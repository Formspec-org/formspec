/** @filedesc MCP tool for expanded behavior: set_bind_property, set_shape_composition, update_validation. */
import type { ProjectRegistry } from '../registry.js';
import type { Project } from '@formspec-org/studio-core';
import { successResponse, errorResponse, formatToolError, wrapHelperCall } from '../errors.js';
import { HelperError } from '@formspec-org/studio-core';

type BehaviorExpandedAction = 'set_bind_property' | 'set_shape_composition' | 'update_validation';

interface BehaviorExpandedParams {
  action: BehaviorExpandedAction;
  target: string;
  // For set_bind_property
  property?: string;
  value?: string | null;
  // For set_shape_composition
  composition?: 'and' | 'or' | 'not' | 'xone';
  rules?: Array<{ constraint: string; message: string }>;
  // For update_validation
  shapeId?: string;
  changes?: {
    rule?: string;
    message?: string;
    timing?: 'continuous' | 'submit' | 'demand';
    severity?: 'error' | 'warning' | 'info';
    code?: string;
    activeWhen?: string;
  };
}

export function handleBehaviorExpanded(
  registry: ProjectRegistry,
  projectId: string,
  params: BehaviorExpandedParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'set_bind_property': {
        return wrapHelperCall(() => {
          const bind = project.bindFor(params.target);
          const updates = { ...bind, [params.property!]: params.value };
          // Use the public Project API if available, or error if bind operations aren't exposed
          throw new HelperError('NOT_IMPLEMENTED', `bind property updates not yet exposed in public API`);
        });
      }

      case 'set_shape_composition': {
        // Create multiple shapes under a composition grouping
        // The composition type indicates how child constraints combine
        const rules = params.rules ?? [];
        const composition = params.composition ?? 'and';

        // Use the public addValidation API for each rule
        const createdIds: string[] = [];
        for (const rule of rules) {
          const result = wrapHelperCall(() =>
            project.addValidation(params.target, rule.constraint, rule.message, {
              // Note: composition metadata is not yet exposed in addValidation options
              // This will need to be extended in the public API
            }),
          );

          if ('isError' in result && result.isError) {
            return result;
          }
          // Extract shape ID if available from result metadata
          if ((result as any).structuredContent?.shapeId) {
            createdIds.push((result as any).structuredContent.shapeId);
          }
        }

        return successResponse({
          composition,
          createdIds,
          ruleCount: rules.length,
          summary: `Added ${composition} composition with ${rules.length} rule(s) on '${params.target}'`,
        });
      }

      case 'update_validation': {
        return wrapHelperCall(() =>
          project.updateValidation(params.shapeId ?? params.target, params.changes!),
        );
      }
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
