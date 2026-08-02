begin;

do $$
declare
  v_business_id uuid;
  v_user_id uuid;
  v_restaurant_id uuid;
  v_period_id uuid;
  v_capacity_id uuid;
  v_area_id uuid;
  v_exception_id uuid;
  v_cross_business_id uuid := gen_random_uuid();
  v_cross_restaurant_id uuid := gen_random_uuid();
  v_cross_period_id uuid;
  v_result jsonb;
  v_audit_count bigint;
begin
  select membership.business_id, membership.user_id, restaurant.id
  into v_business_id, v_user_id, v_restaurant_id
  from public.business_memberships membership
  join public.restaurants restaurant on restaurant.business_id = membership.business_id
  order by membership.created_at, restaurant.created_at
  limit 1;

  if v_business_id is null or v_user_id is null or v_restaurant_id is null then
    raise exception 'An existing Business member and restaurant are required';
  end if;

  if has_table_privilege('anon', 'public.business_service_periods', 'select')
    or has_table_privilege('anon', 'public.reservation_capacity_settings', 'select')
    or has_table_privilege('anon', 'public.restaurant_areas', 'select')
    or has_table_privilege('anon', 'public.availability_exceptions', 'select')
    or has_table_privilege('anon', 'public.reservation_availability_audit_events', 'select')
    or has_function_privilege(
      'anon',
      'public.save_business_service_period_v1(uuid,uuid,text,time without time zone,time without time zone,boolean,uuid)',
      'execute'
    ) then
    raise exception 'Anonymous availability access is not allowed';
  end if;

  if has_table_privilege('authenticated', 'public.business_service_periods', 'insert')
    or has_table_privilege('authenticated', 'public.reservation_capacity_settings', 'update')
    or has_table_privilege('authenticated', 'public.restaurant_areas', 'delete')
    or has_table_privilege('authenticated', 'public.availability_exceptions', 'insert')
    or has_table_privilege('authenticated', 'public.reservation_availability_audit_events', 'insert') then
    raise exception 'Authenticated availability table access must be read-only';
  end if;

  update public.business_memberships set role = 'owner'
  where business_id = v_business_id and user_id = v_user_id;
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  select public.save_business_service_period_v1(
    v_business_id, v_restaurant_id, 'Block 41 Dinner', '19:00', '23:30', true, null
  ) into v_result;
  v_period_id := (v_result ->> 'period_id')::uuid;

  select public.set_reservation_capacity_v1(v_period_id, 80, 12, 15, 20)
  into v_result;
  v_capacity_id := (v_result ->> 'capacity_id')::uuid;

  select public.save_restaurant_area_v1(
    v_business_id, v_restaurant_id, 'Block 41 Terrace', true, null
  ) into v_result;
  v_area_id := (v_result ->> 'area_id')::uuid;

  select public.save_availability_exception_v1(
    v_business_id, v_restaurant_id, date '2099-12-31', v_period_id,
    'reduced_hours', 'Block 41 reduced service', true, '20:00', '22:00', null
  ) into v_result;
  v_exception_id := (v_result ->> 'exception_id')::uuid;

  if not exists (
    select 1 from public.business_service_periods period
    where period.id = v_period_id and period.business_id = v_business_id
      and period.restaurant_id = v_restaurant_id and period.active
  ) or not exists (
    select 1 from public.reservation_capacity_settings capacity
    where capacity.id = v_capacity_id and capacity.service_period_id = v_period_id
      and capacity.max_covers = 80 and capacity.max_simultaneous_reservations = 12
      and capacity.interval_minutes = 15 and capacity.max_covers_per_interval = 20
  ) or not exists (
    select 1 from public.restaurant_areas area
    where area.id = v_area_id and area.active
  ) or not exists (
    select 1 from public.availability_exceptions exception_row
    where exception_row.id = v_exception_id
      and exception_row.override_start_time = time '20:00'
      and exception_row.override_end_time = time '22:00'
  ) then
    raise exception 'Availability foundation records were not created correctly';
  end if;

  select count(*) into v_audit_count
  from public.reservation_availability_audit_events audit
  where audit.entity_id in (v_period_id, v_capacity_id, v_area_id, v_exception_id);
  if v_audit_count <> 4 then
    raise exception 'Each creation must append one audit event';
  end if;

  perform public.save_business_service_period_v1(
    v_business_id, v_restaurant_id, 'Block 41 Dinner', '19:30', '23:30', false, v_period_id
  );
  perform public.set_reservation_capacity_v1(v_period_id, 90, 14, 30, 24);
  perform public.save_restaurant_area_v1(
    v_business_id, v_restaurant_id, 'Block 41 Terrace', false, v_area_id
  );
  perform public.save_availability_exception_v1(
    v_business_id, v_restaurant_id, date '2099-12-31', v_period_id,
    'reduced_hours', 'Block 41 revised reduced service', false,
    '20:30', '22:30', v_exception_id
  );

  if (select count(*) from public.reservation_availability_audit_events audit
      where audit.entity_id in (v_period_id, v_capacity_id, v_area_id, v_exception_id)) <> 8
    or (select count(*) from public.reservation_availability_audit_events audit
        where audit.entity_id in (v_period_id, v_capacity_id, v_area_id, v_exception_id)
          and audit.change_type = 'updated') <> 4 then
    raise exception 'Updates must append complete audit history';
  end if;

  perform public.save_business_service_period_v1(
    v_business_id, v_restaurant_id, 'Block 41 Dinner', '19:30', '23:30', false, v_period_id
  );
  if (select count(*) from public.reservation_availability_audit_events audit
      where audit.entity_id = v_period_id) <> 2 then
    raise exception 'No-op updates must not append audit noise';
  end if;

  begin
    update public.reservation_availability_audit_events
    set new_values = '{}'::jsonb where entity_id = v_period_id;
    raise exception 'Availability audit history was mutable';
  exception when sqlstate '55000' then null;
  end;

  begin
    delete from public.restaurant_areas where id = v_area_id;
    raise exception 'Availability configuration was deletable';
  exception when sqlstate '55000' then null;
  end;

  update public.business_memberships set role = 'staff'
  where business_id = v_business_id and user_id = v_user_id;
  begin
    perform public.save_restaurant_area_v1(
      v_business_id, v_restaurant_id, 'Staff denied area', true, null
    );
    raise exception 'Staff unexpectedly changed availability configuration';
  exception when sqlstate '42501' then null;
  end;
  update public.business_memberships set role = 'owner'
  where business_id = v_business_id and user_id = v_user_id;

  insert into public.businesses (id, name, slug)
  values (v_cross_business_id, 'Block 41 Cross Business', 'block-41-cross-' || txid_current());
  insert into public.restaurants (id, business_id, name, slug)
  values (
    v_cross_restaurant_id, v_cross_business_id,
    'Block 41 Cross Restaurant', 'block-41-cross-restaurant-' || txid_current()
  );
  insert into public.business_service_periods (
    business_id, restaurant_id, name, start_time, end_time, active
  ) values (
    v_cross_business_id, v_cross_restaurant_id, 'Cross Dinner', '18:00', '22:00', true
  ) returning id into v_cross_period_id;

  begin
    perform public.save_business_service_period_v1(
      v_business_id, v_cross_restaurant_id, 'Invalid Cross Scope', '18:00', '22:00', true, null
    );
    raise exception 'Cross-Business restaurant scope unexpectedly succeeded';
  exception when sqlstate '23514' then null;
  end;

  perform set_config('block41.test_user', v_user_id::text, true);
  perform set_config('block41.test_business', v_business_id::text, true);
  perform set_config('block41.own_period', v_period_id::text, true);
  perform set_config('block41.cross_period', v_cross_period_id::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('block41.test_user'), true);

do $$
begin
  if not exists (
    select 1 from public.business_service_periods period
    where period.id = current_setting('block41.own_period')::uuid
  ) then
    raise exception 'RLS hid same-Business availability configuration';
  end if;
  if exists (
    select 1 from public.business_service_periods period
    where period.id = current_setting('block41.cross_period')::uuid
  ) then
    raise exception 'RLS exposed cross-Business availability configuration';
  end if;
end;
$$;

rollback;

select 'block_41_reservation_capacity_availability_valid' as result;
