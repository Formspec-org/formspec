/** @filedesc Test setup — initializes WASM before any test files run. */
import { initFormspecEngine } from '../dist/init-formspec-engine.js';

await initFormspecEngine();
