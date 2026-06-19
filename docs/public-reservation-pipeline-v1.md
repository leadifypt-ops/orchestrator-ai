# Public Reservation Pipeline V1

## Endpoint

`/restaurants/[slug]/reserve` submits JSON to the Route Handler
`POST /api/public/reservations`. The handler validates and normalises the
payload, then calls the transactional PostgreSQL function
`create_public_reservation_v1`.
The public response contains only success or a generic error; no reservation,
restaurant, or Business IDs are returned.

## Validation

The server requires name, valid email, real date, 24-hour time, and an integer
party size between 1 and 20. Phone, occasion, special request, allergies,
intolerances, restrictions, dislikes, wine preferences, and experience notes
are optional. Text and list sizes are bounded in the Route Handler. The RPC
rechecks required values, email, party size, and restaurant association.

## Transactional writes

Migration `20260618000400_public_reservation_pipeline_v1.sql` writes atomically:

- `reservations`, with `status = pending` and `source = public_request`;
- `reservation_timeline_events`, with
  `event_type = reservation_request_created` and source in the description;
- `reservation_guests` and `guest_dietary_profiles` when profile data exists.

The guest is the host and links through `canonical_reservation_id`. Experience
notes are stored in the dietary profile `notes` field. Any failed insert rolls
back the complete request.

## Security

The browser supplies a restaurant slug, never `business_id` or
`restaurant_id`. The `security definer` RPC resolves the restaurant by slug and
derives `business_id` only when the restaurant has a valid ownership link.
`anon` receives execute permission only on this narrow function. No anonymous
table grants or RLS insert policies are added, and the service role key never
reaches the client.

## Limitations

- There is no availability check, payment, customer login, or automatic
  confirmation.
- There is no notification or canonical status editing in this block.
- Rate limiting, bot protection, consent capture, and idempotency remain future
  hardening work.
- The restaurant schema has no published flag, so public eligibility currently
  means an existing slug with a non-null `business_id`.
- Legacy `leads` are unchanged.

## Deployment and verification

The destination database must receive these SQL files in this exact order:

1. `supabase/migrations/20260617000100_gastronomic_profile_v1.sql`
2. `supabase/migrations/20260617000200_reservation_notes_timeline.sql`
3. `supabase/migrations/20260618000100_business_ownership_foundation.sql`
4. `supabase/migrations/20260618000200_reservation_canonical_schema_v1.sql`
5. `supabase/migrations/20260618000300_business_reservations_canonical_write_v1.sql`
6. `supabase/migrations/20260618000400_public_reservation_pipeline_v1.sql`

Those files are the exact SQL to apply; do not apply only the final RPC file.
The public function depends on the ownership column, canonical reservation
table, guest/profile tables, and timeline table created earlier in the chain.
With a linked Supabase project, apply the tracked migrations with:

```sh
npx supabase db push --linked
```

When using the Supabase SQL Editor, paste and execute the complete contents of
each of the six files above, one at a time in the listed order. The final file
also asks PostgREST to reload its schema cache. Verify the deployed contract:

```sql
select
  to_regclass('public.reservations') is not null as has_reservations,
  to_regclass('public.reservation_guests') is not null as has_guests,
  to_regclass('public.reservation_timeline_events') is not null as has_timeline,
  to_regprocedure(
    'public.create_public_reservation_v1(text,text,text,text,date,time without time zone,integer,text,text,text[],text[],text[],text[],text,text)'
  ) is not null as has_public_rpc,
  has_function_privilege(
    'anon',
    'public.create_public_reservation_v1(text,text,text,text,date,time without time zone,integer,text,text,text[],text[],text[],text[],text,text)',
    'EXECUTE'
  ) as anon_can_execute;
```

All five values must be `true`. After a submission, verify the canonical
reservation, guest/profile, and timeline rows, then confirm it appears with the
Canonical badge and `public_request` source in `/business/reservations` and
opens correctly at `/business/reservations/[id]`.
Next steps are rate limiting and bot protection, explicit restaurant publishing
state, notifications, and canonical operational mutations.

## Validation in this workspace

TypeScript, focused ESLint, and the Next.js production build passed. Browser
verification confirmed the public form and the login redirects for Business
Reservations list and detail. The configured destination was audited on
2026-06-19 with read-only requests. It did not expose `public.reservations`,
`public.reservation_guests`, or `public.reservation_timeline_events`;
`public.restaurants.business_id` and `create_public_reservation_v1` were also
absent. Apply the exact six-file chain above before the end-to-end persistence
check.
