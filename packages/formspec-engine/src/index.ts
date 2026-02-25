import { signal, computed, effect, Signal } from '@preact/signals-core';
import { FelLexer } from './fel/lexer';
import { parser } from './fel/parser';
import { interpreter, FelContext } from './fel/interpreter';
import { dependencyVisitor } from './fel/dependency-visitor';

export { assembleDefinition, assembleDefinitionSync } from './assembler';
export type { AssemblyProvenance, AssemblyResult, DefinitionResolver } from './assembler';
export { RuntimeMappingEngine } from './runtime-mapping';
export type { MappingDirection, RuntimeMappingResult } from './runtime-mapping';

export interface FormspecItem {
    key: string;
    type: "field" | "group" | "display";
    label: string;
    dataType?: "string" | "text" | "integer" | "decimal" | "number" | "boolean" | "date" | "dateTime" | "time" | "uri" | "attachment" | "choice" | "multiChoice" | "money";
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

export interface FormspecOption {
    value: string;
    label: string;
}

export interface RemoteOptionsState {
    loading: boolean;
    error: string | null;
}

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

export interface FormspecVariable {
    name: string;
    expression: string;
    scope?: string; // item key or "#" for definition-wide (default)
}

export interface FormspecInstance {
    description?: string;
    source?: string;
    static?: boolean;
    data?: any;
    schema?: Record<string, string>;
    readonly?: boolean;
}

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
    screener?: { routes: Array<{ condition?: string; target: string; label?: string }> };
    migrations?: Array<{ fromVersion: string; changes: Array<{ type: string; [key: string]: any }> }>;
    [key: string]: any;
}

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

export type EngineNowInput = Date | string | number;

export interface FormEngineRuntimeContext {
    now?: (() => EngineNowInput) | EngineNowInput;
    locale?: string;
    timeZone?: string;
    seed?: string | number;
}

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

export type EngineReplayEvent =
    | { type: 'setValue'; path: string; value: any }
    | { type: 'addRepeatInstance'; path: string }
    | { type: 'removeRepeatInstance'; path: string; index: number }
    | { type: 'evaluateShape'; shapeId: string }
    | { type: 'getValidationReport'; mode?: 'continuous' | 'submit' }
    | { type: 'getResponse'; mode?: 'continuous' | 'submit' };

export interface EngineReplayApplyResult {
    ok: boolean;
    event: EngineReplayEvent;
    output?: any;
    error?: string;
}

export interface EngineReplayResult {
    applied: number;
    results: EngineReplayApplyResult[];
    errors: Array<{
        index: number;
        event: EngineReplayEvent;
        error: string;
    }>;
}

export class FormEngine {
    private definition: FormspecDefinition;
    public signals: Record<string, any> = {};
    public relevantSignals: Record<string, Signal<boolean>> = {};
    public requiredSignals: Record<string, Signal<boolean>> = {};
    public readonlySignals: Record<string, Signal<boolean>> = {};
    public errorSignals: Record<string, Signal<string | null>> = {};
    public validationResults: Record<string, Signal<ValidationResult[]>> = {};
    public shapeResults: Record<string, Signal<ValidationResult[]>> = {};
    public repeats: Record<string, Signal<number>> = {};
    public optionSignals: Record<string, Signal<FormspecOption[]>> = {};
    public optionStateSignals: Record<string, Signal<RemoteOptionsState>> = {};
    public variableSignals: Record<string, Signal<any>> = {};  // keyed by "scope:name"
    public instanceData: Record<string, any> = {};
    public dependencies: Record<string, string[]> = {};
    private knownNames: Set<string> = new Set();
    private bindConfigs: Record<string, FormspecBind> = {};
    private compiledExpressions: Record<string, () => any> = {};
    private remoteOptionsTasks: Array<Promise<void>> = [];
    private runtimeContext: {
        nowProvider: () => Date;
        locale?: string;
        timeZone?: string;
        seed?: string | number;
    } = {
        nowProvider: () => new Date(),
    };
    public structureVersion = signal(0);

    constructor(definition: FormspecDefinition, runtimeContext?: FormEngineRuntimeContext) {
        this.definition = definition;
        if (runtimeContext) {
            this.setRuntimeContext(runtimeContext);
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

    public getOptions(path: string): FormspecOption[] {
        const baseName = path.replace(/\[\d+\]/g, '');
        if (this.optionSignals[baseName]) {
            return this.optionSignals[baseName].value;
        }
        return [];
    }

    public getOptionsSignal(path: string): Signal<FormspecOption[]> | undefined {
        const baseName = path.replace(/\[\d+\]/g, '');
        return this.optionSignals[baseName];
    }

    public getOptionsState(path: string): RemoteOptionsState {
        const baseName = path.replace(/\[\d+\]/g, '');
        return this.optionStateSignals[baseName]?.value || { loading: false, error: null };
    }

    public getOptionsStateSignal(path: string): Signal<RemoteOptionsState> | undefined {
        const baseName = path.replace(/\[\d+\]/g, '');
        return this.optionStateSignals[baseName];
    }

    public async waitForRemoteOptions(): Promise<void> {
        if (this.remoteOptionsTasks.length === 0) return;
        await Promise.allSettled(this.remoteOptionsTasks);
    }

    private initializeInstances() {
        if (!this.definition.instances) return;
        for (const [name, inst] of Object.entries(this.definition.instances)) {
            if (inst.data !== undefined) {
                this.instanceData[name] = inst.data;
            }
        }
    }

    /**
     * Get data from a named instance, optionally at a path.
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
     * Returns the disabledDisplay mode for a field path.
     * "hidden" means the field wrapper should be display:none when non-relevant.
     * "protected" means the field should be visible but grayed out / disabled.
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

    /**
     * Resolve a variable by name using lexical scope lookup.
     * Searches from the given scope path upward to the global scope (#).
     */
    public getVariableValue(name: string, scopePath: string): any {
        // Try exact scope first, then walk up ancestors, then global
        const parts = scopePath.split('.');
        for (let i = parts.length; i >= 0; i--) {
            const scope = i === 0 ? '#' : parts.slice(0, i).join('.');
            const key = `${scope}:${name}`;
            if (this.variableSignals[key]) {
                return this.variableSignals[key].value;
            }
        }
        // Try global as fallback if scopePath was empty
        const globalKey = `#:${name}`;
        if (this.variableSignals[globalKey]) {
            return this.variableSignals[globalKey].value;
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
        if (!path) return "";
        return path.replace(/\[(\d+)\]/g, (_, p1) => `[${parseInt(p1) + 1}]`);
    }

    private initializeBindConfigs(items: FormspecItem[], prefix = '') {
        for (const item of items) {
            const fullName = prefix ? `${prefix}.${item.key}` : item.key;
            const relevant = item.relevant || item.visible;
            if (relevant || item.required || item.calculate || item.readonly || item.constraint) {
                this.bindConfigs[fullName] = {
                    path: fullName,
                    relevant: relevant,
                    required: item.required,
                    calculate: item.calculate,
                    readonly: item.readonly,
                    constraint: item.constraint,
                    constraintMessage: item.message
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
            this.relevantSignals[fullName] = computed(() => !!compiled());
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
                    this.signals[fullName] = computed(this.compileFEL(bind.calculate, fullName, undefined, false));
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
            const patternRegex = item.pattern ? new RegExp(item.pattern) : null;

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
                if (isRequired && (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0))) {
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
                    const isValid = !!compiledConstraint();
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
                if (patternRegex) {
                    if (!patternRegex.test(String(value ?? ''))) {
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
                return results;
            });

            this.errorSignals[fullName] = computed(() => {
                const res = this.validationResults[fullName].value;
                return res.length > 0 ? res[0].message : null;
            });
            
            // Default bind: apply default value on relevance transition
            if (bind?.default !== undefined) {
                let prevRelevant = this.relevantSignals[fullName]?.peek?.() ?? true;
                // Use a computed that watches relevance and applies default
                const defaultVal = bind.default;
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

    public addRepeatInstance(itemName: string) {
        const item = this.findItem(this.definition.items, itemName);
        if (item && item.repeatable) {
            const index = this.repeats[itemName].value;
            this.initRepeatInstance(item, itemName, index);
            this.repeats[itemName].value++;
            this.structureVersion.value++;
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

        this.clearRepeatSubtree(itemName);

        this.repeats[itemName].value = snapshots.length;
        for (let i = 0; i < snapshots.length; i++) {
            this.initRepeatInstance(item, itemName, i);
            this.applyGroupChildrenSnapshot(item.children, `${itemName}[${i}]`, snapshots[i]);
        }

        this.structureVersion.value++;
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

    public setValue(name: string, value: any) {
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

        // Precision enforcement
        if (bind?.precision !== undefined && typeof value === 'number' && !isNaN(value)) {
            const factor = Math.pow(10, bind.precision);
            value = Math.round(value * factor) / factor;
        }

        if (this.signals[name]) {
            this.signals[name].value = value;
        }
    }

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
     * Evaluate a specific demand-timing shape by ID.
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

    public getResponse(meta?: { id?: string; author?: { id: string; name?: string }; subject?: { id: string; type?: string }; mode?: 'continuous' | 'submit' }) {
        const data: any = {};
        const mode = meta?.mode || 'continuous';

        const defaultNRB = this.definition.nonRelevantBehavior || 'remove';

        for (const key of Object.keys(this.signals)) {
            const isRelevant = this.isPathRelevant(key);
            const baseName = key.replace(/\[\d+\]/g, '');
            const bind = this.bindConfigs[baseName];
            const nrb = bind?.nonRelevantBehavior || defaultNRB;

            if (!isRelevant) {
                if (nrb === 'remove') continue;
            }

            const parts = key.split(/[\[\]\.]/).filter(Boolean);
            let current = data;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const nextPart = parts[i+1];
                const isNextNumber = !isNaN(parseInt(nextPart));
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

    public getDefinition(): FormspecDefinition {
        return this.definition;
    }

    get formPresentation(): any {
        return this.definition.formPresentation || null;
    }

    private labelContext: string | null = null;

    public setLabelContext(context: string | null) {
        this.labelContext = context;
    }

    public getLabel(item: FormspecItem): string {
        if (this.labelContext && item.labels && item.labels[this.labelContext]) {
            return item.labels[this.labelContext];
        }
        return item.label;
    }

    public evaluateScreener(): { target: string; label?: string } | null {
        const screener = this.definition.screener;
        if (!screener?.routes) return null;
        for (const route of screener.routes) {
            if (!route.condition) {
                return { target: route.target, label: route.label };
            }
            const fn = this.compileFEL(route.condition, '');
            const result = fn();
            if (result) {
                return { target: route.target, label: route.label };
            }
        }
        return null;
    }

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
export interface ComponentObject {
    component: string;
    bind?: string;
    when?: string;
    style?: Record<string, any>;
    children?: ComponentObject[];
    [key: string]: any;
}

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
