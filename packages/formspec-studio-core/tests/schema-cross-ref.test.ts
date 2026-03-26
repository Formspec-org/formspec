/**
 * Schema cross-reference tests — RED phase.
 *
 * Each test targets a specific inconsistency between the helpers
 * implementation and the canonical JSON schemas, as documented in
 * the schema cross-reference addendum.
 */
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/index.js';
import { HelperError } from '../src/helper-types.js';

// ── H1: placeholder routes to theme widgetConfig ──────────────────

describe('H1: placeholder routing', () => {
  it('addField stores placeholder in theme widgetConfig', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { placeholder: 'Enter name' });
    const block = (project.theme as any).items?.name;
    expect(block?.widgetConfig?.placeholder).toBe('Enter name');
  });

  it('updateItem placeholder routes to theme widgetConfig', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { placeholder: 'Enter name' });
    const block = (project.theme as any).items?.name;
    expect(block?.widgetConfig?.placeholder).toBe('Enter name');
  });
});

// ── H2: ariaLabel routes to theme accessibility ───────────────────

describe('H2: ariaLabel routing', () => {
  it('addField stores ariaLabel via theme accessibility', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { ariaLabel: 'Full legal name' });
    const block = (project.theme as any).items?.name;
    expect(block?.accessibility?.description).toBe('Full legal name');
  });

  it('updateItem ariaLabel routes to theme accessibility', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { ariaLabel: 'Full legal name' });
    const block = (project.theme as any).items?.name;
    expect(block?.accessibility?.description).toBe('Full legal name');
  });
});

// ── H3: email/phone constraints use $ self-reference ──────────────

describe('H3: constraint self-references', () => {
  it('email constraint uses $ not bare identifier', () => {
    const project = createProject();
    project.addField('contact_email', 'Email', 'email');
    const bind = project.bindFor('contact_email');
    expect(bind?.constraint).toContain('$');
    expect(bind?.constraint).not.toContain('contact_email');
  });

  it('phone constraint uses $ not bare identifier', () => {
    const project = createProject();
    project.addField('phone_num', 'Phone', 'phone');
    const bind = project.bindFor('phone_num');
    expect(bind?.constraint).toContain('$');
    expect(bind?.constraint).not.toContain('phone_num');
  });

  it('nested email field also uses $ self-reference', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    const bind = project.bindFor('contact.email');
    expect(bind?.constraint).toContain('$');
    expect(bind?.constraint).not.toContain('contact.email');
  });
});

// ── H4: applyStyle CSS in style sub-object ────────────────────────

describe('H4: applyStyle CSS nesting', () => {
  it('applyStyle stores CSS properties in theme items[key].style', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.applyStyle('name', { borderRadius: '8px', padding: '16px' });
    const block = (project.theme as any).items?.name;
    expect(block?.style?.borderRadius).toBe('8px');
    expect(block?.style?.padding).toBe('16px');
    // Should NOT be at block root level
    expect(block?.borderRadius).toBeUndefined();
  });

  it('applyStyle PresentationBlock keys stay at root level', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.applyStyle('name', { widget: 'card', labelPosition: 'top' });
    const block = (project.theme as any).items?.name;
    expect(block?.widget).toBe('card');
    expect(block?.labelPosition).toBe('top');
  });

  it('updateItem style stores CSS in theme items[key].style', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { style: { fontSize: '1.5rem' } });
    const block = (project.theme as any).items?.name;
    expect(block?.style?.fontSize).toBe('1.5rem');
    expect(block?.fontSize).toBeUndefined();
  });
});

// ── H5: applyStyleAll selector match/apply structure ──────────────

describe('H5: applyStyleAll selector structure', () => {
  it('applyStyleAll creates selector with match and apply', () => {
    const project = createProject();
    project.applyStyleAll({ type: 'field' }, { widget: 'card' });
    const selectors = project.theme.selectors ?? [];
    expect(selectors.length).toBeGreaterThan(0);
    const last = selectors[selectors.length - 1] as any;
    expect(last.match).toEqual({ type: 'field' });
    expect(last.apply).toBeDefined();
    expect(last.apply?.widget).toBe('card');
  });

  it('applyStyleAll CSS properties nest in apply.style', () => {
    const project = createProject();
    project.applyStyleAll({ type: 'field' }, { borderRadius: '4px' });
    const selectors = project.theme.selectors ?? [];
    const last = selectors[selectors.length - 1] as any;
    expect(last.match).toEqual({ type: 'field' });
    expect(last.apply?.style?.borderRadius).toBe('4px');
  });

  it('applyStyleAll mixed CSS + PresentationBlock keys', () => {
    const project = createProject();
    project.applyStyleAll({ type: 'field' }, { widget: 'card', borderRadius: '4px' });
    const selectors = project.theme.selectors ?? [];
    const last = selectors[selectors.length - 1] as any;
    expect(last.apply?.widget).toBe('card');
    expect(last.apply?.style?.borderRadius).toBe('4px');
  });
});

// ── M8: applyStyleAll form CSS in defaults.style ──────────────────

describe('M8: applyStyleAll form-target CSS nesting', () => {
  it('applyStyleAll form target stores CSS in defaults.style', () => {
    const project = createProject();
    project.applyStyleAll('form', { borderRadius: '4px', padding: '16px' });
    const defaults = (project.theme as any).defaults;
    expect(defaults?.style?.borderRadius).toBe('4px');
    expect(defaults?.style?.padding).toBe('16px');
    expect(defaults?.borderRadius).toBeUndefined();
  });

  it('applyStyleAll form PresentationBlock keys stay at root', () => {
    const project = createProject();
    project.applyStyleAll('form', { widget: 'card', labelPosition: 'top' });
    const defaults = (project.theme as any).defaults;
    expect(defaults?.widget).toBe('card');
    expect(defaults?.labelPosition).toBe('top');
  });
});

// ── H6: FEL boolean bind values ──────────────────────────────────
//
// The FEL grammar uses `true` / `false` as keyword literals (not functions).
// Helpers must produce valid FEL: `'true'` not `'true()'`.
// This set verifies the helpers produce the FEL-grammar-valid keyword literal.

describe('H6: FEL boolean bind values', () => {
  it('require() default expression is valid FEL boolean', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.require('name');
    expect(project.bindFor('name')?.required).toBe('true');
  });

  it('addField required:true sets bind to FEL true', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { required: true });
    expect(project.bindFor('name')?.required).toBe('true');
  });

  it('addField readonly:true sets bind to FEL true', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { readonly: true });
    expect(project.bindFor('name')?.readonly).toBe('true');
  });

  it('updateItem required:true sets bind to FEL true', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { required: true });
    expect(project.bindFor('name')?.required).toBe('true');
  });

  it('updateItem readonly:true sets bind to FEL true', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.updateItem('name', { readonly: true });
    expect(project.bindFor('name')?.readonly).toBe('true');
  });

  it('require() validates custom FEL expression', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('age', 'Age', 'integer');
    // Should succeed with a valid FEL condition
    project.require('name', 'age > 18');
    expect(project.bindFor('name')?.required).toBe('age > 18');
  });
});

// ── H7: branch boolean FEL literals ──────────────────────────────
//
// Boolean when-values must produce valid FEL: `active = true` / `active = false`
// (FEL keywords, not function calls).

describe('H7: branch boolean when values', () => {
  it('branch boolean when produces valid FEL with true keyword', () => {
    const project = createProject();
    project.addField('active', 'Active', 'boolean');
    project.addField('details', 'Details', 'text');
    project.branch('active', [
      { when: true, show: 'details' },
    ]);
    const bind = project.bindFor('details');
    // Should use FEL keyword, not function call
    expect(bind?.relevant).toBe('active = true');
  });

  it('branch boolean false produces valid FEL with false keyword', () => {
    const project = createProject();
    project.addField('disabled', 'Disabled', 'boolean');
    project.addField('info', 'Info', 'text');
    project.branch('disabled', [
      { when: false, show: 'info' },
    ]);
    const bind = project.bindFor('info');
    expect(bind?.relevant).toBe('disabled = false');
  });
});

// ── M1: renameVariable throws NOT_IMPLEMENTED ─────────────────────

describe('M1: renameVariable error handling', () => {
  it('renameVariable throws HelperError NOT_IMPLEMENTED', () => {
    const project = createProject();
    project.addVariable('x', '42');
    expect(() => project.renameVariable('x', 'y')).toThrow(HelperError);
    try {
      project.renameVariable('x', 'y');
    } catch (e) {
      expect((e as HelperError).code).toBe('NOT_IMPLEMENTED');
    }
  });
});

// ── M6: AMBIGUOUS_ITEM_KEY includes detail ────────────────────────

describe('M6: AMBIGUOUS_ITEM_KEY warning detail', () => {
  it('applyStyle AMBIGUOUS_ITEM_KEY warning includes detail', () => {
    const project = createProject();
    project.addGroup('contacts', 'Contacts');
    project.addField('contacts.name', 'Contact Name', 'text');
    project.addField('name', 'Name', 'text');
    const result = project.applyStyle('name', { widget: 'card' });
    const w = result.warnings?.find(w => w.code === 'AMBIGUOUS_ITEM_KEY');
    expect(w).toBeDefined();
    expect(w?.detail).toBeDefined();
    expect((w?.detail as any)?.leafKey).toBe('name');
    expect((w?.detail as any)?.conflictingPaths).toEqual(
      expect.arrayContaining(['name', 'contacts.name']),
    );
  });
});

// ── L7: addPage atomicity ───────────────────────────────────

describe('L7: addPage atomicity', () => {
  it('addPage undoes both tiers in one step', () => {
    const project = createProject();
    project.addPage('Step 1');
    // Should have created the group item + Page node + wizard mode
    expect(project.definition.items.length).toBeGreaterThan(0);
    expect(project.definition.formPresentation?.pageMode).toBe('wizard');
    const comp = project.effectiveComponent as any;
    const pageNodes = (comp.tree?.children ?? []).filter((n: any) => n.component === 'Page');
    expect(pageNodes.length).toBe(1);
    // Single undo reverses everything
    project.undo();
    expect(project.definition.items).toHaveLength(0);
    const compAfter = project.effectiveComponent as any;
    const pageNodesAfter = (compAfter.tree?.children ?? []).filter((n: any) => n.component === 'Page');
    expect(pageNodesAfter.length).toBe(0);
  });
});
