import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WizardNav } from '../../../src/workspaces/preview/WizardNav';

describe('WizardNav', () => {
  it('shows step indicators', () => {
    render(<WizardNav pageCount={3} currentPage={0} onNavigate={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows Continue button', () => {
    render(<WizardNav pageCount={3} currentPage={0} onNavigate={vi.fn()} />);
    expect(screen.getByText(/continue/i)).toBeInTheDocument();
  });

  it('shows Back button on non-first page', () => {
    render(<WizardNav pageCount={3} currentPage={1} onNavigate={vi.fn()} />);
    expect(screen.getByText(/back/i)).toBeInTheDocument();
  });

  it('shows Submit on final page', () => {
    render(<WizardNav pageCount={3} currentPage={2} onNavigate={vi.fn()} />);
    expect(screen.getByText(/submit/i)).toBeInTheDocument();
  });

  it('Continue advances to next page', async () => {
    const onNavigate = vi.fn();
    render(<WizardNav pageCount={3} currentPage={0} onNavigate={onNavigate} />);
    await act(async () => {
      screen.getByText(/continue/i).click();
    });
    expect(onNavigate).toHaveBeenCalledWith(1);
  });
});
