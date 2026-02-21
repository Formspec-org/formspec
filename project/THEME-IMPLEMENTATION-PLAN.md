# Tier 2 Implementation Plan: Sidecar Theme Document (Approach B)

**Status:** Planning  
**Date:** 2025-01-25  
**Depends on:** Tier 1 (presentation hints) being finalized in `spec.md`

---

## 1. New Spec Document: `theme-spec.md`

### Proposed Table of Contents

```
§1  Introduction
    §1.1  Purpose and Scope                          [informative]
    §1.2  Relationship to Formspec Definition Spec   [informative]
    §1.3  Relationship to Tier 1 Hints and Tier 3 Components  [informative]
    §1.4  Conformance Language (RFC 2119)             [normative]
    §1.5  Notational Conventions                     [normative]
    §1.6  Media Type and File Extension              [normative]

§2  Theme Document Structure
    §2.1  Top-Level Properties                       [normative]
          - $schema, url, version, name, description
    §2.2  Target Definition Binding                  [normative]
          - targetDefinition.url
          - targetDefinition.compatibleVersions (semver range)
    §2.3  Platform Declaration                       [normative]
          - platform (e.g., "web", "ios", "android", "pdf", "universal")
    §2.4  Theme Versioning                           [normative]
          - version (semver), changelog conventions

§3  Design Tokens
    §3.1  Token Format (DTCG Alignment)              [normative]
          - $value, $type, $description
    §3.2  Color Tokens                               [normative]
          - Hex, RGB, HSL, named references
    §3.3  Typography Tokens                          [normative]
          - fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
    §3.4  Spacing Tokens                             [normative]
          - Scale system (e.g., spacing.xs through spacing.3xl)
    §3.5  Border Tokens                              [normative]
          - borderWidth, borderStyle, borderColor, borderRadius
    §3.6  Elevation Tokens                           [normative]
          - boxShadow / elevation levels
    §3.7  Token References and Aliases               [normative]
          - "{tokens.color.primary}" reference syntax
    §3.8  Custom Token Groups                        [normative]
          - Extensibility for renderer-specific tokens

§4  Widget Catalog
    §4.1  Widget Enumeration                         [normative]
          - 16+ widget types: textInput, textArea, numberInput,
            slider, select, combobox, radioGroup, checkboxGroup,
            toggle, datePicker, timePicker, dateTimePicker,
            fileUpload, richTextEditor, rating, colorPicker,
            signaturePad, addressBlock, phoneInput, masked
    §4.2  Widget–DataType Compatibility Matrix       [normative]
          - Which widgets are valid for which item types/dataTypes
    §4.3  Typed widgetConfig Objects                  [normative]
          - Per-widget configuration schemas
          - e.g., slider: { min, max, step, showTicks, showLabels }
          - e.g., select: { searchable, clearable, maxDisplayItems }
    §4.4  Fallback Chains                            [normative]
          - Ordered list of fallback widgets when preferred is unavailable
          - e.g., combobox → select → radioGroup (for small option sets)
    §4.5  Widget Rendering Requirements              [normative]
          - MUST/SHOULD/MAY for each widget type

§5  Selector Cascade
    §5.1  Overview and Specificity Model             [normative]
    §5.2  Level 1: defaults                          [normative]
          - Global defaults applied to all items
          - Keyed by CSS-like property groups (typography, spacing, etc.)
    §5.3  Level 2: Type and DataType Selectors       [normative]
          - selectors[].match.type / selectors[].match.dataType
          - e.g., { match: { type: "text", dataType: "email" }, apply: { widget: "textInput", ... } }
    §5.4  Level 3: Path Pattern Selectors            [normative]
          - selectors[].match.path with glob patterns
          - e.g., "contact.*", "addresses[*].street"
          - Pattern syntax: * (single segment), ** (recursive), [*] (array)
    §5.5  Level 4: Item Key Overrides                [normative]
          - items.{key} — direct per-item configuration
    §5.6  Cascade Resolution Algorithm               [normative]
          - Specificity ordering: defaults < type/dataType < path < items.{key}
          - Deep merge semantics at each level
          - Explicit null to suppress inherited value
    §5.7  Interaction with Tier 1 Hints              [normative]
          - Tier 1 inline hints are treated as Level 0 (lowest specificity)
          - Theme selectors override Tier 1 values
          - Tier 1 acts as author-specified defaults

§6  Page Layout System
    §6.1  Pages Array                                [normative]
          - Ordered list of page objects
          - Each page: id, title, description, regions
    §6.2  12-Column Grid Model                       [normative]
          - columns: 12 (default), gutter, margin
    §6.3  Regions                                    [normative]
          - region.id, region.items (array of item key references)
          - region.span (column span), region.start (column start)
          - region.order (visual order override)
    §6.4  Responsive Breakpoints                     [normative]
          - Named breakpoints: xs (<576), sm (≥576), md (≥768), lg (≥992), xl (≥1200)
          - Per-region responsive overrides: region.responsive.{breakpoint}
          - Breakpoint customization at theme level
    §6.5  Conditional Visibility in Layout           [normative]
          - How FEL conditions interact with layout regions
    §6.6  Page Navigation and Flow                   [normative]
          - Linear vs. non-linear progression
          - Page-level presentation (wizard, tabs, accordion, scroll)

§7  Theme Inheritance
    §7.1  The extends Property                       [normative]
          - extends: url or array of urls
    §7.2  Deep Merge Semantics                       [normative]
          - Object: recursive merge, child wins
          - Array: replace (not concatenate) by default
          - arrayMerge: "replace" | "append" | "byKey" per property
    §7.3  Inheritance Chain Resolution               [normative]
          - Order of evaluation, cycle detection
          - Maximum chain depth: 8 (RECOMMENDED)
    §7.4  Token Override Patterns                    [normative]
          - Partial token group override vs. full replacement

§8  Processing Model
    §8.1  Theme Loading and Validation               [normative]
    §8.2  Target Definition Compatibility Check      [normative]
          - semver satisfaction of compatibleVersions
    §8.3  Full Resolution Algorithm                  [normative]
          - Step-by-step: load theme chain → merge inheritance →
            resolve tokens → merge Tier 1 hints → apply cascade →
            compute layout → emit resolved presentation
    §8.4  Error Handling                             [normative]
          - Unknown item keys: SHOULD warn, MUST NOT fail
          - Invalid widget for dataType: MUST fall back
          - Missing token reference: MUST use platform default

§9  Extensibility
    §9.1  Custom Widgets via x- Prefix               [normative]
    §9.2  Custom Token Groups                        [normative]
    §9.3  Platform-Specific Extensions               [normative]
    §9.4  Relationship to Extension Registry         [informative]

§10 Security and Accessibility Considerations
    §10.1 Color Contrast Requirements                [normative]
    §10.2 Font Size Minimums                         [normative]
    §10.3 Theme URL Resolution Security              [normative]
    §10.4 Accessibility Annotations in Themes        [normative]

Appendix A  Complete Theme Document Example          [informative]
Appendix B  Widget–DataType Compatibility Table      [normative]
Appendix C  Token Reference Quick Reference          [informative]
Appendix D  Migration from Tier 1–Only to Tier 2    [informative]
```

### Estimates

- **Estimated length:** 2,800–3,400 lines (comparable to `mapping-spec.md` at 1,998 lines but larger due to widget catalog, layout system, and token specs)
- **Normative sections:** §2–§10 (core spec)
- **Informative sections:** §1, Appendices A/C/D
- **Mixed:** Appendix B (normative table, informative notes)

---

## 2. New JSON Schema: `theme.schema.json`

### Top-Level Structure

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://formspec.org/schemas/theme/v1/theme.schema.json",
  "type": "object",
  "required": ["$schema", "version", "targetDefinition"],
  "properties": {
    "$schema": { "type": "string", "format": "uri" },
    "url": { "type": "string", "format": "uri" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "version": { "$ref": "#/$defs/semver" },
    "targetDefinition": { "$ref": "#/$defs/targetDefinition" },
    "platform": { "$ref": "#/$defs/platform" },
    "extends": { "$ref": "#/$defs/themeExtends" },
    "tokens": { "$ref": "#/$defs/designTokens" },
    "defaults": { "$ref": "#/$defs/presentationBlock" },
    "selectors": { "type": "array", "items": { "$ref": "#/$defs/selector" } },
    "items": { "type": "object", "additionalProperties": { "$ref": "#/$defs/presentationBlock" } },
    "pages": { "type": "array", "items": { "$ref": "#/$defs/page" } }
  },
  "$defs": { /* see below */ }
}
```

### Key Subschemas (`$defs`)

| Subschema | Description | Est. Lines |
|---|---|---|
| `targetDefinition` | `url` (uri) + `compatibleVersions` (semver range string) | 15 |
| `platform` | Enum: `web`, `ios`, `android`, `pdf`, `universal` + extensible string | 8 |
| `themeExtends` | Single URI or array of URIs for inheritance chain | 12 |
| `designTokens` | Object with groups: `color`, `typography`, `spacing`, `border`, `elevation`, each containing DTCG-format tokens | 120 |
| `tokenValue` | DTCG token: `$value`, `$type`, `$description` + reference pattern `{tokens.*}` | 25 |
| `selector` | `match` (type/dataType/path) + `apply` (presentationBlock) | 35 |
| `selectorMatch` | `type` (item type enum), `dataType` (string enum), `path` (glob pattern) | 30 |
| `presentationBlock` | `widget`, `widgetConfig`, `label`, `layout`, `className`, `style`, `accessibility` | 40 |
| `widget` | Enum of 16+ widget identifiers + `x-*` pattern for custom | 20 |
| `widgetConfig` | Discriminated union (if/then/else or oneOf) per widget type | 180 |
| `widgetConfigSlider` | `min`, `max`, `step`, `showTicks`, `showLabels`, `orientation` | 20 |
| `widgetConfigSelect` | `searchable`, `clearable`, `maxDisplayItems`, `placeholder` | 18 |
| *(12+ more widgetConfig variants)* | Per-widget typed config | ~200 |
| `fallbackChain` | Array of widget identifiers, ordered | 10 |
| `page` | `id`, `title`, `description`, `regions`, `navigation` | 30 |
| `region` | `id`, `items` (key refs), `span`, `start`, `order`, `responsive` | 35 |
| `responsiveOverrides` | Keyed by breakpoint name → partial region properties | 30 |
| `breakpoints` | `xs`, `sm`, `md`, `lg`, `xl` with min-width values | 25 |
| `gridConfig` | `columns` (default 12), `gutter`, `margin` | 15 |
| `semver` | Pattern-validated semver string | 8 |
| `accessibilityBlock` | `ariaLabel`, `ariaDescribedBy`, `role`, `tabIndex` | 15 |

### Estimated Total: 550–700 lines

---

## 3. Changes to `spec.md`

### §2.3 (Layer 3 — Presentation Layer) Updates

The current spec.md §2.3 describes the presentation layer. It needs:

1. **Add Tier model overview** — Insert a subsection (or expand existing prose) describing the 3-tier presentation model:
   - Tier 1: Inline `presentation` on items and `formPresentation` on root (defined here in spec.md)
   - Tier 2: Sidecar Theme Document (defined in `theme-spec.md`)
   - Tier 3: Component Document (future, defined in a separate companion spec)

2. **Add normative cross-reference** — A paragraph like:
   > A Definition MAY be accompanied by one or more Theme Documents as defined in the *Formspec Theme Specification* [THEME-SPEC]. When a Theme Document targets a Definition, the theme's cascade (§5 of [THEME-SPEC]) is applied after Tier 1 inline hints. Renderers that support Tier 2 theming MUST implement the cascade resolution algorithm specified in [THEME-SPEC] §8.3.

3. **Add to references section** — Add `[THEME-SPEC]` to the normative references.

4. **Clarify Tier 1 hint properties** — Ensure every `presentation` property documented in spec.md has a clear property name that the theme spec can reference in its cascade. If any `presentation` properties are currently loosely defined, tighten them now.

### Estimated change: ~30–50 lines added/modified in spec.md

---

## 4. Test Plan

### Test Files

| File | Category | Est. Tests |
|---|---|---|
| `tests/theme/theme-schema-valid.json` | Valid theme documents pass schema validation | 45 |
| `tests/theme/theme-schema-invalid.json` | Invalid theme documents fail schema validation | 55 |
| `tests/theme/theme-tokens-valid.json` | Valid token definitions (DTCG format, references, all groups) | 25 |
| `tests/theme/theme-tokens-invalid.json` | Invalid tokens (circular refs, bad format, unknown $type) | 20 |
| `tests/theme/theme-selectors-valid.json` | Valid selector definitions and match patterns | 30 |
| `tests/theme/theme-selectors-invalid.json` | Invalid selectors (bad globs, conflicting matches) | 20 |
| `tests/theme/theme-cascade-resolution.json` | Specificity resolution across 4 cascade levels | 40 |
| `tests/theme/theme-widget-compat.json` | Widget–dataType compatibility (valid and invalid pairings) | 35 |
| `tests/theme/theme-widget-fallback.json` | Fallback chain resolution when preferred widget unavailable | 15 |
| `tests/theme/theme-layout-valid.json` | Valid page/region/grid configurations | 25 |
| `tests/theme/theme-layout-invalid.json` | Invalid layouts (span > 12, missing item refs, etc.) | 20 |
| `tests/theme/theme-responsive.json` | Responsive breakpoint overrides, custom breakpoints | 20 |
| `tests/theme/theme-inheritance.json` | Deep merge, multi-level extends, cycle detection | 30 |
| `tests/theme/theme-tier1-integration.json` | Tier 1 hints + Tier 2 theme merge behavior | 25 |
| `tests/theme/theme-lifecycle-compat.json` | targetDefinition version range satisfaction | 15 |
| `tests/theme/theme-extensibility.json` | x- prefixed custom widgets, custom token groups | 12 |

### Test Categories Summary

| Category | Tests |
|---|---|
| Schema validation (valid) | 95 |
| Schema validation (invalid) | 115 |
| Cascade/specificity resolution | 40 |
| Widget/dataType compatibility | 50 |
| Layout and responsive | 65 |
| Inheritance and merge | 30 |
| Cross-tier integration | 25 |
| Lifecycle compatibility | 15 |
| Extensibility | 12 |
| **Total** | **~447** |

---

## 5. Cross-Tier Contracts

### Tier 1 → Tier 2: Theme Inherits Hints

**Normative language needed in `theme-spec.md` §5.7 and `spec.md` §2.3:**

> When resolving the effective presentation for an item, processors MUST apply values in the following precedence (highest wins):
>
> 1. Theme `items.{key}` override (Tier 2, Level 4)
> 2. Theme path-pattern selector match (Tier 2, Level 3)
> 3. Theme type/dataType selector match (Tier 2, Level 2)
> 4. Theme `defaults` (Tier 2, Level 1)
> 5. Inline `presentation` on the item (Tier 1)
> 6. Inline `formPresentation` on the Definition root (Tier 1 global)
> 7. Renderer platform defaults
>
> At each level, properties are deep-merged. A property set to `null` explicitly suppresses the inherited value from lower-precedence levels.

**Property name alignment contract:**

> Theme `presentationBlock` property names MUST use identical keys to the Tier 1 `presentation` object properties defined in [FORMSPEC] §2.3. This ensures a theme's `widget: "slider"` overrides an inline `presentation.widget: "numberInput"` without name translation.

**Mapping of Tier 1 properties to theme cascade:**

| Tier 1 `presentation` property | Theme cascade location |
|---|---|
| `widget` | `presentationBlock.widget` |
| `widgetConfig` | `presentationBlock.widgetConfig` |
| `label.position` | `presentationBlock.label.position` |
| `placeholder` | `presentationBlock.placeholder` |
| `className` | `presentationBlock.className` |
| `width` | `presentationBlock.layout.width` (normalized) |

### Tier 2 → Tier 3: Components Reference Tokens

**Normative language needed (in both `theme-spec.md` §3.7 and future `component-spec.md`):**

> Tier 3 Component Documents MAY reference Tier 2 design tokens using the token reference syntax `{tokens.<group>.<name>}`. When a Tier 3 document references a token, the processor MUST resolve it against the active Tier 2 Theme Document's `tokens` object. If no Tier 2 theme is active, the processor MUST use platform defaults.

**Token reference syntax (defined now, consumed by Tier 3 later):**

```
"{tokens.color.primary}"       → resolved from theme.tokens.color.primary.$value
"{tokens.spacing.md}"          → resolved from theme.tokens.spacing.md.$value
"{tokens.typography.heading1}"  → resolved from theme.tokens.typography.heading1.$value
```

> The token reference syntax MUST be `{tokens.<path>}` where `<path>` is a dot-delimited path into the `tokens` object. Processors MUST resolve `$value` from the matched token. This syntax is reserved across all tiers.

**Forward-compatibility clause:**

> Theme Documents SHOULD define tokens with stable names. Token names form a public contract between Tier 2 and Tier 3. Removing a token from a theme that is referenced by a Component Document is a breaking change and MUST be reflected in a major version increment of the theme's `version`.

---

## 6. Hub Page Update (`index.html`)

Add to the specifications listing in `index.html`:

```html
<!-- In the specs/documents list, after mapping-spec entry -->
<li>
  <a href="theme-spec.html">Formspec Theme Specification v1.0</a>
  — Sidecar theme documents: design tokens, widget selection, selector cascade, responsive layout
</li>

<!-- In the schemas list -->
<li>
  <a href="theme.schema.json">theme.schema.json</a>
  — JSON Schema for Formspec Theme Documents
</li>
```

Also update any "companion specifications" or "ecosystem" summary paragraph to mention the 3-tier model.

---

## 7. Estimated Effort

| Artifact | Estimated Size |
|---|---|
| `theme-spec.md` | 2,800–3,400 lines |
| `theme.schema.json` | 550–700 lines |
| `spec.md` changes | 30–50 lines modified/added |
| `index.html` changes | 10–15 lines |
| Test files (16 files) | ~3,500–4,200 lines total |
| Tests count | ~447 tests |
| **Total new content** | **~7,000–8,400 lines** |

---

## 8. Ordered Task List

### Phase 0: Prerequisites (Tier 1 Dependency)

| # | Task | Depends On | Output |
|---|---|---|---|
| 0.1 | Finalize Tier 1 `presentation` property names and types in `spec.md` | — | Updated spec.md §2.3 with stable Tier 1 property names |
| 0.2 | Finalize Tier 1 `formPresentation` root-level property in `spec.md` | — | Updated spec.md |
| 0.3 | Update `definition.schema.json` with final Tier 1 presentation schemas | 0.1, 0.2 | Updated definition.schema.json |
| 0.4 | Write/update Tier 1 tests confirming presentation property schemas | 0.3 | Test files passing |

### Phase 1: Theme Schema

| # | Task | Depends On | Output |
|---|---|---|---|
| 1.1 | Draft `theme.schema.json` — top-level structure, targetDefinition, platform, extends | 0.1 | theme.schema.json (scaffold) |
| 1.2 | Add `$defs/designTokens` — all 5 token groups in DTCG format, token references | 1.1 | theme.schema.json (tokens) |
| 1.3 | Add `$defs/widget` enum and `$defs/widgetConfig` discriminated union for all 16+ widgets | 1.1 | theme.schema.json (widgets) |
| 1.4 | Add `$defs/selector`, `$defs/selectorMatch`, `$defs/presentationBlock` | 1.1, 1.3 | theme.schema.json (selectors) |
| 1.5 | Add `$defs/page`, `$defs/region`, `$defs/responsiveOverrides`, `$defs/breakpoints`, `$defs/gridConfig` | 1.1 | theme.schema.json (layout) |
| 1.6 | Add `$defs/themeExtends`, `$defs/semver`, `$defs/accessibilityBlock` | 1.1 | theme.schema.json (utilities) |
| 1.7 | Review and validate full schema (self-consistency, $ref resolution, draft 2020-12 compliance) | 1.2–1.6 | theme.schema.json (final) |

### Phase 2: Theme Spec Document

| # | Task | Depends On | Output |
|---|---|---|---|
| 2.1 | Write §1 Introduction (purpose, relationships, conformance) | 0.1 | theme-spec.md §1 |
| 2.2 | Write §2 Theme Document Structure (top-level props, target binding, platform, versioning) | 1.1 | theme-spec.md §2 |
| 2.3 | Write §3 Design Tokens (DTCG format, all groups, references, aliases, custom groups) | 1.2 | theme-spec.md §3 |
| 2.4 | Write §4 Widget Catalog (enumeration, compat matrix, typed configs, fallback chains) | 1.3 | theme-spec.md §4 |
| 2.5 | Write §5 Selector Cascade (4 levels, resolution algorithm, Tier 1 interaction) | 1.4, 0.1 | theme-spec.md §5 |
| 2.6 | Write §6 Page Layout System (pages, grid, regions, responsive, conditional visibility) | 1.5 | theme-spec.md §6 |
| 2.7 | Write §7 Theme Inheritance (extends, deep merge, chain resolution) | 1.6 | theme-spec.md §7 |
| 2.8 | Write §8 Processing Model (loading, validation, full resolution algorithm, errors) | 2.2–2.7 | theme-spec.md §8 |
| 2.9 | Write §9 Extensibility (x- prefix, custom tokens, platform extensions) | 2.3, 2.4 | theme-spec.md §9 |
| 2.10 | Write §10 Security and Accessibility | — | theme-spec.md §10 |
| 2.11 | Write Appendices A–D (examples, compat table, quick ref, migration guide) | 2.2–2.9 | theme-spec.md appendices |
| 2.12 | Full spec review pass — normative language audit, internal cross-refs, consistency with schema | 2.1–2.11, 1.7 | theme-spec.md (final) |

### Phase 3: Tests

| # | Task | Depends On | Output |
|---|---|---|---|
| 3.1 | Create `tests/theme/` directory structure and test harness conventions | 1.7 | Directory + README |
| 3.2 | Write schema validation tests — valid themes (45 tests) | 1.7 | theme-schema-valid.json |
| 3.3 | Write schema validation tests — invalid themes (55 tests) | 1.7 | theme-schema-invalid.json |
| 3.4 | Write token tests — valid (25) + invalid (20) | 1.2, 1.7 | theme-tokens-*.json |
| 3.5 | Write selector tests — valid (30) + invalid (20) | 1.4, 1.7 | theme-selectors-*.json |
| 3.6 | Write cascade resolution tests (40 tests) | 2.5 | theme-cascade-resolution.json |
| 3.7 | Write widget compatibility tests (35) + fallback tests (15) | 2.4 | theme-widget-*.json |
| 3.8 | Write layout tests — valid (25) + invalid (20) + responsive (20) | 1.5, 1.7 | theme-layout-*.json, theme-responsive.json |
| 3.9 | Write inheritance/merge tests (30 tests) | 2.7 | theme-inheritance.json |
| 3.10 | Write Tier 1 integration tests (25 tests) | 2.5, 0.4 | theme-tier1-integration.json |
| 3.11 | Write lifecycle compatibility tests (15 tests) | 2.2 | theme-lifecycle-compat.json |
| 3.12 | Write extensibility tests (12 tests) | 2.9 | theme-extensibility.json |
| 3.13 | Run full test suite, fix regressions | 3.2–3.12 | All tests green |

### Phase 4: Integration

| # | Task | Depends On | Output |
|---|---|---|---|
| 4.1 | Update `spec.md` §2.3 — add 3-tier model overview and normative cross-reference to [THEME-SPEC] | 2.12 | Updated spec.md |
| 4.2 | Update `index.html` — add theme-spec and theme.schema.json links | 2.12, 1.7 | Updated index.html |
| 4.3 | Verify all existing 1,244 tests still pass (no regressions) | 4.1 | Clean test run |
| 4.4 | End-to-end walkthrough: author a sample theme for an existing test definition, verify cross-tier resolution narrative | 3.13, 4.1 | Sample theme in appendix / tests |

### Estimated Timeline

| Phase | Tasks | Character |
|---|---|---|
| Phase 0 | Tier 1 finalization | Prerequisite — must be done first |
| Phase 1 | Schema (1.1–1.7) | Can begin immediately after Phase 0 |
| Phase 2 | Spec doc (2.1–2.12) | Overlaps with Phase 1; schema informs spec |
| Phase 3 | Tests (3.1–3.13) | Begins after schema finalized; cascade/integration tests need spec |
| Phase 4 | Integration (4.1–4.4) | After Phases 1–3 complete |

---

## Key Design Decisions to Lock Down Before Implementation

1. **Exact Tier 1 `presentation` property names** — The theme schema must mirror these exactly. Any rename later is a breaking change across tiers.
2. **Widget enum list** — Finalize the 16+ widget identifiers. Each requires a typed widgetConfig subschema.
3. **Token reference syntax** — `{tokens.x.y}` must be consistent and parseable. Decide if FEL expressions can appear in token values.
4. **Path pattern glob syntax** — Align with or explicitly diverge from mapping-spec path patterns (if mapping-spec uses any).
5. **Array merge strategy default** — "replace" is safest for inheritance; confirm this won't surprise theme authors.
6. **Platform enum extensibility** — Open enum (any string) vs. closed enum + x- prefix for custom platforms.
