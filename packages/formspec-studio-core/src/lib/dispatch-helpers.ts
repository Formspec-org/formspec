/** @filedesc Generic dispatch-and-return executor for delegate helper modules. */
import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult } from '../helper-types.js';
import type { ProjectInternals } from '../project-internals.js';

export interface DispatchSpec<P extends object> {
  command: string;
  payload?: (params: P) => Record<string, unknown>;
  summary: (params: P) => string;
  affectedPaths?: (params: P) => string[];
  beforeDispatch?: (project: ProjectInternals, params: P) => void;
  afterDispatch?: (project: ProjectInternals, params: P) => Partial<Pick<HelperResult, 'createdId' | 'warnings'>>;
}

export function exec<P extends object>(
  project: ProjectInternals,
  helper: string,
  params: P,
  spec: DispatchSpec<P>,
): HelperResult {
  spec.beforeDispatch?.(project, params);
  const payload: Record<string, unknown> = spec.payload
    ? spec.payload(params)
    : (params as Record<string, unknown>);
  project.core.dispatch({ type: spec.command, payload } as AnyCommand);
  const extras = spec.afterDispatch?.(project, params);
  return {
    summary: spec.summary(params),
    action: { helper, params: params as Record<string, unknown> },
    affectedPaths: spec.affectedPaths?.(params) ?? [],
    ...(extras ?? {}),
  };
}
