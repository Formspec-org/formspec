/** @filedesc Tests for the shared ItemListEditor — parameterized item tree usable by both definition and screener. */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ItemListEditor, type ItemListEditorConfig } from '../../../src/workspaces/editor/ItemListEditor';

function renderItemListEditor(config: ItemListEditorConfig) {
  const project = createProject();
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ItemListEditor config={config} />
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

function makeConfig(overrides: Partial<ItemListEditorConfig> = {}): ItemListEditorConfig {
  return {
    items: [],
    binds: undefined,
    onAddField: vi.fn(),
    onRemoveItem: vi.fn(),
    onUpdateItem: vi.fn(),
    onReorderItem: vi.fn(),
    allowGroups: false,
    allowDisplayItems: false,
    allowCopy: false,
    allowRename: false,
    allowWrapInGroup: false,
    headerTitle: 'Item list',
    headerDescription: 'Select an item to edit it.',
    emptyStateTitle: 'No items yet',
    emptyStateDescription: 'Add your first item to get started.',
    addButtonLabel: '+ Add Item',
    surfaceTestId: 'item-list-surface',
    selectionTab: 'test',
    ...overrides,
  };
}

describe('ItemListEditor', () => {
  it('renders empty state when items list is empty', () => {
    renderItemListEditor(makeConfig());
    expect(screen.getByText('No items yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first item to get started.')).toBeInTheDocument();
  });

  it('renders field items with label and dataType', () => {
    renderItemListEditor(makeConfig({
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    }));
    expect(screen.getByTestId('field-name')).toBeInTheDocument();
    expect(screen.getByTestId('field-age')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
  });

  it('shows add button with custom label', () => {
    renderItemListEditor(makeConfig({ addButtonLabel: '+ Add Question' }));
    expect(screen.getByTestId('add-item')).toHaveTextContent('+ Add Question');
  });

  it('uses the provided surfaceTestId', () => {
    renderItemListEditor(makeConfig({ surfaceTestId: 'screener-item-surface' }));
    expect(screen.getByTestId('screener-item-surface')).toBeInTheDocument();
  });

  it('omits "Wrap in Group" from context menu when allowWrapInGroup is false', () => {
    renderItemListEditor(makeConfig({
      items: [{ key: 'q1', type: 'field', dataType: 'boolean', label: 'Question 1' }],
      allowWrapInGroup: false,
    }));

    const row = screen.getByTestId('field-q1');
    fireEvent.contextMenu(row);

    // Context menu should not contain "Wrap in Group"
    expect(screen.queryByText('Wrap in Group')).toBeNull();
  });

  it('includes "Duplicate" in context menu only when allowCopy is true', () => {
    renderItemListEditor(makeConfig({
      items: [{ key: 'q1', type: 'field', dataType: 'boolean', label: 'Question 1' }],
      allowCopy: true,
    }));

    const row = screen.getByTestId('field-q1');
    fireEvent.contextMenu(row);

    expect(screen.getByText('Duplicate')).toBeInTheDocument();
  });

  it('does not show "Duplicate" when allowCopy is false', () => {
    renderItemListEditor(makeConfig({
      items: [{ key: 'q1', type: 'field', dataType: 'boolean', label: 'Question 1' }],
      allowCopy: false,
    }));

    const row = screen.getByTestId('field-q1');
    fireEvent.contextMenu(row);

    expect(screen.queryByText('Duplicate')).toBeNull();
  });

  it('calls onRemoveItem when delete is confirmed', () => {
    const onRemoveItem = vi.fn();
    renderItemListEditor(makeConfig({
      items: [{ key: 'q1', type: 'field', dataType: 'boolean', label: 'Question 1' }],
      onRemoveItem,
    }));

    const row = screen.getByTestId('field-q1');
    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByText('Delete'));

    // Confirm dialog should appear
    expect(screen.getByText('Delete Question 1?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirm Delete'));
    expect(onRemoveItem).toHaveBeenCalledWith('q1');
  });

  it('calls onReorderItem via context menu', () => {
    const onReorderItem = vi.fn();
    renderItemListEditor(makeConfig({
      items: [
        { key: 'q1', type: 'field', dataType: 'boolean', label: 'Q1' },
        { key: 'q2', type: 'field', dataType: 'string', label: 'Q2' },
      ],
      onReorderItem,
    }));

    const row = screen.getByTestId('field-q1');
    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByText('Move Down'));

    expect(onReorderItem).toHaveBeenCalledWith('q1', 'down');
  });
});
