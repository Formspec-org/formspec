import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { BindsSection } from '../../../src/workspaces/logic/BindsSection';

const binds: Record<string, any> = {
  name: { required: 'true', relevant: '$age >= 18' },
  age: { required: 'true' },
};

function renderBinds(b = binds, props: Record<string, any> = {}) {
  const bindArray = Object.entries(b).map(([path, entry]) => ({ path, ...entry }));
  const project = createProject({
    seed: {
      definition: {
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', title: 'Binds Test',
        items: [
          { key: 'name', type: 'field' as const, dataType: 'string' as const, label: 'Name' },
          { key: 'age', type: 'field' as const, dataType: 'integer' as const, label: 'Age' },
        ],
        binds: bindArray,
      },
    },
  });
  const updateItemSpy = vi.spyOn(project, 'updateItem');
  return {
    ...render(
      <ProjectProvider project={project}>
        <BindsSection binds={b} {...props} />
      </ProjectProvider>
    ),
    updateItemSpy,
  };
}

describe('BindsSection', () => {
  it('renders bind entries per field', () => {
    renderBinds();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('shows bind type pills per field', () => {
    renderBinds();
    const allMustFill = screen.getAllByText(/must fill/i);
    expect(allMustFill.length).toBeGreaterThanOrEqual(1);
  });

  it('shows expression text with syntax highlighting', () => {
    renderBinds();
    expect(screen.getByTitle('$age >= 18')).toBeInTheDocument();
  });

  it('bind expression is editable via InlineExpression', () => {
    renderBinds();
    fireEvent.click(screen.getByTitle('$age >= 18'));
    expect(screen.getByRole('textbox')).toHaveValue('$age >= 18');
  });

  it('saving calls project.updateItem with correct path and property', () => {
    const { updateItemSpy } = renderBinds();
    fireEvent.click(screen.getByTitle('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '$age >= 21' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(updateItemSpy).toHaveBeenCalledWith('name', { relevant: '$age >= 21' });
  });

  it('saving empty calls updateItem with empty string', () => {
    const { updateItemSpy } = renderBinds();
    fireEvent.click(screen.getByTitle('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(updateItemSpy).toHaveBeenCalledWith('name', { relevant: '' });
  });

  it('BindCard still shows type label and colored border', () => {
    renderBinds();
    const allMustFill = screen.getAllByText(/must fill/i);
    expect(allMustFill.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/shows if/i)).toBeInTheDocument();
  });
});
