# ADR 0009: Tier 3 Implementation Plan — Component Model with Slots

## Status
Implemented (updated 2026-02-24) — component catalog complete; test volume remains below original estimate
**Date:** 2025-01-27  
**Depends on:** Tier 1 (presentation hints in spec.md), Tier 2 (theme-spec.md + theme.schema.json)

### Completion Update (2026-02-24)
- The previously missing `Popover` component is now implemented in schema, spec, and renderer (`ac86fcb`).
- Targeted component E2E gap coverage for repeatable binding, cross-tier interaction, and compatibility assertions is in place (`684b9aa`).
- The original plan's very large test-count target remains aspirational; implementation completeness is no longer blocked by missing component types.

---

## 1. New Spec Document: `component-spec.md`

### Proposed Table of Contents

```
§1  Introduction                                        (~80 lines, informative)
  §1.1  Purpose and Scope
  §1.2  Relationship to Formspec Definition, Theme, and FEL
  §1.3  Conformance Language (RFC 2119)
  §1.4  Terminology
  §1.5  Notation Conventions

§2  Document Structure                                  (~200 lines, normative)
  §2.1  Top-Level Properties
         url, version, targetDefinition, breakpoints, tokens, components, tree
  §2.2  Versioning and targetDefinition Binding
  §2.3  MIME Type and File Extension (.formspec-component.json)
  §2.4  Minimal Conforming Document (example)

§3  Component Model                                     (~250 lines, normative)
  §3.1  Component Object — Base Schema
         type, id, bind, when, props, responsive, children, slots
  §3.2  Component Identity and Referencing
  §3.3  Component Tree Semantics (tree is a single root component)
  §3.4  Children Ordering and Rendering
  §3.5  Nesting Constraints (which components accept children)

§4  Slot Binding                                        (~300 lines, normative)
  §4.1  The `bind` Property
         String value = itemKey from the target Definition
  §4.2  Bind Resolution Rules
         - MUST reference a key present in definition.items
         - If itemKey not found → validation error
         - Unbound items (items with no component binding) → §8 fallback
  §4.3  Bind and Item dataType Compatibility Matrix
         Which components may bind to which dataTypes
  §4.4  Binding Repeatable Groups
         - bind to a group itemKey → component iterates over repetitions
         - children of the bound component template across repetitions
  §4.5  Multi-Bind and Computed Display Components
         Display components (Summary, DataTable) may reference multiple items
  §4.6  Bind Uniqueness
         A single itemKey MAY be bound by multiple components (read-only
         display + one input). At most ONE input component per itemKey.

§5  Built-In Components — Layout                        (~400 lines, normative)
  §5.1  Page
  §5.2  Stack
  §5.3  Grid
  §5.4  Columns
  §5.5  Tabs
  §5.6  Wizard
  §5.7  Accordion
  §5.8  Spacer

§6  Built-In Components — Input                         (~600 lines, normative)
  §6.1  TextInput
  §6.2  NumberInput
  §6.3  DatePicker
  §6.4  Select
  §6.5  RadioGroup
  §6.6  CheckboxGroup
  §6.7  Toggle
  §6.8  FileUpload
  §6.9  MoneyInput
  §6.10 Slider
  §6.11 Rating

§7  Built-In Components — Display                       (~400 lines, normative)
  §7.1  Heading
  §7.2  Text
  §7.3  Divider
  §7.4  Alert
  §7.5  Badge
  §7.6  ProgressBar
  §7.7  Summary
  §7.8  DataTable

§8  Built-In Components — Container                     (~350 lines, normative)
  §8.1  Card
  §8.2  Panel
  §8.3  Collapsible
  §8.4  Modal
  §8.5  Popover
  §8.6  ConditionalGroup

§9  Custom Components                                   (~250 lines, normative)
  §9.1  The `components` Registry (top-level reusable definitions)
  §9.2  Component Template Syntax
         - Parameters declared in `params` array
         - `{paramName}` interpolation in `bind`, `props`, and `when` values
  §9.3  Instantiation via `type` Matching a Registry Key
  §9.4  Parameter Validation — required vs optional, defaults
  §9.5  Recursion Prohibition
  §9.6  Example: Address Block Custom Component

§10 Conditional Rendering                               (~200 lines, normative)
  §10.1 The `when` Property
         FEL expression evaluated at runtime; falsy → component not rendered
  §10.2 Distinction from Definition-level `relevant`
         `relevant` controls data collection; `when` controls UI visibility only
  §10.3 Evaluation Context (FEL expression has access to $fieldKeys)
  §10.4 Static Analysability Requirements
  §10.5 Error Handling (malformed expressions → component hidden + warning)

§11 Responsive Design                                   (~200 lines, normative)
  §11.1 Breakpoints Declaration
         Top-level `breakpoints` object: name → { minWidth, maxWidth }
  §11.2 The `responsive` Property on Components
         Keys = breakpoint names; values = prop overrides (shallow merge)
  §11.3 Merge Semantics
         Base props ← breakpoint overrides, smallest-first cascade
  §11.4 Structural Responsiveness
         Changing `type` is NOT allowed; only props change per breakpoint
  §11.5 Default Breakpoints (informative recommendation)
         sm: 0-599, md: 600-1023, lg: 1024+

§12 Theming and Design Tokens                           (~200 lines, normative)
  §12.1 The `tokens` Map
         Flat key-value map at document top level
  §12.2 Token Reference Syntax: `$token.keyName`
         Usable in any string-typed prop value
  §12.3 Importing Tier 2 Theme Tokens
         Component doc's `tokens` MAY reference a theme doc;
         local tokens override theme tokens (cascade)
  §12.4 Token Resolution Algorithm
  §12.5 Unresolved Token Handling (MUST fall back to implementation default)

§13 Cross-Tier Interaction                              (~200 lines, normative)
  §13.1 Tier 1 Fallback for Unbound Items
  §13.2 Tier 2 Token Inheritance
  §13.3 Precedence: Tier 3 > Tier 2 > Tier 1
  §13.4 Partial Component Trees (not all items need binding)

§14 Validation and Conformance                          (~150 lines, normative)
  §14.1 Structural Validation (JSON Schema)
  §14.2 Referential Integrity Validation
         All bind values resolve; all token references resolve;
         all custom component types resolve to registry
  §14.3 Compatibility Validation (bind + dataType matrix)
  §14.4 Conformance Levels: Structure-Valid, Reference-Valid, Fully-Valid

Appendix A  Full Example — Multi-Page Wizard            (~150 lines, informative)
Appendix B  Component Quick Reference Table             (~80 lines, informative)
Appendix C  DataType ↔ Component Compatibility Matrix   (~60 lines, normative)
Appendix D  Glossary                                    (~40 lines, informative)
```

### Estimated Length: ~3,800–4,200 lines

### Normative vs Informative

| Normative (§2–§14, Appendix C) | Informative (§1, Appendices A/B/D) |
|---|---|
| Document structure, component model, slot binding, all 30+ component specs, custom components, conditional rendering, responsive, theming, cross-tier, validation | Introduction, full examples, quick-reference table, glossary |

---

## 2. New JSON Schema: `component.schema.json`

### Design Strategy: Base + Discriminated Per-Type Extensions

Avoid a massive `oneOf` with 30+ branches (terrible error messages). Instead:

```
component.schema.json (root)
├── $defs/
│   ├── componentBase          — id, type, bind, when, responsive, props (open object)
│   ├── childrenArray           — { "type": "array", "items": { "$ref": "#/$defs/anyComponent" } }
│   ├── anyComponent            — oneOf over all built-in + custom component discriminated by "type"
│   │
│   ├── layout/
│   │   ├── Page                — allOf: [componentBase, { properties: { props: pageProps, children } }]
│   │   ├── Stack               — ...
│   │   ├── Grid                — ...
│   │   ├── Columns             — ...
│   │   ├── Tabs                — ...
│   │   ├── Wizard              — ...
│   │   ├── Accordion           — ...
│   │   └── Spacer              — ...
│   │
│   ├── input/
│   │   ├── TextInput           — allOf: [componentBase, { required: ["bind"], properties: { props: textInputProps } }]
│   │   ├── NumberInput         — ...
│   │   ├── DatePicker          — ...
│   │   ├── Select              — ...
│   │   ├── RadioGroup          — ...
│   │   ├── CheckboxGroup       — ...
│   │   ├── Toggle              — ...
│   │   ├── FileUpload          — ...
│   │   ├── MoneyInput          — ...
│   │   ├── Slider              — ...
│   │   └── Rating              — ...
│   │
│   ├── display/
│   │   ├── Heading             — ...
│   │   ├── Text                — ...
│   │   ├── Divider             — ...
│   │   ├── Alert               — ...
│   │   ├── Badge               — ...
│   │   ├── ProgressBar         — ...
│   │   ├── Summary             — ...
│   │   └── DataTable           — ...
│   │
│   ├── container/
│   │   ├── Card                — ...
│   │   ├── Panel               — ...
│   │   ├── Collapsible         — ...
│   │   ├── Modal               — ...
│   │   ├── Popover             — ...
│   │   └── ConditionalGroup    — ...
│   │
│   ├── customComponentRef      — type matches registry key, params object
│   ├── tokenReference          — pattern: "^\\$token\\.[a-zA-Z][a-zA-Z0-9_.]*$"
│   ├── felExpression           — { type: string, description: "FEL expression" }
│   ├── breakpointDef           — { minWidth, maxWidth }
│   └── responsiveOverride      — patternProperties keyed by breakpoint name
│
├── properties/
│   ├── url                     — format: uri
│   ├── version                 — const: "1.0"
│   ├── targetDefinition        — { url, version, hash? }
│   ├── breakpoints             — additionalProperties: breakpointDef
│   ├── tokens                  — additionalProperties: string | number
│   ├── components              — additionalProperties: customComponentDef
│   └── tree                    — $ref: #/$defs/anyComponent
│
└── required: [url, version, targetDefinition, tree]
```

### Key Schema Decisions

1. **Discriminated union via `type`:** Use `if/then` chains on `type` property (better errors than `oneOf`):
   ```json
   {
     "if": { "properties": { "type": { "const": "TextInput" } } },
     "then": { "$ref": "#/$defs/input/TextInput" }
   }
   ```
2. **Input components:** Require `bind`. Layout/Display: `bind` forbidden or optional.
3. **Props per component:** Each component def has its own `props` sub-schema.
4. **`additionalProperties: false`** on each component's props (strict).
5. **Custom component refs:** Validated structurally only; registry lookup is a referential-integrity check done outside pure JSON Schema.

### Estimated Size: ~2,800–3,200 lines

(30 components × ~60 lines avg props schema = 1,800; infrastructure + wiring = 1,000)

---

## 3. Component Vocabulary Spec — Documentation Template

Each component entry in §5–§8 follows this template:

```markdown
### §X.Y  ComponentName

**Category:** Layout | Input | Display | Container  
**Accepts children:** Yes / No  
**Bind:** Required | Optional | Forbidden  
**Compatible dataTypes:** (for Input components only) list of dataTypes  

#### Description
One paragraph: what this component renders and when to use it.

#### Props

| Prop | Type | Default | Token-able | Description |
|------|------|---------|------------|-------------|
| `variant` | `"outlined"` \| `"filled"` | `"outlined"` | No | Visual variant |
| `label` | string | (from bound item) | Yes | Override label text |
| `gap` | string | `"16px"` | Yes | Spacing between children |
| ... | | | | |

"Token-able" column indicates whether `$token.*` references are supported in that prop.

#### Slots (if component has named slots)

| Slot | Description |
|------|-------------|
| `header` | Content rendered in the card header |
| `footer` | Content rendered in the card footer |

#### Bind Behavior
What happens when `bind` is set:
- Input: component reads/writes the bound item's value
- Display: component reads the bound item's value for display
- Container: component scopes to a group item

#### Responsive Props
Which props may be overridden per breakpoint (all unless stated otherwise).

#### Rendering Requirements
Normative requirements for renderers:
- MUST render as [semantic element or ARIA role]
- MUST propagate the bound item's `required`, `readOnly`, `relevant` state
- MUST apply validation error display from the bound item's validation state

#### Example
```json
{
  "type": "TextInput",
  "bind": "firstName",
  "props": {
    "variant": "outlined",
    "placeholder": "Enter your first name"
  }
}
```
```

### Estimated per-component: ~50–80 lines (props table drives length)

---

## 4. Changes to `spec.md`

Minimal cross-references. These do NOT alter normative semantics of Formspec definitions.

| Location in spec.md | Change |
|---|---|
| §1 Introduction (or §1.x) | Add paragraph: "Formspec supports an optional Component Document companion spec for full UI composition. See `component-spec.md`." |
| §3 (Document Structure) or wherever `presentation` is defined | Add note: "The `presentation` object (Tier 1) provides inline hints. For full component-level control, a separate Component Document (Tier 3) may override these hints. See `component-spec.md` §13." |
| §5 (Items) — near `presentation` property | Add informative note: "When a Component Document binds a component to this item, the component's props take precedence over `presentation` hints." |
| Appendix or new §9.x | Add a short subsection "Companion Specifications" listing: theme-spec.md (Tier 2), component-spec.md (Tier 3), mapping-spec.md, fel-grammar.md |

**Estimated diff: ~30–50 lines of additions. No deletions. No schema changes to definition.schema.json.**

---

## 5. Test Plan

### Test Categories and Estimated Counts

| # | Category | Description | Est. Tests |
|---|----------|-------------|------------|
| 1 | **Schema validation — valid documents** | Minimal doc, full doc, each component type used once, all prop combinations | 80 |
| 2 | **Schema validation — invalid documents** | Missing required fields, wrong prop types, unknown component types, bad structure | 60 |
| 3 | **Slot binding resolution — valid** | Each dataType bound to each compatible component, group binding, multi-bind display | 55 |
| 4 | **Slot binding resolution — invalid** | Bind to nonexistent itemKey, input component bound to incompatible dataType, two inputs bound to same key | 30 |
| 5 | **Unbound items** | Definition items not referenced by any component — verify fallback behavior described | 15 |
| 6 | **Repeatable group binding** | Bind to repeatable group, nested repetitions, bind within repetition template | 20 |
| 7 | **Component/dataType compatibility matrix** | Full cross-product of 11 input components × relevant dataTypes (valid + invalid) | 50 |
| 8 | **Custom component templates** | Valid param interpolation, missing required param, unused param, nested custom components, recursion rejection | 30 |
| 9 | **Conditional `when` expressions** | Valid FEL expressions, references to $fields, boolean operators, malformed expressions | 25 |
| 10 | **Responsive merge logic** | Base-only, single breakpoint override, multi-breakpoint cascade, override precedence | 25 |
| 11 | **Token resolution** | Valid $token.* refs in props, unresolved tokens, Tier 2 token inheritance, local override of theme token | 25 |
| 12 | **Cross-tier precedence** | Tier 3 overrides Tier 2 overrides Tier 1, partial tree with Tier 1 fallback | 15 |
| 13 | **Edge cases** | Empty tree, deeply nested (10+ levels), component with no props, all 30+ components in one tree | 20 |
| | | **TOTAL** | **~450** |

### Test File Organization

```
tests/component/
  schema/
    valid/          — 80 JSON files
    invalid/        — 60 JSON files
  binding/
    valid/          — 55 JSON pairs (component doc + definition)
    invalid/        — 30 JSON pairs
  unbound/          — 15 test cases
  repeatable/       — 20 test cases
  compatibility/    — 50 test cases
  custom/           — 30 test cases
  conditional/      — 25 test cases
  responsive/       — 25 test cases
  tokens/           — 25 test cases
  cross-tier/       — 15 test triples (definition + theme + component)
  edge/             — 20 test cases
```

Each test file is a JSON document with metadata: `{ "description", "component", "definition"?, "theme"?, "expectedValid", "expectedErrors"? }`.

---

## 6. Cross-Tier Contracts

### 6.1 Components Using Tier 2 Tokens

Normative language:

> A Component Document MAY declare a `themeRef` property within its `tokens` section that identifies a Tier 2 Theme Document. When present, the renderer MUST resolve `$token.*` references using this cascade:
>
> 1. Component Document `tokens` map (highest priority)
> 2. Theme Document `tokens` map (referenced by `themeRef`)
> 3. Renderer implementation defaults (lowest priority)
>
> A `$token.*` reference that cannot be resolved at any level MUST NOT cause a fatal error. The renderer MUST use its implementation default and SHOULD emit a warning.

### 6.2 Fallback from Tier 3 to Tier 1

Normative language:

> When a Component Document is associated with a Definition and an item in that Definition is NOT bound by any component in the `tree`, the renderer MUST render that item using Tier 1 `presentation` hints (if present) or the renderer's default widget for that item's `dataType`.
>
> A Component Document is not required to bind every item in the Definition. A conforming renderer MUST render all visible (relevant) items, whether bound by Tier 3 components or falling back to Tier 1/defaults.

### 6.3 Precedence Rule

> For a given item, when both a Tier 3 component `props` and a Tier 1 `presentation` hint specify the same rendering concern (e.g., widget type, label position), the Tier 3 value MUST take precedence.
>
> Tier 2 theme selectors that match an item's characteristics (dataType, tags) apply as defaults beneath Tier 3 explicit props but above Tier 1 hints. Effective precedence: **Tier 3 props > Tier 2 selector match > Tier 1 presentation hints > renderer defaults**.

---

## 7. Complexity Controls

### What's In Scope
- Declarative component tree (JSON)
- FEL expressions in `when` (same expression language already specified)
- `{param}` string interpolation for custom components (simple text substitution, not code execution)
- Static responsive breakpoint overrides (prop merge, not structural changes)

### What's Explicitly Out of Scope

| Excluded Feature | Rationale |
|---|---|
| **Imperative event handlers / scripting** | No `onClick`, `onBlur`, or inline JS. Formspec is declarative. |
| **Conditional `type` switching** | A component's `type` MUST NOT change based on expressions or breakpoints. |
| **Recursive custom components** | A custom component MUST NOT reference itself (directly or transitively). Validators MUST detect cycles. |
| **Computed props via FEL** | FEL is allowed only in `when`. Props are static values or token references. Prevents expression-in-every-prop complexity. |
| **Arbitrary slot projection** | No transclusion, no render-props, no higher-order components. Children are direct. |
| **Animation / transition specs** | Out of scope. Renderers may animate but the spec doesn't define it. |
| **Server-side data fetching** | No `fetch`, no async data sources in the component tree. |
| **Component inheritance** | Custom components are templates, not classes. No `extends`. |
| **Dynamic component registration** | The `components` registry is static and fully declared in the document. |

### Guard Rails

1. **Custom component nesting depth limit:** Spec RECOMMENDS max 3 levels of custom component expansion. Validators SHOULD warn above this.
2. **Tree depth limit:** Spec RECOMMENDS max 20 levels of component nesting.
3. **Single `when` expression per component:** No arrays of conditions; compose with `AND()` / `OR()` in FEL.
4. **`{param}` interpolation is string-only:** Parameters substitute into string values. No object/array parameter types.

---

## 8. Hub Page Update (`index.html`)

Add to the existing hub page:

- New card/link for `component-spec.md` — "Component Specification (Tier 3)" with brief description
- New card/link for `component.schema.json` — "Component Document JSON Schema"
- Update the existing description to mention the 3-tier architecture if not already present
- If there's a diagram or architecture section, add Tier 1/2/3 visual with Tier 3 highlighted

**Estimated change: ~15–25 lines of HTML.**

---

## 9. Estimated Effort

| Artifact | Estimated Lines | Notes |
|----------|----------------|-------|
| `component-spec.md` | 3,800–4,200 | Comparable to mapping-spec.md (1,998 lines) but roughly 2× due to 30+ component entries |
| `component.schema.json` | 2,800–3,200 | Single file with $defs; could split later |
| Test files (JSON) | ~450 files, ~12,000–15,000 lines total | Average ~30 lines per test file |
| `spec.md` changes | 30–50 lines added | Cross-references only |
| `index.html` changes | 15–25 lines | New card entries |
| **Total new content** | **~18,000–22,000 lines** | |

### Time Estimate (for spec authoring, not implementation)

| Phase | Effort |
|-------|--------|
| Schema design + component-spec.md draft | 3–4 days |
| Component vocabulary (30+ entries) | 2–3 days |
| Test suite creation | 2–3 days |
| Cross-tier contracts + complexity controls | 1 day |
| Review, iteration, cross-reference updates | 1–2 days |
| **Total** | **9–13 days** |

---

## 10. Ordered Task List

### Phase 0: Prerequisites

| # | Task | Depends On | Output |
|---|------|-----------|--------|
| 0.1 | Finalize Tier 1 `presentation` object in spec.md | — | Updated spec.md with §X.Y for presentation |
| 0.2 | Finalize Tier 2 theme-spec.md + theme.schema.json | 0.1 | theme-spec.md, theme.schema.json |
| 0.3 | Verify FEL grammar covers all expression needs for `when` | — | Possibly updated fel-grammar.md |

### Phase 1: Schema Foundation

| # | Task | Depends On | Output |
|---|------|-----------|--------|
| 1.1 | Design `component.schema.json` top-level structure (document envelope: url, version, targetDefinition, breakpoints, tokens, components, tree) | 0.2 | Skeleton schema |
| 1.2 | Define `componentBase` $def (shared properties: type, id, bind, when, props, responsive) | 1.1 | Updated schema |
| 1.3 | Define `breakpointDef`, `tokenReference`, `felExpression`, `responsiveOverride` $defs | 1.1 | Updated schema |
| 1.4 | Define `customComponentDef` and `customComponentRef` $defs (params, interpolation pattern) | 1.2 | Updated schema |
| 1.5 | Set up if/then discriminated union scaffold for `anyComponent` | 1.2 | Updated schema |

### Phase 2: Component Schemas (parallelizable by category)

| # | Task | Depends On | Output |
|---|------|-----------|--------|
| 2.1 | Define Layout component schemas (Page, Stack, Grid, Columns, Tabs, Wizard, Accordion, Spacer) — props + children constraints | 1.5 | 8 component $defs |
| 2.2 | Define Input component schemas (TextInput, NumberInput, DatePicker, Select, RadioGroup, CheckboxGroup, Toggle, FileUpload, MoneyInput, Slider, Rating) — props + required bind | 1.5 | 11 component $defs |
| 2.3 | Define Display component schemas (Heading, Text, Divider, Alert, Badge, ProgressBar, Summary, DataTable) — props + optional bind | 1.5 | 8 component $defs |
| 2.4 | Define Container component schemas (Card, Panel, Collapsible, Modal, Popover, ConditionalGroup) — props + children + optional bind | 1.5 | 6 component $defs |
| 2.5 | Wire all 33 component $defs into `anyComponent` discriminated union | 2.1–2.4 | Complete schema |
| 2.6 | Validate schema against JSON Schema draft 2020-12 meta-schema | 2.5 | Passing meta-validation |

### Phase 3: Spec Document

| # | Task | Depends On | Output |
|---|------|-----------|--------|
| 3.1 | Write §1 Introduction + §2 Document Structure | 1.1 | component-spec.md draft |
| 3.2 | Write §3 Component Model (base properties, tree semantics) | 1.2 | Updated draft |
| 3.3 | Write §4 Slot Binding (resolution rules, compatibility matrix, repeatable groups) | 2.2 | Updated draft |
| 3.4 | Write §5 Layout components using vocabulary template | 2.1 | Updated draft |
| 3.5 | Write §6 Input components using vocabulary template | 2.2 | Updated draft |
| 3.6 | Write §7 Display components using vocabulary template | 2.3 | Updated draft |
| 3.7 | Write §8 Container components using vocabulary template | 2.4 | Updated draft |
| 3.8 | Write §9 Custom Components | 1.4 | Updated draft |
| 3.9 | Write §10 Conditional Rendering (when + FEL) | 0.3 | Updated draft |
| 3.10 | Write §11 Responsive Design | 1.3 | Updated draft |
| 3.11 | Write §12 Theming and Design Tokens | 0.2 | Updated draft |
| 3.12 | Write §13 Cross-Tier Interaction | 0.1, 0.2 | Updated draft |
| 3.13 | Write §14 Validation and Conformance | 2.6 | Updated draft |
| 3.14 | Write Appendices A–D | 3.4–3.7 | Complete draft |

### Phase 4: Tests

| # | Task | Depends On | Output |
|---|------|-----------|--------|
| 4.1 | Create test directory structure and test metadata schema | — | tests/component/ scaffold |
| 4.2 | Write schema validation tests (valid + invalid) — 140 tests | 2.6 | tests/component/schema/ |
| 4.3 | Write binding resolution tests (valid + invalid + unbound) — 100 tests | 3.3 | tests/component/binding/ |
| 4.4 | Write repeatable group tests — 20 tests | 3.3 | tests/component/repeatable/ |
| 4.5 | Write compatibility matrix tests — 50 tests | 3.3 | tests/component/compatibility/ |
| 4.6 | Write custom component tests — 30 tests | 3.8 | tests/component/custom/ |
| 4.7 | Write conditional expression tests — 25 tests | 3.9 | tests/component/conditional/ |
| 4.8 | Write responsive merge tests — 25 tests | 3.10 | tests/component/responsive/ |
| 4.9 | Write token resolution tests — 25 tests | 3.11 | tests/component/tokens/ |
| 4.10 | Write cross-tier tests — 15 tests | 3.12 | tests/component/cross-tier/ |
| 4.11 | Write edge case tests — 20 tests | 2.6 | tests/component/edge/ |

### Phase 5: Integration

| # | Task | Depends On | Output |
|---|------|-----------|--------|
| 5.1 | Add cross-references to spec.md | 3.12 | Updated spec.md |
| 5.2 | Update index.html hub page | 3.14 | Updated index.html |
| 5.3 | Run full test suite (existing 1,244 + new ~450) | 4.2–4.11 | All tests passing |
| 5.4 | Final review: internal consistency across spec.md, theme-spec.md, component-spec.md | 5.1–5.3 | Sign-off |

---

## Summary: Critical Path

```
0.1 Tier 1 ──→ 0.2 Tier 2 ──→ 1.1 Schema skeleton ──→ 1.2–1.5 Base defs
                                                              │
                                                              ├──→ 2.1–2.4 Component schemas (parallel)
                                                              │         │
                                                              │         ├──→ 2.5–2.6 Wire + validate schema
                                                              │         │         │
                                                              │         │         ├──→ 4.2 Schema tests
                                                              │         │         └──→ 3.13 Validation section
                                                              │         │
                                                              │         └──→ 3.4–3.7 Component vocabulary
                                                              │
                                                              └──→ 3.1–3.3 Spec preamble + binding
                                                                        │
                                                                        └──→ 3.8–3.14 Remaining sections
                                                                                  │
                                                                                  └──→ 4.3–4.11 Tests
                                                                                            │
                                                                                            └──→ 5.1–5.4 Integration
```

**Tier 1 and Tier 2 are hard prerequisites.** Schema work (Phase 1–2) and spec writing (Phase 3) can overlap once the skeleton exists. Component schemas in Phase 2 are parallelizable across the 4 categories.
