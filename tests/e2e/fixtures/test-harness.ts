/** @filedesc E2E test harness entry point: registers formspec-render and exposes engine globals. */
import { FormspecRender } from '../../../packages/formspec-webcomponent/src/index';
import { FormEngine, assembleDefinitionSync, initWasm, isWasmReady, createFormEngine } from '../../../packages/formspec-engine/src/index';
import { wasmEvalFEL, wasmGetFELDependencies, wasmParseFEL } from '../../../packages/formspec-engine/src/wasm-bridge';

customElements.define('formspec-render', FormspecRender);

const renderer = document.createElement('formspec-render');
document.getElementById('app')?.appendChild(renderer);
window.renderer = renderer;

// Expose engine utilities for E2E tests
(window as any).FormEngine = FormEngine;
(window as any).assembleDefinitionSync = assembleDefinitionSync;

// Initialize WASM eagerly — non-blocking. If it fails, the engine falls back to Chevrotain.
initWasm().then(() => {
    console.log('[formspec] WASM initialized successfully');
    (window as any).__wasmReady = true;
}).catch((err) => {
    console.warn('[formspec] WASM init failed, using Chevrotain fallback:', err);
    (window as any).__wasmReady = false;
});

// Expose WASM readiness check and factory for tests
(window as any).isWasmReady = isWasmReady;
(window as any).createFormEngine = createFormEngine;
(window as any).wasmEvalFEL = wasmEvalFEL;
(window as any).wasmGetFELDependencies = wasmGetFELDependencies;
(window as any).wasmParseFEL = wasmParseFEL;
