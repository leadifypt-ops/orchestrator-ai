# Find Dining — agent handoff v1

Date: 2026-11-12. Status: proposal, not an active autonomous loop.

## Verified snapshot
- GitHub main last observed commit: `8f62bf3` (2026-08-02).
- Product master and consolidated DevLog are complete through Block 48, with a historical Supabase migration state of 33/33.
- Block 49 and migration `20260707000100_public_reservation_enablement_v3.sql` discussed in later work are **not on GitHub main**.
- Remote Supabase and unpublished local Codex workspace have not been checked. Do not assume their state.

## Intended workflow
1. A trusted GitHub Issue records a scoped task, acceptance tests and a risk rating.
2. Codex reads AGENTS.md, master and DevLogs, implements the task on a branch, runs checks and opens a **draft PR**.
3. GitHub Actions validates the PR. A coding/review automation can be added later with its own restricted identity and securely stored API credentials.
4. ChatGPT can review progress and give product direction from GitHub when invoked. This chat alone does not run continuously.
5. Human approval is needed to merge, deploy, apply remote migrations or change payment/reservation/guest data.

## First gate: reconcile local work (before Block 49/50)
- On the original development machine, inspect `git status`, local branches, untracked files and remotes.
- Preserve unpublished work on a separate branch after scanning for secrets. Do not overwrite anything.
- Compare local branch to main and review Block 49 migrations and DevLogs.
- Check current Supabase migration list and dry-run with read-only operations. Do **not** apply.
- Document exact discrepancies and create a reconciliation PR.

## Automation roadmap
- Phase 1: AGENTS.md and PR TypeScript CI, including a documented lockfile failure.
- Phase 2 (prepared but disabled in this PR): read-only Codex PR review and trusted GitHub Issue -> isolated Codex implementation -> draft PR runner. These will not execute Codex without explicit variables and a repository secret.
- Phase 3: baseline lint/build checks, branch protection, human approvals, cost controls and secure pilot before enabling agents.
- Phase 4: scheduled status digests and selective task dispatch after successful pilot.

## Security
No production database credentials in general-purpose agent jobs. Never execute untrusted PR code in a privileged secrets-enabled context. Disable automatic merges. Separate paid API usage and budgets from ChatGPT subscription. Limit runner time, retries, permissions, concurrency and number of tasks. Store secrets only in approved secret managers.

## Activation checklist
- [ ] Reconcile local Codex workspace and remote Supabase with GitHub.
- [ ] Review and merge PR for permanent agent rules and CI.
- [ ] Observe first successful baseline typecheck on a test PR.
- [ ] Protect main with required status checks and human review.
- [ ] Configure scoped Codex credentials, budget and workflow security.
- [ ] Run a harmless documentation-only issue-to-draft-PR trial.
- [ ] Enable further autonomous jobs only after the trial passes.

## 2026-11-12 validation and current backlog

- PR #1: https://github.com/leadifypt-ops/orchestrator-ai/pull/1
- First CI run `43156585420` failed at `npm ci` with `Missing: @swc/helpers@0.5.24 from lock file`. The TypeScript test did not run. This predates any Codex implementation and is tracked as [Issue #2](https://github.com/leadifypt-ops/orchestrator-ai/issues/2).
- Unpublished Block 49 recovery and non-mutating remote migration reconciliation are tracked as [Issue #3](https://github.com/leadifypt-ops/orchestrator-ai/issues/3).

## Opt-in Codex workflow activation (not yet done)

1. Review this PR, restore the correct latest source code and confirm remote migrations. Do not enable `CODEX_SYNC_CONFIRMED` until they match.
2. Merge the PR and protect `main` (required CI, PR review, no unattended merge).
3. Create an OpenAI API key with strict budget controls; store it only as GitHub repository secret `OPENAI_API_KEY`. GitHub Actions Codex uses paid API billing independent of ChatGPT subscription.
4. In repository Settings > Secrets and variables > Actions > Variables, enable `CODEX_REVIEW_ENABLED=true` to allow read-only PR reviews. This is optional and charges API usage.
5. Test a trusted non-sensitive issue. After the pilot, enable `CODEX_SYNC_CONFIRMED=true` and `CODEX_TASKS_ENABLED=true`, create the `codex-ready` label, and have the repo owner apply it only to a carefully reviewed, small, owner-created issue.
6. Ensure GitHub Actions is permitted to create pull requests and the default token can dispatch workflow runs. The workflow publishes a **draft** PR only; it dispatches the separate TypeScript check because PRs opened using GitHub's built-in `GITHUB_TOKEN` normally do not trigger regular PR workflows.
7. Never mark an issue `codex-ready` if it requests database migrations, production writes, secrets, payments or changes to protected operational workflows. Manually inspect the generated PR, CI and logs.

### Security design

The issue worker uses an API-key-backed Codex action with restricted workspace access and a read-only GitHub token. It uploads a patch, not credentials. A separate job with write permission applies the patch **without running its code**, rejects protected paths, creates a fresh branch and draft PR. This is an additional layer of protection, not a complete guarantee; require human review and branch protection. Lint/build and runtime behavior beyond TypeScript require additional validation before release.

### Current limitations

- There is no agent running continuously merely because files exist in GitHub.
- A local-only Codex workspace is not available to GitHub Actions without its code being published safely.
- The bot-generated PR may not trigger a regular PR review workflow through `GITHUB_TOKEN`; the runner explicitly dispatches TypeScript CI, but Codex PR review may need a separate authenticated trigger.
- No API key, runtime variable, branch protection or scheduled job has been configured by this PR.


## 2026-11-14 validated progress (append-only)

- The original development machine published recovered Block 49 to `recovery/find-dining-block49-20261114`; draft PR #4 tracks review. No work was lost, and `main` remains behind by two recovery commits.
- Direct read-only Supabase integration confirmed **35 historical migrations**, including 20260707000100 and 20260707000200; project is `ACTIVE_HEALTHY`. This does not certify complete schema parity.
- Security checks found legacy V1/V2 reservation RPCs accessible to anon without new readiness/capacity validation; see Issue #5.
- Four exposed public tables with RLS disabled and broad client grants; a proposed, unapplied RLS migration + pgTAP tests are in draft PR #8, related to Issue #6.
- Unauthenticated privileged plan activation was identified; a draft code-only patch is in PR #9, related to Issue #7.
- First `npm ci` failure was missing nested `@swc/helpers@0.5.24`. A narrow lockfile repair was committed to this branch; GitHub Actions job `132449222352` completed both `npm ci` and `npx tsc --noEmit` successfully. Verify the final workflow conclusion before marking required.
- Codex Desktop reached an account usage limit while researching Issue #6; no new task PR was published from Codex. ChatGPT prepared PRs #8 and #9 directly via GitHub connector.

### Minimum manual bootstrap remaining
1. Review and merge automation foundation PR #1 **only after** final CI and security review, with `main` protection rules.
2. Create a separately billed OpenAI API key and spending budget; store it as GitHub Actions secret `OPENAI_API_KEY` (never in chat). User must authorize provider billing and credentials.
3. When code and security integration are ready, set `CODEX_SYNC_CONFIRMED=true` and `CODEX_TASKS_ENABLED=true` in repo Actions variables. Optionally set `CODEX_REVIEW_ENABLED=true`.
4. Review and authorize the first low-risk `codex-ready` Issue to run the agent-to-draft-PR workflow. Never dispatch remote migration, security credential access, payment writes, guest communications or production changes.
5. Test a full issue -> Codex workspace patch -> draft PR -> CI -> review loop and apply execution budgets/timeouts. If the first run fails, keep automation disabled until corrected.

The GitHub Codespace/runner automation can continue after setup without a local computer. This ChatGPT conversation itself is not an always-running developer; it can review GitHub and Supabase whenever invoked or through a separately configured scheduled task. **Do not claim that two live agents are already operating autonomously.**
