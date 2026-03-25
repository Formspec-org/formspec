/** @filedesc Tests for batch operations: wrapItemsInGroup, batchDeleteItems, batchDuplicateItems. */
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';
import { HelperError } from '../src/helper-types.js';

describe('wrapItemsInGroup', () => {
  it('wraps multiple items in a new group', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('email', 'Email', 'email');
    project.addField('phone', 'Phone', 'phone');

    const result = project.wrapItemsInGroup(
      ['name', 'email'],
      'contact',
      'Contact Info',
    );

    expect(result.affectedPaths).toContain('contact');
    expect(result.action.helper).toBe('wrapItemsInGroup');

    // Items should now be nested under the group
    const contactGroup = project.itemAt('contact');
    expect(contactGroup).toBeDefined();
    expect(contactGroup?.type).toBe('group');
    expect(contactGroup?.label).toBe('Contact Info');

    // Children should exist under the new group
    const nameItem = project.itemAt('contact.name');
    expect(nameItem).toBeDefined();
    expect(nameItem?.label).toBe('Name');

    const emailItem = project.itemAt('contact.email');
    expect(emailItem).toBeDefined();

    // Phone should still be at root
    const phoneItem = project.itemAt('phone');
    expect(phoneItem).toBeDefined();
  });

  it('throws PATH_NOT_FOUND for unknown item paths', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');

    expect(() =>
      project.wrapItemsInGroup(['name', 'nonexistent'], 'group', 'Group'),
    ).toThrow(HelperError);

    try {
      project.wrapItemsInGroup(['name', 'nonexistent'], 'group', 'Group');
    } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('throws DUPLICATE_KEY if group path already exists', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addGroup('contact', 'Contact');

    expect(() =>
      project.wrapItemsInGroup(['name'], 'contact', 'Contact'),
    ).toThrow(HelperError);

    try {
      project.wrapItemsInGroup(['name'], 'contact', 'Contact');
    } catch (e) {
      expect((e as HelperError).code).toBe('DUPLICATE_KEY');
    }
  });

  it('handles wrapping a single item', () => {
    const project = createProject();
    project.addField('q1', 'Question 1', 'text');

    const result = project.wrapItemsInGroup(['q1'], 'section', 'Section');

    expect(result.affectedPaths).toContain('section');
    expect(project.itemAt('section.q1')).toBeDefined();
    expect(project.itemAt('q1')).toBeUndefined();
  });
});

describe('batchDeleteItems', () => {
  it('deletes multiple items', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');
    project.addField('q2', 'Q2', 'text');
    project.addField('q3', 'Q3', 'text');

    const result = project.batchDeleteItems(['q1', 'q3']);

    expect(result.affectedPaths).toContain('q1');
    expect(result.affectedPaths).toContain('q3');
    expect(result.action.helper).toBe('batchDeleteItems');

    // q1 and q3 should be gone
    expect(project.itemAt('q1')).toBeUndefined();
    expect(project.itemAt('q3')).toBeUndefined();

    // q2 should remain
    expect(project.itemAt('q2')).toBeDefined();
  });

  it('handles deletion of nested items in reverse order safely', () => {
    const project = createProject();
    project.addGroup('group', 'Group');
    project.addField('group.a', 'A', 'text');
    project.addField('group.b', 'B', 'text');
    project.addField('standalone', 'Standalone', 'text');

    const result = project.batchDeleteItems(['group.a', 'standalone']);

    expect(project.itemAt('group.a')).toBeUndefined();
    expect(project.itemAt('standalone')).toBeUndefined();
    expect(project.itemAt('group.b')).toBeDefined();
  });

  it('throws PATH_NOT_FOUND for a nonexistent path', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');

    expect(() => project.batchDeleteItems(['q1', 'nonexistent'])).toThrow(HelperError);
    try {
      project.batchDeleteItems(['q1', 'nonexistent']);
    } catch (e) {
      expect((e as HelperError).code).toBe('PATH_NOT_FOUND');
    }
  });

  it('works with empty array', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');

    const result = project.batchDeleteItems([]);
    expect(result.affectedPaths).toEqual([]);
    expect(project.itemAt('q1')).toBeDefined();
  });
});

describe('batchDuplicateItems', () => {
  it('duplicates multiple items', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');
    project.addField('q2', 'Q2', 'integer');

    const result = project.batchDuplicateItems(['q1', 'q2']);

    expect(result.action.helper).toBe('batchDuplicateItems');
    expect(result.affectedPaths.length).toBe(2);

    // Originals still exist
    expect(project.itemAt('q1')).toBeDefined();
    expect(project.itemAt('q2')).toBeDefined();

    // Copies exist (key_1 pattern)
    expect(project.itemAt('q1_1')).toBeDefined();
    expect(project.itemAt('q2_1')).toBeDefined();
  });

  it('throws PATH_NOT_FOUND for a nonexistent path', () => {
    const project = createProject();

    expect(() => project.batchDuplicateItems(['nonexistent'])).toThrow(HelperError);
  });

  it('works with empty array', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');

    const result = project.batchDuplicateItems([]);
    expect(result.affectedPaths).toEqual([]);
  });
});
