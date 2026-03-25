/** @filedesc MCP tool for form audit: item classification and bind summaries. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';
import type { Project } from 'formspec-studio-core';

// ── Types ────────────────────────────────────────────────────────────

export interface ItemClassification {
  path: string;
  type: 'field' | 'group' | 'display';
  dataType?: string;
  hasBind: boolean;
  hasShape: boolean;
  hasExtension: boolean;
}

type AuditAction = 'classify_items' | 'bind_summary';

interface AuditParams {
  action: AuditAction;
  target?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const BIND_PROPERTIES = ['required', 'constraint', 'calculate', 'relevant', 'readonly'] as const;

/**
 * Walk the item tree and classify each item.
 */
function classifyItems(project: Project): ItemClassification[] {
  const definition = project.definition;
  const items = definition.items ?? [];
  const binds = (definition as any).binds ?? [];
  const shapes = (definition as any).shapes ?? [];
  const result: ItemClassification[] = [];

  // Build sets for bind and shape paths for O(1) lookup
  const bindPaths = new Set<string>();
  for (const bind of binds) {
    if (bind.path) bindPaths.add(bind.path);
  }
  const shapePaths = new Set<string>();
  for (const shape of shapes) {
    if (shape.target) shapePaths.add(shape.target);
  }

  function walkItems(itemList: any[], prefix: string) {
    for (const item of itemList) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      const classification: ItemClassification = {
        path,
        type: item.type,
        hasBind: bindPaths.has(path),
        hasShape: shapePaths.has(path),
        hasExtension: !!(item.extensions && Object.keys(item.extensions).length > 0),
      };
      if (item.type === 'field' && item.dataType) {
        classification.dataType = item.dataType;
      }
      result.push(classification);

      if (item.children && Array.isArray(item.children)) {
        walkItems(item.children, path);
      }
    }
  }

  walkItems(items, '');
  return result;
}

/**
 * Get bind summary for a specific path.
 */
function bindSummary(project: Project, path: string): Record<string, string> {
  const item = project.itemAt(path);
  if (!item) {
    throw new HelperError('ITEM_NOT_FOUND', `Item not found: ${path}`);
  }

  const definition = project.definition;
  const binds = (definition as any).binds ?? [];
  const result: Record<string, string> = {};

  for (const bind of binds) {
    if (bind.path === path) {
      for (const prop of BIND_PROPERTIES) {
        if (bind[prop] !== undefined) {
          result[prop] = bind[prop];
        }
      }
    }
  }

  return result;
}

// ── Handler ──────────────────────────────────────────────────────────

export function handleAudit(
  registry: ProjectRegistry,
  projectId: string,
  params: AuditParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'classify_items':
        return successResponse({ items: classifyItems(project) });
      case 'bind_summary':
        return successResponse({ binds: bindSummary(project, params.target!) });
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
