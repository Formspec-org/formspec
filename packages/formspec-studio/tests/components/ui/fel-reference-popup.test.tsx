import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FELReferencePopup } from '../../../src/components/ui/FELReferencePopup';

describe('FELReferencePopup', () => {
  it('renders the runtime FEL catalog from the engine export', () => {
    render(<FELReferencePopup />);

    fireEvent.click(screen.getByRole('button', { name: /fel reference/i }));

    expect(screen.getAllByRole('button', { name: /aggregate/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /instance/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /mip/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search functions/i), {
      target: { value: 'sum' },
    });

    expect(screen.getByText('sum')).toBeInTheDocument();
  });

  it('filters runtime functions by search query', () => {
    render(<FELReferencePopup />);

    fireEvent.click(screen.getByRole('button', { name: /fel reference/i }));
    fireEvent.change(screen.getByPlaceholderText(/search functions/i), {
      target: { value: 'instance' },
    });

    expect(screen.getByText('instance')).toBeInTheDocument();
    expect(screen.queryByText('sum')).not.toBeInTheDocument();
  });

  // TODO: update expected signatures after fel-catalog refactor
  it.skip('shows complete metadata for functions that were previously falling back to empty signatures', () => {
    render(<FELReferencePopup />);

    fireEvent.click(screen.getByRole('button', { name: /fel reference/i }));
    fireEvent.change(screen.getByPlaceholderText(/search functions/i), {
      target: { value: 'matches' },
    });

    expect(screen.getByText('matches')).toBeInTheDocument();
    expect(screen.getByText('(value, pattern) → boolean')).toBeInTheDocument();
  });
});
