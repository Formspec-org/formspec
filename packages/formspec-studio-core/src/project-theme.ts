import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult } from './helper-types.js';

export function setToken(project: any, key: string, value: string | null): HelperResult {
  project.core.dispatch({ type: 'theme.setToken', payload: { key, value } } as AnyCommand);
  return {
    summary: value === null ? `Deleted theme token '${key}'` : `Set theme token '${key}'`,
    action: { helper: 'setToken', params: { key, value } },
    affectedPaths: [],
  };
}

export function setThemeDefault(project: any, property: string, value: unknown): HelperResult {
  project.core.dispatch({ type: 'theme.setDefaults', payload: { property, value } } as AnyCommand);
  return {
    summary: `Set theme default '${property}'`,
    action: { helper: 'setThemeDefault', params: { property, value } },
    affectedPaths: [],
  };
}

export function setBreakpoint(project: any, name: string, minWidth: number | null): HelperResult {
  project.core.dispatch({ type: 'theme.setBreakpoint', payload: { name, minWidth } } as AnyCommand);
  return {
    summary: minWidth === null ? `Deleted breakpoint '${name}'` : `Set breakpoint '${name}' at ${minWidth}px`,
    action: { helper: 'setBreakpoint', params: { name, minWidth } },
    affectedPaths: [],
  };
}

export function setLocaleString(project: any, key: string, value: string, localeId?: string): HelperResult {
  project.core.dispatch({
    type: 'locale.setString',
    payload: { localeId, key, value },
  } as AnyCommand);
  return {
    summary: `Set locale string '${key}'`,
    action: { helper: 'setLocaleString', params: { localeId, key, value } },
    affectedPaths: [],
  };
}

export function removeLocaleString(project: any, key: string, localeId?: string): HelperResult {
  project.core.dispatch({
    type: 'locale.removeString',
    payload: { localeId, key },
  } as AnyCommand);
  return {
    summary: `Removed locale string '${key}'`,
    action: { helper: 'removeLocaleString', params: { localeId, key } },
    affectedPaths: [],
  };
}

export function setLocaleMetadata(project: any, property: string, value: unknown, localeId?: string): HelperResult {
  project.core.dispatch({
    type: 'locale.setMetadata',
    payload: { localeId, property, value },
  } as AnyCommand);
  return {
    summary: `Updated locale metadata '${property}'`,
    action: { helper: 'setLocaleMetadata', params: { localeId, property, value } },
    affectedPaths: [],
  };
}

export function addThemeSelector(project: any, match: Record<string, unknown>, apply: Record<string, unknown>): HelperResult {
  project.core.dispatch({ type: 'theme.addSelector', payload: { match, apply } } as AnyCommand);
  const selectors = project.core.state.theme.selectors ?? [];
  const newIndex = selectors.length - 1;
  return {
    summary: `Added theme selector`,
    action: { helper: 'addThemeSelector', params: { match, apply } },
    affectedPaths: [],
    createdId: String(newIndex),
  };
}

export function updateThemeSelector(project: any, index: number, changes: { match?: Record<string, unknown>; apply?: Record<string, unknown> }): HelperResult {
  project.core.dispatch({ type: 'theme.setSelector', payload: { index, ...changes } } as AnyCommand);
  return {
    summary: `Updated theme selector ${index}`,
    action: { helper: 'updateThemeSelector', params: { index, changes } },
    affectedPaths: [],
  };
}

export function deleteThemeSelector(project: any, index: number): HelperResult {
  project.core.dispatch({ type: 'theme.deleteSelector', payload: { index } } as AnyCommand);
  return {
    summary: `Deleted theme selector ${index}`,
    action: { helper: 'deleteThemeSelector', params: { index } },
    affectedPaths: [],
  };
}

export function reorderThemeSelector(project: any, index: number, direction: 'up' | 'down'): HelperResult {
  project.core.dispatch({ type: 'theme.reorderSelector', payload: { index, direction } } as AnyCommand);
  return {
    summary: `Reordered theme selector ${index} ${direction}`,
    action: { helper: 'reorderThemeSelector', params: { index, direction } },
    affectedPaths: [],
  };
}

export function addMigration(project: any, fromVersion: string, description?: string): HelperResult {
  project.core.dispatch({
    type: 'definition.addMigration',
    payload: { fromVersion, ...(description ? { description } : {}) },
  } as AnyCommand);
  return {
    summary: `Added migration '${fromVersion}'`,
    action: { helper: 'addMigration', params: { fromVersion, description } },
    affectedPaths: [],
  };
}

export function addMigrationRule(project: any, params: {
  fromVersion: string;
  source: string;
  target: string | null;
  transform: string;
  expression?: string;
  insertIndex?: number;
}): HelperResult {
  project.core.dispatch({
    type: 'definition.addFieldMapRule',
    payload: params,
  } as AnyCommand);
  return {
    summary: `Added migration rule for '${params.fromVersion}'`,
    action: { helper: 'addMigrationRule', params },
    affectedPaths: [],
  };
}

export function removeMigrationRule(project: any, fromVersion: string, index: number): HelperResult {
  project.core.dispatch({
    type: 'definition.deleteFieldMapRule',
    payload: { fromVersion, index },
  } as AnyCommand);
  return {
    summary: `Removed migration rule ${index} from '${fromVersion}'`,
    action: { helper: 'removeMigrationRule', params: { fromVersion, index } },
    affectedPaths: [],
  };
}

export function setItemOverride(project: any, itemKey: string, property: string, value: unknown): HelperResult {
  project.core.dispatch({ type: 'theme.setItemOverride', payload: { itemKey, property, value } } as AnyCommand);
  return {
    summary: `Set theme override '${property}' on item '${itemKey}'`,
    action: { helper: 'setItemOverride', params: { itemKey, property, value } },
    affectedPaths: [itemKey],
  };
}

export function clearItemOverrides(project: any, itemKey: string): HelperResult {
  project.core.dispatch({ type: 'theme.deleteItemOverride', payload: { itemKey } } as AnyCommand);
  return {
    summary: `Cleared all theme overrides for item '${itemKey}'`,
    action: { helper: 'clearItemOverrides', params: { itemKey } },
    affectedPaths: [itemKey],
  };
}
