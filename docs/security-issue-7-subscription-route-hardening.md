# Find Dining — issue #7: subscription authorization hardening

**Date:** 2026-11-14. **Status:** draft proposal, no deployment or database change.

## Findings verified against recovery branch

- `app/api/activate-plan/route.ts` accepted an arbitrary `userId` from the HTTP body, then used `supabaseAdmin` (service-role) to set `plan_status = active` without a visible auth or payment check. No repository caller was found in GitHub code search.
- `app/api/create-subscription/route.ts` accepted an arbitrary `userId` and created an `inactive/free` row through service-role, without checking the caller's identity.
- The Stripe webhook at `app/api/stripe/webhook/route.ts` independently validates the Stripe webhook signature before updating subscription state. The PR leaves that code untouched.
- Service-role bypasses subscription RLS; therefore RLS fixes alone would **not** protect these endpoints.

## Proposed changes

1. Disable `POST /api/activate-plan` with HTTP 410 and a generic response. A separate, audited admin process or a verified Stripe event must be the only way to activate paid plans.
2. Require `supabase.auth.getUser()` and exact equality to the body `userId` before service-role `create-subscription` operations. Anonymous callers receive 401 and mismatched user IDs receive 403.
3. Do not touch payment state, keys, migrations, Stripe webhooks or real users in this PR.

## Tests required before merge

- Anonymous POST to activate-plan always returns 410; authenticated POST also returns 410. No subscription row changes.
- Anonymous POST to create-subscription returns 401.
- Authenticated caller A passing B's ID returns 403; no writes.
- Authenticated caller A passing A's ID gets either idempotent existing response or a new **inactive/free** row only.
- Verify normal checkout + Stripe signed webhook still reaches the expected subscription state without calling activate-plan.
- Inspect any external clients or obsolete onboarding scripts relying on activate-plan, since GitHub search is not proof of global non-use.

## Production and automation gates

No merge, remote SQL, production deploy, real payment transaction or customer-data writes have been performed. CI currently has an unrelated lockfile issue on PR #1. Do not consider this fix deployed until a reviewed release and regression tests have completed.
