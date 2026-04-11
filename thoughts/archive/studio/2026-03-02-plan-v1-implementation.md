# Formspec Studio V1 — Definition-First, Reuse-First Plan

**Visual Design Spec:** [`formspec-studio-design-spec.md`](formspec-studio-design-spec.md) — colors, typography, layout, component catalog, accessibility, motion.

## Summary

Build `form-builder/` as a top-level monorepo app for no-code authoring of `definition.json`. The tool consumes `packages/formspec-engine` and `packages/formspec-webcomponent` as workspace dependencies — the same way any external consumer would. It is not an example or demo; it is a first-class tool.

Core principle: **reuse-first.** No new FEL parser, no custom semantic validator, no reimplementation of what FormEngine already does. The app is a UI layer over existing runtime components.

## Scope

1. **Primary:** Full no-code create / edit / validate / preview / export for `definition.json`.
2. **Secondary:** Create / edit / validate / export for `component`, `theme`, `mapping`, `registry`, `changelog`.
3. Secondary artifacts must never block the primary definition workflow.
4. Definition-only projects are first-class. All secondary artifacts are independently optional.
5. Runtime stack: Preact + `@preact/signals` (browser-only). No Python sidecar.

## Reuse-First Architecture

| Need | Source |
|------|--------|
| FEL parsing, bind logic, shape validation, screener, response serialization | `FormEngine` |
| Mapping preview | `RuntimeMappingEngine` |
| Live form preview, component/theme integration | `<formspec-render>` web component |
| Schema-level document validation | Repository `schemas/*.json` + AJV |
| Python parity checks (CI only) | `src/formspec` — `validator.lint`, `DefinitionEvaluator`, `MappingEngine` |

## UI Technology

Preact + `@preact/signals` for the application UI.

1. **Shared reactive primitive.** `formspec-engine` uses `@preact/signals-core` internally. Engine signals (field values, relevance, validation) drive UI updates directly — no adapter layer.
2. **Tiny footprint.** Preact is ~4KB gzipped. Component composition, JSX, reactive DOM updates with effectively zero bundle cost.
3. **Complexity warrants it.** Tree editor, property panel, live diagnostics, and multi-panel workspace are stateful interactive surfaces that would require an ad-hoc reactive system in vanilla JS.
4. **Not a framework commitment.** No router, no global store convention. Functions that return JSX, compiled by Vite.
5. **`<formspec-render>` stays a web component.** Preview panel mounts the existing custom element. Preact renders the builder UI; the preview is an isolated web component inside it.

## Workspace Layout

Four-zone collapsible workspace with side-by-side tree + preview as the default view.

```
┌──────────────────────────────────────────────────────────────────┐
│ Topbar (48px)                                                     │
├────┬────────────────────┬───────────────────┬────────────────────┤
│ ◆  │  Tree Editor        │  Live Preview     │  Properties       │
│ ◇  │  (structure)        │  (rendered form)  │  + Diagnostics    │
│ ◈  │                     │                   │                   │
│ ⬡  │  ← selection syncs →                   │  ← collapsible →  │
│ ▢  │                     │                   │                   │
│ ▤  │  Guided | JSON      │                   │  Props | Diags    │
└────┴────────────────────┴───────────────────┴────────────────────┘
```

**Sidebar:** ~48px icon-only by default. Tooltip labels on hover. Expand to ~180px on click. Contains artifact tabs (Definition, Component, Theme, Mapping, Registry, Changelog) with configured/unconfigured status.

**Tree + Preview:** Split the flex area with a resizable divider, default 50/50. Tree is the structural editing surface; preview shows the live rendered form via `<formspec-render>`. Selecting a node in either surface syncs the other.

**Properties + Diagnostics:** ~320px right panel, collapsible to zero via toggle button. Two tabs: Properties (context-sensitive for selected node) and Diagnostics (normalized validation results).

**Topbar:** Brand, form title (editable), version/status, import/export buttons.

**Responsive:**
- **1440+px:** All four zones visible, comfortable.
- **1280–1439px:** All visible. Properties starts collapsed.
- **1024–1279px:** Preview becomes a toggleable overlay or tab.
- **<1024px:** "Desktop required" message.

## Tree Editor

The tree is the primary structural editing surface. It must feel fast, scannable, and forgiving.

### Node anatomy

Each node shows: type dot (color-coded), label, data type badge, bind indicators. On hover: grab handle (for drag), action buttons (move up/down, delete), field key. On select: accent background, left border, properties panel populates.

### Smart inline add

Click between nodes to insert. A faint dashed line with "+" appears in the gap on hover. Clicking opens an inline creation row in place:

```
  ● Full Name           string  *
  ┌──────────────────────────────────────────────┐
  │ [Phone Number     ] [field ▾]  [↵]  [×]     │
  └──────────────────────────────────────────────┘
  ● Email Address       string
```

- Text input auto-focused for label. Key auto-derived (kebab-case).
- Type dropdown defaults to `field`. Options: `field`, `group`, `display`.
- Enter creates, Escape cancels. New node is selected after creation.
- Persistent `+ Add` affordance at the end of each group's children.

### Drag-and-drop reorder

- Grab handle (⠿ grip icon) appears on node hover, left edge.
- Drag vertically to reorder within the same parent.
- Drag into a group to reparent (group highlights with drop indicator).
- Drop position shown with a horizontal insertion line (accent color).
- Dragging a group moves it with all children.
- Up/down buttons remain as keyboard-accessible fallback.

### Selection sync

- Tree selection scrolls preview to that field and highlights it (subtle accent outline, fades after 1.5s).
- Clicking a field in preview selects the corresponding tree node and scrolls it into view.
- Either surface drives the Properties panel.

### Modes

- **Guided** (default): Tree editor.
- **JSON**: Raw textarea with apply/revert. Full schema authoring fallback for any artifact.

## Property Panel

Context-sensitive editor driven by tree/preview selection.

- **Empty state:** "Select an item to edit its properties."
- **Field selected:** Sections for Identity (key, label), Data (type, placeholder, options), Behavior (relevant, required, readonly, calculate), Validation (constraint, message). FEL inputs use monospace font.
- **Group selected:** Identity (key, label), Behavior (relevant, readonly), Repeat (min, max).
- **Root selected:** Form metadata (url, title, version, description).

## Data Model and I/O

1. `BuilderProject` contains independent artifact slots, each nullable except `definition`.
2. Minimal valid project requires only `definition`.
3. **Import:** Single JSON file, multi-file upload, ZIP bundle.
4. **Export:** Definition-only ZIP, full-bundle ZIP (includes present optional artifacts). Unknown extra files preserved on ZIP round-trip.

## Validation and Diagnostics

1. Schema pass: each artifact against its canonical `schemas/*.json` via AJV.
2. Semantic pass: `FormEngine` instantiation, validation report, FEL errors.
3. Preview pass: `<formspec-render>` lifecycle warnings/errors.
4. Mapping pass: `RuntimeMappingEngine` diagnostics (when mapping present).
5. All diagnostics normalized to: `{ severity, artifact, path, message, source }`.
6. **Blocking rules:** Definition errors block all export. Optional artifact errors block only full-bundle export when that artifact is included. Optional errors never block definition-only export.

## Random Response Preview

1. Deterministic generator seeded by user input.
2. Generates candidate data from definition structure and data types.
3. Validates through `FormEngine.getValidationReport`.
4. Retries bounded times for better validity.
5. Shows unresolved rule list when perfect validity cannot be achieved.

## Implementation Phases

### Phase 1: Workspace + Definition Tree

Scaffold `form-builder/` with Preact + signals + Vite. Build the four-zone workspace (icon-only sidebar, tree + preview split, collapsible properties). Implement tree editor with:
- Node rendering (labels, type dots, badges, depth guides)
- Smart inline add (gap insertion, inline creation form)
- Drag-and-drop reorder
- Node selection → Properties panel wiring
- Guided (tree) and JSON mode toggle
- FormEngine integration (FEL, binds, validation)
- Diagnostics tab

**Milestone:** Create, edit, reorder, and validate a definition. JSON fallback available. Diagnostics surface errors.

### Phase 2: Live Preview + Selection Sync

Integrate `<formspec-render>` in the preview panel:
- Live rendering (debounced updates)
- Bidirectional selection sync (tree ↔ preview)
- Scroll-to-field on selection
- Respects component/theme if present

**Milestone:** Tree and preview side-by-side with synced selection. Form takes shape in real-time.

### Phase 3: Import / Export + Optional Tabs

- Import: single JSON, multi-file, ZIP bundle
- Export: definition-only ZIP, full-bundle ZIP
- Optional tabs (Component, Theme, Mapping, Registry, Changelog): empty states, JSON editor, schema validation
- Unknown files preserved on ZIP round-trip

**Milestone:** Full project I/O. Optional artifacts editable but never blocking.

### Phase 4: Polish + Response Generation + Parity

- Deterministic random response generation and preview
- Python parity contract suite (CI, using `src/formspec`)
- Keyboard shortcuts, accessibility audit, reduced motion
- Performance tuning

**Milestone:** Production-quality V1.

## Types

App-local types in `form-builder/src/types.ts`:
- `ArtifactKind` — union of artifact names
- `ArtifactState` — loaded/validated state per artifact
- `BuilderProject` — project model with nullable artifact slots
- `BuilderDiagnostic` — normalized diagnostic format
- `ExportProfile` — `'definition-only' | 'full-bundle'`

Non-breaking enhancement in `formspec-webcomponent`:
- `formspec-diagnostic` event: `{ code?, severity, message, path?, source }`.

No breaking changes in `formspec-engine`.

## Test Scenarios

1. Definition-only project: create, validate, preview, export.
2. Optional tabs empty: no blocking, no errors.
3. Invalid optional artifact: diagnostics surface in its tab, don't block definition export.
4. Full bundle export: includes only valid optional artifacts plus definition.
5. FEL behavior: engine results only, no custom parser.
6. Drag-and-drop: reorder within parent, reparent into groups.
7. Inline add: create field/group/display via gap insertion.
8. Selection sync: tree ↔ preview bidirectional.
9. Random generator: deterministic for fixed seed, validation report visible.
10. Import JSON → re-export: preserves semantic content.
11. Import ZIP → re-export: preserves known artifacts and unknown extras.
12. Python parity: lint, evaluation, and mapping output match engine behavior.

## Acceptance Criteria

1. Non-technical user can build/edit a definition without touching raw JSON.
2. Validation and preview rely on existing Formspec runtime components only.
3. Optional artifacts are editable but never mandatory.
4. Definition-only export always available when definition is valid.
5. Full-bundle export available when included artifacts pass validation.
6. CI enforces parity contracts using `src/formspec`.

## Assumptions

1. V1 is JS-only at runtime. Python is CI/test tooling.
2. `definition` is mandatory; everything else is optional.
3. Optional artifact tabs always visible in sidebar.
4. Reuse-first: no new FEL grammar/parser/semantic validator in the app.
5. JSON fallback available in every tab for full schema authoring.
6. `form-builder/` is a top-level monorepo app consuming formspec packages via workspace dependencies.
