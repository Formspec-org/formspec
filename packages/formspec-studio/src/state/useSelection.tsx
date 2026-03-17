/** @filedesc Context and hooks managing single and multi-item selection state in the editor. */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

interface SelectionState {
  // Multi-select state
  selectedKeys: Set<string>;
  primaryKey: string | null;
  primaryType: string | null;
  selectionCount: number;

  // Backwards-compat aliases
  selectedKey: string | null;
  selectedType: string | null;

  // Actions
  select: (key: string, type: string) => void;
  toggleSelect: (key: string, type: string) => void;
  rangeSelect: (key: string, type: string, flatOrder: string[]) => void;
  /** Like select(), but also signals the inspector panel to auto-focus its first input. */
  selectAndFocusInspector: (key: string, type: string) => void;
  deselect: () => void;
  isSelected: (key: string) => boolean;

  /** True if the inspector should auto-focus its first input on next render. Consumed once. */
  shouldFocusInspector: boolean;
  consumeFocusInspector: () => void;
}

export const SelectionContext = createContext<SelectionState | null>(null);

const EMPTY_SET = new Set<string>();

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(EMPTY_SET);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [primaryType, setPrimaryType] = useState<string | null>(null);
  const [shouldFocusInspector, setShouldFocusInspector] = useState(false);

  const select = useCallback((key: string, type: string) => {
    setSelectedKeys(new Set([key]));
    setPrimaryKey(key);
    setPrimaryType(type);
  }, []);

  const toggleSelect = useCallback((key: string, type: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      const wasSelected = next.has(key);
      if (wasSelected) {
        next.delete(key);
        // If we toggled off the primary, clear it
        setPrimaryKey(p => p === key ? null : p);
        if (next.size === 0) setPrimaryType(null);
      } else {
        next.add(key);
        // If there's no primary, make this the new primary
        setPrimaryKey(p => p ?? key);
        setPrimaryType(p => p ?? type);
      }
      return next;
    });
  }, []);

  const rangeSelect = useCallback((key: string, type: string, flatOrder: string[]) => {
    setPrimaryKey(prevPrimary => {
      if (!prevPrimary) {
        // No anchor — just single-select the target
        setSelectedKeys(new Set([key]));
        setPrimaryType(type);
        return key;
      }
      const anchorIdx = flatOrder.indexOf(prevPrimary);
      const targetIdx = flatOrder.indexOf(key);
      if (anchorIdx === -1 || targetIdx === -1) {
        // Can't find either in the flat order — fallback to single select
        setSelectedKeys(new Set([key]));
        setPrimaryType(type);
        return key;
      }
      const start = Math.min(anchorIdx, targetIdx);
      const end = Math.max(anchorIdx, targetIdx);
      const range = new Set(flatOrder.slice(start, end + 1));
      setSelectedKeys(range);
      // Primary (anchor) stays the same — don't change it
      return prevPrimary;
    });
  }, []);

  const selectAndFocusInspector = useCallback((key: string, type: string) => {
    setSelectedKeys(new Set([key]));
    setPrimaryKey(key);
    setPrimaryType(type);
    setShouldFocusInspector(true);
  }, []);

  const consumeFocusInspector = useCallback(() => {
    setShouldFocusInspector(false);
  }, []);

  const deselect = useCallback(() => {
    setSelectedKeys(EMPTY_SET);
    setPrimaryKey(null);
    setPrimaryType(null);
    setShouldFocusInspector(false);
  }, []);

  const isSelected = useCallback((key: string) => {
    return selectedKeys.has(key);
  }, [selectedKeys]);

  const value = useMemo<SelectionState>(() => ({
    selectedKeys,
    primaryKey,
    primaryType,
    selectionCount: selectedKeys.size,
    // Backwards-compat
    selectedKey: primaryKey,
    selectedType: primaryType,
    // Actions
    select,
    toggleSelect,
    rangeSelect,
    selectAndFocusInspector,
    deselect,
    isSelected,
    shouldFocusInspector,
    consumeFocusInspector,
  }), [
    selectedKeys, primaryKey, primaryType,
    select, toggleSelect, rangeSelect, selectAndFocusInspector,
    deselect, isSelected, shouldFocusInspector, consumeFocusInspector,
  ]);

  return (
    <SelectionContext.Provider value={value}>
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
