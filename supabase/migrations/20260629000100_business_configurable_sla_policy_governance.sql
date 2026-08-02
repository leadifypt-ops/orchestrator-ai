-- Block 40: Business-configurable, informational reconciliation SLA policies.
-- Policies never assign, escalate, recover, close, or otherwise mutate queue work.

create table if not exists public.reconciliation_sla_policies (
  business_id uuid primary key references public.businesses(id) on delete restrict,
  high_priority_hours integer not null check (high_priority_hours between 1 and 720),
  medium_priority_hours integer not null check (medium_priority_hours between 1 and 720),
  low_priority_hours integer not null check (low_priority_hours between 1 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.reconciliation_sla_policy_audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  change_type text not null check (change_type in ('initialized', 'policy_changed')),
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reconciliation_sla_policy_audit_business_created_idx
  on public.reconciliation_sla_policy_audit_events (business_id, created_at desc, id desc);

alter table public.reconciliation_sla_policies enable row level security;
alter table public.reconciliation_sla_policy_audit_events enable row level security;

revoke all on public.reconciliation_sla_policies from anon, authenticated;
revoke all on public.reconciliation_sla_policy_audit_events from anon, authenticated;
grant select on public.reconciliation_sla_policies to authenticated;
grant select on public.reconciliation_sla_policy_audit_events to authenticated;

drop policy if exists "Members can read reconciliation SLA policies"
  on public.reconciliation_sla_policies;
create policy "Members can read reconciliation SLA policies"
  on public.reconciliation_sla_policies
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "Members can read reconciliation SLA policy history"
  on public.reconciliation_sla_policy_audit_events;
create policy "Members can read reconciliation SLA policy history"
  on public.reconciliation_sla_policy_audit_events
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.prevent_reconciliation_sla_history_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Reconciliation SLA policy history is append-only'
    using errcode = '55000';
end;
$$;

revoke all on function public.prevent_reconciliation_sla_history_mutation_v1()
  from public, anon, authenticated;

drop trigger if exists reconciliation_sla_policy_prevent_delete
  on public.reconciliation_sla_policies;
create trigger reconciliation_sla_policy_prevent_delete
before delete on public.reconciliation_sla_policies
for each row execute function public.prevent_reconciliation_sla_history_mutation_v1();

drop trigger if exists reconciliation_sla_policy_audit_prevent_mutation
  on public.reconciliation_sla_policy_audit_events;
create trigger reconciliation_sla_policy_audit_prevent_mutation
before update or delete on public.reconciliation_sla_policy_audit_events
for each row execute function public.prevent_reconciliation_sla_history_mutation_v1();

create or replace function public.initialize_reconciliation_sla_policy_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy jsonb := jsonb_build_object(
    'high_priority_hours', 24,
    'medium_priority_hours', 72,
    'low_priority_hours', 120
  );
begin
  insert into public.reconciliation_sla_policies (
    business_id,
    high_priority_hours,
    medium_priority_hours,
    low_priority_hours
  ) values (new.id, 24, 72, 120)
  on conflict (business_id) do nothing;

  if found then
    insert into public.reconciliation_sla_policy_audit_events (
      business_id,
      change_type,
      new_values
    ) values (
      new.id,
      'initialized',
      v_policy || jsonb_build_object('source', 'business_created_default')
    );
  end if;

  return new;
end;
$$;

revoke all on function public.initialize_reconciliation_sla_policy_v1()
  from public, anon, authenticated;

drop trigger if exists businesses_initialize_reconciliation_sla_policy
  on public.businesses;
create trigger businesses_initialize_reconciliation_sla_policy
after insert on public.businesses
for each row execute function public.initialize_reconciliation_sla_policy_v1();

with inserted as (
  insert into public.reconciliation_sla_policies (
    business_id,
    high_priority_hours,
    medium_priority_hours,
    low_priority_hours
  )
  select business.id, 24, 72, 120
  from public.businesses business
  on conflict (business_id) do nothing
  returning business_id, high_priority_hours, medium_priority_hours, low_priority_hours
)
insert into public.reconciliation_sla_policy_audit_events (
  business_id,
  change_type,
  new_values
)
select
  inserted.business_id,
  'initialized',
  jsonb_build_object(
    'high_priority_hours', inserted.high_priority_hours,
    'medium_priority_hours', inserted.medium_priority_hours,
    'low_priority_hours', inserted.low_priority_hours,
    'source', 'block_40_default'
  )
from inserted;

create or replace function public.set_reconciliation_sla_policy_v1(
  p_business_id uuid,
  p_high_priority_hours integer,
  p_medium_priority_hours integer,
  p_low_priority_hours integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_policy public.reconciliation_sla_policies%rowtype;
  v_previous jsonb;
  v_current jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select membership.role into v_role
  from public.business_memberships membership
  where membership.business_id = p_business_id
    and membership.user_id = v_actor;

  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'Owner or manager role required to change SLA policy'
      using errcode = '42501';
  end if;

  if p_high_priority_hours not between 1 and 720
    or p_medium_priority_hours not between 1 and 720
    or p_low_priority_hours not between 1 and 720 then
    raise exception 'SLA hours must be between 1 and 720'
      using errcode = '22023';
  end if;

  select * into v_policy
  from public.reconciliation_sla_policies policy
  where policy.business_id = p_business_id
  for update;

  if v_policy.business_id is null then
    raise exception 'SLA policy not found for Business' using errcode = 'P0002';
  end if;

  v_previous := jsonb_build_object(
    'high_priority_hours', v_policy.high_priority_hours,
    'medium_priority_hours', v_policy.medium_priority_hours,
    'low_priority_hours', v_policy.low_priority_hours
  );
  v_current := jsonb_build_object(
    'high_priority_hours', p_high_priority_hours,
    'medium_priority_hours', p_medium_priority_hours,
    'low_priority_hours', p_low_priority_hours
  );

  if v_previous = v_current then
    return jsonb_build_object(
      'business_id', p_business_id,
      'changed', false,
      'policy', v_current
    );
  end if;

  update public.reconciliation_sla_policies
  set high_priority_hours = p_high_priority_hours,
      medium_priority_hours = p_medium_priority_hours,
      low_priority_hours = p_low_priority_hours,
      updated_at = now(),
      updated_by = v_actor
  where business_id = p_business_id;

  insert into public.reconciliation_sla_policy_audit_events (
    business_id,
    change_type,
    previous_values,
    new_values,
    changed_by
  ) values (
    p_business_id,
    'policy_changed',
    v_previous,
    v_current,
    v_actor
  );

  return jsonb_build_object(
    'business_id', p_business_id,
    'changed', true,
    'policy', v_current
  );
end;
$$;

revoke all on function public.set_reconciliation_sla_policy_v1(
  uuid, integer, integer, integer
) from public, anon;
grant execute on function public.set_reconciliation_sla_policy_v1(
  uuid, integer, integer, integer
) to authenticated;

notify pgrst, 'reload schema';
