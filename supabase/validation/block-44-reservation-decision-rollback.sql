begin;
do $$
declare v_business uuid;v_user uuid;v_restaurant uuid;v_reservation uuid;v_event uuid;
begin
 select membership.business_id,membership.user_id,restaurant.id into v_business,v_user,v_restaurant
 from public.business_memberships membership join public.restaurants restaurant on restaurant.business_id=membership.business_id
 order by membership.created_at limit 1;
 if v_business is null then raise exception 'Existing Business fixture required'; end if;
 update public.business_memberships set role='staff' where business_id=v_business and user_id=v_user;
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 insert into public.reservations(business_id,restaurant_id,guest_name,status,source)
 values(v_business,v_restaurant,'Block 44 Validation','pending','manual') returning id into v_reservation;
 if not exists(select 1 from public.list_pending_reservations(v_business,v_restaurant) where reservation_id=v_reservation) then
  raise exception 'Pending queue omitted reservation'; end if;
 v_event:=public.accept_reservation(v_reservation,'Reviewed manually');
 if (select status from public.reservations where id=v_reservation)<>'accepted' then raise exception 'Acceptance failed'; end if;
 begin perform public.accept_reservation(v_reservation,null);raise exception 'Duplicate acceptance succeeded';exception when sqlstate '22023' then null;end;
 perform public.reject_reservation(v_reservation,'Cannot support requested service','Manager review');
 begin perform public.return_reservation_to_pending(v_reservation,null);raise exception 'Pending return without reason succeeded';exception when sqlstate '22023' then null;end;
 perform public.return_reservation_to_pending(v_reservation,'Reconsidering request');
 if (select count(*) from public.reservation_decision_events where reservation_id=v_reservation)<>3 then raise exception 'Decision audit incomplete'; end if;
 if (select count(*) from public.reservation_timeline_events where canonical_reservation_id=v_reservation and event_type='reservation_decision')<>3 then raise exception 'Timeline incomplete'; end if;
 begin update public.reservation_decision_events set reason='mutated' where id=v_event;raise exception 'Decision audit mutable';exception when sqlstate '55000' then null;end;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.accept_reservation(v_reservation,null);raise exception 'Unauthorized decision succeeded';exception when sqlstate '42501' then null;end;
end $$;
rollback;
select 'block_44_reservation_decision_valid' result;
