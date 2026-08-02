-- Block 36: Business-wide operational reconciliation queue.
-- This layer references identity history but never mutates it.

create table if not exists public.reconciliation_queue_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  reconciliation_type text not null check (
    reconciliation_type in (
      'merge_review',
      'recovery_review',
      'crm_review',
      'conflict_review'
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'in_review', 'completed')
  ),
  priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high')
  ),
  restaurant_id uuid references public.restaurants(id) on delete restrict,
  guest_identity_id uuid references public.guest_identities(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete restrict,
  audit_event_id uuid references public.guest_crm_audit_events(id) on delete restrict,
  merge_audit_event_id uuid references public.guest_crm_audit_events(id) on delete restrict,
  recovery_event_id uuid references public.guest_merge_recovery_events(id) on delete restrict,
  origin text not null check (length(trim(origin)) between 1 and 500),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reconciliation_queue_audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  reconciliation_item_id uuid not null
    references public.reconciliation_queue_items(id) on delete restrict,
  change_type text not null check (
    change_type in (
      'created',
      'status_changed',
      'priority_changed',
      'assignee_changed'
    )
  ),
  previous_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reconciliation_queue_business_updated_idx
  on public.reconciliation_queue_items (business_id, updated_at desc);
create index if not exists reconciliation_queue_business_status_idx
  on public.reconciliation_queue_items (business_id, status, updated_at desc);
create index if not exists reconciliation_queue_business_priority_idx
  on public.reconciliation_queue_items (business_id, priority, updated_at desc);
create index if not exists reconciliation_queue_business_type_idx
  on public.reconciliation_queue_items (
    business_id,
    reconciliation_type,
    updated_at desc
  );
create index if not exists reconciliation_queue_assignee_idx
  on public.reconciliation_queue_items (assigned_to, status)
  where assigned_to is not null;
create index if not exists reconciliation_queue_audit_item_created_idx
  on public.reconciliation_queue_audit_events (
    reconciliation_item_id,
    created_at desc
  );
create index if not exists reconciliation_queue_audit_business_created_idx
  on public.reconciliation_queue_audit_events (business_id, created_at desc);

alter table public.reconciliation_queue_items enable row level security;
alter table public.reconciliation_queue_audit_events enable row level security;

revoke all on public.reconciliation_queue_items from anon, authenticated;
revoke all on public.reconciliation_queue_audit_events from anon, authenticated;
grant select on public.reconciliation_queue_items to authenticated;
grant select on public.reconciliation_queue_audit_events to authenticated;

drop policy if exists "Members can read reconciliation queue items"
  on public.reconciliation_queue_items;
create policy "Members can read reconciliation queue items"
  on public.reconciliation_queue_items
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "Members can read reconciliation queue audit events"
  on public.reconciliation_queue_audit_events;
create policy "Members can read reconciliation queue audit events"
  on public.reconciliation_queue_audit_events
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.validate_reconciliation_queue_scope_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.restaurant_id is not null and not exists (
    select 1 from public.restaurants restaurant
    where restaurant.id = new.restaurant_id
      and restaurant.business_id = new.business_id
  ) then
    raise exception 'Restaurant does not belong to the reconciliation Business'
      using errcode = '23514';
  end if;

  if new.guest_identity_id is not null and not exists (
    select 1 from public.guest_identities identity
    where identity.id = new.guest_identity_id
      and identity.business_id = new.business_id
  ) then
    raise exception 'Guest does not belong to the reconciliation Business'
      using errcode = '23514';
  end if;

  if new.reservation_id is not null and not exists (
    select 1 from public.reservations reservation
    where reservation.id = new.reservation_id
      and reservation.business_id = new.business_id
  ) then
    raise exception 'Reservation does not belong to the reconciliation Business'
      using errcode = '23514';
  end if;

  if new.audit_event_id is not null and not exists (
    select 1 from public.guest_crm_audit_events audit
    where audit.id = new.audit_event_id
      and audit.business_id = new.business_id
  ) then
    raise exception 'Audit event does not belong to the reconciliation Business'
      using errcode = '23514';
  end if;

  if new.merge_audit_event_id is not null and not exists (
    select 1 from public.guest_crm_audit_events audit
    where audit.id = new.merge_audit_event_id
      and audit.business_id = new.business_id
      and audit.change_type = 'merge'
  ) then
    raise exception 'Merge does not belong to the reconciliation Business'
      using errcode = '23514';
  end if;

  if new.recovery_event_id is not null and not exists (
    select 1 from public.guest_merge_recovery_events recovery
    where recovery.id = new.recovery_event_id
      and recovery.business_id = new.business_id
  ) then
    raise exception 'Recovery does not belong to the reconciliation Business'
      using errcode = '23514';
  end if;

  if new.assigned_to is not null and not exists (
    select 1 from public.business_memberships membership
    where membership.business_id = new.business_id
      and membership.user_id = new.assigned_to
  ) then
    raise exception 'Assignee must be a Business member'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_reconciliation_queue_scope_v1()
  from public, anon, authenticated;

drop trigger if exists reconciliation_queue_validate_scope
  on public.reconciliation_queue_items;
create trigger reconciliation_queue_validate_scope
before insert or update on public.reconciliation_queue_items
for each row execute function public.validate_reconciliation_queue_scope_v1();

create or replace function public.set_reconciliation_queue_updated_at_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_reconciliation_queue_updated_at_v1()
  from public, anon, authenticated;

drop trigger if exists reconciliation_queue_set_updated_at
  on public.reconciliation_queue_items;
create trigger reconciliation_queue_set_updated_at
before update on public.reconciliation_queue_items
for each row execute function public.set_reconciliation_queue_updated_at_v1();

create or replace function public.prevent_reconciliation_history_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Reconciliation history is append-only' using errcode = '55000';
end;
$$;

revoke all on function public.prevent_reconciliation_history_mutation_v1()
  from public, anon, authenticated;

drop trigger if exists reconciliation_queue_prevent_delete
  on public.reconciliation_queue_items;
create trigger reconciliation_queue_prevent_delete
before delete on public.reconciliation_queue_items
for each row execute function public.prevent_reconciliation_history_mutation_v1();

drop trigger if exists reconciliation_queue_audit_prevent_mutation
  on public.reconciliation_queue_audit_events;
create trigger reconciliation_queue_audit_prevent_mutation
before update or delete on public.reconciliation_queue_audit_events
for each row execute function public.prevent_reconciliation_history_mutation_v1();

create or replace function public.create_reconciliation_queue_item_v1(
  p_business_id uuid,
  p_reconciliation_type text,
  p_priority text,
  p_origin text,
  p_restaurant_id uuid default null,
  p_guest_identity_id uuid default null,
  p_reservation_id uuid default null,
  p_audit_event_id uuid default null,
  p_merge_audit_event_id uuid default null,
  p_recovery_event_id uuid default null,
  p_assigned_to uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := lower(nullif(trim(p_reconciliation_type), ''));
  v_priority text := lower(nullif(trim(p_priority), ''));
  v_origin text := nullif(trim(p_origin), '');
  v_item public.reconciliation_queue_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_business_id is null or not public.is_business_member(p_business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;

  if v_type not in (
    'merge_review', 'recovery_review', 'crm_review', 'conflict_review'
  ) or v_priority not in ('low', 'medium', 'high')
    or v_origin is null or length(v_origin) > 500 then
    raise exception 'Invalid reconciliation item' using errcode = '22023';
  end if;

  insert into public.reconciliation_queue_items (
    business_id,
    reconciliation_type,
    status,
    priority,
    restaurant_id,
    guest_identity_id,
    reservation_id,
    audit_event_id,
    merge_audit_event_id,
    recovery_event_id,
    origin,
    assigned_to,
    created_by
  ) values (
    p_business_id,
    v_type,
    'pending',
    v_priority,
    p_restaurant_id,
    p_guest_identity_id,
    p_reservation_id,
    p_audit_event_id,
    p_merge_audit_event_id,
    p_recovery_event_id,
    v_origin,
    p_assigned_to,
    auth.uid()
  ) returning * into v_item;

  insert into public.reconciliation_queue_audit_events (
    business_id,
    reconciliation_item_id,
    change_type,
    new_value,
    changed_by
  ) values (
    v_item.business_id,
    v_item.id,
    'created',
    jsonb_build_object(
      'type', v_item.reconciliation_type,
      'status', v_item.status,
      'priority', v_item.priority,
      'assigned_to', v_item.assigned_to,
      'origin', v_item.origin
    ),
    auth.uid()
  );

  return jsonb_build_object('item_id', v_item.id, 'status', v_item.status);
end;
$$;

revoke all on function public.create_reconciliation_queue_item_v1(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon;
grant execute on function public.create_reconciliation_queue_item_v1(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

create or replace function public.update_reconciliation_queue_status_v1(
  p_item_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.reconciliation_queue_items%rowtype;
  v_status text := lower(nullif(trim(p_status), ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'in_review', 'completed') then
    raise exception 'Invalid reconciliation status' using errcode = '22023';
  end if;

  select * into v_item
  from public.reconciliation_queue_items item
  where item.id = p_item_id
  for update;

  if v_item.id is null then
    raise exception 'Reconciliation item not found' using errcode = 'P0002';
  end if;
  if not public.is_business_member(v_item.business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;
  if v_item.status = v_status then
    return jsonb_build_object('item_id', v_item.id, 'status', v_status, 'changed', false);
  end if;

  update public.reconciliation_queue_items
  set status = v_status
  where id = v_item.id;

  insert into public.reconciliation_queue_audit_events (
    business_id, reconciliation_item_id, change_type,
    previous_value, new_value, changed_by
  ) values (
    v_item.business_id, v_item.id, 'status_changed',
    jsonb_build_object('status', v_item.status),
    jsonb_build_object('status', v_status), auth.uid()
  );

  return jsonb_build_object('item_id', v_item.id, 'status', v_status, 'changed', true);
end;
$$;

revoke all on function public.update_reconciliation_queue_status_v1(uuid, text)
  from public, anon;
grant execute on function public.update_reconciliation_queue_status_v1(uuid, text)
  to authenticated;

create or replace function public.update_reconciliation_queue_priority_v1(
  p_item_id uuid,
  p_priority text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.reconciliation_queue_items%rowtype;
  v_priority text := lower(nullif(trim(p_priority), ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_priority not in ('low', 'medium', 'high') then
    raise exception 'Invalid reconciliation priority' using errcode = '22023';
  end if;

  select * into v_item
  from public.reconciliation_queue_items item
  where item.id = p_item_id
  for update;

  if v_item.id is null then
    raise exception 'Reconciliation item not found' using errcode = 'P0002';
  end if;
  if not public.is_business_member(v_item.business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;
  if v_item.priority = v_priority then
    return jsonb_build_object('item_id', v_item.id, 'priority', v_priority, 'changed', false);
  end if;

  update public.reconciliation_queue_items
  set priority = v_priority
  where id = v_item.id;

  insert into public.reconciliation_queue_audit_events (
    business_id, reconciliation_item_id, change_type,
    previous_value, new_value, changed_by
  ) values (
    v_item.business_id, v_item.id, 'priority_changed',
    jsonb_build_object('priority', v_item.priority),
    jsonb_build_object('priority', v_priority), auth.uid()
  );

  return jsonb_build_object('item_id', v_item.id, 'priority', v_priority, 'changed', true);
end;
$$;

revoke all on function public.update_reconciliation_queue_priority_v1(uuid, text)
  from public, anon;
grant execute on function public.update_reconciliation_queue_priority_v1(uuid, text)
  to authenticated;

create or replace function public.assign_reconciliation_queue_item_v1(
  p_item_id uuid,
  p_assigned_to uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.reconciliation_queue_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_item
  from public.reconciliation_queue_items item
  where item.id = p_item_id
  for update;

  if v_item.id is null then
    raise exception 'Reconciliation item not found' using errcode = 'P0002';
  end if;
  if not public.is_business_member(v_item.business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.business_memberships membership
    where membership.business_id = v_item.business_id
      and membership.user_id = p_assigned_to
  ) then
    raise exception 'Assignee must be a Business member' using errcode = '42501';
  end if;
  if v_item.assigned_to is not distinct from p_assigned_to then
    return jsonb_build_object('item_id', v_item.id, 'assigned_to', p_assigned_to, 'changed', false);
  end if;

  update public.reconciliation_queue_items
  set assigned_to = p_assigned_to
  where id = v_item.id;

  insert into public.reconciliation_queue_audit_events (
    business_id, reconciliation_item_id, change_type,
    previous_value, new_value, changed_by
  ) values (
    v_item.business_id, v_item.id, 'assignee_changed',
    jsonb_build_object('assigned_to', v_item.assigned_to),
    jsonb_build_object('assigned_to', p_assigned_to), auth.uid()
  );

  return jsonb_build_object('item_id', v_item.id, 'assigned_to', p_assigned_to, 'changed', true);
end;
$$;

revoke all on function public.assign_reconciliation_queue_item_v1(uuid, uuid)
  from public, anon;
grant execute on function public.assign_reconciliation_queue_item_v1(uuid, uuid)
  to authenticated;

create or replace function public.list_reconciliation_assignees_v1(
  p_business_id uuid
)
returns table (user_id uuid, email text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_business_member(p_business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;

  return query
  select membership.user_id, users.email::text, membership.role
  from public.business_memberships membership
  join auth.users users on users.id = membership.user_id
  where membership.business_id = p_business_id
  order by users.email, membership.user_id;
end;
$$;

revoke all on function public.list_reconciliation_assignees_v1(uuid)
  from public, anon;
grant execute on function public.list_reconciliation_assignees_v1(uuid)
  to authenticated;

notify pgrst, 'reload schema';
