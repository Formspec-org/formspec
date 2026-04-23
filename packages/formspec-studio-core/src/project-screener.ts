import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult, FieldProps } from './helper-types.js';
import { HelperError } from './helper-types.js';

export function createScreenerDocument(project: any, options?: { url?: string; title?: string }): HelperResult {
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
    affectedPaths: [],
  };
}

export function deleteScreenerDocument(project: any): HelperResult {
  project.core.dispatch({ type: 'screener.remove', payload: {} });
  return {
    summary: 'Removed screener document',
    action: { helper: 'deleteScreenerDocument', params: {} },
    affectedPaths: [],
  };
}

export function addScreenField(project: any, key: string, label: string, type: string, props?: FieldProps): HelperResult {
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

export function removeScreenField(project: any, key: string): HelperResult {
  project.core.dispatch({ type: 'screener.deleteItem', payload: { key } });
  return {
    summary: `Removed screener field '${key}'`,
    action: { helper: 'removeScreenField', params: { key } },
    affectedPaths: [key],
  };
}

export function updateScreenField(project: any, key: string, changes: { label?: string; helpText?: string; required?: boolean | string }): HelperResult {
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

export function reorderScreenField(project: any, key: string, direction: 'up' | 'down'): HelperResult {
  const index = project._validateScreenerItemKey(key);
  project.core.dispatch({ type: 'screener.reorderItem', payload: { index, direction } });
  return {
    summary: `Reordered screener field '${key}' ${direction}`,
    action: { helper: 'reorderScreenField', params: { key, direction } },
    affectedPaths: [key],
  };
}

export function addEvaluationPhase(project: any, id: string, strategy: string, label?: string): HelperResult {
  project._getScreener();
  project.core.dispatch({ type: 'screener.addPhase', payload: { id, strategy, label } });
  return {
    summary: `Added evaluation phase '${id}' (${strategy ?? '(unspecified)'})`,
    action: { helper: 'addEvaluationPhase', params: { id, strategy, label } },
    affectedPaths: [],
  };
}

export function removeEvaluationPhase(project: any, phaseId: string): HelperResult {
  project.core.dispatch({ type: 'screener.removePhase', payload: { phaseId } });
  return {
    summary: `Removed evaluation phase '${phaseId}'`,
    action: { helper: 'removeEvaluationPhase', params: { phaseId } },
    affectedPaths: [],
  };
}

export function reorderPhase(project: any, phaseId: string, direction: 'up' | 'down'): HelperResult {
  project.core.dispatch({ type: 'screener.reorderPhase', payload: { phaseId, direction } });
  return {
    summary: `Reordered phase '${phaseId}' ${direction}`,
    action: { helper: 'reorderPhase', params: { phaseId, direction } },
    affectedPaths: [],
  };
}

export function setPhaseStrategy(project: any, phaseId: string, strategy: string, config?: Record<string, unknown>): HelperResult {
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
    affectedPaths: [],
  };
}

export function addScreenRoute(project: any, phaseId: string, route: { condition?: string; target: string; label?: string; message?: string; score?: string; threshold?: number }, insertIndex?: number): HelperResult {
  project._getScreener();
  if (route.condition) project._validateFEL(route.condition);
  if (route.score) project._validateFEL(route.score);
  project.core.dispatch({ type: 'screener.addRoute', payload: { phaseId, route, insertIndex } });
  return {
    summary: `Added route to '${route.target ?? '(unspecified)'}' in phase '${phaseId}'`,
    action: { helper: 'addScreenRoute', params: { phaseId, ...route } },
    affectedPaths: [],
  };
}

export function updateScreenRoute(
  project: any,
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
    affectedPaths: [],
  };
}

export function reorderScreenRoute(project: any, phaseId: string, routeIndex: number, direction: 'up' | 'down'): HelperResult {
  project._validatePhaseRoute(phaseId, routeIndex);
  project.core.dispatch({ type: 'screener.reorderRoute', payload: { phaseId, index: routeIndex, direction } });
  return {
    summary: `Reordered route ${routeIndex} in phase '${phaseId}' ${direction}`,
    action: { helper: 'reorderScreenRoute', params: { phaseId, routeIndex, direction } },
    affectedPaths: [],
  };
}

export function removeScreenRoute(project: any, phaseId: string, routeIndex: number): HelperResult {
  project._validatePhaseRoute(phaseId, routeIndex);
  project.core.dispatch({ type: 'screener.deleteRoute', payload: { phaseId, index: routeIndex } });
  return {
    summary: `Removed route ${routeIndex} from phase '${phaseId}'`,
    action: { helper: 'removeScreenRoute', params: { phaseId, routeIndex } },
    affectedPaths: [],
  };
}

export function setScreenerAvailability(project: any, from?: string | null, until?: string | null): HelperResult {
  project._getScreener();
  project.core.dispatch({ type: 'screener.setAvailability', payload: { from, until } });
  return {
    summary: 'Updated screener availability',
    action: { helper: 'setScreenerAvailability', params: { from, until } },
    affectedPaths: [],
  };
}

export function setScreenerResultValidity(project: any, duration: string | null): HelperResult {
  project._getScreener();
  project.core.dispatch({ type: 'screener.setResultValidity', payload: { duration } });
  return {
    summary: duration ? `Set result validity to ${duration}` : 'Cleared result validity',
    action: { helper: 'setScreenerResultValidity', params: { duration } },
    affectedPaths: [],
  };
}
