import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FormspecRender } from '@formspec-org/webcomponent';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { PreviewTab } from '../../../src/workspaces/preview/PreviewTab';

if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

const previewDef = {
  $formspec: '1.0',
  url: 'urn:test',
  version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
    { key: 'bio', type: 'display', label: 'Biography' },
  ],
};

const calculatedPreviewDef = {
  $formspec: '1.0',
  url: 'urn:calculated-preview',
  version: '1.0.0',
  items: [
    { key: 'grossAnnualIncome', type: 'field', dataType: 'integer', label: 'Gross Annual Income' },
    { key: 'incomeSummary', type: 'field', dataType: 'string', label: 'Income Summary' },
  ],
  binds: {
    incomeSummary: { calculate: 'string($grossAnnualIncome)' },
  },
};

function renderPreview(seed?: Record<string, unknown>) {
  const project = createProject({ seed: { definition: previewDef as any, ...seed } });
  return render(
    <ProjectProvider project={project}>
      <PreviewTab />
    </ProjectProvider>
  );
}

describe('PreviewTab', () => {
  it('renders viewport switcher', () => {
    renderPreview();
    expect(screen.getByText(/desktop/i)).toBeInTheDocument();
    expect(screen.getByText(/tablet/i)).toBeInTheDocument();
    expect(screen.getByText(/mobile/i)).toBeInTheDocument();
  });

  it('shows behavior lab when Behavior mode is selected', () => {
    renderPreview();
    fireEvent.click(screen.getByTestId('preview-mode-behavior'));
    expect(screen.getByTestId('behavior-scenario-input')).toBeInTheDocument();
    expect(screen.getByText('Scenario JSON')).toBeInTheDocument();
    expect(screen.getByText('Behavior Snapshot')).toBeInTheDocument();
  });

  it('renders FormspecPreviewHost with formspec-render when definition has items', () => {
    renderPreview();
    const host = screen.getByTestId('formspec-preview-host');
    expect(host).toBeInTheDocument();
    const el = host.querySelector('formspec-render');
    expect(el).toBeTruthy();
  });

  it('passes Studio appearance to formspec-render so preview does not follow OS prefers-color-scheme alone', async () => {
    vi.useFakeTimers();
    const project = createProject({ seed: { definition: previewDef as any } });
    render(
      <ProjectProvider project={project}>
        <PreviewTab appearance="dark" />
      </ProjectProvider>,
    );
    await act(() => {
      vi.advanceTimersByTime(600);
    });
    const el = screen.getByTestId('formspec-preview-host').querySelector('formspec-render');
    expect(el?.getAttribute('data-formspec-appearance')).toBe('dark');
    vi.useRealTimers();
  });

  it('syncs definition to formspec-render after debounce and renders form content', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPreview();
    await act(() => {
      vi.advanceTimersByTime(600);
    });
    const host = screen.getByTestId('formspec-preview-host');
    const el = host.querySelector('formspec-render');
    expect(el).toBeTruthy();
    const text = el?.textContent ?? '';
    expect(text).toContain('Full Name');
    expect(text).toContain('Email');
    expect(text).toContain('Biography');
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported Component Document version'));
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('recalculates computed fields when the source field changes in preview', async () => {
    vi.useFakeTimers();
    renderPreview({ definition: calculatedPreviewDef as any });
    await act(() => {
      vi.advanceTimersByTime(600);
    });

    const source = screen.getByLabelText('Gross Annual Income');
    const target = screen.getByLabelText('Income Summary') as HTMLInputElement;

    await act(async () => {
      fireEvent.input(source, { target: { value: '60000' } });
      fireEvent.blur(source);
    });

    expect(target.value).toBe('60000');
    vi.useRealTimers();
  });
});
