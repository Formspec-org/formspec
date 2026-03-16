import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleField } from '../src/tools/structure.js';
import { handleStyle } from '../src/tools/style.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── layout ───────────────────────────────────────────────────────

describe('handleStyle — layout', () => {
  it('applies a 2-column layout to a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });
    handleField(registry, projectId, { path: 'q2', label: 'Q2', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'layout',
      target: ['q1', 'q2'],
      arrangement: 'columns-2',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toBeTruthy();
  });

  it('applies layout to a single target string', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'q1', label: 'Q1', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'layout',
      target: 'q1',
      arrangement: 'card',
    });

    expect(result.isError).toBeUndefined();
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleStyle(registry, projectId, {
      action: 'layout',
      target: 'q1',
      arrangement: 'columns-2',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── style (item-level) ──────────────────────────────────────────

describe('handleStyle — style', () => {
  it('applies CSS-like properties to a specific item', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'style',
      path: 'name',
      properties: { width: '50%', color: 'red' },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('name');
  });
});

// ── style_all ───────────────────────────────────────────────────

describe('handleStyle — style_all', () => {
  it('applies properties to all items (no filter)', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'style_all',
      properties: { fontSize: '14px' },
    });

    expect(result.isError).toBeUndefined();
  });

  it('applies properties filtered by target_type', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'style_all',
      target_type: 'field',
      properties: { fontSize: '14px' },
    });

    expect(result.isError).toBeUndefined();
  });

  it('applies properties filtered by target_data_type', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'a', label: 'A', type: 'text' });

    const result = handleStyle(registry, projectId, {
      action: 'style_all',
      target_data_type: 'text',
      properties: { fontSize: '14px' },
    });

    expect(result.isError).toBeUndefined();
  });
});
