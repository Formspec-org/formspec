# Implementation Plan: Tier 1 — Presentation Hints (Approach A)

**Status:** Planning  
**Created:** 2025-01-XX  
**Scope:** Inline `presentation` on Items + `formPresentation` on Definition root  
**Files modified:** `spec.md`, `definition.schema.json`, `index.html`, + new test files  
**Files created:** 0 new spec files (zero-new-files constraint)

---

## 1. Spec Changes to `spec.md`

### 1.1 Section Map (current structure, estimated from ~4,483 lines)

| Section | Topic | Estimated Lines |
|---------|-------|-----------------|
| §1 | Introduction / Conformance | ~1–100 |
| §2 | Architecture & Layers | ~101–300 |
| §3 | Definition Root | ~301–500 |
| §4 | Items (Field, Group, Display) | ~501–1800 |
| §5 | Data Types | ~1801–2400 |
| §6 | Validation | ~2401–2900 |
| §7 | Conditional Logic / FEL | ~2901–3400 |
| §8 | Extensions | ~3401–3800 |
| §9 | Conformance / Appendices | ~3801–4483 |

### 1.2 Edits Required

#### A. §2 — Architecture & Layers (~15 lines changed, ~30 lines added)

**§2.3 (or wherever "Layer 3: Presentation" is described):**
- **Current state:** Layer 3 is described as out-of-scope / renderer-dependent.
- **Change:** Rewrite to introduce the 3-tier presentation escalation ladder:
  - Tier 1 (Hints): inline `presentation` + `formPresentation`, defined in this spec
  - Tier 2 (Theme): separate sidecar document (future spec)
  - Tier 3 (Components): full component tree (future spec)
- Add normative paragraph: *"Tier 1 presentation hints are OPTIONAL. A conforming processor MAY ignore any or all presentation properties. A conforming producer MUST NOT require presentation hints for correct data capture."*
- Add forward reference: *"Tier 2 theme documents, when applied, inherit Tier 1 hints as defaults. See §4.X.6 Cross-Tier Inheritance."*
- **Estimated delta:** +30 lines net.

#### B. §3 — Definition Root: `formPresentation` (~60 lines added)

**New §3.X (e.g., §3.5 or §3.6) — "Form Presentation":**

```
§3.X Form Presentation

The OPTIONAL `formPresentation` object on the Definition root provides
form-wide presentation defaults.

§3.X.1 Properties

| Property       | Type   | Values                                    | Default       |
|----------------|--------|-------------------------------------------|---------------|
| pageMode       | string | "single", "wizard", "tabs"                | "single"      |
| labelPosition  | string | "top", "start", "hidden"                  | "top"         |
| styleHints     | object | See §3.X.2                                | {}            |

§3.X.2 Form-Level styleHints

| Property | Type   | Values                                    | Default       |
|----------|--------|-------------------------------------------|---------------|
| density  | string | "compact", "comfortable", "spacious"      | "comfortable" |

Processors that do not support `pageMode: "wizard"` SHOULD fall back
to "single" and render all items in document order.

Processors that do not support `pageMode: "tabs"` SHOULD fall back
to "single".
```

- **Estimated delta:** +60 lines.

#### C. §4 — Items: `presentation` Object (~250 lines added)

**New §4.X (e.g., §4.2.5 or §4.5) — "Presentation Hints":**

This is the largest addition. Structure:

```
§4.X Presentation

The OPTIONAL `presentation` object MAY appear on any Item (Field, Group,
or Display). All sub-properties are OPTIONAL. Unknown keys MUST be ignored
by conforming processors (forward-compatibility with Tier 2/3).

§4.X.1 widgetHint
  - Type: string (closed enum, per dataType — see table)
  - Semantics: suggests a UI control; processor MAY substitute
  - Compatibility table: dataType → allowed widgetHint values
  - ~30 values total

§4.X.2 layout
  §4.X.2.1 flow
    - "stack" (default), "grid", "inline"
    - Applies to Groups (controls child arrangement)
    - On Fields/Display: ignored (or processor MAY apply to label+control pair)
  §4.X.2.2 columns
    - integer 1–12 (grid column count when flow="grid")
    - Default: implementation-defined (RECOMMENDED 1 for mobile, 2 for desktop)
  §4.X.2.3 colSpan
    - integer 1–12 (how many grid columns this item occupies)
    - Default: 1
  §4.X.2.4 newRow
    - boolean — force this item to start a new grid row
    - Default: false
  §4.X.2.5 collapsible / collapsedByDefault
    - booleans — only meaningful on Groups
    - collapsedByDefault without collapsible: true is ignored
  §4.X.2.6 page
    - string — groups items into named wizard steps / tab pages
    - Only meaningful when formPresentation.pageMode ≠ "single"
    - Items without page: assigned to an implicit first page

§4.X.3 styleHints
  §4.X.3.1 emphasis
    - "primary", "success", "warning", "danger", "muted"
    - Default: none (normal rendering)
  §4.X.3.2 size
    - "compact", "default", "large"
    - Default: "default"

§4.X.4 accessibility
  §4.X.4.1 role
    - string — maps to ARIA role (e.g., "alert", "status", "navigation")
    - Primarily useful on Groups and Display items
  §4.X.4.2 description
    - string — supplemental accessible description (aria-describedby text)
    - Distinct from Item.description (which is visible help text)
  §4.X.4.3 liveRegion
    - "off" (default), "polite", "assertive"
    - Maps to aria-live attribute
    - Primarily useful on Display items with dynamic content

§4.X.5 Inheritance & Defaults
  - presentation properties do NOT cascade from parent Group to child Items
    (each Item is independent — cascading is Tier 2's job)
  - formPresentation.labelPosition applies to all Fields unless overridden
    (this is the ONE cascading form-level default in Tier 1)
  - Missing presentation object = all defaults

§4.X.6 Cross-Tier Inheritance Contract
  - Normative: "When a Tier 2 theme document is applied, properties
    specified in an Item's `presentation` object serve as item-level
    defaults. The theme MAY override any presentation property. In the
    absence of a theme override, the inline hint value MUST be used."
  - Normative: "Tier 2 theme documents SHOULD use the same property
    names and value enums defined in this section for their override
    rules, to ensure vocabulary consistency across tiers."
```

- **Estimated delta:** +250 lines.

#### D. §4.X.1 widgetHint — Compatibility Table (~80 lines)

This is a sub-component of §4.X but large enough to call out:

| dataType | Allowed widgetHint values |
|----------|---------------------------|
| string | `text-input`, `textarea`, `password`, `color-picker`, `slug-input` |
| integer | `number-input`, `stepper`, `slider`, `dial` |
| decimal | `number-input`, `stepper`, `slider`, `currency-input` |
| boolean | `checkbox`, `switch`, `toggle-button` |
| date | `date-picker`, `calendar`, `date-input` |
| time | `time-picker`, `time-input` |
| datetime | `datetime-picker`, `datetime-input` |
| email | `text-input`, `email-input` |
| uri | `text-input`, `url-input` |
| phone | `text-input`, `phone-input` |
| file | `file-picker`, `dropzone`, `camera-capture` |
| select (via options/optionsSource) | `dropdown`, `radio-group`, `button-group`, `chip-group`, `combobox`, `listbox` |
| multiselect | `checkbox-group`, `chip-group`, `listbox`, `transfer-list` |
| rich-text | `rich-editor`, `markdown-editor` |
| signature | `signature-pad` |
| location | `map-picker`, `address-autocomplete`, `coordinate-input` |

*Note: Some widgetHints apply across multiple dataTypes (e.g., `text-input`). The table above is the normative compatibility matrix. A processor receiving an incompatible widgetHint MUST ignore it and fall back to its default widget for that dataType.*

- **Counted within the §4.X 250-line estimate above.**

#### E. §5 — Data Types (minor cross-references, ~5 lines)

- In each dataType subsection, add a sentence: *"See §4.X.1 for compatible widget hints."*
- No structural changes needed.

#### F. AD-02 Discussion (Architectural Decision, ~20 lines changed)

- **Current state:** AD-02 likely explains why presentation is out of scope.
- **Change:** Update to say presentation is NOW in scope at three tiers, with Tier 1 defined inline. Preserve the original rationale as historical context. Add: *"This decision was revisited in v1.1. Tier 1 presentation hints were added as OPTIONAL properties that do not affect data semantics. The separation of concerns is maintained: presentation hints are advisory, never normative for data capture."*
- **Estimated delta:** ~20 lines net change.

#### G. §9 / Appendix — Changelog Entry (~10 lines)

- Add v1.1 changelog entry listing all new properties.

### 1.3 Total Spec Delta

| Section | Lines Added/Changed |
|---------|--------------------|
| §2 (Architecture) | +30 |
| §3 (Definition Root) | +60 |
| §4 (Items — presentation) | +250 |
| §5 (Data Types cross-refs) | +5 |
| AD-02 update | +20 |
| §9 / Changelog | +10 |
| **Total** | **~375 lines** |

---

## 2. Schema Changes to `definition.schema.json`

### 2.1 Current Schema Structure (277 lines)

The schema likely has:
- Top-level `$defs` with `Item`, `Field`, `Group`, `Display` sub-schemas
- A root Definition object with `items`, `metadata`, etc.

### 2.2 Changes Required

#### A. `formPresentation` on Definition root (~25 lines)

```json
"formPresentation": {
  "type": "object",
  "description": "Form-wide presentation defaults (Tier 1)",
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
    "styleHints": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "density": {
          "type": "string",
          "enum": ["compact", "comfortable", "spacious"],
          "default": "comfortable"
        }
      }
    }
  }
}
```

#### B. `presentation` sub-schema in `$defs` (~90 lines)

Define a reusable `$defs/presentation` object:

```json
"presentation": {
  "type": "object",
  "description": "Tier 1 presentation hints",
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
        "emphasis": {
          "type": "string",
          "enum": ["primary", "success", "warning", "danger", "muted"]
        },
        "size": {
          "type": "string",
          "enum": ["compact", "default", "large"]
        }
      }
    },
    "accessibility": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "role": { "type": "string" },
        "description": { "type": "string" },
        "liveRegion": {
          "type": "string",
          "enum": ["off", "polite", "assertive"]
        }
      }
    }
  }
}
```

**Key design decision:** `additionalProperties: true` on the top-level `presentation` object (forward-compat with Tier 2/3 or extensions), but `additionalProperties: false` on the nested sub-objects (`layout`, `styleHints`, `accessibility`) to catch typos.

**widgetHint is NOT an enum in the schema.** Rationale: the compatibility table is dataType-dependent, so static enum validation would either be too loose (allow incompatible combos) or require complex conditional schemas. Instead, `widgetHint` is `type: string` in the schema, and compatibility is enforced by the spec text + test suite. The spec lists the closed set of ~30 values normatively.

#### C. Add `presentation` to Field, Group, Display (~3 lines each, ~9 lines)

In each Item sub-schema, add:
```json
"presentation": { "$ref": "#/$defs/presentation" }
```

If Items share a common base via `allOf`/`$ref`, add it once to the base.

#### D. Total Schema Delta

| Change | Lines |
|--------|-------|
| `formPresentation` on root | +25 |
| `$defs/presentation` | +90 |
| Refs from Field/Group/Display | +9 |
| **Total** | **~124 lines** |

New schema size: ~400 lines (277 + 124).

---

## 3. Test Plan

### 3.1 New Test File: `tests/test_presentation_hints.py`

**Categories and estimated test counts:**

#### A. Schema Validation — formPresentation (15 tests)
- Valid: each pageMode value (3)
- Valid: each labelPosition value (3)
- Valid: each density value (3)
- Invalid: unknown pageMode → schema error (1)
- Invalid: unknown labelPosition → schema error (1)
- Invalid: unknown density → schema error (1)
- Valid: empty formPresentation object (1)
- Valid: formPresentation omitted entirely (1)
- Invalid: formPresentation with wrong type (e.g., string) (1)

#### B. Schema Validation — presentation on Items (20 tests)
- Valid: presentation on Field (1)
- Valid: presentation on Group (1)
- Valid: presentation on Display (1)
- Valid: empty presentation object (1)
- Valid: presentation omitted (1)
- Valid: unknown top-level key in presentation → passes (additionalProperties: true) (1)
- Invalid: layout.flow with bad value (1)
- Invalid: layout.columns = 0 (1)
- Invalid: layout.columns = 13 (1)
- Invalid: layout.colSpan = 0 (1)
- Valid: layout.columns = 1 (boundary) (1)
- Valid: layout.columns = 12 (boundary) (1)
- Invalid: styleHints.emphasis with bad value (1)
- Invalid: styleHints.size with bad value (1)
- Invalid: accessibility.liveRegion with bad value (1)
- Valid: all layout properties together (1)
- Valid: all styleHints properties together (1)
- Valid: all accessibility properties together (1)
- Invalid: layout.columns as string (type error) (1)
- Invalid: unknown key inside layout → schema error (additionalProperties: false) (1)

#### C. widgetHint / dataType Compatibility (25 tests)
- Valid: each major dataType with its primary widgetHint (10)
- Valid: dataType with each alternative widgetHint (8)
- Incompatible: widgetHint that doesn't match dataType → test documents expected processor behavior (fall back) (5)
- Completely unknown widgetHint string → schema passes (it's just a string) but spec says ignore (2)

#### D. Layout Property Semantics (15 tests)
- flow="grid" + columns on Group with children → valid structure (1)
- colSpan on child of grid Group → valid (1)
- newRow on child of grid Group → valid (1)
- collapsible/collapsedByDefault on Group → valid (1)
- collapsedByDefault without collapsible → valid schema, spec says ignored (1)
- page labels on items with pageMode="wizard" (2)
- page labels on items with pageMode="single" → valid but meaningless (1)
- Mixed page and no-page items → valid (1)
- Duplicate page labels → valid (items grouped together) (1)
- collapsible on Field → valid schema (no schema prohibition), semantically ignored (1)
- flow on Field → valid schema, semantically ignored (1)
- Grid layout: colSpan > columns → valid schema, renderer clamps (1)
- Nested groups with different layouts (1)
- All layout defaults (no layout object) → verify defaults (1)

#### E. Accessibility Properties (8 tests)
- role on Group → valid (1)
- role on Display → valid (1)
- description on Field → valid, distinct from item description (1)
- liveRegion on Display → valid (1)
- liveRegion defaults to "off" (1)
- All accessibility properties combined (1)
- Empty accessibility object → valid (1)
- Accessibility on Field vs Group vs Display → all valid (1)

#### F. Integration: Full Form Definitions (7 tests)
- Wizard form: formPresentation with pageMode="wizard", items with page labels (1)
- Tabs form: pageMode="tabs" with page labels (1)
- Grid layout form: Group with flow="grid", columns=3, children with colSpan (1)
- Compact density form: formPresentation.styleHints.density="compact" + compact-sized items (1)
- Accessibility-rich form: multiple items with roles, descriptions, liveRegion (1)
- Kitchen sink: every presentation property used at least once (1)
- Minimal form: no presentation properties at all → passes unchanged (regression) (1)

### 3.2 Existing Test Files — Regression

- Run ALL 1,244 existing tests unchanged. Zero presentation properties in existing fixtures → zero impact expected. If any fixture has `additionalProperties: false` at the Item level, adding `presentation` would break it — must verify schema structure first.

### 3.3 Test Totals

| Category | Count |
|----------|-------|
| formPresentation schema | 15 |
| presentation schema | 20 |
| widgetHint compatibility | 25 |
| Layout semantics | 15 |
| Accessibility | 8 |
| Integration / full forms | 7 |
| **New tests total** | **~90** |
| Existing regression | 1,244 (unchanged) |

---

## 4. Cross-Tier Contract

### 4.1 Normative Language (in §4.X.6)

Three normative paragraphs:

1. **Tier 2 inherits Tier 1:**
   > When a Tier 2 presentation theme is applied to a Definition, the theme's
   > property values take precedence over inline `presentation` hints. For any
   > property NOT specified by the theme (at the matching selector scope), the
   > inline hint value MUST be used as the effective value. If neither the theme
   > nor the inline hint specifies a property, the default from §4.X applies.

2. **Vocabulary consistency:**
   > Tier 2 theme documents MUST use the same property names and value
   > vocabularies defined in §3.X and §4.X for any properties they override.
   > A Tier 2 theme MUST NOT redefine the meaning of Tier 1 enum values.

3. **Tier 3 token reference:**
   > Tier 3 component documents MAY reference design tokens from a co-applied
   > Tier 2 theme. The token vocabulary is defined by the Tier 2 specification.
   > Tier 1 hints do not define design tokens.

### 4.2 Non-Normative Note (in §2.3)

Add an informative box:

> **Note:** The three presentation tiers form a layered system:
> - Tier 1 hints are always available inline and serve as defaults.
> - Tier 2 themes override hints with selector-based rules.
> - Tier 3 components provide full layout control.
>
> A renderer supporting only Tier 1 can ignore Tier 2/3 documents entirely.
> A renderer supporting Tier 2 automatically inherits Tier 1 as its baseline.

---

## 5. Hub Page Update (`index.html`)

- **No new files to link** (zero-new-files constraint for Tier 1).
- **Minor update:** If `index.html` has a feature list or version badge, update to reflect v1.1 / "now includes presentation hints."
- **Add row to any spec-links table:** If there's a table of sections, add "Presentation Hints — §3.X, §4.X" as a feature callout.
- **Estimated change:** ~5–10 lines.

---

## 6. Estimated Effort Summary

| Artifact | Lines Added/Changed | Notes |
|----------|-------------------|-------|
| `spec.md` | ~375 lines | 6 sections touched |
| `definition.schema.json` | ~124 lines | 3 schema objects |
| `tests/test_presentation_hints.py` | ~600–800 lines | ~90 tests |
| `index.html` | ~5–10 lines | version/feature callout |
| **Total** | **~1,100–1,300 lines** | |

**Estimated implementation time:** 2–3 focused sessions.

---

## 7. Ordered Task List

### Phase 1: Schema First (enables test-driven spec writing)

| # | Task | File(s) | Depends On |
|---|------|---------|------------|
| 1 | Read current `definition.schema.json` structure to understand `$defs` layout, Item base schema, and `additionalProperties` policy | `definition.schema.json` | — |
| 2 | Add `$defs/presentation` sub-schema (widgetHint, layout, styleHints, accessibility) | `definition.schema.json` | 1 |
| 3 | Add `"presentation": {"$ref": "#/$defs/presentation"}` to Field, Group, and Display schemas | `definition.schema.json` | 2 |
| 4 | Add `formPresentation` property to the Definition root schema | `definition.schema.json` | 1 |
| 5 | Run existing 1,244 tests — confirm zero regressions from schema additions | all test files | 2, 3, 4 |

### Phase 2: Tests (write before spec prose, validates design decisions)

| # | Task | File(s) | Depends On |
|---|------|---------|------------|
| 6 | Create `tests/test_presentation_hints.py` with test fixtures directory | new file | 5 |
| 7 | Write formPresentation schema validation tests (15 tests) | test file | 6 |
| 8 | Write presentation-on-Items schema validation tests (20 tests) | test file | 6 |
| 9 | Write widgetHint/dataType compatibility tests (25 tests) — these will reference the spec's compatibility table | test file | 6 |
| 10 | Write layout property semantics tests (15 tests) | test file | 6 |
| 11 | Write accessibility property tests (8 tests) | test file | 6 |
| 12 | Write full-form integration tests (7 tests) | test file | 6 |
| 13 | Run all new tests — confirm they pass against schema | — | 7–12 |

### Phase 3: Spec Prose

| # | Task | File(s) | Depends On |
|---|------|---------|------------|
| 14 | Update §2.3 — introduce 3-tier presentation architecture | `spec.md` | 5 |
| 15 | Write §3.X — `formPresentation` (pageMode, labelPosition, styleHints.density) | `spec.md` | 14 |
| 16 | Write §4.X.1 — widgetHint + full compatibility table | `spec.md` | 14 |
| 17 | Write §4.X.2 — layout (flow, columns, colSpan, newRow, collapsible, page) | `spec.md` | 14 |
| 18 | Write §4.X.3 — styleHints (emphasis, size) | `spec.md` | 14 |
| 19 | Write §4.X.4 — accessibility (role, description, liveRegion) | `spec.md` | 14 |
| 20 | Write §4.X.5 — Inheritance & Defaults | `spec.md` | 15–19 |
| 21 | Write §4.X.6 — Cross-Tier Inheritance Contract | `spec.md` | 20 |
| 22 | Update AD-02 discussion with historical note + revised position | `spec.md` | 14 |
| 23 | Add cross-references in §5 dataType subsections | `spec.md` | 16 |
| 24 | Add changelog entry for v1.1 | `spec.md` | 15–23 |

### Phase 4: Finalize

| # | Task | File(s) | Depends On |
|---|------|---------|------------|
| 25 | Update `index.html` with v1.1 feature callout | `index.html` | 24 |
| 26 | Full test suite run (all 1,244 + ~90 new = ~1,334 tests) | — | 13, 24 |
| 27 | Proof-read all new spec text for RFC 2119 keyword consistency | `spec.md` | 24 |
| 28 | Verify schema ↔ spec consistency (every schema property documented, every spec property in schema) | both | 24, 26 |
| 29 | Verify all internal cross-references (§ numbers, table refs) | `spec.md` | 27 |
| 30 | Final commit: "Add Tier 1 presentation hints (§3.X, §4.X)" | all files | 26–29 |

---

## 8. Open Design Questions (to resolve during implementation)

| # | Question | Proposed Answer |
|---|----------|-----------------|
| Q1 | Should `widgetHint` be a schema enum or free string? | Free string in schema (see §2.2B rationale). Closed set in spec prose. |
| Q2 | Should `presentation.additionalProperties` be true or false? | True at top level (forward-compat). False on nested objects (typo safety). |
| Q3 | Does `labelPosition` in `formPresentation` cascade, or is it just a default? | It's a form-wide default. No per-item override in Tier 1 (keep simple). Consider adding per-item override as a Tier 1.1 addition if demand arises. |
| Q4 | Should `page` be on the item or on a Group? | On any Item. This allows individual fields to declare their page. A Group with `page` puts all its children on that page. A child with its own `page` overrides the parent Group's page. |
| Q5 | What section numbers to use? | Determine after reading actual spec structure. Use §3.N+1 for formPresentation, §4.N+1 for presentation. |
| Q6 | Should the compatibility table be normative or informative? | Normative. Incompatible widgetHint MUST be ignored. |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Existing tests break due to `additionalProperties: false` on Items | Step 1: inspect schema before any changes. If Items use `additionalProperties: false`, must add `presentation` to `properties` first. |
| Section numbering conflicts with existing content | Read actual §-numbers before writing. Use placeholder "§X" in plan, resolve in step 14. |
| widgetHint enum grows uncontrollably | Keep initial set to ~30 well-established values. Document that additions go through `extension-registry.md` process. |
| Tier 2/3 design changes invalidate Tier 1 contract | Keep contract language minimal and directional ("Tier 2 overrides Tier 1"). Avoid specifying Tier 2 mechanisms. |
