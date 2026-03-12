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

  it('renders field cards as draggable reorder targets', () => {
    renderCanvas({
      $formspec: '1.0',
      url: 'urn:reorder-fields',
      version: '1.0.0',
      items: [
        { key: 'firstField', type: 'field', dataType: 'string', label: 'First Field' },
        { key: 'secondField', type: 'field', dataType: 'string', label: 'Second Field' },
      ],
    });

    expect(screen.getByTestId('field-firstField')).toHaveAttribute('draggable', 'true');
    expect(screen.getByTestId('field-secondField')).toHaveAttribute('draggable', 'true');
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
      screen.getByRole('button', { name: /^Text\b/i }).click();
    });

    // The newly added field should now be the active selection
    expect(capturedSelectedKey).not.toBeNull();
    expect(capturedSelectedKey).toMatch(/string/i);
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
    const keyInput = screen.getByRole('textbox');
    expect(keyInput).toHaveFocus();
  });
});
