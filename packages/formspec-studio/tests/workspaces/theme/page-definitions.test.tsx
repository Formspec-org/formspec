import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PageDefinitions } from '../../../src/workspaces/theme/PageDefinitions';

function renderPages(pages?: unknown[]) {
  const project = createProject({
    seed: {
      definition: {
        $formspec: '1.0', url: 'urn:test', version: '1.0.0',
        items: [
          { key: 'name', type: 'field', dataType: 'string' },
          { key: 'age', type: 'field', dataType: 'integer' },
        ],
      } as any,
      theme: { pages },
    },
  });
  return {
    ...render(
      <ProjectProvider project={project}>
        <PageDefinitions />
      </ProjectProvider>
    ),
    project,
  };
}

describe('PageDefinitions', () => {
  it('renders pages with title', () => {
    renderPages([{ id: 'intro', title: 'Introduction', regions: [{ key: 'name', span: 12 }] }]);
    expect(screen.getByText('Introduction')).toBeInTheDocument();
  });

  it('empty state', () => {
    renderPages([]);
    expect(screen.getByText(/no pages/i)).toBeInTheDocument();
  });

  it('add page creates a page', async () => {
    const { project } = renderPages([]);
    await act(async () => {
      screen.getByRole('button', { name: /\+ new page/i }).click();
    });
    const pages = (project.export().theme as any).pages;
    expect(pages.length).toBeGreaterThanOrEqual(1);
  });

  it('edit title updates page property', async () => {
    const { project } = renderPages([{ id: 'p1', title: 'Page One', regions: [] }]);
    // Expand page
    await act(async () => { screen.getByText('Page One').click(); });
    const titleInput = screen.getByDisplayValue('Page One');
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
      fireEvent.blur(titleInput);
    });
    expect((project.export().theme as any).pages[0].title).toBe('Updated Title');
  });

  it('delete page removes the page', async () => {
    const { project } = renderPages([
      { id: 'p1', title: 'First', regions: [] },
      { id: 'p2', title: 'Second', regions: [] },
    ]);
    await act(async () => { screen.getByText('First').click(); });
    await act(async () => {
      screen.getByRole('button', { name: /delete page/i }).click();
    });
    expect((project.export().theme as any).pages).toHaveLength(1);
  });

  it('reorder page swaps page positions', async () => {
    const { project } = renderPages([
      { id: 'p1', title: 'First', regions: [] },
      { id: 'p2', title: 'Second', regions: [] },
    ]);
    await act(async () => { screen.getByText('Second').click(); });
    await act(async () => {
      screen.getByRole('button', { name: /move page up/i }).click();
    });
    expect((project.export().theme as any).pages[0].id).toBe('p2');
  });

  it('add region creates a region', async () => {
    const { project } = renderPages([{ id: 'p1', title: 'Page', regions: [] }]);
    await act(async () => { screen.getByText('Page').click(); });
    await act(async () => {
      screen.getByRole('button', { name: /\+ add region/i }).click();
    });
    expect((project.export().theme as any).pages[0].regions).toHaveLength(1);
  });

  it('edit region span updates region property', async () => {
    const { project } = renderPages([{ id: 'p1', title: 'Page', regions: [{ key: 'name', span: 12 }] }]);
    await act(async () => { screen.getByText('Page').click(); });
    const spanInput = screen.getByDisplayValue('12');
    await act(async () => {
      fireEvent.change(spanInput, { target: { value: '6' } });
      fireEvent.blur(spanInput);
    });
    expect((project.export().theme as any).pages[0].regions[0].span).toBe(6);
  });

  it('delete region removes the region', async () => {
    const { project } = renderPages([
      { id: 'p1', title: 'Page', regions: [{ key: 'name', span: 12 }, { key: 'age', span: 6 }] },
    ]);
    await act(async () => { screen.getByText('Page').click(); });
    const deleteBtns = screen.getAllByRole('button', { name: /delete region/i });
    await act(async () => { deleteBtns[0].click(); });
    expect((project.export().theme as any).pages[0].regions).toHaveLength(1);
  });

  it('reorder region swaps region positions', async () => {
    const { project } = renderPages([
      { id: 'p1', title: 'Page', regions: [{ key: 'name', span: 6 }, { key: 'age', span: 6 }] },
    ]);
    await act(async () => { screen.getByText('Page').click(); });
    const moveBtns = screen.getAllByRole('button', { name: /move region down/i });
    await act(async () => { moveBtns[0].click(); });
    expect((project.export().theme as any).pages[0].regions[0].key).toBe('age');
  });
});
