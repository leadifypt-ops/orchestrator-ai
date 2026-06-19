-- Canonical Reservation Schema V1.
-- Business Reservations continues to use legacy leads until a dedicated
-- migration block switches reads and writes.

create unique index if not exists restaurants_id_business_id_uidx
  on public.restaurants (id, business_id);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  guest_name text not null check (length(trim(guest_name)) > 0),
  guest_email text,
  guest_phone text,
  requested_date date,
  requested_time time without time zone,
  party_size integer check (party_size is null or party_size > 0),
  status text not null default 'pending'
    check (status in (
      'pending',
      'reviewing',
      'confirmed',
      'declined',
      'cancelled',
      'completed'
    )),
  occasion text,
  special_request text,
  source text not null default 'manual'
    check (source in ('manual', 'public_request', 'imported_legacy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_restaurant_business_fk
    foreign key (restaurant_id, business_id)
    references public.restaurants (id, business_id)
    on update restrict
    on delete restrict
);

create index if not exists reservations_business_created_at_idx
  on public.reservations (business_id, created_at desc);

create index if not exists reservations_restaurant_requested_date_idx
  on public.reservations (restaurant_id, requested_date);

create index if not exists reservations_business_status_idx
  on public.reservations (business_id, status);

create or replace function public.set_reservation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_reservation_updated_at();

alter table public.reservations enable row level security;

revoke all on public.reservations from anon, authenticated;
grant select, insert on public.reservations to authenticated;
grant update (
  guest_name,
  guest_email,
  guest_phone,
  requested_date,
  requested_time,
  party_size,
  status,
  occasion,
  special_request
) on public.reservations to authenticated;

drop policy if exists "Members can read reservations" on public.reservations;
create policy "Members can read reservations"
  on public.reservations
  for select
  to authenticated
  using (public.is_business_member(business_id));

drop policy if exists "Members can create reservations" on public.reservations;
create policy "Members can create reservations"
  on public.reservations
  for insert
  to authenticated
  with check (public.is_business_member(business_id));

drop policy if exists "Members can update reservations" on public.reservations;
create policy "Members can update reservations"
  on public.reservations
  for update
  to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- Compatibility bridge: legacy rows keep reservation_id text pointing to
-- leads.id. Future canonical rows can use canonical_reservation_id instead.
alter table public.reservation_guests
  alter column reservation_id drop not null,
  add column if not exists canonical_reservation_id uuid
    references public.reservations(id) on delete cascade;

alter table public.reservation_guests
  add constraint reservation_guests_has_reservation_reference
  check (reservation_id is not null or canonical_reservation_id is not null);

create index if not exists reservation_guests_canonical_reservation_id_idx
  on public.reservation_guests (canonical_reservation_id);

alter table public.reservation_internal_notes
  alter column reservation_id drop not null,
  add column if not exists canonical_reservation_id uuid
    references public.reservations(id) on delete cascade;

alter table public.reservation_internal_notes
  add constraint reservation_internal_notes_has_reservation_reference
  check (reservation_id is not null or canonical_reservation_id is not null);

create index if not exists reservation_internal_notes_canonical_reservation_id_idx
  on public.reservation_internal_notes (canonical_reservation_id);

alter table public.reservation_timeline_events
  alter column reservation_id drop not null,
  add column if not exists canonical_reservation_id uuid
    references public.reservations(id) on delete cascade;

alter table public.reservation_timeline_events
  add constraint reservation_timeline_has_reservation_reference
  check (reservation_id is not null or canonical_reservation_id is not null);

create index if not exists reservation_timeline_canonical_reservation_id_idx
  on public.reservation_timeline_events (canonical_reservation_id);
