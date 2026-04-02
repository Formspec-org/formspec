/** @filedesc Tree view of definition.items — thin wrapper over ItemListEditor with definition-specific data and methods. */
import { useMemo } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useProject } from '../../state/useProject';
import { ItemListEditor, type ItemListEditorConfig } from './ItemListEditor';

import type { FormItem, FormBind } from '@formspec-org/types';

export function DefinitionTreeEditor() {
  const definition = useDefinition();
  const project = useProject();

  const items = (definition?.items ?? []) as FormItem[];
  const allBinds = definition?.binds as FormBind[] | undefined;

  const config = useMemo<ItemListEditorConfig>(() => ({
    items,
    binds: allBinds,

    onAddField: (key, label, dataType, parentPath) => {
      project.addField(key, label, dataType, parentPath ? { parentPath } : undefined);
    },
    onRemoveItem: (path) => project.removeItem(path),
    onUpdateItem: (path, changes) => project.updateItem(path, changes),
    onReorderItem: (path, direction) => project.reorderItem(path, direction),
    onRenameItem: (path, nextKey) => project.renameItem(path, nextKey),
    onCopyItem: (path) => project.copyItem(path),
    onAddGroup: (path, label) => project.addGroup(path, label),
    onAddContent: (path, label, kind) => project.addContent(path, label, kind),
    onWrapInGroup: (paths, groupKey, groupLabel) => project.wrapItemsInGroup(paths, groupKey, groupLabel),
    onMoveItem: (sourcePath, parentPath, targetIndex) => project.moveItem(sourcePath, parentPath, targetIndex),

    allowGroups: true,
    allowDisplayItems: true,
    allowCopy: true,
    allowRename: true,
    allowWrapInGroup: true,

    headerTitle: 'Form structure',
    headerDescription: 'Select a group or field to edit it inline, or add new structure below.',
    emptyStateTitle: 'Start building your form',
    emptyStateDescription: 'Add your first field or group to create the structure respondents will move through.',
    addButtonLabel: '+ Add Item',
    surfaceTestId: 'definition-tree-surface',
    selectionTab: 'editor',
  }), [items, allBinds, project]);

  return <ItemListEditor config={config} />;
}
