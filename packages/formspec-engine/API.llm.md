# formspec-engine — API Reference

*Auto-generated from TypeScript declarations — do not hand-edit.*

Core form state management engine. Parses a FormspecDefinition and builds a reactive signal network for field values, relevance, validation, repeat groups, computed variables, and response serialization. Includes FEL expression compilation, definition assembly, and bidirectional runtime mapping.

#### interface `FormspecItem`

A single item in a Formspec definition tree: a field (data-bearing), group (container), or display (read-only content).

- **key**: `string`
- **type**: `"field" | "group" | "display"`
- **label**: `string`
- **dataType?**: `"string" | "text" | "integer" | "decimal" | "number" | "boolean" | "date" | "dateTime" | "time" | "uri" | "attachment" | "choice" | "multiChoice" | "money"`
- **currency?**: `string`
- **description?**: `string`
- **hint?**: `string`
- **repeatable?**: `boolean`
- **minRepeat?**: `number`
- **maxRepeat?**: `number`
- **children?**: `FormspecItem[]`
- **options?**: `{
        value: string;
        label: string;
    }[]`
- **optionSet?**: `string`
- **initialValue?**: `any`
- **presentation?**: `any`
- **prePopulate?**: `{
        instance: string;
        path: string;
        editable?: boolean;
    }`
- **labels?**: `Record<string, string>`
- **relevant?**: `string`
- **required?**: `string | boolean`
- **calculate?**: `string`
- **readonly?**: `string | boolean`
- **constraint?**: `string`
- **message?**: `string`

#### interface `FormspecBind`

A bind configuration that attaches FEL-driven logic (relevance, required, calculate, readonly, constraint) to a field path.

- **path**: `string`
- **relevant?**: `string`
- **required?**: `string | boolean`
- **calculate?**: `string`
- **readonly?**: `string | boolean`
- **constraint?**: `string`
- **constraintMessage?**: `string`
- **default?**: `any`
- **whitespace?**: `'preserve' | 'trim' | 'normalize' | 'remove'`
- **excludedValue?**: `'preserve' | 'null'`
- **nonRelevantBehavior?**: `'remove' | 'empty' | 'keep'`
- **disabledDisplay?**: `'hidden' | 'protected'`
- **precision?**: `number`
- **remoteOptions?**: `string`

#### interface `FormspecOption`

A selectable option for choice/multiChoice fields, consisting of a machine-readable value and a display label.

- **value**: `string`
- **label**: `string`

#### interface `RemoteOptionsState`

Loading/error state for a field whose options are fetched from a remote URL via the `remoteOptions` bind.

- **loading**: `boolean`
- **error**: `string | null`

#### interface `FormspecShape`

A cross-field validation rule evaluated against one or more target paths.
Shapes support composition operators (and/or/not/xone) and timing modes (continuous, submit, demand).

- **id**: `string`
- **target**: `string`
- **severity?**: `"error" | "warning" | "info"`
- **constraint?**: `string`
- **message**: `string`
- **code?**: `string`
- **activeWhen?**: `string`
- **timing?**: `"continuous" | "submit" | "demand"`
- **and?**: `string[]`
- **or?**: `string[]`
- **not?**: `string`
- **xone?**: `string[]`
- **context?**: `Record<string, string>`

#### interface `FormspecVariable`

A named computed variable defined by a FEL expression, scoped to a specific item or the entire definition ('#').

- **name**: `string`
- **expression**: `string`
- **scope?**: `string`

#### interface `FormspecInstance`

A named data instance that provides external data for pre-population and FEL `instance()` lookups.

- **description?**: `string`
- **source?**: `string`
- **static?**: `boolean`
- **data?**: `any`
- **schema?**: `Record<string, string>`
- **readonly?**: `boolean`

#### interface `FormspecDefinition`

The top-level Formspec definition document describing a complete form.
Contains the item tree, bind constraints, shape rules, variables, instances, option sets,
and optional screener/migration/presentation configuration.

- **$formspec**: `string`
- **url**: `string`
- **version**: `string`
- **title**: `string`
- **items**: `FormspecItem[]`
- **binds?**: `FormspecBind[]`
- **shapes?**: `FormspecShape[]`
- **variables?**: `FormspecVariable[]`
- **instances?**: `Record<string, FormspecInstance>`
- **optionSets?**: `Record<string, FormspecOption[]>`
- **nonRelevantBehavior?**: `'remove' | 'empty' | 'keep'`
- **formPresentation?**: `any`
- **screener?**: `{
        items: FormspecItem[];
        routes: Array<{
            condition: string;
            target: string;
            label?: string;
            extensions?: Record<string, any>;
        }>;
        extensions?: Record<string, any>;
    }`
- **migrations?**: `Array<{
        fromVersion: string;
        changes: Array<{
            type: string;
            [key: string]: any;
        }>;
    }>`

#### interface `ValidationResult`

A single validation finding (error, warning, or info) targeting a specific field path.

- **severity**: `"error" | "warning" | "info"`
- **path**: `string`
- **message**: `string`
- **constraintKind**: `"required" | "type" | "cardinality" | "constraint" | "shape" | "external"`
- **code**: `string`
- **source?**: `"bind" | "shape"`
- **shapeId?**: `string`
- **constraint?**: `string`
- **context?**: `Record<string, any>`

#### interface `ValidationReport`

Aggregated validation output for the entire form, including all bind-level and shape-level results.
A report is `valid` when it contains zero errors; warnings and infos do not affect validity.

- **valid**: `boolean`
- **results**: `ValidationResult[]`
- **counts**: `{
        error: number;
        warning: number;
        info: number;
    }`
- **timestamp**: `string`

#### interface `FormEngineRuntimeContext`

Runtime configuration injected into the engine to control time, locale, timezone, and deterministic seeding.

- **now?**: `(() => EngineNowInput) | EngineNowInput`
- **locale?**: `string`
- **timeZone?**: `string`
- **seed?**: `string | number`

#### interface `FormEngineDiagnosticsSnapshot`

A complete point-in-time snapshot of engine state for debugging: all values, MIP states, dependencies, and validation.

- **definition**: `{
        url: string;
        version: string;
        title: string;
    }`
- **timestamp**: `string`
- **structureVersion**: `number`
- **repeats**: `Record<string, number>`
- **values**: `Record<string, any>`
- **mips**: `Record<string, {
        relevant: boolean;
        required: boolean;
        readonly: boolean;
        error: string | null;
    }>`
- **dependencies**: `Record<string, string[]>`
- **validation**: `ValidationReport`
- **runtimeContext**: `{
        now: string;
        locale?: string;
        timeZone?: string;
        seed?: string | number;
    }`

#### interface `EngineReplayApplyResult`

The result of applying a single replay event, including success/failure status and optional output.

- **ok**: `boolean`
- **event**: `EngineReplayEvent`
- **output?**: `any`
- **error?**: `string`

#### interface `EngineReplayResult`

Aggregate result of replaying a sequence of events, with per-event results and any errors encountered.

- **applied**: `number`
- **results**: `EngineReplayApplyResult[]`
- **errors**: `Array<{
        index: number;
        event: EngineReplayEvent;
        error: string;
    }>`

#### interface `ComponentObject`

A node in the component tree describing which UI component to render, with optional binding, conditional visibility, and children.

- **component**: `string`
- **bind?**: `string`
- **when?**: `string`
- **style?**: `Record<string, any>`
- **children?**: `ComponentObject[]`

#### interface `ComponentDocument`

A Formspec Component Document that defines the UI component tree, breakpoints, tokens,
and custom component specifications for rendering a specific definition.

- **$formspecComponent**: `string`
- **version**: `string`
- **targetDefinition**: `{
        url: string;
        compatibleVersions?: string;
    }`
- **url?**: `string`
- **name?**: `string`
- **title?**: `string`
- **description?**: `string`
- **breakpoints?**: `Record<string, number>`
- **tokens?**: `Record<string, any>`
- **components?**: `Record<string, any>`
- **tree**: `ComponentObject`

#### type `EngineNowInput`

Accepted input types for the engine's "now" provider: a Date object, an ISO string, or a Unix timestamp.

```ts
type EngineNowInput = Date | string | number;
```

#### type `EngineReplayEvent`

A discriminated union of events that can be replayed against a FormEngine instance (setValue, repeat operations, validation, response).

#### class `FormEngine`

Central reactive form state manager for Formspec definitions.

FormEngine parses a {@link FormspecDefinition} and builds a network of Preact signals
representing field values, relevance (visibility), required/readonly state, validation
results, repeat group counts, option lists, and computed variables. All signals update
automatically when dependencies change.

Key capabilities:
- **FEL compilation** with caching and dependency tracking for calculated fields, constraints, and shapes.
- **Bind constraint evaluation** (field-level: required, readonly, calculate, constraint, relevance).
- **Shape evaluation** (cross-field rules with composition operators, supporting continuous/submit/demand timing).
- **Repeat group lifecycle** (add/remove instances with automatic signal initialization and cleanup).
- **Response serialization** honoring nonRelevantBehavior settings.
- **Diagnostics snapshots** for debugging.
- **Event replay** for testing and deterministic reproduction.
- **Version migrations** for evolving definitions.
- **Remote options** fetching from bind-configured URLs.
- **Screener evaluation** for conditional form routing.

##### `constructor(definition: FormspecDefinition, runtimeContext?: FormEngineRuntimeContext)`

Creates a new FormEngine from a Formspec definition.

Initializes all reactive signals, resolves option sets, loads instance data,
compiles bind expressions, fetches remote options, and wires up shape evaluation.

- **signals** (`Record<string, any>`): Reactive signals holding current field values, keyed by full dotted path (e.g. `"group[0].field"`).
- **relevantSignals** (`Record<string, Signal<boolean>>`): Reactive boolean signals indicating whether each field/group is currently relevant (visible).
- **requiredSignals** (`Record<string, Signal<boolean>>`): Reactive boolean signals indicating whether each field is currently required.
- **readonlySignals** (`Record<string, Signal<boolean>>`): Reactive boolean signals indicating whether each field is currently readonly.
- **errorSignals** (`Record<string, Signal<string | null>>`): Reactive signals holding the first error message (or null) for each field, derived from validationResults.
- **validationResults** (`Record<string, Signal<ValidationResult[]>>`): Reactive signals holding bind-level validation results for each field path.
- **shapeResults** (`Record<string, Signal<ValidationResult[]>>`): Reactive signals holding shape-level validation results, keyed by shape ID.
- **repeats** (`Record<string, Signal<number>>`): Reactive signals holding the current instance count for each repeatable group path.
- **optionSignals** (`Record<string, Signal<FormspecOption[]>>`): Reactive signals holding the resolved option lists for choice/multiChoice fields.
- **optionStateSignals** (`Record<string, Signal<RemoteOptionsState>>`): Reactive signals holding the loading/error state for fields with remote options.
- **variableSignals** (`Record<string, Signal<any>>`): Reactive signals holding computed variable values, keyed by `"scope:name"` (e.g. `"#:totalDirect"`).
- **instanceData** (`Record<string, any>`): Static instance data loaded from the definition's `instances` section, keyed by instance name.
- **instanceVersion** (`Signal<number>`): Version signal incremented whenever instance data changes, enabling FEL reactivity for
- **dependencies** (`Record<string, string[]>`): Dependency graph mapping each field path to the paths it depends on, built during FEL compilation.
- **structureVersion** (`Signal<number>`): Monotonically increasing counter that increments whenever repeat instances are added or removed, enabling reactive UI rebuilds.
- **(get) formPresentation** (`any`): Returns the definition's `formPresentation` block (layout, wizard, default currency, etc.), or null if absent.

##### `setRuntimeContext(context?: FormEngineRuntimeContext): void`

Updates the engine's runtime context (now provider, locale, timezone, seed).
Only explicitly provided keys are changed; omitted keys are left as-is.

##### `getOptions(path: string): FormspecOption[]`

Returns the current resolved options array for a choice/multiChoice field.

##### `getOptionsSignal(path: string): Signal<FormspecOption[]> | undefined`

Returns the reactive signal holding the options array for a field, or undefined if no options exist.

##### `getOptionsState(path: string): RemoteOptionsState`

Returns the current loading/error state for a field's remote options.

##### `getOptionsStateSignal(path: string): Signal<RemoteOptionsState> | undefined`

Returns the reactive signal holding the remote options loading/error state, or undefined.

##### `waitForRemoteOptions(): Promise<void>`

Waits for all in-flight remote options fetches to settle (resolve or reject).

##### `waitForInstanceSources(): Promise<void>`

Waits for all in-flight instance source fetches to settle (resolve or reject).

##### `setInstanceValue(name: string, path: string | undefined, value: any): void`

Writes to a named instance. Intended for writable (`readonly: false`) scratch-pad instances.

##### `getInstanceData(name: string, path?: string): any`

Retrieves data from a named instance, optionally navigating to a nested path.
Used by FEL's `instance()` function and the pre-population system.

##### `getDisabledDisplay(path: string): 'hidden' | 'protected'`

Returns the disabledDisplay mode for a field path from its bind configuration.
- `"hidden"` (default): the field wrapper is display:none when non-relevant.
- `"protected"`: the field remains visible but grayed out / disabled when non-relevant.

##### `getVariableValue(name: string, scopePath: string): any`

Resolves a computed variable by name using lexical scope lookup.
Searches from the given scope path upward through ancestor scopes to the global scope (`#`).

##### `addRepeatInstance(itemName: string): number | undefined`

Adds a new repeat instance to a repeatable group, initializing all child signals.
Does not enforce maxRepeat; exceeding the maximum produces a validation error instead.

##### `removeRepeatInstance(itemName: string, index: number): void`

Removes a repeat instance at the given index, shifting subsequent instances down.
Does not enforce minRepeat; going below the minimum produces a validation error instead.

##### `compileExpression(expression: string, currentItemName?: string): () => any`

Compiles a FEL expression into a callable function that evaluates against the engine's current state.
Results are cached; subsequent calls with the same expression and context return the cached function.

##### `setValue(name: string, value: any): void`

Sets a field's value, applying whitespace transforms, type coercion, and precision enforcement
as configured by the field's bind and data type.

##### `getValidationReport(options?: {
        mode?: 'continuous' | 'submit';
    }): ValidationReport`

Builds and returns the current validation report, aggregating bind-level and shape-level results.
In `"continuous"` mode (default), only continuous-timing shapes are included.
In `"submit"` mode, submit-timing shapes are also evaluated.
Non-relevant fields are excluded from the report.

##### `evaluateShape(shapeId: string): ValidationResult[]`

Evaluates a specific shape by ID on demand, returning any resulting validation findings.
Typically used for demand-timing shapes that are not automatically evaluated.

##### `getResponse(meta?: {
        id?: string;
        author?: {
            id: string;
            name?: string;
        };
        subject?: {
            id: string;
            type?: string;
        };
        mode?: 'continuous' | 'submit';
    }): any`

Serializes the current form state into a Formspec response document.
Respects nonRelevantBehavior settings (remove, empty, or keep) when building the data tree.
Includes a full validation report and metadata (definitionUrl, definitionVersion, status, authored timestamp).

##### `getDiagnosticsSnapshot(options?: {
        mode?: 'continuous' | 'submit';
    }): FormEngineDiagnosticsSnapshot`

Captures a complete point-in-time snapshot of the engine's internal state for debugging.
Includes all field values, MIP states (relevant/required/readonly/error), dependency graph,
repeat counts, validation report, and runtime context.

##### `applyReplayEvent(event: EngineReplayEvent): EngineReplayApplyResult`

Applies a single replay event to the engine, dispatching to the appropriate method.
Catches errors and returns them in the result rather than throwing.

##### `replay(events: EngineReplayEvent[], options?: {
        stopOnError?: boolean;
    }): EngineReplayResult`

Replays a sequence of events against the engine in order, for deterministic state reproduction.

##### `getDefinition(): FormspecDefinition`

Returns the loaded Formspec definition document.

##### `setLabelContext(context: string | null): void`

Sets the active label context key, used by {@link getLabel} to select alternate label strings.

##### `getLabel(item: FormspecItem): string`

Returns the label for an item, honoring the current label context if one is set.
Falls back to the item's default `label` property when no context match is found.

##### `evaluateScreener(answers: Record<string, any>): {
        target: string;
        label?: string;
        extensions?: Record<string, any>;
    } | null`

Evaluates the definition's screener routes against provided answers.
Screener items are NOT part of the form's instance data — answers are passed
directly and evaluated in isolation. Routes are evaluated in declaration order;
first match wins. Returns the matching route or null if none match.

##### `migrateResponse(responseData: Record<string, any>, fromVersion: string): Record<string, any>`

Applies version migrations to response data, transforming it from `fromVersion` to the current definition version.
Supports rename, remove, add, and FEL-based transform operations as defined in the definition's `migrations` array.

## `rewriteFEL(expression: string, map: RewriteMap): string`

Rewrites `$`-prefixed path references in a FEL expression according to a {@link RewriteMap}.

Three kinds of references are handled:
1. `$path` references — `$budget.lineItems[*].amount` → `$projectBudget.proj_lineItems[*].proj_amount`
2. `@current.path` references — `@current.amount` → `@current.proj_amount`
3. `prev('name')`, `next('name')`, `parent('name')` — string literal field names are prefixed

Bare `$` (current-node), `@index`, `@count`, `@instance('...')`, `#:varName`,
literal values, and paths outside the imported fragment are left untouched.

## `rewriteMessageTemplate(message: string, map: RewriteMap): string`

Rewrites FEL expressions inside `{{...}}` interpolation sequences in a message string.
Literal text outside `{{...}}` is preserved.

## `assembleDefinition(definition: FormspecDefinition, resolver: DefinitionResolver): Promise<AssemblyResult>`

Assembles a {@link FormspecDefinition} by recursively resolving all `$ref` inclusions.
Produces a self-contained definition with no external references, suitable for runtime use.
Assembly is intended to run at publish time (when a definition transitions from "draft" to "active").
Detects circular references and key collisions, and rewrites bind/shape paths with keyPrefix when specified.

## `assembleDefinitionSync(definition: FormspecDefinition, resolver: (url: string, version?: string) => FormspecDefinition): AssemblyResult`

Synchronous variant of {@link assembleDefinition} for use when all referenced definitions
are available in-memory (e.g. during testing or pre-cached scenarios).

#### interface `AssemblyProvenance`

Provenance record for a single `$ref` inclusion resolved during definition assembly, tracking origin URL, version, prefix, and fragment.

- **url**: `string`
- **version**: `string`
- **keyPrefix?**: `string`
- **fragment?**: `string`

#### interface `AssemblyResult`

The output of definition assembly: a self-contained definition with all `$ref` inclusions inlined, plus provenance records.

- **definition**: `FormspecDefinition`
- **assembledFrom**: `AssemblyProvenance[]`

#### interface `RewriteMap`

Lookup structure for FEL path rewriting during assembly.
Built once per `$ref` resolution from the imported fragment.

- **fragmentRootKey** (`string`): The top-level key of the selected fragment item (e.g. "budget"). Empty string when no fragment.
- **hostGroupKey** (`string`): The host group's key that replaces the fragment root in path references (e.g. "projectBudget").
- **importedKeys** (`Set<string>`): All item keys (recursively collected) in the imported fragment subtree, used for prefix matching.
- **keyPrefix** (`string`): The key prefix applied to imported item keys (e.g. "proj_").

#### type `DefinitionResolver`

A function that resolves a `(url, version?)` pair to a {@link FormspecDefinition}.
Implementations may resolve from an in-memory registry, local filesystem, or network fetch.
May return synchronously or asynchronously.

```ts
type DefinitionResolver = (url: string, version?: string) => FormspecDefinition | Promise<FormspecDefinition>;
```

## `dependencyVisitor: FelDependencyVisitor`

Pre-instantiated dependency visitor singleton.

Used by FormEngine when compiling FEL expressions to determine which field
signals each expression depends on. Call `dependencyVisitor.getDependencies(cst)`
with the CST from `parser.expression()` to get the list of referenced field paths.

#### class `FelDependencyVisitor`

Walks a FEL Concrete Syntax Tree to extract the set of field paths referenced
by an expression.

Unlike the {@link FelInterpreter}, this class does not evaluate anything — it
only performs structural analysis. It recognizes both `$`-prefixed relative
references and bare identifier references, reconstructing dotted paths from
`pathTail` nodes. The resulting dependency list drives the FormEngine's
reactive dependency graph.

##### `constructor()`

##### `getDependencies(cst: any): string[]`

Extract all unique field paths referenced in a FEL CST.

Recursively walks the tree, collecting paths from `fieldRef` nodes.
`$`-prefixed references and bare identifiers are both captured. Dotted
paths (e.g. `group.field`) are reconstructed from `pathTail` children.

## `BaseVisitor: new (...args: any[]) => import("chevrotain").ICstVisitor<any, any>`

## `interpreter: FelInterpreter`

Pre-instantiated FEL interpreter singleton.

Shared across the engine to avoid repeated Chevrotain visitor validation.
Usage: call `interpreter.evaluate(cst, context)` where `cst` is the output
of `parser.expression()` and `context` is a {@link FelContext} wired to
the FormEngine's signal graph.

#### interface `FelContext`

Runtime context provided to the interpreter for each FEL evaluation.

Bridges the interpreter to the FormEngine's reactive signal graph. Each
callback reads from a Preact signal so that evaluations are automatically
tracked as signal dependencies, enabling reactive re-computation when
upstream values change.

- **getSignalValue** (`(path: string) => any`): Read the current value of a field signal at the given dotted path.
- **getRepeatsValue** (`(path: string) => number`): Read the current repeat instance count for a repeatable group.
- **getRelevantValue** (`(path: string) => boolean`): Read whether the field at the given path is currently relevant (visible).
- **getRequiredValue** (`(path: string) => boolean`): Read whether the field at the given path is currently required.
- **getReadonlyValue** (`(path: string) => boolean`): Read whether the field at the given path is currently readonly.
- **getValidationErrors** (`(path: string) => number`): Read the count of validation errors for the field at the given path.
- **currentItemPath** (`string`): The fully-qualified dotted path of the item whose bind expression is being evaluated. Used for relative `$` field references.
- **engine** (`any`): Reference to the FormEngine instance. Used by stdlib functions that need engine-level APIs (e.g. `instance()`, variable lookup).

#### class `FelInterpreter`

Chevrotain CstVisitor that evaluates a FEL CST against a live {@link FelContext}.

Visitor methods mirror the grammar rules in {@link FelParser}. Each method
receives a CST node context object and returns the evaluated JavaScript value.
The class also houses {@link felStdLib}, a record of 40+ built-in functions
available to FEL expressions (e.g. `sum(...)`, `today()`, `money(...)`).

Instantiate once and reuse via {@link interpreter}. Not thread-safe — the
`context` field is mutated on each call to {@link evaluate}.

##### `constructor()`

##### `evaluate(cst: any, context: FelContext): any`

Evaluate a FEL CST and return the computed value.

This is the main entry point for stage 3 of the FEL pipeline. The caller
provides the CST (from `parser.expression()`) and a {@link FelContext}
wired to the FormEngine's signal graph. The returned value is used for
calculated fields, conditional relevance, validation constraints, etc.

##### `expression(ctx: any): any`

##### `letExpr(ctx: any): any`

##### `ifExpr(ctx: any): any`

##### `ternary(ctx: any): any`

##### `logicalOr(ctx: any): any`

##### `logicalAnd(ctx: any): any`

##### `equality(ctx: any): any`

##### `comparison(ctx: any): any`

##### `membership(ctx: any): any`

##### `nullCoalesce(ctx: any): any`

##### `addition(ctx: any): any`

##### `multiplication(ctx: any): any`

##### `unary(ctx: any): any`

##### `postfix(ctx: any): any`

##### `pathTail(ctx: any): any`

##### `atom(ctx: any): any`

##### `literal(ctx: any): any`

##### `fieldRef(ctx: any): any`

##### `contextRef(ctx: any): any`

##### `functionCall(ctx: any): any`

##### `ifCall(ctx: any): any`

##### `argList(ctx: any): any`

##### `arrayLiteral(ctx: any): any`

##### `objectLiteral(ctx: any): any`

##### `objectEntries(ctx: any): any`

##### `objectEntry(ctx: any): {
        key: any;
        value: any;
    }`

fel/lexer

Chevrotain-based tokenizer for the Formspec Expression Language (FEL).

This is the first stage of the FEL pipeline (Lexer -> Parser -> Interpreter).
It defines 35 token types covering whitespace/comments (skipped), keywords,
literals, operators, and punctuation. Token ordering in {@link allTokens}
controls Chevrotain's longest-match disambiguation — longer patterns (e.g.
DateTimeLiteral) must precede shorter ones (e.g. DateLiteral, NumberLiteral).

## `WhiteSpace: import("chevrotain").TokenType`

Matches one or more whitespace characters. Skipped during tokenization.

## `Comment: import("chevrotain").TokenType`

Matches single-line comments starting with `//`. Skipped during tokenization.

## `BlockComment: import("chevrotain").TokenType`

Matches block comments delimited by `/* ... *\/`. Skipped during tokenization.

## `True: import("chevrotain").TokenType`

Boolean literal `true`.

## `False: import("chevrotain").TokenType`

Boolean literal `false`.

## `Null: import("chevrotain").TokenType`

Null literal `null`.

## `And: import("chevrotain").TokenType`

Logical AND operator (`and`). Short-circuits in the interpreter.

## `Or: import("chevrotain").TokenType`

Logical OR operator (`or`). Short-circuits in the interpreter.

## `Not: import("chevrotain").TokenType`

Logical NOT / membership negation operator (`not`). Used both as unary prefix and in `not in`.

## `In: import("chevrotain").TokenType`

Set membership operator (`in`). Tests whether a value exists in an array. Also used as the `in` keyword for `let ... in` bindings.

## `Identifier: import("chevrotain").TokenType`

General identifier matching `[a-zA-Z_][a-zA-Z0-9_]*`. Used for field names, function names, and variable references. Listed last in {@link allTokens} so keyword tokens take priority.

## `If: import("chevrotain").TokenType`

Conditional keyword `if`. Categorized as an {@link Identifier} so that `if(...)` can also be parsed as a function call.

## `Then: import("chevrotain").TokenType`

Conditional keyword `then`, used in `if ... then ... else` expressions.

## `Else: import("chevrotain").TokenType`

Conditional keyword `else`, used in `if ... then ... else` expressions.

## `Let: import("chevrotain").TokenType`

Let-binding keyword `let`, used in `let x = expr in body` expressions for local variable scoping.

## `StringLiteral: import("chevrotain").TokenType`

String literal enclosed in single or double quotes, with backslash escapes. Matches `"hello"` or `'world'`.

## `NumberLiteral: import("chevrotain").TokenType`

Numeric literal supporting integers, decimals, and scientific notation. Matches `-3`, `1.5`, `2e10`.

## `DateTimeLiteral: import("chevrotain").TokenType`

DateTime literal prefixed with `@`. Matches ISO 8601 datetime like `@2024-01-15T10:30:00Z`. Must precede {@link DateLiteral} in token order to win longest-match.

## `DateLiteral: import("chevrotain").TokenType`

Date literal prefixed with `@`. Matches ISO 8601 date like `@2024-01-15`.

## `LRound: import("chevrotain").TokenType`

Left parenthesis `(`. Used for grouping, function calls, and context ref parameters.

## `RRound: import("chevrotain").TokenType`

Right parenthesis `)`.

## `LSquare: import("chevrotain").TokenType`

Left square bracket `[`. Used for array literals and indexed path access (e.g. `group[0]`).

## `RSquare: import("chevrotain").TokenType`

Right square bracket `]`.

## `LCurly: import("chevrotain").TokenType`

Left curly brace `{`. Used for object literals.

## `RCurly: import("chevrotain").TokenType`

Right curly brace `}`.

## `Comma: import("chevrotain").TokenType`

Comma `,`. Separates function arguments, array elements, and object entries.

## `Dot: import("chevrotain").TokenType`

Dot `.`. Path separator for field references (e.g. `group.field`) and postfix member access.

## `Colon: import("chevrotain").TokenType`

Colon `:`. Separates keys from values in object literals and ternary false-branch.

## `Question: import("chevrotain").TokenType`

Single question mark `?`. Ternary operator (`cond ? a : b`).

## `DoubleQuestion: import("chevrotain").TokenType`

Double question mark `??`. Null-coalescing operator — returns the right operand when the left is null/undefined.

## `Equals: import("chevrotain").TokenType`

Equality operator `=` or `==`. Both forms are accepted; FEL uses value equality.

## `NotEquals: import("chevrotain").TokenType`

Inequality operator `!=`.

## `LessEqual: import("chevrotain").TokenType`

Less-than-or-equal operator `<=`. Must precede {@link Less} in token order.

## `GreaterEqual: import("chevrotain").TokenType`

Greater-than-or-equal operator `>=`. Must precede {@link Greater} in token order.

## `Less: import("chevrotain").TokenType`

Less-than operator `<`.

## `Greater: import("chevrotain").TokenType`

Greater-than operator `>`.

## `Plus: import("chevrotain").TokenType`

Addition operator `+`. Performs numeric addition.

## `Minus: import("chevrotain").TokenType`

Subtraction / unary negation operator `-`.

## `Ampersand: import("chevrotain").TokenType`

String concatenation operator `&`. Coerces both operands to strings before joining.

## `Asterisk: import("chevrotain").TokenType`

Multiplication operator `*`. Also used as a wildcard in path subscripts (`group[*].field`).

## `Slash: import("chevrotain").TokenType`

Division operator `/`.

## `Percent: import("chevrotain").TokenType`

Modulo (remainder) operator `%`.

## `Dollar: import("chevrotain").TokenType`

Dollar sign `$`. Prefixes relative field references that resolve from the current item's parent path.

## `At: import("chevrotain").TokenType`

At sign `@`. Prefixes context references like `@index`, `@current`, `@count`, and user-defined variables.

## `allTokens: import("chevrotain").TokenType[]`

Ordered token array passed to the Chevrotain Lexer constructor.

Order matters for disambiguation: tokens listed first win when multiple
patterns match at the same position. Key ordering constraints:
- DateTimeLiteral before DateLiteral (both start with `@` + digits)
- DateLiteral before NumberLiteral (the `@` prefix distinguishes dates)
- DoubleQuestion before Question (`??` vs `?`)
- LessEqual/GreaterEqual before Less/Greater (`<=` vs `<`)
- All keyword tokens (True, And, If, etc.) before Identifier
- Identifier is always last to act as a catch-all

## `FelLexer: Lexer`

Pre-instantiated Chevrotain Lexer configured with all FEL token types.

This singleton is the entry point for the first stage of the FEL pipeline.
Call `FelLexer.tokenize(input)` to produce a token vector that the
{@link parser} (stage 2) consumes to build a CST.

fel/parser

Chevrotain CstParser for the Formspec Expression Language (FEL).

This is the second stage of the FEL pipeline (Lexer -> Parser -> Interpreter).
It consumes the token vector produced by {@link FelLexer} and builds a
Concrete Syntax Tree (CST) that the {@link FelInterpreter} (stage 3) or
{@link FelDependencyVisitor} can walk.

The grammar defines ~25 rules implementing standard operator precedence from
loosest to tightest: let -> if/then/else -> ternary -> logicalOr -> logicalAnd
-> equality -> comparison -> membership -> nullCoalesce -> addition ->
multiplication -> unary -> postfix -> atom.

## `parser: FelParser`

Pre-instantiated FEL parser singleton.

Shared across the engine to avoid the cost of repeated Chevrotain self-analysis.
Usage: set `parser.input = FelLexer.tokenize(expr).tokens`, then call
`parser.expression()` to obtain a CST node. The CST is then passed to the
{@link interpreter} or {@link dependencyVisitor} for evaluation or analysis.

#### class `FelParser`

Chevrotain CstParser that produces a Concrete Syntax Tree from FEL token streams.

Instantiate once and reuse — Chevrotain parsers are stateful but re-entrant after
calling `this.input = tokens`. Grammar rules are defined as class properties
using `this.RULE()` so Chevrotain can perform static analysis at construction time.

All grammar rules are private except {@link expression}, which is the top-level
entry point consumed by the interpreter and dependency visitor.

##### `constructor()`

- **expression** (`import("chevrotain").ParserMethod<[], import("chevrotain").CstNode>`): Top-level grammar rule and the only public entry point into the parser.

Every FEL expression string is parsed starting from this rule. It delegates
to `letExpr`, which cascades through the full precedence hierarchy.
The resulting CST node is passed to {@link FelInterpreter.evaluate} or
{@link FelDependencyVisitor.getDependencies}.

#### class `PathResolver`

##### `resolve(currentPath: string, targetPath: string): string`

##### `getParentPath(path: string): string`

#### interface `RuntimeMappingResult`

The result of executing a mapping operation, including the transformed output, rule count, and any diagnostics.

- **direction**: `MappingDirection`
- **output**: `any`
- **appliedRules**: `number`
- **diagnostics**: `string[]`

#### type `MappingDirection`

The direction of a mapping operation: `"forward"` maps Formspec data to an external format, `"reverse"` maps back.

```ts
type MappingDirection = 'forward' | 'reverse';
```

#### class `RuntimeMappingEngine`

Bidirectional data transform engine driven by a Formspec mapping document.

Rules are priority-ordered and support conditions, transform types (drop, constant, valueMap,
coerce, preserve), and per-rule reverse overrides. Forward mapping transforms Formspec response
data into an external format; reverse mapping transforms external data back into Formspec shape.

##### `constructor(mappingDocument: any)`

Creates a RuntimeMappingEngine from a mapping document.

##### `forward(source: any): RuntimeMappingResult`

Executes a forward mapping: transforms Formspec response data into an external format.
Applies document defaults before processing rules.

##### `reverse(source: any): RuntimeMappingResult`

Executes a reverse mapping: transforms external-format data back into Formspec response shape.
Uses each rule's `reverse` override when available, otherwise swaps source/target paths.

