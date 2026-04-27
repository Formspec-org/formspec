import { render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { App } from '../src/App';
import { markOnboardingCompleted } from '../src/onboarding/onboarding-storage';

describe('Smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('mounts onboarding before the shell on first run', () => {
    render(<App />);
    expect(screen.getByTestId('assistant-workspace')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /enter workspace/i }).length).toBeGreaterThan(0);
  });

  it('mounts Studio after onboarding has completed', () => {
    markOnboardingCompleted();
    render(<App />);
    expect(screen.getByRole('button', { name: /the stack home/i })).toBeInTheDocument();
  });
});
