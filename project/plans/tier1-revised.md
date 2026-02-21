# Tier 1 Revised Plan: Presentation Hints

**Status:** Revised after dual review — ready to execute
**Approach:** Amend core spec (`spec.md` + `definition.schema.json`)

---

## §0. Decision: Amend the Core Spec

Presentation hints go directly into `spec.md` and `definition.schema.json`.

AD-02 currently says: *"This specification defines the first two [structure, behavior] and explicitly excludes the third [presentation]."* Since v1.0 hasn't shipped, we rewrite AD-02 to say what we actually mean: structure and behavior are normative; presentation hints are advisory; rendering engines are out of scope.

**Why this is the right call:**

1. **Greenfield.** No deployed implementations to break. We can rewrite any part of the spec.
2. **The spec already has presentation properties.** `prefix`, `suffix`, `hint`, `description`, `labels`, `semanticType`, `disabledDisplay` — these are all presentation metadata scattered across Items and Binds. Adding a `presentation` object is consolidating, not crossing a new line.
3. **~15 optional properties don't warrant a companion spec.** Companion specs earn their weight with independent lifecycles (like `mapping-spec.md`, which maps to external systems). Presentation hints are intrinsic to the form definition.
4. **Discoverability.** Authors see hints inline next to the items they affect — no cross-referencing a separate file.

---

## §1. Ground Truth — What Actually Exists

### Spec structure (actual §-numbers from spec.md)

| Section | Content |
|---------|---------|
| §1 | Introduction, Design Principles (AD-01 through AD-07), Scope, Conformance |
| §2 | Conceptual Model — Abstractions, Relationships, Three Layers, Processing Model, Validation Results |
| §3 | FEL Expression Language (3.1–3.12) |
| §4 | Definition Schema — §4.1 Top-Level, §4.2 Items (§4.2.1 Common, §4.2.2 Group, §4.2.3 Field, §4.2.4 Display), §4.3 Binds, §4.4 Instances, §4.5 Shapes, §4.6 OptionSets |
| §5 | Response + ValidationReport schemas |
| §6 | Processing rules |
| §7 | End-to-end examples |
| §8 | Extension Points (§8.1–§8.5) |
| §9 | Lineage |
| Appendix A | Requirements Traceability |

### Schema structure (definition.schema.json, 798 lines)

- Root: `additionalProperties: false` — **adding any new top-level property requires updating the schema**
- Item `$def`: uses `if/then` with `additionalProperties: false` per type branch (group, field, display)
  - Common properties on all: `key`, `type`, `label`, `description`, `hint`, `labels`, `extensions`
  - Group adds: `children`, `repeatable`, `minRepeat`, `maxRepeat`, `$ref`, `keyPrefix`
  - Field adds: `dataType`, `precision`, `prefix`, `suffix`, `options`, `optionSet`, `initialValue`, `semanticType`, `prePopulate`, `children`
  - Display adds: nothing beyond common
- Bind `$def`: `additionalProperties: false`, has `disabledDisplay` already
- **Impact:** Adding `presentation` requires listing it in EVERY `then` branch's `properties` (group, field, display) AND in the common properties. Adding `formPresentation` requires listing it in the root `properties`.

### Actual dataTypes (13 total)

`string`, `text`, `integer`, `decimal`, `boolean`, `date`, `dateTime`, `time`, `uri`, `attachment`, `choice`, `multiChoice`, `money`

There is NO `email`, `phone`, `file`, `rich-text`, `signature`, `location`, or `multiselect`.

---

## §2. Spec Changes

### 2.1 Rewrite AD-02 (§1.2)

Old:
> **AD-02** | **Separate structure from behavior from presentation.** What data is collected (Items), how it behaves (Binds, Shapes), and how it is displayed (renderer) are three independent concerns. This specification defines the first two and explicitly excludes the third.

New:
> **AD-02** | **Separate structure from behavior from presentation.** What data is collected (Items), how it behaves (Binds, Shapes), and how it is displayed (renderer) are three independent concerns. This specification defines structure and behavior normatively. It provides OPTIONAL, advisory presentation hints (§4.2.5) that guide renderers without constraining them. Rendering, layout engines, widget toolkits, and visual style remain out of scope. | Allows one Definition to carry rendering guidance while still driving web, mobile, PDF, voice, and API interfaces without modification.

### 2.2 Rewrite §2.3 Layer 3 heading

Old title: `#### Layer 3: Presentation Layer (Out of Scope)`

New:
```markdown
#### Layer 3: Presentation Layer

The Presentation Layer answers the question: **HOW is data displayed?**

This specification provides OPTIONAL **presentation hints** — advisory
metadata that helps renderers make informed decisions about widget selection,
layout, and accessibility. Presentation hints are defined in §4.2.5
(per-item) and §4.1.1 (form-wide).

Presentation hints are strictly advisory:
- A conforming processor MAY ignore any or all presentation hints.
- A conforming definition MUST NOT require presentation hints for correct
  data capture, validation, or submission.
- Hints MUST NOT alter data semantics, validation results, or processing
  behavior.

The following remain **out of scope** and are NOT defined by this
specification:
- Rendering engines, widget toolkits, or CSS.
- Platform-specific affordances (touch targets, screen reader APIs).
- Navigation and focus management.
- Visual style, themes, and branding.

Companion specifications MAY standardize richer Presentation Layer schemas
(e.g., sidecar theme documents, component models) that consume and extend
these hints. Such specifications are independent of this document.
```

Estimated delta: ~+10 lines net (replaces existing ~15 lines).

### 2.3 New §4.1.1 — Form Presentation (after §4.1 Top-Level Structure)

```markdown
#### 4.1.1 Form Presentation

The OPTIONAL `formPresentation` object on the Definition root provides
form-wide presentation defaults. All properties within `formPresentation`
are OPTIONAL and advisory.

| Property | Type | Values | Default | Description |
|----------|------|--------|---------|-------------|
| `pageMode` | string | `"single"`, `"wizard"`, `"tabs"` | `"single"` | Suggests how top-level groups are paginated. `"wizard"`: sequential steps. `"tabs"`: tabbed sections. `"single"`: all items on one page. Processors that do not support the declared mode SHOULD fall back to `"single"`. |
| `labelPosition` | string | `"top"`, `"start"`, `"hidden"` | `"top"` | Default label placement for all Fields. `"top"`: label above input. `"start"`: label to the leading side. `"hidden"`: label suppressed visually (MUST remain in accessible markup). |
| `density` | string | `"compact"`, `"comfortable"`, `"spacious"` | `"comfortable"` | Spacing density hint. |
```

Estimated: ~40 lines.

### 2.4 New §4.2.5 — Presentation Hints (after §4.2.4 Display Items)

This is the main addition. Structure:

```markdown
#### 4.2.5 Presentation Hints

The OPTIONAL `presentation` object MAY appear on any Item (Field, Group,
or Display). All properties within `presentation` are OPTIONAL and advisory.

A conforming processor MUST accept `presentation` without error. A
conforming processor MAY ignore any property within `presentation`. Unknown
keys within `presentation` MUST be ignored (forward-compatibility).

Presentation hints MUST NOT affect data capture, validation, calculation,
or submission semantics.
```

Sub-sections below.

---

## §3. The widgetHint Vocabulary (Corrected)

The previous plan referenced phantom dataTypes. Here is the corrected table built against the actual 13 dataTypes.

### 3.1 widgetHint Property

`presentation.widgetHint` is a string suggesting the preferred UI control. The value MUST be one of the values listed below for the Item's `dataType`, or a custom value prefixed with `x-`. A processor receiving an incompatible or unrecognized `widgetHint` MUST ignore it and use its default widget for that `dataType`.

**For Display Items**, `widgetHint` MUST be one of: `"heading"`, `"paragraph"`, `"divider"`, `"banner"`. Default: `"paragraph"`.

**For Group Items**, `widgetHint` MUST be one of: `"section"`, `"card"`, `"accordion"`, `"tab"`. Default: `"section"`.

**For Field Items**, valid values depend on `dataType`:

| dataType | Valid widgetHint values | Default |
|----------|------------------------|---------|
| `string` | `"textInput"`, `"password"`, `"color"` | `"textInput"` |
| `text` | `"textarea"`, `"richText"` | `"textarea"` |
| `integer` | `"numberInput"`, `"stepper"`, `"slider"`, `"rating"` | `"numberInput"` |
| `decimal` | `"numberInput"`, `"slider"` | `"numberInput"` |
| `boolean` | `"checkbox"`, `"toggle"`, `"yesNo"` | `"checkbox"` |
| `date` | `"datePicker"`, `"dateInput"` | `"datePicker"` |
| `dateTime` | `"dateTimePicker"`, `"dateTimeInput"` | `"dateTimePicker"` |
| `time` | `"timePicker"`, `"timeInput"` | `"timePicker"` |
| `uri` | `"textInput"`, `"urlInput"` | `"textInput"` |
| `attachment` | `"fileUpload"`, `"camera"`, `"signature"` | `"fileUpload"` |
| `choice` | `"dropdown"`, `"radio"`, `"autocomplete"`, `"segmented"`, `"likert"` | renderer decides by option count |
| `multiChoice` | `"checkboxGroup"`, `"multiSelect"`, `"autocomplete"` | `"checkboxGroup"` |
| `money` | `"moneyInput"` | `"moneyInput"` |

**Total: 32 distinct values** across all types + 4 display + 4 group = **40 values**.

### 3.2 Schema approach for widgetHint

`widgetHint` is `type: string` in the schema (NOT an enum). Rationale:
- The compatibility table is dataType-dependent; a static enum can't express "slider is valid for integer but not boolean"
- Custom `x-` prefixed values must be allowed
- Enforcement is spec-prose + tests, not schema

### 3.3 Fallback table (per dataType)

When `widgetHint` is absent, unrecognized, or incompatible, the processor MUST use the default widget for that `dataType` as listed in the table above. This makes degradation deterministic.

## §4. Layout, Style, and Accessibility Hints

### 4.1 presentation.layout (on Groups)

| Property | Type | Values | Default | Description |
|----------|------|--------|---------|-------------|
| `flow` | string | `"stack"`, `"grid"`, `"inline"` | `"stack"` | How children are arranged. |
| `columns` | integer | 1–12 | 1 | Column count when `flow` is `"grid"`. |
| `page` | string | any non-empty string | (none) | Groups items into named wizard steps/tabs. Only meaningful when `formPresentation.pageMode` ≠ `"single"`. Groups without `page` attach to the preceding page. |
| `collapsible` | boolean | | `false` | Whether the group can be collapsed. |
| `collapsedByDefault` | boolean | | `false` | Initial collapsed state. Ignored if `collapsible` is not `true`. |

### 4.2 presentation.layout (on Fields and Display Items)

| Property | Type | Values | Default | Description |
|----------|------|--------|---------|-------------|
| `colSpan` | integer | 1–12 | 1 | Grid columns this item spans. Only meaningful when parent Group has `flow: "grid"`. |
| `newRow` | boolean | | `false` | Force this item to start a new grid row. |

### 4.3 presentation.styleHints

| Property | Type | Values | Default | Description |
|----------|------|--------|---------|-------------|
| `emphasis` | string | `"primary"`, `"success"`, `"warning"`, `"danger"`, `"muted"` | (none) | Semantic importance/tone. |
| `size` | string | `"compact"`, `"default"`, `"large"` | `"default"` | Relative sizing. |

These are semantic tokens, NOT CSS. Renderers map them to their own palette/sizing.

### 4.4 presentation.accessibility

| Property | Type | Values | Default | Description |
|----------|------|--------|---------|-------------|
| `role` | string | (free string) | (none) | Semantic role hint. Well-known values: `"alert"`, `"status"`, `"navigation"`, `"complementary"`, `"region"`. Renderers map to platform-equivalent (ARIA on web, UIAccessibility on iOS, etc.). |
| `description` | string | | (none) | Supplemental accessible description. Distinct from `hint`/`description` on the Item (which are visible text); this is for screen-reader-only context. |
| `liveRegion` | string | `"off"`, `"polite"`, `"assertive"` | `"off"` | For dynamic/calculated fields: how aggressively to announce value changes. |

**Platform neutrality note:** `role` and `liveRegion` are named after ARIA concepts but the spec does NOT require ARIA. Renderers on non-web platforms SHOULD map to equivalent accessibility APIs. Renderers on platforms without accessibility APIs SHOULD ignore these properties.

### 4.5 Precedence and Interaction with Existing Properties

**Normative rules:**

1. `formPresentation` properties are form-wide defaults. Item-level `presentation` properties override them per-property (not per-object).
2. Existing Item properties (`prefix`, `suffix`, `hint`, `description`, `labels`, `semanticType`) retain their defined semantics and are NOT superseded by `presentation`. They are complementary.
3. `semanticType` on a Field provides domain annotation (e.g., `"ietf:email"`). `widgetHint` on the same Field provides explicit widget preference. When both are present, `widgetHint` takes precedence for widget selection. When only `semanticType` is present, renderers MAY use it to infer a widget.
4. `disabledDisplay` on a Bind controls non-relevant rendering. `presentation` properties on the same Item control relevant-state rendering. No conflict.
5. `presentation` properties do NOT cascade from parent Group to child Items. Each Item's `presentation` is independent.

### 4.6 Forward-Compatibility

The `presentation` object uses `additionalProperties: true` at the top level. Unknown keys MUST be ignored. Nested sub-objects (`layout`, `styleHints`, `accessibility`) use `additionalProperties: false` to catch typos.

This allows future companion specs to define additional keys inside `presentation` without breaking existing validators.

---

## §5. Schema Changes to definition.schema.json

### 5.1 Root: add `formPresentation`

Add to root `properties`:

```json
"formPresentation": {
  "type": "object",
  "description": "Form-wide presentation defaults. All properties OPTIONAL and advisory.",
  "additionalProperties": false,
  "properties": {
    "pageMode": {
      "type": "string",
      "enum": ["single", "wizard", "tabs"],
      "default": "single"
    },
    "labelPosition": {
      "type": "string",
      "enum": ["top", "start", "hidden"],
      "default": "top"
    },
    "density": {
      "type": "string",
      "enum": ["compact", "comfortable", "spacious"],
      "default": "comfortable"
    }
  }
}
```

### 5.2 New $def: `Presentation`

```json
"Presentation": {
  "type": "object",
  "description": "Advisory presentation hints per §4.2.5.",
  "additionalProperties": true,
  "properties": {
    "widgetHint": { "type": "string" },
    "layout": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "flow": { "type": "string", "enum": ["stack", "grid", "inline"] },
        "columns": { "type": "integer", "minimum": 1, "maximum": 12 },
        "colSpan": { "type": "integer", "minimum": 1, "maximum": 12 },
        "newRow": { "type": "boolean" },
        "collapsible": { "type": "boolean" },
        "collapsedByDefault": { "type": "boolean" },
        "page": { "type": "string", "minLength": 1 }
      }
    },
    "styleHints": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "emphasis": { "type": "string", "enum": ["primary", "success", "warning", "danger", "muted"] },
        "size": { "type": "string", "enum": ["compact", "default", "large"] }
      }
    },
    "accessibility": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "role": { "type": "string" },
        "description": { "type": "string" },
        "liveRegion": { "type": "string", "enum": ["off", "polite", "assertive"] }
      }
    }
  }
}
```

### 5.3 Add `presentation` to EVERY Item type branch

Because the Item $def uses `additionalProperties: false` in each `then` branch, we must add `"presentation": { "$ref": "#/$defs/Presentation" }` to the `properties` of ALL THREE branches (group, field, display).

Also add `"presentation": true` won't work here — we need the actual `$ref` in each branch since they use `additionalProperties: false`.

### 5.4 Schema delta estimate

| Change | Lines |
|--------|-------|
| `formPresentation` on root | ~20 |
| `$defs/Presentation` | ~45 |
| `presentation` ref in group branch | +1 |
| `presentation` ref in field branch | +1 |
| `presentation` ref in display branch | +1 |
| **Total** | **~68 lines** |

New schema size: ~866 lines (798 + 68).

### 5.5 Regression risk

Since root has `additionalProperties: false`, adding `formPresentation` is safe — existing documents without it pass; new documents with it pass. Same for `presentation` on Items. The key insight: `additionalProperties: false` with a new optional property in `properties` is **backward compatible** (old docs omitting the property still validate) and **forward compatible** (new docs including it validate against the new schema).

The only risk: old schemas (v1.0 before this change) will reject documents containing `formPresentation` or `presentation`. Since this is greenfield and we haven't shipped, there are no old schemas in the wild.

## §6. Test Plan

### New file: `test_presentation_hints.py`

#### A. Schema Validation — formPresentation (12 tests)
- Valid: each `pageMode` value (3)
- Valid: each `labelPosition` value (3)
- Valid: each `density` value (3)
- Invalid: unknown `pageMode` (1)
- Invalid: unknown `labelPosition` (1)
- Invalid: unknown `density` (1)

#### B. Schema Validation — formPresentation edge cases (6 tests)
- Valid: empty `formPresentation` object (1)
- Valid: `formPresentation` omitted entirely (1)
- Invalid: `formPresentation` as string (1)
- Invalid: unknown key inside `formPresentation` (additionalProperties: false) (1)
- Valid: only `pageMode` present, others omitted (1)
- Valid: all three properties present (1)

#### C. Schema Validation — presentation on Items (18 tests)
- Valid: `presentation` on Field (1)
- Valid: `presentation` on Group (1)
- Valid: `presentation` on Display (1)
- Valid: empty `presentation: {}` (1)
- Valid: `presentation` omitted entirely (1)
- Valid: unknown top-level key in `presentation` → passes (`additionalProperties: true`) (1)
- Invalid: `layout.flow` with bad value (1)
- Invalid: `layout.columns` = 0 (1)
- Invalid: `layout.columns` = 13 (1)
- Invalid: `layout.colSpan` = 0 (1)
- Valid: `layout.columns` = 1 (boundary) (1)
- Valid: `layout.columns` = 12 (boundary) (1)
- Invalid: `styleHints.emphasis` with bad value (1)
- Invalid: `styleHints.size` with bad value (1)
- Invalid: `accessibility.liveRegion` with bad value (1)
- Invalid: `layout.columns` as string (type mismatch) (1)
- Invalid: unknown key inside `layout` (additionalProperties: false) (1)
- Invalid: unknown key inside `styleHints` (additionalProperties: false) (1)

#### D. widgetHint / dataType Compatibility (26 tests)
- Valid: each dataType with its default widgetHint (13)
- Valid: each dataType with one alternative widgetHint (13 — one per type, picking a non-default)

#### E. widgetHint on Group and Display Items (8 tests)
- Valid: display with each of 4 display widgetHints (4)
- Valid: group with each of 4 group widgetHints (4)

#### F. Layout Property Semantics (15 tests)
- `flow="grid"` + `columns` on Group with children (1)
- `colSpan` on child of grid Group (1)
- `newRow` on child (1)
- `collapsible` + `collapsedByDefault` on Group (1)
- `collapsedByDefault` without `collapsible` → valid schema (1)
- `page` labels with `pageMode="wizard"` (1)
- `page` labels with `pageMode="single"` → valid but no effect (1)
- Mixed page and no-page groups (1)
- Duplicate `page` labels → valid (groups together) (1)
- `flow` on Field → valid schema (semantically ignored) (1)
- `colSpan` > `columns` → valid schema (renderer clamps) (1)
- Nested groups with different `flow` values (1)
- All layout properties combined on one Group (1)
- All layout properties combined on one Field (1)
- No layout at all → defaults apply (1)

#### G. Accessibility Properties (8 tests)
- `role` on Group (1)
- `role` on Display (1)
- `description` on Field, distinct from Item `description` (1)
- `liveRegion` on Display (1)
- All accessibility properties combined (1)
- Empty `accessibility: {}` (1)
- `accessibility` on all three Item types (1)
- Custom `role` string (non-ARIA) → valid (1)

#### H. Precedence and Interaction (10 tests)
- Field with both `semanticType` and `widgetHint` → valid (1)
- Field with `prefix` and `presentation.styleHints` → both preserved (1)
- `formPresentation.density` + item `presentation.styleHints.size` → both valid (1)
- Definition with `formPresentation` + items with and without `presentation` (1)
- Item with `presentation` containing unknown keys + known keys → known validated, unknown ignored (1)
- Bind with `disabledDisplay` + Item with `presentation` on same key → both valid (1)
- Calculated field (has `calculate` bind) with `presentation.accessibility.liveRegion` (1)
- Display item with `presentation.widgetHint: "heading"` + `styleHints.emphasis` (1)
- Group with `presentation.layout.page` + children with own `presentation` (1)
- Round-trip: serialize → deserialize → re-serialize a definition with full `presentation` → lossless (1)

#### I. Integration / Full Form Definitions (8 tests)
- Wizard form: `pageMode="wizard"`, groups with `page` labels, fields with `widgetHint` (1)
- Tabbed form: `pageMode="tabs"` (1)
- Grid layout: Group with `flow="grid"`, `columns=3`, children with `colSpan` (1)
- Accessible form: multiple items with `role`, `description`, `liveRegion` (1)
- Kitchen sink: every presentation property used at least once (1)
- Minimal form: zero presentation properties → passes unchanged (regression) (1)
- Existing test fixtures unchanged: spot-check 3 existing valid definitions still pass (3 — but these run as part of the full 1,244-test regression)
- Definition with `presentation` + all existing features (binds, shapes, instances, variables, etc.) (1)

### Test totals

| Category | Count |
|----------|-------|
| formPresentation schema | 12 |
| formPresentation edge cases | 6 |
| presentation on Items | 18 |
| widgetHint/dataType compat | 26 |
| widgetHint on Group/Display | 8 |
| Layout semantics | 15 |
| Accessibility | 8 |
| Precedence/interaction | 10 |
| Integration | 8 |
| **Total new tests** | **111** |
| Existing regression | 1,244 (unchanged) |
| **Grand total** | **1,355** |

---

## §7. Cross-Tier Contract (Advisory, Not Normative)

Per the combative review's valid criticism: we should NOT normatively constrain Tier 2/3 specs that don't exist yet.

### Language to include in §4.2.5:

> **Informative note — Future presentation tiers:**
>
> The `presentation` object is designed to serve as a baseline for richer
> presentation systems. Future companion specifications may define:
>
> - **Sidecar theme documents** that override presentation hints with
>   selector-based rules, design tokens, and responsive layouts.
> - **Component documents** that define full presentation trees with
>   slot bindings to Definition items.
>
> Such companion specifications are expected to treat inline
> `presentation` hints as defaults that may be overridden. The
> `additionalProperties: true` policy on `presentation` ensures forward
> compatibility with properties defined by future tiers.

This is informative (no RFC 2119 keywords), directional ("expected to" not "MUST"), and non-binding.

---

## §8. Processing Model Clarifications (add to §6 of spec.md)

Add a short paragraph to §6 Processing:

> **Presentation hints and processing.** The `presentation` and
> `formPresentation` objects are metadata. They do not participate in
> the Rebuild → Recalculate → Revalidate → Notify processing cycle.
> FEL expressions MUST NOT reference `presentation` properties. When
> a processor serializes a Response, `presentation` properties MUST NOT
> appear in the Response data.

Estimated: +5 lines.

---

## §9. Ordered Task List

### Phase 1: Schema (5 tasks)

| # | Task | Output |
|---|------|--------|
| 1 | Verify current schema structure matches our analysis (§1 above) | Confirmed understanding |
| 2 | Add `$defs/Presentation` sub-schema | Updated schema |
| 3 | Add `"presentation"` to group/field/display `then` branches | Updated schema |
| 4 | Add `formPresentation` to root `properties` | Updated schema |
| 5 | Run existing 1,244 tests — confirm zero regressions | Green suite |

### Phase 2: Tests (4 tasks)

| # | Task | Output |
|---|------|--------|
| 6 | Create `test_presentation_hints.py` scaffold | New file |
| 7 | Write categories A–F (85 tests: schema + widgetHint + layout) | Tests passing |
| 8 | Write categories G–I (26 tests: accessibility + precedence + integration) | Tests passing |
| 9 | Run full suite (1,244 + 111 = 1,355) | All green |

### Phase 3: Spec Prose (8 tasks)

| # | Task | Output |
|---|------|--------|
| 10 | Rewrite AD-02 in §1.2 | Updated spec.md |
| 11 | Rewrite §2.3 Layer 3 section | Updated spec.md |
| 12 | Write §4.1.1 formPresentation | Updated spec.md |
| 13 | Write §4.2.5 Presentation Hints (intro + widgetHint + table) | Updated spec.md |
| 14 | Write §4.2.5 layout, styleHints, accessibility sub-sections | Updated spec.md |
| 15 | Write §4.2.5 precedence rules + forward-compat note | Updated spec.md |
| 16 | Add processing clarification to §6 | Updated spec.md |
| 17 | Add "Presentation Hints" to Appendix A traceability table | Updated spec.md |

### Phase 4: Finalize (5 tasks)

| # | Task | Output |
|---|------|--------|
| 18 | Update `index.html` — mention presentation hints in feature list | Updated hub |
| 19 | Full test suite run (1,355 tests) | All green |
| 20 | Proof-read: RFC 2119 keywords, internal cross-references | Clean spec |
| 21 | Verify schema ↔ spec consistency (every property documented, every documented property in schema) | Verified |
| 22 | Git commit: "Add presentation hints (§4.1.1, §4.2.5)" | Committed |

**Total: 22 tasks across 4 phases.**

---

## §10. Effort Estimate

| Artifact | Delta |
|----------|-------|
| `spec.md` | ~250 lines added (AD-02 rewrite + §2.3 rewrite + §4.1.1 + §4.2.5 + §6 note) |
| `definition.schema.json` | ~68 lines added |
| `test_presentation_hints.py` | ~700–900 lines (111 tests) |
| `index.html` | ~5 lines |
| **Total** | **~1,025–1,225 lines** |

---

## §11. Resolved Design Questions

| # | Question | Resolution |
|---|----------|------------|
| Q1 | widgetHint: enum or free string in schema? | **Free string.** Compatibility enforced by spec prose + tests. |
| Q2 | `presentation` additionalProperties? | **True at top level** (forward-compat). **False on sub-objects** (typo safety). |
| Q3 | Does `labelPosition` cascade? | **Yes**, as a form-wide default from `formPresentation`. No per-item override in Tier 1. |
| Q4 | Where does `page` live? | On `presentation.layout.page` on Groups. Not on Fields directly. |
| Q5 | Section numbers? | `formPresentation` → §4.1.1. `presentation` → §4.2.5. |
| Q6 | Normative compatibility table? | **Yes.** Incompatible widgetHint MUST be ignored. |
| Q7 | Relationship to existing hint properties? | **Complementary.** `prefix`/`suffix`/`hint`/`description`/`labels`/`semanticType`/`disabledDisplay` retain their semantics. Not superseded. |
| Q8 | Core spec or companion? | **Core spec** (§0). Decided: amend `spec.md` + `definition.schema.json` directly. |
| Q9 | Processing model impact? | **None.** Presentation is metadata. FEL cannot reference it. Not in Responses. |
| Q10 | Cross-tier contract normative? | **No.** Informative note only. Future specs are not bound. |

---

## §12. Risk Mitigation (Updated)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Schema `additionalProperties: false` breaks | Eliminated | Verified: adding optional properties to `properties` is backward-compatible |
| Phantom dataTypes in widgetHint table | Eliminated | Table rebuilt from actual 13 dataTypes |
| AD-02 contradiction | Eliminated | AD-02 rewritten; §2.3 rewritten; this is greenfield |
| Section number mismatch | Eliminated | All references verified against actual spec structure |
| `presentation` overlaps with `prefix`/`suffix`/`semanticType` | Low | §4.2.5 explicitly states complementary relationship; precedence rules defined |
| widgetHint vocabulary grows uncontrollably | Low | `x-` prefix for custom; additions go through extension-registry.md |
| Future Tier 2/3 incompatible with Tier 1 | Low | `additionalProperties: true` + informative (not normative) forward-looking note |
| Existing tests break | Low | Schema addition is additive-only; existing fixtures have no `presentation` key |
