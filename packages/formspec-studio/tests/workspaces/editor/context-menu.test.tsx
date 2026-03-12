import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActivePageProvider } from '../../../src/state/useActivePage';
import { EditorCanvas } from '../../../src/workspaces/editor/EditorCanvas';

const definition = {
  $formspec: '1.0',
  url: 'urn:test',
  version: '1.0.0',
  items: [
    { key: 'firstField', type: 'field', dataType: 'string', label: 'First Field' },
    { key: 'secondField', type: 'field', dataType: 'string', label: 'Second Field' },
  ],
};

function renderCanvas() {
  const project = createProject({ seed: { definition: definition as any } });
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    ),
  };
}

describe('Editor context menu behavior', () => {
  it('wraps a field in a new group when Wrap in Group is clicked', () => {
    renderCanvas();

    fireEvent.contextMenu(screen.getByTestId('field-firstField'));
    fireEvent.click(screen.getByRole('menuitem', { name: /wrap in group/i }));

    expect(screen.getAllByTestId(/group-/i)).toHaveLength(1);
    expect(screen.getByTestId('field-firstField')).toBeInTheDocument();
  });

  it('moves a field down when Move Down is clicked', () => {
    renderCanvas();

    fireEvent.contextMenu(screen.getByTestId('field-firstField'));
    fireEvent.click(screen.getByRole('menuitem', { name: /move down/i }));

    const fieldBlocks = screen.getAllByTestId(/field-/i);
    expect(fieldBlocks[0]).toHaveAttribute('data-testid', 'field-secondField');
    expect(fieldBlocks[1]).toHaveAttribute('data-testid', 'field-firstField');
  });

  // Bug #9: Context menu opened near the right/bottom viewport edge should be
  // clamped so that it remains fully within the viewport. Currently the menu is
  // positioned at the raw clientX/clientY without any boundary check, so it can
  // overflow off-screen.
  it('keeps the context menu within the viewport when right-clicked near the right/bottom edge', () => {
    renderCanvas();

    // Simulate a right-click very close to the bottom-right corner of the viewport.
    // window.innerWidth/Height default to 1024×768 in jsdom.
    const nearEdgeX = window.innerWidth - 5;
    const nearEdgeY = window.innerHeight - 5;

    fireEvent.contextMenu(screen.getByTestId('field-firstField'), {
      clientX: nearEdgeX,
      clientY: nearEdgeY,
    });

    // The position style is on the wrapper div that contains the EditorContextMenu.
    // That wrapper is the direct parent of the element with data-testid="context-menu".
    const menu = screen.getByTestId('context-menu');
    const wrapper = menu.parentElement as HTMLElement;
    const menuLeft = parseFloat(wrapper.style.left);
    const menuTop = parseFloat(wrapper.style.top);
    // min-w-[160px] from CSS; JSDOM doesn't compute layout, so use the known minimum.
    const MENU_MIN_WIDTH = 160;

    // The menu's left edge is placed at the raw click X, which is within 5px of the
    // viewport edge. Without clamping, menuLeft + MENU_MIN_WIDTH > window.innerWidth.
    // A correct implementation would clamp left so the menu stays in view.
    expect(menuLeft + MENU_MIN_WIDTH).toBeLessThanOrEqual(window.innerWidth);
  });

  // Bug #61: Right-clicking the empty canvas background should show a canvas-level
  // context menu with an "Add Item" option so that users can add items without
  // using the "+ Add Item" button at the bottom. Currently the handleContextMenu
  // handler returns early when no field/group/display block is found, so right-
  // clicking empty space does nothing at all.
  it('shows a canvas-level context menu with Add Item when right-clicking the empty canvas background', () => {
    const { container } = renderCanvas();

    // Find the root canvas div (the outermost div rendered by EditorCanvas) and
    // fire a contextMenu event directly on it so that e.target === e.currentTarget,
    // meaning we clicked the blank background, not a field block.
    const canvas = container.firstChild as HTMLElement;
    fireEvent.contextMenu(canvas, { clientX: 300, clientY: 300 });

    // Expect a canvas-level context menu with an "Add Item" action.
    expect(screen.getByRole('menuitem', { name: /add item/i })).toBeInTheDocument();
  });

  it('moves the item into the canonical wrapper path when Wrap in Group generates a collision-safe key', () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:wrap-group-collision',
          version: '1.0.0',
          items: [
            { key: 'firstField', type: 'field', dataType: 'string', label: 'First Field' },
            ...Array.from({ length: 80 }, (_, index) => ({
              key: `group${index + 1}`,
              type: 'group',
              label: `Existing Group ${index + 1}`,
              children: [],
            })),
          ],
        } as any,
      },
    });

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    );

    fireEvent.contextMenu(screen.getByTestId('field-firstField'));
    fireEvent.click(screen.getByRole('menuitem', { name: /wrap in group/i }));

    const createdGroup = project.definition.items.find((item: any) => item.label === 'Group');
    expect(createdGroup).toBeTruthy();
    if (!createdGroup || !createdGroup.children) {
      throw new Error('Expected Wrap in Group to create a wrapper with children');
    }
    expect(createdGroup.children).toHaveLength(1);
    expect(createdGroup.children[0].key).toBe('firstField');
  });
});
