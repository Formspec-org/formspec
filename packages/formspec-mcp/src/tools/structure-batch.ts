/** @filedesc Structure batch tool: wrap_group, batch_delete, batch_duplicate. */

import { HelperError } from 'formspec-studio-core';
import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall, errorResponse, formatToolError } from '../errors.js';

export function handleStructureBatch(
  registry: ProjectRegistry,
  projectId: string,
  params: { action: string; paths: string[]; groupPath?: string; groupLabel?: string },
) {
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    switch (params.action) {
      case 'wrap_group':
        return project.wrapItemsInGroup(params.paths, params.groupPath!, params.groupLabel!);
      case 'batch_delete':
        return project.batchDeleteItems(params.paths);
      case 'batch_duplicate':
        return project.batchDuplicateItems(params.paths);
      default:
        throw new HelperError('INVALID_ACTION', `Unknown structure batch action: ${params.action}`);
    }
  });
}
