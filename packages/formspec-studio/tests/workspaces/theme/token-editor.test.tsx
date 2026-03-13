import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { TokenEditor } from '../../../src/workspaces/theme/TokenEditor';

const themeDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
};
const themeDoc = {
  targetDefinition: { url: 'urn:test' },
  tokens: { primaryColor: '#3b82f6', fontSize: '16px', fontFamily: 'Inter' },
};

function renderTokens() {
  const project = createProject({ seed: { definition: themeDef as any, theme: themeDoc } });
  return { ...render(
    <ProjectProvider project={project}><TokenEditor /></ProjectProvider>
  ), project };
}

describe('TokenEditor', () => {
  it('renders token key-value pairs', () => {
    renderTokens();
    expect(screen.getByText('primaryColor')).toBeInTheDocument();
    expect(screen.getByText('#3b82f6')).toBeInTheDocument();
  });

  it('shows all tokens', () => {
    renderTokens();
    expect(screen.getByText('fontSize')).toBeInTheDocument();
    expect(screen.getByText('fontFamily')).toBeInTheDocument();
  });

  it('shows empty state when no tokens', () => {
    const project = createProject({ seed: { definition: themeDef as any, theme: { targetDefinition: { url: 'urn:test' } } } });
    render(<ProjectProvider project={project}><TokenEditor /></ProjectProvider>);
    expect(screen.getByText(/no tokens/i)).toBeInTheDocument();
  });

  it('adds a token via prompt flow', async () => {
    const { project } = renderTokens();
    const spy = vi.spyOn(project, 'dispatch');
    const promptSpy = vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('color.secondary')
      .mockReturnValueOnce('#0f172a');

    await act(async () => {
      screen.getByRole('button', { name: /\+ add token/i }).click();
    });

    expect(spy).toHaveBeenCalledWith({
      type: 'theme.setToken',
      payload: { key: 'color.secondary', value: '#0f172a' },
    });
    promptSpy.mockRestore();
  });
});
