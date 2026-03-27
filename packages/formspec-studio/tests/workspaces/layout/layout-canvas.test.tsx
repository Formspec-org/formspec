/** @filedesc Tests for the Layout workspace canvas — page sections, layout containers, mode selector. */
import { render, screen, act } from '@testing-library/react';
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
  it('renders Page nodes as titled sections', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });
    project.addPage('Step 1');

    renderLayout(project);
    // Page section has the title inside its titled header area
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

  it('shows page navigation when in wizard mode', () => {
    const project = makeProject({
      $formspec: '1.0', url: 'urn:layout-test', version: '1.0.0',
      items: [
        { key: 'f1', type: 'field', dataType: 'string', label: 'Field One' },
      ],
    });
    project.addPage('Intro');
    project.addPage('Details');

    renderLayout(project);
    // PageNav should render page titles as navigation elements
    expect(screen.getByTestId('page-nav')).toBeInTheDocument();
  });
});
