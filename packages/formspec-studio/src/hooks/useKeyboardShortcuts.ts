/** @filedesc Global keyboard shortcuts for undo/redo, delete, escape, and search. */
import { useEffect } from 'react';
import { handleKeyboardShortcut, isLayoutId, nodeIdFromLayoutId, type Project } from '@formspec-org/studio-core';
import { useSelection } from '../state/useSelection';

export function useKeyboardShortcuts(
  activeTab: string,
  project: Project,
  scopedSelectedKey: string | null,
  setShowPalette: (show: boolean) => void,
) {
  const { deselect } = useSelection();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut(event, {
        undo: () => project.undo(),
        redo: () => project.redo(),
        delete: () => {
          if (scopedSelectedKey) {
            if (activeTab === 'Layout') {
              if (isLayoutId(scopedSelectedKey)) {
                project.deleteLayoutNode(nodeIdFromLayoutId(scopedSelectedKey));
              } else {
                project.deleteComponentNode({ bind: scopedSelectedKey });
              }
            } else {
              project.removeItem(scopedSelectedKey);
            }
            deselect();
          }
        },
        escape: () => { setShowPalette(false); deselect(); },
        search: () => setShowPalette(true),
      }, {
        activeWorkspace: activeTab,
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, project, scopedSelectedKey, deselect, setShowPalette]);
}
