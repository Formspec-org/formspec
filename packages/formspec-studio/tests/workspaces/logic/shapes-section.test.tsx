import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { ShapesSection } from '../../../src/workspaces/logic/ShapesSection';

const shapes = [
  { id: 'ageCheck', name: 'ageCheck', severity: 'error', constraint: '$age >= 0', targets: ['age'], message: 'Age must be non-negative', code: 'AGE_001' },
  { id: 'softLimit', name: 'softLimit', severity: 'warning', constraint: '$score < 100', message: 'Score should stay below 100', code: 'SCORE_001' },
  { id: 'householdCap', name: 'householdCap', severity: 'info', constraint: '$householdSize <= 8', message: 'Household size should stay within the supported cap', code: 'HH_001' },
];

function renderShapes(s = shapes) {
  const project = createProject({
    seed: {
      definition: {
        $formspec: '1.0', url: 'urn:test', version: '1.0.0',
        items: [{ key: 'age', type: 'field', dataType: 'integer' }],
        shapes: s,
      },
    },
  });
  const dispatchSpy = vi.spyOn(project, 'dispatch');
  return {
    ...render(
      <ProjectProvider project={project}>
        <ShapesSection shapes={s} />
      </ProjectProvider>
    ),
    dispatchSpy,
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

  it('shows constraint expressions', () => {
    renderShapes();
    expect(screen.getByText('$age >= 0')).toBeInTheDocument();
    expect(screen.getByText('$score < 100')).toBeInTheDocument();
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

  it('editing constraint dispatches setShapeProperty', () => {
    const { dispatchSpy } = renderShapes();
    fireEvent.click(screen.getByText('ageCheck'));
    // The expanded form has a Constraint label followed by InlineExpression showing '$age >= 0'
    // There are two '$age >= 0' texts: one in ShapeCard (read-only) and one in InlineExpression (editable)
    // Click the one with cursor-pointer class (InlineExpression)
    const allMatches = screen.getAllByText('$age >= 0');
    const editableMatch = allMatches.find(el => el.classList.contains('cursor-pointer'));
    expect(editableMatch).toBeTruthy();
    fireEvent.click(editableMatch!);
    // Now only one textarea should be active (InlineExpression edit mode)
    const textareas = screen.getAllByRole('textbox');
    const textarea = textareas.find(el => el.tagName === 'TEXTAREA')!;
    fireEvent.change(textarea, { target: { value: '$age > 0' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.setShapeProperty',
        payload: { id: 'ageCheck', property: 'constraint', value: '$age > 0' },
      })
    );
  });

  it('delete dispatches deleteShape', () => {
    const { dispatchSpy } = renderShapes();
    fireEvent.click(screen.getByText('ageCheck'));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.deleteShape',
        payload: { id: 'ageCheck' },
      })
    );
  });

  it('+ New Shape creates and auto-expands', () => {
    const { dispatchSpy } = renderShapes();
    fireEvent.click(screen.getByText('+ New Shape'));
    const input = screen.getByPlaceholderText(/shape_id/);
    fireEvent.change(input, { target: { value: 'newRule' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.addShape',
        payload: expect.objectContaining({ id: 'newRule' }),
      })
    );
  });
});
