/** @filedesc Context provider for shell layout state: viewport detection, sidebar widths, resize handles, blueprint drawer, and panel visibility. */
import { createContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';

export interface ShellLayoutState {
  compactLayout: boolean;
  leftWidth: number;
  rightWidth: number;
  showBlueprintDrawer: boolean;
  setShowBlueprintDrawer: (show: boolean) => void;
  showLayoutPreviewPanel: boolean;
  setShowLayoutPreviewPanel: (show: boolean) => void;
  onResizeLeft: (delta: number) => void;
  onResizeRight: (delta: number) => void;
  blueprintCloseRef: React.RefObject<HTMLButtonElement | null>;
  overlayOpen: boolean;
}

export const ShellLayoutContext = createContext<ShellLayoutState | null>(null);

export function ShellLayoutProvider({ children }: { children: ReactNode }) {
  const [isTabletLayout, setIsTabletLayout] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 1024
  );
  const [leftWidth, setLeftWidth] = useState(214);
  const [rightWidth, setRightWidth] = useState(320);
  const [showBlueprintDrawer, setShowBlueprintDrawer] = useState(false);
  const [showLayoutPreviewPanel, setShowLayoutPreviewPanel] = useState(true);
  const blueprintCloseRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const onResizeLeft = useCallback((delta: number) => {
    setLeftWidth((w) => Math.min(Math.max(w + delta, 160), 400));
  }, []);

  const onResizeRight = useCallback((delta: number) => {
    setRightWidth((w) => Math.min(Math.max(w + delta, 220), 500));
  }, []);

  const viewportWidth = typeof window !== 'undefined'
    ? Math.min(window.innerWidth, document.documentElement?.clientWidth || window.innerWidth)
    : Infinity;

  const compactLayout = isTabletLayout || viewportWidth <= 1024;
  const overlayOpen = compactLayout && showBlueprintDrawer;

  useEffect(() => {
    const updateViewport = () => {
      setIsTabletLayout(window.innerWidth <= 1024);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!compactLayout || !showBlueprintDrawer) return;
    lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    blueprintCloseRef.current?.focus();
    return () => {
      lastFocusRef.current?.focus();
    };
  }, [compactLayout, showBlueprintDrawer]);

  useEscapeKey(() => {
    if (showBlueprintDrawer) {
      setShowBlueprintDrawer(false);
    }
  }, overlayOpen);

  const value = {
    compactLayout,
    leftWidth,
    rightWidth,
    showBlueprintDrawer,
    setShowBlueprintDrawer,
    showLayoutPreviewPanel,
    setShowLayoutPreviewPanel,
    onResizeLeft,
    onResizeRight,
    blueprintCloseRef,
    overlayOpen,
  };

  return (
    <ShellLayoutContext.Provider value={value}>
      {children}
    </ShellLayoutContext.Provider>
  );
}
