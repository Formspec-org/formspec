/**
 * Screener tool (consolidated):
 *   action: 'enable' | 'add_field' | 'remove_field' | 'add_route' | 'update_route' | 'reorder_route' | 'remove_route'
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { FieldProps } from 'formspec-studio-core';

type ScreenerAction = 'enable' | 'add_field' | 'remove_field' | 'add_route' | 'update_route' | 'reorder_route' | 'remove_route';

interface ScreenerParams {
  action: ScreenerAction;
  enabled?: boolean;
  key?: string;
  label?: string;
  type?: string;
  props?: FieldProps;
  condition?: string;
  target?: string;
  route_index?: number;
  changes?: { condition?: string; target?: string; label?: string };
  direction?: 'up' | 'down';
}

export function handleScreener(
  registry: ProjectRegistry,
  projectId: string,
  params: ScreenerParams,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'enable':
        return project.setScreener(params.enabled!);
      case 'add_field':
        return project.addScreenField(params.key!, params.label!, params.type!, params.props);
      case 'remove_field':
        return project.removeScreenField(params.key!);
      case 'add_route':
        return project.addScreenRoute(params.condition!, params.target!, params.label);
      case 'update_route':
        return project.updateScreenRoute(params.route_index!, params.changes!);
      case 'reorder_route':
        return project.reorderScreenRoute(params.route_index!, params.direction!);
      case 'remove_route':
        return project.removeScreenRoute(params.route_index!);
    }
  });
}
