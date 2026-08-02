# Block 35 - Post-Recovery Review & Reconciliation

## Scope

Block 35 adds an operational review layer after provenance-backed recovery. It does not broaden or repeat recovery and never modifies identities, reservations, guests, profiles, aliases, provenance, or historical audits.

## Automatic checklist

Every new recovery execution automatically creates a pending reconciliation review with a structured checklist. It distinguishes automatically restored reservations and reservation guests from CRM ownership, dietary visibility, aliases, merged source state, and immutable audit history that still require awareness or manual review.

## Immutable review events

Operators can record `pending`, `completed`, or `requires_follow_up`. Each submission inserts a new immutable event; prior statuses are never overwritten. Review notes are metadata only and are limited to 2,000 characters.

Business-membership RLS protects review reads. Anonymous access and direct authenticated writes are denied; the recording RPC validates authentication and membership. A database trigger rejects updates and deletes to existing review events.

## Validation

Apply `20260627000300_post_recovery_reconciliation.sql`, then run the rollback-only Block 35 validation. It verifies automatic pending review creation, append-only operator review, immutability, unchanged recovered records and merge audit, anonymous denial, and complete rollback.

## Limitations

- Checklist warnings are operational guidance, not automated corrections.
- Existing recovery executions created before this migration are not backfilled.
- Source identities remain merged and inactive.

## Recommended next block

Add a Business-wide reconciliation queue and follow-up ownership/reporting across recovery executions, without adding new recovery mutations.
