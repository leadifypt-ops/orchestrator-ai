-- Block 43 corrective contract: append-only manual operational overrides.
-- Informational only: no reservation table, status, trigger, or write path is changed.

create table public.capacity_override_events (
  id uuid primary key default gen_random_uuid(),
  override_id uuid not null,
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  service_period_id uuid not null,
  operational_date date not null,
  event_type text not null check (event_type in ('created', 'removed')),
  override_type text not null check (override_type in (
    'allow_over_capacity', 'force_operational_review',
    'temporarily_reduce_capacity', 'operational_exception'
  )),
  reduced_capacity integer check (reduced_capacity between 0 and 5000),
  reason text not null check (length(trim(reason)) between 1 and 500),
  internal_notes text check (internal_notes is null or length(trim(internal_notes)) between 1 and 2000),
  previous_state jsonb not null,
  new_state jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint capacity_override_events_reduction_check check (
    (override_type = 'temporarily_reduce_capacity' and reduced_capacity is not null)
    or (override_type <> 'temporarily_reduce_capacity' and reduced_capacity is null)
  ),
  constraint capacity_override_events_restaurant_business_fk
    foreign key (restaurant_id, business_id) references public.restaurants(id, business_id)
    on update restrict on delete restrict,
  constraint capacity_override_events_period_scope_fk
    foreign key (service_period_id, business_id, restaurant_id)
    references public.business_service_periods(id, business_id, restaurant_id)
    on update restrict on delete restrict
);

create unique index capacity_override_events_one_create_uidx
  on public.capacity_override_events (override_id) where event_type = 'created';
create unique index capacity_override_events_one_remove_uidx
  on public.capacity_override_events (override_id) where event_type = 'removed';
create index capacity_override_events_scope_idx on public.capacity_override_events
  (business_id, restaurant_id, operational_date, service_period_id, created_at desc, id desc);

create trigger capacity_override_events_append_only
before update or delete on public.capacity_override_events
for each row execute function public.prevent_reservation_availability_history_mutation_v1();

alter table public.capacity_override_events enable row level security;
revoke all on public.capacity_override_events from anon, authenticated;
grant select on public.capacity_override_events to authenticated;
create policy "Authorized staff can read capacity override history"
on public.capacity_override_events for select to authenticated
using (
  exists (
    select 1 from public.business_memberships membership
    where membership.business_id = capacity_override_events.business_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'manager', 'staff')
  )
);

create or replace function public.list_active_capacity_overrides(
  p_business_id uuid, p_restaurant_id uuid,
  p_date_from date default null, p_date_to date default null
)
returns table (
  override_id uuid, business_id uuid, restaurant_id uuid, service_period_id uuid,
  operational_date date, override_type text, reduced_capacity integer,
  reason text, internal_notes text, created_by uuid, actor_email text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  return query
  select event.override_id, event.business_id, event.restaurant_id, event.service_period_id,
    event.operational_date, event.override_type, event.reduced_capacity, event.reason,
    event.internal_notes, event.created_by, actor.email::text, event.created_at
  from public.capacity_override_events event
  left join auth.users actor on actor.id = event.created_by
  where event.business_id = p_business_id and event.restaurant_id = p_restaurant_id
    and event.event_type = 'created'
    and (p_date_from is null or event.operational_date >= p_date_from)
    and (p_date_to is null or event.operational_date <= p_date_to)
    and not exists (
      select 1 from public.capacity_override_events removal
      where removal.override_id = event.override_id and removal.event_type = 'removed'
    )
  order by event.operational_date, event.created_at, event.id;
end; $$;

create or replace function public.create_capacity_override(
  p_business_id uuid, p_restaurant_id uuid, p_service_period_id uuid,
  p_operational_date date, p_override_type text, p_reason text,
  p_internal_notes text default null, p_reduced_capacity integer default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_reason text := nullif(trim(p_reason), '');
  v_notes text := nullif(trim(p_internal_notes), ''); v_previous jsonb;
begin
  perform public.assert_reservation_availability_manager_v1(p_business_id);
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  if p_operational_date is null or v_reason is null or length(v_reason) > 500
    or p_override_type not in ('allow_over_capacity','force_operational_review','temporarily_reduce_capacity','operational_exception')
    or length(coalesce(v_notes, '')) > 2000
    or (p_override_type = 'temporarily_reduce_capacity' and (p_reduced_capacity is null or p_reduced_capacity < 0 or p_reduced_capacity > 5000))
    or (p_override_type <> 'temporarily_reduce_capacity' and p_reduced_capacity is not null) then
    raise exception 'Invalid capacity override' using errcode = '22023';
  end if;
  if not exists (select 1 from public.business_service_periods period where period.id = p_service_period_id
    and period.business_id = p_business_id and period.restaurant_id = p_restaurant_id) then
    raise exception 'Service period is outside restaurant scope' using errcode = '22023';
  end if;
  if exists (select 1 from public.list_active_capacity_overrides(p_business_id, p_restaurant_id, p_operational_date, p_operational_date) active
    where active.service_period_id = p_service_period_id) then
    raise exception 'An active override already exists for this service' using errcode = '23505';
  end if;
  v_previous := jsonb_build_object('active', false);
  insert into public.capacity_override_events (override_id,business_id,restaurant_id,service_period_id,
    operational_date,event_type,override_type,reduced_capacity,reason,internal_notes,
    previous_state,new_state,created_by)
  values (v_id,p_business_id,p_restaurant_id,p_service_period_id,p_operational_date,'created',
    p_override_type,p_reduced_capacity,v_reason,v_notes,v_previous,
    jsonb_build_object('active',true,'override_type',p_override_type,'reduced_capacity',p_reduced_capacity,
      'reason',v_reason,'internal_notes',v_notes),auth.uid());
  return v_id;
end; $$;

create or replace function public.remove_capacity_override(
  p_override_id uuid, p_reason text, p_internal_notes text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_created public.capacity_override_events%rowtype; v_event_id uuid; v_reason text := nullif(trim(p_reason), '');
  v_notes text := nullif(trim(p_internal_notes), '');
begin
  select * into v_created from public.capacity_override_events
    where override_id = p_override_id and event_type = 'created' for share;
  if not found then raise exception 'Capacity override not found' using errcode = 'P0002'; end if;
  perform public.assert_reservation_availability_manager_v1(v_created.business_id);
  if v_reason is null or length(v_reason) > 500 or length(coalesce(v_notes,'')) > 2000 then
    raise exception 'A valid removal reason is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.capacity_override_events where override_id=p_override_id and event_type='removed') then
    raise exception 'Capacity override is already removed' using errcode = '22023';
  end if;
  insert into public.capacity_override_events (override_id,business_id,restaurant_id,service_period_id,
    operational_date,event_type,override_type,reduced_capacity,reason,internal_notes,
    previous_state,new_state,created_by)
  values (v_created.override_id,v_created.business_id,v_created.restaurant_id,v_created.service_period_id,
    v_created.operational_date,'removed',v_created.override_type,v_created.reduced_capacity,v_reason,v_notes,
    v_created.new_state,jsonb_build_object('active',false,'override_type',v_created.override_type,
      'reduced_capacity',v_created.reduced_capacity,'reason',v_reason,'internal_notes',v_notes),auth.uid())
  returning id into v_event_id;
  return v_event_id;
end; $$;

create or replace function public.get_capacity_override_history(
  p_business_id uuid, p_restaurant_id uuid, p_override_id uuid default null
)
returns table (
  event_id uuid, override_id uuid, service_period_id uuid, operational_date date,
  event_type text, override_type text, reduced_capacity integer, reason text,
  internal_notes text, previous_state jsonb, new_state jsonb,
  created_by uuid, actor_email text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_reservation_availability_member_v1(p_business_id, p_restaurant_id);
  return query select event.id,event.override_id,event.service_period_id,event.operational_date,
    event.event_type,event.override_type,event.reduced_capacity,event.reason,event.internal_notes,
    event.previous_state,event.new_state,event.created_by,actor.email::text,event.created_at
  from public.capacity_override_events event left join auth.users actor on actor.id=event.created_by
  where event.business_id=p_business_id and event.restaurant_id=p_restaurant_id
    and (p_override_id is null or event.override_id=p_override_id)
  order by event.created_at desc,event.id desc;
end; $$;

revoke all on function public.create_capacity_override(uuid,uuid,uuid,date,text,text,text,integer) from public,anon;
revoke all on function public.remove_capacity_override(uuid,text,text) from public,anon;
revoke all on function public.get_capacity_override_history(uuid,uuid,uuid) from public,anon;
revoke all on function public.list_active_capacity_overrides(uuid,uuid,date,date) from public,anon;
grant execute on function public.create_capacity_override(uuid,uuid,uuid,date,text,text,text,integer) to authenticated;
grant execute on function public.remove_capacity_override(uuid,text,text) to authenticated;
grant execute on function public.get_capacity_override_history(uuid,uuid,uuid) to authenticated;
grant execute on function public.list_active_capacity_overrides(uuid,uuid,date,date) to authenticated;
