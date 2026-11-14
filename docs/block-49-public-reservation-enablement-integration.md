# Block 49 — Pilot Restaurant Enablement & Public Reservation Integration

Block 49 moves public reservation intake away from a Feitoria-only, hardcoded-slot path and establishes the canonical multi-restaurant public reservation architecture for Find Dining 1.0.

## Scope Delivered

- Public reservation CTAs now depend on restaurant readiness instead of `slug === "feitoria"`.
- Public reserve pages are available only for restaurants that are explicitly enabled and canonically reservation-ready.
- Public availability is served by a narrow guest-safe RPC, not raw operational tables.
- Public reservation submission V3 revalidates the selected slot in the database before inserting.
- Capacity protection uses canonical service periods, calendars, capacity settings, one-off and recurring exceptions, and operational capacity overrides.
- Submission capacity counts pending/reviewing/confirmed/accepted reservations and excludes rejected/declined/cancelled reservations.
- Restaurants now have explicit `public_reservations_enabled` and `restaurant_timezone` fields.
- Existing Lisbon/Portugal restaurant data is backfilled to `Europe/Lisbon`; timezone identifiers are validated against `pg_timezone_names`.
- Public UI loads availability by restaurant/date/party size and handles no-slot/closed/not-ready/stale availability states.
- Business restaurant management now exposes minimal readiness visibility.

## Database Architecture

Two migrations were applied:

- `20260707000100_public_reservation_enablement_v3.sql`
- `20260707000200_public_reservation_slots_capacity_fix.sql`

The first migration adds restaurant enablement/timezone, readiness and availability RPCs, and `create_public_reservation_v3`. The second corrects the public slot resolver to use the canonical calendar resolver's `configured_capacity` field and removes an unused V3 variable caught by remote lint.

The public availability contract is `resolve_public_reservation_slots_v1(p_restaurant_slug, p_requested_date, p_party_size)`. It returns only guest-safe fields: restaurant slug/name/timezone, requested date/time, public service period name, availability status, and remaining capacity.

Raw operational tables remain unavailable to anon. Existing authenticated operational RPCs remain scoped by membership.

## Reservation V3 Behavior

`create_public_reservation_v3` preserves the canonical public behavior:

- inserts a canonical reservation with `status = 'pending'`;
- stores source as `public_request`;
- creates one reservation guest per guest profile;
- stores dietary profile rows;
- appends a public reservation timeline event;
- performs no automatic acceptance, rejection, provider send, CRM mutation, reviewed profile mutation, table assignment, or unrelated automation.

V1/V2 RPCs remain in place for compatibility. The Next.js public POST route uses V3 when guest profiles are supplied.

## Capacity and Concurrency

The V3 RPC acquires a transaction-scoped advisory lock per restaurant/date/time before rechecking public availability and inserting the reservation. This prevents simultaneous final-slot requests from both passing capacity validation.

Availability and submission use the same canonical resolver path, including overnight service-period timestamp comparisons. The database remains the final authority; UI availability is informational and stale or forged slots are rejected.

## Timezone Behavior

Restaurant timezone is canonical on `restaurants.restaurant_timezone`. Past-date and past-slot filtering uses restaurant-local time through `now() at time zone restaurant_timezone`. Operational date interpretation uses the existing service-period model and preserves overnight behavior.

## Readiness Behavior

`public_reservation_readiness_v1` derives readiness from:

- restaurant/business identity;
- unique public slug;
- public profile fields needed for safe rendering;
- explicit public reservation enablement;
- valid IANA timezone;
- active service period;
- service-period calendar;
- capacity configuration.

On the current remote data, Feitoria is explicitly enabled and set to `Europe/Lisbon`, but it is not reservation-ready because active service period/calendar/capacity configuration is absent. The public restaurant page remains available and preserves Feitoria's premium presentation; the reserve flow remains closed instead of exposing hardcoded legacy slots.

## API and UI

- `GET /api/public/reservations` returns safe public slots for restaurant/date/party size.
- `POST /api/public/reservations` routes guest-profile submissions to `create_public_reservation_v3`.
- `/[locale]/restaurants/[slug]` shows reservation CTAs only when readiness allows.
- `/[locale]/restaurants/[slug]/reserve` is generalized and gated by readiness.
- The public form requests date and party size first, fetches slots, disables submission without an available slot, and keeps guest profile review requirements.
- Business restaurant cards show timezone, public reservations enabled/disabled, and readiness components.

## Validation

Passed:

- pre-apply migration alignment 33/33;
- `supabase db push --linked --dry-run --skip-vault`;
- remote migration apply for both Block 49 migrations;
- final migration alignment 35/35;
- remote database lint with no schema errors after corrective migration;
- `npx tsc --noEmit`;
- focused ESLint with warnings only for existing `<img>` usage on restaurant pages;
- `git diff --check`;
- production build with network access for Google Fonts;
- local runtime API smoke: Feitoria availability returns success with an empty safe slot list;
- local HTTP smoke: Feitoria restaurant page returns 200, reserve route returns 404 while not ready;
- anon RPC smoke: readiness and availability callable without leaking operational notes/reasons/actors.

Not fully executed:

- destructive or persistent synthetic reservation/concurrency tests were not run against production because they would leave public reservation data behind without an available rollback-only SQL execution surface. Concurrency protection was validated by schema/function review and remote lint.

## Limitations and Deferred Scope

Block 49 does not implement guest accounts, full onboarding, Find Dining Admin, provider sends, payment/card guarantee, waitlist, Smart Waitlist, floor plan/table assignment, configurable briefing delivery, or Block 50 functionality.

Leadify was untouched.
