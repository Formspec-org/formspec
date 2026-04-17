# Formspec Compatibility Matrix

> **Current Status:** The npm release pipeline is now split into four per-tier jobs (kernel / foundation / integration / ai) that run sequentially on `main`. Each tier publishes under its own dist-tag (`<tier>-latest`) and opens its own `changeset-release/<tier>` PR. See [ADR 0063](./thoughts/adr/0063-release-trains-by-tier.md) and [Authoring a changeset](#authoring-a-changeset-tier-aware) below.

Formspec is a multi-language monorepo (TypeScript packages, Rust crates, a Python package) whose components mature at different rates. The stable kernel types evolve slowly — most of the engine runtime moves quarterly, and the AI/authoring surface is still pre-1.0 and moves monthly. To let consumers pin risk appropriately, packages are grouped into **velocity tiers**. Once release-train split is active, a vendor may — for example — pin `@formspec-org/types@1.x` for long-term stability while tracking `@formspec-org/chat@0.x` on a faster cadence.

Each tier has its own CHANGELOG (where applicable), its own target cadence, and — after the split — its own release stream. Within a tier, packages move together; across tiers they do not.

## Package Matrix

| Package                       | Tier                 | Cadence        | Current Version | Requires                       |
| ----------------------------- | -------------------- | -------------- | --------------- | ------------------------------ |
| `@formspec-org/types`         | 0 — Kernel           | 6–12 months    | 0.1.0           | —                              |
| `@formspec-org/engine`        | 1 — Foundation       | 3–6 months     | 1.0.0           | `@formspec-org/types@0.1.x`    |
| `@formspec-org/layout`        | 1 — Foundation       | 3–6 months     | 1.0.0           | `@formspec-org/types@0.1.x`    |
| `@formspec-org/webcomponent` | 2 — Foundation       | 3–6 months     | 1.0.0           | `@formspec-org/engine@1.x`     |
| `@formspec-org/react`         | 2 — Foundation       | 3–6 months     | 0.1.0           | `@formspec-org/engine@1.x`     |
| `@formspec-org/core`          | 2 — Foundation       | 3–6 months     | 0.1.0           | `@formspec-org/engine@1.x`     |
| `@formspec-org/assist`        | 2 — Foundation       | 3–6 months     | 0.1.0           | `@formspec-org/engine@1.x`     |
| `@formspec-org/adapters`      | 3 — Integration      | Quarterly      | 0.1.0           | `@formspec-org/core@0.1.x`     |
| `@formspec-org/studio-core`   | 3 — Integration      | Quarterly      | 0.1.0           | `@formspec-org/core@0.1.x`     |
| `@formspec-org/mcp`           | 4 — AI & Authoring   | Monthly        | 0.2.0           | `@formspec-org/studio-core@0.1.x` |
| `@formspec-org/chat`          | 5 — AI & Authoring   | Monthly        | 0.1.0           | `@formspec-org/mcp@0.2.x`      |
| `@formspec-org/studio`        | 6 — Applications     | Out-of-cadence | 0.1.0 (private) | all lower tiers                |

### Rust crates (workspace version `0.1.0`)

| Crate                  | Tier               | Notes                                                       |
| ---------------------- | ------------------ | ----------------------------------------------------------- |
| `fel-core`             | 0 — Kernel         | FEL grammar, parser, evaluator — normative logic            |
| `formspec-core`        | 0 — Kernel         | Core types; emits into `@formspec-org/types`                |
| `formspec-eval`        | 0 — Kernel         | Evaluation primitives shared by runtime + tools             |
| `formspec-lint`        | 1 — Foundation     | Lint rules; consumed by tools tier                          |
| `formspec-changeset`   | 1 — Foundation     | Changeset primitives for authoring                          |
| `formspec-wasm`        | 1 — Foundation     | WASM glue; consumed exclusively by `@formspec-org/engine`   |
| `formspec-py`          | 3 — Integration    | Python bindings; ships as the `formspec-py` wheel           |

All crates currently move together at workspace version `0.1.0`. Kernel-tier crates back `@formspec-org/types`; Foundation-tier crates back `@formspec-org/engine` (WASM).

### Python

| Package       | Tier            | Cadence   | Current Version | Requires                                  |
| ------------- | --------------- | --------- | --------------- | ----------------------------------------- |
| `formspec-py` | 3 — Integration | Quarterly | 0.1.0           | Matches kernel + foundation Rust versions |

`formspec-py` ships via `.github/workflows/publish-pypi.yml` on `py-v*` tags and is already decoupled from the npm pipeline at the workflow level, even while version numbers are currently aligned.

## Tier Definitions

### Tier 0 — Kernel

**Members:** `@formspec-org/types`, `formspec-types` (TypeScript build target), `fel-core`, `formspec-core` (Rust), `formspec-eval`.

The structural and semantic contract of Formspec. Schema shapes, FEL grammar, core evaluation primitives. Breaks here ripple through every other tier.

- **Cadence:** 6–12 months between minor releases. Patch releases only for correctness bugs.
- **Semver discipline:** strict. No silent behavior changes.
- **Vendors pin here.** A vendor or platform integrating Formspec should pin the kernel tier as the anchor for their supply chain.

### Tier 1–2 — Foundation

**Members:** `@formspec-org/engine`, `@formspec-org/layout`, `@formspec-org/webcomponent`, `@formspec-org/react`, `@formspec-org/core`, `@formspec-org/assist`. Rust: `formspec-lint`, `formspec-changeset`, `formspec-wasm`.

Runtime and presentation primitives built on the kernel. Engine state management, layout resolution, component registry, rendering bridges.

- **Cadence:** 3–6 months.
- **Semver discipline:** strict for 1.x packages; tracking toward 1.x for 0.x packages.
- **Moves as a unit within its tier.** Foundation packages are co-versioned because cross-package contracts (engine ↔ webcomponent, engine ↔ react) are tight.

### Tier 3 — Integration

**Members:** `@formspec-org/adapters`, `@formspec-org/studio-core`, `formspec-py`.

Adapters that integrate Formspec with external data and tooling surfaces. Studio runtime (headless). Python backend.

- **Cadence:** Quarterly.
- **Semver discipline:** strict once past 1.0. Currently 0.x while shape stabilizes.

### Tier 4–5 — AI & Authoring

**Members:** `@formspec-org/mcp`, `@formspec-org/chat`.

AI-adjacent and authoring-experience surface. Pre-1.0; APIs still moving as the authoring loop is validated.

- **Cadence:** Monthly.
- **Semver discipline:** 0.x — breaking changes expected at minor bumps. Consumers should expect to update these on every cadence.

### Tier 6 — Applications

**Members:** `@formspec-org/studio` (private).

Applications built on top of the lower tiers. Not published to npm; version moves with internal release cycles.

- **Cadence:** Out-of-cadence.
- **Semver discipline:** N/A (private).

## Authoring a changeset (tier-aware)

Each `.changeset/*.md` file MUST declare the release tier it belongs to. The
tier controls which `publish.yml` job picks the changeset up and what
dist-tag its packages publish under.

**Format.** After the standard Changesets frontmatter, the first line of the
summary body must contain an HTML-comment sentinel:

```md
---
"@formspec-org/engine": minor
"@formspec-org/webcomponent": minor
---

<!-- tier: foundation -->

Describe the change here as usual. Downstream CHANGELOG entries drop the
sentinel automatically.
```

Valid tier values: `kernel`, `foundation`, `integration`, `ai`. The sentinel
lives in the body (not in frontmatter) because Changesets' own parser
rejects any frontmatter key that is not a `<package>: <bump-type>` pair.

**One tier per changeset.** A changeset may only bump packages from a single
tier. Cross-tier changes — e.g. a shared-type update in `@formspec-org/types`
that also tweaks `@formspec-org/engine` — MUST be authored as two separate
changesets (one tagged `tier: kernel`, one tagged `tier: foundation`). The
`check:changesets` script enforces this.

**Validation.** Run locally before pushing:

```bash
npm run check:changesets   # validates tier sentinel + single-tier packages
npm run changeset          # interactive author
```

`npm run docs:check` also invokes `check:changesets`, so CI catches missing
or mis-declared tiers.

**Dry-run a tier release locally.**

```bash
# Author a few throwaway changesets with tier sentinels, then:
node scripts/changeset-tier-filter.mjs foundation
npx changeset version      # only foundation packages bump
node scripts/changeset-tier-filter.mjs --restore
```

The filter moves out-of-tier `*.md` files to `.changeset-scratch/` for the
duration of the run and restores them afterward. `.github/workflows/publish.yml`
runs the same script per tier before invoking the Changesets GitHub Action.

**Dist-tags.** Each tier publishes with `--tag <tier>-latest` (e.g.
`kernel-latest`, `ai-latest`). The default `latest` tag is intentionally not
used — consumers opt into a tier's cadence explicitly via `npm install
@formspec-org/mcp@ai-latest`, for example.
