/** @filedesc Tests for DisplayBlock resize handles — presence and grid-column CSS (mirrors FieldBlock). */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DisplayBlock } from '../../../src/workspaces/layout/DisplayBlock';
import type { LayoutContext } from '../../../src/workspaces/layout/FieldBlock';

const defaultProps = {
  itemKey: 'heading1',
  selectionKey: 'heading1',
  label: 'Introduction',
  widgetHint: 'Heading',
};

describe('DisplayBlock resize handles', () => {
  it('does not render resize handle when no layoutContext', () => {
    render(<DisplayBlock {...defaultProps} />);
    expect(screen.queryByTestId('resize-handle-col')).toBeNull();
  });

  it('does not render resize handle when parent is not a grid', () => {
    const ctx: LayoutContext = { parentContainerType: 'stack', parentGridColumns: 0, currentColSpan: 1 };
    render(<DisplayBlock {...defaultProps} layoutContext={ctx} />);
    expect(screen.queryByTestId('resize-handle-col')).toBeNull();
  });

  it('renders right-edge resize handle when parent is a grid', () => {
    const ctx: LayoutContext = { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 1 };
    render(<DisplayBlock {...defaultProps} layoutContext={ctx} />);
    expect(screen.getByTestId('resize-handle-col')).toBeInTheDocument();
  });

  it('hides resize handle when display block spans all grid columns', () => {
    const ctx: LayoutContext = { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 3 };
    render(<DisplayBlock {...defaultProps} layoutContext={ctx} />);
    expect(screen.queryByTestId('resize-handle-col')).toBeNull();
  });

  it('applies gridColumn CSS when parent is grid and nodeStyle.gridColumn is set', () => {
    const ctx: LayoutContext = { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 2 };
    const { container } = render(
      <DisplayBlock {...defaultProps} layoutContext={ctx} nodeStyle={{ gridColumn: 'span 2' }} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.gridColumn).toBe('span 2');
  });

  it('does not apply gridColumn CSS when parent is not a grid', () => {
    const ctx: LayoutContext = { parentContainerType: 'stack', parentGridColumns: 0, currentColSpan: 1 };
    const { container } = render(
      <DisplayBlock {...defaultProps} layoutContext={ctx} nodeStyle={{ gridColumn: 'span 2' }} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.gridColumn).toBe('');
  });

  it('shows the overflow dot when Tier 3 content exists', () => {
    const ctx: LayoutContext = { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 1 };
    render(
      <DisplayBlock
        {...defaultProps}
        selected
        onSetProp={vi.fn()}
        layoutContext={ctx}
        nodeProps={{ cssClass: 'hero-block' }}
      />,
    );

    expect(screen.getByTestId('toolbar-overflow-dot')).toBeInTheDocument();
  });
});
