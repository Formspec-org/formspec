/**
 * Screener tools: enable/disable screener, screen fields, screen routes.
 *
 * These manage the pre-form screening logic that determines
 * eligibility before the main form is presented.
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { FieldProps } from 'formspec-studio-core';

export function handleScreener(
  registry: ProjectRegistry,
  projectId: string,
  enabled: boolean,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.setScreener(enabled);
  });
}

export function handleScreenField(
  registry: ProjectRegistry,
  projectId: string,
  key: string,
  label: string,
  type: string,
  props?: FieldProps,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addScreenField(key, label, type, props);
  });
}

export function handleRemoveScreenField(
  registry: ProjectRegistry,
  projectId: string,
  key: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.removeScreenField(key);
  });
}

export function handleScreenRoute(
  registry: ProjectRegistry,
  projectId: string,
  condition: string,
  target: string,
  label?: string,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.addScreenRoute(condition, target, label);
  });
}

export function handleUpdateScreenRoute(
  registry: ProjectRegistry,
  projectId: string,
  routeIndex: number,
  changes: { condition?: string; target?: string; label?: string },
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.updateScreenRoute(routeIndex, changes);
  });
}

export function handleReorderScreenRoute(
  registry: ProjectRegistry,
  projectId: string,
  routeIndex: number,
  direction: 'up' | 'down',
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.reorderScreenRoute(routeIndex, direction);
  });
}

export function handleRemoveScreenRoute(
  registry: ProjectRegistry,
  projectId: string,
  routeIndex: number,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.removeScreenRoute(routeIndex);
  });
}
