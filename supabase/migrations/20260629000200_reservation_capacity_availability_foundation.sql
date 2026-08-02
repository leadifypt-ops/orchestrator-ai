-- Block 41: Reservation Capacity & Availability Management Foundation.
-- Configuration is informational only and never confirms or blocks reservations.

create table public.business_service_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 100),
  start_time time without time zone not null,
  end_time time without time zone not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_service_periods_distinct_times check (start_time <> end_time),
  constraint business_service_periods_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict,
  unique (id, business_id, restaurant_id)
);

create unique index business_service_periods_restaurant_name_uidx
  on public.business_service_periods (restaurant_id, lower(name));
create index business_service_periods_business_restaurant_idx
  on public.business_service_periods (business_id, restaurant_id, active, start_time);

create table public.reservation_capacity_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  service_period_id uuid not null unique,
  max_covers integer not null check (max_covers between 1 and 5000),
  max_simultaneous_reservations integer not null check (
    max_simultaneous_reservations between 1 and 500
  ),
  interval_minutes integer not null default 15 check (interval_minutes between 5 and 240),
  max_covers_per_interval integer not null check (
    max_covers_per_interval between 1 and 5000
  ),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_capacity_simultaneous_within_capacity check (
    max_simultaneous_reservations <= max_covers
  ),
  constraint reservation_capacity_interval_within_capacity check (
    max_covers_per_interval <= max_covers
  ),
  constraint reservation_capacity_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict,
  constraint reservation_capacity_period_scope_fk
    foreign key (service_period_id, business_id, restaurant_id)
    references public.business_service_periods(id, business_id, restaurant_id)
    on update restrict on delete restrict
);

create index reservation_capacity_business_restaurant_idx
  on public.reservation_capacity_settings (business_id, restaurant_id);

create table public.restaurant_areas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 100),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_areas_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict
);

create unique index restaurant_areas_restaurant_name_uidx
  on public.restaurant_areas (restaurant_id, lower(name));
create index restaurant_areas_business_restaurant_idx
  on public.restaurant_areas (business_id, restaurant_id, active, name);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  service_period_id uuid,
  exception_date date not null,
  exception_type text not null check (
    exception_type in ('closed', 'private_event', 'maintenance', 'reduced_hours', 'other')
  ),
  reason text not null check (length(trim(reason)) between 1 and 500),
  override_start_time time without time zone,
  override_end_time time without time zone,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_exceptions_reduced_hours_check check (
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
  constraint availability_exceptions_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict,
  constraint availability_exceptions_period_scope_fk
    foreign key (service_period_id, business_id, restaurant_id)
    references public.business_service_periods(id, business_id, restaurant_id)
    on update restrict on delete restrict
);

create unique index availability_exceptions_scope_uidx
  on public.availability_exceptions (
    restaurant_id,
    exception_date,
    coalesce(service_period_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index availability_exceptions_business_date_idx
  on public.availability_exceptions (business_id, exception_date, active);

create table public.reservation_availability_audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  entity_type text not null check (
    entity_type in ('service_period', 'capacity', 'area', 'exception')
  ),
  entity_id uuid not null,
  change_type text not null check (change_type in ('created', 'updated')),
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reservation_availability_audit_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict
);

create index reservation_availability_audit_business_created_idx
  on public.reservation_availability_audit_events (business_id, created_at desc, id desc);
create index reservation_availability_audit_entity_idx
  on public.reservation_availability_audit_events (entity_type, entity_id, created_at desc);

create or replace function public.set_reservation_availability_updated_at_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_reservation_availability_updated_at_v1()
  from public, anon, authenticated;

create trigger business_service_periods_set_updated_at
before update on public.business_service_periods
for each row execute function public.set_reservation_availability_updated_at_v1();
create trigger reservation_capacity_settings_set_updated_at
before update on public.reservation_capacity_settings
for each row execute function public.set_reservation_availability_updated_at_v1();
create trigger restaurant_areas_set_updated_at
before update on public.restaurant_areas
for each row execute function public.set_reservation_availability_updated_at_v1();
create trigger availability_exceptions_set_updated_at
before update on public.availability_exceptions
for each row execute function public.set_reservation_availability_updated_at_v1();

create or replace function public.prevent_reservation_availability_history_mutation_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Reservation availability configuration is retained and audit history is append-only'
    using errcode = '55000';
end;
$$;

revoke all on function public.prevent_reservation_availability_history_mutation_v1()
  from public, anon, authenticated;

create trigger business_service_periods_prevent_delete
before delete on public.business_service_periods
for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger reservation_capacity_settings_prevent_delete
before delete on public.reservation_capacity_settings
for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger restaurant_areas_prevent_delete
before delete on public.restaurant_areas
for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger availability_exceptions_prevent_delete
before delete on public.availability_exceptions
for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger reservation_availability_audit_prevent_mutation
before update or delete on public.reservation_availability_audit_events
for each row execute function public.prevent_reservation_availability_history_mutation_v1();

create or replace function public.assert_reservation_availability_manager_v1(p_business_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.business_memberships membership
    where membership.business_id = p_business_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'manager')
  ) then
    raise exception 'Owner or manager role required for availability configuration'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_reservation_availability_manager_v1(uuid)
  from public, anon, authenticated;

create or replace function public.save_business_service_period_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_name text,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_active boolean,
  p_period_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_period public.business_service_periods%rowtype;
  v_name text := nullif(trim(p_name), '');
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
  if v_name is null or length(v_name) > 100 or p_start_time is null
    or p_end_time is null or p_start_time = p_end_time or p_active is null then
    raise exception 'Invalid service period' using errcode = '22023';
  end if;

  if p_period_id is null then
    insert into public.business_service_periods (
      business_id, restaurant_id, name, start_time, end_time, active, created_by, updated_by
    ) values (
      p_business_id, p_restaurant_id, v_name, p_start_time, p_end_time,
      p_active, auth.uid(), auth.uid()
    ) returning * into v_period;
    v_previous := '{}'::jsonb;
    v_change := 'created';
  else
    select * into v_period from public.business_service_periods period
    where period.id = p_period_id for update;
    if v_period.id is null then
      raise exception 'Service period not found' using errcode = 'P0002';
    end if;
    if v_period.business_id <> p_business_id or v_period.restaurant_id <> p_restaurant_id then
      raise exception 'Service period scope cannot be changed' using errcode = '42501';
    end if;
    v_previous := jsonb_build_object(
      'name', v_period.name, 'start_time', v_period.start_time,
      'end_time', v_period.end_time, 'active', v_period.active
    );
    if v_period.name = v_name and v_period.start_time = p_start_time
      and v_period.end_time = p_end_time and v_period.active = p_active then
      return jsonb_build_object('period_id', v_period.id, 'changed', false);
    end if;
    update public.business_service_periods
    set name = v_name, start_time = p_start_time, end_time = p_end_time,
        active = p_active, updated_by = auth.uid()
    where id = v_period.id returning * into v_period;
    v_change := 'updated';
  end if;

  v_new := jsonb_build_object(
    'name', v_period.name, 'start_time', v_period.start_time,
    'end_time', v_period.end_time, 'active', v_period.active
  );
  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    v_period.business_id, v_period.restaurant_id, 'service_period', v_period.id,
    v_change, v_previous, v_new, auth.uid()
  );
  return jsonb_build_object('period_id', v_period.id, 'changed', true);
end;
$$;

create or replace function public.set_reservation_capacity_v1(
  p_service_period_id uuid,
  p_max_covers integer,
  p_max_simultaneous_reservations integer,
  p_interval_minutes integer,
  p_max_covers_per_interval integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_period public.business_service_periods%rowtype;
  v_capacity public.reservation_capacity_settings%rowtype;
  v_previous jsonb;
  v_new jsonb;
  v_change text;
begin
  select * into v_period from public.business_service_periods period
  where period.id = p_service_period_id;
  if v_period.id is null then
    raise exception 'Service period not found' using errcode = 'P0002';
  end if;
  perform public.assert_reservation_availability_manager_v1(v_period.business_id);
  if p_max_covers not between 1 and 5000
    or p_max_simultaneous_reservations not between 1 and 500
    or p_interval_minutes not between 5 and 240
    or p_max_covers_per_interval not between 1 and 5000
    or p_max_simultaneous_reservations > p_max_covers
    or p_max_covers_per_interval > p_max_covers then
    raise exception 'Invalid reservation capacity' using errcode = '22023';
  end if;

  select * into v_capacity from public.reservation_capacity_settings capacity
  where capacity.service_period_id = p_service_period_id for update;
  if v_capacity.id is null then
    insert into public.reservation_capacity_settings (
      business_id, restaurant_id, service_period_id, max_covers,
      max_simultaneous_reservations, interval_minutes, max_covers_per_interval,
      created_by, updated_by
    ) values (
      v_period.business_id, v_period.restaurant_id, v_period.id, p_max_covers,
      p_max_simultaneous_reservations, p_interval_minutes,
      p_max_covers_per_interval, auth.uid(), auth.uid()
    ) returning * into v_capacity;
    v_previous := '{}'::jsonb;
    v_change := 'created';
  else
    v_previous := jsonb_build_object(
      'max_covers', v_capacity.max_covers,
      'max_simultaneous_reservations', v_capacity.max_simultaneous_reservations,
      'interval_minutes', v_capacity.interval_minutes,
      'max_covers_per_interval', v_capacity.max_covers_per_interval
    );
    if v_capacity.max_covers = p_max_covers
      and v_capacity.max_simultaneous_reservations = p_max_simultaneous_reservations
      and v_capacity.interval_minutes = p_interval_minutes
      and v_capacity.max_covers_per_interval = p_max_covers_per_interval then
      return jsonb_build_object('capacity_id', v_capacity.id, 'changed', false);
    end if;
    update public.reservation_capacity_settings
    set max_covers = p_max_covers,
        max_simultaneous_reservations = p_max_simultaneous_reservations,
        interval_minutes = p_interval_minutes,
        max_covers_per_interval = p_max_covers_per_interval,
        updated_by = auth.uid()
    where id = v_capacity.id returning * into v_capacity;
    v_change := 'updated';
  end if;

  v_new := jsonb_build_object(
    'max_covers', v_capacity.max_covers,
    'max_simultaneous_reservations', v_capacity.max_simultaneous_reservations,
    'interval_minutes', v_capacity.interval_minutes,
    'max_covers_per_interval', v_capacity.max_covers_per_interval
  );
  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    v_capacity.business_id, v_capacity.restaurant_id, 'capacity', v_capacity.id,
    v_change, v_previous, v_new, auth.uid()
  );
  return jsonb_build_object('capacity_id', v_capacity.id, 'changed', true);
end;
$$;

create or replace function public.save_restaurant_area_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_name text,
  p_active boolean,
  p_area_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_area public.restaurant_areas%rowtype;
  v_name text := nullif(trim(p_name), '');
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
  if v_name is null or length(v_name) > 100 or p_active is null then
    raise exception 'Invalid restaurant area' using errcode = '22023';
  end if;

  if p_area_id is null then
    insert into public.restaurant_areas (
      business_id, restaurant_id, name, active, created_by, updated_by
    ) values (
      p_business_id, p_restaurant_id, v_name, p_active, auth.uid(), auth.uid()
    ) returning * into v_area;
    v_previous := '{}'::jsonb;
    v_change := 'created';
  else
    select * into v_area from public.restaurant_areas area
    where area.id = p_area_id for update;
    if v_area.id is null then raise exception 'Area not found' using errcode = 'P0002'; end if;
    if v_area.business_id <> p_business_id or v_area.restaurant_id <> p_restaurant_id then
      raise exception 'Area scope cannot be changed' using errcode = '42501';
    end if;
    v_previous := jsonb_build_object('name', v_area.name, 'active', v_area.active);
    if v_area.name = v_name and v_area.active = p_active then
      return jsonb_build_object('area_id', v_area.id, 'changed', false);
    end if;
    update public.restaurant_areas
    set name = v_name, active = p_active, updated_by = auth.uid()
    where id = v_area.id returning * into v_area;
    v_change := 'updated';
  end if;

  v_new := jsonb_build_object('name', v_area.name, 'active', v_area.active);
  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    v_area.business_id, v_area.restaurant_id, 'area', v_area.id,
    v_change, v_previous, v_new, auth.uid()
  );
  return jsonb_build_object('area_id', v_area.id, 'changed', true);
end;
$$;

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
    'closed', 'private_event', 'maintenance', 'reduced_hours', 'other'
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

revoke all on function public.save_business_service_period_v1(
  uuid, uuid, text, time without time zone, time without time zone, boolean, uuid
) from public, anon;
grant execute on function public.save_business_service_period_v1(
  uuid, uuid, text, time without time zone, time without time zone, boolean, uuid
) to authenticated;
revoke all on function public.set_reservation_capacity_v1(
  uuid, integer, integer, integer, integer
) from public, anon;
grant execute on function public.set_reservation_capacity_v1(
  uuid, integer, integer, integer, integer
) to authenticated;
revoke all on function public.save_restaurant_area_v1(
  uuid, uuid, text, boolean, uuid
) from public, anon;
grant execute on function public.save_restaurant_area_v1(
  uuid, uuid, text, boolean, uuid
) to authenticated;
revoke all on function public.save_availability_exception_v1(
  uuid, uuid, date, uuid, text, text, boolean,
  time without time zone, time without time zone, uuid
) from public, anon;
grant execute on function public.save_availability_exception_v1(
  uuid, uuid, date, uuid, text, text, boolean,
  time without time zone, time without time zone, uuid
) to authenticated;

alter table public.business_service_periods enable row level security;
alter table public.reservation_capacity_settings enable row level security;
alter table public.restaurant_areas enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.reservation_availability_audit_events enable row level security;

revoke all on public.business_service_periods from anon, authenticated;
revoke all on public.reservation_capacity_settings from anon, authenticated;
revoke all on public.restaurant_areas from anon, authenticated;
revoke all on public.availability_exceptions from anon, authenticated;
revoke all on public.reservation_availability_audit_events from anon, authenticated;
grant select on public.business_service_periods to authenticated;
grant select on public.reservation_capacity_settings to authenticated;
grant select on public.restaurant_areas to authenticated;
grant select on public.availability_exceptions to authenticated;
grant select on public.reservation_availability_audit_events to authenticated;

create policy "Members can read service periods" on public.business_service_periods
for select to authenticated using (public.is_business_member(business_id));
create policy "Members can read reservation capacity" on public.reservation_capacity_settings
for select to authenticated using (public.is_business_member(business_id));
create policy "Members can read restaurant areas" on public.restaurant_areas
for select to authenticated using (public.is_business_member(business_id));
create policy "Members can read availability exceptions" on public.availability_exceptions
for select to authenticated using (public.is_business_member(business_id));
create policy "Members can read availability audit" on public.reservation_availability_audit_events
for select to authenticated using (public.is_business_member(business_id));

notify pgrst, 'reload schema';
