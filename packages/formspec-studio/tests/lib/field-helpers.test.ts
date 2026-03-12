import { describe, it, expect } from 'vitest';
import { flatItems, bindsFor, arrayBindsFor, shapesFor, dataTypeInfo } from '../../src/lib/field-helpers';

describe('flatItems', () => {
  it('flattens nested items with paths', () => {
    const items = [
      { key: 'name', type: 'field', dataType: 'string' },
      {
        key: 'address', type: 'group', children: [
          { key: 'street', type: 'field', dataType: 'string' },
          { key: 'city', type: 'field', dataType: 'string' },
        ]
      },
    ];
    const flat = flatItems(items as any);
    expect(flat).toHaveLength(4); // name, address, address.street, address.city
    expect(flat.map(f => f.path)).toEqual([
      'name', 'address', 'address.street', 'address.city'
    ]);
  });

  it('handles empty items', () => {
    expect(flatItems([])).toEqual([]);
  });
});

describe('bindsFor', () => {
  it('returns binds for a field path', () => {
    const binds = { name: { required: 'true', calculate: '$x' } };
    const result = bindsFor(binds, 'name');
    expect(result).toEqual({ required: 'true', calculate: '$x' });
  });

  it('returns empty object for unknown path', () => {
    expect(bindsFor({}, 'unknown')).toEqual({});
  });

  it('handles undefined binds', () => {
    expect(bindsFor(undefined, 'name')).toEqual({});
  });
});

describe('arrayBindsFor', () => {
  it('returns binds for an exact path match', () => {
    const binds = [{ path: 'household.name', required: 'true()' }];
    expect(arrayBindsFor(binds as any, 'household.name')).toEqual({ required: 'true()' });
  });

  it('does not resolve a bind by leaf key when the full path does not match', () => {
    const binds = [{ path: 'name', required: 'true()' }];
    expect(arrayBindsFor(binds as any, 'household.name')).toEqual({});
  });
});

describe('shapesFor', () => {
  it('returns shapes targeting a field', () => {
    const shapes = [
      { name: 's1', severity: 'error', constraint: '$age >= 18', targets: ['age'] },
      { name: 's2', severity: 'warning', constraint: '$x > 0', targets: ['x'] },
    ];
    const result = shapesFor(shapes, 'age');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('s1');
  });

  it('returns empty array when no shapes match', () => {
    const shapes = [
      { name: 's1', severity: 'error', constraint: '$x > 0', targets: ['x'] },
    ];
    expect(shapesFor(shapes, 'age')).toEqual([]);
  });

  it('handles undefined shapes', () => {
    expect(shapesFor(undefined, 'name')).toEqual([]);
  });
});

describe('dataTypeInfo', () => {
  it('returns info for known types', () => {
    const info = dataTypeInfo('string');
    expect(info.icon).toBe('Aa');
    expect(info.label).toBe('String');
    expect(info.color).toBeTruthy();
  });

  it('returns fallback for unknown types', () => {
    const info = dataTypeInfo('x-custom');
    expect(info.icon).toBe('?');
    expect(info.label).toBe('x-custom');
  });

  it('handles integer type', () => {
    const info = dataTypeInfo('integer');
    expect(info.icon).toBe('#');
    expect(info.label).toBe('Integer');
  });

  it('handles money type', () => {
    const info = dataTypeInfo('money');
    expect(info.icon).toBe('$');
    expect(info.label).toBe('Money');
  });
});
