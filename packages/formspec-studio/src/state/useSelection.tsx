/** @filedesc Context and hooks managing single and multi-item selection state, with per-tab scoping. */
import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';

/** Options bag for selection actions. */
export interface SelectionOptions {
  /** Tab scope for this selection. When omitted, uses the default scope. */
  tab?: string;
  /** When true, signals the inspector to focus its primary input (e.g. rename on double-click). */
  focusInspector?: boolean;
}

/** Per-tab selection data. */
interface TabSelection {
  selectedKeys: Set<string>;
  primaryKey: string | null;
  primaryType: string | null;
}

interface SelectionState {
  // Multi-select state (reflects active tab)
  selectedKeys: Set<string>;
  primaryKey: string | null;
  primaryType: string | null;
  selectionCount: number;

  // Backwards-compat aliases
  selectedKey: string | null;
  selectedType: string | null;

  // Actions
  select: (key: string, type: string, opts?: SelectionOptions) => void;
  toggleSelect: (key: string, type: string, opts?: SelectionOptions) => void;
  rangeSelect: (key: string, type: string, flatOrder: string[], opts?: SelectionOptions) => void;
  deselect: () => void;
  isSelected: (key: string) => boolean;

  // Per-tab queries
  selectedKeyForTab: (tab: string) => string | null;
  selectedTypeForTab: (tab: string) => string | null;
  /** Keys selected in `tab` — use on canvases that are not the selection provider's active tab. */
  selectedKeysForTab: (tab: string) => Set<string>;
  isSelectedForTab: (tab: string, key: string) => boolean;

  // Inspector focus (e.g. rename on double-click)
  shouldFocusInspector: boolean;
  consumeFocusInspector: () => void;
}

export const SelectionContext = createContext<SelectionState | null>(null);

const DEFAULT_TAB = '_default';
const EMPTY_SET = new Set<string>();
const EMPTY_MAP = new Map<string, TabSelection>();

function emptyTabSelection(): TabSelection {
  return { selectedKeys: EMPTY_SET, primaryKey: null, primaryType: null };
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [tabSelections, setTabSelections] = useState<Map<string, TabSelection>>(EMPTY_MAP);
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [focusInspector, setFocusInspector] = useState(false);
  // Ref to avoid stale closure in isSelected — always points to current active tab's keys
  const activeKeysRef = useRef<Set<string>>(EMPTY_SET);

  const resolveTab = (opts?: SelectionOptions) => opts?.tab ?? DEFAULT_TAB;

  const getTabState = useCallback((tab: string): TabSelection => {
    return tabSelections.get(tab) ?? emptyTabSelection();
  }, [tabSelections]);

  const updateTab = useCallback((tab: string, updater: (prev: TabSelection) => TabSelection) => {
    setTabSelections(prev => {
      const next = new Map(prev);
      const current = prev.get(tab) ?? emptyTabSelection();
      next.set(tab, updater(current));
      return next;
    });
    setActiveTab(tab);
  }, []);

  const select = useCallback((key: string, type: string, opts?: SelectionOptions) => {
    const tab = resolveTab(opts);
    updateTab(tab, () => ({
      selectedKeys: new Set([key]),
      primaryKey: key,
      primaryType: type,
    }));
    if (opts?.focusInspector) setFocusInspector(true);
  }, [updateTab]);

  const toggleSelect = useCallback((key: string, type: string, opts?: SelectionOptions) => {
    const tab = resolveTab(opts);
    updateTab(tab, prev => {
      const next = new Set(prev.selectedKeys);
      const wasSelected = next.has(key);
      if (wasSelected) {
        next.delete(key);
        return {
          selectedKeys: next,
          primaryKey: prev.primaryKey === key ? null : prev.primaryKey,
          primaryType: next.size === 0 ? null : prev.primaryType,
        };
      } else {
        next.add(key);
        return {
          selectedKeys: next,
          primaryKey: prev.primaryKey ?? key,
          primaryType: prev.primaryType ?? type,
        };
      }
    });
  }, [updateTab]);

  const rangeSelect = useCallback((key: string, type: string, flatOrder: string[], opts?: SelectionOptions) => {
    const tab = resolveTab(opts);
    updateTab(tab, prev => {
      if (!prev.primaryKey) {
        return { selectedKeys: new Set([key]), primaryKey: key, primaryType: type };
      }
      const anchorIdx = flatOrder.indexOf(prev.primaryKey);
      const targetIdx = flatOrder.indexOf(key);
      if (anchorIdx === -1 || targetIdx === -1) {
        return { selectedKeys: new Set([key]), primaryKey: key, primaryType: type };
      }
      const start = Math.min(anchorIdx, targetIdx);
      const end = Math.max(anchorIdx, targetIdx);
      return {
        selectedKeys: new Set(flatOrder.slice(start, end + 1)),
        primaryKey: prev.primaryKey,
        primaryType: prev.primaryType,
      };
    });
  }, [updateTab]);

  const deselect = useCallback(() => {
    setTabSelections(EMPTY_MAP);
    setActiveTab(DEFAULT_TAB);
  }, []);

  // Derive active tab's state
  const active = getTabState(activeTab);
  activeKeysRef.current = active.selectedKeys;

  const isSelected = useCallback((key: string) => {
    return activeKeysRef.current.has(key);
  }, []);

  const selectedKeyForTab = useCallback((tab: string): string | null => {
    return getTabState(tab).primaryKey;
  }, [getTabState]);

  const selectedTypeForTab = useCallback((tab: string): string | null => {
    return getTabState(tab).primaryType;
  }, [getTabState]);

  const selectedKeysForTab = useCallback((tab: string): Set<string> => {
    return getTabState(tab).selectedKeys;
  }, [getTabState]);

  const isSelectedForTab = useCallback((tab: string, key: string) => {
    return getTabState(tab).selectedKeys.has(key);
  }, [getTabState]);

  const consumeFocusInspector = useCallback(() => {
    setFocusInspector(false);
  }, []);

  const value = useMemo<SelectionState>(() => ({
    selectedKeys: active.selectedKeys,
    primaryKey: active.primaryKey,
    primaryType: active.primaryType,
    selectionCount: active.selectedKeys.size,
    // Backwards-compat
    selectedKey: active.primaryKey,
    selectedType: active.primaryType,
    // Actions
    select,
    toggleSelect,
    rangeSelect,
    deselect,
    isSelected,
    // Per-tab queries
    selectedKeyForTab,
    selectedTypeForTab,
    selectedKeysForTab,
    isSelectedForTab,
    // Inspector focus
    shouldFocusInspector: focusInspector,
    consumeFocusInspector,
  }), [
    active.selectedKeys, active.primaryKey, active.primaryType,
    select, toggleSelect, rangeSelect,
    deselect, isSelected, selectedKeyForTab, selectedTypeForTab,
    selectedKeysForTab, isSelectedForTab,
    focusInspector, consumeFocusInspector,
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
