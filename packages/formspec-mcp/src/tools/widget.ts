/** @filedesc Widget vocabulary query tool — list widgets, compatible widgets, field type catalog. */

import type { ProjectRegistry } from '../registry.js';
import { HelperError } from 'formspec-studio-core';
import { errorResponse, successResponse, formatToolError } from '../errors.js';

type WidgetAction = 'list_widgets' | 'compatible' | 'field_types';

interface WidgetParams {
  action: WidgetAction;
  dataType?: string;
}

export function handleWidget(
  registry: ProjectRegistry,
  projectId: string,
  params: WidgetParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'list_widgets':
        return successResponse(project.listWidgets());
      case 'compatible':
        return successResponse(project.compatibleWidgets(params.dataType!));
      case 'field_types':
        return successResponse(project.fieldTypeCatalog());
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
