import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShapesSection } from '../../../src/workspaces/logic/ShapesSection';

const shapes = [
  { name: 'ageCheck', severity: 'error', constraint: '$age >= 0', targets: ['age'] },
  { name: 'softLimit', severity: 'warning', constraint: '$score < 100' },
];

describe('ShapesSection', () => {
  it('renders shape cards', () => {
    render(<ShapesSection shapes={shapes} />);
    expect(screen.getByText('ageCheck')).toBeInTheDocument();
    expect(screen.getByText('softLimit')).toBeInTheDocument();
  });

  it('shows severity badges', () => {
    render(<ShapesSection shapes={shapes} />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
    expect(screen.getByText(/warning/i)).toBeInTheDocument();
  });

  it('shows constraint expressions', () => {
    render(<ShapesSection shapes={shapes} />);
    expect(screen.getByText('$age >= 0')).toBeInTheDocument();
    expect(screen.getByText('$score < 100')).toBeInTheDocument();
  });
});
