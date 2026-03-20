/** @filedesc Test setup — initializes WASM before any test files run. */
import { initWasm } from '../dist/wasm-bridge.js';

await initWasm();
