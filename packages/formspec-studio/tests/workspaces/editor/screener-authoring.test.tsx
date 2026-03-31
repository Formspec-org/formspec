/** @filedesc Tests for the ScreenerAuthoring orchestrator and ScreenerToggle components. */
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ScreenerAuthoring } from '../../../src/workspaces/editor/ScreenerAuthoring';

function renderScreener(def?: any) {
  const base = { $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [] };
  const project = createProject({ seed: { definition: def || base } });
  return { project, ...render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ScreenerAuthoring />
      </SelectionProvider>
    </ProjectProvider>,
  ) };
}

describe('ScreenerAuthoring', () => {
  describe('toggle', () => {
    it('shows empty state when no screener exists', () => {
      renderScreener();
      expect(screen.getByText(/set up screening/i)).toBeInTheDocument();
    });

    it('creates a screener when setup button is clicked', async () => {
      const { project } = renderScreener();
      await act(async () => {
        screen.getByRole('button', { name: /set up screening/i }).click();
      });
      expect(project.definition.screener).toBeDefined();
    });

    it('shows active authoring surface when screener exists', () => {
      renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });
      expect(screen.getByRole('heading', { name: /screening questions/i })).toBeInTheDocument();
      expect(screen.getByText(/routing rules/i)).toBeInTheDocument();
    });

    it('shows Active pill when screener is configured', () => {
      renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows question and route counts', () => {
      renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: {
          items: [
            { key: 'q1', type: 'field', dataType: 'boolean', label: 'Q1' },
            { key: 'q2', type: 'field', dataType: 'boolean', label: 'Q2' },
          ],
          routes: [
            { condition: '$q1', target: 'urn:a' },
            { condition: 'true', target: 'urn:b' },
          ],
        },
      });
      expect(screen.getByText(/2 questions/i)).toBeInTheDocument();
      expect(screen.getByText(/2 routes/i)).toBeInTheDocument();
    });

    it('removes screener with confirmation', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { project } = renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });

      await act(async () => {
        screen.getByRole('button', { name: /remove screener/i }).click();
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(project.definition.screener).toBeUndefined();
      confirmSpy.mockRestore();
    });

    it('does not remove screener when confirmation is cancelled', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { project } = renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });

      await act(async () => {
        screen.getByRole('button', { name: /remove screener/i }).click();
      });

      expect(project.definition.screener).toBeDefined();
      confirmSpy.mockRestore();
    });
  });

  describe('questions', () => {
    const withScreener = {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
      screener: {
        items: [
          { key: 'screen_age', type: 'field', dataType: 'boolean', label: 'Are you 18 or older?' },
        ],
        routes: [{ condition: 'true', target: 'urn:default' }],
      },
    };

    it('shows existing questions', () => {
      renderScreener(withScreener);
      expect(screen.getByText('Are you 18 or older?')).toBeInTheDocument();
    });

    it('shows add question button', () => {
      renderScreener(withScreener);
      expect(screen.getByRole('button', { name: /add question/i })).toBeInTheDocument();
    });

    it('opens inline add form when add is clicked', async () => {
      renderScreener(withScreener);
      await act(async () => {
        screen.getByRole('button', { name: /add question/i }).click();
      });
      expect(screen.getByPlaceholderText(/label/i)).toBeInTheDocument();
    });

    it('adds a question with the inline form', async () => {
      const { project } = renderScreener(withScreener);
      await act(async () => {
        screen.getByRole('button', { name: /add question/i }).click();
      });

      const labelInput = screen.getByPlaceholderText(/label/i);
      await act(async () => {
        fireEvent.change(labelInput, { target: { value: 'Annual income?' } });
      });

      await act(async () => {
        screen.getByRole('button', { name: /^add$/i }).click();
      });

      const items = project.state.definition.screener?.items ?? [];
      expect(items).toHaveLength(2);
      expect(items[1].label).toBe('Annual income?');
    });

    it('deletes a question with confirmation', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { project } = renderScreener(withScreener);

      // Expand the card first by clicking the header
      await act(async () => {
        screen.getByText('Are you 18 or older?').click();
      });

      await act(async () => {
        screen.getByRole('button', { name: /delete/i }).click();
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(project.state.definition.screener?.items).toHaveLength(0);
      confirmSpy.mockRestore();
    });

    it('shows empty state when no questions exist', () => {
      renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });
      expect(screen.getByText(/no screening questions/i)).toBeInTheDocument();
    });
  });

  describe('routes', () => {
    const withRoutes = {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
      screener: {
        items: [{ key: 'screen_age', type: 'field', dataType: 'boolean', label: 'Are you 18+?' }],
        routes: [
          { condition: '$screen_age = true', target: 'urn:adult-form', label: 'Adults' },
          { condition: 'true', target: 'urn:default', label: 'Everyone else' },
        ],
      },
    };

    it('shows the info bar about first-match-wins', () => {
      renderScreener(withRoutes);
      expect(screen.getByText(/first matching rule wins/i)).toBeInTheDocument();
    });

    it('renders route cards with labels', () => {
      renderScreener(withRoutes);
      expect(screen.getByText('Adults')).toBeInTheDocument();
    });

    it('renders the fallback route distinctly', () => {
      renderScreener(withRoutes);
      const fallback = screen.getByTestId('fallback-route');
      expect(fallback).toBeInTheDocument();
      expect(within(fallback).getByText(/everyone else/i)).toBeInTheDocument();
    });

    it('shows add rule button', () => {
      renderScreener(withRoutes);
      expect(screen.getByRole('button', { name: /add rule/i })).toBeInTheDocument();
    });

    it('adds a new route above the fallback', async () => {
      const { project } = renderScreener(withRoutes);
      await act(async () => {
        screen.getByRole('button', { name: /add rule/i }).click();
      });
      const routes = project.state.definition.screener?.routes ?? [];
      expect(routes.length).toBe(3);
      // Fallback should still be last
      expect(routes[routes.length - 1].condition).toBe('true');
    });

    it('does not show delete on fallback route', () => {
      renderScreener(withRoutes);
      const fallback = screen.getByTestId('fallback-route');
      expect(within(fallback).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('ephemeral notice', () => {
    it('shows ephemeral data notice when screener is not active', () => {
      renderScreener();
      expect(screen.getByText(/answers are used for routing only/i)).toBeInTheDocument();
    });

    it('shows ephemeral data notice when screener is active', () => {
      renderScreener({
        $formspec: '1.0', url: 'urn:test', version: '1.0.0', items: [],
        screener: { items: [], routes: [{ condition: 'true', target: 'urn:default' }] },
      });
      expect(screen.getByText(/answers are used for routing only/i)).toBeInTheDocument();
    });
  });
});
