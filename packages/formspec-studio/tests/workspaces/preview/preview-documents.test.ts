import { describe, it, expect } from 'vitest';
import {
  normalizeComponentDoc,
} from '../../../src/workspaces/preview/preview-documents';

describe('normalizeComponentDoc', () => {
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

  it('normalizes a generated component doc (effectiveComponent) with Root→Stack rename', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:wizard-preview-doc',
      version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [],
    };
    // effectiveComponent from Project merges authored + generated
    const effectiveComponent = {
      $formspecComponent: '1.0',
      version: '1.0.0',
      'x-studio-generated': true,
      tree: {
        component: 'Root',
        children: [{ component: 'RadioGroup', bind: 'priority' }],
      },
      targetDefinition: {},
    };

    const normalized = normalizeComponentDoc(effectiveComponent, definition) as any;

    expect(normalized.tree).toBeDefined();
    expect(normalized.tree.component).toBe('Stack');
    expect(normalized.tree.children[0].component).toBe('RadioGroup');
    expect(normalized.$formspecComponent).toBe('1.0');
    expect(normalized['x-studio-generated']).toBe(true);
    expect(normalized.targetDefinition.url).toBe('urn:wizard-preview-doc');
  });
});
