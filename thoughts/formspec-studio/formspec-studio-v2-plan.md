# Formspec Studio V2 Core Plan — Definition + Presentation + Extensions

V1 treated `definition`, `component`, `theme`, `mapping`, `registry`, `changelog` as peer "tabs". That was the wrong mental model: authors experience a *single form* whose structure, presentation, mappings, and provenance are interdependent.

V2 keeps the same four-zone workspace (sidebar, tree, preview, properties/diagnostics) but changes what the sidebar means and where the "other artifacts" live:
- **Definition + Theme + Component are one composite editing surface** (no separate "Component" or "Theme" screens).
- **Mapping and Changelog are sidecars**: always reachable, mostly shown inline at the field level, with global inspectors for the full set.
- **Registry is not a section**: registries are imported as *extension catalogs* that enhance authoring (data types, functions, constraints), not edited as primary artifacts.
- **Schemas in `schemas/` are the source of truth**. Every document type is validated against its schema (AJV) and the runtime engines are used for semantic diagnostics where applicable.

---

## Hard Constraints

1. **Packages-first (no monkeypatching):** if behavior must exist (definition assembly, mapping execution, effective-presentation computation, extension hooks), it belongs in `packages/` (typically `packages/formspec-engine` or `packages/formspec-webcomponent`). Studio (`form-builder/`) is a UI layer over those packages.
2. **Low/no-code for non-technical authors:** guided controls are the default and must cover the common path. Raw JSON remains available only as an "Advanced" escape hatch, never the primary workflow.
3. **Reuse-first:** do not reimplement FEL parsing/execution, validation semantics, mapping semantics, or render behavior in Studio. Add/extend APIs in packages and consume them.

---

## Product Principle: "iOS Feel, Android Flexibility"

Studio should feel automagical and polished by default, while still allowing deep customization when needed:

- **Guided-first:** the default UI should be sufficient for common work without JSON or FEL.
- **Always modifiable:** every generated artifact is editable (Advanced JSON/FEL), and Studio must not "fight" manual edits.
- **Explain the effective result:** show "effective widget / effective rule" and which layer produced it (Definition vs Theme vs Component).
- **Degrade gracefully:** when a user makes an Advanced edit that the guided UI cannot model, mark the section as "Custom" and fall back to showing the raw source (with a "Reset to guided" option).
- **No surprises:** guided actions always create schema-valid documents; validation errors are actionable and navigable.

---

## Delivery Method: Red/Green/Refactor (TDD + Fowler-Style Refactoring)

V2 is primarily a **refactor and reframe** of an already-working V1/V1.5 Studio. Treat changes as a sequence of small, reversible steps with a safety net:

1. **Characterization tests first (protect existing behavior):**
   - Before any structural refactor (state shape, sidebar, properties), write tests that describe what the current UI does.
   - Prefer “black box” tests (Playwright or component-level tests) for workflows that users care about.

2. **Red/Green/Refactor loop:**
   - **Red:** write a failing test for the next thin slice.
   - **Green:** implement the simplest change to pass.
   - **Refactor:** improve structure/names/abstractions while keeping tests green.

3. **Strangler Fig approach for UI changes:**
   - Add new composite sections and drawers **alongside** existing code paths behind flags/toggles.
   - Migrate one workflow at a time; delete old paths only after tests cover the replacement.

4. **Keep the build green:**
   - Never land a refactor without tests that prove equivalence or intentional behavior change.
   - If you must change behavior, update tests first (explicitly).

### Test Pyramid (Where Tests Live)

Use the lowest-level test that gives confidence:

- **Package unit/contract tests**
  - `packages/formspec-engine/tests/*.test.mjs` (Node `--test`)
  - `packages/formspec-webcomponent/tests/*.test.ts` (Vitest + happy-dom)
  - Goal: semantics are correct without Studio.

- **Studio unit/integration tests**
  - `form-builder/src/__tests__/*.test.tsx` (Vitest + happy-dom)
  - Goal: composite property editing + document I/O + state transitions.

- **E2E workflow tests**
  - `tests/e2e/playwright/studio/*.spec.ts` (Playwright)
  - Goal: “non-technical author can do X” flows stay stable.

### Testing Rules of Thumb

- Test “automagic” behavior explicitly:
  - generation (theme overrides, component baseline, semantic enforcement binds) is deterministic
  - manual edits don’t get clobbered by guided UI
  - “Custom” fallback states appear when expected
- Add regression tests for any bug you fix (classic TDD ratchet).
- Prefer deterministic inputs:
  - fixed time provider/seed where relevant
  - stable snapshots for exported JSON (sorted/pretty where needed)

---

## Known Gaps (Must Be Resolved In Packages)

Schemas are the source of truth, but today there are mismatches between `schemas/*` and `packages/*` types/behavior. V2 depends on resolving these in `packages/` so Studio can stay a UI layer:

1. **Definition authoring model vs schema:** `schemas/definition.schema.json` models behavior primarily via top-level `binds[]` and `shapes[]`. `packages/formspec-engine` currently also supports item-level `relevant/required/readonly/calculate/constraint/message` fields. Decide on the schema-valid canonical representation and make engine/webcomponent accept it without Studio “translating” semantics ad-hoc.
2. **Data type naming alignment:** `schemas/definition.schema.json` uses `decimal`; component schema and engine code currently refer to `number` in places. Align the names and compatibility mapping in packages (and keep Studio’s guided UI consistent with schemas).
3. **Widget prop typing vs theme `widgetConfig`:** theme widget configuration is intentionally untyped in schema. Studio should drive guided controls from `schemas/component.schema.json`, but the validation/mapping rules for how those props get applied must live in packages.

---

## Target Author

A **program officer or grants manager** who:
- Understands their form's business requirements (what fields, what validation rules, what output format)
- Has no JSON/CSS/FEL literacy and should never need it for the common path
- Needs to see what they're building as they build it (preview is not optional)
- Manages multiple output mappings (e.g., same form -> internal DB, federal reporting system, CSV export)

### Primary Workflows (must be fully guided, zero JSON)

1. **Build a form**: add groups, add fields, set labels/types/options, set required/readonly, reorder via drag-and-drop.
2. **Validate and constrain input**:
   - Guided semantic rules (required/readonly/relevant/calculate, constraints, cross-field rules) authored as schema-valid definition constructs.
   - Guided widget constraints (min/max, minDate/maxDate, step, etc) driven by `schemas/component.schema.json` for the selected widget.
   - **Enforcement:** any widget constraint configured in the UI also generates semantic enforcement in the Definition (binds/shapes), so data is validated consistently across renderers and exports.
3. **Style the form**: pick a theme, adjust per-field presentation (widget choice, layout hints), see changes in preview immediately.
4. **Import/Export (core)**: load/save definition + optional theme/component + imported extension catalogs.

Mappings and changelog/history are planned as sidecars: see [`formspec-studio-v2-sidecars.md`](formspec-studio-v2-sidecars.md).

### Power-User Escape Hatches (always available, never required)

- Raw JSON editor for any document (definition, theme, component, mapping)
- FEL expression editor with autocomplete (for calculate/constraint/relevant)
- Direct component document editing for advanced layout control

---

## Document Model

A project always contains:
- **1 active Definition version** (editable) — structure + behavior (schema-valid definition primitives).
- **0+ immutable prior Definition versions** (read-only) — for review/diff/history anchoring.
- **1 Theme** (nullable) — presentation tokens/selectors/per-item overrides.
- **1 Component document** (nullable) — optional layout tree / platform-specific presentation.
- **N imported registries** — extension catalogs (data types, functions, constraints).

Sidecars (planned separately): mappings + changelogs. See [`formspec-studio-v2-sidecars.md`](formspec-studio-v2-sidecars.md).

### Identity rules (no invented schema fields)

Because schemas are strict (many are `additionalProperties: false`), Studio should not "add ids" into documents unless allowed by schema. Use these identities:
- **Definition**: `${definition.url}|${definition.version}`
- **Theme**: `${theme.url}|${theme.version}` when `url` exists, else project filename
- **Component**: `${component.url}|${component.version}` when `url` exists, else filename
- **Mapping**: filename (mapping schema has no `url`)
- **Changelog**: `${definitionUrl}|${fromVersion}->${toVersion}` (and/or filename)
- **Registry**: filename (display publisher+published)

---

## V2 Workspace Model

### Sidebar: from "artifact tabs" to "inspectors"

The tree + preview remain centered on the active definition. The sidebar becomes *tooling drawers* (toggle open/closed) rather than mutually-exclusive artifact editors:
- **Project**: identity, versions (active + immutable), imports/exports, files.
- **Extensions**: imported registries and extension catalog browser.
- **Mappings** (sidecar): see [`formspec-studio-v2-sidecars.md`](formspec-studio-v2-sidecars.md).
- **History** (sidecar): see [`formspec-studio-v2-sidecars.md`](formspec-studio-v2-sidecars.md).

No sidebar entry for "Component", "Theme", or "Registry".

### Properties Panel: composite sections

Properties becomes a single scroll surface with collapsible sections, all contextual to the selection:

For a **Field**:
- Identity / Data / Behavior / Validation (Definition schema fields)
- **Presentation (Composite)**:
  - "Effective widget" (computed from the 3-tier cascade)
  - Theme overrides (Tier 2) — guided controls
  - Component overrides (Tier 3, if enabled) — guided controls
  - Inline hints (Tier 1) still editable, but visually demoted
- **Mappings / History (Inline, sidecars)**:
  - Reserved space for mapping rules + per-field history summaries (implemented per sidecars plan).

For a **Group**:
- Group props (label, relevant, repeatable, min/max repeat)
- Layout hints (pages/sections) and presentation summary

For **Root**:
- Definition identity and lifecycle: `url`, `version`, `status`, `derivedFrom`
- Theme/component toggle (enable/disable, with guided creation)
- Version management (create new version from current)

### Preview: composite rendering

Preview renders using:
- The definition
- The theme (if present)
- The component document (if present)

Preview must display what the author is actually building. If component/theme are absent, preview uses renderer defaults + definition Tier 1 hints. If present, they apply as Tier 2/3.

---

## Composite Presentation Model (Definition + Theme + Component)

Presentation is a 3-tier cascade:
1. Tier 1: `definition.formPresentation` + `item.presentation` (inline hints)
2. Tier 2: Theme (`schemas/theme.schema.json`)
3. Tier 3: Component document (`schemas/component.schema.json`)

V2 UI must show:
- **Effective value** (what the renderer will do)
- **Source layer** (which tier produced it)
- A single-click way to create an override at the chosen layer

### Practical authoring strategy

1. **Default path**: authors edit Theme (Tier 2) for most presentation needs (widget choice, per-field overrides, selectors, tokens). Guided controls — no JSON required.
2. **Component is opt-in**: enable a component document when layout/widget needs exceed Theme. Studio auto-generates a baseline component tree from the definition, then authors refine it through guided controls.
3. **Always keep JSON fallback** for Theme and Component as an "Advanced" foldout inside the composite presentation section, not a separate screen.

### Minimal viable component editing (first pass)

Start with:
- An "Enable component overrides" toggle on Root
- A generated component tree that mirrors the definition structure using a conservative layout primitive (e.g., `Stack` + `Page` or `Wizard` based on `definition.formPresentation.pageMode`)
- Field-level widget override by swapping the bound component type (e.g., `TextInput` -> `Select`) with schema-validated props via dropdown

Iterate toward richer layout editing (dragging fields into pages/grids) once the underlying model is stable.

---

## Where Widget Constraints Live (Min/Max, Date Ranges, Step)

Guided widget constraints are defined by the widget/component schema (e.g., `NumberInput.min/max`, `DatePicker.minDate/maxDate`), but **do not require a component document** to exist:

- Default: write widget selection + props into the Theme (Tier 2) as per-item overrides (`theme.items[fieldKey]` with `widget`/`widgetConfig`).
- If a Component document is enabled and explicitly overrides that field (Tier 3), it can supersede the Theme for that field’s widget/props.

Studio should always present a single “effective widget” view (with source tier), regardless of storage layer.

### Semantic Enforcement (Required)

Widget constraints are not just UI hints: Studio must also generate definition-level validation so the constraints are enforced even if:
- a different renderer is used
- the theme/component is removed
- responses are validated server-side

Implementation approach (guided UI):
- Maintain constraints as structured rows/chips in the UI (e.g., Min, Max, Date range, Step).
- Compile them into schema-valid Definition constructs (typically `binds[].constraint` + `constraintMessage`), combining with any existing custom constraints via logical AND.
- Always guard optional values so required validation remains the single source of "missing value" errors:
  - Use a pattern like `not present($) or <constraint>`.

Examples (illustrative, not exhaustive):
- `NumberInput.min = 1` -> bind constraint: `not present($) or $ >= 1`
- `NumberInput.max = 100` -> bind constraint: `not present($) or $ <= 100`
- `DatePicker.minDate = '2025-01-01'` -> `not present($) or dateDiff($, '2025-01-01', 'days') >= 0`
- `DatePicker.maxDate = '2025-12-31'` -> `not present($) or dateDiff($, '2025-12-31', 'days') <= 0`
- `step = 0.01` (decimal) -> `not present($) or abs(($ / 0.01) - round($ / 0.01)) < 0.0000001`

Diagnostics:
- Warn when a widget constraint exists without a corresponding semantic constraint (or vice versa), and offer "Fix" actions (generate missing layer) so it stays automagical but modifiable.

---

## Registries as Imported Extension Catalogs

Registries (per `schemas/registry.schema.json`) are imported as catalogs, not edited.

Extensions drawer:
- Import registry JSON files
- Browse entries by category (dataType/function/constraint/property/namespace)
- Enable/disable catalogs

Authoring integrations:
- Field Data Type dropdown shows registry "dataType" entries as presets
- FEL autocomplete merges registry "function" entries
- Diagnostics warn on unrecognized extension keys

---

## Validation & Diagnostics

Validation passes:
- Schema validation (AJV) for every loaded document type
- Semantic validation: `FormEngine` validation report for the definition
- Cross-document: theme/component reference valid field paths; extension keys are recognized (or warned)

Diagnostics UX:
- Keep existing Diagnostics tab
- Add filtering by document type (Definition / Presentation / Mapping / History)

Blocking rules:
- Definition schema/engine errors block export
- Theme/component/mapping errors block only bundle exports that include them
- Missing registries are warnings, never blocking

---

## Import/Export

Import types:
- Single definition JSON (simple)
- Multi-file upload (definition + optional sidecars)
- ZIP bundle (preserve unknown files)

Export profiles:
- Definition-only: just the definition JSON
- Core bundle: definition + theme + component + registries (optional)

Sidecar bundling (mappings/changelogs) is specified in [`formspec-studio-v2-sidecars.md`](formspec-studio-v2-sidecars.md).

---

## Implementation Phases

### Phase 1: Composite Properties + Sidebar Restructure

- Remove "Component/Theme/Mapping/Registry/Changelog" as editor tabs
- Sidebar becomes drawers: Project, Mappings, History, Extensions
- Properties panel adds composite sections (Presentation, Mappings, History) — initially showing "no theme loaded" / "no mappings" / "no changelogs" with action buttons to create or import
- Import/export updated to handle: active definition + optional theme/component + imported registries
- Tests (red/green/refactor):
  - Add Playwright “smoke” coverage for: open Studio, add field, edit label, preview updates.
  - Add unit tests around sidebar/drawer state transitions and properties-section rendering.

Milestone: The app edits definitions as before, but the UI model matches V2. Authors see where presentation/mapping/history controls *will* live.

### Phase 2: Composite Presentation Editing

- Theme editing inline: guided controls for tokens, selectors, per-field overrides
- Component opt-in: generate baseline, field-level widget swaps
- "Effective value" display showing which tier produced each presentation decision
- Preview renders with active theme + component
- Tests (red/green/refactor):
  - Webcomponent tests for theme cascade + widget selection precedence (Tier 1 vs Theme vs Component).
  - Studio tests: setting a widget constraint updates Theme *and* generates semantic enforcement in Definition.
  - E2E: select field → change widget → preview changes → diagnostics remain navigable.

Milestone: Selecting a field lets you change widget appearance and immediately see it in preview, without leaving the definition workflow.

### Phase 3: Mapping Inline Editing + Global Inspector
Moved to sidecars plan: [`formspec-studio-v2-sidecars.md`](formspec-studio-v2-sidecars.md).

---

## Acceptance Criteria

1. No separate Component/Theme tabs; presentation editing happens in context of selecting items
2. A non-technical author can build a form, style it, and add validation without ever seeing JSON
3. Preview always reflects what the author is building (definition + active theme + active component)
4. Registries are importable and improve authoring, without being a primary "artifact" mode
5. JSON editors remain available as "Advanced" escape hatches for every document type
6. Widget constraints configured in the UI are enforced semantically in the Definition (not just in the widget layer)

Sidecar acceptance criteria live in [`formspec-studio-v2-sidecars.md`](formspec-studio-v2-sidecars.md).
