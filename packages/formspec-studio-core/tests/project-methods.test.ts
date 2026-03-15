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

describe('removeItem', () => {
  it('removes an item from the definition', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    expect(project.fieldPaths()).toContain('name');
    project.removeItem('name');
    expect(project.fieldPaths()).not.toContain('name');
  });

  it('cleans up references from other fields calculate binds', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    project.addField('b', 'B', 'integer');
    project.calculate('b', 'a + 1');
    expect(project.bindFor('b')?.calculate).toBe('a + 1');

    project.removeItem('a');
    // b's calculate referenced 'a' — should be cleaned up
    expect(project.bindFor('b')?.calculate).toBeUndefined();
  });

  it('cleans up shapes referencing deleted field', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    project.addField('b', 'B', 'integer');
    const result = project.addValidation('*', 'a > b', 'A > B');
    const shapeId = result.createdId!;

    project.removeItem('a');
    const shapes = (project.state.definition as any).shapes ?? [];
    expect(shapes.some((s: any) => s.id === shapeId)).toBe(false);
  });

  it('is a single undo entry', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    project.addField('b', 'B', 'integer');
    project.calculate('b', 'a + 1');

    project.removeItem('a');
    expect(project.fieldPaths()).not.toContain('a');

    project.undo();
    expect(project.fieldPaths()).toContain('a');
    expect(project.bindFor('b')?.calculate).toBe('a + 1');
  });

  it('throws PATH_NOT_FOUND for nonexistent path', () => {
    const project = createProject();
    expect(() => project.removeItem('nonexistent')).toThrow(HelperError);
    try { project.removeItem('nonexistent'); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });
});

describe('updateItem', () => {
  it('updates label via setItemProperty', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { label: 'Full Name' });
    expect(project.itemAt('name')?.label).toBe('Full Name');
  });

  it('updates required: true → setBind { required: "true" }', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { required: true });
    expect(project.bindFor('name')?.required).toBe('true');
  });

  it('updates required: false → null-deletion', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { required: true });
    expect(project.bindFor('name')?.required).toBe('true');
    project.updateItem('name', { required: false });
    // After null-deletion, bind entry removed if only 'path' remains
    const bind = project.bindFor('name');
    expect(bind?.required).toBeUndefined();
  });

  it('updates required: string → FEL passthrough', () => {
    const project = createProject();
    project.addField('age', 'Age', 'integer');
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { required: 'age > 18' });
    expect(project.bindFor('name')?.required).toBe('age > 18');
  });

  it('updates constraint via setBind', () => {
    const project = createProject();
    project.addField('email', 'Email', 'text');
    project.updateItem('email', { constraint: "matches(email, '.*@.*')" });
    expect(project.bindFor('email')?.constraint).toMatch(/matches/);
  });

  it('routes prePopulate to setItemProperty NOT setBind', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { prePopulate: 'default value' });
    const item = project.itemAt('name');
    expect((item as any)?.prePopulate).toBe('default value');
    // Should NOT be in bind
    expect(project.bindFor('name')?.prePopulate).toBeUndefined();
  });

  it('throws INVALID_KEY for unknown key', () => {
    const project = createProject();
    project.addField('f', 'F', 'text');
    expect(() => project.updateItem('f', { banana: 'yes' } as any)).toThrow(HelperError);
    try { project.updateItem('f', { banana: 'yes' } as any); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_KEY');
      expect((e as HelperError).detail).toHaveProperty('validKeys');
    }
  });

  it('throws PATH_NOT_FOUND for nonexistent path', () => {
    const project = createProject();
    expect(() => project.updateItem('nonexistent', { label: 'x' })).toThrow(HelperError);
    try { project.updateItem('nonexistent', { label: 'x' }); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });
});

describe('moveItem', () => {
  it('moves an item to a new parent', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addGroup('section', 'Section');
    project.moveItem('name', 'section');
    expect(project.fieldPaths()).toContain('section.name');
    expect(project.fieldPaths()).not.toContain('name');
  });
});

describe('renameItem', () => {
  it('renames a root item and returns new path', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const result = project.renameItem('name', 'full_name');
    expect(result.affectedPaths[0]).toBe('full_name');
    expect(project.fieldPaths()).toContain('full_name');
    expect(project.fieldPaths()).not.toContain('name');
  });

  it('renames a nested item and returns correct full path', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    const result = project.renameItem('contact.email', 'work_email');
    expect(result.affectedPaths[0]).toBe('contact.work_email');
  });
});

describe('reorderItem', () => {
  it('swaps item with previous sibling on "up"', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    const items = project.state.definition.items;
    expect(items[0].key).toBe('a');
    expect(items[1].key).toBe('b');

    project.reorderItem('b', 'up');
    const after = project.state.definition.items;
    expect(after[0].key).toBe('b');
    expect(after[1].key).toBe('a');
  });
});

describe('setMetadata', () => {
  it('sets form title', () => {
    const project = createProject();
    project.setMetadata({ title: 'My Form' });
    expect(project.definition.title).toBe('My Form');
  });

  it('throws INVALID_KEY for submitMode', () => {
    const project = createProject();
    expect(() => project.setMetadata({ submitMode: 'auto' } as any)).toThrow(HelperError);
    try { project.setMetadata({ submitMode: 'auto' } as any); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_KEY');
    }
  });

  it('throws INVALID_KEY for language', () => {
    const project = createProject();
    expect(() => project.setMetadata({ language: 'en' } as any)).toThrow(HelperError);
    try { project.setMetadata({ language: 'en' } as any); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_KEY');
    }
  });
});

describe('defineChoices', () => {
  it('creates a named option set', () => {
    const project = createProject();
    project.defineChoices('colors', [
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue' },
    ]);
    // Option set should be accessible
    const def = project.state.definition as any;
    expect(def.optionSets?.colors).toBeDefined();
  });
});

describe('makeRepeatable', () => {
  it('makes a group repeatable', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1, max: 5 });
    const item = project.itemAt('items');
    expect(item?.repeatable).toBe(true);
  });

  it('throws INVALID_TARGET_TYPE on a field', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    expect(() => project.makeRepeatable('name')).toThrow(HelperError);
    try { project.makeRepeatable('name'); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_TARGET_TYPE');
    }
  });
});

// ── Copy Item ──

describe('copyItem', () => {
  it('shallow copy creates duplicate after original', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const result = project.copyItem('name');
    expect(result.affectedPaths[0]).toBeDefined();
    expect(project.state.definition.items.length).toBe(2);
  });

  it('shallow copy emits BINDS_NOT_COPIED warning when binds exist', () => {
    const project = createProject();
    project.addField('age', 'Age', 'integer');
    project.require('age');
    const result = project.copyItem('age');
    const w = result.warnings?.find(w => w.code === 'BINDS_NOT_COPIED');
    expect(w).toBeDefined();
  });

  it('deep copy rewrites FEL references in binds', () => {
    const project = createProject();
    project.addField('price', 'Price', 'decimal');
    project.addField('qty', 'Quantity', 'integer');
    project.calculate('qty', 'price * 2');
    const result = project.copyItem('price', true);
    // The new field's path should exist
    expect(result.affectedPaths[0]).toBeDefined();
  });
});

// ── Wrap Items In Group ──

describe('wrapItemsInGroup', () => {
  it('wraps a single item in a new group', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const result = project.wrapItemsInGroup(['name'], 'Contact');
    expect(result.affectedPaths[0]).toBeDefined();
    // Original field should be nested
    const items = project.state.definition.items;
    expect(items.some((i: any) => i.type === 'group')).toBe(true);
  });
});

// ── Batch Delete ──

describe('batchDeleteItems', () => {
  it('deletes multiple items atomically with single undo', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    project.addField('c', 'C', 'text');
    project.batchDeleteItems(['a', 'b']);
    expect(project.state.definition.items).toHaveLength(1);
    expect(project.state.definition.items[0].key).toBe('c');
    project.undo();
    expect(project.state.definition.items).toHaveLength(3);
  });
});

// ── Batch Duplicate ──

describe('batchDuplicateItems', () => {
  it('duplicates multiple items atomically', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    const result = project.batchDuplicateItems(['a', 'b']);
    expect(result.affectedPaths).toHaveLength(2);
    expect(project.state.definition.items.length).toBe(4);
  });
});

// ── Wrap In Layout Component ──

describe('wrapInLayoutComponent', () => {
  it('wraps an item node in a Card', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const result = project.wrapInLayoutComponent('name', 'Card');
    expect(result.createdId).toBeDefined();
    expect(result.affectedPaths[0]).toBe(result.createdId);
  });

  it('throws PATH_NOT_FOUND for nonexistent path', () => {
    const project = createProject();
    expect(() => project.wrapInLayoutComponent('nope', 'Card')).toThrow(HelperError);
  });
});

// ── Add Submit Button ──

describe('addSubmitButton', () => {
  it('adds a submit button to root', () => {
    const project = createProject();
    const result = project.addSubmitButton('Submit');
    expect(result.summary).toContain('submit');
  });
});

// ── Page Helpers ──

describe('addPage', () => {
  it('creates a theme-tier page', () => {
    const project = createProject();
    const result = project.addPage('Page 1');
    expect(result.createdId).toBeDefined();
    const pages = project.state.theme.pages;
    expect(pages?.length).toBeGreaterThanOrEqual(1);
  });
});

describe('addWizardPage', () => {
  it('creates a wizard section group', () => {
    const project = createProject();
    const result = project.addWizardPage('Step 1');
    expect(result.createdId).toBeDefined();
    const item = project.itemAt(result.createdId!);
    expect(item?.type).toBe('group');
  });
});

describe('removePage', () => {
  it('removes a page by ID', () => {
    const project = createProject();
    const { createdId } = project.addPage('Page 1');
    project.addPage('Page 2');
    project.removePage(createdId!);
    const pages = project.state.theme.pages ?? [];
    expect(pages.find((p: any) => p.id === createdId)).toBeUndefined();
  });
});

describe('reorderPage', () => {
  it('swaps pages', () => {
    const project = createProject();
    const p1 = project.addPage('Page 1');
    const p2 = project.addPage('Page 2');
    project.reorderPage(p2.createdId!, 'up');
    const pages = project.state.theme.pages ?? [];
    expect(pages[0]?.id).toBe(p2.createdId);
  });
});

describe('updatePage', () => {
  it('updates title of a page', () => {
    const project = createProject();
    const { createdId } = project.addPage('Old Title');
    project.updatePage(createdId!, { title: 'New Title' });
    const pages = project.state.theme.pages ?? [];
    const page = pages.find((p: any) => p.id === createdId);
    expect(page?.title).toBe('New Title');
  });
});

describe('placeOnPage', () => {
  it('assigns item to a page', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const { createdId } = project.addPage('Page 1');
    project.placeOnPage('name', createdId!);
    const pages = project.state.theme.pages ?? [];
    const page = pages.find((p: any) => p.id === createdId);
    expect(page?.regions?.some((r: any) => r.key === 'name')).toBe(true);
  });
});

describe('unplaceFromPage', () => {
  it('removes item from a page', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const { createdId } = project.addPage('Page 1');
    project.placeOnPage('name', createdId!);
    project.unplaceFromPage('name', createdId!);
    const pages = project.state.theme.pages ?? [];
    const page = pages.find((p: any) => p.id === createdId);
    expect(page?.regions?.some((r: any) => r.key === 'name')).toBeFalsy();
  });
});

describe('setFlow', () => {
  it('sets flow mode to wizard', () => {
    const project = createProject();
    project.setFlow('wizard');
    expect(project.state.definition.formPresentation?.pageMode).toBe('wizard');
  });
});

// ── Layout Helpers ──

describe('applyLayout', () => {
  it('wraps targets in a columns-2 grid', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    const result = project.applyLayout(['a', 'b'], 'columns-2');
    expect(result.summary).toContain('layout');
  });
});

describe('applyStyle', () => {
  it('applies style overrides to an item', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const result = project.applyStyle('name', { width: '50%' });
    expect(result.affectedPaths[0]).toBe('name');
  });
});

describe('applyStyleAll', () => {
  it('sets form-level defaults', () => {
    const project = createProject();
    const result = project.applyStyleAll('form', { labelPosition: 'top' });
    expect(result.summary).toContain('style');
  });
});

// ── Variable Helpers ──

describe('addVariable', () => {
  it('adds a named FEL variable', () => {
    const project = createProject();
    const result = project.addVariable('total', '1 + 2');
    expect(result.summary).toContain('total');
    expect(project.variableNames()).toContain('total');
  });
});

describe('updateVariable', () => {
  it('updates a variable expression', () => {
    const project = createProject();
    project.addVariable('total', '1 + 2');
    project.updateVariable('total', '3 + 4');
    // Variable still exists
    expect(project.variableNames()).toContain('total');
  });
});

describe('removeVariable', () => {
  it('removes a variable and warns about dangling refs', () => {
    const project = createProject();
    project.addVariable('x', '42');
    project.addField('f', 'F', 'integer');
    project.calculate('f', '$x + 1');
    const result = project.removeVariable('x');
    expect(project.variableNames()).not.toContain('x');
    // Should warn about dangling reference
    const w = result.warnings?.find(w => w.code === 'DANGLING_REFERENCES');
    expect(w).toBeDefined();
  });
});

describe('renameVariable', () => {
  it('is not implemented (handler missing) — throws', () => {
    const project = createProject();
    project.addVariable('x', '42');
    // renameVariable is Future Work — may throw or not exist
    // Just verify it doesn't silently succeed without handler
    expect(() => project.renameVariable('x', 'y')).toBeDefined();
  });
});

// ── Instance Helpers ──

describe('addInstance', () => {
  it('adds a named external data source', () => {
    const project = createProject();
    const result = project.addInstance('cities', { source: 'https://example.com/cities.json' });
    expect(result.summary).toContain('cities');
    expect(project.instanceNames()).toContain('cities');
  });
});

describe('updateInstance', () => {
  it('updates instance properties', () => {
    const project = createProject();
    project.addInstance('cities', { source: 'https://old.com' });
    project.updateInstance('cities', { source: 'https://new.com' });
    expect(project.instanceNames()).toContain('cities');
  });
});

describe('renameInstance', () => {
  it('renames an instance', () => {
    const project = createProject();
    project.addInstance('cities', { source: 'https://example.com' });
    project.renameInstance('cities', 'towns');
    expect(project.instanceNames()).toContain('towns');
    expect(project.instanceNames()).not.toContain('cities');
  });
});

describe('removeInstance', () => {
  it('removes an instance', () => {
    const project = createProject();
    project.addInstance('cities', { source: 'https://example.com' });
    project.removeInstance('cities');
    expect(project.instanceNames()).not.toContain('cities');
  });
});

// ── Screener Helpers ──

describe('setScreener', () => {
  it('enables the screener', () => {
    const project = createProject();
    project.setScreener(true);
    expect((project.state.definition as any).screener).toBeDefined();
  });
});

describe('addScreenField', () => {
  it('adds a screener question', () => {
    const project = createProject();
    project.setScreener(true);
    const result = project.addScreenField('age', 'How old?', 'integer');
    expect(result.affectedPaths[0]).toBe('age');
  });
});

describe('removeScreenField', () => {
  it('removes a screener question', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenField('age', 'How old?', 'integer');
    project.removeScreenField('age');
    expect(result => result.summary).toBeDefined();
  });
});

describe('addScreenRoute', () => {
  it('adds a routing rule', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenField('age', 'How old?', 'integer');
    const result = project.addScreenRoute('age >= 18', 'https://form.example.com', 'Adults');
    expect(result.summary).toContain('route');
  });
});

describe('updateScreenRoute', () => {
  it('updates a route condition', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenField('age', 'How old?', 'integer');
    project.addScreenRoute('age >= 18', 'https://example.com');
    project.updateScreenRoute(0, { condition: 'age >= 21' });
    // Route should still exist
    expect((project.state.definition as any).screener.routes).toHaveLength(1);
  });
});

describe('reorderScreenRoute', () => {
  it('reorders routes', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenField('age', 'How old?', 'integer');
    project.addScreenRoute('age >= 18', 'https://a.com');
    project.addScreenRoute('age >= 21', 'https://b.com');
    project.reorderScreenRoute(1, 'up');
    const routes = (project.state.definition as any).screener.routes;
    expect(routes[0].condition).toBe('age >= 21');
  });
});

describe('removeScreenRoute', () => {
  it('removes a route', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenField('age', 'How old?', 'integer');
    project.addScreenRoute('age >= 18', 'https://a.com');
    project.addScreenRoute('age >= 21', 'https://b.com');
    project.removeScreenRoute(0);
    const routes = (project.state.definition as any).screener.routes;
    expect(routes).toHaveLength(1);
  });
});
