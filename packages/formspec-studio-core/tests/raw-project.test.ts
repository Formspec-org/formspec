import { describe, it, expect } from 'vitest';
import { HelperError } from '../src/helper-types.js';
import { resolveFieldType, resolveWidget, widgetHintFor } from '../src/field-type-aliases.js';

describe('HelperError', () => {
  it('is an instance of Error', () => {
    const err = new HelperError('PATH_NOT_FOUND', 'Item not found at path "foo"');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HelperError);
  });

  it('exposes code, message, and detail', () => {
    const err = new HelperError('INVALID_TYPE', 'Unknown type "xyz"', { validTypes: ['text', 'integer'] });
    expect(err.code).toBe('INVALID_TYPE');
    expect(err.message).toBe('Unknown type "xyz"');
    expect(err.detail).toEqual({ validTypes: ['text', 'integer'] });
    expect(err.name).toBe('HelperError');
  });

  it('works in try/catch with instanceof', () => {
    try {
      throw new HelperError('TEST_CODE', 'test message');
    } catch (e) {
      expect(e instanceof HelperError).toBe(true);
      if (e instanceof HelperError) {
        expect(e.code).toBe('TEST_CODE');
      }
    }
  });

  it('detail defaults to undefined when not provided', () => {
    const err = new HelperError('SOME_CODE', 'msg');
    expect(err.detail).toBeUndefined();
  });
});

describe('resolveFieldType', () => {
  it('resolves "text" to dataType "text" and widget "TextInput"', () => {
    const result = resolveFieldType('text');
    expect(result.dataType).toBe('text');
    expect(result.defaultWidget).toBe('TextInput');
  });

  it('resolves "email" to dataType "string" with constraint', () => {
    const result = resolveFieldType('email');
    expect(result.dataType).toBe('string');
    expect(result.defaultWidget).toBe('TextInput');
    expect(result.constraintExpr).toMatch(/matches\(\$,/);
  });

  it('resolves "phone" to dataType "string" with constraint', () => {
    const result = resolveFieldType('phone');
    expect(result.dataType).toBe('string');
    expect(result.constraintExpr).toBeDefined();
  });

  it('resolves "choice" → dataType "choice", widget "Select"', () => {
    const r = resolveFieldType('choice');
    expect(r.dataType).toBe('choice');
    expect(r.defaultWidget).toBe('Select');
  });

  it('resolves "multichoice" → dataType "multiChoice", widget "CheckboxGroup"', () => {
    const r = resolveFieldType('multichoice');
    expect(r.dataType).toBe('multiChoice');
    expect(r.defaultWidget).toBe('CheckboxGroup');
  });

  it('resolves "rating" → dataType "integer", widget "Rating"', () => {
    const r = resolveFieldType('rating');
    expect(r.dataType).toBe('integer');
    expect(r.defaultWidget).toBe('Rating');
  });

  it('resolves "slider" → dataType "decimal", widget "Slider"', () => {
    const r = resolveFieldType('slider');
    expect(r.dataType).toBe('decimal');
    expect(r.defaultWidget).toBe('Slider');
  });

  it('resolves "signature" → dataType "attachment", widget "Signature"', () => {
    const r = resolveFieldType('signature');
    expect(r.dataType).toBe('attachment');
    expect(r.defaultWidget).toBe('Signature');
  });

  it('resolves all 24 alias keys without throwing', () => {
    const aliases = [
      'text', 'string', 'integer', 'decimal', 'number', 'boolean',
      'date', 'datetime', 'dateTime', 'time', 'url', 'uri',
      'file', 'attachment', 'signature', 'choice', 'multichoice', 'multiChoice',
      'currency', 'money', 'rating', 'slider', 'email', 'phone',
    ];
    for (const alias of aliases) {
      expect(() => resolveFieldType(alias), `alias "${alias}" should not throw`).not.toThrow();
    }
  });

  it('throws INVALID_TYPE for unknown type', () => {
    try {
      resolveFieldType('banana');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('INVALID_TYPE');
      expect((e as HelperError).detail).toHaveProperty('validTypes');
    }
  });
});

describe('resolveWidget', () => {
  it('resolves "radio" to "RadioGroup"', () => {
    expect(resolveWidget('radio')).toBe('RadioGroup');
  });

  it('resolves "textarea" to "TextInput"', () => {
    expect(resolveWidget('textarea')).toBe('TextInput');
  });

  it('passes through raw component names like "RadioGroup"', () => {
    expect(resolveWidget('RadioGroup')).toBe('RadioGroup');
  });

  it('throws INVALID_WIDGET for unknown widget', () => {
    try {
      resolveWidget('banana');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('INVALID_WIDGET');
    }
  });
});

describe('widgetHintFor', () => {
  it('returns alias string for most aliases', () => {
    expect(widgetHintFor('radio')).toBe('radio');
    expect(widgetHintFor('slider')).toBe('slider');
    expect(widgetHintFor('textarea')).toBe('textarea');
  });

  it('returns undefined for "text" alias (no widgetHint)', () => {
    expect(widgetHintFor('text')).toBeUndefined();
  });
});

// ── Project Wrapper Tests ───────────────────────────────────────────

import { Project, createProject } from '../src/project.js';

describe('Project', () => {
  it('is a Project instance with empty fields', () => {
    const project = createProject();
    expect(project).toBeInstanceOf(Project);
    expect(project.fieldPaths()).toEqual([]);
  });

  it('undo/redo round-trips', () => {
    const project = createProject();
    project.addField('f', 'Field', 'text');
    expect(project.fieldPaths()).toContain('f');
    project.undo();
    expect(project.fieldPaths()).not.toContain('f');
    project.redo();
    expect(project.fieldPaths()).toContain('f');
  });

  it('onChange fires on helper calls', () => {
    const project = createProject();
    let notified = false;
    project.onChange(() => { notified = true; });
    project.addField('f', 'Field', 'text');
    expect(notified).toBe(true);
  });

  it('export includes added items', () => {
    const project = createProject();
    project.addField('f', 'Field', 'text');
    const bundle = project.export();
    expect(bundle.definition.items).toHaveLength(1);
  });

  it('loadBundle replaces state and resets history', () => {
    const project = createProject();
    project.addField('old', 'Old', 'text');
    expect(project.canUndo).toBe(true);

    const bundle = project.export();
    project.loadBundle(bundle);
    expect(project.canUndo).toBe(false);
    expect(project.fieldPaths()).toContain('old');
  });

  it('mapField / unmapField manage mapping rules', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.mapField('name', '/out/name');
    expect((project.mapping as any).rules).toHaveLength(1);
    project.unmapField('name');
    expect((project.mapping as any).rules).toHaveLength(0);
  });

  it('read-only getters expose definition/theme/component/mapping', () => {
    const project = createProject();
    project.addField('f', 'Field', 'text');
    expect(project.definition.items).toHaveLength(1);
    expect(project.theme).toBeDefined();
    expect(project.component).toBeDefined();
    expect(project.mapping).toBeDefined();
  });

  it('statistics and commandHistory are available', () => {
    const project = createProject();
    project.addField('f', 'Field', 'text');
    expect(project.statistics()).toBeDefined();
    expect(project.commandHistory().length).toBeGreaterThan(0);
  });
});
