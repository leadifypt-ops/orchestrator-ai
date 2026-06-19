-- Reservation operational notes and timeline events.
-- These tables use reservation_id text while reservation requests still map to
-- legacy leads.id values. Replace with a stricter FK after reservation_requests exists.

create table if not exists public.reservation_internal_notes (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null,
  note text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reservation_timeline_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null,
  event_type text not null,
  event_label text not null,
  event_description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists reservation_internal_notes_reservation_id_idx
  on public.reservation_internal_notes (reservation_id);

create index if not exists reservation_internal_notes_created_at_idx
  on public.reservation_internal_notes (created_at desc);

create index if not exists reservation_timeline_events_reservation_id_idx
  on public.reservation_timeline_events (reservation_id);

create index if not exists reservation_timeline_events_created_at_idx
  on public.reservation_timeline_events (created_at desc);

alter table public.reservation_internal_notes enable row level security;
alter table public.reservation_timeline_events enable row level security;

-- Temporary development policies:
-- Ownership cannot be safely enforced yet because reservation requests still
-- live in the legacy leads table and this schema deliberately avoids a hard FK.
-- Replace these with reservation-owner scoped policies when the canonical
-- reservation_requests table exists.

drop policy if exists "Authenticated users can read reservation internal notes"
  on public.reservation_internal_notes;
create policy "Authenticated users can read reservation internal notes"
  on public.reservation_internal_notes
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create reservation internal notes"
  on public.reservation_internal_notes;
create policy "Authenticated users can create reservation internal notes"
  on public.reservation_internal_notes
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update reservation internal notes"
  on public.reservation_internal_notes;
create policy "Authenticated users can update reservation internal notes"
  on public.reservation_internal_notes
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete reservation internal notes"
  on public.reservation_internal_notes;
create policy "Authenticated users can delete reservation internal notes"
  on public.reservation_internal_notes
  for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read reservation timeline events"
  on public.reservation_timeline_events;
create policy "Authenticated users can read reservation timeline events"
  on public.reservation_timeline_events
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create reservation timeline events"
  on public.reservation_timeline_events;
create policy "Authenticated users can create reservation timeline events"
  on public.reservation_timeline_events
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update reservation timeline events"
  on public.reservation_timeline_events;
create policy "Authenticated users can update reservation timeline events"
  on public.reservation_timeline_events
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete reservation timeline events"
  on public.reservation_timeline_events;
create policy "Authenticated users can delete reservation timeline events"
  on public.reservation_timeline_events
  for delete
  to authenticated
  using (true);
