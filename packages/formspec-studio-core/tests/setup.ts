/** @filedesc Global test setup — initializes runtime + tools WASM before all tests. */
import { initFormspecEngine, initFormspecEngineTools } from 'formspec-engine';

await initFormspecEngine();
await initFormspecEngineTools();
