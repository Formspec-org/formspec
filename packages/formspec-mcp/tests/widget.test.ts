/** @filedesc Tests for the formspec_widget MCP tool handler. */
import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import { handleWidget } from '../src/tools/widget.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('handleWidget — list_widgets', () => {
  it('returns a non-empty array of widget info objects', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleWidget(registry, projectId, { action: 'list_widgets' });
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('each entry has name, component, and compatibleDataTypes', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleWidget(registry, projectId, { action: 'list_widgets' });
    const data = parseResult(result);

    const first = data[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('component');
    expect(first).toHaveProperty('compatibleDataTypes');
  });
});

describe('handleWidget — compatible', () => {
  it('returns compatible widgets for a valid data type', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleWidget(registry, projectId, { action: 'compatible', dataType: 'string' });
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toContain('TextInput');
  });

  it('returns empty array for unknown data type', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleWidget(registry, projectId, { action: 'compatible', dataType: 'nonexistent' });
    const data = parseResult(result);
    expect(data).toEqual([]);
  });

  it('returns boolean-compatible widgets', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleWidget(registry, projectId, { action: 'compatible', dataType: 'boolean' });
    const data = parseResult(result);
    expect(data).toContain('Toggle');
    expect(data).toContain('Checkbox');
  });
});

describe('handleWidget — field_types', () => {
  it('returns the field type catalog', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleWidget(registry, projectId, { action: 'field_types' });
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('each entry has alias, dataType, and defaultWidget', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleWidget(registry, projectId, { action: 'field_types' });
    const data = parseResult(result);

    const first = data[0];
    expect(first).toHaveProperty('alias');
    expect(first).toHaveProperty('dataType');
    expect(first).toHaveProperty('defaultWidget');
  });

  it('includes email alias', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleWidget(registry, projectId, { action: 'field_types' });
    const data = parseResult(result);

    const email = data.find((e: any) => e.alias === 'email');
    expect(email).toBeDefined();
    expect(email.dataType).toBe('string');
  });
});
