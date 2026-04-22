/** @filedesc Reusable hook that calls a callback when the Escape key is pressed. */
import { useEffect } from 'react';

export function useEscapeKey(callback: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        callback();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [callback, active]);
}
