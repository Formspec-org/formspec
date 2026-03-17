import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { VariablesSection } from '../../../src/workspaces/logic/VariablesSection';

const variables = [
  { name: 'isAdult', expression: '$age >= 18' },
  { name: 'totalCost', expression: '$price * $qty' },
];

function renderVariables(vars = variables) {
  const project = createProject({
    seed: {
      definition: {
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Variables Test',
        items: [{ key: 'age', type: 'field' as const, dataType: 'integer' as const, label: 'Age' }],
        variables: vars,
      },
    },
  });
  const addVariableSpy = vi.spyOn(project, 'addVariable');
  const renameVariableSpy = vi.spyOn(project, 'renameVariable');
  const updateVariableSpy = vi.spyOn(project, 'updateVariable');
  const removeVariableSpy = vi.spyOn(project, 'removeVariable');
  return {
    ...render(
      <ProjectProvider project={project}>
        <VariablesSection variables={vars} />
      </ProjectProvider>
    ),
    addVariableSpy,
    renameVariableSpy,
    updateVariableSpy,
    removeVariableSpy,
  };
}

describe('VariablesSection inline editing', () => {
  it('click variable name enters editable input', () => {
    renderVariables();
    fireEvent.click(screen.getByText('@isAdult'));
    expect(screen.getByDisplayValue('isAdult')).toBeInTheDocument();
  });

  it('edit name calls project.renameVariable with old and new name', () => {
    const { renameVariableSpy } = renderVariables();
    // renameVariable is not yet implemented — mock it so we test component wiring only
    renameVariableSpy.mockReturnValue({ summary: 'mocked', action: { helper: 'renameVariable', params: {} }, affectedPaths: [] });
    fireEvent.click(screen.getByText('@isAdult'));
    const input = screen.getByDisplayValue('isAdult');
    fireEvent.change(input, { target: { value: 'isMinor' } });
    fireEvent.blur(input);
    expect(renameVariableSpy).toHaveBeenCalledWith('isAdult', 'isMinor');
  });

  it('click expression enters InlineExpression edit mode', () => {
    renderVariables();
    fireEvent.click(screen.getByText('$age >= 18'));
    expect(screen.getByRole('textbox')).toHaveValue('$age >= 18');
  });

  it('edit expression calls project.updateVariable with name and new expression', () => {
    const { updateVariableSpy } = renderVariables();
    fireEvent.click(screen.getByText('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '$age >= 21' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(updateVariableSpy).toHaveBeenCalledWith('isAdult', '$age >= 21');
  });

  it('delete button calls project.removeVariable', () => {
    const { removeVariableSpy } = renderVariables();
    // Delete buttons should be visible (we'll test for them)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]);
    expect(removeVariableSpy).toHaveBeenCalledWith('isAdult');
  });

  it('+ New Variable always visible even when list empty', () => {
    renderVariables([]);
    expect(screen.getByText('+ New Variable')).toBeInTheDocument();
  });

  it('new variable flow: type name, Enter calls project.addVariable', () => {
    const { addVariableSpy } = renderVariables();
    fireEvent.click(screen.getByText('+ New Variable'));
    const input = screen.getByPlaceholderText('variable_name');
    fireEvent.change(input, { target: { value: 'newVar' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(addVariableSpy).toHaveBeenCalledWith('newVar', 'null');
  });
});
