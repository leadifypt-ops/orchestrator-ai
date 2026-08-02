-- Composite ownership key required by the Block 44 append-only decision journal.
create unique index if not exists reservations_id_business_restaurant_uidx
  on public.reservations(id,business_id,restaurant_id);
