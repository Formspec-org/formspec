import { describe, it, expect } from 'vitest';
import { parseDefinitionJSON, serializeDefinition } from '../import-export';
import type { FormspecDefinition } from 'formspec-engine';

const minimalDef: FormspecDefinition = {
  $formspec: '1.0',
  url: 'https://example.gov/forms/test',
  version: '0.1.0',
  status: 'draft',
  title: 'Test Form',
  items: [
    { key: 'name', type: 'field', label: 'Name', dataType: 'string' },
  ],
} as FormspecDefinition;

describe('parseDefinitionJSON', () => {
  it('parses valid definition JSON', () => {
    const json = JSON.stringify(minimalDef);
    const result = parseDefinitionJSON(json);
    expect(result.url).toBe('https://example.gov/forms/test');
    expect(result.items).toHaveLength(1);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseDefinitionJSON('not json {')).toThrow('Invalid JSON');
  });

  it('throws on JSON that is not an object', () => {
    expect(() => parseDefinitionJSON('"just a string"')).toThrow(
      'Definition must be a JSON object',
    );
  });

  it('throws when url field is missing', () => {
    const noUrl = { items: [] };
    expect(() => parseDefinitionJSON(JSON.stringify(noUrl))).toThrow(
      'Definition is missing required field: url',
    );
  });

  it('throws when items field is missing', () => {
    const noItems = { url: 'https://example.gov/forms/test' };
    expect(() => parseDefinitionJSON(JSON.stringify(noItems))).toThrow(
      'Definition is missing required field: items',
    );
  });

  it('throws when items is not an array', () => {
    const badItems = { url: 'https://example.gov/forms/test', items: 'not an array' };
    expect(() => parseDefinitionJSON(JSON.stringify(badItems))).toThrow(
      'Definition is missing required field: items',
    );
  });
});

describe('serializeDefinition', () => {
  it('produces valid JSON', () => {
    const json = serializeDefinition(minimalDef);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('produces pretty-printed JSON (2-space indent)', () => {
    const json = serializeDefinition(minimalDef);
    expect(json).toContain('\n  ');
  });

  it('round-trips through parseDefinitionJSON', () => {
    const json = serializeDefinition(minimalDef);
    const reparsed = parseDefinitionJSON(json);
    expect(reparsed.url).toBe(minimalDef.url);
    expect(reparsed.title).toBe(minimalDef.title);
    expect(reparsed.items).toHaveLength(minimalDef.items.length);
    expect(reparsed.items[0].key).toBe(minimalDef.items[0].key);
  });

  it('serializes complex definitions with nested groups', () => {
    const complex: FormspecDefinition = {
      $formspec: '1.0',
      url: 'https://example.gov/forms/complex',
      items: [
        {
          key: 'group1',
          type: 'group',
          label: 'Group 1',
          children: [
            { key: 'field1', type: 'field', label: 'Field 1', dataType: 'string' },
            { key: 'field2', type: 'field', label: 'Field 2', dataType: 'integer' },
          ],
        },
      ],
    } as FormspecDefinition;

    const json = serializeDefinition(complex);
    const reparsed = JSON.parse(json) as FormspecDefinition;
    expect(reparsed.items[0].children).toHaveLength(2);
    expect(reparsed.items[0].children?.[0].key).toBe('field1');
  });
});
