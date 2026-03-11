import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SelectionState {
  selectedKey: string | null;
  selectedType: string | null;
  select: (key: string, type: string) => void;
  deselect: () => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const select = useCallback((key: string, type: string) => {
    setSelectedKey(key);
    setSelectedType(type);
  }, []);

  const deselect = useCallback(() => {
    setSelectedKey(null);
    setSelectedType(null);
  }, []);

  return (
    <SelectionContext.Provider value={{ selectedKey, selectedType, select, deselect }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionState {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a SelectionProvider');
  return ctx;
}
