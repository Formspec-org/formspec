import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { FieldTypeRules } from '../../../src/workspaces/theme/FieldTypeRules';

function renderRules(selectors?: unknown[]) {
  const project = createProject({
    seed: {
      definition: { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] } as any,
      theme: { selectors } as any,
    },
  });
  return {
    ...render(
      <ProjectProvider project={project}>
        <FieldTypeRules />
      </ProjectProvider>
    ),
    project,
  };
}

describe('FieldTypeRules', () => {
  it('renders rules with match summary', () => {
    renderRules([
      { match: { type: 'field', dataType: 'money' }, apply: { widget: 'moneyInput' } },
    ]);
    expect(screen.getByText('field + money')).toBeInTheDocument();
    expect(screen.getByText('moneyInput')).toBeInTheDocument();
  });

  it('empty state with explanation', () => {
    renderRules([]);
    expect(screen.getByText(/no.*rules/i)).toBeInTheDocument();
  });

  it('add dispatches theme.addSelector', async () => {
    const { project } = renderRules([]);
    await act(async () => {
      screen.getByRole('button', { name: /\+ new rule/i }).click();
    });
    const selectors = (project.export().theme as any).selectors;
    expect(selectors).toHaveLength(1);
  });

  it('delete dispatches theme.deleteSelector', async () => {
    const { project } = renderRules([
      { match: { type: 'field' }, apply: { widget: 'text' } },
    ]);
    // Expand to see delete button
    await act(async () => {
      screen.getByText(/field/).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /delete/i }).click();
    });
    const selectors = (project.export().theme as any).selectors;
    expect(selectors).toHaveLength(0);
  });

  it('up dispatches theme.reorderSelector up', async () => {
    const { project } = renderRules([
      { match: { type: 'field' }, apply: {} },
      { match: { type: 'group' }, apply: {} },
    ]);
    // Expand second rule
    await act(async () => {
      screen.getByText(/group/).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /move up/i }).click();
    });
    const selectors = (project.export().theme as any).selectors;
    expect((selectors[0] as any).match.type).toBe('group');
  });

  it('down dispatches theme.reorderSelector down', async () => {
    const { project } = renderRules([
      { match: { type: 'field' }, apply: {} },
      { match: { type: 'group' }, apply: {} },
    ]);
    // Expand first rule
    await act(async () => {
      screen.getByText(/field/).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: /move down/i }).click();
    });
    const selectors = (project.export().theme as any).selectors;
    expect((selectors[0] as any).match.type).toBe('group');
  });

  it('up disabled on first rule', async () => {
    renderRules([
      { match: { type: 'field' }, apply: {} },
      { match: { type: 'group' }, apply: {} },
    ]);
    await act(async () => {
      screen.getByText(/field/).click();
    });
    expect(screen.getByRole('button', { name: /move up/i })).toBeDisabled();
  });

  it('down disabled on last rule', async () => {
    renderRules([
      { match: { type: 'field' }, apply: {} },
      { match: { type: 'group' }, apply: {} },
    ]);
    await act(async () => {
      screen.getByText(/group/).click();
    });
    expect(screen.getByRole('button', { name: /move down/i })).toBeDisabled();
  });

  it('edit type dispatches theme.setSelector with match', async () => {
    const { project } = renderRules([
      { match: {}, apply: {} },
    ]);
    // Expand the rule
    await act(async () => {
      screen.getByText('Any item').click();
    });
    const typeSelect = screen.getByLabelText(/item type/i);
    await act(async () => {
      fireEvent.change(typeSelect, { target: { value: 'field' } });
    });
    const sel = (project.export().theme as any).selectors[0];
    expect(sel.match.type).toBe('field');
  });

  it('edit widget dispatches theme.setSelector with apply', async () => {
    const { project } = renderRules([
      { match: { type: 'field' }, apply: {} },
    ]);
    await act(async () => {
      screen.getByText(/field/).click();
    });
    const widgetInput = screen.getByLabelText(/widget/i);
    await act(async () => {
      fireEvent.change(widgetInput, { target: { value: 'moneyInput' } });
      fireEvent.blur(widgetInput);
    });
    const sel = (project.export().theme as any).selectors[0];
    expect(sel.apply.widget).toBe('moneyInput');
  });
});
