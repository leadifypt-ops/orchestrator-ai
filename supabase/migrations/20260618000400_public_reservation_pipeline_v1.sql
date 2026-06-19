-- Atomic public creation for canonical reservation requests.

create or replace function public.create_public_reservation_v1(
  p_restaurant_slug text,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_requested_date date,
  p_requested_time time without time zone,
  p_party_size integer,
  p_occasion text,
  p_special_request text,
  p_allergies text[],
  p_intolerances text[],
  p_dietary_restrictions text[],
  p_dislikes text[],
  p_wine_preferences text,
  p_experience_notes text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_restaurant_id uuid;
  v_reservation_id uuid;
  v_reservation_guest_id uuid;
  v_guest_name text := nullif(trim(p_guest_name), '');
  v_guest_email text := lower(nullif(trim(p_guest_email), ''));
  v_has_profile boolean;
begin
  if nullif(trim(p_restaurant_slug), '') is null
    or length(trim(p_restaurant_slug)) > 120 then
    raise exception 'Restaurant is required' using errcode = '22023';
  end if;

  if v_guest_name is null or length(v_guest_name) > 160 then
    raise exception 'A valid guest name is required' using errcode = '22023';
  end if;

  if v_guest_email is null
    or length(v_guest_email) > 320
    or v_guest_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;

  if p_requested_date is null or p_requested_time is null then
    raise exception 'A requested date and time are required' using errcode = '22023';
  end if;

  if p_party_size is null or p_party_size < 1 or p_party_size > 20 then
    raise exception 'Party size must be between 1 and 20' using errcode = '22023';
  end if;

  if length(coalesce(p_guest_phone, '')) > 50
    or length(coalesce(p_occasion, '')) > 200
    or length(coalesce(p_special_request, '')) > 2000
    or length(coalesce(p_wine_preferences, '')) > 2000
    or length(coalesce(p_experience_notes, '')) > 2000 then
    raise exception 'One or more fields exceed the allowed length'
      using errcode = '22023';
  end if;

  if cardinality(coalesce(p_allergies, '{}')) > 20
    or cardinality(coalesce(p_intolerances, '{}')) > 20
    or cardinality(coalesce(p_dietary_restrictions, '{}')) > 20
    or cardinality(coalesce(p_dislikes, '{}')) > 20
    or exists (
      select 1
      from unnest(
        coalesce(p_allergies, '{}')
        || coalesce(p_intolerances, '{}')
        || coalesce(p_dietary_restrictions, '{}')
        || coalesce(p_dislikes, '{}')
      ) item
      where length(item) > 120
    ) then
    raise exception 'Dietary profile values exceed the allowed size'
      using errcode = '22023';
  end if;

  select restaurant.id, restaurant.business_id
  into v_restaurant_id, v_business_id
  from public.restaurants restaurant
  where restaurant.slug = lower(trim(p_restaurant_slug))
    and restaurant.business_id is not null;

  if v_restaurant_id is null or v_business_id is null then
    raise exception 'Restaurant is not available for public reservations'
      using errcode = '22023';
  end if;

  insert into public.reservations (
    business_id,
    restaurant_id,
    guest_name,
    guest_email,
    guest_phone,
    requested_date,
    requested_time,
    party_size,
    status,
    occasion,
    special_request,
    source
  )
  values (
    v_business_id,
    v_restaurant_id,
    v_guest_name,
    v_guest_email,
    nullif(trim(p_guest_phone), ''),
    p_requested_date,
    p_requested_time,
    p_party_size,
    'pending',
    nullif(trim(p_occasion), ''),
    nullif(trim(p_special_request), ''),
    'public_request'
  )
  returning id into v_reservation_id;

  insert into public.reservation_timeline_events (
    canonical_reservation_id,
    event_type,
    event_label,
    event_description,
    created_by
  )
  values (
    v_reservation_id,
    'reservation_request_created',
    'Reservation request created',
    format(
      '%s requested %s at %s (source: public_request)',
      v_guest_name,
      p_requested_date,
      p_requested_time
    ),
    null
  );

  v_has_profile :=
    cardinality(coalesce(p_allergies, '{}')) > 0
    or cardinality(coalesce(p_intolerances, '{}')) > 0
    or cardinality(coalesce(p_dietary_restrictions, '{}')) > 0
    or cardinality(coalesce(p_dislikes, '{}')) > 0
    or nullif(trim(p_wine_preferences), '') is not null
    or nullif(trim(p_experience_notes), '') is not null;

  if v_has_profile then
    insert into public.reservation_guests (
      canonical_reservation_id,
      full_name,
      guest_position,
      is_host
    )
    values (v_reservation_id, v_guest_name, 1, true)
    returning id into v_reservation_guest_id;

    insert into public.guest_dietary_profiles (
      reservation_guest_id,
      allergies,
      intolerances,
      dietary_restrictions,
      dislikes,
      wine_preferences,
      notes
    )
    values (
      v_reservation_guest_id,
      coalesce(p_allergies, '{}'),
      coalesce(p_intolerances, '{}'),
      coalesce(p_dietary_restrictions, '{}'),
      coalesce(p_dislikes, '{}'),
      nullif(trim(p_wine_preferences), ''),
      nullif(trim(p_experience_notes), '')
    );
  end if;

  return true;
end;
$$;

revoke all on function public.create_public_reservation_v1(
  text, text, text, text, date, time without time zone, integer, text, text,
  text[], text[], text[], text[], text, text
) from public;

grant execute on function public.create_public_reservation_v1(
  text, text, text, text, date, time without time zone, integer, text, text,
  text[], text[], text[], text[], text, text
) to anon, authenticated;
