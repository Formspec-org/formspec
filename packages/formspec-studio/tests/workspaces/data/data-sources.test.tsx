import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { DataSources } from '../../../src/workspaces/editor/DataSources';

const dataDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [],
  instances: {
    counties: { source: 'https://api.example.com/counties' },
    states: { source: 'https://api.example.com/states', static: true },
  },
};

function renderDS(def?: any) {
  const project = createProject({ seed: { definition: def || dataDef } });
  const addInstanceSpy = vi.spyOn(project, 'addInstance');
  const updateInstanceSpy = vi.spyOn(project, 'updateInstance');
  const removeInstanceSpy = vi.spyOn(project, 'removeInstance');
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <DataSources />
        </SelectionProvider>
      </ProjectProvider>
    ),
    addInstanceSpy,
    updateInstanceSpy,
    removeInstanceSpy,
  };
}

describe('DataSources', () => {
  it('renders instance names from definition', () => {
    renderDS();
    expect(screen.getByTestId('instance-counties')).toBeInTheDocument();
    expect(screen.getByTestId('instance-states')).toBeInTheDocument();
    expect(screen.getByText('counties')).toBeInTheDocument();
    expect(screen.getByText('states')).toBeInTheDocument();
  });

  it('shows source URL in collapsed view', () => {
    renderDS();
    expect(screen.getByText('https://api.example.com/counties')).toBeInTheDocument();
  });

  it('shows empty state with guidance when no instances', () => {
    renderDS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    expect(screen.getByText(/no external sources/i)).toBeInTheDocument();
    // Should explain what instances are and how to reference them
    expect(screen.getByText(/@instance/)).toBeInTheDocument();
  });

  // --- Inline add flow (replaces window.prompt) ---

  it('clicking + Add Source reveals an inline form with name input', () => {
    renderDS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));
    expect(screen.getByPlaceholderText(/patient_record/)).toBeInTheDocument();
  });

  it('inline add form shows examples of valid names', () => {
    renderDS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));
    // Should show example names so the user isn't guessing
    expect(screen.getByText(/e\.g\./i)).toBeInTheDocument();
  });

  it('pressing Enter in name input calls project.addInstance and auto-expands', async () => {
    const { addInstanceSpy } = renderDS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));

    const input = screen.getByPlaceholderText(/patient_record/);
    fireEvent.change(input, { target: { value: 'my_api' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(addInstanceSpy).toHaveBeenCalledWith('my_api', {});
  });

  it('Escape cancels the add flow', () => {
    renderDS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));
    const input = screen.getByPlaceholderText(/patient_record/);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/patient_record/)).not.toBeInTheDocument();
  });

  it('name input strips non-alphanumeric characters (except underscores)', () => {
    renderDS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    fireEvent.click(screen.getByRole('button', { name: /add source/i }));
    const input = screen.getByPlaceholderText(/patient_record/);
    fireEvent.change(input, { target: { value: 'my source!!!' } });
    expect(input).toHaveValue('my_source');
  });

  // --- Expanded editor ---

  it('expanded card shows source field with placeholder example', async () => {
    renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });
    // Source field shows the value via InlineExpression (syntax-highlighted, found by title)
    expect(screen.getByTitle('https://api.example.com/counties')).toBeInTheDocument();
  });

  it('expanded card shows description textarea', async () => {
    renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });
    expect(screen.getByPlaceholderText(/what this data source provides/i)).toBeInTheDocument();
  });

  it('expanded card shows FEL usage hint with the instance name', async () => {
    renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });
    // Should show how to reference this instance in FEL (appears in usage hint + data requirements)
    expect(screen.getAllByText(/@instance\('counties'\)/).length).toBeGreaterThanOrEqual(1);
  });

  it('edit source calls project.updateInstance with source property', async () => {
    const { updateInstanceSpy } = renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });

    // Click the InlineExpression source value to enter edit mode
    fireEvent.click(screen.getByTitle('https://api.example.com/counties'));
    // The InlineExpression renders a textarea; the description field is also a textbox,
    // so target the one with the source URL value.
    const textareas = screen.getAllByRole('textbox');
    const sourceTextarea = textareas.find(el => (el as HTMLTextAreaElement).value === 'https://api.example.com/counties')!;
    fireEvent.change(sourceTextarea, { target: { value: 'https://new-api.com/counties' } });
    fireEvent.keyDown(sourceTextarea, { key: 'Enter', metaKey: true });

    expect(updateInstanceSpy).toHaveBeenCalledWith('counties', { source: 'https://new-api.com/counties' });
  });

  it('edit description calls project.updateInstance with description property', async () => {
    const { updateInstanceSpy } = renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });

    const desc = screen.getByPlaceholderText(/what this data source provides/i);
    fireEvent.change(desc, { target: { value: 'County lookup data' } });
    fireEvent.blur(desc);

    expect(updateInstanceSpy).toHaveBeenCalledWith('counties', { description: 'County lookup data' });
  });

  it('delete calls project.removeInstance', async () => {
    const { removeInstanceSpy } = renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });

    await act(async () => {
      screen.getByRole('button', { name: /delete data source/i }).click();
    });

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      within(dialog).getByRole('button', { name: /delete/i }).click();
    });

    expect(removeInstanceSpy).toHaveBeenCalledWith('counties');
  });

  it('static checkbox calls project.updateInstance with static property', async () => {
    const { updateInstanceSpy } = renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });

    const checkbox = screen.getByRole('checkbox', { name: /static/i });
    fireEvent.click(checkbox);

    expect(updateInstanceSpy).toHaveBeenCalledWith('counties', { static: true });
  });

  it('expanded card shows data format requirements', async () => {
    renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });
    expect(screen.getByTestId('data-format-info')).toBeInTheDocument();
    expect(screen.getByText(/response must be json/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one of source or inline data/i)).toBeInTheDocument();
  });

  // --- Inline data editor ---

  it('expanded card shows inline data JSON editor', async () => {
    renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });
    expect(screen.getByTestId('inline-data-editor')).toBeInTheDocument();
  });

  it('inline data editor shows existing data as formatted JSON', async () => {
    renderDS({
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
      instances: {
        config: { data: { maxRetries: 3, region: 'us-east' } },
      },
    });
    const card = screen.getByTestId('instance-config');
    await act(async () => {
      fireEvent.click(within(card).getByText('config'));
    });
    const editor = screen.getByTestId('inline-data-editor');
    const textarea = within(editor).getByRole('textbox');
    // Should show the data formatted as JSON
    expect(textarea).toHaveValue(JSON.stringify({ maxRetries: 3, region: 'us-east' }, null, 2));
  });

  it('pasting valid JSON into data editor calls project.updateInstance', async () => {
    const { updateInstanceSpy } = renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });
    const editor = screen.getByTestId('inline-data-editor');
    const textarea = within(editor).getByRole('textbox');
    const json = JSON.stringify([{ code: 'US', name: 'United States' }], null, 2);
    fireEvent.change(textarea, { target: { value: json } });
    fireEvent.blur(textarea);

    expect(updateInstanceSpy).toHaveBeenCalledWith('counties', { data: [{ code: 'US', name: 'United States' }] });
  });

  it('invalid JSON shows error message without calling updateInstance for data', async () => {
    const { updateInstanceSpy } = renderDS();
    const card = screen.getByTestId('instance-counties');
    await act(async () => {
      fireEvent.click(within(card).getByText('counties'));
    });
    const editor = screen.getByTestId('inline-data-editor');
    const textarea = within(editor).getByRole('textbox');
    updateInstanceSpy.mockClear();
    fireEvent.change(textarea, { target: { value: '{ not valid json' } });
    fireEvent.blur(textarea);

    expect(screen.getByText(/invalid json/i)).toBeInTheDocument();
    // Should not have called updateInstance for 'data'
    const dataCalls = updateInstanceSpy.mock.calls.filter(
      ([name, changes]: any) => changes?.data !== undefined
    );
    expect(dataCalls).toHaveLength(0);
  });

  it('shows inline data badge when instance has data but no source', () => {
    renderDS({
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
      instances: {
        config: { data: { maxRetries: 3 }, readonly: true },
      },
    });
    expect(screen.getByText(/inline data/i)).toBeInTheDocument();
  });
});
