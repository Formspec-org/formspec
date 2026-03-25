/** @filedesc MCP tool for changelog: list_changes, diff_from_baseline. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';

type ChangelogAction = 'list_changes' | 'diff_from_baseline';

interface ChangelogParams {
  action: ChangelogAction;
  fromVersion?: string;
}

export function handleChangelog(
  registry: ProjectRegistry,
  projectId: string,
  params: ChangelogParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'list_changes': {
        const changelog = project.previewChangelog();
        return successResponse({ changelog });
      }

      case 'diff_from_baseline': {
        const changes = project.diffFromBaseline(params.fromVersion);
        return successResponse({
          fromVersion: params.fromVersion ?? null,
          changeCount: changes.length,
          changes,
        });
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
