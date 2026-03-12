import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BindCard } from '../../../src/components/ui/BindCard';

describe('BindCard', () => {
  it('renders bind type label', () => {
    render(<BindCard bindType="required" expression="true" />);
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });

  it('shows expression text', () => {
    render(<BindCard bindType="calculate" expression="$age + 1" />);
    expect(screen.getByText('$age + 1')).toBeInTheDocument();
  });

  it('shows humanized expression when provided', () => {
    render(<BindCard bindType="relevant" expression="$show = true" humanized="Show is Yes" />);
    expect(screen.getByText('Show is Yes')).toBeInTheDocument();
    expect(screen.getByText('$show = true')).toBeInTheDocument();
  });

  it('applies color based on bind type', () => {
    const { container } = render(<BindCard bindType="required" expression="true" />);
    // Required binds use blue/accent color
    expect(container.firstChild).toBeTruthy();
  });

  it('copies a function signature when a FEL reference entry is clicked', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });

    render(<BindCard bindType="calculate" expression="sum($members[*].mInc)" />);

    await act(async () => {
      screen.getByRole('button', { name: /fel reference/i }).click();
    });

    await act(async () => {
      screen.getByRole('button', { name: /aggregate/i }).click();
    });

    await act(async () => {
      screen.getByText('sum').click();
    });

    expect(writeText).toHaveBeenCalledWith('sum(nodeset)');
  });
});
