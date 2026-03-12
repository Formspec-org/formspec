import { describe, it, expect } from 'vitest';
import { createProject } from '../src/index.js';

describe('definition.setOptionSet', () => {
  it('creates a named option set with inline options', () => {
    const project = createProject();

    project.dispatch({
      type: 'definition.setOptionSet',
      payload: {
        name: 'colors',
        options: [
          { value: 'r', label: 'Red' },
          { value: 'g', label: 'Green' },
        ],
      },
    });

    expect(project.definition.optionSets?.colors).toEqual({
      options: [{ value: 'r', label: 'Red' }, { value: 'g', label: 'Green' }],
    });
  });

  it('replaces an existing option set', () => {
    const project = createProject();

    project.dispatch({
      type: 'definition.setOptionSet',
      payload: { name: 'sizes', options: [{ value: 's', label: 'Small' }] },
    });

    project.dispatch({
      type: 'definition.setOptionSet',
      payload: { name: 'sizes', options: [{ value: 'l', label: 'Large' }] },
    });

    expect(project.definition.optionSets?.sizes).toEqual({ options: [{ value: 'l', label: 'Large' }] });
  });

  it('initializes optionSets if missing', () => {
    const project = createProject();
    expect(project.definition.optionSets).toBeUndefined();

    project.dispatch({
      type: 'definition.setOptionSet',
      payload: { name: 'yesno', options: [{ value: 'y', label: 'Yes' }, { value: 'n', label: 'No' }] },
    });

    expect(project.definition.optionSets).toBeDefined();
  });
});

describe('definition.deleteOptionSet', () => {
  it('removes the option set and inlines into referencing fields', () => {
    const project = createProject();

    // Create an option set
    project.dispatch({
      type: 'definition.setOptionSet',
      payload: {
        name: 'colors',
        options: [{ value: 'r', label: 'Red' }, { value: 'b', label: 'Blue' }],
      },
    });

    // Create a field referencing it
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'fav_color' },
    });
    project.dispatch({
      type: 'definition.setFieldOptions',
      payload: { path: 'fav_color', options: 'colors' },
    });

    // Delete the option set
    project.dispatch({
      type: 'definition.deleteOptionSet',
      payload: { name: 'colors' },
    });

    // Option set should be gone
    expect(project.definition.optionSets?.colors).toBeUndefined();

    // Field should now have inline options and no optionSet reference
    const field = project.itemAt('fav_color')!;
    expect(field.optionSet).toBeUndefined();
    expect(field.options).toEqual([{ value: 'r', label: 'Red' }, { value: 'b', label: 'Blue' }]);
  });

  it('works when no fields reference the option set', () => {
    const project = createProject();

    project.dispatch({
      type: 'definition.setOptionSet',
      payload: { name: 'unused', options: [{ value: 'x', label: 'X' }] },
    });

    project.dispatch({
      type: 'definition.deleteOptionSet',
      payload: { name: 'unused' },
    });

    expect(project.definition.optionSets?.unused).toBeUndefined();
  });
});

describe('definition.promoteToOptionSet', () => {
  it('extracts inline options into a named set', () => {
    const project = createProject();

    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'status' },
    });
    project.dispatch({
      type: 'definition.setFieldOptions',
      payload: {
        path: 'status',
        options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
      },
    });

    project.dispatch({
      type: 'definition.promoteToOptionSet',
      payload: { path: 'status', name: 'statusOptions' },
    });

    // Field should now reference the named set, not inline options
    const field = project.itemAt('status')!;
    expect(field.optionSet).toBe('statusOptions');
    expect(field.options).toBeUndefined();

    // Named option set should exist
    expect(project.definition.optionSets?.statusOptions).toEqual({
      options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
    });
  });
});
