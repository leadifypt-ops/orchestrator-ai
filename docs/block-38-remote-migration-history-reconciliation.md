# Block 38 — Remote Migration History Reconciliation

## Scope

Block 38 is a governance and infrastructure block. It reconciles the Supabase
CLI migration history with schema already deployed through Block 37. It does
not run historical migration SQL, change the public schema, mutate product
data, alter application behavior, or touch Leadify.

## Initial audit

`supabase/migrations` contains 21 ordered SQL files from version
`20260611124608` through `20260628000100`. No file was removed, renamed,
reordered, or edited.

Before reconciliation, `supabase migration list --linked` showed all 21 local
versions and an empty Remote column. The remote schema nevertheless contained
the tables, columns, constraints, indexes, functions, triggers, policies, RLS,
and grants introduced by those migrations. Block 37 had also passed its remote
functional validation after direct SQL application.

## Materialization proof

The rollback-only audit at
`supabase/validation/block-38-remote-migration-materialization-audit.sql`
maps every local version to version-specific catalogue evidence. Later function
replacements are proven from their current definitions, including alias-aware
identity resolution and provenance-writing merge execution.

The audit fails closed if any version lacks evidence. It completed with:

`block_38_remote_migration_materialization_audit_valid`

No history repair was attempted before all 21 checks passed.

## Controlled reconciliation

The supported Supabase CLI history mechanism was used once:

```powershell
npx supabase migration repair <21 proven versions> --status applied --linked
```

`migration repair` marked only the proven versions as applied. No `db push`,
historical migration file, schema DDL, seed, reset, or destructive command was
executed.

After repair, `supabase migration list --linked` showed exact Local/Remote
alignment for all 21 versions. Direct read-only inspection of
`supabase_migrations.schema_migrations` confirmed every version and migration
name from `restaurant_visual_identity` through
`automatic_recovery_follow_up_routing`.

## No-change proof

`supabase/validation/block-38-public-schema-fingerprint.sql` fingerprints nine
independent catalogue groups:

- columns;
- constraints;
- indexes;
- functions;
- triggers;
- policies;
- RLS flags;
- `anon`/`authenticated` table grants;
- `anon`/`authenticated` routine grants.

Every fingerprint was identical before and after history repair. This proves
the reconciliation did not reapply migrations or change the public schema,
security boundary, or callable contracts.

The Block 38 per-version materialization audit and the Block 37 rollback-only
functional validation both passed again after repair.

## Commands and operational notes

Read-only and rollback-only commands:

```powershell
npx supabase migration list --linked
npx supabase db query --linked --file supabase/validation/block-38-remote-migration-materialization-audit.sql
npx supabase db query --linked --file supabase/validation/block-38-public-schema-fingerprint.sql
npx supabase db query --linked "select version, name from supabase_migrations.schema_migrations order by version"
npx supabase db push --linked --dry-run
```

The final authenticated dry-run completed with `Remote database is up to date`.
No migration was selected for execution and no remote change was made.

## Risks and limitations

- History repair asserts that existing schema corresponds to the tracked local
  files; it cannot reconstruct how historical SQL was originally deployed.
- The audit therefore uses concrete version-specific catalogue evidence and
  immutable local files rather than trusting object names alone.
- Public data was not locked or rewritten. The fingerprint deliberately covers
  schema and authorization state, not mutable application row contents.
- Future direct SQL deployments must be avoided. New schema changes should use
  a new ordered migration and the normal linked CLI migration flow.

## Validation status

- remote migration list before repair: 21 local / 0 remote;
- per-version remote materialization audit: passed for 21/21 versions;
- remote migration repair: 21 versions marked applied;
- remote migration list after repair: exact 21/21 Local/Remote alignment;
- public schema/security fingerprint before vs after: identical in 9/9 groups;
- Block 38 materialization audit after repair: passed;
- Block 37 rollback-only regression validation: passed;
- TypeScript: passed;
- focused ESLint: passed on the reconciliation surfaces;
- production build: passed;
- `git diff --check`: passed on the final documentation state;
- `db push --dry-run`: passed with `Remote database is up to date`.

## DevLog — Block 38

• Objetivo do bloco

Reconcile Supabase remote migration history with the schema already deployed
through Block 37, without executing historical DDL or changing product state.

• O que foi implementado

All 21 local migrations were mapped to version-specific remote catalogue
evidence and marked `applied` with the supported Supabase CLI repair mechanism.
Reusable materialization and schema-fingerprint validations were added.

• Descobertas importantes

The remote history was empty while the complete schema was materialized. Exact
Local/Remote alignment is now restored. Schema, authorization, and callable
contract fingerprints remained unchanged across the repair.

• Limitações

The repair records deployment history but cannot reconstruct the original
historical deployment path. Future schema changes must continue through new,
ordered migration files rather than direct SQL deployment.

• Validações executadas

Remote history before/after, 21-version materialization audit, nine-part schema
fingerprint before/after, direct history-table inspection, normal-flow CLI
dry-run, Block 37 rollback regression, TypeScript, focused ESLint,
`git diff --check`, and production build passed.

• Estado final

Block 38 is complete. Remote history exactly matches all 21 local migrations,
the public schema and security fingerprint remained unchanged, and the normal
CLI migration flow reports the remote database is up to date.

• Próximo passo lógico

Block 39 should add Business-wide reconciliation ownership reporting and
ageing/SLA visibility through the restored normal migration flow, preserving
explicit human assignment and avoiding new identity or recovery mutations.
