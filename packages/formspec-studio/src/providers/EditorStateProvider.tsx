/** @filedesc Context provider for editor state: manage count, right panel visibility, and health sheet. */
import { createContext, useState, useEffect, useMemo, useContext, type ReactNode } from 'react';
import { useProjectState } from '../state/useProjectState';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useWorkspaceRouter } from './WorkspaceRouterProvider';
import { useShellLayout } from '../hooks/useShellLayout';

export interface EditorState {
  manageCount: number;
  showRightPanel: boolean;
  setShowRightPanel: (show: boolean) => void;
  showHealthSheet: boolean;
  setShowHealthSheet: (show: boolean) => void;
}

export const EditorStateContext = createContext<EditorState | null>(null);

export function EditorStateProvider({ children }: { children: ReactNode }) {
  const { activeTab } = useWorkspaceRouter();
  const { compactLayout } = useShellLayout();
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

  const value = {
    manageCount,
    showRightPanel,
    setShowRightPanel,
    showHealthSheet,
    setShowHealthSheet,
  };

  return (
    <EditorStateContext.Provider value={value}>
      {children}
    </EditorStateContext.Provider>
  );
}
