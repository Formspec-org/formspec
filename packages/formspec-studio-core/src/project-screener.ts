import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult, FieldProps } from './helper-types.js';
import { HelperError } from './helper-types.js';
import { exec, execBatch, type DispatchSpec, type ExecBatchSpec } from './lib/dispatch-helpers.js';
import * as definitionOps from './project-definition.js';
import type { ProjectInternals } from './project-internals.js';
import type { ScreenerDocument } from './types.js';

function getScreenerOrThrow(project: ProjectInternals): ScreenerDocument {
  const screener = project.core.state.screener;
  if (!screener) throw new HelperError('SCREENER_NOT_FOUND', 'No screener document loaded', {});
  return screener;
}

function validateScreenerItemKey(project: ProjectInternals, key: string): number {
  const items = getScreenerOrThrow(project).items;
  const idx = items.findIndex(it => it.key === key);
  if (idx === -1) throw new HelperError('SCREENER_ITEM_NOT_FOUND', `Screener item not found: ${key}`, { key });
  return idx;
}

function validatePhaseRoute(project: ProjectInternals, phaseId: string, routeIndex: number): void {
  const screener = getScreenerOrThrow(project);
  const phase = screener.evaluation.find(p => p.id === phaseId);
  if (!phase) throw new HelperError('PHASE_NOT_FOUND', `Phase not found: ${phaseId}`, { phaseId });
  if (routeIndex < 0 || routeIndex >= phase.routes.length) {
    throw new HelperError('ROUTE_OUT_OF_BOUNDS', `Route index ${routeIndex} out of bounds in phase ${phaseId}`, {
      phaseId, routeIndex, routeCount: phase.routes.length,
    });
  }
}

const S = {
  deleteScreenerDocument: {
    command: 'screener.remove',
    summary: () => 'Removed screener document',
    affectedPaths: () => ['screener'],
  },
  removeScreenField: {
    command: 'screener.deleteItem',
    summary: (p: { key: string }) => `Removed screener field '${p.key}'`,
    affectedPaths: (p: { key: string }) => [p.key],
  },
  removeEvaluationPhase: {
    command: 'screener.removePhase',
    summary: (p: { phaseId: string }) => `Removed evaluation phase '${p.phaseId}'`,
    affectedPaths: (p: { phaseId: string }) => [p.phaseId],
  },
  reorderPhase: {
    command: 'screener.reorderPhase',
    summary: (p: { phaseId: string; direction: 'up' | 'down' }) =>
      `Reordered phase '${p.phaseId}' ${p.direction}`,
    affectedPaths: (p: { phaseId: string }) => [p.phaseId],
  },
  addEvaluationPhase: {
    command: 'screener.addPhase',
    payload: (p: { id: string; strategy: string; label?: string }) =>
      ({ id: p.id, strategy: p.strategy, ...(p.label !== undefined ? { label: p.label } : {}) }),
    summary: (p: { id: string; strategy: string }) =>
      `Added evaluation phase '${p.id}' (${p.strategy ?? '(unspecified)'})`,
    affectedPaths: (p: { id: string }) => [p.id],
    beforeDispatch: (project: ProjectInternals) => { getScreenerOrThrow(project); },
  },
  removeScreenRoute: {
    command: 'screener.deleteRoute',
    payload: (p: { phaseId: string; routeIndex: number }) =>
      ({ phaseId: p.phaseId, index: p.routeIndex }),
    summary: (p: { phaseId: string; routeIndex: number }) =>
      `Removed route ${p.routeIndex} from phase '${p.phaseId}'`,
    affectedPaths: (p: { phaseId: string }) => [p.phaseId],
    beforeDispatch: (project: ProjectInternals, p: { phaseId: string; routeIndex: number }) => {
      validatePhaseRoute(project, p.phaseId, p.routeIndex);
    },
  },
  reorderScreenRoute: {
    command: 'screener.reorderRoute',
    payload: (p: { phaseId: string; routeIndex: number; direction: 'up' | 'down' }) =>
      ({ phaseId: p.phaseId, index: p.routeIndex, direction: p.direction }),
    summary: (p: { phaseId: string; routeIndex: number; direction: 'up' | 'down' }) =>
      `Reordered route ${p.routeIndex} in phase '${p.phaseId}' ${p.direction}`,
    affectedPaths: (p: { phaseId: string }) => [p.phaseId],
    beforeDispatch: (project: ProjectInternals, p: { phaseId: string; routeIndex: number }) => {
      validatePhaseRoute(project, p.phaseId, p.routeIndex);
    },
  },
  setScreenerAvailability: {
    command: 'screener.setAvailability',
    summary: () => 'Updated screener availability',
    affectedPaths: () => ['screener.availability'],
    beforeDispatch: (project: ProjectInternals) => { getScreenerOrThrow(project); },
  },
  setScreenerResultValidity: {
    command: 'screener.setResultValidity',
    summary: (p: { duration: string | null }) =>
      p.duration ? `Set result validity to ${p.duration}` : 'Cleared result validity',
    affectedPaths: () => ['screener.validity'],
    beforeDispatch: (project: ProjectInternals) => { getScreenerOrThrow(project); },
  },
  createScreenerDocument: {
    command: 'screener.setDocument',
    payload: (p: { url?: string; title?: string }) => ({
      $formspecScreener: '1.0' as const,
      url: p.url ?? '',
      version: '1.0.0',
      title: p.title ?? 'Screener',
      items: [],
      evaluation: [{ id: 'default', strategy: 'first-match', routes: [] }],
    }),
    summary: () => 'Created screener document',
    affectedPaths: () => ['screener'],
  },
  reorderScreenField: {
    command: 'screener.reorderItem',
    payload: (p: { index: number; direction: 'up' | 'down' }) => ({ index: p.index, direction: p.direction }),
    summary: (p: { key: string; direction: 'up' | 'down' }) =>
      `Reordered screener field '${p.key}' ${p.direction}`,
    affectedPaths: (p: { key: string }) => [p.key],
  },
  addScreenRoute: {
    command: 'screener.addRoute',
    payload: (p: {
      phaseId: string;
      route: { condition?: string; target: string; label?: string; message?: string; score?: string; threshold?: number };
      insertIndex?: number;
    }) => ({ phaseId: p.phaseId, route: p.route, insertIndex: p.insertIndex }),
    summary: (p: {
      phaseId: string;
      route: { condition?: string; target: string; label?: string; message?: string; score?: string; threshold?: number };
    }) => `Added route to '${p.route.target ?? '(unspecified)'}' in phase '${p.phaseId}'`,
    affectedPaths: (p: { phaseId: string }) => [p.phaseId],
    beforeDispatch: (project, p) => {
      getScreenerOrThrow(project);
      if (p.route.condition) definitionOps._validateFEL(project, p.route.condition);
      if (p.route.score) definitionOps._validateFEL(project, p.route.score);
    },
  },
} satisfies Record<string, DispatchSpec<any>>;

const B = {
  addScreenField: {
    buildCommands: (proj, p: { key: string; label: string; type: string; props?: FieldProps }) => {
      const { resolved, extensionName, combinedConstraintExpr } = definitionOps._resolveAuthoringFieldType(proj, p.type);
      const payload: Record<string, unknown> = {
        type: 'field',
        key: p.key,
        label: p.label,
        dataType: resolved.dataType,
      };
      if (extensionName) payload.extensions = { [extensionName]: true };
      const cmds: AnyCommand[] = [{ type: 'screener.addItem', payload }];
      if (combinedConstraintExpr) {
        cmds.push({
          type: 'screener.setBind',
          payload: { path: p.key, properties: { constraint: combinedConstraintExpr } },
        });
      }
      return cmds;
    },
    summary: (_proj, p: { key: string }) => `Added screener field '${p.key}'`,
    affectedPaths: (p: { key: string }) => [p.key],
    beforeDispatch: (proj) => {
      getScreenerOrThrow(proj);
    },
  } satisfies ExecBatchSpec<{ key: string; label: string; type: string; props?: FieldProps }>,
  updateScreenField: {
    buildCommands: (proj, p: { key: string; changes: { label?: string; helpText?: string; required?: boolean | string } }) => {
      const commands: AnyCommand[] = [];
      for (const prop of ['label', 'helpText'] as const) {
        if (prop in p.changes) {
          commands.push({
            type: 'screener.setItemProperty',
            payload: { key: p.key, property: prop, value: p.changes[prop as keyof typeof p.changes] },
          });
        }
      }
      if ('required' in p.changes) {
        const val = p.changes.required;
        let bindValue: unknown;
        if (val === true) bindValue = 'true';
        else if (val === false) bindValue = null;
        else bindValue = val;
        commands.push({
          type: 'screener.setBind',
          payload: { path: p.key, properties: { required: bindValue } },
        });
      }
      return commands;
    },
    summary: (_proj, p: { key: string }) => `Updated screener field '${p.key}'`,
    affectedPaths: (p: { key: string }) => [p.key],
    beforeDispatch: (proj, p) => {
      validateScreenerItemKey(proj, p.key);
    },
  } satisfies ExecBatchSpec<{
    key: string;
    changes: { label?: string; helpText?: string; required?: boolean | string };
  }>,
  setPhaseStrategy: {
    buildCommands: (_proj, p: { phaseId: string; strategy: string; config?: Record<string, unknown> }) => {
      const commands: AnyCommand[] = [
        { type: 'screener.setPhaseProperty', payload: { phaseId: p.phaseId, property: 'strategy', value: p.strategy } },
      ];
      if (p.config !== undefined) {
        commands.push({
          type: 'screener.setPhaseProperty',
          payload: { phaseId: p.phaseId, property: 'config', value: p.config },
        });
      }
      return commands;
    },
    summary: (_proj, p: { phaseId: string; strategy: string }) => `Set phase '${p.phaseId}' strategy to '${p.strategy}'`,
    affectedPaths: (p: { phaseId: string }) => [p.phaseId],
  } satisfies ExecBatchSpec<{ phaseId: string; strategy: string; config?: Record<string, unknown> }>,
  updateScreenRoute: {
    buildCommands: (proj, p: {
      phaseId: string;
      routeIndex: number;
      changes: {
        condition?: string;
        target?: string;
        label?: string;
        message?: string;
        score?: string;
        threshold?: number;
        override?: boolean;
        terminal?: boolean;
      };
    }) => {
      if (p.changes.condition) definitionOps._validateFEL(proj, p.changes.condition);
      if (p.changes.score) definitionOps._validateFEL(proj, p.changes.score);
      const commands: AnyCommand[] = [];
      for (const [prop, val] of Object.entries(p.changes)) {
        if (val !== undefined) {
          commands.push({
            type: 'screener.setRouteProperty',
            payload: { phaseId: p.phaseId, index: p.routeIndex, property: prop, value: val },
          });
        }
      }
      return commands;
    },
    summary: (_proj, p: { phaseId: string; routeIndex: number }) => `Updated route ${p.routeIndex} in phase '${p.phaseId}'`,
    affectedPaths: (p: { phaseId: string }) => [p.phaseId],
    beforeDispatch: (proj, p) => {
      validatePhaseRoute(proj, p.phaseId, p.routeIndex);
    },
  } satisfies ExecBatchSpec<{
    phaseId: string;
    routeIndex: number;
    changes: {
      condition?: string;
      target?: string;
      label?: string;
      message?: string;
      score?: string;
      threshold?: number;
      override?: boolean;
      terminal?: boolean;
    };
  }>,
};

export function createScreenerDocument(project: ProjectInternals, options?: { url?: string; title?: string }): HelperResult {
  return exec(project, 'createScreenerDocument', options ?? {}, S.createScreenerDocument);
}

export function deleteScreenerDocument(project: ProjectInternals): HelperResult {
  return exec(project, 'deleteScreenerDocument', {}, S.deleteScreenerDocument);
}

export function addScreenField(project: ProjectInternals, key: string, label: string, type: string, props?: FieldProps): HelperResult {
  return execBatch(project, 'addScreenField', { key, label, type, props }, B.addScreenField);
}

export function removeScreenField(project: ProjectInternals, key: string): HelperResult {
  return exec(project, 'removeScreenField', { key }, S.removeScreenField);
}

export function updateScreenField(project: ProjectInternals, key: string, changes: { label?: string; helpText?: string; required?: boolean | string }): HelperResult {
  return execBatch(project, 'updateScreenField', { key, changes }, B.updateScreenField);
}

export function reorderScreenField(project: ProjectInternals, key: string, direction: 'up' | 'down'): HelperResult {
  const index = validateScreenerItemKey(project, key);
  return exec(project, 'reorderScreenField', { index, direction, key }, S.reorderScreenField);
}

export function addEvaluationPhase(project: ProjectInternals, id: string, strategy: string, label?: string): HelperResult {
  return exec(project, 'addEvaluationPhase', { id, strategy, label }, S.addEvaluationPhase);
}

export function removeEvaluationPhase(project: ProjectInternals, phaseId: string): HelperResult {
  return exec(project, 'removeEvaluationPhase', { phaseId }, S.removeEvaluationPhase);
}

export function reorderPhase(project: ProjectInternals, phaseId: string, direction: 'up' | 'down'): HelperResult {
  return exec(project, 'reorderPhase', { phaseId, direction }, S.reorderPhase);
}

export function setPhaseStrategy(project: ProjectInternals, phaseId: string, strategy: string, config?: Record<string, unknown>): HelperResult {
  return execBatch(project, 'setPhaseStrategy', { phaseId, strategy, config }, B.setPhaseStrategy);
}

export function addScreenRoute(project: ProjectInternals, phaseId: string, route: { condition?: string; target: string; label?: string; message?: string; score?: string; threshold?: number }, insertIndex?: number): HelperResult {
  return exec(project, 'addScreenRoute', { phaseId, route, insertIndex }, S.addScreenRoute);
}

export function updateScreenRoute(
  project: ProjectInternals,
  phaseId: string,
  routeIndex: number,
  changes: { condition?: string; target?: string; label?: string; message?: string; score?: string; threshold?: number; override?: boolean; terminal?: boolean },
): HelperResult {
  return execBatch(project, 'updateScreenRoute', { phaseId, routeIndex, changes }, B.updateScreenRoute);
}

export function reorderScreenRoute(project: ProjectInternals, phaseId: string, routeIndex: number, direction: 'up' | 'down'): HelperResult {
  return exec(project, 'reorderScreenRoute', { phaseId, routeIndex, direction }, S.reorderScreenRoute);
}

export function removeScreenRoute(project: ProjectInternals, phaseId: string, routeIndex: number): HelperResult {
  return exec(project, 'removeScreenRoute', { phaseId, routeIndex }, S.removeScreenRoute);
}

export function setScreenerAvailability(project: ProjectInternals, from?: string | null, until?: string | null): HelperResult {
  return exec(project, 'setScreenerAvailability', { from, until }, S.setScreenerAvailability);
}

export function setScreenerResultValidity(project: ProjectInternals, duration: string | null): HelperResult {
  return exec(project, 'setScreenerResultValidity', { duration }, S.setScreenerResultValidity);
}
