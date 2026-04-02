/** @filedesc Unit tests for the Build/Manage segmented control. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BuildManageToggle } from '../../../src/workspaces/editor/BuildManageToggle';

describe('BuildManageToggle', () => {
  it('renders a radiogroup with Build and Manage options', () => {
    render(<BuildManageToggle activeView="build" onViewChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: /editor view/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Build' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Manage' })).toBeInTheDocument();
  });

  it('marks Build as checked when activeView is build', () => {
    render(<BuildManageToggle activeView="build" onViewChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Build' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'false');
  });

  it('marks Manage as checked when activeView is manage', () => {
    render(<BuildManageToggle activeView="manage" onViewChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Build' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Manage' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onViewChange when clicking the other option', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="build" onViewChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Manage' }));
    expect(onChange).toHaveBeenCalledWith('manage');
  });

  it('does not call onViewChange when clicking the already-active option', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="build" onViewChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Build' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports arrow key navigation between options', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="build" onViewChange={onChange} />);
    const buildRadio = screen.getByRole('radio', { name: 'Build' });
    fireEvent.keyDown(buildRadio, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('manage');
  });

  it('wraps around with arrow keys', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="manage" onViewChange={onChange} />);
    const manageRadio = screen.getByRole('radio', { name: 'Manage' });
    fireEvent.keyDown(manageRadio, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('build');
  });

  it('supports ArrowLeft navigation', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="manage" onViewChange={onChange} />);
    const manageRadio = screen.getByRole('radio', { name: 'Manage' });
    fireEvent.keyDown(manageRadio, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('build');
  });

  it('supports ArrowDown navigation', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="build" onViewChange={onChange} />);
    const buildRadio = screen.getByRole('radio', { name: 'Build' });
    fireEvent.keyDown(buildRadio, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('manage');
  });

  it('shows manage count badge when manageCount is provided', () => {
    render(<BuildManageToggle activeView="build" onViewChange={() => {}} manageCount={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('hides manage count badge when manageCount is zero', () => {
    render(<BuildManageToggle activeView="build" onViewChange={() => {}} manageCount={0} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('supports ArrowUp navigation', () => {
    const onChange = vi.fn();
    render(<BuildManageToggle activeView="manage" onViewChange={onChange} />);
    const manageRadio = screen.getByRole('radio', { name: 'Manage' });
    fireEvent.keyDown(manageRadio, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('build');
  });
});
