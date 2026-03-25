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

type AuditAction = 'classify_items' | 'bind_summary' | 'cross_document' | 'accessibility';

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
 * Cross-document consistency audit.
 * Checks that theme references valid items, component tree binds exist, etc.
 */
function crossDocumentAudit(project: Project): {
  issues: Array<{ type: string; severity: string; message: string; detail?: Record<string, unknown> }>;
  summary: { total: number; errors: number; warnings: number };
} {
  const issues: Array<{ type: string; severity: string; message: string; detail?: Record<string, unknown> }> = [];

  // Use project.diagnose() which already performs cross-artifact consistency checks
  const diagnostics = project.diagnose();

  // Collect consistency issues
  for (const d of diagnostics.consistency) {
    issues.push({
      type: 'consistency',
      severity: d.severity,
      message: d.message,
    });
  }

  // Collect structural issues
  for (const d of diagnostics.structural) {
    issues.push({
      type: 'structural',
      severity: d.severity,
      message: d.message,
    });
  }

  // Check component tree field references
  const component = project.effectiveComponent;
  const tree = (component as any)?.tree;
  if (tree) {
    const checkNode = (node: any) => {
      if (!node) return;
      if (node.bind && typeof node.bind === 'string') {
        const item = project.itemAt(node.bind);
        if (!item) {
          issues.push({
            type: 'component_ref',
            severity: 'warning',
            message: `Component node references nonexistent item: ${node.bind}`,
            detail: { bind: node.bind, component: node.component },
          });
        }
      }
      if (node.children) {
        for (const child of node.children) checkNode(child);
      }
    };
    checkNode(tree);
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  return {
    issues,
    summary: { total: issues.length, errors, warnings },
  };
}

/**
 * Basic accessibility audit.
 * Checks labels, required fields have messages, etc.
 */
function accessibilityAudit(project: Project): {
  issues: Array<{ path: string; severity: string; message: string }>;
  summary: { total: number; errors: number; warnings: number };
} {
  const definition = project.definition;
  const items = definition.items ?? [];
  const binds = (definition as any).binds ?? [];
  const issues: Array<{ path: string; severity: string; message: string }> = [];

  // Build a map of binds by path
  const bindMap = new Map<string, any>();
  for (const bind of binds) {
    if (bind.path) bindMap.set(bind.path, bind);
  }

  function walkItems(itemList: any[], prefix: string) {
    for (const item of itemList) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;

      if (item.type === 'field') {
        // Check: field has a label
        if (!item.label || item.label.trim() === '') {
          issues.push({
            path,
            severity: 'error',
            message: `Field '${path}' is missing a label`,
          });
        }

        // Check: required fields should have a constraint message or description
        const bind = bindMap.get(path);
        if (bind?.required && bind.required !== 'false') {
          if (!item.hint && !item.description) {
            issues.push({
              path,
              severity: 'info',
              message: `Required field '${path}' has no hint or description to guide users`,
            });
          }
        }

        // Check: choice fields have at least one option
        if (item.dataType === 'choice' || item.dataType === 'multiChoice') {
          if (!item.options?.length && !item.optionSet) {
            issues.push({
              path,
              severity: 'warning',
              message: `Choice field '${path}' has no options defined`,
            });
          }
        }
      }

      if (item.children && Array.isArray(item.children)) {
        walkItems(item.children, path);
      }
    }
  }

  walkItems(items, '');

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  return {
    issues,
    summary: { total: issues.length, errors, warnings },
  };
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
      case 'cross_document':
        return successResponse(crossDocumentAudit(project));
      case 'accessibility':
        return successResponse(accessibilityAudit(project));
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
