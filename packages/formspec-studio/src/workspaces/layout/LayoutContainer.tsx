/** @filedesc Layout canvas wrapper for layout nodes — applies real CSS layout per container type (Grid, Stack, Card, Panel, Collapsible, Accordion). */
import React, { useState, useRef, type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';
import { useLayoutDragActive } from './LayoutDragContext';

export interface LayoutContainerProps {
  component: string;
  nodeType: 'group' | 'layout';
  bind?: string;
  bindPath?: string;
  nodeId?: string;
  /** Selection key used by InlineToolbar/PropertyPopover (e.g. '__node:n1' or bind path). */
  selectionKey?: string;
  selected?: boolean;
  index?: number;
  onSelect?: () => void;
  children?: ReactNode;
  // Per-type layout props (from component tree node)
  columns?: number;
  gap?: string;
  direction?: string;
  wrap?: boolean;
  align?: string;
  elevation?: number;
  width?: string;
  position?: string;
  title?: string;
  defaultOpen?: boolean;
  // Open-ended style map (e.g. style.padding on Card)
  nodeStyle?: Record<string, unknown>;
  /**
   * Full raw node props record — used by InlineToolbar to read current values.
   * When provided with onSetProp, enables the inline toolbar.
   */
  nodeProps?: Record<string, unknown>;
  /** Called when toolbar writes a property to the component node. */
  onSetProp?: (key: string, value: unknown) => void;
  /** Called when toolbar writes a style property (via style map, not direct prop). */
  onSetStyle?: (key: string, value: string) => void;
  /** Called when "Unwrap" action is triggered from the PropertyPopover. */
  onUnwrap?: () => void;
  /** Called when "Remove from Tree" action is triggered from the PropertyPopover. */
  onRemove?: () => void;
  /** Called when style is added from the PropertyPopover. */
  onStyleAdd?: (key: string, value: string) => void;
  /** Called when style is removed from the PropertyPopover. */
  onStyleRemove?: (styleKey: string) => void;
  /** When true, renders N+1 insert slots between/around children for spatial DnD. */
  isDragActive?: boolean;
}

const ELEVATION_SHADOW: Record<number, string> = {
  0: 'none',
  1: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
  2: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  3: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
};

function buildContentStyle(props: LayoutContainerProps): React.CSSProperties {
  const { component, columns, gap, direction, wrap, align, elevation, nodeStyle } = props;

  switch (component) {
    case 'Grid':
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${columns ?? 2}, 1fr)`,
        ...(gap ? { gap } : {}),
      };

    case 'Stack':
    case 'ConditionalGroup':
      return {
        display: 'flex',
        flexDirection: (direction ?? 'column') as React.CSSProperties['flexDirection'],
        ...(wrap !== undefined ? { flexWrap: wrap ? 'wrap' : 'nowrap' } : {}),
        ...(align ? { alignItems: align } : {}),
        ...(gap ? { gap } : {}),
      };

    case 'Card':
      return {
        ...(nodeStyle?.padding ? { padding: nodeStyle.padding as string } : {}),
        ...(elevation !== undefined
          ? { boxShadow: ELEVATION_SHADOW[elevation] ?? ELEVATION_SHADOW[1] }
          : {}),
      };

    case 'Panel':
    case 'Accordion':
    case 'Collapsible':
      return { display: 'flex', flexDirection: 'column' };

    default:
      return { display: 'flex', flexDirection: 'column', gap: '6px' };
  }
}

/** A single droppable insert slot registered with dnd-kit. */
function InsertSlot({ nodeId, index }: { nodeId: string; index: number }) {
  const { ref } = useDroppable({
    id: `slot-${nodeId}-${index}`,
    data: { type: 'insert-slot', containerId: nodeId, insertIndex: index },
  });
  return (
    <div
      ref={ref}
      data-testid={`insert-slot-${nodeId}-${index}`}
      data-insert-index={String(index)}
      data-container-id={nodeId}
      className="h-1 rounded bg-accent/30 transition-all"
    />
  );
}

/** Renders N+1 droppable insert slots interleaved with N children. */
function InsertSlotChildren({ nodeId, children }: { nodeId: string; children?: ReactNode }) {
  const childArray = children ? (Array.isArray(children) ? children : [children]) : [];
  const slotCount = childArray.length + 1;

  return (
    <>
      {Array.from({ length: slotCount }, (_, i) => (
        <React.Fragment key={`slot-group-${i}`}>
          <InsertSlot nodeId={nodeId} index={i} />
          {i < childArray.length && childArray[i]}
        </React.Fragment>
      ))}
    </>
  );
}

export function LayoutContainer(props: LayoutContainerProps) {
  const {
    component,
    nodeType,
    bind,
    bindPath,
    nodeId,
    selectionKey,
    selected = false,
    index = 0,
    onSelect,
    children,
    width,
    title,
    defaultOpen = true,
    nodeStyle,
    nodeProps,
    onSetProp,
    onSetStyle,
    onUnwrap,
    onRemove,
    onStyleAdd,
    onStyleRemove,
    isDragActive: isDragActiveProp = false,
  } = props;

  // OBJ-4-02: read from DnD context so containers know drag is active without prop threading
  const isDragActiveCtx = useLayoutDragActive();
  const isDragActive = isDragActiveProp || isDragActiveCtx;

  const [open, setOpen] = useState(defaultOpen);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const overflowRef = useRef<HTMLButtonElement>(null);

  const dragId = nodeId ? `node:${nodeId}` : `bind:${bind ?? component}`;
  const nodeRef = nodeId ? { nodeId } : bind ? { bind } : undefined;

  const { ref: dragRef, isDragging } = useDraggable({
    id: dragId,
    data: { nodeRef, index, type: 'tree-node' },
  });

  const { ref: dropRef } = useDroppable({
    id: `drop:${dragId}`,
    data: { nodeRef, index, type: 'container-drop', component },
  });

  const isCollapsible = component === 'Collapsible' || component === 'Accordion';
  const contentStyle = buildContentStyle(props);
  const containerStyle: React.CSSProperties = component === 'Panel' && width ? { width } : {};
  const displayTitle = title ?? undefined;

  // Determine if any Tier 3 properties are set (for dot indicator on "...")
  const resolvedNodeProps = nodeProps ?? {};
  const hasPopoverContent = !!(
    (resolvedNodeProps.accessibility as Record<string, unknown> | undefined)?.description ||
    (resolvedNodeProps.accessibility as Record<string, unknown> | undefined)?.role ||
    resolvedNodeProps.cssClass ||
    Object.keys((resolvedNodeProps.style as Record<string, unknown>) ?? {}).length > 0
  );

  const showToolbar = selected && !!onSetProp && !!selectionKey;

  return (
    <div
      ref={(el) => { dragRef(el); dropRef(el); }}
      data-testid={`layout-container-${nodeId ?? bind ?? component}`}
      data-layout-node
      data-layout-node-type={nodeType}
      data-component={component}
      {...(bindPath ? { 'data-layout-bind': bindPath } : {})}
      {...(nodeId ? { 'data-layout-node-id': nodeId } : {})}
      style={containerStyle}
      className={`rounded border border-dashed bg-surface transition-colors ${
        isDragging ? 'opacity-40' : ''
      } ${
        selected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-muted'
      }`}
    >
      {/* Header row: type badge + optional title + toolbar / collapse toggle */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={displayTitle ?? component}
        onClick={isCollapsible
          ? () => { setOpen((o) => !o); onSelect?.(); }
          : onSelect}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(); } }}
        className="flex w-full items-center gap-2 rounded px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 cursor-pointer"
      >
        <span className={`shrink-0 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
          selected ? 'bg-accent/15 text-accent' : 'bg-subtle text-muted'
        }`}>
          {component}
        </span>
        {displayTitle && !showToolbar && (
          <span className="text-[12px] text-ink font-medium truncate">{displayTitle}</span>
        )}
        {isCollapsible && !showToolbar && (
          <span className="ml-auto text-muted text-[10px]">{open ? '▾' : '▸'}</span>
        )}
        {/* Inline toolbar — shown when selected and onSetProp is provided */}
        {showToolbar && (
          <InlineToolbar
            selectionKey={selectionKey!}
            nodeId={nodeId}
            component={component}
            nodeProps={resolvedNodeProps}
            onSetProp={onSetProp!}
            onSetStyle={onSetStyle}
            onOpenPopover={() => setPopoverOpen(true)}
            hasPopoverContent={hasPopoverContent}
          />
        )}
      </div>

      {/* PropertyPopover — anchored to overflow button */}
      {showToolbar && popoverOpen && (
        <PropertyPopover
          open={popoverOpen}
          anchorRef={overflowRef}
          nodeProps={resolvedNodeProps}
          selectionKey={selectionKey!}
          nodeId={nodeId}
          isContainer={true}
          onSetProp={onSetProp!}
          onStyleAdd={onStyleAdd ?? (() => {})}
          onStyleRemove={onStyleRemove ?? (() => {})}
          onUnwrap={onUnwrap ?? (() => {})}
          onRemove={onRemove ?? (() => {})}
          onClose={() => setPopoverOpen(false)}
        />
      )}

      {/* Content area — hidden when collapsible is closed */}
      {(!isCollapsible || open) && (
        <div
          data-layout-content
          style={contentStyle}
          className="px-3 pb-2"
        >
          {isDragActive && nodeId ? (
            <InsertSlotChildren nodeId={nodeId}>{children}</InsertSlotChildren>
          ) : (
            children ?? (
              <div
                data-testid="empty-container-placeholder"
                className="flex items-center justify-center rounded border border-dashed border-muted/50 py-4 text-[11px] text-muted"
              >
                Drop items here
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
