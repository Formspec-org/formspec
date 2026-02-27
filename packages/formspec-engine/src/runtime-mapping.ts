/** The direction of a mapping operation: `"forward"` maps Formspec data to an external format, `"reverse"` maps back. */
export type MappingDirection = 'forward' | 'reverse';

/** The result of executing a mapping operation, including the transformed output, rule count, and any diagnostics. */
export interface RuntimeMappingResult {
    direction: MappingDirection;
    output: any;
    appliedRules: number;
    diagnostics: string[];
}

/** Internal representation of a single mapping rule with source/target paths, transform type, and optional reverse override. */
type MappingRule = {
    sourcePath?: string | null;
    targetPath?: string | null;
    transform?: string;
    expression?: string;
    coerce?: any;
    valueMap?: Record<string, any>;
    condition?: string;
    reverse?: Partial<MappingRule>;
    priority?: number;
    reversePriority?: number;
};

/** Splits a dot-separated path string into an array of segments, filtering out empty parts. */
function splitPath(path: string): string[] {
    if (!path) return [];
    return path.split('.').filter(Boolean);
}

/** Navigates into a nested object by a dot-separated path, returning `undefined` if any segment is missing. */
function getByPath(obj: any, path?: string | null): any {
    if (!path) return undefined;
    const parts = splitPath(path);
    let current = obj;
    for (const part of parts) {
        if (current == null) return undefined;
        current = current[part];
    }
    return current;
}

/** Sets a value in a nested object at a dot-separated path, creating intermediate objects as needed. */
function setByPath(obj: any, path: string, value: any): void {
    const parts = splitPath(path);
    if (parts.length === 0) return;
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] == null || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
}

/** Parses a simple literal value from a string: quoted strings, booleans, null, or numbers. Falls back to the raw string. */
function parseSimpleLiteral(expression: string): any {
    const trimmed = expression.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) return asNum;
    return trimmed;
}

/** Evaluates a simple condition string against the source object. Supports `source.path = literal`, `source.path != literal`, and boolean literals. */
function evaluateCondition(condition: string, source: any): boolean {
    // Supported forms:
    // - source.path = literal
    // - source.path != literal
    // - true / false
    const trimmed = condition.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    const match = trimmed.match(/^source\.([a-zA-Z0-9_.]+)\s*(=|!=)\s*(.+)$/);
    if (!match) return true;
    const [, path, op, rhsRaw] = match;
    const left = getByPath(source, path);
    const right = parseSimpleLiteral(rhsRaw);
    return op === '=' ? left === right : left !== right;
}

/** Deep-clones a value using structuredClone (if available) or JSON round-trip as fallback. */
function clone<T>(value: T): T {
    if (value === null || value === undefined || typeof value !== 'object') return value;
    const cloner = (globalThis as any).structuredClone;
    if (typeof cloner === 'function') {
        return cloner(value);
    }
    return JSON.parse(JSON.stringify(value));
}

/**
 * Bidirectional data transform engine driven by a Formspec mapping document.
 *
 * Rules are priority-ordered and support conditions, transform types (drop, constant, valueMap,
 * coerce, preserve), and per-rule reverse overrides. Forward mapping transforms Formspec response
 * data into an external format; reverse mapping transforms external data back into Formspec shape.
 */
export class RuntimeMappingEngine {
    private readonly doc: any;
    private readonly rules: MappingRule[];

    /**
     * Creates a RuntimeMappingEngine from a mapping document.
     * @param mappingDocument - The mapping document containing rules, defaults, and metadata.
     */
    constructor(mappingDocument: any) {
        this.doc = mappingDocument || {};
        this.rules = Array.isArray(this.doc.rules) ? this.doc.rules : [];
    }

    /**
     * Executes a forward mapping: transforms Formspec response data into an external format.
     * Applies document defaults before processing rules.
     * @param source - The Formspec response data to transform.
     */
    public forward(source: any): RuntimeMappingResult {
        return this.execute('forward', source ?? {});
    }

    /**
     * Executes a reverse mapping: transforms external-format data back into Formspec response shape.
     * Uses each rule's `reverse` override when available, otherwise swaps source/target paths.
     * @param source - The external-format data to transform.
     */
    public reverse(source: any): RuntimeMappingResult {
        return this.execute('reverse', source ?? {});
    }

    private execute(direction: MappingDirection, source: any): RuntimeMappingResult {
        const output: any = {};
        const diagnostics: string[] = [];
        let appliedRules = 0;

        if (direction === 'forward' && this.doc.defaults && typeof this.doc.defaults === 'object') {
            for (const [path, value] of Object.entries(this.doc.defaults)) {
                setByPath(output, path, clone(value));
            }
        }

        const sortedRules = [...this.rules].sort((a, b) => {
            const ap = direction === 'forward' ? (a.priority ?? 0) : (a.reversePriority ?? a.priority ?? 0);
            const bp = direction === 'forward' ? (b.priority ?? 0) : (b.reversePriority ?? b.priority ?? 0);
            return bp - ap;
        });

        for (const rule of sortedRules) {
            if (rule.condition && !evaluateCondition(rule.condition, source)) {
                continue;
            }

            const effective = direction === 'reverse' && rule.reverse
                ? { ...rule, ...rule.reverse }
                : rule;

            const sourcePath = direction === 'forward'
                ? effective.sourcePath
                : (effective.targetPath ?? rule.targetPath);
            const targetPath = direction === 'forward'
                ? effective.targetPath
                : (effective.sourcePath ?? rule.sourcePath);

            const transform = effective.transform || 'preserve';
            if (!targetPath) {
                if (transform !== 'drop') {
                    diagnostics.push(`Rule skipped because targetPath is missing (${transform})`);
                }
                continue;
            }

            let value = getByPath(source, sourcePath);
            if (transform === 'drop') {
                continue;
            }

            if (transform === 'constant') {
                value = parseSimpleLiteral(String(effective.expression ?? 'null'));
            } else if (transform === 'valueMap') {
                const map = effective.valueMap || {};
                if (value !== undefined && value !== null && map[String(value)] !== undefined) {
                    value = map[String(value)];
                }
            } else if (transform === 'coerce') {
                const kind = typeof effective.coerce === 'string' ? effective.coerce : effective.coerce?.type;
                if (kind === 'number') {
                    value = value == null ? null : Number(value);
                } else if (kind === 'string') {
                    value = value == null ? null : String(value);
                } else if (kind === 'boolean') {
                    value = Boolean(value);
                } else {
                    diagnostics.push(`Unsupported coerce type: ${String(kind)}`);
                }
            } else if (transform !== 'preserve') {
                diagnostics.push(`Unsupported transform: ${transform}`);
                continue;
            }

            if (value === undefined) continue;
            setByPath(output, targetPath, clone(value));
            appliedRules += 1;
        }

        return {
            direction,
            output,
            appliedRules,
            diagnostics,
        };
    }
}
