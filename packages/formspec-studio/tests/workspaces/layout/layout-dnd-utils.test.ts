/** @filedesc Tests layout DnD drag-end routing, especially Accordion/Collapsible container drops. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  handleDragEnd,
  indexOfComponentChild,
  sortGroupToParentRef,
  type DragEndEvent,
} from '../../../src/workspaces/layout/dnd/layout-dnd-utils';
import { LAYOUT_PDND_KIND } from '../../../src/workspaces/layout/dnd/layout-pdnd';
import type { Project, CompNode } from '@formspec-org/studio-core';

function mockProject(componentTree?: CompNode) {
  return {
    component: { tree: componentTree ?? { component: 'Root', children: [] } },
    moveComponentNodeToContainer: vi.fn(),
    moveComponentNodeToIndex: vi.fn(),
    itemAt: vi.fn(() => false),
    placeOnPage: vi.fn(),
    addItemToLayout: vi.fn(),
  } as unknown as Project;
}

const mockSelect = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('indexOfComponentChild', () => {
  const children = [
    { component: 'A', bind: 'a' },
    { component: 'B', nodeId: 'n1' },
  ] as CompNode[];

  it('finds by bind', () => {
    expect(indexOfComponentChild(children, { bind: 'a' })).toBe(0);
  });

  it('finds by nodeId', () => {
    expect(indexOfComponentChild(children, { nodeId: 'n1' })).toBe(1);
  });

  it('returns -1 when missing', () => {
    expect(indexOfComponentChild(children, { bind: 'missing' })).toBe(-1);
    expect(indexOfComponentChild(undefined, { bind: 'a' })).toBe(-1);
  });
});

describe('sortGroupToParentRef', () => {
  it('maps "root" to { nodeId: "root" }', () => {
    expect(sortGroupToParentRef('root')).toEqual({ nodeId: 'root' });
  });

  it('maps a nodeId to { nodeId }', () => {
    expect(sortGroupToParentRef('acc1')).toEqual({ nodeId: 'acc1' });
  });

  it('maps "bind:firstName" to { bind: "firstName" }', () => {
    expect(sortGroupToParentRef('bind:firstName')).toEqual({ bind: 'firstName' });
  });

  it('returns null for empty string', () => {
    expect(sortGroupToParentRef('')).toBeNull();
  });
});

describe('handleDragEnd — Accordion/Collapsible container drops', () => {
  it('routes a container-drop target to moveComponentNodeToContainer', () => {
    const project = mockProject({
      component: 'Root',
      children: [{ component: 'Accordion', nodeId: 'acc1', children: [] }],
    });

    const event: DragEndEvent = {
      canceled: false,
      source: { id: 'field:firstName', data: { nodeRef: { bind: 'firstName' }, type: 'tree-node' } },
      target: { id: 'empty-acc1', data: { type: 'container-drop', nodeRef: { nodeId: 'acc1' } } },
    };

    handleDragEnd(project, event, null, mockSelect);

    expect(project.moveComponentNodeToContainer).toHaveBeenCalledWith(
      { bind: 'firstName' },
      { nodeId: 'acc1' },
    );
    expect(project.moveComponentNodeToIndex).not.toHaveBeenCalled();
  });

  it('routes a sortable cross-group drop into an Accordion group', () => {
    const project = mockProject({
      component: 'Root',
      children: [
        { component: 'Accordion', nodeId: 'acc1', children: [] },
        { component: 'FieldBlock', bind: 'firstName' },
      ],
    });

    const event: DragEndEvent = {
      canceled: false,
      source: { id: 'field:firstName', data: { nodeRef: { bind: 'firstName' }, type: 'tree-node' } },
      target: null,
      sortable: { group: 'acc1', index: 0, initialGroup: 'root', initialIndex: 1 },
    };

    handleDragEnd(project, event, null, mockSelect);

    expect(project.moveComponentNodeToIndex).toHaveBeenCalledWith(
      { bind: 'firstName' },
      { nodeId: 'acc1' },
      0,
    );
  });

  it('does not route when the item did not move (same group and index)', () => {
    const project = mockProject({
      component: 'Root',
      children: [{ component: 'Accordion', nodeId: 'acc1', children: [{ component: 'FieldBlock', bind: 'firstName' }] }],
    });

    const event: DragEndEvent = {
      canceled: false,
      source: { id: 'field:firstName', data: { nodeRef: { bind: 'firstName' }, type: 'tree-node' } },
      target: null,
      sortable: { group: 'acc1', index: 0, initialGroup: 'acc1', initialIndex: 0 },
    };

    handleDragEnd(project, event, null, mockSelect);

    expect(project.moveComponentNodeToContainer).not.toHaveBeenCalled();
    expect(project.moveComponentNodeToIndex).not.toHaveBeenCalled();
  });

  it('prevents circular move (dropping container into its own descendant)', () => {
    const project = mockProject({
      component: 'Root',
      children: [{
        component: 'Card',
        nodeId: 'card1',
        children: [{
          component: 'Accordion',
          nodeId: 'acc1',
          children: [],
        }],
      }],
    });

    const event: DragEndEvent = {
      canceled: false,
      source: { id: 'node:card1', data: { nodeRef: { nodeId: 'card1' }, type: 'tree-node' } },
      target: { id: 'empty-acc1', data: { type: 'container-drop', nodeRef: { nodeId: 'acc1' } } },
    };

    handleDragEnd(project, event, null, mockSelect);

    expect(project.moveComponentNodeToContainer).not.toHaveBeenCalled();
  });

  it('routes a sortable reorder out of an Accordion to root', () => {
    const project = mockProject({
      component: 'Root',
      children: [
        { component: 'Accordion', nodeId: 'acc1', children: [{ component: 'FieldBlock', bind: 'email' }] },
        { component: 'Heading', nodeId: 'heading1' },
      ],
    });

    const event: DragEndEvent = {
      canceled: false,
      source: { id: 'field:email', data: { nodeRef: { bind: 'email' }, type: 'tree-node' } },
      target: null,
      sortable: { group: 'root', index: 1, initialGroup: 'acc1', initialIndex: 0 },
    };

    handleDragEnd(project, event, null, mockSelect);

    expect(project.moveComponentNodeToIndex).toHaveBeenCalledWith(
      { bind: 'email' },
      { nodeId: 'root' },
      1,
    );
  });
});

describe('handleDragEnd — tray (unassigned-item + layout kind)', () => {
  it('calls handleTrayDrop then moveComponentNodeToIndex when dropped on a tree-node row', () => {
    const tree: CompNode = {
      component: 'Stack',
      nodeId: 'root',
      _layout: true,
      children: [{ component: 'TextInput', bind: 'name' }],
    } as CompNode;
    const project = mockProject(tree);

    handleDragEnd(
      project,
      {
        canceled: false,
        source: {
          id: 'unassigned:phone',
          data: {
            kind: LAYOUT_PDND_KIND,
            type: 'unassigned-item',
            key: 'phone',
            label: 'Phone',
            itemType: 'field',
          },
        },
        target: { id: 'field:name', data: { type: 'tree-node', nodeRef: { bind: 'name' } } },
      },
      'page-1',
      mockSelect,
    );

    expect(project.addItemToLayout).toHaveBeenCalled();
    expect(project.moveComponentNodeToIndex).toHaveBeenCalledWith({ bind: 'phone' }, { nodeId: 'root' }, 0);
    expect(mockSelect).toHaveBeenCalledWith('phone', 'field', { tab: 'layout' });
  });

  it('calls handleTrayDrop then moveComponentNodeToContainer when dropped on container-drop', () => {
    const tree: CompNode = {
      component: 'Root',
      children: [{ component: 'Accordion', nodeId: 'acc1', children: [] }],
    } as CompNode;
    const project = mockProject(tree);

    handleDragEnd(
      project,
      {
        canceled: false,
        source: {
          id: 'unassigned:phone',
          data: {
            kind: LAYOUT_PDND_KIND,
            type: 'unassigned-item',
            key: 'phone',
            label: 'Phone',
            itemType: 'field',
          },
        },
        target: { id: 'empty-acc1', data: { type: 'container-drop', nodeRef: { nodeId: 'acc1' } } },
      },
      null,
      mockSelect,
    );

    expect(project.addItemToLayout).toHaveBeenCalled();
    expect(project.moveComponentNodeToContainer).toHaveBeenCalledWith({ bind: 'phone' }, { nodeId: 'acc1' });
  });

  it('ignores legacy tray payloads without layout kind (no tree routing)', () => {
    const project = mockProject({
      component: 'Root',
      children: [{ component: 'FieldBlock', bind: 'email' }],
    } as CompNode);

    handleDragEnd(
      project,
      {
        canceled: false,
        source: {
          id: 'unassigned:phone',
          data: { type: 'unassigned-item', key: 'phone', label: 'Phone', itemType: 'field' },
        },
        target: { id: 'field:email', data: { type: 'tree-node', nodeRef: { bind: 'email' } } },
      },
      null,
      mockSelect,
    );

    expect(project.addItemToLayout).not.toHaveBeenCalled();
    expect(project.moveComponentNodeToIndex).not.toHaveBeenCalled();
  });
});
