/**
 * Data tool (consolidated):
 *   resource: 'choices' | 'variable' | 'instance'
 *   action: 'add' | 'update' | 'remove' | 'rename'
 */

import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall } from '../errors.js';
import type { ChoiceOption, InstanceProps } from 'formspec-studio-core';

type DataResource = 'choices' | 'variable' | 'instance';
type DataAction = 'add' | 'update' | 'remove' | 'rename';

interface DataParams {
  resource: DataResource;
  action: DataAction;
  name: string;
  // For choices add
  options?: ChoiceOption[];
  // For variable add/update
  expression?: string;
  scope?: string;
  // For instance add/update
  props?: InstanceProps;
  changes?: Partial<InstanceProps>;
  // For rename
  new_name?: string;
}

export function handleData(
  registry: ProjectRegistry,
  projectId: string,
  params: DataParams,
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    const { resource, action, name } = params;

    if (resource === 'choices') {
      if (action !== 'add') {
        throw new Error(`Choices only supports 'add' action, got '${action}'`);
      }
      return project.defineChoices(name, params.options!);
    }

    if (resource === 'variable') {
      switch (action) {
        case 'add': return project.addVariable(name, params.expression!, params.scope);
        case 'update': return project.updateVariable(name, params.expression!);
        case 'remove': return project.removeVariable(name);
        case 'rename': return project.renameVariable(name, params.new_name!);
      }
    }

    if (resource === 'instance') {
      switch (action) {
        case 'add': return project.addInstance(name, params.props!);
        case 'update': return project.updateInstance(name, params.changes!);
        case 'remove': return project.removeInstance(name);
        case 'rename': return project.renameInstance(name, params.new_name!);
      }
    }

    throw new Error(`Unknown resource '${resource}'`);
  });
}
