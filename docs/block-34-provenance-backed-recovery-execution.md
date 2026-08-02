# Block 34 - Provenance-backed Recovery Execution

## Scope

Block 34 introduces the first recovery execution path. It is not a general undo: it moves only `reservations` and `reservation_guests` whose exact source-to-target movement was recorded by Block 33 provenance.

## Safety

`recover_guest_merge_v1(recovery_event_id, confirmation)` requires an authenticated Business member, a confirmed governed recovery preview, exact `RECOVERY` confirmation, matching merge audit and identities, and immutable provenance. Every supported record must still exist and still belong to the current target; otherwise the complete transaction aborts.

The source remains marked as merged. Contact aliases, CRM ownership, dietary profiles, identity timestamps, merge audit, recovery preview, and unrelated records remain unchanged. Unsupported provenance rows are counted as skipped and never mutated.

## Execution audit

`guest_merge_recovery_execution_events` stores one immutable execution per recovery preview, including recovered and skipped counts, a structured summary, Business and identity scope, actor, and timestamp. Business members have read-only RLS access; anonymous users have no table or RPC access.

## Validation

Apply `20260627000200_provenance_backed_recovery_execution.sql`, then run the rollback-only Block 34 validation. It verifies provenance-backed ownership restoration, unchanged aliases and merge audit, retained source merge state, execution auditing, anonymous denial, and transaction rollback.

## Limitations

- Historical merges without Block 33 provenance are rejected.
- Post-merge ownership changes cause a full abort rather than a partial recovery.
- No field reconstruction, alias movement, profile ownership change, or source reactivation occurs.

## Recommended next block

Add a post-recovery operational review state and reconciliation tooling for inactive-source ownership, without broadening recovery beyond provenance-backed records.
