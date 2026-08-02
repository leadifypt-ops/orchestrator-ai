-- Block 44: Reservation Acceptance & Manual Decision Workflow.
-- Every transition is explicit and human-authored. No automation or communication is triggered.

alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check check (status in (
  'pending','reviewing','confirmed','declined','cancelled','completed','accepted','rejected'
));

create table public.reservation_decision_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  old_status text not null,
  new_status text not null check (new_status in ('pending','accepted','rejected')),
  reason text check (reason is null or length(trim(reason)) between 1 and 1000),
  internal_notes text check (internal_notes is null or length(trim(internal_notes)) between 1 and 2000),
  decided_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint reservation_decision_events_reason_requirement_check check (
    (new_status='accepted' and reason is null)
    or (new_status in ('pending','rejected') and reason is not null)
  ),
  constraint reservation_decision_events_reservation_scope_fk
    foreign key (reservation_id,business_id,restaurant_id)
    references public.reservations(id,business_id,restaurant_id)
    on update restrict on delete restrict,
  constraint reservation_decision_events_restaurant_scope_fk
    foreign key (restaurant_id,business_id)
    references public.restaurants(id,business_id)
    on update restrict on delete restrict
);

create unique index if not exists reservations_id_business_restaurant_uidx
  on public.reservations(id,business_id,restaurant_id);
create index reservation_decision_events_reservation_idx
  on public.reservation_decision_events(reservation_id,created_at desc,id desc);
create index reservation_decision_events_scope_idx
  on public.reservation_decision_events(business_id,restaurant_id,created_at desc,id desc);
create index reservations_pending_review_queue_idx
  on public.reservations(business_id,restaurant_id,created_at,id) where status='pending';

create trigger reservation_decision_events_append_only
before update or delete on public.reservation_decision_events
for each row execute function public.prevent_reservation_availability_history_mutation_v1();

alter table public.reservation_decision_events enable row level security;
revoke all on public.reservation_decision_events from anon,authenticated;
grant select on public.reservation_decision_events to authenticated;
create policy "Authorized staff can read reservation decisions"
on public.reservation_decision_events for select to authenticated
using (
  exists (select 1 from public.business_memberships membership
    where membership.business_id=reservation_decision_events.business_id
      and membership.user_id=auth.uid() and membership.role in ('owner','manager','staff'))
);

-- Status decisions must pass through the audited RPCs. Other legacy editable columns remain unchanged.
revoke update(status) on public.reservations from authenticated;

create or replace function public.assert_manual_reservation_decision_access(
  p_reservation_id uuid, p_business_id uuid default null, p_restaurant_id uuid default null
)
returns public.reservations language plpgsql stable security definer set search_path='' as $$
declare v_reservation public.reservations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_reservation from public.reservations reservation
  where reservation.id=p_reservation_id
    and (p_business_id is null or reservation.business_id=p_business_id)
    and (p_restaurant_id is null or reservation.restaurant_id=p_restaurant_id);
  if not found then raise exception 'Reservation not found in requested scope' using errcode='P0002'; end if;
  if not exists (select 1 from public.business_memberships membership
    where membership.business_id=v_reservation.business_id and membership.user_id=auth.uid()
      and membership.role in ('owner','manager','staff')) then
    raise exception 'Reservation decision access denied' using errcode='42501';
  end if;
  return v_reservation;
end $$;
revoke all on function public.assert_manual_reservation_decision_access(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.record_manual_reservation_decision(
  p_reservation_id uuid,p_new_status text,p_reason text default null,p_internal_notes text default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_reservation public.reservations%rowtype; v_event_id uuid;
  v_reason text:=nullif(trim(p_reason),''); v_notes text:=nullif(trim(p_internal_notes),'');
  v_label text;
begin
  v_reservation:=public.assert_manual_reservation_decision_access(p_reservation_id,null,null);
  select * into v_reservation from public.reservations where id=p_reservation_id for update;
  if p_new_status not in ('pending','accepted','rejected') then
    raise exception 'Invalid reservation decision status' using errcode='22023'; end if;
  if v_reservation.status=p_new_status then
    raise exception 'Duplicate reservation decision' using errcode='22023'; end if;
  if p_new_status='pending' and v_reservation.status not in ('accepted','rejected') then
    raise exception 'Only accepted or rejected reservations may return to pending' using errcode='22023'; end if;
  if p_new_status in ('accepted','rejected') and v_reservation.status not in ('pending','accepted','rejected') then
    raise exception 'Reservation is not in the manual decision workflow' using errcode='22023'; end if;
  if p_new_status in ('pending','rejected') and v_reason is null then
    raise exception 'A reason is required for this decision' using errcode='22023'; end if;
  if p_new_status='accepted' and v_reason is not null then
    raise exception 'Acceptance does not take a reason; use internal notes' using errcode='22023'; end if;
  if length(coalesce(v_reason,''))>1000 or length(coalesce(v_notes,''))>2000 then
    raise exception 'Decision reason or notes are too long' using errcode='22023'; end if;

  update public.reservations set status=p_new_status where id=v_reservation.id;
  insert into public.reservation_decision_events(
    reservation_id,business_id,restaurant_id,old_status,new_status,reason,internal_notes,decided_by
  ) values (
    v_reservation.id,v_reservation.business_id,v_reservation.restaurant_id,v_reservation.status,
    p_new_status,v_reason,v_notes,auth.uid()
  ) returning id into v_event_id;
  v_label:=case p_new_status when 'accepted' then 'Reservation Accepted'
    when 'rejected' then 'Reservation Rejected' else 'Returned To Pending' end;
  insert into public.reservation_timeline_events(
    canonical_reservation_id,event_type,event_label,event_description,created_by
  ) values (
    v_reservation.id,'reservation_decision',v_label,
    concat_ws(E'\n',case when v_reason is not null then 'Reason: '||v_reason end,
      case when v_notes is not null then 'Notes: '||v_notes end),auth.uid()
  );
  return v_event_id;
end $$;
revoke all on function public.record_manual_reservation_decision(uuid,text,text,text) from public,anon,authenticated;

create or replace function public.accept_reservation(p_reservation_id uuid,p_internal_notes text default null)
returns uuid language sql security definer set search_path='' as $$
  select public.record_manual_reservation_decision(p_reservation_id,'accepted',null,p_internal_notes)
$$;
create or replace function public.reject_reservation(p_reservation_id uuid,p_rejection_reason text,p_internal_notes text default null)
returns uuid language sql security definer set search_path='' as $$
  select public.record_manual_reservation_decision(p_reservation_id,'rejected',p_rejection_reason,p_internal_notes)
$$;
create or replace function public.return_reservation_to_pending(p_reservation_id uuid,p_reason text)
returns uuid language sql security definer set search_path='' as $$
  select public.record_manual_reservation_decision(p_reservation_id,'pending',p_reason,null)
$$;

create or replace function public.list_pending_reservations(p_business_id uuid,p_restaurant_id uuid default null)
returns table(
  reservation_id uuid,business_id uuid,restaurant_id uuid,business_name text,restaurant_name text,
  guest_name text,guest_email text,guest_phone text,requested_date date,
  requested_time time without time zone,party_size integer,status text,occasion text,
  special_request text,source text,created_at timestamptz
) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.business_memberships membership
    where membership.business_id=p_business_id and membership.user_id=auth.uid()
      and membership.role in ('owner','manager','staff')) then
    raise exception 'Pending reservation access denied' using errcode='42501'; end if;
  if p_restaurant_id is not null and not exists(select 1 from public.restaurants restaurant
    where restaurant.id=p_restaurant_id and restaurant.business_id=p_business_id) then
    raise exception 'Restaurant is outside Business scope' using errcode='42501'; end if;
  return query select reservation.id,reservation.business_id,reservation.restaurant_id,
    business.name::text,restaurant.name::text,reservation.guest_name,reservation.guest_email,
    reservation.guest_phone,reservation.requested_date,reservation.requested_time,reservation.party_size,
    reservation.status,reservation.occasion,reservation.special_request,reservation.source,reservation.created_at
  from public.reservations reservation
  join public.businesses business on business.id=reservation.business_id
  join public.restaurants restaurant on restaurant.id=reservation.restaurant_id
  where reservation.business_id=p_business_id and reservation.status='pending'
    and (p_restaurant_id is null or reservation.restaurant_id=p_restaurant_id)
  order by reservation.created_at,reservation.id;
end $$;

revoke all on function public.accept_reservation(uuid,text) from public,anon;
revoke all on function public.reject_reservation(uuid,text,text) from public,anon;
revoke all on function public.return_reservation_to_pending(uuid,text) from public,anon;
revoke all on function public.list_pending_reservations(uuid,uuid) from public,anon;
grant execute on function public.accept_reservation(uuid,text) to authenticated;
grant execute on function public.reject_reservation(uuid,text,text) to authenticated;
grant execute on function public.return_reservation_to_pending(uuid,text) to authenticated;
grant execute on function public.list_pending_reservations(uuid,uuid) to authenticated;
