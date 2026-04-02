import { describe, it, expect } from 'vitest';
import { createRawProject } from '../src/index.js';

describe('component tree sync', () => {
  it('auto-creates a default node for a new field', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'name', dataType: 'string' },
    });

    const node = project.componentFor('name');
    expect(node).toBeDefined();
    expect(node!.bind).toBe('name');
    expect(node!.component).toBe('TextInput');
  });

  it('preserves authored component trees when definition structure changes', () => {
    const project = createRawProject({
      seed: {
        component: {
          $formspecComponent: '1.0',
          version: '1.0.0',
          targetDefinition: { url: 'urn:test' },
          tree: { component: 'Stack', children: [] },
        } as any,
      },
    });

    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'name', dataType: 'string' },
    });

    expect((project.component as any).$formspecComponent).toBe('1.0');
    expect((project.component as any).version).toBe('1.0.0');
    expect((project.component.tree as any).component).toBe('Stack');
  });

  it('removes component node when item is deleted', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'age' },
    });
    expect(project.componentFor('age')).toBeDefined();

    project.dispatch({
      type: 'definition.deleteItem',
      payload: { path: 'age' },
    });
    expect(project.componentFor('age')).toBeUndefined();
  });

  it('preserves existing bound node properties through rebuild', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'email' },
    });
    // Customize the component node
    project.dispatch({
      type: 'component.setFieldWidget',
      payload: { fieldKey: 'email', widget: 'EmailInput' },
    });

    // Add another item — triggers rebuild
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'phone' },
    });

    // email's custom widget should survive the rebuild
    const emailNode = project.componentFor('email');
    expect(emailNode!.component).toBe('EmailInput');
    // phone should get a default node
    expect(project.componentFor('phone')).toBeDefined();
  });

  it('creates nested structure for groups with children', () => {
    const project = createRawProject();
    project.batch([
      { type: 'definition.addItem', payload: { type: 'group', key: 'contact' } },
      { type: 'definition.addItem', payload: { type: 'field', key: 'name', parentPath: 'contact' } },
      { type: 'definition.addItem', payload: { type: 'field', key: 'email', parentPath: 'contact' } },
    ]);

    const tree = project.component.tree as any;
    const groupNode = tree.children.find((c: any) => c.bind === 'contact');
    expect(groupNode).toBeDefined();
    expect(groupNode.component).toBe('Stack');
    expect(groupNode.children).toHaveLength(2);
    expect(groupNode.children[0].bind).toBe('name');
    expect(groupNode.children[1].bind).toBe('email');
  });

  it('preserves unbound layout nodes after rebuild', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'f1' },
    });
    // Manually add an unbound layout node
    project.dispatch({
      type: 'component.addNode',
      payload: { parent: { nodeId: 'root' }, component: 'Divider' },
    });

    // Trigger rebuild by adding another field
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'f2' },
    });

    const tree = project.component.tree as any;
    const hasDivider = tree.children.some((c: any) => c.component === 'Divider');
    expect(hasDivider).toBe(true);
  });

  it('creates Text nodes for display items using text, not bind', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'display', key: 'header', label: 'Welcome' },
    });

    // Display items use text prop (not bind) — they have no field signals to subscribe to
    const tree = project.component.tree as any;
    const node = tree.children?.find((c: any) => c.nodeId === 'header');
    expect(node).toBeDefined();
    expect(node!.component).toBe('Text');
    expect(node!.text).toBe('Welcome');
    expect(node!.bind).toBeUndefined();
    expect(node!.nodeId).toBe('header');
    // componentFor searches by bind; display items have no bind
    expect(project.componentFor('header')).toBeUndefined();
  });

  it('preserves display node overrides through tree rebuild', () => {
    const project = createRawProject();
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'display', key: 'header', label: 'Welcome' },
    });

    // Customize the display node (e.g. change component to Heading)
    const tree1 = project.component.tree as any;
    const displayNode = tree1.children.find((c: any) => c.nodeId === 'header');
    displayNode.component = 'Heading';
    displayNode.level = 2;

    // Trigger rebuild by adding another item
    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'name', dataType: 'string' },
    });

    // Display node overrides should survive the rebuild
    const tree2 = project.component.tree as any;
    const rebuilt = tree2.children.find((c: any) => c.nodeId === 'header');
    expect(rebuilt).toBeDefined();
    expect(rebuilt!.component).toBe('Heading');
    expect(rebuilt!.level).toBe(2);
    expect(rebuilt!.text).toBe('Welcome');
  });

  it('preserves distinct display overrides for same-key display items in different groups across rebuilds', () => {
    const project = createRawProject();
    project.batch([
      { type: 'definition.addItem', payload: { type: 'group', key: 'groupA' } },
      { type: 'definition.addItem', payload: { type: 'group', key: 'groupB' } },
      { type: 'definition.addItem', payload: { type: 'display', key: 'header', parentPath: 'groupA', label: 'Alpha Header' } },
      { type: 'definition.addItem', payload: { type: 'display', key: 'header', parentPath: 'groupB', label: 'Beta Header' } },
    ]);

    const tree1 = project.component.tree as any;
    const groupANode = tree1.children.find((c: any) => c.bind === 'groupA');
    const groupBNode = tree1.children.find((c: any) => c.bind === 'groupB');
    const groupADisplay = groupANode.children.find((c: any) => c.nodeId === 'header');
    const groupBDisplay = groupBNode.children.find((c: any) => c.nodeId === 'header');

    groupADisplay.component = 'Alert';
    groupADisplay.variant = 'warning';
    groupBDisplay.component = 'Callout';
    groupBDisplay.variant = 'info';

    project.dispatch({
      type: 'definition.addItem',
      payload: { type: 'field', key: 'name', dataType: 'string' },
    });

    const tree2 = project.component.tree as any;
    const rebuiltGroupA = tree2.children.find((c: any) => c.bind === 'groupA');
    const rebuiltGroupB = tree2.children.find((c: any) => c.bind === 'groupB');
    const rebuiltAHeader = rebuiltGroupA.children.find((c: any) => c.text === 'Alpha Header');
    const rebuiltBHeader = rebuiltGroupB.children.find((c: any) => c.text === 'Beta Header');

    expect(rebuiltAHeader.component).toBe('Alert');
    expect(rebuiltAHeader.variant).toBe('warning');
    expect(rebuiltBHeader.component).toBe('Callout');
    expect(rebuiltBHeader.variant).toBe('info');
  });

  it('handles batch with multiple structural changes', () => {
    const project = createRawProject();
    project.batch([
      { type: 'definition.addItem', payload: { type: 'field', key: 'a' } },
      { type: 'definition.addItem', payload: { type: 'field', key: 'b' } },
      { type: 'definition.addItem', payload: { type: 'field', key: 'c' } },
    ]);

    expect(project.componentFor('a')).toBeDefined();
    expect(project.componentFor('b')).toBeDefined();
    expect(project.componentFor('c')).toBeDefined();
  });
});
