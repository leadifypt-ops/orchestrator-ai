-- Block 29: Guest CRM data quality.
-- Existing identity matching remains email-first, then normalized phone.

alter table public.reservation_guests
  add column if not exists email text,
  add column if not exists phone text;

create index if not exists reservation_guests_email_idx
  on public.reservation_guests (email)
  where email is not null;
create index if not exists reservation_guests_phone_idx
  on public.reservation_guests (phone)
  where phone is not null;

create or replace function public.assign_reservation_profile_identity_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_host_identity_id uuid;
begin
  new.email := lower(nullif(trim(new.email), ''));
  new.phone := public.normalize_guest_phone_v1(new.phone);

  if new.canonical_reservation_id is null then
    return new;
  end if;

  select reservation.business_id, reservation.guest_identity_id
  into v_business_id, v_host_identity_id
  from public.reservations reservation
  where reservation.id = new.canonical_reservation_id;

  if new.guest_identity_id is null
    and (new.email is not null or new.phone is not null) then
    new.guest_identity_id := public.resolve_guest_identity_v1(
      v_business_id,
      new.full_name,
      new.email,
      new.phone,
      coalesce(new.created_at, now())
    );
  elsif new.guest_identity_id is null and new.is_host then
    new.guest_identity_id := v_host_identity_id;
  end if;

  return new;
end;
$$;

revoke all on function public.assign_reservation_profile_identity_v1()
  from public, anon, authenticated;

drop trigger if exists reservation_guests_assign_identity
  on public.reservation_guests;
create trigger reservation_guests_assign_identity
before insert or update of full_name, email, phone, canonical_reservation_id, is_host
on public.reservation_guests
for each row execute function public.assign_reservation_profile_identity_v1();

create table if not exists public.guest_crm_profiles (
  guest_identity_id uuid primary key
    references public.guest_identities(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  wine_preferences text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.guest_crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  guest_identity_id uuid not null
    references public.guest_identities(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  change_type text not null default 'correction'
    check (change_type in ('correction', 'merge')),
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists guest_crm_profiles_business_id_idx
  on public.guest_crm_profiles (business_id);
create index if not exists guest_crm_audit_identity_created_idx
  on public.guest_crm_audit_events (guest_identity_id, created_at desc);

alter table public.guest_crm_profiles enable row level security;
alter table public.guest_crm_audit_events enable row level security;

revoke all on public.guest_crm_profiles from anon, authenticated;
revoke all on public.guest_crm_audit_events from anon, authenticated;
grant select on public.guest_crm_profiles to authenticated;
grant select on public.guest_crm_audit_events to authenticated;

drop policy if exists "Members can read guest CRM profiles"
  on public.guest_crm_profiles;
create policy "Members can read guest CRM profiles"
  on public.guest_crm_profiles
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "Members can read guest CRM audit events"
  on public.guest_crm_audit_events;
create policy "Members can read guest CRM audit events"
  on public.guest_crm_audit_events
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.update_guest_crm_profile_v1(
  p_guest_identity_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_wine_preferences text,
  p_notes text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity public.guest_identities%rowtype;
  v_profile public.guest_crm_profiles%rowtype;
  v_email text := lower(nullif(trim(p_email), ''));
  v_phone text := public.normalize_guest_phone_v1(p_phone);
  v_name text := nullif(trim(p_full_name), '');
  v_wine text := nullif(trim(p_wine_preferences), '');
  v_notes text := nullif(trim(p_notes), '');
  v_previous jsonb;
  v_new jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(coalesce(p_full_name, '')) > 160
    or length(coalesce(p_email, '')) > 320
    or length(coalesce(p_phone, '')) > 50
    or length(coalesce(p_wine_preferences, '')) > 2000
    or length(coalesce(p_notes, '')) > 2000
    or (
      v_email is not null
      and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) then
    raise exception 'Invalid guest correction' using errcode = '22023';
  end if;

  select * into v_identity
  from public.guest_identities identity
  where identity.id = p_guest_identity_id;

  if v_identity.id is null
    or not public.is_business_member(v_identity.business_id) then
    raise exception 'Guest identity is not available'
      using errcode = '42501';
  end if;

  if v_email is null and v_phone is null then
    raise exception 'Email or phone is required'
      using errcode = '22023';
  end if;

  if v_email is not null and exists (
    select 1 from public.guest_identities other
    where other.business_id = v_identity.business_id
      and other.email = v_email
      and other.id <> v_identity.id
  ) then
    raise exception 'Email belongs to another guest identity'
      using errcode = '23505';
  end if;

  if v_phone is not null and exists (
    select 1 from public.guest_identities other
    where other.business_id = v_identity.business_id
      and other.phone = v_phone
      and other.id <> v_identity.id
  ) then
    raise exception 'Phone belongs to another guest identity'
      using errcode = '23505';
  end if;

  select * into v_profile
  from public.guest_crm_profiles profile
  where profile.guest_identity_id = v_identity.id;

  v_previous := jsonb_build_object(
    'full_name', v_identity.full_name,
    'email', v_identity.email,
    'phone', v_identity.phone,
    'wine_preferences', v_profile.wine_preferences,
    'notes', v_profile.notes
  );
  v_new := jsonb_build_object(
    'full_name', v_name,
    'email', v_email,
    'phone', v_phone,
    'wine_preferences', v_wine,
    'notes', v_notes
  );

  if v_previous = v_new then
    return true;
  end if;

  update public.guest_identities
  set full_name = v_name,
      email = v_email,
      phone = v_phone,
      updated_at = now()
  where id = v_identity.id;

  insert into public.guest_crm_profiles (
    guest_identity_id,
    business_id,
    wine_preferences,
    notes,
    updated_by
  ) values (
    v_identity.id,
    v_identity.business_id,
    v_wine,
    v_notes,
    auth.uid()
  )
  on conflict (guest_identity_id) do update
  set wine_preferences = excluded.wine_preferences,
      notes = excluded.notes,
      updated_at = now(),
      updated_by = excluded.updated_by;

  insert into public.guest_crm_audit_events (
    business_id,
    guest_identity_id,
    changed_by,
    change_type,
    previous_values,
    new_values
  ) values (
    v_identity.business_id,
    v_identity.id,
    auth.uid(),
    'correction',
    v_previous,
    v_new
  );

  return true;
end;
$$;

revoke all on function public.update_guest_crm_profile_v1(
  uuid, text, text, text, text, text
) from public, anon;
grant execute on function public.update_guest_crm_profile_v1(
  uuid, text, text, text, text, text
) to authenticated;

-- Public reservation functions and contracts are intentionally unchanged.

notify pgrst, 'reload schema';
