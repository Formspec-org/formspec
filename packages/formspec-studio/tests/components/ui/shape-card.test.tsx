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

  it('shows constraint expression', () => {
    render(<ShapeCard name="ageCheck" severity="error" constraint="$age >= 18" />);
    expect(screen.getByText('$age >= 18')).toBeInTheDocument();
  });

  it('shows warning severity', () => {
    render(<ShapeCard name="softCheck" severity="warning" constraint="$x > 0" />);
    expect(screen.getByText(/warning/i)).toBeInTheDocument();
  });
});
