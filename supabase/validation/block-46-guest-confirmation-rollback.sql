begin;
do $$
declare v_business uuid;v_user uuid;v_restaurant uuid;v_accepted uuid;v_pending uuid;v_rejected uuid;v_token text;v_token_id uuid;v_other_user uuid;
begin
 select m.business_id,m.user_id,r.id into v_business,v_user,v_restaurant from public.business_memberships m join public.restaurants r on r.business_id=m.business_id
 where m.role in ('owner','manager','staff') order by m.created_at limit 1;
 if v_business is null then raise exception 'Existing Business fixture required'; end if;
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 insert into public.reservations(business_id,restaurant_id,guest_name,requested_date,requested_time,party_size,status,source)
 values(v_business,v_restaurant,'Block 46 Accepted',current_date+7,'19:30',2,'accepted','manual') returning id into v_accepted;
 insert into public.reservations(business_id,restaurant_id,guest_name,status,source) values(v_business,v_restaurant,'Block 46 Pending','pending','manual') returning id into v_pending;
 insert into public.reservations(business_id,restaurant_id,guest_name,status,source) values(v_business,v_restaurant,'Block 46 Rejected','rejected','manual') returning id into v_rejected;
 select generated.token into v_token from public.generate_reservation_confirmation_token(v_accepted) generated;
 select id into v_token_id from public.reservation_confirmation_tokens where reservation_id=v_accepted and revoked_at is null;
 if v_token is null or not exists(select 1 from public.resolve_guest_confirmation(v_token)) then raise exception 'Valid token did not resolve'; end if;
 if exists(select 1 from public.resolve_guest_confirmation(repeat('0',64))) then raise exception 'Invalid token resolved'; end if;
 begin perform public.generate_reservation_confirmation_token(v_pending);raise exception 'Pending token generated';exception when sqlstate '22023' then null;end;
 begin perform public.generate_reservation_confirmation_token(v_rejected);raise exception 'Rejected token generated';exception when sqlstate '22023' then null;end;
 perform public.submit_guest_communication_preferences(v_token,'email','en',true);
 perform public.submit_guest_reservation_notes(v_token,'Shellfish allergy',null,'Step-free access',null);
 if (select count(*) from public.reservation_guest_submissions where reservation_id=v_accepted)<>2 then raise exception 'Guest submissions missing'; end if;
 if (select count(*) from public.reservation_timeline_events where canonical_reservation_id=v_accepted and event_type='guest_confirmation_submission')<>2 then raise exception 'Submission timeline missing'; end if;
 perform public.revoke_reservation_confirmation_token(v_token_id,'Validation revocation');
 if exists(select 1 from public.resolve_guest_confirmation(v_token)) then raise exception 'Revoked token resolved'; end if;
 begin update public.reservation_guest_submissions set general_note='Changed' where reservation_id=v_accepted;raise exception 'Guest submission mutable';exception when sqlstate '55000' then null;end;
 v_other_user:=gen_random_uuid();perform set_config('request.jwt.claim.sub',v_other_user::text,true);
 begin perform public.generate_reservation_confirmation_token(v_accepted);raise exception 'Cross-business token management succeeded';exception when sqlstate '42501' then null;end;
end $$;
rollback;
select 'block_46_guest_confirmation_valid' result;
