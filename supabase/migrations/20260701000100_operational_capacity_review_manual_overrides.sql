-- Block 43: Operational Capacity Review & Manual Overrides.
-- Human-authored operational context only. Never blocks or mutates reservations.

alter table public.reservation_availability_audit_events
  drop constraint if exists reservation_availability_audit_events_entity_type_check;
alter table public.reservation_availability_audit_events
  add constraint reservation_availability_audit_events_entity_type_check check (
    entity_type in (
      'service_period', 'capacity', 'area', 'exception', 'service_calendar',
      'recurring_exception', 'capacity_override', 'operational_note'
    )
  );

create table public.operational_capacity_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  service_period_id uuid not null,
  operational_date date not null,
  original_capacity integer not null check (original_capacity between 1 and 5000),
  adjusted_capacity integer not null check (adjusted_capacity between 0 and 5000),
  reason text not null check (length(trim(reason)) between 1 and 500),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  ended_by uuid references auth.users(id) on delete set null,
  ended_reason text check (ended_reason is null or length(trim(ended_reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint operational_capacity_overrides_end_state_check check (
    (active and ended_by is null and ended_reason is null and ended_at is null)
    or (not active and ended_by is not null and ended_reason is not null and ended_at is not null)
  ),
  constraint operational_capacity_overrides_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict,
  constraint operational_capacity_overrides_period_scope_fk
    foreign key (service_period_id, business_id, restaurant_id)
    references public.business_service_periods(id, business_id, restaurant_id)
    on update restrict on delete restrict
);

create unique index operational_capacity_overrides_active_scope_uidx
  on public.operational_capacity_overrides (restaurant_id, service_period_id, operational_date)
  where active;
create index operational_capacity_overrides_review_idx
  on public.operational_capacity_overrides
  (business_id, restaurant_id, operational_date, created_at desc);

create table public.operational_capacity_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  service_period_id uuid,
  operational_date date not null,
  note_type text not null check (
    note_type in ('reduced_team', 'private_event', 'maintenance', 'partial_kitchen', 'unavailable_room', 'other')
  ),
  note text not null check (length(trim(note)) between 1 and 1000),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  ended_by uuid references auth.users(id) on delete set null,
  ended_reason text check (ended_reason is null or length(trim(ended_reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint operational_capacity_notes_end_state_check check (
    (active and ended_by is null and ended_reason is null and ended_at is null)
    or (not active and ended_by is not null and ended_reason is not null and ended_at is not null)
  ),
  constraint operational_capacity_notes_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants(id, business_id)
    on update restrict on delete restrict,
  constraint operational_capacity_notes_period_scope_fk
    foreign key (service_period_id, business_id, restaurant_id)
    references public.business_service_periods(id, business_id, restaurant_id)
    on update restrict on delete restrict
);

create index operational_capacity_notes_review_idx
  on public.operational_capacity_notes
  (business_id, restaurant_id, operational_date, active, created_at desc);

create trigger operational_capacity_overrides_prevent_delete
before delete on public.operational_capacity_overrides
for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger operational_capacity_notes_prevent_delete
before delete on public.operational_capacity_notes
for each row execute function public.prevent_reservation_availability_history_mutation_v1();

create or replace function public.save_operational_capacity_override_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_service_period_id uuid,
  p_operational_date date,
  p_adjusted_capacity integer,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_setting public.reservation_capacity_settings%rowtype;
  v_previous public.operational_capacity_overrides%rowtype;
  v_override public.operational_capacity_overrides%rowtype;
  v_reason text := nullif(trim(p_reason), '');
begin
  perform public.assert_reservation_availability_manager_v1(p_business_id);
  if p_operational_date is null or p_adjusted_capacity is null
    or p_adjusted_capacity < 0 or p_adjusted_capacity > 5000
    or v_reason is null or length(v_reason) > 500 then
    raise exception 'Date, adjusted capacity and reason are required' using errcode = '22023';
  end if;
  select setting.* into v_setting
  from public.reservation_capacity_settings setting
  where setting.business_id = p_business_id
    and setting.restaurant_id = p_restaurant_id
    and setting.service_period_id = p_service_period_id;
  if not found then
    raise exception 'Configured capacity not found in this Business and restaurant scope'
      using errcode = '22023';
  end if;
  select existing.* into v_previous
  from public.operational_capacity_overrides existing
  where existing.business_id = p_business_id
    and existing.restaurant_id = p_restaurant_id
    and existing.service_period_id = p_service_period_id
    and existing.operational_date = p_operational_date
    and existing.active
  for update;
  if found and v_previous.adjusted_capacity = p_adjusted_capacity
    and v_previous.reason = v_reason then
    return jsonb_build_object('changed', false, 'override_id', v_previous.id);
  end if;
  if v_previous.id is not null then
    update public.operational_capacity_overrides
    set active = false, ended_by = auth.uid(), ended_reason = 'Superseded by a new manual override', ended_at = now()
    where id = v_previous.id;
  end if;
  insert into public.operational_capacity_overrides (
    business_id, restaurant_id, service_period_id, operational_date,
    original_capacity, adjusted_capacity, reason, created_by
  ) values (
    p_business_id, p_restaurant_id, p_service_period_id, p_operational_date,
    v_setting.max_covers, p_adjusted_capacity, v_reason, auth.uid()
  ) returning * into v_override;
  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    p_business_id, p_restaurant_id, 'capacity_override', v_override.id,
    case when v_previous.id is null then 'created' else 'updated' end,
    jsonb_build_object(
      'capacity', coalesce(v_previous.adjusted_capacity, v_setting.max_covers),
      'override_id', v_previous.id,
      'reason', v_previous.reason
    ),
    jsonb_build_object(
      'capacity', v_override.adjusted_capacity,
      'original_capacity', v_override.original_capacity,
      'operational_date', v_override.operational_date,
      'service_period_id', v_override.service_period_id,
      'reason', v_override.reason,
      'active', true
    ), auth.uid()
  );
  return jsonb_build_object('changed', true, 'override_id', v_override.id);
end;
$$;

create or replace function public.end_operational_capacity_override_v1(
  p_override_id uuid,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_override public.operational_capacity_overrides%rowtype;
  v_reason text := nullif(trim(p_reason), '');
begin
  select * into v_override from public.operational_capacity_overrides where id = p_override_id for update;
  if not found then raise exception 'Capacity override not found' using errcode = 'P0002'; end if;
  perform public.assert_reservation_availability_manager_v1(v_override.business_id);
  if v_reason is null or length(v_reason) > 500 then
    raise exception 'A reason is required to end an override' using errcode = '22023';
  end if;
  if not v_override.active then return jsonb_build_object('changed', false); end if;
  update public.operational_capacity_overrides
  set active = false, ended_by = auth.uid(), ended_reason = v_reason, ended_at = now()
  where id = v_override.id;
  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    v_override.business_id, v_override.restaurant_id, 'capacity_override',
    v_override.id, 'updated',
    jsonb_build_object('capacity', v_override.adjusted_capacity, 'reason', v_override.reason, 'active', true),
    jsonb_build_object('capacity', v_override.original_capacity, 'reason', v_reason, 'active', false),
    auth.uid()
  );
  return jsonb_build_object('changed', true);
end;
$$;

create or replace function public.save_operational_capacity_note_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_service_period_id uuid,
  p_operational_date date,
  p_note_type text,
  p_note text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_note public.operational_capacity_notes%rowtype;
  v_text text := nullif(trim(p_note), '');
begin
  perform public.assert_reservation_availability_manager_v1(p_business_id);
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  if p_operational_date is null or v_text is null or length(v_text) > 1000
    or p_note_type not in ('reduced_team', 'private_event', 'maintenance', 'partial_kitchen', 'unavailable_room', 'other') then
    raise exception 'Date, note type and note are required' using errcode = '22023';
  end if;
  if p_service_period_id is not null and not exists (
    select 1 from public.business_service_periods period
    where period.id = p_service_period_id and period.business_id = p_business_id
      and period.restaurant_id = p_restaurant_id
  ) then raise exception 'Service period is outside restaurant scope' using errcode = '22023'; end if;
  insert into public.operational_capacity_notes (
    business_id, restaurant_id, service_period_id, operational_date,
    note_type, note, created_by
  ) values (
    p_business_id, p_restaurant_id, p_service_period_id, p_operational_date,
    p_note_type, v_text, auth.uid()
  ) returning * into v_note;
  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    p_business_id, p_restaurant_id, 'operational_note', v_note.id, 'created', '{}',
    jsonb_build_object('operational_date', v_note.operational_date, 'service_period_id', v_note.service_period_id,
      'note_type', v_note.note_type, 'note', v_note.note, 'active', true), auth.uid()
  );
  return jsonb_build_object('changed', true, 'note_id', v_note.id);
end;
$$;

create or replace function public.end_operational_capacity_note_v1(
  p_note_id uuid,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_note public.operational_capacity_notes%rowtype;
  v_reason text := nullif(trim(p_reason), '');
begin
  select * into v_note from public.operational_capacity_notes where id = p_note_id for update;
  if not found then raise exception 'Operational note not found' using errcode = 'P0002'; end if;
  perform public.assert_reservation_availability_manager_v1(v_note.business_id);
  if v_reason is null or length(v_reason) > 500 then
    raise exception 'A reason is required to end a note' using errcode = '22023';
  end if;
  if not v_note.active then return jsonb_build_object('changed', false); end if;
  update public.operational_capacity_notes
  set active = false, ended_by = auth.uid(), ended_reason = v_reason, ended_at = now()
  where id = v_note.id;
  insert into public.reservation_availability_audit_events (
    business_id, restaurant_id, entity_type, entity_id, change_type,
    previous_values, new_values, changed_by
  ) values (
    v_note.business_id, v_note.restaurant_id, 'operational_note', v_note.id, 'updated',
    jsonb_build_object('active', true, 'note', v_note.note),
    jsonb_build_object('active', false, 'note', v_note.note, 'reason', v_reason), auth.uid()
  );
  return jsonb_build_object('changed', true);
end;
$$;

create or replace function public.project_operational_capacity_review_v1(
  p_business_id uuid,
  p_restaurant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table (
  operational_date date, service_period_id uuid, service_period_name text,
  scheduled boolean, is_open boolean, effective_start_time time without time zone,
  effective_end_time time without time zone, exception_type text, exception_reason text,
  original_capacity integer, adjusted_capacity integer, capacity_used bigint,
  capacity_remaining bigint, occupancy_percent numeric, reservation_count bigint,
  reservations_outside_effective_hours bigint, availability_status text,
  override_id uuid, override_reason text, override_created_by uuid,
  override_actor_email text, override_created_at timestamptz, operational_notes jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  return query
  select
    projection.operational_date, projection.service_period_id, projection.service_period_name,
    projection.scheduled, projection.is_open, projection.effective_start_time,
    projection.effective_end_time, projection.exception_type, projection.exception_reason,
    projection.configured_capacity as original_capacity,
    case when projection.is_open then coalesce(override.adjusted_capacity, projection.configured_capacity) else 0 end as adjusted_capacity,
    projection.capacity_used,
    greatest(coalesce(case when projection.is_open then coalesce(override.adjusted_capacity, projection.configured_capacity) else 0 end, 0)::bigint - projection.capacity_used, 0)::bigint,
    case when not projection.is_open or coalesce(override.adjusted_capacity, projection.configured_capacity) is null then null::numeric
      when coalesce(override.adjusted_capacity, projection.configured_capacity) = 0 then case when projection.capacity_used > 0 then 100::numeric else 0::numeric end
      else round(projection.capacity_used::numeric * 100 / coalesce(override.adjusted_capacity, projection.configured_capacity), 1) end,
    projection.reservation_count, projection.reservations_outside_effective_hours,
    case
      when not projection.is_open or coalesce(override.adjusted_capacity, projection.configured_capacity) = 0 then 'closed'
      when coalesce(override.adjusted_capacity, projection.configured_capacity) is null then 'not_configured'
      when projection.capacity_used >= coalesce(override.adjusted_capacity, projection.configured_capacity) then 'fully_occupied'
      when projection.capacity_used::numeric * 100 / coalesce(override.adjusted_capacity, projection.configured_capacity) >= 90 then 'high_capacity'
      when projection.capacity_used::numeric * 100 / coalesce(override.adjusted_capacity, projection.configured_capacity) >= 75 then 'near_capacity'
      else 'available' end,
    override.id, override.reason, override.created_by, actor.email::text, override.created_at,
    coalesce(notes.items, '[]'::jsonb)
  from public.project_restaurant_availability_v1(p_business_id, p_restaurant_id, p_date_from, p_date_to) projection
  left join public.operational_capacity_overrides override
    on override.business_id = p_business_id and override.restaurant_id = p_restaurant_id
   and override.service_period_id = projection.service_period_id
   and override.operational_date = projection.operational_date and override.active
  left join auth.users actor on actor.id = override.created_by
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', note.id, 'note_type', note.note_type, 'note', note.note,
      'service_period_id', note.service_period_id, 'created_by', note.created_by,
      'actor_email', note_actor.email, 'created_at', note.created_at
    ) order by note.created_at, note.id) as items
    from public.operational_capacity_notes note
    left join auth.users note_actor on note_actor.id = note.created_by
    where note.business_id = p_business_id and note.restaurant_id = p_restaurant_id
      and note.operational_date = projection.operational_date and note.active
      and (note.service_period_id is null or note.service_period_id = projection.service_period_id)
  ) notes on true
  order by projection.operational_date, projection.effective_start_time, projection.service_period_id;
end;
$$;

alter table public.operational_capacity_overrides enable row level security;
alter table public.operational_capacity_notes enable row level security;
revoke all on public.operational_capacity_overrides from anon, authenticated;
revoke all on public.operational_capacity_notes from anon, authenticated;
grant select on public.operational_capacity_overrides to authenticated;
grant select on public.operational_capacity_notes to authenticated;
create policy "Members can read operational capacity overrides"
  on public.operational_capacity_overrides for select to authenticated
  using (public.is_business_member(business_id));
create policy "Members can read operational capacity notes"
  on public.operational_capacity_notes for select to authenticated
  using (public.is_business_member(business_id));

revoke all on function public.save_operational_capacity_override_v1(uuid, uuid, uuid, date, integer, text) from public, anon;
grant execute on function public.save_operational_capacity_override_v1(uuid, uuid, uuid, date, integer, text) to authenticated;
revoke all on function public.end_operational_capacity_override_v1(uuid, text) from public, anon;
grant execute on function public.end_operational_capacity_override_v1(uuid, text) to authenticated;
revoke all on function public.save_operational_capacity_note_v1(uuid, uuid, uuid, date, text, text) from public, anon;
grant execute on function public.save_operational_capacity_note_v1(uuid, uuid, uuid, date, text, text) to authenticated;
revoke all on function public.end_operational_capacity_note_v1(uuid, text) from public, anon;
grant execute on function public.end_operational_capacity_note_v1(uuid, text) to authenticated;
revoke all on function public.project_operational_capacity_review_v1(uuid, uuid, date, date) from public, anon;
grant execute on function public.project_operational_capacity_review_v1(uuid, uuid, date, date) to authenticated;
