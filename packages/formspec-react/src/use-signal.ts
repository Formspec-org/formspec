/** @filedesc Generic Preact-signal → React bridge via useSyncExternalStore. */
import { useSyncExternalStore, useRef } from 'react';
import { effect } from '@preact/signals-core';
import type { ReadonlyEngineSignal } from 'formspec-engine';

/**
 * Subscribe to a Preact `ReadonlyEngineSignal` from React.
 *
 * Uses `useSyncExternalStore` for tear-free reads.
 * The `effect()` from `@preact/signals-core` auto-tracks signal
 * dependencies, so the React callback fires exactly when the
 * signal's value changes.
 */
export function useSignal<T>(signal: ReadonlyEngineSignal<T>): T {
    const signalRef = useRef(signal);
    signalRef.current = signal;

    return useSyncExternalStore<T>(
        (onStoreChange) => {
            return effect(() => {
                signalRef.current.value; // track the signal
                onStoreChange();
            });
        },
        () => signalRef.current.value as T,
        () => signalRef.current.value as T,
    );
}
