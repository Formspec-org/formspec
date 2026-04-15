# formspec-studio

**The Stack** is the visual authoring environment for Formspec. It is a React 19 single-page application that gives authors a full editing surface for every document tier: definition, component, theme, and mapping.

All mutations flow through `formspec-studio-core`'s command dispatch. The UI is a visual surface over the command catalog — nothing more. Undo, redo, and import/export come for free from the core layer.

Studio is intentionally opinionated about authoring surfaces, but Formspec
itself remains layered:

- `definition.json` alone is valid
- `theme.json` remains a supported optional layer
- `component.json` remains a supported optional highest-precedence layer

The Studio split only changes the editing UX: Studio edits Definition and
Component layout directly, while still preserving Theme as a valid artifact and
runtime layer.

---

## Install and dev setup

The package lives in the monorepo. Install from the repo root:

```bash
npm install          # installs all workspace deps
```

Then, from this package directory:

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # production build → dist/
npm test             # Vitest (unit + component, ~90 test files)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright end-to-end tests
```

Vite aliases `formspec-studio-core`, `formspec-engine`, and `formspec-layout` to their TypeScript source so hot-reload works across packages without a build step.

---

## Architecture

### Component tree

```
StudioApp
 └─ ProjectProvider          formspec-studio-core Project instance
    └─ SelectionProvider      pure React state, persists across tab switches
       └─ ActiveGroupProvider  active layout page in multi-page forms
          └─ Shell
             ├─ Header        workspace tabs, undo/redo, import/export
             ├─ Blueprint      sidebar — 9 navigable sections with count badges
             ├─ Workspace      active tab content (see Workspaces below)
             ├─ ItemProperties selection-driven right panel
             └─ StatusBar      item count, version, status
```

### State management

Three hooks carry all state. There is no Redux, Zustand, or global store.

| Hook | What it does |
|------|-------------|
| `useProjectState()` | `useSyncExternalStore` subscribed to `Project.onChange()`. Returns `Readonly<ProjectState>`. Re-renders on any dispatch, undo, or redo. |
| `useProject()` | Returns the stable `Project` instance from context. Use for imperative calls (`project.undo()`, `project.export()`). |
| `useSelection()` | Pure React context for the selected item key and type. Not part of the command model — cannot be undone. |

Derived hooks (`useDefinition`, `useComponent`, `useTheme`, `useMapping`) select slices from `useProjectState()`.

### Workspaces

| Tab | Component | Purpose |
|-----|-----------|---------|
| Editor | `DefinitionTreeEditor` | Definition tree — items, types, structure, and bind behavior |
| Logic | `LogicTab` | Variables, binds by type, validation shapes |
| Data | `DataTab` | Response schema, data source instances, option sets, test response |
| Layout | `LayoutCanvas` | Visual form builder — pages, layout containers, placement, and widget selection |
| Theme | `ThemeTab` | Token editor, defaults, selector cascade, item overrides |
| Mapping | `MappingTab` | Transform rules, adapter config, mapping preview |
| Preview | `PreviewTab` | Live form preview, **Behavior** lab (scenario JSON + diagnostics), viewport switcher, and JSON documents view |

### Blueprint sidebar

Nine sections with entity count badges:

1. **Structure** — item tree with type icons and selection
2. **Component Tree** — color-coded component document visualization
3. **Theme** — token/selector/defaults summary
4. **Screener** — screening fields and routing rules
5. **Variables** — named FEL variables with expressions
6. **Data Sources** — external data instances
7. **Option Sets** — named option lists with usage tracking
8. **Mappings** — rule count and direction
9. **Settings** — definition metadata, presentation defaults, extensions

### Chat shell

`src/chat/` contains the conversational form builder. It is a self-contained feature with its own state (`ChatProvider`, `useChatSession`) and four panels:

- `ChatShell` — layout wrapper
- `ChatPanel` — conversation thread
- `FormPreview` — live preview alongside the chat
- `IssuePanel` — validation issues surfaced from the session

The chat shell is exported from `formspec-chat` and consumed by the studio as a workspace mode.

### Two chat surfaces

The studio currently ships two distinct chat entry points. They serve different
flows and share no runtime state.

| Surface | Entry | Analytics label | Role |
|---------|-------|-----------------|------|
| Integrated sidebar | `src/components/ChatPanel.tsx` | `integrated-studio-ai` | Assistant bound to the live `Project`, routed through MCP tools, producing reviewable changesets inside the editor. |
| Standalone MPA | `src/chat-v2/` + `main-chat.tsx` at `/studio/chat.html` | `standalone-conversational-entry` | Conversational intake built on `ChatSession`. Hands off to the editor via the `?h=` query parameter. |

The integrated panel mutates the open project directly; the standalone page is
a separate entry that scaffolds a definition and hands it to the editor. Both
use `@formspec-org/chat` but compose it differently.

---

## Design tokens

Tailwind CSS v4 — no `tailwind.config.ts`. Tokens live in `src/index.css` under `@theme {}`.

| Token | Value | Usage |
|-------|-------|-------|
| `ink` | `#0f172a` | Primary text |
| `bg-default` | `#f8fafc` | Page background |
| `surface` | `#ffffff` | Cards, panels |
| `border` | `#e2e8f0` | Dividers |
| `accent` | `#2563eb` | Active states, required binds |
| `logic` | `#7c3aed` | Relevant binds, logic indicators |
| `error` | `#dc2626` | Validation errors, constraint binds |
| `green` | `#059669` | Calculate binds, success |
| `amber` | `#d97706` | Warnings, readonly binds |
| `muted` | `#64748b` | Secondary text |
| `subtle` | `#f1f5f9` | Hover backgrounds |

Fonts: `font-ui` (Space Grotesk), `font-mono` (JetBrains Mono).

---

## Project structure

```
src/
├── main.tsx                  React root — registers formspec-render custom element
├── App.tsx                   Thin wrapper over StudioApp
├── index.css                 Tailwind v4 @theme tokens and font imports
├── studio-app/
│   └── StudioApp.tsx         Provider tree, creates the Project instance
├── state/                    React hooks bridging studio-core to React
│   ├── ProjectContext.tsx    Project instance context
│   ├── useProject.ts         Stable Project ref
│   ├── useProjectState.ts    useSyncExternalStore subscription
│   ├── useSelection.tsx      UI selection state (key + type)
│   ├── useActiveGroup.tsx    Active group context for multi-page forms
│   ├── useDefinition.ts      Definition slice
│   ├── useComponent.ts       Component slice
│   ├── useTheme.ts           Theme slice
│   └── useMapping.ts         Mapping slice
├── components/               Shell chrome and shared UI
│   ├── Shell.tsx             Main layout — sidebar, workspace, properties panel
│   ├── Header.tsx            Tab bar, undo/redo, import/export
│   ├── StatusBar.tsx         Item count, version, status
│   ├── Blueprint.tsx         Sidebar section switcher
│   ├── PropertiesPanel.tsx   Selection-driven right panel
│   ├── CommandPalette.tsx    ⌘K search overlay
│   ├── ImportDialog.tsx      JSON import dialog
│   ├── SettingsDialog.tsx    Definition metadata and settings
│   ├── blueprint/            Sidebar section components
│   └── ui/                   Shared primitives (Pill, BindCard, Section, etc.)
├── workspaces/
│   ├── editor/               Block rendering, DnD, context menu, properties
│   ├── logic/                Variables, binds, shapes
│   ├── data/                 Schema viewer, instances, option sets
│   ├── layout/               Visual layout and page composition
│   ├── theme/                Tokens, defaults, selectors, layouts
│   ├── mapping/              Rules, adapter config, preview
│   └── preview/              Component renderer, viewport switcher, wizard nav
├── chat/                     Conversational form builder (ChatShell + panels)
├── features/
│   └── behavior-preview/     BehaviorPreview — live bind/logic preview panel
├── fixtures/                 Example definition for dev startup
└── lib/
    ├── humanize.ts           FEL expression → human-readable text
    ├── field-helpers.ts      Item flattening, bind/shape lookups
    └── keyboard.ts           Keyboard shortcut registry

tests/
├── smoke.test.tsx
├── state/                    Hook tests
├── components/               Shell, UI, and blueprint tests
├── workspaces/               Workspace component tests
├── integration/              Cross-component workflow tests
├── features/                 BehaviorPreview tests
├── chat/                     Chat shell component tests
└── lib/                      Utility tests
```

---

## Known limitations

- **`Project.renameVariable()`** — Throws `HelperError` with code `NOT_IMPLEMENTED`. There is no `definition.renameVariable` command in the core handler catalog yet, so the studio cannot safely rewrite variable names across binds and FEL. Use manual edits until a core migration path exists.

---

## Key design decisions

**All mutations are commands.** Every user action dispatches a typed command (`definition.addItem`, `theme.setToken`, `component.addNode`, etc.). This gives undo/redo and audit logging without extra infrastructure.

**No state management library.** `useSyncExternalStore` bridges `Project.onChange()` into React's rendering cycle. The `Project` class is the single source of truth. React hooks are thin subscriptions.

**Selection is UI state, not project state.** Selection persists across tab switches but sits outside the command model. It cannot be undone or redone.

**Tests first.** All components and utilities were built test-first. The test suite spans unit, integration, and E2E layers. Run `npm test` to execute the full suite.
