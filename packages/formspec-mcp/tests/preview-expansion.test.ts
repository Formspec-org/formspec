/** @filedesc Tests for expanded formspec_preview modes: sample_data and normalize. */
import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import { handlePreview } from '../src/tools/query.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('handlePreview — sample_data mode', () => {
  it('returns sample data for fields', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'string');
    project.addField('age', 'Age', 'integer');

    const result = handlePreview(registry, projectId, 'sample_data', {});
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(data.name).toBe('Sample text');
    expect(data.age).toBe(42);
  });

  it('returns empty object for project with no fields', () => {
    const { registry, projectId } = registryWithProject();

    const result = handlePreview(registry, projectId, 'sample_data', {});
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(data).toEqual({});
  });

  it('returns money sample for money fields', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('price', 'Price', 'money');

    const result = handlePreview(registry, projectId, 'sample_data', {});
    const data = parseResult(result);

    expect(data.price).toEqual({ amount: 100, currency: 'USD' });
  });
});

describe('handlePreview — normalize mode', () => {
  it('returns a normalized definition', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');
    project.addField('q2', 'Q2', 'integer');

    const result = handlePreview(registry, projectId, 'normalize', {});
    expect(result.isError).toBeUndefined();

    const data = parseResult(result);
    expect(data).toHaveProperty('items');
    expect((data as any).items.length).toBeGreaterThanOrEqual(2);
  });

  it('returns definition without null values', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('q1', 'Q1', 'text');

    const result = handlePreview(registry, projectId, 'normalize', {});
    const text = result.content[0].text;

    // No null values in the output
    expect(text).not.toContain(':null');
  });

  it('returns definition without empty arrays', () => {
    const { registry, projectId } = registryWithProject();

    const result = handlePreview(registry, projectId, 'normalize', {});
    const text = result.content[0].text;

    // Should not contain property:[]
    expect(text).not.toMatch(/"[^"]+"\s*:\s*\[\]/);
  });
});
