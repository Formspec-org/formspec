# Batch FormEngine Rewrite — Implementation Plan

> **Progress:** Phase 1-3 COMPLETE. Phase 4 remaining: remove legacy fallback imports from index.ts (Task 13), delete 15 dead files + remove chevrotain/ajv deps (Task 15), verify downstream packages (Task 16), performance baseline (Task 17). Task 14 (Studio migration) already done.

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

## Phase 1 — Rust Foundation ✅

### Task 1: Extend EvaluationResult in formspec-eval ✅

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs`

- [x] **Step 1: Write failing Rust tests for new fields**

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

- [x] **Step 2: Run tests, verify they fail**

Run: `cargo test -p formspec-eval`
Expected: Compilation errors — `required`, `readonly`, `shape_id` fields don't exist yet.

- [x] **Step 3: Implement the struct changes**

Add `shape_id: Option<String>` to `ValidationResult`. Add `required: HashMap<String, bool>` and `readonly: HashMap<String, bool>` to `EvaluationResult`.

Add `collect_mip_state()` helper. Update `evaluate_definition()` to collect and return the new fields. Update all `ValidationResult` construction sites: bind results get `shape_id: None`, shape results get `shape_id: Some(id)` (the shape ID is read from `shape.get("id")` — already extracted in `validate_shape()`).

- [x] **Step 4: Run tests, verify they pass**

Run: `cargo test -p formspec-eval`
Expected: All pass including new tests.

- [x] **Step 5: Commit**

```bash
git add crates/formspec-eval/
git commit -m "feat(eval): extend EvaluationResult with required, readonly, shape_id"
```

### Task 2: Fix calculate fixpoint iteration (CRITICAL) ✅

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs:383-540` (`recalculate` and `evaluate_items_with_inheritance`)

The Rust evaluator does a single tree-order pass for calculate expressions. If field A's calculate depends on field B's calculate, and B appears after A in the item tree, A sees B's stale value. The spec requires iterative evaluation until fixpoint (no new dirty nodes), up to a processor-defined limit of at least 100 iterations.

- [x] **Step 1: Write failing test**

```rust
#[test]
fn calculate_fixpoint_cross_field_dependency() {
    // subtotal appears AFTER total in tree order, but total depends on subtotal
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [
            { "key": "total", "type": "field", "dataType": "decimal", "label": "Total" },
            { "key": "subtotal", "type": "field", "dataType": "decimal", "label": "Sub" },
            { "key": "qty", "type": "field", "dataType": "decimal", "label": "Qty" },
        ],
        "binds": [
            { "path": "subtotal", "calculate": "$qty * 10" },
            { "path": "total", "calculate": "$subtotal * 1.1" },
        ],
    });
    let mut data = HashMap::new();
    data.insert("qty".into(), serde_json::json!(5));
    let result = evaluate_definition(&def, &data);
    assert_eq!(result.values.get("subtotal"), Some(&serde_json::json!(50)));
    assert_eq!(result.values.get("total"), Some(&serde_json::json!(55.0)));
}
```

- [x] **Step 2: Run test, verify it fails** (total gets stale subtotal value)

- [x] **Step 3: Implement fixpoint iteration for calculate evaluation**

Implemented as iterative fixpoint (`settle_calculated_values()` in `recalculate.rs:754-771`) — runs up to 100 iterations until no values change.

- [x] **Step 4: Run test, verify it passes**

- [x] **Step 5: Run full Rust test suite**

Run: `cargo test -p formspec-eval`

- [x] **Step 6: Commit**

### ~~excludedValue~~ VERIFIED ALREADY FIXED

`ItemInfo.excluded_value` exists in `types.rs:42`. Parsed from binds in `rebuild.rs:133-136`. Applied during Phase 2 evaluation at `recalculate.rs:300-305` via `env.set_field(&item.path, FelValue::Null)`. Also applied in Phase 3 via `apply_excluded_values_to_env()` in `revalidate.rs:31-32`.

### ~~Variable scope~~ VERIFIED ALREADY FIXED

`VariableDef.scope` exists in `types.rs:65`. `evaluate_variables_scoped()` in `recalculate.rs:217-256` handles scope-qualified keys. `visible_variables()` in `recalculate.rs:81-109` filters by ancestor path. `evaluate_items_with_inheritance_scoped()` in `recalculate.rs:502-541` clears/repopulates env per item.

### Task 3: Add shape context map ✅

**Files:**
- Modify: `crates/formspec-eval/src/revalidate.rs:422-494` (`validate_shape`)
- Modify: `crates/formspec-eval/src/types.rs:72-88` (`ValidationResult`)

**Verified still a problem:** `validate_shape()` never reads a `"context"` key from shape JSON. `ValidationResult` has no `context` field. The spec (spec.md:2584, 2663-2666) defines `context` as an object of FEL expressions evaluated when a shape fails, with results included in the output.

- [x] **Step 1: Write failing test**

```rust
#[test]
fn shape_context_evaluated_on_failure() {
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [
            { "key": "budget", "type": "field", "dataType": "decimal", "label": "Budget" },
            { "key": "spent", "type": "field", "dataType": "decimal", "label": "Spent" },
        ],
        "shapes": [{
            "id": "budget-check",
            "targets": ["spent"],
            "constraint": "$spent <= $budget",
            "constraintMessage": "Over budget",
            "context": {
                "remaining": "$budget - $spent",
                "overBy": "$spent - $budget"
            }
        }],
    });
    let mut data = HashMap::new();
    data.insert("budget".into(), serde_json::json!(100));
    data.insert("spent".into(), serde_json::json!(150));
    let result = evaluate_definition(&def, &data);
    let shape_result = result.validations.iter()
        .find(|v| v.shape_id.as_deref() == Some("budget-check"))
        .expect("shape validation should exist");
    let ctx = shape_result.context.as_ref().expect("context should be populated");
    assert_eq!(ctx.get("remaining"), Some(&serde_json::json!(-50)));
    assert_eq!(ctx.get("overBy"), Some(&serde_json::json!(50)));
}
```

- [x] **Step 2: Run test, verify it fails** (no `context` field on `ValidationResult`)

- [x] **Step 3: Implement**

Implemented: `context: Option<HashMap<String, Value>>` on `ValidationResult` (types.rs:95). `evaluate_shape_context()` in revalidate.rs:658-680 evaluates context expressions on shape failure.

- [x] **Step 4: Run test, verify it passes**

- [x] **Step 5: Run full suite:** `cargo test -p formspec-eval`

- [x] **Step 6: Commit**

### Task 4: Fix valid() MIP query ✅

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs:70-121` (`evaluate_definition_with_trigger`)
- Modify: `crates/formspec-eval/src/recalculate.rs:342-350` (`evaluate_single_item` set_mip)

**Verified still a problem:** `set_mip` hardcodes `valid: true` at `recalculate.rs:342-350` with comment `// updated in Phase 3` — but Phase 3 never updates it. Phase 2 and Phase 3 use **separate `FormspecEnvironment` instances** (`recalculate()` creates its own env; `revalidate()` creates a fresh env via `build_validation_env()`). There is no shared state to propagate validation results back.

For a batch-per-change architecture, the natural fix: accept **previous cycle's validation results** as input and use them to set MIP valid states at the START of Phase 2, before any expressions evaluate. This means `valid($field)` reflects the previous cycle's validation state — which matches XForms semantics.

- [x] **Step 1: Write failing test**

```rust
#[test]
fn valid_mip_query_reflects_validation_state() {
    let def = serde_json::json!({
        "$formspec": "1.0", "url": "test", "version": "1.0.0", "title": "T",
        "items": [
            { "key": "age", "type": "field", "dataType": "decimal", "label": "Age" },
            { "key": "ageStatus", "type": "field", "dataType": "string", "label": "Status" },
        ],
        "binds": [
            { "path": "age", "constraint": "$age >= 0", "required": "true" },
            { "path": "ageStatus", "calculate": "if(valid($age), 'ok', 'invalid')" },
        ],
    });
    // First eval: age is missing (required violation) → valid($age) = false
    let data = HashMap::new();
    let prev_validations = vec![]; // no previous results on first call
    let result = evaluate_definition(&def, &data);
    // On second eval, pass previous results so valid() can reflect them
    let result2 = evaluate_definition_with_context(
        &def, &data,
        &EvalContext {
            now_iso: None,
            previous_validations: Some(&result.validations),
        },
    );
    assert_eq!(result2.values.get("ageStatus"), Some(&serde_json::json!("invalid")));
}
```

- [x] **Step 2: Run test, verify it fails**

- [x] **Step 3: Implement**

Implemented: `previous_validations` on `EvalContext` (types.rs:112-116). MIP valid/relevant/readonly/required queries in `environment.rs:249-267`. Previous validation results propagated via `recalculate.rs:179-184`.

- [x] **Step 4: Run test, verify it passes**

- [x] **Step 5: Run full suite:** `cargo test -p formspec-eval`

- [x] **Step 6: Commit**

### Task 5: Add runtime context support to evaluate_definition ✅

**Files:**
- Modify: `crates/formspec-eval/src/lib.rs`

The batch evaluator currently uses system time for `today()`/`now()`. It must accept an injected `nowIso` for deterministic evaluation.

- [x] **Step 1: Write failing test**

- [x] **Step 2: Implement**

Implemented: `EvalContext` in `types.rs:112-116`. Five public API functions in `lib.rs:30-95` (`evaluate_definition`, `evaluate_definition_with_context`, `evaluate_definition_with_trigger`, `evaluate_definition_with_trigger_and_context`, `evaluate_definition_full_with_context`). Context applied in `recalculate.rs:134-135` via `env.set_now_from_iso()`.

- [x] **Step 3: Run tests, verify they pass**

- [x] **Step 4: Commit**

### Task 6: Wire extended result + context through WASM ✅

**Files:**
- Modify: `crates/formspec-wasm/src/lib.rs`
- Modify: `packages/formspec-engine/src/wasm-bridge.ts`

- [x] **Step 1: Update WASM `evaluateDefinition` to accept optional context and return extended fields**

Implemented in `crates/formspec-wasm/src/lib.rs:587-654`. Accepts `context_json` with `nowIso`, `trigger`, `previousValidations`. Returns `required`, `readonly`, `shapeId`, `context` on validations.

- [x] **Step 2: Update TS bridge**

Implemented in `wasm-bridge.ts:247-279`. Accepts optional context with `nowIso`, `trigger`, `previousValidations`.

- [x] **Step 3: Build and verify**

- [x] **Step 4: Commit**

### Task 7: Add tokenizeFEL to WASM ✅

**Files:**
- Modify: `crates/fel-core/src/` (expose positioned tokens)
- Modify: `crates/formspec-wasm/src/lib.rs`
- Modify: `packages/formspec-engine/src/wasm-bridge.ts`

- [x] **Step 1: Expose tokenize in fel-core**

Implemented: `tokenize()` in `fel-core/src/lib.rs:90-102` returning `PositionedToken` (lines 31-37).

- [x] **Step 2: Add WASM export and TS bridge wrapper**

WASM: `formspec-wasm/src/lib.rs:215-234`. TS: `wasm-bridge.ts:114-122` (`wasmTokenizeFEL`).

- [x] **Step 3: Build and test**

- [x] **Step 4: Commit**

---

## Phase 2 — TS Foundation ✅

### Task 8: Write and implement diff.ts ✅

**Files:**
- Create: `packages/formspec-engine/tests/batch-diff.test.mjs`
- Create: `packages/formspec-engine/src/diff.ts`

- [x] **Step 1: Write failing tests** (covers: no previous result, unchanged values, changed values, null transitions, money objects, relevance, required, readonly, validations, shape result grouping by shapeId, variables, new fields, removed fields)

- [x] **Step 2: Run tests, verify they fail**

- [x] **Step 3: Implement `diffEvalResults` in `diff.ts`** (~175 lines, pure function diffing two EvalResults → EvalDelta)

- [x] **Step 4: Run tests, verify they pass**

- [x] **Step 5: Commit**

### Task 9: Update interfaces.ts with all absorbed types ✅

**Files:**
- Modify: `packages/formspec-engine/src/interfaces.ts`

- [x] **Step 1: Copy all type definitions from the files being deleted**

All types absorbed into `interfaces.ts`.

- [x] **Step 2: Verify build**

- [x] **Step 3: Commit**

---

## Phase 3 — BatchFormEngine ✅

### Task 10: Write core engine tests ✅

**Files:**
- Create: `packages/formspec-engine/tests/batch-engine-core.test.mjs`

These are GREEN baseline tests — they must pass against the current engine AND the new one.

- [x] **Step 1: Write tests** — `tests/batch-engine-core.test.mjs` (~80+ lines)

- [x] **Step 2: Run against engine to confirm they pass (GREEN)**

- [x] **Step 3: Commit**

### Task 11: Write repeat lifecycle tests ✅

- [x] **Step 1: Write tests** — `tests/batch-repeat-lifecycle.test.mjs` (~100+ lines)

- [x] **Step 2: Verify GREEN against engine**

- [x] **Step 3: Commit**

### Task 12: Implement BatchFormEngine (index.ts rewrite) ✅

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
  private _previousNonRelevant: Set<string> = new Set(); // for relevance transition detection
  private _calculatedFields: Set<string>;
  private _bindDefaults: Map<string, any>; // path → default value from binds
  private _nowProvider: (() => string) | null = null;
}
```

Key methods to implement:

| Method | Strategy | ~Lines |
|---|---|---|
| `constructor` | Create signal maps from item tree, resolve option sets, identify calculated fields, run initial `_evaluate()`, kick off async fetches | ~80 |
| `_evaluate()` | Build nowIso from `_nowProvider`, call `wasmEvaluateDefinition(def, data, { nowIso })`, diff, patch signals, detect relevance transitions (compare `_previousNonRelevant` with new `nonRelevant`), apply `default` values for newly-relevant fields, re-eval if defaults changed data, filter shape results by timing mode | ~70 |
| `_patchSignals(delta)` | `batch(() => { for each delta field: update signal })` | ~30 |
| `setValue(path, value)` | Guard calculated fields, coerce type, update `_data`, `_evaluate()` | ~30 |
| `addRepeatInstance(name)` | Expand `_data` with defaults, create child signals, increment `repeats` signal, `_evaluate()`, return index | ~40 |
| `removeRepeatInstance(name, i)` | Shift data keys, remove last instance signals, decrement `repeats`, `_evaluate()` | ~50 |
| `getResponse(meta)` | Build response from `_data` + `_previousResult` (NRB already applied by Rust) | ~50 |
| `getValidationReport(opts)` | Aggregate from signal values; for `submit` mode, re-evaluate with submit-timing shapes | ~30 |
| `compileExpression(expr, ctx)` | Return `() => { read relevant signal values, call wasmEvalFELWithContext(expr, cachedContext) }`. Build `WasmFelContext` once per `_evaluate()` cycle, cache it, reuse across all `compileExpression` calls. Reactive inside `effect()` because it reads signals. | ~20 |
| `evaluateShape(shapeId)` | Read from `shapeResults[shapeId]` signal, or call `_evaluate()` if demand-timing | ~10 |
| `isPathRelevant(path)` | Walk parent chain checking `relevantSignals` | ~10 |
| `getVariableValue(name, scope)` | Read from `variableSignals` | ~5 |
| `setRuntimeContext(ctx)` | Update `_nowProvider`, locale, timeZone; re-evaluate | ~15 |
| Options methods | Same as current engine — TS-owned option set resolution, remote fetch | ~50 |
| Instance methods | Same as current engine — TS-owned fetch/cache | ~40 |
| Screener/migration/replay/diagnostics | Same logic as current engine, simplified | ~80 |
| `getLabel`, `setLabelContext` | Trivial — same as current | ~10 |

**Dropped properties:** `dependencies` and `felRuntime` are removed from `IFormEngine`. No external consumer uses them. The 2 test files that assert on `engine.dependencies` are updated to remove those assertions.

- [x] **Step 1: Write the new index.ts**

Fully rewritten: ~3,058 lines. `FormEngine` class at line 272+ uses `wasmEvaluateDefinition` → `diffEvalResults` → `batch()` signal patching. WASM-only, no fallback paths.

- [x] **Step 2: Build**

- [x] **Step 3: Run new tests (Tasks 10-11)** — All PASS.

- [x] **Step 4: Commit**

---

## Phase 4 — Conformance & Migration

### Task 13: Run existing test suite, fix failures — IN PROGRESS

**Files:**
- Modify: `packages/formspec-engine/src/index.ts` (as needed)

**Status:** Engine tests appear to be passing. However, `index.ts` still imports from 4 legacy files as fallbacks:
- `./assembler.js` (line 21)
- `./fel/analysis.js` (line 22, as `legacyAnalyzeFEL`)
- `./fel/rewrite.js` (line 23, as `legacyRewriteFELReferences`)
- `./runtime-mapping.js` (line 53, as `LegacyRuntimeMappingEngine`)

These legacy imports must be removed before Task 15 can delete the files.

- [ ] **Step 1: Remove legacy fallback imports from index.ts**

Remove the 4 legacy imports and any code paths that use them. The WASM versions are the sole backends now.

- [ ] **Step 2: Run full test suite, verify no regressions**

Run: `npm --prefix packages/formspec-engine test`

- [ ] **Step 3: Commit**

### Task 14: Migrate Studio FEL tooling (MANDATORY) ✅

**Files:**
- Modify: `packages/formspec-studio/src/lib/fel-editor-utils.ts`

Already migrated — `fel-editor-utils.ts` now imports `analyzeFEL, tokenizeFEL` from `formspec-engine` (no `FelLexer`/`parser`).

- [x] **Step 1-4: Complete** — Studio uses `tokenizeFEL(expression)` for syntax highlighting.

### Task 15: Delete old files and clean up

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

### Task 16: Verify all downstream packages

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

### Task 17: Performance baseline

- [ ] **Step 1: Write and run performance test**

Use `tests/e2e/fixtures/` for the grant-app fixture (verify path first with `ls`). Measure average `setValue` time across 100 iterations. Budget: under 10ms.

- [ ] **Step 2: Commit**

---

## Verification Checklist

- [x] `cargo test -p formspec-eval` — all Rust tests pass
- [x] `cargo test -p formspec-wasm` — all WASM tests pass
- [ ] `npm --prefix packages/formspec-engine test` — all 62+ test files pass (need to verify after legacy import removal)
- [ ] `npm --prefix packages/formspec-core run build && npm --prefix packages/formspec-core run test`
- [ ] `npm --prefix packages/formspec-studio-core run build && npm --prefix packages/formspec-studio-core run test`
- [ ] `npm --prefix packages/formspec-mcp run build`
- [ ] `npm --prefix packages/formspec-webcomponent run build`
- [ ] `npm --prefix packages/formspec-studio run build`
- [ ] `npm test` (E2E)
- [ ] `packages/formspec-engine/src/` contains exactly 4 files (currently 19 — 15 legacy files remain)
- [ ] `package.json` has no `chevrotain` or `ajv` dependency (both still present)
- [ ] No fallback code paths (4 legacy imports remain in index.ts)
- [ ] Performance: grant-app batch eval under 10ms average

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Batch eval too slow for large forms | Performance test catches early. Escape: debounce keystrokes, add AST caching in Rust evaluator, eventual upgrade to stateful incremental (Option 3). |
| `formspec-eval` missing behaviors | excludedValue and variable scope already implemented. Remaining Rust gaps (calculate fixpoint, shape context, valid() MIP) fixed in Phase 1 Tasks 2-4. TS lifecycle: remote options, instance sources, pre-population, default-on-relevance-transition (TS-side state tracking in `_evaluate()`). |
| Downstream import breakage | No compat shims. Update downstream in Task 13. `createSchemaValidator` → `lintDocument`. Type aliases → import from `formspec-types`. |
| Runtime context not reaching Rust | Task 2 adds `EvalContext` with `nowIso` to the Rust evaluator. TS converts `_nowProvider` to ISO string before each WASM call. |
| `compileExpression` in batch model | Returns a function that reads current signal values and calls `wasmEvalFELWithContext`. Reactive when used inside `effect()` because reading `.value` from signals registers Preact dependencies. |
| Shape timing (submit/demand) | Rust evaluates all shapes. TS filters by timing mode: `_evaluate()` only patches continuous-timing shapes into signals. `getValidationReport({mode:'submit'})` includes submit-timing. `evaluateShape(id)` handles demand-timing. |
| Studio `FelLexer`/`parser` deletion | Task 14 migrates Studio BEFORE deletion in Task 15. Mandatory. |
