import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShapesSection } from '../../../src/workspaces/logic/ShapesSection';

const shapes = [
  { name: 'ageCheck', severity: 'error', constraint: '$age >= 0', targets: ['age'], message: 'Age must be non-negative', code: 'AGE_001' },
  { name: 'softLimit', severity: 'warning', constraint: '$score < 100', message: 'Score should stay below 100', code: 'SCORE_001' },
  { name: 'householdCap', severity: 'info', constraint: '$householdSize <= 8', message: 'Household size should stay within the supported cap', code: 'HH_001' },
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

  it('shows full detail for every shape card, including code and message text', () => {
    render(<ShapesSection shapes={shapes} />);
    expect(screen.getByText('AGE_001')).toBeInTheDocument();
    expect(screen.getByText('Age must be non-negative')).toBeInTheDocument();
    expect(screen.getByText('SCORE_001')).toBeInTheDocument();
    expect(screen.getByText('Score should stay below 100')).toBeInTheDocument();
    expect(screen.getByText('HH_001')).toBeInTheDocument();
    expect(screen.getByText('Household size should stay within the supported cap')).toBeInTheDocument();
  });
});
