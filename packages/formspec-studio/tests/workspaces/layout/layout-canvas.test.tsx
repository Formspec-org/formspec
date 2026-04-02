/** @filedesc Tests for the Layout workspace canvas — authored Page sections, layout containers, and mode selector. */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
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

  it('adds a layout container from the header toolbar', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [],
    });

    renderLayout(project);
    fireEvent.click(screen.getByTestId('layout-add-card'));

    expect(screen.getByText('Card')).toBeInTheDocument();
  });

  it('adds a new item from the layout palette', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [],
    });

    renderLayout(project);
    fireEvent.click(screen.getByTestId('layout-add-item'));
    fireEvent.click(screen.getByRole('button', { name: /^Text Short text/i }));

    expect(project.itemAt('text')?.type).toBe('field');
    expect(screen.getByTestId('layout-field-text')).toBeInTheDocument();
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

  it('selects a field from the canvas when clicked', async () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });

    renderLayout(project);

    const fieldBlock = screen.getByTestId('layout-field-name');
    expect(fieldBlock.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(fieldBlock);
    expect(fieldBlock.getAttribute('aria-pressed')).toBe('true');
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

    fireEvent.click(screen.getByRole('button', { name: /details/i }));

    expect(screen.getByTestId(/^layout-page-/)).toHaveTextContent('Details');
    expect(screen.getByTestId('layout-field-email')).toBeInTheDocument();
    expect(screen.queryByText('Full Name')).not.toBeInTheDocument();
  });
});
