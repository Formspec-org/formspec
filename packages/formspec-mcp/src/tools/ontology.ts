/** @filedesc MCP tool for ontology management: concept bindings and vocabulary URLs. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';
import type { FormItem } from 'formspec-types';

type OntologyAction =
  | 'bind_concept'
  | 'remove_concept'
  | 'list_concepts'
  | 'set_vocabulary';

interface OntologyParams {
  action: OntologyAction;
  path?: string;
  concept?: string;
  vocabulary?: string;
}

interface OntologyBinding {
  concept?: string;
  vocabulary?: string;
}

export function handleOntology(
  registry: ProjectRegistry,
  projectId: string,
  params: OntologyParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'bind_concept': {
        const item = project.itemAt(params.path!);
        if (!item) {
          return errorResponse(formatToolError(
            'PATH_NOT_FOUND',
            `Item not found at path: ${params.path}`,
          ));
        }
        const existing = getOntologyBinding(item);
        const binding: OntologyBinding = {
          ...existing,
          concept: params.concept!,
        };
        if (params.vocabulary) {
          binding.vocabulary = params.vocabulary;
        }
        setOntologyBinding(project, params.path!, binding);
        return successResponse({
          summary: `Ontology concept bound to ${params.path}: ${params.concept}`,
          affectedPaths: [params.path!],
          warnings: [],
        });
      }

      case 'remove_concept': {
        const item = project.itemAt(params.path!);
        if (!item) {
          return errorResponse(formatToolError(
            'PATH_NOT_FOUND',
            `Item not found at path: ${params.path}`,
          ));
        }
        const existing = getOntologyBinding(item);
        if (existing) {
          delete existing.concept;
          if (Object.keys(existing).length === 0) {
            removeOntologyBinding(project, params.path!);
          } else {
            setOntologyBinding(project, params.path!, existing);
          }
        }
        return successResponse({
          summary: `Ontology concept removed from ${params.path}`,
          affectedPaths: [params.path!],
          warnings: [],
        });
      }

      case 'list_concepts': {
        const concepts: Array<{ path: string; concept?: string; vocabulary?: string }> = [];
        walkItems(project.definition.items, '', (item, path) => {
          const binding = getOntologyBinding(item);
          if (binding?.concept) {
            concepts.push({ path, ...binding });
          }
        });
        return successResponse({ concepts });
      }

      case 'set_vocabulary': {
        const item = project.itemAt(params.path!);
        if (!item) {
          return errorResponse(formatToolError(
            'PATH_NOT_FOUND',
            `Item not found at path: ${params.path}`,
          ));
        }
        const existing = getOntologyBinding(item) ?? {};
        existing.vocabulary = params.vocabulary!;
        setOntologyBinding(project, params.path!, existing);
        return successResponse({
          summary: `Vocabulary set on ${params.path}: ${params.vocabulary}`,
          affectedPaths: [params.path!],
          warnings: [],
        });
      }

      default:
        return errorResponse(formatToolError(
          'COMMAND_FAILED',
          `Unknown ontology action: ${params.action}`,
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

const ONTOLOGY_EXT_KEY = 'x-formspec-ontology';

function getOntologyBinding(item: FormItem): OntologyBinding | undefined {
  const ext = (item as any).extensions;
  if (!ext) return undefined;
  return ext[ONTOLOGY_EXT_KEY] as OntologyBinding | undefined;
}

function setOntologyBinding(project: any, path: string, binding: OntologyBinding): void {
  // Use definition.setItemProperty handler to set the extension on the item
  project.core.dispatch({
    type: 'definition.setItemProperty',
    payload: { path, property: `extensions.${ONTOLOGY_EXT_KEY}`, value: binding },
  });
}

function removeOntologyBinding(project: any, path: string): void {
  project.core.dispatch({
    type: 'definition.setItemProperty',
    payload: { path, property: `extensions.${ONTOLOGY_EXT_KEY}`, value: undefined },
  });
}

function walkItems(
  items: FormItem[],
  prefix: string,
  fn: (item: FormItem, path: string) => void,
): void {
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    fn(item, path);
    if (item.children) {
      walkItems(item.children, path, fn);
    }
  }
}
