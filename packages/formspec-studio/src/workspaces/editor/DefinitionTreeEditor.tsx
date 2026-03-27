/** @filedesc Tree view of definition.items — pure Tier 1, no component tree awareness, no page filtering. */
import { useState, useCallback, useMemo } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useProject } from '../../state/useProject';
import { bindsFor } from '../../lib/field-helpers';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { AddItemPalette, type FieldTypeOption } from '../../components/AddItemPalette';
import { ItemRow } from './ItemRow';
import { GroupNode } from './GroupNode';

import type { FormItem, FormBind } from '@formspec-org/types';

/** Map widgetHint to addContent kind parameter. */
const WIDGET_HINT_TO_KIND: Record<string, 'heading' | 'paragraph' | 'divider'> = {
  Heading: 'heading',
  heading: 'heading',
  Paragraph: 'paragraph',
  paragraph: 'paragraph',
  Divider: 'divider',
  divider: 'divider',
};

let nextItemId = 1;
function uniqueKey(prefix: string): string {
  return `${prefix}${nextItemId++}`;
}

function renderItemTree(
  items: FormItem[],
  allBinds: FormBind[] | undefined,
  depth: number,
  parentPath: string,
): React.ReactNode[] {
  return items.map((item) => {
    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    const itemBinds = bindsFor(allBinds, path);

    if (item.type === 'group') {
      return (
        <GroupNode
          key={path}
          itemKey={item.key}
          label={item.label}
          repeatable={item.repeatable}
          minRepeat={item.minRepeat}
          maxRepeat={item.maxRepeat}
          depth={depth}
        >
          {item.children ? renderItemTree(item.children, allBinds, depth + 1, path) : null}
        </GroupNode>
      );
    }

    return (
      <ItemRow
        key={path}
        itemKey={item.key}
        itemType={item.type === 'display' ? 'display' : 'field'}
        label={item.label}
        dataType={item.dataType}
        widgetHint={item.presentation?.widgetHint}
        binds={itemBinds}
        depth={depth}
      />
    );
  });
}

export function DefinitionTreeEditor() {
  const definition = useDefinition();
  const project = useProject();
  const [showPicker, setShowPicker] = useState(false);

  const items = (definition?.items ?? []) as FormItem[];
  const allBinds = definition?.binds as FormBind[] | undefined;

  const handleAddItem = useCallback((opt: FieldTypeOption) => {
    const key = uniqueKey(opt.dataType ?? opt.itemType);

    if (opt.itemType === 'group') {
      project.addGroup(key, opt.label);
    } else if (opt.itemType === 'display') {
      const widgetHint = (opt.extra?.presentation as Record<string, unknown> | undefined)?.widgetHint as string | undefined;
      const kind = widgetHint ? WIDGET_HINT_TO_KIND[widgetHint] : undefined;
      project.addContent(key, opt.label, kind);
    } else if (opt.itemType === 'field') {
      project.addField(key, opt.label, opt.dataType ?? 'string');
    }

    setShowPicker(false);
  }, [project]);

  const tree = useMemo(
    () => renderItemTree(items, allBinds, 0, ''),
    [items, allBinds],
  );

  return (
    <WorkspacePage>
      <WorkspacePageSection className="flex flex-col gap-0.5 pt-3 pb-20">
        <AddItemPalette
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onAdd={handleAddItem}
        />
        {tree}
        <button
          data-testid="add-item"
          className="mt-3 flex items-center justify-center gap-1.5 rounded border border-dashed border-border bg-surface py-2 font-mono text-[11.5px] text-muted transition-colors cursor-pointer hover:border-accent/50 hover:text-ink"
          onClick={() => setShowPicker(!showPicker)}
        >
          + Add Item
        </button>
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
