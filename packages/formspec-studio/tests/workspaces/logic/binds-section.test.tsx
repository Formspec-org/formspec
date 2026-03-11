import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BindsSection } from '../../../src/workspaces/logic/BindsSection';

const binds = {
  name: { required: 'true', relevant: '$age >= 18' },
  age: { required: 'true' },
};

describe('BindsSection', () => {
  it('renders bind entries per field', () => {
    render(<BindsSection binds={binds} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
  });

  it('shows bind type pills per field', () => {
    render(<BindsSection binds={binds} />);
    // name has required + relevant
    const allRequired = screen.getAllByText(/required/i);
    expect(allRequired.length).toBeGreaterThanOrEqual(1);
  });

  it('shows expression text', () => {
    render(<BindsSection binds={binds} />);
    expect(screen.getByText('$age >= 18')).toBeInTheDocument();
  });
});
