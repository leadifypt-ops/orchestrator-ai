# Block 45 — Reservation Confirmation & Guest Communication Foundation

## Objective

Create a human-controlled internal workflow for preparing, reviewing, and recording communication for accepted reservations. The block does not send messages, integrate providers, capture payment, or expose guest-facing accounts.

## What was implemented

- A Business/Restaurant/reservation-scoped communication record with guest contact snapshots, channel, type, lifecycle status, bilingual draft language, content, actor metadata, timestamps, and cancellation reason.
- An append-only communication event journal containing a content snapshot for every lifecycle change.
- Authenticated RPCs to create a confirmation draft, update it, mark it ready, mark it sent, cancel it, list reservation history, and list the operational queue.
- An accepted-reservation-only Guest Communication section on the manual decision detail route.
- A filterable internal queue for status, restaurant, type, and channel.
- English and Portuguese premium confirmation templates.

## Data model

`reservation_communications` stores the current operational record. Valid statuses are `draft`, `ready`, `marked_sent`, `failed`, and `cancelled`; valid channels are `email`, `phone`, `whatsapp`, `sms`, and `manual`; valid types are `confirmation`, `update`, `cancellation_notice`, `reminder_draft`, and `internal_note`.

`reservation_communication_events` is an append-only journal. It snapshots the subject, message, channel, type, status transition, reason, actor, and time so edits never erase history. Scope keys use composite foreign keys back to the reservation, restaurant, and communication.

## RPCs and actions

- `create_reservation_confirmation_draft`: requires an authenticated owner/manager/staff member and an `accepted` reservation in the same scope. It creates only a draft.
- `update_reservation_communication_draft`: permits edits in `draft` or `ready`; an edit returns the item to `draft` review.
- `mark_reservation_communication_ready`: performs the explicit reviewed transition.
- `mark_reservation_communication_sent`: records a human assertion and actor/time; it calls no provider.
- `cancel_reservation_communication`: requires a reason and never deletes the record.
- `list_reservation_communications` and `list_reservation_communication_queue`: return only membership-scoped records.

Server Actions re-check authentication, validate form bounds, call the RPCs, and revalidate the detail and queue routes.

## UI surfaces

Accepted reservation decision pages show draft creation, editable content, ready/sent/cancel confirmations, status badges, and full history. Pending and rejected reservations show the prerequisite instead of draft controls. The queue lives at `/{locale}/business/reservations/communications` and is linked from the internal sidebar.

## RLS and security

Both tables have RLS enabled. Anonymous users receive no grants. Authenticated users receive read access only when an owner/manager/staff membership matches `business_id`. Direct insert/update/delete is denied; mutation is available only through scoped security-definer RPCs. No trigger performs dispatch or reservation decisions.

## Audit and timeline

Draft creation, draft updates, ready transitions, sent markings, and cancellations append both a communication event and a `reservation_communication` timeline event. Existing Block 44 decision events are untouched.

## Limitations

Only English and Portuguese templates are available, chosen explicitly at draft creation. `marked_sent` is a manual assertion, not delivery evidence. There are no email/SMS/WhatsApp providers, automatic reminders, guest-facing preferences, payment, retries, delivery receipts, or guest accounts. Legacy `confirmed` reservations are not implicitly admitted; the Block 44 `accepted` state is required.

## Validations executed

Executed successfully: TypeScript (`npx tsc --noEmit`), focused Block 45 ESLint, production build, linked remote database lint, 30/30 local/remote migration alignment, and authenticated runtime rendering of the queue, five filters, operational columns, no-provider copy, and zero browser console warnings/errors. Repository-wide ESLint remains blocked by seven pre-existing errors outside Block 45. Transactional SQL validation files cover eligibility, update/ready/sent/cancel transitions, mandatory cancellation reason, unauthorized scope, append-only audit, and timeline counts, but could not be executed because the linked CLI exposes migration/lint operations rather than an arbitrary authenticated SQL runner.

## Final status

Implemented and applied to the linked database. The operational UI is production-build clean and authenticated-runtime verified; only the rollback-only behavioral SQL script remains unexecuted for the environment limitation documented above.

## Next logical block

Block 46 — Guest-Facing Confirmation View & Communication Preferences
