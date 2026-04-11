# Rust Decommission Tasks

Status: **Complete** — extracted from `2026-03-18-rust-merge-reconciliation.md` on 2026-03-20 and converted into an execution backlog. Revised 2026-03-20 after spec-scout review against the full specification suite. Completed later on 2026-03-20 after runtime, bridge, and Python-backend decommission verification.

## Goal

Replace the remaining TypeScript and Python FEL/runtime logic with Rust where that replacement is practical, while explicitly separating:

- **runtime decommission** — production FEL/runtime code paths move to Rust/WASM or Rust/PyO3
- **tooling decommission** — editor-facing parser/lexer tooling moves off Chevrotain only if the cost is justified

External consumers are migration targets, not blockers. The only real blocker is parity at the engine/runtime boundary.

## Current State

- Rust is the only FEL execution backend in Python.
- WASM is the default FEL backend in TypeScript runtime paths.
- `fel/interpreter.ts`, `fel/dependency-visitor.ts`, and `fel/chevrotain-runtime.ts` are already out of the working runtime path.
- Engine/runtime parity that originally blocked this backlog is green again.
- The remaining TypeScript files in this area are compatibility wrappers or Studio-only tooling, not runtime blockers.

## Final Verification

- `cargo test -p formspec-py --no-default-features`
- `PYTHONPATH="/tmp/formspec-py-site.76ewpZ:src" python3 -m pytest tests/unit -q`
- `PYTHONPATH="/tmp/formspec-py-site.76ewpZ:src" python3 -m pytest tests/conformance/spec/test_fel_spec_examples.py tests/conformance/spec/test_cross_spec_contracts.py -q`
- `PYTHONPATH="/tmp/formspec-py-site.76ewpZ:src" python3 -m pytest tests/conformance/fuzzing/test_fel_property_based.py -q`

## Out of Scope

The following spec-normative behaviors stay in the TS reactive engine (`index.ts`) and are **not** migration targets. They depend on Preact Signals reactivity, relevance-transition tracking, or engine lifecycle features that have no Rust equivalent and no reason to move.

| Behavior | Rationale |
|---|---|
| `default` bind (relevance-transition re-initialization) | Reactive effect watching relevance flips; lives in `index.ts:1518-1542`. Only meaningful in the live reactive engine. |
| `excludedValue` bind (`"preserve"` / `"null"` for non-relevant fields) | Reactive downstream propagation; lives in `index.ts:1803-1806`. Rust batch evaluator receives pre-resolved values from the TS side. |
| `initialValue` / `prePopulate` (one-shot initialization pass) | Engine lifecycle concern; lives in `index.ts:1224-1253`. Rust evaluator starts with pre-populated `data`. |
| Screener routing evaluation | Route condition evaluation and classification dispatch. TS-only engine feature. Linter validates screener FEL statically via Rust. |
| Version migration (`migrations.from[version]`) | Definition-level schema transform; lives in `index.ts:2382-2420`. Runs before evaluation, not during. |
| Extension function WASM registration | No WASM bridge for registering custom extension functions at runtime. Deferred until a product need is demonstrated. Extension *validation* (lint-time) already works through Rust. |
| Variable scope resolution | TS engine pre-resolves scoped variables (`getVariableValue(name, itemPath)`) before passing values to WASM. Rust environment has a flat HashMap — no `scope` awareness needed as long as the TS side pre-resolves. Moving scope resolution to Rust is only needed if Task 3.3 moves variable lookup entirely out of the TS engine. |

## Task List

### Phase 1 — Finish TS Runtime Parity

#### Task 1.1 — Repeat and instance context parity

- [x] Update `packages/formspec-engine/src/fel/wasm-runtime.ts` to build row-shaped repeat context payloads instead of scalar-only `current` values.
- [x] Include full row objects in the `collection` array — `prev()`, `next()`, and `parent()` all return row objects, not field scalars.
- [x] Ensure writable instances participate in the same lookup and context path resolution.
- [x] Verify with:
  - `packages/formspec-engine/tests/nested-repeats.test.mjs`
  - `packages/formspec-engine/tests/writable-instances.test.mjs`
  - repeat-context engine tests

**Primary files:**
- `packages/formspec-engine/src/fel/wasm-runtime.ts`
- `packages/formspec-engine/src/index.ts`
- `crates/formspec-wasm/src/lib.rs`
- `crates/fel-core/src/environment.rs`

**Exit criteria:** repeat navigation and writable instance tests pass without TS fallback logic. `@current` returns the full row object, not a scalar.

#### Task 1.2 — Money operator parity

- [x] Add handling for `money + number`, `money - number`, and `money % number` in the Rust evaluator — these currently fall through to generic "cannot add/subtract/modulo" errors.
- [x] Verify `money / number` (already partially handled at `evaluator.rs:406-411`) matches legacy semantics.
- [x] Fix money variable chains in Rust (`@totalDirect`, `@indirectCosts`, `@grandTotal`, `@projectPhasesTotal`) rather than compensating in the TS bridge.
- [x] Verify with:
  - `packages/formspec-engine/tests/money-arithmetic.test.mjs`
  - affected assertions in `packages/formspec-engine/tests/nested-repeats.test.mjs`

**Primary files:**
- `crates/fel-core/src/evaluator.rs`
- money helper modules in `crates/fel-core/src/`

**Exit criteria:** all six money-with-number operator combinations (`+ - * / % ==`) produce the same results as the legacy TS evaluator.

#### Task 1.3 — Validation and diagnostics parity

- [x] Restore shape and bind validation behavior when expressions run through WASM.
- [x] Preserve `FEL_RUNTIME` mapping diagnostics in `RuntimeMappingEngine`.
- [x] Eliminate false positives caused by incomplete runtime context serialization.
- [x] Verify with:
  - `packages/formspec-engine/tests/validation-shapes-and-binds.test.mjs`
  - `packages/formspec-engine/tests/runtime-mapping-phases123.test.mjs`
  - `packages/formspec-engine/tests/runtime-diagnostics-and-replay.test.mjs`
  - affected shared-suite fixtures

**Primary files:**
- `packages/formspec-engine/src/index.ts`
- `packages/formspec-engine/src/runtime-mapping.ts`
- `packages/formspec-engine/src/fel/wasm-runtime.ts`

**Exit criteria:** validation results and runtime diagnostics match the expected contract under WASM-only execution.

#### Task 1.4 — Built-in function catalog metadata

- [x] Add a proper metadata structure in Rust — not just function names. Each entry needs: name, signature (parameter types + return type), and description. Match the shape of `FELBuiltinFunctionCatalogEntry`.
- [x] Export the metadata from Rust/WASM.
- [x] Wire it through `packages/formspec-engine/src/wasm-bridge.ts`.
- [x] Return real metadata from `WasmFelRuntime.listBuiltInFunctions()`.
- [x] Verify with `packages/formspec-engine/tests/fel-analysis-and-rewrite.test.mjs`.

**Primary files:**
- `crates/fel-core/src/extensions.rs` (currently `BUILTIN_FUNCTIONS` is names-only)
- `crates/formspec-wasm/src/lib.rs`
- `packages/formspec-engine/src/wasm-bridge.ts`
- `packages/formspec-engine/src/fel/wasm-runtime.ts`

**Exit criteria:** function catalog tests pass with full signature/description metadata. Studio catalog consumers stop depending on TS-only metadata.

#### Task 1.5 — Error contract cleanup

- [x] Decide whether `FelUnsupportedFunctionError` remains a public compatibility contract.
- [x] Either restore a compatibility wrapper or update tests/consumers to the new runtime error contract.
- [x] Ensure mapping and engine runtime failures use one consistent shape.

**Primary files:**
- `packages/formspec-engine/src/index.ts`
- affected tests in `packages/formspec-engine/tests/`

**Exit criteria:** no tests depend on deleted error classes unless they have been intentionally restored.

#### Task 1.6 — Shape composition operators

The Rust batch evaluator (`formspec-eval`) only evaluates the `constraint` property of shapes. It ignores `and`, `or`, `not`, and `xone` composition operators entirely. Any definition using composed shapes produces incorrect validation results through the Rust path.

- [x] Implement `and`, `or`, `not`, and `xone` shape composition in `validate_shape()` in `crates/formspec-eval/src/lib.rs`.
- [x] Match the null-handling semantics of the TS engine implementation (`index.ts:948-992`).
- [x] Verify with Rust/WASM evaluator coverage for composed shapes and null semantics.

**Primary files:**
- `crates/formspec-eval/src/lib.rs` (`validate_shape` at ~line 634)

**Exit criteria:** composed shape validation produces identical results to the TS engine for all composition operators.

#### Task 1.7 — `constraintMessage` in validation results

The Rust evaluator emits `"Constraint failed: {expr}"` as the validation message, ignoring any `constraintMessage` property from the bind.

- [x] Read `constraintMessage` from bind definitions in `formspec-eval`.
- [x] Use it as the validation result message when present, falling back to the expression string when absent.
- [x] Verify with Rust evaluator regression coverage for authored constraint messages.

**Primary files:**
- `crates/formspec-eval/src/lib.rs` (~line 619)

**Exit criteria:** validation results use the author-provided `constraintMessage` when available.

#### Task 1.8 — `if()` null-condition diagnostic

The spec says `if()` with a null condition is an "evaluation error" — null result plus a diagnostic. The Rust evaluator returns null but emits no diagnostic.

- [x] Emit a diagnostic when `if()` / ternary / if-then-else receives a null condition in `evaluator.rs`.
- [x] Verify the diagnostic surfaces through the WASM bridge.

**Primary files:**
- `crates/fel-core/src/evaluator.rs` (`fn_if` at ~line 907, ternary/if-then-else at ~line 174)

**Exit criteria:** null-condition `if()` produces both a null result and a diagnostic record.

#### Task 1.9 — Fix `@source` / `@target` in Rust mapping conditions

**Blocks Task 2.2.** The Rust runtime mapping puts the source document into the field map under `__source__`, but FEL `@source` resolves through the context/variable path — so `@source` always evaluates to null in Rust.

- [x] Fix the resolution path: either use `env.set_variable("source", ...)` so `@source` resolves through variable lookup, or add explicit `@source`/`@target` handling in the environment's `resolve_context`.
- [x] Verify with mapping condition tests that reference `@source` and `@target`.

**Primary files:**
- `crates/formspec-core/src/runtime_mapping.rs` (~line 346)
- `crates/fel-core/src/environment.rs`

**Exit criteria:** FEL expressions in mapping conditions correctly resolve `@source` and `@target` to the source/target document values.

### Phase 2 — Add Missing WASM Bridge Surface

**Prerequisite:** Task 1.9 must be complete before Task 2.2.

#### Task 2.1 — Add thin wrappers for existing Rust exports

- [x] Add wrappers in `packages/formspec-engine/src/wasm-bridge.ts` for:
  - `printFEL`
  - `lintDocumentWithRegistries`
  - `parseRegistry`
  - `findRegistryEntry`
  - `validateLifecycleTransition`
  - `wellKnownRegistryUrl`
  - `generateChangelog`

**Exit criteria:** every already-exported Rust capability used by downstream packages has a typed TS bridge.

#### Task 2.2 — Migrate `formspec-core` mapping usage

**Depends on:** Task 1.9 (`@source`/`@target` fix).

- [x] Switch `formspec-core` mapping queries from the stateful TS `RuntimeMappingEngine` implementation to stateless WASM-backed helpers.
- [x] Keep the public `createMappingEngine()` factory stable while changing the internals.

**Primary consumers:**
- `packages/formspec-core/src/queries/mapping-queries.ts`

**Exit criteria:** `formspec-core` no longer needs TS runtime-mapping internals. Mapping conditions using `@source`/`@target` produce correct results.

#### Task 2.3 — Decide the schema-validation contract

- [x] Choose one path:
  - use `lintDocument()` as the sole validation entry point, or
  - add a schema-only Rust/WASM wrapper that preserves the existing `SchemaValidator` contract.
- [x] Update `formspec-core` and `formspec-mcp` to the chosen contract.

Current assessment:
`lintDocument()` alone is not a drop-in replacement. It does not perform JSON Schema validation, does not accept an explicit `documentType` override, and would duplicate the non-structural diagnostics that `formspec-core` already computes. The smallest viable path is a thin WASM-backed wrapper that preserves the current `SchemaValidator.validate(document, documentType?) -> { documentType, errors[] }` contract.

Progress 2026-03-20:
`createSchemaValidator()` now routes document-type detection and root JSON Pointer-to-JSONPath conversion through the WASM bridge when WASM is initialized, while preserving the existing synchronous contract and falling back locally when the bridge is unavailable. Verified with:
- `packages/formspec-engine/tests/schema-validator.test.mjs`
- `packages/formspec-core/tests/diagnostics.test.ts`
- `packages/formspec-mcp` TypeScript build

Update 2026-03-20 (later):
Task 2.3 is now complete via the "schema-only Rust/WASM wrapper preserving the existing contract" path.

- `crates/formspec-core/src/schema_validator.rs` now exposes a schema-validation planning API that owns document-type dispatch and component-tree target enumeration.
- `crates/formspec-wasm/src/lib.rs` exports that plan through `planSchemaValidation`.
- `packages/formspec-engine/src/schema-validator.ts` is reduced to a compatibility shim: AJV remains the host JSON Schema executor, but document-type detection and component validation target selection now come from the WASM bridge. A local fallback remains only for cyclic/non-serializable object graphs.
- The Rust detector now also covers `validation_result` and `fel_functions`, matching the existing TS/Python document-type contract.

Verified with:
- `cargo test -p formspec-core schema_validator`
- `npm --prefix packages/formspec-engine run build:wasm`
- `npm --prefix packages/formspec-engine test`
- `npm --prefix packages/formspec-core run test -- tests/diagnostics.test.ts`
- `npm --prefix packages/formspec-mcp run build`

**Primary consumers:**
- `packages/formspec-core`
- `packages/formspec-mcp`

**Exit criteria:** downstream packages keep the synchronous `SchemaValidator` contract without depending on TS-side document detection or TS-side component-tree traversal logic.

#### Task 2.4 — Fold extension validation into lint

- [x] Remove any remaining dependency on standalone TS extension-analysis behavior unless there is a demonstrated product need for a separate API.

**Exit criteria:** `extension-analysis.ts` is either unused or replaced by a dedicated Rust/WASM wrapper.

### Phase 3 — Add Missing Rust Exports

#### Task 3.1 — Add FEL rewrite support to Rust

- [x] Add `rewrite_fel_references()` to Rust with parity for:
  - field references such as `$foo.bar` and `$repeat[*].field`
  - navigation targets (`prev`, `next`, `parent`) when the first argument is a string literal
  - `@instance('name')` rewrites
  - preserving bare `$` and non-reference identifiers
- [x] Add `rewrite_message_template()` for `{{expression}}` interpolation in constraint/shape messages.
- [x] Export both through WASM.
  Update 2026-03-20: the Rust path now uses span-based exact-text rewriting instead of the AST printer, so comments, whitespace outside rewritten spans, and quote style are preserved. `packages/formspec-engine/src/fel/rewrite.ts` routes to WASM when initialized and keeps the TS parser path only as an initialization fallback.

**Exit criteria:** TS consumers can stop depending on `packages/formspec-engine/src/fel/analysis.ts` for rewrite and message template behavior.

#### Task 3.2 — Add path traversal support to Rust

- [x] Add `item_at_path()` and `item_location_at_path()` to `formspec-core`.
- [x] Export them through WASM.

**Exit criteria:** TS consumers can stop depending on `packages/formspec-engine/src/path-utils.ts` for definition traversal.

#### Task 3.3 — Migrate runtime consumers off TS helpers

- [x] Migrate:
  - `packages/formspec-core/src/handlers/definition-items.ts`
  - `packages/formspec-core/src/handlers/definition-instances.ts`
  - `packages/formspec-core/src/raw-project.ts`
  - `packages/formspec-core/src/handlers/helpers.ts`
  - `packages/formspec-core/src/queries/field-queries.ts`
  - `packages/formspec-studio-core/src/project.ts`
- [x] Verify that `index.ts` imports from `path-utils.ts` are updated before any deletion gate is triggered.

**Exit criteria:** no runtime consumer outside Studio editor tooling imports TS-only path traversal or rewrite helpers.

### Phase 4 — Decide Studio Tooling Strategy

This phase is intentionally deferred until runtime parity and runtime-consumer migration are complete.

#### Task 4.1 — Choose one editor-tooling path

- [ ] Option A: add `wasmTokenizeFEL()` returning positioned token records for syntax highlighting.
- [ ] Option B: add `wasmParseFELToAST()` returning a JS-consumable serialized AST for editor utilities.
- [x] Option C: keep Chevrotain permanently for Studio-only tooling and document that decision explicitly.

Decision:
Keep Chevrotain for Studio-only FEL tooling. Current Studio consumers in `packages/formspec-studio/src/lib/fel-editor-utils.ts` depend on token-level syntax highlighting, parser error positions, and exact-text source preservation. The runtime path is already on Rust/WASM, and replacing the editor/tooling surface would add a second exact-text/span-preserving contract with no demonstrated product payoff. `fel/lexer.ts`, `fel/parser.ts`, and the parser-aware rewrite helper therefore remain intentional tooling code, not runtime decommission blockers.

**Primary consumer:**
- `packages/formspec-studio/src/lib/fel-editor-utils.ts`

**Exit criteria:** there is an explicit decision. Do not leave Tier 4 as an implied future cleanup item.

## Consumer Migration Order

1. `formspec-engine` parity first
2. `formspec-core`
3. `formspec-mcp`
4. `formspec-studio-core`
5. `formspec-studio` editor tooling decision

## TS Deletion Gates

- [x] `runtime-mapping.ts` can be removed once `formspec-core` uses WASM-backed mapping internally and `@source`/`@target` resolution is verified (Task 1.9).
- [ ] `schema-validator.ts` can be removed once `formspec-core` and `formspec-mcp` no longer require its TS contract.
  Current state: logic moved behind the WASM bridge, but the synchronous TS contract is still exported as an intentional compatibility shim.
- [x] `extension-analysis.ts` can be removed once lint-based or Rust-based replacement is in place.
- [x] `path-utils.ts` can be removed once Rust/WASM path traversal exports exist, all consumers switch, and `index.ts` imports are updated.
- [x] TS rewrite helpers in `fel/analysis.ts` can be removed once Rust/WASM rewrite support exists (including `rewrite_message_template`) and all consumers switch.
  Current state: rewrite moved to the Rust/WASM path; `fel/analysis.ts` remains for Studio/editor analysis utilities.
- [x] `fel/lexer.ts` and `fel/parser.ts` can only be removed after the Studio tooling decision in Phase 4.
  Decision: they are retained for Studio-only tooling and exact-text authoring workflows.

## Python Decommission Tasks

### Task P1 — Make Rust mandatory

- [x] Make `formspec_rust` a hard dependency of the Python package.
- [x] Update package and CI installation flow so PyO3 is always built and available.

### Task P2 — Decide public API shape

- [x] Decide whether `src/formspec/fel/__init__.py` continues exporting Python parser/evaluator internals.
- [x] Either expose equivalent Rust/PyO3 APIs or intentionally narrow the public API.
  Decision: intentionally narrow the public API to the Rust-backed runtime contract. `parse()` now returns an opaque handle, and Python parser/evaluator internals are no longer public surface.

### Task P3 — Delete Python execution backend

- [x] Remove:
  - `src/formspec/fel/parser.py`
  - `src/formspec/fel/evaluator.py`
  - `src/formspec/fel/environment.py`
  - `src/formspec/fel/functions.py`
  - `src/formspec/fel/dependencies.py`
  - `src/formspec/fel/ast_nodes.py`
- [x] Keep protocol/glue files if they still provide value:
  - `src/formspec/fel/runtime.py`
  - `src/formspec/fel/types.py`
  - `src/formspec/fel/errors.py`
  - `src/formspec/fel/extensions.py`

**Exit criteria:** Rust is the only Python execution backend, even if some Python protocol and helper files remain as binding glue.

## Definition of Done

- [x] Engine parity restored under WASM-only FEL runtime (FEL evaluation, shape composition, constraint messages, money operators, repeat context)
- [x] Spec-normative behaviors not implemented in Rust are explicitly documented as TS-only with rationale (see Out of Scope)
- [x] Runtime consumers migrated off TS-only helpers
- [x] Python package uses Rust as its only execution backend
- [x] Studio tooling has an explicit long-term parser/tokenization decision
- [x] Original master plan keeps only a summary and pointer to this task document
