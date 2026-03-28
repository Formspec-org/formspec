/** @filedesc Tests for sample response generation used by the Mapping preview. */
import { describe, expect, it } from 'vitest';
import { generateDefinitionSampleData } from '../src/mapping-sample-data';

describe('generateDefinitionSampleData', () => {
  it('generates stable field-shaped sample data when seeded', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        { key: 'first_name', type: 'field', dataType: 'string' },
        { key: 'age', type: 'field', dataType: 'integer' },
        { key: 'isActive', type: 'field', dataType: 'boolean' },
      ],
    } as any;

    const result = generateDefinitionSampleData(definition, { seed: 123 });

    expect(result).toHaveProperty('first_name');
    expect(typeof result.first_name).toBe('string');
    expect(result).toHaveProperty('age');
    expect(typeof result.age).toBe('number');
    expect(result).toHaveProperty('isActive');
    expect(typeof result.isActive).toBe('boolean');
  });

  it('creates at least one instance for repeatable groups', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:test-repeat',
      version: '1.0.0',
      items: [
        {
          key: 'children',
          type: 'group',
          repeatable: true,
          children: [{ key: 'child_name', type: 'field', dataType: 'string' }],
        },
      ],
    } as any;

    const result = generateDefinitionSampleData(definition, { seed: 123 });

    expect(Array.isArray(result.children)).toBe(true);
    expect(result.children.length).toBeGreaterThan(0);
    expect(result.children[0]).toHaveProperty('child_name');
  });

  it('produces nested objects for non-repeatable groups', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:test-nested',
      version: '1.0.0',
      items: [
        {
          key: 'address',
          type: 'group',
          children: [
            { key: 'street', type: 'field', dataType: 'string' },
            { key: 'postal_code', type: 'field', dataType: 'string' },
          ],
        },
      ],
    } as any;

    const result = generateDefinitionSampleData(definition, { seed: 123 });

    expect(result.address).toMatchObject({
      street: expect.any(String),
      postal_code: expect.any(String),
    });
  });
});
