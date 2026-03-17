/**
 * Behavior tool (consolidated):
 *   action: 'show_when' | 'readonly_when' | 'require' | 'calculate' | 'add_rule'
 *   Batch-enabled via items[] array.
 */

import { HelperError } from 'formspec-studio-core';
import type { Project, ValidationOptions } from 'formspec-studio-core';
import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall, wrapBatchCall, errorResponse, formatToolError } from '../errors.js';
import type { BatchItem } from '../batch.js';

type BehaviorAction = 'show_when' | 'readonly_when' | 'require' | 'calculate' | 'add_rule' | 'remove_rule';

interface BehaviorParams {
  action: BehaviorAction;
  target: string;
  condition?: string;
  expression?: string;
  rule?: string;
  message?: string;
  options?: ValidationOptions;
}

function executeBehavior(project: Project, p: BehaviorParams) {
  switch (p.action) {
    case 'show_when':
      return project.showWhen(p.target, p.condition!);
    case 'readonly_when':
      return project.readonlyWhen(p.target, p.condition!);
    case 'require':
      return project.require(p.target, p.condition);
    case 'calculate':
      return project.calculate(p.target, p.expression!);
    case 'add_rule':
      return project.addValidation(p.target, p.rule!, p.message!, p.options);
    case 'remove_rule':
      return project.removeValidation(p.target);
  }
}

export function handleBehavior(
  registry: ProjectRegistry,
  projectId: string,
  params: BehaviorParams | { items: BatchItem[] },
) {
  if ('items' in params) {
    try {
      const project = registry.getProject(projectId);
      return wrapBatchCall(params.items, (item) => {
        return executeBehavior(project, item as unknown as BehaviorParams);
      });
    } catch (err) {
      if (err instanceof HelperError) {
        return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
      }
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(formatToolError('COMMAND_FAILED', message));
    }
  }
  return wrapHelperCall(() => {
    const project = registry.getProject(projectId);
    return executeBehavior(project, params);
  });
}
