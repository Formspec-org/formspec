import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ScreenerSummary } from '../../../src/components/blueprint/ScreenerSummary';

function renderSummary(opts?: { definition?: any; screener?: any }) {
  const base = { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] };
  const project = createProject({
    seed: {
      definition: opts?.definition ?? base,
      ...(opts?.screener !== undefined ? { screener: opts.screener } : {}),
    },
  });
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ScreenerSummary />
      </SelectionProvider>
    </ProjectProvider>,
  );
}

describe('ScreenerSummary', () => {
  it('shows not configured when no screener', () => {
    renderSummary();
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  });

  it('shows active status with counts', () => {
    renderSummary({
      screener: {
        $formspecScreener: '1.0',
        url: 'urn:test:gate',
        version: '1.0.0',
        title: 'Gate',
        items: [
          { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
          { key: 'income', type: 'field', dataType: 'money', label: 'Income' },
        ],
        evaluation: [
          {
            id: 'main',
            strategy: 'first-match',
            routes: [
              { condition: '$age >= 18', target: 'urn:adult' },
              { condition: 'true', target: 'urn:default' },
            ],
          },
        ],
      },
    });
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/2 questions, 1 phase, 2 routes/)).toBeInTheDocument();
  });

  it('shows singular form for 1 question', () => {
    renderSummary({
      screener: {
        $formspecScreener: '1.0',
        url: 'urn:test:gate',
        version: '1.0.0',
        title: 'Gate',
        items: [{ key: 'age', type: 'field', dataType: 'integer', label: 'Age' }],
        evaluation: [
          {
            id: 'main',
            strategy: 'first-match',
            routes: [{ condition: 'true', target: 'urn:default' }],
          },
        ],
      },
    });
    expect(screen.getByText(/1 question, 1 phase, 1 route/)).toBeInTheDocument();
  });
});
