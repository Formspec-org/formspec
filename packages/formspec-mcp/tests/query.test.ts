import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import {
  handleAudit,
  handleDescribe,
  handlePreview,
  handleSearch,
  handleTrace,
  handleValidateResponse,
} from '../src/tools/query.js';
import {
  handleFelContext,
  handleFelFunctions,
  handleFelCheck,
} from '../src/tools/fel.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── handleAudit ────────────────────────────────────────────────────

describe('handleAudit', () => {
  it('returns diagnostics with counts for a fresh project', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleAudit(registry, projectId);
    const data = parseResult(result);

    expect(data).toHaveProperty('counts');
    expect(data.counts).toHaveProperty('error');
    expect(data.counts).toHaveProperty('warning');
    expect(data.counts).toHaveProperty('info');
    expect(typeof data.counts.error).toBe('number');
  });

  it('returns categorized diagnostic arrays', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleAudit(registry, projectId);
    const data = parseResult(result);

    expect(data).toHaveProperty('structural');
    expect(data).toHaveProperty('expressions');
    expect(data).toHaveProperty('extensions');
    expect(data).toHaveProperty('consistency');
    expect(Array.isArray(data.structural)).toBe(true);
    expect(Array.isArray(data.expressions)).toBe(true);
  });
});

// ── handleDescribe ─────────────────────────────────────────────────

describe('handleDescribe', () => {
  it('returns statistics and fieldPaths without a target', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Question 1', 'text');

    const result = handleDescribe(registry, projectId);
    const data = parseResult(result);

    expect(data).toHaveProperty('statistics');
    expect(data).toHaveProperty('fieldPaths');
    expect(data.fieldPaths).toContain('q1');
  });

  it('returns item and bind info with a target path', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Question 1', 'text');

    const result = handleDescribe(registry, projectId, 'q1');
    const data = parseResult(result);

    expect(data).toHaveProperty('item');
    expect(data.item).toHaveProperty('key', 'q1');
    expect(data.item).toHaveProperty('label', 'Question 1');
  });

  it('returns item: null for a non-existent path', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleDescribe(registry, projectId, 'nonexistent');
    const data = parseResult(result);

    expect(data.item).toBeNull();
  });
});

// ── handlePreview ──────────────────────────────────────────────────

describe('handlePreview', () => {
  it('returns visibleFields after adding a field', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Full Name', 'text');

    const result = handlePreview(registry, projectId);
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(data).toHaveProperty('visibleFields');
    expect(data.visibleFields).toContain('name');
  });

  it('returns currentValues, requiredFields, and validationState', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('age', 'Age', 'integer');

    const result = handlePreview(registry, projectId);
    const data = parseResult(result);

    expect(data).toHaveProperty('currentValues');
    expect(data).toHaveProperty('requiredFields');
    expect(data).toHaveProperty('validationState');
  });

  it('applies scenario values', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('color', 'Color', 'text');

    const result = handlePreview(registry, projectId, { color: 'blue' });
    const data = parseResult(result);

    expect(data.currentValues.color).toBe('blue');
  });
});

// ── handleSearch ───────────────────────────────────────────────────

describe('handleSearch', () => {
  it('returns matching fields filtered by type', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Question 1', 'text');
    project.addGroup('g1', 'Group 1');

    const result = handleSearch(registry, projectId, { type: 'field' });
    const data = parseResult(result);

    expect(data).toHaveProperty('items');
    expect(data.items.some((i: any) => i.key === 'q1')).toBe(true);
  });

  it('returns matching fields filtered by dataType', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Question 1', 'text');
    project.addField('q2', 'Question 2', 'number');

    // 'text' alias resolves to dataType 'text'; 'number' alias resolves to 'decimal'
    const result = handleSearch(registry, projectId, { dataType: 'text' });
    const data = parseResult(result);

    expect(data.items.some((i: any) => i.key === 'q1')).toBe(true);
    expect(data.items.some((i: any) => i.key === 'q2')).toBe(false);
  });

  it('returns all items when no filter criteria', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleSearch(registry, projectId, {});
    const data = parseResult(result);

    expect(data.items.length).toBeGreaterThanOrEqual(1);
  });
});

// ── handleTrace ────────────────────────────────────────────────────

describe('handleTrace', () => {
  it('returns dependencies for an expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');
    project.addField('q2', 'Q2', 'text');

    const result = handleTrace(registry, projectId, '$q1 + $q2');
    const data = parseResult(result);

    expect(data).toHaveProperty('type', 'expression');
    expect(data).toHaveProperty('dependencies');
    expect(data.dependencies).toContain('q1');
    expect(data.dependencies).toContain('q2');
  });

  it('returns dependents for a field path', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleTrace(registry, projectId, 'q1');
    const data = parseResult(result);

    expect(data).toHaveProperty('type', 'field');
    expect(data).toHaveProperty('dependents');
    expect(data.dependents).toHaveProperty('binds');
    expect(data.dependents).toHaveProperty('shapes');
    expect(data.dependents).toHaveProperty('variables');
  });
});

// ── handleValidateResponse ─────────────────────────────────────────

describe('handleValidateResponse', () => {
  it('returns a validation report', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleValidateResponse(registry, projectId, { q1: 'hello' });
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    // ValidationReport has results array
    expect(data).toHaveProperty('results');
  });
});

// ── handleFelContext ───────────────────────────────────────────────

describe('handleFelContext', () => {
  it('returns available references', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleFelContext(registry, projectId);
    const data = parseResult(result);

    expect(data).toHaveProperty('fields');
    expect(data).toHaveProperty('variables');
    expect(data).toHaveProperty('instances');
    expect(data).toHaveProperty('contextRefs');
    expect(data.fields.some((f: any) => f.path === 'q1')).toBe(true);
  });

  it('returns context-specific refs when given a path', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleFelContext(registry, projectId, 'q1');
    const data = parseResult(result);

    expect(data).toHaveProperty('fields');
  });
});

// ── handleFelFunctions ─────────────────────────────────────────────

describe('handleFelFunctions', () => {
  it('returns a non-empty array of function entries', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleFelFunctions(registry, projectId);
    const data = parseResult(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('each entry has name, category, and source', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleFelFunctions(registry, projectId);
    const data = parseResult(result);

    const first = data[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('category');
    expect(first).toHaveProperty('source');
    expect(first.source).toBe('builtin');
  });
});

// ── handleFelCheck ─────────────────────────────────────────────────

describe('handleFelCheck', () => {
  it('returns valid: true for a valid expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'number');

    const result = handleFelCheck(registry, projectId, '$q1 + 1');
    const data = parseResult(result);

    expect(data).toHaveProperty('valid', true);
    expect(data).toHaveProperty('references');
    expect(data.references).toContain('q1');
  });

  it('returns valid: false for an invalid expression', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleFelCheck(registry, projectId, '$$INVALID_FEL$$(');
    const data = parseResult(result);

    expect(data).toHaveProperty('valid', false);
    expect(data).toHaveProperty('errors');
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it('returns functions called in the expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'number');

    const result = handleFelCheck(registry, projectId, 'round($q1, 2)');
    const data = parseResult(result);

    expect(data.valid).toBe(true);
    expect(data.functions).toContain('round');
  });

  it('accepts a context path for scope-aware validation', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleFelCheck(registry, projectId, '$q1', 'q1');
    const data = parseResult(result);

    expect(data).toHaveProperty('valid');
  });
});
