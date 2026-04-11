# ADR 0007: Tier 2 Revised Plan — Sidecar Theme Document

## Status
Implemented
**Approach:** New companion spec `theme-spec.md` + `theme.schema.json`
**Pattern:** Follows `mapping-spec.md` + `mapping.schema.json` companion-spec precedent
**Depends on:** Tier 1 (presentation hints) — COMPLETE, merged, 1,358 tests passing

---

## §0. Scope Reduction (Post-Review)

The combative review found the original plan was a "v3.0 theme spec wearing a v1.0 label." Key cuts:

| Original scope | Revised | Rationale |
|---|---|---|
| 5-level cascade (defaults→type→dataType→path→key) | **3-level** (defaults→dataType→key) | CSS took 25 years. 3 levels is implementable. |
| Theme inheritance via `extends` | **Dropped from v1.0** | Merge semantics are hard; add in v1.1 after battle-testing |
| DTCG token format (normative) | **DTCG-inspired** (informative reference) | DTCG is still a draft W3C community report |
| Composite widgets (`addressBlock`, `phoneInput`) | **Removed** | These are Tier 3 components, not Tier 2 widgets |
| Closed platform enum | **Open string** with well-known values | Future-proof |
| 447 tests | **~200 tests** | Proportionate to spec complexity |
| Normative accessibility/contrast requirements (§10) | **Informative** | Reference WCAG 2.2, don't restate it |
| ~2,800-3,400 line spec | **~1,400-1,800 lines** | Proportionate to mapping-spec (1,999 lines) |

### Token syntax decision (cross-tier)

The combative reviews for both Tier 2 and Tier 3 flagged a **CRITICAL** syntax conflict:
- Tier 2 proposal used `{tokens.color.primary}` (curly braces)
- Tier 3 proposal used `$token.colorPrimary` (dollar prefix)
- Tier 3 also uses `{param}` for component template interpolation

**Resolution:** Use `$token.` prefix (dollar-sign dot-path) for token references across all tiers.
- `$token.color.primary` — unambiguous, no collision with `{param}` interpolation
- Consistent with FEL's `$fieldKey` convention for references
- Curly braces reserved exclusively for Tier 3 `{param}` interpolation

---

## §1. Ground Truth — Current State

### What Tier 1 provides (now implemented)

- `formPresentation` on Definition root: `pageMode`, `labelPosition`, `density`
- `presentation` on Items: `widgetHint`, `layout` (flow/columns/colSpan/newRow/collapsible/page), `styleHints` (emphasis/size), `accessibility` (role/description/liveRegion)
- `presentation` top-level has `additionalProperties: true` (forward-compatible)
- 40 widgetHint values across 13 dataTypes + 4 group + 4 display
- Per §4.2.5.6: future companion specs are expected to treat inline hints as defaults

### What the theme spec adds on top

A **separate JSON document** that:
1. References a Definition by URL
2. Overrides Tier 1 hints with a selector cascade
3. Assigns widgets with typed configs and fallback chains
4. Defines layout pages with responsive grid
5. Provides design tokens for visual consistency

Multiple themes can target the same Definition (web, mobile, PDF, kiosk).

---
## §2. Spec Document: `theme-spec.md`

### Proposed Table of Contents

```
§1  Introduction                                        (~80 lines, informative)
  §1.1  Purpose and Scope
  §1.2  Relationship to Formspec Core and Tier 1 Hints
  §1.3  Conformance Language (RFC 2119)
  §1.4  Terminology
  §1.5  Notational Conventions

§2  Theme Document Structure                             (~150 lines, normative)
  §2.1  Top-Level Properties
        $schema, url, version, name, description
  §2.2  Target Definition Binding
        targetDefinition.url, targetDefinition.compatibleVersions (semver range)
  §2.3  Platform Declaration
        Open string; well-known values: "web", "mobile", "pdf", "print"
  §2.4  Theme Versioning

§3  Design Tokens                                        (~250 lines, normative)
  §3.1  Token Structure
        Flat key-value map; keys are dot-path names; values are strings/numbers
        Inspired by DTCG format but self-contained (informative DTCG reference)
  §3.2  Token Categories
        color, typography, spacing, border, elevation
        Each category has well-known key suffixes (informative)
  §3.3  Token Reference Syntax
        $token.color.primary — dollar-prefix dot-path
        Usable in widgetConfig string values and style overrides
  §3.4  Token Resolution
        Unresolved token → renderer MUST use platform default, SHOULD warn
  §3.5  Custom Token Groups
        x- prefix for vendor/domain-specific tokens

§4  Widget Catalog                                       (~300 lines, normative)
  §4.1  Relationship to Tier 1 widgetHint
        Theme widgets use the SAME vocabulary as §4.2.5.1
        Theme adds typed widgetConfig objects
  §4.2  Typed widgetConfig Objects
        Per-widget configuration schemas (one subsection per widget)
  §4.3  Fallback Chains
        Ordered list; renderer uses first supported widget
  §4.4  Widget Rendering Requirements
        MUST/SHOULD/MAY per widget type; base set vs progressive

§5  Selector Cascade                                     (~200 lines, normative)
  §5.1  Overview
        3-level cascade: defaults → dataType → item key
  §5.2  Level 1: defaults
        Applied to every item. Baseline widgetConfig, style, labelPosition.
  §5.3  Level 2: dataType Selectors
        selectors[].match.dataType → selectors[].apply
        selectors[].match.type (group/field/display) for non-field items
  §5.4  Level 3: Item Key Overrides
        items.{key} — direct per-item configuration, highest specificity
  §5.5  Cascade Resolution Algorithm
        Step-by-step: Tier 1 hints → defaults → dataType → item key
        Deep-merge at each level. Explicit null to suppress.
  §5.6  Interaction with Tier 1 Hints
        Tier 1 inline hints = Level 0 (lowest specificity)

§6  Page Layout System                                   (~200 lines, normative)
  §6.1  Pages Array
        Ordered list of page objects: id, title, description, regions
  §6.2  12-Column Grid Model
        columns (default 12), gutter, margin
  §6.3  Regions
        region.key (item key reference), region.span, region.start
        Group key pulls entire subtree including repeatable children
  §6.4  Responsive Breakpoints
        Top-level breakpoints: named → minWidth
        Per-region responsive overrides
  §6.5  Repeatable Groups in Layout
        Group key in a region = render entire group subtree
        Layout within a repeatable group is controlled by that group's
        Tier 1 presentation.layout, NOT the theme's page grid
  §6.6  Default Layout (No Pages)
        When pages array is absent, renderer walks item tree top-to-bottom

§7  Processing Model                                     (~150 lines, normative)
  §7.1  Theme Loading and Validation
  §7.2  Target Definition Compatibility Check
        semver satisfaction of compatibleVersions
  §7.3  Full Resolution Algorithm
        Load theme → resolve tokens → merge Tier 1 hints → apply cascade →
        compute layout → emit resolved presentation
  §7.4  Error Handling
        Unknown item keys: SHOULD warn, MUST NOT fail
        Invalid widget for dataType: MUST fall back
        Missing token reference: MUST use platform default
  §7.5  Null Theme (Default Rendering)
        When no theme is applied, renderers use Tier 1 hints + platform defaults
        Spec defines the "null theme" baseline

§8  Extensibility                                        (~80 lines, normative)
  §8.1  Custom Widgets via x- Prefix
  §8.2  Custom Token Groups via x- Prefix
  §8.3  Platform-Specific Extensions

§9  Security and Accessibility Considerations             (~60 lines, informative)
  §9.1  Theme URL Resolution Security
  §9.2  Accessibility Guidance (references WCAG 2.2, not restating it)
  §9.3  RTL / Bidirectional Layout Considerations

Appendix A  Complete Theme Document Example              (~80 lines, informative)
Appendix B  Widget–DataType Compatibility Table          (~40 lines, normative)
Appendix C  Token Quick Reference                        (~30 lines, informative)
```

### Estimated length: ~1,400–1,800 lines

Proportionate to `mapping-spec.md` (1,999 lines). The theme spec is simpler in some ways (no bidirectional transform logic) and more complex in others (visual vocabulary).

---
## §3. Schema: `theme.schema.json`

### Top-level structure

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://formspec.org/schemas/theme/1.0",
  "title": "Formspec Theme Document",
  "type": "object",
  "required": ["$formspecTheme", "version", "targetDefinition"],
  "additionalProperties": false,
  "properties": {
    "$formspecTheme": { "type": "string", "const": "1.0" },
    "url": { "type": "string", "format": "uri" },
    "version": { "type": "string", "minLength": 1 },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "targetDefinition": { "$ref": "#/$defs/TargetDefinition" },
    "platform": { "type": "string" },
    "tokens": { "$ref": "#/$defs/Tokens" },
    "defaults": { "$ref": "#/$defs/PresentationBlock" },
    "selectors": { "type": "array", "items": { "$ref": "#/$defs/Selector" } },
    "items": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/PresentationBlock" }
    },
    "pages": { "type": "array", "items": { "$ref": "#/$defs/Page" } },
    "breakpoints": { "$ref": "#/$defs/Breakpoints" },
    "extensions": {
      "type": "object",
      "propertyNames": { "pattern": "^x-" }
    }
  }
}
```

### Key $defs

| $def | Purpose | Est. lines |
|------|---------|------------|
| `TargetDefinition` | `url` (uri, required) + `compatibleVersions` (semver range string) | 15 |
| `Tokens` | `additionalProperties: { oneOf: [string, number] }` — flat key-value map | 10 |
| `PresentationBlock` | `widget` (string), `widgetConfig` (object), `labelPosition`, `style`, `accessibility` | 40 |
| `WidgetConfig` | Open object with well-known per-widget properties. NOT a discriminated union — too complex for v1. Instead: `additionalProperties: true` with spec-prose constraints. | 15 |
| `Selector` | `match` (object: `dataType`, `type`) + `apply` (PresentationBlock) | 25 |
| `Page` | `id`, `title`, `description`, `regions` array | 25 |
| `Region` | `key` (string, required), `span` (1-12), `responsive` (object) | 25 |
| `Breakpoints` | `additionalProperties: { type: integer, minimum: 0 }` — named breakpoints with min-width | 10 |
| **Total** | | **~165 lines** |

### Key schema design decisions

1. **`widgetConfig` is an open object**, not a discriminated union. The original plan wanted typed configs per widget (slider: {min, max, step}, select: {searchable, clearable}, etc.) — that's ~200 lines of schema for v1.0 with poor error messages. Instead: `additionalProperties: true` on widgetConfig, with per-widget property tables in spec prose. Tighten in v1.1 once widget configs stabilize.

2. **`platform` is a free string**, not an enum. Well-known values (`"web"`, `"mobile"`, `"pdf"`, `"print"`, `"kiosk"`) documented in spec prose.

3. **No `extends`** in v1.0 schema. Inheritance adds merge-strategy complexity (which arrays replace vs append). Defer to v1.1.

4. **`$formspecTheme: "1.0"`** follows the `$formspec: "1.0"` pattern from definition.schema.json.

### Estimated total: ~280–350 lines

Much smaller than the original 550-700 estimate because we dropped discriminated widgetConfig unions and extends.

---

## §4. Widget Catalog (for spec prose, not schema)

The theme uses the **same widget vocabulary** as Tier 1 §4.2.5.1. The theme adds typed `widgetConfig` objects.

### Required widgets (renderers MUST support)

| Widget | Applies to | Config properties |
|--------|-----------|-------------------|
| `textInput` | string, uri | `maxLength`, `inputMode` (`"text"`, `"email"`, `"tel"`, `"url"`) |
| `textarea` | text | `rows`, `maxRows`, `autoResize` |
| `numberInput` | integer, decimal | `showStepper`, `locale` |
| `checkbox` | boolean | (none) |
| `datePicker` | date, dateTime, time | `format`, `minDate`, `maxDate` |
| `dropdown` | choice | `searchable`, `placeholder` |
| `checkboxGroup` | multiChoice | `columns`, `maxVisible` |
| `fileUpload` | attachment | `accept`, `maxSizeMb`, `preview` |
| `moneyInput` | money | `showCurrencySymbol`, `locale` |

### Progressive widgets (renderers SHOULD support; MUST declare fallback)

| Widget | Applies to | Config | Fallback |
|--------|-----------|--------|----------|
| `slider` | integer, decimal | `min`, `max`, `step`, `showTicks`, `showValue` | `numberInput` |
| `stepper` | integer | `min`, `max`, `step` | `numberInput` |
| `rating` | integer | `max`, `icon` (`"star"`, `"heart"`) | `numberInput` |
| `toggle` | boolean | `onLabel`, `offLabel` | `checkbox` |
| `yesNo` | boolean | (none) | `checkbox` |
| `radio` | choice | `direction` (`"vertical"`, `"horizontal"`), `columns` | `dropdown` |
| `autocomplete` | choice, multiChoice | `debounceMs`, `minChars` | `dropdown` / `checkboxGroup` |
| `segmented` | choice | (none) | `radio` |
| `likert` | choice | `scaleLabels` | `radio` |
| `multiSelect` | multiChoice | `searchable`, `maxItems` | `checkboxGroup` |
| `richText` | text | `toolbar` (array of strings) | `textarea` |
| `password` | string | `showToggle` | `textInput` |
| `color` | string | `format` (`"hex"`, `"rgb"`) | `textInput` |
| `urlInput` | uri | (none) | `textInput` |
| `dateInput` | date | `format` | `datePicker` |
| `dateTimePicker` | dateTime | `format` | `datePicker` |
| `dateTimeInput` | dateTime | `format` | `textInput` |
| `timePicker` | time | `format`, `step` | `textInput` |
| `timeInput` | time | `format` | `textInput` |
| `camera` | attachment | `facing` (`"user"`, `"environment"`) | `fileUpload` |
| `signature` | attachment | `penColor`, `height` | `fileUpload` |

**Composite widgets (`addressBlock`, `phoneInput`) are NOT in the catalog.** These are Tier 3 custom components.

---
## §5. Cascade Resolution (Simplified)

### 3-level cascade + Tier 1 baseline

Effective precedence (highest wins):

| Level | Source | Example |
|-------|--------|--------|
| 3 | Theme `items.{key}` | `"items": { "totalBudget": { "widget": "slider" } }` |
| 2 | Theme `selectors[].match.dataType` | `{ "match": { "dataType": "money" }, "apply": { "widget": "moneyInput" } }` |
| 1 | Theme `defaults` | `{ "labelPosition": "start" }` |
| 0 | Tier 1 inline `presentation` on Item | `"presentation": { "widgetHint": "textInput" }` |
| -1 | Tier 1 `formPresentation` on root | `"formPresentation": { "labelPosition": "top" }` |
| -2 | Renderer platform defaults | (implementation-defined) |

### Resolution algorithm (pseudocode)

```
for each item in definition.items:
  resolved = {}
  
  # Level -2: renderer defaults (implicit)
  # Level -1: formPresentation globals
  merge(resolved, definition.formPresentation)
  
  # Level 0: Tier 1 inline hints
  merge(resolved, item.presentation)
  
  # Level 1: theme defaults
  merge(resolved, theme.defaults)
  
  # Level 2: matching selectors (in document order, all applied)
  for selector in theme.selectors:
    if matches(selector.match, item):
      merge(resolved, selector.apply)
  
  # Level 3: item key override
  if item.key in theme.items:
    merge(resolved, theme.items[item.key])
  
  # null suppression: any property set to null removes it
  strip_nulls(resolved)
```

`merge` is shallow per-property (not deep). `widgetConfig` merges one level deep (widget-level, not per-config-key). This avoids the "7-pass deep merge" complexity the combative review flagged.

### Selector matching

Selectors have a `match` object with AND semantics:

```json
{ "match": { "dataType": "decimal", "type": "field" }, "apply": { ... } }
```

| Match key | Matches |
|-----------|--------|
| `dataType` | Item's `dataType` (field items only) |
| `type` | Item's `type` (`"group"`, `"field"`, `"display"`) |

No path patterns in v1.0. Path patterns are a v1.1 candidate if demand warrants.

---

## §6. Changes to `spec.md`

Minimal cross-references only. The core spec already has the forward-compatibility note in §4.2.5.6.

| Location | Change |
|----------|--------|
| §2.3 Layer 3 | Add sentence: *"The Formspec Theme Specification [THEME-SPEC] defines sidecar theme documents that override Tier 1 presentation hints."* |
| §4.2.5.6 informative note | Add: *"See the Formspec Theme Specification for the sidecar theme document format."* |
| References section (if one exists) | Add `[THEME-SPEC]` normative reference |

Estimated: ~10 lines of additions.

---

## §7. Test Plan

All tests are pytest (matching existing pattern), not JSON fixture files.

### New file: `test_theme_schema.py`

| Category | Tests | Description |
|----------|-------|-------------|
| **Schema valid** | 30 | Minimal theme, full theme, each top-level property, tokens, selectors, items, pages |
| **Schema invalid** | 35 | Missing required fields, wrong types, bad breakpoint values, unknown keys at root |
| **Selector matching** | 20 | dataType selectors, type selectors, AND matching, no match (falls through), all-match |
| **Cascade resolution** | 25 | 3 levels + Tier 1 baseline; each level overriding the one below; null suppression; absent levels |
| **Widget/dataType compat** | 20 | Valid pairings, invalid pairings (fallback required), fallback chain resolution |
| **Layout pages** | 15 | Valid pages with regions, responsive overrides, group key pulling subtree, missing item key warning |
| **Token resolution** | 15 | Valid `$token.x` refs in widgetConfig strings, unresolved tokens, token override |
| **Tier 1 integration** | 15 | Theme + Definition with Tier 1 hints; verify cascade precedence at each level |
| **Lifecycle** | 10 | targetDefinition version range satisfaction, compatible/incompatible |
| **Extensibility** | 8 | `x-` prefixed widgets, `x-` prefixed tokens, `x-` extensions object |
| **Edge cases** | 7 | Empty theme (only required fields), empty selectors array, empty items object, empty pages |
| **Total** | **~200** |

### Existing regression

All 1,358 existing tests run unchanged. Theme tests are additive.

---
## §8. Ordered Task List

### Phase 1: Schema (6 tasks)

| # | Task | Output |
|---|------|--------|
| 1 | Draft `theme.schema.json` — top-level structure, TargetDefinition, Tokens, Breakpoints | Schema scaffold |
| 2 | Add `$defs/PresentationBlock` and `$defs/WidgetConfig` | Schema with presentation model |
| 3 | Add `$defs/Selector` with match/apply structure | Schema with selectors |
| 4 | Add `$defs/Page` and `$defs/Region` | Schema with layout |
| 5 | Validate schema against draft 2020-12 meta-schema | Passing meta-validation |
| 6 | Run existing 1,358 tests — confirm zero regressions | Green suite |

### Phase 2: Tests (4 tasks)

| # | Task | Output |
|---|------|--------|
| 7 | Create `test_theme_schema.py` scaffold with helpers | New file |
| 8 | Write schema validation + selector + cascade tests (~130 tests) | Tests passing |
| 9 | Write widget compat + layout + token + integration tests (~70 tests) | Tests passing |
| 10 | Run full suite (1,358 + ~200 = ~1,558) | All green |

### Phase 3: Spec Document (10 tasks)

| # | Task | Output |
|---|------|--------|
| 11 | Write §1 Introduction | theme-spec.md draft |
| 12 | Write §2 Theme Document Structure | Updated draft |
| 13 | Write §3 Design Tokens | Updated draft |
| 14 | Write §4 Widget Catalog (typed configs, fallback chains) | Updated draft |
| 15 | Write §5 Selector Cascade (3-level + resolution algorithm) | Updated draft |
| 16 | Write §6 Page Layout System (grid, regions, responsive, repeatable groups) | Updated draft |
| 17 | Write §7 Processing Model + §8 Extensibility | Updated draft |
| 18 | Write §9 Security/Accessibility + Appendices A–C | Complete draft |
| 19 | Full spec review — normative language audit, cross-refs, schema consistency | Reviewed |
| 20 | Proof-read: verify every schema property is documented, every documented property is in schema | Verified |

### Phase 4: Integration (4 tasks)

| # | Task | Output |
|---|------|--------|
| 21 | Add cross-references to `spec.md` (§2.3 + §4.2.5.6) | Updated spec.md |
| 22 | Update `index.html` — add theme-spec + theme.schema.json links | Updated hub |
| 23 | Run full test suite (~1,558 tests) | All green |
| 24 | Git commit: "Add Formspec Theme Specification (Tier 2)" | Committed |

**Total: 24 tasks across 4 phases.**

---

## §9. Effort Estimate

| Artifact | Size |
|----------|------|
| `theme-spec.md` | ~1,400–1,800 lines |
| `theme.schema.json` | ~280–350 lines |
| `test_theme_schema.py` | ~1,200–1,600 lines (~200 tests) |
| `spec.md` changes | ~10 lines |
| `index.html` changes | ~10 lines |
| **Total** | **~2,900–3,800 lines** |

---

## §10. Resolved Design Questions

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Cascade levels? | **3 levels** (defaults → dataType → item key). No path selectors in v1.0. |
| Q2 | Token syntax? | **`$token.path`** (dollar-prefix dot-path). Unified across Tier 2 and Tier 3. |
| Q3 | Token format? | **Flat key-value map.** DTCG referenced informatively, not normatively. |
| Q4 | Theme inheritance? | **Dropped from v1.0.** Add `extends` in v1.1 after merge semantics stabilize. |
| Q5 | Platform enum? | **Open string** with well-known values in spec prose. |
| Q6 | Composite widgets? | **Not in catalog.** These are Tier 3 custom components. |
| Q7 | widgetConfig in schema? | **Open object** (`additionalProperties: true`). Per-widget properties in spec prose only. Tighten in v1.1. |
| Q8 | Accessibility/contrast normative? | **Informative.** Reference WCAG 2.2. |
| Q9 | Merge semantics? | **Shallow merge** per-property, not deep. Avoids complex recursive merge. |
| Q10 | Repeatable groups in layout? | **Group key in region = render entire subtree.** Internal layout controlled by Tier 1 `presentation.layout`. |
| Q11 | Test format? | **pytest** (matching existing pattern). Not JSON fixtures. |
| Q12 | RTL support? | **Noted in §9.3** as a consideration. `labelPosition: "start"` already handles LTR/RTL via "leading side" semantics. |

---

## §11. Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Scope creep back to original 3,400 lines | Medium | Widget configs are open objects; no typed unions in schema. Inheritance deferred. |
| Token syntax conflict with Tier 3 | Eliminated | Decided: `$token.path` everywhere. `{param}` reserved for Tier 3 interpolation. |
| Cascade too complex | Low | 3 levels + shallow merge. Pseudocode in spec. |
| Theme references nonexistent item keys | Medium | §7.4: SHOULD warn, MUST NOT fail. Tooling validates key references. |
| widgetConfig proliferates without structure | Medium | v1.0 uses open object; v1.1 adds typed schemas once configs stabilize. |
| Spec grows disproportionately to mapping-spec | Low | Target 1,400–1,800 lines (mapping-spec is 1,999). |
| DTCG spec changes | Low | Only referenced informatively. Token structure is self-contained. |

---

## §12. Example Theme Document

```json
{
  "$formspecTheme": "1.0",
  "url": "https://agency.gov/forms/budget-2025/themes/web",
  "version": "1.0.0",
  "name": "Budget Form — Web",
  "targetDefinition": {
    "url": "https://agency.gov/forms/budget-2025",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "platform": "web",
  "breakpoints": {
    "sm": 576,
    "md": 768,
    "lg": 1024
  },
  "tokens": {
    "color.primary": "#0057B7",
    "color.error": "#D32F2F",
    "color.surface": "#FFFFFF",
    "spacing.sm": "8px",
    "spacing.md": "16px",
    "spacing.lg": "24px",
    "border.radius": "6px",
    "typography.body.family": "Inter, system-ui, sans-serif",
    "typography.body.size": "1rem"
  },
  "defaults": {
    "labelPosition": "top",
    "style": {
      "borderRadius": "$token.border.radius"
    }
  },
  "selectors": [
    {
      "match": { "dataType": "money" },
      "apply": {
        "widget": "moneyInput",
        "widgetConfig": { "showCurrencySymbol": true, "locale": "en-US" }
      }
    },
    {
      "match": { "dataType": "choice" },
      "apply": {
        "widget": "dropdown",
        "widgetConfig": { "searchable": false }
      }
    },
    {
      "match": { "dataType": "boolean" },
      "apply": {
        "widget": "toggle",
        "widgetConfig": { "onLabel": "Yes", "offLabel": "No" }
      }
    },
    {
      "match": { "type": "display" },
      "apply": { "widget": "paragraph" }
    }
  ],
  "items": {
    "totalBudget": {
      "widget": "moneyInput",
      "widgetConfig": { "showCurrencySymbol": true, "locale": "en-US" },
      "style": {
        "background": "#F0F6FF",
        "borderColor": "$token.color.primary",
        "borderWidth": "2px"
      }
    },
    "approverSignature": {
      "widget": "signature",
      "widgetConfig": { "penColor": "#000", "height": 150 },
      "fallback": "fileUpload"
    },
    "priorityLevel": {
      "widget": "slider",
      "widgetConfig": { "min": 1, "max": 5, "step": 1, "showTicks": true },
      "fallback": "dropdown"
    }
  },
  "pages": [
    {
      "id": "info",
      "title": "Project Information",
      "regions": [
        { "key": "projectName", "span": 8 },
        { "key": "projectCode", "span": 4 },
        { "key": "department", "span": 6 },
        { "key": "fiscalYear", "span": 6 },
        { "key": "description", "span": 12 }
      ]
    },
    {
      "id": "budget",
      "title": "Budget Details",
      "regions": [
        { "key": "lineItems", "span": 12 },
        { "key": "totalBudget", "span": 6 },
        { "key": "contingency", "span": 6 }
      ]
    },
    {
      "id": "review",
      "title": "Review & Submit",
      "regions": [
        { "key": "certify", "span": 12 },
        { "key": "approverSignature", "span": 12 }
      ]
    }
  ]
}
```
