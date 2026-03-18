/** @filedesc Rebuilds the component tree to mirror the definition item hierarchy. */
import type { FormDefinition, FormItem } from 'formspec-types';
import { widgetTokenToComponent } from 'formspec-types';
import type { ThemeState } from './types.js';

/** Component tree node shape used in generated layout documents. */
type TreeNode = {
  component: string;
  bind?: string;
  nodeId?: string;
  children?: TreeNode[];
  [k: string]: unknown;
};

/** Snapshot of a layout wrapper and its position before rebuild. */
interface WrapperSnapshot {
  wrapper: TreeNode;
  parentRef: { bind?: string; nodeId?: string };
  position: number;
  wasLast: boolean;
}

/** Component types that allow `children` per the component schema. */
const CONTAINER_COMPONENTS = new Set([
  'Accordion', 'Card', 'Collapsible', 'Columns', 'ConditionalGroup',
  'Grid', 'Modal', 'Page', 'Panel', 'Popover', 'Stack', 'Tabs', 'Wizard',
]);

/**
 * Determine the default component type for a definition item.
 * Maps item types to sensible widget defaults: field -> TextInput,
 * group -> Stack, display -> Text.
 */
export function defaultComponentType(item: FormItem): string {
  switch (item.type) {
    case 'field':
      if ((item as any).optionSet || Array.isArray((item as any).options)) return 'Select';
      switch (item.dataType) {
        case 'choice': return 'Select';
        case 'multiChoice': return 'CheckboxGroup';
        case 'boolean': return 'Toggle';
        case 'integer':
        case 'decimal': return 'NumberInput';
        case 'date':
        case 'dateTime':
        case 'time': return 'DatePicker';
        case 'money': return 'MoneyInput';
        case 'attachment': return 'FileUpload';
        default: return 'TextInput';
      }
    case 'group': return (item as any).repeatable ? 'Accordion' : 'Stack';
    case 'display': return 'Text';
    default: return 'TextInput';
  }
}

/**
 * Rebuild the component tree to mirror the definition item hierarchy.
 *
 * Pure function — takes all inputs as arguments, returns the new tree root.
 * Preserves existing bound node properties (widget overrides, styles) and
 * unbound layout nodes (re-inserted at original positions).
 *
 * The algorithm:
 *   1. Snapshot top-level layout wrappers with their full subtrees.
 *   2. Collect existing bound/display nodes by path, rebuild from definition.
 *   3. Page-aware distribution (wizard/tabs/single).
 *   4. Re-insert layout wrappers at original positions.
 */
export function reconcileComponentTree(
  definition: FormDefinition,
  currentTree: unknown | undefined,
  theme: ThemeState,
): TreeNode {
  const tree = (currentTree as TreeNode) ?? { component: 'Stack', nodeId: 'root', children: [] };

  // ── Phase 1: Snapshot top-level layout wrappers ──
  const wrapperSnapshots: WrapperSnapshot[] = [];

  const snapshotWrappers = (parent: TreeNode) => {
    const children = parent.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child._layout) {
        wrapperSnapshots.push({
          wrapper: structuredClone(child),
          parentRef: parent.bind ? { bind: parent.bind } : { nodeId: parent.nodeId! },
          position: i,
          wasLast: i === children.length - 1,
        });
      } else if (child.children) {
        snapshotWrappers(child);
      }
    }
  };
  snapshotWrappers(tree);

  // ── Phase 2: Collect existing bound/display nodes ──
  const existingBound = new Map<string, TreeNode>();
  const existingDisplay = new Map<string, TreeNode>();

  const collectExisting = (node: TreeNode, parentPath = '') => {
    for (const child of node.children ?? []) {
      if (child._layout) {
        const collectDeep = (n: TreeNode, path: string) => {
          for (const c of n.children ?? []) {
            if (c.bind) {
              const cPath = path ? `${path}.${c.bind}` : c.bind;
              existingBound.set(cPath, c);
              collectDeep(c, cPath);
            } else if (c.nodeId && !c._layout) {
              const cPath = path ? `${path}.${c.nodeId}` : c.nodeId;
              existingDisplay.set(cPath, c);
            } else if (c._layout) {
              collectDeep(c, path);
            }
          }
        };
        collectDeep(child, parentPath);
      } else if (child.bind) {
        const path = parentPath ? `${parentPath}.${child.bind}` : child.bind;
        existingBound.set(path, child);
        if (child.children) collectExisting(child, path);
      } else if (child.nodeId) {
        const path = parentPath ? `${parentPath}.${child.nodeId}` : child.nodeId;
        existingDisplay.set(path, child);
      }
    }
  };
  collectExisting(tree);

  // ── Collect display paths with calculate binds ──
  const calculatedDisplayPaths = new Set<string>();
  if (definition.binds) {
    for (const bind of definition.binds) {
      if (bind.calculate && bind.path) {
        calculatedDisplayPaths.add(bind.path);
      }
    }
  }

  // ── Build nodes from definition items ──
  // Returns an array: normally [node], but non-container components with
  // definition children emit those children as siblings instead of nesting.
  const buildNodes = (item: FormItem, parentPath = ''): TreeNode[] => {
    const itemPath = parentPath ? `${parentPath}.${item.key}` : item.key;
    let node: TreeNode;

    if (item.type === 'display') {
      const hasCalculate = calculatedDisplayPaths.has(itemPath);
      if (hasCalculate) {
        // Bind the display node so the webcomponent subscribes to the engine signal
        const existing = existingBound.get(itemPath);
        if (existing) {
          node = { ...existing, text: item.label ?? '' };
          existingBound.delete(itemPath);
        } else {
          const hintComponent = widgetTokenToComponent((item as any).presentation?.widgetHint);
          node = { component: hintComponent ?? 'Text', bind: item.key, text: item.label ?? '' };
        }
      } else {
        const existing = existingDisplay.get(itemPath);
        if (existing) {
          node = { ...existing, text: item.label ?? '' };
          existingDisplay.delete(itemPath);
        } else {
          node = { component: 'Text', nodeId: item.key, text: item.label ?? '' };
        }
      }
    } else {
      const existing = existingBound.get(itemPath);
      const hintComponent = widgetTokenToComponent((item as any).presentation?.widgetHint);
      if (existing) {
        node = { ...existing };
        // Update component if widgetHint resolves to a different component
        if (hintComponent && existing.component !== hintComponent) {
          node.component = hintComponent;
        }
      } else {
        node = { component: hintComponent ?? defaultComponentType(item), bind: item.key };
      }
    }

    if (item.children && item.children.length > 0) {
      const childNodes = item.children.flatMap(child => buildNodes(child, itemPath));
      if (CONTAINER_COMPONENTS.has(node.component)) {
        node.children = childNodes;
      } else {
        // Non-container component (e.g. RadioGroup): emit children as siblings
        delete node.children;
        return [node, ...childNodes];
      }
    } else if (item.type === 'group') {
      node.children = [];
    } else {
      delete node.children;
    }

    return [node];
  };

  const builtNodes: TreeNode[] = definition.items.flatMap(item => buildNodes(item));

  // ── Page-aware distribution ──
  const def = definition as any;
  const pageMode: string = def.formPresentation?.pageMode ?? 'single';
  const themePages = (theme.pages ?? []) as any[];

  let newRoot: TreeNode;

  if (themePages.length > 0 && (pageMode === 'wizard' || pageMode === 'tabs')) {
    const nodeByKey = new Map<string, TreeNode>();
    for (const node of builtNodes) {
      const key = node.bind ?? node.nodeId;
      if (key) nodeByKey.set(key, node);
    }

    const pageNodes: TreeNode[] = [];
    const assigned = new Set<string>();

    for (const themePage of themePages) {
      const pageNode: TreeNode = {
        component: 'Page',
        nodeId: (themePage as any).id,
        title: (themePage as any).title,
        ...((themePage as any).description !== undefined && { description: (themePage as any).description }),
        children: [],
      };

      for (const region of ((themePage as any).regions ?? []) as any[]) {
        if (region.key && nodeByKey.has(region.key)) {
          pageNode.children!.push(nodeByKey.get(region.key)!);
          assigned.add(region.key);
        }
      }

      pageNodes.push(pageNode);
    }

    const unassigned = builtNodes.filter(n => {
      const key = n.bind ?? n.nodeId;
      return key && !assigned.has(key);
    });

    if (pageMode === 'wizard') {
      if (unassigned.length > 0) {
        pageNodes.push({
          component: 'Page',
          nodeId: '_unassigned',
          title: 'Other',
          children: unassigned,
        });
      }
      newRoot = { component: 'Wizard', nodeId: 'root', children: pageNodes };
    } else {
      if (unassigned.length > 0) {
        pageNodes.push({
          component: 'Page',
          nodeId: '_unassigned',
          title: 'Other',
          children: unassigned,
        });
      }
      newRoot = { component: 'Tabs', nodeId: 'root', children: pageNodes };
    }
  } else {
    newRoot = { component: 'Stack', nodeId: 'root', children: builtNodes };
  }

  // ── Phase 3: Re-insert layout wrappers ──
  const findInTree = (root: TreeNode, ref: { bind?: string; nodeId?: string }): { parent: TreeNode; index: number; node: TreeNode } | undefined => {
    if (ref.nodeId && root.nodeId === ref.nodeId) return { parent: root, index: -1, node: root };
    if (ref.bind && root.bind === ref.bind) return { parent: root, index: -1, node: root };
    const stack: TreeNode[] = [root];
    while (stack.length) {
      const p = stack.pop()!;
      for (let i = 0; i < (p.children?.length ?? 0); i++) {
        const c = p.children![i];
        if (ref.nodeId && c.nodeId === ref.nodeId) return { parent: p, index: i, node: c };
        if (ref.bind && c.bind === ref.bind) return { parent: p, index: i, node: c };
        stack.push(c);
      }
    }
    return undefined;
  };

  const updateWrapperChildren = (wrapperNode: TreeNode): void => {
    if (!wrapperNode.children) return;
    const updatedChildren: TreeNode[] = [];
    for (const child of wrapperNode.children) {
      if (child._layout) {
        updateWrapperChildren(child);
        updatedChildren.push(child);
      } else if (child.bind) {
        const found = findInTree(newRoot, { bind: child.bind });
        if (found && found.index !== -1) {
          const [extracted] = found.parent.children!.splice(found.index, 1);
          updatedChildren.push(extracted);
        }
      } else if (child.nodeId) {
        const found = findInTree(newRoot, { nodeId: child.nodeId });
        if (found && found.index !== -1) {
          const [extracted] = found.parent.children!.splice(found.index, 1);
          updatedChildren.push(extracted);
        }
      }
    }
    wrapperNode.children = updatedChildren;
  };

  for (const snap of wrapperSnapshots) {
    const wrapperNode = snap.wrapper;
    updateWrapperChildren(wrapperNode);

    const parentResult = findInTree(newRoot, snap.parentRef);
    const parentNode = parentResult ? parentResult.node : newRoot;
    if (!parentNode.children) parentNode.children = [];

    const idx = snap.wasLast ? parentNode.children.length : Math.min(snap.position, parentNode.children.length);
    parentNode.children.splice(idx, 0, wrapperNode);
  }

  return newRoot;
}
