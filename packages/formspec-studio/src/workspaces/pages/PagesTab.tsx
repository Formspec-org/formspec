/** @filedesc Layout workspace tab for page flow planning and grid layout editing. */
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import {
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
  type Draggable,
} from '@dnd-kit/dom';
import { isInteractiveElement } from '@dnd-kit/dom/utilities';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { usePageStructure } from './usePageStructure';
import { useProject } from '../../state/useProject';
import { ActiveGroupContext } from '../../state/useActiveGroup';
import { DragHandle } from '../editor/DragHandle';
import { GridCanvas } from './GridCanvas';
import type { PageItemView, PageView, PlaceableItem } from 'formspec-studio-core';

type FlowMode = 'single' | 'wizard' | 'tabs';

function ModeSelector({
  mode,
  onSetMode,
}: {
  mode: FlowMode;
  onSetMode: (mode: FlowMode) => void;
}) {
  const modes: Array<{ id: FlowMode; label: string }> = [
    { id: 'single', label: 'Single' },
    { id: 'wizard', label: 'Wizard' },
    { id: 'tabs', label: 'Tabs' },
  ];
  const modeHelpText: Record<FlowMode, string> = {
    single: 'One continuous form. Existing pages stay preserved but inactive.',
    wizard: 'Step through pages in order and control how the form advances.',
    tabs: 'Keep pages directly reachable from a top-level tab strip.',
  };

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1 rounded-[14px] border border-border bg-surface p-1 shadow-sm">
        {modes.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSetMode(entry.id)}
            className={`rounded-[10px] px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-colors ${
              mode === entry.id
                ? 'bg-ink text-white'
                : 'text-muted hover:bg-subtle hover:text-ink'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="max-w-[560px] text-[12px] leading-5 text-muted">{modeHelpText[mode]}</p>
    </div>
  );
}

function isDeletableItem(item: PageItemView): boolean {
  if (item.status === 'broken') return true;
  return item.itemType === 'group' && (item.childCount ?? 0) === 0;
}

function isEffectivelyEmpty(page: PageView): boolean {
  if (page.items.length === 0) return true;
  return page.items.every(isDeletableItem);
}

/** Keep PointerSensor from competing with grid width resize (see GridItemBlock `[data-resize-handle]`). */
function pagesTabPointerPreventActivation(event: PointerEvent, source: Draggable): boolean {
  const target = event.target;
  if (target instanceof Element && target.closest('[data-resize-handle]')) {
    return true;
  }
  if (target === source.element) return false;
  if (target === source.handle) return false;
  if (!(target instanceof Element)) return false;
  if (source.handle?.contains(target)) return false;
  return isInteractiveElement(target);
}

function pageSummary(page: PageView): string {
  if (isEffectivelyEmpty(page)) return 'Empty';
  const count = page.items.length;
  return `${count} item${count === 1 ? '' : 's'}`;
}

interface PageActions {
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string | undefined) => void;
  onMovePage: (direction: 'up' | 'down') => void;
  onRemoveItem: (itemKey: string) => void;
  onSetWidth: (itemKey: string, width: number) => void;
  onSetOffset: (itemKey: string, offset: number | undefined) => void;
  onSetResponsive: (itemKey: string, bp: string, overrides: { width?: number; offset?: number; hidden?: boolean }) => void;
  onMoveItemToIndex: (itemKey: string, targetIndex: number) => void;
  onAddItem: (itemKey: string) => void;
  onDeletePage: () => void;
  onMoveItemToPage: (itemKey: string, targetPageId: string) => void;
  onUnassignItem: (itemKey: string) => void;
}

function PageCard({
  page,
  index,
  totalPages,
  allPages,
  unassigned,
  isDormant,
  actions,
  sortableRef,
  dragHandleRef,
  isDragging,
}: {
  page: PageView;
  index: number;
  totalPages: number;
  allPages: Array<{ id: string; title: string }>;
  unassigned: PlaceableItem[];
  isDormant: boolean;
  actions: PageActions;
  sortableRef?: (element: Element | null) => void;
  dragHandleRef?: (element: Element | null) => void;
  isDragging?: boolean;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  // Pages the selected item can be moved to (every page except the current one)
  const otherPages = allPages.filter((p) => p.id !== page.id);

  const canDelete = !isDormant && totalPages > 1 && isEffectivelyEmpty(page);
  const deleteBlockedReason = isDormant
    ? 'Switch to Wizard or Tabs before deleting pages.'
    : totalPages <= 1
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
    if (nextDescription !== (page.description ?? undefined)) actions.onUpdateDescription(nextDescription);
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
        <div
          onClick={(event) => event.stopPropagation()}
          className={isDormant ? 'opacity-40' : ''}
        >
          <DragHandle className="-ml-1" ref={dragHandleRef as React.Ref<HTMLDivElement>} />
        </div>

        <span className="w-5 shrink-0 pt-1 text-center font-mono text-[11px] text-muted">
          {index + 1}
        </span>

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
                {isEffectivelyEmpty(page) && !isDormant && (
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] text-muted">
                    Safe to delete
                  </span>
                )}
                {isDormant && (
                  <span data-testid="dormant-badge" className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                    Dormant
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={`Move ${pageLabel} up`}
                disabled={isDormant || index === 0}
                onClick={() => actions.onMovePage('up')}
                className="rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${pageLabel} down`}
                disabled={isDormant || index === totalPages - 1}
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
                  placeholder="Description…"
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

              <div className="pt-1">
                <GridCanvas
                  items={page.items}
                  activeBreakpoint="base"
                  selectedItemKey={selectedItemKey}
                  onSelectItem={setSelectedItemKey}
                  onRemoveItem={(key) => actions.onRemoveItem(key)}
                  onSetWidth={(key, width) => actions.onSetWidth(key, width)}
                  onSetOffset={(key, offset) => actions.onSetOffset(key, offset)}
                  onSetResponsive={(key, bp, overrides) => actions.onSetResponsive(key, bp, overrides)}
                  onMoveItem={(key, targetIndex) => actions.onMoveItemToIndex(key, targetIndex)}
                  otherPages={otherPages}
                  onMoveToPage={(itemKey, targetPageId) => actions.onMoveItemToPage(itemKey, targetPageId)}
                  onUnassignItem={(itemKey) => actions.onUnassignItem(itemKey)}
                  disabled={isDormant}
                  compact
                  pageId={page.id}
                />
              </div>

              {isDormant ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  Switch to Wizard or Tabs to edit assignments or layout for dormant pages.
                </p>
              ) : unassigned.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Add from unassigned</p>
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
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
              ) : null}

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
      className={`relative rounded-2xl transition-all${isDropTarget ? ' ring-2 ring-accent ring-offset-1' : ''}`}
    >
      {isDropTarget && <div className="pointer-events-none absolute inset-0 rounded-2xl bg-accent/5" />}
      {children}
    </div>
  );
}

function SortablePageCard({
  page,
  index,
  ...props
}: {
  page: PageView;
  index: number;
} & Omit<React.ComponentProps<typeof PageCard>, 'page' | 'index' | 'sortableRef' | 'dragHandleRef' | 'isDragging'>) {
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
      className={`flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted ${
        isDragSource ? 'opacity-40' : ''
      }`}
    >
      <svg
        width="6"
        height="10"
        viewBox="0 0 6 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
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

export function PagesTab() {
  const project = useProject();
  const structure = usePageStructure();
  const activeGroupCtx = useContext(ActiveGroupContext);

  const isSingle = structure.mode === 'single';
  const hasPages = structure.pages.length > 0;

  // Single-toast: rapid deletions overwrite the previous toast (latest wins). Intentional.
  const [deleteToast, setDeleteToast] = useState<{ title: string } | null>(null);

  const handleAddPage = useCallback(() => {
    const result = project.addPage(`Page ${structure.pages.length + 1}`);
    if (result.createdId && result.groupKey && activeGroupCtx) {
      activeGroupCtx.setActiveGroupKey(result.groupKey);
    }
  }, [activeGroupCtx, project, structure.pages.length]);

  return (
    <WorkspacePage maxWidth="max-w-[980px]" className="overflow-y-auto">
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 z-20 border-b border-border/40 bg-bg-default/85 py-6 backdrop-blur-md"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="max-w-[560px] text-[20px] font-semibold leading-tight text-ink">
                Layout
              </p>
              <p className="max-w-[620px] text-[13px] leading-5 text-muted">
                Organize the user journey — reorder pages, assign fields, and edit grid layouts.
              </p>
            </div>
            <ModeSelector mode={structure.mode} onSetMode={(mode) => project.setFlow(mode)} />
          </div>

          {!isSingle && (
            <div className="flex items-center gap-2">
              {hasPages && (
                <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted">
                  {structure.pages.length} {structure.pages.length === 1 ? 'page' : 'pages'}
                </div>
              )}
              <button
                type="button"
                aria-label="Add page"
                onClick={handleAddPage}
                className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold tracking-wide text-white transition-colors hover:bg-ink/90"
              >
                Add page
              </button>
            </div>
          )}
        </div>
      </WorkspacePageSection>

      <WorkspacePageSection className="space-y-6 py-6">
        {isSingle && !hasPages && (
          <p className="text-[13px] text-muted">
            Switch to Wizard or Tabs to organize your form into pages.
          </p>
        )}

        {isSingle && hasPages && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            Pages are preserved but not active in single mode.
          </p>
        )}

        {!isSingle && !hasPages && (
          <div className="space-y-4 rounded-[28px] border border-dashed border-border bg-surface px-6 py-10 text-center">
            <div className="space-y-2">
              <p className="text-[18px] font-semibold text-ink">No pages yet</p>
              <p className="mx-auto max-w-[460px] text-[13px] leading-5 text-muted">
                Start with a manual page, or generate pages from your current group structure and adjust them after.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => project.autoGeneratePages()}
                className="rounded-full border border-border px-4 py-2 text-[12px] font-semibold text-muted transition-colors hover:text-ink"
              >
                Auto-generate from groups
              </button>
              <button
                type="button"
                onClick={handleAddPage}
                className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-ink/90"
              >
                Add page
              </button>
            </div>
          </div>
        )}

        {hasPages && (
          <DragDropProvider
            onDragEnd={(event: any) => {
              if (event.canceled) return;
              const sourceData = event.operation?.source?.data ?? {};
              const targetData = event.operation?.target?.data ?? {};

              if (sourceData.type === 'item' && targetData.type === 'page-drop') {
                project.placeOnPage(sourceData.key, targetData.pageId);
                activeGroupCtx?.setActiveGroupKey(sourceData.key);
                return;
              }

              const sourceId = String(event.operation?.source?.id ?? '');
              const targetId = String(event.operation?.target?.id ?? '');
              if (!sourceId || !targetId || sourceId === targetId || isSingle) return;
              const targetIndex = structure.pages.findIndex((page) => page.id === targetId);
              if (targetIndex === -1) return;
              project.movePageToIndex(sourceId, targetIndex);
            }}
            sensors={() => [
              PointerSensor.configure({
                activationConstraints: [
                  new PointerActivationConstraints.Distance({ value: 5 }),
                ],
                preventActivation: pagesTabPointerPreventActivation,
              }),
              KeyboardSensor,
            ]}
          >
            <div className={`space-y-4${isSingle ? ' opacity-75' : ''}`}>
              {structure.pages.map((page, index) => (
                <SortablePageCard
                  key={page.id}
                  page={page}
                  index={index}
                  totalPages={structure.pages.length}
                  allPages={structure.pages.map((p) => ({ id: p.id, title: p.title || p.id }))}
                  unassigned={structure.unassigned}
                  isDormant={isSingle}
                  actions={{
                    onUpdateTitle: (title) => project.updatePage(page.id, { title }),
                    onUpdateDescription: (description) => project.updatePage(page.id, { description }),
                    onMovePage: (direction) => project.reorderPage(page.id, direction),
                    onRemoveItem: (key) => project.removeItemFromPage(page.id, key),
                    onSetWidth: (key, width) => project.setItemWidth(page.id, key, width),
                    onSetOffset: (key, offset) => project.setItemOffset(page.id, key, offset),
                    onSetResponsive: (key, bp, overrides) => project.setItemResponsive(page.id, key, bp, overrides),
                    onMoveItemToIndex: (key, targetIndex) => project.moveItemOnPageToIndex(page.id, key, targetIndex),
                    onAddItem: (itemKey) => {
                      project.placeOnPage(itemKey, page.id, { span: 12 });
                      activeGroupCtx?.setActiveGroupKey(itemKey);
                    },
                    onDeletePage: () => {
                      const title = page.title || page.id;
                      project.removePage(page.id);
                      setDeleteToast({ title });
                    },
                    onMoveItemToPage: (itemKey, targetPageId) => {
                      project.moveItemToPage(page.id, itemKey, targetPageId, { span: 12 });
                    },
                    onUnassignItem: (itemKey) => {
                      project.removeItemFromPage(page.id, itemKey);
                    },
                  }}
                />
              ))}
            </div>

            {!isSingle && structure.unassigned.length > 0 && (
              <section aria-label="Unassigned items" className="space-y-3 rounded-[24px] border border-border/70 bg-surface px-5 py-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Unassigned</p>
                  <p className="text-[12px] text-muted">
                    Drag these onto a page card or use a page&apos;s quick-add actions.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {structure.unassigned.map((item) => (
                    <DraggableUnassignedItem
                      key={item.key}
                      itemKey={item.key}
                      label={item.label}
                    />
                  ))}
                </div>
              </section>
            )}
          </DragDropProvider>
        )}
      </WorkspacePageSection>

      {deleteToast && (
        <div
          style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
        >
          <p className="text-[13px] text-ink">{deleteToast.title} deleted</p>
          <button
            type="button"
            aria-label="Undo"
            onClick={() => {
              project.undo();
              setDeleteToast(null);
            }}
            className="rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-ink/90"
          >
            Undo
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDeleteToast(null)}
            className="text-[12px] text-muted transition-colors hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}
    </WorkspacePage>
  );
}
