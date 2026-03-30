# ItemRow UX Implementation Plan

**Date:** 2026-03-30
**Basis:** `thoughts/studio/2026-03-30-itemrow-non-technical-ux.md`, `thoughts/studio/mock-itemrow-ux.html`
**Branch:** `feat/itemrow-ux-overhaul`

---

## Summary

Restructure the ItemRow expanded panel from three implementation-oriented zones (field config, behavior, options) into four task-oriented accordion categories (Visibility, Validation, Value, Data format). Replace cryptic pill abbreviations with verb-intent labels. Add inline advisory callouts for confusing-but-legal bind combinations. Add expression error states with plain-language recovery. Consolidate competing "+" actions into one entry per accordion section.

No spec changes. No new spec capabilities. Pure UX restructuring of existing functionality.

---

## Sequencing

Work flows bottom-up: shared infrastructure first, then the surfaces that consume it. Each phase is a commit boundary with passing tests.

### Phase 1 — Shared vocabulary layer

Update the label and pill infrastructure that everything else depends on.

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio-core/src/editor-tree-helpers.ts` | Update `buildStatusPills` text values: `req`→`must fill`, `rel`→`shows if`, `ƒx`→`formula`, `def`→`resets to`, `pre`→`linked`, `rule`→`validates`, `ro`→`locked`. Add `specTerm` field to `RowStatusPill` for tooltip content. |
| `packages/formspec-studio-core/tests/editor-tree-helpers.test.ts` | Update pill text assertions. Add `specTerm` assertions. |
| `packages/formspec-studio/src/components/ui/Pill.tsx` | Add `title` prop, render as HTML `title` attribute for spec-term discoverability. |
| `packages/formspec-studio/src/workspaces/editor/item-row-shared.tsx` | Update `summaryInputLabel` to use task-oriented labels: `'Inline calculate'`→`'Inline formula'`, `'Inline relevant'`→`'Inline visibility condition'`, `'Inline required'`→`'Inline mandatory rule'`, `'Inline readonly'`→`'Inline locked rule'`, `'Inline constraint'`→`'Inline validation rule'`. |

**Tests (red first):**
- `editor-tree-helpers.test.ts`: assert new pill text values and `specTerm` fields
- Existing Playwright tests that assert pill text (grep for `req`, `rel`, `ƒx` in e2e tests) — update selectors

---

### Phase 2 — Summary grid: category-aligned slots

Change the summary grid from priority-based selection to one representative entry per category.

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio-core/src/editor-tree-helpers.ts` | Refactor `buildRowSummaries` (or equivalent) to produce four category-keyed entries: `Visibility` (humanized relevant expression or "Always"), `Validation` (count of active rules or "—"), `Value` (humanized calculate/initialValue/prePopulate or "—"), `Format` (currency + precision summary or "—"). For display items: two slots only (Visibility, Description). |
| `packages/formspec-studio-core/tests/editor-tree-helpers.test.ts` | New tests for category-keyed summary generation across field types: simple field, money field with format, field with binds, display item. |
| `packages/formspec-studio/src/workspaces/editor/ItemRowContent.tsx` | Consume the new category-keyed entries. Display items use a 2-column grid; fields use 4-column. |
| `packages/formspec-studio/tests/workspaces/editor/definition-tree-editor.test.tsx` | Update summary grid assertions. |

---

### Phase 3 — Accordion component

Build the accordion container that the lower panel will use.

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio/src/components/ui/AccordionSection.tsx` | **New file.** Props: `title`, `subtitle`, `badge` (string or count), `colorBar` (CSS class), `open`, `onToggle`, `children`. Renders: colored left bar, title + subtitle, badge, chevron. Only one section open at a time is enforced by the parent, not internally. `aria-expanded`, proper heading semantics. |
| `packages/formspec-studio/tests/components/ui/accordion-section.test.tsx` | **New file.** Renders open/closed, fires onToggle, aria-expanded reflects state, badge renders, color bar renders. |

**Design tokens (from mock):**
- Visibility: `border-l-logic` (purple)
- Validation: `border-l-accent` (blue)
- Value: `border-l-green`
- Data format: `border-l-muted` (gray)

---

### Phase 4 — Advisory callout component

Build the inline advisory that floats above the accordion.

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio/src/components/ui/AdvisoryCallout.tsx` | **New file.** Props: `message` (ReactNode), `actions` (array of `{ label, onClick }`). Amber left border, info icon, `role="status"`, `aria-live="polite"`. Auto-appears/disappears — no dismiss button. |
| `packages/formspec-studio/tests/components/ui/advisory-callout.test.tsx` | **New file.** Renders message, renders action buttons, has correct ARIA attributes. |
| `packages/formspec-studio-core/src/editor-tree-helpers.ts` | Add `buildAdvisories(binds, item): Advisory[]` function. Detects: (1) required + readonly without calculate/initialValue/prePopulate → "must fill + locked but no value source", (2) prePopulate + calculate → "formula runs immediately, replaces starting value", (3) required + readonly + calculate → "redundant: formula already locks the field". Returns plain-language message + suggested action labels. |
| `packages/formspec-studio-core/tests/editor-tree-helpers.test.ts` | Tests for each advisory combination, and for combinations that should NOT produce advisories. |

---

### Phase 5 — BindCard enhancements

Add verb-intent header labels, per-card advanced disclosure, and expression error state.

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio/src/components/ui/BindCard.tsx` | (1) Map `bindType` to verb-intent display label: `required`→`MUST FILL`, `relevant`→`SHOWS IF`, `calculate`→`FORMULA`, `constraint`→`VALIDATES`, `readonly`→`LOCKED`. Keep `bindType` in the `title` attribute. (2) Add optional `advancedProperties` prop (array of `{ label, value, options, onChange }`). Render behind a "More" toggle at the bottom of the card. Toggle only appears when `advancedProperties` is non-empty. (3) Add optional `error` prop (`{ message: ReactNode }`). When present, add red-tinted background to expression display, render error message below with info icon. (4) Add optional `tip` prop (string). Render as muted italic text below the expression (for contextual hints like "Fields with a formula are automatically locked"). |
| `packages/formspec-studio/tests/components/ui/bind-card.test.tsx` | Tests for: verb-intent labels render, title attribute has spec term, advanced toggle hidden when no props, advanced toggle shows/hides properties, error state renders, tip renders. |

---

### Phase 6 — ItemRowLowerPanel restructure

The big change: replace three implementation zones with four-category accordion.

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio/src/workspaces/editor/ItemRowLowerPanel.tsx` | **Major rewrite.** Replace `editingFieldConfig`/`editingBehavior`/`editingOptions`/`editingDisplayContent` zone flags with a single `openSection: 'visibility' | 'validation' | 'value' | 'format' | null` state. Render: (1) `buildAdvisories` callouts above accordion, (2) four `AccordionSection` instances. Section contents: |

**Visibility section:**
- `relevant` BindCard (if present)
- "Add visibility condition" button (if no relevant bind)
- For relevant BindCard: advanced disclosure with `nonRelevantBehavior`, `excludedValue`, `disabledDisplay`

**Validation section:**
- `required` BindCard (if present)
- `constraint` BindCard with `constraintMessage` (if present)
- "Add validation rule" button
- For constraint BindCard: advanced disclosure with `nonRelevantBehavior`, `excludedValue`

**Value section:**
- `calculate` BindCard (if present)
- `initialValue` BindCard (if present)
- `PrePopulateCard` (if present)
- `readonly` BindCard (if present, contextually relevant here — "can the user change the value?")
- `default` BindCard (if present — re-relevance reset value)
- When empty: three-option decision tree entry point (Type a starting value / Copy from a data source / Compute with a formula)

**Data format section:**
- Currency, precision, prefix, suffix fields
- Orphan field-detail editor pattern (reused from current implementation)
- Only auto-expand for money/decimal fields where these properties are relevant

**Options (choice fields):**
- Rendered as a fifth section when `isChoiceField` is true: "Options — What can the user choose?"
- Reuses existing options editing UI

**Display items:**
- Only Visibility section rendered. Other sections hidden entirely — not collapsed, not disabled, just absent. No "Data format" or "Value" sections for headings/dividers.

| File | Change |
|------|--------|
| `packages/formspec-studio/src/workspaces/editor/ItemRow.tsx` | Remove `editingFieldConfig`/`editingBehavior`/`editingDisplayContent` state. Replace with `openSection` state. Simplify the `closeOtherEditors` callback to just set `openSection`. |
| `packages/formspec-studio/src/workspaces/editor/ItemRowLowerPanel.tsx` | Props interface changes: remove zone-specific flags, add `openSection` + `onSectionChange`. |
| `packages/formspec-studio/tests/workspaces/editor/definition-tree-editor.test.tsx` | Update all assertions that reference zone flags, field-detail sections, behavior sections. |

**Prop changes on ItemRowLowerPanel:**

Remove:
- `editingFieldConfig`, `editingBehavior`, `editingOptions`, `editingDisplayContent`
- `orphanUiLabel`, `orphanFieldDetailLabel` (absorbed into Data format section)
- `fieldDetailLaunchers` (absorbed into per-section "Add" buttons)
- `visibleMissingActions` (replaced by per-section empty states)

Add:
- `openSection: string | null`
- `onSectionChange: (section: string | null) => void`
- `isDisplayItem: boolean` (to control which sections render)

---

### Phase 7 — AddBehaviorMenu consolidation + display-item filtering

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio/src/components/ui/AddBehaviorMenu.tsx` | Add `itemType` prop. When `itemType` is a display type (`'display'`, `'heading'`, `'divider'`, etc.), filter `allowedTypes` to only `['relevant']`. This is a bug fix — currently all types are offered regardless. |
| `packages/formspec-studio/tests/components/ui/add-behavior-menu.test.tsx` | Test that display items only see "relevant" option. |
| `packages/formspec-studio/src/workspaces/editor/ItemRowLowerPanel.tsx` | Remove the two separate `AddBehaviorMenu` instances and the field-detail launcher row. Each accordion section gets its own single "Add" button that dispatches to the right handler. The Value section's empty state is the decision-tree, not a menu. |

---

### Phase 8 — Expression error states

Wire up FEL expression errors from the engine to the BindCard UI.

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio-core/src/editor-tree-helpers.ts` | Add `buildExpressionDiagnostics(binds, definitionKeys): Record<string, ExpressionError | null>` function. For each bind expression, check for undefined references against `definitionKeys`. Return `{ message, suggestions }` for each broken expression. |
| `packages/formspec-studio-core/tests/editor-tree-helpers.test.ts` | Tests: valid expression → null, undefined reference → error with suggestions (fuzzy match on definitionKeys), syntax error → error with position. |
| `packages/formspec-studio/src/workspaces/editor/ItemRowLowerPanel.tsx` | Pass `error` prop to BindCard when diagnostics exist for that bind type. |
| `packages/formspec-studio/src/workspaces/editor/ItemRow.tsx` | Call `buildExpressionDiagnostics` and pass results down. |
| `packages/formspec-studio-core/src/editor-tree-helpers.ts` | Update `buildStatusPills` to accept diagnostics. When a bind has an error, append a `warn: true` flag to its pill. |
| `packages/formspec-studio/src/components/ui/Pill.tsx` | Add `warn` prop. When true, append ⚠ character and apply `pill-warn` styling. |

---

### Phase 9 — Playwright E2E updates

All existing Playwright tests that interact with the lower panel, pills, or AddBehaviorMenu will need updates.

**Files:**

| File | Change |
|------|--------|
| `packages/formspec-studio/tests/e2e/playwright/smoke.spec.ts` | Update pill text selectors. |
| `packages/formspec-studio/tests/e2e/playwright/blueprint-sidebar.spec.ts` | Update any panel interaction selectors. |
| `packages/formspec-studio/tests/e2e/playwright/cross-workspace-authoring.spec.ts` | Update behavior-add flows to use new accordion navigation. |
| `packages/formspec-studio/tests/e2e/playwright/logic-authoring.spec.ts` | Update bind-add flows. |
| `packages/formspec-studio/tests/e2e/playwright/inspector-safety.spec.ts` | Update if it touches the lower panel. |

**New E2E tests:**

| Test | Covers |
|------|--------|
| `accordion-navigation.spec.ts` | Open/close sections, only one open at a time, collapsed badges show counts. |
| `value-decision-tree.spec.ts` | Empty Value section shows three options, each creates the right artifact. |
| `advisory-callouts.spec.ts` | Required + readonly shows advisory. Add calculate → advisory updates. Remove required → advisory disappears. |
| `expression-error-recovery.spec.ts` | Type bad reference → error shows inline with suggestions. Click suggestion → expression updates. Pill shows warning. |
| `display-item-filtering.spec.ts` | Select heading → only Visibility section visible. AddBehaviorMenu only offers relevant. |

---

## What is NOT in this plan

- Undo snackbar — deferred. The undo infrastructure exists in `formspec-core`; surfacing it is a separate, smaller task.
- `humanizeFEL` improvements — the function already exists and works. No changes needed for this plan.
- ManageView cross-field behaviors index — separate surface, separate plan.
- Updating the UX guidance document — do that after implementation stabilizes.
- Competitor pattern references in the doc — informational, no code impact.

---

## Risk notes

- **Phase 6 is the big bang.** ItemRowLowerPanel is a ~400-line component getting a structural rewrite. The accordion model changes the data flow (zone flags → single openSection). This is the riskiest phase and should be done in one focused session, not spread across multiple.
- **E2E tests will break in bulk** when Phase 6 lands because selectors change. Phase 9 should happen immediately after Phase 6, not deferred.
- **The `readonly` BindCard moves** from the Behavior zone to the Value section. This is intentional (it answers "can the user change the value?") but may surprise authors who learned the current layout. The advisory system (Phase 4) helps here — when readonly is set, the Value section badge shows "locked".
