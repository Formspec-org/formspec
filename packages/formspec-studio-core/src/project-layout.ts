/** @filedesc Layout authoring helpers for Formspec Studio. */
import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult, FlowProps, PlacementOptions, LayoutArrangement, LayoutAddItemSpec, HelperWarning } from './helper-types.js';
import { HelperError } from './helper-types.js';
import type { ProjectInternals } from './project-internals.js';
import { findComponentNodeByRef, refForCompNode } from './tree-utils.js';
import type { CompNode } from './layout-helpers.js';
import type { FormItem } from './types.js';
import * as definitionOps from './project-definition.js';

const _LAYOUT_ENTRIES = {
  'columns-2': { component: 'Grid', props: { columns: 2 } },
  'columns-3': { component: 'Grid', props: { columns: 3 } },
  'columns-4': { component: 'Grid', props: { columns: 4 } },
  'card': { component: 'Card' },
  'sidebar': { component: 'Panel', props: { position: 'left' } },
  'inline': { component: 'Stack', props: { direction: 'horizontal' } },
} as const satisfies Record<LayoutArrangement, { component: string; props?: Record<string, unknown> }>;

const _LAYOUT_MAP: Record<string, { component: string; props?: Record<string, unknown> }> = _LAYOUT_ENTRIES;

const _STYLE_ROUTING_PRESENTATION_KEYS = new Set([
  'widget', 'labelPosition', 'cssClass', 'inputMode', 'autoComplete',
  'prefix', 'suffix', 'format', 'currency', 'lines', 'placeholder',
  'trueLabel', 'falseLabel',
]);

/** Internal: Resolve a definition item path to the NodeRef used in the component tree. */
export function _nodeRefForItem(project: ProjectInternals, target: string): { bind: string } | { nodeId: string } {
  const leafKey = target.split('.').pop()!;
  const item = project.core.itemAt(target);
  if (item?.type === 'display') {
    return { nodeId: leafKey };
  }
  return { bind: leafKey };
}

/** Internal: Rebuild bound nodes from definition if missing. */
export function _ensureComponentNodeExistsForMove(project: ProjectInternals, sourceRef: { bind?: string; nodeId?: string }): void {
  const tree = project.core.state.component?.tree as CompNode | undefined;
  if (findComponentNodeByRef(tree, sourceRef)) return;
  project.core.dispatch({
    type: 'component.reconcileFromDefinition',
    payload: {},
  });
}

/** Internal: Find a bound child's index by item key on a page. */
export function _regionIndexOf(project: ProjectInternals, pageId: string, itemKey: string): number {
  const page = definitionOps._findPageNode(project, pageId);
  const boundChildren = definitionOps._pageBoundChildren(project, page);
  const index = boundChildren.findIndex(n => n.bind === itemKey);
  if (index === -1) throw new HelperError('ITEM_NOT_ON_PAGE', `Item '${itemKey}' is not on page '${pageId}'`, { pageId, itemKey });
  return index;
}

export function addPage(project: ProjectInternals, title: string, description?: string, id?: string): HelperResult {
  if (id !== undefined) {
    if (!/^[a-zA-Z][a-zA-Z0-9_\-]*$/.test(id)) {
      throw new HelperError('INVALID_PAGE_ID', `Page ID "${id}" is invalid. Must start with a letter and contain only letters, digits, underscores, or hyphens.`, { id });
    }
    const existing = definitionOps._getPageNodes(project).find((n: CompNode) => n.nodeId === id);
    if (existing) {
      throw new HelperError('DUPLICATE_PAGE_ID', `Page ID "${id}" is already in use.`, { id });
    }
  }

  const result = project.core.dispatch({
    type: 'component.addNode',
    payload: {
      parent: { nodeId: 'root' },
      component: 'Page',
      props: {
        title,
        description,
        ...(id !== undefined ? { nodeId: id } : {}),
      },
    },
  });

  const nodeId = result?.nodeRef?.nodeId;
  return {
    summary: `Added page "${title}"`,
    action: { helper: 'addPage', params: { title, description, id } },
    affectedPaths: nodeId ? [nodeId] : [],
    createdId: nodeId,
  };
}

export function removePage(project: ProjectInternals, pageId: string): HelperResult {
  definitionOps._findPageNode(project, pageId);
  project.core.dispatch({
    type: 'component.deleteNode',
    payload: { node: { nodeId: pageId } },
  });
  return {
    summary: `Removed page "${pageId}"`,
    action: { helper: 'removePage', params: { pageId } },
    affectedPaths: [pageId],
  };
}

export function reorderPage(project: ProjectInternals, pageId: string, direction: 'up' | 'down'): HelperResult {
  project.core.dispatch({
    type: 'component.reorderNode',
    payload: { node: { nodeId: pageId }, direction },
  });
  return {
    summary: `Reordered page "${pageId}" ${direction}`,
    action: { helper: 'reorderPage', params: { pageId, direction } },
    affectedPaths: [pageId],
  };
}

export function movePageToIndex(project: ProjectInternals, pageId: string, targetIndex: number): HelperResult {
  const insertIndex = definitionOps._pageInsertIndex(project, targetIndex, pageId);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: { source: { nodeId: pageId }, targetParent: { nodeId: 'root' }, targetIndex: insertIndex },
  });
  return {
    summary: `Moved page "${pageId}" to index ${targetIndex}`,
    action: { helper: 'movePageToIndex', params: { pageId, targetIndex } },
    affectedPaths: [pageId],
  };
}

export function listPages(project: ProjectInternals): Array<{ id: string; title: string; description?: string; groupPath?: string }> {
  return definitionOps._getPageNodes(project).map((n: CompNode) => {
    const boundChildren = definitionOps._pageBoundChildren(project, n);
    return {
      id: n.nodeId!,
      title: n.title ?? n.nodeId!,
      description: n.description,
      groupPath: boundChildren.length > 0 ? (boundChildren[0].bind as string) : undefined,
    };
  });
}

export function updatePage(project: ProjectInternals, pageId: string, changes: { title?: string; description?: string }): HelperResult {
  definitionOps._findPageNode(project, pageId);
  const commands: AnyCommand[] = [];
  if (changes.title !== undefined) {
    commands.push({
      type: 'component.setNodeProperty',
      payload: { node: { nodeId: pageId }, property: 'title', value: changes.title },
    });
  }
  if (changes.description !== undefined) {
    commands.push({
      type: 'component.setNodeProperty',
      payload: { node: { nodeId: pageId }, property: 'description', value: changes.description },
    });
  }
  project.core.batch(commands);
  return {
    summary: `Updated page "${pageId}"`,
    action: { helper: 'updatePage', params: { pageId, changes } },
    affectedPaths: [pageId],
  };
}

export function renamePage(project: ProjectInternals, pageId: string, newTitle: string): HelperResult {
  definitionOps._findPageNode(project, pageId);
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: { node: { nodeId: pageId }, property: 'title', value: newTitle },
  });
  return {
    summary: `Renamed page "${pageId}" to "${newTitle}"`,
    action: { helper: 'renamePage', params: { pageId, newTitle } },
    affectedPaths: [pageId],
  };
}

export function placeOnPage(project: ProjectInternals, target: string, pageId: string, options?: PlacementOptions): HelperResult {
  const sourceRef = _nodeRefForItem(project, target);
  _ensureComponentNodeExistsForMove(project, sourceRef);

  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: sourceRef,
      targetParent: { nodeId: pageId },
      ...(options?.insertIndex !== undefined ? { targetIndex: options.insertIndex } : {}),
    },
  });

  return {
    summary: `Placed "${target}" on page "${pageId}"`,
    action: { helper: 'placeOnPage', params: { target, pageId, options } },
    affectedPaths: [pageId, target],
  };
}

export function unplaceFromPage(project: ProjectInternals, target: string, pageId: string): HelperResult {
  const sourceRef = _nodeRefForItem(project, target);
  _ensureComponentNodeExistsForMove(project, sourceRef);

  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: sourceRef,
      targetParent: { nodeId: 'root' },
    },
  });

  return {
    summary: `Removed "${target}" from page "${pageId}"`,
    action: { helper: 'unplaceFromPage', params: { target, pageId } },
    affectedPaths: [pageId, target],
  };
}

export function reorderItemOnPage(project: ProjectInternals, pageId: string, itemKey: string, direction: 'up' | 'down'): HelperResult {
  const currentIndex = _regionIndexOf(project, pageId, itemKey);
  const targetIndex = Math.max(0, direction === 'up' ? currentIndex - 1 : currentIndex + 1);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: { bind: itemKey },
      targetParent: { nodeId: pageId },
      targetIndex,
    },
  });

  return {
    summary: `Reordered "${itemKey}" ${direction} on page "${pageId}"`,
    action: { helper: 'reorderItemOnPage', params: { pageId, itemKey, direction } },
    affectedPaths: [pageId, itemKey],
  };
}

export function moveItemOnPageToIndex(project: ProjectInternals, pageId: string, itemKey: string, targetIndex: number): HelperResult {
  _regionIndexOf(project, pageId, itemKey);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: { bind: itemKey },
      targetParent: { nodeId: pageId },
      targetIndex,
    },
  });

  return {
    summary: `Moved "${itemKey}" to index ${targetIndex} on page "${pageId}"`,
    action: { helper: 'moveItemOnPageToIndex', params: { pageId, itemKey, targetIndex } },
    affectedPaths: [pageId, itemKey],
  };
}

export function moveItemToPage(project: ProjectInternals, sourcePageId: string, itemKey: string, targetPageId: string, options?: PlacementOptions | number): HelperResult {
  _regionIndexOf(project, sourcePageId, itemKey);

  const targetIndex = typeof options === 'number' ? options : options?.insertIndex;

  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: { bind: itemKey },
      targetParent: { nodeId: targetPageId },
      targetIndex,
    },
  });

  return {
    summary: `Moved "${itemKey}" from page "${sourcePageId}" to "${targetPageId}"`,
    action: { helper: 'moveItemToPage', params: { sourcePageId, itemKey, targetPageId, options } },
    affectedPaths: [sourcePageId, targetPageId, itemKey],
  };
}

export function removeItemFromPage(project: ProjectInternals, pageId: string, itemKey: string): HelperResult {
  _regionIndexOf(project, pageId, itemKey);

  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: { bind: itemKey },
      targetParent: { nodeId: 'root' },
    },
  });

  return {
    summary: `Removed "${itemKey}" from page "${pageId}"`,
    action: { helper: 'removeItemFromPage', params: { pageId, itemKey } },
    affectedPaths: [pageId, itemKey],
  };
}

export function setFlow(project: ProjectInternals, mode: 'single' | 'wizard' | 'tabs', props?: FlowProps): HelperResult {
  const commands: AnyCommand[] = [
    { type: 'component.setNodeProperty', payload: { node: { nodeId: 'root' }, property: 'flowMode', value: mode } },
  ];

  if (props?.pageTitles) {
    for (const [pageId, title] of Object.entries(props.pageTitles)) {
      commands.push({
        type: 'component.setNodeProperty',
        payload: { node: { nodeId: pageId }, property: 'title', value: title },
      });
    }
  }

  project.core.batch(commands);

  return {
    summary: `Set flow mode to ${mode}`,
    action: { helper: 'setFlow', params: { mode, props } },
    affectedPaths: ['root'],
  };
}

export function setGroupRef(project: ProjectInternals, path: string, ref: string | null, keyPrefix?: string): HelperResult {
  project.core.dispatch({
    type: 'definition.setGroupRef',
    payload: { path, ref, ...(keyPrefix !== undefined ? { keyPrefix } : {}) },
  });
  return {
    summary: ref === null
      ? `Cleared group ref on '${path}'`
      : `Set group ref on '${path}'`,
    action: { helper: 'setGroupRef', params: { path, ref, keyPrefix } },
    affectedPaths: [path],
  };
}

export function addItemToLayout(project: ProjectInternals, spec: LayoutAddItemSpec, pageId?: string): HelperResult {
  const pageGroupPath = pageId ? definitionOps._resolvePageGroup(project, pageId) : undefined;
  const parentPath = spec.parentPath ?? pageGroupPath;
  const key = definitionOps._uniqueLayoutItemKey(project, spec.label, parentPath, spec.key);

  const result = definitionOps.addField(
    project,
    parentPath ? `${parentPath}.${key}` : key,
    spec.label,
    spec.dataType ?? 'string',
    spec.props,
  );

  if (pageId && result.createdId) {
    placeOnPage(project, result.createdId, pageId);
  }

  return result;
}

export function setItemWidth(project: ProjectInternals, pageId: string, itemKey: string, width: number): HelperResult {
  const page = definitionOps._findPageNode(project, pageId);
  const child = definitionOps._pageBoundChildren(project, page)[_regionIndexOf(project, pageId, itemKey)];

  project.core.dispatch({
    type: 'component.setNodeStyle',
    payload: { node: refForCompNode(child), property: 'gridSpan', value: width },
  });

  return {
    summary: `Set width of "${itemKey}" to ${width}`,
    action: { helper: 'setItemWidth', params: { pageId, itemKey, width } },
    affectedPaths: [pageId, itemKey],
  };
}

export function setItemOffset(project: ProjectInternals, pageId: string, itemKey: string, offset: number | undefined): HelperResult {
  const page = definitionOps._findPageNode(project, pageId);
  const child = definitionOps._pageBoundChildren(project, page)[_regionIndexOf(project, pageId, itemKey)];

  project.core.dispatch({
    type: 'component.setNodeStyle',
    payload: { node: refForCompNode(child), property: 'gridOffset', value: offset ?? null },
  });

  return {
    summary: `Set offset of "${itemKey}" to ${offset ?? 'auto'}`,
    action: { helper: 'setItemOffset', params: { pageId, itemKey, offset } },
    affectedPaths: [pageId, itemKey],
  };
}

export function setItemResponsive(
  project: ProjectInternals,
  pageId: string,
  itemKey: string,
  breakpoint: string,
  overrides: { width?: number; offset?: number; hidden?: boolean } | undefined,
): HelperResult {
  const page = definitionOps._findPageNode(project, pageId);
  const boundChildren = definitionOps._pageBoundChildren(project, page);
  const node = boundChildren.find((n: CompNode) => n.bind === itemKey);
  if (!node) throw new HelperError('ITEM_NOT_ON_PAGE', `Item '${itemKey}' is not on page '${pageId}'`, { pageId, itemKey });

  const responsive: Record<string, unknown> = { ...(node.responsive ?? {}) };

  if (overrides === undefined) {
    delete responsive[breakpoint];
  } else {
    const entry: Record<string, unknown> = {};
    if (overrides.width !== undefined) entry.span = overrides.width;
    if (overrides.offset !== undefined) entry.start = overrides.offset;
    if (overrides.hidden !== undefined) entry.hidden = overrides.hidden;
    responsive[breakpoint] = entry;
  }

  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: {
      node: refForCompNode(node),
      property: 'responsive',
      value: Object.keys(responsive).length > 0 ? responsive : null,
    },
  });
  return {
    summary: `Set responsive '${breakpoint}' for '${itemKey}' on page '${pageId}'`,
    action: { helper: 'setItemResponsive', params: { pageId, itemKey, breakpoint, overrides } },
    affectedPaths: [pageId, itemKey],
  };
}

export function applyLayout(project: ProjectInternals, targets: string | string[], arrangement: LayoutArrangement): HelperResult {
  const targetPaths = Array.isArray(targets) ? targets : [targets];
  const config = _LAYOUT_MAP[arrangement];
  if (!config) throw new HelperError('INVALID_ARRANGEMENT', `Invalid layout arrangement: ${arrangement}`, { arrangement });

  const result = project.core.dispatch({
    type: 'component.wrapSiblingNodes',
    payload: {
      nodes: targetPaths.map(p => _nodeRefForItem(project, p)),
      wrapper: { component: config.component, props: config.props },
    },
  });

  const nodeId = result?.nodeRef?.nodeId;
  return {
    summary: `Applied ${arrangement} layout to ${targetPaths.length} item(s)`,
    action: { helper: 'applyLayout', params: { targets, arrangement } },
    affectedPaths: nodeId ? [nodeId, ...targetPaths] : targetPaths,
    createdId: nodeId,
  };
}

export function applyStyle(project: ProjectInternals, path: string, properties: Record<string, unknown>): HelperResult {
  const leafKey = path.split('.').pop()!;
  const warnings: HelperWarning[] = [];
  const commands: AnyCommand[] = [];

  const collectLeafPaths = (items: FormItem[], key: string, prefix?: string): string[] => {
    const paths: string[] = [];
    for (const item of items) {
      const itemPath = prefix ? `${prefix}.${item.key}` : item.key;
      if (item.key === key) paths.push(itemPath);
      if (item.children?.length) paths.push(...collectLeafPaths(item.children, key, itemPath));
    }
    return paths;
  };
  const matchingPaths = collectLeafPaths(project.core.state.definition.items, leafKey);
  if (matchingPaths.length > 1) {
    warnings.push({
      code: 'AMBIGUOUS_ITEM_KEY',
      message: `Leaf key '${leafKey}' matches ${matchingPaths.length} items; style override applies to all`,
      detail: { leafKey, conflictingPaths: matchingPaths },
    });
  }

  for (const [prop, val] of Object.entries(properties)) {
    if (_STYLE_ROUTING_PRESENTATION_KEYS.has(prop)) {
      commands.push({
        type: 'theme.setItemOverride',
        payload: { itemKey: leafKey, property: prop, value: val },
      });
    } else {
      commands.push({
        type: 'theme.setItemStyle',
        payload: { itemKey: leafKey, property: prop, value: val },
      });
    }
  }

  if (commands.length > 0) {
    project.core.dispatch(commands);
  }

  return {
    summary: `Applied style to '${path}'`,
    action: { helper: 'applyStyle', params: { path, properties } },
    affectedPaths: [path],
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function applyStyleAll(
  project: ProjectInternals,
  target: 'form' | { type: 'group' | 'field' | 'display' } | { dataType: string },
  properties: Record<string, unknown>,
): HelperResult {
  const commands: AnyCommand[] = [];

  if (target === 'form') {
    const cssProps: Record<string, unknown> = {};
    for (const [prop, val] of Object.entries(properties)) {
      if (prop === 'density') {
        commands.push({
          type: 'definition.setFormPresentation',
          payload: { property: 'density', value: val },
        });
      } else if (_STYLE_ROUTING_PRESENTATION_KEYS.has(prop)) {
        commands.push({
          type: 'theme.setDefaults',
          payload: { property: prop, value: val },
        });
      } else {
        cssProps[prop] = val;
      }
    }
    if (Object.keys(cssProps).length > 0) {
      const existing = (project.core.state.theme.defaults?.style as Record<string, unknown> | undefined) ?? {};
      commands.push({
        type: 'theme.setDefaults',
        payload: { property: 'style', value: { ...existing, ...cssProps } },
      });
    }
  } else {
    const apply: Record<string, unknown> = {};
    const cssProps: Record<string, unknown> = {};
    for (const [prop, val] of Object.entries(properties)) {
      if (_STYLE_ROUTING_PRESENTATION_KEYS.has(prop)) {
        apply[prop] = val;
      } else {
        cssProps[prop] = val;
      }
    }
    if (Object.keys(cssProps).length > 0) {
      apply.style = cssProps;
    }
    commands.push({
      type: 'theme.addSelector',
      payload: { match: target, apply },
    });
  }

  if (commands.length > 0) {
    project.core.dispatch(commands);
  }

  return {
    summary: `Applied style to ${typeof target === 'string' ? target : JSON.stringify(target)}`,
    action: { helper: 'applyStyleAll', params: { target, properties } },
    affectedPaths: [],
  };
}

export function addRegion(project: ProjectInternals, pageId: string, span?: number): HelperResult {
  const key = `region_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  project.core.dispatch({
    type: 'component.addNode',
    payload: {
      parent: { nodeId: pageId },
      component: 'BoundItem',
      bind: key,
      props: span !== undefined ? { span } : undefined,
    },
  });
  return {
    summary: `Added region to page '${pageId}'`,
    action: { helper: 'addRegion', params: { pageId, span } },
    affectedPaths: [pageId],
  };
}

export function updateRegion(project: ProjectInternals, pageId: string, regionIndex: number, property: string, value: unknown): HelperResult {
  const page = definitionOps._findPageNode(project, pageId);
  const child = definitionOps._pageBoundChildren(project, page)[regionIndex];
  if (!child) throw new HelperError('ROUTE_OUT_OF_BOUNDS', `Region not found at index ${regionIndex} on page '${pageId}'`);
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: { node: refForCompNode(child), property, value: value ?? null },
  });
  return {
    summary: `Updated region ${regionIndex} on page '${pageId}' property '${property}'`,
    action: { helper: 'updateRegion', params: { pageId, regionIndex, property, value } },
    affectedPaths: [pageId],
  };
}

export function deleteRegion(project: ProjectInternals, pageId: string, regionIndex: number): HelperResult {
  const page = definitionOps._findPageNode(project, pageId);
  const child = definitionOps._pageBoundChildren(project, page)[regionIndex];
  if (!child) throw new HelperError('ROUTE_OUT_OF_BOUNDS', `Region not found at index ${regionIndex} on page '${pageId}'`);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: refForCompNode(child),
      targetParent: { nodeId: 'root' },
    },
  });
  return {
    summary: `Deleted region ${regionIndex} from page '${pageId}'`,
    action: { helper: 'deleteRegion', params: { pageId, regionIndex } },
    affectedPaths: [pageId],
  };
}

export function reorderRegion(project: ProjectInternals, pageId: string, regionIndex: number, direction: 'up' | 'down'): HelperResult {
  const page = definitionOps._findPageNode(project, pageId);
  const child = definitionOps._pageBoundChildren(project, page)[regionIndex];
  if (!child) throw new HelperError('ROUTE_OUT_OF_BOUNDS', `Region not found at index ${regionIndex} on page '${pageId}'`);
  const targetIndex = Math.max(0, direction === 'up' ? regionIndex - 1 : regionIndex + 1);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: refForCompNode(child),
      targetParent: { nodeId: pageId },
      targetIndex,
    },
  });
  return {
    summary: `Reordered region ${regionIndex} on page '${pageId}' ${direction}`,
    action: { helper: 'reorderRegion', params: { pageId, regionIndex, direction } },
    affectedPaths: [pageId],
  };
}

export function setRegionKey(project: ProjectInternals, pageId: string, regionIndex: number, newKey: string): HelperResult {
  const page = definitionOps._findPageNode(project, pageId);
  const boundChildren = definitionOps._pageBoundChildren(project, page);
  const child = boundChildren[regionIndex];
  if (!child) throw new HelperError('ROUTE_OUT_OF_BOUNDS', `Region not found at index ${regionIndex} on page '${pageId}'`);
  const oldNodeRef = refForCompNode(child);
  const newNodeRef = { bind: newKey };
  const commands: AnyCommand[] = [
    {
      type: 'component.moveNode',
      payload: { source: oldNodeRef, targetParent: { nodeId: 'root' } },
    },
    {
      type: 'component.moveNode',
      payload: { source: newNodeRef, targetParent: { nodeId: pageId }, targetIndex: regionIndex },
    },
    {
      type: 'component.setNodeProperty',
      payload: { node: newNodeRef, property: 'span', value: child.span ?? null },
    },
    {
      type: 'component.setNodeProperty',
      payload: { node: newNodeRef, property: 'start', value: child.start ?? null },
    },
    {
      type: 'component.setNodeProperty',
      payload: { node: newNodeRef, property: 'responsive', value: child.responsive ?? null },
    },
  ];
  project.core.dispatch(commands);
  return {
    summary: `Set region ${regionIndex} on page '${pageId}' to key '${newKey}'`,
    action: { helper: 'setRegionKey', params: { pageId, regionIndex, key: newKey } },
    affectedPaths: [pageId],
  };
}

export function setComponentWhen(project: ProjectInternals, target: string, when: string | null): HelperResult {
  const ref = _nodeRefForItem(project, target);
  if (when) definitionOps._validateFEL(project, when);

  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: { node: ref, property: 'when', value: when },
  });

  return {
    summary: when ? `Set visibility condition for "${target}"` : `Cleared visibility condition for "${target}"`,
    action: { helper: 'setComponentWhen', params: { target, when } },
    affectedPaths: [target],
  };
}

export function setComponentAccessibility(project: ProjectInternals, target: string, property: string, value: unknown): HelperResult {
  const ref = _nodeRefForItem(project, target);
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: { node: ref, property, value },
  });

  return {
    summary: `Updated accessibility property "${property}" for "${target}"`,
    action: { helper: 'setComponentAccessibility', params: { target, property, value } },
    affectedPaths: [target],
  };
}

export function setLayoutNodeProp(project: ProjectInternals, target: string, property: string, value: unknown): HelperResult {
  const ref = _nodeRefForItem(project, target);
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: { node: ref, property, value },
  });

  return {
    summary: `Updated layout property "${property}" for "${target}"`,
    action: { helper: 'setLayoutNodeProp', params: { target, property, value } },
    affectedPaths: [target],
  };
}

export function setNodeStyleProperty(project: ProjectInternals, ref: { nodeId?: string; bind?: string }, property: string, value: string): void {
  project.core.dispatch({
    type: 'component.setNodeStyle',
    payload: { node: ref, property, value },
  });
}
