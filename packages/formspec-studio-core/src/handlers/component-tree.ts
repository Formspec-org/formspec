/**
 * Component tree structure handlers.
 *
 * These handlers implement the `component.*` tree-manipulation commands defined
 * in the API spec's "Component -- Tree Structure" section. They operate on the
 * component document's `tree` -- a recursive node structure that describes how
 * definition items are laid out and rendered.
 *
 * **Node referencing (NodeRef):**
 * Every tree node is addressed by a `NodeRef`, which is an object carrying
 * exactly one of:
 * - `{ bind: string }` -- for nodes bound to a definition item key (Input,
 *   Display, and some Special components).
 * - `{ nodeId: string }` -- for unbound layout/container nodes that receive a
 *   stable auto-generated ID.
 *
 * **Parent/child relationships:**
 * The tree root is always a synthetic `Stack` node with `nodeId: 'root'`.
 * Layout and Container nodes may have `children`; Input and Display nodes
 * are leaf nodes. Nesting rules (component-spec S3.4) are enforced by
 * `addNode` and `moveNode` at a higher level; these handlers perform the
 * raw structural mutations.
 *
 * @module handlers/component-tree
 */
import { registerHandler } from '../handler-registry.js';
import type { ProjectState, FormspecComponentDocument } from '../types.js';
import {
  getEditableComponentDocument,
  hasAuthoredComponentTree,
} from '../component-documents.js';

/** Auto-incrementing counter for generating unique node IDs within a session. */
let nodeCounter = 0;

/**
 * Generate a unique node ID for unbound tree nodes.
 *
 * IDs are session-scoped monotonic strings of the form `node_1`, `node_2`, etc.
 * They provide stable addressing for layout/container nodes that have no
 * definition-level bind key.
 *
 * @returns A unique node identifier string.
 */
function generateNodeId(): string {
  return `node_${++nodeCounter}`;
}

/**
 * Internal representation of a component tree node.
 *
 * - `component` -- the component type name (built-in or custom).
 * - `bind` -- present when the node is bound to a definition item key.
 *   Mutually exclusive with `nodeId` for addressing purposes.
 * - `nodeId` -- present on unbound nodes (layout, container). Auto-generated
 *   when a node is created without a `bind`.
 * - `children` -- child nodes; only meaningful for Layout and Container types.
 * - Additional keys hold component-specific props (style, accessibility, etc.).
 */
type TreeNode = {
  component: string;
  bind?: string;
  nodeId?: string;
  children?: TreeNode[];
  [key: string]: unknown;
};

/**
 * Ensure the component document has a root tree node.
 *
 * If `component.tree` is absent, initializes it with a `Stack` root node
 * (`{ component: 'Stack', nodeId: 'root', children: [] }`). All tree
 * operations require a root, so this is called at the start of every handler.
 * These trees are internal Studio authoring state, not spec-valid serialized
 * component documents, so generated metadata is marked explicitly.
 *
 * @param component - The component document to ensure a tree on.
 * @returns The root tree node.
 */
function markStudioGeneratedComponent(component: FormspecComponentDocument): void {
  component['x-studio-generated'] = true;
}

function ensureTree(state: ProjectState): TreeNode {
  const component = getEditableComponentDocument(state) as FormspecComponentDocument;
  if (!hasAuthoredComponentTree(state.component)) {
    markStudioGeneratedComponent(component);
  }
  if (!component.tree) {
    component.tree = { component: 'Stack', nodeId: 'root', children: [] };
  }
  return component.tree as TreeNode;
}

/**
 * Find a node in the tree by its NodeRef, returning the node together with its
 * parent and position index within the parent's children array.
 *
 * Uses an iterative depth-first search. Matching is performed by `nodeId`
 * (preferred) or `bind` key, reflecting the two addressing modes of NodeRef.
 *
 * When the root node itself matches, `index` is returned as `-1` and `parent`
 * points to the root. Callers that need to splice must check for `index === -1`
 * to avoid operating on the root (which cannot be removed or reordered).
 *
 * @param root - The tree root node to search from.
 * @param ref - A NodeRef identifying the target node by `bind` or `nodeId`.
 * @returns An object `{ parent, index, node }` if found, or `undefined`.
 */
function findNode(
  root: TreeNode,
  ref: { bind?: string; nodeId?: string },
): { parent: TreeNode; index: number; node: TreeNode } | undefined {
  // Check if root itself matches
  if (ref.nodeId && root.nodeId === ref.nodeId) {
    return { parent: root, index: -1, node: root };
  }
  if (ref.bind && root.bind === ref.bind) {
    return { parent: root, index: -1, node: root };
  }

  const stack: TreeNode[] = [root];
  while (stack.length) {
    const parent = stack.pop()!;
    const children = parent.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (ref.nodeId && child.nodeId === ref.nodeId) {
        return { parent, index: i, node: child };
      }
      if (ref.bind && child.bind === ref.bind) {
        return { parent, index: i, node: child };
      }
      stack.push(child);
    }
  }
  return undefined;
}

/**
 * **component.addNode** -- Insert a new component node into the tree.
 *
 * Creates a child node under the specified parent. If `bind` is provided, the
 * node is bound to a definition item key and addressed by `{ bind }`. If `bind`
 * is omitted, a stable `nodeId` is auto-generated for addressing. Additional
 * component-specific properties can be supplied via `props`.
 *
 * When `insertIndex` is specified, the node is spliced at that position among
 * the parent's children; otherwise it is appended to the end.
 *
 * @param payload.parent - NodeRef identifying the parent to insert under.
 * @param payload.insertIndex - Optional zero-based insertion position. Omit to append.
 * @param payload.component - Component type name (built-in or custom).
 * @param payload.bind - Definition item key. Required for Input components; forbidden for Layout.
 * @param payload.props - Component-specific properties to merge onto the node.
 * @returns `{ rebuildComponentTree: false, nodeRef }` where `nodeRef` addresses the new node.
 * @throws If the parent node identified by `payload.parent` is not found in the tree.
 */
registerHandler('component.addNode', (state, payload) => {
  const p = payload as {
    parent: { bind?: string; nodeId?: string };
    insertIndex?: number;
    component: string;
    bind?: string;
    props?: Record<string, unknown>;
  };

  const root = ensureTree(state);
  const parentResult = findNode(root, p.parent);
  if (!parentResult) throw new Error(`Parent node not found`);

  const parentNode = parentResult.node;
  if (!parentNode.children) parentNode.children = [];

  const node: TreeNode = { component: p.component };
  if (p.bind) {
    node.bind = p.bind;
  } else {
    node.nodeId = generateNodeId();
    node._layout = true;
  }
  if (p.props) {
    Object.assign(node, p.props);
  }

  if (p.insertIndex !== undefined) {
    parentNode.children.splice(p.insertIndex, 0, node);
  } else {
    parentNode.children.push(node);
  }

  const nodeRef = node.bind ? { bind: node.bind } : { nodeId: node.nodeId! };
  return { rebuildComponentTree: false, nodeRef };
});

/**
 * **component.deleteNode** -- Remove a node and its entire subtree from the tree.
 *
 * The node is located by NodeRef and spliced out of its parent's children array.
 * Bound fields that lose their component node fall back to Tier 2/1 rendering.
 * This does NOT delete the corresponding definition item -- only the component
 * tree representation is affected.
 *
 * The root node cannot be deleted (index === -1 guard).
 *
 * @param payload.node - NodeRef identifying the node to remove.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found or is the root node.
 */
registerHandler('component.deleteNode', (state, payload) => {
  const { node: ref } = payload as { node: { bind?: string; nodeId?: string } };
  const root = ensureTree(state);
  const result = findNode(root, ref);
  if (!result || result.index === -1) throw new Error('Node not found');

  result.parent.children!.splice(result.index, 1);
  return { rebuildComponentTree: false };
});

/**
 * **component.moveNode** -- Reparent a node (and its subtree) to a new location.
 *
 * The source node is removed from its current parent and inserted as a child of
 * `targetParent`. When `targetIndex` is specified, the node is spliced at that
 * position; otherwise it is appended. The operation is two-phase: remove then
 * insert, so index values refer to post-removal positions.
 *
 * Nesting constraints (component-spec S3.4) and bind-category rules should be
 * validated at a higher level before dispatching this command.
 *
 * @param payload.source - NodeRef identifying the node to move.
 * @param payload.targetParent - NodeRef identifying the new parent node.
 * @param payload.targetIndex - Optional zero-based insertion position under the new parent.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the source node or target parent is not found, or if source is the root.
 */
registerHandler('component.moveNode', (state, payload) => {
  const { source, targetParent, targetIndex } = payload as {
    source: { bind?: string; nodeId?: string };
    targetParent: { bind?: string; nodeId?: string };
    targetIndex?: number;
  };

  const root = ensureTree(state);

  // Remove from current parent
  const sourceResult = findNode(root, source);
  if (!sourceResult || sourceResult.index === -1) throw new Error('Source node not found');
  const [node] = sourceResult.parent.children!.splice(sourceResult.index, 1);

  // Add to target parent
  const targetResult = findNode(root, targetParent);
  if (!targetResult) throw new Error('Target parent not found');
  if (!targetResult.node.children) targetResult.node.children = [];

  if (targetIndex !== undefined) {
    targetResult.node.children.splice(targetIndex, 0, node);
  } else {
    targetResult.node.children.push(node);
  }

  return { rebuildComponentTree: false };
});

/**
 * **component.reorderNode** -- Swap a node with its adjacent sibling.
 *
 * Moves the identified node one position `'up'` (toward index 0) or `'down'`
 * (toward the end) within its parent's children array by swapping it with the
 * neighboring sibling. If the node is already at the boundary (first child for
 * 'up', last child for 'down'), the operation is a no-op.
 *
 * @param payload.node - NodeRef identifying the node to reorder.
 * @param payload.direction - `'up'` to move toward lower indices, `'down'` toward higher.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found or is the root node.
 */
registerHandler('component.reorderNode', (state, payload) => {
  const { node: ref, direction } = payload as {
    node: { bind?: string; nodeId?: string };
    direction: 'up' | 'down';
  };

  const root = ensureTree(state);
  const result = findNode(root, ref);
  if (!result || result.index === -1) throw new Error('Node not found');

  const children = result.parent.children!;
  const idx = result.index;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= children.length) return { rebuildComponentTree: false };

  [children[idx], children[targetIdx]] = [children[targetIdx], children[idx]];
  return { rebuildComponentTree: false };
});

/**
 * **component.duplicateNode** -- Deep clone a node and its subtree.
 *
 * Creates a `structuredClone` of the identified node and inserts the clone
 * immediately after the original in the parent's children array. All unbound
 * nodes in the clone receive fresh auto-generated `nodeId`s to avoid collisions.
 * Bound nodes (`bind` key) retain their bind value in the clone, which may
 * produce duplicate-bind warnings at a higher diagnostic level (S4.3 uniqueness).
 *
 * @param payload.node - NodeRef identifying the node to duplicate.
 * @returns `{ rebuildComponentTree: false, nodeRef }` where `nodeRef` addresses the clone.
 * @throws If the node is not found or is the root node.
 */
registerHandler('component.duplicateNode', (state, payload) => {
  const { node: ref } = payload as { node: { bind?: string; nodeId?: string } };

  const root = ensureTree(state);
  const result = findNode(root, ref);
  if (!result || result.index === -1) throw new Error('Node not found');

  const clone = structuredClone(result.node);

  // Assign new nodeIds to all unbound nodes in the clone
  const reId = (n: TreeNode) => {
    if (n.nodeId) n.nodeId = generateNodeId();
    if (n.children) n.children.forEach(reId);
  };
  reId(clone);

  result.parent.children!.splice(result.index + 1, 0, clone);

  const nodeRef = clone.bind ? { bind: clone.bind } : { nodeId: clone.nodeId! };
  return { rebuildComponentTree: false, nodeRef };
});

/**
 * **component.wrapNode** -- Wrap an existing node inside a new container.
 *
 * Removes the target node from its current position, creates a new wrapper
 * node (which must be a Layout or Container component), places the target as
 * the wrapper's sole child, and inserts the wrapper at the target's original
 * position. The wrapper receives an auto-generated `nodeId` and any supplied
 * props.
 *
 * This is the inverse of `component.unwrapNode`.
 *
 * @param payload.node - NodeRef identifying the node to wrap.
 * @param payload.wrapper.component - Component type for the wrapper (e.g., 'Card', 'Stack').
 * @param payload.wrapper.props - Optional properties to apply to the wrapper node.
 * @returns `{ rebuildComponentTree: false, nodeRef }` where `nodeRef` addresses the new wrapper.
 * @throws If the target node is not found or is the root node.
 */
registerHandler('component.wrapNode', (state, payload) => {
  const { node: ref, wrapper } = payload as {
    node: { bind?: string; nodeId?: string };
    wrapper: { component: string; props?: Record<string, unknown> };
  };

  const root = ensureTree(state);
  const result = findNode(root, ref);
  if (!result || result.index === -1) throw new Error('Node not found');

  // Remove the target node
  const [targetNode] = result.parent.children!.splice(result.index, 1);

  // Create wrapper node (layout container — must have _layout flag for rebuild preservation)
  const wrapperNode: TreeNode = { component: wrapper.component, nodeId: generateNodeId(), _layout: true, children: [targetNode] };
  if (wrapper.props) Object.assign(wrapperNode, wrapper.props);

  // Insert wrapper at same position
  result.parent.children!.splice(result.index, 0, wrapperNode);

  return { rebuildComponentTree: false, nodeRef: { nodeId: wrapperNode.nodeId! } };
});

/**
 * **component.unwrapNode** -- Dissolve a container, promoting its children.
 *
 * Removes the identified node (typically a Layout or Container) and splices
 * its children into the parent's children array at the position the wrapper
 * occupied. If the node has no children, it is simply removed (equivalent
 * to `deleteNode`).
 *
 * This is the inverse of `component.wrapNode`. Only valid on nodes that
 * are containers with children -- calling on a leaf node just removes it.
 *
 * @param payload.node - NodeRef identifying the container node to unwrap.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found or is the root node.
 */
registerHandler('component.unwrapNode', (state, payload) => {
  const { node: ref } = payload as { node: { bind?: string; nodeId?: string } };

  const root = ensureTree(state);
  const result = findNode(root, ref);
  if (!result || result.index === -1) throw new Error('Node not found');

  const children = result.node.children ?? [];

  // Remove wrapper, insert children at its position
  result.parent.children!.splice(result.index, 1, ...children);

  return { rebuildComponentTree: false };
});
