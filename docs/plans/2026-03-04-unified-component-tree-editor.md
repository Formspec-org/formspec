# Unified Component Tree Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the Studio guided editor as a unified tree that interleaves layout components and definition items, editing two documents (component.json + definition.json) simultaneously through one UI.

**Architecture:** The component tree (`componentDoc.tree`) becomes the structural backbone rendered in the tree editor. Each node is a component (layout, input, display, or structure-only). Input/display nodes bind to definition items via `bind` keys. Operations on the tree update both documents simultaneously. The user never thinks about which document they're editing.

**Tech Stack:** Preact + @preact/signals, Vitest + @testing-library/preact, formspec-engine types, component.schema.json for schema-driven property editors.

**Design doc:** `docs/plans/2026-03-04-unified-component-tree-editor-design.md`

---

## Notation

- **Create** = new file
- **Modify** = edit existing file
- **Rewrite** = delete contents and rewrite from scratch (existing file)
- Tests use Vitest (`npm run test --workspace=formspec-studio`)
- E2E uses Playwright (`npm run test:studio:e2e`)

## Phase 1: Foundation (Types + Pure Logic)

### Task 1: Unified Tree Types

**Files:**
- Modify: `form-builder/src/types.ts`

**Step 1: Write the types**

Add to `form-builder/src/types.ts`:

```typescript
// --- Unified Component Tree Types ---

/** A node in the component tree. Mirrors the component.schema.json AnyComponent shape. */
export interface ComponentNode {
  component: string;
  bind?: string;
  when?: string;
  style?: Record<string, unknown>;
  cssClass?: string;
  accessibility?: { role?: string; description?: string; liveRegion?: string };
  responsive?: Record<string, Record<string, unknown>>;
  children?: ComponentNode[];
  [key: string]: unknown; // component-specific props (placeholder, columns, gap, etc.)
}

/** The full component document. */
export interface ComponentDocument {
  $formspecComponent: '1.0';
  version: string;
  url?: string;
  name?: string;
  title?: string;
  description?: string;
  targetDefinition: { url: string; compatibleVersions?: string };
  breakpoints?: Record<string, number>;
  tokens?: Record<string, string | number>;
  components?: Record<string, { params?: string[]; tree: ComponentNode }>;
  tree: ComponentNode;
}

/** Determines how a node behaves in the unified tree. */
export type NodeKind = 'layout' | 'bound-input' | 'bound-display' | 'group' | 'structure-only';

/** Path into the component tree. '' = root node, '0' = first child, '0.2' = first child's third child. */
export type ComponentTreePath = string;

/** Categories for the add-item picker. */
export type AddCategory = 'layout' | 'input' | 'display' | 'structure';

/** An entry in the categorized add picker. */
export interface AddPickerEntry {
  component: string;
  label: string;
  category: AddCategory;
  defaultDataType?: string;       // for inputs: auto-set on the definition field
  createsDefinitionItem?: boolean; // true for inputs, some displays, groups
  definitionType?: 'field' | 'group' | 'display';
  promptForLabel?: boolean;        // true for most; false for Spacer/Divider
}
```

**Step 2: Run type check**

Run: `cd form-builder && npx tsc --noEmit`
Expected: PASS (no errors)

**Step 3: Commit**

```
feat(studio): add unified component tree types
```

---

### Task 2: Component Tree Generator

Expand the existing `generateBaselineComponent` in `presentation-docs.ts` to produce a fully-typed `ComponentNode` tree, and extract it to a dedicated module so it can be tested independently.

**Files:**
- Create: `form-builder/src/logic/component-tree.ts`
- Create: `form-builder/src/logic/__tests__/component-tree.test.ts`

**Step 1: Write the failing test**

Create `form-builder/src/logic/__tests__/component-tree.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateComponentTree, resolveNode, classifyNode, getNodeLabel } from '../component-tree';
import type { FormspecDefinition } from 'formspec-engine';
import type { ComponentNode } from '../../types';

const minimalDef: FormspecDefinition = {
  $formspec: '1.0',
  url: 'https://example.com/test',
  version: '1.0.0',
  status: 'draft',
  title: 'Test',
  items: [
    { key: 'name', type: 'field', label: 'Name', dataType: 'string' },
    { key: 'age', type: 'field', label: 'Age', dataType: 'integer' },
  ],
} as FormspecDefinition;

const wizardDef: FormspecDefinition = {
  $formspec: '1.0',
  url: 'https://example.com/wizard',
  version: '1.0.0',
  status: 'draft',
  title: 'Wizard Form',
  formPresentation: { pageMode: 'wizard' },
  items: [
    {
      key: 'info',
      type: 'group',
      label: 'Info',
      children: [
        { key: 'email', type: 'field', label: 'Email', dataType: 'string' },
      ],
    },
    {
      key: 'notes',
      type: 'group',
      label: 'Notes',
      children: [
        { key: 'body', type: 'field', label: 'Body', dataType: 'text' },
      ],
    },
  ],
} as FormspecDefinition;

describe('generateComponentTree', () => {
  it('wraps flat items in a Stack', () => {
    const tree = generateComponentTree(minimalDef);
    expect(tree.component).toBe('Stack');
    expect(tree.children).toHaveLength(2);
    expect(tree.children![0].component).toBe('TextInput');
    expect(tree.children![0].bind).toBe('name');
    expect(tree.children![1].component).toBe('NumberInput');
    expect(tree.children![1].bind).toBe('age');
  });

  it('generates Wizard with Pages for wizard pageMode', () => {
    const tree = generateComponentTree(wizardDef);
    expect(tree.component).toBe('Wizard');
    expect(tree.children).toHaveLength(2);
    expect(tree.children![0].component).toBe('Page');
    expect(tree.children![0].title).toBe('Info');
    expect(tree.children![0].children![0].component).toBe('TextInput');
    expect(tree.children![0].children![0].bind).toBe('email');
  });

  it('maps dataTypes to correct components', () => {
    const def: FormspecDefinition = {
      ...minimalDef,
      items: [
        { key: 'a', type: 'field', label: 'A', dataType: 'boolean' },
        { key: 'b', type: 'field', label: 'B', dataType: 'date' },
        { key: 'c', type: 'field', label: 'C', dataType: 'choice' },
        { key: 'd', type: 'field', label: 'D', dataType: 'multiChoice' },
        { key: 'e', type: 'field', label: 'E', dataType: 'attachment' },
        { key: 'f', type: 'field', label: 'F', dataType: 'money' },
      ],
    } as FormspecDefinition;
    const tree = generateComponentTree(def);
    expect(tree.children!.map((n) => n.component)).toEqual([
      'Toggle', 'DatePicker', 'Select', 'CheckboxGroup', 'FileUpload', 'MoneyInput',
    ]);
  });

  it('handles display items', () => {
    const def: FormspecDefinition = {
      ...minimalDef,
      items: [{ key: 'header', type: 'display', label: 'Welcome' }],
    } as FormspecDefinition;
    const tree = generateComponentTree(def);
    expect(tree.children![0].component).toBe('Text');
    expect(tree.children![0].bind).toBe('header');
  });

  it('nests group children in a Stack', () => {
    const def: FormspecDefinition = {
      ...minimalDef,
      items: [
        {
          key: 'grp',
          type: 'group',
          label: 'Group',
          children: [
            { key: 'x', type: 'field', label: 'X', dataType: 'string' },
          ],
        },
      ],
    } as FormspecDefinition;
    const tree = generateComponentTree(def);
    expect(tree.children![0].component).toBe('Stack');
    expect(tree.children![0].bind).toBe('grp');
    expect(tree.children![0].children![0].bind).toBe('x');
  });
});

describe('resolveNode', () => {
  const tree: ComponentNode = {
    component: 'Stack',
    children: [
      { component: 'TextInput', bind: 'a' },
      {
        component: 'Grid',
        children: [
          { component: 'NumberInput', bind: 'b' },
          { component: 'Toggle', bind: 'c' },
        ],
      },
    ],
  };

  it('resolves empty path to root', () => {
    expect(resolveNode(tree, '')).toBe(tree);
  });

  it('resolves single index', () => {
    expect(resolveNode(tree, '0')?.component).toBe('TextInput');
  });

  it('resolves nested path', () => {
    expect(resolveNode(tree, '1.1')?.bind).toBe('c');
  });

  it('returns null for out-of-bounds', () => {
    expect(resolveNode(tree, '5')).toBeNull();
  });
});

describe('classifyNode', () => {
  it('classifies layout nodes', () => {
    expect(classifyNode({ component: 'Stack' })).toBe('layout');
    expect(classifyNode({ component: 'Grid' })).toBe('layout');
    expect(classifyNode({ component: 'Page' })).toBe('layout');
    expect(classifyNode({ component: 'Wizard' })).toBe('layout');
    expect(classifyNode({ component: 'Columns' })).toBe('layout');
    expect(classifyNode({ component: 'Tabs' })).toBe('layout');
  });

  it('classifies bound input nodes', () => {
    expect(classifyNode({ component: 'TextInput', bind: 'x' })).toBe('bound-input');
    expect(classifyNode({ component: 'Select', bind: 'y' })).toBe('bound-input');
  });

  it('classifies bound display nodes', () => {
    expect(classifyNode({ component: 'Heading', bind: 'h' })).toBe('bound-display');
    expect(classifyNode({ component: 'Text', bind: 't' })).toBe('bound-display');
  });

  it('classifies structure-only nodes', () => {
    expect(classifyNode({ component: 'Spacer' })).toBe('structure-only');
    expect(classifyNode({ component: 'Divider' })).toBe('structure-only');
    expect(classifyNode({ component: 'SubmitButton' })).toBe('structure-only');
    expect(classifyNode({ component: 'Alert' })).toBe('structure-only');
  });

  it('classifies group wrappers', () => {
    // A Stack/Card with bind is a group wrapper
    expect(classifyNode({ component: 'Stack', bind: 'grp' })).toBe('group');
    expect(classifyNode({ component: 'Card', bind: 'grp' })).toBe('group');
  });
});

describe('getNodeLabel', () => {
  it('returns label from bound definition item', () => {
    const items = [{ key: 'email', type: 'field' as const, label: 'Email Address', dataType: 'string' as const }];
    expect(getNodeLabel({ component: 'TextInput', bind: 'email' }, items)).toBe('Email Address');
  });

  it('returns component name for unbound layout', () => {
    expect(getNodeLabel({ component: 'Grid' }, [])).toBe('Grid');
  });

  it('uses title prop for Page/Card', () => {
    expect(getNodeLabel({ component: 'Page', title: 'Step 1' }, [])).toBe('Step 1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/logic/__tests__/component-tree.test.ts`
Expected: FAIL — module `../component-tree` not found

**Step 3: Write minimal implementation**

Create `form-builder/src/logic/component-tree.ts`:

```typescript
import type { FormspecDefinition, FormspecItem } from 'formspec-engine';
import type { ComponentNode, NodeKind } from '../types';

// --- DataType → Component mapping ---

const DATA_TYPE_COMPONENT: Record<string, string> = {
  string: 'TextInput',
  text: 'TextInput',
  integer: 'NumberInput',
  decimal: 'NumberInput',
  number: 'NumberInput',
  boolean: 'Toggle',
  date: 'DatePicker',
  dateTime: 'DatePicker',
  time: 'DatePicker',
  uri: 'TextInput',
  attachment: 'FileUpload',
  choice: 'Select',
  multiChoice: 'CheckboxGroup',
  money: 'MoneyInput',
};

// --- Component classification ---

const LAYOUT_COMPONENTS = new Set([
  'Stack', 'Grid', 'Page', 'Wizard', 'Columns', 'Tabs', 'Accordion',
]);

const INPUT_COMPONENTS = new Set([
  'TextInput', 'NumberInput', 'DatePicker', 'Select', 'CheckboxGroup',
  'Toggle', 'FileUpload', 'RadioGroup', 'MoneyInput', 'Slider', 'Rating', 'Signature',
]);

const DISPLAY_COMPONENTS = new Set([
  'Heading', 'Text', 'Summary', 'ValidationSummary', 'ProgressBar', 'DataTable',
]);

const CONTAINER_COMPONENTS = new Set([
  'Card', 'Collapsible', 'ConditionalGroup', 'Panel', 'Modal', 'Popover',
]);

export function classifyNode(node: ComponentNode): NodeKind {
  const { component, bind } = node;

  // A container or layout with a bind is a group wrapper
  if (bind && (CONTAINER_COMPONENTS.has(component) || LAYOUT_COMPONENTS.has(component))) {
    return 'group';
  }

  if (LAYOUT_COMPONENTS.has(component)) return 'layout';
  if (INPUT_COMPONENTS.has(component) && bind) return 'bound-input';
  if (DISPLAY_COMPONENTS.has(component) && bind) return 'bound-display';
  if (CONTAINER_COMPONENTS.has(component)) return 'layout'; // unbound container = layout

  return 'structure-only';
}

// --- Tree navigation ---

export function resolveNode(tree: ComponentNode, path: string): ComponentNode | null {
  if (path === '') return tree;
  const indices = path.split('.').map(Number);
  let current: ComponentNode = tree;
  for (const idx of indices) {
    if (!current.children || idx < 0 || idx >= current.children.length) return null;
    current = current.children[idx];
  }
  return current;
}

export function parentPath(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.substring(0, lastDot);
}

export function childIndex(path: string): number {
  const lastDot = path.lastIndexOf('.');
  return Number(lastDot === -1 ? path : path.substring(lastDot + 1));
}

// --- Label resolution ---

export function getNodeLabel(
  node: ComponentNode,
  definitionItems: FormspecItem[],
): string {
  // Check title prop (Page, Card, Collapsible, etc.)
  if (typeof node.title === 'string' && node.title) return node.title;

  // Check bound definition item
  if (node.bind) {
    const item = findItemByKeyFlat(node.bind, definitionItems);
    if (item?.label) return item.label;
  }

  // Fallback to component name
  return node.component;
}

function findItemByKeyFlat(key: string, items: FormspecItem[]): FormspecItem | null {
  for (const item of items) {
    if (item.key === key) return item;
    if (item.children) {
      const found = findItemByKeyFlat(key, item.children);
      if (found) return found;
    }
  }
  return null;
}

// --- Component tree generation from definition ---

function itemToNode(item: FormspecItem): ComponentNode {
  if (item.type === 'display') {
    return { component: 'Text', bind: item.key };
  }
  if (item.type === 'group') {
    const children = (item.children ?? []).map(itemToNode);
    return { component: 'Stack', bind: item.key, children };
  }
  const component = DATA_TYPE_COMPONENT[item.dataType ?? 'string'] ?? 'TextInput';
  return { component, bind: item.key };
}

export function generateComponentTree(definition: FormspecDefinition): ComponentNode {
  const pageMode = (definition as Record<string, unknown>).formPresentation as
    | { pageMode?: string }
    | undefined;
  const isWizard = pageMode?.pageMode === 'wizard';

  const children = definition.items.map((item) => {
    if (isWizard && item.type === 'group') {
      const pageChildren = (item.children ?? []).map(itemToNode);
      return { component: 'Page', title: item.label, bind: item.key, children: pageChildren } as ComponentNode;
    }
    return itemToNode(item);
  });

  return {
    component: isWizard ? 'Wizard' : 'Stack',
    children,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/logic/__tests__/component-tree.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(studio): add component tree generator and node utilities
```

---

### Task 3: Component Tree Mutation Operations

Pure functions for add/delete/reorder/update on the component tree. These return new trees (immutable).

**Files:**
- Create: `form-builder/src/logic/component-tree-ops.ts`
- Create: `form-builder/src/logic/__tests__/component-tree-ops.test.ts`

**Step 1: Write the failing test**

Create `form-builder/src/logic/__tests__/component-tree-ops.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  insertNode,
  removeNode,
  moveNode,
  updateNodeProps,
} from '../component-tree-ops';
import type { ComponentNode } from '../../types';

function makeTree(): ComponentNode {
  return {
    component: 'Stack',
    children: [
      { component: 'TextInput', bind: 'name' },
      {
        component: 'Grid',
        children: [
          { component: 'NumberInput', bind: 'age' },
          { component: 'Toggle', bind: 'active' },
        ],
      },
      { component: 'Divider' },
    ],
  };
}

describe('insertNode', () => {
  it('inserts at root level', () => {
    const tree = makeTree();
    const node: ComponentNode = { component: 'Spacer' };
    const result = insertNode(tree, '', 1, node);
    expect(result.children).toHaveLength(4);
    expect(result.children![1].component).toBe('Spacer');
    expect(result.children![2].component).toBe('Grid');
  });

  it('inserts into nested parent', () => {
    const tree = makeTree();
    const node: ComponentNode = { component: 'Select', bind: 'color' };
    const result = insertNode(tree, '1', 0, node);
    expect(result.children![1].children).toHaveLength(3);
    expect(result.children![1].children![0].bind).toBe('color');
  });

  it('inserts at end when index equals length', () => {
    const tree = makeTree();
    const node: ComponentNode = { component: 'Spacer' };
    const result = insertNode(tree, '', 3, node);
    expect(result.children).toHaveLength(4);
    expect(result.children![3].component).toBe('Spacer');
  });
});

describe('removeNode', () => {
  it('removes from root level', () => {
    const tree = makeTree();
    const result = removeNode(tree, '2');
    expect(result.children).toHaveLength(2);
    expect(result.children!.every((n) => n.component !== 'Divider')).toBe(true);
  });

  it('removes from nested parent', () => {
    const tree = makeTree();
    const result = removeNode(tree, '1.0');
    expect(result.children![1].children).toHaveLength(1);
    expect(result.children![1].children![0].bind).toBe('active');
  });

  it('returns tree unchanged for invalid path', () => {
    const tree = makeTree();
    const result = removeNode(tree, '99');
    expect(result.children).toHaveLength(3);
  });
});

describe('moveNode', () => {
  it('moves within same parent', () => {
    const tree = makeTree();
    // Move Divider (index 2) to position 0
    const result = moveNode(tree, '2', '', 0);
    expect(result.children![0].component).toBe('Divider');
    expect(result.children![1].component).toBe('TextInput');
  });

  it('moves between parents', () => {
    const tree = makeTree();
    // Move 'name' TextInput (root index 0) into Grid (root index 1) at position 0
    const result = moveNode(tree, '0', '1', 0);
    // Root should now have 2 children (Grid moved to index 0 since name was removed, Divider)
    expect(result.children).toHaveLength(2);
    // The Grid (now at index 0) should have 3 children
    expect(result.children![0].children).toHaveLength(3);
    expect(result.children![0].children![0].bind).toBe('name');
  });
});

describe('updateNodeProps', () => {
  it('updates properties on a node', () => {
    const tree = makeTree();
    const result = updateNodeProps(tree, '0', { placeholder: 'Enter name' });
    expect(result.children![0].placeholder).toBe('Enter name');
    expect(result.children![0].bind).toBe('name'); // preserved
  });

  it('updates nested node', () => {
    const tree = makeTree();
    const result = updateNodeProps(tree, '1', { columns: 3, gap: '16px' });
    expect(result.children![1].columns).toBe(3);
    expect(result.children![1].gap).toBe('16px');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/logic/__tests__/component-tree-ops.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `form-builder/src/logic/component-tree-ops.ts`:

```typescript
import type { ComponentNode } from '../types';
import { resolveNode, parentPath, childIndex } from './component-tree';

/** Deep-clone a component tree (structuredClone). */
function cloneTree(tree: ComponentNode): ComponentNode {
  return structuredClone(tree);
}

/** Insert a node as a child of parentPath at the given index. */
export function insertNode(
  tree: ComponentNode,
  parentPathStr: string,
  insertIndex: number,
  node: ComponentNode,
): ComponentNode {
  const result = cloneTree(tree);
  const parent = resolveNode(result, parentPathStr);
  if (!parent) return result;
  if (!parent.children) parent.children = [];
  parent.children.splice(insertIndex, 0, node);
  return result;
}

/** Remove the node at the given path. */
export function removeNode(tree: ComponentNode, nodePath: string): ComponentNode {
  if (nodePath === '') return tree; // can't remove root
  const result = cloneTree(tree);
  const pPath = parentPath(nodePath);
  const idx = childIndex(nodePath);
  const parent = resolveNode(result, pPath);
  if (!parent?.children || idx < 0 || idx >= parent.children.length) return result;
  parent.children.splice(idx, 1);
  return result;
}

/** Move a node from sourcePath to become a child of destParentPath at destIndex. */
export function moveNode(
  tree: ComponentNode,
  sourcePath: string,
  destParentPath: string,
  destIndex: number,
): ComponentNode {
  const result = cloneTree(tree);
  const srcParentPathStr = parentPath(sourcePath);
  const srcIdx = childIndex(sourcePath);

  const srcParent = resolveNode(result, srcParentPathStr);
  if (!srcParent?.children || srcIdx < 0 || srcIdx >= srcParent.children.length) return result;

  const [moved] = srcParent.children.splice(srcIdx, 1);

  const destParent = resolveNode(result, destParentPath);
  if (!destParent) return result;
  if (!destParent.children) destParent.children = [];

  // Adjust index if same parent and source was before dest
  let adjustedIndex = destIndex;
  if (srcParentPathStr === destParentPath && srcIdx < destIndex) {
    adjustedIndex -= 1;
  }

  destParent.children.splice(adjustedIndex, 0, moved);
  return result;
}

/** Update component-specific properties on a node (shallow merge). */
export function updateNodeProps(
  tree: ComponentNode,
  nodePath: string,
  props: Record<string, unknown>,
): ComponentNode {
  const result = cloneTree(tree);
  const node = resolveNode(result, nodePath);
  if (!node) return result;
  Object.assign(node, props);
  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/logic/__tests__/component-tree-ops.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(studio): add component tree mutation operations
```

---

### Task 4: Add-Picker Catalog

The categorized picker needs a catalog of all available components organized by category with metadata.

**Files:**
- Create: `form-builder/src/logic/add-picker-catalog.ts`
- Create: `form-builder/src/logic/__tests__/add-picker-catalog.test.ts`

**Step 1: Write the failing test**

Create `form-builder/src/logic/__tests__/add-picker-catalog.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ADD_CATALOG, getCatalogByCategory } from '../add-picker-catalog';

describe('ADD_CATALOG', () => {
  it('contains entries for all four categories', () => {
    const categories = new Set(ADD_CATALOG.map((e) => e.category));
    expect(categories).toEqual(new Set(['layout', 'input', 'display', 'structure']));
  });

  it('input entries all set createsDefinitionItem and defaultDataType', () => {
    const inputs = ADD_CATALOG.filter((e) => e.category === 'input');
    for (const entry of inputs) {
      expect(entry.createsDefinitionItem).toBe(true);
      expect(entry.defaultDataType).toBeTruthy();
      expect(entry.definitionType).toBe('field');
    }
  });

  it('layout entries do not create definition items', () => {
    const layouts = ADD_CATALOG.filter((e) => e.category === 'layout');
    for (const entry of layouts) {
      expect(entry.createsDefinitionItem).toBeFalsy();
    }
  });
});

describe('getCatalogByCategory', () => {
  it('returns grouped entries', () => {
    const grouped = getCatalogByCategory();
    expect(grouped.layout.length).toBeGreaterThan(0);
    expect(grouped.input.length).toBeGreaterThan(0);
    expect(grouped.display.length).toBeGreaterThan(0);
    expect(grouped.structure.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/logic/__tests__/add-picker-catalog.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `form-builder/src/logic/add-picker-catalog.ts`:

```typescript
import type { AddPickerEntry } from '../types';

export const ADD_CATALOG: AddPickerEntry[] = [
  // --- Layout ---
  { component: 'Stack', label: 'Stack', category: 'layout' },
  { component: 'Grid', label: 'Grid', category: 'layout' },
  { component: 'Page', label: 'Page', category: 'layout', promptForLabel: true },
  { component: 'Wizard', label: 'Wizard', category: 'layout' },
  { component: 'Card', label: 'Card', category: 'layout', promptForLabel: true },
  { component: 'Collapsible', label: 'Collapsible', category: 'layout', promptForLabel: true },
  { component: 'Columns', label: 'Columns', category: 'layout' },
  { component: 'Tabs', label: 'Tabs', category: 'layout' },
  { component: 'Accordion', label: 'Accordion', category: 'layout' },

  // --- Input ---
  { component: 'TextInput', label: 'Text Input', category: 'input', defaultDataType: 'string', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'NumberInput', label: 'Number Input', category: 'input', defaultDataType: 'integer', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'DatePicker', label: 'Date Picker', category: 'input', defaultDataType: 'date', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'Select', label: 'Select', category: 'input', defaultDataType: 'choice', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'RadioGroup', label: 'Radio Group', category: 'input', defaultDataType: 'choice', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'CheckboxGroup', label: 'Checkbox Group', category: 'input', defaultDataType: 'multiChoice', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'Toggle', label: 'Toggle', category: 'input', defaultDataType: 'boolean', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'FileUpload', label: 'File Upload', category: 'input', defaultDataType: 'attachment', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'MoneyInput', label: 'Money Input', category: 'input', defaultDataType: 'money', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'Slider', label: 'Slider', category: 'input', defaultDataType: 'decimal', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'Rating', label: 'Rating', category: 'input', defaultDataType: 'integer', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },
  { component: 'Signature', label: 'Signature', category: 'input', defaultDataType: 'attachment', createsDefinitionItem: true, definitionType: 'field', promptForLabel: true },

  // --- Display ---
  { component: 'Heading', label: 'Heading', category: 'display', createsDefinitionItem: true, definitionType: 'display', promptForLabel: true },
  { component: 'Text', label: 'Text', category: 'display', createsDefinitionItem: true, definitionType: 'display', promptForLabel: true },
  { component: 'Divider', label: 'Divider', category: 'display' },
  { component: 'Alert', label: 'Alert', category: 'display' },
  { component: 'Badge', label: 'Badge', category: 'display' },
  { component: 'ProgressBar', label: 'Progress Bar', category: 'display' },
  { component: 'Summary', label: 'Summary', category: 'display' },
  { component: 'ValidationSummary', label: 'Validation Summary', category: 'display' },
  { component: 'SubmitButton', label: 'Submit Button', category: 'display' },

  // --- Structure ---
  { component: 'Group', label: 'Group', category: 'structure', createsDefinitionItem: true, definitionType: 'group', promptForLabel: true },
  { component: 'ConditionalGroup', label: 'Conditional Group', category: 'structure' },
  { component: 'Spacer', label: 'Spacer', category: 'structure' },
  { component: 'DataTable', label: 'Data Table', category: 'structure' },
];

export function getCatalogByCategory(): Record<string, AddPickerEntry[]> {
  const result: Record<string, AddPickerEntry[]> = { layout: [], input: [], display: [], structure: [] };
  for (const entry of ADD_CATALOG) {
    result[entry.category].push(entry);
  }
  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/logic/__tests__/add-picker-catalog.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(studio): add categorized component picker catalog
```

---

### Task 5: Component-Definition Sync Logic

When adding/deleting bound nodes, we need to sync the definition. This is pure logic — no signals.

**Files:**
- Create: `form-builder/src/logic/component-def-sync.ts`
- Create: `form-builder/src/logic/__tests__/component-def-sync.test.ts`

**Step 1: Write the failing test**

Create `form-builder/src/logic/__tests__/component-def-sync.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  addBoundItem,
  removeBoundItem,
  findGroupForNode,
  generateUniqueKey,
} from '../component-def-sync';
import type { FormspecDefinition } from 'formspec-engine';
import type { ComponentNode, AddPickerEntry } from '../../types';

const baseDef: FormspecDefinition = {
  $formspec: '1.0',
  url: 'https://example.com/test',
  version: '1.0.0',
  status: 'draft',
  title: 'Test',
  items: [
    {
      key: 'info',
      type: 'group',
      label: 'Info',
      children: [
        { key: 'name', type: 'field', label: 'Name', dataType: 'string' },
      ],
    },
    { key: 'notes', type: 'field', label: 'Notes', dataType: 'text' },
  ],
} as FormspecDefinition;

describe('generateUniqueKey', () => {
  it('generates kebab-case key from label', () => {
    expect(generateUniqueKey('Full Name', baseDef)).toBe('fullName');
  });

  it('deduplicates existing keys', () => {
    expect(generateUniqueKey('Name', baseDef)).toBe('name2');
  });

  it('handles empty label', () => {
    const key = generateUniqueKey('', baseDef);
    expect(key).toBe('item');
  });
});

describe('addBoundItem', () => {
  it('adds a field to root items', () => {
    const tree: ComponentNode = {
      component: 'Stack',
      children: [
        { component: 'Stack', bind: 'info', children: [{ component: 'TextInput', bind: 'name' }] },
        { component: 'TextInput', bind: 'notes' },
      ],
    };
    const entry: AddPickerEntry = {
      component: 'TextInput',
      label: 'Text Input',
      category: 'input',
      defaultDataType: 'string',
      createsDefinitionItem: true,
      definitionType: 'field',
      promptForLabel: true,
    };
    const result = addBoundItem(baseDef, tree, '', 'email', 'Email Address', entry);
    expect(result.items).toHaveLength(3);
    expect(result.items[2].key).toBe('email');
    expect(result.items[2].label).toBe('Email Address');
    expect(result.items[2].dataType).toBe('string');
  });

  it('adds a field inside a group when parent is bound to a group', () => {
    const tree: ComponentNode = {
      component: 'Stack',
      children: [
        { component: 'Stack', bind: 'info', children: [{ component: 'TextInput', bind: 'name' }] },
      ],
    };
    const entry: AddPickerEntry = {
      component: 'NumberInput',
      label: 'Number Input',
      category: 'input',
      defaultDataType: 'integer',
      createsDefinitionItem: true,
      definitionType: 'field',
      promptForLabel: true,
    };
    const result = addBoundItem(baseDef, tree, '0', 'age', 'Age', entry);
    const infoGroup = result.items.find((i) => i.key === 'info')!;
    expect(infoGroup.children).toHaveLength(2);
    expect(infoGroup.children![1].key).toBe('age');
  });

  it('adds a display item', () => {
    const tree: ComponentNode = { component: 'Stack', children: [] };
    const entry: AddPickerEntry = {
      component: 'Heading',
      label: 'Heading',
      category: 'display',
      createsDefinitionItem: true,
      definitionType: 'display',
      promptForLabel: true,
    };
    const result = addBoundItem(baseDef, tree, '', 'welcome', 'Welcome', entry);
    const added = result.items.find((i) => i.key === 'welcome')!;
    expect(added.type).toBe('display');
    expect(added.label).toBe('Welcome');
  });

  it('adds a group item', () => {
    const tree: ComponentNode = { component: 'Stack', children: [] };
    const entry: AddPickerEntry = {
      component: 'Group',
      label: 'Group',
      category: 'structure',
      createsDefinitionItem: true,
      definitionType: 'group',
      promptForLabel: true,
    };
    const result = addBoundItem(baseDef, tree, '', 'contact', 'Contact', entry);
    const added = result.items.find((i) => i.key === 'contact')!;
    expect(added.type).toBe('group');
    expect(added.children).toEqual([]);
  });
});

describe('removeBoundItem', () => {
  it('removes a field from root', () => {
    const result = removeBoundItem(baseDef, 'notes');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].key).toBe('info');
  });

  it('removes a field from inside a group', () => {
    const result = removeBoundItem(baseDef, 'name');
    const info = result.items.find((i) => i.key === 'info')!;
    expect(info.children).toHaveLength(0);
  });

  it('returns unchanged if key not found', () => {
    const result = removeBoundItem(baseDef, 'nonexistent');
    expect(result.items).toHaveLength(2);
  });
});

describe('findGroupForNode', () => {
  it('returns null for root-level parent', () => {
    const tree: ComponentNode = {
      component: 'Stack',
      children: [{ component: 'TextInput', bind: 'x' }],
    };
    expect(findGroupForNode(tree, '', baseDef)).toBeNull();
  });

  it('returns group key when parent node is bound to a group', () => {
    const tree: ComponentNode = {
      component: 'Stack',
      children: [
        { component: 'Stack', bind: 'info', children: [{ component: 'TextInput', bind: 'name' }] },
      ],
    };
    expect(findGroupForNode(tree, '0', baseDef)).toBe('info');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/logic/__tests__/component-def-sync.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `form-builder/src/logic/component-def-sync.ts`:

```typescript
import type { FormspecDefinition, FormspecItem } from 'formspec-engine';
import type { AddPickerEntry, ComponentNode } from '../types';
import { resolveNode } from './component-tree';

/** Generate a unique camelCase key from a label. */
export function generateUniqueKey(label: string, definition: FormspecDefinition): string {
  const base = label
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => (i === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join('');

  const keyBase = base || 'item';
  const allKeys = collectAllKeys(definition.items);
  if (!allKeys.has(keyBase)) return keyBase;

  let counter = 2;
  while (allKeys.has(`${keyBase}${counter}`)) counter++;
  return `${keyBase}${counter}`;
}

function collectAllKeys(items: FormspecItem[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    keys.add(item.key);
    if (item.children) {
      for (const k of collectAllKeys(item.children)) keys.add(k);
    }
  }
  return keys;
}

/** Find which definition group a component tree parent corresponds to. */
export function findGroupForNode(
  tree: ComponentNode,
  parentPath: string,
  definition: FormspecDefinition,
): string | null {
  const parentNode = resolveNode(tree, parentPath);
  if (!parentNode?.bind) return null;

  // Check if the bind points to a group in the definition
  const item = findItemDeep(definition.items, parentNode.bind);
  if (item?.type === 'group') return parentNode.bind;

  return null;
}

/** Add a definition item when a bound component is added. */
export function addBoundItem(
  definition: FormspecDefinition,
  tree: ComponentNode,
  parentPath: string,
  key: string,
  label: string,
  entry: AddPickerEntry,
): FormspecDefinition {
  const result = structuredClone(definition);

  const newItem: FormspecItem = {
    key,
    label,
    type: entry.definitionType ?? 'field',
    ...(entry.defaultDataType ? { dataType: entry.defaultDataType } : {}),
    ...(entry.definitionType === 'group' ? { children: [] } : {}),
  } as FormspecItem;

  // Find which group to insert into
  const groupKey = findGroupForNode(tree, parentPath, definition);

  if (groupKey) {
    const group = findItemDeep(result.items, groupKey);
    if (group && group.children) {
      group.children.push(newItem);
    }
  } else {
    result.items.push(newItem);
  }

  return result;
}

/** Remove a definition item when a bound component is deleted. */
export function removeBoundItem(
  definition: FormspecDefinition,
  bindKey: string,
): FormspecDefinition {
  const result = structuredClone(definition);
  removeItemDeep(result.items, bindKey);
  return result;
}

function findItemDeep(items: FormspecItem[], key: string): FormspecItem | null {
  for (const item of items) {
    if (item.key === key) return item;
    if (item.children) {
      const found = findItemDeep(item.children, key);
      if (found) return found;
    }
  }
  return null;
}

function removeItemDeep(items: FormspecItem[], key: string): boolean {
  for (let i = 0; i < items.length; i++) {
    if (items[i].key === key) {
      items.splice(i, 1);
      return true;
    }
    if (items[i].children && removeItemDeep(items[i].children!, key)) {
      return true;
    }
  }
  return false;
}
```

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/logic/__tests__/component-def-sync.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(studio): add component-definition sync logic
```

---

## Phase 2: State Layer

### Task 6: Component Document State + Selection Migration

Add `componentDoc` signal, update `selectedPath` semantics, and wire generation/sync.

**Files:**
- Modify: `form-builder/src/state/project.ts`
- Modify: `form-builder/src/state/selection.ts`
- Modify: `form-builder/src/types.ts`
- Create: `form-builder/src/state/__tests__/component-state.test.ts`

**Step 1: Write the failing test**

Create `form-builder/src/state/__tests__/component-state.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { componentDoc, componentVersion, setComponentDoc } from '../project';
import { selectedPath } from '../selection';
import type { ComponentDocument } from '../../types';

beforeEach(() => {
  componentDoc.value = null;
  componentVersion.value = 0;
  selectedPath.value = null;
});

describe('componentDoc signal', () => {
  it('starts null', () => {
    expect(componentDoc.value).toBeNull();
  });

  it('setComponentDoc updates signal and bumps version', () => {
    const doc: ComponentDocument = {
      $formspecComponent: '1.0',
      version: '1.0.0',
      targetDefinition: { url: 'https://example.com' },
      tree: { component: 'Stack', children: [] },
    };
    setComponentDoc(doc);
    expect(componentDoc.value).toEqual(doc);
    expect(componentVersion.value).toBe(1);
  });
});

describe('selectedPath', () => {
  it('stores component tree path strings', () => {
    selectedPath.value = '0.1';
    expect(selectedPath.value).toBe('0.1');
  });

  it('empty string means root node selected', () => {
    selectedPath.value = '';
    expect(selectedPath.value).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/state/__tests__/component-state.test.ts`
Expected: FAIL — `componentDoc` not exported

**Step 3: Update state/project.ts**

Add to `form-builder/src/state/project.ts`:

```typescript
import type { ComponentDocument } from '../types';

// ... existing exports ...

export const componentDoc = signal<ComponentDocument | null>(null);
export const componentVersion = signal(0);

export function setComponentDoc(doc: ComponentDocument | null) {
  componentDoc.value = doc;
  componentVersion.value += 1;
}

export function updateComponentDoc(mutator: (doc: ComponentDocument) => void) {
  const current = componentDoc.value;
  if (!current) return;
  mutator(current);
  componentDoc.value = current;
  componentVersion.value += 1;
}
```

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/state/__tests__/component-state.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(studio): add componentDoc state signal and selection path migration
```

---

### Task 7: Wire Component Tree Generation into Definition Lifecycle

When a definition is loaded (via `setDefinition`), auto-generate a component tree if one doesn't exist.

**Files:**
- Modify: `form-builder/src/state/definition.ts`
- Create: `form-builder/src/state/__tests__/definition-component-sync.test.ts`

**Step 1: Write the failing test**

Create `form-builder/src/state/__tests__/definition-component-sync.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setDefinition, definition } from '../definition';
import { componentDoc, componentVersion } from '../project';
import type { FormspecDefinition } from 'formspec-engine';

const testDef: FormspecDefinition = {
  $formspec: '1.0',
  url: 'https://example.com/test',
  version: '1.0.0',
  status: 'draft',
  title: 'Test',
  items: [
    { key: 'name', type: 'field', label: 'Name', dataType: 'string' },
  ],
} as FormspecDefinition;

beforeEach(() => {
  componentDoc.value = null;
  componentVersion.value = 0;
});

describe('setDefinition component tree generation', () => {
  it('auto-generates component tree when componentDoc is null', () => {
    setDefinition(testDef);
    expect(componentDoc.value).not.toBeNull();
    expect(componentDoc.value!.tree.component).toBe('Stack');
    expect(componentDoc.value!.tree.children).toHaveLength(1);
    expect(componentDoc.value!.tree.children![0].component).toBe('TextInput');
    expect(componentDoc.value!.tree.children![0].bind).toBe('name');
  });

  it('sets targetDefinition from definition URL', () => {
    setDefinition(testDef);
    expect(componentDoc.value!.targetDefinition.url).toBe('https://example.com/test');
  });

  it('preserves existing componentDoc when already set', () => {
    const existing = {
      $formspecComponent: '1.0' as const,
      version: '2.0.0',
      targetDefinition: { url: 'https://other.com' },
      tree: { component: 'Grid', children: [] },
    };
    componentDoc.value = existing;
    setDefinition(testDef);
    // Should NOT overwrite — the user may have customized the component tree
    expect(componentDoc.value!.tree.component).toBe('Grid');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/state/__tests__/definition-component-sync.test.ts`
Expected: FAIL — auto-generation not wired

**Step 3: Wire generation into setDefinition**

In `form-builder/src/state/definition.ts`, add import and call:

```typescript
import { generateComponentTree } from '../logic/component-tree';
import { componentDoc, setComponentDoc } from './project';
import type { ComponentDocument } from '../types';

// In setDefinition, after rebuildEngine(next):
export function setDefinition(next: FormspecDefinition) {
  batch(() => {
    definition.value = next;
    definitionVersion.value += 1;
    project.value = { ...project.value, definition: next };
  });
  rebuildEngine(next);

  // Auto-generate component tree if none exists
  if (!componentDoc.value) {
    const tree = generateComponentTree(next);
    setComponentDoc({
      $formspecComponent: '1.0',
      version: '1.0.0',
      targetDefinition: { url: next.url },
      tree,
    });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/state/__tests__/definition-component-sync.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(studio): auto-generate component tree on definition load
```

---

## Phase 3: Tree Editor Rewrite

### Task 8: Tree Editor — Read from Component Tree

Rewrite the tree editor to render from `componentDoc.tree` instead of `definition.items`.

**Files:**
- Rewrite: `form-builder/src/components/tree/tree-editor.tsx`
- Create: `form-builder/src/__tests__/tree-editor-unified.test.tsx`

**Step 1: Write the failing test**

Create `form-builder/src/__tests__/tree-editor-unified.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { TreeEditor } from '../components/tree/tree-editor';
import { componentDoc, componentVersion, setComponentDoc } from '../state/project';
import { selectedPath } from '../state/selection';
import { definition, definitionVersion, setDefinition } from '../state/definition';
import type { ComponentDocument } from '../types';
import type { FormspecDefinition } from 'formspec-engine';

const testDef: FormspecDefinition = {
  $formspec: '1.0',
  url: 'https://example.com',
  version: '1.0.0',
  status: 'draft',
  title: 'Test Form',
  items: [
    { key: 'name', type: 'field', label: 'Full Name', dataType: 'string' },
    {
      key: 'info',
      type: 'group',
      label: 'Info Section',
      children: [
        { key: 'email', type: 'field', label: 'Email', dataType: 'string' },
      ],
    },
  ],
} as FormspecDefinition;

const testComponentDoc: ComponentDocument = {
  $formspecComponent: '1.0',
  version: '1.0.0',
  targetDefinition: { url: 'https://example.com' },
  tree: {
    component: 'Stack',
    children: [
      { component: 'TextInput', bind: 'name' },
      {
        component: 'Card',
        title: 'Info Section',
        bind: 'info',
        children: [
          { component: 'TextInput', bind: 'email' },
        ],
      },
      { component: 'Divider' },
    ],
  },
};

beforeEach(() => {
  selectedPath.value = null;
  componentDoc.value = null;
  componentVersion.value = 0;
  setDefinition(testDef);
  setComponentDoc(testComponentDoc);
});

describe('TreeEditor (unified)', () => {
  it('renders tree from componentDoc.tree', () => {
    render(<TreeEditor />);
    // Should show component nodes, not just definition items
    expect(screen.getByText('Full Name')).toBeTruthy(); // resolved from def via bind
    expect(screen.getByText('Info Section')).toBeTruthy(); // from Card title
    expect(screen.getByText('Divider')).toBeTruthy(); // component-only node
  });

  it('shows component type badges', () => {
    render(<TreeEditor />);
    expect(screen.getByText('TextInput')).toBeTruthy();
    expect(screen.getByText('Card')).toBeTruthy();
  });

  it('shows the form title in the tree header', () => {
    render(<TreeEditor />);
    expect(screen.getByText('Test Form')).toBeTruthy();
  });

  it('selects root when header clicked', async () => {
    render(<TreeEditor />);
    const header = screen.getByText('Test Form').closest('[role="treeitem"]')!;
    header.click();
    expect(selectedPath.value).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/__tests__/tree-editor-unified.test.tsx`
Expected: FAIL — TreeEditor still reads from definition.items

**Step 3: Rewrite tree-editor.tsx**

Rewrite `form-builder/src/components/tree/tree-editor.tsx`:

```typescript
import { definition, definitionVersion } from '../../state/definition';
import { componentDoc, componentVersion } from '../../state/project';
import { selectedPath } from '../../state/selection';
import { UnifiedTreeNode } from './tree-node';

export function TreeEditor() {
  // Subscribe to both versions to re-render on changes
  definitionVersion.value;
  componentVersion.value;

  const doc = componentDoc.value;
  const def = definition.value;
  const rootSelected = selectedPath.value === '';

  if (!doc) {
    return (
      <div class="tree-editor" role="tree" aria-label="Component tree">
        <div class="tree-empty">No component tree loaded</div>
      </div>
    );
  }

  const rootNode = doc.tree;

  return (
    <div class="tree-editor" role="tree" aria-label="Component tree">
      <div
        class={`tree-header ${rootSelected ? 'selected' : ''}`}
        onClick={() => {
          selectedPath.value = '';
        }}
        role="treeitem"
        aria-level={1}
        aria-selected={rootSelected}
        tabIndex={0}
      >
        <span class="tree-header-dot" />
        <span class="tree-header-title">{def.title || 'Untitled Form'}</span>
        <span class="tree-header-meta">
          {def.url} · v{def.version}
        </span>
      </div>

      {rootNode.children?.map((child, index) => (
        <UnifiedTreeNode
          key={`${index}-${child.component}`}
          node={child}
          path={String(index)}
          depth={0}
        />
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/__tests__/tree-editor-unified.test.tsx`
Expected: PASS (after also updating TreeNode — see Task 9)

> **Note:** Tasks 8 and 9 are tightly coupled. Implement them together in one pass. The tree editor depends on the new `UnifiedTreeNode` component.

**Step 5: Commit (combined with Task 9)**

---

### Task 9: Tree Node — Component-Aware Rendering

Rewrite `TreeNode` as `UnifiedTreeNode` that renders component nodes with kind-specific colors, component type badges, and definition-resolved labels.

**Files:**
- Rewrite: `form-builder/src/components/tree/tree-node.tsx`

**Step 1: Rewrite tree-node.tsx**

Rewrite `form-builder/src/components/tree/tree-node.tsx`:

```typescript
import { type Signal, signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import { definition, definitionVersion } from '../../state/definition';
import { componentDoc, componentVersion } from '../../state/project';
import { selectedPath } from '../../state/selection';
import { classifyNode, getNodeLabel, resolveNode } from '../../logic/component-tree';
import type { ComponentNode, NodeKind } from '../../types';

const NODE_KIND_COLORS: Record<NodeKind, string> = {
  layout: '#5A8FBB',
  'bound-input': '#D4A34A',
  'bound-display': '#706C68',
  group: '#5AAFBB',
  'structure-only': '#888',
};

const expandedByPath = new Map<string, Signal<boolean>>();

function expansionSignal(path: string): Signal<boolean> {
  const existing = expandedByPath.get(path);
  if (existing) return existing;
  const created = signal(true);
  expandedByPath.set(path, created);
  return created;
}

interface UnifiedTreeNodeProps {
  node: ComponentNode;
  path: string; // component tree path like "0", "0.1", "1.2.0"
  depth: number;
}

export function UnifiedTreeNode({ node, path, depth }: UnifiedTreeNodeProps) {
  definitionVersion.value;
  componentVersion.value;

  const kind = classifyNode(node);
  const label = getNodeLabel(node, definition.value.items);
  const selected = selectedPath.value === path;
  const hasChildren = (node.children?.length ?? 0) > 0;
  const expanded = hasChildren ? expansionSignal(path) : null;

  // Resolve bound definition item for badge info
  const boundItem = node.bind ? findDefItem(node.bind) : null;

  return (
    <div class="tree-node-wrapper" data-depth={depth}>
      {depth > 0 && <div class="tree-depth-line" style={{ left: `${depth * 24 - 12}px` }} />}

      <div
        class={`tree-node ${selected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => {
          selectedPath.value = path;
        }}
        role="treeitem"
        aria-selected={selected}
        aria-expanded={hasChildren ? expanded?.value : undefined}
        aria-level={depth + 2}
        tabIndex={0}
      >
        {hasChildren && (
          <button
            class="tree-node-toggle"
            onClick={(event) => {
              event.stopPropagation();
              if (expanded) expanded.value = !expanded.value;
            }}
            aria-label={expanded?.value ? 'Collapse' : 'Expand'}
          >
            <span
              style={{
                transform: expanded?.value ? 'rotate(90deg)' : 'none',
                display: 'inline-block',
                transition: 'transform var(--duration-normal) var(--ease-out)',
              }}
            >
              ▸
            </span>
          </button>
        )}

        <span
          class="tree-node-dot"
          style={{ background: NODE_KIND_COLORS[kind] }}
          aria-hidden="true"
        />

        <span class="tree-node-label">{label}</span>

        <span class="tree-node-badge" style={{ color: NODE_KIND_COLORS[kind] }}>
          {node.component}
        </span>

        {boundItem?.dataType && (
          <span class="tree-node-badge tree-node-datatype">
            {boundItem.dataType}
          </span>
        )}

        {node.when && (
          <span class="tree-node-bind" title="Conditional">⚡</span>
        )}

        {node.bind && boundItem && (
          <BindIndicators item={boundItem} />
        )}
      </div>

      {hasChildren && expanded?.value && (
        <div role="group">
          {node.children!.map((child, index) => (
            <UnifiedTreeNode
              key={`${path}.${index}`}
              node={child}
              path={`${path}.${index}`}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BindIndicators({ item }: { item: FormspecItem }) {
  // Look up bind info from definition (required, calculate, constraint, relevant are on binds, not items)
  // For now, show nothing — bind indicators will be added when properties panel is connected
  return null;
}

function findDefItem(key: string): FormspecItem | null {
  return findDeep(definition.value.items, key);
}

function findDeep(items: FormspecItem[], key: string): FormspecItem | null {
  for (const item of items) {
    if (item.key === key) return item;
    if (item.children) {
      const found = findDeep(item.children, key);
      if (found) return found;
    }
  }
  return null;
}
```

**Step 2: Run tree editor tests**

Run: `cd form-builder && npx vitest run src/__tests__/tree-editor-unified.test.tsx`
Expected: PASS

**Step 3: Commit**

```
feat(studio): rewrite tree editor and node for unified component tree
```

---

### Task 10: Categorized Add Picker Component

Replace the inline-add form with a categorized picker overlay.

**Files:**
- Create: `form-builder/src/components/tree/add-picker.tsx`
- Modify: `form-builder/src/components/tree/tree-editor.tsx` (add "+" button wiring)
- Create: `form-builder/src/__tests__/add-picker.test.tsx`

**Step 1: Write the failing test**

Create `form-builder/src/__tests__/add-picker.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { AddPicker } from '../components/tree/add-picker';
import { componentDoc, setComponentDoc } from '../state/project';
import { definition, setDefinition } from '../state/definition';
import type { FormspecDefinition } from 'formspec-engine';

const testDef: FormspecDefinition = {
  $formspec: '1.0',
  url: 'https://example.com',
  version: '1.0.0',
  status: 'draft',
  title: 'Test',
  items: [],
} as FormspecDefinition;

beforeEach(() => {
  componentDoc.value = null;
  setDefinition(testDef);
});

describe('AddPicker', () => {
  it('renders category tabs', () => {
    const onAdd = () => {};
    const onCancel = () => {};
    render(<AddPicker parentPath="" insertIndex={0} onAdd={onAdd} onCancel={onCancel} />);
    expect(screen.getByText('Layout')).toBeTruthy();
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Display')).toBeTruthy();
    expect(screen.getByText('Structure')).toBeTruthy();
  });

  it('shows component options for selected category', () => {
    render(<AddPicker parentPath="" insertIndex={0} onAdd={() => {}} onCancel={() => {}} />);
    // Default category is 'input'
    expect(screen.getByText('Text Input')).toBeTruthy();
    expect(screen.getByText('Number Input')).toBeTruthy();
    expect(screen.getByText('Toggle')).toBeTruthy();
  });

  it('switches categories on tab click', async () => {
    render(<AddPicker parentPath="" insertIndex={0} onAdd={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Layout'));
    expect(screen.getByText('Stack')).toBeTruthy();
    expect(screen.getByText('Grid')).toBeTruthy();
  });

  it('prompts for label when input component selected', async () => {
    render(<AddPicker parentPath="" insertIndex={0} onAdd={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Text Input'));
    expect(screen.getByPlaceholderText('Enter label')).toBeTruthy();
  });

  it('calls onAdd with component node when confirmed', async () => {
    let addedNode: unknown = null;
    const onAdd = (node: unknown) => { addedNode = node; };
    render(<AddPicker parentPath="" insertIndex={0} onAdd={onAdd} onCancel={() => {}} />);

    // Click Layout > Divider (no label prompt)
    fireEvent.click(screen.getByText('Display'));
    fireEvent.click(screen.getByText('Divider'));
    expect(addedNode).toEqual({ component: 'Divider' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/__tests__/add-picker.test.tsx`
Expected: FAIL

**Step 3: Write implementation**

Create `form-builder/src/components/tree/add-picker.tsx`:

```typescript
import { signal } from '@preact/signals';
import { getCatalogByCategory } from '../../logic/add-picker-catalog';
import { generateUniqueKey, addBoundItem } from '../../logic/component-def-sync';
import { definition, setDefinition } from '../../state/definition';
import { componentDoc } from '../../state/project';
import type { AddCategory, AddPickerEntry, ComponentNode } from '../../types';

interface AddPickerProps {
  parentPath: string;
  insertIndex: number;
  onAdd: (node: ComponentNode) => void;
  onCancel: () => void;
}

const activeCategory = signal<AddCategory>('input');
const selectedEntry = signal<AddPickerEntry | null>(null);
const labelInput = signal('');

export function AddPicker({ parentPath, insertIndex, onAdd, onCancel }: AddPickerProps) {
  const catalog = getCatalogByCategory();
  const entry = selectedEntry.value;

  function handleEntryClick(e: AddPickerEntry) {
    if (e.promptForLabel) {
      selectedEntry.value = e;
      labelInput.value = '';
      return;
    }
    // No label needed — add immediately
    const node: ComponentNode = { component: e.component };
    onAdd(node);
    selectedEntry.value = null;
  }

  function handleConfirm() {
    if (!entry) return;
    const label = labelInput.value.trim() || entry.label;
    const key = generateUniqueKey(label, definition.value);
    const tree = componentDoc.value?.tree ?? { component: 'Stack', children: [] };

    // Create component node
    const node: ComponentNode = { component: entry.component };

    if (entry.createsDefinitionItem) {
      node.bind = key;
      // Also create definition item
      const newDef = addBoundItem(definition.value, tree, parentPath, key, label, entry);
      setDefinition(newDef);
    }

    if (entry.component === 'Page' || entry.component === 'Card' || entry.component === 'Collapsible') {
      node.title = label;
      node.children = [];
    }

    if (entry.component === 'Group') {
      node.component = 'Stack';
      node.children = [];
    }

    onAdd(node);
    selectedEntry.value = null;
  }

  if (entry?.promptForLabel) {
    return (
      <div class="add-picker add-picker-label">
        <div class="add-picker-label-header">
          Add {entry.label}
        </div>
        <input
          class="studio-input"
          placeholder="Enter label"
          value={labelInput.value}
          onInput={(e) => {
            labelInput.value = (e.target as HTMLInputElement).value;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') {
              selectedEntry.value = null;
            }
          }}
          autoFocus
        />
        <div class="add-picker-actions">
          <button class="btn-primary" onClick={handleConfirm}>Add</button>
          <button class="btn-ghost" onClick={() => { selectedEntry.value = null; }}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div class="add-picker">
      <div class="add-picker-tabs">
        {(['layout', 'input', 'display', 'structure'] as AddCategory[]).map((cat) => (
          <button
            key={cat}
            class={`add-picker-tab ${activeCategory.value === cat ? 'active' : ''}`}
            onClick={() => {
              activeCategory.value = cat;
            }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>
      <div class="add-picker-grid">
        {catalog[activeCategory.value].map((e) => (
          <button
            key={e.component}
            class="add-picker-option"
            onClick={() => handleEntryClick(e)}
          >
            {e.label}
          </button>
        ))}
      </div>
      <div class="add-picker-actions">
        <button class="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/__tests__/add-picker.test.tsx`
Expected: PASS

**Step 5: Commit**

```
feat(studio): add categorized component picker
```

---

### Task 11: Wire Add/Delete into Tree Editor

Add the "+" gap buttons and delete action to the unified tree, using the picker and component-tree-ops.

**Files:**
- Modify: `form-builder/src/components/tree/tree-editor.tsx` (add "+" buttons)
- Modify: `form-builder/src/components/tree/tree-node.tsx` (add actions: delete, move)
- Modify: `form-builder/src/state/selection.ts` (add `addPickerState` signal)

**Step 1: Add addPickerState to selection.ts**

```typescript
// In selection.ts, add:
export interface AddPickerState {
  parentPath: string;
  insertIndex: number;
}

export const addPickerState = signal<AddPickerState | null>(null);
```

**Step 2: Wire into tree-editor.tsx**

Update `tree-editor.tsx` to include the `+` gap triggers and the `AddPicker` overlay. Between each child node, render a thin insertion gap that on click sets `addPickerState`. When `addPickerState` is set, render the `AddPicker` inline at that position.

The `onAdd` callback in the tree editor should:
1. Call `insertNode` from component-tree-ops to add the node to the component tree
2. Call `setComponentDoc` with the updated tree
3. Select the new node
4. Clear `addPickerState`

The `onDelete` in tree-node should:
1. If node has `bind`, call `removeBoundItem` to remove from definition
2. Call `removeNode` to remove from component tree
3. Call `setComponentDoc` with the updated tree
4. Clear selection if deleted node was selected

**Step 3: Implement** (exact code depends on test-driven iteration — follow the pattern established in Tasks 8-10)

**Step 4: Run all tree tests**

Run: `cd form-builder && npx vitest run src/__tests__/tree-editor-unified.test.tsx src/__tests__/add-picker.test.tsx`
Expected: PASS

**Step 5: Commit**

```
feat(studio): wire add/delete operations into unified tree editor
```

---

### Task 12: Drag-Drop for Component Tree

Update drag-drop logic to work with component tree paths instead of definition keys.

**Files:**
- Rewrite: `form-builder/src/components/tree/drag-drop.ts`

**Step 1: Rewrite drag-drop.ts**

```typescript
import { signal } from '@preact/signals';
import { moveNode } from '../../logic/component-tree-ops';
import { componentDoc, setComponentDoc, updateComponentDoc } from '../../state/project';
import type { ComponentNode } from '../../types';

export const draggedPath = signal<string | null>(null);

export interface DropTarget {
  parentPath: string;
  insertIndex: number;
  mode: 'above' | 'below' | 'inside';
}

export const dropTarget = signal<DropTarget | null>(null);

export function executeDrop() {
  const src = draggedPath.value;
  const target = dropTarget.value;
  const doc = componentDoc.value;

  if (!src || !target || !doc) {
    draggedPath.value = null;
    dropTarget.value = null;
    return;
  }

  const newTree = moveNode(doc.tree, src, target.parentPath, target.insertIndex);
  setComponentDoc({ ...doc, tree: newTree });

  draggedPath.value = null;
  dropTarget.value = null;
}
```

**Step 2: Run test**

Run: `cd form-builder && npx vitest run`
Expected: PASS

**Step 3: Commit**

```
feat(studio): update drag-drop for component tree paths
```

---

## Phase 4: Properties Panel

### Task 13: Properties Panel — Route by Node Kind

Update `PropertiesContent` to resolve the selected component node and route to the appropriate properties component.

**Files:**
- Modify: `form-builder/src/components/properties/properties-panel.tsx`
- Create: `form-builder/src/__tests__/properties-panel-unified.test.tsx`

**Step 1: Write the failing test**

Create `form-builder/src/__tests__/properties-panel-unified.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { PropertiesPanel } from '../components/properties/properties-panel';
import { selectedPath } from '../state/selection';
import { componentDoc, setComponentDoc, componentVersion } from '../state/project';
import { setDefinition } from '../state/definition';
import type { FormspecDefinition } from 'formspec-engine';
import type { ComponentDocument } from '../types';

const testDef: FormspecDefinition = {
  $formspec: '1.0',
  url: 'https://example.com',
  version: '1.0.0',
  status: 'draft',
  title: 'Test',
  items: [
    { key: 'name', type: 'field', label: 'Full Name', dataType: 'string' },
    { key: 'info', type: 'group', label: 'Info', children: [] },
    { key: 'header', type: 'display', label: 'Header' },
  ],
} as FormspecDefinition;

const testDoc: ComponentDocument = {
  $formspecComponent: '1.0',
  version: '1.0.0',
  targetDefinition: { url: 'https://example.com' },
  tree: {
    component: 'Stack',
    children: [
      { component: 'TextInput', bind: 'name' },
      { component: 'Grid', children: [] },
      { component: 'Stack', bind: 'info', children: [] },
      { component: 'Text', bind: 'header' },
      { component: 'Divider' },
    ],
  },
};

beforeEach(() => {
  selectedPath.value = null;
  componentDoc.value = null;
  componentVersion.value = 0;
  setDefinition(testDef);
  setComponentDoc(testDoc);
});

describe('PropertiesPanel routing (unified)', () => {
  it('shows empty state when nothing selected', () => {
    render(<PropertiesPanel collapsed={false} onToggle={() => {}} />);
    expect(screen.getByText('Select an item to edit its properties')).toBeTruthy();
  });

  it('shows RootProperties when root selected', () => {
    selectedPath.value = '';
    render(<PropertiesPanel collapsed={false} onToggle={() => {}} />);
    expect(screen.getByText('Document')).toBeTruthy(); // section header from RootProperties
  });

  it('shows FieldProperties for bound input node', () => {
    selectedPath.value = '0'; // TextInput bound to 'name'
    render(<PropertiesPanel collapsed={false} onToggle={() => {}} />);
    expect(screen.getByText('Identity')).toBeTruthy();
    expect(screen.getByDisplayValue('Full Name')).toBeTruthy();
  });

  it('shows layout properties for unbound Grid', () => {
    selectedPath.value = '1'; // Grid (no bind)
    render(<PropertiesPanel collapsed={false} onToggle={() => {}} />);
    expect(screen.getByText('Grid')).toBeTruthy(); // component type header
  });

  it('shows GroupProperties for group-bound node', () => {
    selectedPath.value = '2'; // Stack bound to 'info' group
    render(<PropertiesPanel collapsed={false} onToggle={() => {}} />);
    expect(screen.getByText('Identity')).toBeTruthy();
  });

  it('shows DisplayProperties for bound display node', () => {
    selectedPath.value = '3'; // Text bound to 'header'
    render(<PropertiesPanel collapsed={false} onToggle={() => {}} />);
    expect(screen.getByText('Identity')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/__tests__/properties-panel-unified.test.tsx`
Expected: FAIL

**Step 3: Update PropertiesContent routing**

In `properties-panel.tsx`, update `PropertiesContent`:

```typescript
import { resolveNode, classifyNode } from '../../logic/component-tree';
import { componentDoc, componentVersion } from '../../state/project';
import { LayoutProperties } from './layout-properties';

function PropertiesContent() {
  definitionVersion.value;
  componentVersion.value;
  const path = selectedPath.value;

  if (path === null) {
    return <div class="properties-empty">Select an item to edit its properties</div>;
  }

  if (path === '') {
    return <RootProperties />;
  }

  const doc = componentDoc.value;
  if (!doc) {
    return <div class="properties-empty">No component tree loaded</div>;
  }

  const node = resolveNode(doc.tree, path);
  if (!node) {
    return <div class="properties-empty">Node not found</div>;
  }

  const kind = classifyNode(node);

  if (kind === 'bound-input' && node.bind) {
    const found = findItemByKey(node.bind);
    if (found) return <FieldProperties item={found.item} />;
  }

  if (kind === 'group' && node.bind) {
    const found = findItemByKey(node.bind);
    if (found) return <GroupProperties item={found.item} />;
  }

  if (kind === 'bound-display' && node.bind) {
    const found = findItemByKey(node.bind);
    if (found) return <DisplayProperties item={found.item} />;
  }

  // Layout or structure-only
  return <LayoutProperties node={node} path={path} />;
}
```

**Step 4: Create stub LayoutProperties**

Create `form-builder/src/components/properties/layout-properties.tsx`:

```typescript
import type { ComponentNode } from '../../types';

interface LayoutPropertiesProps {
  node: ComponentNode;
  path: string;
}

export function LayoutProperties({ node, path }: LayoutPropertiesProps) {
  return (
    <div class="properties-content">
      <div class="properties-section-title">{node.component}</div>
      <div class="properties-section-subtitle">Layout Component</div>
      {/* Schema-driven properties will be added in Task 14 */}
    </div>
  );
}
```

**Step 5: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/__tests__/properties-panel-unified.test.tsx`
Expected: PASS

**Step 6: Commit**

```
feat(studio): route properties panel by component node kind
```

---

### Task 14: Schema-Driven Component Properties Editor

Load `component.schema.json` and generate property editors based on JSON Schema type info.

**Files:**
- Create: `form-builder/src/logic/component-schema-registry.ts`
- Create: `form-builder/src/logic/__tests__/component-schema-registry.test.ts`
- Create: `form-builder/src/components/properties/component-props-editor.tsx`

**Step 1: Write the failing test**

Create `form-builder/src/logic/__tests__/component-schema-registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getComponentSchema, getComponentPropertyDefs } from '../component-schema-registry';

describe('getComponentSchema', () => {
  it('returns schema for Stack', () => {
    const schema = getComponentSchema('Stack');
    expect(schema).toBeTruthy();
    expect(schema!.properties.direction).toBeTruthy();
    expect(schema!.properties.gap).toBeTruthy();
  });

  it('returns schema for TextInput', () => {
    const schema = getComponentSchema('TextInput');
    expect(schema).toBeTruthy();
    expect(schema!.properties.placeholder).toBeTruthy();
    expect(schema!.properties.inputMode).toBeTruthy();
  });

  it('returns null for unknown component', () => {
    expect(getComponentSchema('Nonexistent')).toBeNull();
  });
});

describe('getComponentPropertyDefs', () => {
  it('returns property definitions for Grid', () => {
    const props = getComponentPropertyDefs('Grid');
    expect(props.length).toBeGreaterThan(0);
    const columns = props.find((p) => p.name === 'columns');
    expect(columns).toBeTruthy();
    expect(columns!.type).toBe('integer');
  });

  it('excludes base props (component, children, bind, when, etc.)', () => {
    const props = getComponentPropertyDefs('Stack');
    const names = props.map((p) => p.name);
    expect(names).not.toContain('component');
    expect(names).not.toContain('children');
    expect(names).not.toContain('bind');
    expect(names).not.toContain('when');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd form-builder && npx vitest run src/logic/__tests__/component-schema-registry.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `form-builder/src/logic/component-schema-registry.ts`:

```typescript
// @ts-expect-error — JSON import
import componentSchema from '../../../schemas/component.schema.json';

const BASE_PROPS = new Set([
  'component', 'bind', 'when', 'responsive', 'style', 'accessibility', 'cssClass', 'children',
]);

interface SchemaPropertyDef {
  name: string;
  type: string; // 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object'
  enum?: string[];
  description?: string;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

interface ComponentSchemaDef {
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
}

const schemaCache = new Map<string, ComponentSchemaDef | null>();

export function getComponentSchema(componentType: string): ComponentSchemaDef | null {
  if (schemaCache.has(componentType)) return schemaCache.get(componentType)!;

  const defs = (componentSchema as Record<string, unknown>).$defs as Record<string, Record<string, unknown>> | undefined;
  if (!defs) {
    schemaCache.set(componentType, null);
    return null;
  }

  const def = defs[componentType];
  if (!def) {
    schemaCache.set(componentType, null);
    return null;
  }

  // Merge properties from the component def (exclude $ref to ComponentBase)
  const props: Record<string, Record<string, unknown>> = {};
  if (def.properties && typeof def.properties === 'object') {
    Object.assign(props, def.properties);
  }

  const result: ComponentSchemaDef = {
    properties: props,
    required: Array.isArray(def.required) ? (def.required as string[]) : [],
  };

  schemaCache.set(componentType, result);
  return result;
}

export function getComponentPropertyDefs(componentType: string): SchemaPropertyDef[] {
  const schema = getComponentSchema(componentType);
  if (!schema) return [];

  return Object.entries(schema.properties)
    .filter(([name]) => !BASE_PROPS.has(name))
    .map(([name, def]) => {
      const typeDef = def as Record<string, unknown>;
      let type = 'string';
      if (typeDef.type === 'integer') type = 'integer';
      else if (typeDef.type === 'number') type = 'number';
      else if (typeDef.type === 'boolean') type = 'boolean';
      else if (typeDef.type === 'array') type = 'array';
      else if (typeDef.type === 'object') type = 'object';

      return {
        name,
        type,
        ...(Array.isArray(typeDef.enum) ? { enum: typeDef.enum as string[] } : {}),
        ...(typeof typeDef.description === 'string' ? { description: typeDef.description } : {}),
        ...(typeof typeDef.minimum === 'number' ? { minimum: typeDef.minimum } : {}),
        ...(typeof typeDef.maximum === 'number' ? { maximum: typeDef.maximum } : {}),
        ...(typeDef.default !== undefined ? { default: typeDef.default } : {}),
      };
    });
}
```

> **Note:** The JSON import path may need adjustment based on Vite config. If the schema is not resolvable via relative path, use `import.meta.glob` or a Vite `?raw` import and parse at runtime.

**Step 4: Run test to verify it passes**

Run: `cd form-builder && npx vitest run src/logic/__tests__/component-schema-registry.test.ts`
Expected: PASS

**Step 5: Create ComponentPropsEditor component**

Create `form-builder/src/components/properties/component-props-editor.tsx`:

```typescript
import { getComponentPropertyDefs } from '../../logic/component-schema-registry';
import { componentDoc, componentVersion, setComponentDoc } from '../../state/project';
import { resolveNode } from '../../logic/component-tree';
import { updateNodeProps } from '../../logic/component-tree-ops';
import type { ComponentNode } from '../../types';

interface ComponentPropsEditorProps {
  node: ComponentNode;
  path: string;
}

export function ComponentPropsEditor({ node, path }: ComponentPropsEditorProps) {
  componentVersion.value;
  const propDefs = getComponentPropertyDefs(node.component);

  if (propDefs.length === 0) {
    return <div class="properties-empty-section">No configurable properties</div>;
  }

  function handleChange(name: string, value: unknown) {
    const doc = componentDoc.value;
    if (!doc) return;
    const newTree = updateNodeProps(doc.tree, path, { [name]: value });
    setComponentDoc({ ...doc, tree: newTree });
  }

  return (
    <div class="component-props">
      {propDefs.map((prop) => (
        <div key={prop.name} class="property-row">
          <label class="property-label">{prop.name}</label>
          {renderEditor(prop, node[prop.name], (val) => handleChange(prop.name, val))}
        </div>
      ))}
    </div>
  );
}

function renderEditor(
  prop: { name: string; type: string; enum?: string[]; minimum?: number; maximum?: number },
  value: unknown,
  onChange: (val: unknown) => void,
) {
  if (prop.enum) {
    return (
      <select
        class="studio-select"
        value={String(value ?? '')}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value || undefined)}
      >
        <option value="">—</option>
        {prop.enum.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (prop.type === 'boolean') {
    return (
      <select
        class="studio-select"
        value={value === true ? 'true' : value === false ? 'false' : ''}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          onChange(v === 'true' ? true : v === 'false' ? false : undefined);
        }}
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (prop.type === 'integer' || prop.type === 'number') {
    return (
      <input
        class="studio-input"
        type="number"
        value={value != null ? String(value) : ''}
        min={prop.minimum}
        max={prop.maximum}
        step={prop.type === 'integer' ? 1 : 'any'}
        onBlur={(e) => {
          const v = (e.target as HTMLInputElement).value;
          onChange(v ? Number(v) : undefined);
        }}
      />
    );
  }

  // Default: string input
  return (
    <input
      class="studio-input"
      type="text"
      value={String(value ?? '')}
      onBlur={(e) => {
        const v = (e.target as HTMLInputElement).value;
        onChange(v || undefined);
      }}
    />
  );
}
```

**Step 6: Update LayoutProperties to use ComponentPropsEditor**

```typescript
import { ComponentPropsEditor } from './component-props-editor';
import type { ComponentNode } from '../../types';

export function LayoutProperties({ node, path }: { node: ComponentNode; path: string }) {
  return (
    <div class="properties-content">
      <div class="properties-section-title">{node.component}</div>
      <ComponentPropsEditor node={node} path={path} />
    </div>
  );
}
```

**Step 7: Commit**

```
feat(studio): add schema-driven component properties editor
```

---

## Phase 5: Import/Export Updates

### Task 15: Update Import/Export for Component Documents

When importing a definition-only JSON, auto-generate the component tree. When importing a bundle, load the component document. Update exports.

**Files:**
- Modify: `form-builder/src/logic/import-export.ts`
- Modify: `form-builder/src/logic/import-export-actions.ts`
- Modify: `form-builder/src/logic/__tests__/import-export.test.ts`

**Step 1: Write the failing test**

Add to `form-builder/src/logic/__tests__/import-export.test.ts`:

```typescript
describe('parseImportedProject with component', () => {
  it('extracts component document from bundle', () => {
    const bundle = {
      definition: { $formspec: '1.0', url: 'x', version: '1', status: 'draft', title: 'T', items: [] },
      component: {
        $formspecComponent: '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'x' },
        tree: { component: 'Stack', children: [] },
      },
    };
    const result = parseImportedProject(JSON.stringify(bundle));
    expect(result.component).toBeTruthy();
    expect((result.component as Record<string, unknown>).$formspecComponent).toBe('1.0');
  });
});

describe('exportCoreBundle includes component', () => {
  it('includes component in bundle when present', () => {
    const project = {
      definition: { $formspec: '1.0', url: 'x', version: '1', status: 'draft', title: 'T', items: [] },
      component: { $formspecComponent: '1.0', tree: { component: 'Stack' } },
      theme: null, mappings: [], registries: [], changelogs: [], library: [], previousDefinitions: [],
    };
    // We just need to verify the export includes the component
    const bundleStr = JSON.stringify(serializeBundleObject(project));
    const parsed = JSON.parse(bundleStr);
    expect(parsed.component).toBeTruthy();
  });
});
```

**Step 2: Run test to verify failures**

Run: `cd form-builder && npx vitest run src/logic/__tests__/import-export.test.ts`

**Step 3: Update import-export.ts**

Ensure `parseImportedProject` extracts `component` from bundles. Ensure `exportCoreBundle` (or the underlying serialize function) includes `component` when present.

**Step 4: Update import-export-actions.ts**

In `handleImport`, after loading the project, if `project.component` is a valid component document, call `setComponentDoc`. If not, let the `setDefinition` auto-generation handle it.

**Step 5: Run test**

Run: `cd form-builder && npx vitest run src/logic/__tests__/import-export.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat(studio): update import/export for component documents
```

---

## Phase 6: Styles

### Task 16: CSS for Unified Tree and Add Picker

**Files:**
- Modify: `form-builder/styles.css`

**Step 1: Add new CSS**

Add to `form-builder/styles.css`:

```css
/* --- Add Picker --- */
.add-picker {
  background: var(--bg-1);
  border: 1px solid var(--border-0);
  border-radius: 8px;
  padding: 12px;
  margin: 4px 12px;
}

.add-picker-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border-0);
  padding-bottom: 4px;
}

.add-picker-tab {
  background: none;
  border: none;
  color: var(--text-2);
  font: var(--font-ui);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.add-picker-tab.active {
  color: var(--text-0);
  background: var(--bg-2);
}

.add-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.add-picker-option {
  background: var(--bg-2);
  border: 1px solid var(--border-0);
  border-radius: 4px;
  color: var(--text-1);
  font: var(--font-ui);
  font-size: 11px;
  padding: 6px 4px;
  cursor: pointer;
  text-align: center;
  transition: background var(--duration-fast) var(--ease-out);
}

.add-picker-option:hover {
  background: var(--bg-active);
  color: var(--text-0);
}

.add-picker-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-picker-label-header {
  font: var(--font-ui);
  font-size: 12px;
  color: var(--text-1);
  font-weight: 500;
}

.add-picker-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

/* --- Node kind colors in tree --- */
.tree-node-datatype {
  font-size: 10px;
  opacity: 0.6;
}

.tree-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-2);
  font: var(--font-ui);
  font-size: 12px;
}

/* --- Component props editor --- */
.component-props {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.properties-empty-section {
  padding: 12px;
  color: var(--text-2);
  font: var(--font-ui);
  font-size: 11px;
  text-align: center;
}

.properties-section-subtitle {
  font: var(--font-ui);
  font-size: 11px;
  color: var(--text-2);
  padding: 0 12px 8px;
}
```

**Step 2: Commit**

```
feat(studio): add CSS for unified tree and add picker
```

---

## Phase 7: Test Updates

### Task 17: Update Test Setup for Unified State

**Files:**
- Modify: `form-builder/src/__tests__/setup.ts`

**Step 1: Update resetState**

Add component state reset:

```typescript
import { componentDoc, componentVersion } from '../state/project';

export function resetState() {
  cleanup();
  setDefinition(createEmptyDefinition());
  project.value = {
    ...project.value,
    previousDefinitions: [],
    theme: null,
    component: null,
    mappings: [],
    registries: [],
    changelogs: [],
    library: [],
  };
  componentDoc.value = null;
  componentVersion.value = 0;
  selectedPath.value = null;
  inlineAddState.value = null;
  selectedMappingIndex.value = 0;
  selectedChangelogIndex.value = 0;
  editorMode.value = 'guided';
  diagnostics.value = [];
  engine.value = null;
  toasts.value = [];
}
```

**Step 2: Commit**

```
test(studio): update test setup for component state
```

---

### Task 18: Update Existing Component Tests

Many existing tests reference `definition.items` for tree rendering and `selectedPath` as item keys. These need updating for the new architecture.

**Files:**
- Modify: All test files in `form-builder/src/__tests__/`

**Strategy:** For each existing test file:
1. Tests that set `selectedPath.value = 'someKey'` need to be updated to use component tree paths (e.g., `'0'`, `'0.1'`)
2. Tests that check tree rendering need to set up both `definition` and `componentDoc`
3. Properties tests should still work since they receive `item` props directly — minimal changes needed
4. Tests that reference `inlineAddState` should use `addPickerState` instead

**For each test file**, follow the red-green pattern:
1. Run the existing tests to see which fail
2. Update the test setup to include `componentDoc`
3. Update `selectedPath` values to use tree paths
4. Run again to confirm pass

Run: `cd form-builder && npx vitest run`
Expected: All PASS after updates

**Commit:**

```
test(studio): update existing tests for unified component tree architecture
```

---

### Task 19: E2E Test Updates

**Files:**
- Modify: `tests/e2e/playwright/studio/helpers.ts`
- Modify: `tests/e2e/playwright/studio/tree-editor.spec.ts`
- Modify: Other studio E2E spec files as needed

**Strategy:**
1. The tree DOM now shows component type badges and kind-colored dots
2. `treeNodeByLabel` helper should still work (labels come from bound definition items or component names)
3. The add-item flow now uses the categorized picker instead of inline-add
4. Properties panel still shows the same fields for bound items

**For each E2E test file:**
1. Run the test: `npm run test:studio:e2e`
2. Fix failures based on DOM changes
3. Update selectors for new tree node structure
4. Update add-item flows to use the picker

Run: `npm run test:studio:e2e`
Expected: All PASS after updates

**Commit:**

```
test(studio): update E2E tests for unified component tree
```

---

## Phase 8: Polish

### Task 20: Bind Indicators from Definition Binds

Wire up the bind indicators (required *, calculated f, constraint check, conditional lightning) in the tree node by looking up the definition's `binds` array.

**Files:**
- Modify: `form-builder/src/components/tree/tree-node.tsx`

**Step 1: Implement BindIndicators**

```typescript
function BindIndicators({ item }: { item: FormspecItem }) {
  const def = definition.value;
  const binds = (def as Record<string, unknown>).binds as Array<Record<string, unknown>> | undefined;
  if (!binds) return null;

  const bind = binds.find((b) => b.path === item.key);
  if (!bind) return null;

  return (
    <>
      {bind.required && <span class="tree-node-bind" title="Required">*</span>}
      {bind.calculate && <span class="tree-node-bind" title="Calculated">f</span>}
      {bind.constraint && <span class="tree-node-bind" title="Constraint">✓</span>}
      {bind.relevant && <span class="tree-node-bind" title="Conditional">⚡</span>}
    </>
  );
}
```

**Step 2: Commit**

```
feat(studio): add bind indicators to unified tree nodes
```

---

### Task 21: Shared Base Properties (when, style, cssClass)

All component nodes share base properties. Add editors for `when`, `style`, and `cssClass` to both the layout properties and bound node properties panels.

**Files:**
- Create: `form-builder/src/components/properties/base-component-props.tsx`
- Modify: `form-builder/src/components/properties/layout-properties.tsx`
- Modify: `form-builder/src/components/properties/field-properties.tsx`

**Step 1: Create BaseComponentProps**

```typescript
import { FelExpressionInput } from './fel-expression-input';
import { JsonPropertyEditor } from './json-property-editor';
import { componentDoc, setComponentDoc } from '../../state/project';
import { updateNodeProps } from '../../logic/component-tree-ops';
import type { ComponentNode } from '../../types';

interface BaseComponentPropsProps {
  node: ComponentNode;
  path: string;
}

export function BaseComponentProps({ node, path }: BaseComponentPropsProps) {
  function handleChange(name: string, value: unknown) {
    const doc = componentDoc.value;
    if (!doc) return;
    const newTree = updateNodeProps(doc.tree, path, { [name]: value || undefined });
    setComponentDoc({ ...doc, tree: newTree });
  }

  return (
    <>
      <div class="properties-section-title">Presentation</div>
      <div class="property-row">
        <label class="property-label">Visible When</label>
        <FelExpressionInput
          value={node.when ?? ''}
          onChange={(val) => handleChange('when', val)}
        />
      </div>
      <div class="property-row">
        <label class="property-label">CSS Class</label>
        <input
          class="studio-input"
          value={node.cssClass ?? ''}
          onBlur={(e) => handleChange('cssClass', (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="property-row">
        <label class="property-label">Style</label>
        <JsonPropertyEditor
          value={node.style ?? {}}
          onChange={(val) => handleChange('style', val)}
        />
      </div>
    </>
  );
}
```

**Step 2: Wire into LayoutProperties and FieldProperties**

**Step 3: Commit**

```
feat(studio): add shared base component properties (when, style, cssClass)
```

---

### Task 22: Remove Legacy Code

Clean up files/code that are no longer needed:

**Files to consider:**
- `form-builder/src/components/tree/inline-add.tsx` — replaced by `add-picker.tsx`
- `form-builder/src/logic/presentation-docs.ts` — `generateBaselineComponent` moved to `component-tree.ts`; keep other helpers
- `form-builder/src/state/selection.ts` — remove `InlineAddState` type and `inlineAddState` signal
- `form-builder/src/types.ts` — remove `InlineAddState` if it was defined here

**Strategy:** Delete dead code, run full test suite to verify no regressions.

Run: `cd form-builder && npx vitest run && npm run test:studio:e2e`
Expected: All PASS

**Commit:**

```
refactor(studio): remove legacy inline-add and unused presentation-docs code
```

---

## Summary: Task Dependency Graph

```
Task 1 (Types) ─────────┐
Task 2 (Tree Generator) ─┤
Task 3 (Tree Ops) ───────┼── Phase 1: Foundation
Task 4 (Picker Catalog) ─┤
Task 5 (Sync Logic) ─────┘
         │
Task 6 (State) ──────────┐
Task 7 (Def→Component) ──┘── Phase 2: State
         │
Task 8 (Tree Editor) ────┐
Task 9 (Tree Node) ──────┤
Task 10 (Add Picker) ────┼── Phase 3: Tree Editor
Task 11 (Wire Add/Del) ──┤
Task 12 (Drag-Drop) ─────┘
         │
Task 13 (Panel Routing) ─┐
Task 14 (Schema Props) ──┘── Phase 4: Properties
         │
Task 15 (Import/Export) ──── Phase 5
         │
Task 16 (CSS) ───────────── Phase 6
         │
Task 17 (Test Setup) ────┐
Task 18 (Unit Tests) ────┼── Phase 7: Tests
Task 19 (E2E Tests) ─────┘
         │
Task 20 (Bind Indicators) ┐
Task 21 (Base Props) ──────┼─ Phase 8: Polish
Task 22 (Remove Legacy) ───┘
```

Tasks within a phase can often be parallelized. Tasks across phases are sequential (each phase builds on the prior).
