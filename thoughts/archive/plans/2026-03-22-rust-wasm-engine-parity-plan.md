# Plan: Rust / WASM parity for engine-adjacent logic

**Status:** Draft  
**Scope:** `crates/*` primary; `packages/formspec-engine` consumes new surfaces and deletes duplicate logic.  
**Explicitly out of scope:** CSV/XML builders in `RuntimeMappingEngine` (remain TypeScript).

**Parity bar (TS ↔ Rust ↔ Python):** For this plan, “parity” means **one normative implementation in Rust** consumed through **`formspec-wasm` + `wasm-bridge.ts`** and **`formspec-py` + `_rust.py`** with the same JSON-ish contracts (eval context, coercion, option sets, migrations, assembly rewrite, FEL prep). Continuous eval defers shape timing to Rust `revalidate` (no redundant TS filter on the WASM validation stream).

**Progress (2026-03-22):** Phase 1 landed: `EvalContext.repeat_counts`, JSON parsing (`repeatCounts` / `repeat_counts`), public `eval_context_from_json_object` in `formspec-eval`, PyO3 `evaluate_def(..., context=None)` + `_rust.py` `evaluate_definition(..., context=None)`, TS `wasmEvaluateDefinitionPayload({ repeatCounts })`, and `mergeWasmEvalWithExternalValidations` (replaces TS-side repeat cardinality strip/re-add). **Phase 2 landed:** `fel-core` `prepare_host` (`prepare_fel_expression_for_host`, JSON map → `PrepareFelHostOptionsOwned`), WASM `prepareFelExpression`, TS `wasmPrepareFelExpression` + `normalizeExpressionForWasmEvaluation` delegates to Rust, PyO3 `prepare_fel_expression`. **Phase 3 landed:** `formspec-core` `value_coerce::coerce_field_value`, WASM `coerceFieldValue`, TS `wasmCoerceFieldValue` + `coerceFieldValue` delegates to Rust, PyO3 `coerce_field_value` on `formspec_rust`. **Phase 4 landed:** `formspec-core` `option_sets::resolve_option_sets_on_definition`, WASM `resolveOptionSetsOnDefinition`, TS `wasmResolveOptionSetsOnDefinition` + `resolveOptionSetsOnDefinition` / `FormEngine` constructor use Rust, PyO3 `resolve_option_sets_on_definition`. **Phase 5 landed:** `formspec-core` `response_migration::apply_migrations_to_response_data`, WASM `applyMigrationsToResponseData`, TS `wasmApplyMigrationsToResponseData` + `migrateResponseData` delegates to Rust, PyO3 + `_rust.py` `apply_migrations_to_response_data`. **Phase 6 landed:** `formspec-core` `assembly_fel_rewrite` (`AssemblyFelRewriteMap`, `rewrite_fel_for_assembly`, shared with assembler), WASM `rewriteFelForAssembly`, TS `wasmRewriteFelForAssembly` + `rewriteFEL` delegates to Rust, PyO3 + `_rust.py` `rewrite_fel_for_assembly`.

## Goal

Move normative transforms and business rules that today live only in TypeScript into the Rust stack (`fel-core`, `formspec-core`, `formspec-eval`, `formspec-wasm`) so **browser (TS+WASM), Node tooling, and Python (`src/formspec/`)** share one implementation. After each phase, TypeScript should be able to delete or thin the corresponding shim; Python should gain or extend wrappers in `src/formspec/_rust.py` where the public API needs new knobs.

## Success criteria (program-wide)

- Same inputs produce equivalent outputs across TS engine smoke tests, `formspec-eval` integration tests, `formspec-py` `#[cfg(test)]` modules, and **`python3 -m pytest`** where behavior is user-visible.
- `wasm-pack` / `formspec-wasm` exports are documented in `crates/formspec-wasm/README.md` and mirrored in `packages/formspec-engine/src/wasm-bridge.ts`.
- **`src/formspec/_rust.py`**: extend `evaluate_definition`, `evaluate()`, and any new exports while keeping **`EXPECTED_PY_API_VERSION` / `_REQUIRED_EXPORTS`** in sync with `crates/formspec-py/src/lib.rs` (bump `PY_API_VERSION` when the native contract changes).
- No new upward dependency violations; WASM stays in `formspec-wasm` / engine bridge only.

---

## Python (`src/formspec/`) cross-reference

The published Python package is a **thin layer over PyO3** (`formspec_rust`). Almost all batch eval and FEL run in Rust; Python adds type shaping, small normalizers, and API ergonomics.

| Python surface | File(s) | Role today |
|----------------|---------|------------|
| Batch definition eval | `src/formspec/_rust.py` → `evaluate_definition()` | Calls `formspec_rust.evaluate_def(..., context=None)`; optional `context` dict mirrors WASM keys (`now_iso` / `nowIso`, `repeat_counts` / `repeatCounts`, `previous_validations`, …). |
| PyO3 entry | `crates/formspec-py/src/document.rs` → `evaluate_def` | Uses `evaluate_definition_full_with_instances_and_context` with optional `context` dict parsed via `eval_context_from_json_object`. |
| FEL eval | `src/formspec/_rust.py` → `evaluate()` | `eval_fel_detailed(source, data, …)` with MIP/variables serialization; **raw `source` string** — no TS-style `prepareFelExpression`. |
| Lint / detect type | `_rust.py` → `lint`, `detect_document_type` | Delegates to Rust. |
| Changelog **generation** | `_rust.py` → `generate_changelog` | Rust `formspec_core` changelog diff. |
| Response **migration** | `_rust.py` → `apply_migrations_to_response_data` | Rust `apply_migrations_to_response_data` (definition `migrations` array + flat field data). |
| Mapping | `_rust.py` → `execute_mapping` | Rust `execute_mapping_doc` (object graph only; CSV/XML are separate in TS adapters, out of this plan). |
| Path helper | `_rust.py` → `canonical_item_path` | Pure Python path normalization (validator-adjacent; unrelated to eval context). |
| Conformance / validate driver | `src/formspec/validate.py` | Uses `evaluate_definition`, `generate_changelog`, `lint`; will need updates if eval signature or semantics change. |

**Phase 1 note:** Python batch eval now threads `EvalContext` via optional `context` (see table above). Contract tests: `_assert_rust_extension_contract` in `_rust.py` and `tests/unit/test_rust_bridge.py` expect `evaluate_def` parameters including `context`.

### Per-phase Python impact

| Phase | `src/formspec/` / `formspec-py` action |
|-------|----------------------------------------|
| **1** | Extend PyO3 `evaluate_def` + `_rust.py` `evaluate_definition` with optional context dict including **`repeat_counts`**. Bump **`PY_API_VERSION`** if the positional contract changes; if only optional kwargs are added, document and extend `_REQUIRED_EXPORTS` only if new top-level exports appear. Integration tests in `tests/` for min/max repeat with sparse data + explicit counts. |
| **2** | Add `formspec_rust.prepare_fel_expression` (or name TBD) in `crates/formspec-py/src/fel.rs`, re-export in `lib.rs`, wrap in `_rust.py` if authors should call it; otherwise keep internal to Rust and optional from Python. |
| **3** | New PyO3 `coerce_field_value` + `_rust.py` wrapper if servers must coerce before `evaluate_definition`; otherwise document “coercion at eval boundary only.” |
| **4** | Optional `resolve_option_sets_on_definition` in PyO3 + `_rust.py` for CLI/validate pipelines that today pass raw definitions into Rust unchanged. |
| **5** | **Done:** PyO3 `apply_migrations_to_response_data` + `_rust.py` wrapper + `_REQUIRED_EXPORTS`. |
| **6** | **Done:** PyO3 `rewrite_fel_for_assembly` + `_rust.py` + `_REQUIRED_EXPORTS`. |
| **7** | If Rust output shape changes, update `_rust.py` only if `evaluate_definition` / `ProcessingResult` mapping needs new fields; otherwise N/A. |

---

## Phase 1 — Repeat cardinality + REQUIRED copy (fast win)

**Problem:** TypeScript `mergeWasmEvalWithRepeatCardinality` strips WASM `cardinality` validations and recomputes MIN/MAX repeat using signal-backed counts because Rust `detect_repeat_count` only inspects flat `values` keys. Bind-level REQUIRED message strings differ (`Required` vs `Required field is empty`).

### Rust / WASM work

| Area | Action |
|------|--------|
| `formspec-eval/src/types/evaluation.rs` | Extend `EvalContext` with `repeat_counts: Option<HashMap<String, u64>>` (default `None` preserves current behavior). |
| `formspec-eval/src/eval_json.rs` | Parse optional `repeatCounts` / `repeat_counts` from the JSON object already passed to `evaluateDefinition`. |
| `formspec-eval/src/pipeline.rs` | Thread `context.repeat_counts` into `revalidate` (both call sites ~L142 and ~L165). |
| `formspec-eval/src/revalidate/mod.rs` | Add parameter `repeat_counts: Option<&HashMap<String, u64>>`; forward to `validate_items`. |
| `formspec-eval/src/revalidate/items.rs` | For repeatable cardinality (~L134–167), use `repeat_counts` for `item.path` when present, else `detect_repeat_count(&item.path, values)`. |
| `formspec-eval/src/revalidate/items.rs` | Set bind REQUIRED `message` to `Required` (align with TS normalization). |
| `formspec-eval/tests/integration/evaluate_pipeline.rs` | Tests: sparse `_data` + `repeatCounts` still enforces min/max; update REQUIRED message expectations. |
| `formspec-py/src/document.rs` | Switch to `evaluate_definition_full_with_instances_and_context` when wiring context; add optional Python `context` dict (see **Python cross-reference**). |
| `src/formspec/_rust.py` | Forward `repeat_counts` / full eval context; update signature guard in `_assert_rust_extension_contract` if parameters change. |

### TypeScript follow-up

- **Done:** `repeatCounts` from `FormEngine.repeatCountsSnapshot()` in `wasmEvaluateDefinitionPayload`; `mergeWasmEvalWithRepeatCardinality` replaced by `mergeWasmEvalWithExternalValidations` (external validations only).

---

## Phase 2 — `prepareFelExpression` (FEL normalization in Rust)

**Problem:** `normalizeExpressionForWasmEvaluation` in `packages/formspec-engine` (repeat aliases, qualified group refs, bare current-field, implicit repeat paths) can drift from `fel-core`.

### Rust / WASM work

| Area | Action |
|------|--------|
| `fel-core` | New module (e.g. `prepare_host.rs`) implementing normalization; inputs: expression, `current_item_path`, `replace_self_ref`, repeat alias roots (longest-first), and data needed for qualified refs (port from TS + add tests). |
| `fel-core` | Unit tests mirroring critical TS cases (self-ref, nested repeat, wildcard alias expansion). |
| `formspec-wasm/src/fel.rs` | `#[wasm_bindgen(js_name = "prepareFelExpression")]` — JSON options + string in/out. |
| `formspec-py/src/fel.rs` + `lib.rs` | Optional `prepare_fel_expression` for Python FEL tests or authoring tools. |
| `formspec-eval` | Optional: internal callers use the same helper before constraint/calculate eval if expressions are ever normalized in multiple places (single source of truth). |

### TypeScript follow-up

- **Done:** `wasmPrepareFelExpression` + `normalizeExpressionForWasmEvaluation` serializes options and calls WASM `prepareFelExpression`.

---

## Phase 3 — Inbound field coercion

**Problem:** `coerceFieldValue` in `engine/helpers.ts` encodes whitespace modes, numeric string parsing, money object shape, and `precision` rounding — server and client can disagree.

### Rust / WASM work

| Area | Action |
|------|--------|
| `formspec-core` or `formspec-eval` | New module `value_coerce.rs` (or under `formspec-core` if shared with lint/changelog): `coerce_field_value` from JSON fragments (`item`, `bind`, definition presentation defaults) + raw `Value`. |
| Tests | Golden vectors from TS behavior / spec examples. |
| `formspec-wasm` | `#[wasm_bindgen(js_name = "coerceFieldValue")]` **or** document that coercion runs only at pipeline entry in `evaluate_definition` (pick one contract and document it). |
| `formspec-py` + `_rust.py` | Optional thin wrapper for servers coercing inbound JSON before eval. |

### TypeScript follow-up

- **Done:** `coerceFieldValue` in `helpers.ts` calls `wasmCoerceFieldValue` (same contract as `setValue` today).

---

## Phase 4 — Materialize `optionSets` on definitions

**Problem:** TS `resolveOptionSetsOnDefinition` mutates items in place; Rust eval/lint see `optionSet` references unless inlined.

### Rust / WASM work

| Area | Action |
|------|--------|
| `formspec-core` | `resolve_option_sets_on_definition(def: &mut Value)` — walk `items`, match TS semantics (array vs `{ options: [...] }`). |
| `formspec-wasm` | `prepareDefinition` (or named `resolveOptionSetsOnDefinition`) returning JSON string. |
| `formspec-py` + `_rust.py` | Optional export for validate/CLI pipelines. |
| Tests | Round-trip: field with `optionSet` gains `options`; unknown set behavior matches spec/TS. |

### TypeScript follow-up

- **Done:** `resolveOptionSetsOnDefinition` delegates to `wasmResolveOptionSetsOnDefinition`; `FormEngine` assigns the returned definition.

---

## Phase 5 — Response changelog application in Rust

**Problem:** `migrateResponseData` in TS walks `migrations` and evaluates `transform` via FEL callback.

### Rust / WASM work

| Area | Action |
|------|--------|
| `formspec-core` or `formspec-eval` | `apply_migrations_to_response_data(definition, response_data, from_version, now_iso) -> Result<Value, …>` using existing FEL eval and a minimal environment (flattened fields like TS `flattenObject`). |
| `formspec-wasm/src/changelog.rs` (or existing module) | WASM export returning JSON. |
| `formspec-py/src/changelog.rs` + `_rust.py` | Sibling to existing `generate_changelog`; new `apply_migrations_to_response` (name TBD). |
| Tests | Changelog fixtures: rename, remove, add, transform. |

### TypeScript follow-up

- **Done:** `migrateResponseData` calls `wasmApplyMigrationsToResponseData` when `migrations` is an array.

---

## Phase 6 — Fragment assembly `rewriteFEL` in Rust

**Problem:** `rewriteFEL` in `fel/fel-api.ts` builds rewrite maps in TS from `RewriteMap` + `wasmCollectFELRewriteTargets`, then calls `wasmRewriteFELReferences`.

### Rust / WASM work

| Area | Action |
|------|--------|
| `formspec-core` | **Done:** `assembly_fel_rewrite` module — `rewrite_fel_for_assembly` + `assembly_fel_rewrite_map_from_value` (assembler shares the same map + callbacks). |
| Tests | **Done:** Rust unit tests + `formspec-wasm` native test; TS `assembler-fel-rewrite.test.mjs` unchanged. |
| `formspec-wasm/src/fel.rs` | **Done:** `#[wasm_bindgen(js_name = "rewriteFelForAssembly")]`. |
| `formspec-py` + `_rust.py` | **Done:** `rewrite_fel_for_assembly`. |

### TypeScript follow-up

- **Done:** `rewriteFEL` calls `wasmRewriteFelForAssembly` with JSON `RewriteMap`.

---

## Phase 7 — Shape validation stream (**out of scope for TS↔Rust↔Py parity**)

Not required for the parity bar above. Rust already filters shapes by `EvalTrigger` in `revalidate` (e.g. continuous eval omits submit/demand shapes); Python and WASM batch eval share that behavior.

**Done (TS cleanup):** Removed `filterEvalResultContinuousShapes`; reactive eval diffs use the WASM `continuous` result as-is. A **product-only** split-shape JSON payload remains out of scope for parity.

---

## Dependency order

```text
Phase 1 ──► TS can slim wasm-eval shaping
   │
Phase 2 ──► TS drops FEL string prep (depends on stable WASM ABI)
   │
Phase 3 ──► TS drops coerceFieldValue (coordinate with setValue contract)
   │
Phase 4 ──► independent of 2–3 but pairs well with Phase 1 testing (definitions)
   │
Phase 5 ──► uses FEL + JSON (after Phase 2 recommended)
   │
Phase 6 ──► uses existing rewrite targets (can follow Phase 2)
```

Phase 7 — optional TS-only / product follow-up; **not** part of parity dependency order.

## Verification checklist (each phase)

- `cargo test -p formspec-eval` (and affected crates).
- `wasm-pack build` for `formspec-wasm`; `npm run build` in `packages/formspec-engine`.
- `python3 -m pytest tests/` where Python calls eval with new context fields.
- Update or add JSON schema / spec notes if new context keys are part of the public WASM contract.

## References

- TS sources to retire or thin: `packages/formspec-engine/src/engine/wasm-fel.ts` (merge/filter/normalize). **Done (thinned):** `coerceFieldValue`, `resolveOptionSetsOnDefinition`, `migrateResponseData`, `rewriteFEL` delegate to WASM/Rust.
- Rust anchors: `formspec-eval/src/revalidate/mod.rs`, `revalidate/items.rs`, `eval_json.rs`, `pipeline.rs`, `crates/formspec-wasm/src/evaluate.rs`, `fel.rs`.
- Python anchors: `src/formspec/_rust.py` (public API + `formspec_rust` contract), `src/formspec/validate.py` (orchestration), `crates/formspec-py/src/document.rs` (`evaluate_def`), `crates/formspec-py/src/lib.rs` (`PY_API_VERSION`, `#[pymodule]` exports).
