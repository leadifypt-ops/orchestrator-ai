# Block 47 — Guest Update Review & Pre-Service Communication Workflow

## Objective

Turn immutable Block 46 guest submissions into a small, human-controlled pre-service review workflow without changing reservation status, CRM, dietary profiles, or sending communication automatically.

## What was implemented

- Business/Restaurant-scoped guest update review queue with restaurant, service date, status, and update-type filters.
- Review detail with original submission, reservation context, recent internal notes, and prior decision.
- Explicit accept, dismiss, convert-to-internal-note, and convert-to-communication-draft actions.
- Reservation detail status/link integration and Block 45 communication queue integration through ordinary draft records.

## Data model changes

`reservation_guest_submission_reviews` stores one immutable staff decision per immutable Block 46 submission. Absence of a review represents `pending_review`; stored outcomes are `accepted`, `dismissed`, `converted_to_internal_note`, and `converted_to_communication_task`. Each decision stores actor, time, optional reason, and the linked note or communication where applicable.

The original `reservation_guest_submissions` row is never updated. A scoped composite key was added only to enforce the review foreign key.

## RPCs and actions

`list_guest_update_reviews` validates Business membership and optional Restaurant scope before returning operational queue context. `review_guest_submission` validates membership, prevents duplicate decisions, requires dismissal reasons, creates the selected linked artifact, inserts the immutable review, and appends the reservation timeline event atomically.

Server Actions re-check authentication and call the scoped review RPC. Every state-changing UI action uses a confirmation dialog.

## UI surfaces

`/{locale}/business/guest-updates` is the review queue and `/{locale}/business/guest-updates/[id]` is the detail/review page. The internal reservation confirmation panel shows pending submissions and compact reviewed-status links. Guest Updates is available in internal navigation.

## RLS and security

The review table has RLS and authenticated scoped read access only. Anonymous users and guest-token holders receive no queue or mutation grants. Direct insert/update/delete is denied. Mutation is available only through the authenticated security-definer RPC, which reuses Block 45 reservation scope validation. Original submissions remain protected by their Block 46 append-only trigger.

## Audit and timeline behavior

Each decision is itself an append-only audit record with actor, timestamp, scope, submission reference, result, reason, and optional linked artifact. A `guest_update_review` event is appended to the existing reservation timeline. Block 44, 45, and 46 journals are untouched.

## Communication integration

Communication conversion inserts an ordinary Block 45 `update` communication in `draft` status and calls the existing communication audit/timeline helper. It sets no sent metadata and invokes no provider.

## Limitations

Reviews are intentionally single-decision and append-only; correction/recovery is not introduced. Accepted updates become operational context only through the review record. No CRM or dietary-profile write, reservation decision, sending, payment, or generic task engine exists.

The synthetic `Block 46 Runtime Validation` reservation was left untouched: it is test-only, but no audited/scoped reservation deletion mechanism exists and direct deletion would conflict with canonical history protections.

## Validations executed

Passed: TypeScript, focused Block 47 ESLint with zero warnings, production build, 32/32 local/remote migration alignment, remote database lint with no findings, `git diff --check`, authenticated runtime rendering of the queue, all five filters, operational columns, and empty state. Anonymous table/function denial, scoped membership checks, immutable source/review triggers, no reservation/CRM update statements, and draft-only communication conversion were verified in the deployed schema. The rollback-only behavioral SQL script covers queue visibility, duplicate review denial, dismissal reason, original immutability, linked note/draft creation, unsent state, timeline counts, reservation/CRM stability, cross-Business denial, and append-only enforcement, but could not be executed because the linked CLI exposes migration/lint rather than an arbitrary transactional SQL runner. With no real guest submissions present, detail, reservation badge, and live conversion runtime paths were not mutated solely for testing. Global ESLint remains separately blocked by the known seven pre-existing errors outside Blocks 45?47.

## Final status

Implemented, applied remotely, and validated to the environment limits documented above.

## Code precision note

Reused: Block 45 communication records/audit helper, existing reservation internal notes, Block 46 submissions, membership validation, timeline, Server Action/dialog patterns, and existing queue styling.

Intentionally not added: mutable submission states, a generic workflow/task engine, review correction machinery, CRM/profile adapters, provider abstractions, hooks, or speculative shared types.

## Next logical block

Block 48 — Pre-Service Briefing Assembly & Staff Handoff
