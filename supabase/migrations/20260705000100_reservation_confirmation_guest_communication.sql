-- Block 45: Reservation Confirmation & Guest Communication Foundation.
-- Communications are prepared and recorded by humans. This migration dispatches nothing.

create table public.reservation_communications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  guest_name text,
  guest_email text,
  guest_phone text,
  channel text not null check (channel in ('email','phone','whatsapp','sms','manual')),
  communication_type text not null check (communication_type in ('confirmation','update','cancellation_notice','reminder_draft','internal_note')),
  status text not null default 'draft' check (status in ('draft','ready','marked_sent','failed','cancelled')),
  subject text check (subject is null or length(trim(subject)) between 1 and 300),
  body text not null check (length(trim(body)) between 1 and 10000),
  language text not null default 'en' check (language in ('en','pt')),
  note text check (note is null or length(trim(note)) between 1 and 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  marked_sent_by uuid references auth.users(id) on delete restrict,
  marked_sent_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  constraint reservation_communications_reservation_scope_fk
    foreign key (reservation_id,business_id,restaurant_id)
    references public.reservations(id,business_id,restaurant_id) on update restrict on delete restrict,
  constraint reservation_communications_restaurant_scope_fk
    foreign key (restaurant_id,business_id)
    references public.restaurants(id,business_id) on update restrict on delete restrict,
  constraint reservation_communications_sent_metadata_check check (
    (status='marked_sent' and marked_sent_by is not null and marked_sent_at is not null)
    or (status<>'marked_sent' and marked_sent_by is null and marked_sent_at is null)
  ),
  constraint reservation_communications_cancelled_metadata_check check (
    (status='cancelled' and cancelled_by is not null and cancelled_at is not null and note is not null)
    or (status<>'cancelled' and cancelled_by is null and cancelled_at is null)
  )
);

create unique index reservation_communications_scope_uidx on public.reservation_communications(id,business_id,restaurant_id,reservation_id);

create table public.reservation_communication_events (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.reservation_communications(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null,
  event_type text not null check (event_type in ('draft_created','draft_updated','marked_ready','marked_sent','cancelled')),
  old_status text check (old_status is null or old_status in ('draft','ready','marked_sent','failed','cancelled')),
  new_status text not null check (new_status in ('draft','ready','marked_sent','failed','cancelled')),
  reason text check (reason is null or length(trim(reason)) between 1 and 2000),
  subject text,
  body text not null,
  channel text not null,
  communication_type text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint reservation_communication_events_communication_scope_fk
    foreign key (communication_id,business_id,restaurant_id,reservation_id)
    references public.reservation_communications(id,business_id,restaurant_id,reservation_id)
    on update restrict on delete restrict
);

create index reservation_communications_business_idx on public.reservation_communications(business_id);
create index reservation_communications_restaurant_idx on public.reservation_communications(restaurant_id);
create index reservation_communications_reservation_idx on public.reservation_communications(reservation_id,created_at desc);
create index reservation_communications_status_idx on public.reservation_communications(status);
create index reservation_communications_type_idx on public.reservation_communications(communication_type);
create index reservation_communications_created_idx on public.reservation_communications(created_at desc);
create index reservation_communication_events_reservation_idx on public.reservation_communication_events(reservation_id,created_at desc,id desc);
create index reservation_communication_events_communication_idx on public.reservation_communication_events(communication_id,created_at,id);

create trigger reservation_communication_events_append_only before update or delete
on public.reservation_communication_events for each row
execute function public.prevent_reservation_availability_history_mutation_v1();

alter table public.reservation_communications enable row level security;
alter table public.reservation_communication_events enable row level security;
revoke all on public.reservation_communications from anon,authenticated;
revoke all on public.reservation_communication_events from anon,authenticated;
grant select on public.reservation_communications,reservation_communication_events to authenticated;

create policy "Authorized staff can read reservation communications" on public.reservation_communications
for select to authenticated using (exists (
  select 1 from public.business_memberships membership where membership.business_id=reservation_communications.business_id
  and membership.user_id=auth.uid() and membership.role in ('owner','manager','staff')
));
create policy "Authorized staff can read reservation communication events" on public.reservation_communication_events
for select to authenticated using (exists (
  select 1 from public.business_memberships membership where membership.business_id=reservation_communication_events.business_id
  and membership.user_id=auth.uid() and membership.role in ('owner','manager','staff')
));

create or replace function public.assert_reservation_communication_access(p_reservation_id uuid)
returns public.reservations language plpgsql stable security definer set search_path='' as $$
declare v_reservation public.reservations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_reservation from public.reservations where id=p_reservation_id;
  if not found then raise exception 'Reservation not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.business_memberships membership
    where membership.business_id=v_reservation.business_id and membership.user_id=auth.uid()
    and membership.role in ('owner','manager','staff')) then
    raise exception 'Reservation communication access denied' using errcode='42501';
  end if;
  return v_reservation;
end $$;
revoke all on function public.assert_reservation_communication_access(uuid) from public,anon,authenticated;

create or replace function public.append_reservation_communication_event(
  p_communication public.reservation_communications,p_event_type text,p_old_status text,p_reason text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_event_id uuid;v_label text;
begin
  insert into public.reservation_communication_events(
    communication_id,reservation_id,business_id,restaurant_id,event_type,old_status,new_status,reason,
    subject,body,channel,communication_type,created_by
  ) values (p_communication.id,p_communication.reservation_id,p_communication.business_id,p_communication.restaurant_id,
    p_event_type,p_old_status,p_communication.status,p_reason,p_communication.subject,p_communication.body,
    p_communication.channel,p_communication.communication_type,auth.uid()) returning id into v_event_id;
  v_label:=case p_event_type when 'draft_created' then 'Confirmation Draft Created'
    when 'draft_updated' then 'Confirmation Draft Updated' when 'marked_ready' then 'Confirmation Marked Ready'
    when 'marked_sent' then 'Confirmation Marked Sent' else 'Communication Cancelled' end;
  insert into public.reservation_timeline_events(canonical_reservation_id,event_type,event_label,event_description,created_by)
  values(p_communication.reservation_id,'reservation_communication',v_label,
    concat_ws(E'\n','Channel: '||p_communication.channel,case when p_reason is not null then 'Reason: '||p_reason end),auth.uid());
  return v_event_id;
end $$;
revoke all on function public.append_reservation_communication_event(public.reservation_communications,text,text,text) from public,anon,authenticated;

create or replace function public.create_reservation_confirmation_draft(
  p_reservation_id uuid,p_channel text default 'email',p_language text default 'en'
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_reservation public.reservations%rowtype;v_restaurant_name text;v_id uuid;v_body text;v_subject text;v_row public.reservation_communications%rowtype;
begin
  v_reservation:=public.assert_reservation_communication_access(p_reservation_id);
  if v_reservation.status<>'accepted' then raise exception 'Only accepted reservations can have confirmation drafts' using errcode='22023'; end if;
  if p_channel not in ('email','phone','whatsapp','sms','manual') then raise exception 'Invalid communication channel' using errcode='22023'; end if;
  if p_language not in ('en','pt') then raise exception 'Unsupported communication language' using errcode='22023'; end if;
  select name into v_restaurant_name from public.restaurants where id=v_reservation.restaurant_id and business_id=v_reservation.business_id;
  if p_language='pt' then
    v_subject:='Confirmação da sua reserva — '||v_restaurant_name;
    v_body:=format(E'Caro/a %s,\n\nTemos o prazer de confirmar a sua reserva no %s para %s às %s, para %s pessoas.\n\nCaso exista alguma alergia, restrição alimentar ou nota especial que devamos considerar, agradecemos que nos informe antes da sua visita.\n\nTeremos todo o gosto em recebê-lo/a.',
      v_reservation.guest_name,v_restaurant_name,coalesce(to_char(v_reservation.requested_date,'DD/MM/YYYY'),'data a confirmar'),
      coalesce(to_char(v_reservation.requested_time,'HH24:MI'),'hora a confirmar'),coalesce(v_reservation.party_size::text,'um número de'));
  else
    v_subject:='Your reservation confirmation — '||v_restaurant_name;
    v_body:=format(E'Dear %s,\n\nWe are pleased to confirm your reservation at %s for %s at %s for %s guests.\n\nIf there are any allergies, dietary restrictions or special notes we should be aware of, please let us know before your visit.\n\nWe look forward to welcoming you.',
      v_reservation.guest_name,v_restaurant_name,coalesce(to_char(v_reservation.requested_date,'DD Mon YYYY'),'a date to be confirmed'),
      coalesce(to_char(v_reservation.requested_time,'HH24:MI'),'a time to be confirmed'),coalesce(v_reservation.party_size::text,'the confirmed'));
  end if;
  insert into public.reservation_communications(business_id,restaurant_id,reservation_id,guest_name,guest_email,guest_phone,
    channel,communication_type,status,subject,body,language,created_by)
  values(v_reservation.business_id,v_reservation.restaurant_id,v_reservation.id,v_reservation.guest_name,v_reservation.guest_email,
    v_reservation.guest_phone,p_channel,'confirmation','draft',v_subject,v_body,p_language,auth.uid()) returning * into v_row;
  perform public.append_reservation_communication_event(v_row,'draft_created',null,null);
  return v_row.id;
end $$;

create or replace function public.update_reservation_communication_draft(
  p_communication_id uuid,p_subject text,p_body text,p_channel text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_row public.reservation_communications%rowtype;v_old text;
begin
  select * into v_row from public.reservation_communications where id=p_communication_id for update;
  if not found then raise exception 'Communication not found' using errcode='P0002'; end if;
  perform public.assert_reservation_communication_access(v_row.reservation_id);
  if v_row.status not in ('draft','ready') then raise exception 'Only draft or ready communications can be edited' using errcode='22023'; end if;
  if nullif(trim(p_body),'') is null or length(trim(p_body))>10000 or length(coalesce(trim(p_subject),''))>300 then raise exception 'Invalid communication content' using errcode='22023'; end if;
  if p_channel not in ('email','phone','whatsapp','sms','manual') then raise exception 'Invalid communication channel' using errcode='22023'; end if;
  v_old:=v_row.status;
  update public.reservation_communications set subject=nullif(trim(p_subject),''),body=trim(p_body),channel=p_channel,
    status='draft',updated_at=now() where id=p_communication_id returning * into v_row;
  perform public.append_reservation_communication_event(v_row,'draft_updated',v_old,null);
  return v_row.id;
end $$;

create or replace function public.mark_reservation_communication_ready(p_communication_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_row public.reservation_communications%rowtype;
begin
  select * into v_row from public.reservation_communications where id=p_communication_id for update;
  if not found then raise exception 'Communication not found' using errcode='P0002'; end if;
  perform public.assert_reservation_communication_access(v_row.reservation_id);
  if v_row.status<>'draft' then raise exception 'Only drafts can be marked ready' using errcode='22023'; end if;
  update public.reservation_communications set status='ready',updated_at=now() where id=p_communication_id returning * into v_row;
  perform public.append_reservation_communication_event(v_row,'marked_ready','draft',null);return v_row.id;
end $$;

create or replace function public.mark_reservation_communication_sent(p_communication_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_row public.reservation_communications%rowtype;v_old text;
begin
  select * into v_row from public.reservation_communications where id=p_communication_id for update;
  if not found then raise exception 'Communication not found' using errcode='P0002'; end if;
  perform public.assert_reservation_communication_access(v_row.reservation_id);
  if v_row.status not in ('draft','ready') then raise exception 'Only draft or ready communications can be marked sent' using errcode='22023'; end if;
  v_old:=v_row.status;
  update public.reservation_communications set status='marked_sent',marked_sent_by=auth.uid(),marked_sent_at=now(),updated_at=now()
    where id=p_communication_id returning * into v_row;
  perform public.append_reservation_communication_event(v_row,'marked_sent',v_old,null);return v_row.id;
end $$;

create or replace function public.cancel_reservation_communication(p_communication_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_row public.reservation_communications%rowtype;v_old text;v_reason text:=nullif(trim(p_reason),'');
begin
  select * into v_row from public.reservation_communications where id=p_communication_id for update;
  if not found then raise exception 'Communication not found' using errcode='P0002'; end if;
  perform public.assert_reservation_communication_access(v_row.reservation_id);
  if v_row.status in ('marked_sent','cancelled') then raise exception 'Sent or cancelled communications cannot be cancelled' using errcode='22023'; end if;
  if v_reason is null or length(v_reason)>2000 then raise exception 'A valid cancellation reason is required' using errcode='22023'; end if;
  v_old:=v_row.status;
  update public.reservation_communications set status='cancelled',note=v_reason,cancelled_by=auth.uid(),cancelled_at=now(),updated_at=now()
    where id=p_communication_id returning * into v_row;
  perform public.append_reservation_communication_event(v_row,'cancelled',v_old,v_reason);return v_row.id;
end $$;

create or replace function public.list_reservation_communications(p_reservation_id uuid)
returns setof public.reservation_communications language plpgsql stable security definer set search_path='' as $$
begin perform public.assert_reservation_communication_access(p_reservation_id);
return query select * from public.reservation_communications where reservation_id=p_reservation_id order by created_at desc,id desc;end $$;

create or replace function public.list_reservation_communication_queue(
  p_business_id uuid,p_restaurant_id uuid default null,p_status text default null,p_type text default null,p_channel text default null
) returns table(communication_id uuid,reservation_id uuid,business_id uuid,restaurant_id uuid,restaurant_name text,guest_name text,
guest_email text,guest_phone text,requested_date date,requested_time time,party_size integer,communication_type text,channel text,status text,last_activity timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.business_memberships m where m.business_id=p_business_id and m.user_id=auth.uid() and m.role in ('owner','manager','staff'))
 then raise exception 'Communication queue access denied' using errcode='42501'; end if;
 if p_restaurant_id is not null and not exists(select 1 from public.restaurants r where r.id=p_restaurant_id and r.business_id=p_business_id)
 then raise exception 'Restaurant is outside Business scope' using errcode='42501'; end if;
 return query select c.id,c.reservation_id,c.business_id,c.restaurant_id,r.name::text,c.guest_name,c.guest_email,c.guest_phone,
   reservation.requested_date,reservation.requested_time,reservation.party_size,c.communication_type,c.channel,c.status,c.updated_at
 from public.reservation_communications c join public.reservations reservation on reservation.id=c.reservation_id
 join public.restaurants r on r.id=c.restaurant_id and r.business_id=c.business_id
 where c.business_id=p_business_id and (p_restaurant_id is null or c.restaurant_id=p_restaurant_id)
 and (p_status is null or c.status=p_status) and (p_type is null or c.communication_type=p_type) and (p_channel is null or c.channel=p_channel)
 order by c.updated_at desc,c.id desc;
end $$;

revoke all on function public.create_reservation_confirmation_draft(uuid,text,text) from public,anon;
revoke all on function public.update_reservation_communication_draft(uuid,text,text,text) from public,anon;
revoke all on function public.mark_reservation_communication_ready(uuid) from public,anon;
revoke all on function public.mark_reservation_communication_sent(uuid) from public,anon;
revoke all on function public.cancel_reservation_communication(uuid,text) from public,anon;
revoke all on function public.list_reservation_communications(uuid) from public,anon;
revoke all on function public.list_reservation_communication_queue(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.create_reservation_confirmation_draft(uuid,text,text) to authenticated;
grant execute on function public.update_reservation_communication_draft(uuid,text,text,text) to authenticated;
grant execute on function public.mark_reservation_communication_ready(uuid) to authenticated;
grant execute on function public.mark_reservation_communication_sent(uuid) to authenticated;
grant execute on function public.cancel_reservation_communication(uuid,text) to authenticated;
grant execute on function public.list_reservation_communications(uuid) to authenticated;
grant execute on function public.list_reservation_communication_queue(uuid,uuid,text,text,text) to authenticated;
