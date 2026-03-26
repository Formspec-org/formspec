/** @filedesc Shared props interface for the three page-mode renderers. */
import type { PageStructureView, PlaceableItem } from 'formspec-studio-core';
import type { Project } from 'formspec-studio-core';

export interface PageActions {
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string | undefined) => void;
  onMovePage: (direction: 'up' | 'down') => void;
  onRemoveItem: (itemKey: string) => void;
  onSetWidth: (itemKey: string, width: number) => void;
  onSetOffset: (itemKey: string, offset: number | undefined) => void;
  onSetResponsive: (
    itemKey: string,
    bp: string,
    overrides: { width?: number; offset?: number; hidden?: boolean },
  ) => void;
  onMoveItemToIndex: (itemKey: string, targetIndex: number) => void;
  onAddItem: (itemKey: string) => void;
  onDeletePage: () => void;
  onMoveItemToPage: (itemKey: string, targetPageId: string) => void;
  onUnassignItem: (itemKey: string) => void;
  onOpenFocusMode: () => void;
}

export interface ModeRendererProps {
  structure: PageStructureView;
  project: Project;
  activeGroupCtx: { setActiveGroupKey: (key: string) => void } | null;
  setDeleteToast: (toast: { title: string } | null) => void;
  setFocusPageId: (id: string | null) => void;
  handleAddPage: () => void;
}

/** Build PageActions for a specific page, binding project methods to the page ID. */
export function buildPageActions(
  page: { id: string; title: string },
  props: ModeRendererProps,
): PageActions {
  const { project, activeGroupCtx, setDeleteToast, setFocusPageId } = props;
  return {
    onUpdateTitle: (title) => project.updatePage(page.id, { title }),
    onUpdateDescription: (description) => project.updatePage(page.id, { description }),
    onMovePage: (direction) => project.reorderPage(page.id, direction),
    onRemoveItem: (key) => project.removeItemFromPage(page.id, key),
    onSetWidth: (key, width) => project.setItemWidth(page.id, key, width),
    onSetOffset: (key, offset) => project.setItemOffset(page.id, key, offset),
    onSetResponsive: (key, bp, overrides) =>
      project.setItemResponsive(page.id, key, bp, overrides),
    onMoveItemToIndex: (key, targetIndex) =>
      project.moveItemOnPageToIndex(page.id, key, targetIndex),
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
    onOpenFocusMode: () => setFocusPageId(page.id),
  };
}
