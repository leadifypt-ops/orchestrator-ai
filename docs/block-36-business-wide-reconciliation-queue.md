# Block 36 — Business-wide Reconciliation Queue

## Scope

Block 36 adds an operational queue at `/business/reconciliation`. It does not
change Guest Identity, matching, reservations, CRM, merge, recovery,
provenance, or any existing audit payload. Historical entities are linked for
context only and are never edited from this queue.

The initial manual types are `Merge Review`, `Recovery Review`, `CRM Review`,
and `Conflict Review`. Supported states are `Pending`, `In Review`, and
`Completed`; supported priorities are `Low`, `Medium`, and `High`.

## Data model and audit

`reconciliation_queue_items` stores current operational state, Business scope,
optional restaurant/guest/reservation/audit/merge/recovery references, origin,
assignee, creator, and timestamps. No automatic producer is installed.

`reconciliation_queue_audit_events` is the immutable journal. Creation and
every effective status, priority, or assignee change append an event with the
previous value, new value, authenticated actor, and timestamp. Updates and
deletes on the journal are rejected by a trigger. Queue item deletion is also
rejected, so operational and audit history cannot be erased.

Authenticated clients receive read-only table grants. Creation and changes are
available only through the new queue RPCs, which repeat authentication and
Business-membership authorization inside each mutation. Assignees must be
authenticated users with membership in the item's Business.

## Business isolation

RLS on both tables uses `is_business_member(business_id)`. A scope-validation
trigger also verifies every optional linked record and assignee belongs to the
same Business. This blocks cross-Business references even through privileged
write paths. Anonymous roles have no table or RPC access.

## UI

The queue table presents type, state, priority, restaurant, guest, origin,
created and updated timestamps, and assignee. GET query parameters provide
search, state/priority/type filters, and ordering without a complex pagination
layer. Each item has a detail page with relevant historical links, the three
controlled mutations, and its complete append-only queue audit.

## Validation

Migration: `supabase/migrations/20260627000400_business_reconciliation_queue.sql`.

Rollback-only functional validation:
`supabase/validation/block-36-business-reconciliation-queue-rollback.sql`.
It covers item creation, state and priority changes, assignment and
unassignment, audit append-only behavior, membership denial, cross-Business
link rejection, RLS visibility, search predicates, combined filters, and
ordering.

After applying the migration, run the rollback validation, inspect policies and
grants, then run TypeScript, focused ESLint, `git diff --check`, and the
production build.

## Remote validation — 2026-06-27

Block 36 is complete. Migration
`20260627000400_business_reconciliation_queue.sql` was applied to the remote
Supabase production project and the rollback-only validation completed with
`block_36_business_reconciliation_queue_valid`.

Remote catalogue inspection confirmed both queue tables, RLS enabled on both,
the two Business-membership read policies, all authenticated queue RPCs,
anonymous table denial, and the append-only audit trigger. The functional
validation confirmed creation, status and priority changes, assignment,
complete audit events, Business Membership, cross-Business isolation, search,
filters, ordering, and rollback of all synthetic fixtures.

Final TypeScript, focused ESLint, `git diff --check`, and `npm run build`
completed successfully.
