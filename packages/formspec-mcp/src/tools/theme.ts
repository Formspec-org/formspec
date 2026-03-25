/** @filedesc MCP tool for theme management: tokens, defaults, and selectors. */
import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall, successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';
import type { Project, HelperResult } from 'formspec-studio-core';

type ThemeAction =
  | 'set_token'
  | 'remove_token'
  | 'list_tokens'
  | 'set_default'
  | 'list_defaults'
  | 'add_selector'
  | 'list_selectors';

interface ThemeParams {
  action: ThemeAction;
  // For tokens
  key?: string;
  value?: unknown;
  // For defaults
  property?: string;
  // For selectors
  match?: unknown;
  apply?: unknown;
}

export function handleTheme(
  registry: ProjectRegistry,
  projectId: string,
  params: ThemeParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'set_token':
        return wrapMutation(project, 'theme.setToken', { key: params.key!, value: params.value });

      case 'remove_token':
        // setToken with null removes the key
        return wrapMutation(project, 'theme.setToken', { key: params.key!, value: null });

      case 'list_tokens':
        return successResponse({ tokens: project.theme.tokens ?? {} });

      case 'set_default':
        return wrapMutation(project, 'theme.setDefaults', { property: params.property!, value: params.value });

      case 'list_defaults':
        return successResponse({ defaults: project.theme.defaults ?? {} });

      case 'add_selector':
        return wrapMutation(project, 'theme.addSelector', { match: params.match!, apply: params.apply! });

      case 'list_selectors':
        return successResponse({ selectors: (project.theme as any).selectors ?? [] });
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

function wrapMutation(project: Project, type: string, payload: Record<string, unknown>) {
  try {
    (project as any).core.dispatch({ type, payload });
    return successResponse({
      summary: `${type} applied`,
      affectedPaths: [],
      warnings: [],
    });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
