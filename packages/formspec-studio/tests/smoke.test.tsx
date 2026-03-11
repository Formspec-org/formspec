import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../src/App';

describe('Smoke', () => {
  it('mounts without crashing', () => {
    render(<App />);
    expect(screen.getByText('The Stack')).toBeInTheDocument();
  });
});
