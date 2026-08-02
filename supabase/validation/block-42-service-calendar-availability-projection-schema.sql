do $$
declare
  v_table text;
  v_function regprocedure;
begin
  foreach v_table in array array[
    'service_period_calendar_settings',
    'recurring_availability_exceptions'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Missing Block 42 table: %', v_table;
    end if;
    if not exists (
      select 1 from pg_class relation
      where relation.oid = to_regclass('public.' || v_table)
        and relation.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on %', v_table;
    end if;
  end loop;

  if (select count(*) from pg_policies
      where schemaname = 'public'
        and tablename in (
          'service_period_calendar_settings',
          'recurring_availability_exceptions'
        ) and cmd = 'SELECT') <> 2 then
    raise exception 'Block 42 read policies are incomplete';
  end if;

  if has_table_privilege('anon', 'public.service_period_calendar_settings', 'select')
    or has_table_privilege('anon', 'public.recurring_availability_exceptions', 'select')
    or has_table_privilege('authenticated', 'public.service_period_calendar_settings', 'insert')
    or has_table_privilege('authenticated', 'public.recurring_availability_exceptions', 'update')
    or has_table_privilege('authenticated', 'public.recurring_availability_exceptions', 'delete') then
    raise exception 'Block 42 table grants exceed the read-only contract';
  end if;

  foreach v_function in array array[
    'public.save_service_period_calendar_v1(uuid,smallint[])'::regprocedure,
    'public.save_recurring_availability_exception_v1(uuid,uuid,uuid,smallint[],date,date,text,text,boolean,time without time zone,time without time zone,uuid)'::regprocedure,
    'public.get_restaurant_operational_calendar_v1(uuid,uuid,date,date)'::regprocedure,
    'public.list_restaurant_availability_exceptions_v1(uuid,uuid,date,date)'::regprocedure,
    'public.project_restaurant_availability_v1(uuid,uuid,date,date)'::regprocedure,
    'public.get_restaurant_availability_daily_summary_v1(uuid,uuid,date,date)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_function, 'execute')
      or not has_function_privilege('authenticated', v_function, 'execute') then
      raise exception 'Incorrect authenticated-only grant for %', v_function;
    end if;
  end loop;

  if (select count(*) from pg_trigger trigger_row
      where trigger_row.tgname in (
        'service_period_calendar_prevent_delete',
        'recurring_availability_exceptions_prevent_delete',
        'business_service_periods_create_calendar_default'
      ) and not trigger_row.tgisinternal) <> 3 then
    raise exception 'Block 42 retention/default triggers are incomplete';
  end if;

  if not exists (
    select 1 from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.reservation_availability_audit_events'::regclass
      and pg_get_constraintdef(constraint_row.oid) like '%service_calendar%'
      and pg_get_constraintdef(constraint_row.oid) like '%recurring_exception%'
  ) then
    raise exception 'Availability audit does not accept Block 42 entity types';
  end if;

  if exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.reservations'::regclass
      and not trigger_row.tgisinternal
      and trigger_row.tgname like '%availability%'
  ) then
    raise exception 'Block 42 must not add automated reservation decisions';
  end if;
end;
$$;

select 'block_42_service_calendar_availability_projection_schema_valid' as result;
