/** @filedesc Tests for FEL editing helpers: validateFELExpression, felAutocompleteSuggestions, humanizeFELExpression. */
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';

// ── validateFELExpression ──────────────────────────────────────────

describe('validateFELExpression', () => {
  it('returns valid:true for a syntactically correct expression', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'number');
    const result = project.validateFELExpression('$q1 + 1');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid:false for a parse error', () => {
    const project = createProject();
    const result = project.validateFELExpression('$$BAD(');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toHaveProperty('message');
  });

  it('reports referenced field paths', () => {
    const project = createProject();
    project.addField('a', 'A', 'number');
    project.addField('b', 'B', 'number');
    const result = project.validateFELExpression('$a + $b');
    expect(result.references).toContain('a');
    expect(result.references).toContain('b');
  });

  it('reports functions used in the expression', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'number');
    const result = project.validateFELExpression('round($q1, 2)');
    expect(result.functions).toContain('round');
  });

  it('detects unknown field references when contextPath is provided', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');
    const result = project.validateFELExpression('$nonexistent', 'q1');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('nonexistent'))).toBe(true);
  });

  it('accepts contextPath for scope-aware validation', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');
    const result = project.validateFELExpression('$q1', 'q1');
    expect(result.valid).toBe(true);
  });

  it('returns empty references/functions for a literal expression', () => {
    const project = createProject();
    const result = project.validateFELExpression('42');
    expect(result.valid).toBe(true);
    expect(result.references).toHaveLength(0);
    expect(result.functions).toHaveLength(0);
  });
});

// ── felAutocompleteSuggestions ──────────────────────────────────────

describe('felAutocompleteSuggestions', () => {
  it('returns field suggestions', () => {
    const project = createProject();
    project.addField('first_name', 'First Name', 'text');
    project.addField('last_name', 'Last Name', 'text');

    const suggestions = project.felAutocompleteSuggestions('$');
    const fieldSuggestions = suggestions.filter(s => s.kind === 'field');
    expect(fieldSuggestions.length).toBeGreaterThanOrEqual(2);
    expect(fieldSuggestions.some(s => s.insertText.includes('first_name'))).toBe(true);
    expect(fieldSuggestions.some(s => s.insertText.includes('last_name'))).toBe(true);
  });

  it('returns function suggestions', () => {
    const project = createProject();
    const suggestions = project.felAutocompleteSuggestions('to');
    const fnSuggestions = suggestions.filter(s => s.kind === 'function');
    // Should have at least 'today' since it starts with 'to'
    expect(fnSuggestions.some(s => s.label === 'today')).toBe(true);
  });

  it('returns variable suggestions when variables exist', () => {
    const project = createProject();
    project.addVariable('total', '$a + $b');

    const suggestions = project.felAutocompleteSuggestions('@');
    const varSuggestions = suggestions.filter(s => s.kind === 'variable');
    expect(varSuggestions.some(s => s.insertText.includes('total'))).toBe(true);
  });

  it('returns all available suggestions for empty input', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');

    const suggestions = project.felAutocompleteSuggestions('');
    // Should include both fields and functions
    expect(suggestions.some(s => s.kind === 'field')).toBe(true);
    expect(suggestions.some(s => s.kind === 'function')).toBe(true);
  });

  it('filters field suggestions by prefix', () => {
    const project = createProject();
    project.addField('first_name', 'First Name', 'text');
    project.addField('last_name', 'Last Name', 'text');
    project.addField('age', 'Age', 'integer');

    // Searching for "$fir" should only return first_name
    const suggestions = project.felAutocompleteSuggestions('$fir');
    const fieldSuggestions = suggestions.filter(s => s.kind === 'field');
    expect(fieldSuggestions.some(s => s.insertText.includes('first_name'))).toBe(true);
    expect(fieldSuggestions.some(s => s.insertText.includes('last_name'))).toBe(false);
  });

  it('each suggestion has label, kind, and insertText', () => {
    const project = createProject();
    project.addField('q1', 'Question', 'text');

    const suggestions = project.felAutocompleteSuggestions('');
    for (const s of suggestions) {
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('kind');
      expect(s).toHaveProperty('insertText');
      expect(['field', 'function', 'variable', 'instance', 'keyword']).toContain(s.kind);
    }
  });

  it('uses contextPath for repeating group context refs', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.updateItem('items', { repeatable: true, minRepeat: 1, maxRepeat: 5 });
    project.addField('items.amount', 'Amount', 'number');

    const suggestions = project.felAutocompleteSuggestions('@', 'items.amount');
    const kwSuggestions = suggestions.filter(s => s.kind === 'keyword');
    expect(kwSuggestions.some(s => s.insertText.includes('current'))).toBe(true);
  });
});

// ── humanizeFELExpression ──────────────────────────────────────────

describe('humanizeFELExpression', () => {
  it('translates equality comparison', () => {
    const project = createProject();
    expect(project.humanizeFELExpression('$evHist = true')).toBe('Ev Hist is Yes');
  });

  it('translates not-equal comparison', () => {
    const project = createProject();
    expect(project.humanizeFELExpression('$status != "active"')).toBe('Status is not "active"');
  });

  it('translates numeric comparison', () => {
    const project = createProject();
    expect(project.humanizeFELExpression('$age >= 18')).toBe('Age is at least 18');
  });

  it('translates less-than comparison', () => {
    const project = createProject();
    expect(project.humanizeFELExpression('$score < 50')).toBe('Score is less than 50');
  });

  it('translates boolean true/false', () => {
    const project = createProject();
    expect(project.humanizeFELExpression('$isActive = true')).toBe('Is Active is Yes');
    expect(project.humanizeFELExpression('$isActive = false')).toBe('Is Active is No');
  });

  it('returns raw expression for complex FEL', () => {
    const project = createProject();
    const expr = 'if($a > 1, $b + $c, $d)';
    expect(project.humanizeFELExpression(expr)).toBe(expr);
  });

  it('returns raw expression for function calls', () => {
    const project = createProject();
    const expr = 'count($items)';
    expect(project.humanizeFELExpression(expr)).toBe(expr);
  });

  it('translates greater-than', () => {
    const project = createProject();
    expect(project.humanizeFELExpression('$age > 21')).toBe('Age is greater than 21');
  });

  it('translates at most', () => {
    const project = createProject();
    expect(project.humanizeFELExpression('$count <= 100')).toBe('Count is at most 100');
  });
});
