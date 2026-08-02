do $$
declare v_function regprocedure;
begin
 if to_regclass('public.reservation_communications') is null or to_regclass('public.reservation_communication_events') is null then raise exception 'Communication tables missing'; end if;
 if not(select relrowsecurity from pg_class where oid='public.reservation_communications'::regclass)
   or not(select relrowsecurity from pg_class where oid='public.reservation_communication_events'::regclass) then raise exception 'Communication RLS missing'; end if;
 if has_table_privilege('anon','public.reservation_communications','select')
   or has_table_privilege('authenticated','public.reservation_communications','insert')
   or has_table_privilege('authenticated','public.reservation_communications','update')
   or has_table_privilege('authenticated','public.reservation_communications','delete') then raise exception 'Communication grants allow direct mutation'; end if;
 if has_table_privilege('authenticated','public.reservation_communication_events','insert')
   or has_table_privilege('authenticated','public.reservation_communication_events','update')
   or has_table_privilege('authenticated','public.reservation_communication_events','delete') then raise exception 'Communication journal is directly mutable'; end if;
 foreach v_function in array array[
  'public.create_reservation_confirmation_draft(uuid,text,text)'::regprocedure,
  'public.update_reservation_communication_draft(uuid,text,text,text)'::regprocedure,
  'public.mark_reservation_communication_ready(uuid)'::regprocedure,
  'public.mark_reservation_communication_sent(uuid)'::regprocedure,
  'public.cancel_reservation_communication(uuid,text)'::regprocedure,
  'public.list_reservation_communications(uuid)'::regprocedure,
  'public.list_reservation_communication_queue(uuid,uuid,text,text,text)'::regprocedure
 ] loop
  if has_function_privilege('anon',v_function,'execute') or not has_function_privilege('authenticated',v_function,'execute') then raise exception 'Incorrect RPC grant: %',v_function; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgrelid='public.reservation_communication_events'::regclass and tgname='reservation_communication_events_append_only' and not tgisinternal) then raise exception 'Append-only communication trigger missing'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.reservation_communications'::regclass and not tgisinternal) then raise exception 'Automated communication trigger detected'; end if;
end $$;
select 'block_45_reservation_communication_schema_valid' result;
