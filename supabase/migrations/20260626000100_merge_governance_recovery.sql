-- Block 31: controlled contact aliases, merge audit visibility, and recovery preparation.

create table if not exists public.guest_contact_aliases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  guest_identity_id uuid not null references public.guest_identities(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  normalized_value text not null,
  source text not null default 'merge_preserved_contact',
  source_guest_identity_id uuid references public.guest_identities(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (business_id, contact_type, normalized_value)
);

create index if not exists guest_contact_aliases_identity_created_idx
  on public.guest_contact_aliases (guest_identity_id, created_at desc);
create index if not exists guest_contact_aliases_source_identity_idx
  on public.guest_contact_aliases (source_guest_identity_id)
  where source_guest_identity_id is not null;

alter table public.guest_contact_aliases enable row level security;
revoke all on public.guest_contact_aliases from anon, authenticated;
grant select on public.guest_contact_aliases to authenticated;

drop policy if exists "Members can read guest contact aliases" on public.guest_contact_aliases;
create policy "Members can read guest contact aliases"
  on public.guest_contact_aliases for select to authenticated
  using (public.is_business_member(business_id));

create or replace function public.preserve_merged_guest_contacts_v1()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(nullif(trim(old.email), ''));
  v_phone text := public.normalize_guest_phone_v1(old.phone);
  v_existing_target uuid;
begin
  if new.merged_into_identity_id is null
    or new.merged_into_identity_id is not distinct from old.merged_into_identity_id then
    return new;
  end if;
  if new.business_id <> old.business_id then
    raise exception 'Merged guest identity cannot change Business' using errcode = '42501';
  end if;
  if v_email is not null then
    select alias.guest_identity_id into v_existing_target from public.guest_contact_aliases alias
    where alias.business_id = old.business_id and alias.contact_type = 'email'
      and alias.normalized_value = v_email for update;
    if v_existing_target is not null and v_existing_target <> new.merged_into_identity_id then
      raise exception 'Email alias belongs to another guest identity' using errcode = '23505';
    end if;
    insert into public.guest_contact_aliases (business_id, guest_identity_id, contact_type, contact_value, normalized_value, source, source_guest_identity_id, created_by)
    values (old.business_id, new.merged_into_identity_id, 'email', v_email, v_email, 'merge_preserved_contact', old.id, auth.uid())
    on conflict (business_id, contact_type, normalized_value) do nothing;
  end if;
  if v_phone is not null then
    select alias.guest_identity_id into v_existing_target from public.guest_contact_aliases alias
    where alias.business_id = old.business_id and alias.contact_type = 'phone'
      and alias.normalized_value = v_phone for update;
    if v_existing_target is not null and v_existing_target <> new.merged_into_identity_id then
      raise exception 'Phone alias belongs to another guest identity' using errcode = '23505';
    end if;
    insert into public.guest_contact_aliases (business_id, guest_identity_id, contact_type, contact_value, normalized_value, source, source_guest_identity_id, created_by)
    values (old.business_id, new.merged_into_identity_id, 'phone', old.phone, v_phone, 'merge_preserved_contact', old.id, auth.uid())
    on conflict (business_id, contact_type, normalized_value) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.preserve_merged_guest_contacts_v1() from public, anon, authenticated;
drop trigger if exists guest_identities_preserve_merged_contacts on public.guest_identities;
create trigger guest_identities_preserve_merged_contacts
before update of merged_into_identity_id on public.guest_identities
for each row execute function public.preserve_merged_guest_contacts_v1();

create or replace function public.resolve_guest_identity_v1(
  p_business_id uuid, p_full_name text, p_email text, p_phone text,
  p_seen_at timestamptz default now()
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_identity_id uuid;
  v_email text := lower(nullif(trim(p_email), ''));
  v_phone text := public.normalize_guest_phone_v1(p_phone);
  v_name text := nullif(trim(p_full_name), '');
  v_seen_at timestamptz := coalesce(p_seen_at, now());
begin
  if p_business_id is null or (v_email is null and v_phone is null) then return null; end if;
  if auth.uid() is not null and not public.is_business_member(p_business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;
  if v_email is not null then
    select identity.id into v_identity_id from public.guest_identities identity
    where identity.business_id = p_business_id and identity.merged_into_identity_id is null and identity.email = v_email;
  end if;
  if v_identity_id is null and v_email is not null then
    select alias.guest_identity_id into v_identity_id from public.guest_contact_aliases alias
    join public.guest_identities identity on identity.id = alias.guest_identity_id
    where alias.business_id = p_business_id and alias.contact_type = 'email'
      and alias.normalized_value = v_email and identity.merged_into_identity_id is null;
  end if;
  if v_identity_id is null and v_phone is not null then
    select identity.id into v_identity_id from public.guest_identities identity
    where identity.business_id = p_business_id and identity.merged_into_identity_id is null and identity.phone = v_phone;
  end if;
  if v_identity_id is null and v_phone is not null then
    select alias.guest_identity_id into v_identity_id from public.guest_contact_aliases alias
    join public.guest_identities identity on identity.id = alias.guest_identity_id
    where alias.business_id = p_business_id and alias.contact_type = 'phone'
      and alias.normalized_value = v_phone and identity.merged_into_identity_id is null;
  end if;
  if v_identity_id is null then
    begin
      insert into public.guest_identities (business_id, full_name, email, phone, first_seen_at, last_seen_at)
      values (p_business_id, v_name, v_email, v_phone, v_seen_at, v_seen_at) returning id into v_identity_id;
    exception when unique_violation then
      select identity.id into v_identity_id from public.guest_identities identity
      where identity.business_id = p_business_id and identity.merged_into_identity_id is null
        and ((v_email is not null and identity.email = v_email) or (v_phone is not null and identity.phone = v_phone))
      order by case when identity.email = v_email then 0 else 1 end limit 1;
    end;
  end if;
  update public.guest_identities identity
  set full_name = coalesce(v_name, identity.full_name), email = coalesce(identity.email, v_email),
      phone = case when identity.phone is not null or v_phone is null then identity.phone
        when exists (select 1 from public.guest_identities other where other.business_id = p_business_id and other.phone = v_phone and other.id <> identity.id) then identity.phone
        else v_phone end,
      first_seen_at = least(identity.first_seen_at, v_seen_at), last_seen_at = greatest(identity.last_seen_at, v_seen_at), updated_at = now()
  where identity.id = v_identity_id;
  return v_identity_id;
end;
$$;

revoke all on function public.resolve_guest_identity_v1(uuid, text, text, text, timestamptz) from public, anon, authenticated;
notify pgrst, 'reload schema';
