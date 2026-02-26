# OpenSpec changes

Each change lives under `openspec/changes/<change_id>/` and follows the "spec-driven" workflow
(`proposal.md` → `design.md` → `specs/**` → `tasks.md`).

## `.openspec.yaml`

Every change directory SHOULD include a `.openspec.yaml` descriptor.

Current fields:

- `schema`: workflow schema name (e.g. `spec-driven`)
- `created`: change creation date (`YYYY-MM-DD`)
- `depends_on` (optional): a list of other change ids this change depends on

Example:

```yaml
schema: spec-driven
created: 2026-02-26
depends_on:
  - m6-platform-optimization
```

## `depends_on` semantics

`depends_on` is a **baseline dependency** declaration:

- It makes review/implementation order explicit.
- It implies the dependent change **extends** the baseline(s) and MUST NOT re-define or copy baseline specs.
- Incremental specs should reference baseline spec files and only describe **deltas**.

Examples in this repo:

- M6 platform optimization uses the `NOVEL_ASK` interaction protocol described in
  `m6-interactive-question-adapters` → declare `depends_on: [m6-interactive-question-adapters]`.
- M7 platform-profile / platform-constraints specs extend the M6 baseline → declare
  `depends_on: [m6-platform-optimization]` and reference the baseline spec paths instead of duplicating them.

