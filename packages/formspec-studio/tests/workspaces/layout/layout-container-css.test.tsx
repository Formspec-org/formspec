/** @filedesc Tests that LayoutContainer applies per-type CSS layout (Grid, Stack, Card, Panel, Collapsible). */
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LayoutContainer } from '../../../src/workspaces/layout/LayoutContainer';
import { useLayoutResizeReporter } from '../../../src/workspaces/layout/LayoutResizeContext';

// dnd-kit hooks mocked — no DndContext needed
vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({ ref: () => {}, isDragging: false }),
  useDroppable: () => ({ ref: () => {} }),
}));

function ResizeProbe() {
  const reportResize = useLayoutResizeReporter();

  useEffect(() => {
    reportResize({ axis: 'x', value: 3, cursor: { x: 120, y: 40 } });
    return () => reportResize(null);
  }, [reportResize]);

  return <div data-testid="resize-probe" />;
}

describe('LayoutContainer — Grid', () => {
  it('renders display:grid with grid-template-columns', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="n1" layoutProps={{ columns: 3 }} />,
    );
    // The children wrapper is what carries the CSS grid layout
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content).not.toBeNull();
    expect(content.style.display).toBe('grid');
    expect(content.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('applies gap from prop', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="n2" layoutProps={{ columns: 2, gap: '16px' }} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.gap).toBe('16px');
  });

  it('defaults to 2 columns when columns prop is missing', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="n3" layoutProps={{}} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });
});

describe('LayoutContainer — Stack', () => {
  it('renders display:flex with flex-direction from direction prop', () => {
    const { container } = render(
      <LayoutContainer component="Stack" nodeType="layout" nodeId="n4" layoutProps={{ direction: 'row' }} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.display).toBe('flex');
    expect(content.style.flexDirection).toBe('row');
  });

  it('defaults to column direction when direction prop is missing', () => {
    const { container } = render(
      <LayoutContainer component="Stack" nodeType="layout" nodeId="n5" layoutProps={{}} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.flexDirection).toBe('column');
  });

  it('applies flex-wrap from wrap prop (boolean true → "wrap")', () => {
    const { container } = render(
      <LayoutContainer component="Stack" nodeType="layout" nodeId="n6" layoutProps={{ direction: 'row', wrap: true }} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.flexWrap).toBe('wrap');
  });

  it('applies align-items from align prop', () => {
    const { container } = render(
      <LayoutContainer component="Stack" nodeType="layout" nodeId="n7" layoutProps={{ align: 'center' }} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.alignItems).toBe('center');
  });
});

describe('LayoutContainer — Card', () => {
  it('renders a card wrapper with data-component="Card"', () => {
    const { container } = render(
      <LayoutContainer component="Card" nodeType="layout" nodeId="n8" layoutProps={{}} />,
    );
    expect(container.querySelector('[data-component="Card"]')).not.toBeNull();
  });

  it('applies style.padding from nodeStyle prop', () => {
    const { container } = render(
      <LayoutContainer component="Card" nodeType="layout" nodeId="n9" layoutProps={{ nodeStyle: { padding: '24px' } }} />,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.padding).toBe('24px');
  });
});

describe('LayoutContainer — Collapsible', () => {
  it('renders title from prop', () => {
    render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="n10" layoutProps={{ title: 'My Section' }} />,
    );
    expect(screen.getByText('My Section')).toBeInTheDocument();
  });

  it('is open by default when defaultOpen is true', () => {
    const { container } = render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="n11" layoutProps={{ title: 'Sect', defaultOpen: true }}>
        <div data-testid="child-content">child</div>
      </LayoutContainer>,
    );
    expect(container.querySelector('[data-testid="child-content"]')).not.toBeNull();
  });

  it('is closed by default when defaultOpen is false', () => {
    const { container } = render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="n12" layoutProps={{ title: 'Sect', defaultOpen: false }}>
        <div data-testid="child-content">child</div>
      </LayoutContainer>,
    );
    // Children hidden when closed
    expect(container.querySelector('[data-layout-content]')).toBeNull();
  });

  it('toggles open/closed on header click', () => {
    const { container } = render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="n13" layoutProps={{ title: 'Sect', defaultOpen: false }}>
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
    render(<LayoutContainer component="Panel" nodeType="layout" nodeId="n14" layoutProps={{}} />);
    expect(screen.getByText('Panel')).toBeInTheDocument();
  });

  it('calls onSelect when select button is clicked', () => {
    const onSelect = vi.fn();
    render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="n15" onSelect={onSelect} layoutProps={{}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Grid/i }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe('LayoutContainer — Panel flex-column', () => {
  it('renders display:flex with flexDirection:column for Panel content area', () => {
    const { container } = render(
      <LayoutContainer component="Panel" nodeType="layout" nodeId="pan1" layoutProps={{}}>
        <div>child</div>
      </LayoutContainer>,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.display).toBe('flex');
    expect(content.style.flexDirection).toBe('column');
  });
});

describe('LayoutContainer — Collapsible flex-column', () => {
  it('renders display:flex with flexDirection:column for Collapsible content area', () => {
    const { container } = render(
      <LayoutContainer component="Collapsible" nodeType="layout" nodeId="col1" layoutProps={{ defaultOpen: true }}>
        <div>child</div>
      </LayoutContainer>,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.display).toBe('flex');
    expect(content.style.flexDirection).toBe('column');
  });
});

describe('LayoutContainer — Accordion flex-column', () => {
  it('renders display:flex with flexDirection:column for Accordion content area', () => {
    const { container } = render(
      <LayoutContainer component="Accordion" nodeType="layout" nodeId="acc1" layoutProps={{ defaultOpen: true }}>
        <div>child</div>
      </LayoutContainer>,
    );
    const content = container.querySelector('[data-layout-content]') as HTMLElement;
    expect(content.style.display).toBe('flex');
    expect(content.style.flexDirection).toBe('column');
  });
});

describe('LayoutContainer — insert slots for spatial DnD', () => {
  it('renders insert slots when nodeId is provided and isDragActive prop is true', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="g1" layoutProps={{ columns: 2 }} isDragActive>
        <div data-testid="child-1">one</div>
        <div data-testid="child-2">two</div>
      </LayoutContainer>,
    );
    // N+1 slots for N children: 2 children → 3 slots
    const slots = container.querySelectorAll('[data-testid^="insert-slot-"]');
    expect(slots.length).toBe(3);
  });

  it('does not render insert slots when isDragActive is false', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="g2" layoutProps={{ columns: 2 }}>
        <div>one</div>
      </LayoutContainer>,
    );
    const slots = container.querySelectorAll('[data-testid^="insert-slot-"]');
    expect(slots.length).toBe(0);
  });

  it('insert slots carry data-insert-index attributes', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="g3" layoutProps={{ columns: 2 }} isDragActive>
        <div>child</div>
      </LayoutContainer>,
    );
    // 1 child → 2 slots: index 0 (before) and index 1 (after)
    const slots = container.querySelectorAll('[data-testid^="insert-slot-"]');
    expect(slots.length).toBe(2);
    expect(slots[0].getAttribute('data-insert-index')).toBe('0');
    expect(slots[1].getAttribute('data-insert-index')).toBe('1');
  });

  it('empty container shows single insert slot when isDragActive', () => {
    const { container } = render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="g4" layoutProps={{ columns: 2 }} isDragActive />,
    );
    // No children → 1 slot at index 0 (replaces / overlaps with empty placeholder)
    const slots = container.querySelectorAll('[data-testid^="insert-slot-"]');
    expect(slots.length).toBe(1);
    expect(slots[0].getAttribute('data-insert-index')).toBe('0');
  });
});

describe('LayoutContainer — child resize reporting', () => {
  it('shows grid guides and the resize tooltip when a child reports an active resize', async () => {
    render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="g5" layoutProps={{ columns: 3 }}>
        <ResizeProbe />
      </LayoutContainer>,
    );

    expect(await screen.findByTestId('layout-resize-guides')).toBeInTheDocument();
    expect(screen.getByTestId('layout-resize-tooltip')).toHaveTextContent('3 col');
  });
});

describe('LayoutContainer — empty container placeholder', () => {
  it('shows drop placeholder when container has no children', () => {
    render(<LayoutContainer component="Grid" nodeType="layout" nodeId="empty1" layoutProps={{ columns: 2 }} />);
    expect(screen.getByTestId('empty-container-placeholder')).toBeInTheDocument();
  });

  it('placeholder contains instructional text', () => {
    render(<LayoutContainer component="Stack" nodeType="layout" nodeId="empty2" layoutProps={{}} />);
    const placeholder = screen.getByTestId('empty-container-placeholder');
    expect(placeholder.textContent).toMatch(/drop/i);
  });

  it('does not show placeholder when children are present', () => {
    render(
      <LayoutContainer component="Grid" nodeType="layout" nodeId="nonempty1" layoutProps={{ columns: 2 }}>
        <div>child</div>
      </LayoutContainer>,
    );
    expect(screen.queryByTestId('empty-container-placeholder')).toBeNull();
  });

  it('placeholder has dashed border styling class', () => {
    render(<LayoutContainer component="Grid" nodeType="layout" nodeId="empty3" layoutProps={{ columns: 2 }} />);
    const placeholder = screen.getByTestId('empty-container-placeholder');
    expect(placeholder.className).toMatch(/border-dashed/);
  });
});
