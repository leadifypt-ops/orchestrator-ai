begin;
do $$
declare v_business uuid;v_user uuid;v_restaurant uuid;v_reservation uuid;v_token text;v_submission uuid;v_review uuid;
 v_original text;v_status text;v_guest_count bigint;v_note_id uuid;v_communication_id uuid;
begin
 select m.business_id,m.user_id,r.id into v_business,v_user,v_restaurant from public.business_memberships m join public.restaurants r on r.business_id=m.business_id
 where m.role in ('owner','manager','staff') order by m.created_at limit 1;
 if v_business is null then raise exception 'Existing Business fixture required'; end if;
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 insert into public.reservations(business_id,restaurant_id,guest_name,requested_date,requested_time,party_size,status,source)
 values(v_business,v_restaurant,'Block 47 Validation',current_date+7,'19:30',2,'accepted','manual') returning id into v_reservation;
 select generated.token into v_token from public.generate_reservation_confirmation_token(v_reservation) generated;
 select count(*) into v_guest_count from public.guest_identities where business_id=v_business;

 v_submission:=public.submit_guest_reservation_notes(v_token,'Shellfish allergy',null,null,'Quiet table requested');
 select public.guest_submission_summary(s) into v_original from public.reservation_guest_submissions s where s.id=v_submission;
 if not exists(select 1 from public.list_guest_update_reviews(v_business,v_restaurant,null,'pending_review','guest_notes') where submission_id=v_submission) then raise exception 'Pending queue omitted update'; end if;
 v_review:=public.review_guest_submission(v_submission,'accepted','Relevant for service briefing');
 if (select public.guest_submission_summary(s) from public.reservation_guest_submissions s where s.id=v_submission)<>v_original then raise exception 'Original submission changed'; end if;
 begin perform public.review_guest_submission(v_submission,'dismissed','Duplicate');raise exception 'Duplicate review succeeded';exception when sqlstate '22023' then null;end;

 v_submission:=public.submit_guest_reservation_notes(v_token,null,null,null,'No action required');
 begin perform public.review_guest_submission(v_submission,'dismissed',null);raise exception 'Dismissal without reason succeeded';exception when sqlstate '22023' then null;end;
 perform public.review_guest_submission(v_submission,'dismissed','Not operationally relevant');

 v_submission:=public.submit_guest_reservation_notes(v_token,'Dairy-free',null,null,null);
 perform public.review_guest_submission(v_submission,'converted_to_internal_note','Kitchen briefing');
 select linked_internal_note_id into v_note_id from public.reservation_guest_submission_reviews where submission_id=v_submission;
 if not exists(select 1 from public.reservation_internal_notes where id=v_note_id and canonical_reservation_id=v_reservation) then raise exception 'Linked internal note missing'; end if;

 v_submission:=public.submit_guest_communication_preferences(v_token,'email','en',true);
 perform public.review_guest_submission(v_submission,'converted_to_communication_task','Clarify arrival time');
 select linked_communication_id into v_communication_id from public.reservation_guest_submission_reviews where submission_id=v_submission;
 if not exists(select 1 from public.reservation_communications where id=v_communication_id and status='draft' and marked_sent_at is null) then raise exception 'Linked unsent communication draft missing'; end if;
 if (select count(*) from public.reservation_timeline_events where canonical_reservation_id=v_reservation and event_type='guest_update_review')<>4 then raise exception 'Review timeline incomplete'; end if;
 select status into v_status from public.reservations where id=v_reservation;
 if v_status<>'accepted' then raise exception 'Review changed reservation status'; end if;
 if (select count(*) from public.guest_identities where business_id=v_business)<>v_guest_count then raise exception 'Review mutated CRM identities'; end if;
 begin update public.reservation_guest_submission_reviews set review_reason='Changed' where id=v_review;raise exception 'Review journal mutable';exception when sqlstate '55000' then null;end;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.review_guest_submission(v_submission,'accepted',null);raise exception 'Cross-business review succeeded';exception when sqlstate '42501' then null;end;
end $$;
rollback;
select 'block_47_guest_update_review_valid' result;
