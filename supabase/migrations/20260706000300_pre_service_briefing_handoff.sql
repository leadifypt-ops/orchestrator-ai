-- Block 48: Pre-Service Briefing Assembly & Staff Handoff.
-- Human-controlled service briefing. Assembly is read-only; notes, item reviews, handoffs and events are auditable.

create table public.pre_service_briefings (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null, service_date date not null, service_period_id uuid,
  status text not null default 'draft' check (status in ('draft','prepared','handed_off','acknowledged','closed')),
  snapshot jsonb, snapshot_hash text check (snapshot_hash is null or length(snapshot_hash)=64),
  created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
  prepared_by uuid references auth.users(id) on delete restrict, prepared_at timestamptz,
  closed_by uuid references auth.users(id) on delete restrict, closed_at timestamptz,
  close_reason text check (close_reason is null or length(trim(close_reason)) between 1 and 1000),
  constraint pre_service_briefings_restaurant_scope_fk foreign key (restaurant_id,business_id) references public.restaurants(id,business_id) on update restrict on delete restrict,
  constraint pre_service_briefings_period_scope_fk foreign key (service_period_id,business_id,restaurant_id) references public.business_service_periods(id,business_id,restaurant_id) on update restrict on delete restrict,
  constraint pre_service_briefings_prepared_state_check check ((status='draft' and snapshot is null and snapshot_hash is null and prepared_by is null and prepared_at is null) or (status<>'draft' and snapshot is not null and snapshot_hash is not null and prepared_by is not null and prepared_at is not null)),
  constraint pre_service_briefings_closed_state_check check ((status='closed' and closed_by is not null and closed_at is not null and close_reason is not null) or (status<>'closed' and closed_by is null and closed_at is null and close_reason is null))
);
create unique index pre_service_briefings_open_scope_uidx on public.pre_service_briefings(restaurant_id,service_date,coalesce(service_period_id,'00000000-0000-0000-0000-000000000000'::uuid)) where status<>'closed';
create unique index pre_service_briefings_scope_reference_uidx on public.pre_service_briefings(id,business_id,restaurant_id);
create index pre_service_briefings_scope_idx on public.pre_service_briefings(business_id,restaurant_id,service_date,status,created_at desc);

create table public.pre_service_briefing_notes (
 id uuid primary key default gen_random_uuid(), briefing_id uuid not null references public.pre_service_briefings(id) on delete restrict,
 business_id uuid not null references public.businesses(id) on delete restrict, restaurant_id uuid not null,
 reservation_id uuid references public.reservations(id) on delete restrict,
 note text not null check (length(trim(note)) between 1 and 2000), created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
 constraint pre_service_briefing_notes_briefing_scope_fk foreign key (briefing_id,business_id,restaurant_id) references public.pre_service_briefings(id,business_id,restaurant_id) on update restrict on delete restrict,
 constraint pre_service_briefing_notes_reservation_scope_fk foreign key (reservation_id,business_id,restaurant_id) references public.reservations(id,business_id,restaurant_id) on update restrict on delete restrict
);
create index pre_service_briefing_notes_briefing_idx on public.pre_service_briefing_notes(briefing_id,created_at,id);

create table public.pre_service_briefing_reviewed_items (
 id uuid primary key default gen_random_uuid(), briefing_id uuid not null references public.pre_service_briefings(id) on delete restrict,
 business_id uuid not null references public.businesses(id) on delete restrict, restaurant_id uuid not null,
 reservation_id uuid references public.reservations(id) on delete restrict,
 item_type text not null check (item_type in ('reservation','dietary','guest_update','communication','capacity','note','other')),
 item_key text not null check (length(trim(item_key)) between 1 and 200), review_note text check (review_note is null or length(trim(review_note)) between 1 and 1000),
 reviewed_by uuid not null references auth.users(id) on delete restrict, reviewed_at timestamptz not null default now(),
 constraint pre_service_briefing_reviewed_items_briefing_scope_fk foreign key (briefing_id,business_id,restaurant_id) references public.pre_service_briefings(id,business_id,restaurant_id) on update restrict on delete restrict,
 constraint pre_service_briefing_reviewed_items_reservation_scope_fk foreign key (reservation_id,business_id,restaurant_id) references public.reservations(id,business_id,restaurant_id) on update restrict on delete restrict
);
create unique index pre_service_briefing_reviewed_items_uidx on public.pre_service_briefing_reviewed_items(briefing_id,item_type,item_key);

create table public.pre_service_briefing_handoffs (
 id uuid primary key default gen_random_uuid(), briefing_id uuid not null references public.pre_service_briefings(id) on delete restrict,
 business_id uuid not null references public.businesses(id) on delete restrict, restaurant_id uuid not null,
 parent_handoff_id uuid references public.pre_service_briefing_handoffs(id) on delete restrict,
 status text not null check (status in ('created','acknowledged')), target_type text not null check (target_type in ('dining_room','kitchen','management','sommelier','individual','other')),
 target_user_id uuid references auth.users(id) on delete restrict, message text check (message is null or length(trim(message)) between 1 and 2000),
 created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), acknowledged_by uuid references auth.users(id) on delete restrict, acknowledged_at timestamptz,
 acknowledgement_note text check (acknowledgement_note is null or length(trim(acknowledgement_note)) between 1 and 1000),
 constraint pre_service_briefing_handoffs_briefing_scope_fk foreign key (briefing_id,business_id,restaurant_id) references public.pre_service_briefings(id,business_id,restaurant_id) on update restrict on delete restrict,
 constraint pre_service_briefing_handoffs_state_check check ((status='created' and parent_handoff_id is null and acknowledged_by is null and acknowledged_at is null and acknowledgement_note is null) or (status='acknowledged' and parent_handoff_id is not null and acknowledged_by is not null and acknowledged_at is not null)),
 constraint pre_service_briefing_handoffs_individual_target_check check ((target_type='individual' and target_user_id is not null) or target_type<>'individual')
);
create unique index pre_service_briefing_handoffs_ack_uidx on public.pre_service_briefing_handoffs(parent_handoff_id) where status='acknowledged';
create index pre_service_briefing_handoffs_briefing_idx on public.pre_service_briefing_handoffs(briefing_id,created_at,id);
create table public.pre_service_briefing_events (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete restrict, restaurant_id uuid not null,
 briefing_id uuid not null references public.pre_service_briefings(id) on delete restrict, reservation_id uuid references public.reservations(id) on delete restrict, service_period_id uuid,
 actor_user_id uuid references auth.users(id) on delete restrict, event_type text not null check (event_type in ('briefing_created','briefing_prepared','item_reviewed','note_added','handoff_created','handoff_acknowledged','briefing_closed')),
 old_status text, new_status text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 constraint pre_service_briefing_events_briefing_scope_fk foreign key (briefing_id,business_id,restaurant_id) references public.pre_service_briefings(id,business_id,restaurant_id) on update restrict on delete restrict,
 constraint pre_service_briefing_events_reservation_scope_fk foreign key (reservation_id,business_id,restaurant_id) references public.reservations(id,business_id,restaurant_id) on update restrict on delete restrict,
 constraint pre_service_briefing_events_period_scope_fk foreign key (service_period_id,business_id,restaurant_id) references public.business_service_periods(id,business_id,restaurant_id) on update restrict on delete restrict
);
create index pre_service_briefing_events_briefing_idx on public.pre_service_briefing_events(briefing_id,created_at,id);
create index pre_service_briefing_events_scope_idx on public.pre_service_briefing_events(business_id,restaurant_id,created_at desc);

create trigger pre_service_briefings_prevent_delete before delete on public.pre_service_briefings for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger pre_service_briefing_notes_append_only before update or delete on public.pre_service_briefing_notes for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger pre_service_briefing_reviewed_items_append_only before update or delete on public.pre_service_briefing_reviewed_items for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger pre_service_briefing_handoffs_append_only before update or delete on public.pre_service_briefing_handoffs for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger pre_service_briefing_events_append_only before update or delete on public.pre_service_briefing_events for each row execute function public.prevent_reservation_availability_history_mutation_v1();

alter table public.pre_service_briefings enable row level security; alter table public.pre_service_briefing_notes enable row level security; alter table public.pre_service_briefing_reviewed_items enable row level security; alter table public.pre_service_briefing_handoffs enable row level security; alter table public.pre_service_briefing_events enable row level security;
revoke all on public.pre_service_briefings,public.pre_service_briefing_notes,public.pre_service_briefing_reviewed_items,public.pre_service_briefing_handoffs,public.pre_service_briefing_events from anon,authenticated;
grant select on public.pre_service_briefings,public.pre_service_briefing_notes,public.pre_service_briefing_reviewed_items,public.pre_service_briefing_handoffs,public.pre_service_briefing_events to authenticated;
create policy "Authorized staff can read pre-service briefings" on public.pre_service_briefings for select to authenticated using (exists(select 1 from public.business_memberships m where m.business_id=pre_service_briefings.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));
create policy "Authorized staff can read briefing notes" on public.pre_service_briefing_notes for select to authenticated using (exists(select 1 from public.business_memberships m where m.business_id=pre_service_briefing_notes.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));
create policy "Authorized staff can read briefing reviewed items" on public.pre_service_briefing_reviewed_items for select to authenticated using (exists(select 1 from public.business_memberships m where m.business_id=pre_service_briefing_reviewed_items.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));
create policy "Authorized staff can read briefing handoffs" on public.pre_service_briefing_handoffs for select to authenticated using (exists(select 1 from public.business_memberships m where m.business_id=pre_service_briefing_handoffs.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));
create policy "Authorized staff can read briefing events" on public.pre_service_briefing_events for select to authenticated using (exists(select 1 from public.business_memberships m where m.business_id=pre_service_briefing_events.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));

create or replace function public.assert_pre_service_briefing_access(p_restaurant_id uuid,p_service_date date,p_service_period_id uuid default null)
returns public.restaurants language plpgsql stable security definer set search_path='' as $$
declare v_restaurant public.restaurants%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_restaurant_id is null or p_service_date is null then raise exception 'Restaurant and service date are required' using errcode='22023'; end if;
 select * into v_restaurant from public.restaurants where id=p_restaurant_id;
 if not found or not exists(select 1 from public.business_memberships m where m.business_id=v_restaurant.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')) then raise exception 'Pre-service briefing access denied' using errcode='42501'; end if;
 if p_service_period_id is not null and not exists(select 1 from public.business_service_periods p where p.id=p_service_period_id and p.business_id=v_restaurant.business_id and p.restaurant_id=v_restaurant.id) then raise exception 'Service period is outside restaurant scope' using errcode='42501'; end if;
 return v_restaurant;
end $$;
revoke all on function public.assert_pre_service_briefing_access(uuid,date,uuid) from public,anon,authenticated;

create or replace function public.assert_pre_service_briefing_row(p_briefing_id uuid)
returns public.pre_service_briefings language plpgsql stable security definer set search_path='' as $$
declare v_briefing public.pre_service_briefings%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_briefing from public.pre_service_briefings where id=p_briefing_id;
 if not found then raise exception 'Pre-service briefing not found' using errcode='P0002'; end if;
 perform public.assert_pre_service_briefing_access(v_briefing.restaurant_id,v_briefing.service_date,v_briefing.service_period_id);
 return v_briefing;
end $$;
revoke all on function public.assert_pre_service_briefing_row(uuid) from public,anon,authenticated;

create or replace function public.append_pre_service_briefing_event(p_briefing public.pre_service_briefings,p_event_type text,p_old_status text,p_new_status text,p_reservation_id uuid default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_label text;
begin
 insert into public.pre_service_briefing_events(business_id,restaurant_id,briefing_id,reservation_id,service_period_id,actor_user_id,event_type,old_status,new_status,metadata)
 values(p_briefing.business_id,p_briefing.restaurant_id,p_briefing.id,p_reservation_id,p_briefing.service_period_id,auth.uid(),p_event_type,p_old_status,p_new_status,coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
 v_label:=case p_event_type when 'briefing_created' then 'Pre-Service Briefing Created' when 'briefing_prepared' then 'Pre-Service Briefing Prepared' when 'item_reviewed' then 'Briefing Item Reviewed' when 'note_added' then 'Briefing Note Added' when 'handoff_created' then 'Pre-Service Briefing Handoff Created' when 'handoff_acknowledged' then 'Pre-Service Briefing Handoff Acknowledged' else 'Pre-Service Briefing Closed' end;
 if p_reservation_id is not null then insert into public.reservation_timeline_events(canonical_reservation_id,event_type,event_label,event_description,created_by) values(p_reservation_id,'pre_service_briefing',v_label,concat_ws(E'\n','Briefing: '||p_briefing.id::text,'Status: '||coalesce(p_old_status,'')||' -> '||coalesce(p_new_status,'')),auth.uid()); end if;
 return v_id;
end $$;
revoke all on function public.append_pre_service_briefing_event(public.pre_service_briefings,text,text,text,uuid,jsonb) from public,anon,authenticated;
create or replace function public.assemble_pre_service_briefing(p_restaurant_id uuid,p_service_date date,p_service_period_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_restaurant public.restaurants%rowtype; v_period public.business_service_periods%rowtype; v_reservations jsonb; v_capacity jsonb; v_count integer:=0; v_covers integer:=0; v_pending integer:=0; v_comm_warn integer:=0;
begin
 v_restaurant:=public.assert_pre_service_briefing_access(p_restaurant_id,p_service_date,p_service_period_id);
 if p_service_period_id is not null then select * into v_period from public.business_service_periods where id=p_service_period_id and business_id=v_restaurant.business_id and restaurant_id=p_restaurant_id; end if;
 with cap as (select * from public.project_operational_capacity_review_v1(v_restaurant.business_id,p_restaurant_id,p_service_date,p_service_date) where p_service_period_id is null or service_period_id=p_service_period_id),
 accepted as (
  select distinct on (r.id) r.*,cap.operational_date,cap.service_period_id as matched_service_period_id,cap.service_period_name,cap.availability_status,cap.override_reason,cap.operational_notes
  from public.reservations r join cap on r.business_id=v_restaurant.business_id and r.restaurant_id=p_restaurant_id and r.status='accepted' and r.requested_time is not null and ((cap.effective_start_time<cap.effective_end_time and r.requested_date=cap.operational_date and r.requested_time>=cap.effective_start_time and r.requested_time<cap.effective_end_time) or (cap.effective_start_time>cap.effective_end_time and ((r.requested_date=cap.operational_date and r.requested_time>=cap.effective_start_time) or (r.requested_date=cap.operational_date+1 and r.requested_time<cap.effective_end_time))))
  where r.requested_date between p_service_date and p_service_date+1 order by r.id,cap.effective_start_time desc,cap.service_period_id)
 select count(*),coalesce(sum(party_size),0) into v_count,v_covers from accepted;
 with cap as (select * from public.project_operational_capacity_review_v1(v_restaurant.business_id,p_restaurant_id,p_service_date,p_service_date) where p_service_period_id is null or service_period_id=p_service_period_id),
 accepted as (select distinct r.id from public.reservations r join cap on r.business_id=v_restaurant.business_id and r.restaurant_id=p_restaurant_id and r.status='accepted' and r.requested_time is not null and ((cap.effective_start_time<cap.effective_end_time and r.requested_date=cap.operational_date and r.requested_time>=cap.effective_start_time and r.requested_time<cap.effective_end_time) or (cap.effective_start_time>cap.effective_end_time and ((r.requested_date=cap.operational_date and r.requested_time>=cap.effective_start_time) or (r.requested_date=cap.operational_date+1 and r.requested_time<cap.effective_end_time)))) where r.requested_date between p_service_date and p_service_date+1)
 select count(*) into v_pending from public.reservation_guest_submissions s join accepted a on a.id=s.reservation_id left join public.reservation_guest_submission_reviews review on review.submission_id=s.id where review.id is null;
 with cap as (select * from public.project_operational_capacity_review_v1(v_restaurant.business_id,p_restaurant_id,p_service_date,p_service_date) where p_service_period_id is null or service_period_id=p_service_period_id),
 accepted as (select distinct r.id from public.reservations r join cap on r.business_id=v_restaurant.business_id and r.restaurant_id=p_restaurant_id and r.status='accepted' and r.requested_time is not null and ((cap.effective_start_time<cap.effective_end_time and r.requested_date=cap.operational_date and r.requested_time>=cap.effective_start_time and r.requested_time<cap.effective_end_time) or (cap.effective_start_time>cap.effective_end_time and ((r.requested_date=cap.operational_date and r.requested_time>=cap.effective_start_time) or (r.requested_date=cap.operational_date+1 and r.requested_time<cap.effective_end_time)))) where r.requested_date between p_service_date and p_service_date+1)
 select count(*) into v_comm_warn from accepted a where not exists(select 1 from public.reservation_communications c where c.reservation_id=a.id and c.status='marked_sent');
 with cap as (select * from public.project_operational_capacity_review_v1(v_restaurant.business_id,p_restaurant_id,p_service_date,p_service_date) where p_service_period_id is null or service_period_id=p_service_period_id),
 accepted as (
  select distinct on (r.id) r.*,cap.operational_date,cap.service_period_id as matched_service_period_id,cap.service_period_name,cap.availability_status,cap.override_reason,cap.operational_notes
  from public.reservations r join cap on r.business_id=v_restaurant.business_id and r.restaurant_id=p_restaurant_id and r.status='accepted' and r.requested_time is not null and ((cap.effective_start_time<cap.effective_end_time and r.requested_date=cap.operational_date and r.requested_time>=cap.effective_start_time and r.requested_time<cap.effective_end_time) or (cap.effective_start_time>cap.effective_end_time and ((r.requested_date=cap.operational_date and r.requested_time>=cap.effective_start_time) or (r.requested_date=cap.operational_date+1 and r.requested_time<cap.effective_end_time))))
  where r.requested_date between p_service_date and p_service_date+1 order by r.id,cap.effective_start_time desc,cap.service_period_id)
 select coalesce(jsonb_agg(jsonb_build_object('reservation_id',r.id,'service_period_id',r.matched_service_period_id,'service_period_name',r.service_period_name,'operational_date',r.operational_date,'date',r.requested_date,'time',r.requested_time,'guest_name',r.guest_name,'guest_email',r.guest_email,'guest_phone',r.guest_phone,'party_size',r.party_size,'status',r.status,'occasion',r.occasion,'special_request',r.special_request,'source',r.source,
 'returning_guest',exists(select 1 from public.reservations prior where prior.business_id=r.business_id and prior.id<>r.id and prior.created_at<r.created_at and ((r.guest_email is not null and prior.guest_email=r.guest_email) or (r.guest_phone is not null and prior.guest_phone=r.guest_phone))),
 'capacity_context',jsonb_build_object('availability_status',r.availability_status,'override_reason',r.override_reason,'operational_notes',coalesce(r.operational_notes,'[]'::jsonb)),
 'guests',coalesce((select jsonb_agg(jsonb_build_object('guest_id',g.id,'name',g.full_name,'email',g.email,'phone',g.phone,'is_host',g.is_host,'position',g.guest_position) order by g.is_host desc,g.guest_position,g.id) from public.reservation_guests g where g.canonical_reservation_id=r.id),'[]'::jsonb),
 'dietary',coalesce((select jsonb_agg(jsonb_build_object('guest_name',g.full_name,'allergies',d.allergies,'intolerances',d.intolerances,'dietary_restrictions',d.dietary_restrictions,'dislikes',d.dislikes,'wine_preferences',d.wine_preferences,'notes',d.notes) order by g.guest_position,g.id) from public.reservation_guests g join public.guest_dietary_profiles d on d.reservation_guest_id=g.id where g.canonical_reservation_id=r.id),'[]'::jsonb),
 'internal_notes',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at) order by n.created_at,n.id) from public.reservation_internal_notes n where n.canonical_reservation_id=r.id),'[]'::jsonb),
 'communications',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'type',c.communication_type,'channel',c.channel,'status',c.status,'subject',c.subject,'updated_at',c.updated_at) order by c.updated_at desc,c.id desc) from public.reservation_communications c where c.reservation_id=r.id and c.status<>'cancelled'),'[]'::jsonb),
 'confirmation_link_active',exists(select 1 from public.reservation_confirmation_tokens t where t.reservation_id=r.id and t.revoked_at is null and t.expires_at>now()),
 'pending_updates',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'type',s.submission_type,'summary',public.guest_submission_summary(s),'submitted_at',s.created_at) order by s.created_at,s.id) from public.reservation_guest_submissions s left join public.reservation_guest_submission_reviews review on review.submission_id=s.id where s.reservation_id=r.id and review.id is null),'[]'::jsonb),
 'reviewed_updates',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'type',s.submission_type,'summary',public.guest_submission_summary(s),'review_status',review.review_status,'review_reason',review.review_reason,'reviewed_at',review.reviewed_at,'linked_internal_note_id',review.linked_internal_note_id,'linked_communication_id',review.linked_communication_id) order by review.reviewed_at,review.id) from public.reservation_guest_submissions s join public.reservation_guest_submission_reviews review on review.submission_id=s.id where s.reservation_id=r.id and review.review_status<>'dismissed'),'[]'::jsonb),
 'dismissed_updates',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'type',s.submission_type,'review_reason',review.review_reason,'reviewed_at',review.reviewed_at) order by review.reviewed_at,review.id) from public.reservation_guest_submissions s join public.reservation_guest_submission_reviews review on review.submission_id=s.id where s.reservation_id=r.id and review.review_status='dismissed'),'[]'::jsonb)) order by r.requested_date,r.requested_time,r.id),'[]'::jsonb) into v_reservations from accepted r;
 select coalesce(jsonb_agg(to_jsonb(projection)),'[]'::jsonb) into v_capacity from public.project_operational_capacity_review_v1(v_restaurant.business_id,p_restaurant_id,p_service_date,p_service_date) projection where p_service_period_id is null or projection.service_period_id=p_service_period_id;
 return jsonb_build_object('business_id',v_restaurant.business_id,'restaurant_id',v_restaurant.id,'restaurant_name',v_restaurant.name,'service_date',p_service_date,'service_period_id',p_service_period_id,'service_period_name',v_period.name,'summary',jsonb_build_object('accepted_reservations',v_count,'covers',v_covers,'pending_guest_updates',v_pending,'communication_warnings',v_comm_warn,'unresolved_warnings',v_pending+v_comm_warn),'reservations',v_reservations,'capacity_context',v_capacity);
end $$;
create or replace function public.create_pre_service_briefing(p_restaurant_id uuid,p_service_date date,p_service_period_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_restaurant public.restaurants%rowtype; v_briefing public.pre_service_briefings%rowtype;
begin
 v_restaurant:=public.assert_pre_service_briefing_access(p_restaurant_id,p_service_date,p_service_period_id);
 select * into v_briefing from public.pre_service_briefings where restaurant_id=p_restaurant_id and service_date=p_service_date and service_period_id is not distinct from p_service_period_id and status<>'closed';
 if found then return v_briefing.id; end if;
 insert into public.pre_service_briefings(business_id,restaurant_id,service_date,service_period_id,status,created_by) values(v_restaurant.business_id,p_restaurant_id,p_service_date,p_service_period_id,'draft',auth.uid()) returning * into v_briefing;
 perform public.append_pre_service_briefing_event(v_briefing,'briefing_created',null,'draft',null,'{}'::jsonb); return v_briefing.id;
end $$;

create or replace function public.prepare_pre_service_briefing(p_briefing_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_briefing public.pre_service_briefings%rowtype; v_snapshot jsonb;
begin
 select * into v_briefing from public.pre_service_briefings where id=p_briefing_id for update;
 if not found then raise exception 'Pre-service briefing not found' using errcode='P0002'; end if;
 perform public.assert_pre_service_briefing_access(v_briefing.restaurant_id,v_briefing.service_date,v_briefing.service_period_id);
 if v_briefing.status<>'draft' then raise exception 'Only draft briefings can be prepared' using errcode='22023'; end if;
 v_snapshot:=public.assemble_pre_service_briefing(v_briefing.restaurant_id,v_briefing.service_date,v_briefing.service_period_id);
 update public.pre_service_briefings set status='prepared',snapshot=v_snapshot,snapshot_hash=encode(extensions.digest(v_snapshot::text,'sha256'),'hex'),prepared_by=auth.uid(),prepared_at=now() where id=v_briefing.id returning * into v_briefing;
 perform public.append_pre_service_briefing_event(v_briefing,'briefing_prepared','draft','prepared',null,jsonb_build_object('snapshot_hash',v_briefing.snapshot_hash)); return v_briefing.id;
end $$;

create or replace function public.add_pre_service_briefing_note(p_briefing_id uuid,p_note text,p_reservation_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_briefing public.pre_service_briefings%rowtype; v_note text:=nullif(trim(p_note),''); v_id uuid;
begin
 v_briefing:=public.assert_pre_service_briefing_row(p_briefing_id);
 if v_briefing.status='closed' then raise exception 'Closed briefings cannot receive notes' using errcode='22023'; end if;
 if v_note is null or length(v_note)>2000 then raise exception 'A briefing note between 1 and 2000 characters is required' using errcode='22023'; end if;
 if p_reservation_id is not null and not exists(select 1 from public.reservations r where r.id=p_reservation_id and r.business_id=v_briefing.business_id and r.restaurant_id=v_briefing.restaurant_id and r.status='accepted') then raise exception 'Reservation is outside briefing scope or not accepted' using errcode='42501'; end if;
 insert into public.pre_service_briefing_notes(briefing_id,business_id,restaurant_id,reservation_id,note,created_by) values(v_briefing.id,v_briefing.business_id,v_briefing.restaurant_id,p_reservation_id,v_note,auth.uid()) returning id into v_id;
 perform public.append_pre_service_briefing_event(v_briefing,'note_added',v_briefing.status,v_briefing.status,p_reservation_id,jsonb_build_object('note_id',v_id)); return v_id;
end $$;

create or replace function public.mark_pre_service_briefing_item_reviewed(p_briefing_id uuid,p_item_type text,p_item_key text,p_reservation_id uuid default null,p_review_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_briefing public.pre_service_briefings%rowtype; v_key text:=nullif(trim(p_item_key),''); v_note text:=nullif(trim(p_review_note),''); v_id uuid;
begin
 v_briefing:=public.assert_pre_service_briefing_row(p_briefing_id);
 if v_briefing.status='closed' then raise exception 'Closed briefings cannot be changed' using errcode='22023'; end if;
 if p_item_type not in ('reservation','dietary','guest_update','communication','capacity','note','other') or v_key is null or length(v_key)>200 or length(coalesce(v_note,''))>1000 then raise exception 'Invalid briefing review item' using errcode='22023'; end if;
 if p_reservation_id is not null and not exists(select 1 from public.reservations r where r.id=p_reservation_id and r.business_id=v_briefing.business_id and r.restaurant_id=v_briefing.restaurant_id and r.status='accepted') then raise exception 'Reservation is outside briefing scope or not accepted' using errcode='42501'; end if;
 insert into public.pre_service_briefing_reviewed_items(briefing_id,business_id,restaurant_id,reservation_id,item_type,item_key,review_note,reviewed_by) values(v_briefing.id,v_briefing.business_id,v_briefing.restaurant_id,p_reservation_id,p_item_type,v_key,v_note,auth.uid()) on conflict (briefing_id,item_type,item_key) do nothing returning id into v_id;
 if v_id is null then raise exception 'Briefing item was already reviewed' using errcode='22023'; end if;
 perform public.append_pre_service_briefing_event(v_briefing,'item_reviewed',v_briefing.status,v_briefing.status,p_reservation_id,jsonb_build_object('item_type',p_item_type,'item_key',v_key)); return v_id;
end $$;

create or replace function public.create_pre_service_briefing_handoff(p_briefing_id uuid,p_target_type text,p_target_user_id uuid default null,p_message text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_briefing public.pre_service_briefings%rowtype; v_message text:=nullif(trim(p_message),''); v_id uuid; v_old text;
begin
 select * into v_briefing from public.pre_service_briefings where id=p_briefing_id for update;
 if not found then raise exception 'Pre-service briefing not found' using errcode='P0002'; end if;
 perform public.assert_pre_service_briefing_access(v_briefing.restaurant_id,v_briefing.service_date,v_briefing.service_period_id);
 if v_briefing.status not in ('prepared','handed_off','acknowledged') then raise exception 'Briefing must be prepared before handoff' using errcode='22023'; end if;
 if p_target_type not in ('dining_room','kitchen','management','sommelier','individual','other') or (p_target_type='individual' and p_target_user_id is null) or length(coalesce(v_message,''))>2000 then raise exception 'Invalid handoff target or message' using errcode='22023'; end if;
 if p_target_user_id is not null and not exists(select 1 from public.business_memberships m where m.business_id=v_briefing.business_id and m.user_id=p_target_user_id and m.role in ('owner','manager','staff')) then raise exception 'Handoff target user is outside Business scope' using errcode='42501'; end if;
 insert into public.pre_service_briefing_handoffs(briefing_id,business_id,restaurant_id,status,target_type,target_user_id,message,created_by) values(v_briefing.id,v_briefing.business_id,v_briefing.restaurant_id,'created',p_target_type,p_target_user_id,v_message,auth.uid()) returning id into v_id;
 v_old:=v_briefing.status; if v_briefing.status='prepared' then update public.pre_service_briefings set status='handed_off' where id=v_briefing.id returning * into v_briefing; end if;
 perform public.append_pre_service_briefing_event(v_briefing,'handoff_created',v_old,v_briefing.status,null,jsonb_build_object('handoff_id',v_id,'target_type',p_target_type)); return v_id;
end $$;

create or replace function public.acknowledge_pre_service_briefing_handoff(p_handoff_id uuid,p_acknowledgement_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_handoff public.pre_service_briefing_handoffs%rowtype; v_briefing public.pre_service_briefings%rowtype; v_note text:=nullif(trim(p_acknowledgement_note),''); v_id uuid; v_old text;
begin
 select * into v_handoff from public.pre_service_briefing_handoffs where id=p_handoff_id and status='created'; if not found then raise exception 'Open handoff not found' using errcode='P0002'; end if;
 select * into v_briefing from public.pre_service_briefings where id=v_handoff.briefing_id for update;
 perform public.assert_pre_service_briefing_access(v_briefing.restaurant_id,v_briefing.service_date,v_briefing.service_period_id);
 if v_briefing.status='closed' then raise exception 'Closed briefings cannot receive acknowledgements' using errcode='22023'; end if;
 if v_handoff.target_user_id is not null and v_handoff.target_user_id<>auth.uid() then raise exception 'Only the target user can acknowledge this handoff' using errcode='42501'; end if;
 if length(coalesce(v_note,''))>1000 then raise exception 'Acknowledgement note is too long' using errcode='22023'; end if;
 if exists(select 1 from public.pre_service_briefing_handoffs h where h.parent_handoff_id=v_handoff.id and h.status='acknowledged') then raise exception 'Handoff already acknowledged' using errcode='22023'; end if;
 insert into public.pre_service_briefing_handoffs(briefing_id,business_id,restaurant_id,parent_handoff_id,status,target_type,target_user_id,message,created_by,acknowledged_by,acknowledged_at,acknowledgement_note) values(v_handoff.briefing_id,v_handoff.business_id,v_handoff.restaurant_id,v_handoff.id,'acknowledged',v_handoff.target_type,v_handoff.target_user_id,v_handoff.message,auth.uid(),auth.uid(),now(),v_note) returning id into v_id;
 v_old:=v_briefing.status; update public.pre_service_briefings set status='acknowledged' where id=v_briefing.id returning * into v_briefing;
 perform public.append_pre_service_briefing_event(v_briefing,'handoff_acknowledged',v_old,'acknowledged',null,jsonb_build_object('handoff_id',v_handoff.id,'acknowledgement_id',v_id)); return v_id;
end $$;

create or replace function public.close_pre_service_briefing(p_briefing_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_briefing public.pre_service_briefings%rowtype; v_reason text:=nullif(trim(p_reason),''); v_old text;
begin
 select * into v_briefing from public.pre_service_briefings where id=p_briefing_id for update; if not found then raise exception 'Pre-service briefing not found' using errcode='P0002'; end if;
 perform public.assert_pre_service_briefing_access(v_briefing.restaurant_id,v_briefing.service_date,v_briefing.service_period_id);
 if v_briefing.status='closed' then raise exception 'Briefing is already closed' using errcode='22023'; end if;
 if v_reason is null or length(v_reason)>1000 then raise exception 'A close reason is required' using errcode='22023'; end if;
 v_old:=v_briefing.status; update public.pre_service_briefings set status='closed',closed_by=auth.uid(),closed_at=now(),close_reason=v_reason where id=v_briefing.id returning * into v_briefing;
 perform public.append_pre_service_briefing_event(v_briefing,'briefing_closed',v_old,'closed',null,jsonb_build_object('reason',v_reason)); return v_briefing.id;
end $$;
create or replace function public.list_pre_service_briefings(p_business_id uuid,p_restaurant_id uuid default null,p_service_date date default null,p_service_period_id uuid default null,p_status text default null)
returns table(briefing_id uuid,business_id uuid,restaurant_id uuid,restaurant_name text,service_date date,service_period_id uuid,service_period_name text,status text,created_by uuid,created_at timestamptz,prepared_by uuid,prepared_at timestamptz,pending_handoffs bigint,acknowledgements bigint,notes_count bigint,reviewed_items_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.business_memberships m where m.business_id=p_business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')) then raise exception 'Pre-service briefing access denied' using errcode='42501'; end if;
 if p_restaurant_id is not null and not exists(select 1 from public.restaurants r where r.id=p_restaurant_id and r.business_id=p_business_id) then raise exception 'Restaurant is outside Business scope' using errcode='42501'; end if;
 if p_service_period_id is not null and not exists(select 1 from public.business_service_periods p where p.id=p_service_period_id and p.business_id=p_business_id and (p_restaurant_id is null or p.restaurant_id=p_restaurant_id)) then raise exception 'Service period is outside scope' using errcode='42501'; end if;
 return query select b.id,b.business_id,b.restaurant_id,r.name::text,b.service_date,b.service_period_id,p.name::text,b.status,b.created_by,b.created_at,b.prepared_by,b.prepared_at,
  (select count(*) from public.pre_service_briefing_handoffs h where h.briefing_id=b.id and h.status='created' and not exists(select 1 from public.pre_service_briefing_handoffs ack where ack.parent_handoff_id=h.id and ack.status='acknowledged')),
  (select count(*) from public.pre_service_briefing_handoffs h where h.briefing_id=b.id and h.status='acknowledged'),
  (select count(*) from public.pre_service_briefing_notes n where n.briefing_id=b.id),
  (select count(*) from public.pre_service_briefing_reviewed_items i where i.briefing_id=b.id)
 from public.pre_service_briefings b join public.restaurants r on r.id=b.restaurant_id and r.business_id=b.business_id left join public.business_service_periods p on p.id=b.service_period_id
 where b.business_id=p_business_id and (p_restaurant_id is null or b.restaurant_id=p_restaurant_id) and (p_service_date is null or b.service_date=p_service_date) and (p_service_period_id is null or b.service_period_id=p_service_period_id) and (p_status is null or b.status=p_status)
 order by b.service_date desc,b.created_at desc,b.id desc;
end $$;

create or replace function public.get_pre_service_briefing(p_briefing_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_briefing public.pre_service_briefings%rowtype; v_live jsonb; v_notes jsonb; v_items jsonb; v_handoffs jsonb; v_events jsonb;
begin
 v_briefing:=public.assert_pre_service_briefing_row(p_briefing_id);
 v_live:=public.assemble_pre_service_briefing(v_briefing.restaurant_id,v_briefing.service_date,v_briefing.service_period_id);
 select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at,n.id),'[]'::jsonb) into v_notes from public.pre_service_briefing_notes n where n.briefing_id=v_briefing.id;
 select coalesce(jsonb_agg(to_jsonb(i) order by i.reviewed_at,i.id),'[]'::jsonb) into v_items from public.pre_service_briefing_reviewed_items i where i.briefing_id=v_briefing.id;
 select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at,h.id),'[]'::jsonb) into v_handoffs from public.pre_service_briefing_handoffs h where h.briefing_id=v_briefing.id;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]'::jsonb) into v_events from public.pre_service_briefing_events e where e.briefing_id=v_briefing.id;
 return jsonb_build_object('briefing',to_jsonb(v_briefing),'live_briefing',v_live,'prepared_snapshot',v_briefing.snapshot,'notes',v_notes,'reviewed_items',v_items,'handoffs',v_handoffs,'events',v_events);
end $$;

revoke all on function public.assemble_pre_service_briefing(uuid,date,uuid) from public,anon;
revoke all on function public.create_pre_service_briefing(uuid,date,uuid) from public,anon;
revoke all on function public.prepare_pre_service_briefing(uuid) from public,anon;
revoke all on function public.add_pre_service_briefing_note(uuid,text,uuid) from public,anon;
revoke all on function public.mark_pre_service_briefing_item_reviewed(uuid,text,text,uuid,text) from public,anon;
revoke all on function public.create_pre_service_briefing_handoff(uuid,text,uuid,text) from public,anon;
revoke all on function public.acknowledge_pre_service_briefing_handoff(uuid,text) from public,anon;
revoke all on function public.close_pre_service_briefing(uuid,text) from public,anon;
revoke all on function public.list_pre_service_briefings(uuid,uuid,date,uuid,text) from public,anon;
revoke all on function public.get_pre_service_briefing(uuid) from public,anon;
grant execute on function public.assemble_pre_service_briefing(uuid,date,uuid) to authenticated;
grant execute on function public.create_pre_service_briefing(uuid,date,uuid) to authenticated;
grant execute on function public.prepare_pre_service_briefing(uuid) to authenticated;
grant execute on function public.add_pre_service_briefing_note(uuid,text,uuid) to authenticated;
grant execute on function public.mark_pre_service_briefing_item_reviewed(uuid,text,text,uuid,text) to authenticated;
grant execute on function public.create_pre_service_briefing_handoff(uuid,text,uuid,text) to authenticated;
grant execute on function public.acknowledge_pre_service_briefing_handoff(uuid,text) to authenticated;
grant execute on function public.close_pre_service_briefing(uuid,text) to authenticated;
grant execute on function public.list_pre_service_briefings(uuid,uuid,date,uuid,text) to authenticated;
grant execute on function public.get_pre_service_briefing(uuid) to authenticated;
notify pgrst, 'reload schema';
