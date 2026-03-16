/**
 * Style tool (consolidated, replaces presentation.ts):
 *   action: 'layout' | 'style' | 'style_all'
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { LayoutArrangement } from 'formspec-studio-core';

type StyleAction = 'layout' | 'style' | 'style_all';

interface StyleParams {
  action: StyleAction;
  // For layout
  target?: string | string[];
  arrangement?: LayoutArrangement;
  // For style
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
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'layout':
        return project.applyLayout(params.target!, params.arrangement!);
      case 'style':
        return project.applyStyle(params.path!, params.properties!);
      case 'style_all': {
        // Build target union from flat params
        let target: 'form' | { type: 'group' | 'field' | 'display' } | { dataType: string } = 'form';
        if (params.target_type) {
          target = { type: params.target_type as 'group' | 'field' | 'display' };
        } else if (params.target_data_type) {
          target = { dataType: params.target_data_type };
        }
        return project.applyStyleAll(target, params.properties!);
      }
    }
  });
}
