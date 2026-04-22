import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { OptionSets } from '../../../src/workspaces/editor/OptionSets';

const dataDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'color', type: 'field', dataType: 'select1', optionSet: 'colors' },
  ],
  optionSets: {
    colors: { options: [
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue' },
    ]},
  },
};

function renderOS(def?: any) {
  const project = createProject({ seed: { definition: def || dataDef } });
  const defineChoicesSpy = vi.spyOn(project, 'defineChoices');
  const updateOptionSetSpy = vi.spyOn(project, 'updateOptionSet');
  const deleteOptionSetSpy = vi.spyOn(project, 'deleteOptionSet');
  return {
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <OptionSets />
        </SelectionProvider>
      </ProjectProvider>
    ),
    defineChoicesSpy,
    updateOptionSetSpy,
    deleteOptionSetSpy,
  };
}

describe('OptionSets', () => {
  it('renders option set names', () => {
    renderOS();
    expect(screen.getByText('colors')).toBeInTheDocument();
  });

  it('shows option count in collapsed view', () => {
    renderOS();
    expect(screen.getByText(/2 options/i)).toBeInTheDocument();
  });

  it('shows usage count', () => {
    renderOS();
    expect(screen.getByText(/1 ref/i)).toBeInTheDocument();
  });

  it('data-testid present on cards', () => {
    renderOS();
    expect(screen.getByTestId('option-set-colors')).toBeInTheDocument();
  });

  // --- Inline add flow ---

  it('clicking + New Table reveals an inline form with name input', () => {
    renderOS();
    fireEvent.click(screen.getByRole('button', { name: /new table/i }));
    expect(screen.getByPlaceholderText(/state_codes/)).toBeInTheDocument();
  });

  it('inline add form shows example names', () => {
    renderOS();
    fireEvent.click(screen.getByRole('button', { name: /new table/i }));
    expect(screen.getByText(/e\.g\./i)).toBeInTheDocument();
  });

  it('pressing Enter calls project.defineChoices and auto-expands', () => {
    const { defineChoicesSpy } = renderOS();
    fireEvent.click(screen.getByRole('button', { name: /new table/i }));
    const input = screen.getByPlaceholderText(/state_codes/);
    fireEvent.change(input, { target: { value: 'sizes' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(defineChoicesSpy).toHaveBeenCalledWith('sizes', []);
  });

  it('Escape cancels the add flow', () => {
    renderOS();
    fireEvent.click(screen.getByRole('button', { name: /new table/i }));
    fireEvent.keyDown(screen.getByPlaceholderText(/state_codes/), { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/state_codes/)).not.toBeInTheDocument();
  });

  it('name input strips non-alphanumeric characters', () => {
    renderOS();
    fireEvent.click(screen.getByRole('button', { name: /new table/i }));
    const input = screen.getByPlaceholderText(/state_codes/);
    fireEvent.change(input, { target: { value: 'my set!' } });
    expect(input).toHaveValue('my_set');
  });

  // --- Empty state ---

  it('empty state explains what option sets are', () => {
    renderOS({ $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] });
    expect(screen.getByText(/no lookup tables/i)).toBeInTheDocument();
    expect(screen.getByText(/optionSet/)).toBeInTheDocument();
  });

  // --- Expanded editor ---

  it('expanded card shows how fields reference this option set', async () => {
    renderOS();
    const card = screen.getByTestId('option-set-colors');
    await act(async () => {
      fireEvent.click(within(card).getByText('colors'));
    });
    // Should show the optionSet reference syntax
    expect(screen.getByText(/"optionSet": "colors"/)).toBeInTheDocument();
  });

  it('edit option value calls project.updateOptionSet', async () => {
    const { updateOptionSetSpy } = renderOS();
    const card = screen.getByTestId('option-set-colors');
    await act(async () => {
      fireEvent.click(within(card).getByText('colors'));
    });

    const valueInputs = screen.getAllByDisplayValue('red');
    fireEvent.change(valueInputs[0], { target: { value: 'crimson' } });
    fireEvent.blur(valueInputs[0]);

    expect(updateOptionSetSpy).toHaveBeenCalledWith(
      'colors',
      'options',
      expect.any(Array),
    );
  });

  it('delete calls project.deleteOptionSet', async () => {
    const { deleteOptionSetSpy } = renderOS();
    const card = screen.getByTestId('option-set-colors');
    await act(async () => {
      fireEvent.click(within(card).getByText('colors'));
    });

    await act(async () => {
      screen.getByRole('button', { name: /delete table/i }).click();
    });

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      within(dialog).getByRole('button', { name: /delete/i }).click();
    });

    expect(deleteOptionSetSpy).toHaveBeenCalledWith('colors');
  });

  it('remote source editing via InlineExpression calls project.updateOptionSet', async () => {
    const remoteDef = {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0',
      items: [],
      optionSets: {
        countries: { source: 'https://api.example.com/countries' },
      },
    };
    const { updateOptionSetSpy } = renderOS(remoteDef);
    const card = screen.getByTestId('option-set-countries');
    await act(async () => {
      fireEvent.click(within(card).getByText('countries'));
    });

    fireEvent.click(screen.getByTitle('https://api.example.com/countries'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'https://new-api.com/countries' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    expect(updateOptionSetSpy).toHaveBeenCalledWith('countries', 'source', 'https://new-api.com/countries');
  });
});
