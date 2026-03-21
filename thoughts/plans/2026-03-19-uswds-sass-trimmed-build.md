# Plan: USWDS Sass Trimmed Build

**Date:** 2026-03-19
**Relates to:** ADR 0047 (CSS Architecture Split), ADR 0046 (Headless Component Adapters)
**Status:** Done

## Goal

Replace the 400KB USWDS CDN stylesheet + hand-maintained integration CSS overrides with a trimmed Sass build that includes only the USWDS component partials the adapter actually uses. Target output: ~30-40KB CSS, zero integration overrides, formspec-aware from the start.

## Current State

- Theme `stylesheets` loads the full USWDS CDN: `https://cdnjs.cloudflare.com/ajax/libs/uswds/3.11.0/css/uswds.min.css` (400KB)
- `integration-css.ts` carries ~30 lines of overrides to neutralize USWDS defaults that conflict with formspec layout (max-width, margins, step indicator sizing)
- The adapter uses ~20 USWDS component families (see inventory below)
- The full CDN includes ~60+ component families, grid system, typography scale, utilities — most unused

## USWDS Component Inventory

Classes used by the adapter, grouped by USWDS Sass package:

| USWDS Package | Classes Used |
|---|---|
| `usa-form-group` | `usa-form-group`, `usa-form-group--error` |
| `usa-label` | `usa-label` |
| `usa-input` | `usa-input`, `usa-input--error`, `usa-input-group`, `usa-input-prefix`, `usa-input-suffix` |
| `usa-textarea` | `usa-textarea`, `usa-textarea--error` |
| `usa-select` | `usa-select`, `usa-select--error` |
| `usa-checkbox` | `usa-checkbox`, `usa-checkbox__input`, `usa-checkbox__label` |
| `usa-radio` | `usa-radio`, `usa-radio__input`, `usa-radio__label` |
| `usa-date-picker` | `usa-date-picker` |
| `usa-file-input` | `usa-file-input`, `usa-file-input__target`, `usa-file-input__input`, `usa-file-input__instructions`, `usa-file-input__choose`, `usa-file-input__target--drag` |
| `usa-range` | `usa-range`, `usa-range--error` |
| `usa-fieldset` | `usa-fieldset`, `usa-fieldset--error`, `usa-legend` |
| `usa-hint` | `usa-hint` |
| `usa-error-message` | `usa-error-message` |
| `usa-button` | `usa-button`, `usa-button--outline`, `usa-button--unstyled` |
| `usa-button-group` | `usa-button-group`, `usa-button-group__item`, `usa-button-group--segmented` |
| `usa-step-indicator` | `usa-step-indicator`, `usa-step-indicator__segments`, `usa-step-indicator__segment`, `usa-step-indicator__segment--current`, `usa-step-indicator__segment--complete`, `usa-step-indicator__segment-label`, `usa-step-indicator__header`, `usa-step-indicator__heading`, `usa-step-indicator__heading-counter`, `usa-step-indicator__heading-text`, `usa-step-indicator__current-step`, `usa-step-indicator__total-steps` |
| `usa-sr-only` | `usa-sr-only` |

**Not used:** `usa-accordion`, `usa-alert`, `usa-banner`, `usa-breadcrumb`, `usa-card`, `usa-collection`, `usa-combo-box`, `usa-footer`, `usa-header`, `usa-hero`, `usa-icon`, `usa-identifier`, `usa-in-page-navigation`, `usa-layout-grid`, `usa-link`, `usa-list`, `usa-media-block`, `usa-memo`, `usa-modal`, `usa-nav`, `usa-pagination`, `usa-process-list`, `usa-search`, `usa-side-nav`, `usa-site-alert`, `usa-social-links`, `usa-summary-box`, `usa-table`, `usa-tag`, `usa-time-picker`, `usa-tooltip`, `usa-validation`, all utility classes.

## Steps

### Step 1: Add Sass tooling to `formspec-adapters`

```bash
npm install -D sass @uswds/uswds@3
```

Add to `package.json`:
```json
"scripts": {
  "build:css": "sass src/uswds/uswds-formspec.scss dist/uswds-formspec.css --style=compressed --load-path=node_modules/@uswds/uswds/packages",
  "build": "npm run build:css && tsc"
}
```

### Step 2: Create the trimmed Sass entry point

Create `src/uswds/uswds-formspec.scss`:

```scss
// USWDS core (settings, functions, mixins, tokens) — no output CSS
@forward 'uswds-core' with (
  // Override USWDS settings for formspec context
  $theme-show-notifications: false,
  $theme-font-path: '../fonts',  // or CDN path

  // Formspec integration: remove max-width constraint on inputs
  $theme-input-max-width: none,

  // Formspec integration: remove form-group top margin
  // (grid gap handles spacing)
  $theme-form-group-margin-top: 0,
);

// Only the component packages we actually use
@forward 'usa-form-group';
@forward 'usa-label';
@forward 'usa-input';
@forward 'usa-textarea';
@forward 'usa-select';
@forward 'usa-checkbox';
@forward 'usa-radio';
@forward 'usa-date-picker';
@forward 'usa-file-input';
@forward 'usa-range';
@forward 'usa-fieldset';
@forward 'usa-hint';
@forward 'usa-error-message';
@forward 'usa-button';
@forward 'usa-button-group';
@forward 'usa-step-indicator';

// Formspec-specific overrides that can't be handled via USWDS settings
.formspec-wizard .usa-step-indicator__heading { font-size: 1rem; }
.formspec-wizard .usa-step-indicator__current-step {
  width: 2rem;
  height: 2rem;
  padding: 0;
  font-size: 0.875rem;
  line-height: 2rem;
}
.formspec-wizard .usa-step-indicator__heading-text { font-weight: 600; }
```

Key insight: USWDS Sass settings like `$theme-input-max-width` and `$theme-form-group-margin-top` can replace most integration CSS overrides at the source.

### Step 3: Export compiled CSS as the integration string

Replace `integration-css.ts` content with a build step that reads the compiled CSS:

**Option A (build-time generation):** Add a script that runs after `build:css` and writes the compiled CSS into a `.ts` string export. The `.ts` file becomes generated, not hand-authored.

**Option B (Vite raw import):** If the adapter package moves to a Vite build (likely, given the webcomponent already uses Vite), use `import css from './uswds-formspec.css?inline'`. Simplest approach.

**Option C (static CSS file, no string injection):** Export the compiled CSS as a static file. The adapter's `integrationCSS` becomes a URL reference instead of inline CSS. The registry loads it via `<link>` instead of `<style>`. This is cleaner for caching but changes the injection model.

**Recommendation:** Option B if we move the adapter build to Vite. Option A otherwise.

### Step 4: Update the adapter to use compiled CSS

- Remove `integrationCSS` string constant from `integration-css.ts`
- Replace with import of compiled CSS (per chosen option above)
- The adapter's `integrationCSS` property on `RenderAdapter` now contains the full USWDS CSS for the components we use, plus the formspec overrides — all in one compiled output

### Step 5: Remove CDN dependency from theme

Update `examples/uswds-grant/grant.theme.json` — remove the `stylesheets` array entry:

```diff
-  "stylesheets": [
-    "https://cdnjs.cloudflare.com/ajax/libs/uswds/3.11.0/css/uswds.min.css"
-  ],
```

The adapter now carries its own CSS. Themes using the USWDS adapter no longer need to specify a CDN stylesheet.

### Step 6: Font loading

USWDS uses Source Sans Pro and Merriweather from its own font files. Options:

- **Self-host:** Copy USWDS font files into the adapter's dist. Set `$theme-font-path` accordingly.
- **System fonts:** Override `$theme-typeface-tokens` to use system font stacks (Public Sans is already available as a Google Font and is the actual USWDS v3 default). No font files needed.
- **CDN fonts:** Keep a CDN reference for just the fonts (tiny compared to the full CSS).

**Recommendation:** System fonts with Public Sans fallback. The theme already declares `'Public Sans'` in its typography tokens.

## Verification

1. Visual diff: screenshot the USWDS grant example before and after — should be pixel-identical
2. File size: compiled CSS should be <50KB (vs 400KB CDN)
3. Integration overrides: `integration-css.ts` string should be empty or contain only formspec-specific overrides that can't be expressed as USWDS settings
4. No CDN requests: network tab should show zero external CSS fetches for USWDS
5. All existing tests pass

## Risks

- **USWDS Sass API stability.** USWDS v3 Sass API uses `@forward`/`@use` and is documented, but individual `$theme-*` settings may change between minor versions. Pin `@uswds/uswds` to a specific version.
- **Font rendering differences.** Switching from CDN-loaded Source Sans Pro to system fonts may cause subtle rendering differences. Acceptable for a reference implementation.
- **Build time.** USWDS Sass compilation is slow (~3-5s). Only runs when SCSS changes, not on every TypeScript build. Can be cached.

## Estimated Effort

Half a day. The USWDS Sass API is well-documented and the component list is known. Most time goes to verifying visual parity and font loading.
