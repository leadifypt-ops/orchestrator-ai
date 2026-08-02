# Block 31 - Merge Governance & Recovery

## Scope

Block 31 adds controlled contact aliases and Business-visible merge audit history to manual guest identity merges. It does not introduce automatic merges, a public reservation change, cross-Business matching, or one-click undo.

## Contact aliases

When an identity becomes merged, its previous email and normalized phone are preserved as `guest_contact_aliases` for the active destination identity. Alias rows are Business-scoped, uniquely keyed by Business, contact type, and normalized value, and are read only to authenticated Business members through RLS.

The guest resolver remains contact-only: active canonical email, email alias, active normalized phone, then phone alias. It never matches by name and only returns active identities in the supplied Business. The alias table has no anonymous access and the public reservation contract is unchanged.

## Audit and recovery

`/business/guests/data-quality/audit` presents immutable merge records with timestamp, actor identifier, source and target snapshots, reassigned counts, preserved contacts, conflicts, and decision strategy. Recovery is audit-first: a suspected wrong merge requires review and a governed manual correction. No endpoint or UI automatically reverses a merge. A future recovery workflow must require explicit confirmation, Business membership validation, and a new immutable audit event.

## Validation note

The outstanding Block 30 `npm run build` validation remains blocked only by this environment being unable to fetch Google-hosted Geist and Geist Mono fonts; no application build or type error was reported.
