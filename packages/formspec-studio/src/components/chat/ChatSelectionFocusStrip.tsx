/** @filedesc Chat rail — compact inspector for the selected form field, section, or content block (blueprint / editor). */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { FormItem, FormBind } from '@formspec-org/types';
import { Project } from '@formspec-org/studio-core';
import {
  bindsFor,
  buildDefLookup,
  buildCategorySummaries,
  buildMissingPropertyActions,
  buildRowSummaries,
  buildStatusPills,
} from '@formspec-org/studio-core';
import { useOptionalSelection } from '../../state/useSelection';
import { ItemRow } from '../../workspaces/editor/ItemRow';
import { GroupNode } from '../../workspaces/editor/GroupNode';
import { IconChevronDown, IconChevronRight } from '../icons/index';

function pathSegmentDepth(path: string): number {
  return path.includes('.') ? path.split('.').length - 1 : 0;
}

function fieldInsideRepeatableGroup(items: FormItem[], path: string): boolean {
  const segments = path.split('.');
  let bucket = items;
  for (let d = 0; d < segments.length - 1; d++) {
    const seg = segments[d]!;
    const node = bucket.find((n) => n.key === seg);
    if (!node || node.type !== 'group') return false;
    if (node.repeatable) return true;
    bucket = node.children ?? [];
  }
  return false;
}

/** User-facing kind line (not “definition” / not layout). */
function itemKindLabel(item: FormItem): string {
  if (item.type === 'group') return 'Section';
  if (item.type === 'display') return 'Content';
  return 'Field';
}

export function ChatSelectionFocusStrip({ project }: { project: Project }) {
  const definition = useSyncExternalStore(
    (onStoreChange) => project.onChange(onStoreChange),
    () => project.state.definition,
    () => project.state.definition,
  );

  const selection = useOptionalSelection();
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const items = (definition.items ?? []) as FormItem[];
  const allBinds = definition.binds as FormBind[] | undefined;

  const lookup = useMemo(() => buildDefLookup(items), [items]);

  const selectedKey = selection?.primaryKeyForTab('editor') ?? null;
  const select = selection?.select;
  const deselect = selection?.deselect;

  const selectedEntry = useMemo(() => {
    if (!selectedKey) return null;
    return lookup.get(selectedKey) ?? null;
  }, [lookup, selectedKey]);

  useEffect(() => {
    setPanelCollapsed(false);
  }, [selectedKey]);

  const onRenameIdentity = useCallback(
    (path: string, nextKey: string, nextLabel: string) => {
      if (!select) return;
      const currentKey = path.split('.').pop() ?? path;
      let nextPath = path;
      if (nextKey && nextKey !== currentKey) {
        project.renameItem(path, nextKey);
        const parentPath = path.split('.').slice(0, -1).join('.');
        nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      }
      project.updateItem(nextPath, { label: nextLabel || null });
      const nextItems = (project.state.definition.items ?? []) as FormItem[];
      const nextType = buildDefLookup(nextItems).get(nextPath)?.item?.type ?? 'field';
      select(nextPath, nextType, { tab: 'editor' });
    },
    [project, select],
  );

  const body = useMemo(() => {
    if (!selection || !selectedKey || !selectedEntry?.item) {
      return (
        <p
          data-testid="chat-selection-focus-empty"
          className="rounded-[10px] border border-dashed border-border/55 bg-bg-default/40 px-3 py-2.5 text-[11px] leading-snug text-muted"
        >
          Choose a field, section, or content block in the blueprint sidebar or the editor structure list. Changes
          apply to the form right away — with or without an assistant API key.
        </p>
      );
    }

    const item = selectedEntry.item;
    const path = selectedKey;
    const itemBinds = bindsFor(allBinds, path);
    const depth = pathSegmentDepth(path);
    const insideRepeat = fieldInsideRepeatableGroup(items, path);

    if (item.type === 'group') {
      const summaries = buildRowSummaries(item, itemBinds);
      const statusPills = buildStatusPills(itemBinds, item, {
        categorySummaries: buildCategorySummaries(item, itemBinds),
      });
      const resolvedLabel = typeof item.label === 'string' && item.label.trim() ? item.label : item.key;
      const missingActions = buildMissingPropertyActions(item, itemBinds, resolvedLabel);

      return (
        <GroupNode
          itemKey={item.key}
          itemPath={path}
          label={item.label}
          summaries={summaries}
          repeatable={item.repeatable}
          minRepeat={item.minRepeat}
          maxRepeat={item.maxRepeat}
          statusPills={statusPills}
          missingActions={missingActions}
          depth={0}
          selected
          item={item}
          binds={itemBinds}
          onUpdateItem={(changes) => project.updateItem(path, changes)}
          onRenameIdentity={(nextKey, nextLabel) => onRenameIdentity(path, nextKey, nextLabel)}
          onUpdateRepeatSettings={(changes) => project.updateItem(path, changes)}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {null}
        </GroupNode>
      );
    }

    if (item.type === 'field') {
      const categorySummaries = buildCategorySummaries(item, itemBinds);
      const statusPills = buildStatusPills(itemBinds, item, { categorySummaries });
      return (
        <ItemRow
          itemKey={item.key}
          itemPath={path}
          itemType="field"
          label={item.label}
          categorySummaries={categorySummaries}
          dataType={item.dataType}
          widgetHint={item.presentation?.widgetHint}
          statusPills={statusPills}
          depth={depth}
          selected
          item={item}
          binds={itemBinds}
          insideRepeatableGroup={insideRepeat}
          onUpdateItem={(changes) => project.updateItem(path, changes)}
          onRenameIdentity={(nextKey, nextLabel) => onRenameIdentity(path, nextKey, nextLabel)}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        />
      );
    }

    if (item.type === 'display') {
      const categorySummaries = buildCategorySummaries(item, itemBinds);
      const statusPills = buildStatusPills(itemBinds, item, { categorySummaries });
      return (
        <ItemRow
          itemKey={item.key}
          itemPath={path}
          itemType="display"
          label={item.label}
          categorySummaries={categorySummaries}
          widgetHint={item.presentation?.widgetHint}
          statusPills={statusPills}
          depth={depth}
          selected
          item={item}
          binds={itemBinds}
          insideRepeatableGroup={insideRepeat}
          onUpdateItem={(changes) => project.updateItem(path, changes)}
          onRenameIdentity={(nextKey, nextLabel) => onRenameIdentity(path, nextKey, nextLabel)}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        />
      );
    }

    return (
      <p className="text-[11px] text-muted">This part of the form can’t be edited here yet.</p>
    );
  }, [allBinds, items, onRenameIdentity, project, selectedEntry, selectedKey, selection]);

  if (!selection) {
    return null;
  }

  const hasSelection = Boolean(selectedKey && selectedEntry?.item);

  const sectionAriaLabel = (() => {
    if (!hasSelection || !selectedEntry?.item) return 'Form field editor';
    const k = itemKindLabel(selectedEntry.item);
    if (k === 'Section') return 'Selected form section';
    if (k === 'Content') return 'Selected content block';
    return 'Selected form field';
  })();

  return (
    <section
      data-testid="chat-selection-focus"
      aria-label={sectionAriaLabel}
      className="px-4 pb-2.5 pt-1.5"
    >
      {hasSelection ? (
        <div className="mb-1.5 flex justify-end gap-1">
          <button
            type="button"
            className="rounded-md border border-border/80 p-1 text-muted hover:bg-subtle hover:text-ink"
            aria-expanded={!panelCollapsed}
            aria-controls="chat-selection-focus-body"
            title={panelCollapsed ? 'Expand editor' : 'Collapse editor'}
            onClick={() => setPanelCollapsed((c) => !c)}
          >
            {panelCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
          </button>
          {deselect && (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[10px] font-medium text-muted hover:bg-subtle hover:text-ink"
              onClick={() => deselect()}
            >
              Clear
            </button>
          )}
        </div>
      ) : (
        <div className="mb-1.5">
          <h3
            id="chat-selection-focus-heading"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted"
          >
            Form field
          </h3>
        </div>
      )}

      {(!panelCollapsed || !hasSelection) && (
        <div
          id="chat-selection-focus-body"
          key={selectedKey ?? 'none'}
          className="max-h-[min(38vh,280px)] min-h-0 overflow-y-auto overflow-x-auto rounded-[10px] border border-border/55 bg-surface/70 px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          {body}
        </div>
      )}
    </section>
  );
}
