/** @filedesc MCP tool for theme management: tokens, defaults, and selectors. */
import type { ProjectRegistry } from '../registry.js';
import { wrapHelperCall, successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from '@formspec-org/studio-core';
import type { Project, HelperResult } from '@formspec-org/studio-core';

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
        return successResponse(project.setToken(params.key!, params.value as string));

      case 'remove_token':
        // setToken with null removes the key
        return successResponse(project.setToken(params.key!, null));

      case 'list_tokens':
        return successResponse({ tokens: project.theme.tokens ?? {} });

      case 'set_default':
        return successResponse(project.setThemeDefault(params.property!, params.value));

      case 'list_defaults':
        return successResponse({ defaults: project.theme.defaults ?? {} });

      case 'add_selector':
        throw new HelperError('NOT_IMPLEMENTED', 'Theme selector management not yet exposed in public API');

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

