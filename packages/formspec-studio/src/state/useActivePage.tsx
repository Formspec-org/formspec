/** @filedesc Context and hook tracking which page tab is currently active in the editor canvas. */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ActivePageState {
  activePageKey: string | null;
  setActivePageKey: (key: string | null) => void;
}

const ActivePageContext = createContext<ActivePageState | null>(null);

export function ActivePageProvider({ children }: { children: ReactNode }) {
  const [activePageKey, setActivePageKeyRaw] = useState<string | null>(null);
  const setActivePageKey = useCallback((key: string | null) => setActivePageKeyRaw(key), []);

  return (
    <ActivePageContext.Provider value={{ activePageKey, setActivePageKey }}>
      {children}
    </ActivePageContext.Provider>
  );
}

export function useActivePage(): ActivePageState {
  const ctx = useContext(ActivePageContext);
  if (!ctx) throw new Error('useActivePage must be used within an ActivePageProvider');
  return ctx;
}
