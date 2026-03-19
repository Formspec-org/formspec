/** @filedesc Factory functions for creating engine instances — seam for backend swapping. */
import type { IFormEngine, IRuntimeMappingEngine, FormEngineRuntimeContext, RegistryEntry } from './interfaces.js';
import type { IFelRuntime } from './fel/runtime.js';
import type { FormDefinition } from 'formspec-types';
import { FormEngine } from './index.js';
import { RuntimeMappingEngine } from './runtime-mapping.js';

/**
 * Create a form engine instance.
 * Consumers should use this instead of `new FormEngine(...)` to enable backend swapping.
 */
export function createFormEngine(
    definition: FormDefinition,
    runtimeContext?: FormEngineRuntimeContext,
    registryEntries?: RegistryEntry[],
): IFormEngine {
    return new FormEngine(definition, runtimeContext, registryEntries);
}

/**
 * Create a runtime mapping engine instance.
 * Consumers should use this instead of `new RuntimeMappingEngine(...)`.
 */
export function createMappingEngine(
    mappingDocument: any,
    felRuntime?: IFelRuntime,
): IRuntimeMappingEngine {
    return new RuntimeMappingEngine(mappingDocument, felRuntime);
}
