# Studio-Core Helpers — Schema Cross-Reference Addendum

> **Date:** 2026-03-15
> **Spec:** `2026-03-14-formspec-studio-core-helpers.md`
> **Schemas checked:** `definition.schema.json`, `theme.schema.json`, `component.schema.json`, `studio-commands.schema.json`

This addendum documents inconsistencies found by cross-referencing the studio-core helpers implementation (617 tests, branch `studiofixes`) against the canonical JSON schema files and spec.

---

## HIGH Severity

### H1: `placeholder` property silently discarded — not in definition schema

- **Schema:** `definition.schema.json` field item has `additionalProperties: false` and does NOT include `placeholder`.
- **Implementation:** `FieldProps.placeholder` and `ItemChanges.placeholder` exist in `helper-types.ts`. `addField` writes it into the `addItem` payload. `updateItem` routes it via `_ITEM_PROPERTY_KEYS` → `definition.setItemProperty`.
- **Problem:** The `buildItem()` handler in `definition-items.ts:114-133` does not copy `placeholder`, so the value is **silently discarded** during `addField`. The `setItemProperty` handler does set it, but the resulting definition document violates `additionalProperties: false`.
- **Recommendation:** Placeholder belongs in the **theme tier** (`widgetConfig`) or **component tier** (`component.setNodeProperty`). Either re-route to the correct tier or remove from `FieldProps`/`ItemChanges`.

### H2: `ariaLabel` property silently discarded — not in any schema

- **Schema:** No schema (definition, component, or theme) defines `ariaLabel`. The definition schema has `presentation.accessibility.description` for screen-reader text.
- **Implementation:** `FieldProps.ariaLabel` and `ItemChanges.ariaLabel` exist. Same silent-discard behavior as `placeholder` in `addField`.
- **Recommendation:** Re-route to `presentation.accessibility.description` via the appropriate handler, or remove.

### H3: Email/phone constraint expressions use bare identifiers instead of `$` self-reference

- **Schema:** `Bind.constraint` specifies: "The token `$` (bare dollar sign) is bound to the current value of the targeted node." Examples: `matches($, '^[0-9]{2}-[0-9]{7}$')`.
- **Implementation:** `field-type-aliases.ts:32-33` defines `constraintExpr` as `"matches(email, '.*@.*')"`. `addField` rewrites the first arg to `matches(fullPath, ...)`.
- **Problem:** Produces `matches(contactEmail, '.*@.*')` — a bare identifier, not the spec's `$` self-reference. This is semantically wrong per the schema contract.
- **Recommendation:** Change to `constraintExpr: "matches($, '.*@.*')"` for email and equivalent for phone. Remove the regex rewrite in `addField`.

### H4: `applyStyle` and `updateItem({ style })` store CSS props at wrong nesting level

- **Schema:** `theme.schema.json` `PresentationBlock` has `additionalProperties: false` — CSS properties must be inside the `style` sub-object, not at the block root.
- **Implementation:** Both `applyStyle()` and `updateItem({ style })` dispatch `theme.setItemOverride` with CSS property names as `property`, storing them directly on the block (e.g., `block.borderRadius = '8px'`).
- **Problem:** Produces theme documents that violate the `PresentationBlock` schema.
- **Recommendation:** Use `theme.setItemStyle` handler (already exists) instead of `theme.setItemOverride` for CSS properties.

### H5: `applyStyleAll` sends wrong payload shape to `theme.addSelector`

- **Schema:** Theme selectors require `{ match: SelectorMatch, apply: PresentationBlock }`.
- **Implementation:** `applyStyleAll()` dispatches `{ ...target, property, value }` — spreading `type`/`dataType` at root level. Handler reads `match` and `apply` from payload, both are `undefined`.
- **Problem:** Creates broken/no-op selector entries.
- **Recommendation:** Construct correct payload: `{ match: target, apply: { style: { [property]: value } } }` (or `apply: { [property]: value }` for non-CSS props).

### H6: `'true'` vs `'true()'` FEL literal mismatch (3 locations)

- **Spec says:** `definition.setBind { required: 'true()' }` — the FEL function form.
- **Implementation uses:** `'true'` (bare string) in:
  - `require()` — line 395: `condition ?? 'true'`
  - `addField()` — line 185: `{ required: 'true' }`
  - `updateItem()` — line 801: `bindValue = 'true'`
- **Note:** Both `'true'` and `'true()'` are valid FEL and evaluate identically. This is a **spec vs. implementation** mismatch, not a runtime bug. Choose one form and align.

### H7: `branch()` boolean mode produces `true`/`false` instead of `true()`/`false()`

- **Spec says:** Boolean values produce `on = true()/false()` in FEL expressions.
- **Implementation:** Line 431 produces `${on} = ${when}` for booleans — JavaScript `String(true)` = `"true"`, not `"true()"`.
- **Problem:** Produces `fieldPath = true` instead of `fieldPath = true()`. Unlike H6, `true` as a standalone expression evaluates as a path reference in some FEL contexts, not a boolean literal.
- **Recommendation:** Change to `${on} = ${when}()` for boolean branches.

### H8: `pages.*` commands not in studio-commands.schema.json

- **Schema:** No `pages` command area exists in `studio-commands.schema.json`.
- **Implementation:** 10 distinct `pages.*` commands are dispatched and have registered handlers.
- **Recommendation:** Add `pages.*` commands to the schema.

---

## MEDIUM Severity

### M1: `definition.renameVariable` dispatched but no handler registered

- **Implementation:** `project-wrapper.ts:1783` dispatches `definition.renameVariable`. No handler exists in any handler file.
- **Problem:** Will throw a confusing runtime error from the dispatch layer.
- **Recommendation:** Either register the handler or throw explicit `NOT_IMPLEMENTED` HelperError.

### M2: `InstanceProps.source` type mismatch between schemas

- **definition.schema.json:** `source` is `"type": "string", "format": "uri-template"`.
- **studio-commands.schema.json:** `source` is `"type": "object"`.
- **Implementation:** `source?: string` — matches definition schema.
- **Recommendation:** Fix studio-commands schema to `string`.

### M3: `GroupProps.collapsible` declared but never used

- **Implementation:** `GroupProps.collapsible?: boolean` exists but `addGroup()` never reads or dispatches it.
- **Recommendation:** Either implement (wrap in `Collapsible` component) or remove from `GroupProps`.

### M4: `addGroup` payload uses `groupKey` vs spec's `node: { bind: key }` for `setGroupDisplayMode`

- **Spec says:** `component.setGroupDisplayMode { node: { bind: key }, mode: props.display }`.
- **Implementation:** Dispatches `{ groupKey: key, mode: props.display }`.
- **Recommendation:** Verify handler interface and align spec or code.

### M5: `INVALID_PROPS` error code thrown but not in spec error codes table

- **Implementation:** `addField` throws `HelperError('INVALID_PROPS', ...)` when both `choices` and `choicesFrom` are set.
- **Recommendation:** Add `INVALID_PROPS` to spec error codes table.

### M6: `AMBIGUOUS_ITEM_KEY` warning missing `detail` object

- **Spec says:** Should include `detail.leafKey` and `detail.conflictingPaths`.
- **Implementation:** Warning has `code` and `message` only — no `detail`.
- **Recommendation:** Add `detail: { leafKey, conflictingPaths }`.

### M7: `INVALID_FEL` detail structure differs from spec

- **Spec says:** `detail.parseError.offset` and `detail.parseError.errorType`.
- **Implementation:** `detail.parseError.code` instead — no `offset` or `errorType`.
- **Recommendation:** Align spec to match what the parser returns, or enrich the detail.

### M8: `theme.setDefaults` stores CSS properties at wrong nesting level

- **Same issue as H4** but for the `defaults` block instead of per-item overrides.
- **Recommendation:** Route CSS properties to `defaults.style` sub-object.

---

## LOW Severity

### L1-L4: `MetadataChanges` string types should be enums

| Property | Current Type | Schema Enum |
|----------|-------------|-------------|
| `status` | `string` | `'draft' \| 'active' \| 'retired'` |
| `nonRelevantBehavior` | `string` | `'remove' \| 'empty' \| 'keep'` |
| `labelPosition` | `string` | `'top' \| 'start' \| 'hidden'` |
| `pageMode` | `string` | `'single' \| 'wizard' \| 'tabs'` |

**Recommendation:** Tighten types to match schema enums. `density` is already correctly typed.

### L5: `INVALID_PATH` in spec error codes but never thrown

- **Spec says:** Error code for malformed path syntax.
- **Implementation:** No `throw new HelperError('INVALID_PATH', ...)` exists.
- **Recommendation:** Either implement or remove from spec.

### L6: `INVALID_FORMAT` in spec error codes but not applicable

- **Spec says:** Error for unknown `format` value.
- **Implementation:** `format` is not a valid ItemChanges key. Appears to be a leftover.
- **Recommendation:** Remove from spec.

### L7: `addWizardPage` dispatches two non-atomic commands

- Two separate `dispatch()` calls = two undo entries.
- **Recommendation:** Consider combining into `dispatch([...])` for atomicity.

---

## Confirmed Correct (No Issues)

| Area | Status |
|------|--------|
| `dataType` enum values in `FIELD_TYPE_MAP` | All 13 values match schema |
| Item `type` values (`field`, `group`, `display`) | Match schema |
| `ChoiceOption` interface (`value` + `label`) | Match schema `OptionEntry` |
| Bind property names in `_BIND_KEYS` | Match schema `Bind` properties |
| `ValidationOptions.timing` enum | Match schema |
| `ValidationOptions.severity` enum | Match schema |
| `MetadataChanges.density` enum | Match schema |
| `FlowProps` (showProgress, allowSkip) | Match Wizard component schema |
| `addContent` kind-to-widgetHint mapping | All valid per schema |
| `LayoutArrangement` → component mapping | Correct (Grid, Card, Panel, Stack) |
| `wrapInLayoutComponent` values (Card, Stack, Collapsible) | Valid component types |
| Widget names in `FIELD_TYPE_MAP` defaults | All valid component types |
| `RepeatProps` → `minRepeat`/`maxRepeat` routing | Correct tier split |
| `BranchPath.mode` (`equals` | `contains`) | Helper-layer abstraction, no schema conflict |
