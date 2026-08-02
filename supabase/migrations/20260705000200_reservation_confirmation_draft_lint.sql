-- Block 45 follow-up: remove the unused draft RPC variable reported by plpgsql_check.
create or replace function public.create_reservation_confirmation_draft(
  p_reservation_id uuid,p_channel text default 'email',p_language text default 'en'
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_reservation public.reservations%rowtype;v_restaurant_name text;v_body text;v_subject text;v_row public.reservation_communications%rowtype;
begin
  v_reservation:=public.assert_reservation_communication_access(p_reservation_id);
  if v_reservation.status<>'accepted' then raise exception 'Only accepted reservations can have confirmation drafts' using errcode='22023'; end if;
  if p_channel not in ('email','phone','whatsapp','sms','manual') then raise exception 'Invalid communication channel' using errcode='22023'; end if;
  if p_language not in ('en','pt') then raise exception 'Unsupported communication language' using errcode='22023'; end if;
  select name into v_restaurant_name from public.restaurants where id=v_reservation.restaurant_id and business_id=v_reservation.business_id;
  if p_language='pt' then
    v_subject:='Confirmação da sua reserva — '||v_restaurant_name;
    v_body:=format(E'Caro/a %s,\n\nTemos o prazer de confirmar a sua reserva no %s para %s às %s, para %s pessoas.\n\nCaso exista alguma alergia, restrição alimentar ou nota especial que devamos considerar, agradecemos que nos informe antes da sua visita.\n\nTeremos todo o gosto em recebê-lo/a.',
      v_reservation.guest_name,v_restaurant_name,coalesce(to_char(v_reservation.requested_date,'DD/MM/YYYY'),'data a confirmar'),
      coalesce(to_char(v_reservation.requested_time,'HH24:MI'),'hora a confirmar'),coalesce(v_reservation.party_size::text,'um número de'));
  else
    v_subject:='Your reservation confirmation — '||v_restaurant_name;
    v_body:=format(E'Dear %s,\n\nWe are pleased to confirm your reservation at %s for %s at %s for %s guests.\n\nIf there are any allergies, dietary restrictions or special notes we should be aware of, please let us know before your visit.\n\nWe look forward to welcoming you.',
      v_reservation.guest_name,v_restaurant_name,coalesce(to_char(v_reservation.requested_date,'DD Mon YYYY'),'a date to be confirmed'),
      coalesce(to_char(v_reservation.requested_time,'HH24:MI'),'a time to be confirmed'),coalesce(v_reservation.party_size::text,'the confirmed'));
  end if;
  insert into public.reservation_communications(business_id,restaurant_id,reservation_id,guest_name,guest_email,guest_phone,
    channel,communication_type,status,subject,body,language,created_by)
  values(v_reservation.business_id,v_reservation.restaurant_id,v_reservation.id,v_reservation.guest_name,v_reservation.guest_email,
    v_reservation.guest_phone,p_channel,'confirmation','draft',v_subject,v_body,p_language,auth.uid()) returning * into v_row;
  perform public.append_reservation_communication_event(v_row,'draft_created',null,null);
  return v_row.id;
end $$;
