begin;

do $$
declare
  v_business_id uuid;
  v_user_id uuid;
  v_original_role text;
  v_original public.reconciliation_sla_policies%rowtype;
  v_high integer;
  v_medium integer;
  v_low integer;
  v_audit_count bigint;
  v_result jsonb;
  v_cross_business_id uuid := gen_random_uuid();
begin
  select membership.business_id, membership.user_id, membership.role
  into v_business_id, v_user_id, v_original_role
  from public.business_memberships membership
  join public.reconciliation_sla_policies policy
    on policy.business_id = membership.business_id
  order by membership.created_at, membership.business_id
  limit 1;

  if v_business_id is null or v_user_id is null then
    raise exception 'An existing Business member and SLA policy are required';
  end if;

  if has_table_privilege('anon', 'public.reconciliation_sla_policies', 'select')
    or has_table_privilege('anon', 'public.reconciliation_sla_policy_audit_events', 'select')
    or has_function_privilege(
      'anon',
      'public.set_reconciliation_sla_policy_v1(uuid,integer,integer,integer)',
      'execute'
    ) then
    raise exception 'Anonymous SLA policy access is not allowed';
  end if;

  if has_table_privilege('authenticated', 'public.reconciliation_sla_policies', 'insert')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policies', 'update')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policies', 'delete')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policy_audit_events', 'insert')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policy_audit_events', 'update')
    or has_table_privilege('authenticated', 'public.reconciliation_sla_policy_audit_events', 'delete') then
    raise exception 'Authenticated clients must have read-only table access';
  end if;

  select * into v_original
  from public.reconciliation_sla_policies policy
  where policy.business_id = v_business_id;

  v_high := case when v_original.high_priority_hours = 720 then 719 else v_original.high_priority_hours + 1 end;
  v_medium := case when v_original.medium_priority_hours = 720 then 719 else v_original.medium_priority_hours + 1 end;
  v_low := case when v_original.low_priority_hours = 720 then 719 else v_original.low_priority_hours + 1 end;

  select count(*) into v_audit_count
  from public.reconciliation_sla_policy_audit_events audit
  where audit.business_id = v_business_id;

  update public.business_memberships
  set role = 'owner'
  where business_id = v_business_id and user_id = v_user_id;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  select public.set_reconciliation_sla_policy_v1(
    v_business_id, v_high, v_medium, v_low
  ) into v_result;

  if coalesce((v_result ->> 'changed')::boolean, false) is not true
    or not exists (
      select 1
      from public.reconciliation_sla_policies policy
      where policy.business_id = v_business_id
        and policy.high_priority_hours = v_high
        and policy.medium_priority_hours = v_medium
        and policy.low_priority_hours = v_low
        and policy.updated_by = v_user_id
    ) then
    raise exception 'Authorized policy update did not persist';
  end if;

  if (select count(*) from public.reconciliation_sla_policy_audit_events audit
      where audit.business_id = v_business_id) <> v_audit_count + 1
    or not exists (
      select 1
      from public.reconciliation_sla_policy_audit_events audit
      where audit.business_id = v_business_id
        and audit.change_type = 'policy_changed'
        and audit.changed_by = v_user_id
        and (audit.previous_values ->> 'high_priority_hours')::integer = v_original.high_priority_hours
        and (audit.new_values ->> 'high_priority_hours')::integer = v_high
    ) then
    raise exception 'Policy update did not append a complete audit event';
  end if;

  perform public.set_reconciliation_sla_policy_v1(
    v_business_id, v_high, v_medium, v_low
  );
  if (select count(*) from public.reconciliation_sla_policy_audit_events audit
      where audit.business_id = v_business_id) <> v_audit_count + 1 then
    raise exception 'No-op policy updates must not append audit noise';
  end if;

  update public.business_memberships
  set role = 'staff'
  where business_id = v_business_id and user_id = v_user_id;

  begin
    perform public.set_reconciliation_sla_policy_v1(
      v_business_id, v_original.high_priority_hours,
      v_original.medium_priority_hours, v_original.low_priority_hours
    );
    raise exception 'Staff unexpectedly changed the SLA policy';
  exception when sqlstate '42501' then
    null;
  end;

  update public.business_memberships
  set role = 'owner'
  where business_id = v_business_id and user_id = v_user_id;

  begin
    perform public.set_reconciliation_sla_policy_v1(v_business_id, 0, 72, 120);
    raise exception 'Invalid SLA range unexpectedly succeeded';
  exception when sqlstate '22023' then
    null;
  end;

  begin
    update public.reconciliation_sla_policy_audit_events
    set new_values = '{}'::jsonb
    where business_id = v_business_id;
    raise exception 'SLA policy audit history was mutable';
  exception when sqlstate '55000' then
    null;
  end;

  begin
    delete from public.reconciliation_sla_policies
    where business_id = v_business_id;
    raise exception 'Current SLA policy was deletable';
  exception when sqlstate '55000' then
    null;
  end;

  insert into public.businesses (id, name, slug)
  values (
    v_cross_business_id,
    'Block 40 Cross Business',
    'block-40-cross-' || txid_current()::text
  );

  if not exists (
    select 1
    from public.reconciliation_sla_policies policy
    where policy.business_id = v_cross_business_id
      and policy.high_priority_hours = 24
      and policy.medium_priority_hours = 72
      and policy.low_priority_hours = 120
  ) or not exists (
    select 1
    from public.reconciliation_sla_policy_audit_events audit
    where audit.business_id = v_cross_business_id
      and audit.change_type = 'initialized'
  ) then
    raise exception 'New Businesses must receive an audited default SLA policy';
  end if;

  perform set_config('block40.test_user', v_user_id::text, true);
  perform set_config('block40.test_business', v_business_id::text, true);
  perform set_config('block40.cross_business', v_cross_business_id::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('block40.test_user'), true);

do $$
begin
  if not exists (
    select 1 from public.reconciliation_sla_policies policy
    where policy.business_id = current_setting('block40.test_business')::uuid
  ) or not exists (
    select 1 from public.reconciliation_sla_policy_audit_events audit
    where audit.business_id = current_setting('block40.test_business')::uuid
  ) then
    raise exception 'RLS hid same-Business SLA policy data';
  end if;

  if exists (
    select 1 from public.reconciliation_sla_policies policy
    where policy.business_id = current_setting('block40.cross_business')::uuid
  ) or exists (
    select 1 from public.reconciliation_sla_policy_audit_events audit
    where audit.business_id = current_setting('block40.cross_business')::uuid
  ) then
    raise exception 'RLS exposed cross-Business SLA policy data';
  end if;
end;
$$;

rollback;

select 'block_40_business_configurable_sla_policy_governance_valid' as result;
