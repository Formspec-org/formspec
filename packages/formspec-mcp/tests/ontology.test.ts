/** @filedesc Tests for formspec_ontology MCP tool: concept binding and vocabulary management. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleOntology } from '../src/tools/ontology.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── bind_concept ─────────────────────────────────────────────────────

describe('handleOntology — bind_concept', () => {
  it('binds a concept URI to a field', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'string');

    const result = handleOntology(registry, projectId, {
      action: 'bind_concept',
      path: 'name',
      concept: 'https://schema.org/givenName',
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.summary).toBeDefined();
  });

  it('binds a concept with vocabulary', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('country', 'Country', 'choice');

    const result = handleOntology(registry, projectId, {
      action: 'bind_concept',
      path: 'country',
      concept: 'https://schema.org/addressCountry',
      vocabulary: 'https://example.com/countries',
    });

    expect(result.isError).toBeUndefined();
  });

  it('returns error for non-existent field', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleOntology(registry, projectId, {
      action: 'bind_concept',
      path: 'nonexistent',
      concept: 'https://schema.org/name',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
  });
});

// ── remove_concept ───────────────────────────────────────────────────

describe('handleOntology — remove_concept', () => {
  it('removes a concept binding from a field', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'string');

    // First bind a concept
    handleOntology(registry, projectId, {
      action: 'bind_concept',
      path: 'name',
      concept: 'https://schema.org/givenName',
    });

    // Then remove it
    const result = handleOntology(registry, projectId, {
      action: 'remove_concept',
      path: 'name',
    });

    expect(result.isError).toBeUndefined();
  });

  it('succeeds even if no concept was bound', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'string');

    const result = handleOntology(registry, projectId, {
      action: 'remove_concept',
      path: 'name',
    });

    expect(result.isError).toBeUndefined();
  });
});

// ── list_concepts ────────────────────────────────────────────────────

describe('handleOntology — list_concepts', () => {
  it('lists all concept bindings', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'string');
    project.addField('email', 'Email', 'string');

    handleOntology(registry, projectId, {
      action: 'bind_concept',
      path: 'name',
      concept: 'https://schema.org/givenName',
    });
    handleOntology(registry, projectId, {
      action: 'bind_concept',
      path: 'email',
      concept: 'https://schema.org/email',
    });

    const result = handleOntology(registry, projectId, {
      action: 'list_concepts',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('concepts');
    expect(data.concepts).toHaveLength(2);
    expect(data.concepts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name', concept: 'https://schema.org/givenName' }),
        expect.objectContaining({ path: 'email', concept: 'https://schema.org/email' }),
      ]),
    );
  });

  it('returns empty list when no concepts bound', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleOntology(registry, projectId, {
      action: 'list_concepts',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.concepts).toEqual([]);
  });
});

// ── set_vocabulary ───────────────────────────────────────────────────

describe('handleOntology — set_vocabulary', () => {
  it('sets a vocabulary URL on a field', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('country', 'Country', 'choice');

    const result = handleOntology(registry, projectId, {
      action: 'set_vocabulary',
      path: 'country',
      vocabulary: 'https://example.com/countries',
    });

    expect(result.isError).toBeUndefined();
  });

  it('returns error for non-existent field', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleOntology(registry, projectId, {
      action: 'set_vocabulary',
      path: 'nonexistent',
      vocabulary: 'https://example.com/vocab',
    });

    expect(result.isError).toBe(true);
  });
});

// ── WRONG_PHASE ──────────────────────────────────────────────────────

describe('handleOntology — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleOntology(registry, projectId, {
      action: 'bind_concept',
      path: 'name',
      concept: 'https://schema.org/name',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
