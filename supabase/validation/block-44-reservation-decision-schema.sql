do $$
declare v_function regprocedure;
begin
 if to_regclass('public.reservation_decision_events') is null then raise exception 'Missing decision event journal'; end if;
 if not(select relrowsecurity from pg_class where oid='public.reservation_decision_events'::regclass) then raise exception 'Decision event RLS missing'; end if;
 if has_table_privilege('anon','public.reservation_decision_events','select')
  or has_table_privilege('authenticated','public.reservation_decision_events','insert')
  or has_table_privilege('authenticated','public.reservation_decision_events','update')
  or has_table_privilege('authenticated','public.reservation_decision_events','delete') then
  raise exception 'Decision journal grants exceed read-only access'; end if;
 if has_column_privilege('authenticated','public.reservations','status','update') then
  raise exception 'Authenticated users can bypass audited status RPCs'; end if;
 foreach v_function in array array[
  'public.accept_reservation(uuid,text)'::regprocedure,
  'public.reject_reservation(uuid,text,text)'::regprocedure,
  'public.return_reservation_to_pending(uuid,text)'::regprocedure,
  'public.list_pending_reservations(uuid,uuid)'::regprocedure
 ] loop
  if has_function_privilege('anon',v_function,'execute') or not has_function_privilege('authenticated',v_function,'execute') then
   raise exception 'Incorrect decision RPC grant: %',v_function; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgrelid='public.reservation_decision_events'::regclass
  and tgname='reservation_decision_events_append_only' and not tgisinternal) then raise exception 'Append-only trigger missing'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.reservations'::regclass and not tgisinternal
  and (tgname like '%accept%' or tgname like '%reject%' or tgname like '%decision%')) then
  raise exception 'Automated reservation decision trigger detected'; end if;
end $$;
select 'block_44_reservation_decision_schema_valid' result;
