/**
 * Style tool (consolidated, replaces presentation.ts):
 *   action: 'layout' | 'style' | 'style_all'
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall, errorResponse, formatToolError } from '../errors.js';
import type { LayoutArrangement } from 'formspec-studio-core';

type StyleAction = 'layout' | 'style' | 'style_all';

interface StyleParams {
  action: StyleAction;
  // For layout
  target?: string | string[];
  arrangement?: LayoutArrangement;
  // For style / layout fallback
  path?: string;
  properties?: Record<string, unknown>;
  // For style_all
  target_type?: string;
  target_data_type?: string;
}

export function handleStyle(
  registry: ProjectRegistry,
  projectId: string,
  params: StyleParams,
) {
  if (params.action === 'layout') {
    const layoutTarget = params.target ?? params.path;
    if (!layoutTarget) {
      return errorResponse(formatToolError(
        'MISSING_PARAM',
        'layout action requires "target" or "path" parameter',
      ));
    }
    return wrapHelperCall(() => {
      const project = registry.getProject(projectId);
      return project.applyLayout(layoutTarget, params.arrangement!);
    });
  }

  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);

    if (params.action === 'style') {
      return project.applyStyle(params.path!, params.properties!);
    }
    // style_all
    let target: 'form' | { type: 'group' | 'field' | 'display' } | { dataType: string } = 'form';
    if (params.target_type) {
      target = { type: params.target_type as 'group' | 'field' | 'display' };
    } else if (params.target_data_type) {
      target = { dataType: params.target_data_type };
    }
    return project.applyStyleAll(target, params.properties!);
  });
}
