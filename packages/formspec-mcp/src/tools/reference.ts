/** @filedesc MCP tool for reference management: bound references on fields. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';

type ReferenceAction =
  | 'add_reference'
  | 'remove_reference'
  | 'list_references';

interface ReferenceEntry {
  fieldPath: string;
  uri: string;
  type?: string;
  description?: string;
}

interface ReferenceParams {
  action: ReferenceAction;
  field_path?: string;
  uri?: string;
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

    switch (params.action) {
      case 'add_reference': {
        const refs = getReferences(project);
        const entry: ReferenceEntry = {
          fieldPath: params.field_path!,
          uri: params.uri!,
        };
        if (params.type) entry.type = params.type;
        if (params.description) entry.description = params.description;
        refs.push(entry);
        setReferences(project, refs);
        return successResponse({
          summary: `Reference added: ${params.uri} on ${params.field_path}`,
          affectedPaths: [params.field_path!],
          warnings: [],
        });
      }

      case 'remove_reference': {
        const refs = getReferences(project);
        const filtered = refs.filter(
          r => !(r.fieldPath === params.field_path && r.uri === params.uri),
        );
        setReferences(project, filtered);
        return successResponse({
          summary: `Reference removed from ${params.field_path}: ${params.uri}`,
          affectedPaths: params.field_path ? [params.field_path] : [],
          warnings: [],
        });
      }

      case 'list_references': {
        const refs = getReferences(project);
        return successResponse({ references: refs });
      }

      default:
        return errorResponse(formatToolError(
          'COMMAND_FAILED',
          `Unknown reference action: ${(params as any).action}`,
        ));
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

const REFERENCES_EXT_KEY = 'x-formspec-references';

function getReferences(project: any): ReferenceEntry[] {
  const def = project.definition;
  const ext = def.extensions;
  if (!ext) return [];
  return (ext[REFERENCES_EXT_KEY] as ReferenceEntry[] | undefined) ?? [];
}

function setReferences(project: any, refs: ReferenceEntry[]): void {
  // Store references in definition.extensions['x-formspec-references']
  // via direct state mutation (no handler exists for definition-level extensions).
  const state = project.core.state;
  const def = state.definition as any;
  if (!def.extensions) def.extensions = {};
  def.extensions[REFERENCES_EXT_KEY] = refs;
}
