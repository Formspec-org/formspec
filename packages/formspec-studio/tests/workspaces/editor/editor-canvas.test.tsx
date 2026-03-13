import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { ActivePageProvider } from '../../../src/state/useActivePage';
import { EditorCanvas } from '../../../src/workspaces/editor/EditorCanvas';
import { ItemProperties } from '../../../src/workspaces/editor/ItemProperties';

const testDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'contact', type: 'group', label: 'Contact Info', children: [
      { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
      { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
    ]},
    { key: 'notice', type: 'display', label: 'Important Notice' },
  ],
  binds: {
    name: { required: 'true' },
    'contact.email': { calculate: '$name + "@example.com"' },
  },
};

function renderCanvas(def?: any) {
  const project = createProject({ seed: { definition: def || testDef } });
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    ),
    project,
  };
}

describe('EditorCanvas', () => {
  it('renders field blocks with labels', () => {
    renderCanvas();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders group headers', () => {
    renderCanvas();
    expect(screen.getByText('Contact Info')).toBeInTheDocument();
  });

  it('renders display blocks', () => {
    renderCanvas();
    expect(screen.getByText('Important Notice')).toBeInTheDocument();
  });

  it('clicking a block selects it', async () => {
    renderCanvas();
    await act(async () => {
      (screen.getByText('Full Name').closest('[data-testid]') as HTMLElement)?.click();
    });
    // Selected block should have visual indicator
    const block = screen.getByText('Full Name').closest('[data-testid]');
    expect(block?.className).toContain('accent');
  });

  it('shows bind pills on fields', () => {
    renderCanvas();
    // name has required bind
    expect(screen.getByText('req')).toBeInTheDocument();
  });

  it('keeps root-level items visible after wizard page mode is enabled', () => {
    renderCanvas({
      $formspec: '1.0',
      url: 'urn:wizard-root-items',
      version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        { key: 'orphanName', type: 'field', dataType: 'string', label: 'Orphan Name' },
        {
          key: 'pageOne',
          type: 'group',
          label: 'Page One',
          children: [{ key: 'pageField', type: 'field', dataType: 'string', label: 'Page Field' }],
        },
      ],
    });

    expect(screen.getByText('Orphan Name')).toBeInTheDocument();
  });

  it('selects the first page tab even when the structure tree is not mounted', () => {
    renderCanvas({
      $formspec: '1.0',
      url: 'urn:editor-active-page',
      version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        {
          key: 'page1',
          type: 'group',
          label: 'Applicant',
          children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Full Name' }],
        },
        {
          key: 'page2',
          type: 'group',
          label: 'Review',
          children: [{ key: 'summary', type: 'display', label: 'Check your answers' }],
        },
      ],
    });

    const [firstPageTab] = screen.getAllByRole('tab');
    expect(firstPageTab).toHaveAttribute('title', 'Applicant');
    expect(firstPageTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders field cards inside sortable wrappers', () => {
    renderCanvas({
      $formspec: '1.0',
      url: 'urn:reorder-fields',
      version: '1.0.0',
      items: [
        { key: 'firstField', type: 'field', dataType: 'string', label: 'First Field' },
        { key: 'secondField', type: 'field', dataType: 'string', label: 'Second Field' },
      ],
    });

    // Each field block should be wrapped by a SortableItemWrapper div
    const first = screen.getByTestId('field-firstField');
    const second = screen.getByTestId('field-secondField');
    expect(first).toBeInTheDocument();
    expect(second).toBeInTheDocument();
    // Wrapper parent should exist (SortableItemWrapper div)
    expect(first.parentElement).toBeTruthy();
    expect(second.parentElement).toBeTruthy();
  });

  it('moves keyboard focus between field cards before entering the inspector', async () => {
    renderCanvas({
      $formspec: '1.0',
      url: 'urn:tab-order',
      version: '1.0.0',
      items: [
        { key: 'firstField', type: 'field', dataType: 'string', label: 'First Field' },
        { key: 'secondField', type: 'field', dataType: 'string', label: 'Second Field' },
      ],
    });

    const firstField = screen.getByTestId('field-firstField');
    const secondField = screen.getByTestId('field-secondField');

    expect(firstField).toHaveAttribute('tabindex', '0');
    expect(secondField).toHaveAttribute('tabindex', '0');

    await act(async () => {
      firstField.focus();
      fireEvent.keyDown(firstField, { key: 'Tab' });
    });

    expect(secondField).toHaveFocus();
  });

  // Bug #26: New field added on page 6 is not auto-selected
  it('auto-selects the newly added item after clicking Add Item on a later page', async () => {
    // Build a wizard-mode definition with 6 pages; the user is on page 6
    const pages = Array.from({ length: 6 }, (_, i) => ({
      key: `page${i + 1}`,
      type: 'group',
      label: `Page ${i + 1}`,
      children: [
        { key: `field${i + 1}`, type: 'field', dataType: 'string', label: `Field ${i + 1}` },
      ],
    }));

    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:bug26-auto-select',
          version: '1.0.0',
          formPresentation: { pageMode: 'wizard' },
          items: pages,
        } as any,
      },
    });

    // Helper to expose selectedKey from context
    let capturedSelectedKey: string | null = null;
    function SelectionCapture() {
      const { selectedKey } = useSelection();
      capturedSelectedKey = selectedKey;
      return null;
    }

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
            <SelectionCapture />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    );

    // Navigate to page 6 via page tabs
    const pageTabs = screen.getAllByRole('tab');
    const page6Tab = pageTabs.find((t) => t.getAttribute('title') === 'Page 6');
    await act(async () => {
      page6Tab?.click();
    });

    // Open the palette and choose "Text" to add an item
    await act(async () => {
      screen.getByTestId('add-item').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: /^Text Block\b/i }).click();
    });

    // The newly added item should now be the active selection
    expect(capturedSelectedKey).not.toBeNull();
    expect(capturedSelectedKey).toMatch(/display/i);
  });

  // Bug #63: Newly added Single Choice field is not auto-selected with key input focused
  it('auto-selects the new field and focuses the key input after adding a Single Choice item', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:bug63-autofocus-key',
          version: '1.0.0',
          items: [],
        } as any,
      },
    });

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
            <ItemProperties />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    );

    // Open the Add Item palette
    await act(async () => {
      screen.getByTestId('add-item').click();
    });

    // Select "Single Choice" from the palette
    await act(async () => {
      screen.getByRole('button', { name: /^Single Choice\b/i }).click();
    });

    // The ItemProperties panel should be visible (item selected)
    expect(screen.getByText('Properties')).toBeInTheDocument();

    // The KEY input in the inspector should be focused immediately
    const keyInput = screen.getByLabelText('Key');
    expect(keyInput).toHaveFocus();
  });

  it('selects the canonical inserted path after adding an item with a colliding key', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:editor-collision-selection',
          version: '1.0.0',
          formPresentation: { pageMode: 'wizard' },
          items: [
            {
              key: 'page1',
              type: 'group',
              label: 'Page 1',
              children: [
                { key: 'string1', type: 'field', dataType: 'string', label: 'Existing String' },
              ],
            },
          ],
        } as any,
      },
    });

    let capturedSelectedKey: string | null = null;
    function SelectionCapture() {
      const { selectedKey } = useSelection();
      capturedSelectedKey = selectedKey;
      return null;
    }

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
            <SelectionCapture />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByTestId('add-item').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: /^Text Block\b/i }).click();
    });

    const page = project.definition.items[0] as any;
    const insertedField = page.children.find((item: any) => item.label === 'Text Block');

    expect(insertedField).toBeTruthy();
    expect(insertedField.key).not.toBe('string1');
    expect(capturedSelectedKey).toBe(`page1.${insertedField.key}`);
  });

  it('uses the insertedPath returned by dispatch instead of guessing locally', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:editor-inserted-path-override',
          version: '1.0.0',
          items: [],
        } as any,
      },
      middleware: [
        (_state, command, next) => {
          const result = next(command);
          if (command.type !== 'definition.addItem') return result;
          return { ...result, insertedPath: 'canonical.inserted.path' };
        },
      ],
    });

    let capturedSelectedKey: string | null = null;
    function SelectionCapture() {
      const { selectedKey } = useSelection();
      capturedSelectedKey = selectedKey;
      return null;
    }

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActivePageProvider>
            <EditorCanvas />
            <SelectionCapture />
          </ActivePageProvider>
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByTestId('add-item').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: /^Text Block\b/i }).click();
    });

    expect(capturedSelectedKey).toBe('canonical.inserted.path');
  });

  describe('multi-select', () => {
    function renderMultiSelect() {
      const def = {
        $formspec: '1.0', url: 'urn:multi-select', version: '1.0.0',
        items: [
          { key: 'first', type: 'field', dataType: 'string', label: 'First' },
          { key: 'second', type: 'field', dataType: 'string', label: 'Second' },
          { key: 'third', type: 'field', dataType: 'string', label: 'Third' },
          { key: 'fourth', type: 'field', dataType: 'string', label: 'Fourth' },
        ],
      };
      const project = createProject({ seed: { definition: def as any } });

      let captured: any = {};
      function SelectionCapture() {
        const sel = useSelection();
        captured = sel;
        return null;
      }

      const result = render(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <ActivePageProvider>
              <EditorCanvas />
              <SelectionCapture />
            </ActivePageProvider>
          </SelectionProvider>
        </ProjectProvider>,
      );
      return { ...result, project, getSelection: () => captured };
    }

    it('plain click selects single item and deselects others', async () => {
      const { getSelection } = renderMultiSelect();

      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      expect(getSelection().selectedKeys.size).toBe(1);
      expect(getSelection().primaryKey).toBe('first');

      await act(async () => {
        fireEvent.click(screen.getByTestId('field-second'));
      });
      expect(getSelection().selectedKeys.size).toBe(1);
      expect(getSelection().primaryKey).toBe('second');
      expect(getSelection().selectedKeys.has('first')).toBe(false);
    });

    it('cmd+click toggles item in and out of selection', async () => {
      const { getSelection } = renderMultiSelect();

      // Select first
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      // Cmd+click second
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-second'), { metaKey: true });
      });
      expect(getSelection().selectedKeys.size).toBe(2);
      expect(getSelection().selectedKeys.has('first')).toBe(true);
      expect(getSelection().selectedKeys.has('second')).toBe(true);

      // Cmd+click second again to deselect it
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-second'), { metaKey: true });
      });
      expect(getSelection().selectedKeys.size).toBe(1);
      expect(getSelection().selectedKeys.has('second')).toBe(false);
    });

    it('shift+click selects range from primary to target', async () => {
      const { getSelection } = renderMultiSelect();

      // Click first (sets anchor/primary)
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      // Shift+click third
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-third'), { shiftKey: true });
      });
      expect(getSelection().selectedKeys.size).toBe(3);
      expect(getSelection().selectedKeys.has('first')).toBe(true);
      expect(getSelection().selectedKeys.has('second')).toBe(true);
      expect(getSelection().selectedKeys.has('third')).toBe(true);
      // Primary stays at anchor
      expect(getSelection().primaryKey).toBe('first');
    });

    it('right-click on unselected item selects just that item', async () => {
      const { getSelection } = renderMultiSelect();

      // Select first via click
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      // Right-click on third (not in selection)
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-third'));
      });
      expect(getSelection().primaryKey).toBe('third');
      expect(getSelection().selectedKeys.size).toBe(1);
    });

    it('right-click on selected item keeps the multi-selection', async () => {
      const { getSelection } = renderMultiSelect();

      // Build multi-selection
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-second'), { metaKey: true });
      });
      expect(getSelection().selectedKeys.size).toBe(2);

      // Right-click on first (in selection) — should keep selection
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-first'));
      });
      expect(getSelection().selectedKeys.size).toBe(2);
    });

    it('shows batch context menu when multiple items selected', async () => {
      renderMultiSelect();

      // Build multi-selection
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-second'), { metaKey: true });
      });
      // Right-click on selected item
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-first'));
      });
      expect(screen.getByText('Delete 2 items')).toBeInTheDocument();
      expect(screen.getByText('Duplicate 2 items')).toBeInTheDocument();
      expect(screen.getByText('Wrap in Group')).toBeInTheDocument();
    });

    it('batch delete removes all selected items', async () => {
      const { project } = renderMultiSelect();

      // Select first and second
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-second'), { metaKey: true });
      });
      // Right-click and delete
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-first'));
      });
      await act(async () => {
        screen.getByText('Delete 2 items').click();
      });

      const keys = project.definition.items.map((i: any) => i.key);
      expect(keys).not.toContain('first');
      expect(keys).not.toContain('second');
      expect(keys).toContain('third');
      expect(keys).toContain('fourth');
    });

    it('escape clears selection', async () => {
      const { getSelection } = renderMultiSelect();

      // Select two items
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-second'), { metaKey: true });
      });
      expect(getSelection().selectionCount).toBe(2);

      // Press Escape
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      expect(getSelection().selectionCount).toBe(0);
      expect(getSelection().primaryKey).toBeNull();
    });

    it('batch duplicate clones all selected items', async () => {
      const { project } = renderMultiSelect();

      await act(async () => {
        fireEvent.click(screen.getByTestId('field-first'));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('field-second'), { metaKey: true });
      });
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-first'));
      });
      await act(async () => {
        screen.getByText('Duplicate 2 items').click();
      });

      // Should have 6 items (4 original + 2 duplicates)
      expect(project.definition.items.length).toBe(6);
    });
  });

  describe('component tree rendering', () => {
    it('renders a LayoutBlock when the component tree has a layout wrapper', () => {
      const project = createProject({ seed: { definition: testDef as any } });
      // Wrap 'name' in a Card layout container
      project.dispatch({
        type: 'component.wrapNode',
        payload: { node: { bind: 'name' }, wrapper: { component: 'Card' } },
      });

      render(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <ActivePageProvider>
              <EditorCanvas />
            </ActivePageProvider>
          </SelectionProvider>
        </ProjectProvider>,
      );

      // Card layout block should be visible
      expect(screen.getByText('Card')).toBeInTheDocument();
      // The field inside should still render
      expect(screen.getByText('Full Name')).toBeInTheDocument();
    });

    it('clicking a layout block selects it with __node: id', async () => {
      const project = createProject({ seed: { definition: testDef as any } });
      const result = project.dispatch({
        type: 'component.wrapNode',
        payload: { node: { bind: 'name' }, wrapper: { component: 'Card' } },
      });
      const nodeId = (result as any).nodeRef.nodeId;

      let capturedSelectedKey: string | null = null;
      function SelectionCapture() {
        const { selectedKey } = useSelection();
        capturedSelectedKey = selectedKey;
        return null;
      }

      render(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <ActivePageProvider>
              <EditorCanvas />
              <SelectionCapture />
            </ActivePageProvider>
          </SelectionProvider>
        </ProjectProvider>,
      );

      await act(async () => {
        screen.getByTestId(`layout-${nodeId}`).click();
      });

      expect(capturedSelectedKey).toBe(`__node:${nodeId}`);
    });

    it('fields inside layout wrappers maintain correct definition paths', () => {
      const project = createProject({ seed: { definition: testDef as any } });
      project.dispatch({
        type: 'component.wrapNode',
        payload: { node: { bind: 'name' }, wrapper: { component: 'Card' } },
      });

      render(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <ActivePageProvider>
              <EditorCanvas />
            </ActivePageProvider>
          </SelectionProvider>
        </ProjectProvider>,
      );

      // The field should still have its original definition path
      const field = screen.getByTestId('field-name');
      expect(field.getAttribute('data-item-path')).toBe('name');
    });

    it('renders display blocks with widgetHint from component tree', () => {
      const def = {
        $formspec: '1.0', url: 'urn:display-hint', version: '1.0.0',
        items: [
          { key: 'header', type: 'display', label: 'Welcome' },
        ],
      };
      const project = createProject({ seed: { definition: def as any } });
      // Change the display node's component type to Heading via setNodeProperty
      project.dispatch({
        type: 'component.setNodeProperty',
        payload: { node: { nodeId: 'header' }, property: 'component', value: 'Heading' },
      });

      render(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <ActivePageProvider>
              <EditorCanvas />
            </ActivePageProvider>
          </SelectionProvider>
        </ProjectProvider>,
      );

      expect(screen.getByText('Heading')).toBeInTheDocument();
    });
  });

  describe('wrap/unwrap context menu', () => {
    it('right-click field shows "Wrap in Card" option', async () => {
      renderCanvas();
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-name'));
      });
      expect(screen.getByText('Wrap in Card')).toBeInTheDocument();
    });

    it('"Wrap in Card" dispatches component.wrapNode and wraps the field', async () => {
      const { project } = renderCanvas();
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-name'));
      });
      await act(async () => {
        screen.getByText('Wrap in Card').click();
      });

      // A Card layout block should now be visible
      expect(screen.getByText('Card')).toBeInTheDocument();
      // The field should still render inside
      expect(screen.getByText('Full Name')).toBeInTheDocument();
    });

    it('right-click layout node shows "Unwrap" option', async () => {
      const { project } = renderCanvas();
      // First wrap a field in a Card
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-name'));
      });
      await act(async () => {
        screen.getByText('Wrap in Card').click();
      });
      // Now right-click the layout block
      const cardText = screen.getByText('Card');
      const layoutBlock = cardText.closest('[data-item-type="layout"]') as HTMLElement;
      await act(async () => {
        fireEvent.contextMenu(layoutBlock);
      });
      expect(screen.getByText('Unwrap')).toBeInTheDocument();
    });

    it('"Unwrap" dissolves the layout container', async () => {
      const { project } = renderCanvas();
      // Wrap then unwrap
      await act(async () => {
        fireEvent.contextMenu(screen.getByTestId('field-name'));
      });
      await act(async () => {
        screen.getByText('Wrap in Card').click();
      });
      expect(screen.getByText('Card')).toBeInTheDocument();

      const cardText = screen.getByText('Card');
      const layoutBlock = cardText.closest('[data-item-type="layout"]') as HTMLElement;
      await act(async () => {
        fireEvent.contextMenu(layoutBlock);
      });
      await act(async () => {
        screen.getByText('Unwrap').click();
      });
      // Card should be gone
      expect(screen.queryByText('Card')).not.toBeInTheDocument();
      // Field should still be there
      expect(screen.getByText('Full Name')).toBeInTheDocument();
    });
  });
});
