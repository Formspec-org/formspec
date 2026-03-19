/** @filedesc Pages workspace tab for managing wizard pages, regions, and page-level diagnostics. */
import { useState, useCallback, useRef, useEffect, useContext, useMemo } from 'react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { PointerSensor, KeyboardSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { usePageStructure } from './usePageStructure';
import { useProject } from '../../state/useProject';
import { ActivePageContext } from '../../state/useActivePage';
import { DragHandle } from '../editor/DragHandle';
import { PagesFocusView } from './PagesFocusView';
import type { PageView, PageItemView } from 'formspec-studio-core';

// ── ModeSelector ──────────────────────────────────────────────────────

function ModeSelector({
  mode,
  onSetMode,
}: {
  mode: string;
  onSetMode: (mode: 'single' | 'wizard' | 'tabs') => void;
}) {
  const modes: Array<{ id: 'single' | 'wizard' | 'tabs'; label: string }> = [
    { id: 'single', label: 'Single' },
    { id: 'wizard', label: 'Wizard' },
    { id: 'tabs', label: 'Tabs' },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 bg-subtle/50 rounded-[8px] border border-border/50 w-fit">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSetMode(m.id)}
          className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-[6px] transition-all duration-200 ${
            mode === m.id
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:text-ink hover:bg-subtle'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ── PageCard ──────────────────────────────────────────────────────────

function PageCard({
  page,
  index,
  total,
  breakpointNames,
  isExpanded,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdateTitle,
  onUpdateDescription,
  onRemoveItem,
  onUpdateItemWidth,
  onUpdateItemOffset,
  onUpdateItemResponsive,
  onReorderItem,
  onEditLayout,
  sortableRef,
  dragHandleRef,
  isDragging,
}: {
  page: PageView;
  index: number;
  total: number;
  /** Ordered list of breakpoint names to show in responsive override UI */
  breakpointNames: string[];
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string | undefined) => void;
  onRemoveItem: (itemKey: string) => void;
  onUpdateItemWidth: (itemKey: string, width: number) => void;
  onUpdateItemOffset: (itemKey: string, offset: number | undefined) => void;
  onUpdateItemResponsive: (itemKey: string, breakpoint: string, overrides: { width?: number; offset?: number; hidden?: boolean } | undefined) => void;
  onReorderItem: (itemKey: string, direction: 'up' | 'down') => void;
  onEditLayout?: () => void;
  sortableRef?: (el: Element | null) => void;
  dragHandleRef?: (el: Element | null) => void;
  isDragging?: boolean;
}) {
  const items = page.items ?? [];
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [startVisibleFor, setStartVisibleFor] = useState<Set<number>>(new Set());
  /** Per-item index: whether the responsive overrides section is expanded */
  const [responsiveExpandedFor, setResponsiveExpandedFor] = useState<Set<number>>(new Set());
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);
  const gridBarRef = useRef<HTMLDivElement>(null);

  const showStartFor = useCallback((idx: number) => {
    setStartVisibleFor((prev) => new Set([...prev, idx]));
  }, []);

  const toggleResponsiveFor = useCallback((idx: number) => {
    setResponsiveExpandedFor((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingDescription && descInputRef.current) {
      descInputRef.current.focus();
      descInputRef.current.select();
    }
  }, [isEditingDescription]);

  // Deselect grid segment on click-outside
  useEffect(() => {
    if (selectedItemIndex === null) return;
    function handleMouseDown(e: MouseEvent) {
      if (gridBarRef.current && !gridBarRef.current.contains(e.target as Node)) {
        setSelectedItemIndex(null);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [selectedItemIndex]);

  const commitTitle = useCallback(() => {
    if (!titleInputRef.current) return;
    const newTitle = titleInputRef.current.value.trim();
    if (newTitle && newTitle !== page.title) {
      onUpdateTitle(newTitle);
    }
    setIsEditingTitle(false);
  }, [page.title, onUpdateTitle]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  }, [commitTitle]);

  const commitDescription = useCallback(() => {
    if (!descInputRef.current) return;
    const newDesc = descInputRef.current.value.trim();
    // Empty input clears the description
    onUpdateDescription(newDesc || undefined);
    setIsEditingDescription(false);
  }, [onUpdateDescription]);

  const handleDescKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitDescription();
    } else if (e.key === 'Escape') {
      setIsEditingDescription(false);
    }
  }, [commitDescription]);

  const itemCount = items.length;
  const itemLabel = itemCount === 0 ? 'Empty' : `${itemCount} item${itemCount !== 1 ? 's' : ''}`;

  return (
    <div
      ref={sortableRef}
      data-testid={`page-card-${page.id}`}
      className={`group border border-border rounded-lg bg-surface overflow-hidden${isDragging ? ' opacity-40' : ''}`}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Drag handle — hover-visible, acts as drag activator */}
        <DragHandle className="-ml-1" ref={dragHandleRef as React.Ref<HTMLDivElement>} />
        {/* Number badge */}
        <span className="font-mono text-[11px] text-muted w-5 text-center shrink-0">
          {index + 1}
        </span>

        {/* Title (editable) */}
        <div className="flex-1 min-w-0 group/title">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              defaultValue={page.title || page.id}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              className="text-[13px] font-bold text-ink bg-transparent border-b border-accent outline-none w-full"
            />
          ) : (
            <button
              type="button"
              className="text-[13px] font-bold text-ink text-left truncate w-full flex items-center gap-1.5 cursor-text"
              onClick={() => setIsEditingTitle(true)}
            >
              <span className="truncate">{page.title || page.id}</span>
              <span className="text-[10px] text-muted opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0">
                &#9998;
              </span>
            </button>
          )}
        </div>

        {/* Item count */}
        <span className="text-[11px] text-muted shrink-0">{itemLabel}</span>

        {/* Expand/collapse */}
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="text-[12px] text-muted hover:text-ink transition-colors shrink-0 p-0.5"
        >
          <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            &#9656;
          </span>
        </button>
      </div>

      {/* Mini grid preview (collapsed only) */}
      {!isExpanded && items.length > 0 && (
        <div className="px-3 pb-2">
          <div className="grid grid-cols-12 gap-0.5 h-4">
            {items.map((item, i) => (
              <div
                key={i}
                className={`rounded-sm ${item.status === 'broken' ? 'bg-amber-300/30' : 'bg-accent/20'}`}
                style={{ gridColumn: `span ${Math.min(item.width, 12)}` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Larger grid preview — interactive (FF3) */}
          {items.length > 0 && (
            <div ref={gridBarRef} className="grid grid-cols-12 gap-1 h-8">
              {items.map((item, i) => {
                const isBroken = item.status === 'broken';
                const isSelected = selectedItemIndex === i;
                const segmentClass = `border rounded text-[9px] text-center flex items-center justify-center text-muted truncate cursor-pointer transition-all ${
                  isBroken
                    ? `bg-amber-100/50 border-amber-300/50 hover:bg-amber-200/50${isSelected ? ' ring-1 ring-amber-400' : ''}`
                    : isSelected
                      ? 'bg-accent/30 border-accent/70 ring-1 ring-accent'
                      : 'bg-accent/15 border-accent/30 hover:bg-accent/25'
                }`;
                const segmentStyle = { gridColumn: `span ${Math.min(item.width, 12)}` };

                // Single <button> element for both selected/unselected states — avoids stale refs.
                // The "remove" control uses span[role="button"] so it's not nested inside <button>.
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label="grid segment"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedItemIndex(isSelected ? null : i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setSelectedItemIndex(null);
                    }}
                    className={segmentClass}
                    style={segmentStyle}
                  >
                    {isSelected ? (
                      <span className="flex items-center gap-1 px-1 w-full justify-center">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          aria-label="grid segment span"
                          key={`gs-sp-${i}-${item.key}-${item.width}`}
                          defaultValue={item.width}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Escape') setSelectedItemIndex(null);
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= 12 && val !== item.width) {
                              onUpdateItemWidth(item.key, val);
                            }
                          }}
                          className="font-mono text-ink w-8 text-center bg-surface border border-border/50 rounded text-[10px] py-0"
                        />
                        {/* span[role="button"] avoids invalid nested <button> element */}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="remove segment"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveItem(item.key);
                            setSelectedItemIndex(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              onRemoveItem(item.key);
                              setSelectedItemIndex(null);
                            }
                          }}
                          className="text-[9px] text-muted hover:text-error transition-colors shrink-0 cursor-pointer"
                        >
                          &times;
                        </span>
                      </span>
                    ) : (
                      <span className="truncate px-0.5">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Description — show if exists or editing; "Add description" button otherwise */}
          {page.description && !isEditingDescription ? (
            <button
              type="button"
              className="text-[12px] text-muted text-left w-full hover:text-ink transition-colors"
              onClick={() => setIsEditingDescription(true)}
            >
              {page.description}
            </button>
          ) : isEditingDescription ? (
            <input
              ref={descInputRef}
              type="text"
              defaultValue={page.description ?? ''}
              placeholder="Description…"
              onBlur={commitDescription}
              onKeyDown={handleDescKeyDown}
              className="text-[12px] text-muted bg-transparent border-b border-accent outline-none w-full"
            />
          ) : (
            <button
              type="button"
              aria-label="Add description"
              onClick={() => setIsEditingDescription(true)}
              className="text-[10px] text-muted hover:text-ink font-bold uppercase tracking-wider"
            >
              + Add description
            </button>
          )}

          {/* Item list with editing controls */}
          {items.length > 0 && (
            <div className="space-y-1">
              {items.map((item, idx) => {
                const responsive = item.responsive;
                const responsiveOpen = responsiveExpandedFor.has(idx);
                const hasResponsive = responsive && Object.keys(responsive).length > 0;

                return (
                  <div key={`rk-${idx}-${item.key}`} className="rounded bg-subtle/30">
                    {/* Main item row */}
                    <div className="flex items-center gap-2 text-[12px] px-2 py-1">
                      <span className="font-mono text-ink flex-1 truncate">
                        {item.label}
                      </span>
                      {/* Start column — show if explicit value or user clicked to add */}
                      {(item.offset !== undefined || startVisibleFor.has(idx)) ? (
                        <>
                          <span className="text-muted text-[10px]">start</span>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            aria-label="start"
                            key={`st-${idx}-${item.key}-${item.offset}`}
                            defaultValue={item.offset ?? 1}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              onUpdateItemOffset(item.key, !isNaN(val) && val >= 1 && val <= 12 ? val : undefined);
                            }}
                            className="font-mono text-ink w-10 text-center bg-transparent border border-border/50 rounded text-[11px] py-0.5"
                          />
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label="Add start"
                          onClick={() => showStartFor(idx)}
                          className="text-[9px] text-muted hover:text-ink"
                          title="Set start column"
                        >
                          +col
                        </button>
                      )}
                      <span className="text-muted text-[10px]">span</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        key={`sp-${idx}-${item.key}-${item.width}`}
                        defaultValue={item.width}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1 && val <= 12 && val !== item.width) {
                            onUpdateItemWidth(item.key, val);
                          }
                        }}
                        className="font-mono text-ink w-10 text-center bg-transparent border border-border/50 rounded text-[11px] py-0.5"
                      />
                      {/* Responsive toggle button */}
                      <button
                        type="button"
                        aria-label={responsiveOpen ? 'Hide responsive overrides' : 'Show responsive overrides'}
                        onClick={() => toggleResponsiveFor(idx)}
                        title="Responsive breakpoint overrides"
                        className={`text-[9px] px-1 rounded transition-colors ${
                          hasResponsive
                            ? 'text-accent font-bold'
                            : responsiveOpen
                            ? 'text-ink'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        {responsiveOpen ? 'resp\u25B4' : 'resp\u25BE'}
                      </button>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => onReorderItem(item.key, 'up')}
                          className="text-[9px] text-muted hover:text-ink disabled:opacity-30 px-0.5"
                          title="Move region up"
                        >
                          &#9650;
                        </button>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => onReorderItem(item.key, 'down')}
                          className="text-[9px] text-muted hover:text-ink disabled:opacity-30 px-0.5"
                          title="Move region down"
                        >
                          &#9660;
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove region"
                        onClick={() => onRemoveItem(item.key)}
                        className="text-[10px] text-muted hover:text-error transition-colors px-1"
                      >
                        &times;
                      </button>
                    </div>

                    {/* Responsive overrides section — expanded per item */}
                    {responsiveOpen && (
                      <div className="px-2 pb-2 space-y-1 border-t border-border/30 mt-0.5 pt-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-muted">
                            Responsive
                          </span>
                          {hasResponsive && (
                            <button
                              type="button"
                              onClick={() => {
                                // Clear all breakpoints one by one
                                for (const bp of breakpointNames) {
                                  if (responsive[bp]) {
                                    onUpdateItemResponsive(item.key, bp, undefined);
                                  }
                                }
                              }}
                              className="text-[9px] text-muted hover:text-error transition-colors"
                              title="Clear all responsive overrides"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        {breakpointNames.map((bp) => {
                          const bpOverride = responsive?.[bp] ?? {};
                          return (
                            <div key={bp} className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-muted w-6 shrink-0">{bp}</span>
                              {/* Hidden toggle */}
                              <label className="flex items-center gap-1 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={bpOverride.hidden === true}
                                  onChange={(e) => {
                                    const hidden = e.target.checked || undefined;
                                    const newOverride = { ...bpOverride, hidden };
                                    // Clean up undefined hidden
                                    if (!newOverride.hidden) delete newOverride.hidden;
                                    // If empty, remove the breakpoint
                                    onUpdateItemResponsive(
                                      item.key,
                                      bp,
                                      Object.keys(newOverride).length > 0 ? newOverride : undefined,
                                    );
                                  }}
                                  className="w-3 h-3"
                                />
                                <span className="text-[10px] text-muted">hide</span>
                              </label>
                              {/* Width override — only when not hidden */}
                              {bpOverride.hidden !== true && (
                                <>
                                  <span className="text-[10px] text-muted">span</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    aria-label={`${bp} span`}
                                    key={`resp-sp-${idx}-${bp}-${bpOverride.width}`}
                                    defaultValue={bpOverride.width ?? ''}
                                    placeholder="—"
                                    onBlur={(e) => {
                                      const val = e.target.value.trim() === '' ? undefined : parseInt(e.target.value, 10);
                                      const newWidth = val !== undefined && !isNaN(val) && val >= 1 && val <= 12 ? val : undefined;
                                      const updated = { ...bpOverride };
                                      if (newWidth !== undefined) {
                                        updated.width = newWidth;
                                      } else {
                                        delete updated.width;
                                      }
                                      onUpdateItemResponsive(
                                        item.key,
                                        bp,
                                        Object.keys(updated).length > 0 ? updated : undefined,
                                      );
                                    }}
                                    className="font-mono text-ink w-10 text-center bg-transparent border border-border/50 rounded text-[10px] py-0.5"
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={index === 0}
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
              >
                Move Up
              </button>
              <button
                type="button"
                disabled={index === total - 1}
                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                className="text-[10px] font-mono text-muted hover:text-ink disabled:opacity-30"
              >
                Move Down
              </button>
            </div>
            <div className="flex gap-2">
              {onEditLayout && (
                <button
                  type="button"
                  aria-label="Edit Layout"
                  onClick={(e) => { e.stopPropagation(); onEditLayout(); }}
                  className="text-[10px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
                >
                  Edit Layout
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-[10px] text-muted hover:text-error font-bold uppercase tracking-wider transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DroppablePageOverlay ──────────────────────────────────────────────

/**
 * Invisible drop zone that wraps a page card, making it a target for
 * item-drag operations. Highlights with a ring when an item is dragged over.
 */
function DroppablePageOverlay({
  pageId,
  children,
}: {
  pageId: string;
  children: React.ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `drop-page-${pageId}`,
    data: { type: 'page-drop', pageId },
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-drop-page={pageId}
      className={`relative rounded-lg transition-all duration-150${isDropTarget ? ' ring-2 ring-accent ring-offset-1' : ''}`}
    >
      {isDropTarget && (
        <div className="absolute inset-0 bg-accent/5 rounded-lg pointer-events-none z-10" />
      )}
      {children}
    </div>
  );
}

// ── SortablePageCard ─────────────────────────────────────────────────

/** Wraps PageCard with useSortable and DroppablePageOverlay. */
function SortablePageCard({
  page,
  index,
  ...cardProps
}: {
  page: PageView;
  index: number;
} & Omit<React.ComponentProps<typeof PageCard>, 'page' | 'index' | 'sortableRef' | 'dragHandleRef' | 'isDragging'>) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: page.id,
    index,
    data: { type: 'page' },
    transition: null, // we handle positioning via project.movePageToIndex
  });

  return (
    <DroppablePageOverlay pageId={page.id}>
      <PageCard
        {...cardProps}
        page={page}
        index={index}
        sortableRef={ref}
        dragHandleRef={handleRef}
        isDragging={isDragSource}
      />
    </DroppablePageOverlay>
  );
}

// ── DraggableUnassignedItem ───────────────────────────────────────────

/** Makes an unassigned item draggable so it can be dropped onto a page card. */
function DraggableUnassignedItem({
  itemKey,
  label,
}: {
  itemKey: string;
  label: string;
}) {
  const { ref, isDragSource } = useDraggable({
    id: `item-${itemKey}`,
    data: { type: 'item', key: itemKey },
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-draggable-item={itemKey}
      className={`group text-[12px] text-muted px-2 py-1 bg-subtle/30 rounded font-mono truncate cursor-grab active:cursor-grabbing flex items-center gap-1.5 transition-opacity${isDragSource ? ' opacity-40' : ''}`}
    >
      {/* Grip icon */}
      <svg
        width="6"
        height="10"
        viewBox="0 0 6 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
      >
        <circle cx="1.5" cy="2" r="1" fill="currentColor" />
        <circle cx="4.5" cy="2" r="1" fill="currentColor" />
        <circle cx="1.5" cy="5" r="1" fill="currentColor" />
        <circle cx="4.5" cy="5" r="1" fill="currentColor" />
        <circle cx="1.5" cy="8" r="1" fill="currentColor" />
        <circle cx="4.5" cy="8" r="1" fill="currentColor" />
      </svg>
      <span className="truncate">{label}</span>
    </div>
  );
}

// ── Main PagesTab ────────────────────────────────────────────────────

export function PagesTab() {
  const project = useProject();
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);
  const [focusedPageId, setFocusedPageId] = useState<string | null>(null);

  const structure = usePageStructure();

  // FF10: Sidebar <-> PagesTab sync. Context is null when no provider is mounted
  // (e.g. isolated unit tests). All operations guard with `if (!activePageCtx)`.
  const activePageCtx = useContext(ActivePageContext);

  // When activePageKey changes externally (sidebar click), find the matching page and expand it
  useEffect(() => {
    if (!activePageCtx) return;
    const { activePageKey } = activePageCtx;
    if (!activePageKey) return;
    const matchingPage = structure.pages.find((p) =>
      p.items.some((item) => item.key === activePageKey),
    );
    if (matchingPage && matchingPage.id !== expandedPageId) {
      setExpandedPageId(matchingPage.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageCtx?.activePageKey]);

  const handleTogglePage = useCallback((pageId: string) => {
    const nextId = expandedPageId === pageId ? null : pageId;
    setExpandedPageId(nextId);
    // Sync sidebar: set activePageKey to the first item key on the expanded page
    if (nextId && activePageCtx) {
      const page = structure.pages.find((p) => p.id === nextId);
      if (page && page.items.length > 0) {
        activePageCtx.setActivePageKey(page.items[0].key);
      }
    }
  }, [expandedPageId, activePageCtx, structure.pages]);

  const isSingle = structure.mode === 'single';
  const hasPages = structure.pages.length > 0;

  /** Shared callback props for PageCard / SortablePageCard */
  const pageCardProps = useCallback((page: PageView) => ({
    breakpointNames: structure.breakpointNames,
    onDelete: () => project.removePage(page.id),
    onMoveUp: () => project.reorderPage(page.id, 'up'),
    onMoveDown: () => project.reorderPage(page.id, 'down'),
    onUpdateTitle: (title: string) => project.updatePage(page.id, { title }),
    onUpdateDescription: (description: string | undefined) => project.updatePage(page.id, { description }),
    onRemoveItem: (key: string) => project.removeItemFromPage(page.id, key),
    onUpdateItemWidth: (key: string, width: number) => project.setItemWidth(page.id, key, width),
    onUpdateItemOffset: (key: string, offset: number | undefined) => project.setItemOffset(page.id, key, offset),
    onUpdateItemResponsive: (key: string, bp: string, overrides: { width?: number; offset?: number; hidden?: boolean } | undefined) =>
      project.setItemResponsive(page.id, key, bp, overrides),
    onReorderItem: (key: string, dir: 'up' | 'down') => project.reorderItemOnPage(page.id, key, dir),
    onEditLayout: () => setFocusedPageId(page.id),
  }), [project, structure.breakpointNames]);

  // Focus Mode — full-width layout editor for a single page
  if (focusedPageId) {
    return (
      <PagesFocusView
        pageId={focusedPageId}
        onBack={() => setFocusedPageId(null)}
        onNavigate={(pageId) => setFocusedPageId(pageId)}
      />
    );
  }

  return (
    <WorkspacePage className="overflow-y-auto">
      {/* Sticky header */}
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-4 border-b border-border/40"
      >
        <ModeSelector mode={structure.mode} onSetMode={(m) => project.setFlow(m)} />
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-6 space-y-6">
        {/* Single mode: no pages */}
        {isSingle && !hasPages && (
          <p className="text-[12px] text-muted">
            Switch to Wizard or Tabs to organize your form into pages.
          </p>
        )}

        {/* Single mode: has dormant pages */}
        {isSingle && hasPages && (
          <p className="text-[12px] text-muted">
            Pages are preserved but not active in single mode.
          </p>
        )}

        {/* Active mode (wizard/tabs): unified DragDropProvider for both page reorder
            (FF1) and item-to-page assignment (FF4). */}
        {!isSingle && (
          <DragDropProvider
            onDragEnd={(event: any) => {
              if (event.canceled) return;
              const sourceData = event.operation?.source?.data ?? {};
              const targetData = event.operation?.target?.data ?? {};

              if (sourceData.type === 'item' && targetData.type === 'page-drop') {
                // FF4: unassigned item dropped onto a page card — assign it
                project.placeOnPage(sourceData.key, targetData.pageId);
                return;
              }

              // FF1: page dragged to reorder
              const sourceId = String(event.operation?.source?.id ?? '');
              const targetId = String(event.operation?.target?.id ?? '');
              if (!sourceId || !targetId || sourceId === targetId) return;
              const pages = structure.pages;
              const targetIndex = pages.findIndex((p) => p.id === targetId);
              if (targetIndex === -1) return;
              project.movePageToIndex(sourceId, targetIndex);
            }}
            sensors={() => [
              PointerSensor.configure({
                activationConstraints: [
                  new PointerActivationConstraints.Distance({ value: 5 }),
                ],
              }),
              KeyboardSensor,
            ]}
          >
            {/* Page list */}
            {hasPages && (
              <div className="space-y-3">
                {structure.pages.map((page, i) => (
                  <SortablePageCard
                    key={page.id}
                    page={page}
                    index={i}
                    total={structure.pages.length}
                    isExpanded={expandedPageId === page.id}
                    onToggle={() => handleTogglePage(page.id)}
                    {...pageCardProps(page)}
                  />
                ))}
              </div>
            )}

            {/* Add page button */}
            <button
              type="button"
              aria-label="Add page"
              onClick={() => {
                const result = project.addPage('New Page');
                if (result.createdId) {
                  setExpandedPageId(result.createdId);
                  // Sync sidebar to the new page's group key
                  const groupKey = result.affectedPaths[0];
                  if (groupKey && activePageCtx) activePageCtx.setActivePageKey(groupKey);
                }
              }}
              className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
            >
              + Add Page
            </button>

            {/* Unassigned items — draggable onto page cards (FF4) */}
            {structure.unassigned.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
                  Unassigned
                </p>
                <div className="space-y-1">
                  {structure.unassigned.map((item) => (
                    <DraggableUnassignedItem
                      key={item.key}
                      itemKey={item.key}
                      label={item.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </DragDropProvider>
        )}

        {/* Single mode: dormant page list (read-only, pointer-events-none) */}
        {isSingle && hasPages && (
          <div className="opacity-50 pointer-events-none space-y-3">
            {structure.pages.map((page, i) => (
              <PageCard
                key={page.id}
                page={page}
                index={i}
                total={structure.pages.length}
                isExpanded={expandedPageId === page.id}
                onToggle={() => handleTogglePage(page.id)}
                {...pageCardProps(page)}
              />
            ))}
          </div>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
