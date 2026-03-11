# formspec-studio

Desktop-first visual authoring environment for Formspec v1.0. Greenfield replacement of `form-builder/` (Preact), built with React 19, Tailwind CSS 4, and TypeScript. All mutations flow through `formspec-studio-core`'s `Project.dispatch()` — the UI is a visual surface for the 122-command catalog.

## Architecture

```
App
 └─ ProjectProvider (formspec-studio-core Project instance)
    └─ SelectionProvider (pure React state, persists across tab switches)
       └─ Shell
          ├─ Header (tabs, undo/redo)
          ├─ Blueprint sidebar (11 sections)
          ├─ Workspace (Editor | Logic | Data | Theme | Mapping | Preview)
          ├─ PropertiesPanel (selection-driven)
          └─ StatusBar (counts, version, status)
```

### State Management

No Redux, no Zustand. The state layer is three hooks:

- **`useProjectState()`** — `useSyncExternalStore` subscribed to `Project.onChange()`. Returns `Readonly<ProjectState>`. Components re-render when any dispatch/undo/redo mutates state.
- **`useDispatch()`** — Stable dispatch function via context. Components call `dispatch({ type: 'definition.addItem', payload: { ... } })`.
- **`useSelection()`** — Pure React context for UI selection state (selected key + type). Not stored in Project — lives outside the command model per PRD section 20.1.

Derived hooks (`useDefinition`, `useComponent`, `useTheme`, `useMapping`) select slices from `useProjectState()`.

### Design Tokens

Tailwind CSS v4 — no `tailwind.config.ts`. All tokens defined in `src/index.css` via `@theme {}`:

| Token | Value | Usage |
|-------|-------|-------|
| `ink` | `#1e293b` | Primary text |
| `bg-default` | `#f8fafc` | Page background |
| `surface` | `#ffffff` | Cards, panels |
| `border` | `#e2e8f0` | Dividers |
| `accent` | `#3b82f6` | Active states, required binds |
| `logic` | `#8b5cf6` | Relevant binds, logic indicators |
| `error` | `#ef4444` | Validation errors, constraint binds |
| `green` | `#22c55e` | Calculate binds, success |
| `amber` | `#f59e0b` | Warnings, readonly binds |
| `muted` | `#94a3b8` | Secondary text |
| `subtle` | `#f1f5f9` | Hover backgrounds |

Fonts: `font-ui` (Space Grotesk), `font-mono` (JetBrains Mono).

## Workspaces

| Tab | Component | Purpose |
|-----|-----------|---------|
| Editor | `EditorCanvas` | Block-based item authoring — fields, groups, display items with bind pills |
| Logic | `LogicTab` | Behavioral editing — variables, binds by type, validation shapes |
| Data | `DataTab` | Response schema, data source instances, option sets, test response |
| Theme | `ThemeTab` | Token editor, defaults, selector cascade, item overrides, page layouts |
| Mapping | `MappingTab` | Transform rules, adapter config, mapping preview |
| Preview | `PreviewTab` | Respondent-facing form preview with viewport switcher |

## Blueprint Sidebar

11 navigable sections with entity count badges:

1. **Structure** — Item tree with type icons and selection
2. **Component Tree** — Color-coded component document visualization
3. **Theme** — Token/selector/defaults summary
4. **Screener** — Screening fields and routing rules
5. **Variables** — Named FEL variables with expressions
6. **Data Sources** — External data instances
7. **Option Sets** — Named option lists with usage tracking
8. **Mappings** — Rule count and direction
9. **Migrations** — Version migration descriptors
10. **FEL Reference** — 9-category function catalog
11. **Settings** — Definition metadata, presentation defaults, extensions

## Shared Primitives

| Component | Purpose |
|-----------|---------|
| `Pill` | Colored metadata badge (10% bg, 20% border) |
| `BindCard` | Bind type card with colored left border |
| `ShapeCard` | Severity-colored validation shape card |
| `Section` | Collapsible section with title and toggle |
| `PropertyRow` | Label/value row for property panels |
| `FieldIcon` | Data-type icon (Aa, #, $, etc.) |

## Commands

```bash
# Development
npm run dev          # Vite dev server

# Build
npm run build        # Production build

# Tests
npm test             # Run all 195 tests
npm run test:watch   # Watch mode
```

## Project Structure

```
src/
├── main.tsx                    # React root
├── App.tsx                     # Providers + Shell
├── index.css                   # Tailwind v4 @theme tokens
├── state/                      # React hooks wrapping studio-core
│   ├── ProjectContext.tsx
│   ├── useProject.ts
│   ├── useProjectState.ts
│   ├── useDispatch.ts
│   ├── useSelection.tsx
│   ├── useDefinition.ts
│   ├── useComponent.ts
│   ├── useTheme.ts
│   └── useMapping.ts
├── components/                 # Shell chrome + shared UI
│   ├── Shell.tsx
│   ├── Header.tsx
│   ├── StatusBar.tsx
│   ├── Blueprint.tsx
│   ├── PropertiesPanel.tsx
│   ├── CommandPalette.tsx
│   ├── ImportDialog.tsx
│   ├── ui/                     # Shared primitives
│   └── blueprint/              # Sidebar section components
├── workspaces/
│   ├── editor/                 # Block rendering, properties, context menu
│   ├── logic/                  # Variables, binds, shapes
│   ├── data/                   # Schema, instances, option sets
│   ├── theme/                  # Tokens, defaults, selectors, layouts
│   ├── mapping/                # Rules, adapter, preview
│   └── preview/                # Component renderer, viewport, wizard nav
└── lib/                        # Utilities
    ├── humanize.ts             # FEL → human-readable
    ├── field-helpers.ts        # Item flattening, bind/shape lookups
    └── keyboard.ts             # Shortcut registry

tests/
├── smoke.test.tsx
├── state/                      # Hook tests
├── components/                 # Shell + UI + blueprint tests
├── workspaces/                 # Workspace component tests
├── lib/                        # Utility tests
└── e2e/                        # Integration workflow tests
```

## Dependencies

| Package | Role |
|---------|------|
| `react` / `react-dom` 19 | UI framework |
| `formspec-studio-core` | Command dispatch, undo/redo, project state |
| `formspec-engine` | FEL parser, form engine (transitive via studio-core) |
| `tailwindcss` 4 | Utility-first CSS |
| `vite` 5 | Build tooling |
| `vitest` 3 | Test runner |
| `@testing-library/react` | Component testing |
| `happy-dom` | DOM environment for tests |

## Key Design Decisions

**No state management library.** `useSyncExternalStore` bridges `Project.onChange()` into React's rendering cycle. The Project class is the single source of truth — React hooks are thin subscriptions.

**Selection is UI state, not project state.** Selection persists across workspace tab switches but is not part of the command model. It cannot be undone/redone.

**All mutations are commands.** Every user action dispatches a typed command (`definition.addItem`, `theme.setToken`, `component.addNode`, etc.). This gives us undo/redo, audit logging, and potential collaboration for free.

**TDD throughout.** Every component and utility was built test-first. 195 tests across 53 files provide confidence for aggressive iteration.
