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
        $formspec: '1.0', url: 'urn:test', version: '1.0.0',
        items: [{ key: 'age', type: 'field', dataType: 'integer' }],
        variables: vars,
      },
    },
  });
  const dispatchSpy = vi.spyOn(project, 'dispatch');
  return {
    ...render(
      <ProjectProvider project={project}>
        <VariablesSection variables={vars} />
      </ProjectProvider>
    ),
    dispatchSpy,
  };
}

describe('VariablesSection inline editing', () => {
  it('click variable name enters editable input', () => {
    renderVariables();
    fireEvent.click(screen.getByText('@isAdult'));
    expect(screen.getByDisplayValue('isAdult')).toBeInTheDocument();
  });

  it('edit name dispatches definition.setVariable with property name', () => {
    const { dispatchSpy } = renderVariables();
    fireEvent.click(screen.getByText('@isAdult'));
    const input = screen.getByDisplayValue('isAdult');
    fireEvent.change(input, { target: { value: 'isMinor' } });
    fireEvent.blur(input);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.setVariable',
        payload: { name: 'isAdult', property: 'name', value: 'isMinor' },
      })
    );
  });

  it('click expression enters InlineExpression edit mode', () => {
    renderVariables();
    fireEvent.click(screen.getByText('$age >= 18'));
    expect(screen.getByRole('textbox')).toHaveValue('$age >= 18');
  });

  it('edit expression dispatches definition.setVariable with property expression', () => {
    const { dispatchSpy } = renderVariables();
    fireEvent.click(screen.getByText('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '$age >= 21' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.setVariable',
        payload: { name: 'isAdult', property: 'expression', value: '$age >= 21' },
      })
    );
  });

  it('delete button dispatches definition.deleteVariable', () => {
    const { dispatchSpy } = renderVariables();
    // Delete buttons should be visible (we'll test for them)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.deleteVariable',
        payload: { name: 'isAdult' },
      })
    );
  });

  it('+ New Variable always visible even when list empty', () => {
    renderVariables([]);
    expect(screen.getByText('+ New Variable')).toBeInTheDocument();
  });

  it('new variable flow: type name, Enter dispatches addVariable', () => {
    const { dispatchSpy } = renderVariables();
    fireEvent.click(screen.getByText('+ New Variable'));
    const input = screen.getByPlaceholderText('variable_name');
    fireEvent.change(input, { target: { value: 'newVar' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.addVariable',
        payload: expect.objectContaining({ name: 'newVar' }),
      })
    );
  });
});
