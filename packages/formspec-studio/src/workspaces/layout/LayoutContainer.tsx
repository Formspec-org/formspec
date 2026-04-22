/** @filedesc Layout canvas wrapper for layout nodes — applies real CSS layout per container type (Grid, Stack, Card, Panel, Collapsible, Accordion). */
import React, { useState, useRef, useCallback, type ReactNode } from 'react';
import { DragHandle } from '../../components/ui/DragHandle';
import { hasTier3Content, type ContainerLayoutProps } from '@formspec-org/studio-core';
import { InlineToolbar } from './InlineToolbar';
import { PropertyPopover } from './PropertyPopover';
import { LayoutResizeProvider, type LayoutResizeState } from './LayoutResizeContext';
import {
  LAYOUT_CONTAINER_SELECTED,
  LAYOUT_CONTAINER_UNSELECTED,
  LAYOUT_CONTAINER_UNSELECTED_ON_ACTIVE_PAGE,
} from './layout-node-styles';
import { useLayoutCanvasContainerDropTargetActive } from './LayoutCanvasDragFeedbackContext';
import { LayoutCanvasRowDropGuides } from './LayoutCanvasRowDropGuides';
import {
  LAYOUT_CANVAS_EMPTY_CONTAINER_DROP_ACTIVE,
  layoutCanvasContainerShellClassName,
} from './layout-canvas-drag-chrome';
import { useLayoutPragmaticContainerDrop } from './useLayoutPragmaticContainerDrop';
import { useLayoutPragmaticItem } from './useLayoutPragmaticItem';

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
  onSelect?: (e: React.MouseEvent | React.KeyboardEvent) => void;
  /** Parent list id for layout canvas reorder (root stack, page, or layout/bind group). */
  sortableGroup: string;
  /** Index among siblings in `sortableGroup`. */
  sortableIndex: number;
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

/** Subtle drop target rendered only when a container is empty. */
function EmptyContainerPlaceholder({ containerRef }: { containerRef: { bind?: string; nodeId?: string } }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const emptyDropActive = useLayoutCanvasContainerDropTargetActive(containerRef);
  useLayoutPragmaticContainerDrop({
    element: host,
    enabled: !!(containerRef.nodeId || containerRef.bind),
    nodeRef: containerRef,
  });

  return (
    <div
      ref={setHost}
      data-testid="empty-container-placeholder"
      className={`py-8 border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] transition-all duration-200 bg-bg-default/30 border-accent/10 text-accent/20 ${
        emptyDropActive ? LAYOUT_CANVAS_EMPTY_CONTAINER_DROP_ACTIVE : ''
      }`}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-accent/20" />
      Empty Container
    </div>
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
    sortableGroup,
    sortableIndex,
    onSelect,
    children,
    layoutProps,
    nodeProps,
    onSetProp,
    onSetStyle,
    onUnwrap,
    onRemove,
    onStyleRemove,
    pageSectionActive = false,
  } = props;

  const resolvedLayoutProps = layoutProps ?? {};
  const [open, setOpen] = useState(resolvedLayoutProps.defaultOpen ?? true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [childResizeState, setChildResizeState] = useState<LayoutResizeState | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragHandleRef = useRef<Element | null>(null);
  const [shellEl, setShellEl] = useState<HTMLDivElement | null>(null);
  const [headerDropEl, setHeaderDropEl] = useState<HTMLDivElement | null>(null);
  const [dragHandleHost, setDragHandleHost] = useState<Element | null>(null);
  const [isDragSource, setIsDragSource] = useState(false);
  const reportChildResize = useCallback((state: LayoutResizeState | null) => {
    setChildResizeState(state);
  }, []);

  const dragId = nodeId ? `node:${nodeId}` : `bind:${bind ?? component}`;
  const nodeRef = nodeId ? { nodeId } : bind ? { bind } : undefined;
  const containerDropActive = useLayoutCanvasContainerDropTargetActive(nodeRef ?? null);

  useLayoutPragmaticItem({
    enabled: !!nodeRef,
    element: shellEl,
    dragHandle: dragHandleHost,
    sortableGroup,
    sortableIndex,
    nodeRef: nodeRef!,
    sourceId: dragId,
    onDragSourceChange: setIsDragSource,
  });

  const isCollapsible = component === 'Collapsible' || component === 'Accordion';
  /** Visually collapse only — content stays mounted (nested drag targets stay registered). */
  const collapsibleContentClosed = isCollapsible && !open;

  useLayoutPragmaticContainerDrop({
    element: headerDropEl,
    enabled: isCollapsible && !!nodeRef && !isDragSource,
    nodeRef: nodeRef!,
  });

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
      ref={setShellEl}
      data-testid={`layout-container-${nodeId ?? bind ?? component}`}
      data-layout-node
      data-layout-node-type={nodeType}
      data-component={component}
      {...(bindPath ? { 'data-layout-bind': bindPath } : {})}
      {...(bind ? { 'data-layout-tree-bind': bind } : {})}
      {...(nodeId ? { 'data-layout-node-id': nodeId } : {})}
      {...(selectionKey ? { 'data-layout-select-key': selectionKey } : {})}
      style={containerStyle}
      className={layoutCanvasContainerShellClassName({
        selectionShell: shellClasses,
        isDragSource,
        containerDropActive,
      })}
    >
      {nodeRef ? <LayoutCanvasRowDropGuides sortableGroup={sortableGroup} sortableIndex={sortableIndex} /> : null}
      {/* Header: drag grip + row. Collapsible `container-drop` is header-only so inner rows stay the innermost drop target. */}
      <div ref={isCollapsible ? setHeaderDropEl : undefined} className="flex w-full items-center gap-1 rounded px-2 py-1.5 md:px-2 md:py-2">
        <DragHandle
          ref={(el) => {
            dragHandleRef.current = el;
            setDragHandleHost(el);
          }}
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

      {/* Content area — collapsible hides via CSS when closed; never unmount (keeps nested Pragmatic drop targets registered). */}
      <LayoutResizeProvider onResizeChange={reportChildResize}>
        <div
          data-layout-content
          {...(collapsibleContentClosed ? { 'data-layout-collapsed': 'true' } : {})}
          inert={collapsibleContentClosed ? true : undefined}
          style={contentStyle}
          className={`relative px-3 pb-2 transition-[max-height,opacity] duration-200 ease-out ${
            collapsibleContentClosed
              ? 'max-h-0 overflow-hidden p-0 pb-0 opacity-0 pointer-events-none'
              : ''
          }`}
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

            <div
              style={contentStyle}
              className={`relative w-full ${collapsibleContentClosed ? 'min-h-0' : 'min-h-[1.5rem]'}`}
            >
              {React.Children.count(children) > 0 ? (
                children
              ) : (
                <EmptyContainerPlaceholder key="empty-placeholder" containerRef={nodeRef!} />
              )}
            </div>
        </div>
      </LayoutResizeProvider>
    </div>
  );
}
