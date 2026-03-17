import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';
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
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    expect(project.fieldPaths()).toContain('contact.email');
  });

  it('adds field with explicit parentPath in props', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
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

  it('adds nested group via parentPath prop', () => {
    const project = createProject();
    project.addGroup('outer', 'Outer');
    project.addGroup('inner', 'Inner', { parentPath: 'outer' });
    const outer = project.itemAt('outer');
    expect(outer?.children).toHaveLength(1);
    expect(outer?.children?.[0].key).toBe('inner');
  });

  it('parentPath takes precedence over dot-path parsing', () => {
    const project = createProject();
    project.addGroup('container', 'Container');
    // path is "child" but parentPath says "container"
    project.addGroup('child', 'Child', { parentPath: 'container' });
    expect(project.itemAt('container')?.children?.[0].key).toBe('child');
    // "child" should not exist at root
    expect(
      project.core.state.definition.items.some(
        (i: any) => i.key === 'child',
      ),
    ).toBe(false);
  });

  it('throws on parentPath pointing to non-existent group', () => {
    const project = createProject();
    expect(() =>
      project.addGroup('child', 'Child', { parentPath: 'nonexistent' }),
    ).toThrow();
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
    expect((project.itemAt('div') as any)?.presentation?.widgetHint).toBe(
      'divider',
    );
  });

  it('adds content inside a group via parentPath prop', () => {
    const project = createProject();
    project.addGroup('section', 'Section');
    project.addContent('heading', 'Section Title', 'heading', {
      parentPath: 'section',
    });
    const section = project.itemAt('section');
    expect(section?.children).toHaveLength(1);
    expect(section?.children?.[0].key).toBe('heading');
    expect(section?.children?.[0].type).toBe('display');
  });

  it('adds content without parentPath at root (existing behavior)', () => {
    const project = createProject();
    project.addContent('intro', 'Welcome');
    expect(
      project.core.state.definition.items.some(
        (i: any) => i.key === 'intro',
      ),
    ).toBe(true);
  });

  it('dot-path still works for content (regression)', () => {
    const project = createProject();
    project.addGroup('section', 'Section');
    project.addContent('section.note', 'A note');
    const section = project.itemAt('section');
    expect(section?.children).toHaveLength(1);
    expect(section?.children?.[0].key).toBe('note');
  });

  it('parentPath takes precedence over dot-path for content', () => {
    const project = createProject();
    project.addGroup('container', 'Container');
    project.addContent('myheading', 'Title', 'heading', {
      parentPath: 'container',
    });
    expect(project.itemAt('container')?.children?.[0].key).toBe('myheading');
  });

  it('throws when parentPath points to non-existent group', () => {
    const project = createProject();
    expect(() =>
      project.addContent('heading', 'Title', 'heading', {
        parentPath: 'nonexistent',
      }),
    ).toThrow();
  });

  it('supports insertIndex to control position', () => {
    const project = createProject();
    project.addContent('first', 'First');
    project.addContent('second', 'Second');
    project.addContent('zeroth', 'Zeroth', 'paragraph', { insertIndex: 0 });

    const items = project.definition.items;
    expect(items[0].key).toBe('zeroth');
    expect(items[1].key).toBe('first');
  });
});

describe('addGroup insertIndex', () => {
  it('supports insertIndex to control position', () => {
    const project = createProject();
    project.addGroup('first', 'First');
    project.addGroup('second', 'Second');
    project.addGroup('zeroth', 'Zeroth', { insertIndex: 0 });

    const items = project.definition.items;
    expect(items[0].key).toBe('zeroth');
    expect(items[1].key).toBe('first');
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

  it('OR-combines expressions when multiple arms target the same show field', () => {
    const project = createProject();
    project.addField('color', 'Color', 'choice', {
      choices: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }, { value: 'green', label: 'Green' }],
    });
    project.addField('warm_info', 'Warm Info', 'text');

    project.branch('color', [
      { when: 'red', show: 'warm_info' },
      { when: 'blue', show: 'warm_info' },
    ]);

    const bind = project.bindFor('warm_info');
    expect(bind?.relevant).toBe("color = 'red' or color = 'blue'");
  });

  it('OR-combines 3+ arms targeting the same show field', () => {
    const project = createProject();
    project.addField('size', 'Size', 'choice');
    project.addField('detail', 'Detail', 'text');

    project.branch('size', [
      { when: 'small', show: 'detail' },
      { when: 'medium', show: 'detail' },
      { when: 'large', show: 'detail' },
    ]);

    const bind = project.bindFor('detail');
    expect(bind?.relevant).toBe("size = 'small' or size = 'medium' or size = 'large'");
  });

  it('handles mixed shared and unique targets in branch arms', () => {
    const project = createProject();
    project.addField('type', 'Type', 'choice');
    project.addField('shared', 'Shared', 'text');
    project.addField('only_a', 'Only A', 'text');
    project.addField('only_b', 'Only B', 'text');

    project.branch('type', [
      { when: 'a', show: ['shared', 'only_a'] },
      { when: 'b', show: ['shared', 'only_b'] },
    ]);

    // shared should be OR'd
    expect(project.bindFor('shared')?.relevant).toBe("type = 'a' or type = 'b'");
    // unique targets get single expression
    expect(project.bindFor('only_a')?.relevant).toBe("type = 'a'");
    expect(project.bindFor('only_b')?.relevant).toBe("type = 'b'");
  });

  it('emits RELEVANT_OVERWRITTEN for pre-existing bind when arms share target', () => {
    const project = createProject();
    project.addField('type', 'Type', 'choice');
    project.addField('f', 'F', 'text');
    project.showWhen('f', 'type = true');

    const result = project.branch('type', [
      { when: 'a', show: 'f' },
      { when: 'b', show: 'f' },
    ]);

    expect(result.warnings?.some(w => w.code === 'RELEVANT_OVERWRITTEN')).toBe(true);
    // Still OR-combines the new expressions
    expect(project.bindFor('f')?.relevant).toBe("type = 'a' or type = 'b'");
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

    const shapes = project.definition.shapes;
    expect(shapes?.some((s: any) => s.id === shapeId)).toBe(true);

    project.removeValidation(shapeId);
    const shapesAfter = project.definition.shapes;
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

    const shapes = project.definition.shapes;
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
    const shapes = project.definition.shapes ?? [];
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
    const routesBefore = project.definition.screener?.routes ?? [];
    expect(routesBefore.length).toBe(2);
    expect((routesBefore[0] as any).condition).toBe('age > 18');
    // Delete the field — route referencing 'age' should be removed
    project.removeItem('age');
    const routesAfter = project.definition.screener?.routes ?? [];
    expect(routesAfter.length).toBe(1);
    expect((routesAfter[0] as any).condition).toBe('1 = 1');
  });

  it('cleans up mapping rules referencing deleted field', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('email', 'Email', 'email');
    // Add mapping rules — one for name, one for email
    project.mapField('name', '/output/name');
    project.mapField('email', '/output/email');
    const rulesBefore = (project.mapping as any).rules;
    expect(rulesBefore.length).toBe(2);
    // Delete name — its mapping rule should be removed
    project.removeItem('name');
    const rulesAfter = (project.mapping as any).rules;
    expect(rulesAfter.length).toBe(1);
    expect(rulesAfter[0].sourcePath).toBe('email');
  });

  it('deletes multiple mapping rules in descending index order (no index shift)', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    // Add 3 rules: 2 reference 'a', 1 references 'b'
    project.mapField('a', '/out/a1');
    project.mapField('b', '/out/b');
    project.mapField('a', '/out/a2');
    expect((project.mapping as any).rules.length).toBe(3);
    // Delete 'a' — both mapping rules for 'a' should be removed
    project.removeItem('a');
    const rulesAfter = (project.mapping as any).rules;
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

  it('summary includes parent and index when reordering within same parent', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    const result = project.moveItem('b', undefined, 0);
    // Summary should NOT say "Moved 'b' to 'b'" — it should mention the index
    expect(result.summary).toContain('index 0');
    expect(result.summary).not.toBe("Moved 'b' to 'b'");
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
    const items = project.definition.items;
    expect(items[0].key).toBe('a');
    expect(items[1].key).toBe('b');

    project.reorderItem('b', 'up');
    const after = project.definition.items;
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
    const def = project.definition as any;
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
    expect(project.definition.items.length).toBe(2);
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

  it('shallow copy to targetPath places clone under target group', () => {
    const project = createProject();
    project.addGroup('individual', 'Individual');
    project.addField('individual.phone', 'Phone', 'text');
    project.addGroup('business', 'Business');

    const result = project.copyItem('individual.phone', false, 'business');
    expect(result.affectedPaths[0]).toBe('business.phone');
    // Verify the item is actually under the business group
    const bizGroup = project.itemAt('business') as any;
    expect(bizGroup.children?.some((c: any) => c.key === 'phone')).toBe(true);
    // Original still in place
    expect(project.itemAt('individual.phone')).toBeDefined();
  });

  it('deep copy to targetPath places clone under target group', () => {
    const project = createProject();
    project.addGroup('individual', 'Individual');
    project.addField('individual.phone', 'Phone', 'text');
    project.require('individual.phone');
    project.addGroup('business', 'Business');

    const result = project.copyItem('individual.phone', true, 'business');
    expect(result.affectedPaths[0]).toBe('business.phone');
    // Verify bind was copied to new path
    const copyBind = project.bindFor('business.phone');
    expect(copyBind?.required).toBe('true');
  });

  it('copy to nonexistent targetPath throws PATH_NOT_FOUND', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    expect(() => project.copyItem('name', false, 'nonexistent')).toThrow(HelperError);
    try { project.copyItem('name', false, 'nonexistent'); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('copy to same parent behaves as sibling copy', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'text');

    const result = project.copyItem('contact.email', false, 'contact');
    // Should still be under contact, just with a suffixed key
    expect(result.affectedPaths[0]).toMatch(/^contact\./);
    const group = project.itemAt('contact') as any;
    expect(group.children.length).toBe(2);
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
    const items = project.definition.items;
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
    expect(project.definition.items).toHaveLength(1);
    expect(project.definition.items[0].key).toBe('c');
    project.undo();
    expect(project.definition.items).toHaveLength(3);
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
    expect(project.definition.items.length).toBe(4);
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

  it('returns createdId with node ID', () => {
    const project = createProject();
    const result = project.addSubmitButton('Go');
    expect(result.createdId).toBeDefined();
    expect(result.affectedPaths[0]).toBe(result.createdId);
  });
});

// ── Page Helpers ──

describe('addPage', () => {
  it('creates both a definition group AND a theme page', () => {
    const project = createProject();
    const result = project.addPage('Step 1');

    // Returns a createdId (the page ID)
    expect(result.createdId).toBeDefined();

    // Theme page exists
    const pages = project.theme.pages ?? [];
    expect(pages.length).toBe(1);
    const page = pages[0];
    expect(page.title).toBe('Step 1');

    // Definition group exists
    const groupKey = result.affectedPaths[0];
    expect(groupKey).toBeDefined();
    const item = project.itemAt(groupKey);
    expect(item?.type).toBe('group');
    expect(item?.label).toBe('Step 1');

    // Group is wired to page via regions
    expect(page.regions?.some((r: any) => r.key === groupKey)).toBe(true);
  });

  it('sets wizard page mode on first page', () => {
    const project = createProject();
    project.addPage('Step 1');
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');
  });

  it('preserves existing page mode (tabs)', () => {
    const project = createProject();
    project.setFlow('tabs');
    project.addPage('Tab 1');
    expect(project.definition.formPresentation?.pageMode).toBe('tabs');
  });

  it('produces Wizard component tree after addPage', () => {
    const project = createProject();
    const result = project.addPage('Step 1');
    const groupKey = result.affectedPaths[0];

    // Add a field into the group
    project.addField(`${groupKey}.name`, 'Name', 'text');

    const comp = project.effectiveComponent as any;
    expect(comp.tree?.component).toBe('Wizard');
    const pageNodes = comp.tree?.children ?? [];
    expect(pageNodes.length).toBeGreaterThanOrEqual(1);
    expect(pageNodes[0]?.component).toBe('Page');
  });

  it('creates multiple pages with unique groups', () => {
    const project = createProject();
    const r1 = project.addPage('Step 1');
    const r2 = project.addPage('Step 2');

    const pages = project.theme.pages ?? [];
    expect(pages.length).toBe(2);

    // Different groups
    expect(r1.affectedPaths[0]).not.toBe(r2.affectedPaths[0]);

    // Both groups exist
    expect(project.itemAt(r1.affectedPaths[0])?.type).toBe('group');
    expect(project.itemAt(r2.affectedPaths[0])?.type).toBe('group');
  });

  it('handles description parameter', () => {
    const project = createProject();
    const result = project.addPage('Step 1', 'First step');
    const pages = project.theme.pages ?? [];
    const page = pages.find((p: any) => p.id === result.createdId);
    expect(page?.description).toBe('First step');
  });

  it('undoes both tiers in one step', () => {
    const project = createProject();
    const result = project.addPage('Step 1');
    const groupKey = result.affectedPaths[0];

    expect(project.definition.items.length).toBe(1);
    expect((project.theme.pages ?? []).length).toBe(1);

    project.undo();

    expect(project.definition.items.length).toBe(0);
    expect((project.theme.pages ?? []).length).toBe(0);
  });
});

describe('addWizardPage removal', () => {
  it('addWizardPage method does not exist on Project', () => {
    const project = createProject();
    expect((project as any).addWizardPage).toBeUndefined();
  });
});

describe('removePage', () => {
  it('removes a page by ID', () => {
    const project = createProject();
    const { createdId } = project.addPage('Page 1');
    project.addPage('Page 2');
    project.removePage(createdId!);
    const pages = project.theme.pages ?? [];
    expect(pages.find((p: any) => p.id === createdId)).toBeUndefined();
  });

  it('removes the definition group created by addPage', () => {
    const project = createProject();
    const r1 = project.addPage('Page 1');
    project.addPage('Page 2');
    const groupKey = r1.affectedPaths[0];
    expect(project.itemAt(groupKey)).toBeDefined();

    project.removePage(r1.createdId!);
    expect(project.itemAt(groupKey)).toBeUndefined();
  });

  it('removes children of the definition group', () => {
    const project = createProject();
    const r1 = project.addPage('Page 1');
    project.addPage('Page 2');
    const groupKey = r1.affectedPaths[0];
    project.addField(`${groupKey}.name`, 'Name', 'text');
    expect(project.itemAt(`${groupKey}.name`)).toBeDefined();

    project.removePage(r1.createdId!);
    expect(project.itemAt(`${groupKey}.name`)).toBeUndefined();
  });

  it('is atomic — single undo restores page, group, and children', () => {
    const project = createProject();
    const r1 = project.addPage('Page 1');
    project.addPage('Page 2');
    const groupKey = r1.affectedPaths[0];
    project.addField(`${groupKey}.name`, 'Name', 'text');

    project.removePage(r1.createdId!);

    // Everything gone
    expect(project.itemAt(groupKey)).toBeUndefined();
    expect((project.theme.pages ?? []).find((p: any) => p.id === r1.createdId)).toBeUndefined();

    // Single undo restores everything
    project.undo();
    expect(project.itemAt(groupKey)).toBeDefined();
    expect(project.itemAt(`${groupKey}.name`)).toBeDefined();
    expect((project.theme.pages ?? []).find((p: any) => p.id === r1.createdId)).toBeDefined();
  });

  it('does not delete group if page has no region pointing to a root group', () => {
    // Page created manually without a corresponding definition group
    const project = createProject();
    project.addPage('Page 1');
    // Manually add a page with no region wiring
    project.setFlow('wizard');
    const pagesBefore = project.definition.items.length;
    // Use the core dispatch to add a raw theme page (no group)
    (project as any).core.dispatch({ type: 'pages.addPage', payload: { id: 'orphan-page', title: 'Orphan' } });
    expect(project.definition.items.length).toBe(pagesBefore); // no new group
    project.removePage('orphan-page');
    // Original items unchanged
    expect(project.definition.items.length).toBe(pagesBefore);
  });
});

describe('reorderPage', () => {
  it('swaps pages', () => {
    const project = createProject();
    const p1 = project.addPage('Page 1');
    const p2 = project.addPage('Page 2');
    project.reorderPage(p2.createdId!, 'up');
    const pages = project.theme.pages ?? [];
    expect(pages[0]?.id).toBe(p2.createdId);
  });
});

describe('updatePage', () => {
  it('updates title of a page', () => {
    const project = createProject();
    const { createdId } = project.addPage('Old Title');
    project.updatePage(createdId!, { title: 'New Title' });
    const pages = project.theme.pages ?? [];
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
    const pages = project.theme.pages ?? [];
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
    const pages = project.theme.pages ?? [];
    const page = pages.find((p: any) => p.id === createdId);
    expect(page?.regions?.some((r: any) => r.key === 'name')).toBeFalsy();
  });
});

describe('setFlow', () => {
  it('sets flow mode to wizard', () => {
    const project = createProject();
    project.setFlow('wizard');
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');
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
    expect(project.definition.screener).toBeDefined();
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

  it('stores a rejection message on the route', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenField('age', 'How old?', 'integer');
    project.addScreenRoute('age < 18', 'https://reject.example.com', 'Minors', 'You must be 18 or older to participate.');
    const route = project.definition.screener.routes[0];
    expect(route.message).toBe('You must be 18 or older to participate.');
    expect(route.label).toBe('Minors');
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
    expect(project.definition.screener.routes).toHaveLength(1);
  });

  it('updates a route message', () => {
    const project = createProject();
    project.setScreener(true);
    project.addScreenField('age', 'How old?', 'integer');
    project.addScreenRoute('age >= 18', 'https://example.com');
    project.updateScreenRoute(0, { message: 'Sorry, you do not qualify.' });
    const route = project.definition.screener.routes[0];
    expect(route.message).toBe('Sorry, you do not qualify.');
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
    const routes = project.definition.screener.routes;
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
    const routes = project.definition.screener.routes;
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

describe('addPage edge cases', () => {
  it('does not re-dispatch pageMode when already wizard', () => {
    const project = createProject();
    project.addPage('Step 1');
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');

    project.addPage('Step 2');
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');
    expect(project.definition.items).toHaveLength(2);
    expect((project.theme.pages ?? []).length).toBe(2);
  });
});

describe('addPage with custom ID', () => {
  it('uses the provided custom ID', () => {
    const project = createProject();
    const result = project.addPage('Step 1', undefined, 'my-page');
    expect(result.createdId).toBe('my-page');
    const pages = project.theme.pages ?? [];
    expect(pages.find((p: any) => p.id === 'my-page')).toBeDefined();
  });

  it('derives group key from page_id when provided, not title', () => {
    const project = createProject();
    const result = project.addPage('My Fancy Title', undefined, 'basics');
    // Group key should be derived from "basics" (the id), not "my_fancy_title" (the title)
    expect(result.affectedPaths[0]).toBe('basics');
    expect(project.itemAt('basics')).toBeDefined();
    expect(project.itemAt('basics')?.type).toBe('group');
  });

  it('falls back to title-derived key when no custom ID', () => {
    const project = createProject();
    const result = project.addPage('Contact Info');
    // Should derive from title since no custom ID
    expect(result.affectedPaths[0]).toBe('contact_info');
  });

  it('rejects invalid custom ID (starts with number)', () => {
    const project = createProject();
    expect(() => project.addPage('Step 1', undefined, '1bad-id')).toThrow(/invalid/i);
  });

  it('rejects invalid custom ID (contains spaces)', () => {
    const project = createProject();
    expect(() => project.addPage('Step 1', undefined, 'bad id')).toThrow(/invalid/i);
  });

  it('rejects duplicate custom ID', () => {
    const project = createProject();
    project.addPage('Step 1', undefined, 'step1');
    expect(() => project.addPage('Step 2', undefined, 'step1')).toThrow(/already exists/);
  });

  it('accepts valid ID patterns', () => {
    const project = createProject();
    const r1 = project.addPage('Step 1', undefined, 'stepOne');
    expect(r1.createdId).toBe('stepOne');
    const r2 = project.addPage('Step 2', undefined, 'step_2');
    expect(r2.createdId).toBe('step_2');
    const r3 = project.addPage('Step 3', undefined, 'step-3');
    expect(r3.createdId).toBe('step-3');
  });
});

describe('listPages', () => {
  it('returns empty array for a fresh project', () => {
    const project = createProject();
    expect(project.listPages()).toEqual([]);
  });

  it('returns pages with id and title', () => {
    const project = createProject();
    project.addPage('Step 1', undefined, 'step1');
    project.addPage('Step 2', 'Second step', 'step2');
    const pages = project.listPages();
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({ id: 'step1', title: 'Step 1', groupPath: 'step1' });
    expect(pages[1]).toEqual({ id: 'step2', title: 'Step 2', description: 'Second step', groupPath: 'step2' });
  });

  it('excludes description when not set', () => {
    const project = createProject();
    project.addPage('Step 1', undefined, 'step1');
    const pages = project.listPages();
    expect(pages[0]).not.toHaveProperty('description');
  });

  it('includes groupPath from page regions', () => {
    const project = createProject();
    project.addPage('Step 1', undefined, 'step1');
    const pages = project.listPages();
    expect(pages[0]).toHaveProperty('groupPath');
    expect(pages[0].groupPath).toBe('step1');
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
    expect(project.definition.items).toHaveLength(2);
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
    expect(project.definition.items).toHaveLength(1);
    expect(project.definition.items[0].key).toBe('other');
  });

  it('is a single undo entry', () => {
    const project = createProject();
    project.addField('a', 'A', 'text');
    project.addField('b', 'B', 'text');
    project.batchDeleteItems(['a', 'b']);
    expect(project.definition.items).toHaveLength(0);
    project.undo();
    expect(project.definition.items).toHaveLength(2);
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
    const pages = project.theme.pages ?? [];
    expect(pages[0]?.id).toBe(p1.createdId);
  });
});

describe('addSubmitButton with pageId', () => {
  it('dispatches both addNode and pages.assignItem using actual nodeId', () => {
    const project = createProject();
    const { createdId: pageId } = project.addPage('Page 1');
    const result = project.addSubmitButton('Submit', pageId);
    expect(result.summary).toContain('submit');
    expect(result.createdId).toBeDefined();
    // The submit button's region key should be its generated nodeId
    const pages = project.theme.pages ?? [];
    const page = pages.find((p: any) => p.id === pageId);
    expect(page?.regions?.some((r: any) => r.key === result.createdId)).toBe(true);
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

  it('widget change is undone in a single undo step', () => {
    const project = createProject();
    project.addField('status', 'Status', 'choice');
    const itemBefore = project.itemAt('status') as any;
    const hintBefore = itemBefore?.presentation?.widgetHint;

    project.updateItem('status', { widget: 'radio' });
    expect((project.itemAt('status') as any)?.presentation?.widgetHint).toBe('radio');

    // Single undo should revert both definition widgetHint and component widget
    project.undo();
    expect((project.itemAt('status') as any)?.presentation?.widgetHint).toBe(hintBefore ?? undefined);
  });
});

describe('updateItem widget change on boolean field', () => {
  it('changes a boolean field from Toggle to Checkbox', () => {
    const project = createProject();
    project.addField('agreed', 'I agree', 'boolean');

    // Default widget for boolean is Toggle
    const nodeBefore = project.componentFor('agreed');
    expect(nodeBefore?.component).toBe('Toggle');

    // Changing to Checkbox should work — Checkbox is a valid component
    // for boolean fields in the webcomponent renderer
    const result = project.updateItem('agreed', { widget: 'Checkbox' });
    expect(result.warnings).toBeUndefined();

    // Both definition hint and component tree should update
    const item = project.itemAt('agreed') as any;
    expect(item?.presentation?.widgetHint).toBe('checkbox');
    const nodeAfter = project.componentFor('agreed');
    expect(nodeAfter?.component).toBe('Checkbox');
  });
});

describe('updateItem widget with missing component node', () => {
  it('sets widgetHint on definition even when component node absent, emits warning', () => {
    const project = createProject();
    // Add field, then reload with a component tree that does NOT include it
    project.addField('bare', 'Bare', 'text');
    project.loadBundle({
      definition: project.definition,
      component: {
        $formspecComponent: '0.1',
        tree: { component: 'Form', children: [] }, // no node for 'bare'
      } as any,
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
    expect(project.definition.items.length).toBe(4);
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

    const shapes = project.definition.shapes ?? [];
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

    const allShapes = project.definition.shapes ?? [];
    // There should now be 2 shapes — original and copy
    expect(allShapes.length).toBe(2);
    const originalShape = allShapes.find((s: any) => s.id === originalShapeId);
    const copyShape = allShapes.find((s: any) => s.id !== originalShapeId);
    expect(originalShape).toBeDefined();
    expect(copyShape).toBeDefined();
    // The copy should have a DIFFERENT id
    expect(copyShape!.id).not.toBe(originalShapeId);
    // The copy should target the copy path (uniqueKey produces score_1)
    expect((copyShape as any).target).toBe('score_1');
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
    const items = project.definition.items;
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
    // Verify the page has the item assigned via regions
    const pages = project.theme.pages ?? [];
    const targetPage = pages.find((p: any) => p.id === page.createdId);
    const regionKeys = (targetPage as any)?.regions?.map((r: any) => r.key) ?? [];
    expect(regionKeys).toContain('name');
  });

  it('routes dataType to setFieldDataType', () => {
    const project = createProject();
    project.addField('amount', 'Amount', 'text');
    expect(project.itemAt('amount')?.dataType).toBe('text');

    project.updateItem('amount', { dataType: 'decimal' });
    expect(project.itemAt('amount')?.dataType).toBe('decimal');
  });

  it('routes style to theme.setItemStyle (CSS in style sub-object)', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { style: { fontSize: '1.5rem', color: 'blue' } });

    // theme.setItemStyle nests CSS inside items[key].style
    const overrides = (project.theme as any).items?.name;
    expect(overrides?.style?.fontSize).toBe('1.5rem');
    expect(overrides?.style?.color).toBe('blue');
  });

  it('routes readonly: true to setBind "true"', () => {
    const project = createProject();
    project.addField('f', 'F', 'text');
    project.updateItem('f', { readonly: true });
    expect(project.bindFor('f')?.readonly).toBe('true');
  });

  it('routes readonly: false to null-deletion', () => {
    const project = createProject();
    project.addField('f', 'F', 'text');
    project.updateItem('f', { readonly: true });
    expect(project.bindFor('f')?.readonly).toBe('true');
    project.updateItem('f', { readonly: false });
    expect(project.bindFor('f')?.readonly).toBeUndefined();
  });

  it('routes default to setBind', () => {
    const project = createProject();
    project.addField('f', 'F', 'text');
    project.updateItem('f', { default: 'today()' });
    expect(project.bindFor('f')?.default).toBe('today()');
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

    const shapes = project.definition.shapes ?? [];
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

describe('addContent page placement', () => {
  it('places content on the specified page via pages.assignItem', () => {
    const project = createProject();
    const pageResult = project.addPage('Page One');
    const pageId = pageResult.createdId!;
    const groupKey = pageResult.affectedPaths[0];

    // Content must go inside the page's group in a paged definition
    project.addContent(`${groupKey}.intro`, 'Welcome', 'heading', { page: pageId });

    const pages = (project.core as any).state.theme.pages as any[];
    const page = pages.find((p: any) => p.id === pageId);
    expect(page.regions.some((r: any) => r.key === 'intro')).toBe(true);
  });

  it('throws PAGE_NOT_FOUND when page does not exist', () => {
    const project = createProject();
    expect(() =>
      project.addContent('intro', 'Welcome', 'heading', { page: 'nonexistent' }),
    ).toThrow(HelperError);
    try {
      project.addContent('intro2', 'Welcome', 'heading', { page: 'nonexistent' });
    } catch (e) {
      expect((e as HelperError).code).toBe('PAGE_NOT_FOUND');
    }
  });

  it('still adds the content item when page is provided', () => {
    const project = createProject();
    const pageResult = project.addPage('Page One');
    const pageId = pageResult.createdId!;
    const groupKey = pageResult.affectedPaths[0];

    // Content must go inside the page's group in a paged definition
    project.addContent(`${groupKey}.intro`, 'Welcome', 'heading', { page: pageId });

    const item = project.itemAt(`${groupKey}.intro`);
    expect(item?.type).toBe('display');
    expect((item as any)?.presentation?.widgetHint).toBe('heading');
  });
});

describe('page prop auto-resolves to parentPath', () => {
  it('addField with props.page nests field under the page group', () => {
    const project = createProject();
    const pageResult = project.addPage('Basics', undefined, 'basics');
    const pageId = pageResult.createdId!;

    // Use only props.page — no dot-path, no parentPath
    project.addField('name', 'Full Name', 'text', { page: pageId });

    // Field should be nested under the page's group
    const item = project.itemAt('basics.name');
    expect(item).toBeDefined();
    expect(item?.label).toBe('Full Name');
  });

  it('explicit parentPath takes precedence over page prop', () => {
    const project = createProject();
    const pageResult = project.addPage('Basics', undefined, 'basics');
    const pageId = pageResult.createdId!;

    // Create another group under the page group
    project.addGroup('basics.contact', 'Contact');

    // parentPath takes precedence
    project.addField('phone', 'Phone', 'phone', { page: pageId, parentPath: 'basics.contact' });

    expect(project.itemAt('basics.contact.phone')).toBeDefined();
    // Should NOT be at basics.phone
    expect(project.itemAt('basics.phone')).toBeUndefined();
  });

  it('addContent with props.page nests content under the page group', () => {
    const project = createProject();
    const pageResult = project.addPage('Info', undefined, 'info');
    const pageId = pageResult.createdId!;

    project.addContent('intro', 'Welcome', 'heading', { page: pageId });

    const item = project.itemAt('info.intro');
    expect(item).toBeDefined();
    expect(item?.type).toBe('display');
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

// ── S3: Bind helper path validation ──

describe('bind helpers reject nonexistent target paths', () => {
  it('showWhen throws PATH_NOT_FOUND for nonexistent target', () => {
    const project = createProject();
    project.addField('toggle', 'Toggle', 'boolean');
    expect(() => project.showWhen('nonexistent.field', '$toggle = true')).toThrow(HelperError);
    try { project.showWhen('nonexistent.field', '$toggle = true'); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('readonlyWhen throws PATH_NOT_FOUND for nonexistent target', () => {
    const project = createProject();
    expect(() => project.readonlyWhen('ghost', 'true')).toThrow(HelperError);
    try { project.readonlyWhen('ghost', 'true'); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('require throws PATH_NOT_FOUND for nonexistent target', () => {
    const project = createProject();
    expect(() => project.require('missing_field')).toThrow(HelperError);
    try { project.require('missing_field'); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('calculate throws PATH_NOT_FOUND for nonexistent target', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    expect(() => project.calculate('nope', '$a + 1')).toThrow(HelperError);
    try { project.calculate('nope', '$a + 1'); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('addValidation throws PATH_NOT_FOUND for nonexistent non-wildcard target', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    expect(() => project.addValidation('bogus_field', '$a > 0', 'Positive')).toThrow(HelperError);
    try { project.addValidation('bogus_field', '$a > 0', 'Positive'); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('addValidation throws PATH_NOT_FOUND for screener-only field', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.setScreener(true);
    project.addScreenField('age', 'Age', 'integer');
    // 'age' exists only in the screener — not in the main form tree
    expect(() => project.addValidation('age', '$age > 0', 'Must be positive')).toThrow(HelperError);
    try { project.addValidation('age', '$age > 0', 'Must be positive'); } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('addValidation allows wildcard targets (* and #)', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');
    // These should NOT throw
    expect(() => project.addValidation('*', '$a > 0', 'Positive')).not.toThrow();
    expect(() => project.addValidation('#', '$a > 0', 'Positive')).not.toThrow();
  });

  it('addValidation allows paths containing [*] wildcards', () => {
    const project = createProject();
    project.addGroup('items', 'Items', { repeat: { min: 1, max: 5 } });
    project.addField('items.amount', 'Amount', 'decimal');
    // Wildcard shape target — should not throw
    expect(() => project.addValidation('items[*].amount', '$items[*].amount > 0', 'Positive')).not.toThrow();
  });

  it('bind helpers still work with valid existing targets (regression)', () => {
    const project = createProject();
    project.addField('toggle', 'Toggle', 'boolean');
    project.addField('name', 'Name', 'text');
    project.addField('total', 'Total', 'integer');

    // All should succeed without throwing
    expect(() => project.showWhen('name', '$toggle = true')).not.toThrow();
    expect(() => project.readonlyWhen('name', 'true')).not.toThrow();
    expect(() => project.require('name')).not.toThrow();
    expect(() => project.calculate('total', '42')).not.toThrow();
    expect(() => project.addValidation('name', 'string-length($name) > 0', 'Required')).not.toThrow();
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

// ── *ThemePage method removal ──

describe('*ThemePage methods removed', () => {
  it('addThemePage does not exist on Project', () => {
    const project = createProject();
    expect((project as any).addThemePage).toBeUndefined();
  });

  it('deleteThemePage does not exist on Project', () => {
    const project = createProject();
    expect((project as any).deleteThemePage).toBeUndefined();
  });

  it('updateThemePage does not exist on Project', () => {
    const project = createProject();
    expect((project as any).updateThemePage).toBeUndefined();
  });

  it('reorderThemePage does not exist on Project', () => {
    const project = createProject();
    expect((project as any).reorderThemePage).toBeUndefined();
  });

  it('renameThemePage does not exist on Project', () => {
    const project = createProject();
    expect((project as any).renameThemePage).toBeUndefined();
  });
});

// ── renamePage ──

describe('renamePage', () => {
  it('renames a page ID', () => {
    const project = createProject();
    const { createdId } = project.addPage('Page 1');
    project.renamePage(createdId!, 'new-id');
    const pages = project.theme.pages ?? [];
    expect(pages.find((p: any) => p.id === 'new-id')).toBeDefined();
    expect(pages.find((p: any) => p.id === createdId)).toBeUndefined();
  });
});

// ── CIRCULAR_REFERENCE pre-validation ──

describe('CIRCULAR_REFERENCE pre-validation', () => {
  it('addVariable throws for direct self-reference', () => {
    const project = createProject();
    try {
      project.addVariable('x', '@x + 1');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('CIRCULAR_REFERENCE');
    }
  });

  it('updateVariable throws for direct self-reference', () => {
    const project = createProject();
    project.addVariable('x', '42');
    try {
      project.updateVariable('x', '@x + 1');
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('CIRCULAR_REFERENCE');
    }
  });

  it('allows variable referencing a different variable', () => {
    const project = createProject();
    project.addVariable('y', '10');
    project.addVariable('x', '@y + 1');
    expect(project.variableNames()).toContain('x');
  });

  it('field ref $x does not trigger circular check for variable named x', () => {
    const project = createProject();
    project.addField('x', 'X', 'integer');
    // $x is a field reference, not a variable reference — should not trigger
    project.addVariable('x', '$x + 1');
    expect(project.variableNames()).toContain('x');
  });
});
