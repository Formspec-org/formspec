import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleField } from '../src/tools/structure.js';
import { handleFlow } from '../src/tools/flow.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── set_mode ─────────────────────────────────────────────────────

describe('handleFlow — set_mode', () => {
  it('sets single page mode', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleFlow(registry, projectId, {
      action: 'set_mode',
      mode: 'single',
    });
    expect(result.isError).toBeUndefined();
  });

  it('sets wizard mode with properties', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleFlow(registry, projectId, {
      action: 'set_mode',
      mode: 'wizard',
      props: { showProgress: true, allowSkip: false },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toBeTruthy();
  });

  it('sets tabs mode', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleFlow(registry, projectId, {
      action: 'set_mode',
      mode: 'tabs',
    });
    expect(result.isError).toBeUndefined();
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleFlow(registry, projectId, {
      action: 'set_mode',
      mode: 'wizard',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── branch ───────────────────────────────────────────────────────

describe('handleFlow — branch', () => {
  it('creates branches based on field value', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, {
      path: 'type', label: 'Type', type: 'choice',
      props: { choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    });
    handleField(registry, projectId, { path: 'details_a', label: 'Details A', type: 'text' });
    handleField(registry, projectId, { path: 'details_b', label: 'Details B', type: 'text' });

    const result = handleFlow(registry, projectId, {
      action: 'branch',
      on: 'type',
      paths: [
        { when: 'a', show: 'details_a' },
        { when: 'b', show: 'details_b' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });

  it('creates branches with otherwise and contains mode', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'role', label: 'Role', type: 'text' });
    handleField(registry, projectId, { path: 'admin_section', label: 'Admin', type: 'text' });
    handleField(registry, projectId, { path: 'default_section', label: 'Default', type: 'text' });

    const result = handleFlow(registry, projectId, {
      action: 'branch',
      on: 'role',
      paths: [
        { when: 'admin', show: 'admin_section', mode: 'contains' },
      ],
      otherwise: 'default_section',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });

  it('supports show as array of paths', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, {
      path: 'plan', label: 'Plan', type: 'choice',
      props: { choices: [{ value: 'pro', label: 'Pro' }] },
    });
    handleField(registry, projectId, { path: 'feature_x', label: 'Feature X', type: 'text' });
    handleField(registry, projectId, { path: 'feature_y', label: 'Feature Y', type: 'text' });

    const result = handleFlow(registry, projectId, {
      action: 'branch',
      on: 'plan',
      paths: [
        { when: 'pro', show: ['feature_x', 'feature_y'] },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });
});
