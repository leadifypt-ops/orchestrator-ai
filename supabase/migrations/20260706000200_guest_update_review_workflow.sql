-- Block 47: Guest Update Review & Pre-Service Communication Workflow.
-- Original Block 46 submissions remain immutable. One append-only staff decision may reference each submission.

create unique index if not exists reservation_guest_submissions_scope_uidx
  on public.reservation_guest_submissions(id,business_id,restaurant_id,reservation_id);

create table public.reservation_guest_submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.reservation_guest_submissions(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  review_status text not null check (review_status in ('accepted','dismissed','converted_to_internal_note','converted_to_communication_task')),
  review_reason text check (review_reason is null or length(trim(review_reason)) between 1 and 2000),
  linked_internal_note_id uuid references public.reservation_internal_notes(id) on delete restrict,
  linked_communication_id uuid references public.reservation_communications(id) on delete restrict,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  constraint reservation_guest_submission_reviews_submission_scope_fk
    foreign key (submission_id,business_id,restaurant_id,reservation_id)
    references public.reservation_guest_submissions(id,business_id,restaurant_id,reservation_id) on update restrict on delete restrict,
  constraint reservation_guest_submission_reviews_restaurant_scope_fk
    foreign key (restaurant_id,business_id) references public.restaurants(id,business_id) on update restrict on delete restrict,
  constraint reservation_guest_submission_reviews_link_check check (
    (review_status='converted_to_internal_note' and linked_internal_note_id is not null and linked_communication_id is null)
    or (review_status='converted_to_communication_task' and linked_communication_id is not null and linked_internal_note_id is null)
    or (review_status in ('accepted','dismissed') and linked_internal_note_id is null and linked_communication_id is null)
  ),
  constraint reservation_guest_submission_reviews_reason_check check (review_status<>'dismissed' or review_reason is not null)
);

create index reservation_guest_submission_reviews_scope_idx on public.reservation_guest_submission_reviews(business_id,restaurant_id,reviewed_at desc);
create index reservation_guest_submission_reviews_reservation_idx on public.reservation_guest_submission_reviews(reservation_id,reviewed_at desc);
create trigger reservation_guest_submission_reviews_append_only before update or delete on public.reservation_guest_submission_reviews
for each row execute function public.prevent_reservation_availability_history_mutation_v1();

alter table public.reservation_guest_submission_reviews enable row level security;
revoke all on public.reservation_guest_submission_reviews from anon,authenticated;
grant select on public.reservation_guest_submission_reviews to authenticated;
create policy "Authorized staff can read guest update reviews" on public.reservation_guest_submission_reviews
for select to authenticated using (exists(select 1 from public.business_memberships m
 where m.business_id=reservation_guest_submission_reviews.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));

create or replace function public.guest_submission_summary(p_submission public.reservation_guest_submissions)
returns text language sql immutable security definer set search_path='' as $$
 select case when p_submission.submission_type='communication_preferences' then
   format('Preferred channel: %s; language: %s; contact permitted: %s',p_submission.preferred_channel,p_submission.preferred_language,p_submission.can_contact_about_reservation)
 else concat_ws(E'\n',
   case when p_submission.allergies_dietary_note is not null then 'Allergies / dietary: '||p_submission.allergies_dietary_note end,
   case when p_submission.special_occasion_note is not null then 'Special occasion: '||p_submission.special_occasion_note end,
   case when p_submission.arrival_accessibility_note is not null then 'Arrival / accessibility: '||p_submission.arrival_accessibility_note end,
   case when p_submission.general_note is not null then 'General: '||p_submission.general_note end)
 end
$$;
revoke all on function public.guest_submission_summary(public.reservation_guest_submissions) from public,anon,authenticated;

create or replace function public.list_guest_update_reviews(
 p_business_id uuid,p_restaurant_id uuid default null,p_service_date date default null,p_status text default null,p_update_type text default null
) returns table(submission_id uuid,reservation_id uuid,business_id uuid,restaurant_id uuid,restaurant_name text,guest_name text,guest_email text,
 guest_phone text,reservation_date date,reservation_time time,party_size integer,update_type text,preview text,submitted_at timestamptz,
 review_status text,review_reason text,reviewed_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.business_memberships m where m.business_id=p_business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff'))
 then raise exception 'Guest update review access denied' using errcode='42501'; end if;
 if p_restaurant_id is not null and not exists(select 1 from public.restaurants r where r.id=p_restaurant_id and r.business_id=p_business_id)
 then raise exception 'Restaurant is outside Business scope' using errcode='42501'; end if;
 return query select s.id,s.reservation_id,s.business_id,s.restaurant_id,restaurant.name::text,reservation.guest_name,reservation.guest_email,
  reservation.guest_phone,reservation.requested_date,reservation.requested_time,reservation.party_size,s.submission_type,
  left(public.guest_submission_summary(s),240),s.created_at,coalesce(review.review_status,'pending_review'),review.review_reason,review.reviewed_at
 from public.reservation_guest_submissions s join public.reservations reservation on reservation.id=s.reservation_id
 join public.restaurants restaurant on restaurant.id=s.restaurant_id and restaurant.business_id=s.business_id
 left join public.reservation_guest_submission_reviews review on review.submission_id=s.id
 where s.business_id=p_business_id and (p_restaurant_id is null or s.restaurant_id=p_restaurant_id)
  and (p_service_date is null or reservation.requested_date=p_service_date)
  and (p_status is null or coalesce(review.review_status,'pending_review')=p_status)
  and (p_update_type is null or s.submission_type=p_update_type)
 order by case when review.id is null then 0 else 1 end,s.created_at,s.id;
end $$;

create or replace function public.review_guest_submission(p_submission_id uuid,p_action text,p_reason text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_submission public.reservation_guest_submissions%rowtype;v_reservation public.reservations%rowtype;
 v_reason text:=nullif(trim(p_reason),'');v_review_id uuid;v_note_id uuid;v_communication public.reservation_communications%rowtype;
 v_summary text;v_label text;
begin
 select * into v_submission from public.reservation_guest_submissions where id=p_submission_id;
 if not found then raise exception 'Guest submission not found' using errcode='P0002'; end if;
 v_reservation:=public.assert_reservation_communication_access(v_submission.reservation_id);
 if exists(select 1 from public.reservation_guest_submission_reviews where submission_id=p_submission_id) then
  raise exception 'Guest submission has already been reviewed' using errcode='22023'; end if;
 if p_action not in ('accepted','dismissed','converted_to_internal_note','converted_to_communication_task') then
  raise exception 'Invalid guest update review action' using errcode='22023'; end if;
 if p_action='dismissed' and v_reason is null then raise exception 'A dismissal reason is required' using errcode='22023'; end if;
 if length(coalesce(v_reason,''))>2000 then raise exception 'Review note is too long' using errcode='22023'; end if;
 v_summary:=public.guest_submission_summary(v_submission);

 if p_action='converted_to_internal_note' then
  insert into public.reservation_internal_notes(canonical_reservation_id,note,created_by)
  values(v_submission.reservation_id,concat_ws(E'\n','Guest-provided update (staff reviewed):',v_summary,case when v_reason is not null then 'Staff note: '||v_reason end),auth.uid())
  returning id into v_note_id;
 elsif p_action='converted_to_communication_task' then
  insert into public.reservation_communications(business_id,restaurant_id,reservation_id,guest_name,guest_email,guest_phone,channel,
   communication_type,status,subject,body,language,note,created_by)
  values(v_submission.business_id,v_submission.restaurant_id,v_submission.reservation_id,v_reservation.guest_name,v_reservation.guest_email,
   v_reservation.guest_phone,'manual','update','draft','Guest update follow-up',v_summary,'en',v_reason,auth.uid()) returning * into v_communication;
  perform public.append_reservation_communication_event(v_communication,'draft_created',null,'Created from staff-reviewed guest update');
 end if;

 insert into public.reservation_guest_submission_reviews(submission_id,reservation_id,business_id,restaurant_id,review_status,review_reason,
  linked_internal_note_id,linked_communication_id,reviewed_by)
 values(v_submission.id,v_submission.reservation_id,v_submission.business_id,v_submission.restaurant_id,p_action,v_reason,v_note_id,v_communication.id,auth.uid())
 returning id into v_review_id;
 v_label:=case p_action when 'accepted' then 'Guest Update Accepted For Operational Context' when 'dismissed' then 'Guest Update Dismissed'
  when 'converted_to_internal_note' then 'Guest Update Converted To Internal Note' else 'Guest Update Converted To Communication Draft' end;
 insert into public.reservation_timeline_events(canonical_reservation_id,event_type,event_label,event_description,created_by)
 values(v_submission.reservation_id,'guest_update_review',v_label,concat_ws(E'\n','Update: '||v_submission.id::text,
  case when v_reason is not null then 'Review note: '||v_reason end),auth.uid());
 return v_review_id;
end $$;

revoke all on function public.list_guest_update_reviews(uuid,uuid,date,text,text) from public,anon;
revoke all on function public.review_guest_submission(uuid,text,text) from public,anon;
grant execute on function public.list_guest_update_reviews(uuid,uuid,date,text,text) to authenticated;
grant execute on function public.review_guest_submission(uuid,text,text) to authenticated;
