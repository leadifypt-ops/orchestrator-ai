# Block 30 - Manual Guest Identity Merge

## Scope

Block 30 adds an explicit, transactional Business workflow for merging two
active guest identities. It does not alter automatic matching, the public
reservation pipeline, canonical reservation fields, dietary profiles,
operational timeline events, briefings, or returning-guest derivation.

## Transaction

`merge_guest_identities_v1(source, target, confirmation)` requires:

- an authenticated user;
- `confirmation = MERGE`;
- different source and destination identities;
- both identities in the same Business;
- active Business membership;
- active source and destination identities.

The function locks both identities before making changes. It then:

1. reassigns canonical reservation identity links from source to destination;
2. reassigns reservation guest identity links from source to destination;
3. retains every reservation guest and dietary profile;
4. expands the destination first/last seen range;
5. marks the source with `merged_into_identity_id`, `merged_at`, and
   `merged_by`;
6. replaces active source contact keys with a non-routable tombstone so the
   unchanged resolver cannot select the inactive identity;
7. writes one immutable merge audit event.

The source identity and its CRM overlay are not physically deleted.

## Conflict policy

The destination always remains the principal identity. Its name, email, phone,
CRM wine preference, and CRM notes are not overwritten.

The preview and audit payload record differences in:

- name, email, and phone;
- CRM wine preference and notes;
- historical allergies, intolerances, and dietary restrictions.

Historical reservation profiles from both identities remain available through
the destination after their `reservation_guests` links are reassigned.

## Audit

Merge audit events contain:

- authenticated actor and Business;
- source and destination identity IDs;
- timestamp;
- complete before/after identity snapshots;
- source and destination CRM snapshots;
- reservation and profile reassignment counts;
- detected conflicts;
- the applied `destination_wins` decision.

## CRM visibility

Merged identities remain stored but are excluded by the
`guest_identities` Business read policy. Consequently, consolidated Guests and
Data Quality show only the active destination record.

## Validation

The production schema was tested with synthetic identities, reservations,
reservation guests, dietary profiles, and CRM overlays inside one transaction
that ended with `ROLLBACK`. The test verified security guards, reassociation,
history preservation, destination field preservation, merged source state, and
the complete audit event without retaining test data.
