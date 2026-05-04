/** @filedesc Hook for reading editor state from context: manage count, right panel visibility, and health sheet. */
import { useContext } from 'react';
import { EditorStateContext, type EditorState } from '../providers/EditorStateProvider';

export type { EditorState } from '../providers/EditorStateProvider';

export function useEditorState(_activeTab?: string, _compactLayout?: boolean): EditorState {
  const ctx = useContext(EditorStateContext);
  if (!ctx) throw new Error('useEditorState must be used within EditorStateProvider');
  return ctx;
}
