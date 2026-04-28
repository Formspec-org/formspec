# PRD: Formspec Studio v2

> **Archived 2026-04-28.** Superseded by [`thoughts/studio/2026-04-28-prd-chatgpt-forms-ide.md`](../../studio/2026-04-28-prd-chatgpt-forms-ide.md), itself decomposed into ADRs [0082](../../adr/0082-lift-chat-session-above-studio.md)–[0087](../../adr/0087-ai-mutation-provenance-surface.md). Two specific posture inversions vs this PRD: (a) the proposed `Simple / Advanced` inspector toggle is replaced by ADR 0084's rename-without-hiding (the `advanced` boolean controls *depth*, not artifact visibility); (b) the implied `Chat | Edit | Preview` mode framing is replaced by ADR 0083's layout knobs (no top-level mode enum). Kept for historical context — do not cite as current direction.

> **This is a greenfield rewrite.** The previous form-builder (`feat/unified-component-tree-editor`) was a learning exercise. We are throwing away all of its code and starting from scratch. Nothing is carried forward — no components, no state management, no CSS, no file structure. What *is* carried forward: every lesson learned about what worked, what didn't, where the abstractions were wrong, and where the spec's complexity actually lives. This PRD encodes those lessons into a new design.

## 1. Vision

Formspec Studio is a form builder that feels like typing in Notion and designing in Figma — but produces enterprise-grade form specifications.

A new user adds their first field by typing `/` on a blank page. A power user configures cross-field validation shapes with composable logic. A developer exports bidirectional mapping rules to an HL7 endpoint. All three are using the same tool, on the same screen, with the same interface. The complexity they see depends entirely on how deep they reach.

Formspec has ~373 configurable properties across 6 schema documents. The Studio's job is to make the first 40 feel like writing a note, reveal the next 110 through natural exploration, and provide clean access to the remaining 223 without ever making the simple path feel heavy.

---

## 2. Design Language

### 2.1. Document-First, Not Canvas-First

The primary editing experience is a live document — not a widget palette, not a tree view, not an empty canvas with a sidebar. You open the Studio and see your form. You type into it. You click things to edit them. The form *is* the editor.

This is the Tally/Notion insight: a blank page with a blinking cursor is the lowest-friction starting point that exists. Slash commands turn that blank page into a structured form without switching contexts.

The canvas/inspector model (Figma/Webflow) exists as a *layer underneath* — available when you need multi-column layout, responsive breakpoints, or structural tree navigation. But it's never the first thing you see.

### 2.2. Selection Drives Everything

Nothing appears until you select something. The right panel is empty (or hidden) until you click a field. Then it shows exactly the properties relevant to *that* field — grouped by frequency of use, with advanced sections collapsed.

Different selections show different panels:

- Select a text field → label, placeholder, required toggle, validation
- Select a choice field → label, options editor, required toggle, validation
- Select a section → title, collapse behavior, repeat settings
- Select a page → title, description, navigation rules
- Select nothing → form-level settings (metadata, brand, publishing)

This is Figma's core insight: the inspector adapts to context. There is no master list of all properties. You only see what matters right now.

### 2.3. Three Ways to Do Everything

Every action is accessible through at least three channels:

1. **Direct manipulation** — click, drag, inline edit on the form surface
2. **Command palette** — `Cmd+K` fuzzy search for any action, field, or setting
3. **Keyboard shortcuts** — discoverable via contextual menus and the command palette

Beginners click. Intermediates discover shortcuts via right-click menus (which display the shortcut next to each action). Experts never touch the mouse. No separate "power user mode" — the same interface serves all skill levels simultaneously.

### 2.4. Progressive Disclosure Is Five Patterns Composed

No single pattern handles the range from "add a text field" to "configure bidirectional XML mapping rules." The Studio uses five patterns together:

| Pattern | Where It Appears |
|---|---|
| **Smart defaults** | New fields are pre-configured: type inferred, key derived, component selected, bind wired. Zero-configuration state is always useful. |
| **Collapsed sections** | Inspector groups: Basic (expanded), Validation (collapsed), Behavior (collapsed), Layout (collapsed). Click to open. |
| **Hover-to-reveal** | Drag handles, delete buttons, add-between buttons appear on hover. The surface is clean until you reach for something. |
| **Mode switching** | "Simple / Advanced" toggle in the inspector header. Simple shows visual builders for conditions and calculations. Advanced shows raw FEL expressions and full property access. |
| **Contextual surfacing** | Logic badges appear on fields that have conditions (`?`), calculations (`=`), or validation (`!`) — visible at a glance, clickable to edit. You learn about capabilities by seeing them on other fields. |

### 2.5. One Form, Five Documents

The Formspec spec separates concerns into Definition, Component, Theme, Mapping, and Changelog. This is good architecture. It is invisible to the user.

The Studio presents one unified form with different *aspects* — structure, logic, style, integrations, versions — each accessible through natural interaction points, not tabbed document editors. The five JSON documents are generated, validated, and exported as implementation artifacts. They are never the primary editing model.

---

## 3. The Editing Experience

### 3.1. Starting: The Blank Page

Open the Studio. See a blank page with a title placeholder and a blinking cursor:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Untitled Form                                       │
│  Add a description...                                │
│                                                      │
│  Type / to add a field                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Or choose a template from the launcher: Contact Form, Survey, Registration, Grant Application. Templates populate the page with pre-built structure.

### 3.2. Adding Fields: Slash Commands

Type `/` anywhere to open the field picker — an inline, searchable menu:

```
┌─────────────────────────┐
│ 🔍 Search...            │
│                         │
│ COMMON                  │
│  ▸ Short Answer         │
│  ▸ Long Answer          │
│  ▸ Number               │
│  ▸ Email                │
│  ▸ Date                 │
│  ▸ Dropdown             │
│  ▸ Checkboxes           │
│  ▸ Yes / No             │
│  ▸ File Upload          │
│                         │
│ STRUCTURE               │
│  ▸ Section              │
│  ▸ Page Break           │
│  ▸ Repeating Group      │
│                         │
│ DISPLAY                 │
│  ▸ Heading              │
│  ▸ Instructions         │
│  ▸ Divider              │
│                         │
│ ADVANCED                │
│  ▸ Rating               │
│  ▸ Signature            │
│  ▸ Money                │
│  ▸ Slider               │
│  ▸ Data Table           │
│  ▸ More...              │
└─────────────────────────┘
```

Typing filters instantly: `/em` → Email, `/dat` → Date + Data Table. Arrow keys to navigate, Enter to insert. The field appears at the cursor position, label focused for immediate typing.

Between existing fields, a `+` button appears on hover — clicking it opens the same picker.

**What happens behind the scenes:** Each insert atomically creates:

- A Definition item (with `key` derived from the label, `dataType` from the field type)
- A Component node (type inferred: string → TextInput, choice → Select, boolean → Toggle, etc.)
- No Bind is created yet — Binds are created on-demand the first time logic is added (required toggle, show-when, calculate, constraint). This keeps simple forms clean: a 10-field form with no logic has zero binds.

The user never thinks about any of this.

### 3.3. Editing Fields: Inline + Inspector

**Inline editing (on the form surface):**

- Click a field's label to edit it in place
- Click a description to edit it in place
- For choice fields: click the options area to add/edit/reorder options inline (type a value, Enter to add another, drag to reorder)
- Required toggle is a small switch visible on each field's hover state

**Inspector panel (right side, appears on selection):**

Selecting a field opens the inspector with collapsible sections:

```
┌─────────────────────────────┐
│ ✕ Short Answer              │
│   Key: firstName             │
│                              │
│ ▾ BASICS                     │
│   Label     [First Name    ] │
│   Hint      [Enter your... ] │
│   Required  [━━●            ]│
│     └ When... (click to add) │
│   Placeholder [Type here.. ] │
│                              │
│ ▸ LOGIC                      │
│ ▸ VALIDATION                 │
│ ▸ APPEARANCE                 │
│ ▸ ADVANCED                   │
└─────────────────────────────┘
```

Collapsed sections show a summary pill when they have content:

```
│ ▸ LOGIC          ? Show when │
│ ▸ VALIDATION     ! Required  │
```

This tells you at a glance what's configured without opening the section.

### 3.4. Logic: Visual Builders → Expression Escape Hatch

Every logic property follows the same pattern: a visual builder is the default, with a toggle to raw FEL for power users.

**"Show when" (relevant):**

```
┌─────────────────────────────────────────┐
│ SHOW THIS FIELD WHEN                    │
│                                         │
│  [Budget Type ▼] [equals ▼] [Detailed] │
│                                  + AND  │
│                                  + OR   │
│                                         │
│  ⟨/⟩ Edit as expression                │
└─────────────────────────────────────────┘
```

The field picker dropdown lists all fields in the form by label, grouped by section. Operators adapt to the field type: text fields get "equals / contains / starts with / is empty", numbers get "equals / greater than / less than / between", booleans get "is true / is false".

Clicking "Edit as expression" toggles to:

```
┌─────────────────────────────────────────┐
│ SHOW THIS FIELD WHEN          ⟨visual⟩  │
│                                         │
│  $budgetType = 'detailed'               │
│  ──────────────────────────             │
│  ✓ Valid expression                     │
└─────────────────────────────────────────┘
```

The expression editor has `$path` autocomplete (type `$` to see all fields), function signatures on hover, and live validation. The toggle goes both ways — if the expression is simple enough, switching to visual mode parses it back into the builder.

**"Calculate" (calculate):**

```
┌─────────────────────────────────────────┐
│ CALCULATE VALUE                         │
│                                         │
│  [Sum ▼] of [Line Amount ▼]            │
│               in [Budget Items ▼]       │
│                                         │
│  Templates: Sum  Count  Average  Custom │
│                                         │
│  ⟨/⟩ Edit as expression                │
└─────────────────────────────────────────┘
```

Common calculation patterns (sum a repeated field, count instances, concatenate text, date arithmetic) are one-click templates. "Custom" opens the expression editor.

**"Required when", "Read-only when":** Same visual builder as "Show when", just with different labels.

**"Constraint" (field validation):**

```
┌─────────────────────────────────────────┐
│ VALIDATION RULE                         │
│                                         │
│  This value [must be ▼] [at least 0]   │
│                                         │
│  Error message:                         │
│  [Budget amount cannot be negative    ] │
│                                         │
│  ⟨/⟩ Edit as expression                │
└─────────────────────────────────────────┘
```

The "This value" label represents the bare `$` token in FEL — the current field's own value. Constraint operators: "must be at least / at most / between / one of / matching pattern / not empty / before date / after date." These cover 90% of field validation without FEL.

Toggling to expression mode shows: `$ > 0` — where `$` is the field's value. This is distinct from shape constraints which use `$fieldName` paths.

**Form rules (shapes):**

Accessible from the form-level inspector (select nothing, or click "Form Rules" in the toolbar):

```
┌─────────────────────────────────────────┐
│ FORM RULES                      + Add   │
│                                         │
│ ⚠ Budget must balance                   │
│   Applies to: Entire form               │
│   Error if total expenses ≠ total budget│
│                                         │
│ ℹ Contact info recommended              │
│   Applies to: Entire form               │
│   Warning if no email and no phone      │
│                                         │
│ ✕ Personnel limit                       │
│   Applies to: Each budget line item     │
│   Error if personnel count > 50         │
└─────────────────────────────────────────┘
```

Clicking "+ Add" or expanding a rule shows:

```
┌─────────────────────────────────────────┐
│ EDIT RULE                               │
│                                         │
│  Name    [Budget must balance         ] │
│  Severity [Error ▼]                     │
│                                         │
│  Applies to:                            │
│  ● Entire form                          │
│  ○ Specific field [         ▼]          │
│  ○ Each instance of [       ▼]          │
│                                         │
│  Condition (must be TRUE to pass):      │
│  ┌─────────────────────────────────┐    │
│  │ [Total Budget ▼] [= ▼]         │    │
│  │                [Award Amount ▼] │    │
│  │                          + AND  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ▸ GROUP: Combine with other rules      │
│                                         │
│  Error message:                         │
│  [Total budget ({{$totalBudget}}) must ]│
│  [equal the award amount.             ] │
│                                         │
│  ⟨/⟩ Edit as expression                │
│  ▸ Advanced (timing, code, context)     │
└─────────────────────────────────────────┘
```

Key schema mappings:

- **Name** → auto-generates shape `id` (slugified: "Budget must balance" → `budget-must-balance`)
- **Applies to: Entire form** → shape `target: "#"` (the form root)
- **Applies to: Specific field** → shape `target: "fieldPath"` (single field)
- **Applies to: Each instance of** → shape `target: "group[*].field"` (wildcarded repeat path)
- **Condition** → shape `constraint` (FEL expression using `$fieldName` paths — unlike bind constraints which use bare `$`)
- **Group: Combine with other rules** → shape composition (`and`/`or`/`not`/`xone` referencing other shape IDs). Presented as checkboxes: "ALL of these must pass" (and), "ANY of these must pass" (or), "EXACTLY ONE must pass" (xone), "This must NOT pass" (not).
- **Error message** → shape `message`. Supports `{{expression}}` interpolation — type `{{` to insert a live value (e.g., `{{$totalBudget}}`).
- **Advanced** → `timing` (continuous/submit/demand), `code` (machine-readable), `context` (diagnostic data), `activeWhen` (conditional activation)

Behind the scenes: form rules generate Shape objects in the definition's `shapes[]` array. `$path` references auto-update when fields are renamed or moved. Composition references are managed by shape ID — renaming a rule updates all references.

### 3.5. Style: Brand Panel + Per-Field Overrides

**Form-level brand (accessible from toolbar or form-level selection):**

```
┌─────────────────────────────────────────┐
│ BRAND                                   │
│                                         │
│  Primary    [■ #1a73e8] [Pick ▼]       │
│  Secondary  [■ #f5f5f5] [Pick ▼]       │
│  Error      [■ #d93025] [Pick ▼]       │
│  Font       [Inter           ▼]         │
│                                         │
│ LAYOUT                                  │
│  Page mode   [Single ▼]                 │
│  Labels      [Top ▼]                    │
│  Density     [━━━●━━ Comfortable]       │
│  Currency    [USD ▼]                    │
│  Columns     [1 ▼]                      │
│                                         │
│ ▸ DESIGN TOKENS (12 tokens)             │
│ ▸ STYLE RULES (3 rules)                 │
│ ▸ CUSTOM CSS                            │
└─────────────────────────────────────────┘
```

Brand colors write to theme tokens. Layout settings write to `formPresentation` and theme defaults. The user is picking colors and fonts — the spec artifacts are generated underneath.

**Advanced (collapsed sections):**

- **Design Tokens**: full token vocabulary editor. For users who think in design systems: `color.primary`, `spacing.md`, `typography.body`, `border.radius`. Each token is a named value referenced by `$token.key` throughout the theme.
- **Style Rules**: theme selectors in plain language. "All date fields use compact style." "All required fields have a red asterisk." These generate theme `selectors` with `match` conditions.
- **Custom CSS**: raw stylesheet editor for complete visual control. Writes to theme `stylesheets`.

**Per-field styling (in the inspector's Appearance section):**

```
┌─────────────────────────────────────────┐
│ ▾ APPEARANCE                            │
│                                         │
│  Widget    [Dropdown ▼] → Radio         │
│  CSS Class [form-highlight            ] │
│                                         │
│  ▸ Inline Styles                        │
│  ▸ Responsive Overrides                 │
└─────────────────────────────────────────┘
```

Widget override: change how a field renders (e.g., choice → Radio instead of Select, boolean → Checkbox instead of Toggle). The component node's type updates; the definition doesn't change.

Responsive overrides: per-breakpoint property adjustments. This is gated behind the responsive toolbar (see §3.7).

### 3.6. Logic Badges: Seeing What's Smart

Fields with logic show small, color-coded badges directly on the form surface:

```
┌──────────────────────────────────────────┐
│                                          │
│  Organization Type  ●                    │
│  [Dropdown: Nonprofit / University / ...]│
│                                          │
│  Sub-type  ● ? =                         │
│  [Dropdown: ...]                         │
│  Shows when Organization Type is set     │
│                                          │
│  Budget Total  ● =                       │
│  [$45,000.00]                            │
│  Calculated: sum of line items           │
│                                          │
└──────────────────────────────────────────┘
```

Badge legend:

- `●` Required (always or conditional)
- `?` Conditional visibility (has `relevant` expression)
- `=` Calculated value (has `calculate` expression)
- `!` Has validation rule (has `constraint`)
- `🔒` Read-only (always or conditional)

Clicking a badge opens that specific logic section in the inspector. This makes the form's intelligence visible at a glance without cluttering the editing surface.

### 3.7. Responsive: The Viewport Slider

A draggable width handle on the preview (or a breakpoint bar in the toolbar):

```
┌──────────────────────────────────────────────────┐
│  📱 375    📱 768    💻 1024    🖥 1440           │
│  ──●─────────────────────────────────────        │
└──────────────────────────────────────────────────┘
```

Dragging the slider resizes the form preview in real-time. Named breakpoints snap at standard widths. When the slider is at a specific breakpoint, per-component responsive overrides can be set:

- Column count changes (3-column grid → single column on mobile)
- Visibility toggling (hide secondary info on mobile)
- Spacing adjustments

These write to Component `responsive` blocks. The user is "designing at this screen size" — the breakpoint JSON is generated.

### 3.8. Preview: Full-Fidelity Testing

The form preview is always available — either as a split pane or a full-screen toggle. It renders via `<formspec-render>` in an isolated iframe, using the same engine and components that will render the deployed form.

In preview mode, the form is fully interactive:

- Fill out fields, navigate wizard pages, trigger validation
- See calculated values update in real-time
- See conditional fields appear/disappear
- Submit the form and inspect the generated Response JSON

A diagnostics bar at the bottom shows live error/warning/info counts. Clicking opens the diagnostics panel — each diagnostic links back to its source field for one-click navigation.

### 3.9. Structure View: The Tree Layer

For complex forms (50+ fields, deep nesting, multiple pages), a collapsible tree panel on the left:

```
┌──────────────────────┐
│ 📋 STRUCTURE         │
│                      │
│ ▾ 📄 Page 1          │
│   ▾ 📦 Applicant Info│
│     ├ Abc Org Name   │
│     ├ ▼ Org Type     │
│     │  └ ▼ Sub-type ?│
│     └ 📧 Contact     │
│   ▾ 📦 Budget        │
│     ├ # Direct Costs │
│     ├ # Indirect  =  │
│     └ # Total     =  │
│ ▸ 📄 Page 2          │
│ ▸ 📄 Page 3          │
└──────────────────────┘
```

Icons indicate field types. Logic badges (`?` `=` `!` `🔒`) appear inline. Drag to reorder or reparent. Click to select (scrolls the form surface and opens the inspector).

This is the "canvas + inspector" model — but it's a secondary view, not the primary editing surface. For simple forms, this panel stays hidden.

### 3.10. Command Palette: Power User Entry Point

`Cmd+K` opens a fuzzy-search command palette:

```
┌─────────────────────────────────────────┐
│ 🔍 Type a command or search...          │
│                                         │
│ NAVIGATION                              │
│  Go to Page 2: Budget          ⌘G      │
│  Go to field: orgName          ⌘G      │
│                                         │
│ ACTIONS                                 │
│  Add field...                  /        │
│  Toggle preview               ⌘P       │
│  Toggle structure panel        ⌘\       │
│  Form rules...                          │
│  Form settings...                       │
│                                         │
│ ADVANCED                                │
│  Open JSON editor              ⌘⇧J     │
│  Validate against schema                │
│  Load extension registry...             │
│  Export form bundle...         ⌘E       │
└─────────────────────────────────────────┘
```

Fuzzy search across: field labels, field keys, page titles, commands, settings. Recent commands rank higher. Keyboard shortcuts displayed next to each entry for passive learning.

---

## 4. Advanced Workflows

These live behind explicit entry points — mode toggles, collapsed sections, command palette actions. They never clutter the simple path.

### 4.1. Variables: Named Calculations

For forms that need intermediate calculated values (like a spreadsheet's named cells):

Accessible from "Form Settings → Variables" or the command palette:

```
┌─────────────────────────────────────────┐
│ VARIABLES                       + Add   │
│                                         │
│  totalDirect   = sum($budget[*].amount) │
│  totalIndirect = $totalDirect * $rate   │
│  grandTotal    = $totalDirect +         │
│                  $totalIndirect          │
│                                         │
│  Used by: Budget Total, Summary Page    │
└─────────────────────────────────────────┘
```

Variables are named FEL expressions available to any field's logic. The Studio shows where each variable is referenced.

### 4.2. Repeating Groups: "Add Another" Sections

When adding a "Repeating Group" via `/`, the user gets a section that supports multiple instances:

```
┌──────────────────────────────────────────┐
│  Budget Line Items  (min 1, max 20)      │
│  ┌────────────────────────────────────┐  │
│  │ Item 1                             │  │
│  │  Description  [Personnel salaries] │  │
│  │  Amount       [$25,000.00        ] │  │
│  │  Category     [Direct ▼]          │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Item 2                             │  │
│  │  Description  [Equipment         ] │  │
│  │  Amount       [$15,000.00        ] │  │
│  │  Category     [Direct ▼]          │  │
│  └────────────────────────────────────┘  │
│                                          │
│             + Add Line Item              │
└──────────────────────────────────────────┘
```

The inspector for a repeating group shows: min/max instances, template fields (add/configure child fields), and display mode (Card per instance, or Data Table for many instances).

Fields inside repeating groups can reference other instances via FEL: `sum($budget[*].amount)`, `prev('amount')`, `@index`, `@count`.

### 4.3. Option Sets: Reusable Choice Lists

When the same options appear on multiple fields (US states, department codes, severity levels), the user can promote inline options to a shared Option Set:

Right-click options → "Make reusable" → name the set. Other choice fields can then reference it: "Use existing → [US States]".

Option Sets can also be sourced from a URL (dynamic options) or from secondary data instances.

### 4.4. Sub-Forms: Modular Composition ($ref)

For large form systems, groups can be imported from other definitions:

"Insert → Sub-form → [URL or file]" imports a definition fragment. The Studio resolves `$ref` references, rewrites FEL paths, handles key prefixing, and merges binds/shapes/variables. The imported fragment appears as a collapsible section on the form surface with a "linked" badge.

### 4.5. Data Integration: Mapping Editor

Accessible from "Form Settings → Integrations" or the command palette:

```
┌──────────────────────────────────────────────────────┐
│ DATA MAPPING: Export to Grants.gov         + Rule    │
│                                                      │
│ Direction: [Bidirectional ▼]  Format: [JSON ▼]       │
│                                                      │
│ ┌────────────┬──────────┬────────────┬─────────────┐ │
│ │ Form Field │ Target   │ Transform  │ Reversible  │ │
│ ├────────────┼──────────┼────────────┼─────────────┤ │
│ │ orgName    │ org.name │ preserve   │ ✓           │ │
│ │ orgType    │ org.code │ value map  │ ✓           │ │
│ │ budget[*]  │ costs[]  │ flatten    │ ✓           │ │
│ │ —          │ submDate │ = today()  │ ✗ (const)   │ │
│ └────────────┴──────────┴────────────┴─────────────┘ │
│                                                      │
│ Auto-map unmatched fields  [off]                     │
│ Test: [Upload sample JSON...] [Run round-trip test]  │
└──────────────────────────────────────────────────────┘
```

Each rule is a row in a table. Transform types: preserve (copy), value map (lookup table), expression (FEL), coerce (type conversion), flatten/nest (structure), constant, concat, split. Clicking a rule expands it for detailed configuration.

The round-trip test verifies bidirectional fidelity: forward-transform a sample response, then reverse-transform the result, and diff against the original.

This writes to a Mapping document — the user interacts with a table, not a 60-property JSON schema.

### 4.6. Extensions: Registry Loading

"Form Settings → Extensions" or the command palette:

```
┌─────────────────────────────────────────┐
│ EXTENSIONS                     + Add    │
│                                         │
│  formspec-common.registry.json          │
│   ├ SSN (data type)           stable    │
│   ├ fiscal-year (function)    stable    │
│   └ duns-valid (constraint)   depr.     │
│                                         │
│  [Paste registry URL...]               │
└─────────────────────────────────────────┘
```

Pasting a URL fetches the registry, displays its entries, and merges custom data types into the field picker, custom functions into FEL autocomplete, and custom constraints into the validation system.

### 4.7. Versioning & Publishing

"Form Settings → Version" or the command palette:

```
┌─────────────────────────────────────────┐
│ VERSION                                 │
│                                         │
│  Current: 1.2.0 (draft)                │
│  Last published: 1.1.0                  │
│                                         │
│ CHANGES SINCE 1.1.0                     │
│  + Added: indirectRate field   minor    │
│  ~ Modified: budget constraint compat.  │
│  - Removed: legacyField       BREAKING  │
│                                         │
│  Impact: MAJOR (breaking change)        │
│  Suggested version: 2.0.0              │
│                                         │
│  [Publish 2.0.0...]  [Export bundle...] │
└─────────────────────────────────────────┘
```

The diff is computed automatically from the edit history. Impact classification follows the Changelog spec rules (removing a field = breaking, adding an optional field = compatible, changing a label = cosmetic). Publishing bumps the version, generates a Changelog document, and bundles all artifacts.

### 4.8. JSON Editor: The Escape Hatch

`Cmd+Shift+J` or command palette → "Open JSON editor":

A split view showing the raw Definition, Component, and Theme JSON side by side (or tabbed). Edits in JSON propagate to the visual editor and vice versa. This is for developers who think in terms of the spec, or for pasting in externally-authored fragments.

---

## 5. The Complexity Map

How ~373 spec properties map to the Studio's interaction layers:

### Layer 0: Just Typing (~40 properties)

The slash-command and inline-editing surface. No panels needed.

`key`, `label`, `description`, `hint`, `dataType` (13 core types), `options` (value + label), `initialValue`, `children` (nesting), `repeatable`, `title`, `status`, `version`. Simple `required` toggle. Simple `relevant` toggle.

`formPresentation`: `pageMode` (single/wizard/tabs), `labelPosition` (top/start/hidden), `density` (compact/comfortable/spacious), `defaultCurrency` (ISO 4217 code for money fields).

**Interaction:** Type `/`, pick a type, type a label, toggle required. Done.

### Layer 1: Inspector Basics (~70 properties)

The expanded inspector sections, with visual builders.

Field logic: `relevant` (visual condition), `required` (visual condition), `calculate` (formula builder), `readonly` (visual condition), `constraint` + `constraintMessage` (visual validator).

Field config: `placeholder`, `precision`, `prefix`/`suffix`, `min`/`max`, `step`, `format`, `searchable`, `accept`, `maxSize`, `multiple`.

Layout: `formPresentation` (all 4 properties), `columns`, `gap`, `direction`.

Style: brand colors, fonts (→ theme tokens), `cssClass`, widget override.

Item-level presentation hints: `widgetHint` (override the default widget), `layout.flow` (stack/grid/inline), `layout.columns`, `layout.colSpan`, `layout.newRow`, `layout.page` (wizard step assignment).

**Interaction:** Click a field, open a section, use visual builders. Expression toggle for power users.

### Layer 2: Advanced Inspector (~40 properties)

Collapsed "Advanced" subsections within each inspector group.

Shapes: `target`, `severity`, `timing`, `activeWhen`, `code`, `context`, composition. Variables: `name`, `expression`, `scope`.

Item presentation (advanced): `labels` variants (short/pdf/csv/accessibility), `styleHints.emphasis`, `styleHints.size`, `accessibility.role`, `accessibility.description`, `accessibility.liveRegion`, `layout.collapsible`, `layout.collapsedByDefault`.

Bind fine-tuning: `default`, `nonRelevantBehavior`, `whitespace`, `excludedValue`, `disabledDisplay`.

Component config: `Wizard.showProgress`/`allowSkip`, `Collapsible.defaultOpen`, `DataTable` columns, `Tabs` configuration, `responsive` overrides.

**Interaction:** Click "Advanced" to expand. Raw FEL editing for expressions.

### Layer 3: Integrations & Lifecycle (~115 properties)

Behind "Form Settings" tabs — not on the main editing surface.

Mapping (~60): rules, transforms, coerce, valueMap, adapters, direction, reverse overrides.

Registry (~30): entries, categories, compatibility, parameters, lifecycle status.

Changelog (~18): changes, impact, migration hints.

**Interaction:** Dedicated panels with table-based editors and guided wizards.

### Layer 4: Developer Escape Hatches (~108 properties)

Behind JSON editor or mode toggle.

Definition internals: `$ref`, `instances`, `screener`, `migrations`, `extensions`, `derivedFrom`, `versionAlgorithm`.

Component internals: custom component templates, `params`, fallback declarations, accessibility blocks, `tokens`, `breakpoints`.

Theme internals: cascade rules, selector matching, platform hints.

**Interaction:** Raw JSON editing. Full spec access, zero abstraction.

---

## 6. What Exists Today

The current form-builder (branch: `feat/unified-component-tree-editor`) implements:

### Working

- Tree-based canvas with drag/drop
- 43 built-in components in add picker (4 categories)
- 8 inspector panels: root metadata, identity, data types, FEL behavior, validation, layout, shapes
- Atomic field creation/deletion (definition + bind + component wired together)
- Auto-generation of component tree from definition
- Registry loading with extension type discovery
- Live preview via `<formspec-render>`
- Diagnostics panel with navigation
- 4 starter templates, import/export

### Gaps (from this PRD)

- **No document-first editing.** The current UI is tree + inspector. Needs: inline editing on the form surface, slash commands, hover-to-reveal affordances.
- **No visual logic builders.** FEL expressions are raw text inputs. Needs: visual condition builder, formula templates, expression ↔ visual toggle.
- **No brand/style panel.** Form presentation editing exists (pageMode, density) but no color pickers, font selectors, or token management.
- **No responsive editing.** No breakpoint slider or per-component responsive overrides.
- **No command palette.** Exists as a stub (`command-bar.tsx`) but not wired.
- **No logic badges** on the form surface.
- **No mapping editor, version management, or extension browser UI.**

---

## 7. Technical Foundation

### 7.1. Stack

- **Framework:** Preact + Preact Signals
- **Language:** TypeScript (strict)
- **Build:** Vite
- **Validation:** Ajv (structural) + FormEngine (logical)
- **Styling:** Vanilla CSS

### 7.2. Core Packages

**`@formspec/formspec-engine`** — Reactive form state: field values, relevance, required, readonly, validation, repeats via Preact Signals. FEL compiler for expression parsing/evaluation. 4-phase processing model (Rebuild → Recalculate → Revalidate → Notify). Runs headless in the Studio for real-time diagnostics.

**`@formspec/formspec-layout`** — 5-level theme cascade resolution, `$token` reference resolution, responsive breakpoint merging, `LayoutNode` tree planning from Definition + Component + Theme inputs.

**`@formspec/formspec-webcomponent`** — `<formspec-render>` custom element. 37 built-in components. `globalRegistry` for extension injection. Renders in isolated iframe for preview fidelity.

### 7.3. State Model

Single `project` signal containing all artifacts. Focused mutation functions per aspect. Live `FormEngine` rebuilt on definition changes. Flat signals, no premature abstraction — new state modules extracted only when editing surfaces outgrow simple mutation functions.

### 7.4. Automatic Wiring

The user never manually connects artifacts:

- **Add** → definition item + component node created atomically. No bind yet (created on-demand when logic is added).
- **Delete** → component node, definition item, bind (if any), and any shapes targeting the field — all cleaned up.
- **Rename** → key updated in: definition item, bind path, component node `bind` property, all FEL `$path` references across binds/shapes/variables, shape composition references. This is the most complex operation.
- **Move** → component tree structure updated. If a field moves into/out of a group, its bind path changes (e.g., `amount` → `budget.amount`). All FEL references to the old path are rewritten. If it moves into/out of a repeating group, the `[*]` wildcard is added/removed from the bind path.
- **Repeat toggle** → when a group becomes repeatable, all descendant bind paths gain `[*]` (e.g., `group.field` → `group[*].field`). FEL references to those fields are rewritten to include `[*]` where appropriate (e.g., `$group.field` → `$group[*].field` in aggregate contexts, or adjusted per usage).

### 7.5. Validation Pipeline

Two layers, continuous:

1. **Structural** — Ajv against all JSON schemas on every state change
2. **Logical** — FormEngine evaluates FEL expressions and validates constraints/shapes

Diagnostics surface in a bottom bar with counts and a clickable detail panel.

### 7.6. Preview Isolation

`<formspec-render>` in an iframe. Theme CSS and Studio CSS cannot cross-contaminate. Preview behaves identically to deployed form.

---

## 8. Delivery Phases

### Phase 1: The Google Forms Moment

Transform the current tree+inspector into a document-first experience:

- Slash commands for field insertion
- Inline label/description/option editing on the form surface
- Visual condition builder for "show when" and "required when"
- Formula templates for calculated fields
- Logic badges on fields
- Brand panel (colors, fonts → theme tokens)
- Command palette (wired and populated)
- Hover-to-reveal affordances (drag handles, add-between, delete)

**Exit criteria:** A non-technical user can build a multi-page form with conditional logic, calculated fields, and custom branding — without seeing FEL syntax, JSON, or the word "definition."

### Phase 2: The Power User Toolkit

- Full FEL expression editor with `$path` autocomplete and live validation
- Guided form rule builder (shapes) with visual composition
- Responsive breakpoint slider and per-component overrides
- Widget override selector in appearance section
- Theme selector rules ("all date fields use compact style")
- Design token editor
- Variables panel
- Data Table configuration for repeating groups

**Exit criteria:** A power user can build a form with cross-field validation, responsive layout, a complete design token system, and complex repeating sections with aggregate calculations.

### Phase 3: The Integration Platform

- CSV/JSON/XML export with guided mapping setup
- Full mapping rule editor (table-based)
- Extension registry browser and loader
- Version management: diff viewer, impact indicator, publish with changelog
- Migration generation for breaking changes
- Sub-form composition ($ref)
- JSON editor escape hatch with live sync

**Exit criteria:** An integrator can connect a form to external systems with bidirectional mapping, manage versioned releases with automated changelogs, and compose modular form systems from shared fragments.

---

## 9. Success Metrics

- **First form:** New user creates and previews a 10-field form in under 2 minutes.
- **No-code logic:** Conditional visibility and required rules set without typing expressions.
- **Schema parity:** Generated documents validate against all 6 Formspec schemas.
- **Preview fidelity:** Preview matches deployed rendering exactly (same engine, same components).
- **Full access:** Every one of the ~373 spec properties is reachable. Nothing is locked — just layered.
- **Velocity:** A 5-page wizard with conditional logic and cross-field validation: under 15 minutes (vs. hours of JSON editing).

---

## Appendix A: UI → Schema Mapping

How user-facing concepts map to the underlying Formspec schema structures. This is the implementer's bridge between what the user sees and what the Studio generates.

### A.1. Field Properties → Binds

The schema separates **structure** (Items) from **behavior** (Binds). Items define *what* exists; Binds define *how it behaves*. The Studio presents both as a single "field properties" panel.

| User Sees | Schema Location | Notes |
|---|---|---|
| Label, Description, Hint | `items[].label`, `.description`, `.hint` | Direct item properties |
| Key | `items[].key` | Auto-derived from label, editable |
| Data Type | `items[].dataType` | Item property (13 core types) |
| Options | `items[].options` or `items[].optionSet` | Item property |
| Placeholder | Component node property | Not in definition — component-level |
| **Required** (toggle) | `binds[].required: "true"` | Creates bind on-demand |
| **Required when** | `binds[].required: "<FEL>"` | Same bind property, conditional |
| **Show when** | `binds[].relevant: "<FEL>"` | Creates bind on-demand |
| **Calculate** | `binds[].calculate: "<FEL>"` | Implicitly makes field readonly |
| **Read-only when** | `binds[].readonly: "<FEL>"` | Creates bind on-demand |
| **Constraint** | `binds[].constraint: "<FEL>"` | Uses `$` for current field value |
| **Error message** | `binds[].constraintMessage` | Paired with constraint |
| Initial value | `items[].initialValue` | Item property, evaluated once |
| Re-relevance default | `binds[].default` | Bind property, applied on relevance transition |

**Bind lifecycle:**

1. Field created → no bind exists
2. User toggles Required ON → bind created: `{ path: "<fieldPath>", required: "true" }`
3. User adds Show When → same bind updated: `{ path: "<fieldPath>", required: "true", relevant: "<FEL>" }`
4. User removes all logic → bind deleted (garbage collected when all properties are empty)

**Bind path derivation** (automatic from tree position):

- Top-level field `firstName` → path: `firstName`
- Field `orgName` inside group `applicantInfo` → path: `applicantInfo.orgName`
- Field `amount` inside repeating group `lineItems` → path: `lineItems[*].amount`
- Nested: `budget.lineItems[*].description` → path: `budget.lineItems[*].description`

The `[*]` wildcard means the bind applies to ALL instances of the repeated field. When a user edits logic on a field inside a repeating group, they're configuring it once for all instances — the template, not a specific row.

### A.2. Form Rules → Shapes

Shapes are the schema's mechanism for cross-field and form-level validation. They live in `definition.shapes[]` and are independent of any single field.

| User Sees | Schema Property | Notes |
|---|---|---|
| Rule name | `shape.id` | Auto-slugified: "Budget must balance" → `budget-must-balance` |
| Applies to: Entire form | `shape.target: "#"` | Special root target |
| Applies to: Specific field | `shape.target: "fieldPath"` | Same path syntax as binds |
| Applies to: Each instance of | `shape.target: "group[*].field"` | Wildcarded for repeats |
| Severity | `shape.severity` | `error` (default) / `warning` / `info` |
| Condition (visual) | `shape.constraint` | FEL expression using `$fieldName` paths |
| Error message | `shape.message` | Supports `{{FEL}}` interpolation |
| Group: ALL must pass | `shape.and: [...]` | Array of shape IDs or inline FEL |
| Group: ANY must pass | `shape.or: [...]` | Array of shape IDs or inline FEL |
| Group: EXACTLY ONE | `shape.xone: [...]` | Array of shape IDs or inline FEL |
| Group: must NOT pass | `shape.not: "<id or FEL>"` | Single shape ID or inline FEL |
| Timing | `shape.timing` | `continuous` (default) / `submit` / `demand` |
| Active when | `shape.activeWhen` | FEL expression gating the whole shape |
| Error code | `shape.code` | Machine-readable (e.g., `BUDGET_MISMATCH`) |
| Context data | `shape.context` | Object of FEL expressions for diagnostics |

**Critical distinction — Bind constraint vs Shape constraint:**

- **Bind constraint** uses bare `$` → the field's own value: `$ > 0`, `length($) <= 500`
- **Shape constraint** uses `$path` → any field in the form: `$totalBudget = $awardAmount`

The visual builder must generate the correct reference style based on context. The "field validation" builder (in the field inspector) generates bind constraints with `$`. The "form rules" builder generates shape constraints with `$fieldName`.

**Composition model:**
Shape composition arrays can contain either shape IDs (references) or inline FEL boolean expressions. The visual builder uses inline expressions by default (simpler). When a user explicitly groups named rules, it generates shape ID references. Example:

Visual: "Budget must balance" AND "Date range valid"
→ `{ id: "budget-and-dates", target: "#", and: ["budget-must-balance", "date-range-valid"], message: "..." }`

Visual: "Amount > 0" AND "Amount < 1000000" (inline)
→ `{ id: "amount-range", target: "amount", and: ["$ > 0", "$ < 1000000"], message: "..." }`

### A.3. Visual Builder ↔ FEL Round-Trip

The toggle between visual builder and expression editor must handle round-tripping:

**Visual → FEL** (always works): The builder generates FEL from the UI state. A visual condition `[Budget Type] [equals] [Detailed]` generates `$budgetType = 'detailed'`. Multiple conditions with AND generate `$a = 'x' and $b > 5`.

**FEL → Visual** (works for simple expressions): The Studio parses the FEL and reconstructs the visual builder state IF the expression matches supported patterns:

- Binary comparison: `$field = 'value'`, `$field > 5`, `$field != null`
- Conjunction/disjunction: `expr1 and expr2`, `expr1 or expr2`
- Function calls: `empty($field)`, `contains($field, 'text')`, `matches($field, 'pattern')`

**FEL → Visual** (gracefully degrades): Complex expressions that don't fit visual patterns stay in expression mode. The toggle to visual shows "This expression is too complex for the visual builder" and keeps the expression editor active. The user can simplify or stay in expression mode.

This means: expressions authored in the visual builder can always round-trip. Expressions authored as raw FEL may not round-trip back to visual form. This is acceptable — the visual builder is the on-ramp, not a constraint.

### A.4. Required Toggle Lifecycle

The Required toggle in "Basics" and the conditional Required in "Logic" write to the same bind property. The state machine:

| UI State | Bind.required | Generated FEL |
|---|---|---|
| Toggle OFF (default) | property absent | (no bind or bind without required) |
| Toggle ON | `"true"` | Static required |
| Toggle ON + "When..." clicked | `"<FEL>"` | Conditional required |
| Toggle ON + "When..." set to visual condition | `"$field = 'value'"` | Conditional required |
| Toggle OFF (was conditional) | property removed | Bind cleaned up if empty |

The same pattern applies to Show When (relevant), Read-Only (readonly), and Calculate.

### A.5. Repeat Group Path Semantics

When a user configures logic on a field inside a repeating group, the bind targets ALL instances via `[*]`:

```
Group: lineItems (repeatable: true)
  └ Field: amount (dataType: decimal)

Bind path: lineItems[*].amount
```

**What this means for the UI:**

- The "required" toggle on `amount` means "required in every line item"
- A constraint `$ > 0` means "each amount must be positive"
- A calculate expression runs independently per instance
- `@index` and `@count` are available in expressions (1-based position, total instances)
- `prev('amount')` references the previous instance's amount
- `sum($lineItems[*].amount)` is valid outside the repeat (aggregates across all instances)

The visual builder shows these as field-level properties — the user doesn't see `[*]`. The wildcard path is derived automatically from the item's position in a repeating group.

### A.6. formPresentation → Style Panel

The `formPresentation` object lives on the Definition root. It provides form-wide presentation defaults (Tier 1 hints). The Studio maps these to the Style panel's Layout section:

| User Sees | Schema Property | Values | Default |
|---|---|---|---|
| Page mode | `formPresentation.pageMode` | `single` / `wizard` / `tabs` | `single` |
| Labels | `formPresentation.labelPosition` | `top` / `start` / `hidden` | `top` |
| Density | `formPresentation.density` | `compact` / `comfortable` / `spacious` | `comfortable` |
| Currency | `formPresentation.defaultCurrency` | ISO 4217 code (e.g., `USD`) | (none — user inputs currency per field) |

These are Tier 1 hints — advisory, not binding. They can be overridden by Theme (Tier 2) selectors/defaults and by Component (Tier 3) properties. The Studio always writes them to the Definition for portability, even though the theme cascade may override them.

**`defaultCurrency`** deserves special note: when set, ALL money fields in the form default to this currency. The MoneyInput widget pre-fills and locks the currency selector. This eliminates repetition for forms that only deal in one currency (the common case). Individual fields can override via `items[].currency`.

### A.7. Item-Level Presentation → Inspector Sections

Each item can carry a `presentation` object with advisory hints. These are Tier 1 — overridden by Theme and Component layers. The Studio surfaces them across inspector sections:

| User Sees | Schema Property | Where in Inspector |
|---|---|---|
| Widget override | `presentation.widgetHint` | Appearance section |
| Layout flow | `presentation.layout.flow` | Layout section (groups only) |
| Grid columns | `presentation.layout.columns` | Layout section (groups with `flow: grid`) |
| Column span | `presentation.layout.colSpan` | Layout section (items in a grid parent) |
| Force new row | `presentation.layout.newRow` | Layout section (items in a grid parent) |
| Collapsible | `presentation.layout.collapsible` | Layout section (groups only) |
| Start collapsed | `presentation.layout.collapsedByDefault` | Layout section (collapsible groups) |
| Wizard page | `presentation.layout.page` | Layout section (top-level groups in wizard mode) |
| Emphasis | `presentation.styleHints.emphasis` | Appearance → Advanced |
| Size | `presentation.styleHints.size` | Appearance → Advanced |
| A11y role | `presentation.accessibility.role` | Appearance → Advanced |
| A11y description | `presentation.accessibility.description` | Appearance → Advanced |
| A11y live region | `presentation.accessibility.liveRegion` | Appearance → Advanced |

Most of these have sensible defaults and are only surfaced when the user opens the relevant inspector section. The Studio generates `presentation` objects only for non-default values — keeping the output JSON clean.

**Presentation vs Component:** When a Component document exists, its properties take precedence over presentation hints. The Studio prefers writing to the Component tree (component type, style, responsive) and only falls back to `presentation` for definition-portable hints like `widgetHint` and `layout.page`.

### A.8. Items Without Binds

Not every item needs a bind. Items with no logic have no corresponding entry in `binds[]`:

| Item Type | Has Bind? | Why |
|---|---|---|
| Simple text field, no logic | No | Just captures text, no conditions |
| Required field | Yes | `required: "true"` |
| Conditionally visible field | Yes | `relevant: "<FEL>"` |
| Calculated field | Yes | `calculate: "<FEL>"`, implicitly readonly |
| Display item | No | No data, no behavior |
| Group (structural only) | No | Just a container |
| Group with conditional visibility | Yes | `relevant: "<FEL>"` on the group path |

A form with 10 simple fields and 3 required fields has exactly 3 binds. The Studio never shows empty binds.
