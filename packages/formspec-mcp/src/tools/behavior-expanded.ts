/** @filedesc MCP tool for expanded behavior: set_bind_property, set_shape_composition, update_validation. */
import type { ProjectRegistry } from '../registry.js';
import type { Project } from 'formspec-studio-core';
import { successResponse, errorResponse, formatToolError, wrapHelperCall } from '../errors.js';
import { HelperError } from 'formspec-studio-core';

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

/** Raw dispatch through the private core field. */
function dispatch(project: Project, command: { type: string; payload: Record<string, unknown> } | Array<{ type: string; payload: Record<string, unknown> }>) {
  (project as any).core.dispatch(command);
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
        dispatch(project, {
          type: 'definition.setBind',
          payload: {
            path: params.target,
            properties: { [params.property!]: params.value },
          },
        });

        return successResponse({
          summary: `Set bind property '${params.property}' on '${params.target}'`,
          affectedPaths: [params.target],
        });
      }

      case 'set_shape_composition': {
        // Create multiple shapes under a composition grouping
        // The composition type indicates how child constraints combine
        const rules = params.rules ?? [];
        const composition = params.composition ?? 'and';

        // Add a composite shape: first shape gets the composition type,
        // subsequent shapes are linked by sharing the same target + composition
        const commands: Array<{ type: string; payload: Record<string, unknown> }> = [];
        for (const rule of rules) {
          commands.push({
            type: 'definition.addShape',
            payload: {
              target: params.target,
              constraint: rule.constraint,
              message: rule.message,
              composition,
            },
          });
        }

        if (commands.length > 0) {
          dispatch(project, commands);
        }

        const shapes = (project.definition as any).shapes ?? [];
        const createdIds = shapes.slice(-rules.length).map((s: any) => s.id);

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
