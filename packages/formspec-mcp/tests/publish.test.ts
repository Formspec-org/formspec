/** @filedesc Tests for formspec_publish MCP tool: set_version, set_status, validate_transition, get_version_info. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handlePublish } from '../src/tools/publish.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── set_version ─────────────────────────────────────────────────────

describe('handlePublish — set_version', () => {
  it('sets the form version', () => {
    const { registry, projectId } = registryWithProject();

    const result = handlePublish(registry, projectId, {
      action: 'set_version',
      version: '2.0.0',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('metadata');
  });

  it('version is reflected in get_version_info', () => {
    const { registry, projectId } = registryWithProject();

    handlePublish(registry, projectId, {
      action: 'set_version',
      version: '3.0.0',
    });

    const result = handlePublish(registry, projectId, {
      action: 'get_version_info',
    });
    const data = parseResult(result);

    expect(data.version).toBe('3.0.0');
  });
});

// ── set_status ──────────────────────────────────────────────────────

describe('handlePublish — set_status', () => {
  it('transitions from draft to active', () => {
    const { registry, projectId } = registryWithProject();

    const result = handlePublish(registry, projectId, {
      action: 'set_status',
      status: 'active',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
  });

  it('rejects invalid transition from draft to retired', () => {
    const { registry, projectId } = registryWithProject();

    const result = handlePublish(registry, projectId, {
      action: 'set_status',
      status: 'retired',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('transitions active → retired', () => {
    const { registry, projectId } = registryWithProject();

    // draft → active
    handlePublish(registry, projectId, { action: 'set_status', status: 'active' });
    // active → retired
    const result = handlePublish(registry, projectId, { action: 'set_status', status: 'retired' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
  });

  it('rejects transition from retired', () => {
    const { registry, projectId } = registryWithProject();

    handlePublish(registry, projectId, { action: 'set_status', status: 'active' });
    handlePublish(registry, projectId, { action: 'set_status', status: 'retired' });

    const result = handlePublish(registry, projectId, { action: 'set_status', status: 'draft' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('INVALID_STATUS_TRANSITION');
  });
});

// ── validate_transition ─────────────────────────────────────────────

describe('handlePublish — validate_transition', () => {
  it('validates a valid transition', () => {
    const { registry, projectId } = registryWithProject();

    const result = handlePublish(registry, projectId, {
      action: 'validate_transition',
      status: 'active',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.valid).toBe(true);
    expect(data.currentStatus).toBe('draft');
    expect(data.targetStatus).toBe('active');
  });

  it('validates an invalid transition', () => {
    const { registry, projectId } = registryWithProject();

    const result = handlePublish(registry, projectId, {
      action: 'validate_transition',
      status: 'retired',
    });
    const data = parseResult(result);

    expect(data.valid).toBe(false);
    expect(data.allowedTransitions).toEqual(['active']);
  });
});

// ── get_version_info ────────────────────────────────────────────────

describe('handlePublish — get_version_info', () => {
  it('returns defaults for a fresh project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handlePublish(registry, projectId, {
      action: 'get_version_info',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.status).toBe('draft');
    // version may or may not be set
  });
});

// ── WRONG_PHASE ─────────────────────────────────────────────────────

describe('handlePublish — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handlePublish(registry, projectId, {
      action: 'get_version_info',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
