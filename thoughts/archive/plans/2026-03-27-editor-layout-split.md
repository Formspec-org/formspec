# Editor / Layout Workspace Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Studio Editor tab into a pure Tier 1 definition-tree editor and rewrite the Layout tab as a Tier 2+3 visual form builder with component tree canvas.

**Architecture:** Editor renders `definition.items` as a tree view with compact rows — no component tree awareness. Layout renders the component tree as a visual canvas with Page sections, layout containers, DnD, and an unassigned items tray. Both tabs share `useProject` and `useDefinition`; selection is scoped per-tab. Properties panels are split: Editor shows definition/bind props, Layout shows presentation/component props.

**Tech Stack:** React 19, `@dnd-kit/react` (DnD), `@formspec-org/studio-core` (project API), Vitest + Testing Library (unit/integration), Playwright (E2E), Tailwind CSS.

**Spec:** `thoughts/specs/2026-03-27-editor-layout-split-design.md`

---

## File Map

### Pre-work: Extract shared utilities

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/components/ui/DragHandle.tsx` | Drag handle grip icon (extracted from editor) |
| Create | `src/components/ui/block-utils.ts` | `blockRef`, `blockIndent` utilities (extracted from editor) |

### New Editor workspace

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/workspaces/editor/DefinitionTreeEditor.tsx` | Main component — tree view of `definition.items` |
| Create | `src/workspaces/editor/ItemRow.tsx` | Compact tree row for a field/display item |
| Create | `src/workspaces/editor/GroupNode.tsx` | Collapsible group with indented children |
| Create | `src/workspaces/editor/EditorDndProvider.tsx` | DnD wrapper for definition-order reordering |
| Modify | `src/workspaces/editor/EditorContextMenu.tsx` | Simplify — keep delete, duplicate, move, wrap-in-group; remove layout actions |
| Keep | `src/workspaces/editor/properties/FieldConfigSection.tsx` | Field config (strip any presentation props) |
| Keep | `src/workspaces/editor/properties/OptionsSection.tsx` | Options editing |
| Keep | `src/workspaces/editor/properties/GroupConfigSection.tsx` | Group config |
| Keep | `src/workspaces/editor/properties/ContentSection.tsx` | Display item content (strip widget override) |
| Keep | `src/workspaces/editor/properties/shared.tsx` | PropInput, AddPlaceholder |
| Keep | `src/workspaces/editor/properties/MultiSelectSummary.tsx` | Batch actions |
| Keep | `src/workspaces/editor/properties/DefinitionProperties.tsx` | Form metadata panel (no selection) — already exists, keep as-is |
| Create | `src/workspaces/editor/properties/EditorPropertiesPanel.tsx` | Properties router: no selection → DefinitionProperties, single → tier-1 sections, multi → MultiSelectSummary |
| Create | `src/workspaces/editor/properties/BindsInlineSection.tsx` | Inline bind editing (extracted from SelectedItemProperties) |

### New Layout workspace

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/workspaces/layout/LayoutCanvas.tsx` | Main component — component tree visual builder |
| Create | `src/workspaces/layout/PageSection.tsx` | Page node rendered as titled section |
| Create | `src/workspaces/layout/LayoutContainer.tsx` | Card/Grid/Panel/Columns wrapper |
| Create | `src/workspaces/layout/FieldBlock.tsx` | Bound field as visual card |
| Create | `src/workspaces/layout/DisplayBlock.tsx` | Display item visual block |
| Create | `src/workspaces/layout/UnassignedTray.tsx` | Items not placed in component tree |
| Create | `src/workspaces/layout/ModeSelector.tsx` | Single/wizard/tabs mode picker |
| Create | `src/workspaces/layout/PageNav.tsx` | Wizard step bar or tab strip |
| Create | `src/workspaces/layout/LayoutContextMenu.tsx` | Right-click menu (wrap, unwrap, move to page) |
| Create | `src/workspaces/layout/LayoutDndProvider.tsx` | DnD wrapper for component-tree reordering |
| Create | `src/workspaces/layout/render-tree.tsx` | Recursive component tree renderer |
| Create | `src/workspaces/layout/properties/ComponentProperties.tsx` | Properties panel root |
| Create | `src/workspaces/layout/properties/WidgetSection.tsx` | Component type selector |
| Create | `src/workspaces/layout/properties/AppearanceSection.tsx` | Style, CSS classes (migrated) |
| Create | `src/workspaces/layout/properties/LayoutSection.tsx` | Grid span, responsive |
| Create | `src/workspaces/layout/properties/ContainerSection.tsx` | Direction, gap, columns |

### Shell & routing updates

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/components/Shell.tsx` | Swap workspace imports, route properties panel by active tab |
| Modify | `src/components/Header.tsx` | Update TABS help text |
| Modify | `src/state/useSelection.tsx` | Add per-tab selection scoping |
| Modify | `src/state/useCanvasTargets.tsx` | Per-tab target registries |

### Delete after migration

| Action | Path | Reason |
|--------|------|--------|
| Delete | `src/workspaces/editor/EditorCanvas.tsx` | Replaced by DefinitionTreeEditor |
| Delete | `src/workspaces/editor/FieldBlock.tsx` | Replaced by ItemRow |
| Delete | `src/workspaces/editor/GroupBlock.tsx` | Replaced by GroupNode |
| Delete | `src/workspaces/editor/DisplayBlock.tsx` | Replaced by ItemRow |
| Delete | `src/workspaces/editor/LayoutBlock.tsx` | Moved to layout/ |
| Delete | `src/workspaces/editor/render-tree-nodes.tsx` | Replaced by layout/render-tree |
| Delete | `src/workspaces/editor/GroupTabs.tsx` | Pages are Layout concern |
| Delete | `src/workspaces/editor/DragHandle.tsx` | Extracted to components/ui/ |
| Delete | `src/workspaces/editor/block-utils.ts` | Extracted to components/ui/ |
| Delete | `src/workspaces/editor/canvas-operations.ts` | Replaced by EditorContextMenu |
| Delete | `src/workspaces/editor/dnd/` | Entire directory — replaced |
| Delete | `src/workspaces/editor/properties/AppearanceSection.tsx` | Moved to layout/ |
| Delete | `src/workspaces/editor/properties/LayoutProperties.tsx` | Moved to layout/ |
| Delete | `src/workspaces/editor/properties/WidgetHintSection.tsx` | Split: advisory in Editor, override in Layout |
| Delete | `src/workspaces/editor/properties/SelectedItemProperties.tsx` | Split into DefinitionProperties + ComponentProperties |
| Delete | `src/workspaces/editor/properties/ItemProperties.tsx` | Replaced by per-tab properties routing in Shell |
| Delete | `src/workspaces/pages/` | Entire directory — replaced by layout/ |

---

## Tasks

### Task 1: Extract shared utilities

**Files:**
- Read: `src/workspaces/editor/DragHandle.tsx`
- Read: `src/workspaces/editor/block-utils.ts`
- Create: `src/components/ui/DragHandle.tsx`
- Create: `src/components/ui/block-utils.ts`
- Create: `tests/components/ui/drag-handle.test.tsx`

- [ ] **Step 1: Read the current DragHandle and block-utils**

Read `src/workspaces/editor/DragHandle.tsx` and `src/workspaces/editor/block-utils.ts` to understand their interfaces.

- [ ] **Step 2: Write a test for the extracted DragHandle**

```tsx
// tests/components/ui/drag-handle.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DragHandle } from '../../../src/components/ui/DragHandle';

describe('DragHandle', () => {
  it('renders a grip icon with drag-handle testid', () => {
    render(<DragHandle />);
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/components/ui/drag-handle.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 4: Copy DragHandle to components/ui/**

Copy `src/workspaces/editor/DragHandle.tsx` → `src/components/ui/DragHandle.tsx`. Keep the same interface.

- [ ] **Step 5: Copy block-utils to components/ui/**

Copy `src/workspaces/editor/block-utils.ts` → `src/components/ui/block-utils.ts`. Keep the same interface.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/formspec-studio && npx vitest run tests/components/ui/drag-handle.test.tsx`
Expected: PASS

- [ ] **Step 7: Update existing imports**

Update `src/workspaces/pages/PageCard.tsx` to import DragHandle from `../../components/ui/DragHandle` instead of `../editor/DragHandle`.

- [ ] **Step 8: Run full test suite to verify no regressions**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/DragHandle.tsx src/components/ui/block-utils.ts tests/components/ui/drag-handle.test.tsx src/workspaces/pages/PageCard.tsx
git commit -m "refactor: extract DragHandle and block-utils to shared components/ui"
```

---

### Task 2: Add per-tab selection scoping to useSelection

**Files:**
- Modify: `src/state/useSelection.tsx`
- Create: `tests/state/selection-scoping.test.tsx`

- [ ] **Step 1: Read current useSelection implementation**

Read `src/state/useSelection.tsx` to understand the current API surface.

- [ ] **Step 2: Write a failing test for per-tab selection scoping**

```tsx
// tests/state/selection-scoping.test.tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SelectionProvider, useSelection } from '../../src/state/useSelection';

describe('per-tab selection scoping', () => {
  it('maintains independent selection per tab scope', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SelectionProvider>{children}</SelectionProvider>
    );
    const { result } = renderHook(() => useSelection(), { wrapper });

    // Select in editor scope
    act(() => result.current.select('field1', 'field', { tab: 'editor' }));
    expect(result.current.selectedKeyForTab('editor')).toBe('field1');
    expect(result.current.selectedKeyForTab('layout')).toBeNull();

    // Select in layout scope — editor selection unchanged
    act(() => result.current.select('__node:abc', 'node', { tab: 'layout' }));
    expect(result.current.selectedKeyForTab('editor')).toBe('field1');
    expect(result.current.selectedKeyForTab('layout')).toBe('__node:abc');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/state/selection-scoping.test.tsx`
Expected: FAIL

- [ ] **Step 4: Implement per-tab selection scoping**

Add a `tab` parameter to `select`, `toggleSelect`, `rangeSelect`. Add `selectedKeyForTab(tab)`. The existing `selectedKey` continues to return the selection for the active tab (backwards-compatible). Store selection state as `Map<string, SelectionState>` keyed by tab name.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/formspec-studio && npx vitest run tests/state/selection-scoping.test.tsx`
Expected: PASS

- [ ] **Step 6: Run full test suite — existing selection tests should still pass**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass (backwards-compatible)

- [ ] **Step 7: Commit**

```bash
git add src/state/useSelection.tsx tests/state/selection-scoping.test.tsx
git commit -m "feat: add per-tab selection scoping to useSelection"
```

---

### Task 3: Build the Definition Tree Editor — core rendering

**Files:**
- Create: `src/workspaces/editor/ItemRow.tsx`
- Create: `src/workspaces/editor/GroupNode.tsx`
- Create: `src/workspaces/editor/DefinitionTreeEditor.tsx`
- Create: `tests/workspaces/editor/definition-tree-editor.test.tsx`

- [ ] **Step 1: Write failing test — renders fields as compact rows**

```tsx
// tests/workspaces/editor/definition-tree-editor.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { DefinitionTreeEditor } from '../../../src/workspaces/editor/DefinitionTreeEditor';

function renderTree(definition: any) {
  const project = createProject({ seed: { definition } });
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <DefinitionTreeEditor />
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

describe('DefinitionTreeEditor', () => {
  it('renders field items with label and dataType badge', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });
    expect(screen.getByTestId('field-name')).toBeInTheDocument();
    expect(screen.getByTestId('field-age')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
  });

  it('renders group items as collapsible nodes with children', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'contact', type: 'group', label: 'Contact',
        children: [
          { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
        ],
      }],
    });
    expect(screen.getByTestId('group-contact')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders display items with widgetHint badge', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'intro', type: 'display', label: 'Welcome', presentation: { widgetHint: 'heading' } },
      ],
    });
    expect(screen.getByTestId('display-intro')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('shows the full item tree regardless of pageMode', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        { key: 'page1', type: 'group', label: 'Page 1', children: [
          { key: 'f1', type: 'field', dataType: 'string', label: 'Field 1' },
        ]},
        { key: 'page2', type: 'group', label: 'Page 2', children: [
          { key: 'f2', type: 'field', dataType: 'string', label: 'Field 2' },
        ]},
      ],
    });
    // Both pages and all fields visible — no page filtering
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByText('Field 1')).toBeInTheDocument();
    expect(screen.getByText('Field 2')).toBeInTheDocument();
  });

  it('shows bind indicator pills', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }],
      binds: [{ path: 'name', required: 'true' }],
    });
    expect(screen.getByText('req')).toBeInTheDocument();
  });

  it('has an Add Item button', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [],
    });
    expect(screen.getByTestId('add-item')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/definition-tree-editor.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ItemRow**

Create `src/workspaces/editor/ItemRow.tsx` — a compact row component that renders:
- Type badge (field/display)
- Label text
- DataType badge for fields
- WidgetHint badge for display items (advisory, read-only)
- Bind indicator pills (req, calc, cond, ro, val)
- Click handler for selection
- `data-testid="field-{key}"` or `data-testid="display-{key}"`

Read the existing `FieldBlock.tsx` and `DisplayBlock.tsx` for bind pill patterns and testid conventions.

- [ ] **Step 4: Implement GroupNode**

Create `src/workspaces/editor/GroupNode.tsx` — a collapsible tree node that renders:
- Group label with expand/collapse toggle
- Indented children (recursively renders ItemRow/GroupNode)
- `data-testid="group-{key}"`

Read the existing `GroupBlock.tsx` for testid conventions.

- [ ] **Step 5: Implement DefinitionTreeEditor**

Create `src/workspaces/editor/DefinitionTreeEditor.tsx` — main component that:
- Reads `definition.items` via `useDefinition()` (NOT `useComponent()`)
- Reads `definition.binds` for bind indicators
- Recursively renders ItemRow/GroupNode for each item
- Shows ALL items regardless of `formPresentation.pageMode` (no page filtering)
- Includes `+ Add Item` button with `data-testid="add-item"`
- Uses `WorkspacePage` / `WorkspacePageSection` from `components/ui/`
- Imports `AddItemPalette` from `../../components/AddItemPalette` (it lives in `src/components/`, NOT in the editor workspace) with `showLayout={false}` to exclude layout items (Card, Stack, Grid, etc.)

Note: `AddItemPalette` needs a `showLayout` prop added. If it doesn't have one, add a filter that excludes `itemType === 'layout'` items from the catalog when `showLayout` is false. The Layout workspace will import the same palette with `showLayout={true}` (default).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/definition-tree-editor.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/workspaces/editor/ItemRow.tsx src/workspaces/editor/GroupNode.tsx src/workspaces/editor/DefinitionTreeEditor.tsx tests/workspaces/editor/definition-tree-editor.test.tsx
git commit -m "feat: add DefinitionTreeEditor — pure Tier 1 definition tree view"
```

---

### Task 4: Editor — selection, DnD reorder, context menu

**Files:**
- Create: `src/workspaces/editor/EditorDndProvider.tsx`
- Create: `src/workspaces/editor/EditorContextMenu.tsx`
- Modify: `src/workspaces/editor/DefinitionTreeEditor.tsx`
- Create: `tests/workspaces/editor/editor-selection.test.tsx`
- Create: `tests/workspaces/editor/editor-reorder.test.tsx`
- Create: `tests/workspaces/editor/editor-context-menu.test.tsx`

- [ ] **Step 1: Write failing test — click selects item**

```tsx
// tests/workspaces/editor/editor-selection.test.tsx
describe('Editor selection', () => {
  it('clicking an item selects it', async () => {
    // renderTree with two fields, click first, verify selection
  });

  it('Cmd+click toggles multi-select', async () => {
    // renderTree, click first, cmd+click second, verify both selected
  });

  it('Escape clears selection', async () => {
    // select an item, press escape, verify deselected
  });
});
```

- [ ] **Step 2: Run test — fails**

- [ ] **Step 3: Add selection handling to DefinitionTreeEditor and ItemRow**

Wire up `useSelection` with `tab: 'editor'` scope. Add click/cmd-click/shift-click/escape handlers following patterns from current `EditorCanvas.tsx`.

- [ ] **Step 4: Run test — passes**

- [ ] **Step 5: Write failing test — DnD reorder changes definition array order**

```tsx
// tests/workspaces/editor/editor-reorder.test.tsx
describe('Editor DnD reorder', () => {
  it('reordering items changes definition.items array order', async () => {
    // Create project with [fieldA, fieldB, fieldC]
    // Simulate DnD move fieldC before fieldA
    // Assert project.definition.items order is [fieldC, fieldA, fieldB]
  });
});
```

- [ ] **Step 6: Run test — fails**

- [ ] **Step 7: Implement EditorDndProvider**

Definition-order DnD using `@dnd-kit/react`. On drag end, calls `project.reorderItem(key, newIndex)` or equivalent. This changes `definition.items` array order, NOT component tree order.

Read the current `dnd/use-canvas-dnd.ts` for DnD patterns, but implement against definition items array instead of component tree.

- [ ] **Step 8: Run test — passes**

- [ ] **Step 9: Write failing test — context menu**

```tsx
// tests/workspaces/editor/editor-context-menu.test.tsx
describe('Editor context menu', () => {
  it('right-click shows delete, duplicate, wrap-in-group', async () => {
    // render, right-click field, verify menu items
  });

  it('does NOT show wrap-in-Card or unwrap', async () => {
    // render, right-click field, verify layout actions absent
  });
});
```

- [ ] **Step 10: Run test — fails**

- [ ] **Step 11: Implement EditorContextMenu**

Simplified menu with: Delete, Duplicate, Move Up, Move Down, Wrap in Group. NO layout actions (Wrap in Card/Stack/Grid, Unwrap). Read current `canvas-operations.ts` for action patterns.

- [ ] **Step 12: Run all new editor tests — passes**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/editor/editor-selection.test.tsx tests/workspaces/editor/editor-reorder.test.tsx tests/workspaces/editor/editor-context-menu.test.tsx`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add src/workspaces/editor/EditorDndProvider.tsx src/workspaces/editor/EditorContextMenu.tsx src/workspaces/editor/DefinitionTreeEditor.tsx tests/workspaces/editor/editor-selection.test.tsx tests/workspaces/editor/editor-reorder.test.tsx tests/workspaces/editor/editor-context-menu.test.tsx
git commit -m "feat: add selection, DnD reorder, and context menu to Editor tree"
```

---

### Task 5: Editor properties panel — EditorPropertiesPanel

Note: `DefinitionProperties.tsx` already exists — it is the "no item selected" form metadata panel (title, version, status). Do NOT overwrite it. The new component is `EditorPropertiesPanel.tsx` which routes between: no selection → existing `DefinitionProperties`, single item → tier-1 sections, multi-select → `MultiSelectSummary`.

**Files:**
- Create: `src/workspaces/editor/properties/EditorPropertiesPanel.tsx`
- Create: `src/workspaces/editor/properties/BindsInlineSection.tsx`
- Create: `tests/workspaces/editor/properties/editor-properties-panel.test.tsx`

- [ ] **Step 1: Write failing test — routes and shows only Tier 1 properties**

```tsx
// tests/workspaces/editor/properties/editor-properties-panel.test.tsx
describe('EditorPropertiesPanel', () => {
  it('shows form metadata when no item is selected', () => {
    // render with no selection, verify title/version/status fields
  });

  it('shows key, label, dataType for a selected field', () => {
    // render with a field selected, verify identity section visible
  });

  it('shows bind editing section', () => {
    // render with field that has binds, verify required/calculate visible
  });

  it('shows batch actions for multi-select', () => {
    // render with 2 items selected, verify "Delete N items" visible
  });

  it('does NOT show appearance/style/widget-override sections', () => {
    // render with field selected, verify no AppearanceSection, no WidgetSection, no LayoutSection
  });
});
```

- [ ] **Step 2: Run test — fails**

- [ ] **Step 3: Implement EditorPropertiesPanel**

Routing logic (read current `ItemProperties.tsx` for patterns):
- No selection → render existing `DefinitionProperties` (form metadata)
- Multi-select → render existing `MultiSelectSummary`
- Layout node selected (`__node:` prefix) → show nothing (layout nodes are a Layout tab concern)
- Single item → render tier-1 sections: identity (key/label/type/dataType), `FieldConfigSection`, `GroupConfigSection`, `ContentSection`, `OptionsSection`, `BindsInlineSection`

Do NOT include `AppearanceSection`, `WidgetHintSection`, or `LayoutProperties`.

- [ ] **Step 4: Implement BindsInlineSection**

Extract bind editing (required, calculate, relevant, readonly, constraint, constraintMessage) from `SelectedItemProperties.tsx`. Use the same `PropInput` and FEL editor patterns.

- [ ] **Step 5: Run test — passes**

- [ ] **Step 6: Commit**

```bash
git add src/workspaces/editor/properties/EditorPropertiesPanel.tsx src/workspaces/editor/properties/BindsInlineSection.tsx tests/workspaces/editor/properties/editor-properties-panel.test.tsx
git commit -m "feat: add EditorPropertiesPanel with tier-1 routing for Editor tab"
```

---

### Task 6: Build the Layout Canvas — core rendering

**Files:**
- Create: `src/workspaces/layout/render-tree.tsx`
- Create: `src/workspaces/layout/PageSection.tsx`
- Create: `src/workspaces/layout/LayoutContainer.tsx`
- Create: `src/workspaces/layout/FieldBlock.tsx`
- Create: `src/workspaces/layout/DisplayBlock.tsx`
- Create: `src/workspaces/layout/LayoutCanvas.tsx`
- Create: `tests/workspaces/layout/layout-canvas.test.tsx`

- [ ] **Step 1: Write failing test — renders component tree with pages**

```tsx
// tests/workspaces/layout/layout-canvas.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { LayoutCanvas } from '../../../src/workspaces/layout/LayoutCanvas';

function renderLayout(definition: any) {
  const project = createProject({ seed: { definition } });
  return { project, ...render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>
          <LayoutCanvas />
        </ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>,
  )};
}

describe('LayoutCanvas', () => {
  it('renders Page nodes as titled sections', () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    } as any }});
    project.addPage('Step 1');

    const { container } = render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActiveGroupProvider>
            <LayoutCanvas />
          </ActiveGroupProvider>
        </SelectionProvider>
      </ProjectProvider>,
    );

    expect(screen.getByText('Step 1')).toBeInTheDocument();
  });

  it('renders layout containers (Card, Grid) as wrappers', () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    } as any }});
    project.wrapInLayoutComponent('name', 'Card');

    const { container } = render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActiveGroupProvider>
            <LayoutCanvas />
          </ActiveGroupProvider>
        </SelectionProvider>
      </ProjectProvider>,
    );

    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('shows mode selector (single/wizard/tabs)', () => {
    renderLayout({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [],
    });
    expect(screen.getByText('Single')).toBeInTheDocument();
    expect(screen.getByText('Wizard')).toBeInTheDocument();
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — fails**

- [ ] **Step 3: Implement render-tree.tsx**

Note: The spec's `CanvasBlock.tsx` (dispatch hub) is subsumed by `render-tree.tsx` — the recursive renderer dispatches directly to `PageSection`, `LayoutContainer`, `FieldBlock`, or `DisplayBlock`. No separate `CanvasBlock` component needed.

Recursive component tree renderer. Takes a tree node array and context, renders:
- `component === 'Page'` → `<PageSection>`
- `_layout && component !== 'Page'` → `<LayoutContainer>`
- `bind` → `<FieldBlock>`
- `nodeId` (display) → `<DisplayBlock>`

Read current `render-tree-nodes.tsx` for patterns, but this version does NOT need `flattenStructural` — Page nodes render as first-class sections.

- [ ] **Step 4: Implement PageSection, LayoutContainer, FieldBlock, DisplayBlock**

Each is a visual block component. Read current `FieldBlock.tsx`, `GroupBlock.tsx`, `LayoutBlock.tsx` from `workspaces/editor/` for visual patterns. Key difference: these render component tree structure, not definition structure.

- [ ] **Step 5: Implement LayoutCanvas**

Main canvas component that:
- Reads component tree via `useComponent()`
- Reads definition via `useDefinition()` (for unassigned items)
- Includes `ModeSelector` (absorbed from current PagesTab)
- Includes page navigation (PageNav)
- Wraps tree in `WorkspacePage` / `WorkspacePageSection`

Read current `PagesTab.tsx` for mode selector patterns and `EditorCanvas.tsx` for canvas structure.

- [ ] **Step 6: Run test — passes**

- [ ] **Step 7: Commit**

```bash
git add src/workspaces/layout/
git commit -m "feat: add LayoutCanvas — component tree visual builder with page sections"
```

---

### Task 7: Layout — unassigned tray, DnD, context menu

**Files:**
- Create: `src/workspaces/layout/UnassignedTray.tsx`
- Create: `src/workspaces/layout/LayoutDndProvider.tsx`
- Create: `src/workspaces/layout/LayoutContextMenu.tsx`
- Create: `tests/workspaces/layout/unassigned-tray.test.tsx`
- Create: `tests/workspaces/layout/layout-context-menu.test.tsx`

- [ ] **Step 1: Write failing test — unassigned tray shows unbound items**

```tsx
// tests/workspaces/layout/unassigned-tray.test.tsx
describe('UnassignedTray', () => {
  it('shows definition items not placed in the component tree', () => {
    // Create project with items, no component tree placement
    // Render Layout, verify unassigned tray lists them
  });

  it('distinguishes required vs non-required unassigned items', () => {
    // Create project with required bind on one field
    // Verify required unassigned is highlighted differently
  });
});
```

- [ ] **Step 2: Run test — fails**

- [ ] **Step 3: Implement UnassignedTray**

Shows items from `definition.items` that are not bound in the component tree. Uses `usePageStructure()` or queries the component tree directly to determine which items are unbound. Distinguishes required (highlighted) vs non-required (dimmed) per Component S4.5.

Read current `workspaces/pages/UnassignedItemsTray.tsx` for patterns.

- [ ] **Step 4: Run test — passes**

- [ ] **Step 5: Write failing test — context menu**

```tsx
// tests/workspaces/layout/layout-context-menu.test.tsx
describe('Layout context menu', () => {
  it('right-click field shows wrap-in-Card, move-to-page', async () => {
    // render, right-click a field, verify layout-specific actions
  });

  it('right-click layout container shows unwrap', async () => {
    // render, wrap field in card, right-click card, verify unwrap
  });

  it('does NOT show wrap-in-group', async () => {
    // render, right-click field, verify wrap-in-group absent
  });
});
```

- [ ] **Step 6: Run test — fails**

- [ ] **Step 7: Implement LayoutContextMenu**

Context menu: Wrap in Card/Stack/Grid/Panel/Collapsible, Unwrap, Move to Page, Delete from tree. NO definition-tier actions (Wrap in Group).

- [ ] **Step 8: Run context menu test — passes**

- [ ] **Step 9: Write failing test — Layout DnD reorder**

```tsx
// tests/workspaces/layout/layout-dnd.test.tsx
describe('Layout DnD', () => {
  it('reordering changes component tree children order', () => {
    // Create project with items in component tree
    // Simulate DnD reorder
    // Verify component tree order changed, definition order unchanged
  });
});
```

- [ ] **Step 10: Write failing test — drag from unassigned tray to canvas**

```tsx
// Add to tests/workspaces/layout/unassigned-tray.test.tsx
it('dragging from tray to canvas places item in component tree', () => {
  // Create project with unassigned item
  // Simulate drag from tray to a page
  // Verify item is now bound in the component tree
});
```

- [ ] **Step 11: Implement LayoutDndProvider**

Component-tree-order reordering using `@dnd-kit/react`. On drag end, reorders component tree children via `project.moveItemOnPageToIndex` or equivalent. Also supports drag from unassigned tray — on drop, calls `project.placeOnPage(key, pageId)`.

- [ ] **Step 12: Run all layout tests — passes**

Run: `cd packages/formspec-studio && npx vitest run tests/workspaces/layout/`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/workspaces/layout/UnassignedTray.tsx src/workspaces/layout/LayoutDndProvider.tsx src/workspaces/layout/LayoutContextMenu.tsx tests/workspaces/layout/
git commit -m "feat: add unassigned tray, DnD, and context menu to Layout canvas"
```

---

### Task 8: Layout properties panel — ComponentProperties

**Files:**
- Create: `src/workspaces/layout/properties/ComponentProperties.tsx`
- Create: `src/workspaces/layout/properties/WidgetSection.tsx`
- Create: `src/workspaces/layout/properties/LayoutSection.tsx`
- Create: `src/workspaces/layout/properties/ContainerSection.tsx`
- Migrate: `src/workspaces/editor/properties/AppearanceSection.tsx` → `src/workspaces/layout/properties/AppearanceSection.tsx`
- Create: `tests/workspaces/layout/properties/component-properties.test.tsx`

- [ ] **Step 1: Write failing test — shows only Tier 2/3 properties**

```tsx
// tests/workspaces/layout/properties/component-properties.test.tsx
describe('ComponentProperties', () => {
  it('shows widget selector for a bound component node', () => {
    // select a bound field in layout, verify widget section visible
  });

  it('shows container props for a layout container', () => {
    // select a Card node, verify direction/gap/columns visible
  });

  it('does NOT show key, label, dataType, or bind sections', () => {
    // verify no definition-tier properties
  });
});
```

- [ ] **Step 2: Run test — fails**

- [ ] **Step 3: Implement WidgetSection, LayoutSection, ContainerSection**

- `WidgetSection` — component type selector. Replaces `WidgetHintSection` but operates on the component tree (Tier 3), not the definition hint (Tier 1). Read current `WidgetHintSection.tsx` for the widget catalog.
- `LayoutSection` — grid span/start, responsive breakpoint overrides
- `ContainerSection` — direction, gap, columns (for container components)

- [ ] **Step 4: Copy AppearanceSection from editor to layout**

Copy `src/workspaces/editor/properties/AppearanceSection.tsx` → `src/workspaces/layout/properties/AppearanceSection.tsx`. Update imports. This section handles style overrides, CSS classes, labelPosition — all Tier 2/3.

- [ ] **Step 5: Implement ComponentProperties**

Routes to: WidgetSection, AppearanceSection, LayoutSection, ContainerSection. Shows component `when` expression input with clear label "Visual Condition (data preserved)". Also includes an Accessibility section for component-level a11y overrides (defer implementation to a stub for now — the section header should exist even if the controls are minimal).

Add test assertions:
```tsx
it('shows component when expression with visual-condition label', () => {
  // select a bound component node, verify "Visual Condition" label exists
});

it('shows accessibility section header', () => {
  // select a bound component node, verify "Accessibility" section exists
});
```

- [ ] **Step 6: Run test — passes**

- [ ] **Step 7: Commit**

```bash
git add src/workspaces/layout/properties/
git commit -m "feat: add ComponentProperties panel for Layout tab"
```

---

### Task 9: Wire up Shell — swap workspaces and route properties

**Files:**
- Modify: `src/components/Shell.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `tests/components/shell.test.tsx`
- Modify: `tests/components/header.test.tsx`

- [ ] **Step 1: Read current Shell.tsx and Header.tsx**

Understand the WORKSPACES map, imports, and properties panel routing.

- [ ] **Step 2: Update Shell imports and WORKSPACES map**

```tsx
// Replace:
import { EditorCanvas } from '../workspaces/editor/EditorCanvas';
import { ItemProperties } from '../workspaces/editor/ItemProperties';
import { PagesTab } from '../workspaces/pages/PagesTab';

// With:
import { DefinitionTreeEditor } from '../workspaces/editor/DefinitionTreeEditor';
import { EditorPropertiesPanel } from '../workspaces/editor/properties/EditorPropertiesPanel';
import { LayoutCanvas } from '../workspaces/layout/LayoutCanvas';
import { ComponentProperties } from '../workspaces/layout/properties/ComponentProperties';

const WORKSPACES: Record<string, React.FC> = {
  Editor: DefinitionTreeEditor,
  // ... other tabs unchanged
  Layout: LayoutCanvas,
};
```

- [ ] **Step 3: Route properties panel by active tab**

Replace the single `<ItemProperties>` sidebar with tab-conditional rendering:

```tsx
{activeTab === 'Editor' && <EditorPropertiesPanel />}
{activeTab === 'Layout' && <ComponentProperties />}
```

- [ ] **Step 4: Leave ActiveGroupProvider in place**

`ActiveGroupProvider` wraps the entire Shell in `StudioApp.tsx`. Leave it — Layout uses it, Editor ignores it. No change needed.

- [ ] **Step 5: Update Header.tsx tab help text**

```tsx
const TABS: { name: string; help: string }[] = [
  { name: 'Editor', help: 'Definition tree — items, types, and data binds' },
  // ...
  { name: 'Layout', help: 'Visual form builder — pages, layout containers, and widget selection' },
  // ...
];
```

- [ ] **Step 6: Hide Component Tree sidebar section when Editor is active**

In Shell's Blueprint sidebar rendering, conditionally hide the "Component Tree" section when `activeTab === 'Editor'`.

- [ ] **Step 7: Update shell.test.tsx and header.test.tsx**

Update test expectations for new help text, new workspace components, and properties routing.

- [ ] **Step 8: Run tests**

Run: `cd packages/formspec-studio && npx vitest run tests/components/shell.test.tsx tests/components/header.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/Shell.tsx src/components/Header.tsx tests/components/shell.test.tsx tests/components/header.test.tsx
git commit -m "feat: wire Shell to new Editor/Layout workspaces with split properties"
```

---

### Task 10: Integration tests — cross-tab behavior

**Files:**
- Create: `tests/integration/editor-layout-split.test.tsx`

- [ ] **Step 1: Write integration tests**

```tsx
// tests/integration/editor-layout-split.test.tsx
describe('Editor/Layout split integration', () => {
  it('adding item in Editor makes it appear as unassigned in Layout', () => {
    // Create project, render Editor, add field
    // Switch to Layout, verify item in unassigned tray
  });

  it('reordering in Editor changes definition order, not component tree', () => {
    // Create project with items + component tree
    // Reorder in Editor
    // Verify definition.items order changed
    // Verify component tree children order unchanged
  });

  it('reordering in Layout changes component tree, not definition order', () => {
    // Create project with items + component tree
    // Reorder in Layout
    // Verify component tree children order changed
    // Verify definition.items order unchanged
  });

  it('Editor properties shows only definition props', () => {
    // Select item in Editor, verify no appearance/style sections
  });

  it('Layout properties shows only component props', () => {
    // Select item in Layout, verify no key/label/bind sections
  });
});
```

- [ ] **Step 2: Run tests — should pass if previous tasks are correct**

Run: `cd packages/formspec-studio && npx vitest run tests/integration/editor-layout-split.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/editor-layout-split.test.tsx
git commit -m "test: add Editor/Layout split integration tests"
```

---

### Task 11: Delete old code

**Files:**
- Delete: all files listed in the "Delete after migration" section of the file map

- [ ] **Step 1: Delete old Editor canvas files**

```bash
rm src/workspaces/editor/EditorCanvas.tsx
rm src/workspaces/editor/FieldBlock.tsx
rm src/workspaces/editor/GroupBlock.tsx
rm src/workspaces/editor/DisplayBlock.tsx
rm src/workspaces/editor/LayoutBlock.tsx
rm src/workspaces/editor/render-tree-nodes.tsx
rm src/workspaces/editor/GroupTabs.tsx
rm src/workspaces/editor/DragHandle.tsx
rm src/workspaces/editor/block-utils.ts
rm src/workspaces/editor/canvas-operations.ts
rm -rf src/workspaces/editor/dnd/
rm src/workspaces/editor/properties/AppearanceSection.tsx
rm src/workspaces/editor/properties/LayoutProperties.tsx
rm src/workspaces/editor/properties/WidgetHintSection.tsx
rm src/workspaces/editor/properties/SelectedItemProperties.tsx
rm src/workspaces/editor/properties/ItemProperties.tsx
```

- [ ] **Step 2: Delete old pages workspace**

```bash
rm -rf src/workspaces/pages/
```

- [ ] **Step 3: Delete old test files that test deleted components**

Delete ALL tests that import deleted modules. Keep tests for retained components (FieldConfigSection, OptionsSection, GroupConfigSection, ContentSection, shared).

```bash
# Old canvas and block tests
rm tests/workspaces/editor/editor-canvas.test.tsx
rm tests/workspaces/editor/field-block.test.tsx
rm tests/workspaces/editor/display-block.test.tsx
rm tests/workspaces/editor/layout-block.test.tsx
rm tests/workspaces/editor/group-tabs.test.tsx
rm tests/workspaces/editor/context-menu.test.tsx
rm tests/workspaces/editor/ai-context-actions.test.tsx
rm -rf tests/workspaces/editor/dnd/
# Old properties tests for moved/deleted components
rm tests/workspaces/editor/properties/appearance-section.test.tsx
rm tests/workspaces/editor/properties/layout-properties.test.tsx
rm tests/workspaces/editor/properties/widget-hint.test.tsx
rm tests/workspaces/editor/properties/selected-item-properties.test.tsx
rm tests/workspaces/editor/properties/item-properties.test.tsx
rm tests/workspaces/editor/properties/item-properties-switching.test.tsx
# Old pages workspace — entirely replaced
rm -rf tests/workspaces/pages/
```

Also update `tests/workspaces/editor/test-utils.tsx` — it imports old `EditorCanvas`. Replace with a new helper that renders `DefinitionTreeEditor` with providers.

- [ ] **Step 4: Verify no broken imports**

Run: `cd packages/formspec-studio && npx tsc --noEmit 2>&1 | head -50`
Expected: No import errors from deleted files

- [ ] **Step 5: Run full test suite**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All remaining tests pass. Some old tests will have been deleted; new tests cover the new components.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: delete old Editor canvas, Pages workspace, and superseded properties"
```

---

### Task 12: Update E2E tests

**Files:**
- Modify: `tests/e2e/playwright/*.spec.ts` (selectively)
- Modify: `tests/e2e/playwright/helpers.ts`

- [ ] **Step 1: Audit E2E test selectors**

Read through E2E test files to identify which tests:
- Navigate to Editor and expect layout-specific behavior → need to navigate to Layout instead
- Use `data-testid="layout-*"` or wrap/unwrap actions → move to Layout tab
- Use `data-testid="field-*"`, `data-testid="add-item"` in Editor → should still work (preserved testids)

Key files to audit:
- `editor-authoring.spec.ts` — field/display creation tests (should work in new Editor)
- `layout-components.spec.ts` — wrap-in-Card/Stack tests (must navigate to Layout)
- `interaction-patterns.spec.ts` — click/select/DnD (split between Editor and Layout)
- `wizard-mode.spec.ts` — page navigation (must move to Layout)
- `pages-workspace.spec.ts`, `pages-behavioral.spec.ts`, `pages-focus-mode.spec.ts` — update tab navigation
- `helpers.ts` — shared helper functions

- [ ] **Step 2: Update helpers.ts**

Update any shared navigation helpers that assume Layout actions happen in the Editor tab.

- [ ] **Step 3: Update layout-specific E2E tests**

Move tests that perform wrap/unwrap, page management, or component tree reordering to navigate to the Layout tab: `page.getByTestId('tab-Layout').click()`.

- [ ] **Step 4: Update wizard-mode E2E tests**

Wizard page navigation now lives in Layout. Update navigation flow.

- [ ] **Step 5: Run E2E tests**

Run: `npm test` (starts Vite server + runs Playwright)
Expected: All E2E tests pass

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/
git commit -m "test: update E2E tests for Editor/Layout workspace split"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run full unit/integration test suite**

Run: `cd packages/formspec-studio && npx vitest run`
Expected: All pass

- [ ] **Step 2: Run full E2E test suite**

Run: `npm test`
Expected: All pass

- [ ] **Step 3: Run TypeScript type check**

Run: `cd packages/formspec-studio && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Manual smoke test**

Start dev server: `cd packages/formspec-studio && npm run dev`
- Open Editor tab → see definition tree view
- Add items, verify they appear as tree rows
- Switch to Layout → see component tree canvas
- Verify Page nodes render as sections
- Add a page, assign items, verify unassigned tray
- Wrap a field in Card, verify it appears as layout container
- Check both properties panels show correct tier of properties

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from smoke testing"
```
