-- Block 34: execute governed recovery only for immutable provenance-backed records.

create table if not exists public.guest_merge_recovery_execution_events (
  id uuid primary key default gen_random_uuid(),
  recovery_event_id uuid not null unique
    references public.guest_merge_recovery_events(id) on delete restrict,
  merge_audit_event_id uuid not null
    references public.guest_crm_audit_events(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_identity_id uuid not null references public.guest_identities(id) on delete restrict,
  target_identity_id uuid not null references public.guest_identities(id) on delete restrict,
  recovered_record_count integer not null check (recovered_record_count >= 0),
  skipped_record_count integer not null check (skipped_record_count >= 0),
  execution_summary jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists guest_merge_recovery_execution_business_created_idx
  on public.guest_merge_recovery_execution_events (business_id, created_at desc);
create index if not exists guest_merge_recovery_execution_merge_audit_idx
  on public.guest_merge_recovery_execution_events (merge_audit_event_id, created_at desc);

alter table public.guest_merge_recovery_execution_events enable row level security;
revoke all on public.guest_merge_recovery_execution_events from anon, authenticated;
grant select on public.guest_merge_recovery_execution_events to authenticated;

drop policy if exists "Members can read guest merge recovery executions"
  on public.guest_merge_recovery_execution_events;
create policy "Members can read guest merge recovery executions"
  on public.guest_merge_recovery_execution_events
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.recover_guest_merge_v1(
  p_recovery_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recovery public.guest_merge_recovery_events%rowtype;
  v_merge_audit public.guest_crm_audit_events%rowtype;
  v_source public.guest_identities%rowtype;
  v_target public.guest_identities%rowtype;
  v_total_provenance integer := 0;
  v_reservation_count integer := 0;
  v_guest_count integer := 0;
  v_skipped_count integer := 0;
  v_updated_reservations integer := 0;
  v_updated_guests integer := 0;
  v_execution_id uuid;
  v_summary jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_recovery_event_id is null or p_confirmation is distinct from 'RECOVERY' then
    raise exception 'Explicit recovery confirmation is required' using errcode = '22023';
  end if;

  select * into v_recovery
  from public.guest_merge_recovery_events recovery
  where recovery.id = p_recovery_event_id
    and recovery.recovery_type = 'governed_manual_recovery'
    and recovery.status = 'preview_confirmed'
  for share;

  if v_recovery.id is null then
    raise exception 'Confirmed recovery event not found' using errcode = 'P0002';
  end if;

  if not public.is_business_member(v_recovery.business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.guest_merge_recovery_execution_events execution
    where execution.recovery_event_id = v_recovery.id
  ) then
    raise exception 'Recovery event has already been executed' using errcode = '23505';
  end if;

  select * into v_merge_audit
  from public.guest_crm_audit_events audit
  where audit.id = v_recovery.merge_audit_event_id
    and audit.change_type = 'merge'
  for share;

  if v_merge_audit.id is null
    or v_merge_audit.business_id <> v_recovery.business_id
    or v_merge_audit.source_identity_id <> v_recovery.source_identity_id
    or v_merge_audit.target_identity_id <> v_recovery.target_identity_id then
    raise exception 'Recovery event does not match its merge audit' using errcode = '22023';
  end if;

  select * into v_source
  from public.guest_identities identity
  where identity.id = v_recovery.source_identity_id
  for update;

  select * into v_target
  from public.guest_identities identity
  where identity.id = v_recovery.target_identity_id
  for update;

  if v_source.id is null or v_target.id is null
    or v_source.business_id <> v_recovery.business_id
    or v_target.business_id <> v_recovery.business_id
    or v_source.merged_into_identity_id <> v_target.id then
    raise exception 'Source and target identity state is not recoverable' using errcode = '22023';
  end if;

  select count(*) into v_total_provenance
  from public.guest_merge_provenance_records provenance
  where provenance.merge_audit_event_id = v_merge_audit.id;

  if v_total_provenance = 0 then
    raise exception 'Merge has no immutable provenance records' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.guest_merge_provenance_records provenance
    where provenance.merge_audit_event_id = v_merge_audit.id
      and (
        provenance.business_id <> v_recovery.business_id
        or provenance.source_identity_id <> v_source.id
        or provenance.target_identity_id <> v_target.id
        or provenance.previous_identity_id <> v_source.id
        or provenance.new_identity_id <> v_target.id
      )
  ) then
    raise exception 'Merge provenance scope is inconsistent' using errcode = '22023';
  end if;

  select count(*) into v_reservation_count
  from public.guest_merge_provenance_records provenance
  where provenance.merge_audit_event_id = v_merge_audit.id
    and provenance.record_table = 'reservations'
    and provenance.provenance_type = 'identity_reassigned';

  select count(*) into v_guest_count
  from public.guest_merge_provenance_records provenance
  where provenance.merge_audit_event_id = v_merge_audit.id
    and provenance.record_table = 'reservation_guests'
    and provenance.provenance_type = 'identity_reassigned';

  v_skipped_count := v_total_provenance - v_reservation_count - v_guest_count;

  if v_reservation_count + v_guest_count = 0 then
    raise exception 'Merge has no supported provenance-backed records' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.guest_merge_provenance_records provenance
    left join public.reservations reservation
      on reservation.id = provenance.record_id
    where provenance.merge_audit_event_id = v_merge_audit.id
      and provenance.record_table = 'reservations'
      and provenance.provenance_type = 'identity_reassigned'
      and (
        reservation.id is null
        or reservation.business_id <> v_recovery.business_id
        or reservation.guest_identity_id is distinct from v_target.id
      )
  ) then
    raise exception 'A provenance-backed reservation no longer belongs to the target' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.guest_merge_provenance_records provenance
    left join public.reservation_guests guest
      on guest.id = provenance.record_id
    where provenance.merge_audit_event_id = v_merge_audit.id
      and provenance.record_table = 'reservation_guests'
      and provenance.provenance_type = 'identity_reassigned'
      and (
        guest.id is null
        or guest.guest_identity_id is distinct from v_target.id
      )
  ) then
    raise exception 'A provenance-backed reservation guest no longer belongs to the target' using errcode = '22023';
  end if;

  update public.reservations reservation
  set guest_identity_id = v_source.id
  from public.guest_merge_provenance_records provenance
  where provenance.merge_audit_event_id = v_merge_audit.id
    and provenance.record_table = 'reservations'
    and provenance.provenance_type = 'identity_reassigned'
    and reservation.id = provenance.record_id
    and reservation.guest_identity_id = v_target.id;
  get diagnostics v_updated_reservations = row_count;

  update public.reservation_guests guest
  set guest_identity_id = v_source.id,
      updated_at = now()
  from public.guest_merge_provenance_records provenance
  where provenance.merge_audit_event_id = v_merge_audit.id
    and provenance.record_table = 'reservation_guests'
    and provenance.provenance_type = 'identity_reassigned'
    and guest.id = provenance.record_id
    and guest.guest_identity_id = v_target.id;
  get diagnostics v_updated_guests = row_count;

  if v_updated_reservations <> v_reservation_count
    or v_updated_guests <> v_guest_count then
    raise exception 'Recovery reassignment count mismatch' using errcode = '40001';
  end if;

  v_summary := jsonb_build_object(
    'execution', 'provenance_backed_recovery_v1',
    'recovered', jsonb_build_object(
      'reservations', v_updated_reservations,
      'reservation_guests', v_updated_guests
    ),
    'skipped', jsonb_build_object(
      'count', v_skipped_count,
      'reason', 'Unsupported provenance types remain unchanged'
    ),
    'unchanged', jsonb_build_array(
      'source merge state',
      'contact aliases',
      'CRM profile ownership',
      'guest dietary profiles',
      'merge and recovery audit history'
    )
  );

  insert into public.guest_merge_recovery_execution_events (
    recovery_event_id,
    merge_audit_event_id,
    business_id,
    source_identity_id,
    target_identity_id,
    recovered_record_count,
    skipped_record_count,
    execution_summary,
    created_by
  ) values (
    v_recovery.id,
    v_merge_audit.id,
    v_recovery.business_id,
    v_source.id,
    v_target.id,
    v_updated_reservations + v_updated_guests,
    v_skipped_count,
    v_summary,
    auth.uid()
  ) returning id into v_execution_id;

  return jsonb_build_object(
    'execution_event_id', v_execution_id,
    'recovered_record_count', v_updated_reservations + v_updated_guests,
    'skipped_record_count', v_skipped_count,
    'execution_summary', v_summary
  );
end;
$$;

revoke all on function public.recover_guest_merge_v1(uuid, text)
  from public, anon;
grant execute on function public.recover_guest_merge_v1(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
