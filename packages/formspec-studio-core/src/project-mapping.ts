import type { AnyCommand } from '@formspec-org/core';
import { exec, execBatch, type DispatchSpec, type ExecBatchSpec } from './lib/dispatch-helpers.js';
import type { HelperResult } from './helper-types.js';
import { HelperError } from './helper-types.js';
import { requireItemPath } from './project-path-helpers.js';
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
  deleteMapping: {
    command: 'mapping.delete',
    payload: (p: { id: string }) => ({ id: p.id }),
    summary: (p: { id: string }) => `Deleted mapping '${p.id}'`,
    affectedPaths: (p: { id: string }) => [p.id],
    beforeDispatch: (project, p) => {
      const ids = Object.keys(project.core.mappings);
      if (ids.length <= 1) {
        throw new HelperError('MAPPING_MIN_COUNT', 'Cannot delete the last mapping document', { id: p.id });
      }
      if (!project.core.mappings[p.id]) {
        throw new HelperError('MAPPING_NOT_FOUND', `Mapping '${p.id}' does not exist`, { id: p.id });
      }
    },
  },
  renameMapping: {
    command: 'mapping.rename',
    payload: (p: { oldId: string; newId: string }) => ({ oldId: p.oldId, newId: p.newId }),
    summary: (p: { oldId: string; newId: string }) => `Renamed mapping '${p.oldId}' to '${p.newId}'`,
    affectedPaths: (p: { oldId: string }) => [p.oldId],
    beforeDispatch: (project, p) => {
      if (!project.core.mappings[p.oldId]) {
        throw new HelperError('MAPPING_NOT_FOUND', `Mapping '${p.oldId}' does not exist`, { oldId: p.oldId });
      }
      if (project.core.mappings[p.newId]) {
        throw new HelperError('MAPPING_DUPLICATE_ID', `Mapping '${p.newId}' already exists`, { newId: p.newId });
      }
    },
  },
  mapField: {
    command: 'mapping.addRule',
    payload: (p: { sourcePath: string; targetPath: string; mappingId?: string }) => ({
      sourcePath: p.sourcePath,
      targetPath: p.targetPath,
      ...(p.mappingId !== undefined ? { mappingId: p.mappingId } : {}),
    }),
    summary: (p: { sourcePath: string; targetPath: string }) => `Mapped "${p.sourcePath}" → "${p.targetPath}"`,
    affectedPaths: (p: { sourcePath: string }) => [p.sourcePath],
    beforeDispatch: (project, p) => {
      requireItemPath(project.core, p.sourcePath);
    },
  },
} satisfies Record<string, DispatchSpec<any>>;

const M = {
  unmapField: {
    buildCommands: (project, p: { sourcePath: string; mappingId?: string }) => {
      const mappingRules = project.core.mapping.rules ?? [];
      const indices = mappingRules
        .map((r, i) => (r.sourcePath === p.sourcePath ? i : -1))
        .filter((i) => i >= 0)
        .reverse();
      return indices.map(
        (idx) =>
          ({
            type: 'mapping.deleteRule',
            payload: { index: idx, ...(p.mappingId !== undefined ? { mappingId: p.mappingId } : {}) },
          }),
      );
    },
    summary: (project, p: { sourcePath: string }) => {
      const n = (project.core.mapping.rules ?? []).filter((r) => r.sourcePath === p.sourcePath).length;
      return `Unmapped "${p.sourcePath}" (${n} rule(s))`;
    },
    affectedPaths: (p: { sourcePath: string }) => [p.sourcePath],
  } satisfies ExecBatchSpec<{ sourcePath: string; mappingId?: string }>,
};

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
  return exec(project, 'deleteMapping', { id }, S.deleteMapping);
}

export function renameMapping(project: ProjectInternals, oldId: string, newId: string): HelperResult {
  return exec(project, 'renameMapping', { oldId, newId }, S.renameMapping);
}

export function selectMapping(project: ProjectInternals, id: string): HelperResult {
  return exec(project, 'selectMapping', { id }, S.selectMapping);
}

/** Add a mapping rule from a form field to an output target. */
export function mapField(
  project: ProjectInternals,
  sourcePath: string,
  targetPath: string,
  mappingId?: string,
): HelperResult {
  return exec(project, 'mapField', { sourcePath, targetPath, mappingId }, S.mapField);
}

/** Remove all mapping rules for a given source path. */
export function unmapField(project: ProjectInternals, sourcePath: string, mappingId?: string): HelperResult {
  return execBatch(project, 'unmapField', { sourcePath, mappingId }, M.unmapField);
}
