do $$
declare v_table text; v_function regprocedure;
begin
  foreach v_table in array array['operational_capacity_overrides','operational_capacity_notes'] loop
    if to_regclass('public.' || v_table) is null then raise exception 'Missing Block 43 table: %', v_table; end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass('public.' || v_table)) then raise exception 'RLS missing on %', v_table; end if;
  end loop;
  if has_table_privilege('anon','public.operational_capacity_overrides','select')
    or has_table_privilege('authenticated','public.operational_capacity_overrides','insert')
    or has_table_privilege('authenticated','public.operational_capacity_notes','update') then
    raise exception 'Block 43 grants exceed read-only table access';
  end if;
  foreach v_function in array array[
    'public.save_operational_capacity_override_v1(uuid,uuid,uuid,date,integer,text)'::regprocedure,
    'public.end_operational_capacity_override_v1(uuid,text)'::regprocedure,
    'public.save_operational_capacity_note_v1(uuid,uuid,uuid,date,text,text)'::regprocedure,
    'public.end_operational_capacity_note_v1(uuid,text)'::regprocedure,
    'public.project_operational_capacity_review_v1(uuid,uuid,date,date)'::regprocedure
  ] loop
    if has_function_privilege('anon',v_function,'execute') or not has_function_privilege('authenticated',v_function,'execute') then raise exception 'Incorrect RPC grant: %', v_function; end if;
  end loop;
  if (select count(*) from pg_trigger where tgname in ('operational_capacity_overrides_prevent_delete','operational_capacity_notes_prevent_delete') and not tgisinternal) <> 2 then raise exception 'Retention triggers missing'; end if;
  if exists (select 1 from pg_trigger where tgrelid='public.reservations'::regclass and not tgisinternal and tgname like '%capacity%') then raise exception 'Automated reservation capacity trigger detected'; end if;
end; $$;
select 'block_43_operational_capacity_review_schema_valid' as result;
