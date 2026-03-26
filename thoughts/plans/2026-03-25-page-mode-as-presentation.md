# Page Mode as Presentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Agent roles for each task:**
>
> - **`formspec-craftsman`** — Implement the task (write code, create tests, make them pass). Dispatch via `Agent` tool with `subagent_type: "formspec-specs:formspec-craftsman"`.
> - **`formspec-scout`** — Review completed work (code quality, spec compliance, architecture). Dispatch via `Agent` tool with `subagent_type: "formspec-specs:formspec-scout"`.
> - **`spec-expert`** — Validate spec assumptions, answer questions about normative behavior, resolve ambiguities. Dispatch via `Agent` tool with `subagent_type: "formspec-specs:spec-expert"`.
> - **`test-engineer`** — Review test coverage after craftsman's work (quality, edge cases, missing scenarios, test design). Dispatch via `Agent` tool with `subagent_type: "test-engineer"`.
>
> **Workflow per task:**
>
> 1. `spec-expert` (if needed) — resolve any spec ambiguities before coding
> 2. `formspec-craftsman` — implement with TDD (failing tests → implementation → passing tests)
> 3. `test-engineer` — review test coverage, identify gaps, suggest missing edge cases
> 4. `formspec-craftsman` — fill any test gaps identified by test-engineer
> 5. `formspec-scout` — final review (code quality, spec compliance, architecture)
> 6. Fix scout findings if any, re-review if needed

**Goal:** Deprecate the Wizard component type, move page navigation mode to `formPresentation.pageMode`, rewrite page handlers to write directly to the component tree, and split the PagesTab into three visually distinct mode renderers.

**Architecture:** Component tree always uses `Stack > Page*` regardless of mode. `definition.formPresentation.pageMode` controls navigation behavior (single/wizard/tabs). Page handlers create and manipulate `Page` nodes in the component tree instead of writing to `theme.pages`. The PagesTab renders single mode as an open canvas, wizard mode as a connected step chain, and tabs mode as a tab bar editor.

**Tech Stack:** TypeScript (formspec-core, studio-core, mcp, studio), Rust (formspec-lint), Vitest (unit/integration), Playwright (E2E), Tailwind CSS

**Spec:** `thoughts/specs/2026-03-25-page-mode-as-presentation-design.md`

**Prior art:** `thoughts/studio/2026-03-17-pages-tab-redesign.md` (UX patterns, `buildLabelMap`), `thoughts/studio/2026-03-17-nested-wizard-fix.md` (planner `applyThemePages` guard)

**Worktree:** All work in the existing unified-authoring worktree:

```
.claude/worktrees/unified-authoring/
  Branch: claude/unified-authoring-architecture-msWWJ
```

All file paths relative to worktree root. Commit at each task boundary. Run `npm run build` after schema/type changes.

---

## Execution Status: COMPLETE (2026-03-26)

All 9 milestones complete. 20 commits on branch `claude/unified-authoring-architecture-msWWJ`.

### Final Test Results

| Suite | Result | Notes |
|-------|--------|-------|
| formspec-core | 730/732 | 2 pre-existing (FEL sumWhere, Rust schema cache in worktree) |
| formspec-studio-core | 572/572 | Clean |
| formspec-mcp | 483/483 | Clean |
| formspec-layout | 70/70 | Clean |
| formspec-webcomponent | 246/246 | Clean |
| formspec-studio | 841/849 | 8 pre-existing (7 chat-panel, 1 mapping-tab) |
| Rust workspace | 729/729 | Clean |
| Schema/docs checks | 176/177 | 1 pre-existing FEL registry |
| Dependency fences | Pass | All 10 packages clean |

Zero regressions introduced. All failures are pre-existing.

### Commit History

```
f40676d5 fix(mcp): update structure test to read component tree instead of theme.pages
fd78b70e feat(studio): split PagesTab into mode-specific renderers (single/wizard/tabs)
4634bbfc refactor(lint): remove Wizard from known types, delete E805 rule
d697047a refactor(mcp): update tools for Wizard deprecation
53e3b615 fix(fixtures): migrate example component docs from Wizard to Stack>Page*
a06455c9 refactor(webcomponent): wizard behavior driven by pageMode, not component type
cf1c3f55 refactor(layout): planner produces Stack>Page* instead of Wizard/Tabs roots
70261b21 refactor(studio-core): update page helpers to read/write component tree
cd89e50b feat(core): add Wizard/Tabs root migration on project load
449e6fc8 refactor(core): reconciler always produces Stack root, fix downstream tests
792b5e74 refactor(core): page resolution reads component tree instead of theme.pages
4833f569 refactor(core): delete component.setWizardProperty handler
167fca0c feat(core): rewrite page handlers to write component tree directly
7d61aaf6 feat(core): add component-tree-based page resolution query
ad546780 build: regenerate types and artifacts after Wizard deprecation
91035765 feat(schema): deprecate Wizard component type
c02d5c86 feat(schema): add wizard/tabs navigation properties to formPresentation
```

### Remaining Work (not in this plan)

- Spec prose changes (component-spec.md §5.1, §5.4, §6.2, §12.1, §12.4, Appendix A/B; core spec §4.1.1, new §4.1.2)
- Playwright E2E browser tests for the three visual modes
- Adapters (tailwind/uswds) wizard adapter deprecation cleanup

---

## Test Baselines (before execution)

```bash
cd packages/formspec-core && npx vitest run        # was 676, now 730 pass
cd packages/formspec-studio-core && npx vitest run  # was 552, now 572 pass
cd packages/formspec-mcp && npx vitest run          # was 463, now 483 pass
cd packages/formspec-layout && npx vitest run       # was 70, now 70 pass
```

---

## File Map

### Files Created

| File | Responsibility |
|------|---------------|
| `packages/formspec-core/src/queries/component-page-resolution.ts` | Inspect component tree for Page nodes, return `ResolvedPageStructure` |
| `packages/formspec-core/tests/component-page-resolution.test.ts` | Tests for new resolution |
| `packages/formspec-core/src/handlers/migration.ts` | Migrate Wizard/Tabs root nodes on project load |
| `packages/formspec-core/tests/migration.test.ts` | Migration tests |
| `packages/formspec-studio/src/workspaces/pages/SingleModeCanvas.tsx` | Single mode: full-width GridCanvas editor |
| `packages/formspec-studio/src/workspaces/pages/WizardModeFlow.tsx` | Wizard mode: step chain with connectors |
| `packages/formspec-studio/src/workspaces/pages/WizardStepConnector.tsx` | Vertical line + chevron between wizard steps |
| `packages/formspec-studio/src/workspaces/pages/TabsModeEditor.tsx` | Tabs mode: tab bar + selected panel |
| `packages/formspec-studio/src/workspaces/pages/UnassignedItemsTray.tsx` | Shared unassigned items section |

### Files Modified (key changes only)

| File | Change |
|------|--------|
| `schemas/component.schema.json` | Remove Wizard $def (lines 431-460), remove from AnyComponent.oneOf |
| `schemas/definition.schema.json` | Add showProgress, allowSkip, defaultTab, tabPosition to formPresentation (lines 330-390) |
| `packages/formspec-core/src/handlers/pages.ts` | Rewrite all 13 handlers to write component tree nodes |
| `packages/formspec-core/src/handlers/component-properties.ts` | Delete `component.setWizardProperty` handler (lines 171-179) |
| `packages/formspec-core/src/tree-reconciler.ts` | Remove Wizard from CONTAINER_COMPONENTS (line 24), remove Wizard/Tabs root creation (lines 204-268) |
| `packages/formspec-core/src/page-resolution.ts` | Rewrite to delegate to component-page-resolution |
| `packages/formspec-studio-core/src/project.ts` | Update setFlow (lines 2302-2327), listPages (lines 2241-2252), _PRESENTATION_KEYS (lines 1596-1598) |
| `packages/formspec-layout/src/planner.ts` | Remove wrapPageModePages, simplify applyGeneratedPageMode |
| `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx` | Split into mode-specific renderers |

---

## Milestone 1: Schema & Types (no runtime behavior change)

### Task 1.1: Add formPresentation properties to definition schema

**Files:**

- Modify: `schemas/definition.schema.json:330-390`

- [x] **Step 1: Read the current formPresentation block**

Read `schemas/definition.schema.json` lines 330-390 to see the current shape. Confirm the five existing properties: `pageMode`, `labelPosition`, `density`, `defaultCurrency`, `direction`.

- [x] **Step 2: Add the four new properties**

Add after the existing `direction` property (before `additionalProperties: false`):

```json
"showProgress": {
  "type": "boolean",
  "default": true,
  "description": "Wizard mode: display a step progress indicator."
},
"allowSkip": {
  "type": "boolean",
  "default": false,
  "description": "Wizard mode: allow navigating forward without validating the current page."
},
"defaultTab": {
  "type": "integer",
  "minimum": 0,
  "default": 0,
  "description": "Tabs mode: zero-based index of the initially selected tab."
},
"tabPosition": {
  "type": "string",
  "enum": ["top", "bottom", "left", "right"],
  "default": "top",
  "description": "Tabs mode: position of the tab bar relative to the content."
}
```

- [x] **Step 3: Run schema validation**

Run: `npm run docs:check`
Expected: PASS (new properties are additive, no contracts broken)

- [x] **Step 4: Commit**

```bash
git add schemas/definition.schema.json
git commit -m "feat(schema): add wizard/tabs navigation properties to formPresentation"
```

### Task 1.2: Remove Wizard from component schema

**Files:**

- Modify: `schemas/component.schema.json`

- [x] **Step 1: Read the Wizard definition and AnyComponent.oneOf**

Read `schemas/component.schema.json` lines 274-311 (AnyComponent.oneOf) and lines 431-460 (Wizard $def). Note the exact entries to remove.

- [x] **Step 2: Remove the Wizard $def**

Delete the entire `"Wizard"` definition from `$defs` (lines 431-460).

- [x] **Step 3: Remove Wizard from AnyComponent.oneOf**

Remove the `{ "$ref": "#/$defs/Wizard" }` entry from the `oneOf` array (around line 278).

- [x] **Step 4: Remove Wizard from CustomComponentRef exclusion list**

Find the `"not"` enum in `CustomComponentRef` that lists reserved names. Remove `"Wizard"` from that enum.

- [x] **Step 5: Run schema validation**

Run: `npm run docs:check`
Expected: May show warnings about removed type. Fix any reference issues.

- [x] **Step 6: Commit**

```bash
git add schemas/component.schema.json
git commit -m "feat(schema): deprecate Wizard component type"
```

### Task 1.3: Regenerate types and artifacts

**Files:**

- Modify: `packages/formspec-types/src/generated/component.ts` (auto-generated)
- Modify: `packages/formspec-types/src/widget-vocabulary.ts`

- [x] **Step 1: Regenerate all artifacts**

Run: `npm run docs:generate`
This regenerates `.llm.md` files, type definitions, and cross-references.

- [x] **Step 2: Remove Wizard from KNOWN_COMPONENT_TYPES**

In `packages/formspec-types/src/widget-vocabulary.ts`, find the `KNOWN_COMPONENT_TYPES` set and remove `'Wizard'`.

- [x] **Step 3: Build to verify type changes compile**

Run: `npm run build`
Expected: Build failures in files that reference `Wizard` type. This is expected — we fix them in later tasks. The types package itself should compile.

- [x] **Step 4: Commit**

```bash
git add packages/formspec-types/ specs/ schemas/
git commit -m "build: regenerate types and artifacts after Wizard deprecation"
```

---

## Milestone 2: Core Backend — New Page Resolution (the read path)

Build the new resolution that reads page structure from the component tree BEFORE rewriting the handlers. This lets us test the read path independently.

### Task 2.1: Create component-page-resolution query

**Files:**

- Create: `packages/formspec-core/src/queries/component-page-resolution.ts`
- Create: `packages/formspec-core/tests/component-page-resolution.test.ts`

- [x] **Step 1: Write failing tests for the new resolution**

The tests construct component trees directly (no theme.pages) and verify the resolution output matches `ResolvedPageStructure` shape.

```typescript
// packages/formspec-core/tests/component-page-resolution.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePageStructureFromTree } from '../src/queries/component-page-resolution';

describe('resolvePageStructureFromTree', () => {
  it('returns single mode with no pages when root Stack has no Page children', () => {
    const tree = {
      component: 'Stack', nodeId: 'root',
      children: [
        { component: 'TextInput', bind: 'name' },
        { component: 'TextInput', bind: 'email' },
      ],
    };
    const result = resolvePageStructureFromTree(tree, 'single', ['name', 'email']);
    expect(result.mode).toBe('single');
    expect(result.pages).toHaveLength(0);
    expect(result.unassignedItems).toEqual(['name', 'email']);
  });

  it('returns pages from Page children of root Stack', () => {
    const tree = {
      component: 'Stack', nodeId: 'root',
      children: [
        {
          component: 'Page', nodeId: 'page-1', title: 'Contact',
          children: [{ component: 'TextInput', bind: 'name' }],
        },
        {
          component: 'Page', nodeId: 'page-2', title: 'Address',
          children: [{ component: 'TextInput', bind: 'street' }],
        },
      ],
    };
    const result = resolvePageStructureFromTree(tree, 'wizard', ['name', 'street', 'email']);
    expect(result.mode).toBe('wizard');
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].id).toBe('page-1');
    expect(result.pages[0].title).toBe('Contact');
    expect(result.pages[0].regions).toHaveLength(1);
    expect(result.pages[0].regions[0].key).toBe('name');
    expect(result.unassignedItems).toEqual(['email']);
  });

  it('handles nested bound items inside layout containers within Pages', () => {
    const tree = {
      component: 'Stack', nodeId: 'root',
      children: [{
        component: 'Page', nodeId: 'p1', title: 'P1',
        children: [{
          component: 'Stack', nodeId: 'layout-1', direction: 'horizontal',
          children: [
            { component: 'TextInput', bind: 'first' },
            { component: 'TextInput', bind: 'last' },
          ],
        }],
      }],
    };
    const result = resolvePageStructureFromTree(tree, 'wizard', ['first', 'last']);
    expect(result.pages[0].regions).toHaveLength(2);
    expect(result.pages[0].regions.map(r => r.key)).toEqual(['first', 'last']);
  });

  it('reports items not in any Page as unassigned', () => {
    const tree = {
      component: 'Stack', nodeId: 'root',
      children: [
        { component: 'Page', nodeId: 'p1', title: 'P1', children: [{ component: 'TextInput', bind: 'a' }] },
        { component: 'TextInput', bind: 'orphan' },
      ],
    };
    const result = resolvePageStructureFromTree(tree, 'wizard', ['a', 'orphan']);
    expect(result.unassignedItems).toEqual(['orphan']);
  });

  it('returns empty pages array and all items unassigned when root has no Page children in single mode', () => {
    const tree = {
      component: 'Stack', nodeId: 'root',
      children: [
        { component: 'TextInput', bind: 'x' },
      ],
    };
    const result = resolvePageStructureFromTree(tree, 'single', ['x']);
    expect(result.pages).toHaveLength(0);
    expect(result.unassignedItems).toEqual(['x']);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-core && npx vitest run tests/component-page-resolution.test.ts`
Expected: FAIL — module not found

- [x] **Step 3: Implement resolvePageStructureFromTree**

```typescript
// packages/formspec-core/src/queries/component-page-resolution.ts
import type { ResolvedPageStructure, ResolvedPage, ResolvedRegion } from '../page-resolution';

/** Walk a subtree and collect all bound keys. */
function collectBoundKeys(node: any): string[] {
  const keys: string[] = [];
  if (node.bind) keys.push(node.bind);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      keys.push(...collectBoundKeys(child));
    }
  }
  return keys;
}

/**
 * Resolve page structure from a component tree instead of theme.pages.
 * Looks for Page children of the root Stack and extracts bound items.
 */
export function resolvePageStructureFromTree(
  tree: any,
  pageMode: 'single' | 'wizard' | 'tabs',
  allItemKeys: string[],
): ResolvedPageStructure {
  const pages: ResolvedPage[] = [];
  const assignedKeys = new Set<string>();

  if (tree && Array.isArray(tree.children)) {
    for (const child of tree.children) {
      if (child.component === 'Page') {
        const boundKeys = collectBoundKeys(child);
        for (const k of boundKeys) assignedKeys.add(k);

        const regions: ResolvedRegion[] = boundKeys.map((key) => ({
          key,
          span: 12,
          exists: allItemKeys.includes(key),
        }));

        pages.push({
          id: child.nodeId ?? child.id ?? `page-${pages.length}`,
          title: child.title ?? '',
          description: child.description,
          regions,
        });
      }
    }
  }

  const unassignedItems = allItemKeys.filter((k) => !assignedKeys.has(k));

  return {
    mode: pageMode,
    pages,
    diagnostics: [],
    unassignedItems,
    itemPageMap: Object.fromEntries(
      pages.flatMap((p) => p.regions.map((r) => [r.key, p.id])),
    ),
  };
}
```

Note: `ResolvedPageStructure`, `ResolvedPage`, and `ResolvedRegion` types are already exported from `page-resolution.ts`. If they are not, extract them into a shared types file.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-core && npx vitest run tests/component-page-resolution.test.ts`
Expected: PASS

- [x] **Step 5: Add edge case tests**

Add tests for: empty tree (null/undefined), Page with no children, Page with `description`, deeply nested bound items (3+ levels), mixed Page and non-Page children. Run and verify all pass.

- [x] **Step 6: Commit**

```bash
git add packages/formspec-core/src/queries/component-page-resolution.ts packages/formspec-core/tests/component-page-resolution.test.ts
git commit -m "feat(core): add component-tree-based page resolution query"
```

---

## Milestone 3: Core Backend — Rewrite Page Handlers (the write path)

### Task 3.1: Rewrite page handlers to write component tree

This is the root domino. All 13 `pages.*` handlers are rewritten to manipulate the component tree instead of `theme.pages`.

**Files:**

- Modify: `packages/formspec-core/src/handlers/pages.ts`
- Modify: `packages/formspec-core/tests/pages-handlers.test.ts`

- [x] **Step 1: Read the current handler implementations**

Read `packages/formspec-core/src/handlers/pages.ts` (full file) and `packages/formspec-core/tests/pages-handlers.test.ts` (first 100 lines to understand test patterns).

- [x] **Step 2: Read the component tree handler patterns**

Read `packages/formspec-core/src/handlers/component-tree.ts` lines 93-128 (`component.addNode`) and `packages/formspec-core/src/handlers/tree-utils.ts` to understand `findNode`, `TreeNode`, and `NodeRef` patterns.

- [x] **Step 3: Rewrite the test file — RED phase**

Rewrite `pages-handlers.test.ts` so every assertion reads from the component tree (via `state.generatedComponent.tree` or `getEditableComponentDocument()`) instead of `state.theme.pages`. Each test should:
- Assert that Page nodes exist as children of the root Stack
- Assert Page properties (title, description, nodeId)
- Assert bound item placement within Page children
- Assert mode stored in `state.definition.formPresentation.pageMode`

Key test cases to cover (all 13 handlers):
- `pages.addPage` creates a Page node under root Stack
- `pages.addPage` auto-promotes pageMode from single to wizard
- `pages.deletePage` removes the Page node
- `pages.setMode` sets `formPresentation.pageMode` (no tree restructuring)
- `pages.assignItem` moves a bound node into a Page
- `pages.unassignItem` moves a bound node out of a Page to root
- `pages.reorderPages` swaps Page node positions
- `pages.movePageToIndex` moves Page to specific position
- `pages.setPageProperty` sets title/description on Page node
- `pages.autoGenerate` creates Page nodes from definition group hints
- `pages.setPages` bulk replaces Page nodes in tree
- `pages.reorderRegion` reorders an item within a Page
- `pages.setRegionProperty` sets grid layout properties on a bound item within a Page
- `pages.renamePage` updates the title property (NOT nodeId — this is a semantic change from the current handler which renames the structural ID)

**Semantic change: `pages.renamePage`** — currently renames `page.id` (structural ID). New behavior renames `page.title` (display name). Studio-core's `renamePage` helper must be updated to match (Task 5.2). If structural ID renaming is needed, use `component.setNodeProperty({ ref: { nodeId }, property: 'nodeId', value: newId })` directly — but note this breaks undo history references.

**Grid layout properties (`span`, `start`, `responsive`)** — In the new model, these are stored as properties on the bound item nodes within a Page. `pages.setRegionProperty` sets these properties using `component.setNodeProperty` or `component.setResponsiveOverride`. The bound node itself carries `span`, `start`, and `responsive` as top-level properties (same as how TreeNode stores arbitrary props via `[key: string]: unknown`).

**Direct tree manipulation vs dispatching component.* commands** — Page handlers mutate the tree directly (not dispatching `component.*` sub-commands). This preserves the single-undo-entry-per-pages-command model. Each `pages.*` dispatch is one undo step, not N sub-steps. The `_layout: true` flag must be set manually on Page nodes since we bypass `component.addNode`.

Run tests: all should FAIL (handlers still write to theme.pages).

- [x] **Step 4: Rewrite the handlers — GREEN phase**

Rewrite `pages.ts`. Key patterns:

```typescript
// Helper: get the editable component tree root
function getRoot(state: ProjectState): TreeNode {
  const doc = getEditableComponentDocument(state);
  if (!doc?.tree) throw new Error('No component tree');
  return doc.tree as TreeNode;
}

// Helper: find a Page node by nodeId
function findPage(root: TreeNode, pageId: string): TreeNode | undefined {
  return root.children?.find(c => c.component === 'Page' && c.nodeId === pageId);
}

// pages.addPage
'pages.addPage': (state, payload) => {
  const { id, title, description } = payload;
  const root = getRoot(state);
  const pageId = id ?? `page-${Date.now()}`;
  const page: TreeNode = {
    component: 'Page',
    nodeId: pageId,
    title: title ?? 'New Page',
    _layout: true,
    children: [],
  };
  if (description) page.description = description;
  if (!root.children) root.children = [];
  root.children.push(page);

  // Auto-promote to wizard if currently single
  if (!state.definition.formPresentation?.pageMode || state.definition.formPresentation.pageMode === 'single') {
    state.definition.formPresentation = state.definition.formPresentation ?? {};
    state.definition.formPresentation.pageMode = 'wizard';
  }
  return { rebuildComponentTree: false };
},

// pages.setMode — one-liner now
'pages.setMode': (state, payload) => {
  state.definition.formPresentation = state.definition.formPresentation ?? {};
  state.definition.formPresentation.pageMode = payload.mode;
  return { rebuildComponentTree: false };
},
```

Each handler follows the same pattern: read/mutate the component tree directly, return `{ rebuildComponentTree: false }`.

**Critical: `pages.autoGenerate` must:**
1. Clear existing Page children from root
2. Read definition items for `presentation.layout.page` hints
3. Group items by page hint
4. Create Page nodes with bound item children
5. Auto-promote pageMode to wizard

- [x] **Step 5: Run tests to verify they pass**

Run: `cd packages/formspec-core && npx vitest run tests/pages-handlers.test.ts`
Expected: PASS

- [x] **Step 6: Run full core test suite to check for regressions**

Run: `cd packages/formspec-core && npx vitest run`
Expected: Some failures in `page-resolution.test.ts`, `page-aware-rebuild.test.ts` — these still read theme.pages. That's expected; we fix them in the next tasks. `pages-handlers.test.ts` should be all green.

- [x] **Step 7: Commit**

```bash
git add packages/formspec-core/src/handlers/pages.ts packages/formspec-core/tests/pages-handlers.test.ts
git commit -m "feat(core): rewrite page handlers to write component tree directly"
```

### Task 3.2: Delete component.setWizardProperty handler

**Files:**

- Modify: `packages/formspec-core/src/handlers/component-properties.ts:171-179`
- Modify: `packages/formspec-core/tests/component-properties.test.ts`

- [x] **Step 1: Delete the handler**

Remove the `'component.setWizardProperty'` handler from `component-properties.ts` (lines 171-179).

- [x] **Step 2: Update tests**

Remove or update tests in `component-properties.test.ts` that reference `component.setWizardProperty`. These tests should be deleted since the handler no longer exists.

- [x] **Step 3: Run tests**

Run: `cd packages/formspec-core && npx vitest run tests/component-properties.test.ts`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add packages/formspec-core/src/handlers/component-properties.ts packages/formspec-core/tests/component-properties.test.ts
git commit -m "refactor(core): delete component.setWizardProperty handler"
```

---

## Milestone 4: Wire Up Resolution & Reconciler

### Task 4.1: Rewrite page-resolution to use component tree

**Files:**

- Modify: `packages/formspec-core/src/page-resolution.ts`
- Modify: `packages/formspec-core/tests/page-resolution.test.ts`

- [x] **Step 1: Rewrite page-resolution.ts**

Change `resolvePageStructure` to read from the component tree (via `getEditableComponentDocument` or a passed-in tree) instead of `theme.pages`. Delegate to the new `resolvePageStructureFromTree`. Signature stays the same for backward compatibility — just change the internal data source.

- [x] **Step 2: Rewrite tests**

Update `page-resolution.test.ts`: construct test state with component trees containing Page nodes instead of theme.pages arrays.

- [x] **Step 3: Run tests**

Run: `cd packages/formspec-core && npx vitest run tests/page-resolution.test.ts`
Expected: PASS

- [x] **Step 4: Update page-view-resolution source and tests**

Update `packages/formspec-core/src/queries/page-view-resolution.ts`: the `PageViewInput` type includes `theme: Pick<ThemeDocument, 'pages'>` — change to accept a component tree (or read it from the full state). Update `resolvePageView` to pass the component tree to `resolvePageStructure`.

Update `page-view-resolution.test.ts` similarly — construct state with component trees.

Run: `cd packages/formspec-core && npx vitest run tests/page-view-resolution.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/formspec-core/src/page-resolution.ts packages/formspec-core/tests/page-resolution.test.ts packages/formspec-core/tests/page-view-resolution.test.ts
git commit -m "refactor(core): page resolution reads component tree instead of theme.pages"
```

### Task 4.2: Update tree reconciler

**Files:**

- Modify: `packages/formspec-core/src/tree-reconciler.ts`
- Modify: `packages/formspec-core/tests/tree-reconciler.test.ts`
- Modify: `packages/formspec-core/tests/page-aware-rebuild.test.ts`

- [x] **Step 1: Remove Wizard from CONTAINER_COMPONENTS**

At line 24, remove `'Wizard'` from the set. Keep `'Tabs'` (stays as layout component).

- [x] **Step 2: Remove the Wizard/Tabs root creation branch**

Remove the `if (pageMode === 'wizard')` / `else` branch at lines ~244-265 that creates `Wizard` or `Tabs` root nodes. The root is always `Stack`.

The page-aware distribution logic (assigning items to Pages based on theme.pages) can also be removed — page assignment is now handled by `pages.assignItem` writing directly to the tree.

- [x] **Step 3: Ensure Page nodes with `_layout: true` are preserved**

Verify that the existing `_layout` snapshot/restore mechanism (lines 77-96, 270-321) correctly preserves Page nodes. Page nodes created by `pages.addPage` will have `_layout: true` set by `component.addNode`. The `updateWrapperChildren` function at line 287 will correctly handle bound children within Pages — looking them up in the rebuilt tree and extracting them back.

No code changes needed for this step — just verify the existing mechanism works.

- [x] **Step 4: Update tests**

Rewrite `tree-reconciler.test.ts` tests that assert `Wizard` or `Tabs` root types. These should now expect `Stack` roots with `Page` children.

Rewrite `page-aware-rebuild.test.ts` — these tests verify that definition item changes preserve page structure. They should construct component trees with `Page` nodes (marked `_layout: true`) and verify that adding/removing definition items preserves the Page wrappers.

- [x] **Step 5: Run tests**

Run: `cd packages/formspec-core && npx vitest run tests/tree-reconciler.test.ts tests/page-aware-rebuild.test.ts`
Expected: PASS

- [x] **Step 6: Run full core suite**

Run: `cd packages/formspec-core && npx vitest run`
Expected: ALL PASS (all core tests should now be green)

- [x] **Step 7: Commit**

```bash
git add packages/formspec-core/src/tree-reconciler.ts packages/formspec-core/tests/tree-reconciler.test.ts packages/formspec-core/tests/page-aware-rebuild.test.ts
git commit -m "refactor(core): reconciler always produces Stack root, preserves Page nodes via _layout"
```

---

## Milestone 5: Migration & Studio-Core

### Task 5.1: Add Wizard/Tabs root migration

**Files:**

- Create: `packages/formspec-core/src/handlers/migration.ts`
- Create: `packages/formspec-core/tests/migration.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// packages/formspec-core/tests/migration.test.ts
import { describe, it, expect } from 'vitest';
import { migrateWizardRoot } from '../src/handlers/migration';

describe('migrateWizardRoot', () => {
  it('rewrites Wizard root to Stack, preserving Page children', () => {
    const tree = {
      component: 'Wizard', nodeId: 'root', showProgress: true, allowSkip: false,
      children: [
        { component: 'Page', nodeId: 'p1', title: 'Step 1', children: [] },
        { component: 'Page', nodeId: 'p2', title: 'Step 2', children: [] },
      ],
    };
    const result = migrateWizardRoot(tree);
    expect(result.tree.component).toBe('Stack');
    expect(result.tree.children).toHaveLength(2);
    expect(result.tree.children[0].component).toBe('Page');
    expect(result.migratedProps).toEqual({ showProgress: true, allowSkip: false });
    expect(result.migratedMode).toBe('wizard');
  });

  it('rewrites Tabs root to Stack, renames position to tabPosition', () => {
    const tree = {
      component: 'Tabs', nodeId: 'root', position: 'left', defaultTab: 1,
      children: [
        { component: 'Page', nodeId: 'p1', title: 'Tab 1', children: [] },
      ],
    };
    const result = migrateWizardRoot(tree);
    expect(result.tree.component).toBe('Stack');
    expect(result.migratedProps).toEqual({ tabPosition: 'left', defaultTab: 1 });
    expect(result.migratedMode).toBe('tabs');
  });

  it('returns null for Stack root (no migration needed)', () => {
    const tree = { component: 'Stack', nodeId: 'root', children: [] };
    const result = migrateWizardRoot(tree);
    expect(result).toBeNull();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-core && npx vitest run tests/migration.test.ts`
Expected: FAIL

- [x] **Step 3: Implement migrateWizardRoot**

```typescript
// packages/formspec-core/src/handlers/migration.ts
export interface MigrationResult {
  tree: any;
  migratedProps: Record<string, unknown>;
  migratedMode: 'wizard' | 'tabs';
}

export function migrateWizardRoot(tree: any): MigrationResult | null {
  if (!tree || (tree.component !== 'Wizard' && tree.component !== 'Tabs')) return null;

  const migratedProps: Record<string, unknown> = {};
  const migratedMode = tree.component === 'Wizard' ? 'wizard' : 'tabs';

  if (tree.component === 'Wizard') {
    if (tree.showProgress !== undefined) migratedProps.showProgress = tree.showProgress;
    if (tree.allowSkip !== undefined) migratedProps.allowSkip = tree.allowSkip;
  } else {
    if (tree.defaultTab !== undefined) migratedProps.defaultTab = tree.defaultTab;
    if (tree.position !== undefined) migratedProps.tabPosition = tree.position; // rename
  }

  const newTree = {
    component: 'Stack',
    nodeId: tree.nodeId ?? 'root',
    children: tree.children ?? [],
  };

  return { tree: newTree, migratedProps, migratedMode };
}
```

- [x] **Step 4: Run tests**

Run: `cd packages/formspec-core && npx vitest run tests/migration.test.ts`
Expected: PASS

- [x] **Step 5: Integrate into project initialization**

Hook `migrateWizardRoot` into the project load path in `packages/formspec-core/src/raw-project.ts` (or wherever the component state is first accessed). If migration triggers, also set the migrated props on `state.definition.formPresentation`.

- [x] **Step 6: Commit**

```bash
git add packages/formspec-core/src/handlers/migration.ts packages/formspec-core/tests/migration.test.ts
git commit -m "feat(core): add Wizard/Tabs root migration on project load"
```

### Task 5.2: Update studio-core helpers

**Files:**

- Modify: `packages/formspec-studio-core/src/project.ts`
- Modify: `packages/formspec-studio-core/tests/project-methods.test.ts`

- [x] **Step 1: Update `_PRESENTATION_KEYS`**

At lines 1596-1598, add the four new keys:

```typescript
const _PRESENTATION_KEYS = new Set([
  'pageMode', 'labelPosition', 'density', 'defaultCurrency', 'direction',
  'showProgress', 'allowSkip', 'defaultTab', 'tabPosition',
]);
```

- [x] **Step 2: Update `setFlow()`**

At lines 2302-2327, change from dispatching `component.setWizardProperty` to dispatching `definition.setFormPresentation`:

```typescript
setFlow(mode: FlowMode, props?: FlowProps): void {
  this.core.dispatch({ type: 'pages.setMode', payload: { mode } });
  if (props?.showProgress !== undefined) {
    this.core.dispatch({ type: 'definition.setFormPresentation', payload: { property: 'showProgress', value: props.showProgress } });
  }
  if (props?.allowSkip !== undefined) {
    this.core.dispatch({ type: 'definition.setFormPresentation', payload: { property: 'allowSkip', value: props.allowSkip } });
  }
}
```

- [x] **Step 3: Update `listPages()`**

At lines 2241-2252, change from reading `theme.pages` to walking the component tree:

```typescript
listPages(): Array<{ id: string; title: string; description?: string }> {
  const tree = this.core.getEditableComponentDocument()?.tree as any;
  if (!tree?.children) return [];
  return tree.children
    .filter((c: any) => c.component === 'Page')
    .map((c: any) => ({ id: c.nodeId, title: c.title ?? '', description: c.description }));
}
```

- [x] **Step 4: Update `_resolvePageGroup()`**

At line ~464, change from reading `theme.pages` to walking the component tree: find the Page node by nodeId, inspect its first bound child, return the path.

- [x] **Step 5: Update page validation in addField/addGroup/addContent**

Find the `props.page` validation (around lines 524, 679, 749) that checks `theme.pages`. Change to check component tree for Page nodes.

- [x] **Step 6: Update region-based helpers**

The following private helpers all read from `theme.pages` and must be rewritten to read from the component tree:
- `_regionKeyAt` (~line 2698) — find bound item at index within a Page node
- `_regionIndexOf` (~line 2708) — find index of a bound item within a Page node
- `updateRegion`, `deleteRegion`, `reorderRegion` — dispatch to rewritten `pages.*` handlers
- `setItemWidth`, `setItemOffset`, `setItemResponsive` — read/write grid properties on bound nodes
- `removeItemFromPage`, `moveItemToPage`, `moveItemOnPageToIndex` — move bound nodes between Pages

These are ~10 methods in the lines 2620-2840 block of `project.ts`. Each must change from `theme.pages[].regions[]` access to component tree node traversal.

- [x] **Step 7: Update evaluation-helpers.ts**

In `packages/formspec-studio-core/src/evaluation-helpers.ts` at ~line 284, change `bundle.theme?.pages` to read page structure from the component tree. Use `resolvePageStructureFromTree` or walk the tree directly for per-page validation counts.

- [x] **Step 8: Update `renamePage` helper**

The studio-core `renamePage` method dispatches `pages.renamePage` with `{ id, newId }`. Since `pages.renamePage` now changes `title` (not `id`), update the helper's signature from `renamePage(pageId, newId)` to `renamePage(pageId, newTitle)` and update all callers.

- [x] **Step 9: Update tests**

Rewrite page-related assertions in `project-methods.test.ts` to read from the component tree instead of `theme.pages`.

- [x] **Step 6: Run tests**

Run: `cd packages/formspec-studio-core && npx vitest run`
Expected: PASS (all 552+ tests)

- [x] **Step 7: Commit**

```bash
git add packages/formspec-studio-core/src/project.ts packages/formspec-studio-core/tests/project-methods.test.ts
git commit -m "refactor(studio-core): update page helpers to read/write component tree"
```

---

## Milestone 6: Layout Planner & Webcomponent

### Task 6.1: Update layout planner

**Files:**

- Modify: `packages/formspec-layout/src/planner.ts`
- Modify: `packages/formspec-layout/tests/planner.test.ts`

- [x] **Step 1: Read the planner's page-related code**

Read `planner.ts` to understand `wrapPageModePages` (lines ~606-636), `applyGeneratedPageMode` (lines ~638-724), and `applyDefinitionPageMode` (lines ~339-351).

Also read `thoughts/studio/2026-03-17-nested-wizard-fix.md` for the `applyThemePages` guard that must be preserved.

- [x] **Step 2: Refactor `applyGeneratedPageMode` and `applyDefinitionPageMode`**

These functions currently wrap Page nodes in `Wizard` or `Tabs` LayoutNodes. Change them to leave Pages as direct children of the root Stack. The renderer will apply navigation behavior based on `pageMode`.

Remove `wrapPageModePages()` after refactoring its callers.

Remove `Wizard` from `INTERACTIVE_COMPONENTS` set (line 39). Keep the `applyThemePages` guard.

- [x] **Step 3: Update tests**

Rewrite planner tests that assert `Wizard` or `Tabs` root LayoutNodes. They should now expect `Stack > Page*` with `pageMode` metadata.

- [x] **Step 4: Run tests**

Run: `cd packages/formspec-layout && npx vitest run`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/formspec-layout/
git commit -m "refactor(layout): planner produces Stack>Page* instead of Wizard/Tabs roots"
```

### Task 6.2: Move wizard behavior to form-level in webcomponent

**Files:**

- Modify: `packages/formspec-webcomponent/src/components/interactive.ts`
- Modify: `packages/formspec-webcomponent/src/components/index.ts`
- Modify: `packages/formspec-webcomponent/src/element.ts`
- Modify: Multiple behavior/adapter files

- [x] **Step 1: Read the current wizard rendering pipeline**

Read `packages/formspec-webcomponent/src/behaviors/wizard.ts` (the `useWizard` hook), `packages/formspec-webcomponent/src/components/interactive.ts` (the `WizardPlugin`), and `packages/formspec-webcomponent/src/adapters/default/wizard.ts` (the adapter).

- [x] **Step 2: Remove WizardPlugin from component registry**

In `interactive.ts`, remove `WizardPlugin`. In `index.ts`, remove its registration.

- [x] **Step 3: Add form-level page mode handler**

In the root-level rendering path (likely `element.ts` or a new `page-mode.ts`), add logic: when the root Stack has Page children and `formPresentation.pageMode === 'wizard'`, invoke the `useWizard` hook on those Page children. The hook itself stays mostly unchanged — it just gets invoked differently.

For `pageMode === 'tabs'`, the root-level renderer applies tab navigation to Page children. Keep `TabsPlugin` for within-page Tabs (non-root use).

- [x] **Step 4: Update tests**

Update webcomponent tests that create `Wizard` component nodes. They should create `Stack > Page*` with `formPresentation.pageMode: 'wizard'`.

- [x] **Step 5: Run tests**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: PASS

- [x] **Step 6: Run E2E tests**

Run: `npx playwright test tests/e2e/playwright/`
Expected: Some failures in wizard-specific tests — update fixtures.

- [x] **Step 7: Commit**

```bash
git add packages/formspec-webcomponent/
git commit -m "refactor(webcomponent): wizard behavior driven by pageMode, not component type"
```

---

## Milestone 7: Studio UI — Visual Overhaul

### Task 7.1: Extract shared components from PagesTab

**Files:**

- Create: `packages/formspec-studio/src/workspaces/pages/UnassignedItemsTray.tsx`

- [x] **Step 1: Extract UnassignedItemsTray**

Extract the unassigned items section (currently lines 672-690 of PagesTab.tsx) into a standalone component. Props: `items: PlaceableItem[]`, `onAddToPage?: (key: string, pageId: string) => void`.

- [x] **Step 2: Commit**

```bash
git add packages/formspec-studio/src/workspaces/pages/UnassignedItemsTray.tsx
git commit -m "refactor(studio): extract UnassignedItemsTray component"
```

### Task 7.2: Create SingleModeCanvas

**Files:**

- Create: `packages/formspec-studio/src/workspaces/pages/SingleModeCanvas.tsx`

- [x] **Step 1: Implement SingleModeCanvas**

A full-width `GridCanvas` as the primary editing surface. No page cards, no page chrome. Props: items from the root Stack's direct children, all GridCanvas callbacks.

```tsx
// Key structure:
export function SingleModeCanvas({ items, unassigned, actions, hasDormantPages, dormantPageCount }: SingleModeCanvasProps) {
  return (
    <div className="space-y-4">
      {hasDormantPages && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
          <span>{dormantPageCount} pages preserved. Switch to Wizard or Tabs to restore them.</span>
          <button onClick={actions.onFlatten} className="font-semibold underline">Flatten</button>
          <button onClick={actions.onDismiss} className="ml-auto text-muted">Dismiss</button>
        </div>
      )}
      <GridCanvas items={items} activeBreakpoint="base" /* ... full props ... */ />
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add packages/formspec-studio/src/workspaces/pages/SingleModeCanvas.tsx
git commit -m "feat(studio): add SingleModeCanvas component"
```

### Task 7.3: Create WizardModeFlow with step connectors

**Files:**

- Create: `packages/formspec-studio/src/workspaces/pages/WizardStepConnector.tsx`
- Create: `packages/formspec-studio/src/workspaces/pages/WizardModeFlow.tsx`

- [x] **Step 1: Create WizardStepConnector**

```tsx
export function WizardStepConnector() {
  return (
    <div className="flex h-10 items-center justify-center" aria-hidden="true">
      <div className="relative h-full w-px bg-border">
        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted" width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Create WizardModeFlow**

Renders SortablePageCards with step connectors between them. Each card gets a prominent circular step number (`w-7 h-7 rounded-full bg-ink text-white`). Includes a dashed "add step" terminus at the bottom.

Uses the existing `DragDropProvider` and `SortablePageCard` patterns from current PagesTab, but with the visual enhancements.

- [x] **Step 3: Commit**

```bash
git add packages/formspec-studio/src/workspaces/pages/WizardStepConnector.tsx packages/formspec-studio/src/workspaces/pages/WizardModeFlow.tsx
git commit -m "feat(studio): add WizardModeFlow with step connectors"
```

### Task 7.4: Create TabsModeEditor

**Files:**

- Create: `packages/formspec-studio/src/workspaces/pages/TabsModeEditor.tsx`

- [x] **Step 1: Implement TabsModeEditor**

A horizontal tab bar showing page titles with the selected tab's content below. Key features:
- `role="tablist"` with proper ARIA (`role="tab"`, `aria-selected`, `aria-controls`)
- Arrow key navigation between tabs
- Selected tab underline: `border-b-2 border-b-accent`
- `+` add button at end of tab row
- Double-click tab label to rename
- One page's GridCanvas visible at a time

```tsx
export function TabsModeEditor({ pages, unassigned, actions }: TabsModeEditorProps) {
  const [selectedTabId, setSelectedTabId] = useState<string>(pages[0]?.id ?? '');
  const selectedPage = pages.find(p => p.id === selectedTabId) ?? pages[0];
  // ... render tab bar + selected panel
}
```

- [x] **Step 2: Commit**

```bash
git add packages/formspec-studio/src/workspaces/pages/TabsModeEditor.tsx
git commit -m "feat(studio): add TabsModeEditor with tab bar"
```

### Task 7.5: Integrate mode-specific renderers into PagesTab

**Files:**

- Modify: `packages/formspec-studio/src/workspaces/pages/PagesTab.tsx`

- [x] **Step 1: Replace the monolithic page card list with mode dispatch**

```tsx
export function PagesTab() {
  const project = useProject();
  const structure = usePageStructure();
  // ... shared state ...

  return (
    <WorkspacePage maxWidth="max-w-[980px]" className="overflow-y-auto">
      <WorkspacePageSection /* sticky header with ModeSelector */ >
        {/* ... ModeSelector stays ... */}
      </WorkspacePageSection>

      <WorkspacePageSection className="py-6">
        {structure.mode === 'single' && (
          <SingleModeCanvas items={structure.singleModeItems} /* ... */ />
        )}
        {structure.mode === 'wizard' && (
          <WizardModeFlow pages={structure.pages} unassigned={structure.unassigned} /* ... */ />
        )}
        {structure.mode === 'tabs' && (
          <TabsModeEditor pages={structure.pages} unassigned={structure.unassigned} /* ... */ />
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
```

- [x] **Step 2: Remove dormant/isDormant logic**

Single mode is no longer dormant — it has its own active editing surface. Remove all `isDormant` conditionals, dormant badges, and dormant warning banners. Single mode items are editable.

- [x] **Step 3: Run studio E2E tests**

Run: `cd packages/formspec-studio && npx vitest run` and `npx playwright test packages/formspec-studio/tests/e2e/playwright/`
Expected: Some tests need updating for new mode visuals.

- [x] **Step 4: Commit**

```bash
git add packages/formspec-studio/src/workspaces/pages/
git commit -m "feat(studio): split PagesTab into mode-specific renderers (single/wizard/tabs)"
```

---

## Milestone 8: Fixtures, MCP, & Rust Linter

### Task 8.1: Update example fixtures

**Files:**

- Modify: `examples/grant-application/component.json`
- Modify: `examples/grant-report/tribal-long.component.json`
- Modify: `examples/grant-report/tribal-short.component.json`
- Modify: `examples/clinical-intake/intake.component.json`
- Modify: `tests/e2e/fixtures/kitchen-sink-holistic/component.json`

- [x] **Step 1: Rewrite each fixture**

Change `{ "component": "Wizard", ... }` roots to `{ "component": "Stack", "nodeId": "root", "children": [...Page children...] }`. Move `showProgress`/`allowSkip` to the corresponding `definition.json` `formPresentation` block. Ensure `pageMode` is set to `"wizard"` or `"tabs"` as appropriate.

- [x] **Step 2: Commit**

```bash
git add examples/ tests/e2e/fixtures/
git commit -m "fix(fixtures): migrate example component docs from Wizard to Stack>Page*"
```

### Task 8.2: Update MCP tools

**Files:**

- Modify: `packages/formspec-mcp/src/tools/flow.ts`
- Modify: `packages/formspec-mcp/src/tools/query.ts`

- [x] **Step 1: Update flow tool**

The mode enum stays (`wizard`/`tabs`/`single`). The tool dispatches `setFlow()` which now writes to `formPresentation`. No structural changes needed — just verify it works.

- [x] **Step 2: Update query tool**

At line ~53, remove the code that skips `Wizard` nodes in tree walks (since Wizard nodes no longer exist).

- [x] **Step 3: Run MCP tests**

Run: `cd packages/formspec-mcp && npx vitest run`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add packages/formspec-mcp/
git commit -m "refactor(mcp): update tools for Wizard deprecation"
```

### Task 8.3: Update Rust linter

**Files:**

- Modify: `crates/formspec-lint/src/pass_component.rs`

- [x] **Step 1: Remove Wizard from known types and E805 rule**

Remove `"Wizard"` from `KNOWN_TYPES`, `LAYOUT_NO_BIND`, `CONTAINER_NO_BIND`. Delete the E805 lint rule that validates Wizard children must be Page.

- [x] **Step 2: Run Rust tests**

Run: `cargo test -p formspec-lint`
Expected: PASS (minus the deleted E805 tests)

- [x] **Step 3: Commit**

```bash
git add crates/formspec-lint/
git commit -m "refactor(lint): remove Wizard from known types, delete E805 rule"
```

---

## Milestone 9: Full Suite Verification

### Task 9.1: Run all test suites

- [x] **Step 1: Core**

Run: `cd packages/formspec-core && npx vitest run`
Expected: ALL PASS

- [x] **Step 2: Studio-core**

Run: `cd packages/formspec-studio-core && npx vitest run`
Expected: ALL PASS

- [x] **Step 3: MCP**

Run: `cd packages/formspec-mcp && npx vitest run`
Expected: ALL PASS

- [x] **Step 4: Layout planner**

Run: `cd packages/formspec-layout && npx vitest run`
Expected: ALL PASS

- [x] **Step 5: Webcomponent**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: ALL PASS

- [x] **Step 6: Rust**

Run: `cargo test`
Expected: ALL PASS

- [x] **Step 7: E2E**

Run: `npx playwright test`
Expected: ALL PASS (or known failures documented)

- [x] **Step 8: Schema/docs checks**

Run: `npm run docs:check && npm run check:deps`
Expected: PASS

- [x] **Step 9: Final commit if any remaining fixes**

```bash
git commit -m "test: fix remaining test failures after Wizard deprecation"
```
