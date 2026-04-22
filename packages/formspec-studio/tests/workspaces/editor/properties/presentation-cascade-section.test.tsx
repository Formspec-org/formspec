import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PresentationCascadeSection } from '../../../../src/workspaces/editor/properties/PresentationCascadeSection';
import type { ResolvedProperty } from '@formspec-org/studio-core';

const emptyCascade: Record<string, ResolvedProperty> = {};

const singleEntryCascade: Record<string, ResolvedProperty> = {
  widgetHint: { value: 'textarea', source: 'item-hint' },
};

const multiLevelCascade: Record<string, ResolvedProperty> = {
  labelPosition: { value: 'hidden', source: 'selector', sourceDetail: 'selector #1: field' },
  widget: { value: 'Textarea', source: 'item-override' },
  widgetHint: { value: 'textarea', source: 'item-hint' },
};

describe('PresentationCascadeSection', () => {
  it('renders nothing when cascade is empty', () => {
    const { container } = render(
      <PresentationCascadeSection cascade={emptyCascade} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders cascade rows for each property', () => {
    render(<PresentationCascadeSection cascade={multiLevelCascade} />);
    expect(screen.getByTestId('cascade-row-widgetHint')).toBeInTheDocument();
    expect(screen.getByTestId('cascade-row-labelPosition')).toBeInTheDocument();
    expect(screen.getByTestId('cascade-row-widget')).toBeInTheDocument();
  });

  it('shows the effective value', () => {
    render(<PresentationCascadeSection cascade={singleEntryCascade} />);
    expect(screen.getByTestId('cascade-row-widgetHint').textContent).toContain('textarea');
  });

  it('shows source badges with correct labels', () => {
    render(<PresentationCascadeSection cascade={multiLevelCascade} />);
    expect(screen.getByTestId('cascade-badge-item-hint').textContent).toBe('Definition');
    expect(screen.getByTestId('cascade-badge-selector').textContent).toBe('Selector');
    expect(screen.getByTestId('cascade-badge-item-override').textContent).toBe('Override');
  });

  it('shows form-default badge', () => {
    const cascade: Record<string, ResolvedProperty> = { labelPosition: { value: 'start', source: 'form-default' } };
    render(<PresentationCascadeSection cascade={cascade} />);
    expect(screen.getByTestId('cascade-badge-form-default').textContent).toBe('Form Default');
  });

  it('shows theme default badge', () => {
    const cascade: Record<string, ResolvedProperty> = { labelPosition: { value: 'top', source: 'default' } };
    render(<PresentationCascadeSection cascade={cascade} />);
    expect(screen.getByTestId('cascade-badge-default').textContent).toBe('Theme Default');
  });

  it('shows the help text', () => {
    render(<PresentationCascadeSection cascade={singleEntryCascade} />);
    expect(screen.getByText(/which tier sets each presentation property/)).toBeInTheDocument();
  });
});
