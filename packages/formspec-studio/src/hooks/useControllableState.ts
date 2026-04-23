/** @filedesc Hook for values that can be controlled externally or managed internally. */
import { useState, useCallback } from 'react';

export function useControllableState<T>(
  controlledValue: T | undefined,
  onChange: ((value: T) => void) | undefined,
  defaultValue: T,
): [T, (value: T) => void] {
  const [internalValue, setInternalValue] = useState<T>(defaultValue);
  
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  
  const setValue = useCallback((next: T) => {
    setInternalValue(next);
    onChange?.(next);
  }, [onChange]);

  return [value, setValue];
}
