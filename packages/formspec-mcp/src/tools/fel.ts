/**
 * FEL tool (consolidated):
 *   action: 'context' | 'functions' | 'check'
 */

import type { ProjectRegistry } from '../registry.js';
import { HelperError } from 'formspec-studio-core';
import { errorResponse, successResponse, formatToolError } from '../errors.js';

type FelAction = 'context' | 'functions' | 'check';

interface FelParams {
  action: FelAction;
  path?: string;         // for context scoping
  expression?: string;   // for check
  context_path?: string; // for check scoping
}

export function handleFel(
  registry: ProjectRegistry,
  projectId: string,
  params: FelParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'context': {
        const refs = project.availableReferences(params.path);
        return successResponse(refs);
      }
      case 'functions': {
        const catalog = project.felFunctionCatalog();
        return successResponse(catalog);
      }
      case 'check': {
        const context = params.context_path ? { targetPath: params.context_path } : undefined;
        const result = project.parseFEL(params.expression!, context);
        return successResponse(result);
      }
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
