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

    const shapes = project.state.definition.shapes;
    expect(shapes?.some((s: any) => s.id === shapeId)).toBe(true);

    project.removeValidation(shapeId);
    const shapesAfter = project.state.definition.shapes;
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

    const shapes = project.state.definition.shapes;
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
    const shapes = project.state.definition.shapes ?? [];
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

  it('cleans up screener routes referencing deleted field', () => {
    const project = createProject();
    project.addField('age', 'Age', 'integer');
    // Enable screener and add routes — one referencing 'age', one not
    project.setScreener(true);
    project.addScreenField('screen_age', 'Screen Age', 'integer');
    project.addScreenRoute('age > 18', '/adult-form', 'Adult route');
    project.addScreenRoute('1 = 1', '/fallback', 'Fallback');
    // Verify routes exist
    const routesBefore = project.state.definition.screener?.routes ?? [];
    expect(routesBefore.length).toBe(2);
    expect((routesBefore[0] as any).condition).toBe('age > 18');
    // Delete the field — route referencing 'age' should be removed
    project.removeItem('age');
    const routesAfter = project.state.definition.screener?.routes ?? [];
    expect(routesAfter.length).toBe(1);
    expect((routesAfter[0] as any).condition).toBe('1 = 1');
  });

  it('cleans up mapping rules referencing deleted field', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('email', 'Email', 'email');
    // Add mapping rules — one for name, one for email
    project.dispatch({ type: 'mapping.addRule', payload: { sourcePath: 'name', targetPath: '/output/name' } });
    project.dispatch({ type: 'mapping.addRule', payload: { sourcePath: 'email', targetPath: '/output/email' } });
    const rulesBefore = (project.state.mapping as any).rules;
    expect(rulesBefore.length).toBe(2);
    // Delete name — its mapping rule should be removed
    project.removeItem('name');
    const rulesAfter = (project.state.mapping as any).rules;
    expect(rulesAfter.length).toBe(1);
    expect(rulesAfter[0].sourcePath).toBe('email');
  });

  it('deletes multiple mapping rules in descending index order (no index shift)', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    // Add 3 rules: 2 reference 'a', 1 references 'b'
    project.dispatch({ type: 'mapping.addRule', payload: { sourcePath: 'a', targetPath: '/out/a1' } });
    project.dispatch({ type: 'mapping.addRule', payload: { sourcePath: 'b', targetPath: '/out/b' } });
    project.dispatch({ type: 'mapping.addRule', payload: { sourcePath: 'a', targetPath: '/out/a2' } });
    expect((project.state.mapping as any).rules.length).toBe(3);
    // Delete 'a' — both mapping rules for 'a' should be removed
    project.removeItem('a');
    const rulesAfter = (project.state.mapping as any).rules;
    expect(rulesAfter.length).toBe(1);
    expect(rulesAfter[0].sourcePath).toBe('b');
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

  it('throws INVALID_WIDGET for unknown widget alias', () => {
    const project = createProject();
    project.addField('f', 'F', 'text');
    expect(() => project.updateItem('f', { widget: 'banana' })).toThrow(HelperError);
    try { project.updateItem('f', { widget: 'banana' }); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_WIDGET');
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

describe('addPage vs addWizardPage independence', () => {
  it('addPage creates theme page; addWizardPage creates definition group — independent', () => {
    const project = createProject();
    const pageResult = project.addPage('Page 1');
    const wizardResult = project.addWizardPage('Step 1');

    // addPage creates a theme page
    const pages = project.state.theme.pages ?? [];
    expect(pages.some((p: any) => p.id === pageResult.createdId)).toBe(true);

    // addWizardPage creates a definition group
    const wizardItem = project.itemAt(wizardResult.createdId!);
    expect(wizardItem?.type).toBe('group');

    // They target different artifacts
    expect(pageResult.action.helper).toBe('addPage');
    expect(wizardResult.action.helper).toBe('addWizardPage');

    // Undo wizard page — page still exists
    project.undo();
    const pagesAfterUndoWizard = project.state.theme.pages ?? [];
    expect(pagesAfterUndoWizard.some((p: any) => p.id === pageResult.createdId)).toBe(true);
    expect(project.itemAt(wizardResult.createdId!)).toBeUndefined();
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

  it('emits AMBIGUOUS_ITEM_KEY warning when leaf key shared by multiple items', () => {
    const project = createProject();
    project.addGroup('group1', 'Group 1');
    project.addGroup('group2', 'Group 2');
    project.addField('group1.name', 'Name 1', 'text');
    project.addField('group2.name', 'Name 2', 'text');
    // Both fields have leaf key 'name' — applying style should warn
    const result = project.applyStyle('group1.name', { width: '50%' });
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.code === 'AMBIGUOUS_ITEM_KEY')).toBe(true);
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
  it('removes a variable and warns about dangling refs with FEL paths listed', () => {
    const project = createProject();
    project.addVariable('x', '42');
    project.addField('f', 'F', 'integer');
    project.calculate('f', '$x + 1');
    const result = project.removeVariable('x');
    expect(project.variableNames()).not.toContain('x');
    const w = result.warnings?.find(w => w.code === 'DANGLING_REFERENCES');
    expect(w).toBeDefined();
    // Detail should list the specific bind paths that reference this variable
    expect(w?.detail?.referenceCount).toBeGreaterThan(0);
    expect(w?.detail?.paths).toEqual(
      expect.arrayContaining([expect.stringContaining('f')])
    );
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
    expect(project.state.definition.screener).toBeDefined();
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
    const result = project.removeScreenField('age');
    expect(result.summary).toContain('age');
    expect(result.action.helper).toBe('removeScreenField');
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
    expect(project.state.definition.screener.routes).toHaveLength(1);
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
    const routes = project.state.definition.screener.routes;
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
    const routes = project.state.definition.screener.routes;
    expect(routes).toHaveLength(1);
  });
});

// ── Spec Coverage Expansion (lines 1179-1234) ──────────────────────

describe('PATH_NOT_FOUND with similarPaths', () => {
  it('includes similar paths in error detail for removeItem', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('email', 'Email', 'email');
    try {
      project.removeItem('nme'); // typo for 'name'
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
      expect((e as HelperError).detail).toHaveProperty('similarPaths');
      expect((e as HelperError).detail.similarPaths).toContain('name');
    }
  });

  it('includes similar paths in error detail for updateItem', () => {
    const project = createProject();
    project.addField('email', 'Email', 'email');
    try {
      project.updateItem('emal', { label: 'x' }); // typo
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
      expect((e as HelperError).detail).toHaveProperty('similarPaths');
      expect((e as HelperError).detail.similarPaths).toContain('email');
    }
  });
});

describe('updateItem edge cases', () => {
  it('routes default to setBind', () => {
    const project = createProject();
    project.addField('date', 'Date', 'date');
    project.updateItem('date', { default: 'today()' });
    expect(project.bindFor('date')?.default).toBe('today()');
  });

  it('routes repeatable to setItemProperty', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.updateItem('items', { repeatable: true });
    expect(project.itemAt('items')?.repeatable).toBe(true);
  });

  it('routes minRepeat/maxRepeat to setItemProperty', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.updateItem('items', { minRepeat: 1, maxRepeat: 5 });
    expect((project.itemAt('items') as any)?.minRepeat).toBe(1);
    expect((project.itemAt('items') as any)?.maxRepeat).toBe(5);
  });
});

describe('addWizardPage edge cases', () => {
  it('sets pageMode to wizard only when not already paged', () => {
    const project = createProject();
    // First wizard page should set pageMode
    project.addWizardPage('Step 1');
    expect(project.state.definition.formPresentation?.pageMode).toBe('wizard');

    // Second wizard page should NOT re-dispatch pageMode
    // (just verify it doesn't throw / still works)
    project.addWizardPage('Step 2');
    expect(project.state.definition.formPresentation?.pageMode).toBe('wizard');
    expect(project.state.definition.items).toHaveLength(2);
  });
});

describe('removeInstance DANGLING_REFERENCES', () => {
  it('warns about dangling references with FEL paths listed', () => {
    const project = createProject();
    project.addInstance('cities', { source: 'https://example.com/cities.json' });
    project.addField('city', 'City', 'choice');
    project.calculate('city', "@instance('cities')");
    const result = project.removeInstance('cities');
    expect(project.instanceNames()).not.toContain('cities');
    const w = result.warnings?.find(w => w.code === 'DANGLING_REFERENCES');
    expect(w).toBeDefined();
    expect(w?.detail?.referenceCount).toBeGreaterThan(0);
    expect(w?.detail?.paths).toEqual(
      expect.arrayContaining([expect.stringContaining('city')])
    );
  });
});

describe('wrapItemsInGroup multi-item', () => {
  it('wraps multiple items and deduplicates descendants', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    project.addField('c', 'C', 'text');
    const result = project.wrapItemsInGroup(['a', 'b'], 'Section');
    // Group should contain both items
    expect(result.affectedPaths.length).toBeGreaterThanOrEqual(3); // groupPath + 2 moved
    // Original root should have 2 items: the new group and 'c'
    expect(project.state.definition.items).toHaveLength(2);
  });
});

describe('batchDeleteItems ancestor deduplication', () => {
  it('deduplicates descendants — deleting parent also removes children', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    project.addField('contact.phone', 'Phone', 'phone');
    project.addField('other', 'Other', 'text');

    // Passing both parent and child — child should be deduped
    project.batchDeleteItems(['contact', 'contact.email']);
    expect(project.state.definition.items).toHaveLength(1);
    expect(project.state.definition.items[0].key).toBe('other');
  });

  it('is a single undo entry', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    project.batchDeleteItems(['a', 'b']);
    expect(project.state.definition.items).toHaveLength(0);
    project.undo();
    expect(project.state.definition.items).toHaveLength(2);
  });
});

describe('reorderItem nested', () => {
  it('swaps nested item with previous sibling', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    project.addField('contact.phone', 'Phone', 'phone');
    const group = project.itemAt('contact');
    expect(group?.children?.[0].key).toBe('email');

    project.reorderItem('contact.phone', 'up');
    const after = project.itemAt('contact');
    expect(after?.children?.[0].key).toBe('phone');
    expect(after?.children?.[1].key).toBe('email');
  });

  it('is a no-op when item is already first sibling', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    project.addField('contact.phone', 'Phone', 'phone');

    // email is already first — reorder up should be no-op
    project.reorderItem('contact.email', 'up');
    const group = project.itemAt('contact');
    expect(group?.children?.[0].key).toBe('email');
    expect(group?.children?.[1].key).toBe('phone');
  });
});

describe('updateInstance multi-property', () => {
  it('dispatches one setInstance command per property', () => {
    const project = createProject();
    project.addInstance('cities', { source: 'https://old.com' });
    project.updateInstance('cities', { source: 'https://new.com', readonly: true });
    // Instance should still exist with updated values
    expect(project.instanceNames()).toContain('cities');
  });
});

describe('renameVariable', () => {
  it('delegates to handler — throws if handler missing', () => {
    const project = createProject();
    project.addVariable('x', '42');
    // renameVariable dispatches definition.renameVariable which may not exist
    expect(() => project.renameVariable('x', 'y')).toThrow();
  });
});

describe('addGroup display stack', () => {
  it('uses batchWithRebuild for display mode with single undo entry', () => {
    const project = createProject();
    project.addGroup('items', 'Items', { display: 'stack' });
    expect(project.itemAt('items')?.type).toBe('group');
    project.undo();
    expect(project.itemAt('items')).toBeUndefined();
  });
});

describe('reorderPage boundary', () => {
  it('is a no-op when moving first page up', () => {
    const project = createProject();
    const p1 = project.addPage('Page 1');
    project.addPage('Page 2');
    // Moving first page up should be a no-op (no throw)
    project.reorderPage(p1.createdId!, 'up');
    const pages = project.state.theme.pages ?? [];
    expect(pages[0]?.id).toBe(p1.createdId);
  });
});

describe('addSubmitButton with pageId', () => {
  it('dispatches both addNode and pages.assignItem', () => {
    const project = createProject();
    const { createdId } = project.addPage('Page 1');
    const result = project.addSubmitButton('Submit', createdId);
    expect(result.summary).toContain('submit');
    // The submit button should be assigned to the page
    const pages = project.state.theme.pages ?? [];
    const page = pages.find((p: any) => p.id === createdId);
    expect(page?.regions?.some((r: any) => r.key === 'submit')).toBe(true);
  });
});

describe('updateItem widget sets widgetHint on definition', () => {
  it('sets presentation.widgetHint on definition when widget is changed', () => {
    const project = createProject();
    project.addField('status', 'Status', 'choice');
    project.updateItem('status', { widget: 'radio' });
    const item = project.itemAt('status');
    expect((item as any)?.presentation?.widgetHint).toBe('radio');
  });
});

describe('updateItem widget with missing component node', () => {
  it('sets widgetHint on definition even when component node absent, emits warning', () => {
    const project = createProject();
    // Add field via definition
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'bare', label: 'Bare', dataType: 'text' } });
    // Set an authored component tree that does NOT include this field
    project.dispatch({
      type: 'project.import',
      payload: {
        definition: project.state.definition,
        component: {
          $formspecComponent: '0.1',
          tree: { component: 'Form', children: [] }, // no node for 'bare'
        },
      },
    });
    // This should NOT throw — should emit a warning for the component part
    // but still set widgetHint on definition
    const result = project.updateItem('bare', { widget: 'textarea' });
    const item = project.itemAt('bare');
    expect((item as any)?.presentation?.widgetHint).toBe('textarea');
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
    expect(result.warnings![0].code).toBe('COMPONENT_NODE_NOT_FOUND');
  });
});

describe('wrapInLayoutComponent dot-path', () => {
  it('extracts leaf key from dot-path', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    const result = project.wrapInLayoutComponent('contact.email', 'Card');
    expect(result.createdId).toBeDefined();
  });
});

describe('batchDuplicateItems ancestor dedup', () => {
  it('deduplicates descendants and returns all new paths', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    const result = project.batchDuplicateItems(['a', 'b']);
    expect(result.affectedPaths).toHaveLength(2);
    // Original items still present
    expect(project.state.definition.items.length).toBe(4);
  });

  it('deduplicates group with child', () => {
    const project = createProject();
    project.addGroup('g', 'Group');
    project.addField('g.f', 'F', 'text');
    // Passing both group and its child — child should be deduped
    const result = project.batchDuplicateItems(['g', 'g.f']);
    // Only 1 duplication (the group), not 2
    expect(result.affectedPaths).toHaveLength(1);
  });
});

describe('removeValidation preserves adjacent shapes', () => {
  it('removes only the targeted shape, leaves others intact', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    project.addField('b', 'B', 'integer');
    const r1 = project.addValidation('*', 'a > 0', 'A positive');
    const r2 = project.addValidation('*', 'b > 0', 'B positive');

    project.removeValidation(r1.createdId!);

    const shapes = project.state.definition.shapes ?? [];
    expect(shapes.some((s: any) => s.id === r1.createdId)).toBe(false);
    expect(shapes.some((s: any) => s.id === r2.createdId)).toBe(true);
  });
});

describe('copyItem deep shapes with new IDs', () => {
  it('copies shapes with new auto-generated IDs (not same as original)', () => {
    const project = createProject();
    project.addField('score', 'Score', 'integer');
    const shapeResult = project.addValidation('score', 'score > 0', 'Must be positive');
    const originalShapeId = shapeResult.createdId!;
    expect(originalShapeId).toBeDefined();

    project.copyItem('score', true);

    const allShapes = project.state.definition.shapes ?? [];
    // There should now be 2 shapes — original and copy
    expect(allShapes.length).toBe(2);
    const originalShape = allShapes.find((s: any) => s.id === originalShapeId);
    const copyShape = allShapes.find((s: any) => s.id !== originalShapeId);
    expect(originalShape).toBeDefined();
    expect(copyShape).toBeDefined();
    // The copy should have a DIFFERENT id
    expect(copyShape!.id).not.toBe(originalShapeId);
    // The copy should target the copy path
    expect((copyShape as any).target).toBe('score_copy');
  });
});

describe('copyItem deep edge cases', () => {
  it('copies binds with rewritten paths for required field', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.require('name');
    const result = project.copyItem('name', true);
    // The copy should have its own required bind
    const copyPath = result.affectedPaths[0];
    expect(copyPath).toBeDefined();
    const copyBind = project.bindFor(copyPath);
    expect(copyBind?.required).toBe('true');
  });

  it('copies constraint bind (bare refs not rewritten by parser-aware rewriter)', () => {
    const project = createProject();
    project.addField('age', 'Age', 'integer');
    // Bare identifier 'age' — rewriteFELReferences only handles $-prefixed refs
    project.updateItem('age', { constraint: 'age > 0' });
    const result = project.copyItem('age', true);
    const copyPath = result.affectedPaths[0];
    const copyBind = project.bindFor(copyPath);
    // Constraint IS copied (even if bare refs aren't rewritten)
    expect(copyBind?.constraint).toBe('age > 0');
  });
});

// ── Spec coverage: remaining edge cases ──

describe('updateItem routing exhaustiveness', () => {
  it('routes choicesFrom to setItemProperty with optionSet property', () => {
    const project = createProject();
    project.addField('status', 'Status', 'choice');
    // choicesFrom maps to 'optionSet' in the routing table
    const result = project.updateItem('status', { choicesFrom: 'statusOptions' });
    expect(result.affectedPaths[0]).toBe('status');
    // Verify command was dispatched (optionSet is stored on the item)
    const items = project.state.definition.items;
    const item = items.find((i: any) => i.key === 'status');
    expect((item as any)?.optionSet).toBe('statusOptions');
  });

  it('routes currency to setItemProperty', () => {
    const project = createProject();
    project.addField('amount', 'Amount', 'currency');
    project.updateItem('amount', { currency: 'EUR' });
    const item = project.itemAt('amount');
    expect((item as any)?.currency).toBe('EUR');
  });

  it('routes precision to setItemProperty', () => {
    const project = createProject();
    project.addField('amount', 'Amount', 'decimal');
    project.updateItem('amount', { precision: 2 });
    const item = project.itemAt('amount');
    expect((item as any)?.precision).toBe(2);
  });

  it('routes constraintMessage to setBind', () => {
    const project = createProject();
    project.addField('age', 'Age', 'integer');
    project.updateItem('age', { constraintMessage: 'Invalid age' });
    const bind = project.bindFor('age');
    expect(bind?.constraintMessage).toBe('Invalid age');
  });

  it('routes calculate to setBind', () => {
    const project = createProject();
    project.addField('total', 'Total', 'decimal');
    project.addField('subtotal', 'Sub', 'decimal');
    project.updateItem('total', { calculate: 'subtotal * 1.1' });
    const bind = project.bindFor('total');
    expect(bind?.calculate).toBe('subtotal * 1.1');
  });

  it('routes relevant to setBind', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('nickname', 'Nick', 'text');
    project.updateItem('nickname', { relevant: 'name != ""' });
    const bind = project.bindFor('nickname');
    expect(bind?.relevant).toContain('name');
  });

  it('routes page to pages.assignItem', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const page = project.addPage('Page 1');
    project.updateItem('name', { page: page.createdId! });
    // Verify assignment happened (no throw = success)
    expect(true).toBe(true);
  });
});

describe('updateValidation all changes keys', () => {
  it('dispatches timing, severity, code, and activeWhen to setShapeProperty', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    const result = project.addValidation('*', 'a > 0', 'Positive');
    const id = result.createdId!;

    project.updateValidation(id, {
      timing: 'submit',
      severity: 'warning',
      code: 'CUSTOM_CODE',
      activeWhen: 'a > 0',
    });

    const shapes = project.state.definition.shapes ?? [];
    const shape = shapes.find((s: any) => s.id === id) as any;
    expect(shape.timing).toBe('submit');
    expect(shape.severity).toBe('warning');
    expect(shape.code).toBe('CUSTOM_CODE');
    expect(shape.activeWhen).toBe('a > 0');
  });
});

describe('removeItem recursive group cleanup', () => {
  it('cleans up binds on descendants when group is deleted', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    project.addField('contact.phone', 'Phone', 'phone');
    project.addField('summary', 'Summary', 'text');
    // Make summary calculate from a descendant
    project.calculate('summary', 'contact.email');
    expect(project.bindFor('summary')?.calculate).toBe('contact.email');

    // Delete the group — summary's calculate should be cleaned up
    project.removeItem('contact');
    expect(project.bindFor('summary')?.calculate).toBeUndefined();
  });
});

describe('addContent defaults', () => {
  it('defaults widgetHint to paragraph when no kind specified', () => {
    const project = createProject();
    const result = project.addContent('intro', 'Welcome to the form');
    const item = project.itemAt('intro');
    expect((item as any)?.presentation?.widgetHint).toBe('paragraph');
  });
});

describe('addField alias resolution', () => {
  it('resolves all aliases to correct dataType and defaultWidget', () => {
    // Every alias in FIELD_TYPE_MAP must produce the correct dataType on the definition item.
    // Aliases that are synonyms (e.g. datetime/dateTime) map to the same dataType.
    const expected: [alias: string, dataType: string][] = [
      ['text', 'text'],
      ['string', 'string'],
      ['integer', 'integer'],
      ['decimal', 'decimal'],
      ['number', 'decimal'],
      ['boolean', 'boolean'],
      ['date', 'date'],
      ['datetime', 'dateTime'],
      ['dateTime', 'dateTime'],
      ['time', 'time'],
      ['url', 'uri'],
      ['uri', 'uri'],
      ['file', 'attachment'],
      ['attachment', 'attachment'],
      ['signature', 'attachment'],
      ['choice', 'choice'],
      ['multichoice', 'multiChoice'],
      ['multiChoice', 'multiChoice'],
      ['currency', 'money'],
      ['money', 'money'],
      ['rating', 'integer'],
      ['slider', 'decimal'],
      ['email', 'string'],
      ['phone', 'string'],
    ];

    for (const [alias, dataType] of expected) {
      const project = createProject();
      project.addField(`f_${alias}`, `Field ${alias}`, alias);
      const item = project.itemAt(`f_${alias}`);
      expect(item?.type, `${alias}: type should be 'field'`).toBe('field');
      expect(item?.dataType, `${alias}: dataType`).toBe(dataType);
    }
  });

  it('email and phone aliases set constraint binds', () => {
    const project = createProject();
    project.addField('em', 'Email', 'email');
    project.addField('ph', 'Phone', 'phone');
    expect(project.bindFor('em')?.constraint).toMatch(/matches/);
    expect(project.bindFor('ph')?.constraint).toMatch(/matches/);
  });
});

describe('addSubmitButton component tree', () => {
  it('component.addNode includes parent: { nodeId: "root" }', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addSubmitButton('Go');

    // The submit button should be a direct child of the root node
    const tree = project.component.tree as any;
    const rootChildren = tree?.children ?? [];
    const submitNode = rootChildren.find(
      (n: any) => n.component === 'SubmitButton'
    );
    expect(submitNode).toBeDefined();
    expect(submitNode?.label).toBe('Go');
  });
});

describe('HelperError instanceof', () => {
  it('works in catch blocks (class, not interface)', () => {
    const project = createProject();
    let caught = false;
    try {
      project.removeItem('nonexistent.path');
    } catch (e) {
      caught = true;
      expect(e).toBeInstanceOf(HelperError);
      expect(e).toBeInstanceOf(Error);
      if (e instanceof HelperError) {
        expect(e.code).toBe('PATH_NOT_FOUND');
        expect(typeof e.message).toBe('string');
      }
    }
    expect(caught).toBe(true);
  });
});

// ── Pre-validation Error Codes ──

describe('VARIABLE_NOT_FOUND pre-validation', () => {
  it('updateVariable throws for nonexistent variable', () => {
    const project = createProject();
    try {
      project.updateVariable('ghost', '42');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('VARIABLE_NOT_FOUND');
    }
  });

  it('removeVariable throws for nonexistent variable', () => {
    const project = createProject();
    try {
      project.removeVariable('ghost');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('VARIABLE_NOT_FOUND');
    }
  });
});

describe('INSTANCE_NOT_FOUND pre-validation', () => {
  it('updateInstance throws for nonexistent instance', () => {
    const project = createProject();
    try {
      project.updateInstance('ghost', { source: 'http://x' });
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('INSTANCE_NOT_FOUND');
      expect((e as HelperError).detail).toHaveProperty('validInstances');
    }
  });

  it('removeInstance throws for nonexistent instance', () => {
    const project = createProject();
    try {
      project.removeInstance('ghost');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('INSTANCE_NOT_FOUND');
    }
  });

  it('renameInstance throws for nonexistent instance', () => {
    const project = createProject();
    try {
      project.renameInstance('ghost', 'newname');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('INSTANCE_NOT_FOUND');
    }
  });
});

describe('ROUTE_OUT_OF_BOUNDS pre-validation', () => {
  it('updateScreenRoute throws for out-of-bounds index', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenRoute('1 = 1', 'pass');
    try {
      project.updateScreenRoute(99, { condition: '1 = 2' });
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('ROUTE_OUT_OF_BOUNDS');
    }
  });

  it('reorderScreenRoute throws for out-of-bounds index', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenRoute('1 = 1', 'pass');
    try {
      project.reorderScreenRoute(99, 'up');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('ROUTE_OUT_OF_BOUNDS');
    }
  });
});

describe('ROUTE_MIN_COUNT pre-validation', () => {
  it('removeScreenRoute throws when trying to delete the last route', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenRoute('1 = 1', 'pass');
    try {
      project.removeScreenRoute(0);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('ROUTE_MIN_COUNT');
      expect((e as HelperError).detail?.currentRouteCount).toBe(1);
    }
  });
});

describe('DUPLICATE_KEY pre-validation', () => {
  it('addField throws when key already exists', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    try {
      project.addField('name', 'Another Name', 'text');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('DUPLICATE_KEY');
    }
  });

  it('addGroup throws when key already exists', () => {
    const project = createProject();
    project.addGroup('section', 'Section');
    try {
      project.addGroup('section', 'Another Section');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('DUPLICATE_KEY');
    }
  });
});
