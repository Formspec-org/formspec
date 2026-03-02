# Formspec Studio — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the form-builder workspace shell with a functional tree editor that can create, edit, reorder, and validate Formspec definitions.

**Architecture:** Preact + `@preact/signals` app at `form-builder/` consuming `formspec-engine` and `formspec-webcomponent` as workspace dependencies. Four-zone collapsible layout (sidebar, tree editor, preview placeholder, properties panel). FormEngine drives all definition semantics — no custom parsers.

**Tech Stack:** Preact, @preact/signals, Vite (JSX transform), TypeScript, FormEngine, AJV (schema validation)

**Design specs:** `thoughts/formspec-studio-design-spec.md` (colors, typography, layout, components), `thoughts/formspec-studio-v1-plan.md` (architecture, scope)

---

## Task 1: Scaffold form-builder/ App

**Files:**
- Create: `form-builder/package.json`
- Create: `form-builder/tsconfig.json`
- Create: `form-builder/vite.config.ts`
- Create: `form-builder/index.html`
- Create: `form-builder/src/index.tsx`
- Create: `form-builder/src/app.tsx`
- Create: `form-builder/styles.css`
- Modify: `package.json` (root — add workspace)

**Step 1: Create `form-builder/package.json`**

```json
{
  "name": "formspec-studio",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 8082 --open",
    "build": "tsc && vite build",
    "preview": "vite preview --port 8082"
  },
  "dependencies": {
    "@preact/signals": "^2.0.0",
    "formspec-engine": "*",
    "formspec-webcomponent": "*",
    "preact": "^10.0.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create `form-builder/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

**Step 3: Create `form-builder/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';
import fs from 'fs';

const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 8082,
    allowedHosts: true,
    fs: {
      allow: [repoRoot],
    },
  },
});
```

**Step 4: Create `form-builder/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formspec Studio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./src/index.tsx"></script>
</body>
</html>
```

**Step 5: Create `form-builder/styles.css`**

This is the global CSS with custom properties from the design spec, base resets, and layout grid. Full file:

```css
/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Background hierarchy */
  --bg-0: #0E1117;
  --bg-1: #161B22;
  --bg-2: #1C2128;
  --bg-3: #252C35;
  --bg-active: #2D3540;

  /* Text hierarchy */
  --text-0: #E6EDF3;
  --text-1: #9BA4AE;
  --text-2: #545D68;
  --text-3: #353C45;

  /* Accent — Warm Amber */
  --accent: #D4A34A;
  --accent-hover: #E0B45C;
  --accent-dim: #8B6E35;
  --accent-bg: rgba(212, 163, 74, 0.08);
  --accent-bg-strong: rgba(212, 163, 74, 0.14);

  /* Semantic */
  --success: #3FB950;
  --warning: #D29922;
  --error: #DA3633;
  --info: #58A6FF;

  /* Borders */
  --border-0: #1B2028;
  --border-1: #262E38;
  --border-2: #353D48;
  --border-focus: #D4A34A;

  /* Typography */
  --font-display: 'Fraunces', Georgia, serif;
  --font-ui: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;

  /* Animation */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-normal: 200ms;

  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-0);
  background: var(--bg-0);
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-2); }

body {
  height: 100vh;
  overflow: hidden;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Workspace layout ── */
.studio-topbar {
  height: 48px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border-0);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  flex-shrink: 0;
}

.studio-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.studio-sidebar {
  width: 48px;
  background: var(--bg-1);
  border-right: 1px solid var(--border-0);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

.studio-sidebar.expanded {
  width: 180px;
}

.studio-editor {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.studio-tree-pane {
  flex: 1;
  overflow: auto;
  background: var(--bg-0);
  background-image: radial-gradient(
    circle at 1px 1px,
    rgba(255, 255, 255, 0.012) 1px,
    transparent 0
  );
  background-size: 24px 24px;
}

.studio-preview-pane {
  flex: 1;
  overflow: auto;
  border-left: 1px solid var(--border-0);
  background: var(--bg-0);
}

.studio-splitter {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  position: relative;
}

.studio-splitter:hover,
.studio-splitter.dragging {
  background: var(--accent-dim);
}

.studio-properties {
  width: 320px;
  background: var(--bg-1);
  border-left: 1px solid var(--border-0);
  flex-shrink: 0;
  overflow: hidden;
  transition: width var(--duration-normal) var(--ease-out);
  display: flex;
  flex-direction: column;
}

.studio-properties.collapsed {
  width: 0;
  border-left: none;
}

/* ── Buttons ── */
.btn-primary {
  background: var(--accent);
  color: var(--bg-0);
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font: 500 12px var(--font-ui);
  cursor: pointer;
}

.btn-primary:hover { background: var(--accent-hover); }

.btn-ghost {
  background: transparent;
  color: var(--text-1);
  border: 1px solid var(--border-1);
  padding: 6px 12px;
  border-radius: 6px;
  font: 500 12px var(--font-ui);
  cursor: pointer;
}

.btn-ghost:hover {
  border-color: var(--border-2);
  color: var(--text-0);
}

/* ── Form controls ── */
.studio-input {
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 4px;
  padding: 6px 8px;
  font: 400 12.5px var(--font-ui);
  color: var(--text-0);
  outline: none;
  width: 100%;
}

.studio-input:focus { border-color: var(--accent); }
.studio-input::placeholder { color: var(--text-3); }

.studio-input-mono {
  font-family: var(--font-mono);
}

.studio-select {
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 4px;
  padding: 6px 8px;
  font: 400 12.5px var(--font-ui);
  color: var(--text-0);
  outline: none;
  appearance: none;
  width: 100%;
  cursor: pointer;
}

.studio-select:focus { border-color: var(--accent); }

/* ── Section titles (property panel) ── */
.section-title {
  font: 600 10.5px var(--font-ui);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2);
  margin-bottom: 8px;
  padding-top: 4px;
}

/* ── Focus visible only for keyboard ── */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Step 6: Create `form-builder/src/index.tsx`**

```tsx
import { render } from 'preact';
import { App } from './app';

render(<App />, document.getElementById('app')!);
```

**Step 7: Create `form-builder/src/app.tsx`**

Minimal shell that renders the four-zone layout:

```tsx
export function App() {
  return (
    <div class="studio-root">
      <div class="studio-topbar">
        <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
          Formspec Studio
        </span>
      </div>
      <div class="studio-workspace">
        <div class="studio-sidebar" />
        <div class="studio-editor">
          <div class="studio-tree-pane">
            <p style={{ color: 'var(--text-2)', padding: '24px', textAlign: 'center' }}>
              Tree editor
            </p>
          </div>
          <div class="studio-splitter" />
          <div class="studio-preview-pane">
            <p style={{ color: 'var(--text-2)', padding: '24px', textAlign: 'center' }}>
              Preview (Phase 2)
            </p>
          </div>
        </div>
        <div class="studio-properties">
          <p style={{ color: 'var(--text-2)', padding: '24px', textAlign: 'center' }}>
            Properties
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 8: Add workspace to root `package.json`**

In root `package.json`, add `"form-builder"` to the workspaces array:

```json
"workspaces": [
  "packages/*",
  "examples/grant-application",
  "form-builder"
],
```

Also add a convenience script:

```json
"start:studio": "npm run build --workspace=formspec-engine && npm run build --workspace=formspec-webcomponent && npm run dev --workspace=formspec-studio"
```

**Step 9: Install dependencies and verify**

Run: `cd /home/exedev/formspec && npm install`
Run: `npm run dev --workspace=formspec-studio`
Expected: Vite starts on port 8082, shows the four-zone layout shell with placeholder text.

**Step 10: Commit**

```bash
git add form-builder/ package.json
git commit -m "feat(studio): scaffold form-builder app with Preact + Vite"
```

---

## Task 2: Types and State Signals

**Files:**
- Create: `form-builder/src/types.ts`
- Create: `form-builder/src/state/project.ts`
- Create: `form-builder/src/state/selection.ts`

**Step 1: Create `form-builder/src/types.ts`**

```typescript
import type { FormspecDefinition, FormspecItem, FormEngine } from 'formspec-engine';

export type ArtifactKind = 'definition' | 'component' | 'theme' | 'mapping' | 'registry' | 'changelog';

export interface ArtifactState {
  kind: ArtifactKind;
  data: unknown | null;
  dirty: boolean;
}

export interface BuilderProject {
  definition: FormspecDefinition | null;
  component: unknown | null;
  theme: unknown | null;
  mapping: unknown | null;
  registry: unknown | null;
  changelog: unknown | null;
}

export interface BuilderDiagnostic {
  severity: 'error' | 'warning' | 'info';
  artifact: ArtifactKind;
  path: string;
  message: string;
  source: string;
}

export type ExportProfile = 'definition-only' | 'full-bundle';

export type EditorMode = 'guided' | 'json';

/** The item types available when adding a new item to the tree. */
export type NewItemType = 'field' | 'group' | 'display';

/** State for the inline add form shown between tree nodes. */
export interface InlineAddState {
  /** Parent item key, or null for root-level. */
  parentKey: string | null;
  /** Index position to insert at within the parent's children. */
  insertIndex: number;
}
```

**Step 2: Create `form-builder/src/state/project.ts`**

```typescript
import { signal, computed } from '@preact/signals';
import type { FormspecDefinition, FormEngine } from 'formspec-engine';
import type { BuilderProject, BuilderDiagnostic, ArtifactKind, EditorMode } from '../types';

/** The current project. Definition is the only required artifact. */
export const project = signal<BuilderProject>({
  definition: null,
  component: null,
  theme: null,
  mapping: null,
  registry: null,
  changelog: null,
});

/** The active FormEngine instance, created when a definition is loaded. */
export const engine = signal<FormEngine | null>(null);

/** Current diagnostics from all sources. */
export const diagnostics = signal<BuilderDiagnostic[]>([]);

/** Which artifact tab is active in the sidebar. */
export const activeArtifact = signal<ArtifactKind>('definition');

/** Editor mode: guided tree or raw JSON. */
export const editorMode = signal<EditorMode>('guided');

/** Diagnostic counts by severity. */
export const diagnosticCounts = computed(() => {
  const diags = diagnostics.value;
  return {
    error: diags.filter(d => d.severity === 'error').length,
    warning: diags.filter(d => d.severity === 'warning').length,
    info: diags.filter(d => d.severity === 'info').length,
  };
});

/** Whether the definition has any blocking errors. */
export const hasBlockingErrors = computed(() => diagnosticCounts.value.error > 0);
```

**Step 3: Create `form-builder/src/state/selection.ts`**

```typescript
import { signal } from '@preact/signals';
import type { InlineAddState } from '../types';

/**
 * Full path to the currently selected item in the tree.
 * null = nothing selected, '' = root selected.
 */
export const selectedPath = signal<string | null>(null);

/** Current inline-add form state, or null if no inline add is active. */
export const inlineAddState = signal<InlineAddState | null>(null);
```

**Step 4: Verify TypeScript compiles**

Run: `cd /home/exedev/formspec/form-builder && npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add form-builder/src/types.ts form-builder/src/state/
git commit -m "feat(studio): add types and state signals"
```

---

## Task 3: Sidebar Component

**Files:**
- Create: `form-builder/src/components/sidebar.tsx`
- Modify: `form-builder/src/app.tsx`

**Step 1: Create `form-builder/src/components/sidebar.tsx`**

```tsx
import { signal } from '@preact/signals';
import { activeArtifact, project } from '../state/project';
import type { ArtifactKind } from '../types';

const expanded = signal(false);

const TABS: { kind: ArtifactKind; icon: string; label: string }[] = [
  { kind: 'definition', icon: '◆', label: 'Definition' },
  { kind: 'component', icon: '◇', label: 'Component' },
  { kind: 'theme', icon: '◈', label: 'Theme' },
  { kind: 'mapping', icon: '⬡', label: 'Mapping' },
  { kind: 'registry', icon: '▢', label: 'Registry' },
  { kind: 'changelog', icon: '▤', label: 'Changelog' },
];

function isConfigured(kind: ArtifactKind): boolean {
  const p = project.value;
  if (kind === 'definition') return p.definition !== null;
  return p[kind] !== null;
}

export function Sidebar() {
  return (
    <nav
      class={`studio-sidebar ${expanded.value ? 'expanded' : ''}`}
      onMouseEnter={() => { expanded.value = true; }}
      onMouseLeave={() => { expanded.value = false; }}
      role="tablist"
      aria-label="Artifact tabs"
      aria-orientation="vertical"
    >
      {TABS.map(tab => {
        const active = activeArtifact.value === tab.kind;
        const configured = isConfigured(tab.kind);
        return (
          <button
            key={tab.kind}
            role="tab"
            aria-selected={active}
            class="sidebar-tab"
            data-active={active || undefined}
            onClick={() => { activeArtifact.value = tab.kind; }}
            title={tab.label}
          >
            <span class="sidebar-tab-icon" style={{
              color: active ? 'var(--accent)' : 'var(--text-1)',
            }}>
              {tab.icon}
            </span>
            {expanded.value && (
              <span class="sidebar-tab-label">{tab.label}</span>
            )}
            {expanded.value && tab.kind !== 'definition' && (
              <span class="sidebar-tab-status" style={{
                color: configured ? 'var(--success)' : 'var(--text-3)',
              }}>
                {configured ? '✓' : '—'}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

**Step 2: Add sidebar CSS to `styles.css`**

Append to `form-builder/styles.css`:

```css
/* ── Sidebar tabs ── */
.sidebar-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--text-1);
  font: 500 12.5px var(--font-ui);
  cursor: pointer;
  width: 100%;
  text-align: left;
  white-space: nowrap;
}

.sidebar-tab:hover { background: var(--bg-3); }

.sidebar-tab[data-active] {
  background: var(--accent-bg-strong);
  color: var(--accent);
  border-left-color: var(--accent);
}

.sidebar-tab-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-tab-label {
  flex: 1;
}

.sidebar-tab-status {
  font-size: 12px;
  flex-shrink: 0;
}
```

**Step 3: Wire sidebar into `app.tsx`**

Replace the empty sidebar div in `app.tsx` with `<Sidebar />`. Import from `./components/sidebar`.

**Step 4: Verify in browser**

Run: `npm run dev --workspace=formspec-studio`
Expected: Sidebar shows 6 icon-only tabs. Hovering expands to show labels. Clicking switches active tab. Definition tab is active by default.

**Step 5: Commit**

```bash
git add form-builder/src/components/sidebar.tsx form-builder/styles.css form-builder/src/app.tsx
git commit -m "feat(studio): add collapsible sidebar with artifact tabs"
```

---

## Task 4: Topbar Component

**Files:**
- Create: `form-builder/src/components/topbar.tsx`
- Modify: `form-builder/src/app.tsx`

**Step 1: Create `form-builder/src/components/topbar.tsx`**

```tsx
import { signal } from '@preact/signals';
import { project } from '../state/project';

const formTitle = signal('Untitled Form');

export function Topbar() {
  const def = project.value.definition;
  const version = def?.version ?? '0.1.0';
  const status = def?.status ?? 'draft';

  return (
    <header class="studio-topbar">
      <div class="topbar-brand">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="1" y="1" width="8" height="8" rx="2" fill="var(--accent)" opacity="1" />
          <rect x="11" y="1" width="8" height="8" rx="2" fill="var(--accent)" opacity="0.6" />
          <rect x="1" y="11" width="8" height="8" rx="2" fill="var(--accent)" opacity="0.6" />
          <rect x="11" y="11" width="8" height="8" rx="2" fill="var(--accent)" opacity="0.3" />
        </svg>
        <span class="topbar-brand-text">
          Formspec{' '}
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--accent)' }}>
            Studio
          </span>
        </span>
      </div>

      <div class="topbar-center">
        <input
          class="topbar-title-input"
          value={formTitle.value}
          onInput={(e) => { formTitle.value = (e.target as HTMLInputElement).value; }}
          aria-label="Form title"
        />
        <span class="topbar-meta">
          <span class="topbar-dot">·</span>
          v{version}
          <span class="topbar-dot">·</span>
          {status}
        </span>
      </div>

      <div class="topbar-actions">
        <button class="btn-ghost" aria-label="Import project">
          <span aria-hidden="true">↓</span> Import
        </button>
        <button class="btn-primary" aria-label="Export project">
          <span aria-hidden="true">↑</span> Export
        </button>
      </div>
    </header>
  );
}
```

**Step 2: Add topbar CSS to `styles.css`**

Append:

```css
/* ── Topbar ── */
.topbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.topbar-brand-text {
  font: 400 14px var(--font-ui);
  color: var(--text-0);
  white-space: nowrap;
}

.topbar-center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.topbar-title-input {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 8px;
  font: 600 13px var(--font-ui);
  color: var(--text-0);
  outline: none;
  text-align: center;
  max-width: 300px;
}

.topbar-title-input:hover { border-color: var(--border-1); }
.topbar-title-input:focus { border-color: var(--accent); background: var(--bg-2); }

.topbar-meta {
  font: 400 12px var(--font-ui);
  color: var(--text-2);
  white-space: nowrap;
}

.topbar-dot { color: var(--text-3); margin: 0 4px; }

.topbar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
```

**Step 3: Wire into `app.tsx`**

Replace topbar placeholder with `<Topbar />`.

**Step 4: Verify in browser**

Expected: Brand icon + "Formspec Studio" on left, editable title in center, Import/Export buttons on right.

**Step 5: Commit**

```bash
git add form-builder/src/components/topbar.tsx form-builder/styles.css form-builder/src/app.tsx
git commit -m "feat(studio): add topbar with brand, title, and action buttons"
```

---

## Task 5: Definition State + Engine Integration

**Files:**
- Create: `form-builder/src/state/definition.ts`
- Modify: `form-builder/src/state/project.ts`

This task sets up the core integration between the tree editor and FormEngine. When the user edits the definition in the tree, those edits update a definition signal, which rebuilds the FormEngine, which updates diagnostics.

**Step 1: Create `form-builder/src/state/definition.ts`**

```typescript
import { signal, effect, batch } from '@preact/signals';
import { FormEngine } from 'formspec-engine';
import type { FormspecDefinition, FormspecItem } from 'formspec-engine';
import { engine, diagnostics } from './project';
import type { BuilderDiagnostic } from '../types';

/** The current in-memory definition being edited. */
export const definition = signal<FormspecDefinition>(createEmptyDefinition());

/** Counter that increments on every definition change, used to trigger engine rebuild. */
export const definitionVersion = signal(0);

export function createEmptyDefinition(): FormspecDefinition {
  return {
    $formspec: '1.0',
    url: 'https://example.gov/forms/untitled',
    version: '0.1.0',
    status: 'draft',
    title: 'Untitled Form',
    items: [],
  } as FormspecDefinition;
}

/** Mutate the definition and trigger a rebuild. */
export function updateDefinition(mutator: (def: FormspecDefinition) => void) {
  const def = definition.value;
  mutator(def);
  // Trigger reactivity by bumping version (definition itself is mutated in place)
  definitionVersion.value++;
}

/** Replace the entire definition (e.g., after JSON import/edit). */
export function setDefinition(def: FormspecDefinition) {
  batch(() => {
    definition.value = def;
    definitionVersion.value++;
  });
}

/**
 * Find an item in the definition tree by its key path.
 * Returns the item and its parent's children array + index.
 */
export function findItemByKey(
  key: string,
  items: FormspecItem[] = definition.value.items
): { item: FormspecItem; siblings: FormspecItem[]; index: number } | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].key === key) return { item: items[i], siblings: items, index: i };
    if (items[i].children) {
      const found = findItemByKey(key, items[i].children!);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Rebuild the FormEngine from the current definition.
 * Runs as an effect whenever definitionVersion changes.
 */
effect(() => {
  // Subscribe to changes
  definitionVersion.value;
  const def = definition.value;

  try {
    const newEngine = new FormEngine(def);
    engine.value = newEngine;

    // Pull diagnostics from engine validation
    const report = newEngine.getValidationReport();
    const diags: BuilderDiagnostic[] = report.results.map(r => ({
      severity: r.severity,
      artifact: 'definition',
      path: r.path,
      message: r.message,
      source: r.source ?? 'engine',
    }));
    diagnostics.value = diags;
  } catch (e) {
    // Engine construction failed — surface as a diagnostic
    engine.value = null;
    diagnostics.value = [{
      severity: 'error',
      artifact: 'definition',
      path: '',
      message: `Engine error: ${(e as Error).message}`,
      source: 'engine',
    }];
  }
});
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/exedev/formspec/form-builder && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add form-builder/src/state/definition.ts form-builder/src/state/project.ts
git commit -m "feat(studio): add definition state with FormEngine integration"
```

---

## Task 6: Tree Editor — Node Rendering

**Files:**
- Create: `form-builder/src/components/tree/tree-editor.tsx`
- Create: `form-builder/src/components/tree/tree-node.tsx`

The tree editor renders the definition's item hierarchy. Each node shows its type dot, label, data type badge, and bind indicators.

**Step 1: Create `form-builder/src/components/tree/tree-node.tsx`**

```tsx
import { selectedPath } from '../../state/selection';
import { updateDefinition, findItemByKey } from '../../state/definition';
import type { FormspecItem } from 'formspec-engine';
import { signal } from '@preact/signals';

const NODE_TYPE_COLORS: Record<string, string> = {
  field: '#D4A34A',
  group: '#5A8FBB',
  display: '#706C68',
};

const DATA_TYPE_COLORS: Record<string, string> = {
  string: 'var(--text-1)',
  text: 'var(--text-1)',
  integer: '#5AAFBB',
  decimal: '#5AAFBB',
  number: '#5AAFBB',
  boolean: '#5FAF5F',
  date: '#C47AB0',
  dateTime: '#C47AB0',
  time: '#C47AB0',
  choice: '#D48A4A',
  multiChoice: '#D48A4A',
  money: '#5FAF5F',
  uri: '#5ABBB0',
  attachment: '#706C68',
};

interface TreeNodeProps {
  item: FormspecItem;
  depth: number;
  parentKey: string | null;
  index: number;
}

export function TreeNode({ item, depth, parentKey, index }: TreeNodeProps) {
  const isSelected = selectedPath.value === item.key;
  const isGroup = item.type === 'group';
  const isExpanded = signal(true); // default expanded

  const hasBindProps = item.required || item.calculate || item.constraint || item.relevant;

  return (
    <div class="tree-node-wrapper" data-depth={depth}>
      {depth > 0 && <div class="tree-depth-line" style={{ left: `${depth * 24 - 12}px` }} />}

      <div
        class={`tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => { selectedPath.value = item.key; }}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isGroup ? isExpanded.value : undefined}
        aria-level={depth + 1}
        tabIndex={0}
      >
        {/* Drag handle — hidden by default, shown on hover */}
        <span class="tree-node-grip" aria-hidden="true">⠿</span>

        {/* Toggle arrow for groups */}
        {isGroup && (
          <button
            class="tree-node-toggle"
            onClick={(e) => { e.stopPropagation(); isExpanded.value = !isExpanded.value; }}
            aria-label={isExpanded.value ? 'Collapse' : 'Expand'}
          >
            <span style={{ transform: isExpanded.value ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform var(--duration-normal) var(--ease-out)' }}>
              ▸
            </span>
          </button>
        )}

        {/* Type dot */}
        <span
          class="tree-node-dot"
          style={{ background: NODE_TYPE_COLORS[item.type] || 'var(--text-2)' }}
          aria-hidden="true"
        />

        {/* Label */}
        <span class="tree-node-label">{item.label || item.key}</span>

        {/* Key (shown on hover/select) */}
        <span class="tree-node-key">{item.key}</span>

        {/* Data type badge */}
        {item.dataType && (
          <span
            class="tree-node-badge"
            style={{ color: DATA_TYPE_COLORS[item.dataType] || 'var(--text-1)' }}
          >
            {item.dataType}
          </span>
        )}

        {/* Bind indicators */}
        {item.required && <span class="tree-node-bind" title="Required">*</span>}
        {item.calculate && <span class="tree-node-bind" title="Calculated">ƒ</span>}
        {item.constraint && <span class="tree-node-bind" title="Constraint">✓</span>}
        {item.relevant && <span class="tree-node-bind" title="Conditional">⚡</span>}

        {/* Actions (shown on hover/select) */}
        <span class="tree-node-actions">
          <button class="tree-action" title="Move up" onClick={(e) => { e.stopPropagation(); moveItem(item.key, -1); }}>↑</button>
          <button class="tree-action" title="Move down" onClick={(e) => { e.stopPropagation(); moveItem(item.key, 1); }}>↓</button>
          <button class="tree-action tree-action-danger" title="Delete" onClick={(e) => { e.stopPropagation(); deleteItem(item.key); }}>×</button>
        </span>
      </div>

      {/* Children */}
      {isGroup && isExpanded.value && item.children && (
        <div role="group">
          {item.children.map((child, i) => (
            <TreeNode key={child.key} item={child} depth={depth + 1} parentKey={item.key} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function moveItem(key: string, direction: -1 | 1) {
  updateDefinition(def => {
    const found = findItemByKey(key, def.items);
    if (!found) return;
    const { siblings, index } = found;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= siblings.length) return;
    [siblings[index], siblings[newIndex]] = [siblings[newIndex], siblings[index]];
  });
}

function deleteItem(key: string) {
  updateDefinition(def => {
    const found = findItemByKey(key, def.items);
    if (!found) return;
    found.siblings.splice(found.index, 1);
  });
  if (selectedPath.value === key) selectedPath.value = null;
}
```

**Step 2: Create `form-builder/src/components/tree/tree-editor.tsx`**

```tsx
import { definition, definitionVersion } from '../../state/definition';
import { selectedPath } from '../../state/selection';
import { TreeNode } from './tree-node';

export function TreeEditor() {
  // Subscribe to definition changes
  definitionVersion.value;
  const def = definition.value;

  const isRootSelected = selectedPath.value === '';

  return (
    <div class="tree-editor" role="tree" aria-label="Definition tree">
      {/* Tree header — root node */}
      <div
        class={`tree-header ${isRootSelected ? 'selected' : ''}`}
        onClick={() => { selectedPath.value = ''; }}
        role="treeitem"
        aria-level={1}
        aria-selected={isRootSelected}
        tabIndex={0}
      >
        <span class="tree-header-dot" />
        <span class="tree-header-title">{def.title || 'Untitled Form'}</span>
        <span class="tree-header-meta">
          {def.name || def.url} · v{def.version}
        </span>
      </div>

      {/* Items */}
      {def.items.map((item, i) => (
        <TreeNode key={item.key} item={item} depth={0} parentKey={null} index={i} />
      ))}

      {/* Root-level add button */}
      <div class="tree-add-root">
        <button class="tree-add-btn" aria-label="Add item to root">
          + Add Item
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Add tree CSS to `styles.css`**

Append:

```css
/* ── Tree editor ── */
.tree-editor {
  padding: 12px 0;
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-0);
  margin-bottom: 4px;
}

.tree-header.selected { background: var(--accent-bg); }
.tree-header:hover { background: var(--bg-2); }

.tree-header-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.tree-header-title {
  font: 500 17px var(--font-display);
  color: var(--text-0);
  letter-spacing: -0.02em;
  flex: 1;
}

.tree-header-meta {
  font: 400 10.5px var(--font-mono);
  color: var(--text-2);
}

/* ── Tree node ── */
.tree-node-wrapper {
  position: relative;
}

.tree-depth-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-0);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding-right: 12px;
  cursor: pointer;
  position: relative;
}

.tree-node:hover { background: var(--bg-2); }

.tree-node.selected {
  background: var(--accent-bg);
  box-shadow: inset 2px 0 0 var(--accent);
}

/* Grip handle — hidden by default */
.tree-node-grip {
  font-size: 10px;
  color: var(--text-3);
  cursor: grab;
  opacity: 0;
  transition: opacity var(--duration-fast);
  flex-shrink: 0;
  width: 14px;
  text-align: center;
}

.tree-node:hover .tree-node-grip,
.tree-node.selected .tree-node-grip { opacity: 1; }

.tree-node-toggle {
  background: none;
  border: none;
  color: var(--text-2);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tree-node-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tree-node-label {
  font: 500 13px var(--font-ui);
  color: var(--text-0);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Key — hidden by default, shown on hover/select */
.tree-node-key {
  font: 400 10px var(--font-mono);
  color: var(--text-2);
  opacity: 0;
  max-width: 0;
  overflow: hidden;
  transition: opacity var(--duration-fast), max-width var(--duration-fast);
  white-space: nowrap;
}

.tree-node:hover .tree-node-key,
.tree-node.selected .tree-node-key {
  opacity: 0.7;
  max-width: 150px;
}

.tree-node-badge {
  font: 400 10px var(--font-mono);
  background: var(--bg-3);
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.tree-node-bind {
  font-size: 11px;
  color: var(--accent-dim);
  flex-shrink: 0;
}

/* Actions — hidden by default */
.tree-node-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--duration-fast);
  flex-shrink: 0;
}

.tree-node:hover .tree-node-actions,
.tree-node.selected .tree-node-actions { opacity: 1; }

.tree-action {
  background: none;
  border: none;
  color: var(--text-2);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
}

.tree-action:hover { background: var(--bg-3); color: var(--text-0); }
.tree-action-danger:hover { color: var(--error); }

/* Add button */
.tree-add-root {
  padding: 8px 16px;
}

.tree-add-btn {
  background: none;
  border: 1px dashed var(--border-1);
  border-radius: 6px;
  color: var(--text-2);
  cursor: pointer;
  font: 400 12px var(--font-ui);
  padding: 6px 12px;
  width: 100%;
}

.tree-add-btn:hover {
  border-color: var(--accent-dim);
  color: var(--accent);
}
```

**Step 4: Wire tree editor into `app.tsx`**

Replace the tree pane placeholder with `<TreeEditor />`. The tree should show the definition items.

**Step 5: Load a test definition to verify**

In `form-builder/src/state/definition.ts`, seed the default definition with a few items:

```typescript
export function createEmptyDefinition(): FormspecDefinition {
  return {
    $formspec: '1.0',
    url: 'https://example.gov/forms/untitled',
    version: '0.1.0',
    status: 'draft',
    title: 'Untitled Form',
    items: [
      {
        key: 'basicInfo',
        type: 'group',
        label: 'Basic Information',
        children: [
          { key: 'fullName', type: 'field', label: 'Full Name', dataType: 'string' },
          { key: 'email', type: 'field', label: 'Email Address', dataType: 'string' },
        ],
      },
      { key: 'notes', type: 'field', label: 'Additional Notes', dataType: 'text' },
    ],
  } as FormspecDefinition;
}
```

**Step 6: Verify in browser**

Expected: Tree shows "Untitled Form" header, "Basic Information" group (expandable) with two children, and "Additional Notes" field. Hover shows grip, key text, and actions. Click selects a node with accent highlight.

**Step 7: Commit**

```bash
git add form-builder/src/components/tree/ form-builder/styles.css form-builder/src/app.tsx form-builder/src/state/definition.ts
git commit -m "feat(studio): add tree editor with node rendering, selection, and move/delete"
```

---

## Task 7: Smart Inline Add

**Files:**
- Create: `form-builder/src/components/tree/inline-add.tsx`
- Modify: `form-builder/src/components/tree/tree-editor.tsx`
- Modify: `form-builder/src/components/tree/tree-node.tsx`

**Step 1: Create `form-builder/src/components/tree/inline-add.tsx`**

```tsx
import { signal } from '@preact/signals';
import { inlineAddState } from '../../state/selection';
import { updateDefinition, findItemByKey, definition } from '../../state/definition';
import { selectedPath } from '../../state/selection';
import type { FormspecItem } from 'formspec-engine';
import type { NewItemType } from '../../types';

export function InlineAddForm() {
  const state = inlineAddState.value;
  if (!state) return null;

  const label = signal('');
  const itemType = signal<NewItemType>('field');

  function handleCreate() {
    const labelVal = label.value.trim();
    if (!labelVal) return;

    const key = labelVal.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const newItem: FormspecItem = {
      key,
      type: itemType.value,
      label: labelVal,
      ...(itemType.value === 'field' ? { dataType: 'string' } : {}),
      ...(itemType.value === 'group' ? { children: [] } : {}),
    } as FormspecItem;

    updateDefinition(def => {
      if (state.parentKey === null) {
        def.items.splice(state.insertIndex, 0, newItem);
      } else {
        const found = findItemByKey(state.parentKey, def.items);
        if (found && found.item.children) {
          found.item.children.splice(state.insertIndex, 0, newItem);
        }
      }
    });

    selectedPath.value = key;
    inlineAddState.value = null;
  }

  function handleCancel() {
    inlineAddState.value = null;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') handleCancel();
  }

  return (
    <div class="inline-add-form">
      <input
        class="studio-input inline-add-input"
        placeholder="Item label..."
        value={label.value}
        onInput={(e) => { label.value = (e.target as HTMLInputElement).value; }}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <select
        class="studio-select inline-add-type"
        value={itemType.value}
        onChange={(e) => { itemType.value = (e.target as HTMLSelectElement).value as NewItemType; }}
      >
        <option value="field">field</option>
        <option value="group">group</option>
        <option value="display">display</option>
      </select>
      <button class="btn-primary inline-add-confirm" onClick={handleCreate} title="Create (Enter)">↵</button>
      <button class="btn-ghost inline-add-cancel" onClick={handleCancel} title="Cancel (Escape)">×</button>
    </div>
  );
}

/** Renders a gap insertion target between nodes. */
export function InsertionGap({ parentKey, insertIndex }: { parentKey: string | null; insertIndex: number }) {
  const isActive = inlineAddState.value?.parentKey === parentKey && inlineAddState.value?.insertIndex === insertIndex;

  if (isActive) return <InlineAddForm />;

  return (
    <div
      class="tree-insertion-gap"
      onClick={() => {
        inlineAddState.value = { parentKey, insertIndex };
      }}
    >
      <span class="tree-insertion-gap-icon">+</span>
    </div>
  );
}
```

**Step 2: Add inline-add CSS to `styles.css`**

```css
/* ── Inline add ── */
.inline-add-form {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 6px;
  margin: 4px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.inline-add-input { flex: 1; }
.inline-add-type { width: 80px; flex-shrink: 0; }
.inline-add-confirm { padding: 4px 8px; }
.inline-add-cancel { padding: 4px 8px; }

/* ── Insertion gap ── */
.tree-insertion-gap {
  height: 4px;
  margin: 0 12px;
  position: relative;
  cursor: pointer;
  border-radius: 2px;
}

.tree-insertion-gap:hover {
  background: var(--accent-bg);
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tree-insertion-gap-icon {
  display: none;
  font: 500 12px var(--font-ui);
  color: var(--accent);
}

.tree-insertion-gap:hover .tree-insertion-gap-icon {
  display: block;
}
```

**Step 3: Wire insertion gaps into `tree-editor.tsx` and `tree-node.tsx`**

In `tree-editor.tsx`, add `<InsertionGap>` between each root item and after the last item. In `tree-node.tsx`, add gaps between children inside groups. The `+ Add Item` button at the bottom of each group also opens the inline add at the end.

**Step 4: Verify in browser**

Expected: Hovering between nodes shows a subtle gap with "+". Clicking opens an inline form. Typing a label and pressing Enter creates a new item. Pressing Escape cancels.

**Step 5: Commit**

```bash
git add form-builder/src/components/tree/inline-add.tsx form-builder/src/components/tree/tree-editor.tsx form-builder/src/components/tree/tree-node.tsx form-builder/styles.css
git commit -m "feat(studio): add smart inline add with gap insertion"
```

---

## Task 8: Properties Panel

**Files:**
- Create: `form-builder/src/components/properties/properties-panel.tsx`
- Create: `form-builder/src/components/properties/field-properties.tsx`
- Create: `form-builder/src/components/properties/group-properties.tsx`
- Create: `form-builder/src/components/properties/root-properties.tsx`

**Step 1: Create `form-builder/src/components/properties/properties-panel.tsx`**

The properties panel reads `selectedPath` to determine what to show. It uses `findItemByKey` to get the selected item's data.

```tsx
import { signal } from '@preact/signals';
import { selectedPath } from '../../state/selection';
import { definition, findItemByKey, definitionVersion } from '../../state/definition';
import { diagnostics, diagnosticCounts } from '../../state/project';
import { FieldProperties } from './field-properties';
import { GroupProperties } from './group-properties';
import { RootProperties } from './root-properties';

type PropertiesTab = 'properties' | 'diagnostics';
const activeTab = signal<PropertiesTab>('properties');

export function PropertiesPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  if (collapsed) {
    return (
      <button class="properties-toggle-btn" onClick={onToggle} title="Open properties panel">
        ◀
      </button>
    );
  }

  return (
    <div class="studio-properties">
      <div class="properties-header">
        <div class="properties-tabs" role="tablist">
          <button
            role="tab"
            class={`properties-tab ${activeTab.value === 'properties' ? 'active' : ''}`}
            onClick={() => { activeTab.value = 'properties'; }}
            aria-selected={activeTab.value === 'properties'}
          >
            Properties
          </button>
          <button
            role="tab"
            class={`properties-tab ${activeTab.value === 'diagnostics' ? 'active' : ''}`}
            onClick={() => { activeTab.value = 'diagnostics'; }}
            aria-selected={activeTab.value === 'diagnostics'}
          >
            Diagnostics
            {diagnosticCounts.value.error > 0 && (
              <span class="diagnostics-badge">{diagnosticCounts.value.error}</span>
            )}
          </button>
        </div>
        <button class="properties-close" onClick={onToggle} title="Close panel">×</button>
      </div>

      <div class="properties-body" role="tabpanel">
        {activeTab.value === 'properties' ? <PropertiesContent /> : <DiagnosticsContent />}
      </div>
    </div>
  );
}

function PropertiesContent() {
  definitionVersion.value; // subscribe to changes
  const path = selectedPath.value;

  if (path === null) {
    return <div class="properties-empty">Select an item to edit its properties</div>;
  }

  if (path === '') {
    return <RootProperties />;
  }

  const found = findItemByKey(path);
  if (!found) {
    return <div class="properties-empty">Item not found</div>;
  }

  const { item } = found;
  if (item.type === 'group') return <GroupProperties item={item} />;
  return <FieldProperties item={item} />;
}

function DiagnosticsContent() {
  const diags = diagnostics.value;
  const counts = diagnosticCounts.value;

  if (diags.length === 0) {
    return (
      <div class="diagnostics-empty">
        <span class="diagnostics-check">✓</span>
        <span>No issues found</span>
      </div>
    );
  }

  return (
    <div class="diagnostics-list">
      <div class="diagnostics-summary">
        {counts.error > 0 && <span class="diagnostics-pill error">{counts.error} errors</span>}
        {counts.warning > 0 && <span class="diagnostics-pill warning">{counts.warning} warnings</span>}
        {counts.info > 0 && <span class="diagnostics-pill info">{counts.info} info</span>}
      </div>
      {diags.map((d, i) => (
        <div
          key={i}
          class="diagnostics-row"
          onClick={() => { if (d.path) selectedPath.value = d.path; }}
        >
          <span class={`diagnostics-icon ${d.severity}`}>
            {d.severity === 'error' ? '●' : d.severity === 'warning' ? '▲' : 'ℹ'}
          </span>
          <div>
            <div class="diagnostics-message">{d.message}</div>
            {d.path && <div class="diagnostics-path">{d.path}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create `form-builder/src/components/properties/field-properties.tsx`**

```tsx
import type { FormspecItem } from 'formspec-engine';
import { updateDefinition, findItemByKey } from '../../state/definition';

export function FieldProperties({ item }: { item: FormspecItem }) {
  function updateField(field: string, value: string) {
    updateDefinition(def => {
      const found = findItemByKey(item.key, def.items);
      if (found) (found.item as any)[field] = value || undefined;
    });
  }

  return (
    <div class="properties-content">
      <div class="property-type-header">
        <span class="tree-node-dot" style={{ background: '#D4A34A', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} />
        Field
      </div>

      <div class="section-title">Identity</div>
      <PropertyRow label="Key">
        <input class="studio-input studio-input-mono" value={item.key} onInput={(e) => updateField('key', (e.target as HTMLInputElement).value)} />
      </PropertyRow>
      <PropertyRow label="Label">
        <input class="studio-input" value={item.label || ''} onInput={(e) => updateField('label', (e.target as HTMLInputElement).value)} />
      </PropertyRow>

      <div class="section-title">Data</div>
      <PropertyRow label="Data Type">
        <select class="studio-select" value={item.dataType || 'string'} onChange={(e) => updateField('dataType', (e.target as HTMLSelectElement).value)}>
          <option value="string">string</option>
          <option value="text">text</option>
          <option value="integer">integer</option>
          <option value="decimal">decimal</option>
          <option value="boolean">boolean</option>
          <option value="date">date</option>
          <option value="dateTime">dateTime</option>
          <option value="time">time</option>
          <option value="choice">choice</option>
          <option value="multiChoice">multiChoice</option>
          <option value="money">money</option>
          <option value="uri">uri</option>
          <option value="attachment">attachment</option>
        </select>
      </PropertyRow>
      <PropertyRow label="Placeholder">
        <input class="studio-input" value={(item as any).placeholder || ''} onInput={(e) => updateField('placeholder', (e.target as HTMLInputElement).value)} />
      </PropertyRow>

      <div class="section-title">Behavior</div>
      <PropertyRow label="Relevant">
        <input class="studio-input studio-input-mono" value={item.relevant || ''} placeholder="FEL expression" onInput={(e) => updateField('relevant', (e.target as HTMLInputElement).value)} />
      </PropertyRow>
      <PropertyRow label="Required">
        <input class="studio-input studio-input-mono" value={typeof item.required === 'string' ? item.required : ''} placeholder="FEL expression or true()" onInput={(e) => updateField('required', (e.target as HTMLInputElement).value)} />
      </PropertyRow>
      <PropertyRow label="Read Only">
        <input class="studio-input studio-input-mono" value={typeof item.readonly === 'string' ? item.readonly : ''} placeholder="FEL expression" onInput={(e) => updateField('readonly', (e.target as HTMLInputElement).value)} />
      </PropertyRow>
      <PropertyRow label="Calculate">
        <input class="studio-input studio-input-mono" value={item.calculate || ''} placeholder="FEL expression" onInput={(e) => updateField('calculate', (e.target as HTMLInputElement).value)} />
      </PropertyRow>

      <div class="section-title">Validation</div>
      <PropertyRow label="Constraint">
        <input class="studio-input studio-input-mono" value={item.constraint || ''} placeholder="FEL expression" onInput={(e) => updateField('constraint', (e.target as HTMLInputElement).value)} />
      </PropertyRow>
      <PropertyRow label="Message">
        <input class="studio-input" value={item.message || ''} placeholder="Validation error message" onInput={(e) => updateField('message', (e.target as HTMLInputElement).value)} />
      </PropertyRow>
    </div>
  );
}

function PropertyRow({ label, children }: { label: string; children: any }) {
  return (
    <div class="property-row">
      <label class="property-label">{label}</label>
      {children}
    </div>
  );
}
```

**Step 3: Create `group-properties.tsx` and `root-properties.tsx`**

`group-properties.tsx` — same pattern as field but with group-relevant fields (key, label, relevant, readonly, repeatable, minRepeat, maxRepeat).

`root-properties.tsx` — form metadata fields (url, title, version, description, status).

**Step 4: Add properties CSS to `styles.css`**

```css
/* ── Properties panel ── */
.properties-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-0);
  padding: 0 8px;
  flex-shrink: 0;
}

.properties-tabs {
  display: flex;
  flex: 1;
}

.properties-tab {
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--text-2);
  cursor: pointer;
  font: 500 11.5px var(--font-ui);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.properties-tab.active {
  color: var(--text-0);
  border-bottom-color: var(--accent);
}

.properties-close {
  background: none;
  border: none;
  color: var(--text-2);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}

.properties-close:hover { color: var(--text-0); }

.properties-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.properties-empty {
  color: var(--text-2);
  text-align: center;
  padding: 32px 16px;
  font-size: 12.5px;
}

.properties-content { display: flex; flex-direction: column; gap: 8px; }

.property-type-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font: 600 13px var(--font-ui);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-0);
  margin-bottom: 4px;
}

.property-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.property-label {
  font: 500 11.5px var(--font-ui);
  color: var(--text-1);
}

.properties-toggle-btn {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-right: none;
  border-radius: 6px 0 0 6px;
  color: var(--text-2);
  cursor: pointer;
  padding: 8px 4px;
  font-size: 10px;
  z-index: 10;
}

.properties-toggle-btn:hover { color: var(--text-0); background: var(--bg-3); }

/* ── Diagnostics ── */
.diagnostics-empty {
  color: var(--text-2);
  text-align: center;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.diagnostics-check { font-size: 24px; color: var(--success); }

.diagnostics-summary {
  display: flex;
  gap: 8px;
  padding-bottom: 8px;
}

.diagnostics-pill {
  font: 600 11px var(--font-ui);
  padding: 2px 8px;
  border-radius: 4px;
}

.diagnostics-pill.error { background: rgba(218, 54, 51, 0.15); color: var(--error); }
.diagnostics-pill.warning { background: rgba(210, 153, 34, 0.12); color: var(--warning); }
.diagnostics-pill.info { background: rgba(88, 166, 255, 0.12); color: var(--info); }

.diagnostics-row {
  display: flex;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 4px;
  cursor: pointer;
}

.diagnostics-row:hover { background: var(--bg-2); }

.diagnostics-icon { font-size: 10px; flex-shrink: 0; padding-top: 2px; }
.diagnostics-icon.error { color: var(--error); }
.diagnostics-icon.warning { color: var(--warning); }
.diagnostics-icon.info { color: var(--info); }

.diagnostics-message { font-size: 12px; color: var(--text-0); }
.diagnostics-path { font: 400 10.5px var(--font-mono); color: var(--text-2); }
```

**Step 5: Wire into `app.tsx`**

Replace the properties placeholder with `<PropertiesPanel>`. Add a collapsed state signal to `app.tsx`.

**Step 6: Verify in browser**

Expected: Selecting a tree node populates Properties tab with editable fields. Editing a field updates the definition (tree re-renders). Diagnostics tab shows engine validation results. Empty selection shows "Select an item" message.

**Step 7: Commit**

```bash
git add form-builder/src/components/properties/ form-builder/styles.css form-builder/src/app.tsx
git commit -m "feat(studio): add properties panel with field/group/root editing and diagnostics"
```

---

## Task 9: JSON Editor Mode

**Files:**
- Create: `form-builder/src/components/json-editor.tsx`
- Modify: `form-builder/src/app.tsx`

**Step 1: Create `form-builder/src/components/json-editor.tsx`**

```tsx
import { signal } from '@preact/signals';
import { definition, setDefinition, definitionVersion } from '../state/definition';

export function JsonEditor() {
  // Initialize from current definition
  definitionVersion.value; // subscribe
  const jsonText = signal(JSON.stringify(definition.value, null, 2));
  const status = signal<'ok' | 'error' | 'applied'>('ok');
  const errorMessage = signal('');

  function handleApply() {
    try {
      const parsed = JSON.parse(jsonText.value);
      setDefinition(parsed);
      status.value = 'applied';
      setTimeout(() => { status.value = 'ok'; }, 2000);
    } catch (e) {
      status.value = 'error';
      errorMessage.value = (e as Error).message;
    }
  }

  return (
    <div class="json-editor">
      <textarea
        class="json-editor-textarea"
        value={jsonText.value}
        onInput={(e) => {
          jsonText.value = (e.target as HTMLTextAreaElement).value;
          status.value = 'ok';
        }}
        spellcheck={false}
      />
      <div class="json-editor-actions">
        <button class="btn-primary" onClick={handleApply}>Apply Changes</button>
        <span class={`json-editor-status ${status.value}`}>
          {status.value === 'applied' && '✓ Applied'}
          {status.value === 'error' && `✗ ${errorMessage.value}`}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Add JSON editor CSS**

```css
/* ── JSON Editor ── */
.json-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.json-editor-textarea {
  flex: 1;
  background: var(--bg-1);
  border: none;
  color: var(--text-0);
  font: 400 12.5px/1.6 var(--font-mono);
  padding: 16px;
  resize: none;
  outline: none;
  tab-size: 2;
}

.json-editor-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--bg-1);
  border-top: 1px solid var(--border-0);
}

.json-editor-status {
  font: 400 12px var(--font-ui);
}

.json-editor-status.applied { color: var(--success); }
.json-editor-status.error { color: var(--error); }
```

**Step 3: Add mode toggle to editor area in `app.tsx`**

Add a mode toggle bar above the tree/JSON editor. When `editorMode` is `'guided'`, show `<TreeEditor>`. When `'json'`, show `<JsonEditor>`.

```tsx
<div class="editor-mode-bar">
  <button class={editorMode.value === 'guided' ? 'active' : ''} onClick={() => editorMode.value = 'guided'}>
    Guided
  </button>
  <button class={editorMode.value === 'json' ? 'active' : ''} onClick={() => editorMode.value = 'json'}>
    JSON
  </button>
</div>
```

**Step 4: Add mode toggle CSS**

```css
.editor-mode-bar {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-0);
  flex-shrink: 0;
}

.editor-mode-bar button {
  background: none;
  border: none;
  color: var(--text-2);
  cursor: pointer;
  font: 500 12px var(--font-ui);
  padding: 4px 10px;
  border-radius: 4px;
}

.editor-mode-bar button.active {
  background: var(--bg-3);
  color: var(--text-0);
}

.editor-mode-bar button:hover:not(.active) {
  color: var(--text-1);
}
```

**Step 5: Verify**

Expected: Toggle between Guided (tree) and JSON (textarea). Editing JSON and clicking Apply updates the tree. Editing in the tree and switching to JSON shows the updated definition.

**Step 6: Commit**

```bash
git add form-builder/src/components/json-editor.tsx form-builder/styles.css form-builder/src/app.tsx
git commit -m "feat(studio): add JSON editor mode with apply/revert"
```

---

## Task 10: Drag-and-Drop Reorder

**Files:**
- Create: `form-builder/src/components/tree/drag-drop.ts`
- Modify: `form-builder/src/components/tree/tree-node.tsx`

This task adds drag-and-drop reordering to the tree. Nodes can be dragged vertically to reorder within the same parent, or dropped onto a group to reparent.

**Step 1: Create `form-builder/src/components/tree/drag-drop.ts`**

Shared drag-and-drop state and logic:

```typescript
import { signal } from '@preact/signals';
import { updateDefinition, findItemByKey } from '../../state/definition';

/** Currently dragged item key. */
export const draggedKey = signal<string | null>(null);

/** Current drop target info. */
export const dropTarget = signal<{
  parentKey: string | null;
  insertIndex: number;
} | null>(null);

/**
 * Execute the drop: move the dragged item to the drop target position.
 */
export function executeDrop() {
  const key = draggedKey.value;
  const target = dropTarget.value;
  if (!key || !target) return;

  updateDefinition(def => {
    // Remove from current position
    const source = findItemByKey(key, def.items);
    if (!source) return;
    const [removed] = source.siblings.splice(source.index, 1);

    // Insert at target position
    if (target.parentKey === null) {
      def.items.splice(target.insertIndex, 0, removed);
    } else {
      const parent = findItemByKey(target.parentKey, def.items);
      if (parent && parent.item.children) {
        parent.item.children.splice(target.insertIndex, 0, removed);
      }
    }
  });

  draggedKey.value = null;
  dropTarget.value = null;
}
```

**Step 2: Update `tree-node.tsx` with drag event handlers**

Add `draggable` to the grip handle. On `dragstart`, set `draggedKey`. Use `dragover`/`drop` on node wrappers to set `dropTarget` and execute.

Add CSS for drag feedback:
- Dragged node: `opacity: 0.6`, elevation shadow
- Drop indicator: horizontal accent line at insertion point
- Group drop target: accent border highlight

**Step 3: Add drag CSS**

```css
.tree-node.dragging { opacity: 0.6; }

.tree-node-wrapper.drop-above::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 2px;
  background: var(--accent);
  z-index: 1;
}

.tree-node-wrapper.drop-below::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 12px;
  right: 12px;
  height: 2px;
  background: var(--accent);
  z-index: 1;
}

.tree-node-wrapper.drop-inside > .tree-node {
  box-shadow: inset 0 0 0 2px var(--accent);
  border-radius: 4px;
}
```

**Step 4: Verify**

Expected: Grab handle appears on hover. Dragging a node shows insertion line. Dropping reorders. Dragging onto a group reparents. Groups move with all children.

**Step 5: Commit**

```bash
git add form-builder/src/components/tree/drag-drop.ts form-builder/src/components/tree/tree-node.tsx form-builder/styles.css
git commit -m "feat(studio): add drag-and-drop reorder for tree nodes"
```

---

## Task 11: Splitter + Panel Collapse

**Files:**
- Create: `form-builder/src/components/splitter.tsx`
- Modify: `form-builder/src/app.tsx`

**Step 1: Create `form-builder/src/components/splitter.tsx`**

A resizable divider between tree and preview panes:

```tsx
import { signal } from '@preact/signals';

export function Splitter({ onResize }: { onResize: (deltaX: number) => void }) {
  const dragging = signal(false);

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    dragging.value = true;
    const startX = e.clientX;

    function handleMouseMove(e: MouseEvent) {
      onResize(e.clientX - startX);
    }

    function handleMouseUp() {
      dragging.value = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  return (
    <div
      class={`studio-splitter ${dragging.value ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onDblClick={() => onResize(0)} // reset to 50/50
    />
  );
}
```

**Step 2: Wire into `app.tsx`**

Add `splitRatio` signal to `app.tsx`. Splitter adjusts ratio. Properties panel has `collapsed` signal. Pass to `<PropertiesPanel collapsed={collapsed} onToggle={...} />`.

**Step 3: Verify**

Expected: Dragging the splitter resizes tree vs preview. Double-click resets to 50/50. Properties panel collapse button works — panel slides away, toggle button appears on edge.

**Step 4: Commit**

```bash
git add form-builder/src/components/splitter.tsx form-builder/src/app.tsx
git commit -m "feat(studio): add resizable splitter and panel collapse"
```

---

## Task 12: Empty Tab States

**Files:**
- Create: `form-builder/src/components/empty-tab.tsx`
- Modify: `form-builder/src/app.tsx`

**Step 1: Create `form-builder/src/components/empty-tab.tsx`**

```tsx
import type { ArtifactKind } from '../types';

const TAB_INFO: Record<string, { icon: string; description: string }> = {
  component: { icon: '◇', description: 'Component documents define how your form renders.' },
  theme: { icon: '◈', description: 'Theme documents control colors, typography, and layout.' },
  mapping: { icon: '⬡', description: 'Mapping documents transform form data to external formats.' },
  registry: { icon: '▢', description: 'Registry documents declare extensions and dependencies.' },
  changelog: { icon: '▤', description: 'Changelog documents track version history.' },
};

export function EmptyTab({ kind }: { kind: ArtifactKind }) {
  const info = TAB_INFO[kind];
  if (!info) return null;

  const title = kind.charAt(0).toUpperCase() + kind.slice(1);

  return (
    <div class="empty-tab">
      <span class="empty-tab-icon">{info.icon}</span>
      <h2 class="empty-tab-title">{title} not configured</h2>
      <p class="empty-tab-desc">{info.description}</p>
      <div class="empty-tab-actions">
        <button class="btn-primary">Create from Scratch</button>
        <button class="btn-ghost">Import JSON</button>
      </div>
    </div>
  );
}
```

**Step 2: Add empty tab CSS**

```css
.empty-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 100%;
  max-width: 360px;
  margin: 0 auto;
  padding: 24px;
  gap: 12px;
}

.empty-tab-icon { font-size: 40px; opacity: 0.3; }
.empty-tab-title { font: 500 18px var(--font-display); color: var(--text-0); }
.empty-tab-desc { font-size: 13px; color: var(--text-2); }
.empty-tab-actions { display: flex; gap: 8px; margin-top: 8px; }
```

**Step 3: Wire into `app.tsx`**

When `activeArtifact` is not `'definition'` and the artifact is null, show `<EmptyTab kind={activeArtifact.value} />` instead of the tree/preview area.

**Step 4: Verify**

Expected: Clicking Component/Theme/etc in sidebar shows the empty state with icon, title, description, and Create/Import buttons.

**Step 5: Commit**

```bash
git add form-builder/src/components/empty-tab.tsx form-builder/styles.css form-builder/src/app.tsx
git commit -m "feat(studio): add empty tab states for optional artifacts"
```

---

## Task 13: Toast Notifications

**Files:**
- Create: `form-builder/src/components/toast.tsx`
- Create: `form-builder/src/state/toast.ts`

**Step 1: Create `form-builder/src/state/toast.ts`**

```typescript
import { signal } from '@preact/signals';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 0;
export const toasts = signal<Toast[]>([]);

export function showToast(message: string, type: Toast['type'] = 'info') {
  const id = nextId++;
  toasts.value = [...toasts.value, { id, message, type }];
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 2800);
}
```

**Step 2: Create `form-builder/src/components/toast.tsx`**

```tsx
import { toasts } from '../state/toast';

export function ToastContainer() {
  return (
    <div class="toast-container">
      {toasts.value.map(toast => (
        <div key={toast.id} class={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Add toast CSS**

```css
.toast-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  z-index: 100;
}

.toast {
  background: var(--bg-3);
  border: 1px solid var(--border-1);
  border-radius: 6px;
  padding: 10px 16px;
  font: 500 12.5px var(--font-ui);
  color: var(--text-0);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  animation: toast-in 250ms var(--ease-out);
  min-width: 200px;
}

.toast-success { border-left: 3px solid var(--success); }
.toast-error { border-left: 3px solid var(--error); }
.toast-info { border-left: 3px solid var(--info); }

@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

**Step 4: Add `<ToastContainer />` to `app.tsx`**

**Step 5: Commit**

```bash
git add form-builder/src/components/toast.tsx form-builder/src/state/toast.ts form-builder/styles.css form-builder/src/app.tsx
git commit -m "feat(studio): add toast notification system"
```

---

## Task 14: Assemble app.tsx

**Files:**
- Modify: `form-builder/src/app.tsx`

This task finalizes `app.tsx` to wire all components together into the working workspace.

**Step 1: Write the complete `app.tsx`**

```tsx
import { signal } from '@preact/signals';
import { Topbar } from './components/topbar';
import { Sidebar } from './components/sidebar';
import { TreeEditor } from './components/tree/tree-editor';
import { JsonEditor } from './components/json-editor';
import { PropertiesPanel } from './components/properties/properties-panel';
import { Splitter } from './components/splitter';
import { EmptyTab } from './components/empty-tab';
import { ToastContainer } from './components/toast';
import { activeArtifact, editorMode, project } from './state/project';
// Import definition state to trigger the engine-rebuild effect
import './state/definition';

const propertiesCollapsed = signal(false);
const splitPercent = signal(50);

export function App() {
  const artifact = activeArtifact.value;
  const isDefinition = artifact === 'definition';
  const artifactData = artifact === 'definition' ? project.value.definition : project.value[artifact];
  const showEditor = isDefinition || artifactData !== null;

  return (
    <div class="studio-root">
      <Topbar />
      <div class="studio-workspace">
        <Sidebar />
        <div class="studio-editor">
          {!showEditor && !isDefinition ? (
            <EmptyTab kind={artifact} />
          ) : (
            <>
              <div class="editor-mode-bar">
                <button class={editorMode.value === 'guided' ? 'active' : ''} onClick={() => { editorMode.value = 'guided'; }}>
                  Guided
                </button>
                <button class={editorMode.value === 'json' ? 'active' : ''} onClick={() => { editorMode.value = 'json'; }}>
                  JSON
                </button>
              </div>
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div class="studio-tree-pane" style={{ flex: `0 0 ${splitPercent.value}%` }}>
                  {editorMode.value === 'guided' ? <TreeEditor /> : <JsonEditor />}
                </div>
                <Splitter onResize={(delta) => {
                  const container = document.querySelector('.studio-editor');
                  if (container) {
                    const newPercent = Math.min(80, Math.max(20, splitPercent.value + (delta / container.clientWidth) * 100));
                    splitPercent.value = newPercent;
                  }
                }} />
                <div class="studio-preview-pane" style={{ flex: 1 }}>
                  <p style={{ color: 'var(--text-2)', padding: '24px', textAlign: 'center' }}>
                    Live Preview (Phase 2)
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
        <PropertiesPanel
          collapsed={propertiesCollapsed.value}
          onToggle={() => { propertiesCollapsed.value = !propertiesCollapsed.value; }}
        />
      </div>
      <ToastContainer />
    </div>
  );
}
```

**Step 2: Verify the full app works end-to-end**

Run: `npm run dev --workspace=formspec-studio`

Expected behaviors:
1. Four-zone layout renders (sidebar, tree+preview, properties)
2. Sidebar tabs switch artifacts. Non-definition tabs show empty state.
3. Tree shows seeded definition items with correct styling
4. Clicking a node selects it (accent highlight, properties populate)
5. Inline add works (hover gap, click, type label, enter)
6. Move up/down and delete work
7. Properties panel edits update the tree
8. JSON mode shows definition JSON; Apply updates tree
9. Diagnostics tab shows engine validation
10. Splitter resizes tree/preview
11. Properties panel collapses/expands

**Step 3: Commit**

```bash
git add form-builder/src/app.tsx
git commit -m "feat(studio): assemble workspace with all Phase 1 components"
```

---

## Task 15: Playwright E2E Tests

**Files:**
- Create: `tests/e2e/playwright/studio/basic-tree.spec.ts`

Write Playwright tests that verify the core Phase 1 functionality.

**Step 1: Write basic tree editor tests**

```typescript
import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://127.0.0.1:8082';

test.describe('Formspec Studio — Tree Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STUDIO_URL);
    await page.waitForSelector('.tree-editor');
  });

  test('renders the seeded definition tree', async ({ page }) => {
    await expect(page.locator('.tree-header-title')).toHaveText('Untitled Form');
    await expect(page.locator('.tree-node')).toHaveCount(3); // group + 2 fields
  });

  test('selecting a node populates properties panel', async ({ page }) => {
    await page.click('.tree-node-label:text("Full Name")');
    await expect(page.locator('.property-type-header')).toContainText('Field');
    await expect(page.locator('.studio-input[value="fullName"]')).toBeVisible();
  });

  test('inline add creates a new field', async ({ page }) => {
    // Click the root-level add button
    await page.click('.tree-add-btn');
    await page.fill('.inline-add-input', 'Phone Number');
    await page.press('.inline-add-input', 'Enter');
    await expect(page.locator('.tree-node-label:text("Phone Number")')).toBeVisible();
  });

  test('mode toggle switches between guided and JSON', async ({ page }) => {
    await page.click('button:text("JSON")');
    await expect(page.locator('.json-editor-textarea')).toBeVisible();
    await page.click('button:text("Guided")');
    await expect(page.locator('.tree-editor')).toBeVisible();
  });

  test('sidebar tab switches to empty state', async ({ page }) => {
    await page.click('.sidebar-tab[title="Component"]');
    await expect(page.locator('.empty-tab-title')).toHaveText('Component not configured');
  });

  test('diagnostics tab shows validation results', async ({ page }) => {
    await page.click('.properties-tab:text("Diagnostics")');
    // The seeded definition should have minimal or no issues
    const panel = page.locator('.properties-body');
    await expect(panel).toBeVisible();
  });
});
```

**Step 2: Add test infrastructure**

Add a Playwright config or script that starts the studio dev server on port 8082 before running tests. You may need to update `playwright.config.ts` to add the studio server, or run it manually.

**Step 3: Run tests**

Run: `npx playwright test tests/e2e/playwright/studio/ --headed`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/e2e/playwright/studio/
git commit -m "test(studio): add Playwright E2E tests for Phase 1 tree editor"
```

---

## Summary

After completing all 15 tasks, Phase 1 delivers:
- Scaffolded Preact + signals + Vite app at `form-builder/`
- Four-zone collapsible workspace (sidebar, tree, preview placeholder, properties)
- Functional tree editor with node rendering, selection, move, delete
- Smart inline add with gap insertion
- Drag-and-drop reorder
- Context-sensitive properties panel (field, group, root editing)
- JSON editor mode with apply
- FormEngine integration with live diagnostics
- Toast notifications
- Empty tab states for optional artifacts
- Playwright E2E test coverage
