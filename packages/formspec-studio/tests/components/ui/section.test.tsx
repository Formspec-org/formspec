import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Section } from '../../../src/components/ui/Section';

describe('Section', () => {
  it('renders title', () => {
    render(<Section title="Identity"><div>content</div></Section>);
    expect(screen.getByText('Identity')).toBeInTheDocument();
  });

  it('shows children when expanded', () => {
    render(<Section title="Identity"><div>content</div></Section>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('hides children when collapsed', async () => {
    render(<Section title="Identity"><div>content</div></Section>);

    await act(async () => {
      screen.getByText('Identity').click();
    });

    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('remembers collapsed state across re-renders', async () => {
    const { rerender } = render(<Section title="Identity"><div>content</div></Section>);

    await act(async () => {
      screen.getByText('Identity').click();
    });
    expect(screen.queryByText('content')).not.toBeInTheDocument();

    rerender(<Section title="Identity"><div>content</div></Section>);
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });
});
