/** @filedesc Integration tests for FieldBlock resize handles — presence and grid-column CSS. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldBlock } from '../../../src/workspaces/layout/FieldBlock';
import type { LayoutContext } from '../../../src/workspaces/layout/FieldBlock';

// dnd-kit hooks are mocked so we don't need a DndContext wrapper
vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({ ref: () => {}, isDragging: false }),
}));

const defaultProps = {
  itemKey: 'name',
  bindPath: 'name',
  selectionKey: 'name',
  label: 'Full Name',
  dataType: 'string',
};

describe('FieldBlock resize handles', () => {
  it('does not render right-edge resize handle when no layoutContext', () => {
    render(<FieldBlock {...defaultProps} />);
    expect(screen.queryByTestId('resize-handle-col')).toBeNull();
  });

  it('does not render resize handle when parent is not a grid', () => {
    const ctx: LayoutContext = { parentContainerType: 'stack', parentGridColumns: 0, currentColSpan: 1 };
    render(<FieldBlock {...defaultProps} layoutContext={ctx} />);
    expect(screen.queryByTestId('resize-handle-col')).toBeNull();
  });

  it('renders right-edge resize handle when parent is a grid', () => {
    const ctx: LayoutContext = { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 1 };
    render(<FieldBlock {...defaultProps} layoutContext={ctx} />);
    expect(screen.getByTestId('resize-handle-col')).toBeInTheDocument();
  });

  it('hides right-edge resize handle when field spans all grid columns', () => {
    const ctx: LayoutContext = { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 3 };
    render(<FieldBlock {...defaultProps} layoutContext={ctx} />);
    expect(screen.queryByTestId('resize-handle-col')).toBeNull();
  });

  it('applies gridColumn CSS when parent is grid and gridColumn style is set', () => {
    const ctx: LayoutContext = { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 2 };
    const { container } = render(
      <FieldBlock {...defaultProps} layoutContext={ctx} nodeStyle={{ gridColumn: 'span 2' }} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.gridColumn).toBe('span 2');
  });

  it('does not apply gridColumn CSS when parent is not a grid', () => {
    const ctx: LayoutContext = { parentContainerType: 'stack', parentGridColumns: 0, currentColSpan: 1 };
    const { container } = render(
      <FieldBlock {...defaultProps} layoutContext={ctx} nodeStyle={{ gridColumn: 'span 2' }} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.gridColumn).toBe('');
  });
});
