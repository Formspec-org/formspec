/** @filedesc Manages editor-specific state: manage count, right panel visibility, and health sheet. */
import { useState, useEffect, useMemo } from 'react';
import { useProject } from '../state/useProject';
import { useProjectState } from '../state/useProjectState';
import { useEscapeKey } from './useEscapeKey';

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
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showHealthSheet, setShowHealthSheet] = useState(false);

  const definition = useProjectState().definition;

  const manageCount = useMemo(() => {
    return (definition.binds?.length ?? 0) +
      (Array.isArray(definition.shapes) ? definition.shapes.length : 0) +
      (definition.variables?.length ?? 0) +
      Object.keys(definition.optionSets ?? {}).length +
      Object.keys(definition.instances ?? {}).length;
  }, [definition]);

  useEffect(() => {
    if (!compactLayout || activeTab !== 'Editor') return;
    setShowHealthSheet(false);
  }, [compactLayout, activeTab]);

  useEscapeKey(() => setShowHealthSheet(false), showHealthSheet);

  return {
    manageCount,
    showRightPanel,
    setShowRightPanel,
    showHealthSheet,
    setShowHealthSheet,
  };
}
