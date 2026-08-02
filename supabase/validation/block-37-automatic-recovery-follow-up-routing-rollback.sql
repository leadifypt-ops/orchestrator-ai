begin;

do $$
declare
  v_business_id uuid;
  v_user_id uuid;
  v_source_id uuid;
  v_target_id uuid;
  v_merge_id uuid;
  v_recovery_id uuid;
  v_execution_id uuid;
  v_pending_review_id uuid;
  v_follow_up_review_id uuid;
  v_queue_item_id uuid;
  v_result jsonb;
  v_cross_business_id uuid := gen_random_uuid();
begin
  select membership.business_id, membership.user_id
  into v_business_id, v_user_id
  from public.business_memberships membership
  order by membership.created_at, membership.business_id
  limit 1;

  if v_business_id is null or v_user_id is null then
    raise exception 'An existing Business member is required';
  end if;

  if has_function_privilege(
    'anon',
    'public.route_recovery_follow_up_to_queue_v1()',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.route_recovery_follow_up_to_queue_v1()',
    'execute'
  ) then
    raise exception 'The automatic queue producer must not be directly executable';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('block37.test_user', v_user_id::text, true);
  perform set_config('block37.test_business', v_business_id::text, true);

  insert into public.guest_identities (
    business_id, full_name, email
  ) values (
    v_business_id,
    'Block 37 Source',
    'block37-source-' || txid_current()::text || '@example.test'
  ) returning id into v_source_id;

  insert into public.guest_identities (
    business_id, full_name, email
  ) values (
    v_business_id,
    'Block 37 Target',
    'block37-target-' || txid_current()::text || '@example.test'
  ) returning id into v_target_id;

  insert into public.guest_crm_audit_events (
    business_id,
    guest_identity_id,
    changed_by,
    change_type,
    source_identity_id,
    target_identity_id,
    previous_values,
    new_values,
    reservations_reassigned,
    profiles_reassigned,
    conflicts,
    decision
  ) values (
    v_business_id,
    v_target_id,
    v_user_id,
    'merge',
    v_source_id,
    v_target_id,
    jsonb_build_object('source', jsonb_build_object('id', v_source_id)),
    jsonb_build_object('target', jsonb_build_object('id', v_target_id)),
    1,
    1,
    '{}'::jsonb,
    jsonb_build_object('strategy', 'destination_wins')
  ) returning id into v_merge_id;

  insert into public.guest_merge_recovery_events (
    business_id,
    merge_audit_event_id,
    source_identity_id,
    target_identity_id,
    recovery_type,
    status,
    preview_payload,
    created_by,
    confirmed_at,
    confirmation_text
  ) values (
    v_business_id,
    v_merge_id,
    v_source_id,
    v_target_id,
    'governed_manual_recovery',
    'preview_confirmed',
    '{}'::jsonb,
    v_user_id,
    now(),
    'RECOVERY'
  ) returning id into v_recovery_id;

  insert into public.guest_merge_recovery_execution_events (
    recovery_event_id,
    merge_audit_event_id,
    business_id,
    source_identity_id,
    target_identity_id,
    recovered_record_count,
    skipped_record_count,
    execution_summary,
    created_by
  ) values (
    v_recovery_id,
    v_merge_id,
    v_business_id,
    v_source_id,
    v_target_id,
    2,
    0,
    jsonb_build_object(
      'recovered', jsonb_build_object('reservations', 1, 'reservation_guests', 1)
    ),
    v_user_id
  ) returning id into v_execution_id;

  select review.id into v_pending_review_id
  from public.guest_merge_reconciliation_reviews review
  where review.recovery_execution_event_id = v_execution_id
    and review.review_status = 'pending';

  if v_pending_review_id is null then
    raise exception 'The existing automatic pending review was not created';
  end if;

  if exists (
    select 1 from public.reconciliation_queue_items item
    where item.recovery_execution_event_id = v_execution_id
  ) then
    raise exception 'Pending reviews must not create queue work';
  end if;

  select public.record_guest_merge_reconciliation_review_v1(
    v_execution_id,
    'requires_follow_up',
    'Block 37 explicit operational follow-up'
  ) into v_result;
  v_follow_up_review_id := (v_result ->> 'review_id')::uuid;

  select item.id into v_queue_item_id
  from public.reconciliation_queue_items item
  where item.recovery_execution_event_id = v_execution_id;

  if v_queue_item_id is null or not exists (
    select 1
    from public.reconciliation_queue_items item
    where item.id = v_queue_item_id
      and item.business_id = v_business_id
      and item.reconciliation_type = 'recovery_review'
      and item.status = 'pending'
      and item.priority = 'high'
      and item.merge_audit_event_id = v_merge_id
      and item.recovery_event_id = v_recovery_id
      and item.recovery_execution_event_id = v_execution_id
      and item.reconciliation_review_id = v_follow_up_review_id
      and item.created_by = v_user_id
  ) then
    raise exception 'Requires-follow-up review was not routed with complete provenance';
  end if;

  if (select count(*) from public.reconciliation_queue_audit_events audit
      where audit.reconciliation_item_id = v_queue_item_id) <> 1 then
    raise exception 'Automatic queue creation must append exactly one audit event';
  end if;

  if not exists (
    select 1
    from public.reconciliation_queue_audit_events audit
    where audit.reconciliation_item_id = v_queue_item_id
      and audit.change_type = 'created'
      and audit.changed_by = v_user_id
      and audit.new_value ->> 'producer' = 'post_recovery_review'
      and (audit.new_value ->> 'reconciliation_review_id')::uuid = v_follow_up_review_id
  ) then
    raise exception 'Automatic queue creation audit is incomplete';
  end if;

  perform public.record_guest_merge_reconciliation_review_v1(
    v_execution_id,
    'requires_follow_up',
    'Block 37 repeated follow-up decision'
  );

  if (select count(*) from public.reconciliation_queue_items item
      where item.recovery_execution_event_id = v_execution_id) <> 1
    or (select count(*) from public.reconciliation_queue_audit_events audit
        where audit.reconciliation_item_id = v_queue_item_id) <> 1 then
    raise exception 'Repeated follow-up decisions must be idempotent';
  end if;

  perform public.record_guest_merge_reconciliation_review_v1(
    v_execution_id,
    'completed',
    'Block 37 completed review does not create work'
  );

  if (select count(*) from public.reconciliation_queue_items item
      where item.recovery_execution_event_id = v_execution_id) <> 1 then
    raise exception 'Completed reviews must not create queue work';
  end if;

  insert into public.businesses (id, name, slug)
  values (
    v_cross_business_id,
    'Block 37 Cross Business',
    'block-37-cross-' || txid_current()::text
  );

  begin
    insert into public.reconciliation_queue_items (
      business_id,
      reconciliation_type,
      priority,
      recovery_execution_event_id,
      reconciliation_review_id,
      origin
    ) values (
      v_cross_business_id,
      'recovery_review',
      'high',
      v_execution_id,
      v_follow_up_review_id,
      'Block 37 invalid cross-Business routing'
    );
    raise exception 'Cross-Business execution routing unexpectedly succeeded';
  exception when sqlstate '23514' then
    null;
  end;

  perform set_config('block37.queue_item', v_queue_item_id::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('block37.test_user'), true);

do $$
begin
  if not exists (
    select 1
    from public.reconciliation_queue_items item
    where item.id = current_setting('block37.queue_item')::uuid
      and item.business_id = current_setting('block37.test_business')::uuid
  ) then
    raise exception 'RLS hid the same-Business automatic queue item';
  end if;
end;
$$;

rollback;

select 'block_37_automatic_recovery_follow_up_routing_valid' as result;
