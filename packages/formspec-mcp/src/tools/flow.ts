/**
 * Flow tools: flow mode, branching, move, rename.
 *
 * These manage form navigation and item organization.
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { BranchPath, FlowProps } from 'formspec-studio-core';

export function handleFlow(
  registry: ProjectRegistry,
  projectId: string,
  mode: 'single' | 'wizard' | 'tabs',
  props?: FlowProps,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.setFlow(mode, props);
  });
}

export function handleBranch(
  registry: ProjectRegistry,
  projectId: string,
  on: string,
  paths: BranchPath[],
  otherwise?: string | string[],
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.branch(on, paths, otherwise);
  });
}

export function handleMove(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
  targetParentPath?: string,
  targetIndex?: number,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.moveItem(path, targetParentPath, targetIndex);
  });
}

export function handleRename(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
  newKey: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.renameItem(path, newKey);
  });
}
