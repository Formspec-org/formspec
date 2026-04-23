/** @filedesc Generic dispatch-and-return executor for delegate helper modules. */
import type { AnyCommand, BuiltinCommandType } from '@formspec-org/core';
import type { HelperResult } from '../helper-types.js';
import type { ProjectInternals } from '../project-internals.js';

/** Multi-command batch (same return shape as {@link exec}). */
export interface ExecBatchSpec<P extends object> {
  buildCommands: (project: ProjectInternals, params: P) => AnyCommand[];
  summary: (project: ProjectInternals, params: P) => string;
  affectedPaths?: (params: P) => string[];
  beforeDispatch?: (project: ProjectInternals, params: P) => void;
  afterDispatch?: (project: ProjectInternals, params: P) => Partial<Pick<HelperResult, 'createdId' | 'warnings'>>;
}

export interface DispatchSpec<P extends object> {
  command: BuiltinCommandType;
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
  project.core.dispatch({ type: spec.command, payload });
  const extras = spec.afterDispatch?.(project, params);
  return {
    summary: spec.summary(params),
    action: { helper, params: params as Record<string, unknown> },
    affectedPaths: spec.affectedPaths?.(params) ?? [],
    ...(extras ?? {}),
  };
}

export function execBatch<P extends object>(
  project: ProjectInternals,
  helper: string,
  params: P,
  spec: ExecBatchSpec<P>,
): HelperResult {
  spec.beforeDispatch?.(project, params);
  const cmds = spec.buildCommands(project, params);
  if (cmds.length > 0) {
    project.core.dispatch(cmds);
  }
  const extras = spec.afterDispatch?.(project, params);
  return {
    summary: spec.summary(project, params),
    action: { helper, params: params as Record<string, unknown> },
    affectedPaths: spec.affectedPaths?.(params) ?? [],
    ...(extras ?? {}),
  };
}
