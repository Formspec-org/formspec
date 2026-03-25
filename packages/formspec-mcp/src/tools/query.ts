/**
 * Query tools (split per plan):
 *   formspec_describe: mode 'structure' | 'audit'
 *   formspec_search: standalone search
 *   formspec_trace: mode 'trace' | 'changelog'
 *   formspec_preview: mode 'preview' | 'validate'
 */

import type { ProjectRegistry } from '../registry.js';
import { previewForm, validateResponse, HelperError, type ItemFilter } from 'formspec-studio-core';
import { errorResponse, successResponse, formatToolError } from '../errors.js';

/** Common error handler for query tools (which return non-HelperResult types) */
function wrapQuery(fn: () => unknown) {
  try {
    const result = fn();
    return successResponse(result);
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── formspec_describe: structure + audit ─────────────────────────

export function handleDescribe(
  registry: ProjectRegistry,
  projectId: string,
  mode: 'structure' | 'audit',
  target?: string,
) {
  return wrapQuery(() => {
    const project = registry.getProject(projectId);
    if (mode === 'audit') {
      return project.diagnose();
    }
    // structure mode
    if (target) {
      const item = project.itemAt(target);
      const bind = project.bindFor(target);
      return { item: item ?? null, bind: bind ?? null };
    }
    // Include pages and component-tier nodes (submit buttons, etc.)
    const pages = project.listPages();
    const componentTree = (project.effectiveComponent as any)?.tree;
    const componentNodes: Array<{ component: string; id?: string; props?: Record<string, unknown> }> = [];
    if (componentTree?.children) {
      const walk = (node: any) => {
        if (!node) return;
        if (node.component && node.component !== 'Stack' && node.component !== 'Wizard' && node.component !== 'Page') {
          componentNodes.push({
            component: node.component,
            ...(node.id ? { id: node.id } : {}),
            ...(node.props ? { props: node.props } : {}),
          });
        }
        if (node.children) {
          for (const child of node.children) walk(child);
        }
      };
      walk(componentTree);
    }
    const statistics = project.statistics();
    // Override componentNodeCount to match the filtered array (excludes layout wrappers)
    if (componentNodes.length > 0) {
      statistics.componentNodeCount = componentNodes.length;
    }
    return {
      statistics,
      fieldPaths: project.fieldPaths(),
      pages: pages.length > 0 ? pages : undefined,
      componentNodes: componentNodes.length > 0 ? componentNodes : undefined,
    };
  });
}

// ── formspec_search ─────────────────────────────────────────────

export function handleSearch(
  registry: ProjectRegistry,
  projectId: string,
  filter: Partial<ItemFilter>,
) {
  return wrapQuery(() => {
    const project = registry.getProject(projectId);
    return { items: project.searchItems(filter as ItemFilter) };
  });
}

// ── formspec_trace: trace + changelog ───────────────────────────

export function handleTrace(
  registry: ProjectRegistry,
  projectId: string,
  mode: 'trace' | 'changelog',
  params: { expression_or_field?: string; from_version?: string },
) {
  return wrapQuery(() => {
    const project = registry.getProject(projectId);

    if (mode === 'changelog') {
      return project.previewChangelog();
    }

    // trace mode — distinguish field reference from expression
    const raw = params.expression_or_field!;

    // A bare field path: "qty", "contact.email", "$qty", "$contact.email"
    // Matches an optional $ prefix followed by an identifier with optional dot-separated segments
    const fieldPathMatch = raw.match(/^\$?([\w][\w\d]*(?:\.[\w][\w\d]*)*)$/);

    if (fieldPathMatch) {
      const fieldPath = fieldPathMatch[1];
      return { type: 'field', input: fieldPath, dependents: project.fieldDependents(fieldPath) };
    }
    return { type: 'expression', input: raw, dependencies: project.expressionDependencies(raw) };
  });
}

// ── formspec_preview: preview + validate + sample_data + normalize ──

export function handlePreview(
  registry: ProjectRegistry,
  projectId: string,
  mode: 'preview' | 'validate' | 'sample_data' | 'normalize',
  params: { scenario?: Record<string, unknown>; response?: Record<string, unknown> },
) {
  return wrapQuery(() => {
    const project = registry.getProject(projectId);
    switch (mode) {
      case 'validate':
        return validateResponse(project, params.response!);
      case 'sample_data':
        return project.generateSampleData();
      case 'normalize':
        return project.normalizeDefinition();
      case 'preview':
      default:
        return previewForm(project, params.scenario);
    }
  });
}
