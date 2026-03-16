/**
 * Presentation tools: layout, style, styleAll.
 *
 * These manage visual arrangement and styling of form items.
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { LayoutArrangement } from 'formspec-studio-core';

export function handleLayout(
  registry: ProjectRegistry,
  projectId: string,
  targets: string | string[],
  arrangement: LayoutArrangement,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.applyLayout(targets, arrangement);
  });
}

export function handleStyle(
  registry: ProjectRegistry,
  projectId: string,
  path: string,
  properties: Record<string, unknown>,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.applyStyle(path, properties);
  });
}

export function handleStyleAll(
  registry: ProjectRegistry,
  projectId: string,
  properties: Record<string, unknown>,
  target: 'form' | { type: 'group' | 'field' | 'display' } | { dataType: string },
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return project.applyStyleAll(target, properties);
  });
}
