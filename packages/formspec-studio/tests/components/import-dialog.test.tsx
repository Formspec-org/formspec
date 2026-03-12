import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { ImportDialog } from '../../src/components/ImportDialog';

describe('ImportDialog', () => {
  it('shows import instructions when open', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={vi.fn()} />
      </ProjectProvider>
    );
    expect(screen.getByText(/import/i)).toBeInTheDocument();
  });

  it('shows artifact type options', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={vi.fn()} />
      </ProjectProvider>
    );
    expect(screen.getByText(/definition/i)).toBeInTheDocument();
    expect(screen.getByText(/component/i)).toBeInTheDocument();
    expect(screen.getByText(/theme/i)).toBeInTheDocument();
    expect(screen.getByText(/mapping/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={false} onClose={vi.fn()} />
      </ProjectProvider>
    );
    expect(screen.queryByText(/import/i)).not.toBeInTheDocument();
  });

  it('resets JSON content and artifact type when reopened', async () => {
    const project = createProject();
    const onClose = vi.fn();
    const view = render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={onClose} />
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: /mapping/i }).click();
    });

    const textarea = screen.getByPlaceholderText(/paste mapping json here/i);
    await act(async () => {
      (textarea as HTMLTextAreaElement).value = '{"bad": true}';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    view.rerender(
      <ProjectProvider project={project}>
        <ImportDialog open={false} onClose={onClose} />
      </ProjectProvider>
    );
    view.rerender(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={onClose} />
      </ProjectProvider>
    );

    expect(screen.getByPlaceholderText(/paste definition json here/i)).toHaveValue('');
  });

  it('renders as a modal dialog for assistive technology', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={vi.fn()} />
      </ProjectProvider>
    );
    expect(screen.getByRole('dialog', { name: /import/i })).toHaveAttribute('aria-modal', 'true');
  });

  it('disables Load when the JSON is syntactically invalid', async () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={vi.fn()} />
      </ProjectProvider>
    );

    const textarea = screen.getByPlaceholderText(/paste definition json here/i);
    await act(async () => {
      (textarea as HTMLTextAreaElement).value = '{"broken":';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(screen.getByRole('button', { name: /load/i })).toBeDisabled();
  });

  // Bug #18: Importing a definition via the Import dialog should NOT clear the
  // existing undo history. Users expect to be able to undo the import just as
  // they can undo any other edit. Currently project.import dispatches
  // `project.import` which returns `clearHistory: true`, wiping the undo stack.
  it('preserves undo history after importing a definition', async () => {
    const project = createProject();

    // Make an edit so there is something on the undo stack.
    project.dispatch({
      type: 'definition.addItem',
      payload: { key: 'beforeImport', type: 'field', dataType: 'string', label: 'Before Import' },
    });
    expect(project.canUndo).toBe(true);

    const onClose = vi.fn();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={onClose} />
      </ProjectProvider>
    );

    const textarea = screen.getByPlaceholderText(/paste definition json here/i);
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            $formspec: '1.0',
            url: 'urn:imported',
            version: '1.0.0',
            items: [],
          }),
        },
      });
    });

    await act(async () => {
      screen.getByRole('button', { name: /load/i }).click();
    });

    // After import the undo button should still be enabled because pre-import
    // edits remain on the stack.
    expect(project.canUndo).toBe(true);
  });

  // Bug #21: Pressing Escape while the Import dialog is open should close it.
  // Currently the ImportDialog has no keydown listener for Escape, so the dialog
  // stays open even after the key is pressed.
  it('closes the dialog when Escape is pressed', async () => {
    const project = createProject();
    const onClose = vi.fn();
    render(
      <ProjectProvider project={project}>
        <ImportDialog open={true} onClose={onClose} />
      </ProjectProvider>
    );

    // The dialog content should be visible before pressing Escape.
    expect(screen.getByTestId('import-dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });

    // onClose should have been called — if it wasn't, the dialog ignores Escape.
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
