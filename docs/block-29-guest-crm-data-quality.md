# Block 29 - Guest CRM Data Quality

## Scope

Block 29 adds Business-side data maintenance without changing the public
reservation form, public reservation endpoint/RPC contracts, canonical
reservations, identity matching order, reservation history, briefings, or the
returning-guest experience.

## Companion contact capture

`reservation_guests` now supports optional `email` and `phone`. Business users
can complete these fields from Guest Data Quality for profiles already attached
to an authorized canonical or legacy reservation.

For canonical profiles, the existing identity resolver is reused unchanged:

1. normalized email;
2. normalized phone;
3. never name.

Legacy profiles retain their contact data but remain unlinked because legacy
reservations do not have a Business identity context.

## Duplicate detection and merge preparation

The application derives possible duplicate pairs from:

- equal normalized emails;
- equal normalized phones;
- a saved guest email and phone resolving to different identities;
- a saved guest contact resolving away from its linked identity.

Detection is read-only. The merge preview requires explicit source and
destination identities and shows field differences and visit impact. Merge
confirmation and mutation are intentionally disabled.

## Controlled corrections

An authenticated Business RPC can correct identity name, email, and phone after
membership and contact-collision checks. This does not rewrite reservations or
visits.

Corrected CRM wine preference and notes are stored in `guest_crm_profiles`,
separate from historical reservation dietary profiles.

## Audit foundation

Every successful correction writes an immutable
`guest_crm_audit_events` record containing:

- Business and guest identity;
- authenticated actor;
- timestamp;
- previous values;
- new values;
- correction/merge event type foundation.

Direct table writes are not granted to authenticated users. Reads are scoped by
Business membership RLS.

## Compatibility and limitations

- Existing reservation and guest rows remain valid because contact columns are
  nullable.
- Public and manual reservation creation signatures are unchanged.
- Existing canonical hosts continue to inherit the reservation identity.
- Legacy companion contacts cannot become canonical identities without a
  Business-scoped canonical reservation.
- Duplicate detection provides operational signals, not proof that two people
  are the same.
- Block 29 does not execute merges or provide a complete visual audit history.
