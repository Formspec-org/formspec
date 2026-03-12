import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SelectionState {
  selectedKey: string | null;
  selectedType: string | null;
  select: (key: string, type: string) => void;
  /** Like select(), but also signals the inspector panel to auto-focus its first input. */
  selectAndFocusInspector: (key: string, type: string) => void;
  deselect: () => void;
  /** True if the inspector should auto-focus its first input on next render. Consumed once. */
  shouldFocusInspector: boolean;
  consumeFocusInspector: () => void;
}

export const SelectionContext = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [shouldFocusInspector, setShouldFocusInspector] = useState(false);

  const select = useCallback((key: string, type: string) => {
    setSelectedKey(key);
    setSelectedType(type);
  }, []);

  const selectAndFocusInspector = useCallback((key: string, type: string) => {
    setSelectedKey(key);
    setSelectedType(type);
    setShouldFocusInspector(true);
  }, []);

  const consumeFocusInspector = useCallback(() => {
    setShouldFocusInspector(false);
  }, []);

  const deselect = useCallback(() => {
    setSelectedKey(null);
    setSelectedType(null);
    setShouldFocusInspector(false);
  }, []);

  return (
    <SelectionContext.Provider value={{ selectedKey, selectedType, select, selectAndFocusInspector, deselect, shouldFocusInspector, consumeFocusInspector }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionState {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a SelectionProvider');
  return ctx;
}

export function useOptionalSelection(): SelectionState | null {
  return useContext(SelectionContext);
}
