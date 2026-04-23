import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult, FieldProps } from './helper-types.js';
import { exec, type DispatchSpec } from './lib/dispatch-helpers.js';
import type { ProjectInternals } from './project-internals.js';

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
    summary: (p: { id: string; strategy: string }) =>
      `Added evaluation phase '${p.id}' (${p.strategy ?? '(unspecified)'})`,
    affectedPaths: (p: { id: string }) => [p.id],
    beforeDispatch: (project: ProjectInternals) => { project._getScreener(); },
  },
  removeScreenRoute: {
    command: 'screener.deleteRoute',
    payload: (p: { phaseId: string; routeIndex: number }) =>
      ({ phaseId: p.phaseId, index: p.routeIndex }),
    summary: (p: { phaseId: string; routeIndex: number }) =>
      `Removed route ${p.routeIndex} from phase '${p.phaseId}'`,
    affectedPaths: (p: { phaseId: string }) => [p.phaseId],
    beforeDispatch: (project: ProjectInternals, p: { phaseId: string; routeIndex: number }) => {
      project._validatePhaseRoute(p.phaseId, p.routeIndex);
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
      project._validatePhaseRoute(p.phaseId, p.routeIndex);
    },
  },
  setScreenerAvailability: {
    command: 'screener.setAvailability',
    summary: () => 'Updated screener availability',
    affectedPaths: () => ['screener.availability'],
    beforeDispatch: (project: ProjectInternals) => { project._getScreener(); },
  },
  setScreenerResultValidity: {
    command: 'screener.setResultValidity',
    summary: (p: { duration: string | null }) =>
      p.duration ? `Set result validity to ${p.duration}` : 'Cleared result validity',
    affectedPaths: () => ['screener.validity'],
    beforeDispatch: (project: ProjectInternals) => { project._getScreener(); },
  },
} satisfies Record<string, DispatchSpec<any>>;

export function createScreenerDocument(project: ProjectInternals, options?: { url?: string; title?: string }): HelperResult {
  const doc = {
    $formspecScreener: '1.0' as const,
    url: options?.url ?? '',
    version: '1.0.0',
    title: options?.title ?? 'Screener',
    items: [],
    evaluation: [{ id: 'default', strategy: 'first-match', routes: [] }],
  };
  project.core.dispatch({ type: 'screener.setDocument', payload: doc });
  return {
    summary: 'Created screener document',
    action: { helper: 'createScreenerDocument', params: options ?? {} },
    affectedPaths: ['screener'],
  };
}

export function deleteScreenerDocument(project: ProjectInternals): HelperResult {
  return exec(project, 'deleteScreenerDocument', {}, S.deleteScreenerDocument);
}

export function addScreenField(project: ProjectInternals, key: string, label: string, type: string, props?: FieldProps): HelperResult {
  project._getScreener();
  const { resolved, extensionName, combinedConstraintExpr } = project._resolveAuthoringFieldType(type);
  const payload: Record<string, unknown> = {
    type: 'field',
    key,
    label,
    dataType: resolved.dataType,
  };
  if (extensionName) payload.extensions = { [extensionName]: true };
  project.core.dispatch({ type: 'screener.addItem', payload });
  if (combinedConstraintExpr) {
    project.core.dispatch({
      type: 'screener.setBind',
      payload: { path: key, properties: { constraint: combinedConstraintExpr } },
    });
  }
  return {
    summary: `Added screener field '${key}'`,
    action: { helper: 'addScreenField', params: { key, label, type } },
    affectedPaths: [key],
  };
}

export function removeScreenField(project: ProjectInternals, key: string): HelperResult {
  return exec(project, 'removeScreenField', { key }, S.removeScreenField);
}

export function updateScreenField(project: ProjectInternals, key: string, changes: { label?: string; helpText?: string; required?: boolean | string }): HelperResult {
  project._validateScreenerItemKey(key);
  const commands: AnyCommand[] = [];

  for (const prop of ['label', 'helpText'] as const) {
    if (prop in changes) {
      commands.push({
        type: 'screener.setItemProperty',
        payload: { key, property: prop, value: changes[prop as keyof typeof changes] },
      });
    }
  }

  if ('required' in changes) {
    const val = changes.required;
    let bindValue: unknown;
    if (val === true) bindValue = 'true';
    else if (val === false) bindValue = null;
    else bindValue = val;
    commands.push({
      type: 'screener.setBind',
      payload: { path: key, properties: { required: bindValue } },
    });
  }

  if (commands.length > 0) project.core.dispatch(commands);
  return {
    summary: `Updated screener field '${key}'`,
    action: { helper: 'updateScreenField', params: { key, ...changes } },
    affectedPaths: [key],
  };
}

export function reorderScreenField(project: ProjectInternals, key: string, direction: 'up' | 'down'): HelperResult {
  const index = project._validateScreenerItemKey(key);
  project.core.dispatch({ type: 'screener.reorderItem', payload: { index, direction } });
  return {
    summary: `Reordered screener field '${key}' ${direction}`,
    action: { helper: 'reorderScreenField', params: { key, direction } },
    affectedPaths: [key],
  };
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
  const commands: AnyCommand[] = [
    { type: 'screener.setPhaseProperty', payload: { phaseId, property: 'strategy', value: strategy } },
  ];
  if (config !== undefined) {
    commands.push({ type: 'screener.setPhaseProperty', payload: { phaseId, property: 'config', value: config } });
  }
  project.core.dispatch(commands);
  return {
    summary: `Set phase '${phaseId}' strategy to '${strategy}'`,
    action: { helper: 'setPhaseStrategy', params: { phaseId, strategy, config } },
    affectedPaths: [phaseId],
  };
}

export function addScreenRoute(project: ProjectInternals, phaseId: string, route: { condition?: string; target: string; label?: string; message?: string; score?: string; threshold?: number }, insertIndex?: number): HelperResult {
  project._getScreener();
  if (route.condition) project._validateFEL(route.condition);
  if (route.score) project._validateFEL(route.score);
  project.core.dispatch({ type: 'screener.addRoute', payload: { phaseId, route, insertIndex } });
  return {
    summary: `Added route to '${route.target ?? '(unspecified)'}' in phase '${phaseId}'`,
    action: { helper: 'addScreenRoute', params: { phaseId, ...route } },
    affectedPaths: [phaseId],
  };
}

export function updateScreenRoute(
  project: ProjectInternals,
  phaseId: string,
  routeIndex: number,
  changes: { condition?: string; target?: string; label?: string; message?: string; score?: string; threshold?: number; override?: boolean; terminal?: boolean },
): HelperResult {
  project._validatePhaseRoute(phaseId, routeIndex);
  if (changes.condition) project._validateFEL(changes.condition);
  if (changes.score) project._validateFEL(changes.score);

  const commands: AnyCommand[] = [];
  for (const [prop, val] of Object.entries(changes)) {
    if (val !== undefined) {
      commands.push({
        type: 'screener.setRouteProperty',
        payload: { phaseId, index: routeIndex, property: prop, value: val },
      });
    }
  }
  if (commands.length > 0) project.core.dispatch(commands);
  return {
    summary: `Updated route ${routeIndex} in phase '${phaseId}'`,
    action: { helper: 'updateScreenRoute', params: { phaseId, routeIndex, ...changes } },
    affectedPaths: [phaseId],
  };
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
