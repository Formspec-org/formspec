/** @filedesc Tests for InlineToolbar — per-container-type compact toolbar with condition chip and overflow button. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineToolbar, type InlineToolbarProps } from '../../../src/workspaces/layout/InlineToolbar';

// ── Shared mocks ──────────────────────────────────────────────────────────

vi.mock('@formspec-org/studio-core', () => ({
  compatibleWidgets: (type: string, dataType?: string) => {
    if (type === 'field' && dataType === 'string') return ['TextInput', 'TextArea'];
    if (type === 'field' && dataType === 'integer') return ['NumberInput'];
    return [];
  },
  setColumnSpan: vi.fn(),
  setPadding: vi.fn(),
}));

// InlineExpression is click-to-edit; mock it so we can test the chip rendering
vi.mock('../../../src/components/ui/InlineExpression', () => ({
  InlineExpression: ({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) => (
    <div data-testid="inline-expression" data-value={value} data-placeholder={placeholder}>
      <button type="button" data-testid="inline-expression-save" onClick={() => onSave('new-expr')}>
        {value || placeholder}
      </button>
    </div>
  ),
}));

// ── Base props helpers ────────────────────────────────────────────────────

function makeContainerProps(overrides: Partial<InlineToolbarProps> = {}): InlineToolbarProps {
  return {
    selectionKey: '__node:n1',
    nodeId: 'n1',
    component: 'Grid',
    nodeProps: {},
    onSetProp: vi.fn(),
    onSetStyle: vi.fn(),
    onOpenPopover: vi.fn(),
    hasPopoverContent: false,
    ...overrides,
  };
}

function makeFieldProps(overrides: Partial<InlineToolbarProps> = {}): InlineToolbarProps {
  return {
    selectionKey: 'email',
    itemKey: 'email',
    component: 'TextInput',
    nodeProps: {},
    itemType: 'field',
    itemDataType: 'string',
    onSetProp: vi.fn(),
    onOpenPopover: vi.fn(),
    hasPopoverContent: false,
    layoutContext: { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 1 },
    ...overrides,
  };
}

// ── Grid toolbar ──────────────────────────────────────────────────────────

describe('InlineToolbar — Grid', () => {
  it('renders columns stepper showing current value', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: { columns: 3 } })} />);
    expect(screen.getByTestId('toolbar-columns-value')).toHaveTextContent('3');
    expect(screen.getByTestId('toolbar-columns-dec')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-columns-inc')).toBeInTheDocument();
  });

  it('increments columns and calls onSetProp', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: { columns: 3 }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-columns-inc'));
    expect(onSetProp).toHaveBeenCalledWith('columns', 4);
  });

  it('decrements columns and calls onSetProp', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: { columns: 3 }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-columns-dec'));
    expect(onSetProp).toHaveBeenCalledWith('columns', 2);
  });

  it('clamps columns at minimum 1 — dec at 1 does not call onSetProp', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: { columns: 1 }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-columns-dec'));
    expect(onSetProp).not.toHaveBeenCalled();
  });

  it('clamps columns at maximum 12 — inc at 12 does not call onSetProp', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: { columns: 12 }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-columns-inc'));
    expect(onSetProp).not.toHaveBeenCalled();
  });

  it('defaults to 2 columns when columns prop is absent', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-columns-value')).toHaveTextContent('2');
  });

  it('renders gap dropdown', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-gap')).toBeInTheDocument();
  });

  it('renders padding dropdown', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-padding')).toBeInTheDocument();
  });

  it('calls onSetProp with gap value when gap changes', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {}, onSetProp })} />);
    fireEvent.change(screen.getByTestId('toolbar-gap'), { target: { value: 'md' } });
    expect(onSetProp).toHaveBeenCalledWith('gap', 'md');
  });

  it('calls onSetStyle with padding value (NOT onSetProp) — schema has unevaluatedProperties:false', () => {
    const onSetProp = vi.fn();
    const onSetStyle = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {}, onSetProp, onSetStyle })} />);
    fireEvent.change(screen.getByTestId('toolbar-padding'), { target: { value: 'md' } });
    expect(onSetStyle).toHaveBeenCalledWith('padding', 'md');
    expect(onSetProp).not.toHaveBeenCalledWith('padding', expect.anything());
  });
});

// ── Stack toolbar ─────────────────────────────────────────────────────────

describe('InlineToolbar — Stack', () => {
  it('renders direction toggle buttons', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Stack', nodeProps: { direction: 'column' } })} />);
    expect(screen.getByTestId('toolbar-direction-row')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-direction-column')).toBeInTheDocument();
  });

  it('calls onSetProp with row when row button clicked', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Stack', nodeProps: { direction: 'column' }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-direction-row'));
    expect(onSetProp).toHaveBeenCalledWith('direction', 'row');
  });

  it('calls onSetProp with column when column button clicked', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Stack', nodeProps: { direction: 'row' }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-direction-column'));
    expect(onSetProp).toHaveBeenCalledWith('direction', 'column');
  });

  it('renders wrap toggle button', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Stack', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-wrap-toggle')).toBeInTheDocument();
  });

  it('toggles wrap from false to true (boolean, not string)', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Stack', nodeProps: { wrap: false }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-wrap-toggle'));
    expect(onSetProp).toHaveBeenCalledWith('wrap', true);
  });

  it('toggles wrap from true to false (boolean, not string)', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Stack', nodeProps: { wrap: true }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-wrap-toggle'));
    expect(onSetProp).toHaveBeenCalledWith('wrap', false);
  });

  it('renders gap and align dropdowns', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Stack', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-gap')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-align')).toBeInTheDocument();
  });
});

// ── Card toolbar ──────────────────────────────────────────────────────────

describe('InlineToolbar — Card', () => {
  it('renders elevation stepper', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Card', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-elevation-dec')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-elevation-inc')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-elevation-value')).toHaveTextContent('1');
  });

  it('calls onSetProp with elevation number when increment clicked', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Card', nodeProps: {}, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-elevation-inc'));
    expect(onSetProp).toHaveBeenCalledWith('elevation', 2);
  });

  it('renders padding dropdown', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Card', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-padding')).toBeInTheDocument();
  });

  it('calls onSetStyle with padding value (NOT onSetProp) — schema has unevaluatedProperties:false', () => {
    const onSetProp = vi.fn();
    const onSetStyle = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Card', nodeProps: {}, onSetProp, onSetStyle })} />);
    fireEvent.change(screen.getByTestId('toolbar-padding'), { target: { value: 'lg' } });
    expect(onSetStyle).toHaveBeenCalledWith('padding', 'lg');
    expect(onSetProp).not.toHaveBeenCalledWith('padding', expect.anything());
  });
});

// ── Panel toolbar ─────────────────────────────────────────────────────────

describe('InlineToolbar — Panel', () => {
  it('renders position toggle buttons left and right', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Panel', nodeProps: { position: 'left' } })} />);
    expect(screen.getByTestId('toolbar-position-left')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-position-right')).toBeInTheDocument();
  });

  it('calls onSetProp with right when right toggle clicked', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Panel', nodeProps: { position: 'left' }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-position-right'));
    expect(onSetProp).toHaveBeenCalledWith('position', 'right');
  });

  it('renders width input', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Panel', nodeProps: { width: '300px' } })} />);
    expect(screen.getByTestId('toolbar-width-input')).toHaveValue('300px');
  });

  it('commits width on blur', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Panel', nodeProps: { width: '300px' }, onSetProp })} />);
    const input = screen.getByTestId('toolbar-width-input');
    fireEvent.change(input, { target: { value: '400px' } });
    fireEvent.blur(input);
    expect(onSetProp).toHaveBeenCalledWith('width', '400px');
  });

  it('width draft syncs when nodeProps changes (undo/redo)', () => {
    const { rerender } = render(<InlineToolbar {...makeContainerProps({ component: 'Panel', nodeProps: { width: '300px' } })} />);
    expect(screen.getByTestId('toolbar-width-input')).toHaveValue('300px');
    rerender(<InlineToolbar {...makeContainerProps({ component: 'Panel', nodeProps: { width: '200px' } })} />);
    expect(screen.getByTestId('toolbar-width-input')).toHaveValue('200px');
  });
});

// ── Collapsible / Accordion toolbar ──────────────────────────────────────

describe('InlineToolbar — Collapsible', () => {
  it('renders title input', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Collapsible', nodeProps: { title: 'My Section' } })} />);
    expect(screen.getByTestId('toolbar-title-input')).toHaveValue('My Section');
  });

  it('commits title on blur', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Collapsible', nodeProps: { title: '' }, onSetProp })} />);
    const input = screen.getByTestId('toolbar-title-input');
    fireEvent.change(input, { target: { value: 'New Title' } });
    fireEvent.blur(input);
    expect(onSetProp).toHaveBeenCalledWith('title', 'New Title');
  });

  it('title draft syncs when nodeProps changes (undo/redo)', () => {
    const { rerender } = render(<InlineToolbar {...makeContainerProps({ component: 'Collapsible', nodeProps: { title: 'Old Title' } })} />);
    expect(screen.getByTestId('toolbar-title-input')).toHaveValue('Old Title');
    rerender(<InlineToolbar {...makeContainerProps({ component: 'Collapsible', nodeProps: { title: 'New Title' } })} />);
    expect(screen.getByTestId('toolbar-title-input')).toHaveValue('New Title');
  });

  it('renders default-open toggle', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Collapsible', nodeProps: { defaultOpen: false } })} />);
    expect(screen.getByTestId('toolbar-default-open')).toBeInTheDocument();
  });

  it('toggles defaultOpen', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Collapsible', nodeProps: { defaultOpen: false }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('toolbar-default-open'));
    expect(onSetProp).toHaveBeenCalledWith('defaultOpen', true);
  });
});

describe('InlineToolbar — Accordion', () => {
  it('renders title input and default-open toggle', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Accordion', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-default-open')).toBeInTheDocument();
  });
});

// ── Field toolbar ─────────────────────────────────────────────────────────

describe('InlineToolbar — Field', () => {
  it('renders widget dropdown when multiple widgets available for dataType', () => {
    render(<InlineToolbar {...makeFieldProps({ itemType: 'field', itemDataType: 'string' })} />);
    expect(screen.getByTestId('toolbar-widget')).toBeInTheDocument();
  });

  it('does not render widget dropdown when only one widget available', () => {
    render(<InlineToolbar {...makeFieldProps({ itemType: 'field', itemDataType: 'integer' })} />);
    expect(screen.queryByTestId('toolbar-widget')).toBeNull();
  });

  it('calls onSetProp with component type when widget dropdown changes', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeFieldProps({ itemType: 'field', itemDataType: 'string', onSetProp })} />);
    fireEvent.change(screen.getByTestId('toolbar-widget'), { target: { value: 'TextArea' } });
    expect(onSetProp).toHaveBeenCalledWith('component', 'TextArea');
  });

  it('renders span stepper when parent is a grid', () => {
    render(<InlineToolbar {...makeFieldProps({ layoutContext: { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 1 } })} />);
    expect(screen.getByTestId('toolbar-span-dec')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-span-inc')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar-span-value')).toHaveTextContent('1');
  });

  it('does not render span stepper when parent is not grid', () => {
    render(<InlineToolbar {...makeFieldProps({ layoutContext: { parentContainerType: 'stack', parentGridColumns: 0, currentColSpan: 1 } })} />);
    expect(screen.queryByTestId('toolbar-span-dec')).toBeNull();
  });

  it('increments span and calls onSetStyle with gridColumn', () => {
    const onSetStyle = vi.fn();
    render(<InlineToolbar {...makeFieldProps({ onSetStyle, layoutContext: { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 1 } })} />);
    fireEvent.click(screen.getByTestId('toolbar-span-inc'));
    expect(onSetStyle).toHaveBeenCalledWith('gridColumn', 'span 2');
  });

  it('decrements span and calls onSetStyle with gridColumn', () => {
    const onSetStyle = vi.fn();
    render(<InlineToolbar {...makeFieldProps({ onSetStyle, layoutContext: { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 2 } })} />);
    fireEvent.click(screen.getByTestId('toolbar-span-dec'));
    expect(onSetStyle).toHaveBeenCalledWith('gridColumn', 'span 1');
  });

  it('clamps span at 1 minimum', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeFieldProps({ onSetProp, layoutContext: { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 1 } })} />);
    fireEvent.click(screen.getByTestId('toolbar-span-dec'));
    expect(onSetProp).not.toHaveBeenCalled();
  });

  it('clamps span at parentGridColumns maximum', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeFieldProps({ onSetProp, layoutContext: { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 3 } })} />);
    fireEvent.click(screen.getByTestId('toolbar-span-inc'));
    expect(onSetProp).not.toHaveBeenCalled();
  });

  it('RED test: column span stepper must write to style.gridColumn via onSetStyle, not top-level prop', () => {
    const onSetProp = vi.fn();
    const onSetStyle = vi.fn();
    render(<InlineToolbar {...makeFieldProps({
      onSetProp,
      onSetStyle,
      layoutContext: { parentContainerType: 'grid', parentGridColumns: 3, currentColSpan: 1 },
    })} />);
    fireEvent.click(screen.getByTestId('toolbar-span-inc'));
    // BUG: stepper currently calls onSetProp('gridColumn', 'span 2')
    // CORRECT: stepper should call onSetStyle('gridColumn', 'span 2')
    expect(onSetStyle).toHaveBeenCalledWith('gridColumn', 'span 2');
    expect(onSetProp).not.toHaveBeenCalledWith('gridColumn', expect.anything());
  });
});

// ── Condition chip ────────────────────────────────────────────────────────

describe('InlineToolbar — condition chip', () => {
  it('shows "+ condition" affordance when when is not set', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-condition-chip')).toBeInTheDocument();
    // InlineExpression mock renders placeholder when value is empty
    expect(screen.getByTestId('inline-expression')).toHaveAttribute('data-placeholder', 'Always shown (rendering only)');
  });

  it('shows "if: ..." chip when when expression is set', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: { when: 'age > 18' } })} />);
    expect(screen.getByTestId('inline-expression')).toHaveAttribute('data-value', 'age > 18');
    expect(screen.getByTitle('This hides the component only. Use relevant in Editor to control data.')).toBeInTheDocument();
  });

  it('calls onSetProp with new when expression when saved', () => {
    const onSetProp = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: { when: 'old' }, onSetProp })} />);
    fireEvent.click(screen.getByTestId('inline-expression-save'));
    expect(onSetProp).toHaveBeenCalledWith('when', 'new-expr');
  });

  it('condition chip renders on field toolbar too', () => {
    render(<InlineToolbar {...makeFieldProps({ nodeProps: { when: 'x > 0' } })} />);
    expect(screen.getByTestId('inline-expression')).toHaveAttribute('data-value', 'x > 0');
  });
});

// ── Overflow "..." button ─────────────────────────────────────────────────

describe('InlineToolbar — overflow button', () => {
  it('renders the overflow "..." button', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {} })} />);
    expect(screen.getByTestId('toolbar-overflow')).toBeInTheDocument();
  });

  it('calls onOpenPopover when overflow button is clicked', () => {
    const onOpenPopover = vi.fn();
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {}, onOpenPopover })} />);
    fireEvent.click(screen.getByTestId('toolbar-overflow'));
    expect(onOpenPopover).toHaveBeenCalled();
  });

  it('shows dot indicator when hasPopoverContent is true', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {}, hasPopoverContent: true })} />);
    expect(screen.getByTestId('toolbar-overflow-dot')).toBeInTheDocument();
  });

  it('does not show dot indicator when hasPopoverContent is false', () => {
    render(<InlineToolbar {...makeContainerProps({ component: 'Grid', nodeProps: {}, hasPopoverContent: false })} />);
    expect(screen.queryByTestId('toolbar-overflow-dot')).toBeNull();
  });
});
