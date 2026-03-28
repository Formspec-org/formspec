import { describe, it, expect } from 'vitest';
import {
  normalizeComponentDoc,
  normalizeThemeDoc,
} from '@formspec-org/studio-core';

describe('normalizeComponentDoc', () => {
  it('stamps a valid component envelope when preview receives a bare tree doc', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:bare-preview-doc',
      version: '1.0.0',
      items: [],
    };
    const component = {
      tree: {
        component: 'Root',
        children: [{ component: 'TextInput', bind: 'name' }],
      },
      targetDefinition: {},
    };

    const normalized = normalizeComponentDoc(component, definition) as any;

    expect(normalized.$formspecComponent).toBe('1.0');
    expect(normalized.version).toBe('0.1.0');
    expect(normalized.tree.component).toBe('Stack');
    expect(normalized.targetDefinition.url).toBe('urn:bare-preview-doc');
  });

  it('preserves authored component trees without stamping generated metadata', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:authored-preview-doc',
      version: '1.0.0',
      items: [],
    };
    const component = {
      $formspecComponent: '1.0',
      version: '2.0.0',
      tree: {
        component: 'Root',
        children: [{ component: 'RadioGroup', bind: 'priority' }],
      },
      targetDefinition: {},
    };

    const normalized = normalizeComponentDoc(component, definition) as any;

    expect(normalized.tree).toBeDefined();
    expect(normalized.tree.component).toBe('Stack');
    expect(normalized.tree.children[0].component).toBe('RadioGroup');
    expect(normalized.$formspecComponent).toBe('1.0');
    expect(normalized.version).toBe('2.0.0');
    expect(normalized['x-studio-generated']).toBeUndefined();
    expect(normalized.targetDefinition.url).toBe('urn:authored-preview-doc');
  });

  it('normalizes a component doc with Root→Stack rename', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:wizard-preview-doc',
      version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [],
    };
    const componentDoc = {
      $formspecComponent: '1.0',
      version: '1.0.0',
      'x-studio-generated': true,
      tree: {
        component: 'Root',
        children: [{ component: 'RadioGroup', bind: 'priority' }],
      },
      targetDefinition: {},
    };

    const normalized = normalizeComponentDoc(componentDoc, definition) as any;

    expect(normalized.tree).toBeDefined();
    expect(normalized.tree.component).toBe('Stack');
    expect(normalized.tree.children[0].component).toBe('RadioGroup');
    expect(normalized.$formspecComponent).toBe('1.0');
    expect(normalized['x-studio-generated']).toBe(true);
    expect(normalized.targetDefinition.url).toBe('urn:wizard-preview-doc');
  });

  it('synthesizes preview Page nodes for paged definitions without authored page layout', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:wizard-preview-doc',
      version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        {
          key: 'applicant',
          type: 'group',
          label: 'Applicant',
          children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Full Name' }],
        },
        {
          key: 'household',
          type: 'group',
          label: 'Household',
          children: [{ key: 'size', type: 'field', dataType: 'integer', label: 'Household Size' }],
        },
      ],
    };
    const componentDoc = {
      tree: {
        component: 'Stack',
        nodeId: 'root',
        children: [
          {
            component: 'Stack',
            bind: 'applicant',
            children: [{ component: 'TextInput', bind: 'name' }],
          },
          {
            component: 'Stack',
            bind: 'household',
            children: [{ component: 'NumberInput', bind: 'size' }],
          },
        ],
      },
      targetDefinition: {},
    };

    const normalized = normalizeComponentDoc(componentDoc, definition) as any;

    expect(normalized.tree.component).toBe('Stack');
    expect(normalized.tree.children).toHaveLength(2);
    expect(normalized.tree.children[0].component).toBe('Page');
    expect(normalized.tree.children[0].title).toBe('Applicant');
    expect(normalized.tree.children[0].children[0].bind).toBe('applicant');
    expect(normalized.tree.children[1].component).toBe('Page');
    expect(normalized.tree.children[1].title).toBe('Household');
    expect(normalized.tree.children[1].children[0].bind).toBe('household');
  });
});

describe('normalizeThemeDoc', () => {
  it('does not preserve legacy theme.pages in preview normalization', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:preview-theme-doc',
      version: '1.0.0',
      items: [],
    };
    const theme = {
      targetDefinition: {},
      pages: [{ id: 'legacy', title: 'Legacy Page' }],
    };

    const normalized = normalizeThemeDoc(theme, definition) as any;

    expect(normalized.targetDefinition.url).toBe('urn:preview-theme-doc');
    expect('pages' in normalized).toBe(false);
  });
});
