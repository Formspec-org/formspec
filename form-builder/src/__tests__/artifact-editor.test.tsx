import { render, within, fireEvent, cleanup, act } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { project } from '../state/project';
import { toasts } from '../state/toast';
import { resetArtifactEditorState } from '../components/artifact-editor';

beforeEach(() => {
  project.value = {
    definition: null,
    component: null,
    theme: null,
    mapping: null,
    registry: null,
    changelog: null,
  };
  toasts.value = [];
  resetArtifactEditorState();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ArtifactEditor', () => {
  it('renders textarea with current artifact JSON', async () => {
    const data = { $formspecComponent: '1.0', version: '1.0.0', tree: [] };
    project.value = { ...project.value, component: data };

    const { ArtifactEditor } = await import('../components/artifact-editor');
    const { container } = render(<ArtifactEditor kind="component" />);

    const textarea = within(container).getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(JSON.stringify(data, null, 2));
  });

  it('renders empty textarea when artifact has no data', async () => {
    const { ArtifactEditor } = await import('../components/artifact-editor');
    const { container } = render(<ArtifactEditor kind="theme" />);

    const textarea = within(container).getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('Apply Changes parses and updates project', async () => {
    const initial = { $formspecTheme: '1.0', version: '1.0.0', tokens: {} };
    project.value = { ...project.value, theme: initial };

    const { ArtifactEditor } = await import('../components/artifact-editor');
    const { container } = render(<ArtifactEditor kind="theme" />);

    const updated = { $formspecTheme: '1.0', version: '2.0.0', tokens: { color: 'red' } };
    const textarea = within(container).getByRole('textbox') as HTMLTextAreaElement;

    // Directly set the textarea value and fire the input event
    await act(async () => {
      textarea.value = JSON.stringify(updated);
      fireEvent.input(textarea);
    });

    await act(async () => {
      within(container).getByText('Apply Changes').click();
    });

    expect(project.value.theme).toEqual(updated);
  });

  it('shows error status on invalid JSON', async () => {
    const data = { $formspecComponent: '1.0', version: '1.0.0', tree: [] };
    project.value = { ...project.value, component: data };

    const { ArtifactEditor } = await import('../components/artifact-editor');
    const { container } = render(<ArtifactEditor kind="component" />);

    const textarea = within(container).getByRole('textbox') as HTMLTextAreaElement;

    await act(async () => {
      textarea.value = 'not valid json{{{';
      fireEvent.input(textarea);
    });

    await act(async () => {
      within(container).getByText('Apply Changes').click();
    });

    const statusSpan = container.querySelector('.json-editor-status.error');
    expect(statusSpan).not.toBeNull();
    // Project should be unchanged
    expect(project.value.component).toEqual(data);
  });

  it('Revert restores original value from project', async () => {
    const data = { $formspecMapping: '1.0', version: '1.0.0', rules: [] };
    project.value = { ...project.value, mapping: data };

    const { ArtifactEditor } = await import('../components/artifact-editor');
    const { container } = render(<ArtifactEditor kind="mapping" />);

    const textarea = within(container).getByRole('textbox') as HTMLTextAreaElement;

    // Enter some garbage text
    await act(async () => {
      textarea.value = 'garbage';
      fireEvent.input(textarea);
    });

    // Click Revert
    await act(async () => {
      within(container).getByText('Revert').click();
    });

    // After revert, textarea should show original project data
    const updatedTextarea = within(container).getByRole('textbox') as HTMLTextAreaElement;
    expect(updatedTextarea.value).toBe(JSON.stringify(data, null, 2));
  });

  it('Remove sets artifact to null', async () => {
    const data = { $formspecRegistry: '1.0', version: '1.0.0', extensions: [] };
    project.value = { ...project.value, registry: data };

    const { ArtifactEditor } = await import('../components/artifact-editor');
    const { container } = render(<ArtifactEditor kind="registry" />);

    await act(async () => {
      within(container).getByText('Remove').click();
    });

    expect(project.value.registry).toBeNull();
  });

  it('Remove shows an info toast', async () => {
    const data = { $formspecChangelog: '1.0', version: '1.0.0', changes: [] };
    project.value = { ...project.value, changelog: data };

    const { ArtifactEditor } = await import('../components/artifact-editor');
    const { container } = render(<ArtifactEditor kind="changelog" />);

    await act(async () => {
      within(container).getByText('Remove').click();
    });

    expect(toasts.value.length).toBeGreaterThan(0);
    expect(toasts.value[0].type).toBe('info');
  });
});
