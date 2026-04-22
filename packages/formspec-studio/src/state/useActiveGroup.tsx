/** @filedesc Context and hook tracking which definition group is currently active in the editor canvas. */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

interface ActiveGroupState {
  activeGroupKey: string | null;
  setActiveGroupKey: (key: string | null) => void;
}

export const ActiveGroupContext = createContext<ActiveGroupState | null>(null);

export function ActiveGroupProvider({ children }: { children: ReactNode }) {
  const [activeGroupKey, setActiveGroupKeyRaw] = useState<string | null>(null);
  const setActiveGroupKey = useCallback((key: string | null) => setActiveGroupKeyRaw(key), []);
  const value = useMemo(() => ({ activeGroupKey, setActiveGroupKey }), [activeGroupKey, setActiveGroupKey]);

  return (
    <ActiveGroupContext.Provider value={value}>
      {children}
    </ActiveGroupContext.Provider>
  );
}

export function useActiveGroup(): ActiveGroupState {
  const ctx = useContext(ActiveGroupContext);
  if (!ctx) throw new Error('useActiveGroup must be used within an ActiveGroupProvider');
  return ctx;
}
