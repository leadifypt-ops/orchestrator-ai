-- Atomic manual creation for canonical Business reservations.

create or replace function public.create_manual_reservation_v1(
  p_restaurant_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_requested_date date,
  p_requested_time time without time zone,
  p_party_size integer,
  p_occasion text,
  p_special_request text,
  p_host_guest_name text,
  p_allergies text[],
  p_intolerances text[],
  p_dietary_restrictions text[],
  p_dislikes text[],
  p_wine_preferences text,
  p_profile_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_reservation_id uuid;
  v_reservation_guest_id uuid;
  v_has_profile boolean;
  v_guest_name text := nullif(trim(p_guest_name), '');
  v_host_name text := nullif(trim(p_host_guest_name), '');
  v_requested_slot text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_guest_name is null then
    raise exception 'Guest name is required' using errcode = '22023';
  end if;

  select restaurant.business_id
  into v_business_id
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.business_id is not null
    and public.is_business_member(restaurant.business_id);

  if v_business_id is null then
    raise exception 'Restaurant is not available to this business member'
      using errcode = '42501';
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
    p_restaurant_id,
    v_guest_name,
    nullif(trim(p_guest_email), ''),
    nullif(trim(p_guest_phone), ''),
    p_requested_date,
    p_requested_time,
    p_party_size,
    'pending',
    nullif(trim(p_occasion), ''),
    nullif(trim(p_special_request), ''),
    'manual'
  )
  returning id into v_reservation_id;

  v_requested_slot := concat_ws(
    ' at ',
    p_requested_date::text,
    p_requested_time::text
  );

  insert into public.reservation_timeline_events (
    canonical_reservation_id,
    event_type,
    event_label,
    event_description,
    created_by
  )
  values (
    v_reservation_id,
    'reservation_created',
    'Reservation request created',
    case
      when v_requested_slot <> '' then
        format('%s requested %s (source: manual)', v_guest_name, v_requested_slot)
      else
        format('%s was added manually (source: manual)', v_guest_name)
    end,
    auth.uid()
  );

  v_has_profile :=
    v_host_name is not null
    or cardinality(coalesce(p_allergies, '{}')) > 0
    or cardinality(coalesce(p_intolerances, '{}')) > 0
    or cardinality(coalesce(p_dietary_restrictions, '{}')) > 0
    or cardinality(coalesce(p_dislikes, '{}')) > 0
    or nullif(trim(p_wine_preferences), '') is not null
    or nullif(trim(p_profile_notes), '') is not null;

  if v_has_profile then
    insert into public.reservation_guests (
      canonical_reservation_id,
      full_name,
      guest_position,
      is_host
    )
    values (
      v_reservation_id,
      coalesce(v_host_name, v_guest_name),
      1,
      true
    )
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
      nullif(trim(p_profile_notes), '')
    );

    insert into public.reservation_timeline_events (
      canonical_reservation_id,
      event_type,
      event_label,
      event_description,
      created_by
    )
    values (
      v_reservation_id,
      'gastronomic_profile_added',
      'Gastronomic profile added',
      format('Host profile added for %s', coalesce(v_host_name, v_guest_name)),
      auth.uid()
    );
  end if;

  return v_reservation_id;
end;
$$;

revoke all on function public.create_manual_reservation_v1(
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  integer,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text,
  text
) from public, anon;

grant execute on function public.create_manual_reservation_v1(
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  integer,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text[],
  text,
  text
) to authenticated;
