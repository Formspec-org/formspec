/** @filedesc Compact inline property toolbar rendered inside layout container and field block headers. */
import { useState, useEffect, useRef } from 'react';
import { compatibleWidgets } from '@formspec-org/studio-core';
import { InlineExpression } from '../../components/ui/InlineExpression';
import type { LayoutContext } from './FieldBlock';

// ── Types ─────────────────────────────────────────────────────────────────

export interface InlineToolbarProps {
  /** Selection key (e.g. '__node:n1' for layout nodes, 'email' for fields). */
  selectionKey: string;
  /** Layout node ID (only when this is a layout/group node). */
  nodeId?: string;
  /** Item key (only when this is a bound field). */
  itemKey?: string;
  /** Component type string (Grid, Stack, Card, Panel, Collapsible, Accordion, TextInput, etc.). */
  component: string;
  /** Current props of the component node (read from component tree). */
  nodeProps: Record<string, unknown>;
  /** Item type — 'field' | 'group' | 'display' (only for bound items). */
  itemType?: string;
  /** Item data type (only for field items). */
  itemDataType?: string;
  /** Layout context from parent container (only for field items). */
  layoutContext?: LayoutContext;
  /** Called when the toolbar wants to write a prop on the component node. */
  onSetProp: (key: string, value: unknown) => void;
  /** Called when the toolbar wants to write a style property (routes through style map, not direct props). */
  onSetStyle?: (key: string, value: string) => void;
  /** Called when the stepper wants to set column span on a field in a grid. */
  onSetColumnSpan?: (newSpan: number) => void;
  /** Called when overflow "..." button is clicked — caller manages popover mount. */
  onOpenPopover: () => void;
  /** Whether any Tier 3 properties are set — controls dot indicator on "..." button. */
  hasPopoverContent: boolean;
  /** Ref to the overflow button — used by PropertyPopover for positioning. */
  overflowButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

// ── Spacing token list ────────────────────────────────────────────────────

const SPACING_OPTIONS = [
  { value: '', label: 'none' },
  { value: 'xs', label: 'xs' },
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
  { value: 'xl', label: 'xl' },
];

// ── Small shared sub-components ───────────────────────────────────────────

function ToolbarSelect({
  testId,
  value,
  options,
  ariaLabel,
  onChange,
}: {
  testId: string;
  value: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      data-testid={testId}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      className="h-7 rounded border border-border bg-surface px-1 text-[12px] font-mono text-ink outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ToolbarIconBtn({
  testId,
  ariaLabel,
  active,
  onClick,
  children,
}: {
  testId: string;
  ariaLabel: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex h-7 min-w-[24px] items-center justify-center rounded border px-1.5 text-[12px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70 ${
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function WhenWarningBadge() {
  return (
    <span
      title="This hides the component only. Use relevant in Editor to control data."
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-warning/30 bg-warning/10 text-[9px] font-bold text-warning"
      aria-hidden="true"
    >
      ⚠
    </span>
  );
}

function Stepper({
  decTestId,
  incTestId,
  valueTestId,
  value,
  min,
  max,
  ariaLabel,
  onDecrement,
  onIncrement,
}: {
  decTestId: string;
  incTestId: string;
  valueTestId: string;
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        data-testid={decTestId}
        aria-label={`Decrease ${ariaLabel}`}
        disabled={value <= min}
        onClick={(e) => { e.stopPropagation(); if (value > min) onDecrement(); }}
        className="inline-flex h-7 w-5 items-center justify-center rounded border border-border bg-surface text-[12px] text-muted hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
      >
        −
      </button>
      <span
        data-testid={valueTestId}
        className="inline-flex h-7 min-w-[20px] items-center justify-center text-[12px] font-mono text-ink"
      >
        {value}
      </span>
      <button
        type="button"
        data-testid={incTestId}
        aria-label={`Increase ${ariaLabel}`}
        disabled={value >= max}
        onClick={(e) => { e.stopPropagation(); if (value < max) onIncrement(); }}
        className="inline-flex h-7 w-5 items-center justify-center rounded border border-border bg-surface text-[12px] text-muted hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
      >
        +
      </button>
    </span>
  );
}

// ── Per-type toolbar sections ─────────────────────────────────────────────

function GridControls({ nodeProps, onSetProp, onSetStyle }: { nodeProps: Record<string, unknown>; onSetProp: (k: string, v: unknown) => void; onSetStyle?: (k: string, v: string) => void }) {
  const columns = (nodeProps.columns as number) ?? 2;
  const gap = (nodeProps.gap as string) ?? '';
  const padding = ((nodeProps.style as Record<string, unknown> | undefined)?.padding as string) ?? '';
  return (
    <>
      <Stepper
        decTestId="toolbar-columns-dec"
        incTestId="toolbar-columns-inc"
        valueTestId="toolbar-columns-value"
        value={columns}
        min={1}
        max={12}
        ariaLabel="columns"
        onDecrement={() => onSetProp('columns', columns - 1)}
        onIncrement={() => onSetProp('columns', columns + 1)}
      />
      <ToolbarSelect
        testId="toolbar-gap"
        value={gap}
        options={SPACING_OPTIONS}
        ariaLabel="Gap"
        onChange={(v) => onSetProp('gap', v || null)}
      />
      <ToolbarSelect
        testId="toolbar-padding"
        value={padding}
        options={SPACING_OPTIONS}
        ariaLabel="Padding"
        onChange={(v) => onSetStyle?.('padding', v)}
      />
    </>
  );
}

function StackControls({ nodeProps, onSetProp }: { nodeProps: Record<string, unknown>; onSetProp: (k: string, v: unknown) => void }) {
  const direction = (nodeProps.direction as string) ?? 'column';
  const wrap = (nodeProps.wrap as boolean) ?? false;
  const gap = (nodeProps.gap as string) ?? '';
  const align = (nodeProps.align as string) ?? '';

  const ALIGN_OPTIONS = [
    { value: '', label: '—' },
    { value: 'start', label: 'start' },
    { value: 'center', label: 'center' },
    { value: 'end', label: 'end' },
    { value: 'stretch', label: 'stretch' },
  ];

  return (
    <>
      <ToolbarIconBtn
        testId="toolbar-direction-row"
        ariaLabel="Direction: row"
        active={direction === 'row'}
        onClick={() => onSetProp('direction', 'row')}
      >
        →
      </ToolbarIconBtn>
      <ToolbarIconBtn
        testId="toolbar-direction-column"
        ariaLabel="Direction: column"
        active={direction === 'column'}
        onClick={() => onSetProp('direction', 'column')}
      >
        ↓
      </ToolbarIconBtn>
      <ToolbarIconBtn
        testId="toolbar-wrap-toggle"
        ariaLabel={wrap ? 'Wrap: on' : 'Wrap: off'}
        active={wrap}
        onClick={() => onSetProp('wrap', !wrap)}
      >
        ↵
      </ToolbarIconBtn>
      <ToolbarSelect
        testId="toolbar-gap"
        value={gap}
        options={SPACING_OPTIONS}
        ariaLabel="Gap"
        onChange={(v) => onSetProp('gap', v || null)}
      />
      <ToolbarSelect
        testId="toolbar-align"
        value={align}
        options={ALIGN_OPTIONS}
        ariaLabel="Align"
        onChange={(v) => onSetProp('align', v || null)}
      />
    </>
  );
}

function CardControls({ nodeProps, onSetProp, onSetStyle }: { nodeProps: Record<string, unknown>; onSetProp: (k: string, v: unknown) => void; onSetStyle?: (k: string, v: string) => void }) {
  const elevation = (nodeProps.elevation as number) ?? 1;
  const padding = ((nodeProps.style as Record<string, unknown> | undefined)?.padding as string) ?? '';
  return (
    <>
      <Stepper
        decTestId="toolbar-elevation-dec"
        incTestId="toolbar-elevation-inc"
        valueTestId="toolbar-elevation-value"
        value={elevation}
        min={0}
        max={3}
        ariaLabel="elevation"
        onDecrement={() => onSetProp('elevation', elevation - 1)}
        onIncrement={() => onSetProp('elevation', elevation + 1)}
      />
      <ToolbarSelect
        testId="toolbar-padding"
        value={padding}
        options={SPACING_OPTIONS}
        ariaLabel="Padding"
        onChange={(v) => onSetStyle?.('padding', v)}
      />
    </>
  );
}

function PanelControls({ nodeProps, onSetProp }: { nodeProps: Record<string, unknown>; onSetProp: (k: string, v: unknown) => void }) {
  const position = (nodeProps.position as string) ?? 'left';
  const width = (nodeProps.width as string) ?? '';
  const [draft, setDraft] = useState(width);
  useEffect(() => { setDraft(width); }, [width]);

  return (
    <>
      <ToolbarIconBtn
        testId="toolbar-position-left"
        ariaLabel="Position: left"
        active={position === 'left'}
        onClick={() => onSetProp('position', 'left')}
      >
        ⬤L
      </ToolbarIconBtn>
      <ToolbarIconBtn
        testId="toolbar-position-right"
        ariaLabel="Position: right"
        active={position === 'right'}
        onClick={() => onSetProp('position', 'right')}
      >
        R⬤
      </ToolbarIconBtn>
      <input
        type="text"
        data-testid="toolbar-width-input"
        aria-label="Width"
        value={draft}
        placeholder="e.g. 300px"
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={() => onSetProp('width', draft)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
        onClick={(e) => e.stopPropagation()}
        className="h-7 w-20 rounded border border-border bg-surface px-1.5 text-[12px] font-mono text-ink outline-none placeholder:text-muted/40 focus:border-accent"
      />
    </>
  );
}

function CollapsibleControls({ nodeProps, onSetProp }: { nodeProps: Record<string, unknown>; onSetProp: (k: string, v: unknown) => void }) {
  const title = (nodeProps.title as string) ?? '';
  const defaultOpen = (nodeProps.defaultOpen as boolean) ?? false;
  const [draft, setDraft] = useState(title);
  useEffect(() => { setDraft(title); }, [title]);

  return (
    <>
      <input
        type="text"
        data-testid="toolbar-title-input"
        aria-label="Title"
        value={draft}
        placeholder="Section title"
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={() => onSetProp('title', draft)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
        onClick={(e) => e.stopPropagation()}
        className="h-7 w-32 rounded border border-border bg-surface px-1.5 text-[12px] font-mono text-ink outline-none placeholder:text-muted/40 focus:border-accent"
      />
      <ToolbarIconBtn
        testId="toolbar-default-open"
        ariaLabel={defaultOpen ? 'Default: open' : 'Default: closed'}
        active={defaultOpen}
        onClick={() => onSetProp('defaultOpen', !defaultOpen)}
      >
        {defaultOpen ? '▾' : '▸'}
      </ToolbarIconBtn>
    </>
  );
}

function FieldControls({
  nodeProps,
  itemType,
  itemDataType,
  layoutContext,
  onSetProp,
  onSetStyle,
  onSetColumnSpan,
}: {
  nodeProps: Record<string, unknown>;
  itemType?: string;
  itemDataType?: string;
  layoutContext?: LayoutContext;
  onSetProp: (k: string, v: unknown) => void;
  onSetStyle?: (k: string, v: string) => void;
  onSetColumnSpan?: (newSpan: number) => void;
}) {
  const widgets = compatibleWidgets(itemType ?? 'field', itemDataType);
  const defaultWidget = widgets[0] ?? '';
  const currentWidget = (nodeProps.component as string) || '';

  const isInGrid = layoutContext?.parentContainerType === 'grid';
  const parentCols = layoutContext?.parentGridColumns ?? 1;
  const currentSpan = layoutContext?.currentColSpan ?? 1;

  return (
    <>
      {widgets.length >= 2 && (
        <select
          data-testid="toolbar-widget"
          aria-label="Input control type"
          title="Sets the component tree control and keeps definition presentation hints in sync. Default follows theme or data type."
          value={currentWidget || ''}
          onChange={(e) => {
            e.stopPropagation();
            const v = e.currentTarget.value;
            // Tier-3 tree uses `component` (Select, RadioGroup, …); `widget` is not a tree field.
            onSetProp('component', v === '' ? defaultWidget : v);
          }}
          className="h-7 rounded border border-border bg-surface px-1 text-[12px] font-mono text-ink outline-none focus:border-accent"
        >
          <option value="">Default (theme / data type)</option>
          {widgets.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      )}
      {isInGrid && (
        <Stepper
          decTestId="toolbar-span-dec"
          incTestId="toolbar-span-inc"
          valueTestId="toolbar-span-value"
          value={currentSpan}
          min={1}
          max={parentCols}
          ariaLabel="column span"
          onDecrement={() => { if (onSetColumnSpan) onSetColumnSpan(currentSpan - 1); else onSetStyle?.('gridColumn', `span ${currentSpan - 1}`); }}
          onIncrement={() => { if (onSetColumnSpan) onSetColumnSpan(currentSpan + 1); else onSetStyle?.('gridColumn', `span ${currentSpan + 1}`); }}
        />
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function InlineToolbar(props: InlineToolbarProps) {
  const {
    component,
    nodeProps,
    itemType,
    itemDataType,
    layoutContext,
    onSetProp,
    onSetStyle,
    onSetColumnSpan,
    onOpenPopover,
    hasPopoverContent,
    overflowButtonRef,
  } = props;

  const componentWhen = (nodeProps.when as string) ?? '';
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState(0);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (toolbarRef.current) {
        setToolbarWidth(toolbarRef.current.offsetWidth || 320);
      }
    });
    if (toolbarRef.current) {
      setToolbarWidth(toolbarRef.current.offsetWidth || 320);
      resizeObserver.observe(toolbarRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Stop click propagation on the whole toolbar so it doesn't trigger parent selection
  function stopProp(e: React.MouseEvent) {
    e.stopPropagation();
  }

  // Determine responsive mode based on container width
  const isCollapsed = toolbarWidth < 180;
  const isCompact = toolbarWidth < 300 && toolbarWidth >= 180;

  // Widget badge indicator for collapsed mode
  const componentBadge = component.slice(0, 3).toUpperCase();

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-1 flex-1 min-w-0"
      onClick={stopProp}
    >
      {isCollapsed ? (
        <>
          {/* Collapsed: show type badge + [...] only */}
          <span className="inline-flex h-7 px-1.5 items-center justify-center rounded border border-border bg-subtle text-[10px] font-mono font-bold text-ink flex-shrink-0">
            {componentBadge}
          </span>
          <button
            ref={overflowButtonRef}
            type="button"
            data-testid="toolbar-overflow"
            aria-label="More properties"
            onClick={(e) => { e.stopPropagation(); onOpenPopover(); }}
            className="relative ml-auto inline-flex h-7 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-surface text-[12px] text-muted hover:border-accent/40 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
          >
            ...
            {hasPopoverContent && (
              <span
                data-testid="toolbar-overflow-dot"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
          </button>
        </>
      ) : isCompact ? (
        <>
          {/* Compact: show 1-2 critical controls + icon-only condition chip + [...] */}
          {component === 'Grid' && (
            <Stepper
              decTestId="toolbar-columns-dec"
              incTestId="toolbar-columns-inc"
              valueTestId="toolbar-columns-value"
              value={(nodeProps.columns as number) ?? 2}
              min={1}
              max={12}
              ariaLabel="columns"
              onDecrement={() => onSetProp('columns', ((nodeProps.columns as number) ?? 2) - 1)}
              onIncrement={() => onSetProp('columns', ((nodeProps.columns as number) ?? 2) + 1)}
            />
          )}
          {component === 'Stack' && (
            <ToolbarIconBtn
              testId="toolbar-direction-row"
              ariaLabel="Direction: row"
              active={(nodeProps.direction as string) === 'row'}
              onClick={() => onSetProp('direction', 'row')}
            >
              →
            </ToolbarIconBtn>
          )}
          {component === 'Card' && (
            <span className="text-[12px] text-muted">E:</span>
          )}

          {/* Icon-only condition chip for compact mode */}
          {componentWhen && (
            <button
              type="button"
              data-testid="toolbar-condition-chip-compact"
              className="inline-flex h-7 px-1 items-center justify-center rounded border border-warning/30 bg-warning/5 text-[10px] cursor-pointer hover:bg-warning/10 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning/60"
              title="This hides the component only. Use relevant in Editor to control data."
              aria-label="Condition controls rendering only"
              onClick={(e) => { e.stopPropagation(); onOpenPopover(); }}
            >
              <span className="text-warning">⚠</span>
            </button>
          )}

          <button
            ref={overflowButtonRef}
            type="button"
            data-testid="toolbar-overflow"
            aria-label="More properties"
            onClick={(e) => { e.stopPropagation(); onOpenPopover(); }}
            className="relative ml-auto inline-flex h-7 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-surface text-[12px] text-muted hover:border-accent/40 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
          >
            ...
            {hasPopoverContent && (
              <span
                data-testid="toolbar-overflow-dot"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
          </button>
        </>
      ) : (
        <>
          {/* Full: all controls */}
          {component === 'Grid' && (
            <GridControls nodeProps={nodeProps} onSetProp={onSetProp} onSetStyle={onSetStyle} />
          )}
          {component === 'Stack' && (
            <StackControls nodeProps={nodeProps} onSetProp={onSetProp} />
          )}
          {component === 'Card' && (
            <CardControls nodeProps={nodeProps} onSetProp={onSetProp} onSetStyle={onSetStyle} />
          )}
          {component === 'Panel' && (
            <PanelControls nodeProps={nodeProps} onSetProp={onSetProp} />
          )}
          {(component === 'Collapsible' || component === 'Accordion') && (
            <CollapsibleControls nodeProps={nodeProps} onSetProp={onSetProp} />
          )}
          {itemType === 'field' && (
            <FieldControls
              nodeProps={nodeProps}
              itemType={itemType}
              itemDataType={itemDataType}
              layoutContext={layoutContext}
              onSetProp={onSetProp}
              onSetStyle={onSetStyle}
              onSetColumnSpan={onSetColumnSpan}
            />
          )}

          {/* Full condition chip */}
          <span data-testid="toolbar-condition-chip" className="flex items-center gap-1">
            <InlineExpression
              value={componentWhen}
              onSave={(val) => onSetProp('when', val)}
              placeholder="Always shown (rendering only)"
              expressionType="when"
            />
            {componentWhen && <WhenWarningBadge />}
          </span>

          <button
            ref={overflowButtonRef}
            type="button"
            data-testid="toolbar-overflow"
            aria-label="More properties"
            onClick={(e) => { e.stopPropagation(); onOpenPopover(); }}
            className="relative ml-auto inline-flex h-7 w-6 flex-shrink-0 items-center justify-center rounded border border-border bg-surface text-[12px] text-muted hover:border-accent/40 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
          >
            ...
            {hasPopoverContent && (
              <span
                data-testid="toolbar-overflow-dot"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
          </button>
        </>
      )}
    </div>
  );
}
