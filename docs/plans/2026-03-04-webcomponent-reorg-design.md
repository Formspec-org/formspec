# Webcomponent Package Reorganization

## Problem

`packages/formspec-webcomponent/src/` is a flat directory with a 737-line god class (`FormspecRender` in `index.ts`) that mixes rendering, screener state, submit flow, breakpoint management, and delegation wiring. `field-input.ts` (483 lines) and `styling.ts` (187 lines) sit alongside unrelated files with no grouping. `theme-resolver.ts` (308 lines) is dead code. Tests are flat in `tests/` with no structure.

## Design

### Source layout

```
src/
  index.ts              — slim barrel: re-exports, customElements.define, registerDefaultComponents()
  element.ts            — FormspecRender class (~150-200 lines): property setters/getters, lifecycle, scheduleRender/render (delegates), cleanup, delegation wiring, public API forwarding
  types.ts              — RenderContext, ComponentPlugin, screener types, host interfaces
  registry.ts           — ComponentRegistry + globalRegistry singleton (unchanged)
  format.ts             — formatMoney (unchanged)
  formspec-base.css     — (unchanged)
  default-theme.json    — (unchanged)
  global.d.ts           — (unchanged)

  rendering/
    index.ts            — barrel
    emit-node.ts        — emitNode(), renderActualComponent(), renderComponent() — tree-walking logic extracted from FormspecRender
    field-input.ts      — renderInputComponent() + FieldInputHost interface (moved from src/field-input.ts)
    screener.ts         — renderScreener() + ScreenerHost interface (moved from src/screener.ts)
    breakpoints.ts      — setupBreakpoints(), breakpoint state management

  submit/
    index.ts            — submit(), touchAllFields(), setSubmitPending(), isSubmitPending(), resolveValidationTarget() + SubmitHost interface

  styling/
    index.ts            — barrel + StylingHost interface
    tokens.ts           — resolveToken(), emitTokenProperties()
    classes.ts          — applyCssClass(), applyClassValue(), resolveWidgetClassSlots()
    style.ts            — applyStyle()
    accessibility.ts    — applyAccessibility()
    stylesheets.ts      — loadStylesheets(), cleanupStylesheets(), canonicalizeStylesheetHref(), findThemeStylesheet(), stylesheetRefCounts

  navigation/
    index.ts            — barrel + NavigationHost interface
    field-focus.ts      — focusField(), findFieldElement(), revealTabsForField()
    wizard.ts           — goToWizardStep()
    paths.ts            — normalizeFieldPath(), externalPathToInternal()

  components/           — unchanged (layout.ts, inputs.ts, display.ts, interactive.ts, special.ts, index.ts)
```

### Deleted files
- `src/theme-resolver.ts` — dead code; types and functions moved to `formspec-layout` package. Tests updated to import from `formspec-layout`.
- `src/styling.ts` — replaced by `src/styling/` directory
- `src/navigation.ts` — replaced by `src/navigation/` directory
- `src/field-input.ts` — moved to `src/rendering/field-input.ts`
- `src/screener.ts` — moved to `src/rendering/screener.ts`

### Test layout

```
tests/
  rendering/
    emit-node.test.ts           — if needed (may stay covered by integration tests)
    field-input.test.ts         — input-rendering.test.ts content, renamed
    screener.test.ts            — if screener-specific tests exist
  submit/
    submit.test.ts              — submit/touch/pending tests
  styling/
    tokens.test.ts              — token-resolution.test.ts content
    classes.test.ts             — css class tests
    stylesheets.test.ts         — stylesheet ref-counting tests
    accessibility.test.ts       — a11y-attributes.test.ts content
  navigation/
    field-focus.test.ts         — field focus/reveal tests
  components/
    layout.test.ts              — layout-components.test.ts
    inputs.test.ts              — input type tests
    display.test.ts             — display component tests
    interactive.test.ts         — wizard/tabs/submit-button tests
    props.test.ts               — component-props.test.ts
    custom.test.ts              — custom-components.test.ts
  helpers/
    engine-fixtures.ts          — unchanged
  compatibility-matrix.test.ts  — stays at root (cross-cutting)
  format.test.ts                — stays at root
  interpolation.test.ts         — stays at root
  registry.test.ts              — stays at root
  render-lifecycle.test.ts      — stays at root (integration test for full element)
```

### Host interface pattern

Each extracted module defines a narrow host interface describing what it needs from `FormspecRender`. The element implements all host interfaces. This keeps modules unit-testable with minimal mocks.

```typescript
// Example: SubmitHost
export interface SubmitHost {
    engine: FormEngine | null;
    touchedFields: Set<string>;
    touchedVersion: Signal<number>;
    _definition: any;
    _submitPendingSignal: Signal<boolean>;
    _latestSubmitDetailSignal: Signal<any>;
    dispatchEvent(event: Event): boolean;
    findItemByKey(key: string, items?: any[]): any | null;
}
```

### Element class after extraction

`FormspecRender` becomes a thin orchestrator:
- Property setters create engine, schedule renders
- `render()` calls `setupBreakpoints()` from `rendering/breakpoints`, then delegates to `renderScreener()` or `emitNode()` from `rendering/`
- Public methods (`submit()`, `focusField()`, etc.) forward to extracted module functions
- Styling/navigation delegators wire host interfaces to module functions
- `cleanup()` and `disconnectedCallback()` tear down effects

### Public API

The public export surface from `index.ts` does not change. All existing exports remain at the same paths. This is a pure internal reorganization.

### Migration notes

- All internal `.js` extension imports in TS source must be updated to new paths
- `formspec-layout` re-exports in `index.ts` stay unchanged
- E2E test harness (`tests/e2e/fixtures/test-harness.ts`) imports from `index` — unaffected
- Vitest config may need `tests/` glob updates if tests move into subdirectories
