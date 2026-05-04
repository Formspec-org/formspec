import { render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { App } from '../src/App';

describe('Smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('mounts UnifiedStudio directly without onboarding', async () => {
    render(<App />);
    expect(await screen.findByTestId('shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /the stack home/i })).toBeInTheDocument();
  });
});
