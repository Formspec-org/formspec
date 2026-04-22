import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ShapesSection } from '../../../src/workspaces/logic/ShapesSection';

const shapes = [
  { id: 'ageCheck', name: 'ageCheck', severity: 'error' as const, constraint: '$age >= 0', target: 'age', targets: ['age'], message: 'Age must be non-negative', code: 'AGE_001' },
  { id: 'softLimit', name: 'softLimit', severity: 'warning' as const, constraint: '$score < 100', target: 'score', message: 'Score should stay below 100', code: 'SCORE_001' },
  { id: 'householdCap', name: 'householdCap', severity: 'info' as const, constraint: '$householdSize <= 8', target: 'householdSize', message: 'Household size should stay within the supported cap', code: 'HH_001' },
];

function renderShapes(s = shapes) {
  const project = createProject({
    seed: {
      definition: {
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Shapes Test',
        items: [{ key: 'age', type: 'field' as const, dataType: 'integer' as const, label: 'Age' }],
        shapes: s,
      },
    },
  });
  const addValidationSpy = vi.spyOn(project, 'addValidation');
  const updateValidationSpy = vi.spyOn(project, 'updateValidation');
  const removeValidationSpy = vi.spyOn(project, 'removeValidation');
  return {
    ...render(
      <ProjectProvider project={project}>
        <ShapesSection shapes={s} />
      </ProjectProvider>
    ),
    addValidationSpy,
    updateValidationSpy,
    removeValidationSpy,
  };
}

describe('ShapesSection', () => {
  it('renders shape cards', () => {
    renderShapes();
    expect(screen.getByText('ageCheck')).toBeInTheDocument();
    expect(screen.getByText('softLimit')).toBeInTheDocument();
  });

  it('shows severity badges', () => {
    renderShapes();
    expect(screen.getByText(/error/i)).toBeInTheDocument();
    expect(screen.getByText(/warning/i)).toBeInTheDocument();
  });

  it('shows constraint expressions with syntax highlighting in shape cards', () => {
    renderShapes();
    const constraintEls = screen.getAllByTestId('shape-constraint');
    const texts = constraintEls.map(el => el.textContent);
    expect(texts).toContain('$age >= 0');
    expect(texts).toContain('$score < 100');
  });

  it('shows full detail for every shape card, including code and message text', () => {
    renderShapes();
    expect(screen.getByText('AGE_001')).toBeInTheDocument();
    expect(screen.getByText('Age must be non-negative')).toBeInTheDocument();
    expect(screen.getByText('SCORE_001')).toBeInTheDocument();
    expect(screen.getByText('Score should stay below 100')).toBeInTheDocument();
    expect(screen.getByText('HH_001')).toBeInTheDocument();
    expect(screen.getByText('Household size should stay within the supported cap')).toBeInTheDocument();
  });

  it('click shape card expands form below', () => {
    renderShapes();
    fireEvent.click(screen.getByText('ageCheck'));
    // Expanded form shows labeled fields
    expect(screen.getByLabelText('Severity')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Target')).toBeInTheDocument();
  });

  it('click expanded card collapses', () => {
    renderShapes();
    fireEvent.click(screen.getByText('ageCheck'));
    expect(screen.getByLabelText('Severity')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ageCheck'));
    expect(screen.queryByLabelText('Severity')).not.toBeInTheDocument();
  });

  it('only one expanded at a time', () => {
    renderShapes();
    fireEvent.click(screen.getByText('ageCheck'));
    expect(screen.getByLabelText('Severity')).toBeInTheDocument();
    fireEvent.click(screen.getByText('softLimit'));
    // Only one set of form fields should exist
    const severitySelects = screen.getAllByLabelText('Severity');
    expect(severitySelects).toHaveLength(1);
  });

  it('editing constraint calls project.updateValidation with rule', () => {
    const { updateValidationSpy } = renderShapes();
    fireEvent.click(screen.getByText('ageCheck'));
    // The expanded form has InlineExpression with title='$age >= 0'
    const editableChip = screen.getByTitle('$age >= 0');
    expect(editableChip).toBeTruthy();
    fireEvent.click(editableChip);
    // Now only one textarea should be active (InlineExpression edit mode)
    const textareas = screen.getAllByRole('textbox');
    const textarea = textareas.find(el => el.tagName === 'TEXTAREA')!;
    fireEvent.change(textarea, { target: { value: '$age > 0' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(updateValidationSpy).toHaveBeenCalledWith('ageCheck', { rule: '$age > 0' });
  });

  it('delete calls project.removeValidation', () => {
    const { removeValidationSpy } = renderShapes();
    fireEvent.click(screen.getByText('ageCheck'));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(removeValidationSpy).toHaveBeenCalledWith('ageCheck');
  });

  it('+ New Shape creates via project.addValidation', () => {
    const { addValidationSpy } = renderShapes();
    fireEvent.click(screen.getByText('+ New Shape'));
    const input = screen.getByPlaceholderText(/shape_id/);
    fireEvent.change(input, { target: { value: 'newRule' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(addValidationSpy).toHaveBeenCalledWith('newRule', 'true', 'Validation failed', { severity: 'error' });
  });
});
