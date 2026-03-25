/** @filedesc MCP tool for migration rule CRUD: add_rule, remove_rule, list_rules. */
import type { ProjectRegistry } from '../registry.js';
import type { Project } from 'formspec-studio-core';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';

type MigrationAction = 'add_rule' | 'remove_rule' | 'list_rules';

interface MigrationParams {
  action: MigrationAction;
  fromVersion?: string;
  description?: string;
  // For add_rule
  source?: string;
  target?: string | null;
  transform?: string;
  expression?: string;
  insertIndex?: number;
  // For remove_rule
  ruleIndex?: number;
}

/** Raw dispatch through the private core field. */
function dispatch(project: Project, type: string, payload: Record<string, unknown>) {
  (project as any).core.dispatch({ type, payload });
}

export function handleMigration(
  registry: ProjectRegistry,
  projectId: string,
  params: MigrationParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'add_rule': {
        const fromVersion = params.fromVersion!;
        const migrations = (project.definition as any).migrations;

        // Ensure migration descriptor exists for this version
        if (!migrations?.from?.[fromVersion]) {
          dispatch(project, 'definition.addMigration', {
            fromVersion,
            ...(params.description ? { description: params.description } : {}),
          });
        }

        // Add the field map rule
        dispatch(project, 'definition.addFieldMapRule', {
          fromVersion,
          source: params.source!,
          target: params.target ?? null,
          transform: params.transform ?? 'rename',
          ...(params.expression !== undefined ? { expression: params.expression } : {}),
          ...(params.insertIndex !== undefined ? { insertIndex: params.insertIndex } : {}),
        });

        const descriptor = (project.definition as any).migrations?.from?.[fromVersion];
        const rules = descriptor?.fieldMap ?? [];

        return successResponse({
          fromVersion,
          ruleCount: rules.length,
          summary: `Added migration rule from v${fromVersion}: ${params.source} → ${params.target ?? '(removed)'}`,
        });
      }

      case 'remove_rule': {
        const fromVersion = params.fromVersion!;
        const ruleIndex = params.ruleIndex!;

        dispatch(project, 'definition.deleteFieldMapRule', {
          fromVersion,
          index: ruleIndex,
        });

        return successResponse({
          fromVersion,
          removedIndex: ruleIndex,
          summary: `Removed migration rule at index ${ruleIndex} from v${fromVersion}`,
        });
      }

      case 'list_rules': {
        const migrations = (project.definition as any).migrations;
        const result: Record<string, unknown> = {};

        if (migrations?.from) {
          for (const [version, descriptor] of Object.entries(migrations.from)) {
            const desc = descriptor as any;
            result[version] = {
              description: desc.description,
              fieldMap: desc.fieldMap ?? [],
              defaults: desc.defaults,
            };
          }
        }

        return successResponse({ migrations: result });
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
