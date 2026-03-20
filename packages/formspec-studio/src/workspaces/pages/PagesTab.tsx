/** @filedesc Pages workspace tab for managing wizard pages, regions, and page-level diagnostics. */
import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { PointerSensor, KeyboardSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { usePageStructure } from './usePageStructure';
import { useProject } from '../../state/useProject';
import { ActivePageContext } from '../../state/useActivePage';
import { DragHandle } from '../editor/DragHandle';
import { PagesFocusView } from './PagesFocusView';
import type { PageView } from 'formspec-studio-core';

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
  isExpanded,
  onToggle,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
  confirmingDelete,
  onUpdateTitle,
  onUpdateDescription,
  onRemoveItem,
  onAddItem,
  unassigned,
  onEditLayout,
  sortableRef,
  dragHandleRef,
  isDragging,
}: {
  page: PageView;
  index: number;
  total: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
  confirmingDelete?: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string | undefined) => void;
  onRemoveItem: (itemKey: string) => void;
  onAddItem?: (key: string) => void;
  unassigned?: Array<{ key: string; label: string }>;
  onEditLayout?: () => void;
  sortableRef?: (el: Element | null) => void;
  dragHandleRef?: (el: Element | null) => void;
  isDragging?: boolean;
}) {
  const items = page.items ?? [];
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);

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
          {/* Compact grid preview */}
          {items.length > 0 && (
            <div className="grid grid-cols-12 gap-0.5 h-6">
              {items.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-sm flex items-center justify-center text-[8px] text-muted truncate ${item.status === 'broken' ? 'bg-amber-300/30' : 'bg-accent/20'}`}
                  style={{ gridColumn: `span ${Math.min(item.width, 12)}` }}
                >
                  <span className="truncate px-0.5">{item.label}</span>
                </div>
              ))}
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

          {/* Item list — simplified for Overview Mode */}
          {items.length > 0 && (
            <div className="space-y-0.5">
              {items.map((item) => {
                const isBroken = item.status === 'broken';
                const widthLabel = item.width === 12 ? 'Full' : item.width === 6 ? 'Half' : item.width === 4 ? 'Third' : item.width === 3 ? 'Quarter' : `${item.width}/12`;
                return (
                  <div key={item.key} className={`flex items-center gap-2 text-[12px] px-2 py-1 rounded ${isBroken ? 'bg-amber-50' : 'bg-subtle/30'}`}>
                    <span className={`flex-1 truncate ${isBroken ? 'text-amber-700' : 'text-ink'}`}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-muted font-mono shrink-0">{widthLabel}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${item.label}`}
                      onClick={() => onRemoveItem(item.key)}
                      className="text-[10px] text-muted hover:text-error transition-colors px-0.5 shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* C5: Quick add unassigned items */}
          {unassigned && unassigned.length > 0 && onAddItem && (
            <div className="pt-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted mb-1">Add to this page</p>
              <div className="flex flex-wrap gap-1">
                {unassigned.slice(0, 8).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onAddItem(item.key)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-subtle/50 text-muted hover:text-ink hover:bg-subtle transition-colors"
                  >
                    + {item.label}
                  </button>
                ))}
                {unassigned.length > 8 && (
                  <span className="text-[10px] text-muted px-1 py-0.5">+{unassigned.length - 8} more</span>
                )}
              </div>
            </div>
          )}

          {/* Actions / F1: Delete confirmation */}
          {confirmingDelete ? (
            <div className="flex items-center justify-between pt-2 border-t border-error/20 bg-error/5 -mx-3 -mb-3 px-3 py-2 rounded-b-lg">
              <span className="text-[11px] text-error">Delete this page and its items?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCancelDelete?.(); }}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onConfirmDelete?.(); }}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-error/10 text-error hover:bg-error/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-border">
              {onEditLayout && (
                <button
                  type="button"
                  aria-label="Edit Layout"
                  onClick={(e) => { e.stopPropagation(); onEditLayout(); }}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                >
                  Edit Layout
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-error/60 hover:text-error hover:bg-error/5 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
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
  const [confirmDeletePageId, setConfirmDeletePageId] = useState<string | null>(null);

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
    onDelete: () => setConfirmDeletePageId(page.id),
    onCancelDelete: () => setConfirmDeletePageId(null),
    onConfirmDelete: () => { project.removePage(page.id); setConfirmDeletePageId(null); },
    confirmingDelete: confirmDeletePageId === page.id,
    onUpdateTitle: (title: string) => project.updatePage(page.id, { title }),
    onUpdateDescription: (description: string | undefined) => project.updatePage(page.id, { description }),
    onRemoveItem: (key: string) => project.removeItemFromPage(page.id, key),
    onAddItem: (key: string) => project.placeOnPage(key, page.id, { span: 12 }),
    unassigned: structure.unassigned,
    onEditLayout: () => setFocusedPageId(page.id),
  }), [project, confirmDeletePageId, structure.unassigned]);

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
            {/* F2/F3: Empty state for wizard/tabs with no pages */}
            {!hasPages && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-[13px] text-muted">
                  Create pages to organize your form into steps.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => project.autoGeneratePages()}
                    className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    Auto-generate from groups
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const result = project.addPage('Page 1');
                      if (result.createdId) setExpandedPageId(result.createdId);
                    }}
                    className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-subtle text-muted hover:text-ink transition-colors"
                  >
                    Add blank page
                  </button>
                </div>
              </div>
            )}

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

        {/* Single mode: dormant page list (reduced opacity, still interactive for Focus Mode) */}
        {isSingle && hasPages && (
          <div className="opacity-50 space-y-3">
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
