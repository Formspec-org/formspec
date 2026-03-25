/** @filedesc Tests for formspec_composition MCP tool: add_ref, remove_ref, list_refs. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleComposition } from '../src/tools/composition.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── add_ref ─────────────────────────────────────────────────────────

describe('handleComposition — add_ref', () => {
  it('sets a $ref on a group item', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addGroup('shared', 'Shared Section');

    const result = handleComposition(registry, projectId, {
      action: 'add_ref',
      path: 'shared',
      ref: 'https://example.com/shared-section.definition.json',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.path).toBe('shared');
    expect(data.ref).toBe('https://example.com/shared-section.definition.json');
  });

  it('sets a $ref with keyPrefix', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addGroup('contact', 'Contact Info');

    const result = handleComposition(registry, projectId, {
      action: 'add_ref',
      path: 'contact',
      ref: 'https://example.com/contact.definition.json',
      keyPrefix: 'alt_',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.keyPrefix).toBe('alt_');
  });

  it('rejects add_ref on a non-group item', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    const result = handleComposition(registry, projectId, {
      action: 'add_ref',
      path: 'name',
      ref: 'https://example.com/thing.json',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('INVALID_ITEM_TYPE');
  });

  it('rejects add_ref on nonexistent item', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleComposition(registry, projectId, {
      action: 'add_ref',
      path: 'nonexistent',
      ref: 'https://example.com/thing.json',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('ITEM_NOT_FOUND');
  });
});

// ── remove_ref ──────────────────────────────────────────────────────

describe('handleComposition — remove_ref', () => {
  it('removes a $ref from a group', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addGroup('shared', 'Shared Section');

    // Add then remove
    handleComposition(registry, projectId, {
      action: 'add_ref',
      path: 'shared',
      ref: 'https://example.com/shared.json',
    });
    const result = handleComposition(registry, projectId, {
      action: 'remove_ref',
      path: 'shared',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('shared');

    // Verify it's gone
    const listResult = handleComposition(registry, projectId, { action: 'list_refs' });
    const listData = parseResult(listResult);
    expect(listData.refs).toHaveLength(0);
  });

  it('rejects remove_ref on nonexistent item', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleComposition(registry, projectId, {
      action: 'remove_ref',
      path: 'nonexistent',
    });

    expect(result.isError).toBe(true);
  });
});

// ── list_refs ───────────────────────────────────────────────────────

describe('handleComposition — list_refs', () => {
  it('returns empty refs for a fresh project', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleComposition(registry, projectId, { action: 'list_refs' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.refs).toEqual([]);
  });

  it('lists all refs after adding', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addGroup('shared', 'Shared');
    project.addGroup('common', 'Common');

    handleComposition(registry, projectId, {
      action: 'add_ref',
      path: 'shared',
      ref: 'https://example.com/shared.json',
    });
    handleComposition(registry, projectId, {
      action: 'add_ref',
      path: 'common',
      ref: 'https://example.com/common.json',
      keyPrefix: 'c_',
    });

    const result = handleComposition(registry, projectId, { action: 'list_refs' });
    const data = parseResult(result);

    expect(data.refs).toHaveLength(2);
    const sharedRef = data.refs.find((r: any) => r.path === 'shared');
    expect(sharedRef.ref).toBe('https://example.com/shared.json');
    const commonRef = data.refs.find((r: any) => r.path === 'common');
    expect(commonRef.keyPrefix).toBe('c_');
  });
});

// ── WRONG_PHASE ─────────────────────────────────────────────────────

describe('handleComposition — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleComposition(registry, projectId, { action: 'list_refs' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
