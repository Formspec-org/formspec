# ADR 0055: Consolidate Studio Semantic Authoring into the Editor Workspace

**Status:** Proposed
**Date:** 2026-03-30

## Context

Formspec Studio currently exposes semantic authoring concerns across three separate top-level workspaces:

- `Editor` for the definition tree and per-item details
- `Logic` for variables, binds, and shapes
- `Data` for response schema, option sets, data sources, and engine simulation

This split mirrors implementation and schema domains more than the user's mental model. Formspec Studio's primary audience is non-technical form managers — people who think "I need a required field that shows when checkbox X is checked" and "this dropdown should pull from a shared list of states." They do not think in terms of binds, shapes, or data sources. From their perspective, these are all part of the same job: defining what the form collects, how it behaves, and what shared resources it uses.

The current three-workspace split creates several UX problems:

1. **Semantic work is fragmented across tabs.** Editing a field, then its logic, then its option set requires bouncing between `Editor`, `Logic`, and `Data`. The same bind can be edited in `Logic` (global inventory) or `Editor` (inline on the field) — two paths to the same mutation with different UX.
2. **The right rail duplicates inline editing.** The `EditorPropertiesPanel` shows identity, field config, options, and behavior rules for the selected field. But these are the same properties available on the tree row. The rail is a second editing surface for the same data, splitting the user's attention without adding capability.
3. **The right rail shows no consequences.** It focuses on deeper configuration but does not show what the definition produces — no output path, no validation state, no response shape. The user has no persistent feedback about whether their form is correct.
4. **Workspace vocabulary is developer-oriented.** "Logic," "Data," "Behavior," and "Model" are meaningful to specification authors and developers, not to the county government employee building a grant application form.

At the same time, `Layout`, `Theme`, and `Preview` suggest a cleaner high-level separation that aligns with the Formspec tier model:

- **Editor** — Tier 1: definition internals (items, binds, shapes, variables, option sets, instances, screener, migrations, extensions)
- **Layout** — Tier 3 sidecar: component documents, visual composition
- **Theme** — Tier 2 sidecar: design tokens, selector cascade, styling policy
- **Preview** — rendered UI preview

This workspace-per-document-boundary alignment is natural. The definition document contains structure, behavior, and shared data assets. The component and theme documents are external sidecars. The workspace split should follow the same seam.

## Decision

Studio will consolidate Tier 1 semantic authoring into the existing `Editor` workspace, organized around a Build/Manage toggle, inline tree editing, and a persistent Form Health panel.

### Top-Level Workspace Boundary

The top-level workspaces are:

- `Editor` — semantic and business authoring (all definition-document concerns)
- `Layout` — composition and component arrangement (component documents)
- `Theme` — visual tokens, selectors, and styling policy (theme documents)
- `Mapping` — import/export transforms
- `Preview` — rendered UI preview only

`Logic` and `Data` stop existing as first-class top-level workspaces and are absorbed into `Editor`.

### Editor Internal Structure

The Editor workspace has three panels:

```
┌─────────────┬──────────────────────────────┬──────────────────┐
│  Blueprint  │  [ Build | Manage ]          │  Form Health     │
│  (nav)      │                              │                  │
│             │  Build: definition tree      │  Issues panel    │
│  Structure  │    with inline editing       │  (warnings,      │
│  Variables  │    (expand field in-place     │   errors,        │
│  Option Sets│     for all properties)      │   suggestions)   │
│  Data Srcs  │                              │                  │
│  Screener   │  Manage: shared resources    │  ──────────────  │
│  ...        │    (option sets, variables,  │  Response        │
│             │     data sources, screener,  │  inspector       │
│             │     binds index, shapes)     │  (collapsible)   │
│             │                              │                  │
│             │                              │  Simulation      │
│             │                              │  (collapsible)   │
└─────────────┴──────────────────────────────┴──────────────────┘
```

#### Build View (Default)

The primary authoring surface. The definition tree with full inline field editing.

Selecting a field expands it in-place to show its properties. No separate properties panel. The tree row becomes the detail surface.

This is where the form manager spends 95% of their time. The interaction model matches form builders users already know (Google Forms, Typeform): click a field, it opens up, edit everything right there, click another field.

Editing follows a **inline-for-common, modal-for-complex** pattern to keep the tree scannable:

- **Inline** (directly in the expanded row): label, hint, type, required/readonly toggles, simple relevance/constraint expressions, short inline option lists, presentation hints
- **Modal/popover** (anchored to the row, opened on demand): option set table editor with many rows, long FEL expressions with autocomplete, data source configuration, multi-property editors

The principle is one focal point — modals and popovers are still initiated from and anchored to the field row, not a persistent side panel. Complex sub-editors get the space they need without bloating the tree.

Build view includes:

- definition tree with drag-to-reorder and grouping
- add/reorder/group/wrap flows
- inline editing for identity, content, type, options, behavior rules
- item selection with in-place expansion
- modal/popover sub-editors for complex controls (option tables, FEL editor, data source config)
- Tier 1 presentation hints (`widgetHint`, `layout`, `styleHints`, `accessibility`) — visually distinguished as advisory, since the spec allows renderers to override them

Behavior rules (binds) are co-located with their target items. This is semantically natural — the spec separates items from binds at the document level for layering reasons (Core spec S2.3 AD-02), but binds target items by path, creating a natural one-to-one relationship. The Manage view provides the complementary cross-cutting perspective.

#### Manage View

The shared resource management surface. This is where authors go to create and edit the definition-level assets that fields reference — and to get a cross-cutting view of logic across the form.

Manage view is a scrollable page with section anchors, containing:

- **Option sets** — shared choice lists (CRUD, table editing)
- **Variables** — named computed values (name + FEL expression pairs)
- **Data sources / instances** — external data references
- **Screener / routes** — routing mechanism with its own items, binds, and ordered routes
- **Binds inventory** — global index of all field-level behavior rules, filterable by type (required, relevant, calculate, constraint, readonly, pre-populate). Jump-to-owner navigation back into the Build tree
- **Shapes** — cross-field validation rules with composition operators

The framing is action-oriented: "manage my form's shared resources" and "see all my logic in one place." It is not an audit or inspection surface — it is where you go when you need to create an option set, add a variable, configure screener routing, or answer "which fields have calculate expressions?"

Blueprint sidebar sections become scroll-to anchors into the Manage view's content.

#### No Properties Panel in Editor

The current `EditorPropertiesPanel` (right rail editing surface) is removed from the Editor workspace. All field editing moves inline into the Build tree.

The right rail in the Editor workspace is repurposed as the Form Health panel (see below). Properties panels remain in workspaces where they serve a genuinely different concern:

- **Layout** — `ComponentProperties` panel for presentation/component configuration
- **Theme** — token editing, selector configuration

### Form Health Panel (Right Rail)

The Editor right rail becomes a persistent consequence and quality feedback surface. It answers the question every form manager is actually asking: **"Is my form ready to publish?"**

The panel has three sections, ordered by relevance to non-technical users:

#### Issues (Default, Top)

A linter-style list of warnings, errors, and suggestions grouped by severity. Examples:

- "3 fields have no labels"
- "Required field inside a conditional group that can be hidden"
- "Screener route creates a dead-end path"
- "Option set 'states' is defined but not referenced by any field"
- "Calculate expression references undefined variable"

When a field is selected in the Build tree, the issues panel highlights issues relevant to that field. Issues are clickable — selecting one navigates to the affected field in the Build tree or the relevant section in the Manage view.

#### Response Inspector (Collapsible, Middle)

A tree view of the response structure — output paths, types, and cardinality. NOT raw JSON by default. When a field is selected in the Build tree, the corresponding output node highlights.

This section is collapsed by default. Non-technical users rarely need it; technical users and integration developers expand it when needed. A toggle switches between the structured tree view and raw JSON for users who prefer it.

#### Simulation (Collapsible, Bottom)

Seed test values, run the engine, and inspect runtime state. This section surfaces the processing model's intermediate states that the Response and ValidationReport do not capture:

- **Per-field MIP states**: current `relevant`, `required`, and `readonly` values — the computed booleans that determine field visibility, obligation, and editability
- **Variable values**: current resolved values of all named computed variables
- **Validation report**: constraint violations, shape failures, required-but-empty errors
- **Response output**: the actual JSON response with calculated values populated

This gives form managers human-readable feedback ("Field X is currently hidden because [condition]") and gives technical users the raw debugging state they need.

### Blueprint Responsibilities

Blueprint remains a flat, single-level navigator. It does not become a mode selector or a two-level hierarchy.

Blueprint shows the same sections regardless of whether Build or Manage is active:

- Structure (field count)
- Variables (count)
- Option Sets (count)
- Data Sources (count)
- Screener (route count)

Clicking a Blueprint section:

- In **Build view**: if the section is tree-relevant (Structure), scrolls the tree. If the section is a Manage concern (Option Sets, Variables, Data Sources, Screener), auto-switches to Manage view and scrolls to that section. The segmented control in the header updates visibly so the view switch is never hidden.
- In **Manage view**: scrolls to the corresponding section anchor

Blueprint owns:

- navigation and scroll-to
- aggregation counts
- quick-create entry points (add field, add option set, add variable)
- jump links between Build and Manage

Blueprint does not own editing surfaces.

### Boundary Between Editor and Preview

- `Editor` (Form Health panel): data, validation, response structure, runtime MIP states, variable values
- `Preview` (top-level workspace): rendered form UI, viewport-specific rendering, visual interaction behavior

`Editor`'s Form Health panel answers "is my form definition correct?"
`Preview` answers "what does the rendered form look like?"

### Build/Manage Toggle

The toggle between Build and Manage is a segmented control in the Editor workspace header, above the center content area. Two choices. No jargon. The user's mental model is: **"Am I building my form or managing its shared resources?"**

State requirements:

- The active view (`build` or `manage`) persists across top-level workspace switches — navigating to Layout and back to Editor returns to the last active view
- Each view preserves its own scroll position and filter state independently
- The Form Health panel is visible in both views — it is not affected by the toggle

## Consequences

### Product Consequences

- Semantic authoring becomes one workspace instead of three.
- Top-level navigation reduces from 7 tabs to 5. Internal navigation is one binary toggle.
- The total number of navigational destinations drops from 7 to 6 (5 tabs + 1 toggle), with a simpler mental model.
- Non-technical users get persistent quality feedback (Form Health) without needing to seek it out.
- The distinction between semantic authoring (Editor) and visual authoring (Layout/Theme) follows the spec's tier model.

### Interaction Consequences

- Field editing stays fast and contextual — inline expansion in the Build tree keeps the user in one focal point.
- The right rail earns its screen real estate by showing consequences (health, output, simulation) instead of duplicating editing controls.
- Form managers get a "ready to publish?" signal without switching workspaces.
- Manage view gives authors an action-oriented reason to visit shared resources — "I need to add an option set" — instead of an inspection-oriented one.
- Blueprint scroll-sync with the center tree is critical — the sidebar is the user's persistent mental map during inline editing. Expanding a field pushes siblings off-screen; the Blueprint must always show where you are.

### Implementation Consequences

- Header tabs remove `Logic` and `Data`.
- `EditorPropertiesPanel` is removed from the Editor workspace. Its sections (Identity, Content, FieldConfig, Options, BindsInline) migrate into the inline tree expansion component.
- Editor shell state adds:
  - `activeEditorView: 'build' | 'manage'` — persisted across workspace switches
  - Per-view scroll position and filter state (hoisted to Shell or a dedicated context)
- Current `LogicTab` components (`VariablesSection`, `BindsSection`, `ShapesSection`, `FilterBar`) move into the Manage view compositor.
- Current `DataTab` components split:
  - `OptionSets`, `DataSources` → Manage view
  - `ResponseSchema` → Form Health panel (Response Inspector section)
  - `TestResponse` → Form Health panel (Simulation section)
- Form Health panel is a new component combining:
  - Issues: definition linter/health checker (new, backed by engine and static analysis)
  - Response Inspector: adapted from `ResponseSchema`
  - Simulation: adapted from `TestResponse`, extended with MIP state display and variable value display
- `formspec:navigate-workspace` event payloads extend to support `{ tab: 'Editor', view: 'manage', section?: string }` for cross-workspace deep navigation.
- Screener/routes need a section in the Manage view and a Blueprint sidebar entry.

### Accessibility Consequences

- The Build/Manage segmented control must use proper `role="radiogroup"` / `role="radio"` semantics with arrow key navigation, or equivalent ARIA pattern.
- Inline tree expansion must manage focus: expanding a field should move focus into the expanded detail region; collapsing should return focus to the field row.
- The Form Health issues panel should use `role="log"` or `aria-live="polite"` for dynamic issue updates as the author edits.
- Blueprint scroll-sync must not steal focus — visual synchronization only.
- Compact/mobile layout: the Build/Manage toggle fits naturally as a segmented control or paired buttons above the content area. The Form Health panel becomes a slide-up sheet or bottom drawer, toggled by a persistent "health" indicator badge. The Blueprint sidebar becomes a slide-out drawer, as it already is in compact mode.

## Rejected Alternatives

### Keep `Editor`, `Logic`, and `Data` as Separate Top-Level Workspaces

Rejected because it preserves the current fragmentation and keeps semantic authoring split across multiple top-level destinations.

### Four Internal Editor Modes (Structure / Behavior / Model / Verify)

An earlier revision proposed four named modes inside the Editor workspace, with Blueprint as a two-level mode selector and the right rail as a tabbed inspection panel with Structure/Model/Verify tabs.

Rejected for three reasons:

1. **Reorganizes complexity instead of reducing it.** Navigational destinations increase from 7 to 8 (5 tabs + 4 modes - 1 overlap). The user trades "which of 7 tabs?" for "which of 5 tabs, then which of 4 modes?"
2. **Developer vocabulary.** "Behavior," "Model," and "Verify" are meaningful to specification authors, not to form managers. A county employee building a grant application form will never think "I need to go to Model mode."
3. **State explosion.** Four modes + Blueprint subsections + right-rail tabs + selection = four new state dimensions. Each dimension is a potential "where am I?" moment for non-technical users.

### Tabbed Right Rail (Structure / Model / Verify Tabs)

Rejected because it creates a combinatorial state matrix (4 modes x 3 rail tabs = 12 possible states) and competes with Blueprint for the user's navigation attention. It also conflicts with the existing right rail's editing controls — either those move out (breaking change) or the "inspection" framing is misleading.

### Right Rail as Response Structure + Simulation Only

An intermediate proposal put the response JSON tree and simulation in the right rail. Rejected because response structure is developer tooling — non-technical form managers don't think "what data does my form produce?" They think "did I build this correctly?" The Form Health framing (issues first, response inspector secondary) serves both audiences.

### Move All Model Editing into Blueprint

Rejected because Blueprint is too narrow and navigation-oriented to serve as the primary editing surface for option set tables, data source configuration, or other multi-property asset editors.

### Merge Verify into Preview

Rejected because rendered UI preview and semantic runtime verification answer different questions and should remain separate.

## Follow-On Work

1. Design and implement inline tree expansion component — promote `EditorPropertiesPanel` sections into an expandable detail region within `ItemRow` / `GroupNode`.
2. Build the Form Health panel — issues/linter engine, response inspector, simulation with MIP state display.
3. Build the Manage view compositor — merge `LogicTab` and `DataTab` content components into a single scrollable page with section anchors.
4. Add screener/routes section to the Manage view and Blueprint sidebar.
5. Add `activeEditorView` state to Shell with persistence across workspace switches.
6. Extend `formspec:navigate-workspace` event payloads to support `{ tab, view, section }`.
7. Implement Blueprint scroll-sync with the Build tree (highlight current position, restore scroll on collapse).
8. Remove `Logic` and `Data` from the `TABS` array in Header and `WORKSPACES` map in Shell.
9. Design compact/mobile layout for the Form Health panel (bottom drawer with health badge indicator).
10. Consider surfacing migrations and extension declarations in the Manage view for forms that use them.
