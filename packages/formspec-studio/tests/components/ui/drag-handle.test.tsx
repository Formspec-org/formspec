import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DragHandle } from '../../../src/components/ui/DragHandle';

describe('DragHandle', () => {
  it('renders a grip icon with drag-handle testid', () => {
    render(<DragHandle />);
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<DragHandle className="extra" />);
    const el = screen.getByTestId('drag-handle');
    expect(el.className).toContain('extra');
  });

  it('forwards ref to the root element', () => {
    const ref = { current: null } as React.MutableRefObject<Element | null>;
    render(<DragHandle ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
