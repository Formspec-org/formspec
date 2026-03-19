/** @filedesc Factory functions for creating engine instances — seam for backend swapping. */
import type { IFormEngine, IRuntimeMappingEngine, FormEngineRuntimeContext, RegistryEntry } from './interfaces.js';
import type { IFelRuntime } from './fel/runtime.js';
import type { FormDefinition } from 'formspec-types';
import { FormEngine } from './index.js';
import { RuntimeMappingEngine } from './runtime-mapping.js';
import { isWasmReady } from './wasm-bridge.js';
import { wasmFelRuntime } from './fel/wasm-runtime.js';

/**
 * Create a form engine instance.
 * When WASM is available and no explicit felRuntime is provided,
 * uses the WASM FEL runtime. Falls back to Chevrotain otherwise.
 */
export function createFormEngine(
    definition: FormDefinition,
    runtimeContext?: FormEngineRuntimeContext,
    registryEntries?: RegistryEntry[],
): IFormEngine {
    // If no explicit felRuntime and WASM is ready, inject the WASM runtime
    if (!runtimeContext?.felRuntime && isWasmReady()) {
        runtimeContext = { ...runtimeContext, felRuntime: wasmFelRuntime };
    }
    return new FormEngine(definition, runtimeContext, registryEntries);
}

/**
 * Create a runtime mapping engine instance.
 * When WASM is available and no explicit felRuntime is provided,
 * uses the WASM FEL runtime.
 */
export function createMappingEngine(
    mappingDocument: any,
    felRuntime?: IFelRuntime,
): IRuntimeMappingEngine {
    if (!felRuntime && isWasmReady()) {
        felRuntime = wasmFelRuntime;
    }
    return new RuntimeMappingEngine(mappingDocument, felRuntime);
}
