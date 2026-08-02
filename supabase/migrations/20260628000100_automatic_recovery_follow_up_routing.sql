-- Block 37: route explicit post-recovery follow-up into the Business queue.
-- This producer is metadata-only and never mutates recovery or identity history.

alter table public.reconciliation_queue_items
  add column if not exists recovery_execution_event_id uuid
    references public.guest_merge_recovery_execution_events(id) on delete restrict,
  add column if not exists reconciliation_review_id uuid
    references public.guest_merge_reconciliation_reviews(id) on delete restrict;

create unique index if not exists reconciliation_queue_recovery_execution_unique_idx
  on public.reconciliation_queue_items (recovery_execution_event_id)
  where recovery_execution_event_id is not null;

create index if not exists reconciliation_queue_review_idx
  on public.reconciliation_queue_items (reconciliation_review_id)
  where reconciliation_review_id is not null;

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

  if new.recovery_execution_event_id is not null and not exists (
    select 1
    from public.guest_merge_recovery_execution_events execution
    where execution.id = new.recovery_execution_event_id
      and execution.business_id = new.business_id
      and (
        new.recovery_event_id is null
        or execution.recovery_event_id = new.recovery_event_id
      )
      and (
        new.merge_audit_event_id is null
        or execution.merge_audit_event_id = new.merge_audit_event_id
      )
  ) then
    raise exception 'Recovery execution does not match the reconciliation scope'
      using errcode = '23514';
  end if;

  if new.reconciliation_review_id is not null and not exists (
    select 1
    from public.guest_merge_reconciliation_reviews review
    where review.id = new.reconciliation_review_id
      and review.business_id = new.business_id
      and review.recovery_execution_event_id = new.recovery_execution_event_id
      and review.review_status = 'requires_follow_up'
  ) then
    raise exception 'Follow-up review does not match the reconciliation scope'
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

create or replace function public.route_recovery_follow_up_to_queue_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_execution public.guest_merge_recovery_execution_events%rowtype;
  v_item_id uuid;
begin
  if new.review_status <> 'requires_follow_up' then
    return new;
  end if;

  select * into v_execution
  from public.guest_merge_recovery_execution_events execution
  where execution.id = new.recovery_execution_event_id
    and execution.business_id = new.business_id
  for share;

  if v_execution.id is null then
    raise exception 'Recovery review execution scope is inconsistent'
      using errcode = '23514';
  end if;

  insert into public.reconciliation_queue_items (
    business_id,
    reconciliation_type,
    status,
    priority,
    merge_audit_event_id,
    recovery_event_id,
    recovery_execution_event_id,
    reconciliation_review_id,
    origin,
    created_by,
    created_at,
    updated_at
  ) values (
    new.business_id,
    'recovery_review',
    'pending',
    'high',
    v_execution.merge_audit_event_id,
    v_execution.recovery_event_id,
    v_execution.id,
    new.id,
    'Post-recovery reconciliation review requires operational follow-up',
    new.reviewed_by,
    new.reviewed_at,
    new.reviewed_at
  )
  on conflict (recovery_execution_event_id)
    where recovery_execution_event_id is not null
  do nothing
  returning id into v_item_id;

  if v_item_id is not null then
    insert into public.reconciliation_queue_audit_events (
      business_id,
      reconciliation_item_id,
      change_type,
      new_value,
      changed_by,
      created_at
    ) values (
      new.business_id,
      v_item_id,
      'created',
      jsonb_build_object(
        'type', 'recovery_review',
        'status', 'pending',
        'priority', 'high',
        'assigned_to', null,
        'origin', 'Post-recovery reconciliation review requires operational follow-up',
        'producer', 'post_recovery_review',
        'reconciliation_review_id', new.id,
        'recovery_execution_event_id', v_execution.id
      ),
      new.reviewed_by,
      new.reviewed_at
    );
  end if;

  return new;
end;
$$;

revoke all on function public.route_recovery_follow_up_to_queue_v1()
  from public, anon, authenticated;

drop trigger if exists guest_merge_reconciliation_route_follow_up
  on public.guest_merge_reconciliation_reviews;
create trigger guest_merge_reconciliation_route_follow_up
after insert on public.guest_merge_reconciliation_reviews
for each row execute function public.route_recovery_follow_up_to_queue_v1();

-- Backfill only explicit, immutable follow-up decisions. Earlier manual queue
-- items are not guessed or rewritten.
with follow_up_candidates as (
  select distinct on (review.recovery_execution_event_id)
    review.id as review_id,
    review.business_id,
    review.recovery_execution_event_id,
    review.reviewed_by,
    review.reviewed_at,
    execution.merge_audit_event_id,
    execution.recovery_event_id
  from public.guest_merge_reconciliation_reviews review
  join public.guest_merge_recovery_execution_events execution
    on execution.id = review.recovery_execution_event_id
   and execution.business_id = review.business_id
  where review.review_status = 'requires_follow_up'
  order by review.recovery_execution_event_id, review.reviewed_at, review.id
), inserted_items as (
  insert into public.reconciliation_queue_items (
    business_id,
    reconciliation_type,
    status,
    priority,
    merge_audit_event_id,
    recovery_event_id,
    recovery_execution_event_id,
    reconciliation_review_id,
    origin,
    created_by,
    created_at,
    updated_at
  )
  select
    candidate.business_id,
    'recovery_review',
    'pending',
    'high',
    candidate.merge_audit_event_id,
    candidate.recovery_event_id,
    candidate.recovery_execution_event_id,
    candidate.review_id,
    'Post-recovery reconciliation review requires operational follow-up',
    candidate.reviewed_by,
    candidate.reviewed_at,
    candidate.reviewed_at
  from follow_up_candidates candidate
  on conflict (recovery_execution_event_id)
    where recovery_execution_event_id is not null
  do nothing
  returning id, business_id, reconciliation_review_id,
    recovery_execution_event_id, created_by, created_at
)
insert into public.reconciliation_queue_audit_events (
  business_id,
  reconciliation_item_id,
  change_type,
  new_value,
  changed_by,
  created_at
)
select
  item.business_id,
  item.id,
  'created',
  jsonb_build_object(
    'type', 'recovery_review',
    'status', 'pending',
    'priority', 'high',
    'assigned_to', null,
    'origin', 'Post-recovery reconciliation review requires operational follow-up',
    'producer', 'post_recovery_review_backfill',
    'reconciliation_review_id', item.reconciliation_review_id,
    'recovery_execution_event_id', item.recovery_execution_event_id
  ),
  item.created_by,
  item.created_at
from inserted_items item;

notify pgrst, 'reload schema';
