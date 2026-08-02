# Block 46 — Guest-Facing Confirmation View & Communication Preferences

## Objective

Provide accepted reservations with a secure guest-facing confirmation view and a narrow, auditable way to submit communication preferences and pre-visit notes. Guests receive no account and cannot alter operational reservation state.

## What was implemented

- Opaque confirmation links generated and revoked only by authenticated Business staff.
- A public guest-safe confirmation resolver with a fixed field whitelist.
- Append-only communication preference and guest note submissions, always marked pending review.
- English and Portuguese premium confirmation copy.
- Internal token status, generate/regenerate/revoke controls, one-time link copy, view count, expiry, and guest submission cards.
- Confirmation access and guest submissions in the existing reservation timeline.

## Data model and token access

`reservation_confirmation_tokens` stores only a SHA-256 digest of a 256-bit random token. The raw token is returned once to the authenticated staff action. Tokens are Business/Restaurant/reservation scoped, expire after the later of seven days or two days after the requested service date, and can be revoked. Regeneration revokes every active predecessor.

`reservation_confirmation_events` records generation, regeneration, revocation, privacy-safe views, and guest submissions. `reservation_guest_submissions` stores communication preferences or limited notes as append-only `pending_review` records. It does not modify reservation, guest profile, or CRM fields.

## Public guest-safe RPCs and actions

`resolve_guest_confirmation` hashes the supplied token, validates expiry/revocation and rechecks the current reservation status is `accepted`. It returns only restaurant name, service date/time, party size, guest display name, a public status label, optional public contact fields, and change instructions. It returns no IDs, internal notes, decisions, capacity, overrides, reconciliation data, or audit records.

`submit_guest_communication_preferences` accepts only channel, language, and reservation-contact permission. `submit_guest_reservation_notes` accepts only allergy/dietary, occasion, arrival/accessibility, and general notes with strict lengths. Both require an active accepted-reservation token and append timeline/audit records without triggering communication.

## Internal UI

The Block 45 communication detail now includes Guest Confirmation View & Preferences. Staff can generate, regenerate, copy, and revoke links; see active/revoked badges, expiry and privacy-safe view counts; and read pending guest submissions. Operational interpretation remains human-owned.

## Guest-facing UI

`/reservation/confirmation/[token]` has no application navigation or internal identifiers. It presents the restaurant, confirmed service details, calm confirmation copy, a language switch, communication preferences, limited notes, review expectations, and urgent-change guidance.

## RLS and security

All three tables use RLS. Anonymous and authenticated clients have no direct mutation grants; anonymous clients cannot select the tables. Public access exists only through three narrow security-definer RPCs. Internal token management requires owner/manager/staff membership in the reservation Business. Every public operation independently checks token digest, expiry, revocation, and accepted status.

## Audit and timeline

Token generation/regeneration/revocation, confirmation views, preference submissions, and note submissions append dedicated events. Staff-relevant actions also append existing reservation timeline events. Block 44 and Block 45 journals are untouched.

## Limitations

No provider sending, delivery receipts, payments, guest accounts, rescheduling, cancellation, automatic profile updates, or operational decisions are introduced. Public restaurant contact fields are returned as null until a dedicated public contact contract exists. Guest submissions remain pending for the next staff-review workflow.

## Validations executed

Passed: remote migration application; 31/31 local/remote migration alignment; remote database lint with no findings; TypeScript; focused Block 46 ESLint; production build with the existing Google Fonts fetched under approved network access; authenticated production rendering of the internal decision detail, Block 46 panel, and pending-state denial; and `git diff --check`. Global ESLint remains blocked by the same seven pre-existing unrelated errors. A synthetic pending reservation (`Block 46 Runtime Validation`) was created for runtime validation. The approval service then reached its usage limit and rejected further escalated server/database execution, so valid/revoked/expired token resolution, rejected-state denial, guest submission mutation invariants, and remote timeline/audit counts could not be executed end to end and are not reported as passed. Their rollback-only SQL assertions remain in `supabase/validation/block-46-guest-confirmation-rollback.sql`.

## Final status

Implementation and migration deployment are complete. The remaining behavioral checks are blocked only by the approval service usage limit described above; no Block 47 work was started.

## Next logical block

Block 47 — Guest Update Review & Pre-Service Communication Workflow
