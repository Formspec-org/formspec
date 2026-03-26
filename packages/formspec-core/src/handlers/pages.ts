/**
 * @filedesc Page handlers that manipulate Page nodes in the component tree.
 *
 * Page nodes live as direct children of the root Stack with
 * `{ component: 'Page', nodeId, title, _layout: true, children: [] }`.
 *
 * All handlers return `{ rebuildComponentTree: false }` because they
 * mutate the tree directly — no rebuild needed.
 *
 * @module handlers/pages
 */
import type { CommandHandler, ProjectState } from '../types.js';
import { type TreeNode, ensureTree } from './tree-utils.js';

let pageIdCounter = 0;

function generatePageId(): string {
  return `page-${Date.now()}-${pageIdCounter++}`;
}

function ensureFormPresentation(state: ProjectState): any {
  if (!(state.definition as any).formPresentation) (state.definition as any).formPresentation = {};
  return (state.definition as any).formPresentation;
}

/** Get all Page nodes from root.children. */
function getPageNodes(root: TreeNode): TreeNode[] {
  return (root.children ?? []).filter(n => n.component === 'Page');
}

/** Find a Page node by nodeId among root.children. */
function findPageNode(root: TreeNode, nodeId: string): TreeNode {
  const page = (root.children ?? []).find(n => n.component === 'Page' && n.nodeId === nodeId);
  if (!page) throw new Error(`Page not found: ${nodeId}`);
  return page;
}

/** Find the index of a Page node in root.children by nodeId. */
function findPageIndex(root: TreeNode, nodeId: string): number {
  const children = root.children ?? [];
  const index = children.findIndex(n => n.component === 'Page' && n.nodeId === nodeId);
  if (index === -1) throw new Error(`Page not found: ${nodeId}`);
  return index;
}

/**
 * Recursively find a bound node by its bind key anywhere in the tree.
 * Returns the parent and index, or null if not found.
 */
function findBoundNode(
  node: TreeNode,
  key: string,
): { parent: TreeNode; index: number } | null {
  const children = node.children ?? [];
  for (let i = 0; i < children.length; i++) {
    if (children[i].bind === key) {
      return { parent: node, index: i };
    }
    const deeper = findBoundNode(children[i], key);
    if (deeper) return deeper;
  }
  return null;
}

export const pagesHandlers: Record<string, CommandHandler> = {

  'pages.addPage': (state, payload) => {
    const { id, title, description } = payload as { id?: string; title?: string; description?: string };
    const root = ensureTree(state);
    const fp = ensureFormPresentation(state);

    const pageCount = getPageNodes(root).length;
    const page: TreeNode = {
      component: 'Page',
      nodeId: id || generatePageId(),
      title: title || `Page ${pageCount + 1}`,
      _layout: true,
      children: [],
    };
    if (description !== undefined) page.description = description;

    if (!root.children) root.children = [];
    root.children.push(page);

    // Only promote to wizard if currently single or unset.
    if (!fp.pageMode || fp.pageMode === 'single') {
      fp.pageMode = 'wizard';
    }

    return { rebuildComponentTree: false };
  },

  'pages.deletePage': (state, payload) => {
    const { id } = payload as { id: string };
    const root = ensureTree(state);
    const index = findPageIndex(root, id);

    root.children!.splice(index, 1);

    return { rebuildComponentTree: false };
  },

  'pages.setMode': (state, payload) => {
    const { mode } = payload as { mode: 'single' | 'wizard' | 'tabs' };
    const fp = ensureFormPresentation(state);
    fp.pageMode = mode;

    // Ensure tree exists (Page nodes are preserved in single mode).
    ensureTree(state);

    return { rebuildComponentTree: false };
  },

  'pages.reorderPages': (state, payload) => {
    const { id, direction } = payload as { id: string; direction: 'up' | 'down' };
    const root = ensureTree(state);
    const children = root.children ?? [];
    const index = findPageIndex(root, id);

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= children.length) return { rebuildComponentTree: false };

    [children[index], children[swapIndex]] = [children[swapIndex], children[index]];
    return { rebuildComponentTree: false };
  },

  'pages.movePageToIndex': (state, payload) => {
    const { id, targetIndex } = payload as { id: string; targetIndex: number };
    const root = ensureTree(state);
    const children = root.children ?? [];
    const fromIndex = findPageIndex(root, id);

    const clamped = Math.max(0, Math.min(targetIndex, children.length - 1));
    if (fromIndex === clamped) return { rebuildComponentTree: false };

    const [page] = children.splice(fromIndex, 1);
    children.splice(clamped, 0, page);
    return { rebuildComponentTree: false };
  },

  'pages.setPageProperty': (state, payload) => {
    const { id, property, value } = payload as { id: string; property: string; value: unknown };
    const root = ensureTree(state);
    const page = findPageNode(root, id);
    page[property] = value;
    return { rebuildComponentTree: false };
  },

  'pages.assignItem': (state, payload) => {
    const { pageId, key, span } = payload as { pageId: string; key: string; span?: number };
    const root = ensureTree(state);

    // Use leaf key for bind — tree nodes use short keys, not dot-paths
    const leafKey = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;

    // Remove existing bound node from anywhere in the tree and reuse it
    const existing = findBoundNode(root, leafKey);
    let node: TreeNode;
    if (existing) {
      [node] = existing.parent.children!.splice(existing.index, 1);
    } else {
      // Placeholder — will be replaced by reconciler on next definition change
      node = { component: 'BoundItem', bind: leafKey };
    }
    if (span !== undefined) node.span = span;

    // Find target Page and add the node
    const targetPage = findPageNode(root, pageId);
    if (!targetPage.children) targetPage.children = [];
    targetPage.children.push(node);

    return { rebuildComponentTree: false };
  },

  'pages.unassignItem': (state, payload) => {
    const { pageId, key } = payload as { pageId: string; key: string };
    const root = ensureTree(state);
    const page = findPageNode(root, pageId);
    const children = page.children ?? [];

    // Use leaf key for lookup — tree nodes use short keys, not dot-paths
    const leafKey = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
    const index = children.findIndex(n => n.bind === leafKey);
    if (index === -1) return { rebuildComponentTree: false };

    const [node] = children.splice(index, 1);

    // Move the node back to root level
    if (!root.children) root.children = [];
    root.children.push(node);

    return { rebuildComponentTree: false };
  },

  'pages.autoGenerate': (state, _payload) => {
    const root = ensureTree(state);
    const fp = ensureFormPresentation(state);
    const items = (state.definition as any).items ?? [];

    // Remove all existing Page nodes from root
    if (root.children) {
      root.children = root.children.filter(n => n.component !== 'Page');
    } else {
      root.children = [];
    }

    // Walk definition items looking for groups with presentation.layout.page hints
    const pageMap = new Map<string, TreeNode>();
    const pageOrder: string[] = [];
    let lastPageHint: string | null = null;

    for (const item of items) {
      if ((item as any).type !== 'group') continue;

      const pageHint = (item as any).presentation?.layout?.page;

      if (pageHint) {
        lastPageHint = pageHint;
        if (!pageMap.has(pageHint)) {
          const pageNode: TreeNode = {
            component: 'Page',
            nodeId: generatePageId(),
            title: (item as any).label ?? (item as any).key,
            _layout: true,
            children: [],
          };
          pageMap.set(pageHint, pageNode);
          pageOrder.push(pageHint);
        }
      }

      const targetHint = pageHint ?? lastPageHint;
      if (targetHint && pageMap.has(targetHint)) {
        const pageNode = pageMap.get(targetHint)!;
        const children = (item as any).children ?? [];
        for (const child of children) {
          pageNode.children!.push({ component: 'BoundItem', bind: child.key, span: 12 });
        }
      }
    }

    if (pageMap.size > 0) {
      for (const hint of pageOrder) {
        root.children.push(pageMap.get(hint)!);
      }
    } else {
      // Fallback: single page with all root items
      const fallbackPage: TreeNode = {
        component: 'Page',
        nodeId: generatePageId(),
        title: 'Page 1',
        _layout: true,
        children: [],
      };
      for (const item of items) {
        fallbackPage.children!.push({ component: 'BoundItem', bind: (item as any).key, span: 12 });
      }
      root.children.push(fallbackPage);
    }

    // Only promote to wizard if currently single or unset
    if (!fp.pageMode || fp.pageMode === 'single') {
      fp.pageMode = 'wizard';
    }

    return { rebuildComponentTree: false };
  },

  'pages.setPages': (state, payload) => {
    const { pages } = payload as { pages: Array<{ id: string; title?: string; description?: string; regions?: Array<{ key: string; span?: number; responsive?: Record<string, unknown> }> }> };
    const root = ensureTree(state);
    const fp = ensureFormPresentation(state);

    // Remove all existing Page nodes from root
    if (root.children) {
      root.children = root.children.filter(n => n.component !== 'Page');
    } else {
      root.children = [];
    }

    // Create new Page nodes from payload, reusing existing bound nodes from tree
    for (const p of pages) {
      const pageNode: TreeNode = {
        component: 'Page',
        nodeId: p.id,
        title: p.title,
        _layout: true,
        children: (p.regions ?? []).map(r => {
          // Use leaf key for bind — tree nodes use short keys, not dot-paths
          const leafKey = r.key.includes('.') ? r.key.slice(r.key.lastIndexOf('.') + 1) : r.key;
          // Reuse existing bound node from tree if available
          const existing = findBoundNode(root, leafKey);
          let node: TreeNode;
          if (existing) {
            [node] = existing.parent.children!.splice(existing.index, 1);
          } else {
            node = { component: 'BoundItem', bind: leafKey };
          }
          if (r.span !== undefined) node.span = r.span;
          if (r.responsive !== undefined) node.responsive = r.responsive;
          return node;
        }),
      };
      if (p.description !== undefined) pageNode.description = p.description;
      root.children.push(pageNode);
    }

    if (pages.length > 0 && (!fp.pageMode || fp.pageMode === 'single')) {
      fp.pageMode = 'wizard';
    }

    return { rebuildComponentTree: false };
  },

  'pages.reorderRegion': (state, payload) => {
    const { pageId, key, targetIndex } = payload as { pageId: string; key: string; targetIndex: number };
    const root = ensureTree(state);
    const page = findPageNode(root, pageId);
    const children = page.children ?? [];
    if (children.length === 0) return { rebuildComponentTree: false };

    const fromIndex = children.findIndex(n => n.bind === key);
    if (fromIndex === -1) throw new Error(`Region not found: ${key}`);

    const [node] = children.splice(fromIndex, 1);
    const clampedIndex = Math.min(targetIndex, children.length);
    children.splice(clampedIndex, 0, node);

    return { rebuildComponentTree: false };
  },

  'pages.renamePage': (state, payload) => {
    const { id, newId } = payload as { id: string; newId: string };
    const root = ensureTree(state);
    const page = findPageNode(root, id);
    // Semantic change: rename sets title, NOT nodeId
    page.title = newId;
    return { rebuildComponentTree: false };
  },

  'pages.setRegionProperty': (state, payload) => {
    const { pageId, key, property, value } = payload as {
      pageId: string;
      key: string;
      property: 'span' | 'start' | 'responsive';
      value: number | Record<string, unknown> | undefined;
    };
    const root = ensureTree(state);
    const page = findPageNode(root, pageId);
    const children = page.children ?? [];
    const node = children.find(n => n.bind === key);
    if (!node) throw new Error(`Region not found: ${key}`);

    if (value === undefined) {
      delete node[property];
    } else {
      node[property] = value;
    }

    return { rebuildComponentTree: false };
  },
};
