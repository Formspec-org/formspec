import { signal, computed, effect, batch, Signal } from '@preact/signals-core';
import { FelLexer } from './fel/lexer.js';
import { parser } from './fel/parser.js';
import { interpreter, FelContext, FelUnsupportedFunctionError } from './fel/interpreter.js';
import { dependencyVisitor } from './fel/dependency-visitor.js';

export { assembleDefinition, assembleDefinitionSync, rewriteFEL, rewriteMessageTemplate } from './assembler.js';
export type { AssemblyProvenance, AssemblyResult, DefinitionResolver, RewriteMap } from './assembler.js';
export { RuntimeMappingEngine } from './runtime-mapping.js';
export type { MappingDirection, RuntimeMappingResult } from './runtime-mapping.js';

/** A single item in a Formspec definition tree: a field (data-bearing), group (container), or display (read-only content). */
export interface FormspecItem {
    key: string;
    type: "field" | "group" | "display";
    label: string;
    dataType?: "string" | "text" | "integer" | "decimal" | "number" | "boolean" | "date" | "dateTime" | "time" | "uri" | "attachment" | "choice" | "multiChoice" | "money";
    currency?: string;
    description?: string;
    hint?: string;
    repeatable?: boolean;
    minRepeat?: number;
    maxRepeat?: number;
    children?: FormspecItem[];
    options?: { value: string; label: string }[];
    optionSet?: string;
    initialValue?: any;
    presentation?: any;
    prePopulate?: { instance: string; path: string; editable?: boolean };
    labels?: Record<string, string>;
    relevant?: string;
    required?: string | boolean;
    calculate?: string;
    readonly?: string | boolean;
    constraint?: string;
    message?: string;
    [key: string]: any;
}

/** A bind configuration that attaches FEL-driven logic (relevance, required, calculate, readonly, constraint) to a field path. */
export interface FormspecBind {
    path: string;
    relevant?: string;
    required?: string | boolean;
    calculate?: string;
    readonly?: string | boolean;
    constraint?: string;
    constraintMessage?: string;
    default?: any;
    whitespace?: 'preserve' | 'trim' | 'normalize' | 'remove';
    excludedValue?: 'preserve' | 'null';
    nonRelevantBehavior?: 'remove' | 'empty' | 'keep';
    disabledDisplay?: 'hidden' | 'protected';
    precision?: number;
    remoteOptions?: string;
}

/** A selectable option for choice/multiChoice fields, consisting of a machine-readable value and a display label. */
export interface FormspecOption {
    value: string;
    label: string;
}

/** Loading/error state for a field whose options are fetched from a remote URL via the `remoteOptions` bind. */
export interface RemoteOptionsState {
    loading: boolean;
    error: string | null;
}

/**
 * A cross-field validation rule evaluated against one or more target paths.
 * Shapes support composition operators (and/or/not/xone) and timing modes (continuous, submit, demand).
 */
export interface FormspecShape {
    id: string;
    target: string;
    severity?: "error" | "warning" | "info";
    constraint?: string;
    message: string;
    code?: string;
    activeWhen?: string;
    timing?: "continuous" | "submit" | "demand";
    and?: string[];
    or?: string[];
    not?: string;
    xone?: string[];
    context?: Record<string, string>;
}

/** A named computed variable defined by a FEL expression, scoped to a specific item or the entire definition ('#'). */
export interface FormspecVariable {
    name: string;
    expression: string;
    scope?: string; // item key or "#" for definition-wide (default)
}

/** A named data instance that provides external data for pre-population and FEL `instance()` lookups. */
export interface FormspecInstance {
    description?: string;
    source?: string;
    static?: boolean;
    data?: any;
    schema?: Record<string, string>;
    readonly?: boolean;
}

/**
 * The top-level Formspec definition document describing a complete form.
 * Contains the item tree, bind constraints, shape rules, variables, instances, option sets,
 * and optional screener/migration/presentation configuration.
 */
export interface FormspecDefinition {
    $formspec: string;
    url: string;
    version: string;
    title: string;
    items: FormspecItem[];
    binds?: FormspecBind[];
    shapes?: FormspecShape[];
    variables?: FormspecVariable[];
    instances?: Record<string, FormspecInstance>;
    optionSets?: Record<string, FormspecOption[]>;
    nonRelevantBehavior?: 'remove' | 'empty' | 'keep';
    formPresentation?: any;
    screener?: {
        items: FormspecItem[];
        routes: Array<{ condition: string; target: string; label?: string; extensions?: Record<string, any> }>;
        extensions?: Record<string, any>;
    };
    migrations?: Array<{ fromVersion: string; changes: Array<{ type: string; [key: string]: any }> }>;
    [key: string]: any;
}

/** A single validation finding (error, warning, or info) targeting a specific field path. */
export interface ValidationResult {
    severity: "error" | "warning" | "info";
    path: string;
    message: string;
    constraintKind: "required" | "type" | "cardinality" | "constraint" | "shape" | "external";
    code: string;
    source?: "bind" | "shape";
    shapeId?: string;
    constraint?: string;
    context?: Record<string, any>;
}

/**
 * Aggregated validation output for the entire form, including all bind-level and shape-level results.
 * A report is `valid` when it contains zero errors; warnings and infos do not affect validity.
 */
export interface ValidationReport {
    valid: boolean;
    results: ValidationResult[];
    counts: {
        error: number;
        warning: number;
        info: number;
    };
    timestamp: string;
}

export interface PinnedResponseReference {
    definitionUrl: string;
    definitionVersion: string;
}

/** Accepted input types for the engine's "now" provider: a Date object, an ISO string, or a Unix timestamp. */
export type EngineNowInput = Date | string | number;

/** Runtime configuration injected into the engine to control time, locale, timezone, and deterministic seeding. */
export interface FormEngineRuntimeContext {
    now?: (() => EngineNowInput) | EngineNowInput;
    locale?: string;
    timeZone?: string;
    seed?: string | number;
}

/** A registry extension entry providing constraints and metadata for custom data types. */
export interface RegistryEntry {
    name: string;
    category?: string;
    version?: string;
    status?: string;
    baseType?: string;
    constraints?: {
        pattern?: string;
        maxLength?: number;
        [key: string]: any;
    };
    metadata?: Record<string, any>;
    [key: string]: any;
}

/** A complete point-in-time snapshot of engine state for debugging: all values, MIP states, dependencies, and validation. */
export interface FormEngineDiagnosticsSnapshot {
    definition: {
        url: string;
        version: string;
        title: string;
    };
    timestamp: string;
    structureVersion: number;
    repeats: Record<string, number>;
    values: Record<string, any>;
    mips: Record<string, {
        relevant: boolean;
        required: boolean;
        readonly: boolean;
        error: string | null;
    }>;
    dependencies: Record<string, string[]>;
    validation: ValidationReport;
    runtimeContext: {
        now: string;
        locale?: string;
        timeZone?: string;
        seed?: string | number;
    };
}

/** A discriminated union of events that can be replayed against a FormEngine instance (setValue, repeat operations, validation, response). */
export type EngineReplayEvent =
    | { type: 'setValue'; path: string; value: any }
    | { type: 'addRepeatInstance'; path: string }
    | { type: 'removeRepeatInstance'; path: string; index: number }
    | { type: 'evaluateShape'; shapeId: string }
    | { type: 'getValidationReport'; mode?: 'continuous' | 'submit' }
    | { type: 'getResponse'; mode?: 'continuous' | 'submit' };

/** The result of applying a single replay event, including success/failure status and optional output. */
export interface EngineReplayApplyResult {
    ok: boolean;
    event: EngineReplayEvent;
    output?: any;
    error?: string;
}

/** Aggregate result of replaying a sequence of events, with per-event results and any errors encountered. */
export interface EngineReplayResult {
    applied: number;
    results: EngineReplayApplyResult[];
    errors: Array<{
        index: number;
        event: EngineReplayEvent;
        error: string;
    }>;
}

/**
 * Central reactive form state manager for Formspec definitions.
 *
 * FormEngine parses a {@link FormspecDefinition} and builds a network of Preact signals
 * representing field values, relevance (visibility), required/readonly state, validation
 * results, repeat group counts, option lists, and computed variables. All signals update
 * automatically when dependencies change.
 *
 * Key capabilities:
 * - **FEL compilation** with caching and dependency tracking for calculated fields, constraints, and shapes.
 * - **Bind constraint evaluation** (field-level: required, readonly, calculate, constraint, relevance).
 * - **Shape evaluation** (cross-field rules with composition operators, supporting continuous/submit/demand timing).
 * - **Repeat group lifecycle** (add/remove instances with automatic signal initialization and cleanup).
 * - **Response serialization** honoring nonRelevantBehavior settings.
 * - **Diagnostics snapshots** for debugging.
 * - **Event replay** for testing and deterministic reproduction.
 * - **Version migrations** for evolving definitions.
 * - **Remote options** fetching from bind-configured URLs.
 * - **Screener evaluation** for conditional form routing.
 */
export class FormEngine {
    readonly definition: FormspecDefinition;

    /** Reactive signals holding current field values, keyed by full dotted path (e.g. `"group[0].field"`). */
    public signals: Record<string, any> = {};

    /** Reactive boolean signals indicating whether each field/group is currently relevant (visible). */
    public relevantSignals: Record<string, Signal<boolean>> = {};

    /** Reactive boolean signals indicating whether each field is currently required. */
    public requiredSignals: Record<string, Signal<boolean>> = {};

    /** Reactive boolean signals indicating whether each field is currently readonly. */
    public readonlySignals: Record<string, Signal<boolean>> = {};

    /** Reactive signals holding the first error message (or null) for each field, derived from validationResults. */
    public errorSignals: Record<string, Signal<string | null>> = {};

    /** Reactive signals holding bind-level validation results for each field path. */
    public validationResults: Record<string, Signal<ValidationResult[]>> = {};

    /** Reactive signals holding shape-level validation results, keyed by shape ID. */
    public shapeResults: Record<string, Signal<ValidationResult[]>> = {};

    /** Reactive signals holding the current instance count for each repeatable group path. */
    public repeats: Record<string, Signal<number>> = {};

    /** Reactive signals holding the resolved option lists for choice/multiChoice fields. */
    public optionSignals: Record<string, Signal<FormspecOption[]>> = {};

    /** Reactive signals holding the loading/error state for fields with remote options. */
    public optionStateSignals: Record<string, Signal<RemoteOptionsState>> = {};

    /** Reactive signals holding computed variable values, keyed by `"scope:name"` (e.g. `"#:totalDirect"`). */
    public variableSignals: Record<string, Signal<any>> = {};

    /** Static instance data loaded from the definition's `instances` section, keyed by instance name. */
    public instanceData: Record<string, any> = {};
    /** Version signal incremented whenever instance data changes, enabling FEL reactivity for @instance() reads. */
    public instanceVersion = signal(0);

    /** Dependency graph mapping each field path to the paths it depends on, built during FEL compilation. */
    public dependencies: Record<string, string[]> = {};
    private knownNames: Set<string> = new Set();
    private bindConfigs: Record<string, FormspecBind> = {};
    private compiledExpressions: Record<string, () => any> = {};
    private registryEntries: Map<string, RegistryEntry> = new Map();
    private remoteOptionsTasks: Array<Promise<void>> = [];
    private instanceSourceTasks: Array<Promise<void>> = [];
    private static instanceSourceCache = new Map<string, any>();
    private runtimeContext: {
        nowProvider: () => Date;
        locale?: string;
        timeZone?: string;
        seed?: string | number;
    } = {
        nowProvider: () => new Date(),
    };
    /** Monotonically increasing counter that increments whenever repeat instances are added or removed, enabling reactive UI rebuilds. */
    public structureVersion = signal(0);

    /**
     * Creates a new FormEngine from a Formspec definition.
     *
     * Initializes all reactive signals, resolves option sets, loads instance data,
     * compiles bind expressions, fetches remote options, and wires up shape evaluation.
     *
     * @param definition - The complete Formspec definition document.
     * @param runtimeContext - Optional runtime overrides for time, locale, timezone, and seed.
     * @param registryEntries - Optional registry extension entries for enforcing extension constraints.
     */
    constructor(definition: FormspecDefinition, runtimeContext?: FormEngineRuntimeContext, registryEntries?: RegistryEntry[]) {
        this.definition = definition;
        if (runtimeContext) {
            this.setRuntimeContext(runtimeContext);
        }
        if (registryEntries) {
            for (const entry of registryEntries) {
                if (entry.name) this.registryEntries.set(entry.name, entry);
            }
        }
        this.resolveOptionSets();
        this.initializeOptionSignals();
        this.initializeInstances();
        this.initializeBindConfigs(definition.items);
        if (definition.binds) {
            for (const bind of definition.binds) {
                // Normalize wildcard paths: items[*].field → items.field (matches baseKey lookups)
                const normalizedPath = bind.path.replace(/\[\*\]/g, '');
                this.bindConfigs[normalizedPath] = { ...this.bindConfigs[normalizedPath], ...bind, path: normalizedPath };
            }
        }
        this.initializeRemoteOptions();
        this.initializeSignals();
        this.initializeShapes();
        this.initializeVariables();
        this.initializeInstanceCalculates();
    }

    public static resolvePinnedDefinition<T extends { url?: string; version?: string }>(
        response: PinnedResponseReference,
        definitions: T[],
    ): T {
        const exact = definitions.find(
            (definition) =>
                definition.url === response.definitionUrl
                && definition.version === response.definitionVersion,
        );
        if (exact) return exact;

        const availableVersions = definitions
            .filter((definition) => definition.url === response.definitionUrl)
            .map((definition) => definition.version)
            .filter((version): version is string => typeof version === 'string')
            .sort();

        let message = `No definition found for pinned response ${response.definitionUrl}@${response.definitionVersion}`;
        if (availableVersions.length > 0) {
            message += `; available versions: ${availableVersions.join(', ')}`;
        }
        throw new Error(message);
    }

    private coerceDate(value: EngineNowInput): Date {
        if (value instanceof Date) {
            return new Date(value.getTime());
        }
        const coerced = new Date(value);
        if (isNaN(coerced.getTime())) {
            return new Date();
        }
        return coerced;
    }

    private resolveNowProvider(now: FormEngineRuntimeContext['now']): () => Date {
        if (typeof now === 'function') {
            const provider = now as () => EngineNowInput;
            return () => this.coerceDate(provider());
        }
        if (now !== undefined) {
            const fixed = this.coerceDate(now as EngineNowInput);
            return () => new Date(fixed.getTime());
        }
        return () => new Date();
    }

    private nowISO(): string {
        return this.runtimeContext.nowProvider().toISOString();
    }

    /**
     * Updates the engine's runtime context (now provider, locale, timezone, seed).
     * Only explicitly provided keys are changed; omitted keys are left as-is.
     */
    public setRuntimeContext(context: FormEngineRuntimeContext = {}) {
        if (Object.prototype.hasOwnProperty.call(context, 'now')) {
            this.runtimeContext.nowProvider = this.resolveNowProvider(context.now);
        }
        if (Object.prototype.hasOwnProperty.call(context, 'locale')) {
            this.runtimeContext.locale = context.locale;
        }
        if (Object.prototype.hasOwnProperty.call(context, 'timeZone')) {
            this.runtimeContext.timeZone = context.timeZone;
        }
        if (Object.prototype.hasOwnProperty.call(context, 'seed')) {
            this.runtimeContext.seed = context.seed;
        }
    }

    /**
     * Resolve optionSet references on items into concrete options arrays.
     */
    private resolveOptionSets() {
        if (!this.definition.optionSets) return;
        this.resolveOptionSetsRecursive(this.definition.items);
    }

    private resolveOptionSetsRecursive(items: FormspecItem[]) {
        for (const item of items) {
            if (item.optionSet && this.definition.optionSets?.[item.optionSet]) {
                const entry = this.definition.optionSets[item.optionSet] as any;
                item.options = Array.isArray(entry) ? entry : (entry.options ?? []);
            }
            if (item.children) {
                this.resolveOptionSetsRecursive(item.children);
            }
        }
    }

    private initializeOptionSignals() {
        this.initializeOptionSignalsRecursive(this.definition.items);
    }

    private initializeOptionSignalsRecursive(items: FormspecItem[], prefix = '') {
        for (const item of items) {
            const fullName = prefix ? `${prefix}.${item.key}` : item.key;
            if (item.type === 'field') {
                const options = Array.isArray(item.options) ? item.options.map((opt) => ({
                    value: String(opt.value),
                    label: String(opt.label),
                })) : [];
                this.optionSignals[fullName] = signal(options);
                this.optionStateSignals[fullName] = signal({ loading: false, error: null });
            }
            if (item.children) {
                this.initializeOptionSignalsRecursive(item.children, fullName);
            }
        }
    }

    private normalizeRemoteOptions(payload: any): FormspecOption[] {
        const rawOptions = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.options)
                ? payload.options
                : null;
        if (!rawOptions) {
            throw new Error('Remote options response must be an array or { options: [...] }');
        }
        return rawOptions
            .filter((opt: any) => opt && typeof opt === 'object' && opt.value !== undefined && opt.label !== undefined)
            .map((opt: any) => ({
                value: String(opt.value),
                label: String(opt.label),
            }));
    }

    private initializeRemoteOptions() {
        if (!this.definition.binds) return;
        for (const bind of this.definition.binds) {
            if (!bind.remoteOptions) continue;

            const path = bind.path.replace(/\[\*\]/g, '');
            if (!this.optionSignals[path]) {
                this.optionSignals[path] = signal([]);
            }
            if (!this.optionStateSignals[path]) {
                this.optionStateSignals[path] = signal({ loading: false, error: null });
            }

            this.optionStateSignals[path].value = { loading: true, error: null };
            const task = fetch(bind.remoteOptions)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Remote options fetch failed (${response.status})`);
                    }
                    return response.json();
                })
                .then((payload) => {
                    const normalized = this.normalizeRemoteOptions(payload);
                    this.optionSignals[path].value = normalized;
                    this.optionStateSignals[path].value = { loading: false, error: null };
                })
                .catch((error) => {
                    const message = error instanceof Error ? error.message : String(error);
                    this.optionStateSignals[path].value = { loading: false, error: message };
                });
            this.remoteOptionsTasks.push(task);
        }
    }

    /**
     * Returns the current resolved options array for a choice/multiChoice field.
     * @param path - Full field path (repeat indices are stripped to find the base options).
     */
    public getOptions(path: string): FormspecOption[] {
        const baseName = path.replace(/\[\d+\]/g, '');
        if (this.optionSignals[baseName]) {
            return this.optionSignals[baseName].value;
        }
        return [];
    }

    /** Returns the reactive signal holding the options array for a field, or undefined if no options exist. */
    public getOptionsSignal(path: string): Signal<FormspecOption[]> | undefined {
        const baseName = path.replace(/\[\d+\]/g, '');
        return this.optionSignals[baseName];
    }

    /** Returns the current loading/error state for a field's remote options. */
    public getOptionsState(path: string): RemoteOptionsState {
        const baseName = path.replace(/\[\d+\]/g, '');
        return this.optionStateSignals[baseName]?.value || { loading: false, error: null };
    }

    /** Returns the reactive signal holding the remote options loading/error state, or undefined. */
    public getOptionsStateSignal(path: string): Signal<RemoteOptionsState> | undefined {
        const baseName = path.replace(/\[\d+\]/g, '');
        return this.optionStateSignals[baseName];
    }

    /** Waits for all in-flight remote options fetches to settle (resolve or reject). */
    public async waitForRemoteOptions(): Promise<void> {
        if (this.remoteOptionsTasks.length === 0) return;
        await Promise.allSettled(this.remoteOptionsTasks);
    }

    /** Waits for all in-flight instance source fetches to settle (resolve or reject). */
    public async waitForInstanceSources(): Promise<void> {
        if (this.instanceSourceTasks.length === 0) return;
        await Promise.allSettled(this.instanceSourceTasks);
    }

    private parseInstanceTarget(path: string): { instanceName: string; instancePath?: string } | null {
        const explicit = path.match(/^instances\.([a-zA-Z][a-zA-Z0-9_]*)\.?(.*)$/);
        if (explicit) {
            const [, instanceName, instancePath] = explicit;
            return { instanceName, instancePath: instancePath || undefined };
        }

        const felSyntax = path.match(/^@instance\((['"])([^'"]+)\1\)\.?(.*)$/);
        if (felSyntax) {
            const [, , instanceName, instancePath] = felSyntax;
            return { instanceName, instancePath: instancePath || undefined };
        }
        return null;
    }

    private valuesEqual(a: any, b: any): boolean {
        if (a === b) return true;
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    }

    private setObjectPath(target: Record<string, any>, path: string, value: any) {
        const parts = path.split('.').filter(Boolean);
        if (parts.length === 0) return;
        let current: any = target;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (current[part] === null || current[part] === undefined || typeof current[part] !== 'object' || Array.isArray(current[part])) {
                current[part] = {};
            }
            current = current[part];
        }
        current[parts[parts.length - 1]] = value;
    }

    private validateInstanceSchema(instanceName: string, data: any) {
        const schema = this.definition.instances?.[instanceName]?.schema;
        if (!schema || typeof schema !== 'object') return;
        for (const [path, dataType] of Object.entries(schema)) {
            if (typeof dataType !== 'string') continue;
            const value = this.getValueFromDataPath(data ?? {}, path);
            if (value === null || value === undefined) continue;
            if (!this.validateDataType(value, dataType)) {
                throw new Error(
                    `Instance '${instanceName}' schema mismatch at '${path}': expected ${dataType}`
                );
            }
        }
    }

    private writeInstanceValue(
        instanceName: string,
        path: string | undefined,
        value: any,
        options?: { bypassReadonly?: boolean }
    ) {
        const instanceConfig = this.definition.instances?.[instanceName];
        if (!instanceConfig) {
            throw new Error(`Unknown instance '${instanceName}'`);
        }
        if (!options?.bypassReadonly && instanceConfig.readonly !== false) {
            throw new Error(`Instance '${instanceName}' is readonly`);
        }

        let nextData: any;
        if (!path) {
            nextData = this.cloneValue(value);
        } else {
            const base = this.cloneValue(this.instanceData[instanceName] ?? {});
            const container = (base && typeof base === 'object' && !Array.isArray(base)) ? base : {};
            this.setObjectPath(container, path, this.cloneValue(value));
            nextData = container;
        }

        this.validateInstanceSchema(instanceName, nextData);
        if (this.valuesEqual(this.instanceData[instanceName], nextData)) return;
        this.instanceData[instanceName] = nextData;
        this.instanceVersion.value++;
    }

    /**
     * Writes to a named instance. Intended for writable (`readonly: false`) scratch-pad instances.
     * @param name - Instance name.
     * @param path - Optional dot path inside the instance object.
     * @param value - New value (or subtree value when path is provided).
     */
    public setInstanceValue(name: string, path: string | undefined, value: any) {
        this.writeInstanceValue(name, path, value);
    }

    private initializeInstanceSource(name: string, inst: FormspecInstance) {
        if (!inst.source) return;
        if (inst.static && FormEngine.instanceSourceCache.has(inst.source)) {
            const cached = this.cloneValue(FormEngine.instanceSourceCache.get(inst.source));
            if (!this.valuesEqual(this.instanceData[name], cached)) {
                this.instanceData[name] = cached;
                this.instanceVersion.value++;
            }
            return;
        }

        const source = inst.source;
        const task = fetch(source)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Instance source fetch failed (${response.status})`);
                }
                return response.json();
            })
            .then((payload) => {
                this.validateInstanceSchema(name, payload);
                const nextData = this.cloneValue(payload);
                if (inst.static) {
                    FormEngine.instanceSourceCache.set(source, this.cloneValue(nextData));
                }
                if (!this.valuesEqual(this.instanceData[name], nextData)) {
                    this.instanceData[name] = nextData;
                    this.instanceVersion.value++;
                }
            })
            .catch((error) => {
                // Keep fallback inline data if source retrieval fails.
                console.error(`Failed to load instance source '${name}':`, error);
            });
        this.instanceSourceTasks.push(task);
    }

    private initializeInstances() {
        if (!this.definition.instances) return;
        for (const [name, inst] of Object.entries(this.definition.instances)) {
            if (inst.data !== undefined) {
                const fallback = this.cloneValue(inst.data);
                this.validateInstanceSchema(name, fallback);
                this.instanceData[name] = fallback;
            }
            this.initializeInstanceSource(name, inst);
        }
    }

    /**
     * Retrieves data from a named instance, optionally navigating to a nested path.
     * Used by FEL's `instance()` function and the pre-population system.
     * @param name - The instance name as declared in the definition's `instances` section.
     * @param path - Optional dot-separated path into the instance data.
     */
    public getInstanceData(name: string, path?: string): any {
        const data = this.instanceData[name];
        if (data === undefined) return undefined;
        if (!path) return data;
        // Navigate path into data
        const parts = path.split('.');
        let current = data;
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            current = current[part];
        }
        return current;
    }

    /**
     * Returns the disabledDisplay mode for a field path from its bind configuration.
     * - `"hidden"` (default): the field wrapper is display:none when non-relevant.
     * - `"protected"`: the field remains visible but grayed out / disabled when non-relevant.
     */
    public getDisabledDisplay(path: string): 'hidden' | 'protected' {
        const baseName = path.replace(/\[\d+\]/g, '');
        return this.bindConfigs[baseName]?.disabledDisplay || 'hidden';
    }

    private initializeShapes() {
        if (!this.definition.shapes) return;
        for (const shape of this.definition.shapes) {
            const timing = shape.timing || 'continuous';
            if (timing === 'continuous') {
                this.initShape(shape);
            }
            // submit and demand shapes are stored for later evaluation
        }
    }

    private initializeVariables() {
        if (!this.definition.variables) return;

        // Topological sort: build dependency graph among variables
        const vars = this.definition.variables;
        const varByName = new Map<string, FormspecVariable>();
        for (const v of vars) varByName.set(v.name, v);

        // Detect dependencies between variables (one variable referencing @anotherVariable)
        const varDeps = new Map<string, string[]>();
        for (const v of vars) {
            const deps: string[] = [];
            // Scan expression for @varName references
            const atRefs = v.expression.match(/@([a-zA-Z][a-zA-Z0-9_]*)/g) || [];
            for (const ref of atRefs) {
                const name = ref.slice(1); // remove @
                if (name !== 'index' && name !== 'current' && name !== 'count' && varByName.has(name)) {
                    deps.push(name);
                }
            }
            varDeps.set(v.name, deps);
        }

        // Topological sort with cycle detection
        const sorted: FormspecVariable[] = [];
        const visited = new Set<string>();
        const inStack = new Set<string>();

        const visit = (name: string) => {
            if (inStack.has(name)) {
                throw new Error(`Circular variable dependency detected involving: ${name}`);
            }
            if (visited.has(name)) return;
            inStack.add(name);
            for (const dep of varDeps.get(name) || []) {
                visit(dep);
            }
            inStack.delete(name);
            visited.add(name);
            sorted.push(varByName.get(name)!);
        };

        for (const v of vars) visit(v.name);

        // Initialize variable signals in dependency order
        for (const v of sorted) {
            const scope = v.scope || '#';
            const varKey = `${scope}:${v.name}`;
            // Evaluate expression in the scope context.
            // For scoped variables, use "scope.__var" as context so that sibling fields
            // like "amount" resolve to "scope.amount" via parent path resolution.
            const contextPath = scope === '#' ? '' : `${scope}.__var`;
            const compiledExpr = this.compileFEL(v.expression, contextPath, undefined, true);
            this.variableSignals[varKey] = computed(() => compiledExpr());
        }
    }

    private initializeInstanceCalculates() {
        if (!this.definition.binds) return;
        for (const bind of this.definition.binds) {
            if (!bind.calculate) continue;
            const target = this.parseInstanceTarget(bind.path);
            if (!target) continue;

            const instanceConfig = this.definition.instances?.[target.instanceName];
            if (!instanceConfig) {
                throw new Error(`Unknown instance '${target.instanceName}' targeted by bind '${bind.path}'`);
            }
            if (instanceConfig.readonly !== false) {
                throw new Error(`Calculate bind cannot target readonly instance '${target.instanceName}'`);
            }

            const compiledCalc = this.compileFEL(bind.calculate, '', undefined, false);
            effect(() => {
                const value = compiledCalc();
                try {
                    this.writeInstanceValue(target.instanceName, target.instancePath, value, { bypassReadonly: true });
                } catch (error) {
                    console.error(`Failed to apply calculate bind to instance '${target.instanceName}':`, error);
                }
            });
        }
    }

    /**
     * Resolves a computed variable by name using lexical scope lookup.
     * Searches from the given scope path upward through ancestor scopes to the global scope (`#`).
     * @param name - The variable name (without the `@` prefix used in FEL).
     * @param scopePath - The dot-separated path of the current evaluation context.
     * @returns The computed variable value, or `undefined` if not found.
     */
    public getVariableValue(name: string, scopePath: string): any {
        const parts = scopePath ? scopePath.split('.').filter(Boolean) : [];
        const scopesToTry: string[] = [];
        const seen = new Set<string>();

        const pushScope = (scope: string) => {
            if (!scope || seen.has(scope)) return;
            seen.add(scope);
            scopesToTry.push(scope);
        };

        // Try exact scope path and each ancestor, then index-stripped variants.
        for (let i = parts.length; i >= 1; i--) {
            const rawScope = parts.slice(0, i).join('.');
            pushScope(rawScope);
            const normalizedScope = rawScope.replace(/\[\d+\]/g, '');
            pushScope(normalizedScope);
        }

        // Always include definition-wide fallback.
        pushScope('#');

        for (const scope of scopesToTry) {
            const key = `${scope}:${name}`;
            if (this.variableSignals[key]) return this.variableSignals[key].value;
        }
        return undefined;
    }

    private initShape(shape: FormspecShape) {
        const shapeId = shape.id;
        this.shapeResults[shapeId] = computed(() => this.evaluateShapeForPaths(shape));
    }

    /**
     * Evaluate a shape's constraints for all matching target paths.
     * Used by both continuous (reactive) and on-demand evaluation.
     */
    private evaluateShapeForPaths(shape: FormspecShape): ValidationResult[] {
        this.structureVersion.value;
        const results: ValidationResult[] = [];
        const targetPaths = this.resolveWildcardPath(shape.target);

        for (const path of targetPaths) {
            if (path && !this.isPathRelevant(path)) continue;

            if (shape.activeWhen) {
                const activeFn = this.compileFEL(shape.activeWhen, path, undefined, true);
                if (!activeFn()) continue;
            }

            const failed = this.evaluateShapeConstraints(shape, path);
            if (failed) {
                // Evaluate context map if present
                let ctx: Record<string, any> | undefined;
                if (shape.context) {
                    ctx = {};
                    for (const [key, expr] of Object.entries(shape.context)) {
                        const fn = this.compileFEL(expr, path, undefined, true);
                        ctx[key] = fn();
                    }
                }

                const result: ValidationResult = {
                    severity: shape.severity || "error",
                    path: this.toExternalPath(path),
                    message: this.interpolateMessage(shape.message, path),
                    constraintKind: "shape",
                    code: shape.code || "SHAPE_FAILED",
                    source: "shape",
                    shapeId: shape.id,
                    constraint: shape.constraint
                };
                if (ctx) result.context = ctx;
                results.push(result);
            }
        }
        return results;
    }

    /**
     * Evaluate shape constraints including composition operators.
     * Returns true if the shape FAILS (constraint violated).
     */
    private evaluateShapeConstraints(shape: FormspecShape, path: string): boolean {
        // Primary constraint
        if (shape.constraint) {
            const fn = this.compileFEL(shape.constraint, path, undefined, true);
            if (!fn()) return true;
        }

        // and: all must pass
        if (shape.and) {
            for (const expr of shape.and) {
                const fn = this.compileFEL(expr, path, undefined, true);
                if (!fn()) return true;
            }
        }

        // or: at least one must pass
        if (shape.or) {
            let anyPass = false;
            for (const expr of shape.or) {
                const fn = this.compileFEL(expr, path, undefined, true);
                if (fn()) { anyPass = true; break; }
            }
            if (!anyPass) return true;
        }

        // not: must fail (i.e., the expression should evaluate to false)
        if (shape.not) {
            const fn = this.compileFEL(shape.not, path, undefined, true);
            if (fn()) return true;
        }

        // xone: exactly one must pass
        if (shape.xone) {
            let passCount = 0;
            for (const expr of shape.xone) {
                const fn = this.compileFEL(expr, path, undefined, true);
                if (fn()) passCount++;
            }
            if (passCount !== 1) return true;
        }

        return false;
    }

    private interpolateMessage(message: string, contextPath: string): string {
        return message.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
            try {
                const fn = this.compileFEL(expr, contextPath, undefined, true);
                return String(fn());
            } catch (e) {
                return `{{${expr}}}`;
            }
        });
    }

    private resolveWildcardPath(path: string): string[] {
        if (path === "#") return [""];
        if (!path.includes('[*]')) return [path];

        const results: string[] = [];
        const asteriskIndex = path.indexOf('[*]');
        const base = path.substring(0, asteriskIndex);
        const remaining = path.substring(asteriskIndex + 3);

        const count = this.repeats[base]?.value || 0;
        for (let i = 0; i < count; i++) {
            const concrete = `${base}[${i}]${remaining}`;
            results.push(...this.resolveWildcardPath(concrete));
        }
        return results;
    }

    private toExternalPath(path: string): string {
        if (!path) return "#";
        return path.replace(/\[(\d+)\]/g, (_, p1) => `[${parseInt(p1) + 1}]`);
    }

    private initializeBindConfigs(items: FormspecItem[], prefix = '') {
        for (const item of items) {
            const fullName = prefix ? `${prefix}.${item.key}` : item.key;
            const relevant = item.relevant || item.visible;
            if (relevant || item.required || item.calculate || item.readonly || item.constraint || item.precision !== undefined) {
                this.bindConfigs[fullName] = {
                    path: fullName,
                    relevant: relevant,
                    required: item.required,
                    calculate: item.calculate,
                    readonly: item.readonly,
                    constraint: item.constraint,
                    constraintMessage: item.message,
                    precision: item.precision,
                };
            }
            if (item.children) {
                this.initializeBindConfigs(item.children, fullName);
            }
        }
    }

    private discoverAllNames(items: FormspecItem[], prefix = ''): string[] {
        let names: string[] = [];
        for (const item of items) {
            const fullName = prefix ? `${prefix}.${item.key}` : item.key;
            names.push(fullName);
            if (item.children) {
                names.push(...this.discoverAllNames(item.children, fullName));
            }
        }
        return names;
    }

    private initializeSignals() {
        this.knownNames = new Set(this.discoverAllNames(this.definition.items));
        for (const item of this.definition.items) {
            this.initItem(item);
        }
        this.detectCycles();
        this.structureVersion.value++;
    }

    private detectCycles() {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const visit = (node: string) => {
            if (recursionStack.has(node)) {
                console.error(`Cyclic dependency detected involving field: ${node}`);
                throw new Error(`Cyclic dependency detected involving field: ${node}`);
            }
            if (visited.has(node)) return;

            visited.add(node);
            recursionStack.add(node);

            const deps = this.dependencies[node] || [];
            for (const dep of deps) {
                if (dep === node) continue; // skip self-references (e.g. constraints reading own value)
                visit(dep);
            }

            recursionStack.delete(node);
        };

        for (const node of Object.keys(this.dependencies)) {
            visit(node);
        }
    }

    private validateDataType(value: any, dataType: string): boolean {
        if (value === null || value === undefined || value === '') return true;
        switch (dataType) {
            case 'integer':
                return Number.isInteger(value);
            case 'number':
            case 'decimal':
                return typeof value === 'number' && !isNaN(value);
            case 'money':
                if (typeof value === 'number') return !isNaN(value);
                return typeof value === 'object' && 'amount' in value &&
                    (value.amount === null || (typeof value.amount === 'number' && !isNaN(value.amount)));
            case 'boolean':
                return typeof value === 'boolean';
            case 'date':
                return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
            case 'dateTime':
                return !isNaN(Date.parse(String(value)));
            case 'time':
                return /^\d{2}:\d{2}(:\d{2})?$/.test(String(value));
            case 'uri':
                try { new URL(String(value)); return true; } catch { return false; }
            default:
                return true;
        }
    }

    private initItem(item: FormspecItem, prefix = '') {
        const key = item.key;
        if (!key) throw new Error("Item missing required 'key'");
        const fullName = prefix ? `${prefix}.${key}` : key;
        const baseKey = fullName.replace(/\[\d+\]/g, '');
        const bind = this.bindConfigs[baseKey];

        // Relevancy (Visibility)
        this.relevantSignals[fullName] = signal(true);
        if (bind && bind.relevant) {
            const compiled = this.compileFEL(bind.relevant!, fullName, undefined, true);
            this.relevantSignals[fullName] = computed(() => {
                const value = compiled();
                return value === null || value === undefined ? true : !!value;
            });
        }

        if (item.type === 'group') {
            if (item.repeatable) {
                const initialCount = item.minRepeat !== undefined ? item.minRepeat : 1;
                this.repeats[fullName] = signal(initialCount);

                this.validationResults[fullName] = computed(() => {
                    const results: ValidationResult[] = [];
                    const count = this.repeats[fullName].value;
                    if (item.minRepeat !== undefined && count < item.minRepeat) {
                        results.push({
                            severity: "error",
                            path: this.toExternalPath(fullName),
                            message: `Minimum ${item.minRepeat} entries required`,
                            constraintKind: "cardinality",
                            code: "MIN_REPEAT"
                        });
                    }
                    if (item.maxRepeat !== undefined && count > item.maxRepeat) {
                        results.push({
                            severity: "error",
                            path: this.toExternalPath(fullName),
                            message: `Maximum ${item.maxRepeat} entries allowed`,
                            constraintKind: "cardinality",
                            code: "MAX_REPEAT"
                        });
                    }
                    return results;
                });

                for (let i = 0; i < initialCount; i++) {
                    this.initRepeatInstance(item, fullName, i);
                }
            } else if (item.children) {
                for (const child of item.children) {
                    this.initItem(child, fullName);
                }
            }
        } else if (item.type === 'field') {
            let initialValue: any = item.initialValue !== undefined ? item.initialValue : '';
            const dataType = item.dataType;
            if (!dataType) throw new Error(`Field '${fullName}' missing required 'dataType'`);

            if (typeof initialValue === 'string' && initialValue.startsWith('=')) {
                const expr = initialValue.substring(1);
                const compiled = this.compileFEL(expr, fullName, undefined, true);
                initialValue = compiled();
            }

            if (initialValue === '' && (dataType === 'integer' || dataType === 'decimal' || dataType === 'number' || dataType === 'money')) {
                initialValue = null;
            }
            if (initialValue === '' && dataType === 'boolean') {
                initialValue = false;
            }
            
            // prePopulate: override initial value from instance data
            let prePopReadonly = false;
            if (item.prePopulate) {
                const ppData = this.getInstanceData(item.prePopulate.instance, item.prePopulate.path);
                if (ppData !== undefined) {
                    initialValue = ppData;
                }
                if (item.prePopulate.editable === false) {
                    prePopReadonly = true;
                }
            }

            this.signals[fullName] = signal(initialValue);
            this.requiredSignals[fullName] = signal(false);
            this.readonlySignals[fullName] = signal(prePopReadonly);
            this.errorSignals[fullName] = signal(null);
            this.validationResults[fullName] = signal([]);

            // Initialize bind-driven signals BEFORE creating validation computed,
            // so the computed captures the correct signal references.
            if (bind) {
                if (bind.calculate) {
                    const compiledCalc = this.compileFEL(bind.calculate, fullName, undefined, false);
                    if (bind.precision !== undefined) {
                        const factor = Math.pow(10, bind.precision);
                        this.signals[fullName] = computed(() => {
                            const raw = compiledCalc();
                            return typeof raw === 'number' && !isNaN(raw)
                                ? Math.round(raw * factor) / factor
                                : raw;
                        });
                    } else {
                        this.signals[fullName] = computed(compiledCalc);
                    }
                }
                if (bind.required) {
                    if (typeof bind.required === 'string') {
                        const compiled = this.compileFEL(bind.required as string, fullName, undefined, true);
                        this.requiredSignals[fullName] = computed(() => !!compiled());
                    } else {
                        this.requiredSignals[fullName] = signal(!!bind.required);
                    }
                }
                if (bind.readonly) {
                    if (typeof bind.readonly === 'string') {
                        const compiled = this.compileFEL(bind.readonly as string, fullName, undefined, true);
                        this.readonlySignals[fullName] = computed(() => !!compiled());
                    } else {
                        this.readonlySignals[fullName] = signal(!!bind.readonly);
                    }
                }
            }

            const compiledConstraint = bind?.constraint ? this.compileFEL(bind.constraint, fullName, undefined, true) : null;
            let patternRegex: RegExp | null = null;
            if (item.pattern) {
                try {
                    patternRegex = new RegExp(item.pattern);
                } catch {
                    patternRegex = null;
                }
            }

            // Resolve registry extension constraints (pattern, maxLength) for this field.
            let registryPatternRegex: RegExp | null = null;
            let registryMaxLength: number | null = null;
            let registryMinimum: number | null = null;
            let registryMaximum: number | null = null;
            const exts = item.extensions;
            if (exts && typeof exts === 'object') {
                for (const [extName, extEnabled] of Object.entries(exts)) {
                    if (!extEnabled) continue;
                    const entry = this.registryEntries.get(extName);
                    if (!entry?.constraints) continue;
                    if (entry.constraints.pattern && !registryPatternRegex) {
                        try {
                            registryPatternRegex = new RegExp(entry.constraints.pattern);
                        } catch { /* skip invalid patterns */ }
                    }
                    if (entry.constraints.maxLength != null && registryMaxLength == null) {
                        registryMaxLength = entry.constraints.maxLength;
                    }
                    if (entry.constraints.minimum != null && registryMinimum == null) {
                        registryMinimum = entry.constraints.minimum;
                    }
                    if (entry.constraints.maximum != null && registryMaximum == null) {
                        registryMaximum = entry.constraints.maximum;
                    }
                }
            }

            this.validationResults[fullName] = computed(() => {
                const results: ValidationResult[] = [];
                const value = this.signals[fullName].value;
                const isRequired = this.requiredSignals[fullName].value;

                // 1. DataType Validation
                if (!this.validateDataType(value, dataType)) {
                    results.push({
                        severity: "error",
                        path: this.toExternalPath(fullName),
                        message: `Invalid ${dataType}`,
                        constraintKind: "type",
                        code: "TYPE_MISMATCH",
                        source: "bind"
                    });
                }

                // 2. Required Validation
                // Money fields store objects like { amount, currency }; treat missing amount as empty.
                const isMoneyEmpty = dataType === 'money'
                    && value !== null
                    && value !== undefined
                    && typeof value === 'object'
                    && 'amount' in (value as any)
                    && (((value as any).amount === null) || ((value as any).amount === undefined) || ((value as any).amount === ''));

                if (isRequired && (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || isMoneyEmpty)) {
                    results.push({
                        severity: "error",
                        path: this.toExternalPath(fullName),
                        message: "Required",
                        constraintKind: "required",
                        code: "REQUIRED",
                        source: "bind"
                    });
                }

                // 3. Bind Constraint
                if (compiledConstraint) {
                    const raw = compiledConstraint();
                    const isValid = raw === null || raw === undefined ? true : !!raw;
                    if (!isValid) {
                        results.push({
                            severity: "error",
                            path: this.toExternalPath(fullName),
                            message: bind?.constraintMessage || "Invalid",
                            constraintKind: "constraint",
                            code: "CONSTRAINT_FAILED",
                            source: "bind",
                            constraint: bind?.constraint
                        });
                    }
                }

                // 4. Pattern Validation
                // Null-propagating: do not emit pattern errors for empty optional values.
                if (patternRegex && !(value === null || value === undefined || value === '')) {
                    if (!patternRegex.test(String(value))) {
                        results.push({
                            severity: "error",
                            path: this.toExternalPath(fullName),
                            message: "Pattern mismatch",
                            constraintKind: "constraint",
                            code: "PATTERN_MISMATCH",
                            source: "bind"
                        });
                    }
                }

                // 5. Registry extension constraints (pattern, maxLength, minimum, maximum)
                // Null-propagating: skip for empty optional values.
                if (!(value === null || value === undefined || value === '')) {
                    if (registryPatternRegex && !registryPatternRegex.test(String(value))) {
                        results.push({
                            severity: "error",
                            path: this.toExternalPath(fullName),
                            message: "Pattern mismatch",
                            constraintKind: "constraint",
                            code: "PATTERN_MISMATCH",
                            source: "bind"
                        });
                    }
                    if (registryMaxLength != null && String(value).length > registryMaxLength) {
                        results.push({
                            severity: "error",
                            path: this.toExternalPath(fullName),
                            message: `Must be at most ${registryMaxLength} characters`,
                            constraintKind: "constraint",
                            code: "MAX_LENGTH_EXCEEDED",
                            source: "bind"
                        });
                    }
                    const numVal = typeof value === 'number' ? value : Number(value);
                    if (!isNaN(numVal)) {
                        if (registryMinimum != null && numVal < registryMinimum) {
                            results.push({
                                severity: "error",
                                path: this.toExternalPath(fullName),
                                message: `Must be at least ${registryMinimum}`,
                                constraintKind: "constraint",
                                code: "RANGE_UNDERFLOW",
                                source: "bind"
                            });
                        }
                        if (registryMaximum != null && numVal > registryMaximum) {
                            results.push({
                                severity: "error",
                                path: this.toExternalPath(fullName),
                                message: `Must be at most ${registryMaximum}`,
                                constraintKind: "constraint",
                                code: "RANGE_OVERFLOW",
                                source: "bind"
                            });
                        }
                    }
                }
                return results;
            });

            this.errorSignals[fullName] = computed(() => {
                const res = this.validationResults[fullName].value;
                return res.length > 0 ? res[0].message : null;
            });
            
            // Default bind: apply default value on relevance transition
            if (bind?.default !== undefined) {
                let prevRelevant = this.relevantSignals[fullName]?.peek?.() ?? true;
                // Coerce money defaults: ensure amount is numeric, not string
                let defaultVal = bind.default;
                if (dataType === 'money' && defaultVal && typeof defaultVal === 'object' && 'amount' in defaultVal && typeof defaultVal.amount === 'string') {
                    defaultVal = { ...defaultVal, amount: defaultVal.amount === '' ? null : Number(defaultVal.amount) };
                }
                const sigRef = this.signals[fullName];
                if (this.relevantSignals[fullName] && sigRef && !('_dispose' in sigRef)) {
                    // Only for writable signals (not computed/calculated)
                    effect(() => {
                        const nowRelevant = this.relevantSignals[fullName].value;
                        if (nowRelevant && !prevRelevant) {
                            // Transitioning to relevant — apply default
                            if (this.signals[fullName].peek() === null ||
                                this.signals[fullName].peek() === undefined ||
                                this.signals[fullName].peek() === '') {
                                this.signals[fullName].value = defaultVal;
                            }
                        }
                        prevRelevant = nowRelevant;
                    });
                }
            }

            if (item.children) {
                for (const child of item.children) {
                    this.initItem(child, fullName);
                }
            }
        } else if (item.type === 'display') {
            // Display items don't have values, but they can have relevancy
        }
    }

    private initRepeatInstance(item: FormspecItem, fullName: string, index: number) {
        if (!item.children) return;
        const prefix = `${fullName}[${index}]`;
        for (const child of item.children) {
            this.initItem(child, prefix);
        }
    }

    /**
     * Adds a new repeat instance to a repeatable group, initializing all child signals.
     * Does not enforce maxRepeat; exceeding the maximum produces a validation error instead.
     * @param itemName - The full path of the repeatable group.
     * @returns The zero-based index of the newly created instance, or undefined if the item is not repeatable.
     */
    public addRepeatInstance(itemName: string) {
        const item = this.findItem(this.definition.items, itemName);
        if (item && item.repeatable) {
            const index = this.repeats[itemName].value;
            batch(() => {
                this.initRepeatInstance(item!, itemName, index);
                this.repeats[itemName].value++;
                this.structureVersion.value++;
            });
            return index;
        }
    }

    private cloneValue<T>(value: T): T {
        if (value === null || value === undefined || typeof value !== 'object') {
            return value;
        }
        const cloner = (globalThis as any).structuredClone;
        if (typeof cloner === 'function') {
            return cloner(value);
        }
        return JSON.parse(JSON.stringify(value));
    }

    private isWritableSignal(sig: any): boolean {
        if (!sig) return false;
        const proto = Object.getPrototypeOf(sig);
        if (!proto) return false;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        return !!descriptor?.set;
    }

    private snapshotGroupChildren(items: FormspecItem[], prefix: string): Record<string, any> {
        const snapshot: Record<string, any> = {};
        for (const item of items) {
            const path = `${prefix}.${item.key}`;
            if (item.type === 'field') {
                snapshot[item.key] = this.cloneValue(this.signals[path]?.value);
                continue;
            }

            if (item.type === 'group') {
                if (item.repeatable) {
                    const count = this.repeats[path]?.value ?? 0;
                    const rows: Array<Record<string, any>> = [];
                    for (let i = 0; i < count; i++) {
                        rows.push(this.snapshotGroupChildren(item.children || [], `${path}[${i}]`));
                    }
                    snapshot[item.key] = rows;
                } else {
                    snapshot[item.key] = this.snapshotGroupChildren(item.children || [], path);
                }
            }
        }
        return snapshot;
    }

    private clearRepeatSubtree(rootRepeatPath: string) {
        const prefix = `${rootRepeatPath}[`;
        const stores = [
            this.signals,
            this.relevantSignals,
            this.requiredSignals,
            this.readonlySignals,
            this.errorSignals,
            this.validationResults,
            this.repeats
        ];

        for (const store of stores) {
            for (const key of Object.keys(store)) {
                if (key.startsWith(prefix)) {
                    delete (store as any)[key];
                }
            }
        }
    }

    private applyGroupChildrenSnapshot(items: FormspecItem[], prefix: string, snapshot: Record<string, any>) {
        for (const item of items) {
            const path = `${prefix}.${item.key}`;
            if (item.type === 'field') {
                const sig = this.signals[path];
                if (sig && this.isWritableSignal(sig)) {
                    sig.value = this.cloneValue(snapshot?.[item.key]);
                }
                continue;
            }

            if (item.type === 'group') {
                if (item.repeatable) {
                    const desiredRows: Array<Record<string, any>> = Array.isArray(snapshot?.[item.key]) ? snapshot[item.key] : [];
                    let currentCount = this.repeats[path]?.value ?? 0;

                    while (currentCount < desiredRows.length) {
                        this.addRepeatInstance(path);
                        currentCount = this.repeats[path]?.value ?? 0;
                    }
                    while (currentCount > desiredRows.length) {
                        this.removeRepeatInstance(path, currentCount - 1);
                        currentCount = this.repeats[path]?.value ?? 0;
                    }

                    for (let i = 0; i < desiredRows.length; i++) {
                        this.applyGroupChildrenSnapshot(item.children || [], `${path}[${i}]`, desiredRows[i] || {});
                    }
                } else {
                    this.applyGroupChildrenSnapshot(item.children || [], path, snapshot?.[item.key] || {});
                }
            }
        }
    }

    /**
     * Removes a repeat instance at the given index, shifting subsequent instances down.
     * Does not enforce minRepeat; going below the minimum produces a validation error instead.
     * @param itemName - The full path of the repeatable group.
     * @param index - The zero-based index of the instance to remove.
     */
    public removeRepeatInstance(itemName: string, index: number) {
        const count = this.repeats[itemName]?.value;
        if (count == null || index < 0 || index >= count) return;

        const item = this.findItem(this.definition.items, itemName);
        if (!item || !item.children) return;

        const snapshots: Array<Record<string, any>> = [];
        for (let i = 0; i < count; i++) {
            snapshots.push(this.snapshotGroupChildren(item.children, `${itemName}[${i}]`));
        }
        snapshots.splice(index, 1);

        batch(() => {
            this.clearRepeatSubtree(itemName);
            this.repeats[itemName].value = snapshots.length;
            for (let i = 0; i < snapshots.length; i++) {
                this.initRepeatInstance(item!, itemName, i);
                this.applyGroupChildrenSnapshot(item!.children!, `${itemName}[${i}]`, snapshots[i]);
            }
            this.structureVersion.value++;
        });
    }

    private collectFieldKeys(items: FormspecItem[], prefix = ''): string[] {
        const keys: string[] = [];
        for (const item of items) {
            const path = prefix ? `${prefix}.${item.key}` : item.key;
            if (item.type === 'field') {
                keys.push(path);
            }
            if (item.children) {
                keys.push(...this.collectFieldKeys(item.children, path));
            }
        }
        return keys;
    }

    private findItem(items: FormspecItem[], name: string): FormspecItem | undefined {
        const parts = name.split('.');
        let currentItems = items;
        let foundItem: FormspecItem | undefined;

        for (const part of parts) {
            const cleanPart = part.replace(/\[\d+\]/g, '');
            foundItem = currentItems.find(i => i.key === cleanPart);
            if (!foundItem) return undefined;
            if (foundItem.children) {
                currentItems = foundItem.children;
            } else {
                if (parts.indexOf(part) !== parts.length - 1) return undefined;
            }
        }
        return foundItem;
    }

    /**
     * Compiles a FEL expression into a callable function that evaluates against the engine's current state.
     * Results are cached; subsequent calls with the same expression and context return the cached function.
     * @param expression - The FEL expression string to compile.
     * @param currentItemName - The field path providing evaluation context for relative references.
     * @returns A zero-argument function that returns the expression's current value.
     */
    public compileExpression(expression: string, currentItemName: string = '') {
        return this.compileFEL(expression, currentItemName, undefined, true);
    }

    private compileFEL(expression: string, currentItemName: string, index?: number, includeSelf = false): () => any {
        const cacheKey = `${expression}|${currentItemName}|${includeSelf}`;
        if (this.compiledExpressions[cacheKey]) return this.compiledExpressions[cacheKey];

        const lexResult = FelLexer.tokenize(expression);
        parser.input = lexResult.tokens;
        const cst = parser.expression();

        if (parser.errors.length > 0) {
            console.error(`FEL Parse Errors for "${expression}":`, parser.errors);
            const errorFn = () => null;
            this.compiledExpressions[cacheKey] = errorFn;
            return errorFn;
        }

        const baseCurrentItemName = currentItemName.replace(/\[\d+\]/g, '');
        const astDeps = dependencyVisitor.getDependencies(cst);

        if (!this.dependencies[baseCurrentItemName]) {
            this.dependencies[baseCurrentItemName] = [];
        }

        const parts = currentItemName.split(/[.\[\]]/).filter(Boolean);
        const parentPath = parts.slice(0, -1).join('.');

        for (const dep of astDeps) {
            let fullDepPath = dep;
            if (dep === '') {
                fullDepPath = baseCurrentItemName;
            } else if (!dep.includes('.') && parentPath) {
                fullDepPath = `${parentPath}.${dep}`;
            }
            
            const cleanDepPath = fullDepPath.replace(/\[\d+\]/g, '');
            if (!this.dependencies[baseCurrentItemName].includes(cleanDepPath)) {
                this.dependencies[baseCurrentItemName].push(cleanDepPath);
            }
        }

        const compiled = () => {
            this.structureVersion.value;
            this.instanceVersion.value;
            // Track dependencies in signals
            for (const dep of astDeps) {
                let fullDepPath = dep;
                if (dep === '') {
                    if (!includeSelf) continue; // Skip self-references for calculate expressions
                    fullDepPath = currentItemName;
                } else if (!dep.includes('.') && parentPath) {
                    fullDepPath = `${parentPath}.${dep}`;
                }

                if (this.signals[fullDepPath]) this.signals[fullDepPath].value;
                if (this.repeats[fullDepPath]) this.repeats[fullDepPath].value;
                if (this.relevantSignals[fullDepPath]) this.relevantSignals[fullDepPath].value;
            }

            const context: FelContext = {
                getSignalValue: (path: string) => {
                    // excludedValue: when "null", non-relevant fields return null
                    const cleanPath = path.replace(/\[\d+\]/g, '');
                    const pathBind = this.bindConfigs[cleanPath];
                    if (pathBind?.excludedValue === 'null' && this.relevantSignals[path] && !this.relevantSignals[path].value) {
                        return null;
                    }
                    if (this.signals[path]) return this.signals[path].value;
                    // Check if path traverses a repeatable group — collect instances into array
                    // Supports nested repeats by scanning each dotted segment.
                    // '*' segments (from [*] wildcards in FEL) are skipped — the repeat
                    // expansion happens automatically when the group segment is encountered.
                    const segments = path.split('.');
                    const resolvedPaths = [''];
                    for (let s = 0; s < segments.length; s++) {
                        const seg = segments[s];
                        if (seg === '*') continue; // skip wildcard markers
                        const newPaths: string[] = [];
                        for (const rp of resolvedPaths) {
                            const candidate = rp ? `${rp}.${seg}` : seg;
                            if (this.repeats[candidate]) {
                                const count = this.repeats[candidate].value;
                                for (let i = 0; i < count; i++) {
                                    newPaths.push(`${candidate}[${i}]`);
                                }
                            } else {
                                newPaths.push(candidate);
                            }
                        }
                        resolvedPaths.length = 0;
                        resolvedPaths.push(...newPaths);
                    }
                    // If we expanded repeats, collect leaf signal values
                    if (resolvedPaths.length > 0 && resolvedPaths[0] !== path) {
                        const result: any[] = [];
                        for (const rp of resolvedPaths) {
                            const sig = this.signals[rp];
                            if (sig) {
                                const val = sig.value;
                                if (Array.isArray(val)) {
                                    result.push(...val);
                                } else {
                                    result.push(val);
                                }
                            }
                        }
                        if (result.length > 0) return result;
                    }
                    return undefined;
                },
                getRepeatsValue: (path: string) => this.repeats[path]?.value ?? 0,
                getRelevantValue: (path: string) => this.relevantSignals[path]?.value ?? true,
                getRequiredValue: (path: string) => this.requiredSignals[path]?.value ?? false,
                getReadonlyValue: (path: string) => this.readonlySignals[path]?.value ?? false,
                getValidationErrors: (path: string) => {
                    const vr = this.validationResults[path];
                    if (!vr) return 0;
                    return vr.value.filter(r => r.severity === 'error').length;
                },
                currentItemPath: currentItemName,
                engine: this
            };

            try {
                return interpreter.evaluate(cst, context);
            } catch (e) {
                if (e instanceof FelUnsupportedFunctionError) {
                    throw e;
                }
                console.error("FEL Evaluation Error:", e);
                return null;
            }
        };

        this.compiledExpressions[cacheKey] = compiled;
        return compiled;
    }

    private getValueFromDataPath(data: Record<string, any>, path: string): any {
        if (!path) return data;

        let currentValues: any[] = [data];
        const segments = path.split('.');

        for (const segment of segments) {
            const nextValues: any[] = [];
            const match = segment.match(/^([^\[\]]+)(?:\[(\*|\d+)\])?$/);

            for (const current of currentValues) {
                if (current === null || current === undefined) continue;

                if (!match) {
                    if (/^\d+$/.test(segment)) {
                        const idx = parseInt(segment, 10) - 1; // FEL index access is 1-based.
                        if (Array.isArray(current) && idx >= 0 && idx < current.length) {
                            nextValues.push(current[idx]);
                        } else if (typeof current === 'object' && segment in current) {
                            nextValues.push((current as any)[segment]);
                        }
                    } else if (segment === '*') {
                        if (Array.isArray(current)) {
                            nextValues.push(...current);
                        }
                    } else if (typeof current === 'object' && segment in current) {
                        nextValues.push((current as any)[segment]);
                    }
                    continue;
                }

                const base = match[1];
                const indexToken = match[2];
                const baseValue = (current as any)[base];

                if (indexToken === undefined) {
                    if (Array.isArray(baseValue)) {
                        nextValues.push(...baseValue);
                    } else {
                        nextValues.push(baseValue);
                    }
                    continue;
                }

                if (indexToken === '*') {
                    if (Array.isArray(baseValue)) {
                        nextValues.push(...baseValue);
                    }
                    continue;
                }

                const idx = parseInt(indexToken, 10) - 1; // FEL index access is 1-based.
                if (Array.isArray(baseValue) && idx >= 0 && idx < baseValue.length) {
                    nextValues.push(baseValue[idx]);
                }
            }

            currentValues = nextValues;
            if (currentValues.length === 0) return undefined;
        }

        return currentValues.length === 1 ? currentValues[0] : currentValues;
    }

    private evaluateMigrationExpression(expression: string, data: Record<string, any>): any {
        const lexResult = FelLexer.tokenize(expression);
        parser.input = lexResult.tokens;
        const cst = parser.expression();
        if (parser.errors.length > 0) return null;

        const context: FelContext = {
            getSignalValue: (path: string) => this.getValueFromDataPath(data, path),
            getRepeatsValue: (path: string) => {
                const value = this.getValueFromDataPath(data, path);
                return Array.isArray(value) ? value.length : 0;
            },
            getRelevantValue: () => true,
            getRequiredValue: () => false,
            getReadonlyValue: () => false,
            getValidationErrors: () => 0,
            currentItemPath: '',
            engine: this
        };

        try {
            return interpreter.evaluate(cst, context);
        } catch {
            return null;
        }
    }

    /**
     * Sets a field's value, applying whitespace transforms, type coercion, and precision enforcement
     * as configured by the field's bind and data type.
     * @param name - Full field path including repeat indices (e.g. `"expenses[0].amount"`).
     * @param value - The new value to set.
     */
    public setValue(name: string, value: any) {
        const instanceTarget = this.parseInstanceTarget(name);
        if (instanceTarget) {
            this.writeInstanceValue(instanceTarget.instanceName, instanceTarget.instancePath, value);
            return;
        }

        const baseName = name.replace(/\[\d+\]/g, '');
        const item = this.findItem(this.definition.items, baseName);
        const dataType = item?.dataType || (item?.type as string);
        const bind = this.bindConfigs[baseName];

        // Whitespace transform (before type coercion)
        if (typeof value === 'string' && bind?.whitespace) {
            switch (bind.whitespace) {
                case 'trim': value = value.trim(); break;
                case 'normalize': value = value.replace(/\s+/g, ' ').trim(); break;
                case 'remove': value = value.replace(/\s/g, ''); break;
            }
        }

        // Type coercion
        if (dataType && (dataType === 'integer' || dataType === 'decimal' || dataType === 'number') && typeof value === 'string') {
            value = value === '' ? null : Number(value);
        }
        if (dataType === 'money' && typeof value === 'number') {
            const currency = item?.currency || this.definition.formPresentation?.defaultCurrency || '';
            value = { amount: value, currency };
        }
        if (dataType === 'money' && value && typeof value === 'object' && typeof value.amount === 'string') {
            value = { ...value, amount: value.amount === '' ? null : Number(value.amount) };
        }

        // Precision enforcement
        if (bind?.precision !== undefined && typeof value === 'number' && !isNaN(value)) {
            const factor = Math.pow(10, bind.precision);
            value = Math.round(value * factor) / factor;
        }

        if (this.signals[name]) {
            this.signals[name].value = value;
        }
    }

    /**
     * Builds and returns the current validation report, aggregating bind-level and shape-level results.
     * In `"continuous"` mode (default), only continuous-timing shapes are included.
     * In `"submit"` mode, submit-timing shapes are also evaluated.
     * Non-relevant fields are excluded from the report.
     * @param options - Optional mode selection (`"continuous"` or `"submit"`).
     */
    public getValidationReport(options?: { mode?: 'continuous' | 'submit' }): ValidationReport {
        const mode = options?.mode || 'continuous';
        const allResults: ValidationResult[] = [];

        // Always include bind-level validation (field constraints)
        for (const key of Object.keys(this.validationResults)) {
            if (this.isPathRelevant(key)) {
                allResults.push(...this.validationResults[key].value);
            }
        }

        // Include continuous shape results (always)
        for (const shapeId of Object.keys(this.shapeResults)) {
            allResults.push(...this.shapeResults[shapeId].value);
        }

        // In submit mode, also evaluate submit-timing shapes
        if (mode === 'submit' && this.definition.shapes) {
            for (const shape of this.definition.shapes) {
                if (shape.timing === 'submit') {
                    allResults.push(...this.evaluateShapeForPaths(shape));
                }
            }
        }

        const counts = { error: 0, warning: 0, info: 0 };
        for (const r of allResults) {
            counts[r.severity]++;
        }

        return {
            valid: counts.error === 0,
            results: allResults,
            counts,
            timestamp: this.nowISO()
        };
    }

    /**
     * Evaluates a specific shape by ID on demand, returning any resulting validation findings.
     * Typically used for demand-timing shapes that are not automatically evaluated.
     * @param shapeId - The shape's unique identifier from the definition.
     * @returns An array of validation results (empty if the shape passes or is not found).
     */
    public evaluateShape(shapeId: string): ValidationResult[] {
        const shape = this.definition.shapes?.find(s => s.id === shapeId);
        if (!shape) return [];
        return this.evaluateShapeForPaths(shape);
    }

    private isPathRelevant(path: string): boolean {
        if (!path) return true;
        const parts = path.split(/[\[\]\.]/).filter(Boolean);
        let currentPath = '';
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isNumber = !isNaN(parseInt(part));
            if (isNumber) {
                currentPath += `[${part}]`;
            } else {
                currentPath += (currentPath ? '.' : '') + part;
            }
            if (this.relevantSignals[currentPath] && !this.relevantSignals[currentPath].value) {
                return false;
            }
        }
        return true;
    }

    /**
     * Serializes the current form state into a Formspec response document.
     * Respects nonRelevantBehavior settings (remove, empty, or keep) when building the data tree.
     * Includes a full validation report and metadata (definitionUrl, definitionVersion, status, authored timestamp).
     * @param meta - Optional metadata: response id, author, subject, and validation mode.
     * @returns A Formspec response object ready for submission or persistence.
     */
    public getResponse(meta?: { id?: string; author?: { id: string; name?: string }; subject?: { id: string; type?: string }; mode?: 'continuous' | 'submit' }) {
        const data: any = {};
        const mode = meta?.mode || 'continuous';

        const defaultNRB = this.definition.nonRelevantBehavior || 'remove';

        for (const key of Object.keys(this.signals)) {
            const isRelevant = this.isPathRelevant(key);
            const baseName = key.replace(/\[\d+\]/g, '');
            let nrb = defaultNRB;
            const ownBind = this.bindConfigs[baseName];
            if (ownBind?.nonRelevantBehavior) {
                nrb = ownBind.nonRelevantBehavior;
            } else {
                const nrbParts = baseName.split('.');
                for (let ai = nrbParts.length - 1; ai >= 1; ai--) {
                    const ancestor = nrbParts.slice(0, ai).join('.');
                    const ancestorBind = this.bindConfigs[ancestor];
                    if (ancestorBind?.nonRelevantBehavior) {
                        nrb = ancestorBind.nonRelevantBehavior;
                        break;
                    }
                }
            }

            if (!isRelevant) {
                if (nrb === 'remove') continue;
            }

            const parts = key.split(/[\[\]\.]/).filter(Boolean);
            let current = data;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const nextPart = parts[i+1];
                const isNextNumber = !isNaN(parseInt(nextPart));
                if (current[part] !== undefined && (typeof current[part] !== 'object' || current[part] === null)) {
                    // Parent segment already holds a scalar (e.g. a field with child items).
                    // Flatten child to the current container level to avoid clobbering the scalar.
                    break;
                }
                if (!current[part]) {
                    current[part] = isNextNumber ? [] : {};
                }
                current = current[part];
            }

            if (!isRelevant && nrb === 'empty') {
                current[parts[parts.length - 1]] = null;
            } else {
                const val = this.signals[key].value;
                current[parts[parts.length - 1]] = Array.isArray(val) ? [...val] : (typeof val === 'object' && val !== null ? {...val} : val);
            }
        }

        // Submit mode uses full validation (continuous + submit shapes)
        const report = this.getValidationReport({ mode });

        const response: any = {
            definitionUrl: this.definition.url || "http://example.org/form",
            definitionVersion: this.definition.version || "1.0.0",
            status: report.valid ? "completed" : "in-progress",
            data,
            validationResults: report.results,
            authored: this.nowISO()
        };

        if (meta?.id) response.id = meta.id;
        if (meta?.author) response.author = meta.author;
        if (meta?.subject) response.subject = meta.subject;

        return response;
    }

    /**
     * Captures a complete point-in-time snapshot of the engine's internal state for debugging.
     * Includes all field values, MIP states (relevant/required/readonly/error), dependency graph,
     * repeat counts, validation report, and runtime context.
     * @param options - Optional validation mode for the included report.
     */
    public getDiagnosticsSnapshot(options?: { mode?: 'continuous' | 'submit' }): FormEngineDiagnosticsSnapshot {
        const mode = options?.mode || 'continuous';
        const values: Record<string, any> = {};
        const mips: FormEngineDiagnosticsSnapshot['mips'] = {};
        const repeats: Record<string, number> = {};

        for (const [path, repeatSignal] of Object.entries(this.repeats)) {
            repeats[path] = repeatSignal.value;
        }

        const signalPaths = Object.keys(this.signals).sort();
        for (const path of signalPaths) {
            values[path] = this.cloneValue(this.signals[path]?.value);
            mips[path] = {
                relevant: this.relevantSignals[path]?.value ?? true,
                required: this.requiredSignals[path]?.value ?? false,
                readonly: this.readonlySignals[path]?.value ?? false,
                error: this.errorSignals[path]?.value ?? null,
            };
        }

        const timestamp = this.nowISO();
        return {
            definition: {
                url: this.definition.url,
                version: this.definition.version,
                title: this.definition.title,
            },
            timestamp,
            structureVersion: this.structureVersion.value,
            repeats,
            values,
            mips,
            dependencies: this.cloneValue(this.dependencies),
            validation: this.getValidationReport({ mode }),
            runtimeContext: {
                now: timestamp,
                locale: this.runtimeContext.locale,
                timeZone: this.runtimeContext.timeZone,
                seed: this.runtimeContext.seed,
            },
        };
    }

    /**
     * Applies a single replay event to the engine, dispatching to the appropriate method.
     * Catches errors and returns them in the result rather than throwing.
     * @param event - The replay event to apply.
     * @returns A result indicating success/failure, with optional output and error message.
     */
    public applyReplayEvent(event: EngineReplayEvent): EngineReplayApplyResult {
        try {
            switch (event.type) {
                case 'setValue':
                    this.setValue(event.path, event.value);
                    return { ok: true, event };
                case 'addRepeatInstance':
                    return { ok: true, event, output: this.addRepeatInstance(event.path) };
                case 'removeRepeatInstance':
                    this.removeRepeatInstance(event.path, event.index);
                    return { ok: true, event };
                case 'evaluateShape':
                    return { ok: true, event, output: this.evaluateShape(event.shapeId) };
                case 'getValidationReport':
                    return { ok: true, event, output: this.getValidationReport({ mode: event.mode }) };
                case 'getResponse':
                    return { ok: true, event, output: this.getResponse({ mode: event.mode }) };
                default: {
                    const neverType: never = event;
                    throw new Error(`Unsupported replay event: ${(neverType as any).type}`);
                }
            }
        } catch (error) {
            return {
                ok: false,
                event,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Replays a sequence of events against the engine in order, for deterministic state reproduction.
     * @param events - The ordered list of replay events to apply.
     * @param options - If `stopOnError` is true, replay halts on the first failed event.
     * @returns Aggregate results with per-event outcomes and any errors.
     */
    public replay(events: EngineReplayEvent[], options?: { stopOnError?: boolean }): EngineReplayResult {
        const results: EngineReplayApplyResult[] = [];
        const errors: EngineReplayResult['errors'] = [];
        let applied = 0;

        for (let i = 0; i < events.length; i++) {
            const result = this.applyReplayEvent(events[i]);
            results.push(result);
            if (result.ok) {
                applied++;
            } else {
                errors.push({
                    index: i,
                    event: events[i],
                    error: result.error || 'Unknown replay error',
                });
                if (options?.stopOnError) {
                    break;
                }
            }
        }

        return {
            applied,
            results,
            errors,
        };
    }

    // === Extended Features (Phase 11) ===

    /** Returns the loaded Formspec definition document. */
    public getDefinition(): FormspecDefinition {
        return this.definition;
    }

    /** Returns the definition's `formPresentation` block (layout, wizard, default currency, etc.), or null if absent. */
    get formPresentation(): any {
        return this.definition.formPresentation || null;
    }

    private labelContext: string | null = null;

    /**
     * Sets the active label context key, used by {@link getLabel} to select alternate label strings.
     * @param context - A label context key (e.g. `"short"`, `"print"`), or null to use the default label.
     */
    public setLabelContext(context: string | null) {
        this.labelContext = context;
    }

    /**
     * Returns the label for an item, honoring the current label context if one is set.
     * Falls back to the item's default `label` property when no context match is found.
     */
    public getLabel(item: FormspecItem): string {
        if (this.labelContext && item.labels && item.labels[this.labelContext]) {
            return item.labels[this.labelContext];
        }
        return item.label;
    }

    /**
     * Evaluates the definition's screener routes against provided answers.
     * Screener items are NOT part of the form's instance data — answers are passed
     * directly and evaluated in isolation. Routes are evaluated in declaration order;
     * first match wins. Returns the matching route or null if none match.
     */
    public evaluateScreener(answers: Record<string, any>): { target: string; label?: string; extensions?: Record<string, any> } | null {
        const screener = this.definition.screener;
        if (!screener?.routes) return null;

        // Build a FelContext that reads from the answers object, not form signals
        const screenerContext: FelContext = {
            getSignalValue: (path: string) => {
                // Simple path lookup in answers (supports dotted paths)
                const segments = path.split('.');
                let value: any = answers;
                for (const seg of segments) {
                    if (value == null) return null;
                    value = value[seg];
                }
                return value ?? null;
            },
            getRepeatsValue: () => 0,
            getRelevantValue: () => true,
            getRequiredValue: () => false,
            getReadonlyValue: () => false,
            getValidationErrors: () => 0,
            currentItemPath: '',
            engine: this
        };

        for (const route of screener.routes) {
            const lexResult = FelLexer.tokenize(route.condition);
            parser.input = lexResult.tokens;
            const cst = parser.expression();
            if (parser.errors.length > 0) continue;

            try {
                const result = interpreter.evaluate(cst, screenerContext);
                if (result) {
                    const out: { target: string; label?: string; extensions?: Record<string, any> } = { target: route.target };
                    if (route.label !== undefined) out.label = route.label;
                    if (route.extensions !== undefined) out.extensions = route.extensions;
                    return out;
                }
            } catch {
                continue;
            }
        }
        return null;
    }

    /**
     * Applies version migrations to response data, transforming it from `fromVersion` to the current definition version.
     * Supports rename, remove, add, and FEL-based transform operations as defined in the definition's `migrations` array.
     * @param responseData - The response data object to migrate.
     * @param fromVersion - The version string the response data was created against.
     * @returns The migrated response data.
     */
    public migrateResponse(responseData: Record<string, any>, fromVersion: string): Record<string, any> {
        const migrations = this.definition.migrations;
        if (!migrations || !Array.isArray(migrations)) return responseData;

        // Sort migrations by fromVersion, apply those >= fromVersion
        const applicable = migrations.filter(m => m.fromVersion >= fromVersion);
        applicable.sort((a: any, b: any) => a.fromVersion.localeCompare(b.fromVersion));

        let data = { ...responseData };
        for (const migration of applicable) {
            if (!migration.changes) continue;
            for (const change of migration.changes) {
                switch (change.type) {
                    case 'rename':
                        if (data[change.from] !== undefined) {
                            data[change.to] = data[change.from];
                            delete data[change.from];
                        }
                        break;
                    case 'remove':
                        delete data[change.path];
                        break;
                    case 'add':
                        if (data[change.path] === undefined) {
                            data[change.path] = change.default;
                        }
                        break;
                    case 'transform':
                        if (data[change.path] !== undefined && change.expression) {
                            data[change.path] = this.evaluateMigrationExpression(change.expression, data);
                        }
                        break;
                }
            }
        }
        return data;
    }
}

/** A node in the component tree describing which UI component to render, with optional binding, conditional visibility, and children. */
export interface ComponentObject {
    component: string;
    bind?: string;
    when?: string;
    style?: Record<string, any>;
    children?: ComponentObject[];
    [key: string]: any;
}

/**
 * A Formspec Component Document that defines the UI component tree, breakpoints, tokens,
 * and custom component specifications for rendering a specific definition.
 */
export interface ComponentDocument {
    $formspecComponent: string;
    version: string;
    targetDefinition: {
        url: string;
        compatibleVersions?: string;
    };
    url?: string;
    name?: string;
    title?: string;
    description?: string;
    breakpoints?: Record<string, number>;
    tokens?: Record<string, any>;
    components?: Record<string, any>;
    tree: ComponentObject;
}
