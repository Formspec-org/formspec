/** @filedesc Tests for the ConditionBuilder UI component. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConditionBuilder, ConditionBuilderPreview } from '../../../src/components/ui/ConditionBuilder';
import type { FELEditorFieldOption } from '@formspec-org/studio-core';

const mockFields: FELEditorFieldOption[] = [
  { path: 'age', label: 'Age', dataType: 'integer' },
  { path: 'isReturning', label: 'Is Returning', dataType: 'boolean' },
  { path: 'applicantType', label: 'Applicant Type', dataType: 'choice' },
  { path: 'requestedAmount', label: 'Requested Amount', dataType: 'money' },
  { path: 'name', label: 'Name', dataType: 'string' },
];

describe('ConditionBuilder', () => {
  it('renders in guided mode for parseable FEL', () => {
    render(
      <ConditionBuilder
        value="$age >= 18"
        onSave={vi.fn()}
        fields={mockFields}
        autoEdit
      />,
    );
    expect(screen.getByText(/all/)).toBeInTheDocument();
    expect(screen.getByText(/of these are true/)).toBeInTheDocument();
  });

  it('renders in advanced mode for complex FEL', () => {
    render(
      <ConditionBuilder
        value="sum($items[*].amount)"
        onSave={vi.fn()}
        fields={mockFields}
        autoEdit
      />,
    );
    expect(screen.getByText('Guided')).toBeInTheDocument();
  });

  it('shows FEL preview of generated expression', () => {
    render(
      <ConditionBuilder
        value="$age >= 18"
        onSave={vi.fn()}
        fields={mockFields}
        autoEdit
      />,
    );
    expect(screen.getByText(/FEL:/)).toBeInTheDocument();
  });

  it('renders self-reference mode for constraint', () => {
    render(
      <ConditionBuilder
        value="$ >= 0"
        onSave={vi.fn()}
        fields={mockFields}
        selfReference
        autoEdit
      />,
    );
    expect(screen.getByText('this value')).toBeInTheDocument();
  });

  it('adds a condition row on button click', () => {
    render(
      <ConditionBuilder
        value="$age >= 18"
        onSave={vi.fn()}
        fields={mockFields}
        autoEdit
      />,
    );
    const addBtn = screen.getByText('Add condition');
    fireEvent.click(addBtn);
    const fieldSelects = screen.getAllByLabelText('Field');
    expect(fieldSelects).toHaveLength(2);
  });

  it('removes a condition row on trash click', () => {
    render(
      <ConditionBuilder
        value="$age >= 18 and $name = 'test'"
        onSave={vi.fn()}
        fields={mockFields}
        autoEdit
      />,
    );
    const removeButtons = screen.getAllByLabelText('Remove condition');
    fireEvent.click(removeButtons[0]);
    const fieldSelects = screen.getAllByLabelText('Field');
    expect(fieldSelects).toHaveLength(1);
  });

  it('toggles logic between all and any', () => {
    render(
      <ConditionBuilder
        value="$age >= 18 and $name = 'test'"
        onSave={vi.fn()}
        fields={mockFields}
        autoEdit
      />,
    );
    const toggle = screen.getByText('all');
    fireEvent.click(toggle);
    expect(screen.getByText('any')).toBeInTheDocument();
  });

  it('switches to advanced mode on Advanced click', () => {
    render(
      <ConditionBuilder
        value="$age >= 18"
        onSave={vi.fn()}
        fields={mockFields}
        autoEdit
      />,
    );
    fireEvent.click(screen.getByText('Advanced'));
    expect(screen.getByText('Guided')).toBeInTheDocument();
  });

  it('calls onSave with FEL when Save is clicked', () => {
    const onSave = vi.fn();
    render(
      <ConditionBuilder
        value="$age >= 18"
        onSave={onSave}
        fields={mockFields}
        autoEdit
      />,
    );
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('$age >= 18');
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConditionBuilder
        value="$age >= 18"
        onSave={vi.fn()}
        onCancel={onCancel}
        fields={mockFields}
        autoEdit
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  describe('ConditionBuilderPreview', () => {
    it('renders humanized preview for parseable FEL', () => {
      render(<ConditionBuilderPreview value="$age >= 18" onClick={vi.fn()} />);
      expect(screen.getByTestId('condition-builder-preview').textContent).toContain('age is at least 18');
    });

    it('renders raw FEL for complex expressions', () => {
      render(<ConditionBuilderPreview value="sum($items[*].amount)" onClick={vi.fn()} />);
      expect(screen.queryByTestId('condition-builder-preview')).not.toBeInTheDocument();
    });

    it('uses self-reference label when selfReference is true', () => {
      render(<ConditionBuilderPreview value="$ >= 0" onClick={vi.fn()} selfReference />);
      const el = screen.getByTestId('condition-builder-preview');
      expect(el.textContent).toContain('value is at least 0');
    });

    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<ConditionBuilderPreview value="$age >= 18" onClick={onClick} />);
      fireEvent.click(screen.getByTestId('condition-builder-preview'));
      expect(onClick).toHaveBeenCalled();
    });
  });
});
