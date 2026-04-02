/** @filedesc Unit tests for AdvisoryCallout component. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdvisoryCallout } from '../../../src/components/ui/AdvisoryCallout';

describe('AdvisoryCallout', () => {
  it('renders message text', () => {
    render(<AdvisoryCallout message="Field is required but locked." />);
    expect(screen.getByText('Field is required but locked.')).toBeInTheDocument();
  });

  it('renders with info severity styling', () => {
    render(<AdvisoryCallout message="Info advisory" severity="info" />);
    const callout = screen.getByRole('status');
    expect(callout.className).toContain('border-l-blue-500');
    expect(callout.className).toContain('bg-blue-500/5');
  });

  it('renders with warning severity styling by default', () => {
    render(<AdvisoryCallout message="Warning advisory" />);
    const callout = screen.getByRole('status');
    expect(callout.className).toContain('border-l-amber');
    expect(callout.className).toContain('bg-amber/5');
  });

  it('renders action buttons with labels', () => {
    render(
      <AdvisoryCallout
        message="Test message"
        actions={[
          { label: 'Add formula', onClick: () => {} },
          { label: 'Add initial value', onClick: () => {} },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add formula' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add initial value' })).toBeInTheDocument();
  });

  it('has role="status" and aria-live="polite"', () => {
    render(<AdvisoryCallout message="Advisory" />);
    const callout = screen.getByRole('status');
    expect(callout).toHaveAttribute('aria-live', 'polite');
  });

  it('does not render a dismiss button', () => {
    render(
      <AdvisoryCallout
        message="Advisory"
        actions={[{ label: 'Fix it', onClick: () => {} }]}
      />,
    );
    // Only the action button should exist, no close/dismiss button
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Fix it');
  });

  it('fires onClick when action button is clicked', () => {
    const handler = vi.fn();
    render(
      <AdvisoryCallout
        message="Advisory"
        actions={[{ label: 'Add formula', onClick: handler }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add formula' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('renders without action buttons when actions is omitted', () => {
    render(<AdvisoryCallout message="Just a warning" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders ReactNode message content', () => {
    render(
      <AdvisoryCallout message={<span data-testid="custom">Rich content</span>} />,
    );
    expect(screen.getByTestId('custom')).toHaveTextContent('Rich content');
  });
});
