-- Block 49: Pilot Restaurant Enablement & Public Reservation Integration.
-- Public reservations are enabled explicitly per restaurant and submission is
-- revalidated against canonical availability/capacity inside the database.

alter table public.restaurants
  add column if not exists public_reservations_enabled boolean not null default false,
  add column if not exists restaurant_timezone text not null default 'Europe/Lisbon';

create or replace function public.is_valid_iana_timezone(p_timezone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = nullif(trim(p_timezone), '')
      and timezone_name.name like '%/%'
  );
$$;

revoke all on function public.is_valid_iana_timezone(text) from public, anon, authenticated;

create or replace function public.validate_restaurant_public_settings_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.restaurant_timezone := coalesce(nullif(trim(new.restaurant_timezone), ''), 'Europe/Lisbon');
  if not public.is_valid_iana_timezone(new.restaurant_timezone) then
    raise exception 'Restaurant timezone must be a valid IANA timezone identifier'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_restaurant_public_settings_v1()
  from public, anon, authenticated;

drop trigger if exists restaurants_validate_public_settings on public.restaurants;
create trigger restaurants_validate_public_settings
before insert or update of restaurant_timezone, public_reservations_enabled
on public.restaurants
for each row execute function public.validate_restaurant_public_settings_v1();

update public.restaurants
set restaurant_timezone = 'Europe/Lisbon'
where restaurant_timezone is null
   or restaurant_timezone = ''
   or location ilike '%lisbon%'
   or location ilike '%lisboa%'
   or location ilike '%portugal%';

update public.restaurants
set public_reservations_enabled = true,
    restaurant_timezone = 'Europe/Lisbon'
where slug = 'feitoria';

create index if not exists restaurants_public_reservable_idx
  on public.restaurants (slug, public_reservations_enabled)
  where business_id is not null;

create index if not exists reservations_public_capacity_lookup_idx
  on public.reservations (restaurant_id, requested_date, requested_time, status)
  where requested_time is not null;

create or replace function public.public_reservation_readiness_v1(p_restaurant_slug text)
returns table (
  restaurant_id uuid,
  restaurant_slug text,
  restaurant_name text,
  location text,
  public_reservations_enabled boolean,
  restaurant_timezone text,
  safe_public_profile_ready boolean,
  active_service_period_ready boolean,
  calendar_ready boolean,
  capacity_ready boolean,
  reservation_ready boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    restaurant.id,
    restaurant.slug::text,
    restaurant.name::text,
    restaurant.location::text,
    restaurant.public_reservations_enabled,
    restaurant.restaurant_timezone::text,
    (
      nullif(trim(coalesce(restaurant.name, '')), '') is not null
      and nullif(trim(coalesce(restaurant.slug, '')), '') is not null
      and nullif(trim(coalesce(restaurant.location, '')), '') is not null
      and nullif(trim(coalesce(restaurant.description, '')), '') is not null
      and nullif(trim(coalesce(restaurant.image_url, '')), '') is not null
    ) as safe_public_profile_ready,
    exists (
      select 1
      from public.business_service_periods period
      where period.business_id = restaurant.business_id
        and period.restaurant_id = restaurant.id
        and period.active
    ) as active_service_period_ready,
    exists (
      select 1
      from public.business_service_periods period
      join public.service_period_calendar_settings setting
        on setting.service_period_id = period.id
      where period.business_id = restaurant.business_id
        and period.restaurant_id = restaurant.id
        and period.active
    ) as calendar_ready,
    exists (
      select 1
      from public.business_service_periods period
      join public.reservation_capacity_settings capacity
        on capacity.service_period_id = period.id
      where period.business_id = restaurant.business_id
        and period.restaurant_id = restaurant.id
        and period.active
    ) as capacity_ready,
    (
      restaurant.public_reservations_enabled
      and restaurant.business_id is not null
      and public.is_valid_iana_timezone(restaurant.restaurant_timezone)
      and nullif(trim(coalesce(restaurant.name, '')), '') is not null
      and nullif(trim(coalesce(restaurant.slug, '')), '') is not null
      and nullif(trim(coalesce(restaurant.location, '')), '') is not null
      and nullif(trim(coalesce(restaurant.description, '')), '') is not null
      and nullif(trim(coalesce(restaurant.image_url, '')), '') is not null
      and exists (
        select 1
        from public.business_service_periods period
        join public.service_period_calendar_settings setting
          on setting.service_period_id = period.id
        join public.reservation_capacity_settings capacity
          on capacity.service_period_id = period.id
        where period.business_id = restaurant.business_id
          and period.restaurant_id = restaurant.id
          and period.active
      )
    ) as reservation_ready
  from public.restaurants restaurant
  where restaurant.slug = lower(trim(p_restaurant_slug))
    and restaurant.business_id is not null;
end;
$$;

revoke all on function public.public_reservation_readiness_v1(text) from public;
grant execute on function public.public_reservation_readiness_v1(text) to anon, authenticated;

create or replace function public.resolve_public_reservation_slots_v1(
  p_restaurant_slug text,
  p_requested_date date,
  p_party_size integer
)
returns table (
  restaurant_slug text,
  restaurant_name text,
  restaurant_timezone text,
  requested_date date,
  requested_time time without time zone,
  service_period_name text,
  availability_status text,
  remaining_capacity integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants%rowtype;
begin
  if p_requested_date is null
    or p_party_size is null
    or p_party_size < 1
    or p_party_size > 20 then
    raise exception 'Invalid public availability request' using errcode = '22023';
  end if;

  select * into v_restaurant
  from public.restaurants restaurant
  where restaurant.slug = lower(trim(p_restaurant_slug))
    and restaurant.business_id is not null;

  if v_restaurant.id is null
    or not coalesce(v_restaurant.public_reservations_enabled, false)
    or not exists (
      select 1
      from public.public_reservation_readiness_v1(v_restaurant.slug) readiness
      where readiness.reservation_ready
    ) then
    return;
  end if;

  if p_requested_date < ((now() at time zone v_restaurant.restaurant_timezone)::date)
    or p_requested_date > ((now() at time zone v_restaurant.restaurant_timezone)::date + 180) then
    return;
  end if;

  return query
  with calendar as (
    select * from public.resolve_restaurant_service_calendar_v1(
      v_restaurant.business_id,
      v_restaurant.id,
      p_requested_date - 1,
      p_requested_date
    )
  ), active_event_overrides as (
    select distinct on (event.service_period_id, event.operational_date)
      event.service_period_id,
      event.operational_date,
      event.override_type,
      event.reduced_capacity
    from public.capacity_override_events event
    where event.business_id = v_restaurant.business_id
      and event.restaurant_id = v_restaurant.id
      and event.event_type = 'created'
      and event.operational_date between p_requested_date - 1 and p_requested_date
      and not exists (
        select 1
        from public.capacity_override_events removal
        where removal.override_id = event.override_id
          and removal.event_type = 'removed'
      )
    order by event.service_period_id, event.operational_date, event.created_at desc, event.id desc
  ), capacity_context as (
    select
      calendar.*,
      calendar.operational_date::timestamp + calendar.effective_start_time as service_start_at,
      case
        when calendar.effective_start_time < calendar.effective_end_time
          then calendar.operational_date::timestamp + calendar.effective_end_time
        else calendar.operational_date::timestamp + interval '1 day' + calendar.effective_end_time
      end as service_end_at,
      case
        when not calendar.is_open then 0
        when event_override.override_type = 'temporarily_reduce_capacity' then
          least(coalesce(legacy_override.adjusted_capacity, calendar.max_covers), event_override.reduced_capacity)
        else coalesce(legacy_override.adjusted_capacity, calendar.max_covers)
      end as adjusted_capacity,
      coalesce(calendar.interval_minutes, 15) as slot_interval_minutes,
      coalesce(calendar.max_covers_per_interval, calendar.max_covers) as slot_capacity
    from calendar
    left join public.operational_capacity_overrides legacy_override
      on legacy_override.business_id = v_restaurant.business_id
     and legacy_override.restaurant_id = v_restaurant.id
     and legacy_override.service_period_id = calendar.service_period_id
     and legacy_override.operational_date = calendar.operational_date
     and legacy_override.active
    left join active_event_overrides event_override
      on event_override.service_period_id = calendar.service_period_id
     and event_override.operational_date = calendar.operational_date
  ), slots as (
    select
      context.*,
      slot_value as slot_at,
      slot_value::date as slot_date,
      slot_value::time as slot_time
    from capacity_context context
    cross join lateral generate_series(
      context.service_start_at,
      context.service_end_at - make_interval(mins => context.slot_interval_minutes),
      make_interval(mins => context.slot_interval_minutes)
    ) slot_value
    where context.is_open
      and context.adjusted_capacity is not null
      and context.adjusted_capacity > 0
      and context.slot_capacity is not null
      and context.slot_capacity > 0
  ), reservation_matches as (
    select
      slot_row.service_period_id,
      slot_row.operational_date,
      slot_row.slot_at,
      coalesce(sum(reservation.party_size), 0)::integer as slot_covers,
      count(reservation.id)::integer as slot_reservations
    from slots slot_row
    left join public.reservations reservation
      on reservation.business_id = v_restaurant.business_id
     and reservation.restaurant_id = v_restaurant.id
     and reservation.status in ('pending', 'reviewing', 'confirmed', 'accepted')
     and reservation.requested_date::timestamp + reservation.requested_time >= slot_row.slot_at
     and reservation.requested_date::timestamp + reservation.requested_time < slot_row.slot_at + make_interval(mins => slot_row.slot_interval_minutes)
    group by slot_row.service_period_id, slot_row.operational_date, slot_row.slot_at
  ), service_totals as (
    select
      context.service_period_id,
      context.operational_date,
      coalesce(sum(reservation.party_size), 0)::integer as service_covers,
      count(reservation.id)::integer as service_reservations
    from capacity_context context
    left join public.reservations reservation
      on reservation.business_id = v_restaurant.business_id
     and reservation.restaurant_id = v_restaurant.id
     and reservation.status in ('pending', 'reviewing', 'confirmed', 'accepted')
     and reservation.requested_date::timestamp + reservation.requested_time >= context.service_start_at
     and reservation.requested_date::timestamp + reservation.requested_time < context.service_end_at
    group by context.service_period_id, context.operational_date
  )
  select
    v_restaurant.slug::text,
    v_restaurant.name::text,
    v_restaurant.restaurant_timezone::text,
    slots.slot_date,
    slots.slot_time,
    slots.service_period_name::text,
    case
      when slots.slot_at <= (now() at time zone v_restaurant.restaurant_timezone) then 'past'
      when coalesce(service_totals.service_covers, 0) + p_party_size > slots.adjusted_capacity then 'full'
      when coalesce(service_totals.service_reservations, 0) + 1 > slots.max_simultaneous_reservations then 'full'
      when coalesce(reservation_matches.slot_covers, 0) + p_party_size > slots.slot_capacity then 'full'
      else 'available'
    end,
    greatest(
      least(
        slots.adjusted_capacity - coalesce(service_totals.service_covers, 0),
        slots.slot_capacity - coalesce(reservation_matches.slot_covers, 0)
      ),
      0
    )::integer
  from slots
  left join reservation_matches
    on reservation_matches.service_period_id = slots.service_period_id
   and reservation_matches.operational_date = slots.operational_date
   and reservation_matches.slot_at = slots.slot_at
  left join service_totals
    on service_totals.service_period_id = slots.service_period_id
   and service_totals.operational_date = slots.operational_date
  where slots.slot_date = p_requested_date
  order by slots.slot_at, slots.service_period_id;
end;
$$;

revoke all on function public.resolve_public_reservation_slots_v1(text, date, integer) from public;
grant execute on function public.resolve_public_reservation_slots_v1(text, date, integer) to anon, authenticated;

create or replace function public.create_public_reservation_v3(
  p_restaurant_slug text,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_requested_date date,
  p_requested_time time without time zone,
  p_party_size integer,
  p_occasion text,
  p_special_request text,
  p_experience_notes text,
  p_guest_profiles jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_reservation_id uuid;
  v_reservation_guest_id uuid;
  v_profile jsonb;
  v_position integer := 0;
  v_name text;
  v_available_slot record;
  v_lock_key bigint;
begin
  if nullif(trim(p_restaurant_slug), '') is null or length(trim(p_restaurant_slug)) > 120
    or nullif(trim(p_guest_name), '') is null or length(trim(p_guest_name)) > 160
    or nullif(trim(p_guest_email), '') is null or length(trim(p_guest_email)) > 320
    or lower(trim(p_guest_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_requested_date is null or p_requested_time is null
    or p_party_size is null or p_party_size < 1 or p_party_size > 20 then
    raise exception 'Invalid reservation request' using errcode = '22023';
  end if;
  if length(coalesce(p_guest_phone, '')) > 50
    or length(coalesce(p_occasion, '')) > 200
    or length(coalesce(p_special_request, '')) > 2000
    or length(coalesce(p_experience_notes, '')) > 2000 then
    raise exception 'Reservation fields exceed allowed size' using errcode = '22023';
  end if;
  if jsonb_typeof(p_guest_profiles) <> 'array'
    or jsonb_array_length(p_guest_profiles) <> p_party_size then
    raise exception 'One guest profile is required per guest' using errcode = '22023';
  end if;

  for v_profile in select value from jsonb_array_elements(p_guest_profiles)
  loop
    if jsonb_typeof(v_profile) <> 'object' or v_profile->'reviewed' is distinct from 'true'::jsonb
      or jsonb_typeof(coalesce(v_profile->'allergies', 'null'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(v_profile->'intolerances', 'null'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(v_profile->'dietary_restrictions', 'null'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(v_profile->'dislikes', 'null'::jsonb)) <> 'array'
      or jsonb_array_length(v_profile->'allergies') > 20
      or jsonb_array_length(v_profile->'intolerances') > 20
      or jsonb_array_length(v_profile->'dietary_restrictions') > 20
      or jsonb_array_length(v_profile->'dislikes') > 20
      or length(coalesce(v_profile->>'name', '')) > 160
      or length(coalesce(v_profile->>'wine_preference', '')) > 2000
      or length(coalesce(v_profile->>'notes', '')) > 2000
      or exists (
        select 1 from jsonb_array_elements(
          (v_profile->'allergies') || (v_profile->'intolerances') ||
          (v_profile->'dietary_restrictions') || (v_profile->'dislikes')
        ) item where jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 120
      ) then
      raise exception 'Invalid or unreviewed guest profile' using errcode = '22023';
    end if;
  end loop;

  select * into v_restaurant
  from public.restaurants restaurant
  where restaurant.slug = lower(trim(p_restaurant_slug))
    and restaurant.business_id is not null
    and restaurant.public_reservations_enabled;

  if v_restaurant.id is null then
    raise exception 'Restaurant is not available for public reservations' using errcode = '22023';
  end if;

  v_lock_key := hashtextextended(
    v_restaurant.id::text || ':' || p_requested_date::text || ':' || p_requested_time::text,
    49
  );
  perform pg_advisory_xact_lock(v_lock_key);

  select *
  into v_available_slot
  from public.resolve_public_reservation_slots_v1(
    v_restaurant.slug,
    p_requested_date,
    p_party_size
  ) slot
  where slot.requested_time = p_requested_time
    and slot.availability_status = 'available'
  limit 1;

  if not found then
    raise exception 'Selected reservation time is no longer available'
      using errcode = '23514';
  end if;

  insert into public.reservations (
    business_id, restaurant_id, guest_name, guest_email, guest_phone,
    requested_date, requested_time, party_size, status, occasion,
    special_request, source
  )
  values (
    v_restaurant.business_id, v_restaurant.id, trim(p_guest_name),
    lower(trim(p_guest_email)), nullif(trim(p_guest_phone), ''),
    p_requested_date, p_requested_time, p_party_size, 'pending',
    nullif(trim(p_occasion), ''), nullif(trim(p_special_request), ''),
    'public_request'
  )
  returning id into v_reservation_id;

  insert into public.reservation_timeline_events (
    canonical_reservation_id, event_type, event_label, event_description, created_by
  )
  values (
    v_reservation_id,
    'reservation_request_created',
    'Reservation request created',
    format(
      '%s requested %s at %s for %s guests (source: public_request)',
      trim(p_guest_name), p_requested_date, p_requested_time, p_party_size
    ),
    null
  );

  for v_profile in select value from jsonb_array_elements(p_guest_profiles)
  loop
    v_position := v_position + 1;
    v_name := nullif(trim(v_profile->>'name'), '');
    insert into public.reservation_guests (
      canonical_reservation_id, full_name, guest_position, is_host
    )
    values (v_reservation_id, v_name, v_position, v_position = 1)
    returning id into v_reservation_guest_id;

    insert into public.guest_dietary_profiles (
      reservation_guest_id, allergies, intolerances, dietary_restrictions,
      dislikes, wine_preferences, notes
    )
    values (
      v_reservation_guest_id,
      array(select jsonb_array_elements_text(v_profile->'allergies')),
      array(select jsonb_array_elements_text(v_profile->'intolerances')),
      array(select jsonb_array_elements_text(v_profile->'dietary_restrictions')),
      array(select jsonb_array_elements_text(v_profile->'dislikes')),
      nullif(trim(v_profile->>'wine_preference'), ''),
      nullif(trim(concat_ws(E'\n', nullif(v_profile->>'notes', ''), case when v_position = 1 then nullif(p_experience_notes, '') end)), '')
    );
  end loop;

  return true;
end;
$$;

revoke all on function public.create_public_reservation_v3(
  text, text, text, text, date, time without time zone, integer, text, text, text, jsonb
) from public;
grant execute on function public.create_public_reservation_v3(
  text, text, text, text, date, time without time zone, integer, text, text, text, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';
