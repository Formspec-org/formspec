import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult, FlowProps, PlacementOptions, LayoutArrangement, LayoutAddItemSpec, HelperWarning } from './helper-types.js';
import { HelperError } from './helper-types.js';
import type { ProjectInternals } from './project-internals.js';
import { pageChildren, findParentRefOfNodeRef, findComponentNodeById, findComponentNodeByRef, refForCompNode } from './tree-utils.js';
import { componentTargetRef } from './lib/component-target-ref.js';
import type { CompNode } from './layout-helpers.js';
import type { FormItem } from './types.js';

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

export function addPage(project: ProjectInternals, title: string, description?: string, id?: string): HelperResult {
  if (id !== undefined) {
    if (!/^[a-zA-Z][a-zA-Z0-9_\-]*$/.test(id)) {
      throw new HelperError('INVALID_PAGE_ID', `Page ID "${id}" is invalid. Must start with a letter and contain only letters, digits, underscores, or hyphens.`, { id });
    }
    const existing = project._getPageNodes().find((n: CompNode) => n.nodeId === id);
    if (existing) {
      throw new HelperError('DUPLICATE_KEY', `A page with ID "${id}" already exists`, { id });
    }
  }

  const pageId = id ?? `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pageProps: Record<string, unknown> = { nodeId: pageId, title };
  if (description) pageProps.description = description;

  const pageModeCommand: AnyCommand | null =
    !project.definition.formPresentation?.pageMode || project.definition.formPresentation.pageMode === 'single'
      ? {
          type: 'definition.setFormPresentation',
          payload: { property: 'pageMode', value: 'wizard' },
        }
      : null;

  const addPageCommand: AnyCommand = {
    type: 'component.addNode',
    payload: {
      parent: { nodeId: 'root' },
      component: 'Page',
      props: pageProps,
    },
  };

  if (pageModeCommand) {
    project.core.dispatch([pageModeCommand, addPageCommand]);
  } else {
    project.core.dispatch(addPageCommand);
  }

  return {
    summary: `Added page '${title}'`,
    action: { helper: 'addPage', params: { title, description } },
    affectedPaths: [pageId],
    createdId: pageId,
  };
}

export function removePage(project: ProjectInternals, pageId: string): HelperResult {
  const page = project._findPageNode(pageId);
  const commands: AnyCommand[] = pageChildren(page).map((child) => ({
    type: 'component.moveNode',
    payload: {
      source: refForCompNode(child),
      targetParent: { nodeId: 'root' },
    },
  }));
  commands.push({
    type: 'component.deleteNode',
    payload: { node: { nodeId: pageId } },
  });
  project.core.batch(commands);

  return {
    summary: `Removed page '${pageId}'`,
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
    summary: `Reordered page '${pageId}' ${direction}`,
    action: { helper: 'reorderPage', params: { pageId, direction } },
    affectedPaths: [pageId],
  };
}

export function movePageToIndex(project: ProjectInternals, pageId: string, targetIndex: number): HelperResult {
  const insertIndex = project._pageInsertIndex(targetIndex, pageId);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: { nodeId: pageId },
      targetParent: { nodeId: 'root' },
      targetIndex: insertIndex,
    },
  });
  return {
    summary: `Moved page '${pageId}' to index ${targetIndex}`,
    action: { helper: 'movePageToIndex', params: { pageId, targetIndex } },
    affectedPaths: [pageId],
  };
}

export function listPages(project: ProjectInternals): Array<{ id: string; title: string; description?: string; groupPath?: string }> {
  return project._getPageNodes().map((n: CompNode) => {
    const boundChildren = project._pageBoundChildren(n);
    const groupPath = boundChildren[0]?.bind;
    return {
      id: n.nodeId!,
      title: n.title ?? 'Untitled',
      ...(n.description ? { description: n.description } : {}),
      ...(groupPath ? { groupPath } : {}),
    };
  });
}

export function updatePage(project: ProjectInternals, pageId: string, changes: { title?: string; description?: string }): HelperResult {
  const commands: AnyCommand[] = [];
  for (const [prop, val] of Object.entries(changes)) {
    if (val !== undefined) {
      commands.push({
        type: 'component.setNodeProperty',
        payload: { node: { nodeId: pageId }, property: prop, value: val },
      });
    }
  }
  if (commands.length > 0) project.core.dispatch(commands);

  return {
    summary: `Updated page '${pageId}'`,
    action: { helper: 'updatePage', params: { pageId, ...changes } },
    affectedPaths: [pageId],
  };
}

export function placeOnPage(project: ProjectInternals, target: string, pageId: string, options?: PlacementOptions): HelperResult {
  const sourceRef = project._nodeRefForItem(target);
  project._ensureComponentNodeExistsForMove(sourceRef);
  const commands: AnyCommand[] = [{
    type: 'component.moveNode',
    payload: {
      source: sourceRef,
      targetParent: { nodeId: pageId },
    },
  }];
  if (options?.span !== undefined) {
    commands.push({
      type: 'component.setNodeProperty',
      payload: { node: sourceRef, property: 'span', value: options.span },
    });
  }

  project.core.dispatch(commands);

  return {
    summary: `Placed '${target}' on page '${pageId}'`,
    action: { helper: 'placeOnPage', params: { target, pageId } },
    affectedPaths: [target],
  };
}

export function unplaceFromPage(project: ProjectInternals, target: string, pageId: string): HelperResult {
  const sourceRef = project._nodeRefForItem(target);
  project._ensureComponentNodeExistsForMove(sourceRef);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: sourceRef,
      targetParent: { nodeId: 'root' },
    },
  });

  return {
    summary: `Removed '${target}' from page '${pageId}'`,
    action: { helper: 'unplaceFromPage', params: { target, pageId } },
    affectedPaths: [target],
  };
}

export function setFlow(project: ProjectInternals, mode: 'single' | 'wizard' | 'tabs', props?: FlowProps): HelperResult {
  const commands: AnyCommand[] = [
    { type: 'definition.setFormPresentation', payload: { property: 'pageMode', value: mode } },
  ];

  if (props?.showProgress !== undefined) {
    commands.push({
      type: 'definition.setFormPresentation',
      payload: { property: 'showProgress', value: props.showProgress },
    });
  }
  if (props?.allowSkip !== undefined) {
    commands.push({
      type: 'definition.setFormPresentation',
      payload: { property: 'allowSkip', value: props.allowSkip },
    });
  }

  project.core.dispatch(commands);

  return {
    summary: `Set flow mode to '${mode}'`,
    action: { helper: 'setFlow', params: { mode, ...props } },
    affectedPaths: [],
  };
}

export function setGroupRef(project: ProjectInternals, path: string, ref: string | null, keyPrefix?: string): HelperResult {
  project.core.dispatch({
    type: 'definition.setGroupRef',
    payload: { path, ref, ...(keyPrefix !== undefined ? { keyPrefix } : {}) },
  } as AnyCommand);
  return {
    summary: ref === null
      ? `Cleared group ref on '${path}'`
      : `Set group ref on '${path}'`,
    action: { helper: 'setGroupRef', params: { path, ref, keyPrefix } },
    affectedPaths: [path],
  };
}

export function setComponentWhen(project: ProjectInternals, target: string, when: string | null): HelperResult {
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: {
      node: componentTargetRef(target),
      property: 'when',
      value: when && when.trim() ? when.trim() : null,
    },
  });

  return {
    summary: when && when.trim()
      ? `Set visual condition on '${target}'`
      : `Cleared visual condition on '${target}'`,
    action: { helper: 'setComponentWhen', params: { target, when } },
    affectedPaths: [target],
  };
}

export function setComponentAccessibility(project: ProjectInternals, target: string, property: string, value: unknown): HelperResult {
  project.core.dispatch({
    type: 'component.setNodeAccessibility',
    payload: {
      node: componentTargetRef(target),
      property,
      value: value === '' ? null : value,
    },
  });

  return {
    summary: value === '' || value === null
      ? `Cleared accessibility '${property}' on '${target}'`
      : `Set accessibility '${property}' on '${target}'`,
    action: { helper: 'setComponentAccessibility', params: { target, property, value } },
    affectedPaths: [target],
  };
}

export function setLayoutNodeProp(project: ProjectInternals, target: string, property: string, value: unknown): HelperResult {
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: {
      node: componentTargetRef(target),
      property,
      value: value === '' ? null : value,
    },
  });
  return {
    summary: `Set '${property}' on '${target}'`,
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

export function addItemToLayout(project: ProjectInternals, spec: LayoutAddItemSpec, pageId?: string): HelperResult {
  if (spec.itemType === 'layout') {
    const parentNodeId = pageId ?? 'root';
    return project.addLayoutNode(parentNodeId, spec.component ?? 'Card');
  }

  const pageGroupPath = pageId ? project._resolvePageGroup(pageId) : undefined;
  const parentPath = pageGroupPath;
  const key = project._uniqueLayoutItemKey(spec.label, parentPath, spec.key);
  const fullPath = parentPath ? `${parentPath}.${key}` : key;

  if (spec.itemType === 'field') {
    const typeArg = spec.registryDataType ?? spec.dataType ?? 'string';
    const addResult = project.addField(key, spec.label, typeArg, {
      ...(parentPath ? { parentPath } : {}),
    });
    const leafKey = addResult.affectedPaths[0] ?? fullPath;
    if (pageId && !pageGroupPath) {
      project.placeOnPage(leafKey, pageId);
    }
    return {
      summary: addResult.summary,
      action: { helper: 'addItemToLayout', params: { spec, pageId } },
      affectedPaths: addResult.affectedPaths,
      createdId: leafKey,
    };
  }

  if (spec.itemType === 'group') {
    const phase1: AnyCommand[] = [
      {
        type: 'definition.addItem',
        payload: {
          type: 'group',
          key,
          label: spec.label,
          ...(parentPath ? { parentPath } : {}),
          ...(spec.repeatable ? { repeatable: true } : {}),
        },
      },
    ];
    const phase2: AnyCommand[] = pageId
      ? [{
          type: 'component.moveNode',
          payload: {
            source: { bind: key },
            targetParent: { nodeId: pageId },
          },
        }]
      : [];

    if (phase2.length > 0) project.core.batchWithRebuild(phase1, phase2);
    else project.core.dispatch(phase1[0]);

    return {
      summary: `Added group '${spec.label}' to layout`,
      action: { helper: 'addItemToLayout', params: { spec, pageId } },
      affectedPaths: [fullPath],
      createdId: fullPath,
    };
  }

  const LAYOUT_DISPLAY_COMPONENTS = new Set(['Heading', 'Divider']);
  if (spec.component && LAYOUT_DISPLAY_COMPONENTS.has(spec.component)) {
    const parentNodeId = pageId ?? 'root';
    const props: Record<string, unknown> = spec.component === 'Heading'
      ? { text: spec.label, level: 2 }
      : { label: spec.label }; 
    const result = project.core.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: parentNodeId }, component: spec.component, props },
    } as AnyCommand);
    const nodeId = result?.nodeRef?.nodeId;
    return {
      summary: `Added ${spec.component} '${spec.label}' to layout`,
      action: { helper: 'addItemToLayout', params: { spec, pageId } },
      affectedPaths: nodeId ? [nodeId] : [],
      createdId: nodeId,
    };
  }

  const payload: Record<string, unknown> = {
    type: 'display',
    key,
    label: spec.label,
  };
  if (parentPath) payload.parentPath = parentPath;
  if (spec.presentation) payload.presentation = spec.presentation;
  project.core.dispatch({ type: 'definition.addItem', payload });

  if (pageId && !pageGroupPath) {
    project.placeOnPage(key, pageId);
  }

  return {
    summary: `Added display item '${spec.label}' to layout`,
    action: { helper: 'addItemToLayout', params: { spec, pageId } },
    affectedPaths: [fullPath],
    createdId: fullPath,
  };
}

export function applyLayout(project: ProjectInternals, targets: string | string[], arrangement: LayoutArrangement): HelperResult {
  const targetArray = Array.isArray(targets) ? targets : [targets];
  const layout = _LAYOUT_MAP[arrangement];

  const tree = project.core.state.component?.tree as CompNode | undefined;
  let parentRef: { nodeId: string } | { bind: string } = { nodeId: 'root' };
  if (tree) {
    const targetRefs = targetArray.map(t => ({ bind: t.split('.').pop()! }));
    const parentRefs = targetRefs
      .map(ref => findParentRefOfNodeRef(tree, ref))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (parentRefs.length > 0 && parentRefs.every(r => JSON.stringify(r) === JSON.stringify(parentRefs[0]))) {
      parentRef = parentRefs[0];
    }
  }

  const addPayload: Record<string, unknown> = {
    parent: parentRef,
    component: layout.component,
  };
  if (layout.props) addPayload.props = layout.props;

  project.core.dispatch({ type: 'component.addNode', payload: addPayload });

  const updatedTree = project.core.state.component?.tree as CompNode | undefined;
  const parentNode = 'nodeId' in parentRef
    ? findComponentNodeById(updatedTree, parentRef.nodeId)
    : findComponentNodeByRef(updatedTree, parentRef);
  const parentChildren = parentNode?.children ?? [];
  const lastChild = parentChildren[parentChildren.length - 1];
  const containerRef = lastChild?.nodeId
    ? { nodeId: lastChild.nodeId }
    : lastChild?.bind
      ? { bind: lastChild.bind }
      : { nodeId: 'root' };

  const moveCommands: AnyCommand[] = targetArray.map((t, i) => ({
    type: 'component.moveNode' as const,
    payload: {
      source: { bind: t.split('.').pop()! },
      targetParent: containerRef,
      targetIndex: i,
    },
  }));

  if (moveCommands.length > 0) {
    project.core.dispatch(moveCommands);
  }

  const pathList = targetArray.length <= 3
    ? targetArray.join(', ')
    : `${targetArray.slice(0, 3).join(', ')} and ${targetArray.length - 3} more`;

  return {
    summary: `Applied ${arrangement} layout to ${pathList} (${targetArray.length} item${targetArray.length !== 1 ? 's' : ''})`,
    action: { helper: 'applyLayout', params: { targets: targetArray, arrangement } },
    affectedPaths: targetArray,
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
  } as AnyCommand);
  return {
    summary: `Added region to page '${pageId}'`,
    action: { helper: 'addRegion', params: { pageId, span } },
    affectedPaths: [pageId],
  };
}

export function updateRegion(project: ProjectInternals, pageId: string, regionIndex: number, property: string, value: unknown): HelperResult {
  const page = project._findPageNode(pageId);
  const child = project._pageBoundChildren(page)[regionIndex];
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
  const page = project._findPageNode(pageId);
  const child = project._pageBoundChildren(page)[regionIndex];
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
  const page = project._findPageNode(pageId);
  const child = project._pageBoundChildren(page)[regionIndex];
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
  const page = project._findPageNode(pageId);
  const boundChildren = project._pageBoundChildren(page);
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

export function renamePage(project: ProjectInternals, pageId: string, newTitle: string): HelperResult {
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: { node: { nodeId: pageId }, property: 'title', value: newTitle },
  });
  return {
    summary: `Renamed page '${pageId}' to '${newTitle}'`,
    action: { helper: 'renamePage', params: { pageId, newTitle } },
    affectedPaths: [pageId],
  };
}

export function setItemWidth(project: ProjectInternals, pageId: string, itemKey: string, width: number): HelperResult {
  const page = project._findPageNode(pageId);
  const node = project._pageBoundChildren(page).find((n: CompNode) => n.bind === itemKey);
  if (!node) throw new HelperError('ITEM_NOT_ON_PAGE', `Item '${itemKey}' is not on page '${pageId}'`, { pageId, itemKey });
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: { node: refForCompNode(node), property: 'span', value: width },
  });
  return {
    summary: `Set width of '${itemKey}' on page '${pageId}' to ${width}`,
    action: { helper: 'setItemWidth', params: { pageId, itemKey, width } },
    affectedPaths: [pageId],
  };
}

export function setItemOffset(project: ProjectInternals, pageId: string, itemKey: string, offset: number | undefined): HelperResult {
  const page = project._findPageNode(pageId);
  const node = project._pageBoundChildren(page).find((n: CompNode) => n.bind === itemKey);
  if (!node) throw new HelperError('ITEM_NOT_ON_PAGE', `Item '${itemKey}' is not on page '${pageId}'`, { pageId, itemKey });
  project.core.dispatch({
    type: 'component.setNodeProperty',
    payload: { node: refForCompNode(node), property: 'start', value: offset ?? null },
  });
  return {
    summary: `Set offset of '${itemKey}' on page '${pageId}' to ${offset ?? 'auto'}`,
    action: { helper: 'setItemOffset', params: { pageId, itemKey, offset } },
    affectedPaths: [pageId],
  };
}

export function setItemResponsive(
  project: ProjectInternals,
  pageId: string,
  itemKey: string,
  breakpoint: string,
  overrides: { width?: number; offset?: number; hidden?: boolean } | undefined,
): HelperResult {
  project._regionIndexOf(pageId, itemKey);
  const page = project._findPageNode(pageId);
  const boundChildren = project._pageBoundChildren(page);
  const node = boundChildren.find((n: CompNode) => n.bind === itemKey)!;

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
    affectedPaths: [pageId],
  };
}

export function removeItemFromPage(project: ProjectInternals, pageId: string, itemKey: string): HelperResult {
  project._regionIndexOf(pageId, itemKey);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: { bind: itemKey },
      targetParent: { nodeId: 'root' },
    },
  });
  return {
    summary: `Removed '${itemKey}' from page '${pageId}'`,
    action: { helper: 'removeItemFromPage', params: { pageId, itemKey } },
    affectedPaths: [pageId],
  };
}

export function moveItemToPage(project: ProjectInternals, sourcePageId: string, itemKey: string, targetPageId: string, opts?: PlacementOptions): HelperResult {
  project._regionIndexOf(sourcePageId, itemKey);
  const leafKey = itemKey.split('.').pop()!;
  const commands: AnyCommand[] = [{
    type: 'component.moveNode',
    payload: {
      source: { bind: leafKey },
      targetParent: { nodeId: targetPageId },
    },
  }];
  if (opts?.span !== undefined) {
    commands.push({
      type: 'component.setNodeProperty',
      payload: { node: { bind: leafKey }, property: 'span', value: opts.span },
    });
  }
  project.core.batch(commands);
  return {
    summary: `Moved '${itemKey}' from page '${sourcePageId}' to page '${targetPageId}'`,
    action: { helper: 'moveItemToPage', params: { sourcePageId, itemKey, targetPageId } },
    affectedPaths: [sourcePageId, targetPageId],
  };
}

export function reorderItemOnPage(project: ProjectInternals, pageId: string, itemKey: string, direction: 'up' | 'down'): HelperResult {
  const currentIndex = project._regionIndexOf(pageId, itemKey);
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
    summary: `Reordered '${itemKey}' ${direction} on page '${pageId}'`,
    action: { helper: 'reorderItemOnPage', params: { pageId, itemKey, direction } },
    affectedPaths: [pageId],
  };
}

export function moveItemOnPageToIndex(project: ProjectInternals, pageId: string, itemKey: string, targetIndex: number): HelperResult {
  if (targetIndex < 0) {
    throw new HelperError('ROUTE_OUT_OF_BOUNDS', `targetIndex must be non-negative, got ${targetIndex}`);
  }
  project._regionIndexOf(pageId, itemKey);
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: { bind: itemKey },
      targetParent: { nodeId: pageId },
      targetIndex,
    },
  });
  return {
    summary: `Moved '${itemKey}' to index ${targetIndex} on page '${pageId}'`,
    action: { helper: 'moveItemOnPageToIndex', params: { pageId, itemKey, targetIndex } },
    affectedPaths: [pageId],
  };
}
