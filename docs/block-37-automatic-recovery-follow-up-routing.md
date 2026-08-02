# Block 37 — Automatic Recovery Follow-up Routing

## Objetivo do bloco

Connect explicit post-recovery `requires_follow_up` decisions from Block 35 to
the Business-wide reconciliation queue from Block 36. The connection is
operational metadata only: it does not broaden recovery and does not modify
Guest Identity, reservations, guests, profiles, aliases, provenance, or any
historical audit.

## O que foi implementado

- `reconciliation_queue_items` now carries immutable references to the recovery
  execution and reconciliation review that produced automatic work.
- An `after insert` producer routes only `requires_follow_up` review events into
  one Pending, High-priority Recovery Review queue item.
- A partial unique index makes routing idempotent per recovery execution.
  Repeated immutable follow-up decisions remain in review history but do not
  duplicate operational work or queue audit events.
- Automatic queue creation appends the existing `created` audit event with the
  actor, review ID, execution ID, producer, timestamp, and initial queue state.
- The queue scope trigger verifies the complete Business, merge, recovery,
  execution, and review chain before accepting linked records.
- Existing explicit `requires_follow_up` reviews are backfilled from their
  immutable relationships. Earlier manual queue items are never guessed,
  rewritten, or deleted.
- The recovery action revalidates the queue after review recording, and the
  queue UI identifies manual versus post-recovery work.

Migration:
`supabase/migrations/20260628000100_automatic_recovery_follow_up_routing.sql`.

Rollback-only functional validation:
`supabase/validation/block-37-automatic-recovery-follow-up-routing-rollback.sql`.

## Descobertas importantes

Block 35 already had the authoritative, append-only decision event and Block 36
already had the controlled operational state machine. The safest producer is
therefore a database trigger on the immutable review insert, rather than a
second client mutation that could succeed or fail independently.

The recovery execution is the correct idempotency boundary. Multiple follow-up
review events may legitimately describe the same execution, while the Business
needs one owned operational item for that execution.

## Limitações

- Automatic routing is intentionally limited to post-recovery
  `requires_follow_up`; merge, CRM, and conflict signals remain manual.
- The producer does not auto-assign a Business member and does not change queue
  status after later review events. Operational ownership remains explicit in
  the governed queue.
- Earlier manual items cannot be safely deduplicated against the new producer
  because they do not carry an execution reference; they are preserved.

## Validações executadas

- Next.js 16.2.1 Forms and `revalidatePath` documentation read before UI work.
- TypeScript: passed with `npx tsc --noEmit`.
- Focused ESLint: passed for recovery review and reconciliation queue files.
- `git diff --check`: passed before final remote validation.
- Production build: passed after allowing the configured Geist font fetch.
- Remote migration and rollback-only SQL validation: pending authenticated
  Supabase Management API or database access.

## Estado final

Implementation and local validation are complete. The block is not yet marked
complete because the new migration has not been applied and validated on the
remote Supabase project.

## Próximo passo lógico

After remote validation closes Block 37, add queue ownership reporting and
ageing/SLA visibility without introducing automatic assignment or new identity
mutations.

## Remote validation and final closure — 2026-06-29

This final record supersedes the provisional pending state above without
rewriting the existing DevLog entry.

Migration `20260628000100_automatic_recovery_follow_up_routing.sql` was applied
directly through the authenticated linked-project query command. The remote CLI
migration history was already empty for the existing migration chain even
though the Block 36 schema and RPCs were present. A broad `db push` was therefore
not used because it would have attempted to reapply previously deployed work.

Catalogue inspection confirmed:

- `recovery_execution_event_id` and `reconciliation_review_id` on the queue;
- the partial unique execution index;
- the automatic producer function and review-insert trigger;
- no direct producer execution for `anon` or `authenticated`;
- RLS still enabled on `reconciliation_queue_items`.

The Block 37 rollback-only test returned
`block_37_automatic_recovery_follow_up_routing_valid`. The Block 35 and Block 36
rollback-only suites were repeated afterward and returned their expected valid
markers. All fixtures were rolled back.

• Objetivo do bloco

Route explicit post-recovery follow-up decisions into governed Business work
without modifying Guest Identity or immutable recovery history.

• O que foi implementado

An idempotent database producer now creates one audited, High-priority Pending
Recovery Review per recovery execution when an immutable review is marked
`requires_follow_up`. Complete Business-scoped provenance links the review,
execution, recovery, and merge. The Business UI identifies automatic queue
work and refreshes the queue after the decision.

• Descobertas importantes

The immutable review insert is the authoritative event and the recovery
execution is the correct deduplication boundary. The linked remote project has
an empty CLI migration history despite the deployed schema through Block 36,
so only the Block 37 SQL was applied directly.

• Limitações

Automatic routing covers only post-recovery follow-up. It does not auto-assign,
auto-complete, merge heuristic duplicates with older manual items, or create
new Guest Identity mutations. The pre-existing remote migration-history gap
still requires a separately governed reconciliation plan.

• Validações executadas

TypeScript, focused ESLint, `git diff --check`, production build, remote schema
inspection, Block 37 rollback-only functional validation, and regression runs
of the Block 35 and Block 36 rollback-only validations all passed.

• Estado final

Block 37 is complete, deployed, remotely validated, regression-checked, and
documented. No Leadify code or validated unrelated functionality was changed.

• Próximo passo lógico

Block 38 should audit and reconcile the remote Supabase migration history with
the schema already deployed through Block 37, without reapplying schema changes.
After deployment history is trustworthy again, the next product block can add
reconciliation ownership reporting and ageing/SLA visibility.
