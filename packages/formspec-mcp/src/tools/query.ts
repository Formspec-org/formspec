/**
 * Query tools: preview, audit, describe, trace, validate_response, search, changelog.
 *
 * These wrap Project query methods and evaluation helpers for LLM consumption.
 * They return diverse types (not HelperResult), so we use try/catch directly.
 */

import type { ProjectRegistry } from '../registry.js';
import { previewForm, validateResponse, HelperError, type ItemFilter } from 'formspec-studio-core';
import { errorResponse, successResponse, formatToolError } from '../errors.js';

// ── handlePreview ──────────────────────────────────────────────────

export function handlePreview(
  registry: ProjectRegistry,
  projectId: string,
  scenario?: Record<string, unknown>,
) {
  try {
    const project = registry.getProject(projectId);
    const result = previewForm(project, scenario);
    return successResponse(result);
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleAudit ────────────────────────────────────────────────────

export function handleAudit(
  registry: ProjectRegistry,
  projectId: string,
) {
  try {
    const project = registry.getProject(projectId);
    const diagnostics = project.diagnose();
    return successResponse(diagnostics);
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleDescribe ─────────────────────────────────────────────────

export function handleDescribe(
  registry: ProjectRegistry,
  projectId: string,
  target?: string,
) {
  try {
    const project = registry.getProject(projectId);

    if (target) {
      const item = project.itemAt(target);
      const bind = project.bindFor(target);
      return successResponse({
        item: item ?? null,
        bind: bind ?? null,
      });
    }

    return successResponse({
      statistics: project.statistics(),
      fieldPaths: project.fieldPaths(),
    });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleTrace ────────────────────────────────────────────────────

/**
 * Trace dependencies/dependents for a FEL expression or field path.
 *
 * Heuristic: if the string contains FEL operators or function calls, treat as expression.
 * Otherwise treat as a field path.
 */
export function handleTrace(
  registry: ProjectRegistry,
  projectId: string,
  expressionOrField: string,
) {
  try {
    const project = registry.getProject(projectId);
    const isExpression = /[$+\-*/()!<>=]/.test(expressionOrField);

    if (isExpression) {
      const deps = project.expressionDependencies(expressionOrField);
      return successResponse({
        type: 'expression',
        input: expressionOrField,
        dependencies: deps,
      });
    }

    const dependents = project.fieldDependents(expressionOrField);
    return successResponse({
      type: 'field',
      input: expressionOrField,
      dependents,
    });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleValidateResponse ─────────────────────────────────────────

export function handleValidateResponse(
  registry: ProjectRegistry,
  projectId: string,
  response: Record<string, unknown>,
) {
  try {
    const project = registry.getProject(projectId);
    const report = validateResponse(project, response);
    return successResponse(report);
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleSearch ───────────────────────────────────────────────────

export function handleSearch(
  registry: ProjectRegistry,
  projectId: string,
  filter: Partial<ItemFilter>,
) {
  try {
    const project = registry.getProject(projectId);
    const items = project.searchItems(filter as ItemFilter);
    return successResponse({ items });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleChangelog ────────────────────────────────────────────────

export function handleChangelog(
  registry: ProjectRegistry,
  projectId: string,
  _fromVersion?: string,
) {
  try {
    const project = registry.getProject(projectId);
    // Basic stub — returns current state info
    const stats = project.statistics();
    return successResponse({
      status: 'stub',
      message: 'Changelog generation is not yet fully implemented',
      projectStats: stats,
    });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
