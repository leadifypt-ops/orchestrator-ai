# Block 32 - Governed Manual Recovery

## Scope

Block 32 provides a preview-first, explicitly confirmed recovery-review workflow for a previous guest identity merge. It does not offer automatic undo and does not move identities, reservations, reservation guests, profiles, or aliases.

## Recovery preview and audit

The recovery route is `/business/guests/data-quality/audit/[id]/recovery`. It displays the immutable merge audit snapshot, source and target identities, merge time and actor, reassignment counts, preserved source aliases, and the boundaries of what can be safely inferred.

`guest_merge_recovery_events` records each explicitly confirmed review. The event includes the merge reference, Business and identities, a snapshot of the preview, authenticated actor, confirmation text, and an explicit `not_implemented` execution payload. It is read-only to Business members through RLS. The recording RPC is unavailable to anonymous callers.

## Safety rules

- Confirmation must be exactly `RECOVERY` and requires an authenticated Business member.
- The original merge audit and contact aliases are never deleted or modified.
- No public reservation function, resolver behavior, or unrelated identity is changed.
- Recovery execution remains intentionally unimplemented because Block 30 did not record immutable, per-record provenance for reassigned reservations or profiles.

## Validation

- TypeScript and focused ESLint on Block 32 files.
- `git diff --check`.
- `npm run build`; the known Google Fonts network failure should be recorded separately if it persists.
- After applying the migration, verify RLS, anonymous RPC denial, authenticated membership denial, and that a confirmation creates only a recovery-review event.

## Recommended next block

Capture immutable per-record merge provenance prospectively, then design a separately confirmed, narrowly scoped recovery execution for only those traceable records.
