# Formspec Component Specification (LLM Reference)

A sidecar JSON document defining a **parallel presentation tree** of UI components bound to a Formspec Definition's items. Tier 3 in the presentation hierarchy (Tier 1 = inline hints, Tier 2 = Theme selectors, Tier 3 = explicit component tree). Multiple Component Documents can target the same Definition for platform-specific layouts (web wizard, mobile single-page, print).

## Document Structure

Required: `$formspecComponent` ("1.0"), `version`, `targetDefinition` (with `url`, optional `compatibleVersions` semver range), `tree` (single root component object).

Optional: `url`, `name`, `title`, `description`, `breakpoints`, `tokens`, `components` (custom component registry).

File extension: `.formspec-component.json`. Unrecognized top-level keys starting with `x-` are ignored; others are rejected.

## Conformance

| Level | Scope | Requirement |
|-------|-------|-------------|
| **Core** | 18 components | MUST support all 18. Substitute Progressive components with their Core fallback. |
| **Complete** | All 33 (18 Core + 15 Progressive) | MUST render all 33 natively. |

Both levels MUST support custom components, `when` expressions, `responsive` overrides, and `$token.` resolution.

## Component Model

Every component object has base properties: `component` (type name, REQUIRED), `bind` (item key), `when` (FEL boolean), `responsive` (breakpoint overrides), `style` (flat map, supports `$token.path`), `children` (ordered array). Processors ignore unrecognized properties (forward-compatible).

**Single root**: `tree` contains exactly one component object (wrap multiples in Stack/Page).

**Children ordering**: Array order preserved in rendering. Renderers must not reorder.

**Four categories with nesting rules**:

| Category | Has children | Has bind | Examples |
|----------|-------------|----------|----------|
| **Layout** | Yes | Forbidden | Page, Stack, Grid, Wizard, Columns, Tabs, Accordion, Spacer (leaf) |
| **Container** | Yes | Forbidden (except DataTable) | Card, Collapsible, ConditionalGroup, Panel, Modal |
| **Input** | No | Required | TextInput, NumberInput, Select, Toggle, etc. |
| **Display** | No | Optional | Heading, Text, Divider, Alert, Badge, etc. |

Max nesting depth: 20 levels. Wizard children must all be Page. Spacer must not have children.

## Slot Binding

`bind` is a flat item `key` string (not dotted path or FEL). Resolution by category:

- **Input**: REQUIRED. Reads/writes bound item value. Renderer propagates required, readonly, relevant state and displays validation errors adjacent to component.
- **Display**: OPTIONAL. Shows bound item value read-only; otherwise renders static `text` prop.
- **Layout/Container**: FORBIDDEN (except DataTable for repeatable groups).

**Uniqueness**: At most one editable Input per item key. Multiple read-only Display components may bind the same key.

**Repeatable groups**: When bound to a repeatable group, the component acts as a repeat template — rendered once per instance. Child binds resolve within repeat context. Available on DataTable.

**Unbound required items**: Renderer must append fallback inputs for required items not bound in the tree, using Tier 2 → Tier 1 → defaults, in Definition document order.

**dataType compatibility**:

| dataType | Compatible Inputs |
|----------|------------------|
| `string` | TextInput |
| `number`, `integer` | NumberInput, Slider(P), Rating(P), MoneyInput(P) |
| `boolean` | Toggle |
| `date`, `dateTime`, `time` | DatePicker |
| `choice` | Select, RadioGroup(P) |
| `multiChoice` | CheckboxGroup |
| `attachment` | FileUpload, Signature(P) |

Display components are compatible with ALL dataTypes in read-only bind mode.

## Built-In Components — Core (18)

### Layout (5)

**Page** — Top-level section container. Props: `title`, `description`. When inside Wizard, shown/hidden by step navigation.

**Stack** — Flexbox stacking container. Props: `direction` ("vertical"|"horizontal", default "vertical"), `gap`, `align` ("start"|"center"|"end"|"stretch"), `wrap`. Most common layout primitive and typical root component.

**Grid** — Multi-column grid. Props: `columns` (integer or CSS template string, default 2), `gap`, `rowGap`. Children placed in source order, wrapping to new rows.

**Wizard** — Sequential step-by-step navigation. Children MUST all be Page. Props: `showProgress` (default true), `allowSkip` (default false). Shows one Page at a time with Next/Previous controls. Validates current page before forward navigation unless allowSkip.

**Spacer** — Empty spacing element (leaf, no children). Props: `size`.

### Input (7)

**TextInput** — Single/multi-line text input. Compatible: `string`. Props: `placeholder`, `maxLines` (1=single-line, >1=textarea), `inputMode` ("text"|"email"|"tel"|"url"|"search"), `prefix`, `suffix`.

**NumberInput** — Numeric input with optional stepper. Compatible: `integer`, `number`. Props: `step`, `min`, `max`, `showStepper`, `locale`.

**DatePicker** — Date/time/datetime picker (auto-detected from bound dataType). Compatible: `date`, `dateTime`, `time`. Props: `format` (display only, stores ISO 8601), `minDate`, `maxDate`, `showTime`.

**Select** — Dropdown single-select. Compatible: `choice`. Options from bound item's `options`/`optionSet`. Props: `searchable`, `placeholder`, `clearable`.

**CheckboxGroup** — Multi-select checkboxes. Compatible: `multiChoice`. Props: `columns`, `selectAll`.

**Toggle** — Boolean switch. Compatible: `boolean`. Props: `onLabel`, `offLabel`.

**FileUpload** — File attachment upload. Compatible: `attachment`. Props: `accept` (MIME types), `maxSize` (bytes), `multiple`, `dragDrop`.

### Display (3)

**Heading** — Section heading. Props: `level` (1–6, REQUIRED), `text` (REQUIRED). Bind forbidden.

**Text** — Static or data-bound text. Props: `text`, `format` ("plain"|"markdown"). When `bind` present, displays bound value; otherwise static `text`. Markdown output must be sanitized.

**Divider** — Horizontal rule. Props: `label` (optional centered text). Bind forbidden.

### Container (3)

**Card** — Bordered surface grouping. Props: `title`, `subtitle`, `elevation`.

**Collapsible** — Expandable/collapsible section. Props: `title` (REQUIRED), `defaultOpen` (default false). Collapsed children hidden but remain in DOM, data preserved, `relevant`/`when` still evaluated. ARIA: `aria-expanded`.

**ConditionalGroup** — Condition-based visibility group. `when` is REQUIRED (unlike optional on other components). Props: `when` (FEL boolean, REQUIRED), `fallback` (text shown when false). Hidden children retain data (unlike Bind `relevant` which may clear data).

## Built-In Components — Progressive (15)

### Layout (3)

**Columns** → fallback Grid. Explicit per-column widths. Props: `widths` (array of CSS values), `gap`.

**Tabs** → fallback Stack + Heading per child. Tabbed navigation. Props: `position` ("top"|"bottom"|"left"|"right", default "top"), `tabLabels`, `defaultTab`. All children remain mounted.

**Accordion** → fallback Stack + Collapsible per child. Props: `allowMultiple` (default false), `defaultOpen` (index).

### Input (5)

**RadioGroup** → fallback Select. Radio buttons for choice. Props: `columns`, `orientation`.

**MoneyInput** → fallback NumberInput. Currency-aware numeric input. Props: `currency` (ISO 4217), `showCurrency`, `locale`. Stores money object.

**Slider** → fallback NumberInput. Range slider. Props: `min`, `max`, `step`, `showValue`, `showTicks`.

**Rating** → fallback NumberInput (min:1, step:1). Star/icon rating. Props: `max` (default 5), `icon` ("star"|"heart"|"circle"), `allowHalf`.

**Signature** → fallback FileUpload (accept:"image/*"). Drawn signature capture. Props: `strokeColor`, `height`, `penWidth`, `clearable`.

### Display (5)

**Alert** → fallback Text (prefixed with "[severity] "). Status banner. Props: `severity` ("info"|"success"|"warning"|"error", REQUIRED), `text` (REQUIRED), `dismissible`.

**Badge** → fallback Text. Compact label. Props: `text` (REQUIRED), `variant` ("default"|"primary"|"success"|"warning"|"error").

**ProgressBar** → fallback Text ("value / max (percent%)"). Props: `value`, `max`, `label`, `showPercent`. Bind optional.

**Summary** → fallback Stack of Text. Key-value display for review pages. Props: `items` (array of `{label, bind}`, REQUIRED).

**DataTable** → fallback Stack of Card. Tabular repeatable group display. Props: `columns` (array of `{header, bind}`, REQUIRED), `showRowNumbers`, `allowAdd`, `allowRemove`. Bind optional (to repeatable group).

### Container (2)

**Panel** → fallback Card. Sidebar panel. Props: `position` ("left"|"right"), `title`, `width`.

**Modal** → fallback Collapsible (defaultOpen:false). Dialog overlay. Props: `title` (REQUIRED), `size` ("sm"|"md"|"lg"|"xl"|"full"), `trigger` ("button"|"auto"), `triggerLabel`, `closable`. Focus trap, `role="dialog"`, `aria-modal="true"`.

## Fallback Substitution Rules

When a Core processor substitutes a Progressive component, it MUST preserve: all child components (recursively), `when`, `responsive`, `style`, `bind` (when fallback supports it). Props without equivalents on the fallback are discarded with a warning.

## Custom Components

Defined in top-level `components` registry. Each entry has: `params` (array of string parameter names, optional), `tree` (component subtree template, REQUIRED).

**Names**: PascalCase `[A-Z][a-zA-Z0-9]*`, must not collide with built-in names. `x-` prefix for vendor extensions.

**Interpolation**: `{paramName}` syntax in allowed string props only (`bind`, `when`, `text`, `title`, `placeholder`, `label`, `fallback`). Escaped braces: `{{`/`}}`. Forbidden in: `component`, `$token.*`, numeric/boolean props, `style`.

**Instantiation**: Use registry name as `component`, provide `params` object. Processor deep-clones template, replaces all `{param}` occurrences, inserts resolved subtree. Missing params → error. Extra params → ignored with warning. `when`/`style`/`responsive` on instantiation merge onto resolved root.

**Recursion**: Prohibited. Static cycle detection via directed graph. Documents with cycles rejected.

**Depth limits**: Custom nesting ≤ 3 levels; total tree depth ≤ 20.

## Conditional Rendering (`when`)

FEL boolean expression. `true` → render; `false`/`null`/non-boolean → hide (with all children). Optional on all components except ConditionalGroup (where REQUIRED). Use FEL `and`/`or` for compound conditions.

**vs. Bind `relevant`**: `when` is visual-only (data preserved); `relevant` affects data model. When both apply: `relevant=false` always hides (takes precedence); `relevant=true` + `when=false` → hidden but data preserved.

**FEL context**: Resolves against data tree only. `$fieldKey` for values, `@index`/`@count` in repeat context. Cannot reference component props or presentation state.

**Error handling**: Malformed `when` → hide + warning. Missing field ref → null → hidden + warning. Never halt rendering.

## Responsive Design

**Breakpoints**: Top-level `breakpoints` object (name → min-width in px). Component Document breakpoints override Theme Document breakpoints.

**`responsive` property**: Object of breakpoint → prop overrides. Only component-specific and `style` props allowed. Forbidden in overrides: `component`, `bind`, `when`, `children`, `responsive`.

**Mobile-first cascade**: Base props apply at all widths. Breakpoints applied in ascending min-width order via shallow merge. `style` overrides replace entire style object.

**Structural constraints**: `component` type, `children`, and `bind` must not change per breakpoint. Only presentational props may vary.

## Design Tokens

Same format as Theme spec. Flat `tokens` map: dot-delimited keys → string/number values. Referenced via `$token.<key>` in `style` and token-able props. No recursive references.

**Cross-tier cascade** (highest → lowest): Component tokens → Theme tokens → renderer defaults. Allows Component Documents to override specific theme tokens while inheriting the rest.

**Unresolved tokens**: Use platform default + warning. Never fail rendering.

## Cross-Tier Precedence

Tier 3 (Component) > Tier 2 (Theme) > Tier 1 (Definition hints). Component tree controls layout/component selection for bound items; unbound items fall back to Tier 2/Tier 1.

Behavioral rules (`required`, `readonly`, `relevant`, `constraint`, `calculate`) from the Definition are **never** overridden by any presentation tier.

**Partial trees**: Component Documents need not bind every item. Unbound visible items rendered via fallback after the tree output, in Definition order. All required items must remain editable.

## Validation

1. **Structural**: Required properties present, correct types, valid enums, valid component names, nesting constraints, ConditionalGroup has `when`, Wizard children are Page, Heading has level 1–6 + text.
2. **Referential integrity**: Bind keys exist in Definition, token references resolvable, custom component references exist in registry, custom params complete, Summary/DataTable bind refs valid, custom component graph acyclic.
3. **Compatibility**: Input component dataType matches bound item dataType per compatibility matrix.

## Complexity Controls

**Excluded features**: No imperative event handlers/scripting, no conditional component type switching, no recursive custom components, no computed props via FEL (only `when` and display text), no slot projection/transclusion, no animations, no server-side data fetching, no component inheritance, no dynamic component registration, no deep responsive (children swap).

**Guard rails**: Tree depth ≤ 20, custom nesting ≤ 3, one `when` per component, string-only params, no param interpolation in type names, flat token map, one editable Input per key, static tree structure.

**Extensions**: `x-` prefix for custom component names, top-level properties, style keys, and token prefixes. Extensions must not be required for correct Core/Progressive rendering.
