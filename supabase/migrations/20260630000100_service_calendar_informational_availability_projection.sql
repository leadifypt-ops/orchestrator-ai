-- Block 42: Service Calendar & Informational Availability Projection.
-- Every projection in this migration is informational. Nothing here blocks,
-- confirms, declines, seats, assigns, or otherwise mutates a reservation.

alter table public.availability_exceptions
  drop constraint if exists availability_exceptions_exception_type_check;
alter table public.availability_exceptions
  add constraint availability_exceptions_exception_type_check check (
    exception_type in (
      'closed', 'private_event', 'maintenance', 'reduced_hours', 'special_day', 'other'
    )
  );

alter table public.reservation_availability_audit_events
  drop constraint if exists reservation_availability_audit_events_entity_type_check;
alter table public.reservation_availability_audit_events
  add constraint reservation_availability_audit_events_entity_type_check check (
    entity_type in (
      'service_period', 'capacity', 'area', 'exception',
      'service_calendar', 'recurring_exception'
    )
  );

create table public.service_period_calendar_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  service_period_id uuid not null unique,
  operating_weekdays smallint[] not null default array[1,2,3,4,5,6,7]::smallint[],
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_period_calendar_weekdays_check check (
    cardinality(operating_weekdays) <= 7
    and operating_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint service_period_calendar_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict,
  constraint service_period_calendar_period_scope_fk
    foreign key (service_period_id, business_id, restaurant_id)
    references public.business_service_periods(id, business_id, restaurant_id)
    on update restrict on delete restrict
);

create index service_period_calendar_business_restaurant_idx
  on public.service_period_calendar_settings (business_id, restaurant_id);

create table public.recurring_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  service_period_id uuid,
  operating_weekdays smallint[] not null,
  valid_from date not null,
  valid_until date,
  exception_type text not null check (
    exception_type in (
      'closed', 'private_event', 'maintenance', 'reduced_hours', 'special_day', 'other'
    )
  ),
  reason text not null check (length(trim(reason)) between 1 and 500),
  override_start_time time without time zone,
  override_end_time time without time zone,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_availability_weekdays_check check (
    cardinality(operating_weekdays) between 1 and 7
    and operating_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint recurring_availability_date_range_check check (
    valid_until is null or valid_until >= valid_from
  ),
  constraint recurring_availability_reduced_hours_check check (
    (
      exception_type = 'reduced_hours'
      and override_start_time is not null
      and override_end_time is not null
      and override_start_time <> override_end_time
    ) or (
      exception_type <> 'reduced_hours'
      and override_start_time is null
      and override_end_time is null
    )
  ),
  constraint recurring_availability_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict,
  constraint recurring_availability_period_scope_fk
    foreign key (service_period_id, business_id, restaurant_id)
    references public.business_service_periods(id, business_id, restaurant_id)
    on update restrict on delete restrict
);

create index recurring_availability_business_restaurant_date_idx
  on public.recurring_availability_exceptions (
    business_id, restaurant_id, active, valid_from, valid_until
  );

create trigger service_period_calendar_set_updated_at
before update on public.service_period_calendar_settings
for each row execute function public.set_reservation_availability_updated_at_v1();

create trigger recurring_availability_exceptions_set_updated_at
before update on public.recurring_availability_exceptions
for each row execute function public.set_reservation_availability_updated_at_v1();

create trigger service_period_calendar_prevent_delete
before delete on public.service_period_calendar_settings
for each row execute function public.prevent_reservation_availability_history_mutation_v1();

create trigger recurring_availability_exceptions_prevent_delete
before delete on public.recurring_availability_exceptions
for each row execute function public.prevent_reservation_availability_history_mutation_v1();

insert into public.service_period_calendar_settings (
  business_id, restaurant_id, service_period_id, operating_weekdays
)
select
  period.business_id,
  period.restaurant_id,
  period.id,
  array[1,2,3,4,5,6,7]::smallint[]
from public.business_service_periods period
on conflict (service_period_id) do nothing;

insert into public.reservation_availability_audit_events (
  business_id, restaurant_id, entity_type, entity_id, change_type,
  previous_values, new_values, changed_by
)
select
  setting.business_id,
  setting.restaurant_id,
  'service_calendar',
  setting.id,
  'created',
  '{}'::jsonb,
  jsonb_build_object(
    'service_period_id', setting.service_period_id,
    'operating_weekdays', setting.operating_weekdays,
    'source', 'block_42_backfill'
  ),
  null
from public.service_period_calendar_settings setting
where not exists (
  select 1
  from public.reservation_availability_audit_events audit
  where audit.entity_type = 'service_calendar'
    and audit.entity_id = setting.id
);

create or replace function public.create_service_period_calendar_default_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_setting_id uuid;
begin
  insert into public.service_period_calendar_settings (
    business_id, restaurant_id, service_period_id, operating_weekdays,
    created_by, updated_by
  ) values (
    new.business_id, new.restaurant_id, new.id,
    array[1,2,3,4,5,6,7]::smallint[], auth.uid(), auth.uid()
  )
  on conflict (service_period_id) do nothing
  returning id into v_setting_id;

  if v_setting_id is not null then
    insert into public.reservation_availability_audit_events (
      business_id, restaurant_id, entity_type, entity_id, change_type,
      previous_values, new_values, changed_by
    ) values (
      new.business_id, new.restaurant_id, 'service_calendar', v_setting_id,
      'created', '{}'::jsonb,
      jsonb_build_object(
        'service_period_id', new.id,
        'operating_weekdays', array[1,2,3,4,5,6,7]::smallint[],
        'source', 'service_period_default'
      ),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

revoke all on function public.create_service_period_calendar_default_v1()
  from public, anon, authenticated;

create trigger business_service_periods_create_calendar_default
after insert on public.business_service_periods
for each row execute function public.create_service_period_calendar_default_v1();

create or replace function public.assert_reservation_availability_member_v1(
  p_business_id uuid,
  p_restaurant_id uuid
)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.business_memberships membership
    join public.restaurants restaurant
      on restaurant.business_id = membership.business_id
    where membership.business_id = p_business_id
      and membership.user_id = auth.uid()
      and restaurant.id = p_restaurant_id
  ) then
    raise exception 'Business membership and restaurant scope required'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_reservation_availability_member_v1(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.save_service_period_calendar_v1(
  p_service_period_id uuid,
  p_operating_weekdays smallint[]
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_period public.business_service_periods%rowtype;
  v_setting public.service_period_calendar_settings%rowtype;
  v_weekdays smallint[];
  v_previous jsonb;
  v_change text;
begin
  select * into v_period
  from public.business_service_periods period
  where period.id = p_service_period_id;
  if v_period.id is null then
    raise exception 'Service period not found' using errcode = 'P0002';
  end if;
  perform public.assert_reservation_availability_manager_v1(v_period.business_id);
  if p_operating_weekdays is null or exists (
    select 1 from unnest(p_operating_weekdays) weekday
    where weekday not between 1 and 7
  ) then
    raise exception 'Operating weekdays must use ISO values 1 through 7'
      using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct weekday order by weekday), '{}'::smallint[])
  into v_weekdays
  from unnest(p_operating_weekdays) weekday;

  select * into v_setting
  from public.service_period_calendar_settings setting
  where setting.service_period_id = p_service_period_id
  for update;

  if v_setting.id is null then
    insert into public.service_period_calendar_settings (
      business_id, restaurant_id, service_period_id, operating_weekdays,
      created_by, updated_by
    ) values (
      v_period.business_id, v_period.restaurant_id, v_period.id, v_weekdays,
      auth.uid(), auth.uid()
    ) returning * into v_setting;
    v_previous := '{}'::jsonb;
    v_change := 'created';
  else
    if v_setting.operating_weekdays = v_weekdays then
      return jsonb_build_object('calendar_id', v_setting.id, 'changed', false);
    end if;
    v_previous := jsonb_build_object(
      'service_period_id', v_setting.service_period_id,
      'operating_weekdays', v_setting.operating_weekdays
    );
    update public.service_period_calendar_settings
    set operating_weekdays = v_weekdays, updated_by = auth.uid()
    where id = v_setting.id
    returning * into v_setting;
    v_change := 'updated';
  end if;

  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    v_setting.business_id, v_setting.restaurant_id, 'service_calendar',
    v_setting.id, v_change, v_previous,
    jsonb_build_object(
      'service_period_id', v_setting.service_period_id,
      'operating_weekdays', v_setting.operating_weekdays
    ), auth.uid()
  );
  return jsonb_build_object('calendar_id', v_setting.id, 'changed', true);
end;
$$;

create or replace function public.save_recurring_availability_exception_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_service_period_id uuid,
  p_operating_weekdays smallint[],
  p_valid_from date,
  p_valid_until date,
  p_exception_type text,
  p_reason text,
  p_active boolean,
  p_override_start_time time without time zone default null,
  p_override_end_time time without time zone default null,
  p_exception_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_exception public.recurring_availability_exceptions%rowtype;
  v_weekdays smallint[];
  v_type text := lower(nullif(trim(p_exception_type), ''));
  v_reason text := nullif(trim(p_reason), '');
  v_previous jsonb;
  v_change text;
begin
  perform public.assert_reservation_availability_manager_v1(p_business_id);
  if not exists (
    select 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id
      and restaurant.business_id = p_business_id
  ) then
    raise exception 'Restaurant does not belong to the Business' using errcode = '23514';
  end if;
  if p_service_period_id is not null and not exists (
    select 1 from public.business_service_periods period
    where period.id = p_service_period_id
      and period.business_id = p_business_id
      and period.restaurant_id = p_restaurant_id
  ) then
    raise exception 'Service period does not belong to the restaurant' using errcode = '23514';
  end if;
  if p_operating_weekdays is null or cardinality(p_operating_weekdays) = 0
    or exists (
      select 1 from unnest(p_operating_weekdays) weekday
      where weekday not between 1 and 7
    ) then
    raise exception 'Recurring exceptions require ISO weekdays 1 through 7'
      using errcode = '22023';
  end if;
  select array_agg(distinct weekday order by weekday)
  into v_weekdays from unnest(p_operating_weekdays) weekday;
  if p_valid_from is null or (p_valid_until is not null and p_valid_until < p_valid_from)
    or v_type not in (
      'closed', 'private_event', 'maintenance', 'reduced_hours', 'special_day', 'other'
    ) or v_reason is null or length(v_reason) > 500 or p_active is null then
    raise exception 'Invalid recurring availability exception' using errcode = '22023';
  end if;
  if v_type = 'reduced_hours' then
    if p_override_start_time is null or p_override_end_time is null
      or p_override_start_time = p_override_end_time then
      raise exception 'Reduced hours require distinct start and end times' using errcode = '22023';
    end if;
  else
    p_override_start_time := null;
    p_override_end_time := null;
  end if;

  if p_exception_id is null then
    insert into public.recurring_availability_exceptions (
      business_id, restaurant_id, service_period_id, operating_weekdays,
      valid_from, valid_until, exception_type, reason,
      override_start_time, override_end_time, active, created_by, updated_by
    ) values (
      p_business_id, p_restaurant_id, p_service_period_id, v_weekdays,
      p_valid_from, p_valid_until, v_type, v_reason,
      p_override_start_time, p_override_end_time, p_active, auth.uid(), auth.uid()
    ) returning * into v_exception;
    v_previous := '{}'::jsonb;
    v_change := 'created';
  else
    select * into v_exception
    from public.recurring_availability_exceptions exception_row
    where exception_row.id = p_exception_id
    for update;
    if v_exception.id is null then
      raise exception 'Recurring exception not found' using errcode = 'P0002';
    end if;
    if v_exception.business_id <> p_business_id
      or v_exception.restaurant_id <> p_restaurant_id then
      raise exception 'Recurring exception scope cannot be changed' using errcode = '42501';
    end if;
    v_previous := jsonb_build_object(
      'service_period_id', v_exception.service_period_id,
      'operating_weekdays', v_exception.operating_weekdays,
      'valid_from', v_exception.valid_from,
      'valid_until', v_exception.valid_until,
      'exception_type', v_exception.exception_type,
      'reason', v_exception.reason,
      'override_start_time', v_exception.override_start_time,
      'override_end_time', v_exception.override_end_time,
      'active', v_exception.active
    );
    if v_exception.service_period_id is not distinct from p_service_period_id
      and v_exception.operating_weekdays = v_weekdays
      and v_exception.valid_from = p_valid_from
      and v_exception.valid_until is not distinct from p_valid_until
      and v_exception.exception_type = v_type
      and v_exception.reason = v_reason
      and v_exception.override_start_time is not distinct from p_override_start_time
      and v_exception.override_end_time is not distinct from p_override_end_time
      and v_exception.active = p_active then
      return jsonb_build_object('exception_id', v_exception.id, 'changed', false);
    end if;
    update public.recurring_availability_exceptions
    set service_period_id = p_service_period_id,
        operating_weekdays = v_weekdays,
        valid_from = p_valid_from,
        valid_until = p_valid_until,
        exception_type = v_type,
        reason = v_reason,
        override_start_time = p_override_start_time,
        override_end_time = p_override_end_time,
        active = p_active,
        updated_by = auth.uid()
    where id = v_exception.id
    returning * into v_exception;
    v_change := 'updated';
  end if;

  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    v_exception.business_id, v_exception.restaurant_id, 'recurring_exception',
    v_exception.id, v_change, v_previous,
    jsonb_build_object(
      'service_period_id', v_exception.service_period_id,
      'operating_weekdays', v_exception.operating_weekdays,
      'valid_from', v_exception.valid_from,
      'valid_until', v_exception.valid_until,
      'exception_type', v_exception.exception_type,
      'reason', v_exception.reason,
      'override_start_time', v_exception.override_start_time,
      'override_end_time', v_exception.override_end_time,
      'active', v_exception.active
    ), auth.uid()
  );
  return jsonb_build_object('exception_id', v_exception.id, 'changed', true);
end;
$$;

-- Add special_day to the governed one-off exception path without changing its signature.
create or replace function public.save_availability_exception_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_exception_date date,
  p_service_period_id uuid,
  p_exception_type text,
  p_reason text,
  p_active boolean,
  p_override_start_time time without time zone default null,
  p_override_end_time time without time zone default null,
  p_exception_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_exception public.availability_exceptions%rowtype;
  v_type text := lower(nullif(trim(p_exception_type), ''));
  v_reason text := nullif(trim(p_reason), '');
  v_previous jsonb;
  v_new jsonb;
  v_change text;
begin
  perform public.assert_reservation_availability_manager_v1(p_business_id);
  if not exists (
    select 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id and restaurant.business_id = p_business_id
  ) then
    raise exception 'Restaurant does not belong to the Business' using errcode = '23514';
  end if;
  if p_service_period_id is not null and not exists (
    select 1 from public.business_service_periods period
    where period.id = p_service_period_id and period.business_id = p_business_id
      and period.restaurant_id = p_restaurant_id
  ) then
    raise exception 'Service period does not belong to the restaurant' using errcode = '23514';
  end if;
  if p_exception_date is null or v_type not in (
    'closed', 'private_event', 'maintenance', 'reduced_hours', 'special_day', 'other'
  ) or v_reason is null or length(v_reason) > 500 or p_active is null then
    raise exception 'Invalid availability exception' using errcode = '22023';
  end if;
  if v_type = 'reduced_hours' then
    if p_override_start_time is null or p_override_end_time is null
      or p_override_start_time = p_override_end_time then
      raise exception 'Reduced hours require distinct start and end times' using errcode = '22023';
    end if;
  else
    p_override_start_time := null;
    p_override_end_time := null;
  end if;

  if p_exception_id is null then
    insert into public.availability_exceptions (
      business_id, restaurant_id, service_period_id, exception_date,
      exception_type, reason, override_start_time, override_end_time,
      active, created_by, updated_by
    ) values (
      p_business_id, p_restaurant_id, p_service_period_id, p_exception_date,
      v_type, v_reason, p_override_start_time, p_override_end_time,
      p_active, auth.uid(), auth.uid()
    ) returning * into v_exception;
    v_previous := '{}'::jsonb;
    v_change := 'created';
  else
    select * into v_exception from public.availability_exceptions exception_row
    where exception_row.id = p_exception_id for update;
    if v_exception.id is null then raise exception 'Exception not found' using errcode = 'P0002'; end if;
    if v_exception.business_id <> p_business_id or v_exception.restaurant_id <> p_restaurant_id then
      raise exception 'Exception scope cannot be changed' using errcode = '42501';
    end if;
    v_previous := jsonb_build_object(
      'service_period_id', v_exception.service_period_id,
      'exception_date', v_exception.exception_date,
      'exception_type', v_exception.exception_type,
      'reason', v_exception.reason,
      'override_start_time', v_exception.override_start_time,
      'override_end_time', v_exception.override_end_time,
      'active', v_exception.active
    );
    if v_exception.service_period_id is not distinct from p_service_period_id
      and v_exception.exception_date = p_exception_date
      and v_exception.exception_type = v_type and v_exception.reason = v_reason
      and v_exception.override_start_time is not distinct from p_override_start_time
      and v_exception.override_end_time is not distinct from p_override_end_time
      and v_exception.active = p_active then
      return jsonb_build_object('exception_id', v_exception.id, 'changed', false);
    end if;
    update public.availability_exceptions
    set service_period_id = p_service_period_id, exception_date = p_exception_date,
        exception_type = v_type, reason = v_reason,
        override_start_time = p_override_start_time,
        override_end_time = p_override_end_time, active = p_active,
        updated_by = auth.uid()
    where id = v_exception.id returning * into v_exception;
    v_change := 'updated';
  end if;

  v_new := jsonb_build_object(
    'service_period_id', v_exception.service_period_id,
    'exception_date', v_exception.exception_date,
    'exception_type', v_exception.exception_type,
    'reason', v_exception.reason,
    'override_start_time', v_exception.override_start_time,
    'override_end_time', v_exception.override_end_time,
    'active', v_exception.active
  );
  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    v_exception.business_id, v_exception.restaurant_id, 'exception', v_exception.id,
    v_change, v_previous, v_new, auth.uid()
  );
  return jsonb_build_object('exception_id', v_exception.id, 'changed', true);
end;
$$;

create or replace function public.resolve_restaurant_service_calendar_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table (
  operational_date date,
  business_id uuid,
  restaurant_id uuid,
  service_period_id uuid,
  service_period_name text,
  scheduled boolean,
  is_open boolean,
  base_start_time time without time zone,
  base_end_time time without time zone,
  effective_start_time time without time zone,
  effective_end_time time without time zone,
  exception_source text,
  exception_id uuid,
  exception_type text,
  exception_reason text,
  configured_capacity integer,
  max_simultaneous_reservations integer,
  interval_minutes integer,
  max_covers_per_interval integer
)
language sql stable security definer set search_path = '' as $$
  select
    day_value::date as operational_date,
    period.business_id,
    period.restaurant_id,
    period.id as service_period_id,
    period.name as service_period_name,
    extract(isodow from day_value)::smallint = any(
      coalesce(calendar.operating_weekdays, array[1,2,3,4,5,6,7]::smallint[])
    ) as scheduled,
    case
      when chosen.exception_type in ('closed', 'private_event', 'maintenance') then false
      when chosen.exception_type in ('special_day', 'reduced_hours') then true
      else extract(isodow from day_value)::smallint = any(
        coalesce(calendar.operating_weekdays, array[1,2,3,4,5,6,7]::smallint[])
      )
    end as is_open,
    period.start_time,
    period.end_time,
    case when chosen.exception_type = 'reduced_hours'
      then chosen.override_start_time else period.start_time end,
    case when chosen.exception_type = 'reduced_hours'
      then chosen.override_end_time else period.end_time end,
    chosen.exception_source,
    chosen.exception_id,
    chosen.exception_type,
    chosen.reason,
    capacity.max_covers,
    capacity.max_simultaneous_reservations,
    capacity.interval_minutes,
    capacity.max_covers_per_interval
  from generate_series(p_date_from, p_date_to, interval '1 day') day_value
  join public.business_service_periods period
    on period.business_id = p_business_id
   and period.restaurant_id = p_restaurant_id
   and period.active
  left join public.service_period_calendar_settings calendar
    on calendar.service_period_id = period.id
  left join public.reservation_capacity_settings capacity
    on capacity.service_period_id = period.id
  left join lateral (
    select candidate.exception_source, candidate.exception_id,
           candidate.exception_type, candidate.reason,
           candidate.override_start_time, candidate.override_end_time
    from (
      select
        'one_off'::text as exception_source,
        exception_row.id as exception_id,
        exception_row.exception_type,
        exception_row.reason,
        exception_row.override_start_time,
        exception_row.override_end_time,
        case when exception_row.service_period_id is not null then 400 else 300 end as priority,
        exception_row.created_at
      from public.availability_exceptions exception_row
      where exception_row.business_id = p_business_id
        and exception_row.restaurant_id = p_restaurant_id
        and exception_row.active
        and exception_row.exception_date = day_value::date
        and (exception_row.service_period_id is null or exception_row.service_period_id = period.id)
      union all
      select
        'recurring'::text,
        recurring.id,
        recurring.exception_type,
        recurring.reason,
        recurring.override_start_time,
        recurring.override_end_time,
        case when recurring.service_period_id is not null then 200 else 100 end,
        recurring.created_at
      from public.recurring_availability_exceptions recurring
      where recurring.business_id = p_business_id
        and recurring.restaurant_id = p_restaurant_id
        and recurring.active
        and day_value::date >= recurring.valid_from
        and (recurring.valid_until is null or day_value::date <= recurring.valid_until)
        and extract(isodow from day_value)::smallint = any(recurring.operating_weekdays)
        and (recurring.service_period_id is null or recurring.service_period_id = period.id)
    ) candidate
    order by candidate.priority desc, candidate.created_at desc, candidate.exception_id desc
    limit 1
  ) chosen on true
  order by day_value, period.start_time, period.id;
$$;

revoke all on function public.resolve_restaurant_service_calendar_v1(uuid, uuid, date, date)
  from public, anon, authenticated;

create or replace function public.get_restaurant_operational_calendar_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table (
  operational_date date,
  business_id uuid,
  restaurant_id uuid,
  service_period_id uuid,
  service_period_name text,
  scheduled boolean,
  is_open boolean,
  base_start_time time without time zone,
  base_end_time time without time zone,
  effective_start_time time without time zone,
  effective_end_time time without time zone,
  exception_source text,
  exception_id uuid,
  exception_type text,
  exception_reason text,
  configured_capacity integer,
  max_simultaneous_reservations integer,
  interval_minutes integer,
  max_covers_per_interval integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  if p_date_from is null or p_date_to is null or p_date_to < p_date_from
    or p_date_to - p_date_from > 366 then
    raise exception 'Calendar range must contain at most 367 days' using errcode = '22023';
  end if;
  return query
  select * from public.resolve_restaurant_service_calendar_v1(
    p_business_id, p_restaurant_id, p_date_from, p_date_to
  );
end;
$$;

create or replace function public.list_restaurant_availability_exceptions_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table (
  occurrence_date date,
  exception_source text,
  exception_id uuid,
  service_period_id uuid,
  exception_type text,
  reason text,
  override_start_time time without time zone,
  override_end_time time without time zone,
  operating_weekdays smallint[],
  valid_from date,
  valid_until date
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  if p_date_from is null or p_date_to is null or p_date_to < p_date_from
    or p_date_to - p_date_from > 366 then
    raise exception 'Exception range must contain at most 367 days' using errcode = '22023';
  end if;
  return query
  select
    exception_row.exception_date,
    'one_off'::text,
    exception_row.id,
    exception_row.service_period_id,
    exception_row.exception_type,
    exception_row.reason,
    exception_row.override_start_time,
    exception_row.override_end_time,
    null::smallint[],
    exception_row.exception_date,
    exception_row.exception_date
  from public.availability_exceptions exception_row
  where exception_row.business_id = p_business_id
    and exception_row.restaurant_id = p_restaurant_id
    and exception_row.active
    and exception_row.exception_date between p_date_from and p_date_to
  union all
  select
    day_value::date,
    'recurring'::text,
    recurring.id,
    recurring.service_period_id,
    recurring.exception_type,
    recurring.reason,
    recurring.override_start_time,
    recurring.override_end_time,
    recurring.operating_weekdays,
    recurring.valid_from,
    recurring.valid_until
  from public.recurring_availability_exceptions recurring
  cross join lateral generate_series(
    greatest(p_date_from, recurring.valid_from),
    least(p_date_to, coalesce(recurring.valid_until, p_date_to)),
    interval '1 day'
  ) day_value
  where recurring.business_id = p_business_id
    and recurring.restaurant_id = p_restaurant_id
    and recurring.active
    and recurring.valid_from <= p_date_to
    and (recurring.valid_until is null or recurring.valid_until >= p_date_from)
    and extract(isodow from day_value)::smallint = any(recurring.operating_weekdays)
  order by 1, 2, 3;
end;
$$;

create or replace function public.project_restaurant_availability_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table (
  operational_date date,
  service_period_id uuid,
  service_period_name text,
  scheduled boolean,
  is_open boolean,
  effective_start_time time without time zone,
  effective_end_time time without time zone,
  exception_source text,
  exception_id uuid,
  exception_type text,
  exception_reason text,
  configured_capacity integer,
  total_capacity integer,
  capacity_used bigint,
  capacity_remaining bigint,
  occupancy_percent numeric,
  reservation_count bigint,
  reservations_outside_effective_hours bigint,
  covers_outside_effective_hours bigint,
  max_simultaneous_reservations integer,
  interval_minutes integer,
  max_covers_per_interval integer,
  availability_status text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  if p_date_from is null or p_date_to is null or p_date_to < p_date_from
    or p_date_to - p_date_from > 366 then
    raise exception 'Projection range must contain at most 367 days' using errcode = '22023';
  end if;
  return query
  with calendar as (
    select * from public.resolve_restaurant_service_calendar_v1(
      p_business_id, p_restaurant_id, p_date_from, p_date_to
    )
  ), reservation_matches as (
    select
      reservation.id,
      reservation.party_size,
      reservation.requested_date,
      reservation.requested_time,
      calendar.operational_date,
      calendar.service_period_id,
      calendar.is_open,
      calendar.effective_start_time,
      calendar.effective_end_time,
      row_number() over (
        partition by reservation.id
        order by calendar.is_open desc, calendar.scheduled desc,
                 calendar.base_start_time desc, calendar.service_period_id
      ) as match_rank
    from public.reservations reservation
    join calendar on (
      (
        calendar.base_start_time < calendar.base_end_time
        and reservation.requested_date = calendar.operational_date
        and reservation.requested_time >= calendar.base_start_time
        and reservation.requested_time < calendar.base_end_time
      ) or (
        calendar.base_start_time > calendar.base_end_time
        and (
          (reservation.requested_date = calendar.operational_date
            and reservation.requested_time >= calendar.base_start_time)
          or
          (reservation.requested_date = calendar.operational_date + 1
            and reservation.requested_time < calendar.base_end_time)
        )
      )
    )
    where reservation.business_id = p_business_id
      and reservation.restaurant_id = p_restaurant_id
      and reservation.status not in ('declined', 'cancelled')
      and reservation.requested_date between p_date_from and p_date_to + 1
      and reservation.requested_time is not null
  ), assigned_reservations as (
    select
      matched.*,
      case
        when not matched.is_open then true
        when matched.effective_start_time < matched.effective_end_time then not (
          matched.requested_date = matched.operational_date
          and matched.requested_time >= matched.effective_start_time
          and matched.requested_time < matched.effective_end_time
        )
        else not (
          (matched.requested_date = matched.operational_date
            and matched.requested_time >= matched.effective_start_time)
          or
          (matched.requested_date = matched.operational_date + 1
            and matched.requested_time < matched.effective_end_time)
        )
      end as outside_effective_hours
    from reservation_matches matched
    where matched.match_rank = 1
  ), reservation_totals as (
    select
      assigned.operational_date,
      assigned.service_period_id,
      count(*)::bigint as reservation_count,
      coalesce(sum(assigned.party_size), 0)::bigint as capacity_used,
      count(*) filter (where assigned.outside_effective_hours)::bigint
        as reservations_outside_effective_hours,
      coalesce(sum(assigned.party_size) filter (where assigned.outside_effective_hours), 0)::bigint
        as covers_outside_effective_hours
    from assigned_reservations assigned
    group by assigned.operational_date, assigned.service_period_id
  ), projected as (
    select
      calendar.*,
      case when calendar.is_open then calendar.configured_capacity else 0 end
        as total_capacity,
      coalesce(totals.capacity_used, 0)::bigint as capacity_used,
      greatest(
        coalesce(case when calendar.is_open then calendar.configured_capacity else 0 end, 0)::bigint
          - coalesce(totals.capacity_used, 0),
        0
      )::bigint as capacity_remaining,
      case
        when not calendar.is_open or calendar.configured_capacity is null then null::numeric
        else round(coalesce(totals.capacity_used, 0)::numeric * 100
          / calendar.configured_capacity, 1)
      end as occupancy_percent,
      coalesce(totals.reservation_count, 0)::bigint as reservation_count,
      coalesce(totals.reservations_outside_effective_hours, 0)::bigint
        as reservations_outside_effective_hours,
      coalesce(totals.covers_outside_effective_hours, 0)::bigint
        as covers_outside_effective_hours
    from calendar
    left join reservation_totals totals
      on totals.operational_date = calendar.operational_date
     and totals.service_period_id = calendar.service_period_id
  )
  select
    projected.operational_date,
    projected.service_period_id,
    projected.service_period_name,
    projected.scheduled,
    projected.is_open,
    projected.effective_start_time,
    projected.effective_end_time,
    projected.exception_source,
    projected.exception_id,
    projected.exception_type,
    projected.exception_reason,
    projected.configured_capacity,
    projected.total_capacity,
    projected.capacity_used,
    projected.capacity_remaining,
    projected.occupancy_percent,
    projected.reservation_count,
    projected.reservations_outside_effective_hours,
    projected.covers_outside_effective_hours,
    projected.max_simultaneous_reservations,
    projected.interval_minutes,
    projected.max_covers_per_interval,
    case
      when not projected.is_open then 'closed'
      when projected.configured_capacity is null then 'not_configured'
      when projected.occupancy_percent >= 100 then 'fully_occupied'
      when projected.occupancy_percent >= 90 then 'high_capacity'
      when projected.occupancy_percent >= 75 then 'near_capacity'
      else 'available'
    end
  from projected
  order by projected.operational_date, projected.effective_start_time,
           projected.service_period_id;
end;
$$;

create or replace function public.get_restaurant_availability_daily_summary_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table (
  operational_date date,
  service_period_count bigint,
  open_service_period_count bigint,
  exception_count bigint,
  total_capacity bigint,
  capacity_used bigint,
  capacity_remaining bigint,
  occupancy_percent numeric,
  reservation_count bigint,
  reservations_outside_effective_hours bigint,
  availability_status text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  return query
  with projection as (
    select * from public.project_restaurant_availability_v1(
      p_business_id, p_restaurant_id, p_date_from, p_date_to
    )
  ), summary as (
    select
      projection.operational_date,
      count(*)::bigint as service_period_count,
      count(*) filter (where projection.is_open)::bigint as open_service_period_count,
      count(*) filter (where projection.exception_id is not null)::bigint as exception_count,
      coalesce(sum(projection.total_capacity), 0)::bigint as total_capacity,
      coalesce(sum(projection.capacity_used), 0)::bigint as capacity_used,
      coalesce(sum(projection.capacity_remaining), 0)::bigint as capacity_remaining,
      case when coalesce(sum(projection.total_capacity), 0) = 0 then null::numeric
        else round(sum(projection.capacity_used)::numeric * 100
          / sum(projection.total_capacity), 1) end as occupancy_percent,
      coalesce(sum(projection.reservation_count), 0)::bigint as reservation_count,
      coalesce(sum(projection.reservations_outside_effective_hours), 0)::bigint
        as reservations_outside_effective_hours
    from projection
    group by projection.operational_date
  )
  select
    summary.operational_date,
    summary.service_period_count,
    summary.open_service_period_count,
    summary.exception_count,
    summary.total_capacity,
    summary.capacity_used,
    summary.capacity_remaining,
    summary.occupancy_percent,
    summary.reservation_count,
    summary.reservations_outside_effective_hours,
    case
      when summary.open_service_period_count = 0 then 'closed'
      when summary.total_capacity = 0 then 'not_configured'
      when summary.occupancy_percent >= 100 then 'fully_occupied'
      when summary.occupancy_percent >= 90 then 'high_capacity'
      when summary.occupancy_percent >= 75 then 'near_capacity'
      else 'available'
    end
  from summary
  order by summary.operational_date;
end;
$$;

alter table public.service_period_calendar_settings enable row level security;
alter table public.recurring_availability_exceptions enable row level security;

revoke all on public.service_period_calendar_settings from anon, authenticated;
revoke all on public.recurring_availability_exceptions from anon, authenticated;
grant select on public.service_period_calendar_settings to authenticated;
grant select on public.recurring_availability_exceptions to authenticated;

create policy "Members can read service calendars"
on public.service_period_calendar_settings
for select to authenticated using (public.is_business_member(business_id));

create policy "Members can read recurring availability exceptions"
on public.recurring_availability_exceptions
for select to authenticated using (public.is_business_member(business_id));

revoke all on function public.save_service_period_calendar_v1(uuid, smallint[])
  from public, anon;
grant execute on function public.save_service_period_calendar_v1(uuid, smallint[])
  to authenticated;

revoke all on function public.save_recurring_availability_exception_v1(
  uuid, uuid, uuid, smallint[], date, date, text, text, boolean,
  time without time zone, time without time zone, uuid
) from public, anon;
grant execute on function public.save_recurring_availability_exception_v1(
  uuid, uuid, uuid, smallint[], date, date, text, text, boolean,
  time without time zone, time without time zone, uuid
) to authenticated;

revoke all on function public.get_restaurant_operational_calendar_v1(uuid, uuid, date, date)
  from public, anon;
grant execute on function public.get_restaurant_operational_calendar_v1(uuid, uuid, date, date)
  to authenticated;

revoke all on function public.list_restaurant_availability_exceptions_v1(uuid, uuid, date, date)
  from public, anon;
grant execute on function public.list_restaurant_availability_exceptions_v1(uuid, uuid, date, date)
  to authenticated;

revoke all on function public.project_restaurant_availability_v1(uuid, uuid, date, date)
  from public, anon;
grant execute on function public.project_restaurant_availability_v1(uuid, uuid, date, date)
  to authenticated;

revoke all on function public.get_restaurant_availability_daily_summary_v1(uuid, uuid, date, date)
  from public, anon;
grant execute on function public.get_restaurant_availability_daily_summary_v1(uuid, uuid, date, date)
  to authenticated;

notify pgrst, 'reload schema';
