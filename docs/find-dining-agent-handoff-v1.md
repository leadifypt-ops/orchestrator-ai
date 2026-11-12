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
- Phase 1: AGENTS.md + PR typechecking (this PR).
- Phase 2: baseline lint/build checks, branch protection, human approvals, CODEOWNERS if appropriate.
- Phase 3: opt-in Codex review and trusted-issue-to-draft-PR runner using the official Codex GitHub integration, scoped permissions and secure secret management.
- Phase 4: scheduled status digests and selective task dispatch, subject to budgets and explicit security review.

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
