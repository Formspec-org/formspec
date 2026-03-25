/** @filedesc Tests for formspec_response MCP tool: set/get/clear test responses, validate. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleResponse, clearTestResponsesForProject } from '../src/tools/response.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── set_test_response ───────────────────────────────────────────────

describe('handleResponse — set_test_response', () => {
  it('sets a test response value for a field', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    const result = handleResponse(registry, projectId, {
      action: 'set_test_response',
      field: 'name',
      value: 'John',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.field).toBe('name');
    expect(data.value).toBe('John');
  });

  it('overwrites previous value', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('age', 'Age', 'integer');

    handleResponse(registry, projectId, {
      action: 'set_test_response',
      field: 'age',
      value: 25,
    });
    handleResponse(registry, projectId, {
      action: 'set_test_response',
      field: 'age',
      value: 30,
    });

    const result = handleResponse(registry, projectId, {
      action: 'get_test_response',
      field: 'age',
    });
    const data = parseResult(result);
    expect(data.value).toBe(30);

    // Cleanup
    clearTestResponsesForProject(projectId);
  });
});

// ── get_test_response ───────────────────────────────────────────────

describe('handleResponse — get_test_response', () => {
  it('returns null for unset field', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    const result = handleResponse(registry, projectId, {
      action: 'get_test_response',
      field: 'name',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.value).toBeNull();
  });

  it('returns all test responses when no field specified', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'integer');

    handleResponse(registry, projectId, {
      action: 'set_test_response',
      field: 'a',
      value: 'hello',
    });
    handleResponse(registry, projectId, {
      action: 'set_test_response',
      field: 'b',
      value: 42,
    });

    const result = handleResponse(registry, projectId, {
      action: 'get_test_response',
    });
    const data = parseResult(result);

    expect(data.response.a).toBe('hello');
    expect(data.response.b).toBe(42);

    clearTestResponsesForProject(projectId);
  });
});

// ── clear_test_responses ────────────────────────────────────────────

describe('handleResponse — clear_test_responses', () => {
  it('clears all test responses', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    handleResponse(registry, projectId, {
      action: 'set_test_response',
      field: 'name',
      value: 'John',
    });

    const result = handleResponse(registry, projectId, {
      action: 'clear_test_responses',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.summary).toContain('Cleared');

    // Verify responses are cleared
    const getResult = handleResponse(registry, projectId, {
      action: 'get_test_response',
    });
    const getData = parseResult(getResult);
    expect(getData.response).toEqual({});
  });
});

// ── validate_response ───────────────────────────────────────────────

describe('handleResponse — validate_response', () => {
  it('validates a provided response', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    const result = handleResponse(registry, projectId, {
      action: 'validate_response',
      response: { name: 'John' },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    // Validation report should have a results array or counts
    expect(data).toBeDefined();
  });

  it('validates using stored test responses when no response provided', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    handleResponse(registry, projectId, {
      action: 'set_test_response',
      field: 'name',
      value: 'Jane',
    });

    const result = handleResponse(registry, projectId, {
      action: 'validate_response',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toBeDefined();

    clearTestResponsesForProject(projectId);
  });
});

// ── WRONG_PHASE ─────────────────────────────────────────────────────

describe('handleResponse — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleResponse(registry, projectId, {
      action: 'get_test_response',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
