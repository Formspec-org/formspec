/**
 * Data tools: choices, variables, instances.
 *
 * These manage option sets, computed variables, and external data sources.
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { ChoiceOption, InstanceProps } from 'formspec-studio-core';

export function handleDefineChoices(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
  options: ChoiceOption[],
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.defineChoices(name, options);
  });
}

export function handleVariable(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
  expression: string,
  scope?: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addVariable(name, expression, scope);
  });
}

export function handleUpdateVariable(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
  expression: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.updateVariable(name, expression);
  });
}

export function handleRemoveVariable(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.removeVariable(name);
  });
}

export function handleRenameVariable(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
  newName: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.renameVariable(name, newName);
  });
}

export function handleInstance(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
  props: InstanceProps,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addInstance(name, props);
  });
}

export function handleUpdateInstance(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
  changes: Partial<InstanceProps>,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.updateInstance(name, changes);
  });
}

export function handleRenameInstance(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
  newName: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.renameInstance(name, newName);
  });
}

export function handleRemoveInstance(
  registry: ProjectRegistry,
  projectId: string,
  name: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.removeInstance(name);
  });
}
