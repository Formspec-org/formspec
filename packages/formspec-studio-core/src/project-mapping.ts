import { exec, type DispatchSpec } from './lib/dispatch-helpers.js';
import type { HelperResult } from './helper-types.js';
import { HelperError } from './helper-types.js';
import type { ProjectInternals } from './project-internals.js';

const S = {
  setMappingProperty: {
    command: 'mapping.setProperty',
    payload: (p: { property: string; value: unknown; mappingId?: string }) =>
      ({ property: p.property, value: p.value, ...(p.mappingId !== undefined ? { mappingId: p.mappingId } : {}) }),
    summary: (p: { property: string }) => `Set mapping property '${p.property}'`,
    affectedPaths: (p: { mappingId?: string }) => [p.mappingId ?? 'default'],
  },
  setMappingTargetSchema: {
    command: 'mapping.setTargetSchema',
    payload: (p: { property: string; value: unknown; mappingId?: string }) =>
      ({ property: p.property, value: p.value, ...(p.mappingId !== undefined ? { mappingId: p.mappingId } : {}) }),
    summary: (p: { property: string }) => `Set mapping target schema '${p.property}'`,
    affectedPaths: (p: { mappingId?: string }) => [p.mappingId ?? 'default'],
  },
  addMappingRule: {
    command: 'mapping.addRule',
    summary: (p: { sourcePath?: string; targetPath?: string }) =>
      `Added mapping rule ${p.sourcePath ?? ''} → ${p.targetPath ?? ''}`,
    affectedPaths: (p: { sourcePath?: string }) => p.sourcePath ? [p.sourcePath] : [],
  },
  updateMappingRule: {
    command: 'mapping.setRule',
    payload: (p: { index: number; property: string; value: unknown; mappingId?: string }) =>
      ({ index: p.index, property: p.property, value: p.value, ...(p.mappingId !== undefined ? { mappingId: p.mappingId } : {}) }),
    summary: (p: { index: number; property: string }) => `Updated mapping rule ${p.index} property '${p.property}'`,
    affectedPaths: (p: { mappingId?: string }) => [p.mappingId ?? 'default'],
  },
  removeMappingRule: {
    command: 'mapping.deleteRule',
    payload: (p: { index: number; mappingId?: string }) =>
      ({ index: p.index, ...(p.mappingId !== undefined ? { mappingId: p.mappingId } : {}) }),
    summary: (p: { index: number }) => `Removed mapping rule ${p.index}`,
    affectedPaths: (p: { mappingId?: string }) => [p.mappingId ?? 'default'],
  },
  clearMappingRules: {
    command: 'mapping.clearRules',
    payload: (p: { mappingId?: string }) =>
      ({ ...(p.mappingId !== undefined ? { mappingId: p.mappingId } : {}) }),
    summary: () => 'Cleared all mapping rules',
    affectedPaths: (p: { mappingId?: string }) => [p.mappingId ?? 'default'],
  },
  reorderMappingRule: {
    command: 'mapping.reorderRule',
    payload: (p: { index: number; direction: 'up' | 'down'; mappingId?: string }) =>
      ({ index: p.index, direction: p.direction, ...(p.mappingId !== undefined ? { mappingId: p.mappingId } : {}) }),
    summary: (p: { index: number; direction: 'up' | 'down' }) => `Reordered mapping rule ${p.index} ${p.direction}`,
    affectedPaths: (p: { mappingId?: string }) => [p.mappingId ?? 'default'],
  },
  setMappingAdapter: {
    command: 'mapping.setAdapter',
    summary: (p: { format: string }) => `Configured '${p.format}' adapter`,
    affectedPaths: () => ['adapter'],
  },
  updateMappingDefaults: {
    command: 'mapping.setDefaults',
    summary: () => 'Updated mapping defaults',
    affectedPaths: () => ['defaults'],
  },
  autoGenerateMappingRules: {
    command: 'mapping.autoGenerateRules',
    summary: () => 'Auto-generated mapping rules',
    affectedPaths: (p: { mappingId?: string }) => [p.mappingId ?? 'default'],
  },
  createMapping: {
    command: 'mapping.create',
    payload: (p: { id: string; targetSchema?: Record<string, unknown> }) =>
      ({ id: p.id, ...(p.targetSchema ? { targetSchema: p.targetSchema } : {}) }),
    summary: (p: { id: string }) => `Created mapping '${p.id}'`,
    affectedPaths: (p: { id: string }) => [p.id],
    afterDispatch: (_project: ProjectInternals, p: { id: string }) => ({ createdId: p.id }),
  },
  selectMapping: {
    command: 'mapping.select',
    summary: (p: { id: string }) => `Selected mapping '${p.id}'`,
    affectedPaths: (p: { id: string }) => [p.id],
  },
} satisfies Record<string, DispatchSpec<any>>;

export function setMappingProperty(project: ProjectInternals, property: string, value: unknown, mappingId?: string): HelperResult {
  return exec(project, 'setMappingProperty', { property, value, mappingId }, S.setMappingProperty);
}

export function setMappingTargetSchema(project: ProjectInternals, property: string, value: unknown, mappingId?: string): HelperResult {
  return exec(project, 'setMappingTargetSchema', { property, value, mappingId }, S.setMappingTargetSchema);
}

export function addMappingRule(project: ProjectInternals, params: {
  sourcePath?: string;
  targetPath?: string;
  transform?: string;
  insertIndex?: number;
  mappingId?: string;
}): HelperResult {
  return exec(project, 'addMappingRule', params, S.addMappingRule);
}

export function updateMappingRule(project: ProjectInternals, index: number, property: string, value: unknown, mappingId?: string): HelperResult {
  return exec(project, 'updateMappingRule', { index, property, value, mappingId }, S.updateMappingRule);
}

export function removeMappingRule(project: ProjectInternals, index: number, mappingId?: string): HelperResult {
  return exec(project, 'removeMappingRule', { index, mappingId }, S.removeMappingRule);
}

export function clearMappingRules(project: ProjectInternals, mappingId?: string): HelperResult {
  return exec(project, 'clearMappingRules', { mappingId }, S.clearMappingRules);
}

export function reorderMappingRule(project: ProjectInternals, index: number, direction: 'up' | 'down', mappingId?: string): HelperResult {
  return exec(project, 'reorderMappingRule', { index, direction, mappingId }, S.reorderMappingRule);
}

export function setMappingAdapter(project: ProjectInternals, format: string, config: unknown): HelperResult {
  return exec(project, 'setMappingAdapter', { format, config }, S.setMappingAdapter);
}

export function updateMappingDefaults(project: ProjectInternals, defaults: Record<string, unknown>): HelperResult {
  return exec(project, 'updateMappingDefaults', { defaults }, S.updateMappingDefaults);
}

export function autoGenerateMappingRules(project: ProjectInternals, params: {
  mappingId?: string;
  scopePath?: string;
  priority?: number;
  replace?: boolean;
} = {}): HelperResult {
  return exec(project, 'autoGenerateMappingRules', params, S.autoGenerateMappingRules);
}

export function previewMapping(project: ProjectInternals, params: import('./types.js').MappingPreviewParams): import('./types.js').MappingPreviewResult {
  return project.core.previewMapping(params);
}

export function createMapping(project: ProjectInternals, id: string, options: { targetSchema?: Record<string, unknown> } = {}): HelperResult {
  return exec(project, 'createMapping', { id, ...options }, S.createMapping);
}

export function deleteMapping(project: ProjectInternals, id: string): HelperResult {
  const ids = Object.keys(project.core.mappings);
  if (ids.length <= 1) {
    throw new HelperError('MAPPING_MIN_COUNT', 'Cannot delete the last mapping document', { id });
  }
  if (!project.core.mappings[id]) {
    throw new HelperError('MAPPING_NOT_FOUND', `Mapping '${id}' does not exist`, { id });
  }
  project.core.dispatch({
    type: 'mapping.delete',
    payload: { id },
  } as import('@formspec-org/core').AnyCommand);
  return {
    summary: `Deleted mapping '${id}'`,
    action: { helper: 'deleteMapping', params: { id } },
    affectedPaths: [id],
  };
}

export function renameMapping(project: ProjectInternals, oldId: string, newId: string): HelperResult {
  if (!project.core.mappings[oldId]) {
    throw new HelperError('MAPPING_NOT_FOUND', `Mapping '${oldId}' does not exist`, { oldId });
  }
  if (project.core.mappings[newId]) {
    throw new HelperError('MAPPING_DUPLICATE_ID', `Mapping '${newId}' already exists`, { newId });
  }
  project.core.dispatch({
    type: 'mapping.rename',
    payload: { oldId, newId },
  } as import('@formspec-org/core').AnyCommand);
  return {
    summary: `Renamed mapping '${oldId}' to '${newId}'`,
    action: { helper: 'renameMapping', params: { oldId, newId } },
    affectedPaths: [oldId],
  };
}

export function selectMapping(project: ProjectInternals, id: string): HelperResult {
  return exec(project, 'selectMapping', { id }, S.selectMapping);
}
