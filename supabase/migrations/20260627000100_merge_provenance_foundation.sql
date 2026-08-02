-- Block 33: immutable per-record provenance for future manual guest merges.

create table if not exists public.guest_merge_provenance_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  merge_audit_event_id uuid not null references public.guest_crm_audit_events(id) on delete restrict,
  source_identity_id uuid not null references public.guest_identities(id) on delete restrict,
  target_identity_id uuid not null references public.guest_identities(id) on delete restrict,
  record_table text not null check (
    record_table in ('reservations', 'reservation_guests', 'guest_contact_aliases')
  ),
  record_id uuid not null,
  previous_identity_id uuid not null references public.guest_identities(id) on delete restrict,
  new_identity_id uuid not null references public.guest_identities(id) on delete restrict,
  provenance_type text not null check (
    provenance_type in ('identity_reassigned', 'contact_alias_preserved')
  ),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (merge_audit_event_id, record_table, record_id, provenance_type),
  check (previous_identity_id = source_identity_id),
  check (new_identity_id = target_identity_id)
);

create index if not exists guest_merge_provenance_business_created_idx
  on public.guest_merge_provenance_records (business_id, created_at desc);
create index if not exists guest_merge_provenance_audit_record_idx
  on public.guest_merge_provenance_records (merge_audit_event_id, record_table);

alter table public.guest_merge_provenance_records enable row level security;
revoke all on public.guest_merge_provenance_records from anon, authenticated;
grant select on public.guest_merge_provenance_records to authenticated;

drop policy if exists "Members can read guest merge provenance"
  on public.guest_merge_provenance_records;
create policy "Members can read guest merge provenance"
  on public.guest_merge_provenance_records
  for select
  to authenticated
  using (public.is_business_member(business_id));
create or replace function public.merge_guest_identities_v1(
  p_source_identity_id uuid,
  p_target_identity_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.guest_identities%rowtype;
  v_target public.guest_identities%rowtype;
  v_source_profile public.guest_crm_profiles%rowtype;
  v_target_profile public.guest_crm_profiles%rowtype;
  v_audit_event_id uuid := gen_random_uuid();
  v_reservation_record_ids uuid[] := array[]::uuid[];
  v_guest_record_ids uuid[] := array[]::uuid[];
  v_reservations_reassigned integer := 0;
  v_profiles_reassigned integer := 0;
  v_conflicts jsonb;
  v_before jsonb;
  v_after jsonb;
  v_decision jsonb;
  v_source_allergies text[];
  v_target_allergies text[];
  v_source_intolerances text[];
  v_target_intolerances text[];
  v_source_restrictions text[];
  v_target_restrictions text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_source_identity_id is null
    or p_target_identity_id is null
    or p_source_identity_id = p_target_identity_id then
    raise exception 'Source and destination must be different identities'
      using errcode = '22023';
  end if;

  if p_confirmation is distinct from 'MERGE' then
    raise exception 'Explicit merge confirmation is required'
      using errcode = '22023';
  end if;

  select * into v_source
  from public.guest_identities identity
  where identity.id = p_source_identity_id
  for update;

  select * into v_target
  from public.guest_identities identity
  where identity.id = p_target_identity_id
  for update;

  if v_source.id is null or v_target.id is null then
    raise exception 'Guest identity not found' using errcode = 'P0002';
  end if;

  if v_source.business_id <> v_target.business_id then
    raise exception 'Guest identities must belong to the same Business'
      using errcode = '42501';
  end if;

  if not public.is_business_member(v_source.business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;

  if v_source.merged_into_identity_id is not null then
    raise exception 'Source identity is already merged'
      using errcode = '22023';
  end if;

  if v_target.merged_into_identity_id is not null then
    raise exception 'Destination identity is inactive'
      using errcode = '22023';
  end if;

  select * into v_source_profile
  from public.guest_crm_profiles profile
  where profile.guest_identity_id = v_source.id;

  select * into v_target_profile
  from public.guest_crm_profiles profile
  where profile.guest_identity_id = v_target.id;

  select
    coalesce(array_agg(distinct item order by item), '{}')
  into v_source_allergies
  from public.reservation_guests guest
  join public.guest_dietary_profiles profile
    on profile.reservation_guest_id = guest.id
  cross join unnest(profile.allergies) as allergy(item)
  where guest.guest_identity_id = v_source.id;

  select
    coalesce(array_agg(distinct item order by item), '{}')
  into v_target_allergies
  from public.reservation_guests guest
  join public.guest_dietary_profiles profile
    on profile.reservation_guest_id = guest.id
  cross join unnest(profile.allergies) as allergy(item)
  where guest.guest_identity_id = v_target.id;

  select
    coalesce(array_agg(distinct item order by item), '{}')
  into v_source_intolerances
  from public.reservation_guests guest
  join public.guest_dietary_profiles profile
    on profile.reservation_guest_id = guest.id
  cross join unnest(profile.intolerances) as intolerance(item)
  where guest.guest_identity_id = v_source.id;

  select
    coalesce(array_agg(distinct item order by item), '{}')
  into v_target_intolerances
  from public.reservation_guests guest
  join public.guest_dietary_profiles profile
    on profile.reservation_guest_id = guest.id
  cross join unnest(profile.intolerances) as intolerance(item)
  where guest.guest_identity_id = v_target.id;

  select
    coalesce(array_agg(distinct item order by item), '{}')
  into v_source_restrictions
  from public.reservation_guests guest
  join public.guest_dietary_profiles profile
    on profile.reservation_guest_id = guest.id
  cross join unnest(profile.dietary_restrictions) as restriction(item)
  where guest.guest_identity_id = v_source.id;

  select
    coalesce(array_agg(distinct item order by item), '{}')
  into v_target_restrictions
  from public.reservation_guests guest
  join public.guest_dietary_profiles profile
    on profile.reservation_guest_id = guest.id
  cross join unnest(profile.dietary_restrictions) as restriction(item)
  where guest.guest_identity_id = v_target.id;

  v_conflicts := jsonb_strip_nulls(jsonb_build_object(
    'full_name', case
      when v_source.full_name is distinct from v_target.full_name
      then jsonb_build_object('source', v_source.full_name, 'target', v_target.full_name)
    end,
    'email', case
      when v_source.email is distinct from v_target.email
      then jsonb_build_object('source', v_source.email, 'target', v_target.email)
    end,
    'phone', case
      when v_source.phone is distinct from v_target.phone
      then jsonb_build_object('source', v_source.phone, 'target', v_target.phone)
    end,
    'wine_preferences', case
      when v_source_profile.wine_preferences is distinct from v_target_profile.wine_preferences
      then jsonb_build_object(
        'source', v_source_profile.wine_preferences,
        'target', v_target_profile.wine_preferences
      )
    end,
    'notes', case
      when v_source_profile.notes is distinct from v_target_profile.notes
      then jsonb_build_object('source', v_source_profile.notes, 'target', v_target_profile.notes)
    end,
    'allergies', case
      when v_source_allergies is distinct from v_target_allergies
      then jsonb_build_object('source', v_source_allergies, 'target', v_target_allergies)
    end,
    'intolerances', case
      when v_source_intolerances is distinct from v_target_intolerances
      then jsonb_build_object('source', v_source_intolerances, 'target', v_target_intolerances)
    end,
    'dietary_restrictions', case
      when v_source_restrictions is distinct from v_target_restrictions
      then jsonb_build_object('source', v_source_restrictions, 'target', v_target_restrictions)
    end
  ));

  v_before := jsonb_build_object(
    'source', to_jsonb(v_source),
    'target', to_jsonb(v_target),
    'source_crm_profile', to_jsonb(v_source_profile),
    'target_crm_profile', to_jsonb(v_target_profile)
  );

  with reassigned as (
    update public.reservations
    set guest_identity_id = v_target.id
    where guest_identity_id = v_source.id
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[])
  into v_reservation_record_ids
  from reassigned;
  v_reservations_reassigned := cardinality(v_reservation_record_ids);

  with reassigned as (
    update public.reservation_guests
    set guest_identity_id = v_target.id,
        updated_at = now()
    where guest_identity_id = v_source.id
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[])
  into v_guest_record_ids
  from reassigned;
  v_profiles_reassigned := cardinality(v_guest_record_ids);

  update public.guest_identities
  set first_seen_at = least(v_target.first_seen_at, v_source.first_seen_at),
      last_seen_at = greatest(v_target.last_seen_at, v_source.last_seen_at),
      updated_at = now()
  where id = v_target.id;

  update public.guest_identities
  set email = format('merged+%s@invalid.find-dining.local', v_source.id),
      phone = null,
      merged_into_identity_id = v_target.id,
      merged_at = now(),
      merged_by = auth.uid(),
      updated_at = now()
  where id = v_source.id;

  v_decision := jsonb_build_object(
    'strategy', 'destination_wins',
    'destination_fields_overwritten', false,
    'historical_profiles_preserved', true,
    'source_identity_retained', true,
    'source_crm_profile_retained', true
  );

  select jsonb_build_object(
    'source', to_jsonb(source_identity),
    'target', to_jsonb(target_identity)
  )
  into v_after
  from public.guest_identities source_identity
  cross join public.guest_identities target_identity
  where source_identity.id = v_source.id
    and target_identity.id = v_target.id;

  insert into public.guest_crm_audit_events (
    id,
    business_id,
    guest_identity_id,
    changed_by,
    change_type,
    previous_values,
    new_values,
    source_identity_id,
    target_identity_id,
    reservations_reassigned,
    profiles_reassigned,
    conflicts,
    decision
  ) values (
    v_audit_event_id,
    v_source.business_id,
    v_target.id,
    auth.uid(),
    'merge',
    v_before,
    v_after,
    v_source.id,
    v_target.id,
    v_reservations_reassigned,
    v_profiles_reassigned,
    v_conflicts,
    v_decision
  );

  insert into public.guest_merge_provenance_records (
    business_id, merge_audit_event_id, source_identity_id, target_identity_id,
    record_table, record_id, previous_identity_id, new_identity_id,
    provenance_type, created_by
  )
  select
    v_source.business_id, v_audit_event_id, v_source.id, v_target.id,
    'reservations', record_id, v_source.id, v_target.id,
    'identity_reassigned', auth.uid()
  from unnest(v_reservation_record_ids) as reassigned_record(record_id);

  insert into public.guest_merge_provenance_records (
    business_id, merge_audit_event_id, source_identity_id, target_identity_id,
    record_table, record_id, previous_identity_id, new_identity_id,
    provenance_type, created_by
  )
  select
    v_source.business_id, v_audit_event_id, v_source.id, v_target.id,
    'reservation_guests', record_id, v_source.id, v_target.id,
    'identity_reassigned', auth.uid()
  from unnest(v_guest_record_ids) as reassigned_record(record_id);

  insert into public.guest_merge_provenance_records (
    business_id, merge_audit_event_id, source_identity_id, target_identity_id,
    record_table, record_id, previous_identity_id, new_identity_id,
    provenance_type, created_by
  )
  select
    v_source.business_id, v_audit_event_id, v_source.id, v_target.id,
    'guest_contact_aliases', alias.id, v_source.id, v_target.id,
    'contact_alias_preserved', auth.uid()
  from public.guest_contact_aliases alias
  where alias.business_id = v_source.business_id
    and alias.source_guest_identity_id = v_source.id
    and alias.guest_identity_id = v_target.id;

  return jsonb_build_object(
    'merge_audit_event_id', v_audit_event_id,
    'source_identity_id', v_source.id,
    'target_identity_id', v_target.id,
    'reservations_reassigned', v_reservations_reassigned,
    'profiles_reassigned', v_profiles_reassigned,
    'conflicts', v_conflicts,
    'decision', v_decision
  );
end;
$$;

revoke all on function public.merge_guest_identities_v1(
  uuid, uuid, text
) from public, anon;
grant execute on function public.merge_guest_identities_v1(
  uuid, uuid, text
) to authenticated;

notify pgrst, 'reload schema';
