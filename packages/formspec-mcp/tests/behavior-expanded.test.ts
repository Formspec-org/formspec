/** @filedesc Tests for expanded behavior MCP tool: set_bind_property, set_shape_composition, update_validation. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleBehaviorExpanded } from '../src/tools/behavior-expanded.js';
import { handleField } from '../src/tools/structure.js';
import { handleBehavior } from '../src/tools/behavior.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── set_bind_property ───────────────────────────────────────────────

describe('handleBehaviorExpanded — set_bind_property', () => {
  it('sets a required bind property', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'set_bind_property',
      target: 'name',
      property: 'required',
      value: 'true',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('name');
  });

  it('sets a relevant bind property', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'boolean' });
    handleField(registry, projectId, { path: 'q2', label: 'Q2', type: 'text' });

    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'set_bind_property',
      target: 'q2',
      property: 'relevant',
      value: '$q1 = true',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('q2');
  });

  it('clears a bind property by setting null', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    // Set then clear
    handleBehaviorExpanded(registry, projectId, {
      action: 'set_bind_property',
      target: 'name',
      property: 'required',
      value: 'true',
    });
    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'set_bind_property',
      target: 'name',
      property: 'required',
      value: null,
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'set_bind_property',
      target: 'name',
      property: 'required',
      value: 'true',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── set_shape_composition ───────────────────────────────────────────

describe('handleBehaviorExpanded — set_shape_composition', () => {
  it('adds an AND composition with multiple rules', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'age', label: 'Age', type: 'integer' });

    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'set_shape_composition',
      target: 'age',
      composition: 'and',
      rules: [
        { constraint: '$age >= 0', message: 'Age must be non-negative' },
        { constraint: '$age <= 150', message: 'Age must be at most 150' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.composition).toBe('and');
    expect(data.ruleCount).toBe(2);
    expect(data.createdIds).toHaveLength(2);
  });

  it('adds an OR composition', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'status', label: 'Status', type: 'text' });

    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'set_shape_composition',
      target: 'status',
      composition: 'or',
      rules: [
        { constraint: "$status = 'active'", message: 'Must be active' },
        { constraint: "$status = 'pending'", message: 'Must be pending' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.composition).toBe('or');
    expect(data.ruleCount).toBe(2);
  });

  it('handles empty rules array', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'set_shape_composition',
      target: '*',
      composition: 'and',
      rules: [],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.ruleCount).toBe(0);
  });
});

// ── update_validation ───────────────────────────────────────────────

describe('handleBehaviorExpanded — update_validation', () => {
  it('updates a validation rule message', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'age', label: 'Age', type: 'integer' });

    // Add a validation rule first
    const addResult = handleBehavior(registry, projectId, {
      action: 'add_rule',
      target: 'age',
      rule: '$age >= 0',
      message: 'Original message',
    });
    const { createdId } = parseResult(addResult);

    // Update the message
    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'update_validation',
      target: createdId,
      shapeId: createdId,
      changes: { message: 'Updated message' },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain(createdId);
  });

  it('updates timing and severity', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'email', label: 'Email', type: 'email' });

    const addResult = handleBehavior(registry, projectId, {
      action: 'add_rule',
      target: 'email',
      rule: "contains($email, '@')",
      message: 'Must contain @',
    });
    const { createdId } = parseResult(addResult);

    const result = handleBehaviorExpanded(registry, projectId, {
      action: 'update_validation',
      target: createdId,
      shapeId: createdId,
      changes: { timing: 'submit', severity: 'warning' },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
  });
});
