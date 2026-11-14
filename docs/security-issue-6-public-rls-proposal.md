# Find Dining — issue #6: public table RLS hardening proposal

**Prepared:** 2026-11-14. **Status:** DRAFT branch, **not executed** against any database.
**Base:** `recovery/find-dining-block49-20261114` (Block 49 preserved).
**Remote evidence:** project Find Dining ACTIVE_HEALTHY; 35 historical migrations applied. Four legacy public tables have RLS disabled and anon/authenticated broad grants. Read-only `pg_policies` showed no existing policies on those four tables.

## Proposed security contracts

| Table | New anon access | New authenticated access | Server access |
| --- | --- | --- | --- |
| `setup_requests` | none | none | service_role INSERT / administration (server route) |
| `plan_interest` | none | none | service_role only; no current repo consumer found, check external clients |
| `subscriptions` | none | SELECT own row where `auth.uid() = user_id` | service_role manages billing state |
| `restaurant_featured_dishes` | SELECT editorial content | SELECT editorial content | service_role manages published content |

## Implementation

1. Migration `20261114122812_public_table_rls_hardening.sql` enables RLS, revokes previous broad client grants, grants only required SELECT, and adds two explicit policies.
2. `supabase/tests/public_table_rls_hardening_test.sql` has 19 pgTAP checks for RLS, grants, presence of policies and retained service_role permissions.
3. No data is deleted, changed or copied. No reservations, payments, tables or provider sends are modified.
4. This migration filename was constructed from a UTC timestamp because the CLI was unavailable in this agent runtime. Before merging, regenerate/confirm with `supabase migration new public_table_rls_hardening` in the canonical development workspace and reconcile filename safely.

## Verified callers (repository code only)

- `app/api/setup-request/route.ts` inserts via `supabaseAdmin`. No direct anonymous table write needed.
- `app/api/generate-automation/route.ts` reads `subscriptions` for signed-in user's own `user_id`; this continues via owner-scoped SELECT policy.
- `app/api/checkout/route.ts`, `app/api/create-subscription/route.ts`, `app/api/activate-plan/route.ts`, `app/api/stripe/webhook/route.ts` use service_role for billing state. Those API endpoints need **separate authorization reviews**; RLS does not protect privileged server operations.
- `app/[locale]/restaurants/[slug]/page.tsx` reads `restaurant_featured_dishes` through the public client. SELECT remains public.
- No direct reference to `plan_interest` was found in GitHub code search; **external clients not verified**.

## Required validation before approval

- Confirm whether any external website uses direct anon INSERT into `plan_interest`. If yes, move it to a validated/rate-limited server endpoint rather than reopening table-wide privileges.
- Run `supabase test db` on a disposable project/container **after** applying the proposed migration there; review all 19 checks and add negative runtime two-user tests for `subscriptions`.
- Exercise anonymous restaurant featured dishes and authenticated subscription gating in a development environment.
- Re-run `get_advisors(type=security)`, confirm four `rls_disabled_in_public` notices disappear and client grants are least privilege.
- Review app-level payment/plan endpoints, especially `activate-plan` (issue #7), before public rollout.
- Follow approved deployment process with backup, preflight, postflight and rollback plan. Never apply on production as part of a PR or agent run.

## Rollback outline (requires security approval)

Prefer a forward-only corrective migration over restoring broad historical grants. If a legacy client breaks, migrate that client to a safe server route or add precisely scoped policy. Do **not** disable RLS or restore anonymous write/delete access as a workaround.

## Durable state

This is a proposal. Remote database is still unchanged at 35 migrations. The source-control branch adds a proposed **36th** migration, not yet applied anywhere. Do not report security issue #6 as fixed until production migration and postflight advisor checks are approved, executed and verified.
