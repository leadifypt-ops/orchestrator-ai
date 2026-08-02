begin;

do $$
declare
  v_business_id uuid;
  v_user_id uuid;
  v_restaurant_id uuid;
  v_source_id uuid;
  v_target_id uuid;
  v_reservation_id uuid;
  v_guest_id uuid;
  v_dietary_id uuid;
  v_audit_event_id uuid;
  v_merge_result jsonb;
  v_suffix text := txid_current()::text;
begin
  select membership.business_id, membership.user_id, restaurant.id
  into v_business_id, v_user_id, v_restaurant_id
  from public.business_memberships membership
  join public.restaurants restaurant
    on restaurant.business_id = membership.business_id
  order by membership.created_at
  limit 1;

  if v_business_id is null or v_user_id is null or v_restaurant_id is null then
    raise exception 'An existing Business member and restaurant are required';
  end if;

  if has_table_privilege('anon', 'public.guest_merge_provenance_records', 'select') then
    raise exception 'anon unexpectedly has provenance SELECT access';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  insert into public.guest_identities (business_id, full_name, email, phone)
  values (
    v_business_id,
    'Block 33 Synthetic Source',
    format('block33-source-%s@example.invalid', v_suffix),
    format('+351930%s', v_suffix)
  ) returning id into v_source_id;

  insert into public.guest_identities (business_id, full_name, email, phone)
  values (
    v_business_id,
    'Block 33 Synthetic Target',
    format('block33-target-%s@example.invalid', v_suffix),
    format('+351931%s', v_suffix)
  ) returning id into v_target_id;

  insert into public.reservations (
    business_id, restaurant_id, guest_name, guest_email, guest_phone,
    requested_date, requested_time, party_size, status, source,
    guest_identity_id
  ) values (
    v_business_id, v_restaurant_id, 'Block 33 Synthetic Source',
    format('block33-source-%s@example.invalid', v_suffix),
    format('+351930%s', v_suffix), current_date, '19:00', 1,
    'pending', 'manual', v_source_id
  ) returning id into v_reservation_id;

  insert into public.reservation_guests (
    canonical_reservation_id, full_name, guest_position, is_host,
    guest_identity_id
  ) values (
    v_reservation_id, 'Block 33 Synthetic Source', 1, true, v_source_id
  ) returning id into v_guest_id;

  insert into public.guest_dietary_profiles (
    reservation_guest_id, allergies, notes
  ) values (
    v_guest_id, array['block33-synthetic-allergy'], 'rollback-only validation'
  ) returning id into v_dietary_id;

  select public.merge_guest_identities_v1(v_source_id, v_target_id, 'MERGE')
  into v_merge_result;
  v_audit_event_id := (v_merge_result ->> 'merge_audit_event_id')::uuid;

  if v_audit_event_id is null or not exists (
    select 1 from public.guest_crm_audit_events audit
    where audit.id = v_audit_event_id
      and audit.business_id = v_business_id
      and audit.source_identity_id = v_source_id
      and audit.target_identity_id = v_target_id
      and audit.change_type = 'merge'
  ) then
    raise exception 'Merge audit event was not created or returned';
  end if;

  if not exists (
    select 1 from public.guest_merge_provenance_records provenance
    where provenance.merge_audit_event_id = v_audit_event_id
      and provenance.business_id = v_business_id
      and provenance.record_table = 'reservations'
      and provenance.record_id = v_reservation_id
      and provenance.previous_identity_id = v_source_id
      and provenance.new_identity_id = v_target_id
      and provenance.provenance_type = 'identity_reassigned'
  ) then
    raise exception 'Reservation provenance was not created';
  end if;

  if not exists (
    select 1 from public.guest_merge_provenance_records provenance
    where provenance.merge_audit_event_id = v_audit_event_id
      and provenance.business_id = v_business_id
      and provenance.record_table = 'reservation_guests'
      and provenance.record_id = v_guest_id
      and provenance.previous_identity_id = v_source_id
      and provenance.new_identity_id = v_target_id
      and provenance.provenance_type = 'identity_reassigned'
  ) then
    raise exception 'Reservation guest provenance was not created';
  end if;

  if (select count(*) from public.guest_merge_provenance_records provenance
      where provenance.merge_audit_event_id = v_audit_event_id
        and provenance.record_table = 'guest_contact_aliases'
        and provenance.provenance_type = 'contact_alias_preserved') <> 2 then
    raise exception 'Expected email and phone alias provenance was not created';
  end if;

  if exists (
    select 1
    from public.guest_merge_provenance_records provenance
    join public.guest_crm_audit_events audit
      on audit.id = provenance.merge_audit_event_id
    where provenance.merge_audit_event_id = v_audit_event_id
      and (
        provenance.business_id <> audit.business_id
        or provenance.source_identity_id <> audit.source_identity_id
        or provenance.target_identity_id <> audit.target_identity_id
      )
  ) then
    raise exception 'Provenance is not scoped to the merge audit Business and identities';
  end if;

  if not exists (
    select 1 from public.reservations reservation
    where reservation.id = v_reservation_id
      and reservation.guest_identity_id = v_target_id
  ) or not exists (
    select 1 from public.reservation_guests guest
    where guest.id = v_guest_id
      and guest.guest_identity_id = v_target_id
  ) or not exists (
    select 1 from public.guest_dietary_profiles profile
    where profile.id = v_dietary_id
      and profile.reservation_guest_id = v_guest_id
  ) then
    raise exception 'Merge reassignment or dietary-profile preservation failed';
  end if;

  raise notice 'block_33_merge_provenance_valid: audit=%', v_audit_event_id;
end;
$$;

rollback;

select 'block_33_rollback_functional_validation_valid' as result;
