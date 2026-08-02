begin;
do $$
declare v_business uuid; v_user uuid; v_restaurant uuid; v_period uuid; v_date date := date '2099-06-15'; v_result jsonb; v_override uuid; v_note uuid;
begin
 select membership.business_id,membership.user_id,restaurant.id into v_business,v_user,v_restaurant from public.business_memberships membership join public.restaurants restaurant on restaurant.business_id=membership.business_id order by membership.created_at limit 1;
 if v_business is null then raise exception 'Existing Business fixture required'; end if;
 update public.business_memberships set role='owner' where business_id=v_business and user_id=v_user;
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 select public.save_business_service_period_v1(v_business,v_restaurant,'Block 43 Review','18:00','23:00',true,null) into v_result; v_period := (v_result->>'period_id')::uuid;
 perform public.set_reservation_capacity_v1(v_period,80,12,15,20);
 perform public.save_service_period_calendar_v1(v_period,array[1,2,3,4,5,6,7]::smallint[]);
 select public.save_operational_capacity_override_v1(v_business,v_restaurant,v_period,v_date,52,'Reduced human team') into v_result; v_override := (v_result->>'override_id')::uuid;
 select public.save_operational_capacity_note_v1(v_business,v_restaurant,v_period,v_date,'partial_kitchen','Only cold section available') into v_result; v_note := (v_result->>'note_id')::uuid;
 if not exists (select 1 from public.project_operational_capacity_review_v1(v_business,v_restaurant,v_date,v_date) row where row.service_period_id=v_period and row.original_capacity=80 and row.adjusted_capacity=52 and row.override_reason='Reduced human team' and jsonb_array_length(row.operational_notes)=1) then raise exception 'Review projection did not combine override and note'; end if;
 if not exists (select 1 from public.reservation_availability_audit_events where entity_id=v_override and entity_type='capacity_override' and previous_values->>'capacity'='80' and new_values->>'capacity'='52' and changed_by=v_user) then raise exception 'Override audit incomplete'; end if;
 perform public.end_operational_capacity_override_v1(v_override,'Team restored');
 if not exists (select 1 from public.reservation_availability_audit_events where entity_id=v_override and new_values->>'active'='false') then raise exception 'Override end not audited'; end if;
 begin delete from public.operational_capacity_notes where id=v_note; raise exception 'Note history was deletable'; exception when sqlstate '55000' then null; end;
 update public.business_memberships set role='staff' where business_id=v_business and user_id=v_user;
 begin perform public.save_operational_capacity_override_v1(v_business,v_restaurant,v_period,v_date,40,'Denied'); raise exception 'Staff write succeeded'; exception when sqlstate '42501' then null; end;
 if exists (select 1 from pg_trigger where tgrelid='public.reservations'::regclass and not tgisinternal and tgname like '%capacity%') then raise exception 'Reservation automation introduced'; end if;
end; $$;
rollback;
select 'block_43_operational_capacity_review_valid' as result;
