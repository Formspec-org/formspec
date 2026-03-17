import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';
import { HelperError } from '../src/helper-types.js';

describe('path resolution — parentPath + dot-path interaction', () => {
  // When parentPath is given, path is treated as RELATIVE — split on dots,
  // last segment = key, preceding segments prepended to parentPath.
  // When parentPath is NOT given, path is split on dots (existing behavior).

  it('addField: relative dot-path with parentPath resolves correctly', () => {
    const project = createProject();
    project.addGroup('service_details', 'Service Details');
    project.addGroup('consulting', 'Consulting', { parentPath: 'service_details' });
    // path="consulting.rate" + parentPath="service_details"
    // key="rate", effectiveParent="service_details.consulting"
    project.addField('consulting.rate', 'Rate', 'decimal', { parentPath: 'service_details' });
    expect(project.fieldPaths()).toContain('service_details.consulting.rate');
    expect(project.itemAt('service_details.consulting.rate')).toBeDefined();
  });

  it('addGroup: relative dot-path with parentPath resolves correctly', () => {
    const project = createProject();
    project.addGroup('outer', 'Outer');
    project.addGroup('middle', 'Middle', { parentPath: 'outer' });
    // path="middle.inner" + parentPath="outer"
    // key="inner", effectiveParent="outer.middle"
    project.addGroup('middle.inner', 'Inner', { parentPath: 'outer' });
    expect(project.itemAt('outer.middle.inner')).toBeDefined();
    expect(project.itemAt('outer.middle.inner')?.type).toBe('group');
  });

  it('addGroup: dot-path WITHOUT parentPath still splits on dots', () => {
    const project = createProject();
    project.addGroup('service_details', 'Service Details');
    project.addGroup('service_details.consulting', 'Consulting');
    expect(project.itemAt('service_details.consulting')).toBeDefined();
    expect(project.itemAt('service_details')?.children).toHaveLength(1);
  });

  it('addContent: relative dot-path with parentPath resolves correctly', () => {
    const project = createProject();
    project.addGroup('section', 'Section');
    project.addGroup('sub', 'Sub', { parentPath: 'section' });
    // path="sub.note" + parentPath="section"
    // key="note", effectiveParent="section.sub"
    project.addContent('sub.note', 'A note', 'paragraph', { parentPath: 'section' });
    expect(project.itemAt('section.sub')?.children).toHaveLength(1);
    expect(project.itemAt('section.sub')?.children?.[0].key).toBe('note');
  });

  it('addField: simple key with parentPath still works', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('email', 'Email', 'email', { parentPath: 'contact' });
    expect(project.fieldPaths()).toContain('contact.email');
  });

  it('addContent: simple key with parentPath still works', () => {
    const project = createProject();
    project.addGroup('section', 'Section');
    project.addContent('title', 'Section Title', 'heading', { parentPath: 'section' });
    expect(project.itemAt('section')?.children?.[0].key).toBe('title');
  });

  it('addField: no dots and no parentPath stays at root', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    expect(project.fieldPaths()).toContain('name');
    expect(project.itemAt('name')?.type).toBe('field');
  });

  it('addGroup: deeply nested dot-path without parentPath', () => {
    const project = createProject();
    project.addGroup('a', 'A');
    project.addGroup('a.b', 'B');
    project.addGroup('a.b.c', 'C');
    expect(project.itemAt('a.b.c')).toBeDefined();
    expect(project.itemAt('a.b.c')?.type).toBe('group');
  });
});

describe('addGroup page prop', () => {
  it('places group on specified page via parentPath resolution', () => {
    const project = createProject();
    project.addPage('Details', undefined, 'page_1');
    // addPage with id='page_1' creates a root group with key 'page_1'
    // addGroup with page='page_1' should nest under that page group
    project.addGroup('details', 'Service Details', { page: 'page_1' });
    // The group should exist as a child of the page's root group
    const pageGroup = project.itemAt('page_1');
    expect(pageGroup).toBeDefined();
    const child = pageGroup?.children?.find((c: any) => c.key === 'details');
    expect(child).toBeDefined();
    expect(child?.type).toBe('group');
  });

  it('throws PAGE_NOT_FOUND for nonexistent page', () => {
    const project = createProject();
    expect(() =>
      project.addGroup('details', 'Details', { page: 'nonexistent' } as any),
    ).toThrow(HelperError);
    try {
      project.addGroup('details', 'Details', { page: 'nonexistent' } as any);
    } catch (e) {
      expect((e as HelperError).code).toBe('PAGE_NOT_FOUND');
    }
  });

  it('page prop with dot-path uses parentPath for nesting under page group', () => {
    const project = createProject();
    project.addPage('Details', undefined, 'page_1');
    // Create a group under the page, then nest via explicit parentPath
    project.addGroup('parent', 'Parent', { page: 'page_1' });
    // To nest under page_1.parent, use parentPath explicitly
    project.addGroup('child', 'Child', { parentPath: 'page_1.parent' });
    expect(project.itemAt('page_1.parent.child')).toBeDefined();
    expect(project.itemAt('page_1.parent.child')?.type).toBe('group');
  });
});
