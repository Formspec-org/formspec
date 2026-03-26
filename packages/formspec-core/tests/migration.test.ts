import { describe, it, expect } from 'vitest';
import { migrateWizardRoot } from '../src/handlers/migration.js';
import { createRawProject } from '../src/index.js';

describe('migrateWizardRoot', () => {
  it('rewrites Wizard root to Stack, preserving Page children', () => {
    const tree = {
      component: 'Wizard', nodeId: 'root', showProgress: true, allowSkip: false,
      children: [
        { component: 'Page', nodeId: 'p1', title: 'Step 1', children: [] },
        { component: 'Page', nodeId: 'p2', title: 'Step 2', children: [] },
      ],
    };
    const result = migrateWizardRoot(tree);
    expect(result).not.toBeNull();
    expect(result!.tree.component).toBe('Stack');
    expect(result!.tree.nodeId).toBe('root');
    expect(result!.tree.children).toHaveLength(2);
    expect(result!.tree.children[0].component).toBe('Page');
    expect(result!.migratedProps).toEqual({ showProgress: true, allowSkip: false, pageMode: 'wizard' });
    expect(result!.migratedMode).toBe('wizard');
    // Wizard-specific props should NOT be on the new Stack
    expect(result!.tree.showProgress).toBeUndefined();
    expect(result!.tree.allowSkip).toBeUndefined();
  });

  it('rewrites Tabs root to Stack, renames position to tabPosition', () => {
    const tree = {
      component: 'Tabs', nodeId: 'root', position: 'left', defaultTab: 1,
      children: [
        { component: 'Page', nodeId: 'p1', title: 'Tab 1', children: [] },
      ],
    };
    const result = migrateWizardRoot(tree);
    expect(result).not.toBeNull();
    expect(result!.tree.component).toBe('Stack');
    expect(result!.migratedProps).toEqual({ tabPosition: 'left', defaultTab: 1, pageMode: 'tabs' });
    expect(result!.migratedMode).toBe('tabs');
    // Tabs-specific props should NOT be on the new Stack
    expect(result!.tree.position).toBeUndefined();
    expect(result!.tree.defaultTab).toBeUndefined();
  });

  it('returns null for Stack root (no migration needed)', () => {
    const tree = { component: 'Stack', nodeId: 'root', children: [] };
    expect(migrateWizardRoot(tree)).toBeNull();
  });

  it('returns null for null/undefined tree', () => {
    expect(migrateWizardRoot(null)).toBeNull();
    expect(migrateWizardRoot(undefined)).toBeNull();
  });

  it('handles Wizard with no props to migrate — still sets pageMode', () => {
    const tree = { component: 'Wizard', nodeId: 'root', children: [] };
    const result = migrateWizardRoot(tree);
    expect(result!.migratedProps).toEqual({ pageMode: 'wizard' });
    expect(result!.migratedMode).toBe('wizard');
  });

  it('preserves nodeId from original root', () => {
    const tree = { component: 'Wizard', nodeId: 'custom-root', children: [] };
    const result = migrateWizardRoot(tree);
    expect(result!.tree.nodeId).toBe('custom-root');
  });

  it('handles Tabs root with no props to migrate — still sets pageMode', () => {
    const tree = { component: 'Tabs', nodeId: 'root', children: [] };
    const result = migrateWizardRoot(tree);
    expect(result!.migratedProps).toEqual({ pageMode: 'tabs' });
    expect(result!.migratedMode).toBe('tabs');
    expect(result!.tree.component).toBe('Stack');
  });

  it('does not strip unrelated props from Wizard root', () => {
    const tree = {
      component: 'Wizard', nodeId: 'root', showProgress: true, someOtherProp: 'kept', children: [],
    };
    const result = migrateWizardRoot(tree);
    expect((result!.tree as any).someOtherProp).toBe('kept');
  });
});

describe('RawProject — Wizard/Tabs root migration on load', () => {
  it('migrates Wizard component root to Stack and sets formPresentation props', () => {
    const project = createRawProject({
      seed: {
        component: {
          $formspecComponent: '1.0',
          version: '0.1.0',
          targetDefinition: { url: 'urn:formspec:test' },
          tree: {
            component: 'Wizard', nodeId: 'root', showProgress: true, allowSkip: false,
            children: [
              { component: 'Page', nodeId: 'p1', title: 'Step 1', children: [] },
            ],
          },
        } as any,
      },
    });

    expect(project.component.tree).toBeDefined();
    expect((project.component.tree as any).component).toBe('Stack');
    expect((project.component.tree as any).showProgress).toBeUndefined();
    expect((project.definition as any).formPresentation?.showProgress).toBe(true);
    expect((project.definition as any).formPresentation?.allowSkip).toBe(false);
    expect((project.definition as any).formPresentation?.pageMode).toBe('wizard');
  });

  it('migrates Tabs component root to Stack and sets tabPosition/defaultTab', () => {
    const project = createRawProject({
      seed: {
        component: {
          $formspecComponent: '1.0',
          version: '0.1.0',
          targetDefinition: { url: 'urn:formspec:test' },
          tree: {
            component: 'Tabs', nodeId: 'root', position: 'top', defaultTab: 2,
            children: [
              { component: 'Page', nodeId: 'p1', title: 'Tab 1', children: [] },
            ],
          },
        } as any,
      },
    });

    expect((project.component.tree as any).component).toBe('Stack');
    expect((project.definition as any).formPresentation?.tabPosition).toBe('top');
    expect((project.definition as any).formPresentation?.defaultTab).toBe(2);
    expect((project.definition as any).formPresentation?.pageMode).toBe('tabs');
  });

  it('leaves Stack-rooted component trees unchanged', () => {
    const project = createRawProject({
      seed: {
        component: {
          $formspecComponent: '1.0',
          version: '0.1.0',
          targetDefinition: { url: 'urn:formspec:test' },
          tree: {
            component: 'Stack', nodeId: 'root', children: [],
          },
        } as any,
      },
    });

    expect((project.component.tree as any).component).toBe('Stack');
    expect((project.definition as any).formPresentation).toBeUndefined();
  });

  it('preserves Page children after Wizard migration', () => {
    const project = createRawProject({
      seed: {
        component: {
          $formspecComponent: '1.0',
          version: '0.1.0',
          targetDefinition: { url: 'urn:formspec:test' },
          tree: {
            component: 'Wizard', nodeId: 'root', children: [
              { component: 'Page', nodeId: 'p1', title: 'A', children: [] },
              { component: 'Page', nodeId: 'p2', title: 'B', children: [] },
            ],
          },
        } as any,
      },
    });

    const children = (project.component.tree as any).children;
    expect(children).toHaveLength(2);
    expect(children[0].component).toBe('Page');
    expect(children[1].component).toBe('Page');
  });
});
