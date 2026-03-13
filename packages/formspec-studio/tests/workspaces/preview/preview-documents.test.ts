import { describe, it, expect } from 'vitest';
import { normalizeComponentDoc } from '../../../src/workspaces/preview/preview-documents';

describe('normalizeComponentDoc', () => {
  it('preserves generated wizard trees and upgrades them for preview rendering', () => {
    const definition = {
      $formspec: '1.0',
      url: 'urn:wizard-preview-doc',
      version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [],
    };
    const component = {
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
    expect(normalized.version).toBe('1.0.0');
    expect(normalized['x-studio-generated']).toBe(true);
    expect(normalized.targetDefinition.url).toBe('urn:wizard-preview-doc');
  });
});
