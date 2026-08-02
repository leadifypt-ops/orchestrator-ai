-- Block 32: governed, preview-first recovery preparation for guest identity merges.

create table if not exists public.guest_merge_recovery_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  merge_audit_event_id uuid not null references public.guest_crm_audit_events(id) on delete restrict,
  source_identity_id uuid not null references public.guest_identities(id) on delete restrict,
  target_identity_id uuid not null references public.guest_identities(id) on delete restrict,
  recovery_type text not null check (recovery_type in ('governed_manual_recovery')),
  status text not null check (status in ('preview_confirmed')),
  preview_payload jsonb not null default '{}'::jsonb,
  executed_payload jsonb not null default '{"execution":"not_implemented"}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz not null,
  confirmation_text text not null check (confirmation_text = 'RECOVERY')
);

create index if not exists guest_merge_recovery_events_business_created_idx
  on public.guest_merge_recovery_events (business_id, created_at desc);
create index if not exists guest_merge_recovery_events_merge_audit_idx
  on public.guest_merge_recovery_events (merge_audit_event_id, created_at desc);

alter table public.guest_merge_recovery_events enable row level security;
revoke all on public.guest_merge_recovery_events from anon, authenticated;
grant select on public.guest_merge_recovery_events to authenticated;

drop policy if exists "Members can read guest merge recovery events"
  on public.guest_merge_recovery_events;
create policy "Members can read guest merge recovery events"
  on public.guest_merge_recovery_events
  for select
  to authenticated
  using (public.is_business_member(business_id));

create or replace function public.record_guest_merge_recovery_preview_v1(
  p_merge_audit_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merge_audit public.guest_crm_audit_events%rowtype;
  v_preview jsonb;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_merge_audit_event_id is null or p_confirmation is distinct from 'RECOVERY' then
    raise exception 'Explicit recovery confirmation is required' using errcode = '22023';
  end if;

  select * into v_merge_audit
  from public.guest_crm_audit_events audit
  where audit.id = p_merge_audit_event_id
    and audit.change_type = 'merge'
  for share;

  if v_merge_audit.id is null then
    raise exception 'Merge audit event not found' using errcode = 'P0002';
  end if;

  if not public.is_business_member(v_merge_audit.business_id) then
    raise exception 'Business membership required' using errcode = '42501';
  end if;

  v_preview := jsonb_build_object(
    'merge_audit_event_id', v_merge_audit.id,
    'source_identity_id', v_merge_audit.source_identity_id,
    'target_identity_id', v_merge_audit.target_identity_id,
    'merge_created_at', v_merge_audit.created_at,
    'merge_counts', jsonb_build_object(
      'reservations_reassigned', coalesce(v_merge_audit.reservations_reassigned, 0),
      'profiles_reassigned', coalesce(v_merge_audit.profiles_reassigned, 0)
    ),
    'merge_decision', coalesce(v_merge_audit.decision, '{}'::jsonb),
    'merge_conflicts', coalesce(v_merge_audit.conflicts, '{}'::jsonb),
    'source_snapshot', coalesce(v_merge_audit.previous_values -> 'source', '{}'::jsonb),
    'target_snapshot', coalesce(v_merge_audit.previous_values -> 'target', '{}'::jsonb),
    'preserved_aliases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', alias.id,
        'contact_type', alias.contact_type,
        'contact_value', alias.contact_value,
        'normalized_value', alias.normalized_value,
        'created_at', alias.created_at
      ) order by alias.created_at)
      from public.guest_contact_aliases alias
      where alias.business_id = v_merge_audit.business_id
        and alias.source_guest_identity_id = v_merge_audit.source_identity_id
    ), '[]'::jsonb),
    'execution', 'not_implemented',
    'limitations', jsonb_build_array(
      'No reservation or guest-profile provenance is stored per merge.',
      'No identity, reservation, profile, or alias is changed by this recovery confirmation.',
      'Any future record movement requires a separately reviewed and audited operation.'
    )
  );

  insert into public.guest_merge_recovery_events (
    business_id,
    merge_audit_event_id,
    source_identity_id,
    target_identity_id,
    recovery_type,
    status,
    preview_payload,
    executed_payload,
    created_by,
    confirmed_at,
    confirmation_text
  ) values (
    v_merge_audit.business_id,
    v_merge_audit.id,
    v_merge_audit.source_identity_id,
    v_merge_audit.target_identity_id,
    'governed_manual_recovery',
    'preview_confirmed',
    v_preview,
    '{"execution":"not_implemented"}'::jsonb,
    auth.uid(),
    now(),
    p_confirmation
  ) returning id into v_event_id;

  return jsonb_build_object(
    'recovery_event_id', v_event_id,
    'status', 'preview_confirmed',
    'execution', 'not_implemented'
  );
end;
$$;

revoke all on function public.record_guest_merge_recovery_preview_v1(uuid, text)
  from public, anon;
grant execute on function public.record_guest_merge_recovery_preview_v1(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
