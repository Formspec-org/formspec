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

  it('renders title attribute for spec-term discoverability', () => {
    render(<Pill text="must fill" title="required" />);
    const pill = screen.getByText('must fill');
    expect(pill).toHaveAttribute('title', 'required');
  });

  it('omits title attribute when not provided', () => {
    render(<Pill text="must fill" />);
    const pill = screen.getByText('must fill');
    expect(pill).not.toHaveAttribute('title');
  });

  it('appends warning indicator when warn is true', () => {
    render(<Pill text="shows if" warn />);
    const pill = screen.getByText(/shows if/);
    expect(pill.textContent).toContain('\u26A0');
  });

  it('applies warning border class when warn is true', () => {
    render(<Pill text="formula" warn />);
    const pill = screen.getByText(/formula/);
    expect(pill.className).toContain('border-amber');
  });

  it('does not append warning indicator when warn is false or omitted', () => {
    render(<Pill text="locked" />);
    const pill = screen.getByText('locked');
    expect(pill.textContent).not.toContain('\u26A0');
  });
});
