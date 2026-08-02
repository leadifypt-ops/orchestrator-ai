# Block 33 - Merge Provenance Foundation

## Scope

Block 33 adds immutable, per-record provenance for manual guest identity merges performed after this migration. It does not execute recovery and does not infer provenance for older merges.

## Recorded provenance

`guest_merge_provenance_records` records every canonical `reservations` and `reservation_guests` row whose `guest_identity_id` changes from the source identity to the destination identity. It also records each `guest_contact_aliases` row created to preserve the source contact during that merge.

Each row stores the Business, immutable merge audit event, source and target identities, record table and ID, previous and new identity, provenance type, timestamp, and authenticated actor. A unique constraint prevents duplicate provenance for the same merge, record, and provenance type. Authenticated users receive read-only access through Business-membership RLS; anonymous users receive no access.

The merge RPC collects reassigned record IDs, creates its existing merge audit event with a known ID, and inserts provenance rows in the same transaction. Confirmation, destination-wins behavior, source deactivation, alias preservation, and existing audit payloads remain unchanged.

## Recovery visibility

The governed recovery preview displays the number of traceable provenance rows and a table/type breakdown. Older merges show an explicit warning that per-record provenance is unavailable. Recovery execution remains unimplemented.

## Intentional limitations

- Historical merges are not backfilled or guessed.
- Dietary profiles are not recorded independently because the merge does not reassign them; they remain attached to their original `reservation_guests` rows.
- Provenance does not authorize or perform record movement.
- Public reservation functions and the guest identity resolver are unchanged.

## Validation

Apply `20260627000100_merge_provenance_foundation.sql`, then run the rollback-only Block 33 validation script. It creates synthetic identities and linked records inside a transaction, performs a merge, validates provenance/audit/Business scope and anonymous denial, and rolls everything back.

## Recommended next block

Design a separately confirmed recovery execution that operates only on provenance-backed records, detects post-merge changes, and creates a new immutable execution audit before any narrowly scoped reassignment.
