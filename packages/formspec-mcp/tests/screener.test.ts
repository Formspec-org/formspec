import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleScreener } from '../src/tools/screener.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── create/delete document ──────────────────────────────────────

describe('handleScreener — create/delete document', () => {
  it('creates a screener document', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleScreener(registry, projectId, {
      action: 'create_document',
      title: 'Test Screener',
    });
    expect(result.isError).toBeUndefined();
  });

  it('deletes the screener document', () => {
    const { registry, projectId } = registryWithProject();
    handleScreener(registry, projectId, { action: 'create_document' });

    const result = handleScreener(registry, projectId, {
      action: 'delete_document',
    });
    expect(result.isError).toBeUndefined();
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleScreener(registry, projectId, {
      action: 'create_document',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── fields ───────────────────────────────────────────────────────

describe('handleScreener — fields', () => {
  it('adds a screen field', () => {
    const { registry, projectId } = registryWithProject();
    handleScreener(registry, projectId, { action: 'create_document' });

    const result = handleScreener(registry, projectId, {
      action: 'add_field',
      key: 'age',
      label: 'Age',
      type: 'integer',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('age');
  });

  it('removes a screen field', () => {
    const { registry, projectId } = registryWithProject();
    handleScreener(registry, projectId, { action: 'create_document' });
    handleScreener(registry, projectId, {
      action: 'add_field', key: 'age', label: 'Age', type: 'integer',
    });

    const result = handleScreener(registry, projectId, {
      action: 'remove_field',
      key: 'age',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('age');
  });
});

// ── routes (phase-scoped) ───────────────────────────────────────

describe('handleScreener — routes', () => {
  function setupScreenerWithRoute(registry: any, projectId: string) {
    handleScreener(registry, projectId, { action: 'create_document' });
    handleScreener(registry, projectId, {
      action: 'add_field', key: 'eligible', label: 'Eligible?', type: 'boolean',
    });
    handleScreener(registry, projectId, {
      action: 'add_route',
      phase_id: 'default',
      condition: '$eligible = true',
      target: 'main_form',
    });
  }

  it('adds a screener route to a phase', () => {
    const { registry, projectId } = registryWithProject();
    handleScreener(registry, projectId, { action: 'create_document' });
    handleScreener(registry, projectId, {
      action: 'add_field', key: 'eligible', label: 'Eligible?', type: 'boolean',
    });

    const result = handleScreener(registry, projectId, {
      action: 'add_route',
      phase_id: 'default',
      condition: '$eligible = true',
      target: 'main_form',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toBeTruthy();
  });

  it('updates a screener route', () => {
    const { registry, projectId } = registryWithProject();
    setupScreenerWithRoute(registry, projectId);

    const result = handleScreener(registry, projectId, {
      action: 'update_route',
      phase_id: 'default',
      route_index: 0,
      changes: { target: 'alternate_form' },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toBeTruthy();
  });

  it('removes a screener route', () => {
    const { registry, projectId } = registryWithProject();
    setupScreenerWithRoute(registry, projectId);
    // Add a second route
    handleScreener(registry, projectId, {
      action: 'add_route',
      phase_id: 'default',
      condition: '$eligible = false',
      target: 'rejected',
    });

    const result = handleScreener(registry, projectId, {
      action: 'remove_route',
      phase_id: 'default',
      route_index: 0,
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toBeTruthy();
  });
});
