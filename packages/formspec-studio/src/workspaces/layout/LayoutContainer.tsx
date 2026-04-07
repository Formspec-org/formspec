/** @filedesc Layout canvas wrapper for layout nodes — applies real CSS layout per container type (Grid, Stack, Card, Panel, Collapsible, Accordion). */
import React, { useState, useRef, useCallback, type ReactNode } from 'react';
import { DragHandle } from '../../components/ui/DragHandle';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { hasTier3Content, type ContainerLayoutProps } from '@formspec-org/studio-core';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';
import { useLayoutDragActive } from './LayoutDragContext';
import { LayoutResizeProvider, type LayoutResizeState } from './LayoutResizeContext';
import {
  LAYOUT_CONTAINER_SELECTED,
  LAYOUT_CONTAINER_UNSELECTED,
  LAYOUT_CONTAINER_UNSELECTED_ON_ACTIVE_PAGE,
} from './layout-node-styles';

export interface LayoutContainerProps {
  component: string;
  nodeType: 'group' | 'layout';
  bind?: string;
  bindPath?: string;
  nodeId?: string;
  /** Selection key used by InlineToolbar/PropertyPopover (e.g. '__node:n1' or bind path). */
  selectionKey?: string;
  selected?: boolean;
  /** When set, inline toolbar only shows on the primary row during multi-select. */
  layoutPrimaryKey?: string | null;
  index?: number;
  onSelect?: (e: React.MouseEvent | React.KeyboardEvent) => void;
  children?: ReactNode;
  /** Layout-specific props grouped to avoid a long positional prop list. */
  layoutProps?: ContainerLayoutProps;
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
  /** Called when style is removed from the PropertyPopover. */
  onStyleRemove?: (styleKey: string) => void;
  /** When true, renders N+1 insert slots between/around children for spatial DnD. */
  isDragActive?: boolean;
  /** Collision priority for nested drop targets (higher wins). */
  collisionPriority?: number;
  /**
   * When true, unselected Stack containers use a solid frame on the active layout page so the
   * interior does not read as a throwaway sketch (wizard / single-page canvas).
   */
  pageSectionActive?: boolean;
}

const ELEVATION_SHADOW: Record<number, string> = {
  0: 'none',
  1: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
  2: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  3: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
};

type ContentStyleProps = Pick<
  ContainerLayoutProps,
  'columns' | 'gap' | 'direction' | 'wrap' | 'align' | 'elevation' | 'nodeStyle'
>;

function buildContentStyle(component: string, layoutProps: ContentStyleProps = {}): React.CSSProperties {
  const { columns, gap, direction, wrap, align, elevation, nodeStyle } = layoutProps;

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
function InsertSlot({ nodeId, index, collisionPriority }: { nodeId: string; index: number; collisionPriority: number }) {
  const { ref } = useDroppable({
    id: `slot-${nodeId}-${index}`,
    data: { type: 'insert-slot', containerId: nodeId, insertIndex: index },
    collisionPriority,
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
function InsertSlotChildren({ nodeId, children, collisionPriority }: { nodeId: string; children?: ReactNode; collisionPriority: number }) {
  const childArray = children ? (Array.isArray(children) ? children : [children]) : [];
  const slotCount = childArray.length + 1;

  return (
      <>
      {Array.from({ length: slotCount }, (_, i) => (
        <React.Fragment key={`slot-group-${i}`}>
          <InsertSlot nodeId={nodeId} index={i} collisionPriority={collisionPriority} />
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
    layoutPrimaryKey = null,
    index = 0,
    onSelect,
    children,
    layoutProps,
    nodeProps,
    onSetProp,
    onSetStyle,
    onUnwrap,
    onRemove,
    onStyleRemove,
    isDragActive: isDragActiveProp = false,
    collisionPriority = 0,
    pageSectionActive = false,
  } = props;

  // OBJ-4-02: read from DnD context so containers know drag is active without prop threading
  const isDragActiveCtx = useLayoutDragActive();
  const isDragActive = isDragActiveProp || isDragActiveCtx;

  const resolvedLayoutProps = layoutProps ?? {};
  const [open, setOpen] = useState(resolvedLayoutProps.defaultOpen ?? true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [childResizeState, setChildResizeState] = useState<LayoutResizeState | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragHandleRef = useRef<Element | null>(null);
  const reportChildResize = useCallback((state: LayoutResizeState | null) => {
    setChildResizeState(state);
  }, []);

  const dragId = nodeId ? `node:${nodeId}` : `bind:${bind ?? component}`;
  const nodeRef = nodeId ? { nodeId } : bind ? { bind } : undefined;

  const { ref: dragRef, isDragging } = useDraggable({
    id: dragId,
    data: { nodeRef, index, type: 'tree-node' },
    /** Handle only — @dnd-kit overwrites aria-pressed on the activator for drag state; keep selection on the inner row. */
    handle: dragHandleRef,
  });

  const { ref: dropRef } = useDroppable({
    id: `drop:${dragId}`,
    data: { nodeRef, index, type: 'container-drop', component },
    collisionPriority,
  });

  const isCollapsible = component === 'Collapsible' || component === 'Accordion';
  const contentStyle = buildContentStyle(component, resolvedLayoutProps);
  const containerStyle: React.CSSProperties = component === 'Panel' && resolvedLayoutProps.width
    ? { width: resolvedLayoutProps.width }
    : {};
  const displayTitle = resolvedLayoutProps.title ?? undefined;
  const isChildResizing = childResizeState !== null;
  const childDragValue = childResizeState?.value ?? 0;
  const childDragCursorX = childResizeState?.cursor.x ?? 0;
  const childResizeAxis = childResizeState?.axis ?? null;

  // Column guides overlay for Grid when child is resizing
  const numColumns = component === 'Grid' ? (resolvedLayoutProps.columns ?? 2) : 0;
  const showColumnGuides = isChildResizing && childResizeAxis === 'x' && numColumns > 0 && component === 'Grid';

  // Determine if any Tier 3 properties are set (for dot indicator on "...")
  const resolvedNodeProps = nodeProps ?? {};
  const hasPopoverContent = hasTier3Content(resolvedNodeProps);

  const isToolbarPrimary = layoutPrimaryKey == null || layoutPrimaryKey === selectionKey;
  const showToolbar = selected && isToolbarPrimary && !!onSetProp && !!selectionKey;

  const shellClasses =
    selected
      ? LAYOUT_CONTAINER_SELECTED
      : pageSectionActive && component === 'Stack'
        ? LAYOUT_CONTAINER_UNSELECTED_ON_ACTIVE_PAGE
        : LAYOUT_CONTAINER_UNSELECTED;

  return (
    <div
      ref={dropRef}
      data-testid={`layout-container-${nodeId ?? bind ?? component}`}
      data-layout-node
      data-layout-node-type={nodeType}
      data-component={component}
      {...(bindPath ? { 'data-layout-bind': bindPath } : {})}
      {...(bind ? { 'data-layout-tree-bind': bind } : {})}
      {...(nodeId ? { 'data-layout-node-id': nodeId } : {})}
      {...(selectionKey ? { 'data-layout-select-key': selectionKey } : {})}
      style={containerStyle}
      className={`transition-colors ${isDragging ? 'opacity-40' : ''} ${shellClasses}`}
    >
      {/* Header: drag grip (dnd activator) + clickable row (selection + toolbar). */}
      <div ref={dragRef} className="flex w-full items-center gap-1 rounded px-2 py-1.5 md:px-2 md:py-2">
        <DragHandle
          ref={dragHandleRef}
          label={`Reorder ${displayTitle ?? component}`}
          className="h-9 shrink-0"
        />
        <div
          data-testid="layout-select-row"
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          aria-label={displayTitle ?? component}
          onClick={(e) => {
            if (isCollapsible && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
              setOpen((o) => !o);
            }
            onSelect?.(e);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect?.(e);
            }
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
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
              overflowButtonRef={overflowButtonRef}
            />
          )}
        </div>
      </div>


      {/* SD-06: ConditionalGroup data preservation note */}
      {component === 'ConditionalGroup' && selected && (
        <div className="mx-3 mb-1 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-400 select-none">
          Data is still submitted when hidden
        </div>
      )}
      {/* PropertyPopover — anchored to overflow button */}
      {showToolbar && popoverOpen && (
        <PropertyPopover
          open={popoverOpen}
          anchorRef={overflowButtonRef}
          nodeProps={resolvedNodeProps}
          isContainer={true}
          itemKey={bind}
          onSetProp={onSetProp!}
          onSetStyle={onSetStyle ?? (() => {})}
          onStyleRemove={onStyleRemove ?? (() => {})}
          onUnwrap={onUnwrap}
          onRemove={onRemove ?? (() => {})}
          onClose={() => setPopoverOpen(false)}
        />
      )}

      {/* Content area — hidden when collapsible is closed */}
      {(!isCollapsible || open) && (
        <LayoutResizeProvider onResizeChange={reportChildResize}>
          <div
            data-layout-content
            style={contentStyle}
            className="relative px-3 pb-2"
          >
            {/* Column guides overlay when a child is resizing inside a Grid */}
            {showColumnGuides && childResizeAxis === 'x' && (
              <div
                data-testid="layout-resize-guides"
                className="absolute inset-0 pointer-events-none"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${numColumns}, 1fr)`,
                  gap: contentStyle.gap as string | undefined,
                }}
              >
                {Array.from({ length: numColumns }).map((_, i) => (
                  <div
                    key={`guide-${i}`}
                    className="border-l border-dashed border-accent/30"
                  />
                ))}
              </div>
            )}

            {/* Numeric tooltip during resize */}
            {showColumnGuides && childResizeAxis === 'x' && (
              <div
                data-testid="layout-resize-tooltip"
                className="fixed bg-accent/90 text-background px-2 py-1 rounded text-[11px] font-semibold pointer-events-none z-50"
                style={{
                  left: `${childDragCursorX}px`,
                  top: '0px',
                  transform: 'translateX(-50%)',
                }}
              >
                {childDragValue} col
              </div>
            )}

            {isDragActive && nodeId ? (
              <InsertSlotChildren nodeId={nodeId} collisionPriority={collisionPriority + 1}>
                {children}
              </InsertSlotChildren>
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
        </LayoutResizeProvider>
      )}
    </div>
  );
}
