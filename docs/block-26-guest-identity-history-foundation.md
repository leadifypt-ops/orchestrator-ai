# Block 26 - Guest Identity and History Foundation

## Scope

This block adds business-scoped returning-guest recognition without guest login,
loyalty, recommendations, AI, or profile editing. Public and manual reservation
RPC signatures remain unchanged.

## Minimal schema

Migration `20260621000200_guest_identity_history_foundation.sql` adds:

- `guest_identities`, scoped by `business_id`;
- nullable `guest_identity_id` links on canonical `reservations` and
  `reservation_guests`;
- unique partial indexes for normalized email and phone within each Business;
- insert triggers that resolve the canonical reservation contact by email first,
  then phone, and link the host reservation profile when one exists;
- a chronological backfill for existing canonical reservations and host profiles.

Contacts without email and phone remain unlinked. Names are never used for
matching. Non-host public profiles remain unlinked because V2 does not collect
individual contact identifiers.

## Safety

`guest_identities` has RLS enabled. Authenticated reads require
`is_business_member(business_id)`; anonymous and authenticated direct writes
are not granted. Resolution helpers and trigger functions are not callable by
public roles. Existing canonical reservation RLS remains authoritative for
history queries.

The migration does not alter public or manual RPC signatures, reservation
status behavior, profile persistence, or the public form.

## Business detail

For a linked canonical host, reservation detail shows:

- first and last reservation date;
- total linked reservations and first/returning status;
- known allergies, intolerances, restrictions, dislikes, and wine preferences;
- previous notes/context;
- returning-guest context in Service Briefing;
- dietary risks from previous reservations in Kitchen Briefing.

Canonical profiles remain read-only. In this foundation, "visit" means a linked
canonical reservation; completion and attendance semantics can be introduced in
a later operational block.

## Validation

1. Apply the migration after Public Reservation Form V2.
2. Create two canonical reservations for the same Business with the same email
   (or, when email is absent, the same normalized phone).
3. Confirm both reservations share one `guest_identity_id`.
4. Open the second reservation detail and verify returning status, two visits,
   historical preferences, previous context, and historical kitchen risks.
5. Run TypeScript, focused ESLint, `git diff --check`, and the production build.
