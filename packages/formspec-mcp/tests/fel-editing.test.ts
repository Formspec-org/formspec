/** @filedesc Tests for expanded FEL MCP tool actions: validate, autocomplete, humanize. */
import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import { handleFel } from '../src/tools/fel.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── validate action ─────────────────────────────────────────────────

describe('handleFel — validate', () => {
  it('returns valid:true for a correct expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'number');

    const result = handleFel(registry, projectId, { action: 'validate', expression: '$q1 + 1' });
    const data = parseResult(result);

    expect(data.valid).toBe(true);
    expect(data.errors).toHaveLength(0);
    expect(data.references).toContain('q1');
  });

  it('returns valid:false for an invalid expression', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleFel(registry, projectId, { action: 'validate', expression: '$$BAD(' });
    const data = parseResult(result);

    expect(data.valid).toBe(false);
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it('reports functions used in the expression', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'number');

    const result = handleFel(registry, projectId, { action: 'validate', expression: 'round($q1, 2)' });
    const data = parseResult(result);

    expect(data.valid).toBe(true);
    expect(data.functions).toContain('round');
  });

  it('uses context_path for scope-aware validation', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleFel(registry, projectId, {
      action: 'validate',
      expression: '$nonexistent',
      context_path: 'q1',
    });
    const data = parseResult(result);

    expect(data.valid).toBe(false);
    expect(data.errors.some((e: any) => e.message.includes('nonexistent'))).toBe(true);
  });
});

// ── autocomplete action ─────────────────────────────────────────────

describe('handleFel — autocomplete', () => {
  it('returns field suggestions', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('email', 'Email', 'email');

    const result = handleFel(registry, projectId, { action: 'autocomplete', expression: '$' });
    const data = parseResult(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.some((s: any) => s.kind === 'field' && s.insertText.includes('email'))).toBe(true);
  });

  it('returns function suggestions', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleFel(registry, projectId, { action: 'autocomplete', expression: 'to' });
    const data = parseResult(result);

    expect(data.some((s: any) => s.kind === 'function')).toBe(true);
  });

  it('returns suggestions scoped by context_path', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addGroup('items', 'Items');
    project.updateItem('items', { repeatable: true, minRepeat: 1, maxRepeat: 5 });
    project.addField('items.amount', 'Amount', 'number');

    const result = handleFel(registry, projectId, {
      action: 'autocomplete',
      expression: '@',
      context_path: 'items.amount',
    });
    const data = parseResult(result);

    expect(data.some((s: any) => s.kind === 'keyword' && s.insertText.includes('current'))).toBe(true);
  });

  it('all suggestions have required properties', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleFel(registry, projectId, { action: 'autocomplete', expression: '' });
    const data = parseResult(result);

    for (const s of data) {
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('kind');
      expect(s).toHaveProperty('insertText');
    }
  });
});

// ── humanize action ─────────────────────────────────────────────────

describe('handleFel — humanize', () => {
  it('converts a simple comparison to English', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleFel(registry, projectId, { action: 'humanize', expression: '$age >= 18' });
    const data = parseResult(result);

    expect(data).toHaveProperty('humanized');
    expect(data.humanized).toEqual({ text: 'Age is at least 18', supported: true });
    expect(data.original).toBe('$age >= 18');
  });

  it('returns the raw expression for complex FEL with a note about supported patterns', () => {
    const { registry, projectId } = registryWithProject();

    const expr = 'if($a > 1, $b, $c)';
    const result = handleFel(registry, projectId, { action: 'humanize', expression: expr });
    const data = parseResult(result);

    expect(data.humanized).toEqual({ text: expr, supported: false });
    expect(data.note).toMatch(/binary comparison/i);
  });

  it('translates boolean literals', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleFel(registry, projectId, { action: 'humanize', expression: '$active = true' });
    const data = parseResult(result);

    expect(data.humanized).toEqual({ text: 'Active is Yes', supported: true });
  });
});
