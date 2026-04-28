import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ScreenerTestRouting } from '../../../src/workspaces/editor/screener/ScreenerTestRouting';

function renderWithScreener(
  items: Array<{ key: string; dataType: string; label: string; choices?: { value: string; label: string }[] }> = [],
) {
  const project = createProject();
  project.createScreenerDocument();
  for (const item of items) {
    project.addScreenField(item.key, item.label, item.dataType);
  }
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ScreenerTestRouting />
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

describe('ScreenerTestRouting', () => {
  it('renders nothing when screener has no items', () => {
    const { container } = renderWithScreener();
    expect(container.innerHTML).toBe('');
  });

  it('renders collapsed when screener has items', () => {
    renderWithScreener([{ key: 'q1', dataType: 'boolean', label: 'Over 18?' }]);
    expect(screen.getByTestId('screener-test-routing')).toBeInTheDocument();
    expect(screen.getByText('Test Routing')).toBeInTheDocument();
  });

  it('expands and shows question inputs', () => {
    renderWithScreener([{ key: 'q1', dataType: 'boolean', label: 'Over 18?' }]);
    fireEvent.click(screen.getByText('Test Routing'));
    expect(screen.getByText('Answer the screening questions to see which route would match.')).toBeInTheDocument();
    expect(screen.getByText('Over 18?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders number input for integer fields', () => {
    renderWithScreener([{ key: 'q1', dataType: 'integer', label: 'Age' }]);
    fireEvent.click(screen.getByText('Test Routing'));
    const input = screen.getByPlaceholderText('0');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'number');
  });

  it('shows results section after answering', () => {
    renderWithScreener([{ key: 'q1', dataType: 'boolean', label: 'Over 18?' }]);
    fireEvent.click(screen.getByText('Test Routing'));
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByText('Results')).toBeInTheDocument();
  });

  it('shows clear answers button after answering', () => {
    renderWithScreener([{ key: 'q1', dataType: 'boolean', label: 'Over 18?' }]);
    fireEvent.click(screen.getByText('Test Routing'));
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByText('Clear answers')).toBeInTheDocument();
  });

  it('clears answers on button click', () => {
    renderWithScreener([{ key: 'q1', dataType: 'boolean', label: 'Over 18?' }]);
    fireEvent.click(screen.getByText('Test Routing'));
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByText('Results')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear answers'));
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
    expect(screen.getByText(/Fill in answers above/)).toBeInTheDocument();
  });

  it('shows matched route with a phase and route configured', () => {
    const project = createProject();
    project.createScreenerDocument();
    project.addScreenField('q1', 'Over 18?', 'boolean');
    project.addEvaluationPhase('eligibility', 'first-match');
    project.addScreenRoute('eligibility', { condition: '$q1 = true', target: 'https://example.com/adult', label: 'Adult form' });
    project.addScreenRoute('eligibility', { condition: 'true', target: 'https://example.com/minor', label: 'Minor form' });

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ScreenerTestRouting />
        </SelectionProvider>
      </ProjectProvider>,
    );

    fireEvent.click(screen.getByText('Test Routing'));
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByText('Adult form')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/adult')).toBeInTheDocument();
  });

  it('highlights different route when answer changes', () => {
    const project = createProject();
    project.createScreenerDocument();
    project.addScreenField('q1', 'Over 18?', 'boolean');
    project.addEvaluationPhase('eligibility', 'first-match');
    project.addScreenRoute('eligibility', { condition: '$q1 = true', target: 'https://example.com/adult', label: 'Adult form' });
    project.addScreenRoute('eligibility', { condition: 'true', target: 'https://example.com/minor', label: 'Minor form' });

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ScreenerTestRouting />
        </SelectionProvider>
      </ProjectProvider>,
    );

    fireEvent.click(screen.getByText('Test Routing'));
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByText('Adult form')).toBeInTheDocument();

    fireEvent.click(screen.getByText('No'));
    expect(screen.getByText('Minor form')).toBeInTheDocument();
  });
});
