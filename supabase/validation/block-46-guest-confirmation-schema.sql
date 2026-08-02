do $$
declare v_function regprocedure;
begin
 if to_regclass('public.reservation_confirmation_tokens') is null or to_regclass('public.reservation_confirmation_events') is null or to_regclass('public.reservation_guest_submissions') is null then raise exception 'Block 46 tables missing'; end if;
 if not(select relrowsecurity from pg_class where oid='public.reservation_confirmation_tokens'::regclass)
  or not(select relrowsecurity from pg_class where oid='public.reservation_confirmation_events'::regclass)
  or not(select relrowsecurity from pg_class where oid='public.reservation_guest_submissions'::regclass) then raise exception 'Block 46 RLS missing'; end if;
 if has_table_privilege('anon','public.reservation_confirmation_tokens','select')
  or has_table_privilege('anon','public.reservation_guest_submissions','select')
  or has_table_privilege('authenticated','public.reservation_confirmation_tokens','insert')
  or has_table_privilege('authenticated','public.reservation_guest_submissions','insert') then raise exception 'Direct table grants exceed contract'; end if;
 foreach v_function in array array[
  'public.resolve_guest_confirmation(text)'::regprocedure,
  'public.submit_guest_communication_preferences(text,text,text,boolean)'::regprocedure,
  'public.submit_guest_reservation_notes(text,text,text,text,text)'::regprocedure
 ] loop
  if not has_function_privilege('anon',v_function,'execute') then raise exception 'Public RPC unavailable: %',v_function; end if;
 end loop;
 foreach v_function in array array[
  'public.generate_reservation_confirmation_token(uuid)'::regprocedure,
  'public.revoke_reservation_confirmation_token(uuid,text)'::regprocedure
 ] loop
  if has_function_privilege('anon',v_function,'execute') or not has_function_privilege('authenticated',v_function,'execute') then raise exception 'Internal token RPC grant incorrect: %',v_function; end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgrelid='public.reservation_confirmation_events'::regclass and tgname='reservation_confirmation_events_append_only' and not tgisinternal)
  or not exists(select 1 from pg_trigger where tgrelid='public.reservation_guest_submissions'::regclass and tgname='reservation_guest_submissions_append_only' and not tgisinternal) then raise exception 'Append-only triggers missing'; end if;
end $$;
select 'block_46_guest_confirmation_schema_valid' result;
