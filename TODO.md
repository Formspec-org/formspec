# Formspec — Consolidated TODO

**Validated 2026-04-10** against the current codebase by formspec-scout.

Sources: editor/layout split review, chaos-test phase 1 findings + phase 4 follow-ups, layout DnD review, studio plans.

## Open

### 22. Bridge FEL traces through WASM → Python → MCP
- **State**: `evaluate_with_trace` in `crates/fel-core/src/trace.rs` emits ordered `TraceStep` sequences (FieldResolved, FunctionCalled, BinaryOp, IfBranch, ShortCircuit). No binding forwards them.
- **Why**: LLMs cannot see the trace until the WASM → Python → TS → MCP chain carries it. The Rust foundation sits unused until this wires through.
- **Files**: `crates/formspec-wasm/src/fel.rs` (add `eval_fel_with_trace` returning `{value, diagnostics, trace}`), `crates/formspec-py/src/fel.rs` (Python binding mirror), `packages/formspec-engine/src/wasm-bridge-*.ts` (add `FelTrace` type + `wasmEvalFELWithTrace` method), `packages/formspec-mcp/src/tools/fel.ts` (new `formspec_fel_trace` tool).
- **Done when**: `formspec_fel_trace("$a + $b", {a: 3, b: 4})` called through the MCP returns a `TraceStep[]` identical to what Rust produces for the same input.

### 23. MCP-driven benchmark runner loop
- **State**: `benchmarks/run_benchmark.py` scores a candidate directory against a reference. Four tasks under `benchmarks/tasks/` each carry a `requirement.md`. Nothing reads those requirements.
- **Why**: The existing runner proves references validate clean. Measuring whether an LLM can *produce* a clean candidate from prose requires a separate runner that drives the MCP from `requirement.md`.
- **Files**: new `benchmarks/run_mcp_loop.py`.
- **Done when**: `python3 benchmarks/run_mcp_loop.py invoice --model <name>` reads `tasks/invoice/requirement.md`, drives `formspec_create` + `formspec_audit` in a scratch dir, iterates until clean or `N` rounds elapse, then writes `{score, rounds, first_round_diags, last_round_diags}` per task. Pair with `run_benchmark.py score` to reuse the scoring function.

### 24. Split release pipelines by velocity tier
- **State**: `COMPAT.md`, ADR-0063, and per-tier `CHANGELOG.md` stubs ship. Every npm package still releases atomically through one Changesets pipeline (`.github/workflows/publish.yml` + `.changeset/config.json`).
- **Why**: Kernel packages need slow, semver-strict cadence; AI packages want monthly pre-1.0 drops. One pipeline couples kernel stability to AI velocity.
- **Files**: `.changeset/config.json` (add `fixed` groups per tier), `.github/workflows/publish.yml` (per-tier job matrix), git tag conventions (`kernel-v*`, `foundation-v*`, `ai-v*`), npm `dist-tag` conventions.
- **Done when**: each tier publishes on its own tag and cadence, proven by a dry-run on a release branch before landing on `main`.

### 25. CI gate for lint-code registry coverage + per-rule fixtures
- **State**: `tests/unit/test_lint_rule_registry.py` passes locally. It enforces that every emitted code appears in `specs/lint-codes.json` and every `tested`/`stable` rule carries `specRef` + `suggestedFix`. CI does not run it. Every `fixtures: []` array in the registry is empty.
- **Why**: A new diagnostic code can reach `main` today without a registry entry. "Registered" without "exercised" is weak coverage — fixture links close the loop.
- **Files**: `.github/workflows/*.yml` (wire the test into the required suite), `specs/lint-codes.json` (populate `fixtures` arrays).
- **Done when**: the Python test runs on every PR, and every rule lists ≥1 fixture path under `tests/` or `examples/` that triggers the rule.

### 26. Populate authoring metadata on 29 draft lint rules
- **State**: 8 of 37 rules in `specs/lint-codes.json` are `state: "tested"` with real `specRef` + `suggestedFix`. 29 remain `state: "draft"` with empty strings. After the single-source refactor, `crates/formspec-lint/src/metadata.rs` loads the registry via `include_str!` — metadata flows automatically, no Rust edits.
- **Why**: A diagnostic without a repair hint costs an LLM a round trip per miss. Every rule stuck at `draft` weakens the authoring loop.
- **Files**: `specs/lint-codes.json` only. Spec anchors live in `specs/core/spec.md`, `specs/theme/theme-spec.md`, `specs/component/component-spec.md`, `specs/fel/fel-grammar.md` — verify each anchor exists before committing.
- **Done when**: every rule reaches `state: "tested"` with a verified repo-relative `specRef` and an imperative `suggestedFix` under ~120 characters. `test_tested_and_stable_rules_have_spec_ref_and_suggested_fix` stays green throughout.

### 27. `generate_changelog` output fails document-type detection (E100)
- **State**: `generate_changelog(parent, child, url)` returns a document that `detect_document_type` cannot classify. `_pass_changelog_generation` at `src/formspec/validate.py:493-531` pipes the output through `lint()`, which emits E100. The `grant-report` benchmark task is scoped to the short form only to avoid tripping this.
- **Why**: Any directory-validator run over a multi-version definition tree sees a spurious E100. The benchmark workaround hides the defect — remove both together.
- **Plan**: `thoughts/plans/2026-04-17-changelog-generation-fails-doctype-detection.md`.
- **Files**: `crates/formspec-changeset/` (generator output shape), `src/formspec/validate.py:493-531`, `crates/formspec-core/src/document_type.rs` if the fix extends detection instead of the generator.
- **Done when**: a generated changelog round-trips `detect_document_type` → `lint()` cleanly, a fixture under `tests/conformance/` guards the invariant, and the `grant-report` benchmark task widens to cover base + long alongside short.

### 28. Commit ADR-0064 + handoff archival
- **State**: The handoff has been relocated inside the submodule to `wos-spec/thoughts/archive/reviews/2026-04-16-architecture-review-handoff.md` (submodule change pending). `thoughts/adr/0064-wos-granularity-and-ai-native-positioning.md` carries the updated path references but remains uncommitted.
- **Why**: ADR-0064's "Supersedes" clause mandates the relocation. The ADR and the submodule pointer bump need to land together so `wos-spec/architecture-review-handoff.md` stops resolving while the ADR is visible.
- **Files**: `thoughts/adr/0064-wos-granularity-and-ai-native-positioning.md`, the `wos-spec` submodule pointer in the outer repo.
- **Done when**: ADR-0064 lands on `main`, the `wos-spec` submodule bump lands in the same or a closely-following commit, and the pre-move handoff path no longer resolves from either side.

## Track / Monitor

### 14. `materializePagedLayout` — by design
- **Source**: editor/layout split review
- **File**: `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx:361-380`
- **Status**: Guarded by `useRef<boolean>` flag — no-op after first call. Negligible overhead.

### 19. Component tree reconciles on every dispatch
- **Source**: editor/layout split review
- **File**: `packages/formspec-core/src/raw-project.ts:350-373`
- **Action**: Monitor. Resolution path documented: add dirty flag. Not yet implemented.

### ~~21. `as any` casts in `project.ts`~~ — resolved
- All 33 casts eliminated. `CommandResult` typed with `nodeRef`/`nodeNotFound`, `Diagnostic` with `line`/`column`, `CompNode` structured type replaces `Record<string, unknown>`.

### LayoutContainer dual-droppable
- **Source**: layout DnD review (2026-04-07)
- **File**: `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx:194-209`
- **Status**: `useSortable` + `useDroppable(container-drop)` on same element. No code change until a mis-hit is reproduced.

## Resolved

<details>
<summary>Resolved items from editor/layout split review (click to expand)</summary>

### Studio-core extraction review (batch)
- ~~Non-spec dataTypes in TYPE_MAP~~ — replaced with spec-normative types
- ~~`(project as any).core.dispatch()` x3~~ — added typed methods to Project
- ~~Missing `text` (Long Text) entry in FIELD_TYPE_CATALOG~~ — added
- ~~`item.choices` non-spec fallback~~ — removed, uses `options` only
- ~~Cross-package `default-theme.json` import~~ — added sub-path export
- ~~Unnecessary `@formspec-org/layout` dependency~~ — imports from `@formspec-org/types`
- ~~Incomplete re-export wrapper (`field-helpers.ts`)~~ — added missing exports
- ~~14 direct imports into `formspec-studio-core/src/`~~ — redirected
- ~~Duplicate test files~~ — deleted, canonical copies in studio-core

### Individual items
- **1.** ~~Screener `required` literal-only~~ — evaluates FEL via `evalFEL`
- **2.** ~~PascalCase widgetHints~~ — corrected to camelCase
- **3.** ~~JSON adapter `pretty` default~~ — changed to spec default `false`
- **4.** ~~Screener route heuristic fallback~~ — heuristic documented with trade-off comment
- **5.** ~~`lib/` re-export wrappers~~ — eliminated
- **6.** ~~`src/chat/` v1 dead code~~ — deleted
- **7.** ~~`PropertiesPanel.tsx` dead prototype~~ — deleted
- **8.** ~~`Spacer` invalid widgetHint~~ — moved to layout
- **9.** ~~ITEM_TYPE_WIDGETS missing `Tabs`~~ — added
- **10.** ~~Row summaries secondary bind properties~~ — `nonRelevantBehavior` pill added (keep/empty)
- **11.** ~~Missing CSV `encoding` option~~ — added
- **12.** ~~`isStudioGeneratedComponentDoc` comment~~ — JSDoc added
- **13.** ~~Story fixtures PascalCase~~ — corrected
- **15.** ~~`@faker-js/faker` prod dep~~ — removed
- **16.** ~~`COMPONENT_TO_HINT` Collapsible→accordion~~ — removed
- **17.** ~~Test file naming ambiguity~~ — renamed
- **18.** ~~Orphaned E2E spec~~ — moved
- **20.** ~~`SubmitButton` spec prose~~ — S5.19 added

</details>

<details>
<summary>Resolved items from chaos-test + DnD review + studio plans (click to expand)</summary>

- ~~ARCH-3: `analyze_fel_with_field_types` end-to-end~~ — full chain wired: WASM → bridge → API → parseFEL with `FEL_TYPE_MISMATCH`
- ~~Sigil hint ($name vs @name)~~ — `expression-index.ts:129` emits `FEL_SIGIL_HINT`
- ~~BUG-5: Shape per-row evaluation~~ — `shapes.rs:117-227` evaluates per-instance correctly
- ~~UX-5: Theme token validation/listing~~ — `theme.ts:64` validates, `:73` lists
- ~~CONF-3: Variables in bind expressions~~ — `parseFEL` includes variables in known refs
- ~~addPage standalone-only refactor~~ — code matches plan; `standalone` option and `groupKey` removed
- ~~BUG-1: `parentPath` doubles path~~ — fixed in `_resolvePath`
- ~~BUG-2: Date comparison with `today()`~~ — `json_to_runtime_fel_typed` coerces dates
- ~~BUG-4: Conditional required on calculated fields~~ — `refresh_required_state()` re-evaluates after calculate
- ~~BUG-6: Required fires on repeat template at 0 instances~~ — `repeat_expand.rs` clears children
- ~~BUG-7: `remove_rule` ambiguous~~ — `removeValidation` normalizes target
- ~~BUG-8: `sample_data` ignores scenario~~ — `generateSampleData(overrides?)` added
- ~~BUG-9: Cross-document audit leaf key~~ — broken check removed
- ~~BUG-10: Content items not findable by `placeOnPage`~~ — `_nodeRefForItem()` added
- ~~BUG-12: Save omits `status`~~ — `createDefaultDefinition` includes `status: 'draft'`
- ~~BUG-13: Unknown `Checkbox` component~~ — mapped to `Toggle`
- ~~BUG-14: Unevaluated `widgetHint` on component nodes~~ — allowlist export strips it
- ~~BUG-16: Repeat component unevaluated props~~ — allowlist export strips them
- ~~UX-1: No shape listing~~ — `formspec_describe(mode: 'shapes')` added
- ~~UX-2: `choices` silently ignored~~ — `.strict()` on Zod schemas
- ~~UX-3: Sample data dates~~ — dynamic today() dates, nested repeat arrays
- ~~UX-4: `formspec_create` skips bootstrap~~ — guide shows both paths
- ~~UX-6: `humanize` FEL limitation~~ — MCP surfaces `note` explaining supported patterns
- ~~UX-7: Flat sample data for repeat groups~~ — nested arrays with 2 sample instances
- ~~UX-8: Content appended at end~~ — `insertIndex` added to content schema
- ~~UX-9: `describe` vs `place` identifier mismatch~~ — `id` → `page_id`
- ~~UX-10: No unsaved indicator~~ — `isDirty` / `markClean()` on Project, surfaced in MCP statistics
- ~~CONF-1: Three parent-context mechanisms~~ — precedence notes in tool descriptions
- ~~CONF-2: Money diagnostic gap~~ — evaluator.rs now suggests `moneyAmount()` for money/number and money/money ordering
- ~~BUG-3: Money comparison diagnostic~~ — evaluator.rs suggests `moneyAmount()` in all money comparison failures
- ~~FIX 8: FEL rewrite for repeat wildcard shapes~~ — `addValidation` rewrites FEL at write time via `rewriteFELReferences`/`rewriteMessageTemplate`
- ~~Sortable-only E2E test gap~~ — skip reasons documented (dnd-kit simulation limitation)
- ~~Layout DnD Finding 1: Sibling fallback~~ — `siblingIndicesForTreeReorder` derives from tree
- ~~Layout DnD Finding 3: Stale `isDragging` comment~~ — fixed
- ~~Layout DnD Finding 5: `bind:` prefix encoding~~ — JSDoc added

</details>
