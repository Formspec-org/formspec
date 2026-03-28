import { describe, it, expect } from 'vitest';
import {
  flatItems,
  bindsFor,
  shapesFor,
  dataTypeInfo,
  compatibleWidgets,
  widgetHintForComponent,
  componentForWidgetHint,
} from '@formspec-org/studio-core';

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
    const binds = [{ path: 'name', required: 'true', calculate: '$x' }];
    const result = bindsFor(binds as any, 'name');
    expect(result).toEqual({ required: 'true', calculate: '$x' });
  });

  it('returns empty object for unknown path', () => {
    expect(bindsFor([], 'unknown')).toEqual({});
  });

  it('handles undefined binds', () => {
    expect(bindsFor(undefined, 'name')).toEqual({});
  });

  it('returns binds for an exact path match', () => {
    const binds = [{ path: 'household.name', required:  'true' }];
    expect(bindsFor(binds as any, 'household.name')).toEqual({ required:  'true' });
  });

  it('does not resolve a bind by leaf key when the full path does not match', () => {
    const binds = [{ path: 'name', required:  'true' }];
    expect(bindsFor(binds as any, 'household.name')).toEqual({});
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

describe('compatibleWidgets', () => {
  // Must match the webcomponent renderer's compatibility matrix in
  // packages/formspec-webcomponent/src/rendering/field-input.ts

  it('returns all renderable widgets for string fields', () => {
    const widgets = compatibleWidgets('field', 'string');
    expect(widgets).toEqual(['TextInput', 'Select', 'RadioGroup']);
  });

  it('returns TextInput for text fields', () => {
    expect(compatibleWidgets('field', 'text')).toEqual(['TextInput']);
  });

  it('returns numeric widgets for integer fields', () => {
    expect(compatibleWidgets('field', 'integer')).toEqual(['NumberInput', 'Slider', 'Rating', 'TextInput']);
  });

  it('returns numeric widgets for decimal fields', () => {
    expect(compatibleWidgets('field', 'decimal')).toEqual(['NumberInput', 'Slider', 'Rating', 'TextInput']);
  });

  it('returns Toggle and Checkbox for boolean fields', () => {
    expect(compatibleWidgets('field', 'boolean')).toEqual(['Toggle', 'Checkbox']);
  });

  it('returns DatePicker and TextInput for date fields', () => {
    expect(compatibleWidgets('field', 'date')).toEqual(['DatePicker', 'TextInput']);
  });

  it('returns DatePicker and TextInput for time fields', () => {
    expect(compatibleWidgets('field', 'time')).toEqual(['DatePicker', 'TextInput']);
  });

  it('returns DatePicker and TextInput for dateTime fields', () => {
    expect(compatibleWidgets('field', 'dateTime')).toEqual(['DatePicker', 'TextInput']);
  });

  it('returns Select, RadioGroup, TextInput for choice fields', () => {
    expect(compatibleWidgets('field', 'choice')).toEqual(['Select', 'RadioGroup', 'TextInput']);
  });

  it('returns CheckboxGroup for multiChoice fields', () => {
    expect(compatibleWidgets('field', 'multiChoice')).toEqual(['CheckboxGroup']);
  });

  it('returns MoneyInput, NumberInput, TextInput for money fields', () => {
    expect(compatibleWidgets('field', 'money')).toEqual(['MoneyInput', 'NumberInput', 'TextInput']);
  });

  it('returns FileUpload and Signature for attachment fields', () => {
    expect(compatibleWidgets('field', 'attachment')).toEqual(['FileUpload', 'Signature']);
  });

  it('returns TextInput for uri fields', () => {
    expect(compatibleWidgets('field', 'uri')).toEqual(['TextInput']);
  });

  it('returns real layout component names for groups', () => {
    const widgets = compatibleWidgets('group');
    expect(widgets).toContain('Stack');
    expect(widgets).toContain('Card');
    expect(widgets).toContain('Accordion');
    expect(widgets).not.toContain('Section');
    expect(widgets).not.toContain('Tab');
  });

  it('returns real display component names for display items', () => {
    const widgets = compatibleWidgets('display');
    expect(widgets).toContain('Text');
    expect(widgets).toContain('Heading');
    expect(widgets).toContain('Divider');
    expect(widgets).not.toContain('Paragraph');
    expect(widgets).not.toContain('Banner');
  });

  it('returns empty array for unknown types', () => {
    expect(compatibleWidgets('unknown')).toEqual([]);
  });
});

describe('widget hint vocabulary', () => {
  it('maps component ids to canonical definition hints', () => {
    expect(widgetHintForComponent('RadioGroup', 'choice')).toBe('radio');
    expect(widgetHintForComponent('Select', 'choice')).toBe('dropdown');
    expect(widgetHintForComponent('DatePicker', 'date')).toBe('datePicker');
  });

  it('maps definition hints back to component ids', () => {
    expect(componentForWidgetHint('radio')).toBe('RadioGroup');
    expect(componentForWidgetHint('dropdown')).toBe('Select');
    expect(componentForWidgetHint('datePicker')).toBe('DatePicker');
  });
});
