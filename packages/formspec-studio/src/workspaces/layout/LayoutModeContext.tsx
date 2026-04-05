/** @filedesc Context for current Layout workspace mode (layout vs theme) — lets Shell hide right sidebar in Theme mode. */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { type LayoutMode } from './LayoutThemeToggle';

interface LayoutModeState {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  pendingLayoutMode: LayoutMode | null;
  requestLayoutModeChange: (mode: LayoutMode) => boolean;
  confirmLayoutModeChange: () => void;
  cancelLayoutModeChange: () => void;
  // Theme mode state
  themeSelectedKey: string | null;
  setThemeSelectedKey: (key: string | null) => void;
  themePopoverPosition: { x: number; y: number };
  setThemePopoverPosition: (position: { x: number; y: number }) => void;
  // Dirty state tracking for popovers
  hasDirtyPopover: boolean;
  registerDirtyPopover: (popoverId: string) => void;
  clearDirtyPopover: (popoverId: string) => void;
  // Per-mode sidebar section state
  layoutModeSection: string | null;
  setLayoutModeSection: (section: string | null) => void;
  themeModeSection: string | null;
  setThemeModeSection: (section: string | null) => void;
}

const LayoutModeContext = createContext<LayoutModeState | null>(null);

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [layoutMode, setLayoutModeSt] = useState<LayoutMode>('layout');
  const [pendingLayoutMode, setPendingLayoutMode] = useState<LayoutMode | null>(null);
  const [themeSelectedKey, setThemeSelectedKey] = useState<string | null>(null);
  const [themePopoverPosition, setThemePopoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dirtyPopovers, setDirtyPopovers] = useState<Set<string>>(new Set());
  const [layoutModeSection, setLayoutModeSection] = useState<string | null>(null);
  const [themeModeSection, setThemeModeSection] = useState<string | null>(null);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setPendingLayoutMode(null);
    setLayoutModeSt(mode);
  }, []);

  const requestLayoutModeChange = useCallback((mode: LayoutMode) => {
    if (mode === layoutMode) {
      setPendingLayoutMode(null);
      return true;
    }
    if (dirtyPopovers.size > 0) {
      setPendingLayoutMode(mode);
      return false;
    }
    setPendingLayoutMode(null);
    setLayoutModeSt(mode);
    return true;
  }, [dirtyPopovers.size, layoutMode]);

  const confirmLayoutModeChange = useCallback(() => {
    setPendingLayoutMode((mode) => {
      if (mode) {
        setLayoutModeSt(mode);
      }
      return null;
    });
  }, []);

  const cancelLayoutModeChange = useCallback(() => {
    setPendingLayoutMode(null);
  }, []);

  const registerDirtyPopover = useCallback((popoverId: string) => {
    setDirtyPopovers((prev) => new Set(prev).add(popoverId));
  }, []);

  const clearDirtyPopover = useCallback((popoverId: string) => {
    setDirtyPopovers((prev) => {
      const next = new Set(prev);
      next.delete(popoverId);
      return next;
    });
  }, []);

  const hasDirtyPopover = dirtyPopovers.size > 0;

  const value = useMemo(
    () => ({
      layoutMode,
      setLayoutMode,
      pendingLayoutMode,
      requestLayoutModeChange,
      confirmLayoutModeChange,
      cancelLayoutModeChange,
      themeSelectedKey,
      setThemeSelectedKey,
      themePopoverPosition,
      setThemePopoverPosition,
      hasDirtyPopover,
      registerDirtyPopover,
      clearDirtyPopover,
      layoutModeSection,
      setLayoutModeSection,
      themeModeSection,
      setThemeModeSection,
    }),
    [layoutMode, setLayoutMode, pendingLayoutMode, requestLayoutModeChange, confirmLayoutModeChange, cancelLayoutModeChange, themeSelectedKey, themePopoverPosition, hasDirtyPopover, registerDirtyPopover, clearDirtyPopover, layoutModeSection, themeModeSection],
  );
  return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>;
}

export function useLayoutMode(): LayoutModeState {
  const ctx = useContext(LayoutModeContext);
  if (!ctx) throw new Error('useLayoutMode must be used within a LayoutModeProvider');
  return ctx;
}

export function useOptionalLayoutMode(): LayoutModeState | null {
  return useContext(LayoutModeContext);
}
