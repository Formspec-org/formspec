import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddItemPalette, FIELD_TYPE_CATALOG } from '../../src/components/AddItemPalette';

describe('AddItemPalette', () => {
  it('uses a single-column results layout on narrow screens', () => {
    render(
      <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} />
    );

    const textCard = screen.getByRole('button', { name: /^Text Block\b/i });
    const resultsGrid = textCard.parentElement;

    expect(resultsGrid).toHaveClass(/grid-cols-1/);
  });

  it('shows Layout category with Card, Columns, Collapsible, Stack', () => {
    render(
      <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /^Card\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Columns\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Collapsible\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Stack\b/i })).toBeInTheDocument();
  });

  it('hides only layout components in editor scope', () => {
    render(
      <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} scope="editor" />
    );

    expect(screen.queryByRole('button', { name: /^Card\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Columns\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Collapsible\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Stack\b/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Group\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Text Short text\b/i })).toBeInTheDocument();
    // Editor scope excludes display and layout catalog entries (Layout workspace adds those).
    expect(screen.queryByRole('button', { name: /^Heading\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Divider\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Text Block\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Spacer\b/i })).not.toBeInTheDocument();
  });

  it('uses a scoped search prompt in editor scope', () => {
    render(
      <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} scope="editor" />
    );

    expect(screen.getByPlaceholderText('Search inputs and groups...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search types...')).not.toBeInTheDocument();
  });

  it('uses a plain search row without wrapper focus effects', () => {
    render(
      <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} scope="editor" />
    );

    expect(screen.getByTestId('add-item-search')).not.toHaveClass('focus-within:ring-4');
    expect(screen.getByTestId('add-item-search')).not.toHaveClass('focus-within:border-accent/70');
  });

  it('shows Content sub-types: Heading, Divider; Spacer is now in Layout (not a display widgetHint)', () => {
    render(
      <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /^Heading\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Divider\b/i })).toBeInTheDocument();
    // Spacer is in the Layout category now (component-tier, no widgetHint)
    expect(screen.getByRole('button', { name: /^Spacer\b/i })).toBeInTheDocument();
  });

  it('layout items have itemType "layout" in catalog', () => {
    const layoutItems = FIELD_TYPE_CATALOG.filter(f => f.itemType === 'layout' as any);
    expect(layoutItems.length).toBeGreaterThanOrEqual(4);
    const labels = layoutItems.map(l => l.label);
    expect(labels).toContain('Card');
    expect(labels).toContain('Columns');
    expect(labels).toContain('Collapsible');
    expect(labels).toContain('Stack');
  });

  it('Heading item has display itemType with spec-lowercase widgetHint in extra (CoreSpec S4.2.5.1)', () => {
    const heading = FIELD_TYPE_CATALOG.find(f => f.label === 'Heading');
    expect(heading).toBeDefined();
    expect(heading!.itemType).toBe('display');
    expect((heading!.extra as any)?.presentation?.widgetHint).toBe('heading');
  });

  describe('canonical dataType values for choice fields', () => {
    it('Single Choice uses canonical dataType "choice" (not "select1")', () => {
      const singleChoice = FIELD_TYPE_CATALOG.find(f => f.label === 'Single Choice');
      expect(singleChoice).toBeDefined();
      expect(singleChoice!.dataType).toBe('choice');
    });

    it('Multiple Choice uses canonical dataType "multiChoice" (not "select")', () => {
      const multiChoice = FIELD_TYPE_CATALOG.find(f => f.label === 'Multiple Choice');
      expect(multiChoice).toBeDefined();
      expect(multiChoice!.dataType).toBe('multiChoice');
    });

    it('clicking Single Choice calls onAdd with dataType "choice"', () => {
      const onAdd = vi.fn();
      render(<AddItemPalette open={true} onClose={vi.fn()} onAdd={onAdd} />);
      fireEvent.click(screen.getByRole('button', { name: /^Single Choice\b/i }));
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ dataType: 'choice' })
      );
    });

    it('clicking Multiple Choice calls onAdd with dataType "multiChoice"', () => {
      const onAdd = vi.fn();
      render(<AddItemPalette open={true} onClose={vi.fn()} onAdd={onAdd} />);
      fireEvent.click(screen.getByRole('button', { name: /^Multiple Choice\b/i }));
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ dataType: 'multiChoice' })
      );
    });
  });

  describe('Tabs', () => {
    it('renders all tabs', () => {
      render(
        <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} />
      );
      expect(screen.getByRole('button', { name: /^All$/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Inputs$/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Layout$/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Display$/ })).toBeInTheDocument();
    });

    it('omits the tab bar entirely in editor scope', () => {
      render(
        <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} scope="editor" />
      );

      expect(screen.queryByRole('button', { name: /^All$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Inputs$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Layout$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Display$/ })).not.toBeInTheDocument();
    });

    it('filters items when clicking Layout tab', () => {
      render(
        <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} />
      );
      
      // Initially "All" is active, "Integer" should be visible
      expect(screen.getByRole('button', { name: /^Integer\s/i })).toBeInTheDocument();
      
      // Click Layout tab
      fireEvent.click(screen.getByRole('button', { name: /^Layout$/ }));
      
      // "Integer" (Input) should disappear
      expect(screen.queryByRole('button', { name: /^Integer\s/i })).not.toBeInTheDocument();
      
      // "Card" (Layout) should still be visible
      expect(screen.getByRole('button', { name: /^Card\s/i })).toBeInTheDocument();
      // "Group" (Structure/Layout) should also be visible
      expect(screen.getByRole('button', { name: /^Group\s/i })).toBeInTheDocument();
    });

    it('filters items when searching within a tab', () => {
      render(
        <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} />
      );
      
      // Click Layout tab
      fireEvent.click(screen.getByRole('button', { name: /^Layout$/ }));
      
      // Search for "Card"
      const input = screen.getByPlaceholderText(/Search types/i);
      fireEvent.change(input, { target: { value: 'Card' } });
      
      expect(screen.getByRole('button', { name: /^Card\s/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Columns\s/i })).not.toBeInTheDocument();
    });

    it('shows only display items in Display tab', () => {
      render(
        <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} />
      );
      
      // Click Display tab
      fireEvent.click(screen.getByRole('button', { name: /^Display$/ }));
      
      expect(screen.getByRole('button', { name: /^Heading\s/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Integer\s/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Card\s/i })).not.toBeInTheDocument();
    });
  });
});
