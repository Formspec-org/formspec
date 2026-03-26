/** @filedesc MCP tool for publish lifecycle: set_version, set_status, validate_transition, get_version_info. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError, wrapHelperCall } from '../errors.js';
import { HelperError } from 'formspec-studio-core';

type PublishAction = 'set_version' | 'set_status' | 'validate_transition' | 'get_version_info';

type LifecycleStatus = 'draft' | 'active' | 'retired';

interface PublishParams {
  action: PublishAction;
  version?: string;
  status?: LifecycleStatus;
}

/** Valid status transitions: from → allowed to values. */
const STATUS_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  draft: ['active'],
  active: ['retired'],
  retired: [],
};

export function handlePublish(
  registry: ProjectRegistry,
  projectId: string,
  params: PublishParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'set_version': {
        return wrapHelperCall(() =>
          project.setMetadata({ version: params.version }),
        );
      }

      case 'set_status': {
        const currentStatus = ((project.definition as any).status ?? 'draft') as LifecycleStatus;
        const targetStatus = params.status!;

        // Validate the transition
        const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
        if (!allowed.includes(targetStatus)) {
          return errorResponse(formatToolError(
            'INVALID_STATUS_TRANSITION',
            `Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowed.join(', ') || 'none'}`,
            { currentStatus, targetStatus, allowedTransitions: allowed },
          ));
        }

        return wrapHelperCall(() =>
          project.setMetadata({ status: targetStatus }),
        );
      }

      case 'validate_transition': {
        const currentStatus = ((project.definition as any).status ?? 'draft') as LifecycleStatus;
        const targetStatus = params.status!;
        const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
        const valid = allowed.includes(targetStatus);

        return successResponse({
          currentStatus,
          targetStatus,
          valid,
          allowedTransitions: allowed,
        });
      }

      case 'get_version_info': {
        const def = project.definition as any;
        return successResponse({
          version: def.version ?? null,
          status: def.status ?? 'draft',
          name: def.name ?? null,
          date: def.date ?? null,
          versionAlgorithm: def.versionAlgorithm ?? null,
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
