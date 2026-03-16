/**
 * Component property handlers.
 *
 * These handlers implement the `component.*` property-mutation commands defined
 * in the API spec's "Component -- Node Properties", "Custom Components", and
 * "Document-Level" sections. They modify properties on individual tree nodes,
 * manage custom component templates, and set document-level tokens/breakpoints.
 *
 * **Node location:**
 * Nodes are located by NodeRef -- an object with exactly one of `{ bind }` or
 * `{ nodeId }`. Bound nodes (Input, Display, some Special components) are
 * addressed by their definition item key. Unbound nodes (Layout, Container)
 * are addressed by their auto-generated `nodeId`.
 *
 * **Property categories:**
 * - General properties (`setNodeProperty`) -- any key on the node object.
 * - Style properties (`setNodeStyle`) -- scoped to the `style` sub-object;
 *   values may contain `$token.key` references resolved at render time.
 * - Accessibility properties (`setNodeAccessibility`) -- scoped to the
 *   `accessibility` sub-object (role, description, liveRegion).
 * - Responsive overrides (`setResponsiveOverride`) -- per-breakpoint property
 *   patches scoped to the `responsive` sub-object.
 * - Array properties (`spliceArrayProp`) -- splice-based mutation for array
 *   valued props like Summary `items`, DataTable `columns`, etc.
 *
 * **Custom components:**
 * Custom components are reusable template trees stored in
 * `component.customComponents`. They are registered by PascalCase name, may
 * declare parameters, and contain a template tree that is expanded wherever
 * the custom component name appears in the main tree. Renaming propagates
 * through all tree references.
 *
 * **Document-level properties:**
 * Tokens, breakpoints, wizard configuration, and top-level metadata are set
 * directly on the component document rather than on individual tree nodes.
 *
 * @module handlers/component-properties
 */
import { registerHandler } from '../handler-registry.js';
import type { ComponentState, ProjectState } from '../types.js';
import {
  getEditableComponentDocument,
  hasAuthoredComponentTree,
} from '../component-documents.js';
import { normalizeIndexedPath } from 'formspec-engine';

/**
 * Internal representation of a component tree node.
 *
 * Mirrors the TreeNode type in component-tree.ts with additional typed
 * sub-objects for style, accessibility, and responsive overrides.
 */
type TreeNode = {
  component: string;
  bind?: string;
  nodeId?: string;
  children?: TreeNode[];
  style?: Record<string, unknown>;
  accessibility?: Record<string, unknown>;
  responsive?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * Ensure the component document has a root tree node.
 *
 * Initializes `component.tree` with a synthetic Stack root if absent and marks
 * the document as Studio-generated internal state rather than a spec-valid
 * serialized component document.
 *
 * @param component - The component document.
 * @returns The root tree node.
 */
function markStudioGeneratedComponent(component: ComponentState): void {
  component['x-studio-generated'] = true;
}

function ensureTree(state: ProjectState): TreeNode {
  const component = getEditableComponentDocument(state) as ComponentState;
  if (!hasAuthoredComponentTree(state.component)) {
    markStudioGeneratedComponent(component);
  }
  if (!component.tree) {
    component.tree = { component: 'Stack', nodeId: 'root', children: [] };
  }
  return component.tree as TreeNode;
}

/**
 * Locate a tree node by its NodeRef.
 *
 * Performs an iterative depth-first search matching on `nodeId` or `bind`.
 * Unlike the tree-handler variant, this returns only the node (no parent/index)
 * since property mutations do not need splice context.
 *
 * @param root - The tree root to search from.
 * @param ref - A NodeRef with `bind` or `nodeId`.
 * @returns The matched TreeNode, or `undefined` if not found.
 */
function findNode(
  root: TreeNode,
  ref: { bind?: string; nodeId?: string },
): TreeNode | undefined {
  if (ref.nodeId && root.nodeId === ref.nodeId) return root;
  if (ref.bind && root.bind === ref.bind) return root;

  const stack: TreeNode[] = [root];
  while (stack.length) {
    const parent = stack.pop()!;
    for (const child of parent.children ?? []) {
      if (ref.nodeId && child.nodeId === ref.nodeId) return child;
      if (ref.bind && child.bind === ref.bind) return child;
      stack.push(child);
    }
  }
  return undefined;
}

function findFirstComponent(root: TreeNode, componentType: string): TreeNode | undefined {
  const stack: TreeNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.component === componentType) return node;
    for (const child of node.children ?? []) {
      stack.push(child);
    }
  }
  return undefined;
}

// ── Node Properties ─────────────────────────────────────────────

/**
 * **component.setNodeProperty** -- Set or remove any property on a component tree node.
 *
 * This is the general-purpose property setter. It can modify any key on the
 * node object. Setting `value` to `null` removes the property entirely.
 *
 * Common uses include setting `when` (FEL conditional visibility expression),
 * `label`, `placeholder`, and any component-specific prop. For style and
 * accessibility properties, prefer the dedicated `setNodeStyle` and
 * `setNodeAccessibility` commands which scope to the appropriate sub-object.
 *
 * @param payload.node - NodeRef identifying the target node by `bind` or `nodeId`.
 * @param payload.property - The property key to set on the node.
 * @param payload.value - The value to assign, or `null` to delete the property.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found.
 */
registerHandler('component.setNodeProperty', (state, payload) => {
  const { node: ref, property, value } = payload as {
    node: { bind?: string; nodeId?: string }; property: string; value: unknown;
  };
  const root = ensureTree(state);
  const node = findNode(root, ref);
  if (!node) throw new Error('Node not found');

  if (value === null) {
    delete node[property];
  } else {
    node[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * **component.setNodeType** -- Change a node's component type in place.
 *
 * Replaces the `component` field on the identified node. The node retains its
 * position in the tree, its children, and all other properties. When
 * `preserveProps` is true (the default at the API level), compatible properties
 * are kept; incompatible ones should be dropped by a higher-level validator.
 *
 * For bound field nodes, prefer `component.setFieldWidget` which additionally
 * validates widget/dataType compatibility (component-spec S4.6).
 *
 * @param payload.node - NodeRef identifying the target node.
 * @param payload.component - The new component type name.
 * @param payload.preserveProps - Whether to keep existing props (handled at validation layer).
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found.
 */
registerHandler('component.setNodeType', (state, payload) => {
  const { node: ref, component } = payload as {
    node: { bind?: string; nodeId?: string }; component: string; preserveProps?: boolean;
  };
  const root = ensureTree(state);
  const node = findNode(root, ref);
  if (!node) throw new Error('Node not found');

  node.component = component;
  return { rebuildComponentTree: false };
});

/**
 * **component.setNodeStyle** -- Set or remove a single style property on a node.
 *
 * Operates on the node's `style` sub-object (StyleMap). Setting `value` to
 * `null` removes the property. This is more ergonomic than replacing the entire
 * style object via `setNodeProperty`.
 *
 * Style values may contain `$token.key` references that are resolved against
 * the token cascade (Tier 3 component tokens > Tier 2 theme tokens) at render time.
 *
 * @param payload.node - NodeRef identifying the target node.
 * @param payload.property - The style property key (e.g., 'width', 'padding').
 * @param payload.value - The value to set, or `null` to remove the property.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found.
 */
registerHandler('component.setNodeStyle', (state, payload) => {
  const { node: ref, property, value } = payload as {
    node: { bind?: string; nodeId?: string }; property: string; value: unknown;
  };
  const root = ensureTree(state);
  const node = findNode(root, ref);
  if (!node) throw new Error('Node not found');

  if (!node.style) node.style = {};

  if (value === null) {
    delete node.style[property];
  } else {
    node.style[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * **component.setNodeAccessibility** -- Set or remove an accessibility property on a node.
 *
 * Operates on the node's `accessibility` sub-object. Valid properties are
 * `role`, `description`, and `liveRegion`. Setting `value` to `null` removes
 * the property.
 *
 * @param payload.node - NodeRef identifying the target node.
 * @param payload.property - The accessibility key ('role', 'description', or 'liveRegion').
 * @param payload.value - The value to set, or `null` to remove.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found.
 */
registerHandler('component.setNodeAccessibility', (state, payload) => {
  const { node: ref, property, value } = payload as {
    node: { bind?: string; nodeId?: string }; property: string; value: unknown;
  };
  const root = ensureTree(state);
  const node = findNode(root, ref);
  if (!node) throw new Error('Node not found');

  if (!node.accessibility) node.accessibility = {};

  if (value === null) {
    delete node.accessibility[property];
  } else {
    node.accessibility[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * **component.spliceArrayProp** -- Splice elements within an array-valued node property.
 *
 * Uses standard `Array.prototype.splice` semantics to add, remove, or replace
 * elements within array-valued component properties without replacing the
 * entire array. Common targets include Summary `items`, DataTable `columns`,
 * Tabs `tabLabels`, Accordion `labels`, and Columns `widths`.
 *
 * @param payload.node - NodeRef identifying the target node.
 * @param payload.property - The array-valued property name (e.g., 'items', 'columns').
 * @param payload.index - Zero-based position to start the splice.
 * @param payload.deleteCount - Number of elements to remove (0 for pure insert).
 * @param payload.insert - Optional array of elements to insert at the position.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found or the property is not an array.
 */
registerHandler('component.spliceArrayProp', (state, payload) => {
  const { node: ref, property, index, deleteCount, insert } = payload as {
    node: { bind?: string; nodeId?: string };
    property: string; index: number; deleteCount: number; insert?: unknown[];
  };
  const root = ensureTree(state);
  const node = findNode(root, ref);
  if (!node) throw new Error('Node not found');

  const arr = node[property] as unknown[];
  if (!Array.isArray(arr)) throw new Error(`Property ${property} is not an array`);

  arr.splice(index, deleteCount, ...(insert ?? []));
  return { rebuildComponentTree: false };
});

/**
 * **component.setFieldWidget** -- Override which component type renders a bound field.
 *
 * Locates the tree node bound to `fieldKey` and changes its `component` type to
 * the specified `widget`. This is a convenience wrapper around `setNodeType`
 * that addresses the node by bind key and should validate widget/dataType
 * compatibility (component-spec S4.6) at a higher level.
 *
 * @param payload.fieldKey - The definition item key (bind path) of the field.
 * @param payload.widget - The new component type name to use for rendering.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If no component node is bound to the specified field key.
 */
registerHandler('component.setFieldWidget', (state, payload) => {
  const { fieldKey, widget } = payload as { fieldKey: string; widget: string };
  const root = ensureTree(state);
  const node = findNode(root, { bind: fieldKey });
  if (!node) throw new Error(`No component node bound to field: ${fieldKey}`);

  node.component = widget;
  return { rebuildComponentTree: false };
});

/**
 * **component.setResponsiveOverride** -- Set or remove per-breakpoint property overrides.
 *
 * Manages the node's `responsive` sub-object, which maps breakpoint names to
 * property patch objects. At render time, the active breakpoint's patch is
 * merged over the node's base properties.
 *
 * Setting `patch` to `null` removes the override for that breakpoint. Certain
 * properties are forbidden in responsive overrides per component-spec S9.4:
 * `component`, `bind`, `when`, `children`, and `responsive`.
 *
 * @param payload.node - NodeRef identifying the target node.
 * @param payload.breakpoint - The breakpoint name (must match a defined breakpoint).
 * @param payload.patch - Property overrides for this breakpoint, or `null` to remove.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If the node is not found.
 */
registerHandler('component.setResponsiveOverride', (state, payload) => {
  const { node: ref, breakpoint, patch } = payload as {
    node: { bind?: string; nodeId?: string }; breakpoint: string; patch: unknown;
  };
  const root = ensureTree(state);
  const node = findNode(root, ref);
  if (!node) throw new Error('Node not found');

  if (!node.responsive) node.responsive = {};

  if (patch === null) {
    delete node.responsive[breakpoint];
  } else {
    node.responsive[breakpoint] = patch;
  }
  return { rebuildComponentTree: false };
});

/**
 * **component.setWizardProperty** -- Set a property on the Wizard component.
 *
 * Finds the Wizard node in whichever tree is active (authored or generated)
 * and sets the property directly on it. No-ops if no Wizard node exists
 * (e.g., form is in single mode with a Stack root).
 *
 * @param payload.property - The Wizard component prop (e.g., 'showProgress', 'allowSkip').
 * @param payload.value - The value to set.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('component.setWizardProperty', (state, payload) => {
  const { property, value } = payload as { property: string; value: unknown };
  const root = ensureTree(state);
  const wizard = findFirstComponent(root, 'Wizard');
  if (wizard) {
    wizard[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * **component.setGroupRepeatable** -- Toggle repeat mode on a group's component node.
 *
 * Locates the tree node bound to `groupKey` and sets its `repeatable` flag.
 * When toggled on, the runtime adds repeat container, add/remove buttons.
 * This command returns `rebuildComponentTree: true` because toggling
 * repeatability may structurally alter the rendered tree.
 *
 * @param payload.groupKey - The definition group key (bind path).
 * @param payload.repeatable - `true` to enable, `false` to disable repeat mode.
 * @returns `{ rebuildComponentTree: true }`.
 * @throws If no component node is bound to the specified group key.
 */
registerHandler('component.setGroupRepeatable', (state, payload) => {
  const { groupKey, repeatable } = payload as { groupKey: string; repeatable: boolean };
  const root = ensureTree(state);
  const node = findNode(root, { bind: groupKey });
  if (!node) throw new Error(`No component node bound to group: ${groupKey}`);

  node.repeatable = repeatable;
  return { rebuildComponentTree: true };
});

/**
 * **component.setGroupDisplayMode** -- Switch a group's display mode.
 *
 * Sets the `displayMode` property on the tree node bound to `groupKey`.
 * Supported modes are `'stack'` (default stacked fields) and `'dataTable'`
 * (tabular data entry). Use `component.setGroupDataTable` to configure
 * column definitions when mode is `'dataTable'`.
 *
 * @param payload.groupKey - The definition group key (bind path).
 * @param payload.mode - `'stack'` or `'dataTable'`.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If no component node is bound to the specified group key.
 */
registerHandler('component.setGroupDisplayMode', (state, payload) => {
  const { groupKey, mode } = payload as { groupKey: string; mode: string };
  const root = ensureTree(state);
  const node = findNode(root, { bind: groupKey });
  if (!node) throw new Error(`No component node bound to group: ${groupKey}`);

  node.displayMode = mode;
  return { rebuildComponentTree: false };
});

/**
 * **component.setGroupDataTable** -- Configure data table settings for a group.
 *
 * Sets the `dataTableConfig` property on the tree node bound to `groupKey`.
 * The config object defines column definitions, sorting behavior, and
 * add/remove row controls. Only meaningful when the group's `displayMode`
 * is `'dataTable'`.
 *
 * @param payload.groupKey - The definition group key (bind path).
 * @param payload.config - Data table configuration object.
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If no component node is bound to the specified group key.
 */
registerHandler('component.setGroupDataTable', (state, payload) => {
  const { groupKey, config } = payload as { groupKey: string; config: unknown };
  const root = ensureTree(state);
  const node = findNode(root, { bind: groupKey });
  if (!node) throw new Error(`No component node bound to group: ${groupKey}`);

  node.dataTableConfig = config;
  return { rebuildComponentTree: false };
});

// ── Custom Components ───────────────────────────────────────────

/**
 * **component.registerCustom** -- Register a new reusable custom component template.
 *
 * Creates an entry in `component.customComponents` keyed by `name`. The `name`
 * must be PascalCase and must not collide with any built-in component name.
 * The template consists of `params` (parameter declarations for the template)
 * and `tree` (the template's component subtree that is expanded wherever the
 * custom component name is used in the main tree).
 *
 * @param payload.name - PascalCase name for the custom component.
 * @param payload.params - Parameter schema/declarations for the template.
 * @param payload.tree - The template tree structure to expand at usage sites.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('component.registerCustom', (state, payload) => {
  const { name, params, tree } = payload as { name: string; params: unknown; tree: unknown };
  if (!state.component.customComponents) {
    state.component.customComponents = {};
  }
  (state.component.customComponents as any)[name] = { params, tree };
  return { rebuildComponentTree: false };
});

/**
 * **component.updateCustom** -- Update an existing custom component template.
 *
 * Partially updates the template's `params` and/or `tree`. Omitted fields
 * are left unchanged. This allows modifying the parameter schema or template
 * tree independently.
 *
 * @param payload.name - Name of the existing custom component to update.
 * @param payload.params - New parameter declarations (optional; omit to keep current).
 * @param payload.tree - New template tree (optional; omit to keep current).
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If no custom component with the given name exists.
 */
registerHandler('component.updateCustom', (state, payload) => {
  const { name, params, tree } = payload as { name: string; params?: unknown; tree?: unknown };
  const custom = (state.component.customComponents as any)?.[name];
  if (!custom) throw new Error(`Custom component not found: ${name}`);

  if (params !== undefined) custom.params = params;
  if (tree !== undefined) custom.tree = tree;
  return { rebuildComponentTree: false };
});

/**
 * **component.deleteCustom** -- Remove a custom component template.
 *
 * Deletes the named entry from `component.customComponents`. At a higher level,
 * instances of this custom component in the main tree should be replaced with
 * their expanded subtree. This handler only removes the template definition.
 *
 * @param payload.name - Name of the custom component to delete.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('component.deleteCustom', (state, payload) => {
  const { name } = payload as { name: string };
  if (state.component.customComponents) {
    delete (state.component.customComponents as any)[name];
  }
  return { rebuildComponentTree: false };
});

/**
 * **component.renameCustom** -- Rename a custom component and propagate references.
 *
 * Moves the template entry from `name` to `newName` in `customComponents`, then
 * performs a recursive walk of the entire component tree to rewrite every node
 * whose `component` field matches the old name. This ensures all usage sites
 * are updated atomically.
 *
 * @param payload.name - Current name of the custom component.
 * @param payload.newName - New name (must be PascalCase, must not collide with built-ins).
 * @returns `{ rebuildComponentTree: false }`.
 * @throws If no custom component with the given name exists.
 */
registerHandler('component.renameCustom', (state, payload) => {
  const { name, newName } = payload as { name: string; newName: string };
  const customs = state.component.customComponents as any;
  if (!customs?.[name]) throw new Error(`Custom component not found: ${name}`);

  customs[newName] = customs[name];
  delete customs[name];

  // Rewrite tree references
  const root = ensureTree(state);
  const rewrite = (node: TreeNode) => {
    if (node.component === name) node.component = newName;
    if (node.children) node.children.forEach(rewrite);
  };
  rewrite(root);

  return { rebuildComponentTree: false };
});

// ── Document-Level ──────────────────────────────────────────────

/**
 * **component.setToken** -- Set or remove a Tier 3 design token on the component document.
 *
 * Tier 3 tokens are defined at the component level and override Tier 2 theme
 * tokens of the same key. Setting `value` to `null` removes the token.
 * Token keys are dot-delimited (e.g., `color.primary`).
 *
 * @param payload.key - The token key (dot-delimited path).
 * @param payload.value - The token value, or `null` to remove.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('component.setToken', (state, payload) => {
  const { key, value } = payload as { key: string; value: unknown };
  if (!state.component.tokens) state.component.tokens = {};

  if (value === null) {
    delete state.component.tokens[key];
  } else {
    state.component.tokens[key] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * **component.setBreakpoint** -- Set or remove a component-level responsive breakpoint.
 *
 * Breakpoints defined here are independent of theme breakpoints and are used
 * with `component.setResponsiveOverride` to apply per-breakpoint property
 * patches on individual nodes. Setting `minWidth` to `null` removes the
 * breakpoint.
 *
 * @param payload.name - The breakpoint name (e.g., 'sm', 'md', 'lg').
 * @param payload.minWidth - Minimum viewport width in pixels, or `null` to remove.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('component.setBreakpoint', (state, payload) => {
  const { name, minWidth } = payload as { name: string; minWidth: number | null };
  if (!state.component.breakpoints) state.component.breakpoints = {};

  if (minWidth === null) {
    delete state.component.breakpoints[name];
  } else {
    state.component.breakpoints[name] = minWidth;
  }
  return { rebuildComponentTree: false };
});

/**
 * **component.setDocumentProperty** -- Set or remove a top-level component document property.
 *
 * Manages document-level metadata fields: `url`, `name`, `title`, `description`,
 * `version`, and `targetDefinition`. Setting `value` to `null` removes the
 * property. These properties do not affect the tree structure or node rendering.
 *
 * @param payload.property - The document property key.
 * @param payload.value - The value to set, or `null` to remove.
 * @returns `{ rebuildComponentTree: false }`.
 */
registerHandler('component.setDocumentProperty', (state, payload) => {
  const { property, value } = payload as { property: string; value: unknown };
  if (value === null) {
    delete (state.component as any)[property];
  } else {
    // Normalize bind paths in tree to strip repeat indices
    if (property === 'tree' && value && typeof value === 'object') {
      const normalizeBinds = (node: Record<string, unknown>) => {
        if (typeof node.bind === 'string') {
          node.bind = normalizeIndexedPath(node.bind);
        }
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            if (child && typeof child === 'object') normalizeBinds(child as Record<string, unknown>);
          }
        }
      };
      normalizeBinds(value as Record<string, unknown>);
    }
    (state.component as any)[property] = value;
  }
  return { rebuildComponentTree: false };
});
