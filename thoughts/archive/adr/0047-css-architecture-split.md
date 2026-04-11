# ADR 0047: CSS Architecture Split — Layout vs Default vs Adapter Integration

**Status:** Accepted
**Date:** 2026-03-19

## Context

The webcomponent's `formspec-base.css` was a monolithic 1700-line file containing three categories of CSS interleaved together:

1. **Structural layout** (~270 lines): `.formspec-grid`, `.formspec-stack`, `.formspec-columns`, `.formspec-page`, `.formspec-wizard` shell, `.formspec-repeat`, `.formspec-group`, responsive breakpoints
2. **Default visual styling** (~1400 lines): field borders, error colors, card shadows, wizard chrome, tab appearance, screener, submit button, rating stars, etc.
3. **Bare element resets** (~80 lines): `input`, `select`, `textarea`, `label`, `button`, `h1`-`h6` scoped under `:not([data-adapter])`

When a design-system adapter (e.g., USWDS per ADR 0046) is activated, only category 3 was gated via the `[data-adapter]` attribute. Categories 1 and 2 applied unconditionally. This caused cascading conflicts:

- USWDS sets `max-width: 30rem` on `.usa-input` — formspec's grid expects inputs to fill their cells
- USWDS sets `margin-top: 1.5rem` on `.usa-form-group` — formspec's grid gap already handles inter-field spacing
- Default visual rules (`.formspec-error` border-left, wizard step colors) applied on top of USWDS's own error and wizard patterns

Each conflict required a bandaid override scoped under `.formspec-container[data-adapter]`. This was unsustainable — every new USWDS component would introduce new collisions.

## Decision

### Split `formspec-base.css` into two files

**`formspec-layout.css`** — Pure structural layout, always loaded. Contains visibility, screen-reader-only, container flex/gap, stack, grid, columns, page structure, conditional-group, repeat, group, wizard/tabs structural shells, and responsive breakpoints. **Zero visual opinions** — no colors, borders, backgrounds, shadows, or font sizes.

**`formspec-default.css`** — Visual styling for the default adapter. Contains bare element resets, field chrome, error styling, toggle/checkbox/radio appearance, card/panel/alert/badge/modal/popover styles, wizard/tabs visual chrome (step indicators, nav buttons, sidenav), screener, submit button, slider, rating, file upload, signature, data table, validation summary. Loaded alongside layout CSS; its rules are visually overridden (not disabled) when a design-system adapter provides its own styling.

### Add `integrationCSS` to the adapter interface

Extend `RenderAdapter` with an optional `integrationCSS?: string` property:

```typescript
interface RenderAdapter {
    name: string;
    components: Partial<Record<string, AdapterRenderFn>>;
    integrationCSS?: string;
}
```

When `globalRegistry.setAdapter('uswds')` is called, the registry injects the adapter's `integrationCSS` into a `<style id="formspec-adapter-integration">` tag in the document head. When the adapter changes or resets, the old style tag is removed. This keeps integration rules co-located with the adapter.

### USWDS integration CSS

The USWDS adapter carries a small (~30 line) integration stylesheet that resolves known conflicts:

```css
/* Inputs fill their grid cells instead of capping at 30rem */
.formspec-grid .usa-input,
.formspec-grid .usa-textarea,
.formspec-grid .usa-select { max-width: 100%; }

/* Grid gap handles spacing, not USWDS margins */
.formspec-grid .usa-form-group,
.formspec-stack .usa-form-group { margin-top: 0; }

/* Scale step indicator to formspec wizard proportions */
.formspec-wizard .usa-step-indicator__heading { font-size: 1rem; }
.formspec-wizard .usa-step-indicator__current-step {
  width: 2rem; height: 2rem; padding: 0;
  font-size: 0.875rem; line-height: 2rem;
}
```

This is exported as a TypeScript string constant (`integration-css.ts`) — single source of truth, no separate `.css` file to keep in sync.

## Consequences

### Positive

- **Clean adapter isolation.** Design-system adapters no longer fight with formspec's default visual CSS. Layout primitives (grid, stack) work universally; visual opinions are layered.
- **No more bandaid overrides.** Adapter-specific conflicts are handled by the adapter's own integration CSS, injected/removed on adapter switch.
- **Smaller payload when needed.** Consumers who only use a design-system adapter can theoretically skip `formspec-default.css` entirely (not currently automated, but the seam exists).
- **Integration CSS is co-located.** The USWDS adapter owns its overrides — they ship with the adapter package, not scattered in `formspec-base.css`.

### Negative

- **Two CSS imports instead of one.** Consumers must import both `formspec-layout.css` and `formspec-default.css`. Minor friction.
- **Split judgment calls.** Some rules straddle layout and visual (e.g., wizard sidenav button resets, grid gap values). The boundary requires judgment and may drift.
- **Integration CSS is a string constant.** No Sass compilation, no source maps. Acceptable at ~30 lines but won't scale to hundreds.

### Future

- **Trimmed USWDS Sass build.** Replace the CDN stylesheet + integration overrides with a Sass build using USWDS component-level partials. This would drop the 400KB CDN dependency to ~30KB and eliminate most integration overrides. Tracked as a TODO in `integration-css.ts`.
- **Conditional default CSS loading.** When an adapter is active, `formspec-default.css` could be skipped entirely via dynamic import or build-time tree-shaking. Not needed yet but the file boundary enables it.

## Alternatives Considered

### Shadow DOM for style isolation

Rejected. Shadow DOM would break the theme system's stylesheet cascade — themes load external stylesheets that must reach form elements. Light DOM is correct for formspec.

### Replace formspec layout with USWDS grid (`usa-layout-grid`)

Rejected. Would require the planner to emit different layout nodes per adapter — massive scope increase. The formspec grid/stack/page primitives are structural contracts that work across design systems; the conflicts come from visual opinions, not structural incompatibility.

### Scope all default visual rules under `:not([data-adapter])`

Considered but rejected in favor of the file split. `:not([data-adapter])` scoping would keep everything in one file but add selector complexity to every rule, increase specificity, and make it harder to reason about which styles apply when.
