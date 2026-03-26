/** @filedesc Tabs-mode renderer — horizontal tab bar with one visible page panel. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GridCanvas } from './GridCanvas';
import { UnassignedItemsTray } from './UnassignedItemsTray';
import { buildPageActions, type ModeRendererProps } from './mode-renderer-props';
import type { PageView, PlaceableItem } from 'formspec-studio-core';

function TabPanel({
  page,
  allPages,
  unassigned,
  props,
}: {
  page: PageView;
  allPages: Array<{ id: string; title: string }>;
  unassigned: PlaceableItem[];
  props: ModeRendererProps;
}) {
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const actions = buildPageActions(
    { id: page.id, title: page.title || page.id },
    props,
  );
  const otherPages = allPages.filter((p) => p.id !== page.id);
  const pageLabel = page.title || page.id;

  return (
    <div
      role="tabpanel"
      aria-labelledby={`tab-${page.id}`}
      id={`tabpanel-${page.id}`}
      data-testid={`page-card-${page.id}`}
      className="space-y-4 rounded-b-2xl rounded-t-none border border-t-0 border-border bg-surface px-5 py-5"
    >
      {/* Description */}
      {page.description && (
        <p className="text-[12px] text-muted">{page.description}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={actions.onOpenFocusMode}
          className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-accent/40 hover:text-ink"
        >
          Edit layout
        </button>
      </div>

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
        compact
        pageId={page.id}
      />

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
    </div>
  );
}

export function TabsModeEditor(props: ModeRendererProps) {
  const { structure, handleAddPage } = props;
  const { pages, unassigned } = structure;
  const [selectedTabId, setSelectedTabId] = useState<string | null>(
    pages[0]?.id ?? null,
  );
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Keep selectedTabId in sync if the selected page was deleted
  useEffect(() => {
    if (pages.length === 0) {
      setSelectedTabId(null);
      return;
    }
    if (!pages.some((p) => p.id === selectedTabId)) {
      setSelectedTabId(pages[0].id);
    }
  }, [pages, selectedTabId]);

  useEffect(() => {
    if (editingTabId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingTabId]);

  const commitTabRename = useCallback(
    (pageId: string, currentTitle: string) => {
      if (!editInputRef.current) return;
      const next = editInputRef.current.value.trim();
      if (next && next !== currentTitle) {
        props.project.updatePage(pageId, { title: next });
      }
      setEditingTabId(null);
    },
    [props.project],
  );

  if (pages.length === 0) return null;

  const selectedPage = pages.find((p) => p.id === selectedTabId) ?? pages[0];
  const allPageSummaries = pages.map((p) => ({ id: p.id, title: p.title || p.id }));

  return (
    <div className="space-y-4" data-testid="tabs-mode-editor">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Pages"
        className="flex items-end gap-0 border-b border-border"
      >
        {pages.map((page) => {
          const isSelected = page.id === selectedPage.id;
          const label = page.title || page.id;

          if (editingTabId === page.id) {
            return (
              <div key={page.id} className="px-1 pb-1">
                <input
                  ref={editInputRef}
                  type="text"
                  defaultValue={label}
                  aria-label="Edit tab title"
                  onBlur={() => commitTabRename(page.id, label)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitTabRename(page.id, label);
                    if (event.key === 'Escape') setEditingTabId(null);
                  }}
                  className="border-b border-accent bg-transparent px-2 py-1 text-[13px] font-semibold text-ink outline-none"
                />
              </div>
            );
          }

          return (
            <button
              key={page.id}
              role="tab"
              id={`tab-${page.id}`}
              aria-selected={isSelected}
              aria-controls={`tabpanel-${page.id}`}
              type="button"
              onClick={() => setSelectedTabId(page.id)}
              onDoubleClick={() => setEditingTabId(page.id)}
              className={`px-4 py-2 text-[13px] transition-colors ${
                isSelected
                  ? 'border-b-2 border-b-accent font-semibold text-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          );
        })}

        {/* Add tab button */}
        <button
          type="button"
          aria-label="Add page"
          onClick={handleAddPage}
          className="px-3 py-2 text-[13px] text-muted transition-colors hover:text-ink"
        >
          +
        </button>
      </div>

      {/* Selected page panel */}
      <TabPanel
        page={selectedPage}
        allPages={allPageSummaries}
        unassigned={unassigned}
        props={props}
      />

      <UnassignedItemsTray items={unassigned} />
    </div>
  );
}
