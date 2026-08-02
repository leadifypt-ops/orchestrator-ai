do $$
declare v_function regprocedure;
begin
  if to_regclass('public.capacity_override_events') is null then
    raise exception 'Missing append-only capacity override event table';
  end if;
  if not (select relrowsecurity from pg_class where oid=to_regclass('public.capacity_override_events')) then
    raise exception 'RLS missing on capacity_override_events';
  end if;
  if has_table_privilege('anon','public.capacity_override_events','select')
    or has_table_privilege('authenticated','public.capacity_override_events','insert')
    or has_table_privilege('authenticated','public.capacity_override_events','update')
    or has_table_privilege('authenticated','public.capacity_override_events','delete') then
    raise exception 'Capacity override table grants exceed append-only read access';
  end if;
  foreach v_function in array array[
    'public.create_capacity_override(uuid,uuid,uuid,date,text,text,text,integer)'::regprocedure,
    'public.remove_capacity_override(uuid,text,text)'::regprocedure,
    'public.get_capacity_override_history(uuid,uuid,uuid)'::regprocedure,
    'public.list_active_capacity_overrides(uuid,uuid,date,date)'::regprocedure
  ] loop
    if has_function_privilege('anon',v_function,'execute')
      or not has_function_privilege('authenticated',v_function,'execute') then
      raise exception 'Incorrect RPC grant: %',v_function;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid='public.capacity_override_events'::regclass
    and tgname='capacity_override_events_append_only' and not tgisinternal) then
    raise exception 'Append-only trigger missing';
  end if;
  if exists (select 1 from pg_trigger where tgrelid='public.reservations'::regclass
    and not tgisinternal and tgname like '%capacity%') then
    raise exception 'Automated reservation capacity trigger detected';
  end if;
end $$;
select 'block_43_capacity_override_append_only_schema_valid' result;
