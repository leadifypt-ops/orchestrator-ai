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
  v_merge_audit_id uuid;
  v_recovery_event_id uuid;
  v_execution_event_id uuid;
  v_merge_result jsonb;
  v_recovery_result jsonb;
  v_execution_result jsonb;
  v_merge_audit_before jsonb;
  v_merge_audit_after jsonb;
  v_aliases_before jsonb;
  v_aliases_after jsonb;
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

  if has_function_privilege(
    'anon',
    'public.recover_guest_merge_v1(uuid,text)',
    'execute'
  ) then
    raise exception 'anon unexpectedly has recovery RPC execution access';
  end if;

  if has_table_privilege(
    'anon',
    'public.guest_merge_recovery_execution_events',
    'select'
  ) then
    raise exception 'anon unexpectedly has recovery execution audit access';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  insert into public.guest_identities (business_id, full_name, email, phone)
  values (
    v_business_id,
    'Block 34 Synthetic Source',
    format('block34-source-%s@example.invalid', v_suffix),
    format('+351940%s', v_suffix)
  ) returning id into v_source_id;

  insert into public.guest_identities (business_id, full_name, email, phone)
  values (
    v_business_id,
    'Block 34 Synthetic Target',
    format('block34-target-%s@example.invalid', v_suffix),
    format('+351941%s', v_suffix)
  ) returning id into v_target_id;

  insert into public.reservations (
    business_id, restaurant_id, guest_name, guest_email, guest_phone,
    requested_date, requested_time, party_size, status, source,
    guest_identity_id
  ) values (
    v_business_id, v_restaurant_id, 'Block 34 Synthetic Source',
    format('block34-source-%s@example.invalid', v_suffix),
    format('+351940%s', v_suffix), current_date, '19:00', 1,
    'pending', 'manual', v_source_id
  ) returning id into v_reservation_id;

  insert into public.reservation_guests (
    canonical_reservation_id, full_name, guest_position, is_host,
    guest_identity_id
  ) values (
    v_reservation_id, 'Block 34 Synthetic Source', 1, true, v_source_id
  ) returning id into v_guest_id;

  insert into public.guest_dietary_profiles (
    reservation_guest_id, allergies, notes
  ) values (
    v_guest_id, array['block34-synthetic-allergy'], 'rollback-only validation'
  ) returning id into v_dietary_id;

  select public.merge_guest_identities_v1(v_source_id, v_target_id, 'MERGE')
  into v_merge_result;
  v_merge_audit_id := (v_merge_result ->> 'merge_audit_event_id')::uuid;

  select to_jsonb(audit) into v_merge_audit_before
  from public.guest_crm_audit_events audit
  where audit.id = v_merge_audit_id;

  select coalesce(jsonb_agg(to_jsonb(alias) order by alias.id), '[]'::jsonb)
  into v_aliases_before
  from public.guest_contact_aliases alias
  where alias.source_guest_identity_id = v_source_id;

  select public.record_guest_merge_recovery_preview_v1(
    v_merge_audit_id,
    'RECOVERY'
  ) into v_recovery_result;
  v_recovery_event_id := (v_recovery_result ->> 'recovery_event_id')::uuid;

  select public.recover_guest_merge_v1(v_recovery_event_id, 'RECOVERY')
  into v_execution_result;
  v_execution_event_id := (v_execution_result ->> 'execution_event_id')::uuid;

  if not exists (
    select 1 from public.reservations reservation
    where reservation.id = v_reservation_id
      and reservation.guest_identity_id = v_source_id
  ) then
    raise exception 'Provenance-backed reservation was not restored to source';
  end if;

  if not exists (
    select 1 from public.reservation_guests guest
    where guest.id = v_guest_id
      and guest.guest_identity_id = v_source_id
  ) then
    raise exception 'Provenance-backed reservation guest was not restored to source';
  end if;

  if not exists (
    select 1 from public.guest_dietary_profiles profile
    where profile.id = v_dietary_id
      and profile.reservation_guest_id = v_guest_id
  ) then
    raise exception 'Dietary profile attachment changed during recovery';
  end if;

  select to_jsonb(audit) into v_merge_audit_after
  from public.guest_crm_audit_events audit
  where audit.id = v_merge_audit_id;

  if v_merge_audit_after is distinct from v_merge_audit_before then
    raise exception 'Historical merge audit changed during recovery';
  end if;

  select coalesce(jsonb_agg(to_jsonb(alias) order by alias.id), '[]'::jsonb)
  into v_aliases_after
  from public.guest_contact_aliases alias
  where alias.source_guest_identity_id = v_source_id;

  if v_aliases_after is distinct from v_aliases_before then
    raise exception 'Contact aliases changed during recovery';
  end if;

  if not exists (
    select 1 from public.guest_identities source_identity
    where source_identity.id = v_source_id
      and source_identity.merged_into_identity_id = v_target_id
      and source_identity.merged_at is not null
  ) then
    raise exception 'Source identity merge state changed during recovery';
  end if;

  if not exists (
    select 1
    from public.guest_merge_recovery_execution_events execution
    where execution.id = v_execution_event_id
      and execution.recovery_event_id = v_recovery_event_id
      and execution.merge_audit_event_id = v_merge_audit_id
      and execution.business_id = v_business_id
      and execution.source_identity_id = v_source_id
      and execution.target_identity_id = v_target_id
      and execution.recovered_record_count = 2
      and execution.skipped_record_count = 2
      and execution.created_by = v_user_id
      and execution.execution_summary #>> '{recovered,reservations}' = '1'
      and execution.execution_summary #>> '{recovered,reservation_guests}' = '1'
  ) then
    raise exception 'Recovery execution audit was not created correctly';
  end if;

  raise notice 'block_34_provenance_backed_recovery_valid: execution=%',
    v_execution_event_id;
end;
$$;

rollback;

select 'block_34_rollback_functional_validation_valid' as result;
