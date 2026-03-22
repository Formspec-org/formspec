/** @filedesc Public `initFormspecEngine` / `isFormspecEngineInitialized` — wraps wasm-bridge load for apps. */

import { initWasm, isWasmReady } from './wasm-bridge.js';

/**
 * Initialize the Formspec engine (loads and links the Rust/WASM module).
 *
 * Call once during app startup (e.g. `await initFormspecEngine()` or `await initEngine()`).
 * Safe to call multiple times; concurrent calls share one load.
 *
 * Not required for `formspec-webcomponent` only: importing that package starts WASM load automatically.
 */
export async function initFormspecEngine(): Promise<void> {
    return initWasm();
}

/**
 * Whether {@link initFormspecEngine} has completed successfully in this JS realm.
 */
export function isFormspecEngineInitialized(): boolean {
    return isWasmReady();
}
