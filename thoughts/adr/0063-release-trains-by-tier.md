# ADR 0063: Release Trains by Velocity Tier

**Status:** Proposed
**Date:** 2026-04-16

## Context

Formspec is a multi-language monorepo that ships twelve TypeScript packages, seven Rust crates, and one Python wheel from a single repository. All npm packages currently release atomically from one Changesets pipeline (`.github/workflows/publish.yml`), `updateInternalDependencies: "patch"` ensures that any version bump in any workspace package cascades to every downstream package.

The repository houses components that mature at dramatically different rates:

- **Kernel** — `@formspec-org/types`, `fel-core`, `formspec-core` (Rust). Normative spec shape and FEL semantics. Changes are rare and deliberate; breaks here ripple through every consumer.
- **Foundation** — `@formspec-org/engine`, `@formspec-org/layout`, `@formspec-org/webcomponent`, `@formspec-org/react`, `@formspec-org/core`, `@formspec-org/assist`. Already at `1.0.0` for several. Quarterly-ish cadence is realistic.
- **Integration** — `@formspec-org/adapters`, `@formspec-org/studio-core`, `formspec-py`. Still 0.x but shape is largely settled.
- **AI & Authoring** — `@formspec-org/mcp`, `@formspec-org/chat`. Pre-1.0; APIs churn monthly as the authoring loop is validated.

The atomic release produces two problems. First, **downstream coupling**: a minor bump in `@formspec-org/chat` (which is expected to churn) forces a patch bump in `@formspec-org/engine` via `updateInternalDependencies`, even when engine has zero changes. Consumers see phantom churn on a package they expected to be stable. Second, **consumer pinning has no target**: a vendor integrating Formspec into a regulated product wants to pin a stable kernel separately from a fast-moving AI surface. Today there is no such distinction exposed — every version moves together.

The dependency-fence work (`scripts/check-dep-fences.mjs`) already identifies seven ordered layers. Those layers collapse cleanly into four release-cadence tiers with real semantic meaning, not just structural layering.

## Decision

Split the release pipeline into **four velocity tiers**, each with its own CHANGELOG, version stream, and (eventually) CI job — all still in one repository.

| Tier                 | Members                                                                                                                           | Cadence        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 0 — Kernel           | `@formspec-org/types`; Rust `fel-core`, `formspec-core`, `formspec-eval`                                                          | 6–12 months    |
| 1–2 — Foundation     | `@formspec-org/engine`, `layout`, `webcomponent`, `react`, `core`, `assist`; Rust `formspec-lint`, `formspec-changeset`, `formspec-wasm` | 3–6 months     |
| 3 — Integration      | `@formspec-org/adapters`, `studio-core`; `formspec-py` (Python wheel)                                                             | Quarterly      |
| 4–5 — AI & Authoring | `@formspec-org/mcp`, `@formspec-org/chat`                                                                                         | Monthly        |

`@formspec-org/studio` (Tier 6) remains private and out-of-cadence.

Mechanics:

1. Each tier maintains its own `CHANGELOG.md` (top-level header identifies the tier and target cadence).
2. Packages within a tier co-version via Changesets `fixed` groups. Packages across tiers do not.
3. Each tier releases on its own CI job/trigger. `publish.yml` grows a matrix keyed by tier.
4. Consumers can claim supported combinations like `@formspec-org/types@1.x + @formspec-org/chat@0.x` with confidence that those version streams are independent.

The full consumer-facing matrix lives in [`/COMPAT.md`](../../COMPAT.md).

## Consequences

### Positive

- **AI/authoring ships monthly without shaking the kernel.** `chat` and `mcp` can iterate as aggressively as pre-1.0 requires without forcing phantom patches on `engine` or `types`.
- **Vendors can pin.** A long-tail integrator can anchor their supply chain on `@formspec-org/types@1.x` and treat AI packages as an independent dependency line.
- **Changelogs become readable.** Per-tier CHANGELOGs stop interleaving `webcomponent` fixes with `chat` feature drops. Reviewers can read one file and understand one story.
- **Releases stop being all-or-nothing.** Shipping Tier 4 does not require green CI on Tier 0's never-touched code.
- **Natural home for semver discipline.** Tier 0 is strict semver. Tier 4–5 is 0.x with breaking-at-minor expectations. Making the tier explicit makes the contract explicit.

### Negative

- **More CI complexity.** One atomic workflow becomes four tier-scoped jobs (plus shared build/test). Matrix wiring, per-tier tags, per-tier npm dist-tags all need care.
- **Cross-tier changes require coordination.** A change that touches kernel + foundation + AI must now produce three changesets instead of one. Authors need guidance.
- **Version drift is visible.** Today every `@formspec-org/*` package has the same version at the same moment. After the split, version numbers will diverge — consumer confusion is possible if docs don't set the expectation.
- **`updateInternalDependencies` behavior changes.** Currently a bump in any package cascades as a patch to all consumers. Per-tier releases mean cross-tier dep updates happen at tier boundaries, not per-commit.

### Migration Path

Each step is independently reversible.

1. **This PR — docs only.** Add `COMPAT.md`, four per-tier `CHANGELOG.md` stubs, this ADR, and `docs/release-trains.md`. No config changes. No workflow changes. No version changes. Purely sets context for what follows.
2. **Per-package changesets.** Update author guidance to write narrower changesets that target a single tier. Still one pipeline.
3. **Split CI workflow.** Add a matrix to `publish.yml` so each tier releases independently. Validate on a dry-run release branch before landing. This is the disruptive step and gets its own PR with explicit rollback plan.
4. **Dual release tags.** Adopt distinct git tags per stream (`kernel-v…`, `foundation-v…`, `integration-v…`, `ai-v…`) and `dist-tag` conventions on npm.

## Alternatives Considered

### Stay with atomic releases

Simplest to operate; matches the current pipeline exactly. Rejected because the cost of coupling compounds every time an AI-tier package bumps: either phantom kernel patches or a de-facto block on shipping AI changes. The monorepo's value comes from shared infra, not shared release cadence.

### Split the monorepo into separate repos per tier

Would solve the release-coupling problem at the cost of cross-cutting changes. Many real changes touch kernel semantics, engine behavior, and an AI wrapper in a single coherent PR. Four repos means four coordinated PRs, four CI pipelines that must agree, and a real risk of cross-repo version drift nobody can diagnose. The monorepo exists to make those changes cheap — giving that up is a much larger loss than the CI complexity per-tier trains introduce.

### Use Changesets `linked` instead of per-tier workflows

`linked` co-versions packages but still runs through one pipeline, one tag, one publish step. It narrows the cascade but does not let a tier release on its own cadence or its own trigger. It is a useful building block within a tier (this ADR uses `fixed` groups internally) but not a substitute for per-tier jobs.

## Status

Proposed. This PR lands only the documentation scaffolding (COMPAT.md, per-tier CHANGELOGs, this ADR, `docs/release-trains.md`). The CI split is the subject of a follow-on PR that carries its own dry-run validation.
