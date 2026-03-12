import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PageTabs } from '../../../src/workspaces/editor/PageTabs';

const multiPageDef = {
  $formspec: '1.0',
  url: 'urn:test',
  version: '1.0.0',
  title: 'Test',
  items: [
    { key: 'page1', type: 'group', label: 'Personal Info', children: [
      { key: 'name', type: 'field', dataType: 'string' },
    ]},
    { key: 'page2', type: 'group', label: 'Address', children: [
      { key: 'street', type: 'field', dataType: 'string' },
    ]},
    { key: 'page3', type: 'group', label: 'Review', children: [] },
  ],
  presentation: { pageMode: 'wizard' },
};

function renderPageTabs(def?: any) {
  const project = createProject({ seed: { definition: def || multiPageDef } });
  const onPageChange = vi.fn();
  return {
    ...render(
      <ProjectProvider project={project}>
        <PageTabs activePage={0} onPageChange={onPageChange} />
      </ProjectProvider>
    ),
    onPageChange,
    project,
  };
}

describe('PageTabs', () => {
  it('renders page labels from definition', () => {
    renderPageTabs();
    // Active tab renders label as text; inactive tabs expose label via title attribute
    expect(screen.getByText('Personal Info')).toBeInTheDocument();
    expect(screen.getByTitle('Address')).toBeInTheDocument();
    expect(screen.getByTitle('Review')).toBeInTheDocument();
  });

  it('highlights active page', () => {
    renderPageTabs();
    const tab = screen.getByText('Personal Info').closest('button');
    expect(tab?.getAttribute('aria-selected')).toBe('true');
  });

  it('clicking a tab calls onPageChange', async () => {
    const { onPageChange } = renderPageTabs();
    await act(async () => {
      screen.getByTitle('Address').click();
    });
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('shows page numbers', () => {
    renderPageTabs();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('handles single-page forms gracefully', () => {
    const singlePage = {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0',
      items: [{ key: 'name', type: 'field', dataType: 'string' }],
    };
    renderPageTabs(singlePage);
    // Should render even with flat items (no wizard pages)
    expect(screen.queryByRole('tablist')).toBeInTheDocument();
  });
});
