import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Pill } from '../../../src/components/ui/Pill';

describe('Pill', () => {
  it('renders text content', () => {
    render(<Pill text="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('applies color variant', () => {
    render(<Pill text="Calc" color="accent" />);
    const pill = screen.getByText('Calc');
    expect(pill.className).toContain('accent');
  });

  it('renders small variant', () => {
    render(<Pill text="Type" size="sm" />);
    const pill = screen.getByText('Type');
    expect(pill.className).toContain('text-xs');
  });

  it('defaults to normal size', () => {
    render(<Pill text="Label" />);
    const pill = screen.getByText('Label');
    expect(pill.className).not.toContain('text-xs');
  });
});
