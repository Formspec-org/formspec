/** @filedesc Accordion-style page card with inline title editing, grid canvas, and page actions. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { useDroppable } from '@dnd-kit/react';
import { DragHandle } from '../editor/DragHandle';
import { GridCanvas } from './GridCanvas';
import type { PageItemView, PageView, PlaceableItem } from 'formspec-studio-core';
import type { PageActions } from './mode-renderer-props';

function isDeletableItem(item: PageItemView): boolean {
  if (item.status === 'broken') return true;
  return item.itemType === 'group' && (item.childCount ?? 0) === 0;
}

export function isEffectivelyEmpty(page: PageView): boolean {
  if (page.items.length === 0) return true;
  return page.items.every(isDeletableItem);
}

function pageSummary(page: PageView): string {
  if (isEffectivelyEmpty(page)) return 'Empty';
  const count = page.items.length;
  return `${count} item${count === 1 ? '' : 's'}`;
}

export function PageCard({
  page,
  index,
  totalPages,
  allPages,
  unassigned,
  actions,
  sortableRef,
  dragHandleRef,
  isDragging,
  stepNumber,
}: {
  page: PageView;
  index: number;
  totalPages: number;
  allPages: Array<{ id: string; title: string }>;
  unassigned: PlaceableItem[];
  actions: PageActions;
  sortableRef?: (element: Element | null) => void;
  dragHandleRef?: (element: Element | null) => void;
  isDragging?: boolean;
  /** When provided, renders a prominent step-number circle instead of the plain index. */
  stepNumber?: number;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  const otherPages = allPages.filter((p) => p.id !== page.id);

  const canDelete = totalPages > 1 && isEffectivelyEmpty(page);
  const deleteBlockedReason =
    totalPages <= 1
      ? 'Keep at least one page in the flow.'
      : 'Move every assigned item off this page before deleting it.';

  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isEditingDescription) return;
    descriptionInputRef.current?.focus();
    descriptionInputRef.current?.select();
  }, [isEditingDescription]);

  const commitTitle = useCallback(() => {
    if (!titleInputRef.current) return;
    const nextTitle = titleInputRef.current.value.trim();
    if (nextTitle && nextTitle !== page.title) actions.onUpdateTitle(nextTitle);
    setIsEditingTitle(false);
  }, [page.title, actions]);

  const commitDescription = useCallback(() => {
    if (!descriptionInputRef.current) return;
    const nextDescription = descriptionInputRef.current.value.trim() || undefined;
    if (nextDescription !== (page.description ?? undefined))
      actions.onUpdateDescription(nextDescription);
    setIsEditingDescription(false);
  }, [page.description, actions]);

  const pageLabel = page.title || page.id;

  return (
    <div
      ref={sortableRef}
      data-testid={`page-card-${page.id}`}
      className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-opacity${
        isDragging ? ' opacity-40' : ''
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <div onClick={(event) => event.stopPropagation()}>
          <DragHandle className="-ml-1" ref={dragHandleRef as React.Ref<HTMLDivElement>} />
        </div>

        {stepNumber != null ? (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white"
            aria-label={`Step ${stepNumber}`}
          >
            {stepNumber}
          </span>
        ) : (
          <span className="w-5 shrink-0 pt-1 text-center font-mono text-[11px] text-muted">
            {index + 1}
          </span>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  defaultValue={pageLabel}
                  aria-label="Edit page title"
                  onBlur={commitTitle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitTitle();
                    if (event.key === 'Escape') setIsEditingTitle(false);
                  }}
                  className="w-full border-b border-accent bg-transparent text-[20px] font-semibold text-ink outline-none"
                />
              ) : (
                <button
                  type="button"
                  aria-label={`Edit title: ${pageLabel}`}
                  className="w-full truncate text-left text-[20px] font-semibold leading-none text-ink"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {pageLabel}
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                <span>{pageSummary(page)}</span>
                {isEffectivelyEmpty(page) && (
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] text-muted">
                    Safe to delete
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={`Move ${pageLabel} up`}
                disabled={index === 0}
                onClick={() => actions.onMovePage('up')}
                className="rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${pageLabel} down`}
                disabled={index === totalPages - 1}
                onClick={() => actions.onMovePage('down')}
                className="rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
              >
                ↓
              </button>
            </div>
          </div>

          <div className="space-y-4 border-t border-border/70 pt-4">
            {page.description && !isEditingDescription ? (
              <button
                type="button"
                aria-label="Edit description"
                className="w-full text-left text-[12px] text-muted transition-colors hover:text-ink"
                onClick={() => setIsEditingDescription(true)}
              >
                {page.description}
              </button>
            ) : isEditingDescription ? (
              <input
                ref={descriptionInputRef}
                type="text"
                defaultValue={page.description ?? ''}
                placeholder="Description..."
                onBlur={commitDescription}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitDescription();
                  if (event.key === 'Escape') setIsEditingDescription(false);
                }}
                className="w-full border-b border-accent bg-transparent text-[12px] text-muted outline-none"
              />
            ) : (
              <button
                type="button"
                aria-label="Add description"
                onClick={() => setIsEditingDescription(true)}
                className="text-[12px] text-muted transition-colors hover:text-ink"
              >
                + Add description
              </button>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={actions.onOpenFocusMode}
                className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-accent/40 hover:text-ink"
              >
                Edit layout
              </button>
            </div>

            <div className="pt-1">
              <GridCanvas
                items={page.items}
                activeBreakpoint="base"
                selectedItemKey={selectedItemKey}
                onSelectItem={setSelectedItemKey}
                onRemoveItem={(key) => actions.onRemoveItem(key)}
                onSetWidth={(key, width) => actions.onSetWidth(key, width)}
                onSetOffset={(key, offset) => actions.onSetOffset(key, offset)}
                onSetResponsive={(key, bp, overrides) =>
                  actions.onSetResponsive(key, bp, overrides)
                }
                onMoveItem={(key, targetIndex) => actions.onMoveItemToIndex(key, targetIndex)}
                otherPages={otherPages}
                onMoveToPage={(itemKey, targetPageId) =>
                  actions.onMoveItemToPage(itemKey, targetPageId)
                }
                onUnassignItem={(itemKey) => actions.onUnassignItem(itemKey)}
                compact
                pageId={page.id}
              />
            </div>

            {unassigned.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Add from unassigned
                </p>
                <div className="flex max-h-[200px] flex-wrap gap-2 overflow-y-auto">
                  {unassigned.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-label={`Add ${item.label} to ${pageLabel}`}
                      onClick={() => actions.onAddItem(item.key)}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent/30 hover:text-ink"
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-start justify-end gap-3 border-t border-border/70 pt-4">
              <div className="space-y-2 text-right">
                {!canDelete && (
                  <p className="max-w-[260px] text-[11px] leading-4 text-muted">
                    {deleteBlockedReason}
                  </p>
                )}

                {isConfirmingDelete ? (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="rounded border border-border px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      aria-label="Confirm delete"
                      onClick={actions.onDeletePage}
                      className="rounded bg-error/10 px-2.5 py-1 text-[11px] font-semibold text-error transition-colors hover:bg-error/15"
                    >
                      Confirm delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label="Delete page"
                    disabled={!canDelete}
                    onClick={() => setIsConfirmingDelete(true)}
                    className="rounded border border-error/30 px-2.5 py-1 text-[11px] font-semibold text-error transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:border-border disabled:text-muted"
                  >
                    Delete page
                  </button>
                )}

                {isConfirmingDelete && (
                  <p className="text-[11px] text-error">
                    Delete {pageLabel} permanently?
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DroppablePageOverlay({
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
      className={`relative rounded-2xl transition-all${
        isDropTarget ? ' ring-2 ring-accent ring-offset-1' : ''
      }`}
    >
      {isDropTarget && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-accent/5" />
      )}
      {children}
    </div>
  );
}

export function SortablePageCard({
  page,
  index,
  ...props
}: {
  page: PageView;
  index: number;
} & Omit<
  React.ComponentProps<typeof PageCard>,
  'page' | 'index' | 'sortableRef' | 'dragHandleRef' | 'isDragging'
>) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: page.id,
    index,
    data: { type: 'page' },
    transition: null,
  });

  return (
    <DroppablePageOverlay pageId={page.id}>
      <PageCard
        {...props}
        page={page}
        index={index}
        sortableRef={ref}
        dragHandleRef={handleRef}
        isDragging={isDragSource}
      />
    </DroppablePageOverlay>
  );
}
