/** @filedesc FEL runtime interface — abstraction layer for swappable FEL backends. */

/**
 * Minimal engine interface required by the FEL stdlib functions.
 *
 * Only the methods actually called via `ctx.engine` in the interpreter are
 * included here.  `FormEngine` satisfies this interface.
 */
export interface IFelEngineContext {
    /** Retrieve inline instance data by name, optionally drilling into a sub-path. */
    getInstanceData(name: string, path?: string): any;
    /** Read the current value of a named variable, resolved within the given scope path. */
    getVariableValue(name: string, scopePath: string): any;
    /** Field value signals by path (used by MIP lookup and row-building in stdlib). */
    readonly signals?: Record<string, any>;
    /** Visibility state signals by path (used by MIP lookup). */
    readonly relevantSignals?: Record<string, any>;
    /** Required state signals by path (used by MIP lookup). */
    readonly requiredSignals?: Record<string, any>;
    /** Readonly state signals by path (used by MIP lookup). */
    readonly readonlySignals?: Record<string, any>;
    /** Bind-level validation results by path (used by MIP lookup). */
    readonly validationResults?: Record<string, any>;
}

/**
 * Runtime context provided to the FEL evaluator for field/MIP state lookups.
 *
 * Bridges the evaluator to the form engine's state (reactive signals, static
 * data, etc.).  Each callback reads a single value so evaluation frameworks
 * can track dependencies automatically.
 */
export interface FelContext {
    /** Read the current value of a field signal at the given dotted path. */
    getSignalValue: (path: string) => any;
    /** Read the current repeat instance count for a repeatable group. */
    getRepeatsValue: (path: string) => number;
    /** Read whether the field at the given path is currently relevant (visible). */
    getRelevantValue: (path: string) => boolean;
    /** Read whether the field at the given path is currently required. */
    getRequiredValue: (path: string) => boolean;
    /** Read whether the field at the given path is currently readonly. */
    getReadonlyValue: (path: string) => boolean;
    /** Read the count of validation errors for the field at the given path. */
    getValidationErrors: (path: string) => number;
    /** The fully-qualified dotted path of the item whose bind expression is being evaluated. */
    currentItemPath: string;
    /** Reference to the engine instance (used by stdlib functions like `instance()` and variable resolution). */
    engine: IFelEngineContext;
}

/** Built-in FEL function metadata exposed for tooling/autocomplete surfaces. */
export interface FELBuiltinFunctionCatalogEntry {
    name: string;
    category: string;
    signature?: string;
    description?: string;
}

/**
 * Opaque handle to a compiled FEL expression.
 *
 * Backends store whatever internal representation they need (Chevrotain CST,
 * Rust AST handle, WASM bytecode, etc.).  Consumers only interact with
 * the dependencies list and the `evaluate` method.
 */
export interface ICompiledExpression {
    /** Field paths referenced by this expression (used to wire reactive dependencies). */
    readonly dependencies: string[];
    /** Evaluate the expression against the given runtime context. */
    evaluate(context: FelContext): any;
}

/**
 * Error returned when a FEL expression fails to compile (lex or parse errors).
 */
export interface FelCompilationError {
    message: string;
    offset?: number;
    line?: number;
    column?: number;
}

/**
 * Result of compiling a FEL expression.  Either `expression` is set (success)
 * or `errors` is non-empty (failure).
 */
export interface FelCompilationResult {
    expression: ICompiledExpression | null;
    errors: FelCompilationError[];
}

/**
 * Pluggable FEL runtime — the single abstraction the FormEngine depends on
 * for expression compilation and evaluation.
 *
 * Implementations:
 * - `WasmFelRuntime` — Rust/WASM backend compiled from the shared Rust crate (default)
 */
export interface IFelRuntime {
    /**
     * Compile a FEL expression string into an evaluable handle.
     *
     * Returns a result with the compiled expression and any errors.
     * If compilation fails, `expression` is null and `errors` is non-empty.
     */
    compile(expression: string): FelCompilationResult;

    /** Return the catalog of built-in FEL functions for tooling surfaces. */
    listBuiltInFunctions(): FELBuiltinFunctionCatalogEntry[];

    /**
     * Extract field path dependencies from a FEL expression without full compilation.
     * Spec S3.6.1 (MUST): dependency analysis for reactive wiring.
     */
    extractDependencies(expression: string): string[];

    /**
     * Register an extension function from the registry.
     * Spec S3.12, S8.1: runtime-extensible function catalog.
     */
    registerFunction(
        name: string,
        impl: (...args: any[]) => any,
        meta?: { signature?: string; description?: string; category?: string },
    ): void;
}
