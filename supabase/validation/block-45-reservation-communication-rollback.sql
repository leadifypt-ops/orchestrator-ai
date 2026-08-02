begin;
do $$
declare v_business uuid;v_user uuid;v_restaurant uuid;v_accepted uuid;v_pending uuid;v_rejected uuid;v_communication uuid;v_other_user uuid;
begin
 select membership.business_id,membership.user_id,restaurant.id into v_business,v_user,v_restaurant
 from public.business_memberships membership join public.restaurants restaurant on restaurant.business_id=membership.business_id
 where membership.role in ('owner','manager','staff') order by membership.created_at limit 1;
 if v_business is null then raise exception 'Existing Business fixture required'; end if;
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 insert into public.reservations(business_id,restaurant_id,guest_name,guest_email,requested_date,requested_time,party_size,status,source)
 values(v_business,v_restaurant,'Block 45 Accepted','guest@example.com',current_date,'19:30',2,'accepted','manual') returning id into v_accepted;
 insert into public.reservations(business_id,restaurant_id,guest_name,status,source) values(v_business,v_restaurant,'Block 45 Pending','pending','manual') returning id into v_pending;
 insert into public.reservations(business_id,restaurant_id,guest_name,status,source) values(v_business,v_restaurant,'Block 45 Rejected','rejected','manual') returning id into v_rejected;
 v_communication:=public.create_reservation_confirmation_draft(v_accepted,'email','en');
 begin perform public.create_reservation_confirmation_draft(v_pending,'email','en');raise exception 'Pending reservation was confirmable';exception when sqlstate '22023' then null;end;
 begin perform public.create_reservation_confirmation_draft(v_rejected,'email','en');raise exception 'Rejected reservation was confirmable';exception when sqlstate '22023' then null;end;
 perform public.update_reservation_communication_draft(v_communication,'A considered confirmation','Revised premium message.','email');
 perform public.mark_reservation_communication_ready(v_communication);
 perform public.mark_reservation_communication_sent(v_communication);
 if (select status from public.reservation_communications where id=v_communication)<>'marked_sent' then raise exception 'Mark sent failed'; end if;
 if (select count(*) from public.reservation_communication_events where communication_id=v_communication)<>4 then raise exception 'Communication audit incomplete'; end if;
 if (select count(*) from public.reservation_timeline_events where canonical_reservation_id=v_accepted and event_type='reservation_communication')<>4 then raise exception 'Communication timeline incomplete'; end if;
 v_communication:=public.create_reservation_confirmation_draft(v_accepted,'manual','pt');
 begin perform public.cancel_reservation_communication(v_communication,null);raise exception 'Cancellation without reason succeeded';exception when sqlstate '22023' then null;end;
 perform public.cancel_reservation_communication(v_communication,'Guest will be contacted later.');
 begin update public.reservation_communication_events set reason='changed' where communication_id=v_communication;raise exception 'Communication journal mutable';exception when sqlstate '55000' then null;end;
 v_other_user:=gen_random_uuid();perform set_config('request.jwt.claim.sub',v_other_user::text,true);
 begin perform public.list_reservation_communications(v_accepted);raise exception 'Cross-business access succeeded';exception when sqlstate '42501' then null;end;
end $$;
rollback;
select 'block_45_reservation_communication_valid' result;
