/** @filedesc Tests for formspec_changelog MCP tool: list_changes, diff_from_baseline. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleChangelog } from '../src/tools/changelog.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── list_changes ────────────────────────────────────────────────────

describe('handleChangelog — list_changes', () => {
  it('returns a changelog for a fresh project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleChangelog(registry, projectId, { action: 'list_changes' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.changelog).toBeDefined();
  });

  it('returns a changelog reflecting modifications', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    const result = handleChangelog(registry, projectId, { action: 'list_changes' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.changelog).toBeDefined();
  });
});

// ── diff_from_baseline ──────────────────────────────────────────────

describe('handleChangelog — diff_from_baseline', () => {
  it('returns diff from baseline', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    const result = handleChangelog(registry, projectId, {
      action: 'diff_from_baseline',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.changes).toBeDefined();
    expect(Array.isArray(data.changes)).toBe(true);
    expect(data.changeCount).toBeGreaterThanOrEqual(0);
  });

  it('returns empty diff for unmodified project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleChangelog(registry, projectId, {
      action: 'diff_from_baseline',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.changeCount).toBe(0);
  });

  it('returns error for nonexistent fromVersion', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleChangelog(registry, projectId, {
      action: 'diff_from_baseline',
      fromVersion: '1.0.0',
    });
    const data = parseResult(result);

    // Should error because version 1.0.0 was never released
    expect(result.isError).toBe(true);
    expect(data.code).toBe('COMMAND_FAILED');
  });
});

// ── WRONG_PHASE ─────────────────────────────────────────────────────

describe('handleChangelog — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleChangelog(registry, projectId, { action: 'list_changes' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
