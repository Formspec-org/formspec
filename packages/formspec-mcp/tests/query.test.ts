import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import { handleDescribe, handleSearch, handleTrace, handlePreview } from '../src/tools/query.js';
import { handleFel } from '../src/tools/fel.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── handleDescribe — audit mode ─────────────────────────────────

describe('handleDescribe — audit', () => {
  it('returns diagnostics with counts for a fresh project', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleDescribe(registry, projectId, 'audit');
    const data = parseResult(result);

    expect(data).toHaveProperty('counts');
    expect(data.counts).toHaveProperty('error');
    expect(data.counts).toHaveProperty('warning');
    expect(data.counts).toHaveProperty('info');
    expect(typeof data.counts.error).toBe('number');
  });

  it('returns categorized diagnostic arrays', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleDescribe(registry, projectId, 'audit');
    const data = parseResult(result);

    expect(data).toHaveProperty('structural');
    expect(data).toHaveProperty('expressions');
    expect(data).toHaveProperty('extensions');
    expect(data).toHaveProperty('consistency');
    expect(Array.isArray(data.structural)).toBe(true);
    expect(Array.isArray(data.expressions)).toBe(true);
  });
});

// ── handleDescribe — structure mode ─────────────────────────────

describe('handleDescribe — structure', () => {
  it('returns statistics and fieldPaths without a target', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Question 1', 'text');

    const result = handleDescribe(registry, projectId, 'structure');
    const data = parseResult(result);

    expect(data).toHaveProperty('statistics');
    expect(data).toHaveProperty('fieldPaths');
    expect(data.fieldPaths).toContain('q1');
  });

  it('returns item and bind info with a target path', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Question 1', 'text');

    const result = handleDescribe(registry, projectId, 'structure', 'q1');
    const data = parseResult(result);

    expect(data).toHaveProperty('item');
    expect(data.item).toHaveProperty('key', 'q1');
    expect(data.item).toHaveProperty('label', 'Question 1');
  });

  it('returns item: null for a non-existent path', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleDescribe(registry, projectId, 'structure', 'nonexistent');
    const data = parseResult(result);

    expect(data.item).toBeNull();
  });

  it('includes pages in structure output when pages exist', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addPage('Step 1', 'First step', 'step1');
    project.addPage('Step 2', undefined, 'step2');

    const result = handleDescribe(registry, projectId, 'structure');
    const data = parseResult(result);

    expect(data).toHaveProperty('pages');
    expect(data.pages).toHaveLength(2);
    expect(data.pages[0]).toMatchObject({ page_id: 'step1', title: 'Step 1', description: 'First step' });
    expect(data.pages[1]).toMatchObject({ page_id: 'step2', title: 'Step 2' });
  });

  it('uses page_id (not id) so it matches formspec_place parameter name', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addPage('My Page', undefined, 'pg1');

    const result = handleDescribe(registry, projectId, 'structure');
    const data = parseResult(result);

    const page = data.pages[0];
    expect(page).toHaveProperty('page_id');
    expect(page).not.toHaveProperty('id');
    expect(page.page_id).toBe('pg1');
  });

  it('omits pages when none exist', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleDescribe(registry, projectId, 'structure');
    const data = parseResult(result);

    expect(data.pages).toBeUndefined();
  });

  it('includes submit button in componentNodes', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addSubmitButton('Send');

    const result = handleDescribe(registry, projectId, 'structure');
    const data = parseResult(result);

    expect(data).toHaveProperty('componentNodes');
    expect(data.componentNodes.some((n: any) => n.component === 'SubmitButton')).toBe(true);
  });

  it('omits componentNodes when there are no non-layout components', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleDescribe(registry, projectId, 'structure');
    const data = parseResult(result);

    // componentNodes should be undefined or not contain anything
    // (there may be auto-generated layout nodes, but not user-added ones like SubmitButton)
    if (data.componentNodes) {
      expect(data.componentNodes.some((n: any) => n.component === 'SubmitButton')).toBe(false);
    }
  });

  it('componentNodeCount matches filtered componentNodes length', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addSubmitButton('Send');

    const result = handleDescribe(registry, projectId, 'structure');
    const data = parseResult(result);

    // componentNodeCount should equal the filtered array length (no Stack/Wizard/Page)
    expect(data.componentNodes).toBeDefined();
    expect(data.statistics.componentNodeCount).toBe(data.componentNodes.length);
  });

  it('surfaces isDirty flag in statistics', () => {
    const { registry, projectId, project } = registryWithProject();

    // New project should not be dirty
    const cleanResult = handleDescribe(registry, projectId, 'structure');
    const cleanData = parseResult(cleanResult);
    expect(cleanData.statistics.isDirty).toBe(false);

    // After mutation
    project.addField('q1', 'Q1', 'text');
    const dirtyResult = handleDescribe(registry, projectId, 'structure');
    const dirtyData = parseResult(dirtyResult);
    expect(dirtyData.statistics.isDirty).toBe(true);

    // After markClean
    project.markClean();
    const afterClean = handleDescribe(registry, projectId, 'structure');
    const afterCleanData = parseResult(afterClean);
    expect(afterCleanData.statistics.isDirty).toBe(false);
  });
});

// ── handleDescribe — shapes mode ──────────────────────────────

describe('handleDescribe — shapes', () => {
  it('returns empty shapes list when no shapes exist', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleDescribe(registry, projectId, 'shapes');
    const data = parseResult(result);

    expect(data).toHaveProperty('shapes');
    expect(data.shapes).toEqual([]);
  });

  it('returns shape details with human-readable description', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('qty', 'Quantity', 'integer');
    project.addField('price', 'Price', 'decimal');
    project.addValidation('qty', '$qty > 0', 'Quantity must be positive');

    const result = handleDescribe(registry, projectId, 'shapes');
    const data = parseResult(result);

    expect(data.shapes.length).toBe(1);
    const shape = data.shapes[0];
    expect(shape).toHaveProperty('id');
    expect(shape).toHaveProperty('target');
    expect(shape).toHaveProperty('description');
    expect(shape.target).toBe('qty');
    expect(shape.description).toContain('Quantity must be positive');
  });

  it('includes severity for non-error shapes', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('age', 'Age', 'integer');
    project.addValidation('age', '$age >= 0', 'Age should not be negative', { severity: 'warning' });

    const result = handleDescribe(registry, projectId, 'shapes');
    const data = parseResult(result);

    expect(data.shapes.length).toBe(1);
    expect(data.shapes[0].severity).toBe('warning');
    expect(data.shapes[0].description).toContain('Age should not be negative');
  });
});

// ── handlePreview — preview mode ────────────────────────────────

describe('handlePreview — preview', () => {
  it('returns visibleFields after adding a field', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Full Name', 'text');

    const result = handlePreview(registry, projectId, 'preview', {});
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(data).toHaveProperty('visibleFields');
    expect(data.visibleFields).toContain('name');
  });

  it('returns currentValues, requiredFields, and validationState', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('age', 'Age', 'integer');

    const result = handlePreview(registry, projectId, 'preview', {});
    const data = parseResult(result);

    expect(data).toHaveProperty('currentValues');
    expect(data).toHaveProperty('requiredFields');
    expect(data).toHaveProperty('validationState');
  });

  it('applies scenario values', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('color', 'Color', 'text');

    const result = handlePreview(registry, projectId, 'preview', { scenario: { color: 'blue' } });
    const data = parseResult(result);

    expect(data.currentValues.color).toBe('blue');
  });
});

// ── handlePreview — validate mode ───────────────────────────────

describe('handlePreview — validate', () => {
  it('returns a validation report', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handlePreview(registry, projectId, 'validate', { response: { q1: 'hello' } });
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(data).toHaveProperty('results');
  });
});

// ── handleSearch ────────────────────────────────────────────────

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

// ── handleTrace ─────────────────────────────────────────────────

describe('handleTrace', () => {
  it('returns dependencies for an expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');
    project.addField('q2', 'Q2', 'text');

    const result = handleTrace(registry, projectId, 'trace', { expression_or_field: '$q1 + $q2' });
    const data = parseResult(result);

    expect(data).toHaveProperty('type', 'expression');
    expect(data).toHaveProperty('dependencies');
    expect(data.dependencies).toContain('q1');
    expect(data.dependencies).toContain('q2');
  });

  it('returns dependents for a field path', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleTrace(registry, projectId, 'trace', { expression_or_field: 'q1' });
    const data = parseResult(result);

    expect(data).toHaveProperty('type', 'field');
    expect(data).toHaveProperty('dependents');
    expect(data.dependents).toHaveProperty('binds');
    expect(data.dependents).toHaveProperty('shapes');
    expect(data.dependents).toHaveProperty('variables');
  });

  it('treats $-prefixed bare identifier as a field reference, not an expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('myfield', 'My Field', 'text');

    const result = handleTrace(registry, projectId, 'trace', { expression_or_field: '$myfield' });
    const data = parseResult(result);

    expect(data).toHaveProperty('type', 'field');
    expect(data.input).toBe('myfield');
    expect(data).toHaveProperty('dependents');
  });

  it('treats dotted $-prefixed path as a field reference', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');

    const result = handleTrace(registry, projectId, 'trace', { expression_or_field: '$contact.email' });
    const data = parseResult(result);

    expect(data).toHaveProperty('type', 'field');
    expect(data.input).toBe('contact.email');
  });

  it('treats expressions with operators as expressions', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('a', 'A', 'number');
    project.addField('b', 'B', 'number');

    const result = handleTrace(registry, projectId, 'trace', { expression_or_field: '$a + $b' });
    const data = parseResult(result);

    expect(data).toHaveProperty('type', 'expression');
  });

  it('returns changelog with semverImpact and changes for a fresh project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleTrace(registry, projectId, 'changelog', {});
    const data = parseResult(result);

    expect(data).toHaveProperty('semverImpact');
    expect(data).toHaveProperty('changes');
    expect(data).toHaveProperty('fromVersion');
    expect(data).toHaveProperty('toVersion');
    expect(Array.isArray(data.changes)).toBe(true);
  });

  it('changelog detects added fields', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Question 1', 'text');

    const result = handleTrace(registry, projectId, 'changelog', {});
    const data = parseResult(result);

    expect(data.semverImpact).not.toBe('cosmetic'); // at least 'compatible' since a field was added
    expect(data.changes.some((c: any) => c.type === 'added' && c.path === 'q1')).toBe(true);
  });
});

// ── handleFel — context ─────────────────────────────────────────

describe('handleFel — context', () => {
  it('returns available references', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleFel(registry, projectId, { action: 'context' });
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

    const result = handleFel(registry, projectId, { action: 'context', path: 'q1' });
    const data = parseResult(result);

    expect(data).toHaveProperty('fields');
  });
});

// ── handleFel — functions ───────────────────────────────────────

describe('handleFel — functions', () => {
  it('returns a non-empty array of function entries', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleFel(registry, projectId, { action: 'functions' });
    const data = parseResult(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('each entry has name, category, and source', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleFel(registry, projectId, { action: 'functions' });
    const data = parseResult(result);

    const first = data[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('category');
    expect(first).toHaveProperty('source');
    expect(first.source).toBe('builtin');
  });
});

// ── handleFel — check ───────────────────────────────────────────

describe('handleFel — check', () => {
  it('returns valid: true for a valid expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'number');

    const result = handleFel(registry, projectId, { action: 'check', expression: '$q1 + 1' });
    const data = parseResult(result);

    expect(data).toHaveProperty('valid', true);
    expect(data).toHaveProperty('references');
    expect(data.references).toContain('q1');
  });

  it('returns valid: false for an invalid expression', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleFel(registry, projectId, { action: 'check', expression: '$$INVALID_FEL$$(' });
    const data = parseResult(result);

    expect(data).toHaveProperty('valid', false);
    expect(data).toHaveProperty('errors');
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it('returns functions called in the expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'number');

    const result = handleFel(registry, projectId, { action: 'check', expression: 'round($q1, 2)' });
    const data = parseResult(result);

    expect(data.valid).toBe(true);
    expect(data.functions).toContain('round');
  });

  it('accepts a context path for scope-aware validation', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleFel(registry, projectId, { action: 'check', expression: '$q1', context_path: 'q1' });
    const data = parseResult(result);

    expect(data).toHaveProperty('valid');
  });

  it('provides helpful hint when true() is used as a function call', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('active', 'Active', 'boolean');

    const result = handleFel(registry, projectId, { action: 'check', expression: '$active = true()' });
    const data = parseResult(result);

    expect(data.valid).toBe(false);
    expect(data.errors[0].message).toContain('literal');
  });
});
