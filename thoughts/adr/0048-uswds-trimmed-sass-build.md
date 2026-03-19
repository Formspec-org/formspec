# ADR 0048: USWDS Trimmed Sass Build

**Status:** Accepted
**Date:** 2026-03-19

## Context

The USWDS adapter (ADR 0046) requires USWDS v3 CSS to style its `usa-*` markup. Today this CSS arrives via two mechanisms:

1. **CDN stylesheet** — themes include `https://cdnjs.cloudflare.com/ajax/libs/uswds/3.11.0/css/uswds.min.css` (400KB) in their `stylesheets` array. This pulls the entire USWDS component library: 60+ component families, the full grid system, typography scale, and utility classes.

2. **Integration CSS** — a hand-maintained ~30-line string constant in `integration-css.ts` (ADR 0047) that overrides USWDS defaults conflicting with formspec layout primitives (`max-width` on inputs, `margin-top` on form groups, step indicator sizing).

This approach has three problems:

- **Payload.** The adapter uses ~15 USWDS component families. The CDN delivers ~60+. Over 85% of the CSS is dead weight.
- **External dependency.** Every form load makes a blocking CDN request. Offline use, air-gapped environments, and CDN outages all break rendering.
- **Override fragility.** Integration CSS fights USWDS defaults after the fact. USWDS provides Sass settings (`$theme-input-max-width`, `$theme-form-group-margin-top`) that configure these values at the source — but only if you compile from Sass.

ADR 0047 identified this as a future improvement: "Replace the CDN stylesheet + integration overrides with a Sass build using USWDS component-level partials."

## Decision

### Add a trimmed USWDS Sass build to `formspec-adapters`

Install `sass` and `@uswds/uswds@3` as dev dependencies in `formspec-adapters`. Create a Sass entry point (`src/uswds/uswds-formspec.scss`) that:

1. Imports `uswds-core` with formspec-specific settings overrides (eliminating most integration CSS at the source)
2. `@forward`s only the ~15 USWDS component packages the adapter actually uses
3. Appends a small block of formspec-specific overrides that cannot be expressed as USWDS settings

### Component inventory

Only these USWDS packages are included:

| Package | Why |
|---|---|
| `usa-form-group` | Field wrapper with error state |
| `usa-label` | Field labels |
| `usa-input` | Text/number/date inputs |
| `usa-textarea` | Multiline text |
| `usa-select` | Dropdown select |
| `usa-checkbox` | Single checkbox + group |
| `usa-radio` | Radio button groups |
| `usa-date-picker` | Date picker component |
| `usa-file-input` | File upload |
| `usa-range` | Slider/range input |
| `usa-fieldset` | Fieldset/legend wrapper |
| `usa-hint` | Help text |
| `usa-error-message` | Validation error display |
| `usa-button` | Submit/action buttons |
| `usa-button-group` | Button grouping |
| `usa-step-indicator` | Wizard progress indicator |

Everything else (`usa-accordion`, `usa-alert`, `usa-banner`, `usa-header`, `usa-nav`, `usa-table`, `usa-layout-grid`, all utility classes, etc.) is excluded.

### USWDS settings replace integration overrides

These USWDS Sass settings eliminate the need for runtime CSS overrides:

| Setting | Value | Replaces |
|---|---|---|
| `$theme-input-max-width` | `none` | `.formspec-grid .usa-input { max-width: 100% }` |
| `$theme-form-group-margin-top` | `0` | `.formspec-grid .usa-form-group { margin-top: 0 }` |
| `$theme-show-notifications` | `false` | Suppresses USWDS compile-time banner |

Remaining overrides that have no USWDS setting equivalent (fieldset reset, label/hint margin reset, step indicator sizing) stay as Sass rules appended after the component imports.

### Build pipeline

A `build:css` npm script compiles the Sass entry point to compressed CSS. A `build:integration-css` script reads the compiled CSS and generates `integration-css.ts` as a string export — preserving the existing `integrationCSS` contract from ADR 0047. The adapter's `build` script runs both before `tsc`.

### Eliminate CDN dependency

Themes using the USWDS adapter no longer need a `stylesheets` entry for the USWDS CDN. The adapter carries its own CSS via `integrationCSS`. The example theme (`grant.theme.json`) is updated to remove the CDN reference.

### Font strategy

Use system fonts. The theme already declares `'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` in its typography tokens. USWDS font file loading is disabled via `$theme-typeface-tokens` overrides. No font files are bundled.

## Consequences

### Positive

- **~90% smaller CSS payload.** ~15 component packages instead of 60+. Expected output ~30-40KB vs 400KB.
- **Zero external dependencies at runtime.** No CDN request. Works offline and in air-gapped environments.
- **Overrides at the source.** USWDS settings handle most layout conflicts that previously required runtime CSS overrides.
- **Adapter is self-contained.** The adapter package carries everything needed to render — components, behavior, and styles. No theme-level `stylesheets` coordination required.

### Negative

- **Build-time cost.** USWDS Sass compilation adds ~3-5s to the adapter build. Only runs when SCSS changes.
- **USWDS version pinning.** Must pin `@uswds/uswds` to a specific version. Sass API (`$theme-*` settings, package names) may change between USWDS minor versions.
- **Generated file.** `integration-css.ts` becomes a build artifact. Must not be hand-edited; regenerated by the build script.

## Alternatives Considered

### Keep CDN + integration CSS (status quo)

Rejected. 400KB of dead CSS, external runtime dependency, and fragile override maintenance. The plan (documented in ADR 0047) always called for replacing this.

### Vite raw import (`?inline`)

Considered for importing the compiled CSS directly in TypeScript. Would require moving the adapter to a Vite build. The adapter currently uses plain `tsc` — adding Vite just for one CSS import is unnecessary complexity. A simple build script that generates the `.ts` export is simpler and keeps the build toolchain minimal. Can revisit if the adapter moves to Vite for other reasons.

### Static CSS file with `<link>` injection

Would require changing the `integrationCSS` contract from inline string to URL reference. Better for caching but changes the injection model established in ADR 0047. Not worth the disruption for a reference implementation.
