# Changesets

Managed by `@changesets/cli`. Full docs at [changesets/changesets](https://github.com/changesets/changesets). Config in [config.json](./config.json).

Tier rationale and decision table: [ADR 0063](../../thoughts/adr/0063-release-trains-by-tier.md).

## npm releases (maintainers)

Pushes to `main` run [.github/workflows/publish.yml](../.github/workflows/publish.yml). The workflow runs **four per-tier jobs sequentially** (kernel → foundation → integration → ai) — each one filters `.changeset/*.md` by tier, opens a `changeset-release/<tier>` PR, and publishes under `--tag <tier>-latest`. Publishing uses **npm Trusted Publishing** (OIDC from GitHub Actions), not a long-lived `NPM_TOKEN`.

**Adding a new `@formspec-org/*` workspace package:** before the first successful publish, open that package on [npmjs.com](https://www.npmjs.com/), go to **Package settings → Trusted publishing**, and connect **GitHub Actions** with repository `Formspec-org/formspec` and workflow file **`publish.yml`** (name must match exactly). Without this, the registry may return a misleading `E404` on publish. The workflow installs **npm ≥ 11.5.1** because Trusted Publishing requires that CLI version. Also add the package to `TIER_PACKAGES` in `scripts/changeset-tiers.mjs` so the filter and lint recognise it.

## Authoring a changeset (tier-aware)

Each `.changeset/*.md` file MUST declare its release tier. The tier controls which `publish.yml` job picks the changeset up and what dist-tag its packages publish under.

**Format.** After the standard Changesets frontmatter, the first line of the summary body must contain an HTML-comment sentinel:

```md
---
"@formspec-org/engine": minor
"@formspec-org/webcomponent": minor
---

<!-- tier: foundation -->

Describe the change here as usual. Downstream CHANGELOG entries drop the
sentinel automatically.
```

Valid tier values: `kernel`, `foundation`, `integration`, `ai`. The sentinel lives in the body (not in frontmatter) because Changesets' own parser rejects any frontmatter key that is not a `<package>: <bump-type>` pair.

**One tier per changeset.** A changeset may only bump packages from a single tier. Cross-tier changes — e.g. a shared-type update in `@formspec-org/types` that also tweaks `@formspec-org/engine` — MUST be authored as two separate changesets (one tagged `tier: kernel`, one tagged `tier: foundation`). The `check:changesets` script enforces this.

**Validation.** Run locally before pushing:

```bash
npm run check:changesets   # validates tier sentinel + single-tier packages
npm run changeset          # interactive author
```

`npm run docs:check` also invokes `check:changesets`, so CI catches missing or mis-declared tiers.

**Dry-run a tier release locally.**

```bash
# Author a few throwaway changesets with tier sentinels, then:
node scripts/changeset-tier-filter.mjs foundation
npx changeset version      # only foundation packages bump
node scripts/changeset-tier-filter.mjs --restore
```

The filter moves out-of-tier `*.md` files to `.changeset-scratch/` for the duration of the run and restores them afterward. `.github/workflows/publish.yml` runs the same script per tier before invoking the Changesets GitHub Action.

**Dist-tags.** Each tier publishes with `--tag <tier>-latest` (e.g. `kernel-latest`, `ai-latest`). The default `latest` tag is intentionally not used — consumers opt into a tier's cadence explicitly via `npm install @formspec-org/mcp@ai-latest`, for example.
