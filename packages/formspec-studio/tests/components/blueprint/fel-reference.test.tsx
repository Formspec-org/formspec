import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FELReference } from '../../../src/components/blueprint/FELReference';

describe('FELReference', () => {
  it('shows function categories', () => {
    render(<FELReference />);
    expect(screen.getByText(/aggregate/i)).toBeInTheDocument();
    expect(screen.getByText(/string/i)).toBeInTheDocument();
    expect(screen.getByText(/numeric/i)).toBeInTheDocument();
    expect(screen.getByText(/date/i)).toBeInTheDocument();
    expect(screen.getByText(/logical/i)).toBeInTheDocument();
  });

  it('shows function names', () => {
    render(<FELReference />);
    expect(screen.getByText('sum')).toBeInTheDocument();
    expect(screen.getByText('concat')).toBeInTheDocument();
    expect(screen.getByText('if')).toBeInTheDocument();
  });

  it('shows function signatures', () => {
    render(<FELReference />);
    // At least one typed signature should be visible
    expect(screen.getByText(/\(.*\)/)).toBeInTheDocument();
  });
});
