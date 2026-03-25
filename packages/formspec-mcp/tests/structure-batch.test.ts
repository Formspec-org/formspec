/** @filedesc Tests for the formspec_structure_batch MCP tool handler. */
import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import { handleStructureBatch } from '../src/tools/structure-batch.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('handleStructureBatch — wrap_group', () => {
  it('wraps items into a new group', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');
    project.addField('email', 'Email', 'email');

    const result = handleStructureBatch(registry, projectId, {
      action: 'wrap_group',
      paths: ['name', 'email'],
      groupPath: 'contact',
      groupLabel: 'Contact Info',
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.affectedPaths).toContain('contact');
  });

  it('returns error when group path already exists', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');
    project.addGroup('contact', 'Contact');

    const result = handleStructureBatch(registry, projectId, {
      action: 'wrap_group',
      paths: ['name'],
      groupPath: 'contact',
      groupLabel: 'Contact Info',
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result).code).toBe('DUPLICATE_KEY');
  });
});

describe('handleStructureBatch — batch_delete', () => {
  it('deletes multiple items', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');
    project.addField('q2', 'Q2', 'text');
    project.addField('q3', 'Q3', 'text');

    const result = handleStructureBatch(registry, projectId, {
      action: 'batch_delete',
      paths: ['q1', 'q3'],
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.affectedPaths).toContain('q1');
    expect(data.affectedPaths).toContain('q3');
  });

  it('returns error for nonexistent path', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handleStructureBatch(registry, projectId, {
      action: 'batch_delete',
      paths: ['q1', 'nonexistent'],
    });

    expect(result.isError).toBe(true);
  });
});

describe('handleStructureBatch — batch_duplicate', () => {
  it('duplicates multiple items', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');
    project.addField('q2', 'Q2', 'integer');

    const result = handleStructureBatch(registry, projectId, {
      action: 'batch_duplicate',
      paths: ['q1', 'q2'],
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.affectedPaths.length).toBe(2);
  });
});

describe('handleStructureBatch — invalid action', () => {
  it('returns error for unknown action', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleStructureBatch(registry, projectId, {
      action: 'unknown_action',
      paths: [],
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result).code).toBe('INVALID_ACTION');
  });
});
