/** @filedesc Manages shell layout: viewport detection, sidebar widths, resize handles, blueprint drawer, and panel visibility. */
import { useContext } from 'react';
import { ShellLayoutContext, type ShellLayoutState } from '../providers/ShellLayoutProvider';

export type { ShellLayoutState } from '../providers/ShellLayoutProvider';

export function useShellLayout(): ShellLayoutState {
  const ctx = useContext(ShellLayoutContext);
  if (!ctx) throw new Error('useShellLayout must be used within ShellLayoutProvider');
  return ctx;
}
