import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FELEditor } from '../../../src/components/ui/FELEditor';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { createProject } from 'formspec-studio-core';

// Mock scrollHeight for autoResize
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 50 });

const mockDefinition = {
  $formspec: '1.0',
  url: 'urn:test',
  version: '1.0.0',
  title: 'Test',
  items: [
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
  ],
};

function renderEditor(props: any) {
  const project = createProject({ seed: { definition: mockDefinition as any } });
  return render(
    <ProjectProvider project={project}>
      <FELEditor {...props} />
    </ProjectProvider>
  );
}

describe('FELEditor', () => {
  it('renders with initial value', () => {
    renderEditor({ value: '1 + 2', onSave: vi.fn() });
    expect(screen.getByRole('textbox')).toHaveValue('1 + 2');
  });

  it('shows syntax highlighting tokens', () => {
    renderEditor({ value: 'sum($age)', onSave: vi.fn() });
    // The highlight overlay is present
    // We use a matcher function because syntax highlighting breaks text into spans
    expect(screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && content === 'sum';
    })).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && content === '$';
    })).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && content === 'age';
    })).toBeInTheDocument();
  });

  it('triggers autocomplete on $', async () => {
    renderEditor({ value: '', onSave: vi.fn() });
    const textarea = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '$', selectionStart: 1 } });
    });

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('$age')).toBeInTheDocument();
    expect(screen.getByText('$name')).toBeInTheDocument();
  });

  it('filters autocomplete options', async () => {
    renderEditor({ value: '', onSave: vi.fn() });
    const textarea = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '$ag', selectionStart: 3 } });
    });

    expect(screen.getByText('$age')).toBeInTheDocument();
    expect(screen.queryByText('$name')).not.toBeInTheDocument();
  });

  it('applies autocomplete option on click', async () => {
    const onSave = vi.fn();
    renderEditor({ value: '', onSave });
    const textarea = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '$', selectionStart: 1 } });
    });

    const option = screen.getByText('$age');
    await act(async () => {
      fireEvent.mouseDown(option);
    });

    expect(textarea).toHaveValue('$age');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('navigates options with arrow keys', async () => {
    renderEditor({ value: '', onSave: vi.fn() });
    const textarea = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '$', selectionStart: 1 } });
    });

    const options = screen.getAllByRole('listitem');
    expect(options[0].querySelector('div')?.parentElement).toHaveClass('bg-accent');

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    });

    expect(options[1].querySelector('div')?.parentElement).toHaveClass('bg-accent');
  });

  it('shows syntax error message as title on indicator', async () => {
    const { container } = renderEditor({ value: '1 + ', onSave: vi.fn() });
    const indicator = container.querySelector('.bg-error');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('title', expect.stringMatching(/line 1, column 1:/i));
  });

  it('selects option with Enter key', async () => {
    const onSave = vi.fn();
    renderEditor({ value: '', onSave });
    const textarea = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '$', selectionStart: 1 } });
    });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
    });

    expect(textarea).toHaveValue('$age');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('closes menu with Escape key', async () => {
    renderEditor({ value: '', onSave: vi.fn() });
    const textarea = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '$', selectionStart: 1 } });
    });

    expect(screen.getByRole('list')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Escape' });
    });

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  // TODO: update expected signatures after fel-catalog refactor
  it.skip('shows peek pane for focused function option', async () => {
    renderEditor({ value: '', onSave: vi.fn() });
    const textarea = screen.getByRole('textbox');

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'co', selectionStart: 2 } });
    });

    // Check for function in list
    const option = screen.getByText('coalesce');
    expect(option).toBeInTheDocument();

    // Peek pane shows signature (params part before ->) and description from engine
    expect(screen.getByText('coalesce(...any)')).toBeInTheDocument();
    expect(screen.getByText('Returns the first non-null argument.')).toBeInTheDocument();
  });
});
