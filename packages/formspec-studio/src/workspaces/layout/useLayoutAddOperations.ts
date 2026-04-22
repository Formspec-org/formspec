/** @filedesc Layout add/page operations — add page, rename page, add item to layout. */
import { type CompNode } from '@formspec-org/studio-core';
import type { FieldTypeOption } from '../../components/AddItemPalette';

export function useLayoutAddOperations(
  project: ReturnType<typeof import('../../state/useProject')['useProject']>,
  activePageId: string | null,
  isMultiPage: boolean,
  pageNavItems: Array<{ id: string; title: string; groupPath?: string; pageId?: string }>,
  materializePagedLayout: () => Map<string, string>,
  setActivePageId: (id: string) => void,
  handleSelectNode: (key: string, type: 'field' | 'group' | 'display' | 'layout') => void,
) {
  const handleAddPage = () => {
    materializePagedLayout();
    const result = project.addPage(`Page ${pageNavItems.length + 1}`);
    if (result.createdId) {
      setActivePageId(result.createdId);
    }
  };

  const handleRenamePage = (pageId: string, title: string, groupPath?: string, componentPageId?: string) => {
    if (componentPageId) {
      project.renamePage(componentPageId, title);
    }
    if (groupPath) {
      project.updateItem(groupPath, { label: title });
    }
  };

  const handleAddItem = (option: FieldTypeOption) => {
    const pageIdMap = materializePagedLayout();
    const resolvedActivePageId = activePageId ? (pageIdMap.get(activePageId) ?? activePageId) : null;
    const pageId = isMultiPage ? (resolvedActivePageId ?? undefined) : undefined;
    const result = project.addItemToLayout({
      itemType: option.itemType,
      label: option.label,
      dataType: option.dataType,
      registryDataType: typeof option.extra?.registryDataType === 'string' ? option.extra.registryDataType : undefined,
      component: option.component,
      repeatable: option.extra?.repeatable === true,
      presentation: (option.extra?.presentation as Record<string, unknown> | undefined) ?? undefined,
    }, pageId);

    if (!result.createdId) return;

    if (resolvedActivePageId && resolvedActivePageId !== activePageId) {
      setActivePageId(resolvedActivePageId);
    }

    const selectionKey = option.itemType === 'layout' ? `__node:${result.createdId}` : result.createdId;
    const selectionType = option.itemType === 'layout'
      ? 'layout'
      : option.itemType === 'group'
        ? 'group'
        : option.itemType === 'display'
          ? 'display'
          : 'field';

    handleSelectNode(selectionKey, selectionType);
  };

  return {
    handleAddPage,
    handleRenamePage,
    handleAddItem,
  };
}
