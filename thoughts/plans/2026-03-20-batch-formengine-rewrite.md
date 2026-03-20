# Batch FormEngine Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reactive-graph FormEngine with a batch-evaluation engine backed entirely by Rust/WASM, deleting ~3,500 lines of duplicated TS logic.

**No backwards compatibility.** Zero users, zero deployments. Downstream packages are updated to the new API. No compat shims, no type aliases, no preserving exports that don't earn their place. `IFormEngine` is simplified: `dependencies` and `felRuntime` properties are dropped (no external consumer uses them).

**Architecture:** Every change to form state calls `wasmEvaluateDefinition()` (Rust batch evaluator), diffs the result against the previous evaluation, and patches Preact Signal outputs. TS owns only signal lifecycle, async I/O, and type coercion. WASM is mandatory — no fallback code paths. All FEL parsing, evaluation, validation, dependency resolution, variable scoping, and shape composition happen exclusively in Rust.

**Tech Stack:** Rust (`formspec-eval`, `formspec-wasm`, `fel-core`), TypeScript, `@preact/signals-core`, `wasm-pack`

**Key References:**
- Current engine: `packages/formspec-engine/src/index.ts` (~2464 lines)
- IFormEngine interface: `packages/formspec-engine/src/interfaces.ts` (~255 lines)
- Rust batch evaluator: `crates/formspec-eval/src/lib.rs` (~936 lines)
- WASM exports: `crates/formspec-wasm/src/lib.rs` (~1998 lines)
- Python reference architecture: `src/formspec/_rust.py` (~410 lines, zero fallbacks)
- Existing test suite: `packages/formspec-engine/tests/` (62 files, ~579 tests)
- Studio FEL tooling consumer: `packages/formspec-studio/src/lib/fel-editor-utils.ts`

---

## Public API Surface

No backwards compat. Export what's useful, update downstream to match.

### New exports from `index.ts`

- `FormEngine` class (batch engine)
- `createFormEngine(def, ctx?, registryEntries?)` factory
- `createMappingEngine(mappingDoc)` returning `IRuntimeMappingEngine`
- `lintDocument(doc)` — replaces `createSchemaValidator`

### Re-exports from `wasm-bridge.ts` (all WASM, no fallbacks)

`initWasm`, `isWasmReady`, `normalizeIndexedPath`, `itemAtPath`, `itemLocationAtPath`, `analyzeFEL`, `rewriteFELReferences`, `rewriteMessageTemplate`, `validateExtensionUsage`, `listBuiltinFunctions`, `assembleDefinition`, `executeMappingDoc`, `parseRegistry`, `findRegistryEntry`, `validateLifecycleTransition`, `wellKnownRegistryUrl`, `generateChangelog`, `printFEL`, `evaluateDefinition`, `tokenizeFEL` (NEW)

### Types from `interfaces.ts`

`IFormEngine` (simplified: no `dependencies`, no `felRuntime`), `IRuntimeMappingEngine`, `RemoteOptionsState`, `FormEngineRuntimeContext`, `RegistryEntry`, `FormEngineDiagnosticsSnapshot`, `EngineReplayEvent`, `EngineReplayApplyResult`, `EngineReplayResult`, `MappingDirection`, `MappingDiagnostic`, `RuntimeMappingResult`, `PinnedResponseReference`

Plus types absorbed from deleted files that downstream actually uses: `FELBuiltinFunctionCatalogEntry`, `FELAnalysis`, `ExtensionUsageIssue`, `DocumentType`

### Dropped (downstream updated to alternatives)

| Dropped | Replacement for downstream |
|---|---|
| `FormspecItem`, `FormspecBind`, etc. type aliases | `import from 'formspec-types'` |
| `createSchemaValidator(schemas)` | `lintDocument(doc)` |
| `RuntimeMappingEngine` class | `createMappingEngine()` |
| `FelLexer`, `parser` | `tokenizeFEL()` |
| `WasmFelRuntime`, `wasmFelRuntime` | Gone — batch eval |
| `IFormEngine.dependencies` | Dropped — no consumer |
| `IFormEngine.felRuntime` | Dropped — no consumer |
| `assembleDefinitionSync`, `rewriteFEL` | `wasmAssembleDefinition`, `wasmRewriteFELReferences` directly |
| `SchemaValidatorSchemas`, `SchemaValidator` | `lintDocument` return type |
| `IFelRuntime`, `ICompiledExpression`, `FelContext` | Dropped — batch model has no per-expression compilation |
| `normalizePathSegment`, `splitNormalizedPath` | Dropped — trivial, inline if needed |

---

## File Structure

### Files to Create

| File | Responsibility | ~Lines |
|---|---|---|
| `packages/formspec-engine/src/diff.ts` | Pure function: diff two EvaluationResults → EvalDelta | ~80 |
| `packages/formspec-engine/tests/batch-diff.test.mjs` | Tests for diff function | ~120 |
| `packages/formspec-engine/tests/batch-engine-core.test.mjs` | Core batch cycle tests | ~180 |
| `packages/formspec-engine/tests/batch-repeat-lifecycle.test.mjs` | Repeat signal lifecycle tests | ~100 |
| `packages/formspec-engine/tests/batch-performance.test.mjs` | Performance baseline | ~30 |

### Files to Modify

| File | Change |
|---|---|
| `crates/formspec-eval/src/lib.rs` | Extend `EvaluationResult` with `required`, `readonly`; add `shape_id` to `ValidationResult`; accept optional runtime context (`nowIso`) |
| `crates/formspec-wasm/src/lib.rs` | Wire extended fields through `evaluateDefinition`; accept `context_json` param; add `tokenizeFEL` export |
| `crates/fel-core/src/lib.rs` (or lexer module) | Expose `tokenize()` returning positioned token records |
| `packages/formspec-engine/src/wasm-bridge.ts` | Update `wasmEvaluateDefinition` signature; add `wasmTokenizeFEL` |
| `packages/formspec-engine/src/interfaces.ts` | Absorb ALL types from deleted files (see inventory above) |
| `packages/formspec-engine/src/index.ts` | Full rewrite: BatchFormEngine + re-exports |
| `packages/formspec-engine/package.json` | Remove `chevrotain`, `ajv` |
| `packages/formspec-studio/src/lib/fel-editor-utils.ts` | Migrate from `FelLexer`/`parser` to `tokenizeFEL` |

### Files to Delete (after all migrations complete)

All paths relative to `packages/formspec-engine/`:

| File | Lines | Replaced by |
|---|---|---|
| `src/fel/wasm-runtime.ts` | 498 | Batch eval (no per-expression context building) |
| `src/fel/analysis.ts` | 451 | `wasmAnalyzeFEL` |
| `src/schema-validator.ts` | 459 | `wasmLintDocument` |
| `src/fel/parser.ts` | 369 | Rust parser + `wasmTokenizeFEL` |
| `src/assembler.ts` | ~300 | `wasmAssembleDefinition` |
| `src/fel/lexer.ts` | 256 | Rust lexer + `wasmTokenizeFEL` |
| `src/fel/runtime.ts` | 130 | Types absorbed into `interfaces.ts` |
| `src/extension-analysis.ts` | 124 | `wasmValidateExtensionUsage` |
| `src/runtime-mapping.ts` | 1032 | `wasmExecuteMappingDoc` |
| `src/path-utils.ts` | 71 | WASM wrappers + inline helpers |
| `src/fel/rewrite.ts` | 68 | `wasmRewriteFELReferences` |
| `src/fel/builtin-catalog.ts` | 67 | `wasmListBuiltinFunctions` |
| `src/runtime-path-utils.ts` | 64 | WASM wrappers directly |
| `src/wasm-runtime-mapping.ts` | 50 | Inline `createMappingEngine` |
| `src/factories.ts` | 41 | Folded into `index.ts` |
| **Total** | **~3,980** | |

---

## Phase 1 — Rust Foundation

### Task 1: Extend EvaluationResult in formspec-eval

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests for new fields**

Add tests to `crates/formspec-eval/src/lib.rs` (or a test module):

```rust
#[test]
fn eval_result_includes_required_state() {
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [{ "key": "name", "type": "field", "dataType": "string", "label": "N" }],
        "binds": [{ "path": "name", "required": "true" }],
    });
    let data = HashMap::new();
    let result = evaluate_definition(&def, &data);
    assert_eq!(result.required.get("name"), Some(&true));
}

#[test]
fn eval_result_includes_readonly_state() {
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [{ "key": "name", "type": "field", "dataType": "string", "label": "N" }],
        "binds": [{ "path": "name", "readonly": "true" }],
    });
    let data = HashMap::new();
    let result = evaluate_definition(&def, &data);
    assert_eq!(result.readonly.get("name"), Some(&true));
}

#[test]
fn shape_validations_include_shape_id() {
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [
            { "key": "a", "type": "field", "dataType": "decimal", "label": "A" },
            { "key": "b", "type": "field", "dataType": "decimal", "label": "B" },
        ],
        "shapes": [{
            "id": "ab-check",
            "targets": ["a"],
            "constraint": "$a > $b",
            "constraintMessage": "A must exceed B",
        }],
    });
    let mut data = HashMap::new();
    data.insert("a".into(), serde_json::json!(1));
    data.insert("b".into(), serde_json::json!(10));
    let result = evaluate_definition(&def, &data);
    let shape_results: Vec<_> = result.validations.iter()
        .filter(|v| v.shape_id.as_deref() == Some("ab-check"))
        .collect();
    assert!(!shape_results.is_empty(), "shape validation should include shape_id");
}
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cargo test -p formspec-eval`
Expected: Compilation errors — `required`, `readonly`, `shape_id` fields don't exist yet.

- [ ] **Step 3: Implement the struct changes**

Add `shape_id: Option<String>` to `ValidationResult`. Add `required: HashMap<String, bool>` and `readonly: HashMap<String, bool>` to `EvaluationResult`.

Add `collect_mip_state()` helper. Update `evaluate_definition()` to collect and return the new fields. Update all `ValidationResult` construction sites: bind results get `shape_id: None`, shape results get `shape_id: Some(id)` (the shape ID is read from `shape.get("id")` — already extracted in `validate_shape()`).

- [ ] **Step 4: Run tests, verify they pass**

Run: `cargo test -p formspec-eval`
Expected: All pass including new tests.

- [ ] **Step 5: Commit**

```bash
git add crates/formspec-eval/
git commit -m "feat(eval): extend EvaluationResult with required, readonly, shape_id"
```

### Task 2: Add runtime context support to evaluate_definition

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs`

The batch evaluator currently uses system time for `today()`/`now()`. It must accept an injected `nowIso` for deterministic evaluation.

- [ ] **Step 1: Write failing test**

```rust
#[test]
fn eval_with_runtime_context_uses_injected_now() {
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [{ "key": "d", "type": "field", "dataType": "date", "label": "D" }],
        "binds": [{ "path": "d", "calculate": "today()" }],
    });
    let data = HashMap::new();
    let ctx = EvalContext { now_iso: Some("2025-06-15T00:00:00".into()) };
    let result = evaluate_definition_with_context(&def, &data, &ctx);
    assert_eq!(result.values.get("d"), Some(&serde_json::json!("2025-06-15")));
}
```

- [ ] **Step 2: Implement**

Add `EvalContext` struct and `evaluate_definition_with_context()` that calls `env.set_now_from_iso()` before evaluation. Keep `evaluate_definition()` as a convenience that passes default context.

```rust
pub struct EvalContext {
    pub now_iso: Option<String>,
}

pub fn evaluate_definition_with_context(
    definition: &Value,
    data: &HashMap<String, Value>,
    context: &EvalContext,
) -> EvaluationResult {
    // ... same as evaluate_definition but call env.set_now_from_iso if provided
}
```

- [ ] **Step 3: Run tests, verify they pass**

Run: `cargo test -p formspec-eval`

- [ ] **Step 4: Commit**

```bash
git add crates/formspec-eval/
git commit -m "feat(eval): accept runtime context (nowIso) in evaluate_definition"
```

### Task 3: Wire extended result + context through WASM

**Files:**
- Modify: `crates/formspec-wasm/src/lib.rs`
- Modify: `packages/formspec-engine/src/wasm-bridge.ts`

- [ ] **Step 1: Update WASM `evaluateDefinition` to accept optional context and return extended fields**

In `crates/formspec-wasm/src/lib.rs`, update the function signature:

```rust
#[wasm_bindgen(js_name = "evaluateDefinition")]
pub fn evaluate_definition_wasm(
    definition_json: &str,
    data_json: &str,
    context_json: Option<String>,
) -> Result<String, JsError> { ... }
```

Parse `context_json` into `EvalContext`. Add `required`, `readonly`, and `shapeId` to the output JSON.

- [ ] **Step 2: Update TS bridge**

```typescript
export function wasmEvaluateDefinition(
    definition: unknown,
    data: Record<string, unknown>,
    context?: { nowIso?: string },
): {
    values: Record<string, any>;
    validations: Array<{ path: string; severity: string; kind: string; message: string; shapeId?: string }>;
    nonRelevant: string[];
    variables: Record<string, any>;
    required: Record<string, boolean>;
    readonly: Record<string, boolean>;
} {
    const resultJson = wasm().evaluateDefinition(
        JSON.stringify(definition),
        JSON.stringify(data),
        context ? JSON.stringify(context) : undefined,
    );
    return JSON.parse(resultJson);
}
```

- [ ] **Step 3: Build and verify**

Run: `cargo test -p formspec-wasm && npm --prefix packages/formspec-engine run build:wasm`

- [ ] **Step 4: Commit**

```bash
git add crates/formspec-wasm/ packages/formspec-engine/src/wasm-bridge.ts
git commit -m "feat(wasm): wire runtime context, required, readonly, shapeId through evaluateDefinition"
```

### Task 4: Add tokenizeFEL to WASM

**Files:**
- Modify: `crates/fel-core/src/` (expose positioned tokens)
- Modify: `crates/formspec-wasm/src/lib.rs`
- Modify: `packages/formspec-engine/src/wasm-bridge.ts`

- [ ] **Step 1: Expose tokenize in fel-core**

`fel-core` already produces tokens with spans internally. Add a public `tokenize()` function that returns positioned token records. Note: the internal token type is likely an enum (`Token`) with a `Span { start, end }` — you need to convert the enum variant to a string name and extract the source text via `&expression[span.start..span.end]`.

```rust
#[derive(Debug, Serialize)]
pub struct PositionedToken {
    pub token_type: String,
    pub text: String,
    pub start: usize,
    pub end: usize,
}

pub fn tokenize(expression: &str) -> Vec<PositionedToken> {
    // Use the existing lexer, convert SpannedToken → PositionedToken
}
```

- [ ] **Step 2: Add WASM export and TS bridge wrapper**

- [ ] **Step 3: Build and test**

Run: `cargo test -p fel-core && cargo test -p formspec-wasm && npm --prefix packages/formspec-engine run build:wasm`

- [ ] **Step 4: Commit**

```bash
git add crates/fel-core/ crates/formspec-wasm/ packages/formspec-engine/src/wasm-bridge.ts
git commit -m "feat(wasm): add tokenizeFEL for Studio syntax highlighting"
```

---

## Phase 2 — TS Foundation

### Task 5: Write and implement diff.ts

**Files:**
- Create: `packages/formspec-engine/tests/batch-diff.test.mjs`
- Create: `packages/formspec-engine/src/diff.ts`

- [ ] **Step 1: Write failing tests** (see full test file in previous plan version — covers: no previous result, unchanged values, changed values, null transitions, money objects, relevance, required, readonly, validations, shape result grouping by shapeId, variables, new fields, removed fields)

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `diffEvalResults` in `diff.ts`** (see previous plan version for implementation)

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

### Task 6: Update interfaces.ts with all absorbed types

**Files:**
- Modify: `packages/formspec-engine/src/interfaces.ts`

- [ ] **Step 1: Copy all type definitions from the files being deleted**

Read each file listed in the "Types to absorb" table. Copy the type/interface definitions into `interfaces.ts`. Organize into sections:

```typescript
// ── FEL types (from fel/runtime.ts) ─────────────────────
export interface IFelRuntime { ... }
export interface ICompiledExpression { ... }
export interface FelContext { ... }
// ... etc

// ── Analysis types (from fel/analysis.ts) ────────────────
export interface FELAnalysis { ... }
export interface FELAnalysisError { ... }

// ── Schema types (from schema-validator.ts) ──────────────
export type DocumentType = 'definition' | 'theme' | 'component' | ...;
export interface SchemaValidationError { path: string; message: string; }
export interface SchemaValidationResult { ... }
export interface SchemaValidatorSchemas { definition?: object; theme?: object; component?: object; ... }
export interface SchemaValidator { validate(document: unknown, documentType?: DocumentType | null): SchemaValidationResult; }

// ── Extension types (from extension-analysis.ts) ─────────
export interface ExtensionUsageIssue { ... }
export interface ValidateExtensionUsageOptions { ... }

// ── Assembly types (from assembler.ts) ───────────────────
export type DefinitionResolver = (url: string, version?: string) => any | Promise<any>;
export interface AssemblyResult { ... }
export interface RewriteMap { ... }

// ── Component types (from index.ts) ──────────────────────
export interface ComponentObject { ... }
export interface ComponentDocument { ... }
```

Remove the import of `IFelRuntime` from `./fel/runtime.js` at the top.

- [ ] **Step 2: Verify build**

Run: `npm --prefix packages/formspec-engine run build`

- [ ] **Step 3: Commit**

```bash
git add packages/formspec-engine/src/interfaces.ts
git commit -m "refactor(engine): absorb all types from files being deleted into interfaces.ts"
```

---

## Phase 3 — BatchFormEngine

### Task 7: Write core engine tests

**Files:**
- Create: `packages/formspec-engine/tests/batch-engine-core.test.mjs`

These are GREEN baseline tests — they must pass against the current engine AND the new one.

- [ ] **Step 1: Write tests** covering:
  - Constructor creates signals for all fields
  - `setValue` updates signals
  - Calculated fields computed by Rust
  - `setValue` on calculated fields silently ignored
  - Relevance signals update
  - Required signals update
  - Readonly signals update
  - Validation results update
  - Variable signals update
  - `compileExpression` returns callable that evaluates against current state

- [ ] **Step 2: Run against current engine to confirm they pass (GREEN baseline)**

Run: `npm --prefix packages/formspec-engine run build && node --test packages/formspec-engine/tests/batch-engine-core.test.mjs`
Expected: All PASS against the current reactive engine.

- [ ] **Step 3: Commit**

### Task 8: Write repeat lifecycle tests

Same approach — GREEN baseline against current engine.

- [ ] **Step 1: Write tests** covering add/remove/shift/calculated fields across instances

- [ ] **Step 2: Verify GREEN against current engine**

- [ ] **Step 3: Commit**

### Task 9: Implement BatchFormEngine (index.ts rewrite)

**Files:**
- Rewrite: `packages/formspec-engine/src/index.ts`

This is the largest task. The file has these sections:

**1. Imports and type re-exports (~60 lines)**

```typescript
import { signal, batch, type Signal } from '@preact/signals-core';
import type { FormDefinition, FormItem, ... } from 'formspec-types';
import { wasmEvaluateDefinition, wasmEvalFELWithContext, wasmExtractDependencies,
         wasmAnalyzeFEL, ... } from './wasm-bridge.js';
import { diffEvalResults, type EvalDelta, type EvalResult } from './diff.js';
import type { IFormEngine, IFelRuntime, ... } from './interfaces.js';

// Re-export all types from interfaces.ts
export type { IFormEngine, IRuntimeMappingEngine, IFelRuntime, ... } from './interfaces.js';

// Type aliases (preserving backwards compat)
export type FormspecItem = FormItem;
// ... etc
```

**2. Convenience re-exports (~80 lines)**

All WASM re-exports listed in the inventory table, plus thin wrappers for:

- `createFormEngine` — `new FormEngine(def, ctx, entries)`
- `createMappingEngine(mappingDoc)` — returns `{ forward(src) { wasmExecuteMappingDoc(doc, src, 'forward') }, reverse(src) { ... } }` matching `IRuntimeMappingEngine`
- `createSchemaValidator(schemas?)` — wraps `wasmLintDocument`, accepts optional `SchemaValidatorSchemas` for compat (ignores the schemas since Rust has them built in, uses them only if WASM is not ready — but WASM is mandatory so this is a no-op compat shim)
- `assembleDefinition(def, resolver)` — async: find `$ref`s, resolve, call `wasmAssembleDefinition`
- `assembleDefinitionSync(def, fragments)` — direct call to `wasmAssembleDefinition`
- `getBuiltinFELFunctionCatalog()` — wraps `wasmListBuiltinFunctions`
- `getFELDependencies(expr)` — wraps `wasmAnalyzeFEL`
- `normalizePathSegment(s)` — inline: `s.replace(/\[(?:\d+|\*)\]/g, '')`
- `splitNormalizedPath(p)` — inline: `normalizeIndexedPath(p).split('.').filter(Boolean)`

**3. BatchFormEngine class (~400 lines)**

Key properties:
```typescript
class FormEngine implements IFormEngine {
  readonly definition: FormDefinition;
  readonly signals: Record<string, Signal<any>> = {};
  readonly relevantSignals: Record<string, Signal<boolean>> = {};
  readonly requiredSignals: Record<string, Signal<boolean>> = {};
  readonly readonlySignals: Record<string, Signal<boolean>> = {};
  readonly errorSignals: Record<string, Signal<string | null>> = {};
  readonly validationResults: Record<string, Signal<any[]>> = {};
  readonly shapeResults: Record<string, Signal<any[]>> = {};
  readonly repeats: Record<string, Signal<number>> = {};
  readonly optionSignals: Record<string, Signal<any[]>> = {};
  readonly optionStateSignals: Record<string, Signal<RemoteOptionsState>> = {};
  readonly variableSignals: Record<string, Signal<any>> = {};
  readonly instanceData: Record<string, any> = {};
  readonly instanceVersion: Signal<number>;
  readonly structureVersion: Signal<number>;
  // NOTE: `dependencies` and `felRuntime` dropped from IFormEngine — no external consumer.

  private _data: Record<string, any> = {};
  private _definition: any; // cached parsed definition for WASM calls
  private _previousResult: EvalResult | null = null;
  private _calculatedFields: Set<string>;
  private _nowProvider: (() => string) | null = null;
}
```

Key methods to implement:

| Method | Strategy | ~Lines |
|---|---|---|
| `constructor` | Create signal maps from item tree, resolve option sets, identify calculated fields, run initial `_evaluate()`, kick off async fetches | ~80 |
| `_evaluate()` | Build nowIso from `_nowProvider`, call `wasmEvaluateDefinition(def, data, { nowIso })`, diff, patch signals, track relevance transitions | ~20 |
| `_patchSignals(delta)` | `batch(() => { for each delta field: update signal })` | ~30 |
| `setValue(path, value)` | Guard calculated fields, coerce type, update `_data`, `_evaluate()` | ~30 |
| `addRepeatInstance(name)` | Expand `_data` with defaults, create child signals, increment `repeats` signal, `_evaluate()`, return index | ~40 |
| `removeRepeatInstance(name, i)` | Shift data keys, remove last instance signals, decrement `repeats`, `_evaluate()` | ~50 |
| `getResponse(meta)` | Build response from `_data` + `_previousResult` (NRB already applied by Rust) | ~50 |
| `getValidationReport(opts)` | Aggregate from signal values; for `submit` mode, re-evaluate with submit-timing shapes | ~30 |
| `compileExpression(expr, ctx)` | Return `() => { read relevant signal values, call wasmEvalFELWithContext(expr, snapshot) }` — reactive when used inside `effect()` because it reads signals | ~20 |
| `evaluateShape(shapeId)` | Read from `shapeResults[shapeId]` signal, or call `_evaluate()` if demand-timing | ~10 |
| `isPathRelevant(path)` | Walk parent chain checking `relevantSignals` | ~10 |
| `getVariableValue(name, scope)` | Read from `variableSignals` | ~5 |
| `setRuntimeContext(ctx)` | Update `_nowProvider`, locale, timeZone; re-evaluate | ~15 |
| Options methods | Same as current engine — TS-owned option set resolution, remote fetch | ~50 |
| Instance methods | Same as current engine — TS-owned fetch/cache | ~40 |
| Screener/migration/replay/diagnostics | Same logic as current engine, simplified | ~80 |
| `getLabel`, `setLabelContext` | Trivial — same as current | ~10 |

**Dropped properties:** `dependencies` and `felRuntime` are removed from `IFormEngine`. No external consumer uses them. The 2 test files that assert on `engine.dependencies` are updated to remove those assertions.

- [ ] **Step 1: Write the new index.ts**

Build incrementally: start with imports, type re-exports, and an empty `FormEngine` class. Then add constructor, then `setValue`, then `_evaluate`, etc.

- [ ] **Step 2: Build**

Run: `npm --prefix packages/formspec-engine run build`

- [ ] **Step 3: Run new tests (Tasks 7-8)**

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-engine/src/index.ts
git commit -m "feat(engine): BatchFormEngine — Rust batch eval with signal patching"
```

---

## Phase 4 — Conformance & Migration

### Task 10: Run existing test suite, fix failures

**Files:**
- Modify: `packages/formspec-engine/src/index.ts` (as needed)

- [ ] **Step 1: Run full test suite**

Run: `npm --prefix packages/formspec-engine test`

Expected failure categories:
- **`compileExpression` tests** (~6 files) — should pass if `felRuntime` wrapper is correct
- **`dependencies` access** (~2 files) — should pass if populated at init
- **`FelLexer`/`parser` imports in test helpers** — if any test file imports these directly, update the import
- **Timing-sensitive tests** — batch eval patches synchronously in `batch()`, so signal reads after `setValue` should see updated values immediately
- **Precision/coercion edge cases** — may differ between TS coercion and Rust coercion

- [ ] **Step 2: Fix failures iteratively, commit after each batch of fixes**

- [ ] **Step 3: Achieve 100% pass rate**

Run: `npm --prefix packages/formspec-engine test`
Expected: All 62+ files pass.

- [ ] **Step 4: Commit**

### Task 11: Migrate Studio FEL tooling (MANDATORY)

**Files:**
- Modify: `packages/formspec-studio/src/lib/fel-editor-utils.ts`

This MUST happen before deleting `fel/lexer.ts` and `fel/parser.ts`.

- [ ] **Step 1: Read `fel-editor-utils.ts` to understand usage**

It imports `FelLexer`, `parser`, and `FormspecInstance`. It calls `FelLexer.tokenize(expression)` for syntax highlighting tokens and error detection.

- [ ] **Step 2: Replace with `tokenizeFEL` from WASM**

```typescript
// Before:
import { FelLexer, parser, type FormspecInstance } from 'formspec-engine';
const lexResult = FelLexer.tokenize(expression);

// After:
import { tokenizeFEL, type FormspecInstance } from 'formspec-engine';
const tokens = tokenizeFEL(expression);
```

Map token type names as needed (Chevrotain names → Rust names).

- [ ] **Step 3: Verify Studio builds**

Run: `npm --prefix packages/formspec-studio run build`

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-studio/
git commit -m "refactor(studio): migrate FEL editor from Chevrotain to wasmTokenizeFEL"
```

### Task 12: Delete old files and clean up

- [ ] **Step 1: Delete all 15 files listed in the deletion table**

- [ ] **Step 2: Remove `chevrotain` and `ajv` from `package.json` dependencies**

- [ ] **Step 3: `npm install` to update lockfile**

- [ ] **Step 4: Build and run full test suite**

Run: `npm --prefix packages/formspec-engine run build && npm --prefix packages/formspec-engine run test:unit`
Expected: Build succeeds (no dangling imports), all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A packages/formspec-engine/
git commit -m "refactor(engine): delete 3,980 lines of duplicated TS — Rust sole backend"
```

### Task 13: Verify all downstream packages

- [ ] **Step 1: Build each downstream package**

```bash
npm --prefix packages/formspec-core run build
npm --prefix packages/formspec-studio-core run build
npm --prefix packages/formspec-mcp run build
npm --prefix packages/formspec-webcomponent run build
npm --prefix packages/formspec-studio run build
```

Fix any import breakage — likely candidates:
- `SchemaValidationError` import in `formspec-mcp/src/registry.ts`
- `DocumentType` import in `formspec-mcp/src/tools/bootstrap.ts`
- `SchemaValidator` type in `formspec-core/src/types.ts`

- [ ] **Step 2: Run downstream tests**

```bash
npm --prefix packages/formspec-core run test
npm --prefix packages/formspec-studio-core run test
```

- [ ] **Step 3: Run E2E tests**

Run: `npm test` (Playwright from repo root)

- [ ] **Step 4: Commit any fixes**

### Task 14: Performance baseline

- [ ] **Step 1: Write and run performance test**

Use `tests/e2e/fixtures/` for the grant-app fixture (verify path first with `ls`). Measure average `setValue` time across 100 iterations. Budget: under 10ms.

- [ ] **Step 2: Commit**

---

## Verification Checklist

- [ ] `cargo test -p formspec-eval` — all Rust tests pass
- [ ] `cargo test -p formspec-wasm` — all WASM tests pass
- [ ] `npm --prefix packages/formspec-engine test` — all 62+ test files pass
- [ ] `npm --prefix packages/formspec-core run build && npm --prefix packages/formspec-core run test`
- [ ] `npm --prefix packages/formspec-studio-core run build && npm --prefix packages/formspec-studio-core run test`
- [ ] `npm --prefix packages/formspec-mcp run build`
- [ ] `npm --prefix packages/formspec-webcomponent run build`
- [ ] `npm --prefix packages/formspec-studio run build`
- [ ] `npm test` (E2E)
- [ ] `packages/formspec-engine/src/` contains exactly 4 files
- [ ] `package.json` has no `chevrotain` or `ajv` dependency
- [ ] No fallback code paths: `grep -r "fallback\|Fallback\|FALLBACK" packages/formspec-engine/src/` returns nothing
- [ ] Performance: grant-app batch eval under 10ms average

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Batch eval too slow for large forms | Performance test catches early. Escape: debounce keystrokes, add AST caching in Rust evaluator, eventual upgrade to stateful incremental (Option 3). |
| `formspec-eval` missing behaviors | Remote options, instance sources, pre-population, default-on-relevance, excludedValue, display calculates stay in TS as lifecycle. Track gaps during Task 10. |
| Downstream import breakage | No compat shims. Update downstream in Task 13. `createSchemaValidator` → `lintDocument`. Type aliases → import from `formspec-types`. |
| Runtime context not reaching Rust | Task 2 adds `EvalContext` with `nowIso` to the Rust evaluator. TS converts `_nowProvider` to ISO string before each WASM call. |
| `compileExpression` in batch model | Returns a function that reads current signal values and calls `wasmEvalFELWithContext`. Reactive when used inside `effect()` because reading `.value` from signals registers Preact dependencies. |
| Studio `FelLexer`/`parser` deletion | Task 11 migrates Studio BEFORE deletion in Task 12. Mandatory. |
