import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../src/App';

describe('Smoke', () => {
  it('mounts Studio by default', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /the stack home/i })).toBeInTheDocument();
  });
});

