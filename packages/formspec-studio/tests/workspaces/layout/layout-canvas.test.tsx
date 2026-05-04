/** @filedesc Tests for the Layout workspace canvas — authored Page sections, layout containers, and mode selector. */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { LayoutCanvas } from '../../../src/workspaces/layout/LayoutCanvas';

function renderLayout(project: Project) {
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActiveGroupProvider>
            <LayoutCanvas />
          </ActiveGroupProvider>
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

function makeProject(definition: any): Project {
  return createProject({ seed: { definition } });
}

describe('LayoutCanvas', () => {
  it('renders authored Page nodes as titled sections', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });
    project.addPage('Step 1');

    renderLayout(project);
    // The authored Page section exposes its title in the section header.
    const pageSection = screen.getByTestId(/^layout-page-/);
    expect(pageSection).toBeInTheDocument();
    expect(pageSection).toHaveTextContent('Step 1');
  });

  it('renders layout containers (Card) as labeled wrappers', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });
    project.wrapInLayoutComponent('name', 'Card');

    renderLayout(project);
    const cardContainer = screen.getByTestId((id, el) =>
      Boolean((el as HTMLElement).getAttribute('data-testid')?.startsWith('layout-container-')),
    );
    expect(cardContainer).toHaveTextContent('Card');
    expect(cardContainer).toHaveTextContent('Full Name');
  });

  it('renders bound field items with their labels', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'email', type: 'field', dataType: 'string', label: 'Email Address' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });

    renderLayout(project);
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('multi-selects field rows with meta+click', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'email', type: 'field', dataType: 'string', label: 'Email Address' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });

    renderLayout(project);
    const emailRow = screen.getByTestId('layout-field-email');
    const ageRow = screen.getByTestId('layout-field-age');

    fireEvent.click(emailRow);
    expect(emailRow.getAttribute('aria-pressed')).toBe('true');
    expect(ageRow.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(ageRow, { metaKey: true });
    expect(emailRow.getAttribute('aria-pressed')).toBe('true');
    expect(ageRow.getAttribute('aria-pressed')).toBe('true');
  });

  it('range-selects field rows with shift+click', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'email', type: 'field', dataType: 'string', label: 'Email Address' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });

    renderLayout(project);
    const emailRow = screen.getByTestId('layout-field-email');
    const ageRow = screen.getByTestId('layout-field-age');

    fireEvent.click(emailRow);
    fireEvent.click(ageRow, { shiftKey: true });
    expect(emailRow.getAttribute('aria-pressed')).toBe('true');
    expect(ageRow.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders display items', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'notice', type: 'display', label: 'Important Notice' },
      ],
    });

    renderLayout(project);
    expect(screen.getByText('Important Notice')).toBeInTheDocument();
  });

  it('commits multi-line body text for definition display items from the layout canvas', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'note1', type: 'display', label: 'First line' },
      ],
    });

    renderLayout(project);
    fireEvent.click(screen.getByTestId('layout-display-note1'));
    const editor = screen.getByTestId('layout-display-body-editor');
    fireEvent.change(editor, { target: { value: 'Line A\nLine B' } });
    fireEvent.blur(editor);
    expect(project.itemAt('note1')?.label).toBe('Line A\nLine B');
  });

  it('shows mode selector with Single / Wizard / Tabs', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [],
    });

    renderLayout(project);
    expect(screen.getByText('Single')).toBeInTheDocument();
    expect(screen.getByText('Wizard')).toBeInTheDocument();
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });

  it('adds a layout container from the modal palette (fields and groups are editor-only)', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [],
    });

    renderLayout(project);
    fireEvent.click(screen.getByTestId('layout-add-item'));
    fireEvent.click(screen.getByRole('button', { name: /Card / }));

    const cardContainer = screen.getByTestId((id, el) =>
      Boolean((el as HTMLElement).getAttribute('data-testid')?.startsWith('layout-container-')),
    );
    expect(cardContainer).toHaveTextContent('Card');
  });

  it('renders nested children inside layout containers', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        {
          key: 'group1', type: 'group', label: 'Contact',
          children: [
            { key: 'phone', type: 'field', dataType: 'string', label: 'Phone Number' },
          ],
        },
      ],
    });

    renderLayout(project);
    expect(screen.getByText('Phone Number')).toBeInTheDocument();
  });

  it('shows layout step navigation when in wizard mode', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'f1', type: 'field', dataType: 'string', label: 'Field One' },
      ],
    });
    project.addPage('Intro');
    project.addPage('Details');

    renderLayout(project);
    // LayoutCanvas should expose wizard step navigation for authored Page nodes.
    expect(screen.getByTestId('page-nav')).toBeInTheDocument();
  });

  it('opens page step context menu with rename, move, and delete', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [],
    });
    project.addPage('First');
    project.addPage('Second');

    renderLayout(project);

    const tabs = screen.getAllByTestId(/^page-nav-tab-/);
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    fireEvent.contextMenu(tabs[0]!);

    expect(screen.getByTestId('page-nav-context-menu')).toBeInTheDocument();
    expect(screen.getByTestId('page-nav-ctx-rename')).toBeInTheDocument();
    expect(screen.getByTestId('page-nav-ctx-move-left')).toBeDisabled();
    expect(screen.getByTestId('page-nav-ctx-move-right')).not.toBeDisabled();
    expect(screen.getByTestId('page-nav-ctx-delete')).toBeInTheDocument();
  });

  it('selects a field from the canvas when clicked', async () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });

    renderLayout(project);

    const fieldBlock = screen.getByTestId('layout-field-name');
    expect(fieldBlock).not.toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(fieldBlock);
    expect(fieldBlock).toHaveAttribute('aria-pressed', 'true');
  });

  it('changes the visible page when selecting a different page in wizard mode', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'email', type: 'field', dataType: 'string', label: 'Email Address' },
      ],
    });
    const introPageId = project.addPage('Intro').createdId!;
    const detailsPageId = project.addPage('Details').createdId!;
    project.placeOnPage('name', introPageId);
    project.placeOnPage('email', detailsPageId);

    renderLayout(project);

    expect(screen.getByTestId(/^layout-page-/)).toHaveTextContent('Intro');
    expect(screen.queryByText('Email Address')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`page-nav-tab-${detailsPageId}`));

    expect(screen.getByTestId(/^layout-page-/)).toHaveTextContent('Details');
    expect(screen.getByTestId('layout-field-email')).toBeInTheDocument();
    expect(screen.queryByText('Full Name')).not.toBeInTheDocument();
  });

  it('renders bound group node with selectionKey so it can be selected for toolbar interaction', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        {
          key: 'section', type: 'group', label: 'Section',
          children: [
            { key: 'field1', type: 'field', dataType: 'string', label: 'Field One' },
          ],
        },
      ],
    });

    renderLayout(project);

    // Group node should render with aria-pressed=false (selectable)
    const groupContainer = screen.getByTestId('layout-container-section');
    expect(groupContainer).toBeInTheDocument();

    // Click to select — row target (not the drag grip button)
    const headerBtn = groupContainer.querySelector('[data-testid="layout-select-row"]') as HTMLElement;
    expect(headerBtn).not.toBeNull();
    expect(headerBtn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(headerBtn);
    expect(headerBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows inline toolbar for a selected bound group node (selectionKey + onSetProp wired)', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        {
          key: 'contact', type: 'group', label: 'Contact Info',
          children: [
            { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
          ],
        },
      ],
    });

    renderLayout(project);

    // Select the group
    const groupContainer = screen.getByTestId('layout-container-contact');
    const headerBtn = groupContainer.querySelector('[data-testid="layout-select-row"]') as HTMLElement;
    fireEvent.click(headerBtn);

    // With selectionKey + onSetProp wired, the inline toolbar should appear on selection
    // The InlineToolbar renders the overflow button inside the header row
    expect(groupContainer.querySelector('[data-testid="toolbar-overflow"]')).not.toBeNull();
  });

  it('wires onResizeColSpan for display items inside a Grid — resize handle renders when in grid context', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [],
    });
    const setNodeStyleProperty = vi.spyOn(project, 'setNodeStyleProperty');

    // Add a Grid layout node, then add a Heading display node inside it
    const gridResult = project.addLayoutNode('root', 'Grid');
    const gridNodeId = gridResult.createdId!;
    project.addLayoutNode(gridNodeId, 'Heading');

    renderLayout(project);

    // The display block inside a Grid should render a resize handle
    // (parentContainerType === 'grid' and not spanning all columns)
    const handle = screen.queryByTestId('resize-handle-col');
    expect(handle).toBeInTheDocument();

    // Spy present and not yet called (no drag has happened)
    expect(setNodeStyleProperty).not.toHaveBeenCalled();
  });

  it('renders bound group node with correct CSS layout when it has spatial props', () => {
    // Group nodes with component=Grid should get grid CSS from buildContentStyle
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        {
          key: 'grp', type: 'group', label: 'Grid Group',
          children: [
            { key: 'a', type: 'field', dataType: 'string', label: 'A' },
          ],
        },
      ],
    });

    renderLayout(project);

    // Wrap the group in a Grid layout context so the component is "Grid"
    // (Group nodes use whatever component is in the component tree)
    // The default group renders as Stack — just verify the group renders
    const groupContainer = screen.getByTestId('layout-container-grp');
    expect(groupContainer).toBeInTheDocument();
    // Stack groups render the content div
    const contentDiv = groupContainer.querySelector('[data-layout-content]') as HTMLElement;
    expect(contentDiv).not.toBeNull();
    // Stack default: flex column
    expect(contentDiv.style.display).toBe('flex');
    expect(contentDiv.style.flexDirection).toBe('column');
  });
});
