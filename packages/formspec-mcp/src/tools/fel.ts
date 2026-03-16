/**
 * FEL tools: fel_context, fel_functions, fel_check.
 *
 * These expose FEL expression parsing, validation, and reference discovery
 * for LLM-driven expression authoring.
 */

import type { ProjectRegistry } from '../registry.js';
import { HelperError } from 'formspec-studio-core';
import { errorResponse, successResponse, formatToolError } from '../errors.js';

// ── handleFelContext ───────────────────────────────────────────────

/**
 * Returns available references (fields, variables, instances, context refs)
 * scoped to an optional field path.
 */
export function handleFelContext(
  registry: ProjectRegistry,
  projectId: string,
  path?: string,
) {
  try {
    const project = registry.getProject(projectId);
    const refs = project.availableReferences(path);
    return successResponse(refs);
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleFelFunctions ─────────────────────────────────────────────

/**
 * Returns the catalog of available FEL functions (builtin + extension-provided).
 */
export function handleFelFunctions(
  registry: ProjectRegistry,
  projectId: string,
) {
  try {
    const project = registry.getProject(projectId);
    const catalog = project.felFunctionCatalog();
    return successResponse(catalog);
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleFelCheck ─────────────────────────────────────────────────

/**
 * Parse and validate a FEL expression. Returns validity, errors, referenced
 * field paths, and function names. Optionally scoped to a context path.
 */
export function handleFelCheck(
  registry: ProjectRegistry,
  projectId: string,
  expression: string,
  contextPath?: string,
) {
  try {
    const project = registry.getProject(projectId);
    const context = contextPath ? { targetPath: contextPath } : undefined;
    const result = project.parseFEL(expression, context);
    return successResponse(result);
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
