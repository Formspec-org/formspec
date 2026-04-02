import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShapeCard } from '../../../src/components/ui/ShapeCard';

describe('ShapeCard', () => {
  it('renders shape name', () => {
    render(<ShapeCard name="ageCheck" severity="error" constraint="$age >= 18" />);
    expect(screen.getByText('ageCheck')).toBeInTheDocument();
  });

  it('shows severity badge', () => {
    render(<ShapeCard name="ageCheck" severity="error" constraint="$age >= 18" />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('shows constraint expression with syntax highlighting', () => {
    render(<ShapeCard name="ageCheck" severity="error" constraint="$age >= 18" />);
    const constraintEl = screen.getByTestId('shape-constraint');
    expect(constraintEl).toBeInTheDocument();
    expect(constraintEl.textContent).toBe('$age >= 18');
  });

  it('shows warning severity', () => {
    render(<ShapeCard name="softCheck" severity="warning" constraint="$x > 0" />);
    expect(screen.getByText(/warning/i)).toBeInTheDocument();
  });
});
