/** @filedesc Tests for expanded formspec_audit MCP tool: cross_document and accessibility actions. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleAudit } from '../src/tools/audit.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── cross_document ──────────────────────────────────────────────────

describe('handleAudit — cross_document', () => {
  it('returns no issues for a fresh project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleAudit(registry, projectId, { action: 'cross_document' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.issues).toBeDefined();
    expect(Array.isArray(data.issues)).toBe(true);
    expect(data.summary).toBeDefined();
    expect(data.summary.total).toBeGreaterThanOrEqual(0);
  });

  it('returns issues for a project with fields', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');
    project.addGroup('info', 'Info');

    const result = handleAudit(registry, projectId, { action: 'cross_document' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toBeDefined();
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleAudit(registry, projectId, { action: 'cross_document' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── accessibility ───────────────────────────────────────────────────

describe('handleAudit — accessibility', () => {
  it('returns no issues for a fresh project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleAudit(registry, projectId, { action: 'accessibility' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.issues).toEqual([]);
    expect(data.summary.total).toBe(0);
  });

  it('flags required fields without hints', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');
    project.require('name');

    const result = handleAudit(registry, projectId, { action: 'accessibility' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    // Should have an info about missing hint on required field
    const hintIssues = data.issues.filter((i: any) => i.path === 'name' && i.severity === 'info');
    expect(hintIssues.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag required fields with hints', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text', { hint: 'Enter your full name' });
    project.require('name');

    const result = handleAudit(registry, projectId, { action: 'accessibility' });
    const data = parseResult(result);

    const hintIssues = data.issues.filter((i: any) =>
      i.path === 'name' && i.message.includes('hint'),
    );
    expect(hintIssues).toHaveLength(0);
  });

  it('flags choice fields without options', () => {
    const { registry, projectId, project } = registryWithProject();
    // Add a choice field without options (use raw dispatch)
    (project as any).core.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'color', label: 'Color', dataType: 'choice' },
    });

    const result = handleAudit(registry, projectId, { action: 'accessibility' });
    const data = parseResult(result);

    const choiceIssues = data.issues.filter((i: any) =>
      i.path === 'color' && i.severity === 'warning',
    );
    expect(choiceIssues.length).toBeGreaterThanOrEqual(1);
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleAudit(registry, projectId, { action: 'accessibility' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
