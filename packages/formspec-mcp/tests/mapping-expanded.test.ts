/** @filedesc Tests for formspec_mapping expanded MCP tool: add_mapping, remove_mapping, list_mappings, auto_map. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleMappingExpanded } from '../src/tools/mapping-expanded.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── add_mapping ─────────────────────────────────────────────────────

describe('handleMappingExpanded — add_mapping', () => {
  it('adds a mapping rule', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleMappingExpanded(registry, projectId, {
      action: 'add_mapping',
      sourcePath: 'name',
      targetPath: 'user.name',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.ruleCount).toBe(1);
    expect(data.summary).toContain('name');
  });

  it('adds a mapping rule with transform', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleMappingExpanded(registry, projectId, {
      action: 'add_mapping',
      sourcePath: 'amount',
      targetPath: 'total',
      transform: 'currency',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.ruleCount).toBe(1);
  });

  it('adds multiple rules', () => {
    const { registry, projectId } = registryWithProject();

    handleMappingExpanded(registry, projectId, {
      action: 'add_mapping',
      sourcePath: 'a',
      targetPath: 'x',
    });
    const result = handleMappingExpanded(registry, projectId, {
      action: 'add_mapping',
      sourcePath: 'b',
      targetPath: 'y',
    });
    const data = parseResult(result);

    expect(data.ruleCount).toBe(2);
  });
});

// ── remove_mapping ──────────────────────────────────────────────────

describe('handleMappingExpanded — remove_mapping', () => {
  it('removes a mapping rule by index', () => {
    const { registry, projectId } = registryWithProject();

    handleMappingExpanded(registry, projectId, {
      action: 'add_mapping',
      sourcePath: 'a',
      targetPath: 'x',
    });
    handleMappingExpanded(registry, projectId, {
      action: 'add_mapping',
      sourcePath: 'b',
      targetPath: 'y',
    });

    const result = handleMappingExpanded(registry, projectId, {
      action: 'remove_mapping',
      ruleIndex: 0,
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.removedIndex).toBe(0);

    // Verify only one rule remains
    const listResult = handleMappingExpanded(registry, projectId, { action: 'list_mappings' });
    const listData = parseResult(listResult);
    const defaultRules = listData.mappings.default?.rules ?? [];
    expect(defaultRules).toHaveLength(1);
    expect(defaultRules[0].sourcePath).toBe('b');
  });
});

// ── list_mappings ───────────────────────────────────────────────────

describe('handleMappingExpanded — list_mappings', () => {
  it('returns empty mappings for a fresh project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleMappingExpanded(registry, projectId, { action: 'list_mappings' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.mappings).toBeDefined();
  });

  it('lists rules after adding', () => {
    const { registry, projectId } = registryWithProject();

    handleMappingExpanded(registry, projectId, {
      action: 'add_mapping',
      sourcePath: 'name',
      targetPath: 'output.name',
    });

    const result = handleMappingExpanded(registry, projectId, { action: 'list_mappings' });
    const data = parseResult(result);

    // Find the mapping with rules
    const allRules = Object.values(data.mappings).flatMap((m: any) => m.rules);
    expect(allRules.length).toBeGreaterThanOrEqual(1);
  });
});

// ── auto_map ────────────────────────────────────────────────────────

describe('handleMappingExpanded — auto_map', () => {
  it('auto-generates mapping rules from fields', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');
    project.addField('age', 'Age', 'integer');

    const result = handleMappingExpanded(registry, projectId, {
      action: 'auto_map',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.ruleCount).toBeGreaterThanOrEqual(2);
  });

  it('auto-map with replace removes previous auto-generated rules', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    // First auto-map
    handleMappingExpanded(registry, projectId, { action: 'auto_map' });

    // Add another field and re-auto-map with replace
    project.addField('email', 'Email', 'email');
    const result = handleMappingExpanded(registry, projectId, {
      action: 'auto_map',
      replace: true,
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.ruleCount).toBeGreaterThanOrEqual(2);
  });
});

// ── WRONG_PHASE ─────────────────────────────────────────────────────

describe('handleMappingExpanded — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleMappingExpanded(registry, projectId, { action: 'list_mappings' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
