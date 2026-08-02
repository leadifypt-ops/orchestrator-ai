-- Block 30: transactional, manual guest identity merge.

alter table public.guest_identities
  add column if not exists merged_into_identity_id uuid
    references public.guest_identities(id) on delete restrict,
  add column if not exists merged_at timestamptz,
  add column if not exists merged_by uuid
    references auth.users(id) on delete set null;

create index if not exists guest_identities_merged_into_idx
  on public.guest_identities (merged_into_identity_id)
  where merged_into_identity_id is not null;

alter table public.guest_identities
  drop constraint if exists guest_identities_merge_state_valid;
alter table public.guest_identities
  add constraint guest_identities_merge_state_valid
  check (
    (
      merged_into_identity_id is null
      and merged_at is null
      and merged_by is null
    )
    or (
      merged_into_identity_id is not null
      and merged_at is not null
    )
  );

alter table public.guest_crm_audit_events
  add column if not exists source_identity_id uuid
    references public.guest_identities(id) on delete restrict,
  add column if not exists target_identity_id uuid
    references public.guest_identities(id) on delete restrict,
  add column if not exists reservations_reassigned integer,
  add column if not exists profiles_reassigned integer,
  add column if not exists conflicts jsonb,
  add column if not exists decision jsonb;

create index if not exists guest_crm_audit_source_identity_idx
  on public.guest_crm_audit_events (source_identity_id, created_at desc)
  where source_identity_id is not null;
create index if not exists guest_crm_audit_target_identity_idx
  on public.guest_crm_audit_events (target_identity_id, created_at desc)
  where target_identity_id is not null;

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

  update public.reservations
  set guest_identity_id = v_target.id
  where guest_identity_id = v_source.id;
  get diagnostics v_reservations_reassigned = row_count;

  update public.reservation_guests
  set guest_identity_id = v_target.id,
      updated_at = now()
  where guest_identity_id = v_source.id;
  get diagnostics v_profiles_reassigned = row_count;

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

  return jsonb_build_object(
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
