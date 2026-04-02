import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccordionSection } from '../../../src/components/ui/AccordionSection';

describe('AccordionSection', () => {
  const defaults = {
    title: 'Visibility',
    open: false,
    onToggle: vi.fn(),
  };

  it('renders title, subtitle, and badge', () => {
    render(
      <AccordionSection {...defaults} subtitle="2 rules" badge={3}>
        <p>content</p>
      </AccordionSection>,
    );
    expect(screen.getByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText('2 rules')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('sets aria-expanded true when open', () => {
    render(
      <AccordionSection {...defaults} open={true}>
        <p>body</p>
      </AccordionSection>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets aria-expanded false when closed', () => {
    render(
      <AccordionSection {...defaults} open={false}>
        <p>body</p>
      </AccordionSection>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('fires onToggle when header is clicked', () => {
    const onToggle = vi.fn();
    render(
      <AccordionSection {...defaults} onToggle={onToggle}>
        <p>body</p>
      </AccordionSection>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders children when open', () => {
    render(
      <AccordionSection {...defaults} open={true}>
        <p>visible content</p>
      </AccordionSection>,
    );
    expect(screen.getByText('visible content')).toBeInTheDocument();
  });

  it('does not render children when closed', () => {
    render(
      <AccordionSection {...defaults} open={false}>
        <p>hidden content</p>
      </AccordionSection>,
    );
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('applies the colorBar CSS class', () => {
    const { container } = render(
      <AccordionSection {...defaults} colorBar="border-l-logic">
        <p>body</p>
      </AccordionSection>,
    );
    const section = container.firstElementChild as HTMLElement;
    expect(section.className).toContain('border-l-logic');
  });

  it('renders badge with text value', () => {
    render(
      <AccordionSection {...defaults} badge="new">
        <p>body</p>
      </AccordionSection>,
    );
    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('renders badge with numeric value', () => {
    render(
      <AccordionSection {...defaults} badge={5}>
        <p>body</p>
      </AccordionSection>,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
