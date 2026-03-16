/**
 * Flow tool (consolidated):
 *   action: 'set_mode' | 'branch'
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { BranchPath, FlowProps } from 'formspec-studio-core';

type FlowAction = 'set_mode' | 'branch';

interface FlowParams {
  action: FlowAction;
  // For set_mode
  mode?: 'single' | 'wizard' | 'tabs';
  props?: FlowProps;
  // For branch
  on?: string;
  paths?: BranchPath[];
  otherwise?: string | string[];
}

export function handleFlow(
  registry: ProjectRegistry,
  projectId: string,
  params: FlowParams,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'set_mode':
        return project.setFlow(params.mode!, params.props);
      case 'branch':
        return project.branch(params.on!, params.paths!, params.otherwise);
    }
  });
}
