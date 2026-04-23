import type { AnyCommand } from '@formspec-org/core';
import type { HelperResult } from './helper-types.js';
import { HelperError } from './helper-types.js';

export function setMappingProperty(project: any, property: string, value: unknown, mappingId?: string): HelperResult {
  project.core.dispatch({
    type: 'mapping.setProperty',
    payload: { property, value, ...(mappingId !== undefined ? { mappingId } : {}) },
  } as AnyCommand);
  return {
    summary: `Set mapping property '${property}'`,
    action: { helper: 'setMappingProperty', params: { property, value, mappingId } },
    affectedPaths: [],
  };
}

export function setMappingTargetSchema(project: any, property: string, value: unknown, mappingId?: string): HelperResult {
  project.core.dispatch({
    type: 'mapping.setTargetSchema',
    payload: { property, value, ...(mappingId !== undefined ? { mappingId } : {}) },
  } as AnyCommand);
  return {
    summary: `Set mapping target schema '${property}'`,
    action: { helper: 'setMappingTargetSchema', params: { property, value, mappingId } },
    affectedPaths: [],
  };
}

export function addMappingRule(project: any, params: {
  sourcePath?: string;
  targetPath?: string;
  transform?: string;
  insertIndex?: number;
  mappingId?: string;
}): HelperResult {
  project.core.dispatch({
    type: 'mapping.addRule',
    payload: params,
  } as AnyCommand);
  return {
    summary: `Added mapping rule ${params.sourcePath ?? ''} → ${params.targetPath ?? ''}`,
    action: { helper: 'addMappingRule', params },
    affectedPaths: params.sourcePath ? [params.sourcePath] : [],
  };
}

export function updateMappingRule(project: any, index: number, property: string, value: unknown, mappingId?: string): HelperResult {
  project.core.dispatch({
    type: 'mapping.setRule',
    payload: { index, property, value, ...(mappingId !== undefined ? { mappingId } : {}) },
  } as AnyCommand);
  return {
    summary: `Updated mapping rule ${index} property '${property}'`,
    action: { helper: 'updateMappingRule', params: { index, property, value, mappingId } },
    affectedPaths: [],
  };
}

export function removeMappingRule(project: any, index: number, mappingId?: string): HelperResult {
  project.core.dispatch({
    type: 'mapping.deleteRule',
    payload: { index, ...(mappingId !== undefined ? { mappingId } : {}) },
  } as AnyCommand);
  return {
    summary: `Removed mapping rule ${index}`,
    action: { helper: 'removeMappingRule', params: { index, mappingId } },
    affectedPaths: [],
  };
}

export function clearMappingRules(project: any, mappingId?: string): HelperResult {
  project.core.dispatch({
    type: 'mapping.clearRules',
    payload: { ...(mappingId !== undefined ? { mappingId } : {}) },
  } as AnyCommand);
  return {
    summary: 'Cleared all mapping rules',
    action: { helper: 'clearMappingRules', params: { mappingId } },
    affectedPaths: [],
  };
}

export function reorderMappingRule(project: any, index: number, direction: 'up' | 'down', mappingId?: string): HelperResult {
  project.core.dispatch({
    type: 'mapping.reorderRule',
    payload: { index, direction, ...(mappingId !== undefined ? { mappingId } : {}) },
  } as AnyCommand);
  return {
    summary: `Reordered mapping rule ${index} ${direction}`,
    action: { helper: 'reorderMappingRule', params: { index, direction, mappingId } },
    affectedPaths: [],
  };
}

export function setMappingAdapter(project: any, format: string, config: unknown): HelperResult {
  project.core.dispatch({
    type: 'mapping.setAdapter',
    payload: { format, config },
  } as AnyCommand);
  return {
    summary: `Configured '${format}' adapter`,
    action: { helper: 'setMappingAdapter', params: { format, config } },
    affectedPaths: [],
  };
}

export function updateMappingDefaults(project: any, defaults: Record<string, unknown>): HelperResult {
  project.core.dispatch({
    type: 'mapping.setDefaults',
    payload: { defaults },
  } as AnyCommand);
  return {
    summary: 'Updated mapping defaults',
    action: { helper: 'updateMappingDefaults', params: { defaults } },
    affectedPaths: [],
  };
}

export function autoGenerateMappingRules(project: any, params: {
  mappingId?: string;
  scopePath?: string;
  priority?: number;
  replace?: boolean;
} = {}): HelperResult {
  project.core.dispatch({
    type: 'mapping.autoGenerateRules',
    payload: params,
  } as AnyCommand);
  return {
    summary: 'Auto-generated mapping rules',
    action: { helper: 'autoGenerateMappingRules', params },
    affectedPaths: [],
  };
}

export function previewMapping(project: any, params: import('./types.js').MappingPreviewParams): import('./types.js').MappingPreviewResult {
  return project.core.previewMapping(params);
}

export function createMapping(project: any, id: string, options: { targetSchema?: Record<string, unknown> } = {}): HelperResult {
  project.core.dispatch({
    type: 'mapping.create',
    payload: { id, ...options },
  } as AnyCommand);
  return {
    summary: `Created mapping '${id}'`,
    action: { helper: 'createMapping', params: { id, options } },
    affectedPaths: [],
    createdId: id,
  };
}

export function deleteMapping(project: any, id: string): HelperResult {
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
  } as AnyCommand);
  return {
    summary: `Deleted mapping '${id}'`,
    action: { helper: 'deleteMapping', params: { id } },
    affectedPaths: [],
  };
}

export function renameMapping(project: any, oldId: string, newId: string): HelperResult {
  if (!project.core.mappings[oldId]) {
    throw new HelperError('MAPPING_NOT_FOUND', `Mapping '${oldId}' does not exist`, { oldId });
  }
  if (project.core.mappings[newId]) {
    throw new HelperError('MAPPING_DUPLICATE_ID', `Mapping '${newId}' already exists`, { newId });
  }
  project.core.dispatch({
    type: 'mapping.rename',
    payload: { oldId, newId },
  } as AnyCommand);
  return {
    summary: `Renamed mapping '${oldId}' to '${newId}'`,
    action: { helper: 'renameMapping', params: { oldId, newId } },
    affectedPaths: [],
  };
}

export function selectMapping(project: any, id: string): HelperResult {
  project.core.dispatch({
    type: 'mapping.select',
    payload: { id },
  } as AnyCommand);
  return {
    summary: `Selected mapping '${id}'`,
    action: { helper: 'selectMapping', params: { id } },
    affectedPaths: [],
  };
}
