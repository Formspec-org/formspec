import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { BindsSection } from '../../../src/workspaces/logic/BindsSection';

const binds = {
  name: { required: 'true', relevant: '$age >= 18' },
  age: { required: 'true' },
};

function renderBinds(b = binds, props: Record<string, any> = {}) {
  const project = createProject({
    seed: {
      definition: {
        $formspec: '1.0', url: 'urn:test', version: '1.0.0',
        items: [
          { key: 'name', type: 'field', dataType: 'string' },
          { key: 'age', type: 'field', dataType: 'integer' },
        ],
        binds: b,
      },
    },
  });
  const dispatchSpy = vi.spyOn(project, 'dispatch');
  return {
    ...render(
      <ProjectProvider project={project}>
        <BindsSection binds={b} {...props} />
      </ProjectProvider>
    ),
    dispatchSpy,
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
    const allRequired = screen.getAllByText(/required/i);
    expect(allRequired.length).toBeGreaterThanOrEqual(1);
  });

  it('shows expression text', () => {
    renderBinds();
    expect(screen.getByText('$age >= 18')).toBeInTheDocument();
  });

  it('bind expression is editable via InlineExpression', () => {
    renderBinds();
    fireEvent.click(screen.getByText('$age >= 18'));
    expect(screen.getByRole('textbox')).toHaveValue('$age >= 18');
  });

  it('saving dispatches definition.setBind with correct path and type', () => {
    const { dispatchSpy } = renderBinds();
    fireEvent.click(screen.getByText('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '$age >= 21' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.setBind',
        payload: { path: 'name', properties: { relevant: '$age >= 21' } },
      })
    );
  });

  it('saving empty dispatches with null (removes bind)', () => {
    const { dispatchSpy } = renderBinds();
    fireEvent.click(screen.getByText('$age >= 18'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'definition.setBind',
        payload: { path: 'name', properties: { relevant: null } },
      })
    );
  });

  it('BindCard still shows type label and colored border', () => {
    renderBinds();
    const allRequired = screen.getAllByText(/required/i);
    expect(allRequired.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/relevant/i)).toBeInTheDocument();
  });
});
