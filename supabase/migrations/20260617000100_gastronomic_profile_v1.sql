-- Gastronomic Profile V1
-- These tables are intentionally linked to reservation requests by reservation_id
-- as text while the app still treats the legacy leads.id value as an opaque string.
-- A future reservation_requests table can backfill this field or add a stricter FK.

create table if not exists public.reservation_guests (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null,
  full_name text,
  guest_position integer not null default 1,
  is_host boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_dietary_profiles (
  id uuid primary key default gen_random_uuid(),
  reservation_guest_id uuid not null references public.reservation_guests(id) on delete cascade,
  allergies text[] not null default '{}',
  intolerances text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  dislikes text[] not null default '{}',
  wine_preferences text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservation_guests_reservation_id_idx
  on public.reservation_guests (reservation_id);

create index if not exists reservation_guests_reservation_position_idx
  on public.reservation_guests (reservation_id, guest_position);

create index if not exists guest_dietary_profiles_guest_id_idx
  on public.guest_dietary_profiles (reservation_guest_id);

alter table public.reservation_guests enable row level security;
alter table public.guest_dietary_profiles enable row level security;

-- Temporary development policies:
-- Ownership cannot be safely joined yet because reservation requests still live
-- in the legacy leads table and this schema deliberately avoids a hard FK to it.
-- Restricting access to authenticated users is conservative enough for local
-- development, but should be replaced with owner-scoped policies once
-- reservation_requests or a stable ownership relationship exists.

drop policy if exists "Authenticated users can read reservation guests"
  on public.reservation_guests;
create policy "Authenticated users can read reservation guests"
  on public.reservation_guests
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create reservation guests"
  on public.reservation_guests;
create policy "Authenticated users can create reservation guests"
  on public.reservation_guests
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update reservation guests"
  on public.reservation_guests;
create policy "Authenticated users can update reservation guests"
  on public.reservation_guests
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete reservation guests"
  on public.reservation_guests;
create policy "Authenticated users can delete reservation guests"
  on public.reservation_guests
  for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read guest dietary profiles"
  on public.guest_dietary_profiles;
create policy "Authenticated users can read guest dietary profiles"
  on public.guest_dietary_profiles
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create guest dietary profiles"
  on public.guest_dietary_profiles;
create policy "Authenticated users can create guest dietary profiles"
  on public.guest_dietary_profiles
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update guest dietary profiles"
  on public.guest_dietary_profiles;
create policy "Authenticated users can update guest dietary profiles"
  on public.guest_dietary_profiles
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete guest dietary profiles"
  on public.guest_dietary_profiles;
create policy "Authenticated users can delete guest dietary profiles"
  on public.guest_dietary_profiles
  for delete
  to authenticated
  using (true);
