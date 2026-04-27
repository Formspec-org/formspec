import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StudioApp } from '../../src/studio-app/StudioApp';

describe('StudioApp assistant workspace', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?onboarding=1');
  });

  it('marks onboarding completed and emits completion telemetry when entering workspace', () => {
    const telemetryEvents: Array<Record<string, unknown>> = [];
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      telemetryEvents.push(detail);
    };
    window.addEventListener('formspec:onboarding-telemetry', listener);
    try {
      render(<StudioApp />);
      fireEvent.click(screen.getAllByRole('button', { name: /Enter workspace/i })[0]);

      expect(localStorage.getItem('formspec-studio:onboarding-completed:v1')).toBe('1');
      expect(screen.getByTestId('shell')).toBeInTheDocument();
      expect(telemetryEvents.some((event) => event.name === 'onboarding_completed')).toBe(true);
      const diagnosticsSnapshot = telemetryEvents.find((event) => event.name === 'onboarding_diagnostics_snapshot');
      expect(diagnosticsSnapshot).toBeDefined();
      expect(typeof diagnosticsSnapshot?.diagnosticTotal).toBe('number');
      expect(typeof diagnosticsSnapshot?.diagnosticErrors).toBe('number');
      expect(typeof diagnosticsSnapshot?.diagnosticWarnings).toBe('number');
    } finally {
      window.removeEventListener('formspec:onboarding-telemetry', listener);
    }
  });

  it('stays in workspace when New Form is chosen after first-run is completed', async () => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    render(<StudioApp />);
    expect(screen.getByTestId('assistant-workspace')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Enter workspace/i })[0]);
    });
    expect(screen.getByTestId('shell')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /new form/i }));
    });

    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(localStorage.getItem('formspec-studio:onboarding-completed:v1')).toBe('1');
  });

  it('returns to assistant workspace when New Form is chosen before first-run is completed', async () => {
    window.history.replaceState({}, '', '/?skipOnboarding=1');
    localStorage.clear();
    render(<StudioApp />);
    expect(screen.getByTestId('shell')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /new form/i }));
    });

    expect(screen.getByTestId('assistant-workspace')).toBeInTheDocument();
    expect(localStorage.getItem('formspec-studio:onboarding-completed:v1')).toBeNull();
  });

  it('opens assistant workspace from the header assistant menu then returns to shell', async () => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    render(<StudioApp />);
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Enter workspace/i })[0]);
    });
    expect(screen.getByTestId('shell')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-entry-trigger'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-menu-open-workspace'));
    });
    expect(screen.getByTestId('assistant-workspace')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Enter workspace/i })[0]);
    });
    expect(screen.getByTestId('shell')).toBeInTheDocument();
  });
});
