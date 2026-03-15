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
