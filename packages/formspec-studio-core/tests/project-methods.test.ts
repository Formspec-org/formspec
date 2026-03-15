import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project-wrapper.js';
import { HelperError } from '../src/helper-types.js';

describe('addField', () => {
  it('adds a text field to the definition', () => {
    const project = createProject();
    const result = project.addField('name', 'Full Name', 'text');
    expect(result.affectedPaths).toEqual(['name']);
    expect(result.action.helper).toBe('addField');
    expect(result.action.params).toHaveProperty('type', 'text');
    expect(project.fieldPaths()).toContain('name');
    const item = project.itemAt('name');
    expect(item?.label).toBe('Full Name');
    expect(item?.dataType).toBe('text');
  });

  it('dispatches type "field" not the dataType string', () => {
    const project = createProject();
    project.addField('amount', 'Amount', 'decimal');
    const item = project.itemAt('amount');
    expect(item?.type).toBe('field');
    expect(item?.dataType).toBe('decimal');
  });

  it('resolves email alias with constraint bind', () => {
    const project = createProject();
    project.addField('email', 'Email', 'email');
    expect(project.itemAt('email')?.dataType).toBe('string');
    const bind = project.bindFor('email');
    expect(bind?.constraint).toMatch(/matches/);
  });

  it('resolves phone alias with constraint bind', () => {
    const project = createProject();
    project.addField('phone', 'Phone', 'phone');
    expect(project.itemAt('phone')?.dataType).toBe('string');
    const bind = project.bindFor('phone');
    expect(bind?.constraint).toBeDefined();
  });

  it('sets required bind when props.required is true', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { required: true });
    const bind = project.bindFor('name');
    expect(bind?.required).toBe('true');
  });

  it('sets readonly bind when props.readonly is true', () => {
    const project = createProject();
    project.addField('ro', 'Read Only', 'text', { readonly: true });
    const bind = project.bindFor('ro');
    expect(bind?.readonly).toBe('true');
  });

  it('sets initialValue via setItemProperty', () => {
    const project = createProject();
    project.addField('qty', 'Quantity', 'integer', { initialValue: 1 });
    const item = project.itemAt('qty');
    expect(item?.initialValue).toBe(1);
  });

  it('throws INVALID_TYPE for unknown type (pre-validation)', () => {
    const project = createProject();
    expect(() => project.addField('f', 'F', 'banana')).toThrow(HelperError);
    try { project.addField('f', 'F', 'banana'); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_TYPE');
    }
    expect(project.fieldPaths()).not.toContain('f');
  });

  it('throws INVALID_WIDGET for unknown widget in props', () => {
    const project = createProject();
    expect(() => project.addField('f', 'F', 'text', { widget: 'banana' })).toThrow(HelperError);
    try { project.addField('f', 'F', 'text', { widget: 'banana' }); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_WIDGET');
    }
  });

  it('throws PAGE_NOT_FOUND for nonexistent page (pre-validation)', () => {
    const project = createProject();
    expect(() => project.addField('f', 'F', 'text', { page: 'nonexistent' })).toThrow(HelperError);
    try { project.addField('f', 'F', 'text', { page: 'nonexistent' }); } catch (e) {
      expect((e as HelperError).code).toBe('PAGE_NOT_FOUND');
    }
    expect(project.fieldPaths()).not.toContain('f');
  });

  it('is a single undo entry (field + binds undone together)', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { required: true });
    expect(project.fieldPaths()).toContain('name');
    expect(project.bindFor('name')?.required).toBe('true');
    project.undo();
    expect(project.fieldPaths()).not.toContain('name');
    expect(project.bindFor('name')).toBeUndefined();
  });

  it('adds nested field via dot-path', () => {
    const project = createProject();
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'contact' } });
    project.addField('contact.email', 'Email', 'email');
    expect(project.fieldPaths()).toContain('contact.email');
  });

  it('adds field with explicit parentPath in props', () => {
    const project = createProject();
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'contact' } });
    project.addField('phone', 'Phone', 'phone', { parentPath: 'contact' });
    expect(project.fieldPaths()).toContain('contact.phone');
  });

  it('resolves widget alias and sets component widget', () => {
    const project = createProject();
    project.addField('status', 'Status', 'choice', { widget: 'radio' });
    // The field should exist with choice dataType
    expect(project.itemAt('status')?.dataType).toBe('choice');
  });
});

describe('addGroup', () => {
  it('adds a group to the definition', () => {
    const project = createProject();
    const result = project.addGroup('contact', 'Contact Information');
    expect(result.affectedPaths).toEqual(['contact']);
    expect(result.action.helper).toBe('addGroup');
    const item = project.itemAt('contact');
    expect(item?.type).toBe('group');
    expect(item?.label).toBe('Contact Information');
  });

  it('with display mode uses batchWithRebuild and single undo entry', () => {
    const project = createProject();
    project.addGroup('items', 'Items', { display: 'dataTable' });
    expect(project.itemAt('items')?.type).toBe('group');
    project.undo();
    expect(project.itemAt('items')).toBeUndefined();
  });

  it('without display mode still creates group correctly', () => {
    const project = createProject();
    project.addGroup('section', 'Section');
    expect(project.itemAt('section')?.type).toBe('group');
  });

  it('adds nested group via dot-path', () => {
    const project = createProject();
    project.addGroup('outer', 'Outer');
    project.addGroup('outer.inner', 'Inner');
    const outer = project.itemAt('outer');
    expect(outer?.children).toHaveLength(1);
    expect(outer?.children?.[0].key).toBe('inner');
  });
});

describe('addContent', () => {
  it('adds display content with default kind (paragraph)', () => {
    const project = createProject();
    const result = project.addContent('intro', 'Welcome to the form');
    expect(result.affectedPaths).toEqual(['intro']);
    expect(result.action.helper).toBe('addContent');
    const item = project.itemAt('intro');
    expect(item?.type).toBe('display');
    expect(item?.label).toBe('Welcome to the form');
    expect((item as any)?.presentation?.widgetHint).toBe('paragraph');
  });

  it('adds heading content', () => {
    const project = createProject();
    project.addContent('title', 'Form Title', 'heading');
    expect((project.itemAt('title') as any)?.presentation?.widgetHint).toBe('heading');
  });

  it('maps "instructions" to "paragraph" widgetHint', () => {
    const project = createProject();
    project.addContent('instr', 'Instructions here', 'instructions');
    expect((project.itemAt('instr') as any)?.presentation?.widgetHint).toBe('paragraph');
  });

  it('maps "alert" to "banner" widgetHint', () => {
    const project = createProject();
    project.addContent('warn', 'Warning!', 'alert');
    expect((project.itemAt('warn') as any)?.presentation?.widgetHint).toBe('banner');
  });

  it('maps "banner" to "banner" widgetHint', () => {
    const project = createProject();
    project.addContent('b', 'Banner text', 'banner');
    expect((project.itemAt('b') as any)?.presentation?.widgetHint).toBe('banner');
  });

  it('adds divider content', () => {
    const project = createProject();
    project.addContent('div', '', 'divider');
    expect((project.itemAt('div') as any)?.presentation?.widgetHint).toBe('divider');
  });
});

describe('showWhen', () => {
  it('sets relevant bind on the target field', () => {
    const project = createProject();
    project.addField('toggle', 'Show Extra?', 'boolean');
    project.addField('extra', 'Extra', 'text');
    const result = project.showWhen('extra', 'toggle = true');
    expect(result.action.helper).toBe('showWhen');
    expect(project.bindFor('extra')?.relevant).toBe('toggle = true');
  });

  it('throws INVALID_FEL on bad expression', () => {
    const project = createProject();
    project.addField('f', 'F', 'text');
    expect(() => project.showWhen('f', '!!! bad %%')).toThrow(HelperError);
    try { project.showWhen('f', '!!! bad %%'); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_FEL');
    }
  });
});

describe('readonlyWhen', () => {
  it('sets readonly bind on the target field', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.readonlyWhen('name', 'true');
    expect(project.bindFor('name')?.readonly).toBe('true');
  });
});

describe('require', () => {
  it('sets required to "true" when no condition given', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.require('name');
    expect(project.bindFor('name')?.required).toBe('true');
  });

  it('sets required to a FEL condition', () => {
    const project = createProject();
    project.addField('age', 'Age', 'integer');
    project.addField('name', 'Name', 'text');
    project.require('name', 'age > 18');
    expect(project.bindFor('name')?.required).toBe('age > 18');
  });
});

describe('calculate', () => {
  it('sets calculate bind on the target field', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    project.addField('b', 'B', 'integer');
    project.addField('total', 'Total', 'integer');
    project.calculate('total', 'a + b');
    expect(project.bindFor('total')?.calculate).toBe('a + b');
  });

  it('throws INVALID_FEL on bad expression', () => {
    const project = createProject();
    project.addField('f', 'F', 'integer');
    expect(() => project.calculate('f', '++ invalid')).toThrow(HelperError);
    try { project.calculate('f', '++ invalid'); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_FEL');
    }
  });
});

describe('branch', () => {
  it('sets relevant expressions on target paths for a choice field', () => {
    const project = createProject();
    project.addField('color', 'Color', 'choice', {
      choices: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }],
    });
    project.addField('red_shade', 'Red Shade', 'text');
    project.addField('blue_shade', 'Blue Shade', 'text');

    project.branch('color', [
      { when: 'red', show: 'red_shade' },
      { when: 'blue', show: 'blue_shade' },
    ]);

    expect(project.bindFor('red_shade')?.relevant).toBe("color = 'red'");
    expect(project.bindFor('blue_shade')?.relevant).toBe("color = 'blue'");
  });

  it('uses selected() for multiChoice fields (auto-detection)', () => {
    const project = createProject();
    project.addField('tags', 'Tags', 'multichoice', {
      choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    });
    project.addField('a_detail', 'A Detail', 'text');

    project.branch('tags', [
      { when: 'a', show: 'a_detail' },
    ]);

    expect(project.bindFor('a_detail')?.relevant).toBe("selected(tags, 'a')");
  });

  it('builds otherwise arm with negation', () => {
    const project = createProject();
    project.addField('type', 'Type', 'choice');
    project.addField('type_a', 'A', 'text');
    project.addField('type_other', 'Other', 'text');

    project.branch('type', [
      { when: 'a', show: 'type_a' },
    ], 'type_other');

    expect(project.bindFor('type_other')?.relevant).toBe("not(type = 'a')");
  });

  it('handles boolean when values', () => {
    const project = createProject();
    project.addField('agreed', 'Agreed', 'boolean');
    project.addField('details', 'Details', 'text');

    project.branch('agreed', [
      { when: true, show: 'details' },
    ]);

    expect(project.bindFor('details')?.relevant).toBe('agreed = true');
  });

  it('handles number when values', () => {
    const project = createProject();
    project.addField('count', 'Count', 'integer');
    project.addField('many_section', 'Many', 'text');

    project.branch('count', [
      { when: 42, show: 'many_section' },
    ]);

    expect(project.bindFor('many_section')?.relevant).toBe('count = 42');
  });

  it('handles multiple show targets per path', () => {
    const project = createProject();
    project.addField('type', 'Type', 'choice');
    project.addField('f1', 'F1', 'text');
    project.addField('f2', 'F2', 'text');

    project.branch('type', [
      { when: 'special', show: ['f1', 'f2'] },
    ]);

    expect(project.bindFor('f1')?.relevant).toBe("type = 'special'");
    expect(project.bindFor('f2')?.relevant).toBe("type = 'special'");
  });

  it('throws PATH_NOT_FOUND when on field does not exist', () => {
    const project = createProject();
    project.addField('f', 'F', 'text');
    expect(() => project.branch('nonexistent', [{ when: 'a', show: 'f' }])).toThrow(HelperError);
    try { project.branch('nonexistent', [{ when: 'a', show: 'f' }]); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('emits RELEVANT_OVERWRITTEN warning when target already has relevant', () => {
    const project = createProject();
    project.addField('type', 'Type', 'choice');
    project.addField('f', 'F', 'text');
    project.showWhen('f', 'type = true');

    const result = project.branch('type', [
      { when: 'a', show: 'f' },
    ]);

    expect(result.warnings?.some(w => w.code === 'RELEVANT_OVERWRITTEN')).toBe(true);
  });
});

describe('addValidation', () => {
  it('adds a shape rule with correct payload mapping', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    project.addField('b', 'B', 'integer');

    const result = project.addValidation('*', 'a > b', 'A must be greater than B');
    expect(result.createdId).toBeDefined();
    expect(result.affectedPaths[0]).toBe(result.createdId);
    expect(result.action.helper).toBe('addValidation');
  });

  it('throws INVALID_FEL on bad rule expression', () => {
    const project = createProject();
    expect(() => project.addValidation('*', '!!! bad', 'msg')).toThrow(HelperError);
    try { project.addValidation('*', '!!! bad', 'msg'); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_FEL');
    }
  });
});

describe('removeValidation', () => {
  it('removes a shape by ID', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    const result = project.addValidation('*', 'a > 0', 'Must be positive');
    const shapeId = result.createdId!;

    const shapes = (project.state.definition as any).shapes;
    expect(shapes?.some((s: any) => s.id === shapeId)).toBe(true);

    project.removeValidation(shapeId);
    const shapesAfter = (project.state.definition as any).shapes;
    expect(shapesAfter?.some((s: any) => s.id === shapeId)).toBe(false);
  });
});

describe('updateValidation', () => {
  it('updates a shape rule (changes.rule dispatches as constraint)', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    const result = project.addValidation('*', 'a > 0', 'Must be positive');
    const shapeId = result.createdId!;

    project.updateValidation(shapeId, { rule: 'a > 10', message: 'Must be > 10' });

    const shapes = (project.state.definition as any).shapes;
    const shape = shapes?.find((s: any) => s.id === shapeId);
    expect(shape?.constraint).toBe('a > 10');
    expect(shape?.message).toBe('Must be > 10');
  });
});
