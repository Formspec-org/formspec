/** @filedesc Tests for formspec_reference MCP tool: bound reference management. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleReference } from '../src/tools/reference.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── add_reference ────────────────────────────────────────────────────

describe('handleReference — add_reference', () => {
  it('adds a reference binding to a field', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('diagnosis', 'Diagnosis', 'string');

    const result = handleReference(registry, projectId, {
      action: 'add_reference',
      field_path: 'diagnosis',
      uri: 'https://hl7.org/fhir/ValueSet/condition-code',
      type: 'fhir-valueset',
      description: 'FHIR condition code value set',
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.summary).toBeDefined();
  });

  it('adds a reference without optional fields', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('code', 'Code', 'string');

    const result = handleReference(registry, projectId, {
      action: 'add_reference',
      field_path: 'code',
      uri: 'https://example.com/codes',
    });

    expect(result.isError).toBeUndefined();
  });

  it('adds multiple references to different fields', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('field1', 'Field 1', 'string');
    project.addField('field2', 'Field 2', 'string');

    handleReference(registry, projectId, {
      action: 'add_reference',
      field_path: 'field1',
      uri: 'https://example.com/ref1',
    });
    handleReference(registry, projectId, {
      action: 'add_reference',
      field_path: 'field2',
      uri: 'https://example.com/ref2',
    });

    const listResult = handleReference(registry, projectId, {
      action: 'list_references',
    });
    const data = parseResult(listResult);

    expect(data.references).toHaveLength(2);
  });
});

// ── remove_reference ─────────────────────────────────────────────────

describe('handleReference — remove_reference', () => {
  it('removes a reference by field path and URI', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('code', 'Code', 'string');

    handleReference(registry, projectId, {
      action: 'add_reference',
      field_path: 'code',
      uri: 'https://example.com/codes',
    });

    const result = handleReference(registry, projectId, {
      action: 'remove_reference',
      field_path: 'code',
      uri: 'https://example.com/codes',
    });

    expect(result.isError).toBeUndefined();

    const listResult = handleReference(registry, projectId, {
      action: 'list_references',
    });
    const data = parseResult(listResult);
    expect(data.references).toHaveLength(0);
  });

  it('succeeds even if no matching reference exists', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleReference(registry, projectId, {
      action: 'remove_reference',
      field_path: 'nonexistent',
      uri: 'https://example.com/nothing',
    });

    expect(result.isError).toBeUndefined();
  });
});

// ── list_references ──────────────────────────────────────────────────

describe('handleReference — list_references', () => {
  it('lists all references', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('diag', 'Diagnosis', 'string');

    handleReference(registry, projectId, {
      action: 'add_reference',
      field_path: 'diag',
      uri: 'https://example.com/codes',
      type: 'valueset',
      description: 'A code list',
    });

    const result = handleReference(registry, projectId, {
      action: 'list_references',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('references');
    expect(data.references).toHaveLength(1);
    expect(data.references[0]).toEqual(expect.objectContaining({
      fieldPath: 'diag',
      uri: 'https://example.com/codes',
      type: 'valueset',
      description: 'A code list',
    }));
  });

  it('returns empty list when no references exist', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleReference(registry, projectId, {
      action: 'list_references',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.references).toEqual([]);
  });
});

// ── WRONG_PHASE ──────────────────────────────────────────────────────

describe('handleReference — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleReference(registry, projectId, {
      action: 'add_reference',
      field_path: 'code',
      uri: 'https://example.com/codes',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
