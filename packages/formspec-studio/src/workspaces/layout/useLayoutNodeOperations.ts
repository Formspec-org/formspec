/** @filedesc Layout node mutation operations — set props, unwrap, remove, style, resize. */
import { type CompNode } from '@formspec-org/studio-core';
import { nodeIdFromLayoutId, resolveLayoutSelectionNodeRef, setColumnSpan, setRowSpan, setStyleProperty, removeStyleProperty } from '@formspec-org/studio-core';

export function useLayoutNodeOperations(
  project: ReturnType<typeof import('../../state/useProject')['useProject']>,
  deselect: () => void,
) {
  const tree = project.component.tree as CompNode | undefined;
  const nodeRef = (selectionKey: string) => resolveLayoutSelectionNodeRef(tree, selectionKey);

  const handleSetNodeProp = (selectionKey: string, key: string, value: unknown) => {
    project.setLayoutNodeProp(selectionKey, key, value);
  };

  const handleUnwrapNode = (selectionKey: string) => {
    const nodeId = nodeIdFromLayoutId(selectionKey);
    project.unwrapLayoutNode(nodeId);
    deselect();
  };

  const handleRemoveNode = (selectionKey: string) => {
    const nodeId = nodeIdFromLayoutId(selectionKey);
    project.deleteLayoutNode(nodeId);
    deselect();
  };

  const handleStyleAdd = (selectionKey: string, key: string, value: string) => {
    setStyleProperty(project, nodeRef(selectionKey), key, value);
  };

  const handleStyleRemove = (selectionKey: string, key: string) => {
    removeStyleProperty(project, nodeRef(selectionKey), key);
  };

  const handleResizeColSpan = (selectionKey: string, newSpan: number) => {
    setColumnSpan(project, nodeRef(selectionKey), newSpan);
  };

  const handleResizeRowSpan = (selectionKey: string, newSpan: number) => {
    setRowSpan(project, nodeRef(selectionKey), newSpan);
  };

  return {
    handleSetNodeProp,
    handleUnwrapNode,
    handleRemoveNode,
    handleStyleAdd,
    handleStyleRemove,
    handleResizeColSpan,
    handleResizeRowSpan,
  };
}
