-- Block 46: Guest-Facing Confirmation View & Communication Preferences.
-- Raw tokens are returned once and never stored. Guest input is append-only and review-only.

create table public.reservation_confirmation_tokens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  token_hash text not null unique check (length(token_hash)=64),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text check (revocation_reason is null or length(trim(revocation_reason)) between 1 and 1000),
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count>=0),
  constraint reservation_confirmation_tokens_scope_fk foreign key (reservation_id,business_id,restaurant_id)
    references public.reservations(id,business_id,restaurant_id) on update restrict on delete restrict,
  constraint reservation_confirmation_tokens_restaurant_scope_fk foreign key (restaurant_id,business_id)
    references public.restaurants(id,business_id) on update restrict on delete restrict,
  constraint reservation_confirmation_tokens_revocation_check check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revoked_by is not null and revocation_reason is not null)
  )
);

create unique index reservation_confirmation_tokens_scope_uidx on public.reservation_confirmation_tokens(id,business_id,restaurant_id,reservation_id);

create table public.reservation_confirmation_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.reservation_confirmation_tokens(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  event_type text not null check (event_type in ('token_generated','token_regenerated','token_revoked','confirmation_viewed','preferences_submitted','guest_notes_submitted')),
  event_detail text check (event_detail is null or length(trim(event_detail)) between 1 and 2000),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint reservation_confirmation_events_token_scope_fk foreign key (token_id,business_id,restaurant_id,reservation_id)
    references public.reservation_confirmation_tokens(id,business_id,restaurant_id,reservation_id) on update restrict on delete restrict
);

create table public.reservation_guest_submissions (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.reservation_confirmation_tokens(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  submission_type text not null check (submission_type in ('communication_preferences','guest_notes')),
  preferred_channel text check (preferred_channel is null or preferred_channel in ('email','phone','whatsapp','sms')),
  preferred_language text check (preferred_language is null or preferred_language in ('pt','en')),
  can_contact_about_reservation boolean,
  allergies_dietary_note text check (allergies_dietary_note is null or length(trim(allergies_dietary_note)) between 1 and 2000),
  special_occasion_note text check (special_occasion_note is null or length(trim(special_occasion_note)) between 1 and 1000),
  arrival_accessibility_note text check (arrival_accessibility_note is null or length(trim(arrival_accessibility_note)) between 1 and 2000),
  general_note text check (general_note is null or length(trim(general_note)) between 1 and 2000),
  review_status text not null default 'pending_review' check (review_status in ('pending_review','reviewed')),
  created_at timestamptz not null default now(),
  constraint reservation_guest_submissions_token_scope_fk foreign key (token_id,business_id,restaurant_id,reservation_id)
    references public.reservation_confirmation_tokens(id,business_id,restaurant_id,reservation_id) on update restrict on delete restrict,
  constraint reservation_guest_submissions_payload_check check (
    (submission_type='communication_preferences' and preferred_channel is not null and preferred_language is not null
      and can_contact_about_reservation is not null and allergies_dietary_note is null and special_occasion_note is null
      and arrival_accessibility_note is null and general_note is null)
    or (submission_type='guest_notes' and preferred_channel is null and preferred_language is null
      and can_contact_about_reservation is null and (allergies_dietary_note is not null or special_occasion_note is not null
      or arrival_accessibility_note is not null or general_note is not null))
  )
);

create index reservation_confirmation_tokens_reservation_idx on public.reservation_confirmation_tokens(reservation_id,created_at desc);
create index reservation_confirmation_tokens_business_idx on public.reservation_confirmation_tokens(business_id);
create index reservation_confirmation_tokens_restaurant_idx on public.reservation_confirmation_tokens(restaurant_id);
create index reservation_confirmation_tokens_expiry_idx on public.reservation_confirmation_tokens(expires_at) where revoked_at is null;
create index reservation_confirmation_events_reservation_idx on public.reservation_confirmation_events(reservation_id,created_at desc,id desc);
create index reservation_guest_submissions_reservation_idx on public.reservation_guest_submissions(reservation_id,created_at desc,id desc);
create index reservation_guest_submissions_review_idx on public.reservation_guest_submissions(business_id,review_status,created_at desc);

create trigger reservation_confirmation_events_append_only before update or delete on public.reservation_confirmation_events
for each row execute function public.prevent_reservation_availability_history_mutation_v1();
create trigger reservation_guest_submissions_append_only before update or delete on public.reservation_guest_submissions
for each row execute function public.prevent_reservation_availability_history_mutation_v1();

alter table public.reservation_confirmation_tokens enable row level security;
alter table public.reservation_confirmation_events enable row level security;
alter table public.reservation_guest_submissions enable row level security;
revoke all on public.reservation_confirmation_tokens,reservation_confirmation_events,reservation_guest_submissions from anon,authenticated;
grant select on public.reservation_confirmation_tokens,reservation_confirmation_events,reservation_guest_submissions to authenticated;
create policy "Authorized staff can read confirmation tokens" on public.reservation_confirmation_tokens for select to authenticated
using (exists(select 1 from public.business_memberships m where m.business_id=reservation_confirmation_tokens.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));
create policy "Authorized staff can read confirmation events" on public.reservation_confirmation_events for select to authenticated
using (exists(select 1 from public.business_memberships m where m.business_id=reservation_confirmation_events.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));
create policy "Authorized staff can read guest submissions" on public.reservation_guest_submissions for select to authenticated
using (exists(select 1 from public.business_memberships m where m.business_id=reservation_guest_submissions.business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff')));

create or replace function public.confirmation_token_digest(p_token text) returns text language sql immutable security definer set search_path='' as $$
 select encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
$$;
revoke all on function public.confirmation_token_digest(text) from public,anon,authenticated;

create or replace function public.generate_reservation_confirmation_token(p_reservation_id uuid)
returns table(token text,expires_at timestamptz) language plpgsql security definer set search_path='' as $$
declare v_reservation public.reservations%rowtype;v_token text;v_row public.reservation_confirmation_tokens%rowtype;v_regenerated boolean;
begin
 v_reservation:=public.assert_reservation_communication_access(p_reservation_id);
 if v_reservation.status<>'accepted' then raise exception 'Only accepted reservations can have confirmation links' using errcode='22023'; end if;
 v_regenerated:=exists(select 1 from public.reservation_confirmation_tokens where reservation_id=p_reservation_id);
 update public.reservation_confirmation_tokens set revoked_at=now(),revoked_by=auth.uid(),revocation_reason='Superseded by regenerated confirmation link'
 where reservation_id=p_reservation_id and revoked_at is null;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.reservation_confirmation_tokens(business_id,restaurant_id,reservation_id,token_hash,created_by,expires_at)
 values(v_reservation.business_id,v_reservation.restaurant_id,v_reservation.id,public.confirmation_token_digest(v_token),auth.uid(),
   greatest(now()+interval '7 days',coalesce(v_reservation.requested_date::timestamptz+interval '2 days',now()+interval '30 days')))
 returning * into v_row;
 insert into public.reservation_confirmation_events(token_id,reservation_id,business_id,restaurant_id,event_type,event_detail,created_by)
 values(v_row.id,v_row.reservation_id,v_row.business_id,v_row.restaurant_id,case when v_regenerated then 'token_regenerated' else 'token_generated' end,
   'Guest confirmation access created; raw token not stored.',auth.uid());
 insert into public.reservation_timeline_events(canonical_reservation_id,event_type,event_label,event_description,created_by)
 values(v_row.reservation_id,'guest_confirmation_access',case when v_regenerated then 'Confirmation Link Regenerated' else 'Confirmation Link Generated' end,
   'Guest-safe confirmation access created. No communication was sent.',auth.uid());
 return query select v_token,v_row.expires_at;
end $$;

create or replace function public.revoke_reservation_confirmation_token(p_token_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_row public.reservation_confirmation_tokens%rowtype;v_reason text:=nullif(trim(p_reason),'');
begin
 select * into v_row from public.reservation_confirmation_tokens where id=p_token_id for update;
 if not found then raise exception 'Confirmation token not found' using errcode='P0002'; end if;
 perform public.assert_reservation_communication_access(v_row.reservation_id);
 if v_row.revoked_at is not null then raise exception 'Confirmation token is already revoked' using errcode='22023'; end if;
 if v_reason is null or length(v_reason)>1000 then raise exception 'A valid revocation reason is required' using errcode='22023'; end if;
 update public.reservation_confirmation_tokens set revoked_at=now(),revoked_by=auth.uid(),revocation_reason=v_reason where id=v_row.id returning * into v_row;
 insert into public.reservation_confirmation_events(token_id,reservation_id,business_id,restaurant_id,event_type,event_detail,created_by)
 values(v_row.id,v_row.reservation_id,v_row.business_id,v_row.restaurant_id,'token_revoked',v_reason,auth.uid());
 insert into public.reservation_timeline_events(canonical_reservation_id,event_type,event_label,event_description,created_by)
 values(v_row.reservation_id,'guest_confirmation_access','Confirmation Link Revoked','Reason: '||v_reason,auth.uid());
 return v_row.id;
end $$;

create or replace function public.resolve_guest_confirmation(p_token text)
returns table(restaurant_name text,reservation_date date,reservation_time time,party_size integer,guest_display_name text,
confirmation_status text,restaurant_phone text,restaurant_email text,change_instructions text)
language plpgsql security definer set search_path='' as $$
declare v_token public.reservation_confirmation_tokens%rowtype;
begin
 if p_token is null or length(p_token)<>64 then return; end if;
 select t.* into v_token from public.reservation_confirmation_tokens t join public.reservations r on r.id=t.reservation_id
 where t.token_hash=public.confirmation_token_digest(p_token) and t.revoked_at is null and t.expires_at>now() and r.status='accepted' for update of t;
 if not found then return; end if;
 update public.reservation_confirmation_tokens set last_viewed_at=now(),view_count=view_count+1 where id=v_token.id;
 insert into public.reservation_confirmation_events(token_id,reservation_id,business_id,restaurant_id,event_type,event_detail)
 values(v_token.id,v_token.reservation_id,v_token.business_id,v_token.restaurant_id,'confirmation_viewed','Guest confirmation page resolved.');
 return query select restaurant.name::text,reservation.requested_date,reservation.requested_time,reservation.party_size,
   reservation.guest_name,'confirmed'::text,null::text,null::text,
   'Please contact the restaurant directly for urgent changes. Updates submitted here are reviewed by the restaurant team.'::text
 from public.reservations reservation join public.restaurants restaurant on restaurant.id=reservation.restaurant_id
 where reservation.id=v_token.reservation_id;
end $$;

create or replace function public.submit_guest_communication_preferences(p_token text,p_preferred_channel text,p_preferred_language text,p_can_contact boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_token public.reservation_confirmation_tokens%rowtype;v_id uuid;
begin
 select t.* into v_token from public.reservation_confirmation_tokens t join public.reservations r on r.id=t.reservation_id
 where t.token_hash=public.confirmation_token_digest(p_token) and t.revoked_at is null and t.expires_at>now() and r.status='accepted';
 if not found then raise exception 'Invalid or inactive confirmation token' using errcode='22023'; end if;
 if p_preferred_channel not in ('email','phone','whatsapp','sms') or p_preferred_language not in ('pt','en') or p_can_contact is null
 then raise exception 'Invalid communication preferences' using errcode='22023'; end if;
 insert into public.reservation_guest_submissions(token_id,reservation_id,business_id,restaurant_id,submission_type,preferred_channel,preferred_language,can_contact_about_reservation)
 values(v_token.id,v_token.reservation_id,v_token.business_id,v_token.restaurant_id,'communication_preferences',p_preferred_channel,p_preferred_language,p_can_contact) returning id into v_id;
 insert into public.reservation_confirmation_events(token_id,reservation_id,business_id,restaurant_id,event_type,event_detail)
 values(v_token.id,v_token.reservation_id,v_token.business_id,v_token.restaurant_id,'preferences_submitted','Guest submitted communication preferences for staff review.');
 insert into public.reservation_timeline_events(canonical_reservation_id,event_type,event_label,event_description)
 values(v_token.reservation_id,'guest_confirmation_submission','Guest Communication Preferences Received',format('Preferred channel: %s; language: %s; contact permission: %s',p_preferred_channel,p_preferred_language,p_can_contact));
 return v_id;
end $$;

create or replace function public.submit_guest_reservation_notes(p_token text,p_allergies_dietary_note text default null,p_special_occasion_note text default null,
 p_arrival_accessibility_note text default null,p_general_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_token public.reservation_confirmation_tokens%rowtype;v_id uuid;v_allergies text:=nullif(trim(p_allergies_dietary_note),'');
 v_occasion text:=nullif(trim(p_special_occasion_note),'');v_arrival text:=nullif(trim(p_arrival_accessibility_note),'');v_general text:=nullif(trim(p_general_note),'');
begin
 select t.* into v_token from public.reservation_confirmation_tokens t join public.reservations r on r.id=t.reservation_id
 where t.token_hash=public.confirmation_token_digest(p_token) and t.revoked_at is null and t.expires_at>now() and r.status='accepted';
 if not found then raise exception 'Invalid or inactive confirmation token' using errcode='22023'; end if;
 if v_allergies is null and v_occasion is null and v_arrival is null and v_general is null then raise exception 'At least one guest note is required' using errcode='22023'; end if;
 if length(coalesce(v_allergies,''))>2000 or length(coalesce(v_occasion,''))>1000 or length(coalesce(v_arrival,''))>2000 or length(coalesce(v_general,''))>2000
 then raise exception 'Guest note is too long' using errcode='22023'; end if;
 insert into public.reservation_guest_submissions(token_id,reservation_id,business_id,restaurant_id,submission_type,allergies_dietary_note,special_occasion_note,arrival_accessibility_note,general_note)
 values(v_token.id,v_token.reservation_id,v_token.business_id,v_token.restaurant_id,'guest_notes',v_allergies,v_occasion,v_arrival,v_general) returning id into v_id;
 insert into public.reservation_confirmation_events(token_id,reservation_id,business_id,restaurant_id,event_type,event_detail)
 values(v_token.id,v_token.reservation_id,v_token.business_id,v_token.restaurant_id,'guest_notes_submitted','Guest submitted reservation notes for staff review.');
 insert into public.reservation_timeline_events(canonical_reservation_id,event_type,event_label,event_description)
 values(v_token.reservation_id,'guest_confirmation_submission','Guest Update Received','Guest-provided notes are pending staff review.');
 return v_id;
end $$;

revoke all on function public.generate_reservation_confirmation_token(uuid) from public,anon;
revoke all on function public.revoke_reservation_confirmation_token(uuid,text) from public,anon;
grant execute on function public.generate_reservation_confirmation_token(uuid) to authenticated;
grant execute on function public.revoke_reservation_confirmation_token(uuid,text) to authenticated;
revoke all on function public.resolve_guest_confirmation(text) from public;
revoke all on function public.submit_guest_communication_preferences(text,text,text,boolean) from public;
revoke all on function public.submit_guest_reservation_notes(text,text,text,text,text) from public;
grant execute on function public.resolve_guest_confirmation(text) to anon,authenticated;
grant execute on function public.submit_guest_communication_preferences(text,text,text,boolean) to anon,authenticated;
grant execute on function public.submit_guest_reservation_notes(text,text,text,text,text) to anon,authenticated;
