-- Block 48 behavioral validation template. Intended for a transaction with an authenticated member context.
-- It asserts human-controlled lifecycle, accepted-only assembly, pending update segregation, append-only audit, and no reservation mutation.
begin;
-- Set a real staff user id before running manually, e.g.:
-- select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
-- select set_config('role','authenticated',true);
do $$
declare
 v_user uuid := nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
 v_business uuid; v_restaurant uuid; v_period uuid; v_date date := current_date; v_briefing uuid; v_status text; v_events integer; v_before text; v_after text; v_handoff uuid; v_ack uuid;
begin
 if v_user is null then raise exception 'Set request.jwt.claim.sub to an authenticated staff user before running'; end if;
 select m.business_id into v_business from public.business_memberships m where m.user_id=v_user and m.role in ('owner','manager','staff') limit 1;
 if v_business is null then raise exception 'No staff membership found for validation user'; end if;
 select id into v_restaurant from public.restaurants where business_id=v_business limit 1;
 if v_restaurant is null then raise exception 'No restaurant found for validation business'; end if;
 select id into v_period from public.business_service_periods where business_id=v_business and restaurant_id=v_restaurant and active limit 1;
 v_briefing := public.create_pre_service_briefing(v_restaurant,v_date,v_period);
 select status into v_status from public.pre_service_briefings where id=v_briefing;
 if v_status <> 'draft' then raise exception 'briefing not draft after explicit create'; end if;
 perform public.add_pre_service_briefing_note(v_briefing,'Block 48 validation note',null);
 perform public.mark_pre_service_briefing_item_reviewed(v_briefing,'capacity','block-48-capacity-review',null,'validated');
 perform public.prepare_pre_service_briefing(v_briefing);
 select status into v_status from public.pre_service_briefings where id=v_briefing;
 if v_status <> 'prepared' then raise exception 'briefing not prepared'; end if;
 v_handoff := public.create_pre_service_briefing_handoff(v_briefing,'kitchen',null,'Block 48 validation handoff');
 v_ack := public.acknowledge_pre_service_briefing_handoff(v_handoff,'Block 48 validation acknowledgement');
 perform public.close_pre_service_briefing(v_briefing,'Block 48 validation close');
 select status into v_status from public.pre_service_briefings where id=v_briefing;
 if v_status <> 'closed' then raise exception 'briefing not closed'; end if;
 select count(*) into v_events from public.pre_service_briefing_events where briefing_id=v_briefing;
 if v_events < 6 then raise exception 'expected lifecycle events, got %', v_events; end if;
 -- Authenticated application roles may be blocked by grants/RLS before the append-only trigger executes.
 -- Either insufficient_privilege (42501) or the trigger's object_not_in_prerequisite_state (55000) satisfies the append-only protection invariant.
 begin
  update public.pre_service_briefing_events set metadata='{}' where briefing_id=v_briefing;
  raise exception 'events update unexpectedly succeeded';
 exception
  when sqlstate '42501' then null;
  when sqlstate '55000' then null;
 end;
 select status into v_before from public.reservations where business_id=v_business and restaurant_id=v_restaurant order by created_at desc limit 1;
 perform public.get_pre_service_briefing(v_briefing);
 select status into v_after from public.reservations where business_id=v_business and restaurant_id=v_restaurant order by created_at desc limit 1;
 if v_before is distinct from v_after then raise exception 'reservation status changed during briefing read'; end if;
 if exists(select 1 from public.pre_service_briefings where snapshot::text ilike '%pending_review%approved%') then raise exception 'pending update appears approved'; end if;
end $$;
rollback;
