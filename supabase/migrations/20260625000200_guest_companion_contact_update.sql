-- Secure Business-side companion contact capture.

create or replace function public.update_reservation_guest_contact_v1(
  p_reservation_guest_id uuid,
  p_full_name text,
  p_email text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.reservation_guests%rowtype;
  v_identity_id uuid;
  v_email text := lower(nullif(trim(p_email), ''));
  v_phone text := public.normalize_guest_phone_v1(p_phone);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(coalesce(p_full_name, '')) > 160
    or length(coalesce(p_email, '')) > 320
    or length(coalesce(p_phone, '')) > 50
    or (
      v_email is not null
      and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) then
    raise exception 'Invalid guest contact' using errcode = '22023';
  end if;

  select * into v_guest
  from public.reservation_guests guest
  where guest.id = p_reservation_guest_id;

  if v_guest.id is null then
    raise exception 'Reservation guest not found' using errcode = 'P0002';
  end if;

  if v_guest.canonical_reservation_id is not null then
    if not exists (
      select 1
      from public.reservations reservation
      where reservation.id = v_guest.canonical_reservation_id
        and public.is_business_member(reservation.business_id)
    ) then
      raise exception 'Reservation guest is not available'
        using errcode = '42501';
    end if;
  elsif v_guest.reservation_id is not null then
    if not exists (
      select 1
      from public.leads lead
      where lead.id::text = v_guest.reservation_id
        and lead.user_id = auth.uid()
    ) then
      raise exception 'Reservation guest is not available'
        using errcode = '42501';
    end if;
  else
    raise exception 'Reservation guest has no reservation'
      using errcode = '22023';
  end if;

  update public.reservation_guests
  set full_name = nullif(trim(p_full_name), ''),
      email = v_email,
      phone = v_phone,
      updated_at = now()
  where id = v_guest.id
  returning guest_identity_id into v_identity_id;

  return v_identity_id;
end;
$$;

revoke all on function public.update_reservation_guest_contact_v1(
  uuid, text, text, text
) from public, anon;
grant execute on function public.update_reservation_guest_contact_v1(
  uuid, text, text, text
) to authenticated;

notify pgrst, 'reload schema';
