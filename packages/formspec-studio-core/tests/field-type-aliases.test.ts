import { describe, it, expect } from 'vitest';
import { HelperError } from '../src/helper-types.js';
import {
  resolveFieldType,
  resolveWidget,
  widgetHintFor,
  isTextareaWidget,
  WIDGET_ALIAS_MAP,
} from '../src/field-type-aliases.js';
import { createProject } from '../src/project.js';

// ── resolveWidget: spec widgetHint coverage ─────────────────────────

describe('resolveWidget — spec widgetHint coverage', () => {
  it('resolves "dropdown" to "Select" (spec-normative for choice fields)', () => {
    expect(resolveWidget('dropdown')).toBe('Select');
  });

  it('resolves all spec field widgetHints to correct components', () => {
    // From spec §4.2.5.1 — Field Items by dataType
    const specWidgets: Array<[string, string]> = [
      // string
      ['textInput', 'TextInput'],
      ['password', 'TextInput'],
      ['color', 'TextInput'],
      // text
      ['textarea', 'TextInput'],
      ['richText', 'TextInput'],
      // integer / decimal
      ['numberInput', 'NumberInput'],
      ['stepper', 'NumberInput'],
      // boolean
      ['checkbox', 'Checkbox'],
      ['toggle', 'Toggle'],
      ['yesNo', 'Toggle'],
      // date / dateTime / time
      ['datePicker', 'DatePicker'],
      ['dateTimePicker', 'DatePicker'],
      ['timePicker', 'DatePicker'],
      ['dateInput', 'TextInput'],
      ['dateTimeInput', 'TextInput'],
      ['timeInput', 'TextInput'],
      // choice
      ['dropdown', 'Select'],
      ['radio', 'RadioGroup'],
      ['autocomplete', 'Select'],
      ['segmented', 'RadioGroup'],
      ['likert', 'RadioGroup'],
      // multiChoice
      ['checkboxGroup', 'CheckboxGroup'],
      ['multiSelect', 'CheckboxGroup'],
      // attachment
      ['fileUpload', 'FileUpload'],
      ['camera', 'FileUpload'],
      ['signature', 'Signature'],
      // money
      ['moneyInput', 'MoneyInput'],
      // special
      ['slider', 'Slider'],
      ['rating', 'Rating'],
    ];

    for (const [alias, expectedComponent] of specWidgets) {
      expect(resolveWidget(alias), `"${alias}" should resolve to "${expectedComponent}"`).toBe(expectedComponent);
    }
  });

  it('accepts PascalCase component names as pass-through', () => {
    const components = [
      'RadioGroup', 'CheckboxGroup', 'Toggle', 'Checkbox', 'Select', 'Slider', 'Rating',
      'TextInput', 'FileUpload', 'Signature', 'DatePicker', 'MoneyInput', 'NumberInput',
    ];
    for (const comp of components) {
      expect(resolveWidget(comp)).toBe(comp);
    }
  });

  it('preserves backward-compat short aliases', () => {
    // "select" is not in the spec but existed before; still works
    expect(resolveWidget('select')).toBe('Select');
    expect(resolveWidget('file')).toBe('FileUpload');
    expect(resolveWidget('date')).toBe('DatePicker');
    expect(resolveWidget('money')).toBe('MoneyInput');
    expect(resolveWidget('number')).toBe('NumberInput');
    expect(resolveWidget('text')).toBe('TextInput');
  });
});

// ── resolveWidget: error messages ───────────────────────────────────

describe('resolveWidget — error messages', () => {
  it('error detail lists only lowercase/camelCase aliases, no PascalCase component names', () => {
    try {
      resolveWidget('banana');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      const detail = (e as HelperError).detail as { validWidgets: string[] };
      for (const w of detail.validWidgets) {
        expect(w, `"${w}" should not start with uppercase`).not.toMatch(/^[A-Z]/);
      }
    }
  });

  it('error message names the unknown widget', () => {
    try {
      resolveWidget('banana');
      expect.fail('should throw');
    } catch (e) {
      expect((e as HelperError).message).toContain('banana');
    }
  });

  it('error code is INVALID_WIDGET', () => {
    try {
      resolveWidget('banana');
      expect.fail('should throw');
    } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_WIDGET');
    }
  });
});

// ── widgetHintFor ───────────────────────────────────────────────────

describe('widgetHintFor', () => {
  it('returns the alias itself for spec aliases in the map', () => {
    expect(widgetHintFor('dropdown')).toBe('dropdown');
    expect(widgetHintFor('radio')).toBe('radio');
    expect(widgetHintFor('textarea')).toBe('textarea');
    expect(widgetHintFor('slider')).toBe('slider');
    expect(widgetHintFor('rating')).toBe('rating');
  });

  it('returns camelCase spec hints', () => {
    expect(widgetHintFor('textInput')).toBe('textInput');
    expect(widgetHintFor('numberInput')).toBe('numberInput');
    expect(widgetHintFor('datePicker')).toBe('datePicker');
    expect(widgetHintFor('checkboxGroup')).toBe('checkboxGroup');
    expect(widgetHintFor('moneyInput')).toBe('moneyInput');
    expect(widgetHintFor('fileUpload')).toBe('fileUpload');
  });

  it('returns undefined for "text" short alias (no widgetHint needed)', () => {
    expect(widgetHintFor('text')).toBeUndefined();
  });

  it('returns undefined for TextInput (default widget, no hint)', () => {
    expect(widgetHintFor('TextInput')).toBeUndefined();
  });

  it('reverse-maps PascalCase component names', () => {
    // RadioGroup → first alias that maps to it
    const hint = widgetHintFor('RadioGroup');
    expect(hint).toBeDefined();
    expect(WIDGET_ALIAS_MAP[hint!]).toBe('RadioGroup');
  });
});

// ── resolveFieldType ────────────────────────────────────────────────

describe('resolveFieldType', () => {
  it('"text" resolves to dataType "text" with defaultWidgetHint "textarea"', () => {
    const r = resolveFieldType('text');
    expect(r.dataType).toBe('text');
    expect(r.defaultWidget).toBe('TextInput');
    expect(r.defaultWidgetHint).toBe('textarea');
  });

  it('"string" resolves without defaultWidgetHint', () => {
    const r = resolveFieldType('string');
    expect(r.dataType).toBe('string');
    expect(r.defaultWidget).toBe('TextInput');
    expect(r.defaultWidgetHint).toBeUndefined();
  });

  it('throws INVALID_TYPE for unknown type', () => {
    try {
      resolveFieldType('banana');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('INVALID_TYPE');
    }
  });
});

// ── isTextareaWidget ────────────────────────────────────────────────

describe('isTextareaWidget', () => {
  it('returns true for "textarea"', () => {
    expect(isTextareaWidget('textarea')).toBe(true);
  });

  it('returns false for other values', () => {
    expect(isTextareaWidget('text')).toBe(false);
    expect(isTextareaWidget('TextInput')).toBe(false);
    expect(isTextareaWidget('richText')).toBe(false);
  });
});

// ── addField integration: text type defaults ────────────────────────

describe('addField — text type produces textarea semantics', () => {
  it('type "text" without explicit widget sets widgetHint "textarea" on definition', () => {
    const project = createProject();
    project.addField('notes', 'Notes', 'text');
    const item = project.itemAt('notes') as any;
    expect(item).toBeDefined();
    expect(item.dataType).toBe('text');
    // The definition should carry widgetHint for round-trip
    expect(item.presentation?.widgetHint).toBe('textarea');
  });

  it('type "string" without explicit widget does NOT set widgetHint', () => {
    const project = createProject();
    project.addField('name', 'Name', 'string');
    const item = project.itemAt('name') as any;
    expect(item).toBeDefined();
    expect(item.dataType).toBe('string');
    expect(item.presentation?.widgetHint).toBeUndefined();
  });

  it('type "text" with explicit widget "richText" uses that instead', () => {
    const project = createProject();
    project.addField('bio', 'Bio', 'text', { widget: 'richText' });
    const item = project.itemAt('bio') as any;
    expect(item.presentation?.widgetHint).toBe('richText');
  });
});

describe('addField — dropdown widget', () => {
  it('widget "dropdown" resolves to Select component', () => {
    const project = createProject();
    project.addField('color', 'Color', 'choice', {
      widget: 'dropdown',
      choices: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    });
    const item = project.itemAt('color') as any;
    expect(item).toBeDefined();
    expect(item.presentation?.widgetHint).toBe('dropdown');
  });
});

// ── WIDGET_ALIAS_MAP sanity ─────────────────────────────────────────

describe('WIDGET_ALIAS_MAP — no PascalCase keys', () => {
  it('all keys start with lowercase', () => {
    for (const key of Object.keys(WIDGET_ALIAS_MAP)) {
      expect(key, `key "${key}" should start with lowercase`).toMatch(/^[a-z]/);
    }
  });

  it('all values are valid PascalCase component names', () => {
    for (const [key, value] of Object.entries(WIDGET_ALIAS_MAP)) {
      expect(value, `value for "${key}" should start with uppercase`).toMatch(/^[A-Z]/);
    }
  });
});
