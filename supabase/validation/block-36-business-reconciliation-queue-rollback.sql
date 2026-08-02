begin;

do $$
declare
  v_business_id uuid;
  v_user_id uuid;
  v_restaurant_id uuid;
  v_guest_id uuid;
  v_item_id uuid;
  v_second_item_id uuid;
  v_third_item_id uuid;
  v_cross_business_id uuid := gen_random_uuid();
  v_cross_restaurant_id uuid;
  v_cross_item_id uuid;
  v_result jsonb;
begin
  select membership.business_id, membership.user_id, restaurant.id
  into v_business_id, v_user_id, v_restaurant_id
  from public.business_memberships membership
  join public.restaurants restaurant
    on restaurant.business_id = membership.business_id
  order by membership.created_at
  limit 1;

  select identity.id into v_guest_id
  from public.guest_identities identity
  where identity.business_id = v_business_id
  order by identity.created_at
  limit 1;

  if v_business_id is null or v_user_id is null or v_restaurant_id is null then
    raise exception 'An existing Business member and restaurant are required';
  end if;

  if has_table_privilege('anon', 'public.reconciliation_queue_items', 'select')
    or has_table_privilege('anon', 'public.reconciliation_queue_audit_events', 'select')
    or has_function_privilege(
      'anon',
      'public.create_reconciliation_queue_item_v1(uuid,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid)',
      'execute'
    ) then
    raise exception 'Anonymous access to reconciliation queue is not allowed';
  end if;

  if has_table_privilege('authenticated', 'public.reconciliation_queue_items', 'insert')
    or has_table_privilege('authenticated', 'public.reconciliation_queue_items', 'update')
    or has_table_privilege('authenticated', 'public.reconciliation_queue_items', 'delete')
    or has_table_privilege('authenticated', 'public.reconciliation_queue_audit_events', 'insert')
    or has_table_privilege('authenticated', 'public.reconciliation_queue_audit_events', 'update')
    or has_table_privilege('authenticated', 'public.reconciliation_queue_audit_events', 'delete') then
    raise exception 'Authenticated users unexpectedly have direct queue mutation privileges';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('block36.test_user', v_user_id::text, true);
  perform set_config('block36.test_business', v_business_id::text, true);

  select public.create_reconciliation_queue_item_v1(
    p_business_id => v_business_id,
    p_reconciliation_type => 'merge_review',
    p_priority => 'medium',
    p_origin => 'Block 36 searchable merge review',
    p_restaurant_id => v_restaurant_id,
    p_guest_identity_id => v_guest_id,
    p_assigned_to => v_user_id
  ) into v_result;
  v_item_id := (v_result ->> 'item_id')::uuid;

  select public.create_reconciliation_queue_item_v1(
    p_business_id => v_business_id,
    p_reconciliation_type => 'crm_review',
    p_priority => 'low',
    p_origin => 'Block 36 searchable CRM review'
  ) into v_result;
  v_second_item_id := (v_result ->> 'item_id')::uuid;

  select public.create_reconciliation_queue_item_v1(
    p_business_id => v_business_id,
    p_reconciliation_type => 'conflict_review',
    p_priority => 'high',
    p_origin => 'Block 36 searchable conflict review'
  ) into v_result;
  v_third_item_id := (v_result ->> 'item_id')::uuid;

  perform public.update_reconciliation_queue_status_v1(v_item_id, 'in_review');
  perform public.update_reconciliation_queue_status_v1(v_item_id, 'completed');
  perform public.update_reconciliation_queue_priority_v1(v_item_id, 'high');
  perform public.assign_reconciliation_queue_item_v1(v_item_id, null);
  perform public.assign_reconciliation_queue_item_v1(v_item_id, v_user_id);

  if not exists (
    select 1 from public.reconciliation_queue_items item
    where item.id = v_item_id
      and item.business_id = v_business_id
      and item.status = 'completed'
      and item.priority = 'high'
      and item.assigned_to = v_user_id
      and item.created_by = v_user_id
  ) then
    raise exception 'Queue status, priority, or assignee update failed';
  end if;

  if (select count(*) from public.reconciliation_queue_audit_events audit
      where audit.reconciliation_item_id = v_item_id) <> 6 then
    raise exception 'Expected creation plus five append-only audit events';
  end if;

  if not exists (
    select 1
    from public.list_reconciliation_assignees_v1(v_business_id) member
    where member.user_id = v_user_id
  ) then
    raise exception 'Business member is not available for assignment';
  end if;

  begin
    update public.reconciliation_queue_audit_events
    set new_value = '{}'::jsonb
    where reconciliation_item_id = v_item_id;
    raise exception 'Append-only audit unexpectedly allowed mutation';
  exception when sqlstate '55000' then
    null;
  end;

  insert into public.businesses (id, name, slug)
  values (
    v_cross_business_id,
    'Block 36 Cross Business',
    'block-36-cross-' || txid_current()::text
  );
  insert into public.restaurants (name, slug, business_id)
  values (
    'Block 36 Cross Restaurant',
    'block-36-cross-restaurant-' || txid_current()::text,
    v_cross_business_id
  ) returning id into v_cross_restaurant_id;

  begin
    perform public.create_reconciliation_queue_item_v1(
      p_business_id => v_business_id,
      p_reconciliation_type => 'crm_review',
      p_priority => 'medium',
      p_origin => 'Block 36 invalid cross-business link',
      p_restaurant_id => v_cross_restaurant_id
    );
    raise exception 'Cross-Business restaurant link unexpectedly succeeded';
  exception when sqlstate '23514' then
    null;
  end;

  begin
    perform public.create_reconciliation_queue_item_v1(
      p_business_id => v_cross_business_id,
      p_reconciliation_type => 'crm_review',
      p_priority => 'medium',
      p_origin => 'Block 36 membership denial'
    );
    raise exception 'Cross-Business creation unexpectedly succeeded';
  exception when sqlstate '42501' then
    null;
  end;

  insert into public.reconciliation_queue_items (
    business_id, reconciliation_type, priority, origin
  ) values (
    v_cross_business_id, 'recovery_review', 'high',
    'Block 36 RLS invisible cross-business item'
  ) returning id into v_cross_item_id;

  perform set_config('block36.cross_item', v_cross_item_id::text, true);

  if (select count(*) from public.reconciliation_queue_items item
      where item.business_id = v_business_id
        and item.origin ilike 'Block 36 searchable%') <> 3 then
    raise exception 'Search predicate did not return the expected queue items';
  end if;

  if (select count(*) from public.reconciliation_queue_items item
      where item.business_id = v_business_id
        and item.status = 'completed'
        and item.priority = 'high'
        and item.reconciliation_type = 'merge_review') <> 1 then
    raise exception 'Combined status, priority, and type filters failed';
  end if;

  if (select item.priority from public.reconciliation_queue_items item
      where item.id in (v_item_id, v_second_item_id, v_third_item_id)
      order by
        case item.priority when 'high' then 1 when 'medium' then 2 else 3 end,
        item.created_at,
        item.id
      limit 1) <> 'high' then
    raise exception 'Queue ordering validation failed';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('block36.test_user'), true);

do $$
begin
  if exists (
    select 1 from public.reconciliation_queue_items item
    where item.id = current_setting('block36.cross_item')::uuid
  ) then
    raise exception 'RLS exposed a cross-Business reconciliation item';
  end if;

  if (select count(*) from public.reconciliation_queue_items item
      where item.business_id = current_setting('block36.test_business')::uuid
        and item.origin ilike 'Block 36 searchable%') <> 3 then
    raise exception 'RLS hid same-Business reconciliation items';
  end if;
end;
$$;

rollback;

select 'block_36_business_reconciliation_queue_valid' as result;
