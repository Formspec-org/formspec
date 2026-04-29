# Phase 4 follow-up TODO list

**Context:** Items deferred, discovered, or verified after Phase 4 chaos-test work. Full narrative: [`phase4-implementation.md`](./phase4-implementation.md).

Use checkboxes to track progress locally (not wired to GitHub Issues).

---

## Implementation Plan

### Wave 1 — Simple fixes (all independent, parallelize) — DONE

All five items completed in parallel. No regressions.

#### 1. BUG: MCP `handleGroup` + `makeRepeatable` uses unresolved path

**Files:** `packages/formspec-mcp/src/tools/structure.ts`, `packages/formspec-mcp/tests/bugfixes.test.ts`

**Problem:** Both the single-item path (line ~170) and batch path (line ~154) call `makeRepeatable(params.path!, repeat)` using the raw `params.path` instead of the resolved full path. When `parentPath` is provided, `addGroup` resolves to `{parentPath}.{path}` internally, but `makeRepeatable` receives the unresolved leaf — causing `PATH_NOT_FOUND`.

**Fix:**
- Single-item path: change `project.makeRepeatable(params.path!, repeat)` → `project.makeRepeatable(result.affectedPaths[0], repeat)`. The `result` variable already exists from the `addGroup` call.
- Batch path: same pattern — use the result's `affectedPaths[0]` instead of `item.path`.
- Add test in `bugfixes.test.ts`: create a group with `parentPath` + `repeat`, verify the group is repeatable at the resolved path.

**Red-green:** Write failing test first (group at `parentPath.path` with `repeat` — should succeed but currently throws). Fix. Verify.

---

#### 2. Sigil hint: `$name` when `name` is a variable

**Files:** `packages/formspec-core/src/queries/expression-index.ts`, tests in `packages/formspec-core/tests/`

**Problem:** When an unknown field reference (`$name`) matches a known variable name, no hint is emitted. Authors get a generic `FEL_UNKNOWN_REFERENCE` error with no guidance.

**Fix:**
- In the unknown-field-reference loop (lines 66–75), after confirming the ref is not in `knownFieldPaths`, check if it exists in `knownVariables` (already computed at line 59).
- If it matches a variable, emit a warning with a new code (e.g. `FEL_SIGIL_HINT`) suggesting `@{name}` instead of `$name`. Keep the original `FEL_UNKNOWN_REFERENCE` error as well — the hint is supplemental.

**Red-green:** Write test with a known variable `@status` and an expression using `$status`. Expect a `FEL_SIGIL_HINT` warning in diagnostics. Fail first, then implement.

---

#### 3. Document in-memory `TreeNode.bind` convention

**Files:** `packages/formspec-core/src/handlers/tree-utils.ts`

**Change:** Update the JSDoc comment on the `bind` property (lines 25–38) to clarify:
- In memory, `bind` stores the **leaf `item.key`** (e.g. `"email"`), not the full dotted path.
- At export, `cleanTreeForExport()` in `raw-project.ts` rewrites `bind` to the full path (e.g. `"contact.email"`).
- Include a brief example showing the difference.

No behavioral change — documentation only.

---

#### 4. Remove `as any` from MCP dispatch

**Files:** `packages/formspec-mcp/src/dispatch.ts`

**Problem:** Lines 48–89 have ~30 `as any` casts on handler args. The `Handler` type (line 32) already uses `Record<string, any>` for args, making these casts redundant.

**Fix:** Remove the `as any` casts. If TypeScript complains about specific handler overloads (batch vs single signatures on `handleField`, `handleGroup`, etc.), widen those handler parameter types at the dispatch boundary — the dispatch table is a valid type-erasure point.

**Verify:** `npx tsc --noEmit` on the MCP package after changes. Run MCP test suite.

---

#### 5. Deduplicate `describeShapeConstraint`

**Files:** `packages/formspec-studio-core/src/index.ts`, `packages/formspec-mcp/src/tools/query.ts`

**Problem:** Identical implementations of `describeShapeConstraint` exist in `formspec-core/src/queries/shape-display.ts` (canonical) and `formspec-mcp/src/tools/query.ts:34-64` (duplicate). MCP can't reach the core version because it only imports through `studio-core`.

**Fix:**
1. In `packages/formspec-studio-core/src/index.ts`, add re-export: `export { describeShapeConstraint } from '@formspec-org/core';`
2. In `packages/formspec-mcp/src/tools/query.ts`, delete the local function (lines 34–64) and import from `@formspec-org/studio-core`.
3. Verify `FormShape` type is already importable through studio-core (it is — line 39 of studio-core index.ts).

**Verify:** MCP test suite passes unchanged.

---

### Wave 2 — ARCH-3: wire `analyze_fel_with_field_types` end-to-end

**Complexity:** Medium. Four sequential layers, ~57 lines of new code total. Each follows established patterns exactly.

**What exists:** `analyze_fel_with_field_types()` is fully implemented and tested in `crates/formspec-core/src/fel_analysis.rs:367-380` (7 tests at lines 1462–1570). It takes `expression: &str` and `field_types: &HashMap<String, String>`, calls base `analyze_fel()`, then runs `check_comparison_types()` to detect type-mismatched comparisons (money vs number, date vs string). Already re-exported from `crates/formspec-core/src/lib.rs:45`.

**Spec validation (Core S3.10.1, S3.10.2, S3.3, S3.4.3):**

- Cross-type comparisons MUST signal a type error; result is `null`. FEL has NO implicit coercion.
- Type mismatches are **evaluation errors**, NOT definition errors (absent from the 8 load-time blockers).
- Diagnostic severity: **warning**. Code: **`FEL_TYPE_MISMATCH`**.
- 13 `dataType` values map to 5 FEL types (S2.1.3): string/text/time/uri/choice→string, integer/decimal→number, boolean→boolean, date/dateTime→date, money→money.
- `[*]` wildcards wrap scalar type in `array<T>`; element-wise ops apply (S3.9).

**What's missing — 4 layers:**

#### Layer 1: WASM export (~15 lines)

**File:** `crates/formspec-wasm/src/fel.rs`

- Add `#[wasm_bindgen(js_name = "analyzeFELWithFieldTypes")]` function alongside `analyze_fel_wasm` (lines 154–159).
- **No feature gate** — `analyze_fel_wasm` has none; the typed variant must also be in runtime WASM because `parseFEL` imports from `fel-runtime`.
- Accept `expression: &str` and `field_types_json: &str`, deserialize JSON object into `HashMap<String, String>` using `json_host::parse_value_str`, call `analyze_fel_with_field_types()`, serialize with `fel_analysis_to_json_value()`.
- Add `analyze_fel_with_field_types` to the `formspec_core` import block at line 16.

#### Layer 2: TS WASM bridge (~15 lines)

**File:** `packages/formspec-engine/src/wasm-bridge-runtime.ts`

- Add `wasmAnalyzeFELWithFieldTypes(expression: string, fieldTypes: Record<string, string>)` alongside `wasmAnalyzeFEL` (line 245).
- **Goes in runtime bridge** (not tools) because `parseFEL` imports from `@formspec-org/engine/fel-runtime`.
- Pattern: call `wasm().analyzeFELWithFieldTypes(expression, JSON.stringify(fieldTypes))`, parse JSON result.

#### Layer 3: TS FEL API (~12 lines)

**File:** `packages/formspec-engine/src/fel/fel-api-runtime.ts`

- Add `analyzeFELWithFieldTypes(expression: string, fieldTypes: Record<string, string>): FELAnalysis` alongside `analyzeFEL` (lines 20–28).
- Calls bridge, normalizes error objects (same pattern as `analyzeFEL`).
- Re-export from the `fel-api` barrel.

#### Layer 4: Core integration (~15 lines)

**File:** `packages/formspec-core/src/queries/expression-index.ts`

- In `parseFEL()`, when `context` is provided and `analysis.valid` is true:
  1. Build `fieldTypeMap: Record<string, string>` from `available.fields` (each has `path` and `dataType`, already populated at line 175).
  2. Call `analyzeFELWithFieldTypes(expression, fieldTypeMap)`.
  3. Append type warnings to diagnostics with code `FEL_TYPE_MISMATCH` and severity `"warning"`.
- MCP gets this for free — it calls `parseFEL` through studio-core.

**Red-green:** Write a test in formspec-core that passes a FEL expression comparing a date field to a number (e.g. `$start_date > 100`) with field types provided. Expect a `FEL_TYPE_MISMATCH` warning. Fail first, then implement layer by layer until it passes.

**Verify:** Rust tests (`cargo nextest run -p formspec-core`), WASM build (`npm run build` in formspec-engine), core tests, MCP tests.

---

### Wave 3 — Design decisions (closed)

These items are now decided. Implementation work can follow the decisions below;
they are no longer open architecture questions.

#### FIX 8: FEL rewrite for repeat wildcard shapes

**Status:** Decision made — canonicalize at write time.

**Scout findings:** All low-level rewrite tools exist and are tested:
- `collect_fel_rewrite_targets()` (`fel_analysis.rs:397-406`) — parses expression, collects all rewritable references into `FelRewriteTargets` (field paths, current paths, variables, instance names, navigation targets). Exposed through tools WASM.
- `rewrite_fel_source_references()` (`fel_rewrite_exact.rs:24-41`) — exact-text rewriter using span-aware lexer. Accepts `RewriteOptions` with callbacks per reference type. Preserves whitespace, comments, quote styles.
- `print_expr()` (`fel-core/printer.rs`) — complete AST-to-source serializer, round-trip tested. Handles `[*]` wildcards.
- Runtime wildcard evaluation exists in `formspec-eval` (`rebuild/wildcard.rs`, `revalidate/shapes.rs`).

**Decision:** Rewrite at the authoring boundary, not in the evaluator. When
`addValidation()` inserts `[*]` into the target, Studio must also canonicalize
`constraint`, `activeWhen`, and FEL interpolations in `message` into the
row-scoped form the spec already uses.

**Canonical form:** For `target: "categories[*].personnel_costs"`, store `$`
for the current field, `$row_total` for same-row siblings, and keep explicit
collection/global references such as `sum($categories[*].row_total)` unchanged.

**Guardrail:** If an authored absolute field reference crosses a repeat
boundary and cannot be rewritten losslessly into row-scoped FEL, reject the
helper call and require the author to write the canonical expression explicitly
(for example with `parent()`).

**Design doc:** [`../../specs/2026-04-07-phase4-follow-up-design-decisions.md`](../../specs/2026-04-07-phase4-follow-up-design-decisions.md)

#### ARCH-4: Canonical `bind` at write time

**Status:** Decision made — do not pursue.

**Scout findings:** Changing `bind` from leaf key to full path would touch 6+ files across 2 packages (`tree-utils.ts`, `component-tree.ts`, `component-properties.ts`, `definition-items.ts`, `tree-reconciler.ts`, `raw-project.ts`). The leaf-key convention has a deliberate advantage: tree structure changes (move, reparent) don't require rewriting all descendant `bind` values — only `cleanTreeForExport` needs prefix context. Full-path bind would introduce bugs around structural mutations for no user-facing benefit.

**Decision:** Keep `TreeNode.bind` as the leaf `item.key` in memory. Full
paths remain an export/boundary concern handled by `cleanTreeForExport()` and
by explicit boundary code that needs serialized component paths.

**Reopen only if:** We replace the current open `TreeNode` bag with a typed
component-node model. Until then, changing `bind` to a full path is the wrong
tradeoff.

**Design doc:** [`../../specs/2026-04-07-phase4-follow-up-design-decisions.md`](../../specs/2026-04-07-phase4-follow-up-design-decisions.md)

---

## Authoring and diagnostics (incremental)

- [x] **ARCH-3: wire `analyze_fel_with_field_types` end-to-end**
  - [x] WASM export in `crates/formspec-wasm/src/fel.rs` (no feature gate, alongside `analyzeFEL`).
  - [x] TS bridge in `packages/formspec-engine/src/wasm-bridge-runtime.ts`.
  - [x] FEL API in `packages/formspec-engine/src/fel/fel-api-runtime.ts`.
  - [x] `parseFEL` integration: build `fieldTypeMap` from `available.fields`, call typed analysis, emit `FEL_TYPE_MISMATCH` warnings.

---

## Larger design (closed)

- [x] **FIX 8: FEL rewrite for repeat wildcard shapes** — Decision made: canonicalize repeat-target shape FEL at write time in Studio, not at runtime. See Wave 3 and the linked design doc.

- [x] **ARCH-4 (optional): canonical `bind` at write time** — Decision made: keep leaf-key `bind` in memory; full paths stay at export/boundary seams. See Wave 3 and the linked design doc.

---

## Done (reference only — do not recheck)

- [x] FIX 4: `json_to_runtime_fel_typed` — implemented; prior broken reference in `formspec-eval` resolved (see Phase 4 summary).
- [x] **MCP `handleGroup` + `makeRepeatable` path bug** — Fixed both single-item and batch paths to use `result.affectedPaths[0]`. 2 tests added in `bugfixes.test.ts`. MCP suite: 499/499.
- [x] **Sigil hint: `$name` when `name` is a variable** — Added `FEL_SIGIL_HINT` warning in `expression-index.ts`. 3 tests added. Core suite: 695/695.
- [x] **Document in-memory `TreeNode.bind` convention** — JSDoc updated in `tree-utils.ts` with leaf-key vs full-path semantics and `cleanTreeForExport()` behavior.
- [x] **Remove `as any` from MCP dispatch** — Changed `Handler` args to `any`, replaced 28 lambda wrappers with direct function references. MCP suite: 499/499.
- [x] **Deduplicate `describeShapeConstraint`** — Deleted 31-line duplicate from MCP `query.ts`, added re-exports through `formspec-core/index.ts` → `studio-core/index.ts`. MCP suite: 499/499.
