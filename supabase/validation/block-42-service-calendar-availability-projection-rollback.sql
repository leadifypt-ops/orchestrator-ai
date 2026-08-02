begin;

do $$
declare
  v_business_id uuid;
  v_user_id uuid;
  v_restaurant_id uuid;
  v_period_id uuid;
  v_overnight_period_id uuid;
  v_calendar_id uuid;
  v_recurring_id uuid;
  v_monday date;
  v_tuesday date;
  v_result jsonb;
  v_reservation_id uuid;
  v_cancelled_id uuid;
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

  v_monday := date '2099-01-01'
    + ((8 - extract(isodow from date '2099-01-01')::integer) % 7);
  v_tuesday := v_monday + 1;

  if has_table_privilege('anon', 'public.service_period_calendar_settings', 'select')
    or has_function_privilege(
      'anon',
      'public.project_restaurant_availability_v1(uuid,uuid,date,date)',
      'execute'
    ) then
    raise exception 'Anonymous calendar/projection access is not allowed';
  end if;

  update public.business_memberships set role = 'owner'
  where business_id = v_business_id and user_id = v_user_id;
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  select public.save_business_service_period_v1(
    v_business_id, v_restaurant_id, 'Block 42 Dinner', '19:00', '23:00', true, null
  ) into v_result;
  v_period_id := (v_result ->> 'period_id')::uuid;

  select setting.id into v_calendar_id
  from public.service_period_calendar_settings setting
  where setting.service_period_id = v_period_id;
  if v_calendar_id is null then
    raise exception 'New service periods must receive a default calendar';
  end if;

  perform public.save_service_period_calendar_v1(
    v_period_id, array[2,4,4]::smallint[]
  );
  if (select operating_weekdays from public.service_period_calendar_settings
      where id = v_calendar_id) <> array[2,4]::smallint[] then
    raise exception 'Service calendar did not normalize ISO weekdays';
  end if;

  perform public.set_reservation_capacity_v1(v_period_id, 80, 12, 15, 20);
  select public.save_availability_exception_v1(
    v_business_id, v_restaurant_id, v_monday, v_period_id,
    'special_day', 'Block 42 special Monday', true, null, null, null
  ) into v_result;

  select public.save_recurring_availability_exception_v1(
    v_business_id, v_restaurant_id, v_period_id, array[2]::smallint[],
    v_tuesday, v_tuesday + 28, 'reduced_hours',
    'Block 42 Tuesday reduced hours', true, '20:00', '22:00', null
  ) into v_result;
  v_recurring_id := (v_result ->> 'exception_id')::uuid;

  insert into public.reservations (
    business_id, restaurant_id, guest_name, guest_email,
    requested_date, requested_time, party_size, status, source
  ) values (
    v_business_id, v_restaurant_id, 'Block 42 Monday Guest',
    'block42-monday@example.test', v_monday, '19:30', 60, 'pending', 'manual'
  ) returning id into v_reservation_id;

  insert into public.reservations (
    business_id, restaurant_id, guest_name, guest_email,
    requested_date, requested_time, party_size, status, source
  ) values (
    v_business_id, v_restaurant_id, 'Block 42 Cancelled Guest',
    'block42-cancelled@example.test', v_monday, '20:00', 80, 'cancelled', 'manual'
  ) returning id into v_cancelled_id;

  insert into public.reservations (
    business_id, restaurant_id, guest_name, guest_email,
    requested_date, requested_time, party_size, status, source
  ) values (
    v_business_id, v_restaurant_id, 'Block 42 Tuesday Guest',
    'block42-tuesday@example.test', v_tuesday, '19:30', 20, 'reviewing', 'manual'
  );

  if not exists (
    select 1 from public.get_restaurant_operational_calendar_v1(
      v_business_id, v_restaurant_id, v_monday, v_tuesday
    ) calendar
    where calendar.service_period_id = v_period_id
      and calendar.operational_date = v_monday
      and not calendar.scheduled
      and calendar.is_open
      and calendar.exception_type = 'special_day'
  ) then
    raise exception 'Special day did not open a regularly closed service day';
  end if;

  if not exists (
    select 1 from public.project_restaurant_availability_v1(
      v_business_id, v_restaurant_id, v_monday, v_tuesday
    ) projection
    where projection.service_period_id = v_period_id
      and projection.operational_date = v_monday
      and projection.total_capacity = 80
      and projection.capacity_used = 60
      and projection.capacity_remaining = 20
      and projection.occupancy_percent = 75.0
      and projection.reservation_count = 1
      and projection.availability_status = 'near_capacity'
  ) then
    raise exception 'Informational projection did not calculate Monday capacity correctly';
  end if;

  if not exists (
    select 1 from public.project_restaurant_availability_v1(
      v_business_id, v_restaurant_id, v_monday, v_tuesday
    ) projection
    where projection.service_period_id = v_period_id
      and projection.operational_date = v_tuesday
      and projection.effective_start_time = time '20:00'
      and projection.effective_end_time = time '22:00'
      and projection.capacity_used = 20
      and projection.reservations_outside_effective_hours = 1
      and projection.covers_outside_effective_hours = 20
  ) then
    raise exception 'Reduced hours or outside-hours visibility is incorrect';
  end if;

  if not exists (
    select 1 from public.list_restaurant_availability_exceptions_v1(
      v_business_id, v_restaurant_id, v_monday, v_tuesday + 7
    ) exception_row
    where exception_row.exception_id = v_recurring_id
      and exception_row.exception_source = 'recurring'
      and exception_row.occurrence_date = v_tuesday
  ) then
    raise exception 'Recurring exception occurrence was not returned';
  end if;

  if not exists (
    select 1 from public.get_restaurant_availability_daily_summary_v1(
      v_business_id, v_restaurant_id, v_monday, v_tuesday
    ) summary
    where summary.operational_date = v_monday
      and summary.total_capacity >= 80
      and summary.capacity_used >= 60
  ) then
    raise exception 'Daily summary did not aggregate the projection';
  end if;

  select public.save_business_service_period_v1(
    v_business_id, v_restaurant_id, 'Block 42 Overnight', '20:00', '02:00', true, null
  ) into v_result;
  v_overnight_period_id := (v_result ->> 'period_id')::uuid;
  perform public.save_service_period_calendar_v1(
    v_overnight_period_id, array[2]::smallint[]
  );
  perform public.set_reservation_capacity_v1(v_overnight_period_id, 50, 10, 30, 15);
  insert into public.reservations (
    business_id, restaurant_id, guest_name, guest_email,
    requested_date, requested_time, party_size, status, source
  ) values (
    v_business_id, v_restaurant_id, 'Block 42 Overnight Guest',
    'block42-overnight@example.test', v_tuesday + 1, '01:00', 4, 'confirmed', 'manual'
  );
  if not exists (
    select 1 from public.project_restaurant_availability_v1(
      v_business_id, v_restaurant_id, v_tuesday, v_tuesday
    ) projection
    where projection.service_period_id = v_overnight_period_id
      and projection.operational_date = v_tuesday
      and projection.capacity_used = 4
  ) then
    raise exception 'Overnight service did not attribute next-date reservations correctly';
  end if;

  if (select status from public.reservations where id = v_reservation_id) <> 'pending'
    or (select status from public.reservations where id = v_cancelled_id) <> 'cancelled' then
    raise exception 'Projection changed reservation state';
  end if;

  if not exists (
    select 1 from public.reservation_availability_audit_events audit
    where audit.entity_type = 'service_calendar' and audit.entity_id = v_calendar_id
      and audit.change_type = 'updated'
  ) or not exists (
    select 1 from public.reservation_availability_audit_events audit
    where audit.entity_type = 'recurring_exception' and audit.entity_id = v_recurring_id
      and audit.change_type = 'created'
  ) then
    raise exception 'Block 42 configuration changes were not audited';
  end if;

  begin
    delete from public.recurring_availability_exceptions where id = v_recurring_id;
    raise exception 'Recurring availability configuration was deletable';
  exception when sqlstate '55000' then null;
  end;

  update public.business_memberships set role = 'staff'
  where business_id = v_business_id and user_id = v_user_id;
  begin
    perform public.save_service_period_calendar_v1(
      v_period_id, array[1,2,3]::smallint[]
    );
    raise exception 'Staff unexpectedly changed the service calendar';
  exception when sqlstate '42501' then null;
  end;
  update public.business_memberships set role = 'owner'
  where business_id = v_business_id and user_id = v_user_id;

  perform set_config('block42.test_user', v_user_id::text, true);
  perform set_config('block42.test_business', v_business_id::text, true);
  perform set_config('block42.test_restaurant', v_restaurant_id::text, true);
  perform set_config('block42.calendar_id', v_calendar_id::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('block42.test_user'), true);

do $$
begin
  if not exists (
    select 1 from public.service_period_calendar_settings setting
    where setting.id = current_setting('block42.calendar_id')::uuid
  ) then
    raise exception 'RLS hid same-Business service calendar configuration';
  end if;
  begin
    perform public.project_restaurant_availability_v1(
      gen_random_uuid(), current_setting('block42.test_restaurant')::uuid,
      current_date, current_date
    );
    raise exception 'Cross-Business projection scope unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

rollback;

select 'block_42_service_calendar_availability_projection_valid' as result;
