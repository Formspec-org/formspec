/** @filedesc Hook for values that can be controlled externally or managed internally. */
import { useState } from 'react';

export function useControllableState<T>(
  controlledValue: T | undefined,
  onChange: ((value: T) => void) | undefined,
  defaultValue: T,
): [T, (value: T) => void] {
  const [internalValue, setInternalValue] = useState<T>(defaultValue);
  const value = controlledValue ?? internalValue;
  const setValue = (next: T) => {
    setInternalValue(next);
    onChange?.(next);
  };
  return [value, setValue];
}
