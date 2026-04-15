/** @filedesc Manages editor-specific state: manage count, right panel visibility, and health sheet. */
import { useState, useEffect } from 'react';
import { useProject } from '../state/useProject';

export interface EditorState {
  manageCount: number;
  showRightPanel: boolean;
  setShowRightPanel: (show: boolean) => void;
  showHealthSheet: boolean;
  setShowHealthSheet: (show: boolean) => void;
}

export function useEditorState(
  activeTab: string,
  compactLayout: boolean,
): EditorState {
  const project = useProject();
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showHealthSheet, setShowHealthSheet] = useState(false);

  const manageCount = (() => {
    const def = project.definition;
    return (def.binds?.length ?? 0) +
      (Array.isArray(def.shapes) ? def.shapes.length : 0) +
      (def.variables?.length ?? 0) +
      Object.keys(def.optionSets ?? {}).length +
      Object.keys(def.instances ?? {}).length;
  })();

  useEffect(() => {
    if (!compactLayout || activeTab !== 'Editor') return;
    setShowHealthSheet(false);
  }, [compactLayout, activeTab]);

  useEffect(() => {
    if (!showHealthSheet) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHealthSheet(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showHealthSheet]);

  return {
    manageCount,
    showRightPanel,
    setShowRightPanel,
    showHealthSheet,
    setShowHealthSheet,
  };
}
