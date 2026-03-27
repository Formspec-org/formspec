/** @filedesc Tests for the DefinitionTreeEditor — pure definition-tier tree view. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { DefinitionTreeEditor } from '../../../src/workspaces/editor/DefinitionTreeEditor';

function renderTree(definition: any) {
  const project = createProject({ seed: { definition } });
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <DefinitionTreeEditor />
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

describe('DefinitionTreeEditor', () => {
  it('renders field items with label and dataType badge', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });
    expect(screen.getByTestId('field-name')).toBeInTheDocument();
    expect(screen.getByTestId('field-age')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
  });

  it('renders group items as collapsible nodes with children', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'contact', type: 'group', label: 'Contact',
        children: [
          { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
        ],
      }],
    });
    expect(screen.getByTestId('group-contact')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders display items with widgetHint badge', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'intro', type: 'display', label: 'Welcome', presentation: { widgetHint: 'heading' } },
      ],
    });
    expect(screen.getByTestId('display-intro')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('shows the full item tree regardless of pageMode', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        { key: 'page1', type: 'group', label: 'Page 1', children: [
          { key: 'f1', type: 'field', dataType: 'string', label: 'Field 1' },
        ]},
        { key: 'page2', type: 'group', label: 'Page 2', children: [
          { key: 'f2', type: 'field', dataType: 'string', label: 'Field 2' },
        ]},
      ],
    });
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByText('Field 1')).toBeInTheDocument();
    expect(screen.getByText('Field 2')).toBeInTheDocument();
  });

  it('shows bind indicator pills', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }],
      binds: [{ path: 'name', required: 'true' }],
    });
    expect(screen.getByText('req')).toBeInTheDocument();
  });

  it('has an Add Item button', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [],
    });
    expect(screen.getByTestId('add-item')).toBeInTheDocument();
  });

  it('renders nested groups with deeply nested fields', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'outer', type: 'group', label: 'Outer',
        children: [{
          key: 'inner', type: 'group', label: 'Inner',
          children: [
            { key: 'deep', type: 'field', dataType: 'string', label: 'Deep Field' },
          ],
        }],
      }],
    });
    expect(screen.getByTestId('group-outer')).toBeInTheDocument();
    expect(screen.getByTestId('group-inner')).toBeInTheDocument();
    expect(screen.getByTestId('field-deep')).toBeInTheDocument();
  });

  it('falls back to itemKey when label is missing', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'unlabeled', type: 'field', dataType: 'string' },
      ],
    });
    expect(screen.getByText('unlabeled')).toBeInTheDocument();
  });

  it('shows calculate and readonly pills', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'total', type: 'field', dataType: 'decimal', label: 'Total' },
        { key: 'locked', type: 'field', dataType: 'string', label: 'Locked' },
      ],
      binds: [
        { path: 'total', calculate: '$a + $b' },
        { path: 'locked', readonly: 'true' },
      ],
    });
    expect(screen.getByText('\u0192x')).toBeInTheDocument();
    expect(screen.getByText('ro')).toBeInTheDocument();
  });

  it('shows repeatable badge on groups', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'items', type: 'group', label: 'Line Items',
        repeatable: true, minRepeat: 1, maxRepeat: 5,
        children: [
          { key: 'desc', type: 'field', dataType: 'string', label: 'Description' },
        ],
      }],
    });
    expect(screen.getByTestId('group-items')).toBeInTheDocument();
    // The repeat badge text includes the recycle icon and range
    expect(screen.getByText(/1.*5/)).toBeInTheDocument();
  });

  it('handles object-style binds after normalization', () => {
    // createProject normalizes object binds to array format
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{ key: 'f', type: 'field', dataType: 'string', label: 'F' }],
      binds: { f: { required: 'true' } },
    });
    expect(screen.getByText('req')).toBeInTheDocument();
  });

  it('renders empty tree without errors', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [],
    });
    // Only the add-item button should be present
    expect(screen.getByTestId('add-item')).toBeInTheDocument();
    expect(screen.queryByTestId(/^field-/)).toBeNull();
    expect(screen.queryByTestId(/^group-/)).toBeNull();
  });

  it('shows binds for nested fields using dotted paths', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'g', type: 'group', label: 'G',
        children: [
          { key: 'nested', type: 'field', dataType: 'string', label: 'Nested' },
        ],
      }],
      binds: [{ path: 'g.nested', required: 'true' }],
    });
    expect(screen.getByText('req')).toBeInTheDocument();
  });

  it('collapses group children when toggle is clicked', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'section', type: 'group', label: 'Section',
        children: [
          { key: 'child', type: 'field', dataType: 'string', label: 'Child Field' },
        ],
      }],
    });
    // Child visible by default
    expect(screen.getByText('Child Field')).toBeInTheDocument();

    // Click the group header to collapse
    fireEvent.click(screen.getByTestId('group-section').querySelector('[class*="cursor-pointer"]')!);
    expect(screen.queryByText('Child Field')).toBeNull();

    // Click again to expand
    fireEvent.click(screen.getByTestId('group-section').querySelector('[class*="cursor-pointer"]')!);
    expect(screen.getByText('Child Field')).toBeInTheDocument();
  });
});
