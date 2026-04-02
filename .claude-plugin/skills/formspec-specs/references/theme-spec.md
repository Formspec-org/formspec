# Theme Specification Reference Map

> specs/theme/theme-spec.md -- 1167 lines, ~45K -- Tier 2: Design Tokens, Widget Catalog, Selector Cascade, Page Layout

## Overview

The Formspec Theme Specification defines the **sidecar theme document** format -- a separate JSON file that controls how a Formspec Definition is visually presented. It occupies Tier 2 of the three-tier architecture (Structure, Behavior, Presentation), sitting between Tier 1 inline hints embedded in Definitions and Tier 3 Component Documents. A Theme Document binds to a target Definition by URL, overrides inline presentation hints through a multi-level selector cascade, assigns widgets with typed configuration and fallback chains, defines page layout on a 12-column grid, and provides design tokens for visual consistency. Multiple themes can target the same Definition, enabling platform-specific rendering (web, mobile, PDF, kiosk) without modifying the Definition itself.

## Section Map

### Preamble and Introduction (Lines 1-80)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| (preamble) | Status of This Document | Declares this as a Draft companion specification to Formspec v1.0 Core. | Draft status, companion spec | Checking spec maturity or normative status |
| (preamble) | Conventions and Terminology | Establishes RFC 2119 keyword interpretation for normative language. | MUST, SHOULD, MAY, RFC 2119 | Interpreting normative requirements |
| 1 | Introduction | Introduces the theme document concept and its role in the three-tier architecture. | Theme document, sidecar, three-tier | Understanding why themes exist and what they control |
| 1.1 | Purpose and Scope | Defines what a Theme Document does: references a Definition by URL, overrides inline hints via selector cascade, assigns widgets, defines page layout, provides design tokens. Multiple themes can target the same Definition. | sidecar, selector cascade, 12-column grid, design tokens, platform-specific rendering | Understanding the scope of what themes can and cannot control |
| 1.2 | Relationship to Formspec Core | Maps the three-layer architecture (Structure, Behavior, Presentation) to specific spec sections. Tier 1 hints are author-specified defaults; Tier 2 themes override them. | Tier 1 (inline hints), Tier 2 (themes), precedence cascade | Understanding how theme interacts with core definition hints |
| 1.3 | Terminology | Defines key terms: Definition, Theme, Tier 1 hints, Renderer, Token, Widget, Cascade. | Definition, Theme, Tier 1 hints, Renderer, Token, Widget, Cascade | Looking up formal term definitions |
| 1.4 | Notational Conventions | Notes on JSON comment syntax in examples, monospace property names, and section reference conventions. | JSON comments, cross-references | Reading code examples in the spec |
| (BLUF) | Bottom Line Up Front | Summary: valid theme requires `$formspecTheme`, `version`, `targetDefinition`; cascade is defaults -> selectors -> items. | Required fields, cascade order | Quick orientation before deep reading |

### Theme Document Structure (Lines 82-203)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 2 | Theme Document Structure | Defines the top-level JSON structure of a Theme Document, listing all recognized properties and their roles. Shows canonical JSON example with all top-level keys. | $formspecTheme, url, version, name, title, description, targetDefinition, platform, stylesheets, tokens, defaults, selectors, items, pages, breakpoints, extensions | Building or validating a theme document from scratch |
| 2.1 | Top-Level Properties | Schema-generated canonical table of all top-level properties with type, required status, and normative descriptions. 16 properties total; `$formspecTheme`, `targetDefinition`, and `version` are REQUIRED. | $formspecTheme (const "1.0"), version (REQUIRED), targetDefinition (REQUIRED), defaults (PresentationBlock), selectors (array), items (object), pages (array), tokens, breakpoints, stylesheets, platform, extensions | Implementing theme parsing or validation; checking which properties are required |
| 2.2 | Target Definition Binding | Defines `targetDefinition` object: `url` (REQUIRED, URI of target Definition) and `compatibleVersions` (OPTIONAL, semver range). Processor MUST NOT fail on version mismatch; SHOULD warn and MAY fall back to null theme. | targetDefinition, url, compatibleVersions, semver range, null theme fallback | Binding a theme to a definition; version compatibility checking |
| 2.3 | Platform Declaration | The `platform` property is an open string. Well-known values: web, mobile, pdf, print, kiosk, universal. Processors SHOULD apply theme regardless of unrecognized platform values. | platform, web, mobile, pdf, print, kiosk, universal | Targeting a theme to a specific rendering platform |
| 2.4 | Theme Versioning | `version` is free-form string; SemVer RECOMMENDED. Pair of (url, version) SHOULD be globally unique. | version, SemVer, url+version uniqueness | Versioning theme releases |
| 2.5 | External Stylesheets | `stylesheets` array of URI strings for external CSS. Loaded in array order (later = higher CSS precedence). Renderer MUST NOT fail on load error; SHOULD warn. Non-web renderers MAY ignore. Subject to CSP/CORS. | stylesheets, CSS loading order, CSP, CORS, graceful degradation | Adding external CSS to a theme; understanding load order and failure behavior |

### Design Tokens (Lines 204-298)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3 | Design Tokens | Introduces design tokens as named values (colors, spacing, typography) for visual consistency. Defined once, referenced throughout the theme. | design tokens, named values, visual consistency | Working with any aspect of the token system |
| 3.1 | Token Structure | `tokens` is a flat key-value map. Keys are dot-delimited names; values MUST be strings or numbers. No nested objects, arrays, booleans, or null. Notes DTCG compatibility. | flat map, dot-delimited keys, string/number values, DTCG | Defining tokens; understanding value constraints |
| 3.2 | Token Categories | RECOMMENDED category prefixes: `color.`, `spacing.`, `typography.`, `border.`, `elevation.`, `x-`. Lists example keys for each. | color, spacing, typography, border, elevation, x- (custom) | Choosing token key naming conventions |
| 3.3 | Token Reference Syntax | Tokens referenced via `$token.<key>` syntax in `style` objects, `widgetConfig` string values, and Tier 3 Component Documents. Reference resolved at theme-application time. `$token.` prefix is reserved cross-tier. | $token. prefix, resolution time, cross-tier reservation | Writing token references in style or widgetConfig values |
| 3.4 | Token Resolution | Resolution algorithm: look up key in `tokens` object; if found substitute; if NOT found use platform default and SHOULD warn. Token references MUST NOT be recursive (token value cannot contain `$token.` reference). Recursive references treated as unresolved. | token lookup, platform defaults, no recursion, unresolved token warning | Implementing token resolution; debugging unresolved tokens |
| 3.5 | Custom Token Groups | `x-` prefixed token keys reserved for custom/vendor-specific tokens. Processors MUST NOT assign semantics to unrecognized `x-` tokens. | x- prefix, custom tokens, vendor tokens | Adding brand-specific or vendor-specific tokens |

### Widget Catalog (Lines 299-451)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4 | Widget Catalog | Defines the complete widget vocabulary shared with Tier 1 `widgetHint`, plus theme-only capabilities (widgetConfig, fallback chains). | widget vocabulary, widgetConfig, fallback | Working with any widget assignment or configuration |
| 4.1 | Relationship to Tier 1 widgetHint | Theme uses the same widget vocabulary as core `widgetHint`. Theme adds: (1) typed `widgetConfig` objects, (2) `fallback` arrays. `widget` property in PresentationBlock accepts any valid `widgetHint` value. | shared vocabulary, widgetConfig, fallback arrays | Understanding how theme widgets relate to core widgetHint |
| 4.2 | Typed widgetConfig Objects | Defines well-known configuration properties per widget. `widgetConfig` is an open object; renderers SHOULD support listed properties and MUST ignore unrecognized keys. Covers Required widgets (textInput, textarea, numberInput, checkbox, datePicker, dropdown, checkboxGroup, fileUpload, moneyInput) and Progressive widgets (slider, stepper, rating, toggle, yesNo, radio, autocomplete, segmented, likert, multiSelect, richText, password, color, urlInput, dateInput, dateTimePicker, dateTimeInput, timePicker, timeInput, camera, signature). Group/display widgets have no widgetConfig. | widgetConfig, Required widgets, Progressive widgets, config properties per widget, open object | Configuring a specific widget; looking up available config properties |
| 4.3 | Fallback Chains | `fallback` array lists ordered fallback widgets. Renderer tries each in order when primary is unsupported. If none supported, uses default for dataType per core spec. Fallback does NOT carry widgetConfig forward. | fallback array, ordered fallback, widgetConfig not inherited | Setting up widget fallbacks; understanding config inheritance across fallbacks |
| 4.4 | Widget Rendering Requirements | Renderer MUST support all Required widgets. SHOULD support Progressive widgets and declare which. MUST resolve fallback chain. MUST ignore unrecognized widgetConfig keys. Custom widgets must be `x-` prefixed; renderer MUST NOT fail on unrecognized `x-` widgets. | Required vs Progressive, x- custom widgets, fallback resolution | Implementing a renderer; checking conformance requirements |

### Selector Cascade (Lines 452-670)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5 | Selector Cascade | Defines the cascade system that determines the effective presentation for each item by combining Tier 1 hints, theme defaults, selectors, and per-item overrides. | cascade, effective presentation, resolved PresentationBlock | Understanding how presentation properties are resolved for any item |
| 5.1 | Overview | Defines the 6 cascade levels: Level 3 (items), Level 2 (selectors), Level 1 (defaults), Level 0 (Tier 1 presentation), Level -1 (Tier 1 formPresentation), Level -2 (renderer defaults). Higher levels override lower. | cascade levels -2 through 3, override order | Understanding the full cascade priority from renderer defaults through per-item overrides |
| 5.2 | Level 1: Defaults | `defaults` is a PresentationBlock applied to every item before selectors or per-item overrides. Sets form-wide baseline. | defaults, PresentationBlock, form-wide baseline | Setting baseline presentation for all items |
| 5.3 | Level 2: Selectors | `selectors` array with `match`/`apply` pairs. Match criteria: `type` (group/field/display) and `dataType` (13 core data types) with AND semantics. At least one criterion required. All matching selectors apply in document order; later matches override earlier per-property. | selectors, match criteria, type, dataType, AND semantics, document order, all-match | Writing type-based or dataType-based presentation rules |
| 5.4 | Level 3: Item Key Overrides | `items` object maps item keys to PresentationBlocks. Highest theme specificity. Unknown keys SHOULD warn, MUST NOT fail. | items map, per-item override, highest specificity | Overriding presentation for a specific field by key |
| 5.5 | Cascade Resolution Algorithm | Pseudocode algorithm: merge levels -1 through 3, with cssClass using union semantics (not shallow replace). Merge is shallow per-property -- nested objects (widgetConfig, style, accessibility) are replaced as a whole, NOT deep-merged. cssClass accumulates across all levels, deduplicated, order preserved. | merge algorithm, shallow per-property, cssClass union semantics, no deep merge | Implementing cascade resolution; debugging unexpected property values |
| 5.6 | Interaction with Tier 1 Hints | Tier 1 inline hints are Level 0; theme defaults (Level 1) override them. No theme = null theme baseline (Tier 1 only). Property suppression via `"none"` sentinel. JSON null MUST NOT be used. Property name alignment table: `widget` vs `widgetHint`, `style` vs `styleHints`, etc. | null theme, property suppression, "none" sentinel, property name alignment | Understanding how theme and definition interact; suppressing inherited values |

### Page Layout System (Lines 671-811)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6 | Page Layout System | Defines the page-based layout model with 12-column grid, responsive breakpoints, and region assignments. | pages, regions, 12-column grid, responsive | Working with any aspect of page layout |
| 6.1 | Pages Array | `pages` array defines ordered pages with `id` (REQUIRED, regex-constrained), `title` (REQUIRED), `description` (OPTIONAL), `regions` (OPTIONAL). When absent, renderer walks Definition tree top-to-bottom. | Page object, id, title, description, regions | Defining page structure; understanding page requirements |
| 6.2 | 12-Column Grid Model | Regions assign items to grid positions: `key` (REQUIRED, item key), `span` (1-12, default 12), `start` (1-12, optional), `responsive` (optional breakpoint overrides). | Region object, key, span, start, responsive, 12-column grid | Laying out items in columns; controlling grid positioning |
| 6.3 | Regions and Item Keys | Special rules: group key includes entire subtree; repeatable group renders all instances within region; nested item key renders standalone; unknown key SHOULD warn; unassigned items rendered after all pages or optionally hidden. | group subtree, repeatable groups, nested item key, unknown key, unassigned items | Understanding how groups map to regions; handling unassigned items |
| 6.4 | Responsive Breakpoints | `breakpoints` top-level object defines named breakpoints as min-width pixels. Regions' `responsive` object overrides span, start, or hidden per breakpoint. Processors without responsive support SHOULD use base values. | breakpoints, min-width pixels, responsive overrides, span/start/hidden | Making layouts responsive; defining breakpoints |
| 6.5 | Default Layout (No Pages) | When `pages` absent or empty, renderer walks Definition tree top-to-bottom with cascade applied. Tier 1 `formPresentation.pageMode` guides group pagination. | no-pages fallback, top-to-bottom, pageMode | Understanding behavior when no pages are defined |

### Processing Model (Lines 813-881)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7 | Processing Model | Defines the complete lifecycle of theme loading, validation, resolution, and error handling. | processing model, lifecycle | Implementing a theme processor end-to-end |
| 7.1 | Theme Loading and Validation | Parse JSON, validate against theme.schema.json, verify $formspecTheme version, reject if REQUIRED properties missing. | JSON parsing, schema validation, version check | Implementing theme loading |
| 7.2 | Target Definition Compatibility Check | Verify targetDefinition.url matches Definition. If compatibleVersions present, verify semver satisfaction. MUST NOT fail on mismatch; SHOULD warn; MAY fall back to null theme. | compatibility check, url match, semver, graceful degradation | Implementing definition-theme binding verification |
| 7.3 | Full Resolution Algorithm | 6-step algorithm: (1) load theme, (2) check compatibility, (3) resolve tokens, (4) for each item apply cascade + resolve tokens + validate widget compatibility, (5) compute layout, (6) emit resolved presentation. | resolution order, token resolution, cascade, widget validation, layout computation | Implementing the complete theme resolution pipeline |
| 7.4 | Error Handling | Table of 9 error conditions with required behavior: unknown keys (warn/no fail), incompatible widget (fallback), unresolved token (default/warn), recursive token (unresolved), version mismatch (warn/fallback), unknown version (reject), x- widget (fallback), unknown widgetConfig key (ignore). | error table, graceful degradation, when to reject vs warn vs ignore | Implementing error handling; understanding which errors are fatal |
| 7.5 | Null Theme (Default Rendering) | When no theme applied: use Tier 1 formPresentation, Tier 1 inline presentation, renderer defaults. Conforming renderer MUST produce usable form from Tier 1 alone. | null theme, Tier 1 only, minimum renderer requirement | Understanding baseline rendering without a theme |

### Extensibility (Lines 882-931)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 8 | Extensibility | Defines extension points for custom widgets, tokens, and platform metadata. | extensibility, x- prefix | Adding custom or vendor-specific extensions |
| 8.1 | Custom Widgets via x- Prefix | `x-` prefixed widget names for custom widgets. Renderers fall back for unrecognized ones. Custom widgets MUST always have a fallback chain ending with a standard widget. | x- widgets, fallback required | Adding custom widget types |
| 8.2 | Custom Token Groups | `x-` prefixed token keys for custom/vendor tokens. | x- tokens | Adding brand-specific or agency-specific tokens |
| 8.3 | Platform-Specific Extensions | `extensions` object at theme root accepts `x-` prefixed keys. Processors MUST ignore unrecognized extensions. | extensions object, x- keys, platform metadata | Adding analytics, PDF settings, or other platform-specific metadata |

### Security and Accessibility (Lines 933-972)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 9 | Security and Accessibility Considerations | Informative section covering URL security, accessibility, and RTL/bidirectional layout guidance. | security, accessibility, RTL | Reviewing security or accessibility implications of themes |
| 9.1 | Theme URL Resolution Security | Processors SHOULD validate URIs, restrict to `https:`, apply CSP, timeout gracefully. | URI validation, https, CSP, timeout | Hardening theme processing against malicious URIs |
| 9.2 | Accessibility Guidance | WCAG 2.2 contrast ratios (4.5:1 normal, 3:1 large). Font size minimums. `labelPosition: "hidden"` MUST still render accessible labels. `liveRegion: "assertive"` use sparingly. Spec does NOT normatively require WCAG. | WCAG 2.2, contrast ratios, hidden labels, liveRegion, informative-only | Ensuring themes maintain accessibility; understanding labelPosition "hidden" |
| 9.3 | RTL / Bidirectional Layout | `labelPosition: "start"` means leading side (left in LTR, right in RTL). 12-column grid uses logical positions; renderers SHOULD mirror in RTL. | RTL, bidirectional, "start" = leading side, logical columns | Implementing RTL support; interpreting "start" label position |

### Appendices (Lines 974-1167)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Appendix A | Complete Theme Document Example | Informative full-form theme JSON example demonstrating tokens, defaults, selectors, items, pages, responsive regions. | reference example | Seeing a complete real-world theme; using as a starting template |
| Appendix B | Widget-DataType Compatibility Table | **Normative.** Complete matrix of all 33 widgets, their level (Required/Progressive), compatible dataTypes, and default fallback. Includes field, group, and display widgets. | widget-dataType matrix, Required vs Progressive, 33 widgets, fallback defaults | Checking which widgets work with which data types; determining fallback chains |
| Appendix C | Token Quick Reference | Informative table of common token key patterns, examples, and typical values. | token patterns, example values | Quick lookup of conventional token naming |

## Cross-References

| Reference | Context |
|-----------|---------|
| Core spec `spec.md` -- Items (core 4) | Definition of what data a form collects; items are the targets of theme presentation |
| Core spec `spec.md` -- Binds (core 4.3) | How data behaves; theme does not control behavior, only presentation |
| Core spec `spec.md` -- Shapes (core 5) | Cross-field validation; independent of theme |
| Core spec `spec.md` -- 4.1.1 `formPresentation` | Tier 1 form-wide presentation defaults; cascade Level -1 |
| Core spec `spec.md` -- 4.2.5 `presentation` | Tier 1 per-item inline presentation hints; cascade Level 0 |
| Core spec `spec.md` -- 4.2.5.1 `widgetHint` | Shared widget vocabulary between Tier 1 and Tier 2; theme uses same values |
| `schemas/theme.schema.json` | JSON Schema that the theme document MUST validate against |
| Component spec (Tier 3) | Future tier that uses `{param}` template syntax (does not conflict with `$token.`); tokens flow into Tier 3 |
| Design Tokens Community Group (DTCG) | External standard; Formspec flat token format is inspired by but simpler than DTCG nested groups |
| RFC 2119 | Normative keyword interpretation |
| WCAG 2.2 | Accessibility contrast and sizing guidance (informative, not normatively required) |

## Key Schemas Defined

| Schema / Structure | Location | Description |
|-------------------|----------|-------------|
| Theme Document (top-level) | 2.1 | Root JSON object with `$formspecTheme`, `version`, `targetDefinition` (all REQUIRED), plus optional tokens, defaults, selectors, items, pages, breakpoints, stylesheets, platform, extensions |
| TargetDefinition | 2.2 | `{ url: string (REQUIRED), compatibleVersions?: string }` -- binds theme to a Definition |
| Tokens | 3.1 | Flat `Record<string, string \| number>` -- no nesting, no arrays, no booleans, no null |
| PresentationBlock | 5.2-5.4 | Object with `widget`, `widgetConfig`, `labelPosition`, `style`, `accessibility`, `fallback`, `cssClass` -- used at defaults, selectors.apply, and items levels |
| Selector | 5.3 | `{ match: { type?, dataType? }, apply: PresentationBlock }` -- match has AND semantics |
| Page | 6.1 | `{ id: string (REQUIRED), title: string (REQUIRED), description?: string, regions?: Region[] }` |
| Region | 6.2 | `{ key: string (REQUIRED), span?: 1-12, start?: 1-12, responsive?: Record<string, { span?, start?, hidden? }> }` |
| Breakpoints | 6.4 | `Record<string, number>` -- named breakpoints as min-width pixel values |
| Extensions | 8.3 | Open object; all keys MUST be `x-` prefixed |
| Widget-DataType compatibility | Appendix B | Normative matrix of 33 widgets, their level, compatible dataTypes, and default fallback |

## Critical Behavioral Rules

1. **Cascade merge is SHALLOW per-property, not deep.** Nested objects (`widgetConfig`, `style`, `accessibility`) are **replaced as a whole**, not deep-merged. A selector that sets `style: { background: "red" }` completely replaces a default-level `style: { borderRadius: "6px" }` -- the borderRadius is lost.

2. **cssClass is the ONE exception to shallow merge.** It uses **union semantics** across all cascade levels. Classes accumulate from defaults, then selectors (document order), then item overrides. Duplicates are removed; insertion order is preserved.

3. **Fallback chains do NOT carry widgetConfig.** When a renderer falls back from widget A to widget B, widget B uses its own default config, NOT widget A's widgetConfig. The only way to configure a fallback widget is via a separate cascade entry for that widget.

4. **All matching selectors apply, not just the first.** Selectors are evaluated in document order, and every matching selector's `apply` block is merged on top of previous matches. This is "all-match" behavior, not "first-match".

5. **Selector match criteria use AND semantics.** When both `type` and `dataType` are specified, the item must satisfy both to match. At least one criterion is required per selector.

6. **Token references MUST NOT be recursive.** A token value cannot itself contain a `$token.` reference. Recursive references are treated as unresolved.

7. **JSON null MUST NOT appear in PresentationBlock properties.** Use the sentinel string `"none"` to suppress inherited values for properties that support it (e.g., `widget`). Omitting a property leaves it unset (inherits from lower cascade levels). Validators SHOULD reject null.

8. **Version mismatch is non-fatal.** When `compatibleVersions` is present and the Definition version does not satisfy it, the processor MUST NOT fail. It SHOULD warn and MAY fall back to null theme (Tier 1 only).

9. **Unknown item keys in `items` or regions are non-fatal.** SHOULD produce a warning, MUST NOT cause failure. This allows themes to be forward-compatible with Definition changes.

10. **Unrecognized `$formspecTheme` version IS fatal.** This is the only case where the processor MUST reject the theme entirely.

11. **`labelPosition: "hidden"` does NOT remove the label from the DOM.** The label MUST still be rendered in accessible markup for screen readers -- it is only *visually* hidden.

12. **`labelPosition: "start"` is logical, not physical.** It means "leading side" -- left in LTR, right in RTL. Renderers MUST respect text direction.

13. **Group key in a region includes the entire subtree.** Referencing a group's key in a page region renders all children and nested groups within that region. Layout inside the group is controlled by the group's own Tier 1 presentation, not the theme's page grid.

14. **Unassigned items (not in any region/page) SHOULD be rendered after all pages.** Alternatively, a renderer MAY hide them if pages are treated as exhaustive. This is a renderer policy decision, not strictly mandated.

15. **Custom widgets (`x-` prefixed) MUST always have a fallback chain ending with a standard widget.** This ensures graceful degradation across all renderers.

16. **Stylesheet load failures are non-fatal.** Renderers MUST NOT fail if a stylesheet cannot be loaded; they SHOULD warn and continue rendering.

17. **Pages live in the theme document, not the definition.** The `pages` array is a theme-tier construct. Without a theme, the renderer uses the Definition's item tree order, guided by Tier 1 `formPresentation.pageMode`.

18. **Nested item keys can be referenced directly in regions.** A region MAY reference any item key, including nested items within groups. When referenced directly, the nested item renders standalone at its grid position, independent of its parent group's layout.
