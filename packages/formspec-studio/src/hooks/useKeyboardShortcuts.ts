/** @filedesc Global keyboard shortcuts for undo/redo, delete, escape, and search. */
import { useEffect } from 'react';
import { handleKeyboardShortcut, isLayoutId, nodeIdFromLayoutId, type Project } from '@formspec-org/studio-core';
import { useSelection } from '../state/useSelection';

export interface UseKeyboardShortcutsOptions {
  /**
   * Replaces default Escape (close palette + deselect). Use on the assistant surface for stacked overlays.
   * Dialogs that call `preventDefault` on Escape (see `useEscapeKey`) run on document first; this handler
   * is skipped when `event.defaultPrevented` so confirm/import/settings keep working.
   */
  escape?: () => void;
}

export function useKeyboardShortcuts(
  activeTab: string,
  project: Project,
  scopedSelectedKey: string | null,
  setShowPalette: (show: boolean) => void,
  options?: UseKeyboardShortcutsOptions,
) {
  const { deselect } = useSelection();
  const escape = options?.escape;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && event.defaultPrevented) return;
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
        escape: escape ?? (() => { setShowPalette(false); deselect(); }),
        search: () => setShowPalette(true),
      }, {
        activeWorkspace: activeTab,
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, project, scopedSelectedKey, deselect, setShowPalette, escape]);
}
