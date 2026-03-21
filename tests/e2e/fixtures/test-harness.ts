/** @filedesc E2E test harness entry point: registers formspec-render and exposes engine globals. */
import { FormspecRender } from '../../../packages/formspec-webcomponent/src/index';
// Import from the same package path as formspec-webcomponent so both share
// a single WASM module instance. Using relative source paths would create a
// separate module graph entry and the webcomponent would see uninitialized WASM.
import { FormEngine, assembleDefinitionSync, initWasm, isWasmReady, createFormEngine } from 'formspec-engine';

customElements.define('formspec-render', FormspecRender);

const renderer = document.createElement('formspec-render');
document.getElementById('app')?.appendChild(renderer);
window.renderer = renderer;

// Expose engine utilities for E2E tests
(window as any).FormEngine = FormEngine;
(window as any).assembleDefinitionSync = assembleDefinitionSync;

// Initialize WASM eagerly so browser tests can assert the Rust runtime is available.
initWasm().then(() => {
    console.log('[formspec] WASM initialized successfully');
    (window as any).__wasmReady = true;
}).catch((err) => {
    console.warn('[formspec] WASM initialization failed:', err);
    (window as any).__wasmReady = false;
});

// Expose WASM readiness check and factory for tests
(window as any).isWasmReady = isWasmReady;
(window as any).createFormEngine = createFormEngine;
