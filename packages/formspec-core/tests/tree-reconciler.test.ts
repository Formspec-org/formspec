import { describe, it, expect } from 'vitest';
import { reconcileComponentTree, defaultComponentType } from '../src/tree-reconciler.js';

describe('defaultComponentType', () => {
  it('maps string field to TextInput', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'string' } as any)).toBe('TextInput');
  });

  it('maps boolean field to Toggle', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'boolean' } as any)).toBe('Toggle');
  });

  it('maps integer field to NumberInput', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'integer' } as any)).toBe('NumberInput');
  });

  it('maps decimal field to NumberInput', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'decimal' } as any)).toBe('NumberInput');
  });

  it('maps date field to DatePicker', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'date' } as any)).toBe('DatePicker');
  });

  it('maps dateTime field to DatePicker', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'dateTime' } as any)).toBe('DatePicker');
  });

  it('maps time field to DatePicker', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'time' } as any)).toBe('DatePicker');
  });

  it('maps money field to MoneyInput', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'money' } as any)).toBe('MoneyInput');
  });

  it('maps attachment field to FileUpload', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'attachment' } as any)).toBe('FileUpload');
  });

  it('maps choice field to Select', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'choice' } as any)).toBe('Select');
  });

  it('maps multiChoice field to CheckboxGroup', () => {
    expect(defaultComponentType({ type: 'field', dataType: 'multiChoice' } as any)).toBe('CheckboxGroup');
  });

  it('maps group to Stack', () => {
    expect(defaultComponentType({ type: 'group' } as any)).toBe('Stack');
  });

  it('maps repeatable group to Accordion', () => {
    expect(defaultComponentType({ type: 'group', repeatable: true } as any)).toBe('Accordion');
  });

  it('maps display to Text', () => {
    expect(defaultComponentType({ type: 'display' } as any)).toBe('Text');
  });

  it('selects Select for fields with optionSet', () => {
    expect(defaultComponentType({ type: 'field', optionSet: 'countries' } as any)).toBe('Select');
  });

  it('selects Select for fields with inline options', () => {
    expect(defaultComponentType({ type: 'field', options: [{ value: 'a' }] } as any)).toBe('Select');
  });

  it('defaults unknown type to TextInput', () => {
    expect(defaultComponentType({ type: 'unknown' } as any)).toBe('TextInput');
  });
});

describe('reconcileComponentTree', () => {
  it('builds a flat Stack from simple definition', () => {
    const definition = {
      items: [
        { key: 'name', type: 'field', dataType: 'string' },
        { key: 'age', type: 'field', dataType: 'integer' },
      ],
    } as any;

    const tree = reconcileComponentTree(definition, undefined, {});
    expect(tree.component).toBe('Stack');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].bind).toBe('name');
    expect(tree.children[0].component).toBe('TextInput');
    expect(tree.children[1].bind).toBe('age');
    expect(tree.children[1].component).toBe('NumberInput');
  });

  it('reuses existing bound node properties', () => {
    const definition = {
      items: [{ key: 'email', type: 'field', dataType: 'string' }],
    } as any;
    const existing = {
      component: 'Stack',
      nodeId: 'root',
      children: [{ component: 'EmailInput', bind: 'email', placeholder: 'Enter email' }],
    };

    const tree = reconcileComponentTree(definition, existing, {});
    expect(tree.children[0].component).toBe('EmailInput');
    expect(tree.children[0].placeholder).toBe('Enter email');
  });

  it('removes nodes for deleted items', () => {
    const definition = { items: [] } as any;
    const existing = {
      component: 'Stack',
      nodeId: 'root',
      children: [{ component: 'TextInput', bind: 'deleted' }],
    };

    const tree = reconcileComponentTree(definition, existing, {});
    expect(tree.children).toHaveLength(0);
  });

  it('builds display nodes with Text component', () => {
    const definition = {
      items: [{ key: 'heading', type: 'display', label: 'Hello World' }],
    } as any;

    const tree = reconcileComponentTree(definition, undefined, {});
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].component).toBe('Text');
    expect(tree.children[0].nodeId).toBe('heading');
    expect(tree.children[0].text).toBe('Hello World');
  });

  it('builds group nodes with children', () => {
    const definition = {
      items: [{
        key: 'address', type: 'group', children: [
          { key: 'street', type: 'field', dataType: 'string' },
          { key: 'city', type: 'field', dataType: 'string' },
        ],
      }],
    } as any;

    const tree = reconcileComponentTree(definition, undefined, {});
    expect(tree.children).toHaveLength(1);
    const group = tree.children[0];
    expect(group.component).toBe('Stack');
    expect(group.bind).toBe('address');
    expect(group.children).toHaveLength(2);
    expect(group.children[0].bind).toBe('street');
    expect(group.children[1].bind).toBe('city');
  });

  it('builds empty children array for group with no children', () => {
    const definition = {
      items: [{ key: 'section', type: 'group' }],
    } as any;

    const tree = reconcileComponentTree(definition, undefined, {});
    expect(tree.children[0].children).toEqual([]);
  });

  it('generates Wizard root when pageMode is wizard with theme pages', () => {
    const definition = {
      items: [
        { key: 'name', type: 'field', dataType: 'string' },
        { key: 'age', type: 'field', dataType: 'integer' },
      ],
      formPresentation: { pageMode: 'wizard' },
    } as any;
    const theme = {
      pages: [
        { id: 'p1', title: 'Page 1', regions: [{ key: 'name' }] },
        { id: 'p2', title: 'Page 2', regions: [{ key: 'age' }] },
      ],
    };

    const tree = reconcileComponentTree(definition, undefined, theme);
    expect(tree.component).toBe('Wizard');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].component).toBe('Page');
    expect(tree.children[0].title).toBe('Page 1');
    expect(tree.children[0].children[0].bind).toBe('name');
    expect(tree.children[1].children[0].bind).toBe('age');
  });

  it('generates Tabs root when pageMode is tabs with theme pages', () => {
    const definition = {
      items: [{ key: 'name', type: 'field', dataType: 'string' }],
      formPresentation: { pageMode: 'tabs' },
    } as any;
    const theme = {
      pages: [{ id: 'p1', title: 'Tab 1', regions: [{ key: 'name' }] }],
    };

    const tree = reconcileComponentTree(definition, undefined, theme);
    expect(tree.component).toBe('Tabs');
  });

  it('places unassigned items in auto-generated "Other" page for wizard mode', () => {
    const definition = {
      items: [
        { key: 'name', type: 'field', dataType: 'string' },
        { key: 'extra', type: 'field', dataType: 'string' },
      ],
      formPresentation: { pageMode: 'wizard' },
    } as any;
    const theme = {
      pages: [{ id: 'p1', title: 'Page 1', regions: [{ key: 'name' }] }],
    };

    const tree = reconcileComponentTree(definition, undefined, theme);
    expect(tree.children).toHaveLength(2);
    expect(tree.children[1].nodeId).toBe('_unassigned');
    expect(tree.children[1].title).toBe('Other');
    expect(tree.children[1].children[0].bind).toBe('extra');
  });
});
