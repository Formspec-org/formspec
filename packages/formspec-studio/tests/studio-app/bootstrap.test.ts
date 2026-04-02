import { describe, it, expect } from 'vitest';
import { createStudioProject } from '../../src/studio-app/StudioApp';
import { exampleDefinition } from '../../src/fixtures/example-definition';

describe('createStudioProject bootstrap', () => {
  it('does not synthesize component pages from definition groups', () => {
    const project = createStudioProject();
    const pages = project.listPages();

    expect(pages).toBeDefined();
    expect(Array.isArray(pages)).toBe(true);
    expect(pages).toHaveLength(0);
  });

  it('sets pageMode to wizard when groups exist', () => {
    const project = createStudioProject();
    const fp = project.definition.formPresentation;

    expect(fp?.pageMode).toBe('wizard');
  });

  it('does NOT overwrite pages when seed provides them in component tree', () => {
    const project = createStudioProject({
      seed: {
        definition: exampleDefinition as any,
        component: {
          tree: {
            component: 'Stack', nodeId: 'root', children: [
              { component: 'Page', nodeId: 'custom-1', title: 'My Custom Page', _layout: true, children: [] },
            ],
          },
        } as any,
      },
    });

    const pages = project.listPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('My Custom Page');
  });

  it('does not auto-generate pages for a minimal definition with groups', () => {
    const minimalDef = {
      $formspec: '1.0',
      name: 'test',
      title: 'Test Form',
      status: 'draft',
      items: [
        {
          key: 'info',
          type: 'group',
          label: 'Basic Info',
          presentation: { layout: { page: 'Info' } },
          children: [
            { key: 'name', type: 'field', label: 'Name', dataType: 'string' },
          ],
        },
        {
          key: 'review',
          type: 'group',
          label: 'Review',
          presentation: { layout: { page: 'Review' } },
          children: [
            { key: 'done', type: 'field', label: 'Done', dataType: 'boolean' },
          ],
        },
      ],
    };

    const project = createStudioProject({
      seed: { definition: minimalDef as any },
    });

    const pages = project.listPages();
    expect(pages).toHaveLength(0);
  });

  it('does NOT auto-generate pages when definition has no groups', () => {
    const noGroupsDef = {
      $formspec: '1.0',
      name: 'flat',
      title: 'Flat Form',
      status: 'draft',
      items: [
        { key: 'name', type: 'field', label: 'Name', dataType: 'string' },
      ],
    };

    const project = createStudioProject({
      seed: { definition: noGroupsDef as any },
    });

    const pages = project.listPages();
    // Should either be empty or not have auto-generated content
    // (no groups means nothing to generate from)
    expect(pages.length === 0).toBe(true);
  });
});
