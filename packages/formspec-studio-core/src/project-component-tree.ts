/** @filedesc Component-tree authoring commands (layout nodes, submit button, batch moves). */
import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult } from './helper-types.js';
import type { ProjectInternals } from './project-internals.js';

/** Move a component tree node to a new parent/position. */
export function moveLayoutNode(
  project: ProjectInternals,
  sourceNodeId: string,
  targetParentNodeId: string,
  targetIndex: number,
): HelperResult {
  project.core.dispatch({
    type: 'component.moveNode',
    payload: {
      source: { nodeId: sourceNodeId },
      targetParent: { nodeId: targetParentNodeId },
      targetIndex,
    },
  });
  return {
    summary: `Moved layout node ${sourceNodeId}`,
    action: { helper: 'moveLayoutNode', params: { sourceNodeId, targetParentNodeId, targetIndex } },
    affectedPaths: [sourceNodeId],
  };
}

/** Batch-move multiple definition items atomically (e.g. multi-select DnD). */
export function moveItems(
  project: ProjectInternals,
  moves: Array<{ sourcePath: string; targetParentPath?: string; targetIndex: number }>,
): HelperResult {
  const commands: Array<{ type: 'definition.moveItem'; payload: { sourcePath: string; targetParentPath?: string; targetIndex: number } }> = moves.map(m => ({
    type: 'definition.moveItem' as const,
    payload: {
      sourcePath: m.sourcePath,
      ...(m.targetParentPath != null ? { targetParentPath: m.targetParentPath } : {}),
      targetIndex: m.targetIndex,
    },
  }));
  project.core.batch(commands);
  return {
    summary: `Moved ${moves.length} items`,
    action: { helper: 'moveItems', params: { moves } },
    affectedPaths: moves.map(m => m.sourcePath),
  };
}

/**
 * Set definition-level `extensions` in one undoable command (`definition.setDefinitionProperty`).
 * Caller supplies the full merged map, or `null` to remove the property.
 */
export function setDefinitionExtensions(project: ProjectInternals, extensions: Record<string, unknown> | null): void {
  project.core.dispatch({
    type: 'definition.setDefinitionProperty',
    payload: { property: 'extensions', value: extensions },
  });
}

/** Add a component-tree node under an arbitrary parent ref. */
export function addComponentNode(
  project: ProjectInternals,
  parent: { bind?: string; nodeId?: string },
  component: string,
  options?: { bind?: string; props?: Record<string, unknown>; insertIndex?: number },
): HelperResult & { nodeRef?: { bind?: string; nodeId?: string } } {
  const result = project.core.dispatch({
    type: 'component.addNode',
    payload: {
      parent,
      component,
      ...(options?.bind !== undefined ? { bind: options.bind } : {}),
      ...(options?.props !== undefined ? { props: options.props } : {}),
      ...(options?.insertIndex !== undefined ? { insertIndex: options.insertIndex } : {}),
    },
  });
  const nodeRef = result?.nodeRef;
  const createdId = nodeRef?.nodeId ?? nodeRef?.bind;
  return {
    summary: `Added component node '${component}'`,
    action: { helper: 'addComponentNode', params: { parent, component, options } },
    affectedPaths: createdId ? [createdId] : [],
    createdId,
    nodeRef,
  };
}

/** Add a layout-only node to the component tree. */
export function addLayoutNode(project: ProjectInternals, parentNodeId: string, component: string): HelperResult {
  const result = project.core.dispatch({
    type: 'component.addNode',
    payload: { parent: { nodeId: parentNodeId }, component },
  });
  const nodeId = result?.nodeRef?.nodeId;
  return {
    summary: `Added layout node '${component}' under '${parentNodeId}'`,
    action: { helper: 'addLayoutNode', params: { parentNodeId, component } },
    affectedPaths: nodeId ? [nodeId] : [],
    createdId: nodeId,
  };
}

/** Unwrap a layout container, promoting its children. */
export function unwrapLayoutNode(project: ProjectInternals, nodeId: string): HelperResult {
  project.core.dispatch({
    type: 'component.unwrapNode',
    payload: { node: { nodeId } },
  });
  return {
    summary: `Unwrapped layout node '${nodeId}'`,
    action: { helper: 'unwrapLayoutNode', params: { nodeId } },
    affectedPaths: [nodeId],
  };
}

/** Delete a layout node from the component tree. */
export function deleteLayoutNode(project: ProjectInternals, nodeId: string): HelperResult {
  project.core.dispatch({
    type: 'component.deleteNode',
    payload: { node: { nodeId } },
  });
  return {
    summary: `Deleted layout node '${nodeId}'`,
    action: { helper: 'deleteLayoutNode', params: { nodeId } },
    affectedPaths: [nodeId],
  };
}

/** Wrap a component node (by bind or nodeId ref) in any layout component. */
export function wrapComponentNode(
  project: ProjectInternals,
  ref: { bind: string } | { nodeId: string },
  component: string,
): HelperResult {
  const result = project.core.dispatch({
    type: 'component.wrapNode',
    payload: { node: ref, wrapper: { component } },
  });
  const nodeId = result?.nodeRef?.nodeId;
  return {
    summary: `Wrapped node in ${component}`,
    action: { helper: 'wrapComponentNode', params: { ref, component } },
    affectedPaths: nodeId ? [nodeId] : [],
    createdId: nodeId,
  };
}

/** Wrap multiple sibling nodes in one layout container (same parent, visual order preserved). */
export function wrapSiblingComponentNodes(
  project: ProjectInternals,
  refs: Array<{ bind: string } | { nodeId: string }>,
  component: string,
): HelperResult {
  const result = project.core.dispatch({
    type: 'component.wrapSiblingNodes',
    payload: { nodes: refs, wrapper: { component } },
  });
  const nodeId = result?.nodeRef?.nodeId;
  return {
    summary: `Wrapped ${refs.length} sibling nodes in ${component}`,
    action: { helper: 'wrapSiblingComponentNodes', params: { refs, component } },
    affectedPaths: nodeId ? [nodeId] : [],
    createdId: nodeId,
  };
}

/** Reorder a component node (by bind or nodeId ref) up or down. */
export function reorderComponentNode(
  project: ProjectInternals,
  ref: { bind?: string; nodeId?: string },
  direction: 'up' | 'down',
): HelperResult {
  project.core.dispatch({
    type: 'component.reorderNode',
    payload: { node: ref, direction },
  });
  return {
    summary: `Reordered node ${direction}`,
    action: { helper: 'reorderComponentNode', params: { ref, direction } },
    affectedPaths: [],
  };
}

/** Move a component node (by bind or nodeId ref) as the last child of a target container. */
export function moveComponentNodeToContainer(
  project: ProjectInternals,
  ref: { bind?: string; nodeId?: string },
  targetParent: { bind?: string; nodeId?: string },
): HelperResult {
  project.core.dispatch({
    type: 'component.moveNode',
    payload: { source: ref, targetParent },
  });
  const id = 'bind' in ref && ref.bind ? ref.bind : ref.nodeId;
  const targetKey = targetParent.nodeId ?? targetParent.bind ?? '';
  return {
    summary: `Moved node '${id}' into container '${targetKey}'`,
    action: { helper: 'moveComponentNodeToContainer', params: { ref, targetParent } },
    affectedPaths: targetKey ? [targetKey] : [],
  };
}

/** Move a component node (by bind or nodeId ref) to a specific index within a target container. */
export function moveComponentNodeToIndex(
  project: ProjectInternals,
  ref: { bind?: string; nodeId?: string },
  targetParent: { bind?: string; nodeId?: string },
  insertIndex: number,
): HelperResult {
  project.core.dispatch({
    type: 'component.moveNode',
    payload: { source: ref, targetParent, targetIndex: insertIndex },
  });
  const id = 'bind' in ref && ref.bind ? ref.bind : ref.nodeId;
  const targetKey = targetParent.nodeId ?? targetParent.bind ?? '';
  return {
    summary: `Moved node '${id}' to index ${insertIndex} in container '${targetKey}'`,
    action: { helper: 'moveComponentNodeToIndex', params: { ref, targetParent, insertIndex } },
    affectedPaths: targetKey ? [targetKey] : [],
  };
}

/** Delete a component node by bind or nodeId ref. */
export function deleteComponentNode(project: ProjectInternals, ref: { bind?: string; nodeId?: string }): HelperResult {
  project.core.dispatch({
    type: 'component.deleteNode',
    payload: { node: ref },
  });
  const id = 'bind' in ref && ref.bind ? ref.bind : ref.nodeId;
  return {
    summary: `Deleted component node '${id}'`,
    action: { helper: 'deleteComponentNode', params: { ref } },
    affectedPaths: id ? [id] : [],
  };
}

/** Add a submit button. */
export function addSubmitButton(project: ProjectInternals, label?: string, pageId?: string): HelperResult {
  const addNodeCmd: AnyCommand = {
    type: 'component.addNode',
    payload: {
      parent: { nodeId: 'root' },
      component: 'SubmitButton',
      props: { label: label ?? 'Submit' },
    },
  };

  if (pageId) {
    const addResult = project.core.dispatch(addNodeCmd);
    const nodeId = addResult?.nodeRef?.nodeId;
    if (nodeId) {
      project.core.dispatch({
        type: 'component.moveNode',
        payload: {
          source: { nodeId },
          targetParent: { nodeId: pageId },
        },
      });
    }
    return {
      summary: `Added submit button`,
      action: { helper: 'addSubmitButton', params: { label, pageId } },
      affectedPaths: nodeId ? [nodeId] : [],
      createdId: nodeId,
    };
  }

  const result = project.core.dispatch(addNodeCmd);
  const nodeId = result?.nodeRef?.nodeId;

  return {
    summary: `Added submit button`,
    action: { helper: 'addSubmitButton', params: { label, pageId } },
    affectedPaths: nodeId ? [nodeId] : [],
    createdId: nodeId,
  };
}
