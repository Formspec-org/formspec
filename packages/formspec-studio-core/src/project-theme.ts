import { exec, type DispatchSpec } from './lib/dispatch-helpers.js';
import type { HelperResult } from './helper-types.js';
import type { ProjectInternals } from './project-internals.js';

const S = {
  setToken: {
    command: 'theme.setToken',
    summary: (p: { key: string; value: string | null }) =>
      p.value === null ? `Deleted theme token '${p.key}'` : `Set theme token '${p.key}'`,
    affectedPaths: (p: { key: string }) => [p.key],
  },
  setThemeDefault: {
    command: 'theme.setDefaults',
    summary: (p: { property: string }) => `Set theme default '${p.property}'`,
    affectedPaths: (p: { property: string }) => [p.property],
  },
  setBreakpoint: {
    command: 'theme.setBreakpoint',
    summary: (p: { name: string; minWidth: number | null }) =>
      p.minWidth === null ? `Deleted breakpoint '${p.name}'` : `Set breakpoint '${p.name}' at ${p.minWidth}px`,
    affectedPaths: (p: { name: string }) => [p.name],
  },
  setLocaleString: {
    command: 'locale.setString',
    summary: (p: { key: string }) => `Set locale string '${p.key}'`,
    affectedPaths: (p: { key: string }) => [p.key],
  },
  removeLocaleString: {
    command: 'locale.removeString',
    summary: (p: { key: string }) => `Removed locale string '${p.key}'`,
    affectedPaths: (p: { key: string }) => [p.key],
  },
  setLocaleMetadata: {
    command: 'locale.setMetadata',
    summary: (p: { property: string }) => `Updated locale metadata '${p.property}'`,
    affectedPaths: (p: { property: string }) => [p.property],
  },
  addThemeSelector: {
    command: 'theme.addSelector',
    summary: () => `Added theme selector`,
    affectedPaths: () => ['selectors'],
    afterDispatch: (project: ProjectInternals) => {
      const selectors = project.core.state.theme.selectors ?? [];
      return { createdId: String(selectors.length - 1) };
    },
  },
  updateThemeSelector: {
    command: 'theme.setSelector',
    payload: (p: { index: number; changes: { match?: Record<string, unknown>; apply?: Record<string, unknown> } }) =>
      ({ index: p.index, ...p.changes }),
    summary: (p: { index: number }) => `Updated theme selector ${p.index}`,
    affectedPaths: () => ['selectors'],
  },
  deleteThemeSelector: {
    command: 'theme.deleteSelector',
    summary: (p: { index: number }) => `Deleted theme selector ${p.index}`,
    affectedPaths: () => ['selectors'],
  },
  reorderThemeSelector: {
    command: 'theme.reorderSelector',
    summary: (p: { index: number; direction: 'up' | 'down' }) =>
      `Reordered theme selector ${p.index} ${p.direction}`,
    affectedPaths: () => ['selectors'],
  },
  addMigration: {
    command: 'definition.addMigration',
    payload: (p: { fromVersion: string; description?: string }) =>
      ({ fromVersion: p.fromVersion, ...(p.description ? { description: p.description } : {}) }),
    summary: (p: { fromVersion: string }) => `Added migration '${p.fromVersion}'`,
    affectedPaths: (p: { fromVersion: string }) => [p.fromVersion],
  },
  addMigrationRule: {
    command: 'definition.addFieldMapRule',
    summary: (p: { fromVersion: string }) => `Added migration rule for '${p.fromVersion}'`,
    affectedPaths: (p: { fromVersion: string }) => [p.fromVersion],
  },
  removeMigrationRule: {
    command: 'definition.deleteFieldMapRule',
    summary: (p: { fromVersion: string; index: number }) =>
      `Removed migration rule ${p.index} from '${p.fromVersion}'`,
    affectedPaths: (p: { fromVersion: string }) => [p.fromVersion],
  },
  setItemOverride: {
    command: 'theme.setItemOverride',
    summary: (p: { itemKey: string; property: string }) =>
      `Set theme override '${p.property}' on item '${p.itemKey}'`,
    affectedPaths: (p: { itemKey: string }) => [p.itemKey],
  },
  clearItemOverrides: {
    command: 'theme.deleteItemOverride',
    summary: (p: { itemKey: string }) => `Cleared all theme overrides for item '${p.itemKey}'`,
    affectedPaths: (p: { itemKey: string }) => [p.itemKey],
  },
} satisfies Record<string, DispatchSpec<any>>;

export function setToken(project: ProjectInternals, key: string, value: string | null): HelperResult {
  return exec(project, 'setToken', { key, value }, S.setToken);
}

export function setThemeDefault(project: ProjectInternals, property: string, value: unknown): HelperResult {
  return exec(project, 'setThemeDefault', { property, value }, S.setThemeDefault);
}

export function setBreakpoint(project: ProjectInternals, name: string, minWidth: number | null): HelperResult {
  return exec(project, 'setBreakpoint', { name, minWidth }, S.setBreakpoint);
}

export function setLocaleString(project: ProjectInternals, key: string, value: string, localeId?: string): HelperResult {
  return exec(project, 'setLocaleString', { localeId, key, value }, S.setLocaleString);
}

export function removeLocaleString(project: ProjectInternals, key: string, localeId?: string): HelperResult {
  return exec(project, 'removeLocaleString', { localeId, key }, S.removeLocaleString);
}

export function setLocaleMetadata(project: ProjectInternals, property: string, value: unknown, localeId?: string): HelperResult {
  return exec(project, 'setLocaleMetadata', { localeId, property, value }, S.setLocaleMetadata);
}

export function addThemeSelector(project: ProjectInternals, match: Record<string, unknown>, apply: Record<string, unknown>): HelperResult {
  return exec(project, 'addThemeSelector', { match, apply }, S.addThemeSelector);
}

export function updateThemeSelector(project: ProjectInternals, index: number, changes: { match?: Record<string, unknown>; apply?: Record<string, unknown> }): HelperResult {
  return exec(project, 'updateThemeSelector', { index, changes }, S.updateThemeSelector);
}

export function deleteThemeSelector(project: ProjectInternals, index: number): HelperResult {
  return exec(project, 'deleteThemeSelector', { index }, S.deleteThemeSelector);
}

export function reorderThemeSelector(project: ProjectInternals, index: number, direction: 'up' | 'down'): HelperResult {
  return exec(project, 'reorderThemeSelector', { index, direction }, S.reorderThemeSelector);
}

export function addMigration(project: ProjectInternals, fromVersion: string, description?: string): HelperResult {
  return exec(project, 'addMigration', { fromVersion, description }, S.addMigration);
}

export function addMigrationRule(project: ProjectInternals, params: {
  fromVersion: string;
  source: string;
  target: string | null;
  transform: string;
  expression?: string;
  insertIndex?: number;
}): HelperResult {
  return exec(project, 'addMigrationRule', params, S.addMigrationRule);
}

export function removeMigrationRule(project: ProjectInternals, fromVersion: string, index: number): HelperResult {
  return exec(project, 'removeMigrationRule', { fromVersion, index }, S.removeMigrationRule);
}

export function setItemOverride(project: ProjectInternals, itemKey: string, property: string, value: unknown): HelperResult {
  return exec(project, 'setItemOverride', { itemKey, property, value }, S.setItemOverride);
}

export function clearItemOverrides(project: ProjectInternals, itemKey: string): HelperResult {
  return exec(project, 'clearItemOverrides', { itemKey }, S.clearItemOverrides);
}
