/** @filedesc MCP tool for mapping rule CRUD: add_mapping, remove_mapping, list_mappings, auto_map. */
import type { ProjectRegistry } from '../registry.js';
import type { Project } from 'formspec-studio-core';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';

type MappingAction = 'add_mapping' | 'remove_mapping' | 'list_mappings' | 'auto_map';

interface MappingParams {
  action: MappingAction;
  mappingId?: string;
  // For add_mapping
  sourcePath?: string;
  targetPath?: string;
  transform?: string;
  insertIndex?: number;
  // For remove_mapping
  ruleIndex?: number;
  // For auto_map
  scopePath?: string;
  replace?: boolean;
}

/** Raw dispatch through the private core field. */
function dispatch(project: Project, type: string, payload: Record<string, unknown>) {
  (project as any).core.dispatch({ type, payload });
}

export function handleMappingExpanded(
  registry: ProjectRegistry,
  projectId: string,
  params: MappingParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'add_mapping': {
        dispatch(project, 'mapping.addRule', {
          ...(params.mappingId ? { mappingId: params.mappingId } : {}),
          sourcePath: params.sourcePath,
          targetPath: params.targetPath,
          transform: params.transform ?? 'preserve',
          ...(params.insertIndex !== undefined ? { insertIndex: params.insertIndex } : {}),
        });

        const mapping = params.mappingId
          ? (project.mappings as any)[params.mappingId]
          : project.mapping;
        const rules = (mapping as any)?.rules ?? [];

        return successResponse({
          ruleCount: rules.length,
          summary: `Added mapping: ${params.sourcePath} → ${params.targetPath}`,
        });
      }

      case 'remove_mapping': {
        const ruleIndex = params.ruleIndex!;
        dispatch(project, 'mapping.deleteRule', {
          ...(params.mappingId ? { mappingId: params.mappingId } : {}),
          index: ruleIndex,
        });

        return successResponse({
          removedIndex: ruleIndex,
          summary: `Removed mapping rule at index ${ruleIndex}`,
        });
      }

      case 'list_mappings': {
        const mappingId = params.mappingId;
        if (mappingId) {
          const mapping = (project.mappings as any)[mappingId];
          return successResponse({
            mappingId,
            rules: mapping?.rules ?? [],
          });
        }

        // List all mappings
        const result: Record<string, unknown> = {};
        for (const [id, m] of Object.entries(project.mappings)) {
          result[id] = { rules: (m as any).rules ?? [] };
        }
        return successResponse({ mappings: result });
      }

      case 'auto_map': {
        dispatch(project, 'mapping.autoGenerateRules', {
          ...(params.mappingId ? { mappingId: params.mappingId } : {}),
          ...(params.scopePath ? { scopePath: params.scopePath } : {}),
          ...(params.replace !== undefined ? { replace: params.replace } : {}),
        });

        const mapping = params.mappingId
          ? (project.mappings as any)[params.mappingId]
          : project.mapping;
        const rules = (mapping as any)?.rules ?? [];

        return successResponse({
          ruleCount: rules.length,
          summary: `Auto-generated mapping rules (${rules.length} total)`,
        });
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
