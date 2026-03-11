# formspec-engine

Core form state management package for Formspec. Implements `FormEngine` — the central reactive engine that manages field values, MIP states (Model Item Properties: relevant/required/readonly), validation, repeatable groups, and FEL (Formspec Expression Language) expression evaluation.

**Runtime dependencies:** `@preact/signals-core ^1.6.0`, `chevrotain ^11.1.1`
**Entry point:** `dist/index.js` (ESM)
**Build:** `npm run build` (tsc → dist/)

---

## FormEngine Class

`packages/formspec-engine/src/index.ts`

```typescript
new FormEngine(definition: FormspecDefinition, runtimeContext?: FormEngineRuntimeContext)
```

### Constructor Initialization Order

1. Resolve `optionSet` references on items from `definition.optionSets`
2. Initialize option signals and option state signals for every field
3. Load inline instance data from `definition.instances`
4. Collect bind configs from inline item properties, then overlay explicit `definition.binds[]` entries (wildcard paths `[*]` stripped to base key)
5. Fire `fetch()` for any bind with `remoteOptions` URL
6. Walk all items, create value/MIP/validation signals; run cycle detection; increment `structureVersion`
7. Create reactive `computed` signals for `continuous`-timing shapes
8. Topological sort of `definition.variables`; create computed variable signals in dependency order

### Public Signal Properties

All signals are `@preact/signals-core` primitives. Read `.value` to get the current value; read inside a `computed()` or `effect()` to subscribe reactively.

| Property | Type | Description |
|---|---|---|
| `signals` | `Record<string, Signal<any>>` | Field value signals. Keys are dotted paths with 0-based indexed brackets (e.g., `items[0].name`). Writable `signal()` or read-only `computed()` for calculate binds. |
| `relevantSignals` | `Record<string, Signal<boolean>>` | Visibility per path. `true` by default; `computed` if bind has `relevant` FEL expression. |
| `requiredSignals` | `Record<string, Signal<boolean>>` | Required state per path. Static `signal` or `computed` if expression-based. |
| `readonlySignals` | `Record<string, Signal<boolean>>` | Readonly state per path. |
| `errorSignals` | `Record<string, Signal<string\|null>>` | First error message (or `null`) per field. Derived from `validationResults`. |
| `validationResults` | `Record<string, Signal<ValidationResult[]>>` | Full validation result arrays per path. Each result has `type`, `constraintKind`, `code`, `message`, `severity`. |
| `shapeResults` | `Record<string, Signal<ValidationResult[]>>` | Results per shape ID for `continuous`-timing shapes. |
| `repeats` | `Record<string, Signal<number>>` | Instance count per repeatable group path. |
| `optionSignals` | `Record<string, Signal<FormspecOption[]>>` | Options per field path (from inline options, optionSets, or remote fetch). |
| `optionStateSignals` | `Record<string, Signal<RemoteOptionsState>>` | `{ loading: boolean, error: string\|null }` for remote options. |
| `variableSignals` | `Record<string, Signal<any>>` | Variables keyed as `"scope:name"` (e.g., `"#:globalRate"`, `"order:localTax"`). All `computed`. |
| `instanceData` | `Record<string, any>` | Inline instance data keyed by instance name (not signals — plain objects). |
| `dependencies` | `Record<string, string[]>` | Dependency graph: field path → array of paths it depends on. |
| `structureVersion` | `Signal<number>` | Monotonically incrementing counter; bumped on add/remove repeat instances and initialization. All compiled FEL closures read this to trigger re-evaluation on structural changes. |

### Public Methods

#### Value Management

```typescript
setValue(name: string, value: any): void
```
Sets a field signal value. Applies: whitespace normalization (`trim`/`normalize`/`remove` per bind config), numeric coercion (string→number for integer/decimal/number dataTypes), precision rounding.

#### Definition & Metadata

```typescript
getDefinition(): FormspecDefinition
get formPresentation: any           // definition.formPresentation or null
getDisabledDisplay(path: string): 'hidden' | 'protected'
```

#### Options

```typescript
getOptions(path: string): FormspecOption[]
getOptionsSignal(path: string): Signal<FormspecOption[]> | undefined
getOptionsState(path: string): RemoteOptionsState
getOptionsStateSignal(path: string): Signal<RemoteOptionsState> | undefined
async waitForRemoteOptions(): Promise<void>
```
Path normalization: strips indexed brackets (`items[0].field` → `items.field`) before looking up signals.

#### Instance Data

```typescript
getInstanceData(name: string, path?: string): any
// path is dot-separated navigation into the instance object
```

#### Repeatable Groups

```typescript
addRepeatInstance(itemName: string): number | undefined
// Returns new 0-based index. Initializes all child signals. Increments structureVersion.

removeRepeatInstance(itemName: string, index: number): void
// Snapshot-clear-rebuild strategy:
// 1. Snapshot all instance values (deep clone)
// 2. Splice out the removed index
// 3. Delete all signals under itemName[
// 4. Re-initialize remaining instances
// 5. Restore snapshotted values
// 6. Increment structureVersion
// Silently no-ops for out-of-range indices.
```

#### Validation

```typescript
getValidationReport(options?: { mode?: 'continuous' | 'submit' }): ValidationReport
// Collects bind-level results (filtered by relevancy), continuous shape results,
// and (if mode='submit') evaluates submit-timing shapes.
// valid = true iff counts.error === 0 (warnings and info do not affect validity).

evaluateShape(shapeId: string): ValidationResult[]
// Evaluates a single shape by ID (for demand-timing shapes).
```

`ValidationReport`:
```typescript
{
  valid: boolean;
  results: ValidationResult[];
  counts: { error: number; warning: number; info: number };
  timestamp: string; // ISO 8601
}
```

`ValidationResult`:
```typescript
{
  path: string;        // External (1-based) path
  message: string;
  severity: 'error' | 'warning' | 'info';
  constraintKind: 'type' | 'required' | 'constraint' | 'minRepeat' | 'maxRepeat';
  code: string;        // TYPE_MISMATCH, REQUIRED, CONSTRAINT_FAILED, PATTERN_MISMATCH, MIN_REPEAT, MAX_REPEAT
  context?: Record<string, any>;
  constraintMessage?: string;
}
```

#### Expression Compilation

```typescript
compileExpression(expression: string, currentItemName?: string): () => any
// Returns a reactive closure. When called inside a computed(), auto-subscribes
// to all referenced field signals. Used by the webcomponent for ad-hoc expressions.
```

#### Variables

```typescript
getVariableValue(name: string, scopePath: string): any
// Lexical scope lookup: walks from scopePath upward through ancestors to global
// scope ('#'), returning the first matching variable signal's value.
```

#### Labels / i18n

```typescript
setLabelContext(context: string | null): void  // e.g., 'es', 'fr'
getLabel(item: FormspecItem): string            // Returns locale label or item.label fallback
```

#### Screener

```typescript
evaluateScreener(): { target: string; label?: string } | null
// Evaluates definition.screener.routes in order.
// Returns first route with truthy condition (or no condition). Null if none match.
```

#### Migration

```typescript
migrateResponse(responseData: Record<string, any>, fromVersion: string): Record<string, any>
// Applies definition.migrations filtered to fromVersion >= migration.fromVersion, sorted ascending.
// Change types: rename (from/to), remove (path), add (path + default), transform (FEL expression).
```

#### Runtime Context

```typescript
setRuntimeContext(context: FormEngineRuntimeContext): void
// context: { now?, locale?, timeZone?, seed? }
// now: Date | string | number | (() => Date | string | number)
```

#### Diagnostics

```typescript
getDiagnosticsSnapshot(options?: { mode?: 'continuous' | 'submit' }): FormEngineDiagnosticsSnapshot
// Returns: definition metadata, all signal values, all MIP states, repeat counts,
// dependency graph, full validation report, runtime context.
```

#### Replay

```typescript
applyReplayEvent(event: EngineReplayEvent): EngineReplayApplyResult
// Event types: setValue, addRepeatInstance, removeRepeatInstance,
//              evaluateShape, getValidationReport, getResponse
// Returns: { ok, event, output?, error? }

replay(events: EngineReplayEvent[], options?: { stopOnError?: boolean }): EngineReplayResult
// Returns: { applied, results, errors }
```

#### Response Generation

```typescript
getResponse(meta?: { id?, author?, subject?, mode? }): object
// Returns full response object:
// { definitionUrl, definitionVersion, status, data, validationResults, authored }
// status: 'completed' if valid, 'in-progress' otherwise
// Non-relevant fields handled per nonRelevantBehavior (remove | empty | keep)
//   - remove: omit from data (default)
//   - empty: set to null
//   - keep: preserve value
```

---

## FEL Pipeline

`packages/formspec-engine/src/fel/`

### Lexer (`lexer.ts`)

Chevrotain `Lexer` with 38 token types. Key tokens:
- **Keywords:** `True`, `False`, `Null`, `And`, `Or`, `Not`, `In`, `If`, `Then`, `Else`, `Let`
- **Literals:** `StringLiteral` (single/double quoted), `NumberLiteral`, `DateTimeLiteral` (`@YYYY-MM-DDTHH:MM:SSZ`), `DateLiteral` (`@YYYY-MM-DD`)
- **Special:** `Dollar` (`$`), `At` (`@`), `DoubleQuestion` (`??`), `Ampersand` (`&` string concat)
- **Skipped:** `WhiteSpace`, line comments (`//`), block comments (`/* */`)

### Parser (`parser.ts`)

Singleton `FelParser extends CstParser`. Produces CST via `parser.expression()`.

**Operator precedence** (lowest → highest):
1. `let x = ... in ...`
2. `if ... then ... else ...`
3. Ternary `? :`
4. `or`
5. `and`
6. `=` / `!=`
7. `<` / `>` / `<=` / `>=`
8. `in` / `not in`
9. `??` (null coalesce)
10. `+` / `-` / `&`
11. `*` / `/` / `%`
12. Unary `not` / `-`
13. Postfix `.field` / `[n]` / `[*]`
14. Atoms (literals, field refs, function calls, parens)

`if(...)` is parsed as `FunctionCall('if', ...)`. `if ... then ... else` is the keyword form (disambiguated by lookahead scanning for `then`).

### Interpreter (`interpreter.ts`)

Singleton `FelInterpreter extends BaseVisitor`. Evaluates CST nodes given a `FelContext`.

```typescript
export interface FelContext {
  getSignalValue: (path: string) => any;
  getRepeatsValue: (path: string) => number;
  getRelevantValue: (path: string) => boolean;
  getRequiredValue: (path: string) => boolean;
  getReadonlyValue: (path: string) => boolean;
  getValidationErrors: (path: string) => number;
  currentItemPath: string;
  engine: any;
}
```

**Field Reference Resolution:**
- `$` (bare) → value at `currentItemPath` (self-reference)
- `$name` or `$name.path` → resolves relative to parent of `currentItemPath`, falls back to absolute
- `@index` → 1-based index within enclosing repeat group
- `@current` → value at `currentItemPath`
- `@count` → total instances of enclosing repeat group
- `@variableName` → `engine.getVariableValue(name, currentItemPath)`

**Aggregate fan-out:** When `getSignalValue` doesn't find a direct signal, it checks whether the path traverses a repeatable group and fans out into an array of all leaf values (enables `sum(items.amount)` without explicit `[*]`).

**Standard Library (44+ functions):**

| Category | Functions |
|---|---|
| Aggregates | `sum`, `count`, `avg`, `min`, `max`, `countWhere(arr, predicate)` |
| String | `upper`, `lower`, `trim`, `length`, `contains`, `startsWith`, `endsWith`, `substring`, `replace`, `matches`, `format` |
| Math | `abs`, `power`, `round`, `floor`, `ceil` |
| Date/Time | `today`, `now`, `year`, `month`, `day`, `hours`, `minutes`, `seconds`, `dateAdd`, `dateDiff`, `time`, `timeDiff` |
| Logical | `coalesce`, `isNull`, `present`, `empty`, `if` |
| Type-check | `isNumber`, `isString`, `isDate`, `typeOf` |
| Cast | `string`, `number`, `boolean`, `date` |
| Choice | `selected(val, opt)` |
| Money | `money`, `moneyAmount`, `moneyCurrency`, `moneyAdd`, `moneySum` |
| Navigation | `prev(name)`, `next(name)`, `parent(name)` |
| MIP Query | `valid(path)`, `relevant(path)`, `readonly(path)`, `required(path)` |
| Instance | `instance(name, path?)` |

`countWhere(arr, predicate)` evaluates the predicate per-element with `$` rebound to each element. MIP query functions extract the path from CST tokens rather than evaluating it as a value.

### Dependency Visitor (`dependency-visitor.ts`)

Singleton `FelDependencyVisitor`. Walks CST and returns de-duplicated dependency paths.

```typescript
getDependencies(cst: any): string[]
```

Used by `compileFEL` to populate `this.dependencies[baseCurrentItemName]` and to ensure all referenced signals are read inside the compiled closure (triggering reactive updates).

### compileFEL Internal

```typescript
private compileFEL(
  expression: string,
  currentItemName: string,
  index?: number,
  includeSelf?: boolean
): () => any
```

Returns a closure cached by `expression|currentItemName|includeSelf`. When called:
1. Reads `structureVersion.value` (triggers re-eval on structural changes)
2. Reads all dependency signal values (triggers re-eval when deps change)
3. Constructs `FelContext` bridging to engine signals
4. Calls `interpreter.evaluate(cst, context)`

---

## Path Resolution

- **Simple:** `fieldName`
- **Dotted:** `group.child.field`
- **Indexed (internal):** `group[0].field` (0-based)
- **Indexed (external/ValidationResult):** `group[1].field` (1-based, via `toExternalPath()`)
- **Wildcard (binds/shapes):** `items[*].field` → expanded via `resolveWildcardPath` to concrete indexed paths

`resolveWildcardPath(path)` recursively expands `[*]` using repeat counts. Handles nested wildcards.

`isPathRelevant(path)` walks each path segment incrementally, checking `relevantSignals` at each level. If any ancestor is non-relevant, the entire path is non-relevant.

**baseKey normalization:** `path.replace(/\[\d+\]/g, '')` strips instance indices to look up bind configs and options defined once for all instances.

---

## Validation Logic

### Bind-Level (Field) Validation

`validationResults[fullName]` is a `computed` that checks in order:
1. **Type validation** — integer, decimal, boolean, date (`YYYY-MM-DD`), dateTime, time (`HH:MM`), uri. Code: `TYPE_MISMATCH`.
2. **Required** — null/undefined/empty-string/empty-array when `requiredSignals[path]` is true. Code: `REQUIRED`.
3. **Constraint expression** — compiled FEL; falsy = failure. Code: `CONSTRAINT_FAILED`.
4. **Pattern** — regex test on value if item has `pattern`. Code: `PATTERN_MISMATCH`.

Cardinality checks on repeatable groups against `minRepeat`/`maxRepeat`. Codes: `MIN_REPEAT`, `MAX_REPEAT`.

### Shape Rules (Cross-Field)

Each shape in `definition.shapes[]`:
- `id`, `target` (path or `"#"` form-level, supports wildcards), `severity` (`error`|`warning`|`info`)
- `timing`: `continuous` (reactive computed), `submit` (only in `getValidationReport({mode:'submit'})`), `demand` (only via `evaluateShape(id)`)
- `activeWhen`: FEL guard — shape skipped if falsy
- `message`: failure message (supports `{{expr}}` interpolation)
- `context`: `Record<string, string>` of FEL expressions evaluated on failure

**Composition operators** in `evaluateShapeConstraints`:
- `constraint`: single FEL (must be truthy)
- `and`: all must be truthy
- `or`: at least one must be truthy
- `not`: must be falsy
- `xone`: exactly one must be truthy

---

## Definition Assembler

`packages/formspec-engine/src/assembler.ts`

Resolves `$ref` inclusions in definitions (publish-time assembly). Produces a self-contained definition with all external references inlined.

```typescript
// $ref URI format: "url|version#fragment"
// fragment = single item key to extract; omit for full definition

async function assembleDefinition(
  definition: FormspecDefinition,
  resolver: (url: string, version?: string) => FormspecDefinition | Promise<FormspecDefinition>
): Promise<AssemblyResult>

function assembleDefinitionSync(
  definition: FormspecDefinition,
  resolver: (url: string, version?: string) => FormspecDefinition
): AssemblyResult

interface AssemblyResult {
  definition: FormspecDefinition;
  assembledFrom: AssemblyProvenance[];
}
```

### Assembly Pipeline

For each group item with `$ref`, the assembler:

1. **Resolves** — fetches the referenced definition via the resolver
2. **Selects fragment** — if `#fragment` specified, extracts the matching top-level item
3. **Prefixes keys** — applies `keyPrefix` to all imported item keys recursively
4. **Rewrites bind paths** — scopes imported bind `path` values under the host group
5. **Rewrites shape targets** — same scoping for shape `target` values
6. **Rewrites FEL expressions** — updates `$`-prefixed path references in all FEL-bearing properties
7. **Imports variables** — brings in referenced definition's variables with rewritten expressions/scopes
8. **Detects collisions** — throws on key collisions and variable name collisions
9. **Handles shape ID collisions** — auto-prefixes with group key; updates composition references
10. **Records provenance** — appends to `assembledFrom` array
11. **Recurses** — resolves any nested `$ref` items within the imported subtree

### FEL Path Rewriting

```typescript
// Exported for direct use / testing
function rewriteFEL(expression: string, map: RewriteMap): string
function rewriteMessageTemplate(message: string, map: RewriteMap): string

interface RewriteMap {
  fragmentRootKey: string;   // e.g. "budget"
  hostGroupKey: string;      // e.g. "projectBudget"
  importedKeys: Set<string>; // all keys in the fragment subtree
  keyPrefix: string;         // e.g. "proj_"
}
```

`rewriteFEL` transforms path references in FEL expression strings:

| Reference type | Example | Rewritten to |
|---|---|---|
| Fragment root path | `$budget.totalDirect` | `$projectBudget.proj_totalDirect` |
| Imported key path | `$budget.lineItems[*].amount` | `$projectBudget.proj_lineItems[*].proj_amount` |
| `@current.field` | `@current.amount` | `@current.proj_amount` |
| `prev/next/parent('field')` | `prev('runningTotal')` | `prev('proj_runningTotal')` |
| Bare `$` (current-node) | `$ >= 0` | unchanged |
| External paths | `$externalField` | unchanged |
| Context vars (`@index`, `@count`) | `@index > 0` | unchanged |
| Variable refs (`@name`) | `@budgetComplete` | unchanged |
| `@instance(...)` | `@instance('data').field` | unchanged |

**Properties rewritten during assembly:**

- **Binds:** `calculate`, `constraint`, `relevant`, `readonly`, `required` (FEL strings), `default` (when string starting with `=`, the `=` prefix is preserved)
- **Shapes:** `constraint`, `activeWhen` (FEL strings), `context` values (each is FEL), `message` (FEL inside `{{...}}` interpolation), `and[]`/`or[]`/`xone[]` entries and `not` (inline FEL rewritten; shape ID references use rename map)
- **Variables:** `expression` (FEL), `scope` (item key — uses key rename, not FEL rewriting)

### Error Detection

- **Circular `$ref`**: throws `"Circular $ref detected: url|version"`
- **Key collision**: throws `"Key collision after assembly: "path" already exists in host definition"`
- **Fragment not found**: throws `"Fragment key "name" not found in referenced definition url"`
- **Variable name collision**: throws `"Variable name collision during assembly: "name" already exists in host definition"`

---

## RuntimeMappingEngine

`packages/formspec-engine/src/runtime-mapping.ts`

Bidirectional data mapping, independent of `FormEngine`.

```typescript
class RuntimeMappingEngine {
  constructor(mappingDocument: any)
  forward(source: any): RuntimeMappingResult
  reverse(source: any): RuntimeMappingResult
}
```

Rules sorted by `priority` (descending). Transform types: `preserve`, `valueMap`, `coerce` (`number`|`string`|`boolean`), `constant`, `drop`. Condition guards: `"source.path = literal"` or `"source.path != literal"`. Reverse uses `targetPath→sourcePath` with optional `rule.reverse` overrides.

---

## Key Types

```typescript
interface FormspecItem {
  key: string;
  type: 'field' | 'group' | 'section' | ...;
  dataType?: string;
  label?: string;
  options?: FormspecOption[];
  optionSet?: string;
  repeatable?: boolean;
  minRepeat?: number;
  maxRepeat?: number;
  pattern?: string;
  presentation?: any;
  // inline bind shorthand:
  relevant?: string;
  required?: string | boolean;
  calculate?: string;
  readonly?: string | boolean;
  constraint?: string;
  constraintMessage?: string;
  default?: any;
  nonRelevantBehavior?: 'remove' | 'empty' | 'keep';
}

interface FormspecBind {
  path: string;         // supports [*] wildcards
  relevant?: string;
  required?: string | boolean;
  calculate?: string;
  readonly?: string | boolean;
  constraint?: string;
  constraintMessage?: string;
  default?: any;
  nonRelevantBehavior?: 'remove' | 'empty' | 'keep';
  remoteOptions?: { url: string; ... };
  whitespace?: 'trim' | 'normalize' | 'remove';
  precision?: number;
}

interface FormspecOption {
  value: string;
  label: string;
}

interface RemoteOptionsState {
  loading: boolean;
  error: string | null;
}

interface FormEngineRuntimeContext {
  now?: Date | string | number | (() => Date | string | number);
  locale?: string;
  timeZone?: string;
  seed?: number;
}
```

---

## Reactive Signals Pattern

Three `@preact/signals-core` primitives:

- **`signal(value)`** — writable container. Used for: field values (no calculate), static MIP states, repeat counts, option signals, `structureVersion`.
- **`computed(fn)`** — read-only derived. Used for: calculated field values, FEL-based MIP states, validation results, error signals, variable signals.
- **`effect(fn)`** — side-effect. Used for: applying `bind.default` values on relevance transitions.

All reactive wiring happens inside `compileFEL` closures: the closure reads `structureVersion.value` and all dependency signals' `.value`, ensuring Preact's tracking captures every dependency when the closure is used inside a `computed`.

---

## Tests

20 test files in `tests/`, using Node.js built-in test runner (`node:test`, `.mjs` files):

- `bind-behaviors` — whitespace normalization, precision, nonRelevantBehavior, optionSets
- `bind-defaults-and-expression-context` — defaults on relevance, compileExpression, variable lookup
- `definition-assembly` / `assembler-async` — sync/async assembly, fragments, keyPrefix, circular refs
- `assembler-fel-rewrite` — rewriteFEL unit tests: `$path` rewriting, `@current.path`, `prev/next/parent('field')`, bare `$`, external paths, `@index`/`@count`/`@instance`, `#:varName`, indexed/wildcard paths, literals
- `assembler-bind-fel` — bind FEL integration: calculate, constraint, relevant, readonly, required rewriting; `=`-prefixed default; literal default passthrough; bare `$` constraint
- `assembler-shape-fel` — shape FEL integration: constraint, activeWhen, context values, `{{...}}` message templates, composition operators (and/or/xone/not), shape ID vs inline FEL disambiguation, collision rename tracking
- `assembler-variable-import` — variable import: expression rewriting, scope rewriting, `#` scope passthrough, name collision detection, fragment scope filtering
- `assembler-integration` — full integration: budget template end-to-end, double import with different prefixes, nested `$ref` recursive FEL rewriting
- `fel-completeness-and-variables` — valid() reactivity, @count/@index, countWhere, scoped variables, cycle detection
- `fel-cast-functions` — boolean(), date(), time() casting
- `instances-and-prepopulation` — instance data, instance() FEL, prePopulate, readonly composition
- `shape-composition-and-timing` — and/or/not/xone, shape context, submit/demand timing
- `shape-active-and-severity` — activeWhen guard, warning/info severity
- `response-contract-and-pruning` — NRB modes, deep group pruning, response metadata
- `repeat-lifecycle-and-response-metadata` — remove-with-shift, nested repeat removal, NRB
- `extended-engine-features` — formPresentation, screener, i18n, migration
- `runtime-diagnostics-and-replay` — now provider, diagnostics snapshots, replay
- `runtime-mapping` — forward/reverse, valueMap, coerce, condition, drop
- `remote-options` — fetch, fallback on failure, error state tracking
