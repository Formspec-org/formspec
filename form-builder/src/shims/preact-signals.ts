export {
  batch,
  computed,
  effect,
  signal,
  type ReadonlySignal,
  type Signal,
} from '@preact/signals-core';
import { signal as createSignal } from '@preact/signals-core';

// Minimal compatibility for code that expects this helper.
export function useSignal<T>(initial: T) {
  return createSignal(initial);
}
