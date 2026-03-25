# Phase 2: Root Cause Analysis

**Date:** 2026-03-25
**Agents:** 5 code-scout agents | **Issues traced:** 20 (8 bugs, 6 UX, 3 gaps, 3 confusion)

---

## Layer Heatmap

| Layer | Issues Rooted Here | Issues |
|-------|-------------------|--------|
| **spec/schema** | 1 | GAP-6 (requiredMessage missing from schema) |
| **engine (Rust/WASM)** | 3 | BUG-3 runtime (constraint_passes(Null)==true), BUG-5 (no arity checking), GAP-1 (no sumWhere) |
| **core** | 2 | UX-4b (allItemPaths missing content items), UX-6 (FEL context scope) |
| **studio-core** | 7 | BUG-1 (phone regex), BUG-4 (removeConstraint), BUG-8 (dup validation warning), BUG-3 creation-time, UX-1 (path feedback), GAP-2 (condition branch), GAP-3 (variable branch) |
| **MCP** | 9 | BUG-2 (style path/target), BUG-6 (preview response), BUG-7 (parentPath nesting), UX-2 (save path), UX-3 (move semantics), UX-4a/c (describe enrichment), CONFUSION-1/2/3 |
| **Not a bug** | 1 | UX-5 (shape validation in preview — works correctly, likely user error) |

**Key insight:** Studio-core and MCP share the most issues, but the deepest/highest-impact fixes are in the engine (Rust) and studio-core layers.

---

## Issues Grouped by Root Layer

### Rust/WASM Engine (3 issues — HIGH IMPACT)

**BUG-3 (runtime): Broken FEL expressions silently pass validation**
- **Root cause:** `constraint_passes(Null) == true` in `crates/formspec-eval/src/revalidate/expr.rs:6-8`. When a constraint expression fails (undefined function, type error), the evaluator returns `Null` via `self.diag()`, and `constraint_passes` treats Null as passing. Diagnostics are discarded at every consumption site.
- **Files:** `crates/formspec-eval/src/revalidate/items.rs:104`, `revalidate/expr.rs:10-14`, `recalculate/calculate_pass.rs:156-178`
- **Fix:** Check `result.diagnostics` for eval errors before calling `constraint_passes`. Surface as `EXPRESSION_ERROR` validation result.

**BUG-5: No arity checking in FEL evaluator**
- **Root cause:** `eval_function` in `crates/fel-core/src/evaluator.rs` dispatches to `fn_aggregate(args, "sum", ...)` which reads only `eval_arg(args, 0)`. Extra arguments are silently ignored. The catalog declares `sum(array<number>) -> number` (one arg) but the parser/evaluator never validates arity.
- **Systemic:** Affects ALL FEL functions — `sum(a,b,c)`, `length(a,b)`, `today(x,y,z)` all silently ignore extras.
- **Files:** `crates/fel-core/src/evaluator.rs` (eval_function), `crates/formspec-core/src/fel_analysis.rs` (analyze_fel)
- **Fix:** Add arity checking in both `analyze_fel` (authoring time) and `eval_function` (runtime). The catalog already has the signature info.

**GAP-1: No sumWhere/avgWhere/minWhere/maxWhere/moneySumWhere**
- **Root cause:** Spec gap. `countWhere(array, boolean)` exists and works (uses `let_scope` with `$` binding). No predicate variant exists for any other aggregate.
- **Files:** `specs/core/spec.md:1220`, `crates/fel-core/src/extensions.rs`, `crates/fel-core/src/evaluator.rs`, `src/formspec/fel/evaluator.py`
- **Fix:** Add functions to spec, catalog, Rust evaluator, Python evaluator. Implementation follows `fn_count_where` pattern.

### Studio-Core (7 issues)

**BUG-1: Phone type alias invalid FEL regex**
- **Root cause:** `field-type-aliases.ts:41` — `constraintExpr` has `\\s` (2 backslashes) where it needs `\\\\s` (4 backslashes). The email line was fixed previously; phone was not. TS `\\s` → JS `\s` → FEL sees `\s` → unrecognized escape.
- **Fix:** Change to `\\\\s` and `\\\\-` on line 41. Also: add test that parses ALL `constraintExpr` values through FEL parser.

**BUG-3 (creation-time): _validateFEL doesn't reject unknown functions**
- **Root cause:** `project.ts:807` — `_validateFEL` checks `result.valid` which is true for syntax-only validity. Unknown functions generate `FEL_UNKNOWN_FUNCTION` warnings, not errors.
- **Fix:** Also check warnings for `FEL_UNKNOWN_FUNCTION` and reject.

**BUG-4: remove_rule doesn't touch bind constraints**
- **Root cause:** `removeValidation(shapeId)` at `project.ts:1070` calls `deleteShape({id})` which filters `shapes[]` array. Bind-level `constraint` (from type aliases) is untouched. The MCP `remove_rule` passes a field path as a shape ID — no shape has that ID.
- **Fix:** Add `removeConstraint(path)` method that clears `bind.constraint` + `bind.constraintMessage`. Wire into MCP `remove_rule` to try both.

**BUG-8: No warning when creating duplicate validation (bind + shape)**
- **Root cause:** `addValidation` at `project.ts:1027` doesn't check if target field already has a bind constraint. The two mechanisms are independent.
- **Fix:** Add `DUPLICATE_VALIDATION` warning in `addValidation` when target has existing bind constraint.

**UX-1: Field creation summary doesn't show canonical path**
- **Root cause:** `project.ts:668` — summary says `"Added field 'age' to 'demographics'"` but never shows `"demographics.age"`. The `affectedPaths[0]` has it, but LLMs read the summary.
- **Fix:** Change summary to `"Added field 'age' (integer) at path \"demographics.age\""`.

**GAP-2: Branch only supports equality**
- **Root cause:** `BranchPath` in `helper-types.ts:80-84` only has `mode: 'equals' | 'contains'`. The underlying `relevant` bind accepts any FEL.
- **Fix:** Add `mode: 'condition'` + `condition: string` to `BranchPath`. `_branchExpr` returns the raw FEL when mode is `condition`.

**GAP-3: Cannot branch on variables**
- **Root cause:** `branch()` at `project.ts:948` uses `this.core.itemAt(on)` which only looks up items, not variables. Variables use `@name` in FEL.
- **Fix:** Detect `@` prefix or match against `variableNames()`. Use `@varName` in FEL generation.

### Core (2 issues)

**UX-4b: describe fieldPaths omits display content items**
- **Root cause:** `allItemPaths` query likely filters to data-bearing items only.
- **Fix:** Add `allItemPaths(includeContent: true)` option or separate `allContentPaths()` query.

**UX-6: FEL context doesn't scope to repeat rows**
- **Root cause:** `availableReferences` in `expression-index.ts:156-203` walks ALL items regardless of context. `contextPath` only controls whether `@current/@index/@count` are added.
- **Fix:** Add `scope: 'local' | 'global'` to `FELReferenceSet.fields` entries. Annotate based on whether field is inside the repeat group.

### MCP (9 issues)

**BUG-2: formspec_style crashes with `path` instead of `target`**
- **Root cause:** `style.ts:33` reads `params.target!` for layout action. Schema has both `path` and `target` with no per-action docs.
- **Fix:** Accept `params.path` as fallback for `target` in layout action. Add pre-validation.

**BUG-6: Preview `response` silently ignored**
- **Root cause:** `query.ts:141` — preview mode calls `previewForm(project, params.scenario)`, ignoring `params.response`.
- **Fix:** `previewForm(project, params.scenario ?? params.response)`. Add per-mode param descriptions.

**BUG-7: Group parentPath at wrong nesting level**
- **Root cause:** `parentPath` is inside `props` in Zod schema. Top-level `parentPath` gets stripped by Zod. Group created at root, user expects nested path, gets confused.
- **Fix:** Accept `parentPath` as top-level param, merge into `props`.

**UX-2: formspec_save no path param**
- **Root cause:** Neither `formspec_create` nor `formspec_save` accepts a file path. Only `formspec_open` sets source path.
- **Fix:** Add `path` parameter to `formspec_save`.

**UX-3: edit move nests inside target**
- **Root cause:** MCP move handler uses `target_path` as parent, not sibling positioning. No `after`/`before` semantics.
- **Fix:** Add `position: 'inside' | 'after' | 'before'` parameter with `'inside'` as default for backwards compat.

**UX-4a: describe doesn't show repeat config**
- **Root cause:** MCP describe handler doesn't merge repeat data into response.
- **Fix:** Enrich describe response with repeat config from the item.

**UX-4c: Group creation doesn't confirm repeat config**
- **Root cause:** `handleGroup` response doesn't echo back repeat settings.
- **Fix:** Include repeat summary in response.

**CONFUSION-1: behavior vs flow overlap**
- **Fix:** Documentation — update tool descriptions to explain both write `relevant` binds.

**CONFUSION-2: Money field format unclear**
- **Root cause:** `loadDataIntoEngine` in `evaluation-helpers.ts` flattens money objects `{amount, currency}` as nested groups instead of treating as atomic.
- **Fix:** Detect money-shaped objects as leaf values in flattening logic. Plus MCP docs.

**CONFUSION-3: Bind constraints vs shape rules**
- **Fix:** Documentation — update `formspec_behavior` description to explain the distinction.

### Not a Bug (1 issue)

**UX-5: Shape validation in preview**
- Agent 4 confirmed shapes ARE evaluated in preview. The 1/5 persona signal was likely a FEL expression error or path format mismatch, not a missing feature.

---

## Tech Debt Patterns

### Pattern 1: Silent failure on invalid input
BUG-3, BUG-5, BUG-6, BUG-7 — the system accepts bad input, does something unexpected, and returns success. The deepest instance is `constraint_passes(Null) == true` in the Rust evaluator.

### Pattern 2: Silently-ignored parameters (tool consolidation debt)
BUG-2, BUG-6, BUG-7 — stems from ADR-0040 consolidating 65→28 tools. Multi-action tools have union schemas where parameters apply to different actions, with no per-action validation.

### Pattern 3: Bind/shape duality leaking through API
BUG-4, BUG-8, CONFUSION-3 — two validation mechanisms (bind constraints from type aliases, shape rules from add_rule) with no unified management API.

### Pattern 4: Missing FEL semantic validation
BUG-3, BUG-5 — the FEL checker validates syntax only. Function existence generates warnings (not errors). Arity is never checked. The gap between what the checker accepts and what the runtime handles correctly is a correctness hazard.

---

## Dependency Violations Found

**None.** All proposed fixes respect layer direction. Deepest fixes are in Rust (engine), and shallower layers only need corresponding wiring changes.

---

## Recommended Fix Order

Fixes ordered to maximize masking resolution (deeper fixes may resolve shallow symptoms):

### Batch 1: Rust/WASM Engine (unblocks everything downstream)
1. **BUG-5** — FEL arity checking (blocks BUG-3 creation-time fix from being complete)
2. **BUG-3 runtime** — constraint_passes(Null) / diagnostic surfacing
3. **GAP-1** — sumWhere/avgWhere (spec + Rust + Python)

### Batch 2: Studio-Core (unblocks MCP improvements)
4. **BUG-1** — phone regex fix (1-line change + tests)
5. **BUG-3 creation-time** — _validateFEL reject unknown functions
6. **BUG-4** — removeConstraint method + wire into remove_rule
7. **BUG-8** — DUPLICATE_VALIDATION warning
8. **UX-1** — canonical path in summary
9. **GAP-2** — condition mode for branch
10. **GAP-3** — variable branch support

### Batch 3: MCP (user-facing improvements)
11. **BUG-2** — style path/target fallback
12. **BUG-6** — preview response/scenario alias
13. **BUG-7** — parentPath at top level
14. **UX-2** — save path parameter
15. **UX-3** — move position semantics
16. **UX-4** — describe enrichment
17. **CONFUSION-1/2/3** — documentation updates

### Batch 4: Core queries (nice-to-have)
18. **UX-4b** — allItemPaths include content
19. **UX-6** — FEL context scope annotations

### Deferred
20. **GAP-6** — requiredMessage (schema change, needs spec reconciliation)
21. **UX-5** — Closed (not a bug)
