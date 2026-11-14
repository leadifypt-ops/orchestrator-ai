<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Find Dining — permanent agent contract

## Source of truth
- Inspect actual repository state and applied migrations before assuming a task is finished.
- Read `docs/find-dine-master-v2.md` and `docs/find-dining-devlog-v2-blocks-39-48.md`; preserve historical DevLogs without deletion or silent rewriting.
- As of 2026-11-14, GitHub main still documents Block 48, but Block 49 was **recovered** to `recovery/find-dining-block49-20261114` and opened as draft PR #4. Supabase read-only checks found 35/35 historical migrations applied, including the two Block 49 migrations. This is NOT proof of full schema parity or readiness for live reservations. Do not start Block 50 until the recovered work and security issues #5/#6/#7 are reconciled and reviewed.

## Safety and boundaries
- Operate only on Find Dining files in this repo. Never modify Leadify or another project.
- All code changes go to feature branches and pull requests. Never push directly to main or merge on your own.
- Do not run production deployments, apply remote Supabase migrations, mutate production data, send communications, trigger payments or make reservation decisions without separate human approval.
- Reservations require human decisions; availability is informational. Preserve business/restaurant scope, Supabase RLS, audit journals, guest privacy and token security.
- Never log or commit credentials, customer PII or raw public confirmation tokens.
- Read official local Next.js docs before modifying Next.js code (rule above).

## Delivery contract
- For each task: acceptance criteria, minimal change, tests and checks, security/DB impact, blockers, DevLog append-only entry, next logical step.
- Check `npm ci`, `npx tsc --noEmit`, relevant tests, lint and build where feasible; distinguish historical failures from new regressions.
- Successful CI is not authorization to merge or deploy.
