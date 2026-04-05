/** @filedesc Context for reporting active child resize drags to the nearest layout container. */
import { createContext, useContext, type ReactNode } from 'react';

export interface LayoutResizeState {
  axis: 'x' | 'y';
  value: number;
  cursor: { x: number; y: number };
}

export type LayoutResizeReporter = (state: LayoutResizeState | null) => void;

const LayoutResizeContext = createContext<LayoutResizeReporter | null>(null);

export function useLayoutResizeReporter(): LayoutResizeReporter {
  return useContext(LayoutResizeContext) ?? (() => {});
}

export function LayoutResizeProvider({
  children,
  onResizeChange,
}: {
  children: ReactNode;
  onResizeChange: LayoutResizeReporter;
}) {
  return <LayoutResizeContext.Provider value={onResizeChange}>{children}</LayoutResizeContext.Provider>;
}
