# Public Reservation Form V2 - Guest Profiles

## Scope

The Feitoria public request route at `/{locale}/restaurants/feitoria/reserve` now captures contextual information for every person in the party. The canonical reservation and Business Reservations UI are unchanged.

## Public flow

The existing `POST /api/public/reservations` endpoint remains the browser boundary. Requests with `guest_profiles` use V2; the prior flat payload continues to call the unchanged V1 RPC for backward compatibility. Contact name, email, date, requested time, and party size retain their reservation-level validation. Feitoria dinner request slots are presented from 19:00 through 22:00 in 15-minute intervals. They are request times, not live availability; the restaurant still reviews and confirms the table.

Party size controls the number of individual profiles. Every profile supports:

- optional name;
- allergies;
- intolerances;
- dietary restrictions;
- dislikes;
- wine preference;
- notes;
- required review confirmation.

Common allergies, intolerances, and restrictions use multi-select chips. All profile information is optional except the explicit review confirmation for each guest. Editing a profile after confirmation clears that confirmation.

## Payload contract

The endpoint accepts `guest_profiles` as an array whose length must equal `party_size`. Each object is normalised to:

`{ name, allergies, intolerances, dietary_restrictions, dislikes, wine_preference, notes, reviewed }`

The Route Handler rejects missing profiles, unreviewed profiles, unknown shapes, oversized values, invalid party sizes, and times outside the configured Feitoria request slots. The payload separates kitchen-facing arrays from service-facing preferences and notes, so downstream Kitchen Briefing and Service Briefing projections do not need to parse a shared free-text field.

## Minimal migration

Migration `20260621000100_public_reservation_guest_profiles_v2.sql` adds only `create_public_reservation_v2(..., jsonb)`. It does not alter canonical tables or replace `create_public_reservation_v1`. This is the lowest-risk rollout because:

- V1 callers and grants remain intact;
- the canonical `reservations` contract is unchanged;
- existing `reservation_guests` and `guest_dietary_profiles` tables already model the required data;
- reservation, timeline, guests, and profiles are written in one transaction;
- Business Reservations receives the same canonical pending reservation and requires no changes.

V2 writes one `reservation_guests` row and one `guest_dietary_profiles` row for every party member. Guest 1 is marked as host; its optional profile name remains independent from the required reservation contact name. General experience notes are preserved on the host profile.

## Deployment

Apply the migrations documented in `public-reservation-pipeline-v1.md` first, then apply:

`supabase/migrations/20260621000100_public_reservation_guest_profiles_v2.sql`

Verify the RPC and anonymous execute grant:

```sql
select
  to_regprocedure(
    'public.create_public_reservation_v2(text,text,text,text,date,time without time zone,integer,text,text,text,jsonb)'
  ) is not null as has_v2_rpc,
  has_function_privilege(
    'anon',
    'public.create_public_reservation_v2(text,text,text,text,date,time without time zone,integer,text,text,text,jsonb)',
    'EXECUTE'
  ) as anon_can_execute;
```

Both values must be `true`. Submit a multi-guest request and verify one canonical reservation, one timeline event, and exactly `party_size` guest/profile rows.

## Verification

Run:

```sh
npx tsc --noEmit
npx eslint 'app/[locale]/restaurants/[slug]/reserve/reservation-request-form.tsx' 'app/api/public/reservations/route.ts'
npm run build
```
