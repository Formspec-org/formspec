# ADR-0019: Theme Cascade Implementation and Default Theme

**Status**: Implemented
**Date**: 2026-02-24
**Authors**: exedev, Claude (AI)
**Deciders**: exedev
**Depends on**: [ADR-0020: CSS Integration and Design System Interop](0020-css-integration-and-design-system-interop.md)

---

## 1. Context and Problem Statement

The theme spec (Tier 2) defines a 5-level presentation cascade — from form-wide Tier 1 hints at the bottom to per-item theme overrides at the top — but the renderer had no implementation of this cascade. Theme documents existed as a data model concept only: the `ThemeDocument` type was threaded through the codebase but never resolved into effective presentation decisions.

Concretely, the following problems existed:

- **No cascade resolver.** The renderer had no function that took a theme document, an item descriptor, and Tier 1 hints and produced a merged `PresentationBlock`. Every rendering path made ad-hoc decisions.
- **No default theme.** When no theme was provided, the renderer fell back to scattered hardcoded defaults. There was no single document expressing baseline presentation.
- **Weak types.** `Tier1Hints` used `any` for layout and style sub-objects. `ThemeDocument` used bare `string` for `$formspecTheme` instead of the literal `'1.0'`. `SelectorMatch.dataType` was `string` instead of the schema's 12-value enum. These weak types allowed silent mismatches at compile time.
- **Incorrect ARIA usage.** `aria-description` (not a valid ARIA attribute) was used instead of `aria-describedby`. Display items had `role="status"` applied unconditionally, imposing live-region semantics on static content.
- **Two rendering paths with no theme coordination.** The component-document path (`renderActualComponent`) and the definition-fallback path (`renderItem`) each made independent widget and presentation choices with no shared theme resolution.
- **Multiple pre-existing bugs.** Breakpoints ignored the schema's integer-pixel requirement, stylesheet injection had no deduplication, `selectAll` in `CheckboxGroup` used a broken selector, readonly targeted the wrapper instead of the input, and `getDefaultComponent` was missing cases for several data types.

## 2. Decision Drivers

- **The spec defines cascade semantics that must be implemented, not approximated.** The theme spec (section 5) prescribes a specific 5-level precedence chain with distinct merge semantics per property kind. The renderer is the reference implementation and must follow it exactly.
- **Theme resolution must be testable in isolation.** Mixing cascade logic with DOM rendering makes it untestable without a browser. A pure-function resolver can be unit-tested against the spec's cascade rules directly.
- **A default theme prevents "null theme" brokenness.** Without a baseline, missing theme means missing presentation decisions. The renderer should always have a complete theme, with explicit opt-out if desired.
- **Component documents are prescriptive; themes are advisory.** When a component document explicitly selects a widget (e.g., `"component": "RadioGroup"`), the theme must not silently override that choice. The theme's widget recommendation only applies in the definition-fallback rendering path.
- **Types must match the schema.** Literal unions and typed interfaces catch mismatches at compile time rather than at runtime through silent selector failures.

## 3. Decisions

### 3.1 Standalone cascade resolver module (`theme-resolver.ts`)

A new module `packages/formspec-webcomponent/src/theme-resolver.ts` implements the spec's presentation cascade as pure functions with zero DOM dependencies.

**`resolvePresentation(theme, item, tier1)`** implements the full 5-level precedence chain:

1. Tier 1 `formPresentation` (lowest) — form-wide defaults like `labelPosition`
2. Tier 1 `item.presentation.widgetHint` — per-item definition hints
3. Theme `defaults` — theme-wide baseline
4. Theme `selectors` — matching selectors applied in document order (later overrides earlier)
5. Theme `items[key]` — per-item theme overrides (highest)

Merge semantics follow the spec precisely:

- **`cssClass`** is unioned across cascade levels via `Set`-based deduplication. Per the schema: "Merged (unioned) across cascade levels, not replaced."
- **`style`, `widgetConfig`, `accessibility`** are shallow-merged (property-oriented spread, not wholesale replacement).
- **Scalar properties** (`widget`, `labelPosition`, `fallback`) are overridden by higher levels.

**`resolveWidget(presentation, isAvailable)`** resolves the preferred widget with a fallback chain, checked against the component registry. When the preferred widget and all fallbacks are unavailable, it emits `console.warn` per spec section 7 error handling requirements and returns `null` to fall through to default component selection.

**`selectorMatches(match, item)`** implements AND semantics when both `type` and `dataType` are present on a `SelectorMatch`. Guards against empty match objects (returns `false`).

File: `packages/formspec-webcomponent/src/theme-resolver.ts`

### 3.2 Strong type system matching the JSON schema

All types in `theme-resolver.ts` are derived from the JSON schema definitions:

- **`FormspecDataType`** — literal union of all 13 data types (`'string' | 'text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'dateTime' | 'time' | 'uri' | 'attachment' | 'choice' | 'multiChoice' | 'money'`). Prevents silent selector match failures from typos.
- **`ThemeDocument`** — `$formspecTheme: '1.0'` as a string literal type, not `string`.
- **`Page`** and **`Region`** — fully typed interfaces replacing `any[]`.
- **`LayoutHints`** and **`StyleHints`** — typed interfaces replacing `any` in `Tier1Hints`.
- **`PresentationBlock`** — `widgetConfig` typed as `Record<string, unknown>` (not `any`) for open-ended fields.
- **`SelectorMatch`** — `dataType` uses `FormspecDataType` for compile-time validation.

These types are exported and consumed by the `RenderContext` interface (`packages/formspec-webcomponent/src/types.ts`), which now exposes `resolveItemPresentation(item: ItemDescriptor): PresentationBlock` to all component plugins.

### 3.3 Integration into `FormspecRender`

Theme resolution is wired into the web component (`packages/formspec-webcomponent/src/index.ts`) through three integration points:

**`getEffectiveTheme()`** — returns the explicitly-set theme or the default theme. Uses a straightforward conditional (avoiding operator-precedence bugs with `as` casts against logical-OR expressions).

**`resolveItemPresentation(itemDesc)`** — looks up the item from the definition, constructs `Tier1Hints` from the definition's `formPresentation` and the item's `presentation` block, and calls `resolvePresentation()`.

**Two rendering paths handle theme differently:**

- **Component-document path** (`renderActualComponent` -> `renderInputComponent`): The component document explicitly chose the widget — the theme does NOT override it. The theme contributes only `cssClass`, `style`, `accessibility`, and `labelPosition`. Application order: theme cascade (lower priority), then component document overrides (higher priority).
- **Definition-fallback path** (`renderItem`): Full theme widget resolution applies. The resolver's `widget` -> `fallback` chain -> Tier 1 `widgetHint` -> `getDefaultComponent()` dataType default all participate.

This separation ensures that an explicit `"component": "RadioGroup"` in a component document is never silently replaced by a theme selector that prefers `Select` for `choice` fields.

### 3.4 Default theme (`default-theme.json`)

A default theme ships with the package at `packages/formspec-webcomponent/src/default-theme.json` and is auto-applied when no explicit theme is set.

Design principles:

- **Structural only.** No colors, no fonts, no decoration. Defines layout and interaction defaults.
- **`labelPosition: "top"`** as the baseline default for all items.
- **All 13 data types covered** by selectors mapping to appropriate widgets (`boolean` -> `Toggle`, `choice` -> `Select` with `RadioGroup` fallback, `multiChoice` -> `CheckboxGroup`, date types -> `DatePicker`, numeric types -> `NumberInput`, `attachment` -> `FileUpload`, `money` -> `NumberInput` with `TextInput` fallback, `uri`/`text` -> `TextInput`).
- **Boolean fields** get `labelPosition: "start"` (inline label, which is the natural pattern for checkboxes/toggles).
- **Groups** get `role: "group"` via the accessibility block.
- **Design tokens** for spacing (`spacing.xs` through `spacing.xl`) and border-radius (`radius.sm`, `radius.md`) as CSS custom properties. These are structural tokens only.

### 3.5 `labelPosition` rendering

The resolved `labelPosition` value drives CSS class application:

- **`hidden`** — the `<label>` element receives the `formspec-sr-only` class, a WCAG-compliant screen-reader-only pattern using the clip-rect technique (defined in `formspec-base.css`).
- **`start`** — the field wrapper receives the `formspec-field--inline` class, switching from column to row flex direction.
- **`top`** (default) — standard column layout, no additional class.

### 3.6 Accessibility fixes

Several ARIA issues were corrected as part of the theme cascade integration:

- **`aria-description` replaced with `aria-describedby`.** `aria-description` is not a valid ARIA attribute. The renderer now creates a visually-hidden `<span>` with a generated ID and points `aria-describedby` at it. Multiple descriptions are space-concatenated per the ARIA spec.
- **`role="status"` removed from display items.** Live-region semantics on static content is incorrect; display items are not dynamic status indicators.
- **`.formspec-sr-only` CSS class** uses the battle-tested clip-rect pattern (`position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0); overflow: hidden; white-space: nowrap; border: 0`).

File: `packages/formspec-webcomponent/src/formspec-base.css`

### 3.7 Spec-required diagnostics

Two diagnostic paths satisfy spec section 7's requirement that "malformed selectors, unknown widget configs, and invalid token refs should emit actionable warnings while preserving best-effort rendering":

- **`console.warn` when theme widget and all fallbacks are unavailable.** Emitted by `resolveWidget()` with the full list of attempted widgets.
- **`console.warn` when `$token.X` reference is unresolved.** Emitted during token resolution in `resolveToken()`.

In both cases the renderer continues with best-effort rendering rather than failing.

### 3.8 Pre-existing bug fixes

The following bugs were discovered and fixed during the theme cascade integration work:

| Bug | Fix | File |
|-----|-----|------|
| Breakpoints: schema says integer pixels, code passed raw integers to `matchMedia` | Convert to `(min-width: Npx)` media query strings | `index.ts` |
| Stylesheet injection: duplicate `<link>` tags for the same `href` | Track injected hrefs, deduplicate before insertion | `index.ts` |
| `selectAll` checkbox: broken selector for targeting checkboxes | Use `[name="${fullName}"]` attribute selector instead of `:not(:first-child)` | `index.ts` |
| Readonly effect: applied to wrapper container instead of input | Target the actual `<input>` / `<select>` / `<textarea>` element | `index.ts` |
| RadioGroup condition: redundant disjunct `(dataType === 'choice' && componentType === 'RadioGroup')` | Removed; the component-type check alone is sufficient | `index.ts` |
| Widget compat matrix: missing dataTypes `text`, `uri`, `attachment` | Added to the compatibility mapping | `index.ts` |
| `getDefaultComponent`: missing dataType cases `text`, `dateTime`, `time`, `uri`, `attachment`, `money` | Added all missing cases with appropriate default components | `index.ts` |

## 4. Consequences

### Positive

- The spec's 5-level cascade is implemented exactly, with correct merge semantics per property kind.
- Theme resolution is a pure-function module testable without a browser.
- The renderer always has a complete theme baseline — "no theme" falls back to `default-theme.json`, never to broken or missing presentation.
- Component documents retain authority over widget choice; themes advise but do not override explicit selections.
- Types match the schema precisely, catching data-type mismatches and selector errors at compile time.
- Accessibility attributes are now correct (valid ARIA, no incorrect live-region roles).
- All 13 data types have default widget mappings via the default theme.

### Negative

- The `theme-resolver.ts` module introduces a new file that must be kept in sync with any changes to the theme schema's `PresentationBlock` or `SelectorMatch` definitions.
- The two-path rendering model (component-document vs. definition-fallback) adds conceptual complexity. Developers must understand which path they are in to predict how the theme applies.
- The default theme encodes opinionated widget selections (e.g., `Toggle` for booleans, `Select` for choices) that may not match every use case. These can be overridden by an explicit theme or component document.
- Pre-existing bug fixes change rendering behavior for existing E2E test fixtures. Selectors and assertions in `tests/e2e/playwright/` require corresponding updates.

## 5. References

- [ADR-0020: CSS Integration and Design System Interop](0020-css-integration-and-design-system-interop.md)
- `packages/formspec-webcomponent/src/theme-resolver.ts` — cascade resolver implementation
- `packages/formspec-webcomponent/src/default-theme.json` — default theme document
- `packages/formspec-webcomponent/src/types.ts` — `RenderContext` with `resolveItemPresentation`
- `packages/formspec-webcomponent/src/formspec-base.css` — structural base stylesheet including `.formspec-sr-only`
- `packages/formspec-webcomponent/src/index.ts` — `FormspecRender` integration (`getEffectiveTheme`, `resolveItemPresentation`, `renderInputComponent`, `renderActualComponent`)
- `specs/theme/theme-spec.llm.md` — theme cascade algorithm (section 5)
- `specs/component/component-spec.llm.md` — component base properties (section 3.1)
- Theme spec section 7 — error handling and diagnostic requirements
- `schemas/theme.schema.json` — `PresentationBlock`, `SelectorMatch`, `stylesheets`
