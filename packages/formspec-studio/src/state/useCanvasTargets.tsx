import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

interface CanvasTargetsState {
  registerTarget: (path: string, element: HTMLElement | null) => void;
  scrollToTarget: (path: string) => boolean;
}

const CanvasTargetsContext = createContext<CanvasTargetsState | null>(null);
const fallbackState: CanvasTargetsState = {
  registerTarget: () => {},
  scrollToTarget: () => false,
};

export function CanvasTargetsProvider({ children }: { children: ReactNode }) {
  const targetsRef = useRef(new Map<string, HTMLElement>());

  const registerTarget = useCallback((path: string, element: HTMLElement | null) => {
    if (!element) {
      targetsRef.current.delete(path);
      return;
    }
    targetsRef.current.set(path, element);
  }, []);

  const scrollToTarget = useCallback((path: string) => {
    const target = targetsRef.current.get(path);
    if (!target) return false;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return true;
  }, []);

  const value = useMemo(
    () => ({ registerTarget, scrollToTarget }),
    [registerTarget, scrollToTarget],
  );

  return (
    <CanvasTargetsContext.Provider value={value}>
      {children}
    </CanvasTargetsContext.Provider>
  );
}

export function useCanvasTargets(): CanvasTargetsState {
  const ctx = useContext(CanvasTargetsContext);
  return ctx ?? fallbackState;
}
