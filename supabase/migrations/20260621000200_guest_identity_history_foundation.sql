-- Block 26: business-scoped guest identity and reservation history foundation.

create table if not exists public.guest_identities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_identities_has_contact
    check (email is not null or phone is not null)
);

create unique index if not exists guest_identities_business_email_uidx
  on public.guest_identities (business_id, email)
  where email is not null;
create unique index if not exists guest_identities_business_phone_uidx
  on public.guest_identities (business_id, phone)
  where phone is not null;
create index if not exists guest_identities_business_last_seen_idx
  on public.guest_identities (business_id, last_seen_at desc);

alter table public.reservations
  add column if not exists guest_identity_id uuid
    references public.guest_identities(id) on delete set null;
alter table public.reservation_guests
  add column if not exists guest_identity_id uuid
    references public.guest_identities(id) on delete set null;

create index if not exists reservations_guest_identity_id_idx
  on public.reservations (guest_identity_id);
create index if not exists reservation_guests_guest_identity_id_idx
  on public.reservation_guests (guest_identity_id);

alter table public.guest_identities enable row level security;
revoke all on public.guest_identities from anon, authenticated;
grant select on public.guest_identities to authenticated;

drop policy if exists "Members can read guest identities"
  on public.guest_identities;
create policy "Members can read guest identities"
  on public.guest_identities
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.normalize_guest_phone_v1(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(trim(coalesce(p_phone, '')), '[^0-9+]', '', 'g'), '')
$$;

create or replace function public.resolve_guest_identity_v1(
  p_business_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_seen_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity_id uuid;
  v_email text := lower(nullif(trim(p_email), ''));
  v_phone text := public.normalize_guest_phone_v1(p_phone);
  v_name text := nullif(trim(p_full_name), '');
  v_seen_at timestamptz := coalesce(p_seen_at, now());
begin
  if p_business_id is null or (v_email is null and v_phone is null) then
    return null;
  end if;

  if auth.uid() is not null and not public.is_business_member(p_business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;

  if v_email is not null then
    select identity.id into v_identity_id
    from public.guest_identities identity
    where identity.business_id = p_business_id and identity.email = v_email;
  end if;

  if v_identity_id is null and v_phone is not null then
    select identity.id into v_identity_id
    from public.guest_identities identity
    where identity.business_id = p_business_id and identity.phone = v_phone;
  end if;

  if v_identity_id is null then
    begin
      insert into public.guest_identities (
        business_id, full_name, email, phone, first_seen_at, last_seen_at
      ) values (
        p_business_id, v_name, v_email, v_phone, v_seen_at, v_seen_at
      ) returning id into v_identity_id;
    exception when unique_violation then
      select identity.id into v_identity_id
      from public.guest_identities identity
      where identity.business_id = p_business_id
        and (
          (v_email is not null and identity.email = v_email)
          or (v_phone is not null and identity.phone = v_phone)
        )
      order by case when identity.email = v_email then 0 else 1 end
      limit 1;
    end;
  end if;

  update public.guest_identities identity
  set full_name = coalesce(v_name, identity.full_name),
      email = coalesce(identity.email, v_email),
      phone = case
        when identity.phone is not null or v_phone is null then identity.phone
        when exists (
          select 1 from public.guest_identities other
          where other.business_id = p_business_id
            and other.phone = v_phone
            and other.id <> identity.id
        ) then identity.phone
        else v_phone
      end,
      first_seen_at = least(identity.first_seen_at, v_seen_at),
      last_seen_at = greatest(identity.last_seen_at, v_seen_at),
      updated_at = now()
  where identity.id = v_identity_id;

  return v_identity_id;
end;
$$;

revoke all on function public.normalize_guest_phone_v1(text) from public, anon, authenticated;
revoke all on function public.resolve_guest_identity_v1(uuid, text, text, text, timestamptz) from public, anon, authenticated;

create or replace function public.assign_reservation_guest_identity_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.guest_identity_id is null then
    new.guest_identity_id := public.resolve_guest_identity_v1(
      new.business_id,
      new.guest_name,
      new.guest_email,
      new.guest_phone,
      coalesce(new.created_at, now())
    );
  end if;
  return new;
end;
$$;

revoke all on function public.assign_reservation_guest_identity_v1() from public, anon, authenticated;

create or replace function public.assign_reservation_profile_identity_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.guest_identity_id is null
    and new.is_host
    and new.canonical_reservation_id is not null then
    select reservation.guest_identity_id into new.guest_identity_id
    from public.reservations reservation
    where reservation.id = new.canonical_reservation_id;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_reservation_profile_identity_v1() from public, anon, authenticated;

drop trigger if exists reservations_assign_guest_identity
  on public.reservations;
create trigger reservations_assign_guest_identity
before insert on public.reservations
for each row execute function public.assign_reservation_guest_identity_v1();

drop trigger if exists reservation_guests_assign_identity
  on public.reservation_guests;
create trigger reservation_guests_assign_identity
before insert on public.reservation_guests
for each row execute function public.assign_reservation_profile_identity_v1();

-- Backfill canonical hosts in creation order so first/last seen dates are stable.
do $$
declare
  reservation record;
  v_identity_id uuid;
begin
  for reservation in
    select id, business_id, guest_name, guest_email, guest_phone, created_at
    from public.reservations
    where guest_email is not null or guest_phone is not null
    order by created_at, id
  loop
    v_identity_id := public.resolve_guest_identity_v1(
      reservation.business_id,
      reservation.guest_name,
      reservation.guest_email,
      reservation.guest_phone,
      reservation.created_at
    );

    update public.reservations
    set guest_identity_id = v_identity_id
    where id = reservation.id;

    update public.reservation_guests
    set guest_identity_id = v_identity_id
    where canonical_reservation_id = reservation.id and is_host;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
