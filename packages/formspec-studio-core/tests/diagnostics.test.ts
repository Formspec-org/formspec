import { describe, it, expect } from 'vitest';
import { createProject } from '../src/index.js';

describe('diagnose', () => {
  it('returns clean diagnostics for valid empty project', () => {
    const project = createProject();
    const diag = project.diagnose();

    expect(diag.structural).toEqual([]);
    expect(diag.expressions).toEqual([]);
    expect(diag.extensions).toEqual([]);
    expect(diag.consistency).toEqual([]);
    expect(diag.counts).toEqual({ error: 0, warning: 0, info: 0 });
  });

  it('reports structural schema diagnostics for invalid definitions', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test',
          version: '1.0.0',
          status: 'draft',
          title: 'Broken',
          items: [{ type: 'field', label: 'Missing key' }],
        } as any,
      },
    });

    const diag = project.diagnose();
    expect(diag.structural.length).toBeGreaterThan(0);
    expect(diag.structural.every((entry) => entry.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
  });

  it('detects unresolved extension references', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });
    project.dispatch({ type: 'definition.setItemExtension', payload: { path: 'email', extension: 'x-custom', value: true } });

    const diag = project.diagnose();
    expect(diag.extensions.length).toBe(1);
    expect(diag.extensions[0].code).toBe('UNRESOLVED_EXTENSION');
    expect(diag.extensions[0].severity).toBe('error');
    expect(diag.counts.error).toBe(1);
  });

  it('passes when extension is in loaded registry', () => {
    const project = createProject();
    project.dispatch({
      type: 'project.loadRegistry',
      payload: {
        registry: {
          url: 'urn:test',
          entries: [{ name: 'x-custom', category: 'constraint', status: 'stable' }],
        },
      },
    });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });
    project.dispatch({ type: 'definition.setItemExtension', payload: { path: 'email', extension: 'x-custom', value: true } });

    const diag = project.diagnose();
    expect(diag.extensions).toEqual([]);
  });

  it('reports deprecated and retired extension usage from shared validation helper', () => {
    const project = createProject();
    project.dispatch({
      type: 'project.loadRegistry',
      payload: {
        registry: {
          url: 'urn:test',
          entries: [
            { name: 'x-deprecated', category: 'constraint', status: 'deprecated' },
            { name: 'x-retired', category: 'constraint', status: 'retired' },
          ],
        },
      },
    });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'email' } });
    project.dispatch({ type: 'definition.setItemExtension', payload: { path: 'email', extension: 'x-deprecated', value: true } });
    project.dispatch({ type: 'definition.setItemExtension', payload: { path: 'email', extension: 'x-retired', value: true } });

    const diag = project.diagnose();
    expect(diag.extensions.some((entry) => entry.code === 'EXTENSION_DEPRECATED')).toBe(true);
    expect(diag.extensions.some((entry) => entry.code === 'EXTENSION_RETIRED')).toBe(true);
  });

  it('detects component tree referencing nonexistent items', () => {
    const project = createProject();
    // Manually add a component node bound to a field that doesn't exist
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'TextInput', bind: 'nonexistent' },
    });

    const diag = project.diagnose();
    const orphan = diag.consistency.find(d => d.code === 'ORPHAN_COMPONENT_BIND');
    expect(orphan).toBeDefined();
    expect(orphan!.severity).toBe('warning');
  });

  it('detects component node bound to a display item', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'display', key: 'notice', label: 'Read carefully' } });
    // Manually add a Text node bound to the display item key
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Text', bind: 'notice' },
    });

    const diag = project.diagnose();
    const displayBind = diag.consistency.find(d => d.code === 'DISPLAY_ITEM_BIND');
    expect(displayBind).toBeDefined();
    expect(displayBind!.severity).toBe('warning');
    expect(displayBind!.path).toBe('notice');
  });

  it('detects stale mapping rule source paths', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'name' } });
    project.dispatch({ type: 'mapping.addRule', payload: { sourcePath: 'deleted_field', targetPath: 'output.name' } });

    const diag = project.diagnose();
    const stale = diag.consistency.find(d => d.code === 'STALE_MAPPING_SOURCE');
    expect(stale).toBeDefined();
    expect(stale!.severity).toBe('warning');
  });

  it('detects unmatched theme selectors', () => {
    const project = createProject();
    project.batch([
      { type: 'definition.addItem', payload: { type: 'field', key: 'name', dataType: 'string' } },
      { type: 'theme.addSelector', payload: { match: { dataType: 'integer' }, apply: { widget: 'NumberInput' } } },
    ]);

    const diag = project.diagnose();
    expect(diag.consistency.some((entry) => entry.code === 'UNMATCHED_THEME_SELECTOR')).toBe(true);
  });

  it('aggregates counts correctly', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f1' } });
    project.dispatch({ type: 'definition.setItemExtension', payload: { path: 'f1', extension: 'x-bad1', value: true } });
    project.dispatch({ type: 'definition.setItemExtension', payload: { path: 'f1', extension: 'x-bad2', value: true } });
    project.dispatch({ type: 'mapping.addRule', payload: { sourcePath: 'stale', targetPath: 'out' } });

    const diag = project.diagnose();
    expect(diag.counts.error).toBe(2);    // 2 unresolved extensions
    expect(diag.counts.warning).toBe(1);  // 1 stale mapping
  });

  it('warns about root-level non-group items in paged definitions', () => {
    const project = createProject();
    // Add root-level items BEFORE enabling pageMode (the real scenario:
    // user has a flat form, then enables wizard mode)
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'page1', label: 'Page 1' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'rootField' } });
    project.dispatch({ type: 'definition.setFormPresentation', payload: { property: 'pageMode', value: 'wizard' } });

    const diag = project.diagnose();
    const pagedWarning = diag.consistency.find(d => d.code === 'PAGED_ROOT_NON_GROUP');
    expect(pagedWarning).toBeDefined();
    expect(pagedWarning!.severity).toBe('warning');
    expect(pagedWarning!.path).toContain('rootField');
  });

  it('no paged warning when pageMode is not set', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'rootField' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'g1' } });

    const diag = project.diagnose();
    expect(diag.consistency.filter(d => d.code === 'PAGED_ROOT_NON_GROUP')).toEqual([]);
  });

  it('no paged warning when all root items are groups', () => {
    const project = createProject();
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'page1' } });
    project.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'page2' } });
    project.dispatch({ type: 'definition.setFormPresentation', payload: { property: 'pageMode', value: 'tabs' } });

    const diag = project.diagnose();
    expect(diag.consistency.filter(d => d.code === 'PAGED_ROOT_NON_GROUP')).toEqual([]);
  });
});
