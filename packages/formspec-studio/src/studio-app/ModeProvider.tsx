/** @filedesc Studio mode context — four-mode taxonomy replacing studioView toggle. */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import {
  dispatchStudioEvent,
  addStudioEventListener,
  STUDIO_EVENTS,
  type StudioModeLiteral,
} from '../studio-events';

/** Closed taxonomy: the four primary authoring modes. */
export type StudioMode = StudioModeLiteral;

export interface ModeContextValue {
  mode: StudioMode;
  setMode: (mode: StudioMode) => void;
  /** Previous mode for transition direction inference. */
  previousMode: StudioMode | null;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const STORAGE_KEY = 'formspec-studio:mode';
const VALID_MODES = new Set<StudioMode>(['chat', 'edit', 'design', 'preview']);

/**
 * Resolve the Studio mode used for the initial `useState` value (cold load only).
 *
 * Precedence: valid `?studioMode=` query param → `localStorage` (`formspec-studio:mode`) → `fallback`
 * from `ModeProvider` props. Query wins for deterministic E2E; it does not write to `localStorage` until
 * the user changes mode via `setMode` (which calls `persistMode`).
 */
function resolveInitialStudioMode(fallback: StudioMode): StudioMode {
  if (typeof window === 'undefined') return fallback;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('studioMode');
  if (fromQuery && VALID_MODES.has(fromQuery as StudioMode)) {
    return fromQuery as StudioMode;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_MODES.has(stored as StudioMode)) return stored as StudioMode;
  return fallback;
}

function persistMode(mode: StudioMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

interface ModeProviderProps {
  children: ReactNode;
  /** Default mode when no persisted value exists. */
  defaultMode?: StudioMode;
}

export function ModeProvider({ children, defaultMode = 'chat' }: ModeProviderProps) {
  const [mode, setModeInternal] = useState<StudioMode>(() => resolveInitialStudioMode(defaultMode));
  const [previousMode, setPreviousMode] = useState<StudioMode | null>(null);

  const setMode = useCallback((next: StudioMode) => {
    setModeInternal((current) => {
      if (current === next) return current;
      setPreviousMode(current);
      persistMode(next);

      // Emit event for telemetry adapter and other listeners
      dispatchStudioEvent(STUDIO_EVENTS.MODE_CHANGED, {
        from: current, to: next,
      });

      return next;
    });
  }, []);

  useEffect(() => {
    return addStudioEventListener(STUDIO_EVENTS.SET_MODE, (e) => {
      const next = e.detail.mode;
      if (VALID_MODES.has(next)) {
        setMode(next);
      }
    });
  }, [setMode]);

  const value = useMemo<ModeContextValue>(() => ({
    mode,
    setMode,
    previousMode,
  }), [mode, setMode, previousMode]);

  return (
    <ModeContext.Provider value={value}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within a ModeProvider');
  return ctx;
}

/**
 * Mode index for transition direction inference.
 * Lower index → earlier in the authoring flow.
 */
export const MODE_ORDER: Record<StudioMode, number> = {
  chat: 0,
  edit: 1,
  design: 2,
  preview: 3,
};
