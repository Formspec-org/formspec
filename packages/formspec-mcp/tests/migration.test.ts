/** @filedesc Tests for formspec_migration MCP tool: add_rule, remove_rule, list_rules. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleMigration } from '../src/tools/migration.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── add_rule ────────────────────────────────────────────────────────

describe('handleMigration — add_rule', () => {
  it('creates a migration descriptor and adds a field map rule', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '1.0.0',
      source: 'old_name',
      target: 'new_name',
      transform: 'rename',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.fromVersion).toBe('1.0.0');
    expect(data.ruleCount).toBe(1);
  });

  it('adds multiple rules to same version', () => {
    const { registry, projectId } = registryWithProject();

    handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '1.0.0',
      source: 'field_a',
      target: 'field_b',
      transform: 'rename',
    });
    const result = handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '1.0.0',
      source: 'field_c',
      target: null,
      transform: 'remove',
    });
    const data = parseResult(result);

    expect(data.ruleCount).toBe(2);
  });

  it('adds rule with expression', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '1.0.0',
      source: 'price',
      target: 'amount',
      transform: 'compute',
      expression: '$price * 100',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.ruleCount).toBe(1);
  });

  it('adds rule with description', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '1.0.0',
      description: 'Rename old fields',
      source: 'old',
      target: 'new',
      transform: 'rename',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.ruleCount).toBe(1);
  });
});

// ── remove_rule ─────────────────────────────────────────────────────

describe('handleMigration — remove_rule', () => {
  it('removes a rule by index', () => {
    const { registry, projectId } = registryWithProject();

    // Add two rules
    handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '1.0.0',
      source: 'a',
      target: 'b',
      transform: 'rename',
    });
    handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '1.0.0',
      source: 'c',
      target: 'd',
      transform: 'rename',
    });

    // Remove first rule
    const result = handleMigration(registry, projectId, {
      action: 'remove_rule',
      fromVersion: '1.0.0',
      ruleIndex: 0,
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.removedIndex).toBe(0);

    // Verify only one rule remains
    const listResult = handleMigration(registry, projectId, { action: 'list_rules' });
    const listData = parseResult(listResult);
    expect(listData.migrations['1.0.0'].fieldMap).toHaveLength(1);
    expect(listData.migrations['1.0.0'].fieldMap[0].source).toBe('c');
  });

  it('returns error for nonexistent version', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleMigration(registry, projectId, {
      action: 'remove_rule',
      fromVersion: '9.9.9',
      ruleIndex: 0,
    });

    expect(result.isError).toBe(true);
  });
});

// ── list_rules ──────────────────────────────────────────────────────

describe('handleMigration — list_rules', () => {
  it('returns empty migrations for fresh project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleMigration(registry, projectId, { action: 'list_rules' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.migrations).toEqual({});
  });

  it('lists rules for multiple versions', () => {
    const { registry, projectId } = registryWithProject();

    handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '1.0.0',
      source: 'a',
      target: 'b',
      transform: 'rename',
    });
    handleMigration(registry, projectId, {
      action: 'add_rule',
      fromVersion: '2.0.0',
      source: 'x',
      target: 'y',
      transform: 'rename',
    });

    const result = handleMigration(registry, projectId, { action: 'list_rules' });
    const data = parseResult(result);

    expect(Object.keys(data.migrations)).toHaveLength(2);
    expect(data.migrations['1.0.0'].fieldMap).toHaveLength(1);
    expect(data.migrations['2.0.0'].fieldMap).toHaveLength(1);
  });
});

// ── WRONG_PHASE ─────────────────────────────────────────────────────

describe('handleMigration — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleMigration(registry, projectId, { action: 'list_rules' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
