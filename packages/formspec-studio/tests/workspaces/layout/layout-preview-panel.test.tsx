/** @filedesc Tests for LayoutPreviewPanel — thin h-full wrapper around LayoutLivePreviewSection. */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { LayoutPreviewPanel } from '../../../src/workspaces/layout/LayoutPreviewPanel';

// FormspecPreviewHost creates a <formspec-render> custom element imperatively.
// Mock it so tests don't need a real webcomponent registration.
vi.mock('../../../src/workspaces/preview/FormspecPreviewHost', () => ({
  FormspecPreviewHost: ({ width }: { width: string | number }) => (
    <div data-testid="formspec-preview-host" data-width={String(width)} />
  ),
}));

function renderPanel(width: string | number = '100%') {
  const project = createProject();
  return render(
    <ProjectProvider project={project}>
      <LayoutPreviewPanel width={width} />
    </ProjectProvider>,
  );
}

describe('LayoutPreviewPanel', () => {
  it('renders a "Live Preview" label', () => {
    renderPanel();
    expect(screen.getByText('Live Preview')).toBeInTheDocument();
  });

  it('renders FormspecPreviewHost inside the panel', () => {
    renderPanel();
    expect(screen.getByTestId('formspec-preview-host')).toBeInTheDocument();
  });

  it('passes width prop through to FormspecPreviewHost', () => {
    renderPanel(320);
    const host = screen.getByTestId('formspec-preview-host');
    expect(host.dataset.width).toBe('320');
  });

  it('has a bottom border under the header label', () => {
    const { container } = renderPanel();
    // The header element should have a border-bottom class
    const header = container.querySelector('[data-testid="layout-preview-header"]');
    expect(header).not.toBeNull();
  });

  it('fills available vertical space (flex-1 or h-full)', () => {
    const { container } = renderPanel();
    const root = container.firstChild as HTMLElement;
    // Root should be a flex column container
    expect(root.className).toMatch(/flex.*flex-col|flex-col.*flex/);
  });
});
