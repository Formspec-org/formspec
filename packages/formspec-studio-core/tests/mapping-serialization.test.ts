/** @filedesc Tests for Studio-core mapping preview serialization helpers. */
import { describe, expect, it } from 'vitest';
import { serializeMappedData } from '../src/mapping-serialization';

describe('serializeMappedData', () => {
  it('serializes JSON with null omission and stable key sorting', () => {
    const result = serializeMappedData(
      { b: null, a: { d: 2, c: 1 } },
      { format: 'json', nullHandling: 'omit', sortKeys: true },
    );

    expect(result).toBe('{\n  "a": {\n    "c": 1,\n    "d": 2\n  }\n}');
  });

  it('serializes XML with namespaces and CDATA content', () => {
    const result = serializeMappedData(
      { item: { '@id': '123', description: 'A < B' } },
      {
        format: 'xml',
        rootElement: 'feed',
        namespaces: { x: 'urn:test:x' },
        cdata: ['item.description'],
      },
    );

    expect(result).toContain('<feed xmlns:x="urn:test:x">');
    expect(result).toContain('<item id="123">');
    expect(result).toContain('<description><![CDATA[A < B]]></description>');
  });

  it('serializes CSV with headers and escaped fields', () => {
    const result = serializeMappedData(
      [{ name: 'Doe, Jane', note: 'He said "hello"' }],
      { format: 'csv' },
    );

    expect(result).toBe('name,note\r\n"Doe, Jane","He said ""hello"""');
  });

  it('returns a serialization error string instead of throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = serializeMappedData(circular, { format: 'json' });
    expect(result).toMatch(/^Serialization Error:/);
  });
});
