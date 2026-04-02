/** @filedesc Tests that LayoutContainer applies per-type CSS layout (Grid, Stack, Card, Panel, Collapsible). */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayoutContainer } from '../../../src/workspaces/layout/LayoutContainer';

// dnd-kit hooks mocked — no DndContext needed
vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({ ref: () => {}, isDragging: false }),
  useDroppable: () => ({ ref: () => {} }),
}));

describe('LayoutContainer — Grid', () => {
  it('renders display:grid with grid-template-columns', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="n1" columns={3} />,
    );
    // The children wrapper is what carries the CSS grid layout
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content).not.toBeNull();
    expect(content.style.display).toBe('grid');
    expect(content.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('applies gap from prop', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="n2" columns={2} gap="16px" />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.gap).toBe('16px');
  });

  it('defaults to 2 columns when columns prop is missing', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="n3" />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });
});

describe('LayoutContainer — Stack', () => {
  it('renders display:flex with flex-direction from direction prop', () => {
    const { container } = render(
      <LayoutContainer component="Stack" nodeType="layout" nodeId="n4" direction="row" />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.display).toBe('flex');
    expect(content.style.flexDirection).toBe('row');
  });

  it('defaults to column direction when direction prop is missing', () => {
    const { container } = render(
      <LayoutContainer component="Stack" nodeType="layout" nodeId="n5" />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.flexDirection).toBe('column');
  });

  it('applies flex-wrap from wrap prop (boolean true → "wrap")', () => {
    const { container } = render(
      <LayoutContainer component="Stack" nodeType="layout" nodeId="n6" direction="row" wrap={true} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.flexWrap).toBe('wrap');
  });

  it('applies align-items from align prop', () => {
    const { container } = render(
      <LayoutContainer component="Stack" nodeType="layout" nodeId="n7" align="center" />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.alignItems).toBe('center');
  });
});

describe('LayoutContainer — Card', () => {
  it('renders a card wrapper with data-component="Card"', () => {
    const { container } = render(
      <LayoutContainer component="Card" nodeType="layout" nodeId="n8" />,
    );
    expect(container.querySelector('[data-component="Card"]')).not.toBeNull();
  });

  it('applies style.padding from nodeStyle prop', () => {
    const { container } = render(
      <LayoutContainer component="Card" nodeType="layout" nodeId="n9" nodeStyle={{ padding: '24px' }} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.padding).toBe('24px');
  });
});

describe('LayoutContainer — Collapsible', () => {
  it('renders title from prop', () => {
    render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="n10" title="My Section" />,
    );
    expect(screen.getByText('My Section')).toBeInTheDocument();
  });

  it('is open by default when defaultOpen is true', () => {
    const { container } = render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="n11" title="Sect" defaultOpen>
        <div data-testid="child-content">child</div>
      </LayoutContainer>,
    );
    expect(container.querySelector('[data-testid="child-content"]')).not.toBeNull();
  });

  it('is closed by default when defaultOpen is false', () => {
    const { container } = render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="n12" title="Sect" defaultOpen={false}>
        <div data-testid="child-content">child</div>
      </LayoutContainer>,
    );
    // Children hidden when closed
    expect(container.querySelector('[data-layout-content]')).toBeNull();
  });

  it('toggles open/closed on header click', () => {
    const { container } = render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="n13" title="Sect" defaultOpen={false}>
        <div data-testid="child-content">child</div>
      </LayoutContainer>,
    );
    expect(container.querySelector('[data-layout-content]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Sect/i }));
    expect(container.querySelector('[data-layout-content]')).not.toBeNull();
  });
});

describe('LayoutContainer — generic header', () => {
  it('shows component type badge', () => {
    render(<LayoutContainer component="Panel" nodeType="layout" nodeId="n14" />);
    expect(screen.getByText('Panel')).toBeInTheDocument();
  });

  it('calls onSelect when select button is clicked', () => {
    const onSelect = vi.fn();
    render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="n15" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Grid/i }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe('LayoutContainer — empty container placeholder', () => {
  it('shows drop placeholder when container has no children', () => {
    render(<LayoutContainer component="Grid" nodeType="layout" nodeId="empty1" columns={2} />);
    expect(screen.getByTestId('empty-container-placeholder')).toBeInTheDocument();
  });

  it('placeholder contains instructional text', () => {
    render(<LayoutContainer component="Stack" nodeType="layout" nodeId="empty2" />);
    const placeholder = screen.getByTestId('empty-container-placeholder');
    expect(placeholder.textContent).toMatch(/drop/i);
  });

  it('does not show placeholder when children are present', () => {
    render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="nonempty1" columns={2}>
        <div>child</div>
      </LayoutContainer>,
    );
    expect(screen.queryByTestId('empty-container-placeholder')).toBeNull();
  });

  it('placeholder has dashed border styling class', () => {
    render(<LayoutContainer component="Grid" nodeType="layout" nodeId="empty3" columns={2} />);
    const placeholder = screen.getByTestId('empty-container-placeholder');
    expect(placeholder.className).toMatch(/border-dashed/);
  });
});
