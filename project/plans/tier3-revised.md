# Tier 3 Revised Plan: Component Model with Slots

**Status:** Final draft — ready to execute
**Approach:** New companion spec `component-spec.md` + `component.schema.json`
**Pattern:** Follows `mapping-spec.md` and `theme-spec.md` companion-spec precedent
**Depends on:** Tier 1 (COMPLETE, 111 tests), Tier 2 (COMPLETE, 171 tests), 1,559 total passing

---

## §0. Scope Reduction (Post-Review)

The combative review found 6 CRITICAL and 8 MAJOR issues. Key resolutions:

| Original | Revised | Rationale |
|---|---|---|
| 33 components, all normative | **18 Core** (MUST) + **15 Progressive** (SHOULD, with fallback) | HTML 1.0 had ~18 elements. Conformance levels prevent blocking adoption. |
| `{param}` interpolation with no grammar | **Formal ABNF grammar** for interpolation | Combative review: "unspecified string interpolation creates security disasters" |
| At most ONE input per itemKey | **At most one EDITABLE input**; read-only displays unlimited | Fixes wizard review-page pattern |
| Cycle detection with params is undecidable | **Structural cycles only** (same component name = cycle, regardless of params) | Conservative, decidable, simple to implement |
| FEL `@index` unspecified in component context | **FEL always resolves against data tree**, never component tree | Explicit normative statement |
| Unbound required items → unsubmittable | **Renderer MUST render all relevant required items**, using Tier 1/2 fallback for unbound | Closes the gap |
| Bind by dotted group path | **Bind by global key only** (keys are unique per spec.md) | Decouples component tree from Definition group structure |
| Token syntax `$token.x` (flat) | **`$token.path`** (dot-path, matching Tier 2 implementation) | Already resolved and implemented in Tier 2 |
| `when` property name | **Keep `when`** | Alternatives (`visible`, `showIf`) were considered; `when` is concise and already in proposals |
| ~4,000 line spec + ~3,000 line schema | **~2,200–2,800 line spec + ~800–1,200 line schema** | Scope cut by ~40% |
| 450 tests | **~250 tests** | Proportionate |
| 9–13 day estimate | **Realistic: spec writing is the bottleneck, not code** | |

---

## §1. Ground Truth — Current State

### Tier 1 (implemented in spec.md + definition.schema.json)
- `formPresentation`: pageMode, labelPosition, density
- `presentation` on Items: widgetHint (40 values), layout, styleHints, accessibility
- `additionalProperties: true` on presentation top-level
- §4.2.5.6: informative note about future companion specs

### Tier 2 (implemented in theme-spec.md + theme.schema.json)
- Theme document: `$formspecTheme`, `url`, `version`, `targetDefinition`, `platform`, `tokens`, `defaults`, `selectors`, `items`, `pages`, `breakpoints`
- 3-level cascade: defaults → selectors (dataType/type match) → item key overrides
- Tier 1 hints = Level 0 (lowest specificity)
- Shallow merge per-property; null suppression
- Token syntax: `$token.path` (dollar-prefix dot-path)
- `widgetConfig`: open object, typed in prose
- Fallback chains on progressive widgets
- 12-column responsive grid with pages/regions
- 171 tests, schema at 287 lines, spec at 1,082 lines

### What Tier 3 adds
A **Component Document** that defines a parallel presentation tree with:
1. **Slot binding** — components reference Definition items by globally unique `key`
2. **Component vocabulary** — 18 core + 15 progressive built-in components
3. **Custom components** — parameterized reusable templates
4. **Conditional rendering** — `when` (FEL expression) for UI-only visibility
5. **Responsive variants** — per-breakpoint prop overrides
6. **Token references** — `$token.path` (shared with Tier 2)

---
## §2. Component Vocabulary

### Conformance Levels

| Level | Components | Requirement |
|-------|-----------|-------------|
| **Core** (18) | Renderers MUST support | Enough to render any form functionally |
| **Progressive** (15) | Renderers SHOULD support; MUST declare fallback | Enhanced UX |

A renderer that supports all Core components is **Tier 3 Core Conformant**.
A renderer that also supports all Progressive components is **Tier 3 Complete Conformant**.

### Core Components (18)

**Layout (5):**

| Component | Props | Children | Description |
|-----------|-------|----------|-------------|
| `Page` | `title`, `description` | Yes | Top-level container. Wizard uses multiple Pages. |
| `Stack` | `direction` (vertical/horizontal), `gap`, `align` | Yes | Flexbox-style stacking. |
| `Grid` | `columns` (int or pattern), `gap` | Yes | Multi-column grid. |
| `Wizard` | `showProgress` | Yes (Pages) | Sequential step navigation. |
| `Spacer` | `size` | No | Empty space. |

**Input (7) — `bind` REQUIRED:**

| Component | Binds to dataType | Props |
|-----------|------------------|-------|
| `TextInput` | string, text, uri | `placeholder`, `maxLines`, `inputMode` |
| `NumberInput` | integer, decimal | `step`, `min`, `max` |
| `DatePicker` | date, dateTime, time | `format`, `minDate`, `maxDate` |
| `Select` | choice | `searchable`, `placeholder` |
| `CheckboxGroup` | multiChoice | `columns`, `selectAll` |
| `Toggle` | boolean | `onLabel`, `offLabel` |
| `FileUpload` | attachment | `accept`, `maxSize`, `multiple` |

**Display (3):**

| Component | Props | bind | Description |
|-----------|-------|------|-------------|
| `Heading` | `level` (1–6), `text` | No | Section heading. |
| `Text` | `text`, `format` (plain/markdown) | Optional | Static or bound value display. |
| `Divider` | `label` | No | Horizontal rule. |

**Container (3):**

| Component | Props | Children | Description |
|-----------|-------|----------|-------------|
| `Card` | `title`, `subtitle` | Yes | Bordered surface. |
| `Collapsible` | `title`, `defaultOpen` | Yes | Expandable section. |
| `ConditionalGroup` | `when` (FEL), `fallback` | Yes | Conditional visibility. |

### Progressive Components (15)

**Layout (3):**

| Component | Props | Children | Description | Fallback |
|-----------|-------|----------|-------------|----------|
| `Columns` | `widths` (array) | Yes | Multi-column layout with explicit widths. | `Grid` or `Stack` |
| `Tabs` | `position` | Yes (Pages) | Tabbed navigation. | `Stack` |
| `Accordion` | `allowMultiple` | Yes (Collapsibles) | Vertically stacked headers that expand. | `Stack` |

**Input (5) — `bind` REQUIRED:**

| Component | Binds to dataType | Props | Fallback |
|-----------|------------------|-------|----------|
| `RadioGroup` | choice | `columns` | `Select` |
| `MoneyInput` | decimal, number | `currency`, `prefix`, `suffix` | `NumberInput` |
| `Slider` | integer, decimal | `min`, `max`, `step` | `NumberInput` |
| `Rating` | integer | `max`, `icon` | `NumberInput` |
| `Signature` | attachment | `strokeColor`, `clearable` | `FileUpload` |

**Display (5):**

| Component | Props | bind | Description | Fallback |
|-----------|-------|------|-------------|----------|
| `Alert` | `severity`, `text` | Optional | Contextual feedback messages. | `Card` or `Text` |
| `Badge` | `text`, `variant` | Optional | Small status descriptor. | `Text` |
| `ProgressBar` | `value`, `max`, `label` | Optional | Visual progress indicator. | `Text` |
| `Summary` | `items` (array) | No | Key-value pair list of bound values. | `Stack` of `Text` |
| `DataTable` | `columns` (array) | Yes (Repeatable) | Tabular display of repeatable data. | `Stack` |

**Container (2):**

| Component | Props | Children | Description | Fallback |
|-----------|-------|----------|-------------|----------|
| `Panel` | `position` (left/right) | Yes | Sidebar or auxiliary container. | `Stack` |
| `Modal` | `title`, `size` | Yes | Overlaid dialog. | `Collapsible` |

Each Progressive component MUST declare a Core fallback as shown above. A renderer that does not support a Progressive component MUST render its designated fallback to ensure the form remains functional.

---

## §2.1 Component ↔ DataType Compatibility Matrix

Each Input component is compatible with a specific subset of Formspec `dataType` values.

| `dataType` | Compatible Input Components |
|---|---|
| `string`, `text`, `uri` | `TextInput` |
| `integer`, `decimal` | `NumberInput`, `Slider`, `Rating`, `MoneyInput` |
| `boolean` | `Toggle` |
| `date`, `dateTime`, `time` | `DatePicker` |
| `choice` | `Select`, `RadioGroup` |
| `multiChoice` | `CheckboxGroup` |
| `attachment` | `FileUpload`, `Signature` |

Display components (`Text`, `Heading`, `Alert`, `Badge`) may bind to any `dataType` for read-only display.

---
## §3. Slot Binding

### The `bind` property

`"bind": "itemKey"` — a single string, the globally unique `key` from the Definition.

**NOT dotted paths.** Since keys are unique across the entire Definition (per spec.md §4.2.1), `"bind": "totalBudget"` is unambiguous. No `"bind": "budget_section.totalBudget"` needed. This decouples the component tree from the Definition's group hierarchy.

### Binding rules

| Rule | Description |
|------|-------------|
| **Input components** | `bind` is REQUIRED. The component reads/writes the bound item's value. |
| **Display components** | `bind` is OPTIONAL. When set, the component displays the bound item's current value. |
| **Layout/Container** | `bind` is FORBIDDEN (except for binding to a repeatable group, see below). |
| **Label resolution** | Renderer reads `label`, `hint`, `description` from the Definition item. Component MAY override with `labelOverride`, `hintOverride`. |
| **Error display** | Validation errors from Binds are routed to whichever input component binds that key. |
| **Required/readonly** | Resolved from Binds at runtime. Components cannot override behavioral properties. |

### Editable binding uniqueness

**At most ONE editable input component per itemKey.** Multiple display/read-only components binding the same key are allowed.

This enables wizard review pages: Step 1 has `TextInput` bound to `name` (editable), Step 3 has `Text` bound to `name` (read-only display).

### Repeatable group binding

Binding to a repeatable group's key makes the component a **repeat template**:
- The component's children render once per repetition
- FEL's `@index` and `@count` resolve against the data tree's repeat context
- `DataTable` bound to a repeatable group renders children as columns

### Unbound items

Definition items NOT referenced by any `bind` in the component tree are **not rendered by the component tree**. However:

> **Normative:** A conforming renderer MUST render all visible (relevant) items that have `required: true` on their Bind. For unbound required items, the renderer MUST use Tier 1 `presentation` hints (if present) or Tier 2 theme overrides (if a theme is active) or the renderer's default widget for that `dataType`. Unbound required items SHOULD be appended after the component tree's rendered output.

This prevents the "accidentally unsubmittable form" scenario.

---

## §4. Custom Components and `{param}` Interpolation

### Registry

Top-level `components` object defines reusable templates:

```json
{
  "components": {
    "AddressBlock": {
      "params": ["prefix"],
      "tree": {
        "component": "Stack",
        "gap": "$token.spacing.sm",
        "children": [
          { "component": "TextInput", "bind": "{prefix}_street" },
          { "component": "Grid", "columns": 3, "children": [
            { "component": "TextInput", "bind": "{prefix}_city" },
            { "component": "Select", "bind": "{prefix}_state" },
            { "component": "TextInput", "bind": "{prefix}_zip" }
          ]}
        ]
      }
    }
  }
}
```

Instantiation: `{ "component": "AddressBlock", "params": { "prefix": "home" } }`

### `{param}` Interpolation Grammar (ABNF)

```abnf
interpolation  = "{" param-name "}"
param-name     = ALPHA *(ALPHA / DIGIT / "_")

; Interpolation occurs in:
;   - "bind" string values
;   - "when" string values
;   - "text" prop on Text/Heading/Alert components
;
; Interpolation does NOT occur in:
;   - Component type names
;   - Token references ($token.path)
;   - Numeric or boolean prop values
;
; Escaping: "{{" produces a literal "{". "}}" produces a literal "}".
; Nesting is prohibited: "{outer_{inner}}" is invalid.
; Interpolation is textual (string substitution), not structural.
; Result MUST be a valid item key when used in "bind".
```

### Recursion prohibition

A custom component MUST NOT reference itself, directly or transitively. Cycle detection is **structural**: if component A's tree contains a reference to component B, and B's tree contains a reference to A, this is a cycle regardless of `{param}` values. Validators MUST detect and reject cycles.

Recommended limits:
- Custom component nesting depth: SHOULD NOT exceed 3 levels
- Total tree depth: SHOULD NOT exceed 20 levels

---
## §5. Conditional Rendering, FEL Context, and Responsive Design

### `when` property

Any component MAY carry a `when` property containing a FEL expression. When the expression evaluates to `false` (or null), the component and its children are not rendered.

```json
{ "component": "Alert", "when": "$budget_amount > 50000", "severity": "warning",
  "text": "Budgets over $50,000 require VP approval." }
```

### Distinction from Bind `relevant`

| | Bind `relevant` | Component `when` |
|---|---|---|
| **Controls** | Data model inclusion | Visual rendering only |
| **When false** | Item excluded from submission, validation suspended | Component hidden, data model unaffected |
| **Use case** | "This field shouldn't exist unless X" | "Show this help panel when amount is high" |

### FEL evaluation context

**Normative:** FEL expressions in `when` ALWAYS resolve against the **data tree** (Definition Instance), never the component tree.

- `$fieldKey` resolves to the field's value in the Instance
- `@index` and `@count` resolve relative to the repeat context in the **data** tree
- If a component reorganizes items across groups (e.g., pulling fields from different groups into one wizard step), FEL references still resolve against the original data tree positions
- FEL expressions in `when` have the same semantics as FEL expressions in Bind `relevant`, except that `when: false` does NOT affect data model inclusion

### Responsive variants

Top-level `breakpoints` (same as Tier 2 format: `{ "sm": 640, "md": 1024 }`).

Any component can carry a `responsive` object with per-breakpoint **prop overrides** (shallow merge):

```json
{
  "component": "Grid",
  "columns": "1fr 1fr",
  "responsive": {
    "sm": { "columns": "1fr" }
  }
}
```

**Constraints:**
- A component's `component` type MUST NOT change per breakpoint
- `responsive` overrides props only, not `children` or `bind`
- Breakpoints cascade smallest-first (mobile-first)

---

## §6. Document Structure and Schema

### Top-level JSON structure

```json
{
  "$formspecComponent": "1.0",
  "url": "https://example.com/presentations/budget-wizard",
  "version": "1.0.0",
  "targetDefinition": {
    "url": "https://example.com/definitions/budget-form",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "breakpoints": { "sm": 640, "md": 1024, "lg": 1440 },
  "tokens": { "color.accent": "#1e40af" },
  "components": { },
  "tree": { }
}
```

### Schema approach: `component.schema.json`

**Discriminated union via `if/then`** on the `component` property (not `oneOf` — better error messages).

```
component.schema.json
├─ $defs/
│  ├─ ComponentBase       ─ component (string), bind, when, responsive, style
│  ├─ ChildrenArray       ─ array of anyComponent
│  ├─ AnyComponent        ─ if/then dispatch on "component" property
│  ├─ Layout/
│  │  ├─ Page, Stack, Grid, Wizard, Spacer          (5 Core)
│  │  └─ Columns, Tabs, Accordion                   (3 Progressive)
│  ├─ Input/
│  │  ├─ TextInput, NumberInput, DatePicker, Select,
│  │  │  CheckboxGroup, Toggle, FileUpload          (7 Core)
│  │  └─ RadioGroup, MoneyInput, Slider, Rating,
│  │     Signature                                 (5 Progressive)
│  ├─ Display/
│  │  ├─ Heading, Text, Divider                     (3 Core)
│  │  └─ Alert, Badge, ProgressBar, Summary,
│  │     DataTable                                  (5 Progressive)
│  ├─ Container/
│  │  ├─ Card, Collapsible, ConditionalGroup         (3 Core)
│  │  └─ Panel, Modal                               (2 Progressive)
│  ├─ CustomComponentRef  ─ component matches registry key, params
│  ├─ TargetDefinition   ─ reuse from theme.schema.json pattern
│  └─ Breakpoints        ─ reuse from theme.schema.json pattern
└─ required: [$formspecComponent, version, targetDefinition, tree]
```

**Key schema decisions:**

1. **Each component has its own props sub-schema** with `additionalProperties: false` (strict per-component, catches typos).
2. **Input components require `bind`.** Layout/Container forbid it (except DataTable, which optionally binds to a repeatable group).
3. **`when` is `type: string`** on every component (FEL expression). No schema-level FEL validation.
4. **Custom component refs** validated structurally only; registry lookup is referential-integrity, done outside pure JSON Schema.
5. **Progressive components** are in the schema (valid documents can use them). Conformance levels are spec-prose, not schema-enforced.

### Estimated schema size: ~800–1,200 lines

33 components × ~25 lines avg (props are small; the `if/then` wiring is the bulk) + ~200 lines infrastructure.

Much smaller than the original 2,800–3,200 estimate because:
- Props are simple (most components have 2–5 props)
- No discriminated widgetConfig unions (learned from Tier 2)
- Shared ComponentBase cuts repetition

---
## §7. Spec Document: `component-spec.md`

### Proposed Table of Contents

```
§1  Introduction                                        (~60 lines, informative)
  §1.1  Purpose and Scope
  §1.2  Relationship to Formspec Core, Theme Spec, and FEL
  §1.3  Conformance Levels (Core / Complete)
  §1.4  Terminology

§2  Document Structure                                  (~100 lines, normative)
  §2.1  Top-Level Properties
  §2.2  Target Definition Binding
  §2.3  MIME Type (.formspec-component.json)
  §2.4  Minimal Conforming Document

§3  Component Model                                     (~150 lines, normative)
  §3.1  Component Object Base Properties
        component, bind, when, responsive, style, children
  §3.2  Component Tree Semantics (single root)
  §3.3  Children Ordering
  §3.4  Nesting Constraints (which accept children)

§4  Slot Binding                                        (~200 lines, normative)
  §4.1  The bind Property (global key, not dotted path)
  §4.2  Bind Resolution Rules
  §4.3  Editable Binding Uniqueness (one editable per key)
  §4.4  Repeatable Group Binding
  §4.5  Unbound Required Items (MUST render with fallback)
  §4.6  Bind/dataType Compatibility Matrix

§5  Built-In Components — Core                          (~500 lines, normative)
  §5.1–5.5   Layout: Page, Stack, Grid, Wizard, Spacer
  §5.6–5.12  Input: TextInput, NumberInput, DatePicker, Select,
             CheckboxGroup, Toggle, FileUpload
  §5.13–5.15 Display: Heading, Text, Divider
  §5.16–5.18 Container: Card, Collapsible, ConditionalGroup

§6  Built-In Components — Progressive                   (~400 lines, normative)
  §6.1–6.3   Layout: Columns, Tabs, Accordion
  §6.4–6.8   Input: RadioGroup, MoneyInput, Slider, Rating, Signature
  §6.9–6.13  Display: Alert, Badge, ProgressBar, Summary, DataTable
  §6.14–6.15 Container: Panel, Modal
  §6.16 Fallback Requirements

§7  Custom Components                                   (~150 lines, normative)
  §7.1  The components Registry
  §7.2  {param} Interpolation Grammar (ABNF)
  §7.3  Instantiation
  §7.4  Recursion Prohibition and Cycle Detection
  §7.5  Depth Limits

§8  Conditional Rendering                               (~100 lines, normative)
  §8.1  The when Property
  §8.2  Distinction from Bind relevant
  §8.3  FEL Evaluation Context (always data tree)
  §8.4  Error Handling (malformed expression → hidden + warning)

§9  Responsive Design                                   (~80 lines, normative)
  §9.1  Breakpoints Declaration
  §9.2  The responsive Property (prop overrides only)
  §9.3  Merge Semantics (mobile-first)
  §9.4  Structural Constraints (no type switching)

§10 Theming and Design Tokens                           (~80 lines, normative)
  §10.1 The tokens Map (same format as Tier 2)
  §10.2 $token.path References
  §10.3 Cross-Tier Token Cascade:
        Component tokens > Theme tokens > renderer defaults
  §10.4 Unresolved Token Handling

§11 Cross-Tier Interaction                              (~100 lines, normative)
  §11.1 Tier 1 Fallback for Unbound Items
  §11.2 Tier 2 Token Inheritance
  §11.3 Precedence: Tier 3 > Tier 2 > Tier 1
  §11.4 Partial Component Trees

§12 Validation and Conformance                          (~80 lines, normative)
  §12.1 Structural Validation (JSON Schema)
  §12.2 Referential Integrity (bind keys, token refs, custom components)
  §12.3 Compatibility Validation (bind + dataType matrix)
  §12.4 Conformance Levels: Core / Complete

§13 Complexity Controls                                 (~60 lines, normative)
  §13.1 Excluded Features (the "NOT" list)
  §13.2 Guard Rails (depth limits, single-when, string-only params)
  §13.3 Extension Mechanism (x- prefixed custom components)

Appendix A  Full Example — Budget Wizard                (~100 lines, informative)
Appendix B  Component Quick Reference                    (~50 lines, informative)
Appendix C  DataType ↔ Component Compatibility          (~40 lines, normative)
```

### Estimated length: ~2,200–2,800 lines

Comparable to theme-spec (1,082 lines) + mapping-spec (1,999 lines). The component vocabulary (§5+§6) is the bulk.

---

## §8. Complexity Controls (the "NOT" list)

| Excluded Feature | Rationale |
|---|---|
| Imperative event handlers / scripting | No `onClick`, `onBlur`. Formspec is declarative. |
| Conditional `component` type switching | Component type is static. Only props change per breakpoint/condition. |
| Recursive custom components | Validators MUST detect structural cycles. |
| Computed props via FEL | FEL allowed only in `when` and `text` (on display components). Props are static or token refs. |
| Arbitrary slot projection | No transclusion, render-props, higher-order components. Children are direct. |
| Animation / transition specs | Out of scope. Renderers may animate. |
| Server-side data fetching | No `fetch`, no async. |
| Component inheritance | Templates, not classes. No `extends`. |
| Dynamic component registration | `components` registry is static. |
| Deep responsive (children swap) | `responsive` overrides props only, not tree structure. |

---
## §9. Component Documentation Template

Every component entry in §5–§6 follows this template:

```markdown
### §X.Y  ComponentName

**Category:** Layout | Input | Display | Container
**Level:** Core | Progressive (fallback: FallbackComponent)
**Accepts children:** Yes / No
**Bind:** Required | Optional | Forbidden
**Compatible dataTypes:** (Input only) list

#### Description
One paragraph.

#### Props
| Prop | Type | Default | Token-able | Description |
|------|------|---------|------------|-------------|

#### Rendering Requirements
- MUST render as [semantic element or role]
- MUST propagate bound item's required/readOnly/relevant state
- MUST display validation errors from bound item

#### Example
```json
{ "component": "TextInput", "bind": "firstName", "placeholder": "..." }
```
```

Estimated per-component: ~40–60 lines.

---

## §10. Changes to `spec.md` and `theme-spec.md`

### spec.md

| Location | Change |
|----------|--------|
| §2.3 Layer 3 | Add: *"The Formspec Component Specification [COMPONENT-SPEC] defines component documents for full presentation-tree control."* |
| §4.2.5.6 | Add: *"See the Formspec Component Specification for the component document format."* |

### theme-spec.md

| Location | Change |
|----------|--------|
| §3.3 (token reference cross-tier note) | Already has: *"Future Tier 3 specifications use `{param}` syntax... does not conflict with `$token.`"* — update to reference the actual component-spec. |

Estimated: ~15 lines total across both files.

---

## §11. Test Plan

### New file: `test_component_schema.py`

| Category | Tests | Description |
|----------|-------|-------------|
| **Schema valid** | 35 | Minimal doc, full doc, each Core component, each Progressive component, custom components |
| **Schema invalid** | 30 | Missing required, wrong types, unknown component names, bad props |
| **Bind resolution — valid** | 25 | Each dataType bound to compatible component, group binding, display binding, unbound |
| **Bind resolution — invalid** | 15 | Incompatible dataType, two editable inputs same key, bind on layout component |
| **Repeatable groups** | 12 | Bind to repeatable, nested, DataTable binding |
| **Custom components** | 20 | Valid params, missing param, escape `{{`, cycle detection, nesting depth |
| **Conditional `when`** | 15 | Valid FEL, $fieldKey refs, boolean ops, null field ref, malformed expression |
| **Responsive** | 12 | Single breakpoint, multi-breakpoint, mobile-first cascade, no type switching |
| **Token resolution** | 12 | Valid $token refs, unresolved, Tier 2 inheritance, local override |
| **Cross-tier** | 15 | Tier 3 > Tier 2 > Tier 1, unbound required item fallback, partial tree |
| **Conformance levels** | 8 | Core-only doc, Complete doc, Progressive with fallback declared |
| **Edge cases** | 10 | Empty tree, deep nesting (20+), all 33 components in one tree, component with no props |
| **Compatibility matrix** | 20 | Input component × dataType cross-product (valid + invalid) |
| **Total** | **~229** |

### Regression

All 1,559 existing tests unchanged.

---

## §12. Ordered Task List

### Phase 1: Schema (7 tasks)

| # | Task | Output |
|---|------|--------|
| 1 | Draft `component.schema.json` — top-level, TargetDefinition, Breakpoints, Tokens (reuse Tier 2 patterns) | Scaffold |
| 2 | Define ComponentBase $def (component, bind, when, responsive, style, children) | Updated schema |
| 3 | Define Core Layout components (Page, Stack, Grid, Wizard, Spacer) | 5 component $defs |
| 4 | Define Core Input components (TextInput, NumberInput, DatePicker, Select, CheckboxGroup, Toggle, FileUpload) | 7 component $defs |
| 5 | Define Core Display + Container (Heading, Text, Divider, Card, Collapsible, ConditionalGroup) | 6 component $defs |
| 6 | Define all Progressive components (15) + CustomComponentRef | 16 $defs |
| 7 | Wire if/then dispatch, validate against meta-schema | Complete schema |

### Phase 2: Tests (4 tasks)

| # | Task | Output |
|---|------|--------|
| 8 | Create `test_component_schema.py` scaffold | New file |
| 9 | Write schema + bind + custom component tests (~140 tests) | Passing |
| 10 | Write conditional + responsive + token + cross-tier + edge tests (~89 tests) | Passing |
| 11 | Run full suite (1,559 + ~229 = ~1,788) | All green |

### Phase 3: Spec Document (10 tasks)

| # | Task | Output |
|---|------|--------|
| 12 | Write §1–§2 (Introduction, Document Structure) | Draft |
| 13 | Write §3 (Component Model — base props, tree semantics) | Updated |
| 14 | Write §4 (Slot Binding — rules, uniqueness, repeatable, unbound) | Updated |
| 15 | Write §5 (Core Components — 18 entries using template) | Updated |
| 16 | Write §6 (Progressive Components — 15 entries + fallback table) | Updated |
| 17 | Write §7 (Custom Components — registry, ABNF, cycles) | Updated |
| 18 | Write §8–§9 (Conditional Rendering, Responsive) | Updated |
| 19 | Write §10–§13 (Tokens, Cross-Tier, Validation, Complexity Controls) | Updated |
| 20 | Write Appendices A–C | Complete |
| 21 | Full review — normative audit, cross-refs, schema consistency | Reviewed |

### Phase 4: Integration (4 tasks)

| # | Task | Output |
|---|------|--------|
| 22 | Add cross-references to `spec.md` + `theme-spec.md` | Updated |
| 23 | Update `index.html` | Updated hub |
| 24 | Run full suite (~1,788 tests) | All green |
| 25 | Git commit: "Add Formspec Component Specification (Tier 3)" | Committed |

**Total: 25 tasks across 4 phases.**

---

## §13. Effort Estimate

| Artifact | Size |
|----------|------|
| `component-spec.md` | ~2,200–2,800 lines |
| `component.schema.json` | ~800–1,200 lines |
| `test_component_schema.py` | ~1,500–2,000 lines (~229 tests) |
| `spec.md` changes | ~10 lines |
| `theme-spec.md` changes | ~5 lines |
| `index.html` changes | ~10 lines |
| **Total** | **~4,500–6,000 lines** |

---

## §14. Resolved Design Questions

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Component count? | **33 total: 18 Core (MUST) + 15 Progressive (SHOULD + fallback)** |
| Q2 | Bind: dotted path or global key? | **Global key only.** Keys are unique. Decouples from group hierarchy. |
| Q3 | Editable binding uniqueness? | **At most one editable input per key.** Read-only displays unlimited. |
| Q4 | Token syntax? | **`$token.path`** (matching Tier 2 implementation). |
| Q5 | `{param}` grammar? | **Formal ABNF.** Escaping via `{{`/`}}`. No nesting. String-only. |
| Q6 | Cycle detection? | **Structural only.** Same component name = cycle regardless of params. |
| Q7 | FEL context for `when`? | **Always data tree.** Never component tree. Explicit normative statement. |
| Q8 | Unbound required items? | **Renderer MUST render with Tier 1/2/default fallback.** Appended after component tree. |
| Q9 | `when` property name? | **Keep `when`.** Concise, already established in proposals. |
| Q10 | Responsive: can children change? | **No.** Props only. No structural responsiveness. |
| Q11 | Schema approach? | **`if/then` dispatch** on `component` prop (not `oneOf`). Better errors. |
| Q12 | Submission for hidden-by-`when` items? | **`when` is visual only.** Data model unaffected. Distinct from `relevant`. |
| Q13 | Extension mechanism? | **`x-` prefixed custom component names** in the `components` registry. |
| Q14 | Accessibility per component? | **Rendering Requirements** in each component entry specify semantic role / ARIA equivalent. |

---

## §15. Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| 33 components too many for v1 | Low (cut to 18 Core) | Conformance levels; Progressive fallbacks |
| `{param}` injection / invalid keys | Eliminated | ABNF grammar; result validated as key pattern |
| Cycle detection complexity | Low | Structural only; no param-dependent analysis |
| FEL context ambiguity | Eliminated | Normative: always data tree |
| Unsubmittable forms | Eliminated | Required-item fallback rule |
| Token syntax conflict | Eliminated | `$token.path` shared with Tier 2 (already implemented) |
| Schema too large | Medium | ~1,000 lines (vs original 3,000). Components have small prop sets. |
| Spec grows disproportionately | Medium | Target ~2,500 lines. Component template keeps entries consistent. |
| Wizard review pattern broken | Eliminated | One editable, unlimited read-only displays per key |
| Bind path couples to group structure | Eliminated | Global key binding only |

---

## §17. Success Criteria and Validation

Completion of Tier 3 is defined by the following:

1.  **Normative Spec:** `component-spec.md` is complete, internally consistent, and cross-referenced with `spec.md` and `theme-spec.md`.
2.  **Structural Schema:** `component.schema.json` validates all 33 Core and Progressive components, enforces `bind` requirements for inputs, and prevents structural cycles.
3.  **Test Coverage:** A suite of ~229 tests (in `test_component_schema.py`) achieving:
    - 100% coverage of component types in the schema.
    - 100% coverage of `bind` compatibility matrix.
    - Validation of `{param}` interpolation and cycle detection.
    - Validation of `when` expression evaluation context.
4.  **Referential Integrity:** Proof that a validator can verify:
    - Every `bind` resolves to a valid key in the target Definition.
    - Every `$token` resolves to a token in the local doc or referenced theme.
    - Every custom component reference resolves to a registry entry.
5.  **Backward Compatibility:** All 1,559 existing tests for Tier 1 and Tier 2 continue to pass.

---

## §18. Appendix: Full Example — Employee Onboarding Wizard

```json
{
  "$formspecComponent": "1.0",
  "url": "https://example.com/onboarding-ui",
  "version": "1.1.0",
  "targetDefinition": {
    "url": "https://example.com/onboarding-def",
    "compatibleVersions": "^1.0.0"
  },
  "tokens": {
    "spacing.page": "24px",
    "color.primary": "$token.brand.blue"
  },
  "components": {
    "LabeledSection": {
      "params": ["title", "itemKey"],
      "tree": {
        "component": "Stack",
        "children": [
          { "component": "Heading", "level": 3, "text": "{title}" },
          { "component": "TextInput", "bind": "{itemKey}" }
        ]
      }
    }
  },
  "tree": {
    "component": "Wizard",
    "showProgress": true,
    "children": [
      {
        "component": "Page",
        "title": "Personal Details",
        "children": [
          { "component": "Card", "title": "Basic Info", "children": [
            { "component": "LabeledSection", "params": { "title": "First Name", "itemKey": "fname" } },
            { "component": "LabeledSection", "params": { "title": "Last Name", "itemKey": "lname" } }
          ]},
          { "component": "DatePicker", "bind": "dob", "maxDate": "2007-01-01" }
        ]
      },
      {
        "component": "Page",
        "title": "Equipment",
        "children": [
          { "component": "Text", "text": "Select your preferred equipment:" },
          { "component": "CheckboxGroup", "bind": "hardware_prefs", "columns": 2 },
          { "component": "ConditionalGroup",
            "when": "CONTAINS($hardware_prefs, 'other')",
            "children": [
              { "component": "TextInput", "bind": "hardware_other_details", "placeholder": "Specify..." }
            ]
          }
        ]
      }
    ]
  }
}
```
