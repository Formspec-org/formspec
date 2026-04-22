import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WidgetConstraintSection } from '../../../../src/workspaces/editor/properties/WidgetConstraintSection';
import type { Project, WidgetConstraintState } from '@formspec-org/studio-core';

function mockProject(overrides: Partial<Project> = {}): Project {
  return {
    setWidgetConstraints: vi.fn(),
    bindFor: vi.fn().mockReturnValue({ constraint: '$ >= 1 and $ <= 100' }),
    ...overrides,
  } as unknown as Project;
}

const numericState: WidgetConstraintState = {
  type: 'numeric',
  numericValues: { min: 1, max: 100 },
  dateValues: {},
  isManaged: true,
  hasCustomConstraint: false,
  component: 'NumberInput',
};

const dateState: WidgetConstraintState = {
  type: 'date',
  numericValues: {},
  dateValues: { min: '2025-01-01', max: '2025-12-31' },
  isManaged: true,
  hasCustomConstraint: false,
  component: 'DatePicker',
};

const customConstraintState: WidgetConstraintState = {
  type: 'numeric',
  numericValues: { min: 1 },
  dateValues: {},
  isManaged: false,
  hasCustomConstraint: true,
  component: 'NumberInput',
};

const noConstraintState: WidgetConstraintState = {
  type: 'none',
  numericValues: {},
  dateValues: {},
  isManaged: false,
  hasCustomConstraint: false,
  component: 'TextInput',
};

describe('WidgetConstraintSection', () => {
  it('renders nothing for widgets without constraint props', () => {
    const project = mockProject();
    const { container } = render(
      <WidgetConstraintSection path="name" project={project} widgetState={noConstraintState} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders min/max/step inputs for numeric widget', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="age" project={project} widgetState={numericState} />,
    );
    expect(screen.getByLabelText('Min')).toBeInTheDocument();
    expect(screen.getByLabelText('Max')).toBeInTheDocument();
    expect(screen.getByLabelText('Step')).toBeInTheDocument();
  });

  it('renders min/max date inputs for DatePicker', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="date" project={project} widgetState={dateState} />,
    );
    expect(screen.getByLabelText('Min Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Max Date')).toBeInTheDocument();
    expect(screen.queryByLabelText('Step')).not.toBeInTheDocument();
  });

  it('populates inputs with current values', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="age" project={project} widgetState={numericState} />,
    );
    expect(screen.getByLabelText('Min')).toHaveValue(1);
    expect(screen.getByLabelText('Max')).toHaveValue(100);
  });

  it('calls setWidgetConstraints on blur', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="age" project={project} widgetState={numericState} />,
    );
    const minInput = screen.getByLabelText('Min');
    fireEvent.change(minInput, { target: { value: '5' } });
    fireEvent.blur(minInput);
    expect(project.setWidgetConstraints).toHaveBeenCalledWith('age', { min: 5 });
  });

  it('calls setWidgetConstraints with date values for DatePicker', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="date" project={project} widgetState={dateState} />,
    );
    const minInput = screen.getByLabelText('Min Date');
    fireEvent.change(minInput, { target: { value: '2025-06-01' } });
    fireEvent.blur(minInput);
    expect(project.setWidgetConstraints).toHaveBeenCalledWith('date', { min: '2025-06-01' });
  });

  it('shows managed constraint expression', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="age" project={project} widgetState={numericState} />,
    );
    expect(screen.getByTestId('widget-constraint-managed')).toBeInTheDocument();
    expect(screen.getByTestId('widget-constraint-managed').textContent).toContain('$ >= 1 and $ <= 100');
  });

  it('shows custom constraint notice', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="age" project={project} widgetState={customConstraintState} />,
    );
    expect(screen.getByTestId('widget-constraint-custom-notice')).toBeInTheDocument();
  });

  it('does not show managed expression for custom constraints', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="age" project={project} widgetState={customConstraintState} />,
    );
    expect(screen.queryByTestId('widget-constraint-managed')).not.toBeInTheDocument();
  });

  it('passes null when numeric input is cleared', () => {
    const project = mockProject();
    render(
      <WidgetConstraintSection path="age" project={project} widgetState={numericState} />,
    );
    const minInput = screen.getByLabelText('Min');
    fireEvent.change(minInput, { target: { value: '' } });
    fireEvent.blur(minInput);
    expect(project.setWidgetConstraints).toHaveBeenCalledWith('age', { min: null });
  });
});
