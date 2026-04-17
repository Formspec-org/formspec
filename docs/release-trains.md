# Release Trains — Planned Migration

This document is **advisory**. It describes the planned migration of the Changesets pipeline to support per-tier release trains. It is **not** a changeset — it does not trigger a version bump.

## Current State

`config.json` drives a **single, atomic release pipeline**:

- `updateInternalDependencies: "patch"` — a bump in any workspace package triggers a patch bump in every downstream package.
- `fixed: []`, `linked: []` — no co-versioning groups declared.
- `ignore: ["@formspec-org/studio"]` — only the private application is excluded.

This works but couples unrelated tiers: a pre-1.0 change in `@formspec-org/chat` has no reason to ripple into `@formspec-org/engine`, and consumers cannot pin kernel separately from AI.

## Target State — Velocity Tiers

See [`/COMPAT.md`](../COMPAT.md) for the full tier breakdown and [ADR 0063](../thoughts/adr/0063-release-trains-by-tier.md) for the rationale.

Four release streams, one repo:

1. **Kernel** — `@formspec-org/types` (Tier 0)
2. **Foundation** — engine, layout, webcomponent, react, core, assist (Tiers 1–2)
3. **Integration** — adapters, studio-core (Tier 3)
4. **AI & Authoring** — mcp, chat (Tiers 4–5)

Within a stream, packages move together (Changesets `fixed` groups). Across streams they do not.

## Migration Path

This is deliberately sequenced so each step is independently reversible.

1. **THIS PR — documentation only.** Add `COMPAT.md`, per-tier `CHANGELOG.md` stubs, and the ADR. No config changes. No workflow changes. No version changes.
2. **Per-package changesets.** Teach authors to write narrower changesets that target a single tier. Still one pipeline, but the blast radius of each bump shrinks.
3. **Split CI workflow.** Add a matrix to `publish.yml` (or siblings) so each tier can release on its own trigger. Validate on a dry-run release branch before landing.
4. **Dual release tags.** Adopt distinct git tags per stream (e.g. `kernel-v…`, `foundation-v…`) so consumers and tooling can subscribe to one stream.

## What NOT To Change Yet

- Do **not** add `fixed` or `linked` groups to `config.json` until Step 3. The current atomic release remains the fallback while we validate the new workflow.
- Do **not** flip `updateInternalDependencies` to `"minor"` or `"major"`. `"patch"` is the safe default for today's coupled pipeline.
- Do **not** edit `.github/workflows/publish.yml` until Step 3; it requires a validated dry-run.
