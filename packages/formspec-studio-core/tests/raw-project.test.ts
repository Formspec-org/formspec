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
    expect(result.constraintExpr).toMatch(/matches.*email/);
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

// ── RawProject Tests ────────────────────────────────────────────────

import { RawProject, createRawProject } from '../src/raw-project.js';

describe('RawProject', () => {
  it('is exported as RawProject class', () => {
    const raw = createRawProject();
    expect(raw).toBeInstanceOf(RawProject);
  });

  describe('dispatch with array (atomic multi-command)', () => {
    it('executes multiple commands atomically with single undo entry', () => {
      const raw = createRawProject();
      raw.dispatch([
        { type: 'definition.addItem', payload: { type: 'field', key: 'a' } },
        { type: 'definition.addItem', payload: { type: 'field', key: 'b' } },
      ]);
      expect(raw.state.definition.items).toHaveLength(2);
      raw.undo();
      expect(raw.state.definition.items).toHaveLength(0);
    });

    it('rolls back all commands if any throws — no partial commit', () => {
      const raw = createRawProject();
      raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'existing', label: 'Original' } });

      expect(() => raw.dispatch([
        { type: 'definition.setItemProperty', payload: { path: 'existing', property: 'label', value: 'Modified' } },
        { type: 'definition.deleteItem', payload: { path: 'nonexistent' } },
      ])).toThrow();

      expect(raw.state.definition.items).toHaveLength(1);
      expect(raw.state.definition.items[0].key).toBe('existing');
      expect(raw.state.definition.items[0].label).toBe('Original');
    });

    it('runs middleware once for array dispatch', () => {
      let callCount = 0;
      const raw = createRawProject({
        middleware: [(_state, _cmd, next) => {
          callCount++;
          return next(_cmd);
        }],
      });
      raw.dispatch([
        { type: 'definition.addItem', payload: { type: 'field', key: 'a' } },
        { type: 'definition.addItem', payload: { type: 'field', key: 'b' } },
      ]);
      expect(callCount).toBe(1);
    });

    it('notifies listeners once for array dispatch', () => {
      let notifyCount = 0;
      const raw = createRawProject();
      raw.onChange(() => { notifyCount++; });
      raw.dispatch([
        { type: 'definition.addItem', payload: { type: 'field', key: 'a' } },
        { type: 'definition.addItem', payload: { type: 'field', key: 'b' } },
      ]);
      expect(notifyCount).toBe(1);
    });
  });

  describe('batchWithRebuild', () => {
    it('executes phase1, rebuilds component tree, then executes phase2', () => {
      const raw = createRawProject();
      const results = raw.batchWithRebuild(
        [{ type: 'definition.addItem', payload: { type: 'field', key: 'email', label: 'Email' } }],
        [{ type: 'component.setFieldWidget', payload: { fieldKey: 'email', widget: 'TextInput' } }],
      );
      expect(results).toHaveLength(2);
      expect(raw.state.definition.items).toHaveLength(1);
    });

    it('produces a single undo entry', () => {
      const raw = createRawProject();
      raw.batchWithRebuild(
        [{ type: 'definition.addItem', payload: { type: 'field', key: 'f1' } }],
        [{ type: 'component.setFieldWidget', payload: { fieldKey: 'f1', widget: 'TextInput' } }],
      );
      raw.undo();
      expect(raw.state.definition.items).toHaveLength(0);
    });

    it('notifies listeners once', () => {
      let notifyCount = 0;
      const raw = createRawProject();
      raw.onChange(() => { notifyCount++; });
      raw.batchWithRebuild(
        [{ type: 'definition.addItem', payload: { type: 'field', key: 'f1' } }],
        [{ type: 'component.setFieldWidget', payload: { fieldKey: 'f1', widget: 'TextInput' } }],
      );
      expect(notifyCount).toBe(1);
    });
  });

  describe('clearRedo', () => {
    it('clears the redo stack', () => {
      const raw = createRawProject();
      raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f' } });
      raw.undo();
      expect(raw.canRedo).toBe(true);
      raw.clearRedo();
      expect(raw.canRedo).toBe(false);
    });
  });
});

// ── Project Wrapper Tests ───────────────────────────────────────────

import { Project, createProject } from '../src/project-wrapper.js';

describe('Project wrapper', () => {
  it('extends RawProject and exposes raw self-reference', () => {
    const project = createProject();
    expect(project).toBeInstanceOf(RawProject);
    expect(project).toBeInstanceOf(Project);
    expect(project.raw).toBe(project);
    expect(project.fieldPaths()).toEqual([]);
  });

  it('proxies undo/redo', () => {
    const project = createProject();
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f' } });
    expect(project.fieldPaths()).toContain('f');
    project.undo();
    expect(project.fieldPaths()).not.toContain('f');
    project.redo();
    expect(project.fieldPaths()).toContain('f');
  });

  it('proxies onChange subscription', () => {
    const project = createProject();
    let notified = false;
    project.onChange(() => { notified = true; });
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f' } });
    expect(notified).toBe(true);
  });

  it('proxies export', () => {
    const project = createProject();
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f', label: 'Test' } });
    const bundle = project.export();
    expect(bundle.definition.items).toHaveLength(1);
  });
});
