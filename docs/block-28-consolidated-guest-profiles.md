# Block 28 - Consolidated Guest Profiles

## Scope

The Business Guests surface treats `guest_identities` as the primary CRM
record. It remains read-only and does not change identity matching, reservation
creation, canonical schema, or briefing derivation.

## List and detail

`/${locale}/business/guests` shows one card per authorized identity with contact
details, visit dates and totals, and accumulated gastronomic context.

`/${locale}/business/guests/[id]` provides the read-only consolidated profile
and a reverse-chronological visit timeline linked to Reservation Detail.

Profiles without a stable identity remain visible in a secondary
reservation-only compatibility section. They are not merged by name because
Block 26 deliberately limits matching to normalized email or phone.

## Safety

No migration or write path was added. Authentication remains inherited from the
`(app)` layout and Business authorization remains enforced by existing RLS.
Public reservation RPCs, guest matching, briefings, and canonical reservation
fields are unchanged.

## Known limitation

Only canonical host contacts currently receive a stable identity. Companion and
legacy profiles generally lack individual contact data and cannot be safely
consolidated without expanding the identity contract.
