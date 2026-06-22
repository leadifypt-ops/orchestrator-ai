-- Public Reservation Form V2: atomically persist one reviewed profile per guest.
-- V1 remains available so existing callers keep their original contract.
create or replace function public.create_public_reservation_v2(
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
  v_business_id uuid;
  v_restaurant_id uuid;
  v_reservation_id uuid;
  v_reservation_guest_id uuid;
  v_profile jsonb;
  v_position integer := 0;
  v_name text;
begin
  if nullif(trim(p_restaurant_slug), '') is null or length(trim(p_restaurant_slug)) > 120
    or nullif(trim(p_guest_name), '') is null or length(trim(p_guest_name)) > 160
    or nullif(trim(p_guest_email), '') is null or length(trim(p_guest_email)) > 320
    or lower(trim(p_guest_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_requested_date is null or p_requested_time is null
    or p_requested_time not in ('19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00')
    or p_party_size is null or p_party_size < 1 or p_party_size > 20 then
    raise exception 'Invalid reservation request' using errcode = '22023';
  end if;
  if length(coalesce(p_guest_phone, '')) > 50 or length(coalesce(p_occasion, '')) > 200 or length(coalesce(p_special_request, '')) > 2000 or length(coalesce(p_experience_notes, '')) > 2000 then
    raise exception 'Reservation fields exceed allowed size' using errcode = '22023';
  end if;
  if jsonb_typeof(p_guest_profiles) <> 'array' or jsonb_array_length(p_guest_profiles) <> p_party_size then
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

  select restaurant.id, restaurant.business_id into v_restaurant_id, v_business_id
  from public.restaurants restaurant
  where restaurant.slug = lower(trim(p_restaurant_slug)) and restaurant.business_id is not null;
  if v_restaurant_id is null or v_business_id is null then
    raise exception 'Restaurant is not available for public reservations' using errcode = '22023';
  end if;

  insert into public.reservations (business_id, restaurant_id, guest_name, guest_email, guest_phone, requested_date, requested_time, party_size, status, occasion, special_request, source)
  values (v_business_id, v_restaurant_id, trim(p_guest_name), lower(trim(p_guest_email)), nullif(trim(p_guest_phone), ''), p_requested_date, p_requested_time, p_party_size, 'pending', nullif(trim(p_occasion), ''), nullif(trim(p_special_request), ''), 'public_request')
  returning id into v_reservation_id;

  insert into public.reservation_timeline_events (canonical_reservation_id, event_type, event_label, event_description, created_by)
  values (v_reservation_id, 'reservation_request_created', 'Reservation request created', format('%s requested %s at %s for %s guests (source: public_request)', trim(p_guest_name), p_requested_date, p_requested_time, p_party_size), null);

  for v_profile in select value from jsonb_array_elements(p_guest_profiles)
  loop
    v_position := v_position + 1;
    v_name := nullif(trim(v_profile->>'name'), '');
    insert into public.reservation_guests (canonical_reservation_id, full_name, guest_position, is_host)
    values (v_reservation_id, v_name, v_position, v_position = 1)
    returning id into v_reservation_guest_id;

    insert into public.guest_dietary_profiles (reservation_guest_id, allergies, intolerances, dietary_restrictions, dislikes, wine_preferences, notes)
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

revoke all on function public.create_public_reservation_v2(text, text, text, text, date, time without time zone, integer, text, text, text, jsonb) from public;
grant execute on function public.create_public_reservation_v2(text, text, text, text, date, time without time zone, integer, text, text, text, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
