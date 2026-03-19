/** @filedesc WASM-backed FEL runtime — delegates to Rust via wasm-bindgen. */

import type {
    IFelRuntime,
    ICompiledExpression,
    FelCompilationResult,
    FelContext,
    FELBuiltinFunctionCatalogEntry,
} from './runtime.js';
import {
    isWasmReady,
    wasmEvalFEL,
    wasmGetFELDependencies,
    wasmParseFEL,
} from '../wasm-bridge.js';

// ---------------------------------------------------------------------------
// WasmCompiledExpression
// ---------------------------------------------------------------------------

/**
 * A compiled FEL expression backed by WASM. Stores the expression string
 * and pre-extracted dependencies. Evaluation re-invokes WASM evalFEL with
 * a snapshot of the current signal values.
 */
class WasmCompiledExpression implements ICompiledExpression {
    readonly dependencies: string[];
    private readonly expression: string;

    constructor(expression: string, dependencies: string[]) {
        this.expression = expression;
        this.dependencies = dependencies;
    }

    evaluate(context: FelContext): any {
        // Build a flat fields map from the context's signal accessor.
        // The WASM evalFEL takes a JSON object of { path: value }.
        // We must provide all fields the expression references so the
        // Rust evaluator can resolve $-prefixed paths.
        const fields: Record<string, any> = {};

        // Provide all dependency path values
        for (const dep of this.dependencies) {
            if (dep === '') {
                // Self-reference: read the current item's value.
                // Only done when the expression explicitly references '$' (bare).
                const selfValue = context.getSignalValue(context.currentItemPath);
                if (selfValue !== undefined) {
                    fields[''] = selfValue;
                }
                continue;
            }
            const value = context.getSignalValue(dep);
            if (value !== undefined) {
                fields[dep] = value;
            }
        }

        try {
            return wasmEvalFEL(this.expression, fields);
        } catch (e) {
            // On WASM error, return null (same as Chevrotain error behavior)
            console.warn(`WASM FEL eval error for "${this.expression}":`, e);
            return null;
        }
    }
}

// ---------------------------------------------------------------------------
// WasmFelRuntime
// ---------------------------------------------------------------------------

/**
 * FEL runtime backed by the Rust WASM module.
 *
 * Requires WASM to be initialized before use (call `initWasm()` first).
 * If WASM is not ready, `compile()` returns an error result rather than
 * throwing, allowing graceful degradation.
 */
export class WasmFelRuntime implements IFelRuntime {
    compile(expression: string): FelCompilationResult {
        if (!isWasmReady()) {
            return {
                expression: null,
                errors: [{ message: 'WASM not initialized' }],
            };
        }

        // Validate the expression parses
        try {
            const valid = wasmParseFEL(expression);
            if (!valid) {
                return {
                    expression: null,
                    errors: [{ message: `FEL parse error: invalid expression` }],
                };
            }
        } catch (e: any) {
            return {
                expression: null,
                errors: [{ message: e.message || String(e) }],
            };
        }

        // Extract dependencies
        let dependencies: string[];
        try {
            dependencies = wasmGetFELDependencies(expression);
        } catch {
            dependencies = [];
        }

        return {
            expression: new WasmCompiledExpression(expression, dependencies),
            errors: [],
        };
    }

    listBuiltInFunctions(): FELBuiltinFunctionCatalogEntry[] {
        // The WASM module doesn't expose a function catalog endpoint yet.
        // Return an empty list — callers that need the catalog should use
        // the Chevrotain runtime explicitly.
        return [];
    }

    extractDependencies(expression: string): string[] {
        if (!isWasmReady()) return [];
        try {
            return wasmGetFELDependencies(expression);
        } catch {
            return [];
        }
    }

    registerFunction(
        _name: string,
        _impl: (...args: any[]) => any,
        _meta?: { signature?: string; description?: string; category?: string },
    ): void {
        // WASM runtime doesn't support dynamic function registration from JS.
        // Extension functions registered here would need to be handled by
        // falling back to the Chevrotain runtime for those expressions.
        console.warn(
            'WasmFelRuntime.registerFunction() is a no-op. Extension functions are not yet supported in the WASM runtime.',
        );
    }
}

/** Shared singleton instance. */
export const wasmFelRuntime = new WasmFelRuntime();
