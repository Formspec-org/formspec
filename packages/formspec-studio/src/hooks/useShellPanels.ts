/** @filedesc Hook for reading shell panel state from context: command palette, import dialog, settings dialogs, chat panel, preview companion. */
import { useContext } from 'react';
import { ShellPanelsContext, type ShellPanelsState, PREVIEW_PERSIST_KEY, readPreviewVisibility, writePreviewVisibility } from '../providers/ShellPanelsProvider';

export type { ShellPanelsState } from '../providers/ShellPanelsProvider';
export { PREVIEW_PERSIST_KEY, readPreviewVisibility, writePreviewVisibility } from '../providers/ShellPanelsProvider';

export function useShellPanels(): ShellPanelsState {
  const ctx = useContext(ShellPanelsContext);
  if (!ctx) throw new Error('useShellPanels must be used within ShellPanelsProvider');
  return ctx;
}
