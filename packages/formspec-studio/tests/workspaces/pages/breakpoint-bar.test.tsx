/** @filedesc Tests for the BreakpointBar component. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BreakpointBar } from '../../../src/workspaces/pages/BreakpointBar';

describe('BreakpointBar', () => {
  it('renders "Base" plus named breakpoints', () => {
    render(
      <BreakpointBar
        breakpointNames={['sm', 'md', 'lg']}
        active="base"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('sm')).toBeInTheDocument();
    expect(screen.getByText('md')).toBeInTheDocument();
    expect(screen.getByText('lg')).toBeInTheDocument();
  });

  it('highlights the active breakpoint', () => {
    render(
      <BreakpointBar
        breakpointNames={['sm', 'md']}
        active="sm"
        onSelect={() => {}}
      />,
    );
    const smButton = screen.getByText('sm').closest('button')!;
    const baseButton = screen.getByText('Base').closest('button')!;
    expect(smButton).toHaveAttribute('aria-pressed', 'true');
    expect(baseButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect with the breakpoint name when clicked', () => {
    const onSelect = vi.fn();
    render(
      <BreakpointBar
        breakpointNames={['sm', 'md']}
        active="base"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('md'));
    expect(onSelect).toHaveBeenCalledWith('md');
  });

  it('calls onSelect with "base" when Base is clicked', () => {
    const onSelect = vi.fn();
    render(
      <BreakpointBar
        breakpointNames={['sm', 'md']}
        active="sm"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Base'));
    expect(onSelect).toHaveBeenCalledWith('base');
  });

  it('shows tooltip with pixel value when breakpointValues is provided', () => {
    render(
      <BreakpointBar
        breakpointNames={['sm', 'md']}
        breakpointValues={{ sm: 576, md: 768 }}
        active="base"
        onSelect={() => {}}
      />,
    );
    const smButton = screen.getByText('sm').closest('button')!;
    expect(smButton).toHaveAttribute('title', 'sm (576px)');
    const mdButton = screen.getByText('md').closest('button')!;
    expect(mdButton).toHaveAttribute('title', 'md (768px)');
  });

  it('shows tooltip with name only when breakpointValues is undefined', () => {
    render(
      <BreakpointBar
        breakpointNames={['sm', 'md']}
        active="base"
        onSelect={() => {}}
      />,
    );
    const smButton = screen.getByText('sm').closest('button')!;
    expect(smButton).toHaveAttribute('title', 'sm');
  });

  it('renders with empty breakpoint names (only Base)', () => {
    render(
      <BreakpointBar
        breakpointNames={[]}
        active="base"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('Base')).toBeInTheDocument();
    // Only one button total
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
  });
});
