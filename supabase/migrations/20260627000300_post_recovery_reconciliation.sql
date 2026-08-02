-- Block 35: immutable, metadata-only post-recovery reconciliation reviews.

create table if not exists public.guest_merge_reconciliation_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recovery_execution_event_id uuid not null
    references public.guest_merge_recovery_execution_events(id) on delete restrict,
  review_status text not null check (
    review_status in ('pending', 'completed', 'requires_follow_up')
  ),
  checklist_summary jsonb not null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  notes text check (notes is null or length(notes) <= 2000)
);

create index if not exists guest_merge_reconciliation_business_reviewed_idx
  on public.guest_merge_reconciliation_reviews (business_id, reviewed_at desc);
create index if not exists guest_merge_reconciliation_execution_reviewed_idx
  on public.guest_merge_reconciliation_reviews (
    recovery_execution_event_id,
    reviewed_at desc
  );

alter table public.guest_merge_reconciliation_reviews enable row level security;
revoke all on public.guest_merge_reconciliation_reviews from anon, authenticated;
grant select on public.guest_merge_reconciliation_reviews to authenticated;

drop policy if exists "Members can read guest merge reconciliation reviews"
  on public.guest_merge_reconciliation_reviews;
create policy "Members can read guest merge reconciliation reviews"
  on public.guest_merge_reconciliation_reviews
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.guest_merge_reconciliation_checklist_v1(
  p_execution_summary jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'key', 'reservations_restored',
      'status', case
        when coalesce((p_execution_summary #>> '{recovered,reservations}')::integer, 0) > 0
        then 'completed' else 'not_applicable' end,
      'description', 'Provenance-backed reservations restored',
      'count', coalesce((p_execution_summary #>> '{recovered,reservations}')::integer, 0),
      'recommended_action', 'Verify restored reservations remain operationally visible.'
    ),
    jsonb_build_object(
      'key', 'reservation_guests_restored',
      'status', case
        when coalesce((p_execution_summary #>> '{recovered,reservation_guests}')::integer, 0) > 0
        then 'completed' else 'not_applicable' end,
      'description', 'Provenance-backed reservation guests restored',
      'count', coalesce((p_execution_summary #>> '{recovered,reservation_guests}')::integer, 0),
      'recommended_action', 'Review guest history and reservation-level context.'
    ),
    jsonb_build_object(
      'key', 'crm_profile_ownership',
      'status', 'warning',
      'description', 'CRM profile ownership was not recovered',
      'recommended_action', 'Review CRM notes and preferences manually before any correction.'
    ),
    jsonb_build_object(
      'key', 'dietary_profile_ownership',
      'status', 'warning',
      'description', 'Dietary profiles remained attached to their reservation guests',
      'recommended_action', 'Verify dietary history is visible from the intended operational view.'
    ),
    jsonb_build_object(
      'key', 'source_identity_state',
      'status', 'warning',
      'description', 'Source identity remains merged and inactive',
      'recommended_action', 'Do not reactivate automatically; escalate if identity visibility is required.'
    ),
    jsonb_build_object(
      'key', 'contact_aliases',
      'status', 'warning',
      'description', 'Contact aliases were intentionally preserved',
      'recommended_action', 'Confirm alias routing remains correct; do not delete aliases during review.'
    ),
    jsonb_build_object(
      'key', 'historical_audits',
      'status', 'completed',
      'description', 'Historical merge and recovery audits remain immutable',
      'recommended_action', 'Retain audit history as the authoritative decision trail.'
    )
  )
$$;

revoke all on function public.guest_merge_reconciliation_checklist_v1(jsonb)
  from public, anon, authenticated;

create or replace function public.create_pending_guest_merge_reconciliation_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guest_merge_reconciliation_reviews (
    business_id,
    recovery_execution_event_id,
    review_status,
    checklist_summary,
    reviewed_by,
    reviewed_at,
    notes
  ) values (
    new.business_id,
    new.id,
    'pending',
    public.guest_merge_reconciliation_checklist_v1(new.execution_summary),
    new.created_by,
    new.created_at,
    null
  );

  return new;
end;
$$;

revoke all on function public.create_pending_guest_merge_reconciliation_v1()
  from public, anon, authenticated;

drop trigger if exists guest_merge_recovery_execution_create_review
  on public.guest_merge_recovery_execution_events;
create trigger guest_merge_recovery_execution_create_review
after insert on public.guest_merge_recovery_execution_events
for each row execute function public.create_pending_guest_merge_reconciliation_v1();

create or replace function public.record_guest_merge_reconciliation_review_v1(
  p_recovery_execution_event_id uuid,
  p_review_status text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_execution public.guest_merge_recovery_execution_events%rowtype;
  v_status text := lower(nullif(trim(p_review_status), ''));
  v_notes text := nullif(trim(p_notes), '');
  v_review_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_recovery_execution_event_id is null
    or v_status not in ('pending', 'completed', 'requires_follow_up')
    or length(coalesce(v_notes, '')) > 2000 then
    raise exception 'Invalid reconciliation review' using errcode = '22023';
  end if;

  select * into v_execution
  from public.guest_merge_recovery_execution_events execution
  where execution.id = p_recovery_execution_event_id
  for share;

  if v_execution.id is null then
    raise exception 'Recovery execution event not found' using errcode = 'P0002';
  end if;

  if not public.is_business_member(v_execution.business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;

  insert into public.guest_merge_reconciliation_reviews (
    business_id,
    recovery_execution_event_id,
    review_status,
    checklist_summary,
    reviewed_by,
    reviewed_at,
    notes
  ) values (
    v_execution.business_id,
    v_execution.id,
    v_status,
    public.guest_merge_reconciliation_checklist_v1(v_execution.execution_summary),
    auth.uid(),
    now(),
    v_notes
  ) returning id into v_review_id;

  return jsonb_build_object(
    'review_id', v_review_id,
    'review_status', v_status
  );
end;
$$;

revoke all on function public.record_guest_merge_reconciliation_review_v1(
  uuid, text, text
) from public, anon;
grant execute on function public.record_guest_merge_reconciliation_review_v1(
  uuid, text, text
) to authenticated;

create or replace function public.prevent_guest_merge_reconciliation_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Reconciliation review events are immutable' using errcode = '55000';
end;
$$;

revoke all on function public.prevent_guest_merge_reconciliation_mutation_v1()
  from public, anon, authenticated;

drop trigger if exists guest_merge_reconciliation_prevent_mutation
  on public.guest_merge_reconciliation_reviews;
create trigger guest_merge_reconciliation_prevent_mutation
before update or delete on public.guest_merge_reconciliation_reviews
for each row execute function public.prevent_guest_merge_reconciliation_mutation_v1();

notify pgrst, 'reload schema';
