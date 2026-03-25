/** @filedesc MCP tool handler for bound reference management. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';

type ReferenceAction = 'add_reference' | 'remove_reference' | 'list_references';

interface ReferenceParams {
  action: ReferenceAction;
  field_path?: string;
  uri?: string;
  type?: string;
  description?: string;
}

interface ReferenceEntry {
  fieldPath: string;
  uri: string;
  type?: string;
  description?: string;
}

export function handleReference(
  registry: ProjectRegistry,
  projectId: string,
  params: ReferenceParams,
) {
  try {
    const project = registry.getProject(projectId);
    const def = project.definition as any;

    switch (params.action) {
      case 'add_reference': {
        if (!def.references) def.references = [];
        const entry: ReferenceEntry = {
          fieldPath: params.field_path!,
          uri: params.uri!,
        };
        if (params.type) entry.type = params.type;
        if (params.description) entry.description = params.description;
        def.references.push(entry);
        return successResponse({ summary: `Added reference to "${params.field_path}" → ${params.uri}` });
      }

      case 'remove_reference': {
        if (!def.references) def.references = [];
        def.references = def.references.filter(
          (r: ReferenceEntry) => !(r.fieldPath === params.field_path && r.uri === params.uri),
        );
        return successResponse({ summary: `Removed reference from "${params.field_path}" → ${params.uri}` });
      }

      case 'list_references': {
        return successResponse({ references: def.references ?? [] });
      }

      default:
        return errorResponse(formatToolError('UNKNOWN_ACTION', `Unknown action: ${params.action}`));
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
