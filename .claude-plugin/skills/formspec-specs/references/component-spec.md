# Component Specification Reference Map

> specs/component/component-spec.md -- 3521 lines, ~120K -- Tier 3: Component Tree, Slot Binding, 35 Built-in Components

## Overview

The Component Specification defines **Tier 3** of Formspec's three-tier presentation model: an explicit, parallel presentation tree of UI components that slot-bind to Definition items by key. It is the most expressive presentation layer, overriding Tier 2 (Theme) widget selection and Tier 1 (Definition) hints for layout purposes, while never overriding the Definition's behavioral rules (required, relevant, readonly, constraint, calculate). The spec defines 35 built-in components (18 Core + 17 Progressive with fallbacks), a custom component template mechanism with parameterized interpolation, conditional rendering via FEL `when` expressions, responsive breakpoint overrides, and a design token system that cascades with Theme tokens.

## Section Map

### Preamble and Introduction (Lines 1-212)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Preamble | Status of This Document | Draft companion spec metadata, version 1.0.0, dated 2025-01-14. Declares dependencies on Core Spec, Theme Spec, and FEL Grammar. | Draft, dependencies | Checking spec version or dependency chain |
| Conventions | Conventions and Terminology | RFC 2119 keyword interpretation, JSON syntax references, section reference notation (`core $N`, `theme $N`). | RFC 2119, JSON Pointer, URI | Understanding normative language or cross-spec references |
| BLUF | Bottom Line Up Front | Four-bullet summary: Tier 3 documents, required top-level properties, component trees cannot override core behavioral semantics. | $formspecComponent, version, targetDefinition, tree | Quick orientation on what the spec mandates |
| ToC | Table of Contents | Full section listing with anchor links for all 13 numbered sections plus 3 appendices. | -- | Navigation |
| S1 | Introduction | Establishes the spec's role as Tier 3 of Formspec presentation; introduces Component Documents as sidecar JSON targeting a Definition. | Component Document, slot binding, presentation tree | Understanding what a Component Document is and why it exists |
| S1.1 | Purpose and Scope | Tier 3 builds an explicit tree of layout containers, input controls, and display elements. Multiple Component Documents MAY target the same Definition for platform-specific presentations. Declares 35 built-in components (18 Core + 17 Progressive). | Tier 3, parallel tree, platform-specific | Deciding whether to use a Component Document vs Theme |
| S1.2 | Relationship to Formspec Core, Theme Spec, and FEL | Three-tier table (Structure hints / Theme / Component). Tier 3 precedence over Tiers 1-2 for layout; behavioral rules always from Definition. FEL used only in `when` and display text interpolation. Tier 3 MAY coexist with Tier 2. | Three-tier model, behavioral rules immutable, FEL scope | Understanding how Component Documents interact with Themes and Definitions |
| S1.3 | Conformance Levels (Core / Complete) | Two conformance levels: Core (18 components + fallback for Progressive) and Complete (all 35 native). Both MUST support custom components. | Core Conformant, Complete Conformant, fallback substitution | Determining which components a processor must support |
| S1.4 | Terminology | Definitions for key terms: Definition, Component Document, Component, Tier 1/2/3, Renderer, Token, Slot binding, Core/Progressive/Custom component. | All terminology | Looking up precise term definitions |

### Document Structure (Lines 213-330)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S2 | Document Structure | Top-level JSON object structure with example showing all 8 properties. | JSON structure | Starting to author or parse a Component Document |
| S2.1 | Top-Level Properties | Schema-generated table of 11 top-level properties: `$formspecComponent` (req), `version` (req), `targetDefinition` (req), `tree` (req), `url`, `name`, `title`, `description`, `breakpoints`, `tokens`, `components`. Processors MUST ignore `x-` properties, MUST reject others. | $formspecComponent, version, targetDefinition, tree, tokens, components, breakpoints | Validating or authoring the top-level envelope |
| S2.2 | Target Definition Binding | `targetDefinition` object with `url` (required) and `compatibleVersions` (optional semver range). Processor SHOULD warn on range mismatch but MUST NOT fail. Identical mechanism to Theme Spec S2.2. | targetDefinition, url, compatibleVersions, semver | Binding a Component Document to a specific Definition version |
| S2.3 | MIME Type (.formspec-component.json) | File extension convention `.formspec-component.json`. HTTP content type `application/json` or custom `application/formspec-component+json`. | File extension, MIME type | File naming or content-type negotiation |
| S2.4 | Minimal Conforming Document | Smallest valid Component Document: 4 required properties, Stack root with one TextInput child. | Minimal document | Creating the simplest valid Component Document |

### Component Model (Lines 331-545)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S3 | Component Model | Overview: component tree is a hierarchy of component objects (layout, input, display, container). | Component object, tree hierarchy | Understanding the structural model |
| S3.1 | Component Object Base Properties | 9 base properties on every component: `component` (req), `id` (optional unique identifier), `bind`, `when`, `responsive`, `style`, `cssClass`, `accessibility`, `children`. The `id` property enables locale string addressing (`$component.<id>.<prop>`), test selectors, and accessibility anchoring. `id` MUST be unique across the document; collision at validation = error, at runtime = warning + first-occurrence wins. Repeat template nodes share the same `id` across instances. Processors MUST ignore unrecognized properties. | component, id, bind, when, responsive, style, cssClass, accessibility, children, locale addressing | Authoring any component node or building a parser |
| S3.2 | Component Tree Semantics (single root) | `tree` MUST be exactly one component object (not an array). Wrap in Stack or Page for multiple top-level components. Root MAY be any children-accepting component. | Single root, tree property | Fixing "tree cannot be an array" errors |
| S3.3 | Children Ordering | `children` array is ordered; renderers MUST preserve array order. Renderers MUST NOT reorder children. | Ordered children, render order | Debugging unexpected child ordering |
| S3.4 | Nesting Constraints | Four categories (Layout, Container, Input, Display) with rules: Layout/Container accept children; Input/Display MUST NOT have children. Spacer MUST NOT have children. Depth SHOULD NOT exceed 20. | Layout, Container, Input, Display categories, nesting rules | Validating tree structure or debugging nesting errors |
| S3.5 | AccessibilityBlock | Optional `accessibility` property on any component: `role` (ARIA role override), `description` (wired to aria-describedby), `liveRegion` (aria-live: off/polite/assertive). Renderers MUST apply all present properties. | AccessibilityBlock, role, description, liveRegion, ARIA | Adding accessibility overrides to components |
| S3.6 | Localizable String Properties | Table listing all component properties addressable by Locale Documents via `$component.<id>.<prop>` keys. Covers 20 components' localizable props. Array-valued properties use bracket indexing (e.g., `$component.mainTabs.tabLabels[0]`). | Localizable props, locale addressing, $component.<id>.<prop> | Identifying which component props are translatable |

### Slot Binding (Lines 546-715)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S4 | Slot Binding | Mechanism associating components with Definition items via the `bind` property. | Slot binding, bind property | Understanding data binding in the component tree |
| S4.1 | The bind Property | `bind` is a string accepting two forms: flat key (e.g., `"projectName"`) or dotted qualified path (e.g., `"applicantInfo.orgName"`). NOT a JSON Pointer or FEL expression. MUST correspond to an item key (or dotted path to nested item) in the target Definition. If key missing, processor MUST warn and SHOULD hide. | bind, flat key, dotted qualified path, item key | Authoring bind values or debugging "key not found" errors |
| S4.2 | Bind Resolution Rules | Per-category rules: Input=REQUIRED (reads/writes value, propagates required/readOnly/relevant/validation); Display=OPTIONAL (read-only display); Layout=FORBIDDEN; Container=FORBIDDEN (except DataTable and Accordion). Six renderer MUSTs for bound Input components: label, hint, required indicator, readonly, relevant, validation errors. | Input bind, Display bind, Layout/Container forbidden, label, hint, required indicator, readonly, relevant, validation | Implementing bind behavior in a renderer |
| S4.3 | Editable Binding Uniqueness | At most ONE editable Input per item key. Multiple read-only Display components MAY bind same key. Duplicate editable binds: reject or warn+use first. | Editable uniqueness, read-only display binding | Fixing duplicate bind validation errors |
| S4.4 | Repeatable Group Binding | Components binding to repeatable groups act as repeat templates. Renderer MUST render per-instance, resolve child binds within repeat context, provide add/remove affordances. DataTable (S6.14) and Accordion (S6.3) support this. Other layout/container components MUST NOT bind repeatable groups. | Repeatable group, repeat template, DataTable, Accordion, minRepeat, maxRepeat | Implementing or authoring repeatable group rendering |
| S4.5 | Unbound Required Items | Component Document need not bind every item. Required unbound items MUST get fallback rendering (Tier 2 then Tier 1 then defaults), appended after tree output, in Definition order. Non-required unbound items MAY be omitted. | Fallback rendering, unbound required items, partial tree | Handling items not in the component tree |
| S4.6 | Bind/dataType Compatibility Matrix | 10-row matrix mapping each dataType to compatible Input components. Processors MUST validate compatibility and MUST reject/warn on mismatches. Select on `multiChoice` MUST set `multiple` to `true`. | dataType compatibility, validation error | Checking if a component can bind a given dataType |

### Built-In Components -- Core (Lines 716-1562)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S5 | Built-In Components -- Core (18) | Section header introducing the 18 Core components. All conforming processors MUST support these. Grouped by category. | Core components | Starting point for Core component catalog |
| S5.1 | Page | Layout/Core. Top-level section container. Props: `title`, `description`. When in Wizard pageMode, shown/hidden by step navigation. MUST render as block section. | Page, section, wizard step | Authoring multi-step forms or sections |
| S5.2 | Stack | Layout/Core. Flexbox stacking container (default root). Props: `direction` (vertical/horizontal), `gap`, `align`, `wrap`. | Stack, direction, gap, align, wrap | Arranging children vertically or horizontally |
| S5.3 | Grid | Layout/Core. Multi-column grid. Props: `columns` (int or CSS template), `gap`, `rowGap`. Children distributed in source order. | Grid, columns, gap, rowGap | Creating multi-column layouts |
| S5.4 | [Reserved] | The Wizard component type was removed in favor of `formPresentation.pageMode: "wizard"` with a `Stack > Page*` tree structure. See Core S4.1.2 for normative page mode processing. | Wizard removed, pageMode | Understanding why there is no Wizard component |
| S5.5 | Spacer | Layout/Core. Empty spacing leaf. Props: `size`. No children, no bind. | Spacer, size | Adding whitespace between siblings |
| S5.6 | TextInput | Input/Core. Single/multi-line text. Props: `placeholder`, `maxLines`, `inputMode`, `prefix`, `suffix`. Compatible: string (plus number/date/time/dateTime as text). | TextInput, maxLines, inputMode, prefix, suffix | Authoring string field inputs |
| S5.7 | NumberInput | Input/Core. Numeric input with stepper. Props: `step`, `min`, `max`, `showStepper`, `locale`. Compatible: integer, number. | NumberInput, step, min, max, showStepper | Authoring numeric field inputs |
| S5.8 | DatePicker | Input/Core. Date/datetime/time picker. Props: `format`, `minDate`, `maxDate`, `showTime`. Mode auto-determined by dataType. Stores ISO 8601. | DatePicker, format, minDate, maxDate, ISO 8601 | Authoring date/time field inputs |
| S5.9 | Select | Input/Core. Single- or multi-select dropdown/combobox. Props: `searchable`, `multiple`, `placeholder`, `clearable`. When `searchable` or `multiple` is true, MUST render accessible combobox. Options from bound item's `options`/`optionSet`. Filter uses case-insensitive match against label, value, and `keywords` array. Compatible: choice, multiChoice. | Select, searchable, multiple, clearable, combobox, options, optionSet, keywords | Authoring choice field dropdowns or multi-selects |
| S5.10 | CheckboxGroup | Input/Core. Multi-select checkboxes. Props: `columns`, `selectAll`. Stores array of values. Compatible: multiChoice. | CheckboxGroup, columns, selectAll, multiChoice | Authoring multi-select fields |
| S5.11 | Toggle | Input/Core. Boolean switch. Props: `onLabel`, `offLabel`. Stores true/false. Compatible: boolean. | Toggle, onLabel, offLabel | Authoring boolean fields |
| S5.12 | FileUpload | Input/Core. File upload control. Props: `accept`, `maxSize`, `multiple`, `dragDrop`. Compatible: attachment. | FileUpload, accept, maxSize, multiple, dragDrop | Authoring file attachment fields |
| S5.13 | Heading | Display/Core. Section heading h1-h6. Props: `level` (req, 1-6), `text` (req). Bind FORBIDDEN. | Heading, level, text | Adding structural headings to forms |
| S5.14 | Text | Display/Core. Static or data-bound text. Props: `text`, `format` (plain/markdown). Bind OPTIONAL (displays bound value read-only). Markdown output MUST be sanitized. | Text, format, markdown, data-bound display | Displaying static text or read-only field values |
| S5.15 | Divider | Display/Core. Horizontal rule separator. Props: `label` (optional centered text). Bind FORBIDDEN. | Divider, label | Adding visual section breaks |
| S5.16 | Card | Container/Core. Bordered surface grouping. Props: `title`, `subtitle`, `elevation`. Accepts children. | Card, title, subtitle, elevation | Visually grouping related fields |
| S5.17 | Collapsible | Container/Core. Expand/collapse section. Props: `title` (req), `defaultOpen`. Collapsed children remain in DOM, data preserved, relevant/when still evaluated. ARIA: aria-expanded. | Collapsible, title, defaultOpen, aria-expanded | Adding optional/advanced collapsible sections |
| S5.18 | ConditionalGroup | Container/Core. Visibility controlled by REQUIRED `when` expression. Props: `when` (req, FEL), `fallback`. Hidden children retain data (unlike Bind relevant). ConditionalGroup without `when` is invalid and MUST be rejected. | ConditionalGroup, when (required), fallback, data preservation | Conditionally showing/hiding groups of fields |
| S5.19 | SubmitButton | Display/Core. Form submission trigger button. Props: `label`, `mode` (continuous/submit), `emitEvent`, `pendingLabel`, `disableWhenPending`. Dispatches `formspec-submit` CustomEvent when `emitEvent` is true. Shows `pendingLabel` and disables during submit-pending state. Bind FORBIDDEN. | SubmitButton, label, mode, emitEvent, pendingLabel, disableWhenPending, formspec-submit | Adding a submit button to the form |

### Built-In Components -- Progressive (Lines 1563-2491)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S6 | Built-In Components -- Progressive (17) | Section header for 17 Progressive components. Complete Conformant processors MUST support all. Core Conformant processors MUST substitute Core fallbacks. | Progressive components, fallback | Starting point for Progressive component catalog |
| S6.1 | Columns | Layout/Progressive. Explicit per-column widths. Props: `widths` (array of CSS values), `gap`. Fallback: Grid with columns=child count. | Columns, widths, fallback to Grid | Creating precise column layouts |
| S6.2 | Tabs | Layout/Progressive. Tabbed navigation. Props: `position` (top/bottom/left/right), `tabLabels`, `defaultTab`. All children stay mounted; switching tabs changes visibility, not lifecycle. Fallback: Stack + Heading per child. | Tabs, position, tabLabels, defaultTab | Building tabbed form sections |
| S6.3 | Accordion | Layout/Progressive. Collapsible section list. Props: `allowMultiple`, `defaultOpen`, `labels`. Bind OPTIONAL (repeatable group key -- each instance becomes one section). Fallback: Stack + Collapsible per child. | Accordion, allowMultiple, labels, mutual exclusion, repeatable group | Building accordion-style collapsible sections |
| S6.4 | RadioGroup | Input/Progressive. Radio buttons for choice fields. Props: `columns`, `orientation`. Compatible: choice. Fallback: Select. | RadioGroup, columns, orientation, fallback to Select | Showing all choice options simultaneously |
| S6.5 | MoneyInput | Input/Progressive. Currency-aware numeric input. Props: `currency` (ISO 4217), `showCurrency`, `locale`. Compatible: number, integer. Fallback: NumberInput. | MoneyInput, currency, ISO 4217, locale | Authoring currency/money fields |
| S6.6 | Slider | Input/Progressive. Range slider. Props: `min`, `max`, `step`, `showValue`, `showTicks`. Compatible: integer, number. Fallback: NumberInput. | Slider, min, max, step, showValue, showTicks | Authoring range-selection numeric fields |
| S6.7 | Rating | Input/Progressive. Star/icon rating. Props: `max`, `icon` (star/heart/circle), `allowHalf`. Compatible: integer. Fallback: NumberInput (min:1, step:1). | Rating, max, icon, allowHalf | Authoring satisfaction/rating fields |
| S6.8 | Signature | Input/Progressive. Drawn signature capture. Props: `strokeColor`, `height`, `penWidth`, `clearable`. Compatible: attachment. Fallback: FileUpload (accept: image/*). | Signature, strokeColor, penWidth, canvas | Capturing handwritten signatures |
| S6.9 | Alert | Display/Progressive. Status message banner. Props: `severity` (req: info/success/warning/error), `text` (req), `dismissible`. ARIA: role=alert for error/warning, role=status for info/success. Fallback: Text with `[Severity]` prefix. | Alert, severity, dismissible, ARIA roles | Displaying status/warning/error banners |
| S6.10 | Badge | Display/Progressive. Compact label badge. Props: `text` (req), `variant` (default/primary/success/warning/error). Fallback: Text. | Badge, text, variant | Displaying status tags or indicators |
| S6.11 | ProgressBar | Display/Progressive. Visual progress indicator. Props: `value`, `max`, `label`, `showPercent`. Bind OPTIONAL (reads bound value). Fallback: Text showing "X / Y (Z%)". | ProgressBar, value, max, showPercent, aria-valuenow | Displaying progress indicators |
| S6.12 | Summary | Display/Progressive. Key-value summary display for review pages. Props: `items` array (each has `label`, `bind`, optional `optionSet` for choice label resolution). Bind FORBIDDEN. Fallback: Stack of Text. | Summary, items, optionSet, review page | Building review/summary pages |
| S6.13 | ValidationSummary | Display/Progressive. Validation message panel surfacing current form validation state. Props: `source` (live/submit), `mode` (continuous/submit), `showFieldErrors`, `jumpLinks`, `dedupe`. When `jumpLinks` is true, renders clickable controls calling `focusField(path)`. Bind FORBIDDEN. Fallback: Alert per finding. | ValidationSummary, source, mode, jumpLinks, focusField, dedupe | Displaying validation summaries or building submission feedback |
| S6.14 | DataTable | Display/Progressive. Tabular repeatable group data. Props: `columns` (array of {header, bind}), `showRowNumbers`, `allowAdd`, `allowRemove`. Bind OPTIONAL (to repeatable group). Fallback: Stack of Card per instance. | DataTable, columns, repeatable group, allowAdd, allowRemove | Displaying/editing repeatable group data in table form |
| S6.15 | Panel | Container/Progressive. Side panel for supplementary content. Props: `position` (left/right), `title`, `width`. Fallback: Card. | Panel, position, width | Adding sidebar help or contextual content |
| S6.16 | Modal | Container/Progressive. Dialog overlay. Props: `title` (req), `size` (sm/md/lg/xl/full), `trigger` (button/auto), `triggerLabel`, `closable`. MUST trap focus, role=dialog, aria-modal. Fallback: Collapsible. | Modal, size, trigger, focus trap, aria-modal | Displaying content in modal dialogs |
| S6.17 | Popover | Container/Progressive. Anchored contextual overlay. Props: `triggerBind`, `triggerLabel`, `placement` (top/right/bottom/left). Fallback: Collapsible. | Popover, triggerBind, placement | Displaying contextual popover content |
| S6.18 | Fallback Requirements | Consolidated 17-row table of all Progressive-to-Core fallback substitutions. Five preservation rules: children, when, responsive, style, bind. Discarded props SHOULD emit warnings. | Fallback table, preservation rules | Implementing Core-conformant Progressive fallback |

### Custom Components (Lines 2492-2653)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S7 | Custom Components | Overview of the custom component mechanism: reusable subtrees with parameterized interpolation. | Custom components, templates, reuse | Creating reusable component patterns |
| S7.1 | The components Registry | Top-level `components` object. Templates have `params` (array of strings) and `tree` (required). Names MUST be PascalCase, MUST NOT collide with built-ins. `x-` prefix reserved for vendors. | components registry, params, tree, PascalCase naming | Defining custom component templates |
| S7.2 | {param} Interpolation Grammar (ABNF) | ABNF grammar for `{paramName}` interpolation in string props. Escape with `{{ }}`. No nesting. Allowed in: bind, when, text, title, placeholder, label, fallback. FORBIDDEN in: component, $token refs, numeric/boolean props, style. | {param} interpolation, ABNF, allowed/forbidden props | Authoring parameterized templates or debugging interpolation |
| S7.3 | Instantiation | Using custom components: set `component` to registry name, provide `params` object. Processor deep-clones template, replaces `{param}` refs, inserts resolved subtree. Extra params ignored with warning. Instance `when`/`style`/`responsive` merged onto resolved root. | Instantiation, params object, deep clone, merge | Using custom component instances in trees |
| S7.4 | Recursion Prohibition and Cycle Detection | Templates MUST NOT self-reference directly or indirectly. Processors MUST do static cycle detection via directed graph. Cyclic documents MUST be rejected. | Recursion prohibition, cycle detection, directed graph | Validating custom component dependency graphs |
| S7.5 | Depth Limits | Custom component nesting SHOULD NOT exceed 3 levels. Total tree depth SHOULD NOT exceed 20. Processors MUST NOT enforce limits below 3 custom / 10 total. | Depth limits, 3 custom, 20 total | Hitting depth limit errors |

### Conditional Rendering (Lines 2654-2741)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S8 | Conditional Rendering | Overview: `when` property enables show/hide based on data state without affecting data model. | Conditional rendering, when | Understanding conditional visibility |
| S8.1 | The when Property | FEL boolean expression. true=render, false/null/non-boolean=hide. OPTIONAL on all except ConditionalGroup (REQUIRED). Single `when` per component; use FEL `and`/`or` for compound conditions. | when, FEL boolean, single expression | Authoring conditional visibility rules |
| S8.2 | Distinction from Bind relevant | Critical distinction: `when` is visual-only (data preserved); `relevant` affects data model (may clear data per `nonRelevantBehavior`). When both apply: relevant=false always hides (takes precedence); relevant=true + when=false hides but preserves data. | when vs relevant, data preservation, precedence | Debugging why a component is hidden, or understanding data clearing behavior |
| S8.3 | FEL Evaluation Context | `$fieldKey` resolves to field value. `@index` and `@count` for repeat context. Standard FEL functions available. MUST NOT reference component props or presentation values. | $fieldKey, @index, @count, data-only context | Writing FEL expressions for `when` conditions |
| S8.4 | Error Handling | Malformed `when`: hide component (treat as false), emit warning, MUST NOT halt rendering. Missing key reference: evaluates to null, component hidden, SHOULD warn. | Error handling, graceful degradation | Debugging `when` expression failures |

### Responsive Design (Lines 2742-2856)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S9 | Responsive Design | Adaptive layouts from a single document via viewport-width breakpoints. | Responsive design, breakpoints | Implementing responsive form layouts |
| S9.1 | Breakpoints Declaration | Top-level `breakpoints` object: keys are names, values are min-width pixels. Same format as Theme Spec S6.4. Component Document breakpoints take precedence over Theme breakpoints. | breakpoints, min-width, precedence over Theme | Defining viewport breakpoints |
| S9.2 | The responsive Property | Breakpoint-keyed prop override objects on component nodes. MUST NOT override: component, bind, when, children, responsive (recursive). `style` MAY appear in overrides. | responsive, prop overrides, forbidden overrides | Adding responsive prop variants to components |
| S9.3 | Merge Semantics (mobile-first) | Mobile-first cascade: base props apply everywhere, then breakpoints merge in ascending min-width order. Shallow merge (not deep). Style override replaces entire style object. Resolution algorithm pseudocode provided. | Mobile-first, shallow merge, ascending order | Debugging responsive prop resolution |
| S9.4 | Structural Constraints | Responsive MUST NOT alter: component type, children array, bind. Only presentational props may vary. Ensures structurally stable tree across viewports. | Structural stability, no type switching, no children swap | Understanding why responsive children changes are rejected |

### Theming and Design Tokens (Lines 2857-2968)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S10 | Theming and Design Tokens | Token system for visual consistency, same format as Theme Spec S3. | Design tokens, $token references | Working with design tokens in Component Documents |
| S10.1 | The tokens Map | Flat key-value map. Keys are dot-delimited names, values are strings or numbers. No nested objects/arrays/booleans/null. Recommended prefixes: color., spacing., typography., border., elevation., x-. | tokens, flat map, dot-delimited keys | Defining design tokens |
| S10.2 | $token.path References | `$token.<key>` syntax in style objects and token-able props. MUST NOT be recursive (no token referencing another token). | $token.path, reference syntax | Using token references in component props |
| S10.3 | Cross-Tier Token Cascade | Priority: Tier 3 Component tokens > Tier 2 Theme tokens > Renderer defaults. Resolution: look up in Component, then Theme, then default. | Token cascade, Tier 3 > Tier 2 > defaults | Understanding token override behavior |
| S10.4 | Unresolved Token Handling | Unresolved tokens: use platform default, SHOULD warn, MUST NOT fail/halt. | Unresolved tokens, graceful fallback | Debugging missing token warnings |
| S10.5 | CSS Custom Property Emission (Web Renderers) | Web renderers SHOULD emit tokens as CSS custom properties: `--formspec-{key-with-dots-replaced-by-hyphens}`. Enables external CSS integration via `var(--formspec-*)`. Non-web renderers MAY ignore. | CSS custom properties, --formspec-*, bridge CSS, var() | Integrating formspec tokens with external stylesheets |

### Cross-Tier Interaction (Lines 2969-3051)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S11 | Cross-Tier Interaction | How Tier 3 interacts with Tier 2 (Themes) and Tier 1 (Definition hints). | Cross-tier, presentation stack | Understanding the full presentation pipeline |
| S11.1 | Tier 1 Fallback for Unbound Items | Unbound items fall back: Tier 2 Theme first, then Tier 1 Definition hints, then renderer defaults. Follows S4.5 rules. | Fallback chain, unbound items | Configuring fallback rendering for items not in the tree |
| S11.2 | Tier 2 Token Inheritance | Component Documents inherit Theme tokens. Common pattern: Theme defines design system, Component Document references without redeclaring. MAY override specific tokens. | Token inheritance, Theme as design system | Sharing tokens between Theme and Component Documents |
| S11.3 | Precedence: Tier 3 > Tier 2 > Tier 1 | General precedence table and specific interactions: widget selection, label display (Tier 1 always source of truth for labels), layout, tokens, behavioral rules (NEVER overridden by any presentation tier). | Precedence rules, behavioral rules immutable | Resolving conflicts between tiers |
| S11.4 | Partial Component Trees | Component Document need not bind every item. Partial trees bind a subset; remaining rendered via fallback. Renderer MUST: render tree first, identify unbound items, render unbound visible items after tree, ensure all required items editable. | Partial tree, incremental adoption | Building Component Documents that cover only key sections |

### Validation, Conformance, and Complexity Controls (Lines 3052-3226)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S12 | Validation and Conformance | Validation requirements and conformance criteria for processors. | Validation, conformance | Implementing or testing a processor |
| S12.1 | Structural Validation (JSON Schema) | 7 structural checks: required properties, type correctness, enum constraints, component names, children constraints, ConditionalGroup when, Heading props. MUST precede referential integrity. | JSON Schema validation, 7 checks | Building structural validators |
| S12.2 | Referential Integrity | 6 referential checks: bind keys exist in Definition, token references resolve, custom component references exist in registry, custom component params complete, Summary/DataTable bind refs valid, cycle-free custom components. | Referential integrity, 6 checks | Building referential validators |
| S12.3 | Compatibility Validation | Verify each Input's bound item has compatible dataType per S4.6 matrix. Incompatible bindings SHOULD be errors. | dataType compatibility, type checking | Validating bind/dataType matches |
| S12.4 | Conformance Levels: Core / Complete | Core: all 18 Core + fallbacks + custom + when + responsive + tokens + bind. Complete: all Core requirements + 17 Progressive native. | Core Conformant, Complete Conformant | Declaring or verifying processor conformance level |
| S13 | Complexity Controls | Intentional constraints for predictability, portability, implementation ease. | Complexity controls, excluded features | Understanding why a feature is missing or forbidden |
| S13.1 | Excluded Features | 10 explicitly excluded features: imperative handlers, conditional type switching, recursive templates, computed props via FEL, slot projection, animation specs, server-side fetching, component inheritance, dynamic registration, deep responsive. | Excluded features, declarative constraint | Understanding design boundaries |
| S13.2 | Guard Rails | 8 guard rails: tree depth <=20, custom nesting <=3, single when, string-only params, no param in component type, flat tokens, editable uniqueness, static tree. | Guard rails, limits | Hitting processor limits or understanding constraints |
| S13.3 | Extension Mechanism | `x-` prefix for vendor extensions: custom component names, top-level properties, style keys, token prefixes. Extensions MUST NOT be required for Core/Progressive rendering. Absent/unsupported `x-` features MUST NOT cause failure. | x- prefix, vendor extensions | Adding proprietary extensions |

### Appendices (Lines 3227-3521)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| App A | Appendix A: Full Example -- Budget Form | INFORMATIVE. Complete Component Document: 3-page wizard with custom AddressBlock, responsive Grid, DataTable, MoneyInput, Summary, Alert, Signature, ConditionalGroup, tokens, cross-tier cascade. | Budget wizard, full example | Seeing a complete real-world Component Document |
| App B | Appendix B: Component Quick Reference | NORMATIVE. 35-row table: all built-in components with Category, Level, Children, Bind, Description. Includes DataTable and Accordion footnotes for repeatable group binding. | Quick reference, all 35 components | Quick lookup of component classification |
| App C | Appendix C: DataType <-> Component Compatibility | NORMATIVE. Matrix of 10 dataTypes x 12 Input components showing compatibility. Notes on Display components (compatible with all), MoneyInput, TextInput as universal fallback. | Compatibility matrix, dataType x component | Checking which components work with which dataTypes |

## Cross-References

| Referenced Spec | Reference Context |
|-----------------|-------------------|
| **Core Specification (spec.md)** | core S4.2 (Items), core S4.2.5 (presentation/widgetHint for Tier 1 hints), core S4.1.1 (formPresentation), core S4.1.2 (normative page mode processing for Wizard), core S5.6 (ValidationReport for validation error display), core S4 (Definition structure). Referenced throughout for behavioral rules (required, relevant, readOnly, constraint, calculate). |
| **Theme Specification (theme-spec.md)** | theme S2.2 (targetDefinition binding mechanism, identical), theme S3 (token format), theme S3.1 (token key-value format), theme S3.2 (recommended category prefixes), theme S3.3 (token reference syntax), theme S3.5 (x- token convention), theme S6.4 (breakpoints format). Referenced for Tier 2 cascade, token inheritance, fallback rendering. |
| **FEL Normative Grammar (fel-grammar.md)** | Used for `when` expressions (S8), `$fieldKey` path references, `@index`/`@count` repeat context variables. FEL scope explicitly limited to `when` conditions and display text interpolation. |
| **Locale Specification (locale spec)** | S3.1 references `$component.<id>.<prop>` keys in Locale Documents for localizable string properties. S3.6 enumerates addressable props per component. |
| **JSON Schema (component.schema.json)** | S2.1 generated table is canonical structural contract. S12.1 references schema for structural validation. |
| **RFC 2119** | Normative language interpretation. |
| **RFC 8259** | JSON syntax and data types. |
| **RFC 6901** | JSON Pointer syntax. |
| **RFC 3986** | URI syntax. |

## Key Schemas Defined

| Schema / Structure | Location | Description |
|-------------------|----------|-------------|
| **Component Document (top-level)** | S2.1, `component.schema.json` | Root JSON object with `$formspecComponent`, `version`, `targetDefinition`, `tree`, and optional `breakpoints`, `tokens`, `components`, `url`, `name`, `title`, `description`. |
| **TargetDefinition** | S2.2, `#/$defs/TargetDefinition` | Object with `url` (required URI) and `compatibleVersions` (optional semver range). |
| **AnyComponent** | S3.1, `#/$defs/AnyComponent` | Union of all component objects. Base properties: `component`, `id`, `bind`, `when`, `responsive`, `style`, `cssClass`, `accessibility`, `children`. |
| **AccessibilityBlock** | S3.5 | Object with optional `role`, `description`, `liveRegion` for ARIA overrides. |
| **Breakpoints** | S9.1, `#/$defs/Breakpoints` | Object mapping breakpoint names to min-width pixel values. |
| **Tokens** | S10.1, `#/$defs/Tokens` | Flat key-value map of design tokens (string or number values). |
| **Custom Component Template** | S7.1 | Object with `params` (array of strings) and `tree` (component object). |
| **Summary Item** | S6.12 | Object with `label` (string), `bind` (string), optional `optionSet` (string). |
| **DataTable Column** | S6.14 | Object with `header` (string) and `bind` (string). |
| **ValidationSummary** | S6.13 | Display component with `source`, `mode`, `showFieldErrors`, `jumpLinks`, `dedupe` props. |

## Component Quick Reference

| # | Component | Tier | Category | Purpose | Bind DataTypes |
|---|-----------|------|----------|---------|---------------|
| 1 | Page | Core | Layout | Top-level page/section container; wizard step | N/A (Forbidden) |
| 2 | Stack | Core | Layout | Flexbox vertical/horizontal stacking container | N/A (Forbidden) |
| 3 | Grid | Core | Layout | Multi-column grid layout with auto-wrapping | N/A (Forbidden) |
| 4 | [Reserved] | -- | -- | Wizard removed; use formPresentation.pageMode with Stack > Page | -- |
| 5 | Spacer | Core | Layout | Empty spacing leaf element | N/A (Forbidden) |
| 6 | TextInput | Core | Input | Single/multi-line text input | string, number*, date*, time*, dateTime* |
| 7 | NumberInput | Core | Input | Numeric input with optional stepper | integer, number |
| 8 | DatePicker | Core | Input | Date/datetime/time picker (mode by dataType) | date, dateTime, time |
| 9 | Select | Core | Input | Dropdown or combobox; optional multi-select (`multiple`) | choice, multiChoice |
| 10 | CheckboxGroup | Core | Input | Multi-select checkboxes from options | multiChoice |
| 11 | Toggle | Core | Input | Boolean on/off switch | boolean |
| 12 | FileUpload | Core | Input | File attachment upload control | attachment |
| 13 | Heading | Core | Display | Section heading h1-h6 | N/A (Forbidden) |
| 14 | Text | Core | Display | Static text or read-only bound value display | Any (Optional, read-only) |
| 15 | Divider | Core | Display | Horizontal rule separator | N/A (Forbidden) |
| 16 | SubmitButton | Core | Display | Form submission trigger button with pending state | N/A (Forbidden) |
| 17 | Card | Core | Container | Bordered surface grouping with title/subtitle | N/A (Forbidden) |
| 18 | Collapsible | Core | Container | Expandable/collapsible section with toggle | N/A (Forbidden) |
| 19 | ConditionalGroup | Core | Container | Condition-based visibility group (when REQUIRED) | N/A (Forbidden) |
| 20 | Columns | Progressive | Layout | Explicit per-column width layout (fallback: Grid) | N/A (Forbidden) |
| 21 | Tabs | Progressive | Layout | Tabbed navigation container (fallback: Stack+Heading) | N/A (Forbidden) |
| 22 | Accordion | Progressive | Layout | Collapsible section list (fallback: Stack+Collapsible) | Optional: repeatable group |
| 23 | RadioGroup | Progressive | Input | Radio button single-select (fallback: Select) | choice |
| 24 | MoneyInput | Progressive | Input | Currency-aware numeric input (fallback: NumberInput) | number, integer |
| 25 | Slider | Progressive | Input | Range slider control (fallback: NumberInput) | integer, number |
| 26 | Rating | Progressive | Input | Star/icon rating (fallback: NumberInput) | integer |
| 27 | Signature | Progressive | Input | Drawn signature capture (fallback: FileUpload) | attachment |
| 28 | Alert | Progressive | Display | Status message banner (fallback: Text with prefix) | N/A (Forbidden) |
| 29 | Badge | Progressive | Display | Compact label badge (fallback: Text) | N/A (Forbidden) |
| 30 | ProgressBar | Progressive | Display | Visual progress indicator (fallback: Text) | number, integer (Optional) |
| 31 | Summary | Progressive | Display | Key-value summary for review pages (fallback: Stack of Text) | N/A (Forbidden, uses items[].bind) |
| 32 | ValidationSummary | Progressive | Display | Live or submit validation message panel (fallback: Alert per finding) | N/A (Forbidden) |
| 33 | DataTable | Progressive | Display | Tabular repeatable group data (fallback: Stack of Card) | Repeatable group (Optional) |
| 34 | Panel | Progressive | Container | Side panel for supplementary content (fallback: Card) | N/A (Forbidden) |
| 35 | Modal | Progressive | Container | Dialog overlay with focus trap (fallback: Collapsible) | N/A (Forbidden) |
| 36 | Popover | Progressive | Container | Anchored contextual overlay (fallback: Collapsible) | N/A (Forbidden) |

\* TextInput lists number/date/time/dateTime as compatible "as text" in S5.6, meaning it can serve as a text-mode fallback but is not the primary component for those types.

## Critical Behavioral Rules

These are the non-obvious rules that frequently trip up implementers:

1. **Behavioral rules are NEVER overridden by presentation tiers.** `required`, `readOnly`, `relevant`, `constraint`, and `calculate` from the Definition ALWAYS apply regardless of what the Component Document specifies (S1.2, S11.3).

2. **`when` vs `relevant` precedence and data semantics.** `relevant=false` ALWAYS hides the component regardless of `when`. `when=false` hides visually but PRESERVES data (unlike `relevant` which MAY clear data per `nonRelevantBehavior`). This is the most common source of confusion (S8.2).

3. **ConditionalGroup's `when` is REQUIRED, not optional.** Unlike the optional `when` on other components, ConditionalGroup MUST have a `when` expression. Documents without it MUST be rejected (S5.18).

4. **ConditionalGroup hidden children RETAIN data.** Unlike Bind `relevant` which may remove data, ConditionalGroup hides visually only -- data values are preserved (S5.18).

5. **Collapsible collapsed children remain in the DOM.** Bound data is preserved, and `relevant`/`when` state continues to be evaluated even when collapsed (S5.17).

6. **Editable binding uniqueness.** At most ONE editable Input component per item key. Multiple read-only Display components MAY bind the same key. Violating this MUST be rejected or warned (S4.3).

7. **`bind` supports flat keys AND dotted qualified paths.** Two forms: `"projectName"` (flat key) or `"applicantInfo.orgName"` (dotted path to nested child). NOT a JSON Pointer or FEL expression (S4.1).

8. **Only DataTable and Accordion may bind repeatable groups.** Other layout/container components MUST NOT bind to repeatable groups. This is enforced as a rejection (S4.4).

9. **Wizard component was removed.** Section 5.4 is [Reserved]. Wizard-style navigation is now `formPresentation.pageMode: "wizard"` with a `Stack > Page*` tree structure. See Core S4.1.2 (S5.4).

10. **Responsive overrides MUST NOT change structure.** Cannot alter `component` type, `children` array, `bind`, or `when`. Only presentational props may vary (S9.4).

11. **Responsive merge is shallow, not deep.** A `style` override at a breakpoint replaces the entire style object, not individual keys within it (S9.3).

12. **Mobile-first cascade.** Base props apply to all widths. Breakpoint overrides merge in ascending min-width order. This means the smallest breakpoint's overrides apply to all widths above it unless overridden by a larger breakpoint (S9.3).

13. **Component Document breakpoints override Theme breakpoints** when both are present for the same Definition (S9.1).

14. **Token references MUST NOT be recursive.** A token value MUST NOT itself contain a `$token.` reference (S10.2).

15. **Token cascade: Tier 3 > Tier 2 > Renderer defaults.** Component Document tokens override Theme tokens of the same key (S10.3).

16. **Custom component param interpolation is FORBIDDEN in `component` type, numeric/boolean props, `$token.*` references, and `style`.** Only allowed in string props like `bind`, `when`, `text`, `title`, `placeholder`, `label`, `fallback` (S7.2).

17. **Custom component param values MUST be strings.** No objects, arrays, numbers, or booleans (S13.2).

18. **Custom component recursion is statically prohibited.** Processors MUST build a directed graph and check for cycles at validation time, regardless of runtime parameter values (S7.4).

19. **Fallback substitution MUST preserve `when`, `responsive`, `style`, `bind`, and `children`.** Props without equivalents on the fallback MUST be discarded with a warning (S6.18).

20. **Unbound required items MUST be rendered.** Renderer MUST append fallback inputs for required unbound items after the tree output, in Definition document order (S4.5).

21. **Structural validation MUST precede referential integrity checks** (S12.1).

22. **Processors MUST ignore unrecognized properties** on component objects for forward compatibility (S3.1). But unrecognized top-level properties that don't start with `x-` MUST be rejected (S2.1).

23. **`when` error handling: hide, warn, continue.** Malformed expressions default to hiding the component. Missing key references evaluate to null (falsy). Neither case halts rendering (S8.4).

24. **Summary `optionSet` resolution.** When `optionSet` is set on a Summary item, the renderer MUST look up the raw bound value in the named option set and display the matching label, not the raw value (S6.12).

25. **DataTable is categorized as Display, not Container.** Despite having `bind` and rendering interactive add/remove controls, it does not accept `children` in the component tree sense (S6.14).

26. **Layout/Container bind rules differ.** Layout components: bind FORBIDDEN. Container components: bind FORBIDDEN (except DataTable which is actually Display, and Accordion which is Layout). If present on Layout/Container, MUST ignore and warn (S4.2).

27. **Depth limits are soft ceilings with hard floors.** Tree depth SHOULD NOT exceed 20 (processors MAY reject). Custom nesting SHOULD NOT exceed 3. But processors MUST NOT enforce limits below 10 total / 3 custom (S7.5, S13.2).

28. **`cssClass` values MAY contain `$token.` references.** This is easy to miss -- token references work in class names, not just style objects (S3.1).

29. **`id` MUST be unique across the entire component tree document.** Collision at validation time is an error. At runtime, collision is a warning and first occurrence wins. Repeat template nodes share the same `id` across all instances (S3.1).

30. **Select `multiple` is required for `multiChoice` dataType.** Using Select without `multiple` on `multiChoice` is incompatible with the stored value type (array vs scalar) (S4.6).

31. **SubmitButton dispatches `formspec-submit` CustomEvent** when `emitEvent` is true. It uses the `mode` prop to control which validation pass (continuous/submit) produces the report. During pending state, shows `pendingLabel` and disables unless `disableWhenPending` is false (S5.19).

32. **Web renderers SHOULD emit tokens as CSS custom properties.** Convention: `--formspec-{key-with-dots-replaced-by-hyphens}`. Enables external CSS to use `var(--formspec-*)` for bridge stylesheets (S10.5).
