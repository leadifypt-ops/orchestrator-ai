do $$
begin
  if to_regclass('public.reconciliation_sla_policies') is null
    or to_regclass('public.reconciliation_sla_policy_audit_events') is null then
    raise exception 'Block 40 SLA policy tables are missing';
  end if;

  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.reconciliation_sla_policies'::regclass
      and relation.relrowsecurity
  ) or not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.reconciliation_sla_policy_audit_events'::regclass
      and relation.relrowsecurity
  ) then
    raise exception 'Block 40 RLS is not enabled';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public'
        and tablename in (
          'reconciliation_sla_policies',
          'reconciliation_sla_policy_audit_events'
        )
        and roles = array['authenticated']::name[]
        and cmd = 'SELECT') <> 2 then
    raise exception 'Block 40 Business-scoped read policies are incomplete';
  end if;

  if has_table_privilege('anon', 'public.reconciliation_sla_policies', 'select')
    or has_table_privilege('anon', 'public.reconciliation_sla_policy_audit_events', 'select')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policies', 'insert')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policies', 'update')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policies', 'delete')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policy_audit_events', 'insert')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policy_audit_events', 'update')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policy_audit_events', 'delete') then
    raise exception 'Block 40 grants exceed the read-only table contract';
  end if;

  if has_function_privilege(
      'anon',
      'public.set_reconciliation_sla_policy_v1(uuid,integer,integer,integer)',
      'execute'
    ) or not has_function_privilege(
      'authenticated',
      'public.set_reconciliation_sla_policy_v1(uuid,integer,integer,integer)',
      'execute'
    ) then
    raise exception 'Block 40 RPC grants are incorrect';
  end if;

  if not exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.reconciliation_sla_policy_audit_events'::regclass
      and trigger_row.tgname = 'reconciliation_sla_policy_audit_prevent_mutation'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.businesses'::regclass
      and trigger_row.tgname = 'businesses_initialize_reconciliation_sla_policy'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'Block 40 governance triggers are incomplete';
  end if;

  if exists (
    select 1
    from public.businesses business
    left join public.reconciliation_sla_policies policy
      on policy.business_id = business.id
    where policy.business_id is null
  ) then
    raise exception 'A Business is missing its SLA policy';
  end if;

  if exists (
    select 1
    from public.reconciliation_sla_policies policy
    where not exists (
      select 1
      from public.reconciliation_sla_policy_audit_events audit
      where audit.business_id = policy.business_id
        and audit.change_type = 'initialized'
    )
  ) then
    raise exception 'An SLA policy is missing initialization history';
  end if;
end;
$$;

select 'block_40_business_configurable_sla_policy_schema_valid' as result;
