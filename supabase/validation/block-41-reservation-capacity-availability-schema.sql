do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'business_service_periods',
    'reservation_capacity_settings',
    'restaurant_areas',
    'availability_exceptions',
    'reservation_availability_audit_events'
  ] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Missing Block 41 table: %', v_table;
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
          'business_service_periods', 'reservation_capacity_settings',
          'restaurant_areas', 'availability_exceptions',
          'reservation_availability_audit_events'
        ) and cmd = 'SELECT') <> 5 then
    raise exception 'Block 41 read policies are incomplete';
  end if;

  if has_table_privilege('anon', 'public.business_service_periods', 'select')
    or has_table_privilege('authenticated', 'public.business_service_periods', 'insert')
    or has_table_privilege('authenticated', 'public.reservation_capacity_settings', 'update')
    or has_table_privilege('authenticated', 'public.restaurant_areas', 'delete')
    or has_table_privilege('authenticated', 'public.availability_exceptions', 'insert')
    or has_table_privilege('authenticated', 'public.reservation_availability_audit_events', 'update') then
    raise exception 'Block 41 table grants exceed the read-only contract';
  end if;

  if has_function_privilege(
      'anon',
      'public.set_reservation_capacity_v1(uuid,integer,integer,integer,integer)',
      'execute'
    ) or not has_function_privilege(
      'authenticated',
      'public.set_reservation_capacity_v1(uuid,integer,integer,integer,integer)',
      'execute'
    ) then
    raise exception 'Block 41 RPC grants are incorrect';
  end if;

  if (select count(*) from pg_trigger trigger_row
      where trigger_row.tgname in (
        'business_service_periods_prevent_delete',
        'reservation_capacity_settings_prevent_delete',
        'restaurant_areas_prevent_delete',
        'availability_exceptions_prevent_delete',
        'reservation_availability_audit_prevent_mutation'
      ) and not trigger_row.tgisinternal) <> 5 then
    raise exception 'Block 41 retention/audit triggers are incomplete';
  end if;

  if exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.reservations'::regclass
      and not trigger_row.tgisinternal
      and trigger_row.tgname like '%availability%'
  ) then
    raise exception 'Block 41 must not add automated reservation decisions';
  end if;
end;
$$;

select 'block_41_reservation_capacity_availability_schema_valid' as result;
