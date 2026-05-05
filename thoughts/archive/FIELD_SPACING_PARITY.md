# Field chrome parity: `formspec-react` vs `formspec-webcomponent`

This document compares how the two renderers structure built-in field components. Both import the same canonical stylesheet: `@formspec-org/layout` → `formspec-default.css` (see `packages/formspec-layout/src/styles/default.base.css` and `default.inputs.css`).

## Verification

- **Storybook:** [Examples / Grant Application — Community Impact Grant](http://localhost:6006/?path=/story/examples-grant-application--default) (`stories/examples/GrantApplication.stories.tsx` → `SideBySideStory`). Renders the same definition in isolated shadow roots for React (left) and `<formspec-render>` (right). HTTP check: Storybook on port 6006 returns 200.
- **Automated:** `packages/formspec-react/tests/field-spacing-parity.test.ts` asserts shared CSS ownership (e.g. `.formspec-field { gap: var(--formspec-spacing-xs, 0.25rem); }`, stack `gap: var(--formspec-spacing-field, 0.75rem)`).

## Canonical DOM order (default field chrome)

For every component that uses the shared field wrapper, the intended order is:

1. **Label** — `formspec-label` (or `formspec-legend` inside `formspec-fieldset` for groups in WC)
2. **Description** (optional) — `div.formspec-description` — item-level help, locale-resolved
3. **Hint** (optional) — `p.formspec-hint`
4. **Control** — input, select, toggle container, group container, etc.
5. **Error** — `p.formspec-error` (empty when no message; `:empty { display: none }`)

**Inline boolean fields** (`Checkbox`, `Toggle` with default `labelPosition: top`): root gets `formspec-field--inline`; label and control sit on one row, with description and hint still **above** the control in source order so they read before the interactive control in vertical layout contexts.

## Structural discrepancies found via DOM audit

While spacing parity is high, the following structural differences were identified between `formspec-react` and `formspec-webcomponent` (WC) via automated screenshot/DOM comparisons:

| Feature | React | Web Component (WC) | Parity Note |
|---------|-------|-------------------|-------------|
| **Group container** | `<section class="formspec-group">` | `<div class="formspec-group">` | WC uses `div` to avoid potential nested sectioning semantic issues in some host environments. |
| **Field root classes** | `.formspec-field` | `.formspec-field.formspec-themed-field` | WC uses `.formspec-themed-field` to anchor theme-driven class injection. |
| **Field root ARIA** | (none) | `aria-live="off"` | WC adds this to prevent some screen readers from announcing the whole field container on internal updates. |
| **Boolean field ARIA** | `aria-required` on group | `aria-required` on individual inputs | WC replicates required state to individual radio/checkbox inputs for broader AT support. |
| **Submit button** | `type="submit"` | `type="button"` | WC uses `button` to prevent default form submission which is handled by the component logic. |
| **Descriptive text** | `<p>` | `<p class="formspec-text">` | WC adds a semantic class for descriptive paragraphs. |
| **Alert content** | Raw text child | Text wrapped in `<span>` | WC wraps to allow better flex alignment with icons. |
| **Signature pad** | Inner `.formspec-signature` wrapper | Root `.formspec-signature` on field | WC flattens the signature pad structure; React uses a wrapper. |
| **Signature ARIA** | Dynamic `aria-label` with field name | Static `aria-label` | React provides more context in the label by default. |
| **DataTable ARIA** | Column-only `aria-label` | Column + Row index in `aria-label` | WC provides row-specific context for input elements inside data tables. |
| **Data attributes** | `data-name` only | `data-name` and `data-bind` | WC includes the raw bind key in the DOM for easier debugging. |

## Shared spacing tokens (layout-owned)

| Selector / rule | Role |
|-----------------|------|
| `.formspec-field` | Column flex; `gap: var(--formspec-spacing-xs, 0.25rem)` |
| `.formspec-stack`, `.formspec-group` | `gap: var(--formspec-spacing-field, 0.75rem)` between fields |
| `.formspec-container :where(label)` | Label typography + `margin-bottom: 0.4rem` (stacking with field `gap`) |
| `.formspec-hint` | `margin: 0 0 0.25rem`; subtle type size/color |
| `.formspec-error` | `min-height: 1.25rem`; `margin-top: 0.25rem` |
| `.formspec-checkbox-group`, `.formspec-radio-group` | `gap: 0.625rem`; `margin-top: 0.375rem` after legend/label block |

## Component-by-component matrix

All rows assume the **default** adapter / `DefaultField` path unless noted.

| Component | React entry | WC entry | Wrapper / label | Description + hint | Control shell | Parity notes |
|-----------|-------------|----------|-----------------|-------------------|---------------|--------------|
| **TextInput** | `DefaultField` → `renderControl` | `adapters/default/text-input.ts` | `div.formspec-field`, `label.formspec-label` | Same order as canonical | `input` / `textarea` / `div.formspec-input-adornment` (React) vs `div.formspec-input-wrapper` (WC) | **Unified:** `.formspec-input-adornment` and `.formspec-input-wrapper` share the same rules in `default.base.css`. |
| **NumberInput** | `DefaultField` | `number-input.ts` | Same | Same | Same pattern as text | Same as TextInput. |
| **MoneyInput** | `DefaultField` | `money-input.ts` | Same | Same | `.formspec-money` / `.formspec-money-field` | Shared layout CSS in `default.inputs.css`. |
| **DatePicker** | `DefaultField` | `date-picker.ts` | Same | Same | Native date input + picker chrome | Same field chrome. |
| **Select** (native / combobox) | `DefaultField` | `select.ts` | Same | Same | `.formspec-select-wrapper` | Shared select styling in `default.inputs.css`. |
| **Slider** | `DefaultField` + `formspec-slider` on field | `slider.ts` | Same | Same | `.formspec-slider` | Extra surface class on field root in both stacks. |
| **Rating** | `DefaultField` + `formspec-rating` | `rating.ts` | Same | Same | `.formspec-rating` | Same. |
| **FileUpload** | `DefaultField` + `formspec-file-upload` | `file-upload.ts` | Same | Same | File input + upload UI | Same. |
| **Signature** | `DefaultField` | `signature.ts` | Same | Same | Signature control | Same. |
| **Checkbox** | `DefaultField` (inline branch) | `checkbox.ts` | `formspec-field--inline`, `label.formspec-label` | Included when present | Native checkbox after chrome | **WC fix:** checkbox is inserted **after** description/hint (not immediately after label) so order matches other fields. |
| **Toggle** | `DefaultField` (inline + `.formspec-toggle`) | `toggle.ts` | Same inline pattern | Description/hint before `.formspec-toggle` | `.formspec-toggle` | Toggle appends container at end of chrome; matches React after React gained description/hint nodes. |
| **RadioGroup** | `DefaultField` → `renderGroupControl` | `radio-group.ts` | `fieldset.formspec-fieldset` + `legend.formspec-legend` | Same order | `div.formspec-radio-group[role="radiogroup"]` | **Native:** group caption uses `<legend>`; inner options stay in a `radiogroup` region with `aria-labelledby` pointing at the legend id (matches WC). |
| **CheckboxGroup** | `DefaultField` → `renderGroupControl` | `checkbox-group.ts` | Same fieldset/legend as RadioGroup | Same | `div.formspec-checkbox-group` | Same as RadioGroup with `role="group"`. |

## Decisions (best user value)

| Topic | Choice | Rationale |
|-------|--------|-----------|
| Description vs hint order | **Description before hint** | Matches long-form help → short affordance copy; aligns with WC `createFieldDOM` and with `bindSharedFieldEffects` listing `.formspec-description` before hint in `aria-describedby` assembly. |
| Hidden labels | **`formspec-label` + `formspec-sr-only`** | One visually hidden pattern for both renderers; avoids Tailwind-only `sr-only` in React when the layout bundle already defines `formspec-sr-only`. |
| Required marker | **`<abbr class="formspec-required usa-label--required" title="required">`** | Matches WC/USWDS; expands “required” for assistive tech. |
| React item **description** | **Render `div.formspec-description`** | Previously React only surfaced `hint`; definitions with `items[].description` were invisible next to WC. |
| Checkbox control position (WC) | **After description/hint** | Prior `insertAdjacentElement` after label put the checkbox *between* label and description, which broke reading order and misaligned with React once description exists. |

## Files touched for this parity pass

- `packages/formspec-react/src/defaults/fields/default-field.tsx` — description node, label/required classes, checkbox/toggle chrome, group `aria-describedby` includes description id; RadioGroup/CheckboxGroup use `fieldset`/`legend`.
- `packages/formspec-layout/src/styles/default.base.css` — `fieldset.formspec-fieldset` uses the same flex column + `spacing-xs` gap as `.formspec-field`; grid alignment rules include fieldsets.
- `packages/formspec-webcomponent/src/adapters/default/shared.ts` — `initialDescribedBy` includes description id for group `aria-describedby`.
- `packages/formspec-webcomponent/src/adapters/default/checkbox.ts` — checkbox insertion after description/hint.
- `packages/formspec-react/tests/default-field-inputs.test.tsx` — regression tests for description order, `formspec-label`, and group fieldset/legend.
- `packages/formspec-react/tests/field-spacing-parity.test.ts` — asserts `formspec-fieldset` gap matches `.formspec-field`.

## Out of scope / known structural differences

- **Group root element:** Both renderers use `fieldset`/`legend` for RadioGroup and CheckboxGroup. The option list still lives in an inner `div` with `role="radiogroup"` or `role="group"` and `aria-labelledby` / `aria-describedby` for robust AT support.
- **`aria-describedby`:** Both renderers use it only for **supplementary** text (description, hint, prefix/suffix, money currency, etc.). **Validation errors** are **not** referenced from `aria-describedby`; controls use **`aria-invalid`** and the **`p.formspec-error`** node uses **`aria-live="polite"`** so updates are announced without doubling via describedby.
- **Screener** (`formspec-screener-field`) uses a smaller bespoke block; not all slots mirror full field chrome.

---

*Last updated: 2026-04-06 — aligned with repo state after the parity implementation above.*
