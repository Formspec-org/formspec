# THOUGHTS.md — Document Audit & Review

**Generated:** 2026-02-24
**Scope:** All planning docs, proposals, ADRs, and audit files — now consolidated in `thoughts/adr/`.

---

## Table of Contents

| ADR | File | Status Header | Notes |
|-----|------|---------------|-------|
| 0001 | [0001-linter-policy-and-modes.md](docs/adr/0001-linter-policy-and-modes.md) | Accepted | Active; fully implemented |
| 0002 | [0002-presentation-layer-approach-a.md](docs/adr/0002-presentation-layer-approach-a.md) | Superseded | Adopted as Tier 1 in `spec.md` §4.2.5 |
| 0003 | [0003-presentation-layer-approach-b.md](docs/adr/0003-presentation-layer-approach-b.md) | Superseded | Adopted as `theme-spec.md` |
| 0004 | [0004-presentation-layer-approach-c.md](docs/adr/0004-presentation-layer-approach-c.md) | Superseded | Adopted as `component-spec.md` |
| 0005 | [0005-tier1-presentation-hints-plan.md](docs/adr/0005-tier1-presentation-hints-plan.md) | Implemented | All 22 tasks complete |
| 0006 | [0006-tier1-revised-plan.md](docs/adr/0006-tier1-revised-plan.md) | Implemented | 111 tests passing |
| 0007 | [0007-tier2-theme-revised-plan.md](docs/adr/0007-tier2-theme-revised-plan.md) | Implemented | 201 tests; cascade gap closed by ADR-0019 |
| 0008 | [0008-tier2-theme-implementation-plan.md](docs/adr/0008-tier2-theme-implementation-plan.md) | Implemented | Simplifications vs plan (flat tokens, 3-level cascade) |
| 0009 | [0009-tier3-component-plan.md](docs/adr/0009-tier3-component-plan.md) | Implemented | Test gap: 111 of ~450 planned |
| 0010 | [0010-tier3-component-revised-plan.md](docs/adr/0010-tier3-component-revised-plan.md) | Implemented | `accessibility` spec-schema drift |
| 0011 | [0011-hardening-plan.md](docs/adr/0011-hardening-plan.md) | Partially Implemented | PathResolver stub + innerHTML wipe remain |
| 0012 | [0012-schema-review.md](docs/adr/0012-schema-review.md) | Implemented | Spec example fixes done; fully complete |
| 0013 | [0013-audit-spec-vs-schema.md](docs/adr/0013-audit-spec-vs-schema.md) | Implemented | 200 FULL, 9 PARTIAL, 3 MISSING |
| 0014 | [0014-llm-spec-generation-plan.md](docs/adr/0014-llm-spec-generation-plan.md) | Implemented | CI enforcement not yet wired |
| 0015 | [0015-e2e-testing-plan.md](docs/adr/0015-e2e-testing-plan.md) | Implemented | 3 missing FEL functions: `boolean()`, `date()`, `time()` |
| 0016 | [0016-feature-completeness-remediation.md](adr/0016-feature-completeness-remediation.md) | Proposed | 12-phase vertical remediation plan; partially executed |
| 0017 | [0017-playwright-e2e-reorganization-and-deduplication.md](adr/0017-playwright-e2e-reorganization-and-deduplication.md) | Implemented | Intent-based folder split; shared helpers added |
| 0018 | [0018-python-unit-test-reorganization-and-ownership.md](adr/0018-python-unit-test-reorganization-and-ownership.md) | Implemented | All 29 files migrated to `tests/unit/`; 1,882 tests |
| 0019 | [0019-theme-cascade-default-theme.md](adr/0019-theme-cascade-default-theme.md) | Implemented | 5-level cascade resolver + `default-theme.json` + ARIA fixes |
| 0020 | [0020-css-integration-and-design-system-interop.md](adr/0020-css-integration-and-design-system-interop.md) | Implemented | `cssClass`/`stylesheets` in schemas + renderer |
| 0021 | [0021-holistic-kitchen-sink-e2e-conformance-plan.md](adr/0021-holistic-kitchen-sink-e2e-conformance-plan.md) | Implemented | All phases implemented (Python runner + Playwright) |
| 0022 | [0022-component-playground-strategy.md](adr/0022-component-playground-strategy.md) | Implemented | Custom playground shipped with diagnostics, deterministic runtime controls, mapping/replay tooling, and Playwright `/playground` + `/demo` convergence coverage |

---

## Cross-Cutting Findings

Before the per-file reviews, here are the **recurring themes** that surfaced across multiple documents:

### Runtime gaps in the web component
The TypeScript web component (`packages/formspec-webcomponent/`) previously accepted theme and component documents without using them. Remaining gaps:
- **Theme cascade (ADR-0019): IMPLEMENTED** — `theme-resolver.ts`, `default-theme.json`, `resolveItemPresentation()` on `RenderContext`.
- **`cssClass`/`stylesheets` (ADR-0020): IMPLEMENTED** — schemas updated, `applyCssClass()` and `loadStylesheets()` in renderer.
- **All 33 components: IMPLEMENTED** — all built-in components have renderer implementations.
- **Reactive reconciliation: NOT DONE** — renderer still calls `this.innerHTML = ''` on every render, causing focus loss and re-render thrashing (ADR-0011). Page/region layout also has no runtime implementation.

### Test coverage shortfalls
Component test gap remains significant:
- ~111 tests delivered vs ~450 planned (ADR-0009) / ~229 planned (ADR-0010)
- Missing: repeatable group binding, cross-tier interaction (theme + component), responsive override merge, exhaustive compatibility matrix

### Spec example drift
**Resolved.** `"choices"`, `"targets"` (plural), boolean `required`/`readonly` patterns all corrected in canonical spec.

### Duplicate `validator/` package
**Resolved.** Root-level `validator/` directory removed; single canonical copy at `src/formspec/validator/`.

---

## Per-File Reviews

### 1. `docs/adr/0012-schema-review.md`

**What it is:** A cross-reference audit (2025-07-11) of `definition.schema.json` and `response.schema.json` against the core spec. Catalogues 18 issues across four categories with a prioritized action list.

**Implementation status:** ~85% resolved. All high-priority structural schema fixes are done (Group `$ref`/`keyPrefix`, separate response fields, `derivedFrom` type evolution, Instance `description`/`source` format, `extensions` `propertyNames`, `validationReport.schema.json` created, Shape `id` pattern expanded).

**Assessment:** Fully resolved. Schemas sound, spec examples corrected.

**Verdict:** **Archive.**

---

### 2. `docs/adr/0003-presentation-layer-approach-b.md`

**What it is:** Proposal for a sidecar theme document architecture — separate `.theme.json` files governing widget selection, design tokens, page layout, and styling.

**Implementation status:** Core proposal adopted and substantially implemented. The Theme Specification (`specs/theme/theme-spec.md`), JSON Schema (`schemas/theme.schema.json`), and 201 Python conformance tests all exist. Token syntax changed from `{token.path}` to `$token.<key>`. Path-pattern selectors were dropped. Widget names are camelCase (not kebab-case).

**What's NOT done:** Theme inheritance (`extends`) remains deferred (not in spec or schema).

**Assessment:** Good proposal, well-executed. Superseded by the formal spec which is strictly better. Theme cascade is now implemented (ADR-0019).

**Verdict:** **Archive** — superseded by `specs/theme/theme-spec.md`.

---

### 3. `docs/adr/0008-tier2-theme-implementation-plan.md`

**What it is:** Detailed implementation plan for building the Tier 2 Theme specification. 4 phases, targeting ~447 tests across 16 test files.

**Implementation status:** Executed with deliberate simplifications. Spec: 1,110 lines (plan projected 2,800–3,400). Schema: 287 lines (plan projected 550–700). Tests: 171 (plan projected ~447). Flat tokens replaced DTCG format. 3-level cascade replaced 4-level. Theme inheritance (`extends`) deferred.

**What's NOT done:** Path-pattern selectors and theme inheritance (`extends`) remain deferred. Runtime cascade is now implemented (ADR-0019). E2E theme coverage is included in the holistic kitchen-sink suite (ADR-0021).

**Assessment:** The simplifications were improvements. The plan served its purpose.

**Verdict:** **Archive** — the spec is the canonical source now.

---

### 4. `docs/adr/0006-tier1-revised-plan.md`

**What it is:** Detailed plan for adding presentation hints to the core spec — `formPresentation` root object and per-item `presentation` object.

**Implementation status:** **Fully implemented.** `definition.schema.json` has `formPresentation` and `$defs/Presentation`. `spec.md` has §4.1.1 and §4.2.5. `test_presentation_hints.py` has 111 passing tests. AD-02 rewritten. Requirements PR-01 through PR-07 tracked.

**Assessment:** Good idea, well executed. The `additionalProperties: true` at the top-level `presentation` object is the correct forward-compatibility call.

**Verdict:** **Archive / mark done.** Nothing left to implement.

---

### 5. `docs/adr/0005-tier1-presentation-hints-plan.md`

**What it is:** Earlier version of the Tier 1 presentation hints plan, framing them as one of three competing approaches (A/B/C).

**Implementation status:** **Fully implemented.** All concepts are normative in `spec.md`, `definition.schema.json`, and referenced by both Theme and Component specs. The three-tier cascade (hints < theme < component) is the adopted architecture.

**Assessment:** Sound design, correctly adopted. The "90% solution" framing was accurate — it handles most cases with minimal complexity.

**Verdict:** **Archive** — move to `docs/adr/` as a decision record.

---

### 6. `docs/adr/0011-hardening-plan.md`

**What it is:** Post-prototype pivot document. Identified four categories of technical debt in the spike implementation and proposed replacements: AST interpreter for FEL, component registry, JSON Pointer paths, reactive diffing engine.

**Implementation status:**
- **FEL AST Interpreter: DONE** — Full Chevrotain pipeline, zero `eval`/`new Function`.
- **Component Registry: DONE** — Clean `register()`/`get()` pattern in `registry.ts`.
- **JSON Pointer Path Resolver: DELETING** — `PathResolver` is dead code; never called; 16+ inline splits in `index.ts` do the work. Will be deleted (task #4). A real implementation should be designed as part of ADR-0016 path-handling work.
- **Reactive Reconciliation: NOT DONE** — Web component still calls `this.innerHTML = ''` on every render. Focus loss and re-render thrashing remain unaddressed.

**Assessment:** 3 of 4 pillars resolved. innerHTML wipe is the remaining significant gap.

**Verdict:** **Act on it** — reactive reconciliation is tracked in open actions.

---

### 7. `docs/adr/0009-tier3-component-plan.md`

**What it is:** Pre-implementation plan for the Component Specification. 33 built-in components, `if/then` schema discrimination, slot binding, ~450-test suite.

**Implementation status:** Substantially implemented with refinements. Spec exists (3,227 lines). Schema exists (715 lines). Components split into Core (18) + Progressive (15). Discriminator changed from `"type"` to `"component"`. `AccessibilityBlock` added (not in plan).

**What's NOT done:**
- `Popover` component missing from schema and renderer
- Test coverage: ~111 delivered vs ~450 planned (~75% gap)
- Missing test categories: repeatable group binding, responsive merge, cross-tier, exhaustive compatibility matrix

**Assessment:** Good plan, well executed. The Core/Progressive split was an improvement over the flat four-category approach.

**Verdict:** **Archive** — extract `Popover` gap and test coverage shortfall as separate tasks.

---

### 8. `docs/adr/0007-tier2-theme-revised-plan.md`

**What it is:** Post-review execution plan for the Theme Specification. 24-task sequence, ~200 tests target, deliberate scope reduction from an overengineered first draft.

**Implementation status:** **Fully executed.** Spec: 1,110 lines. Schema: 287 lines. Tests: 201 (exceeding the ~200 target). All four phases complete. Cross-references in `spec.md` present.

**What's NOT done:** Runtime cascade is now implemented (ADR-0019).

**Assessment:** Excellent execution. The post-review scope reduction was the right call.

**Verdict:** **Archive** — runtime cascade gap should be tracked separately.

---

### 9. `docs/adr/0010-tier3-component-revised-plan.md`

**What it is:** Post-review implementation plan for the Component Specification. Scope-reduced from a draft that received 14 review issues. 25 tasks, 4 phases, ~229 tests target.

**Implementation status:** Substantially implemented. Spec, schema, and initial tests all exist and pass. 111 tests delivered (vs ~229 planned). `AccessibilityBlock` added to all components post-plan.

**What's NOT done:**
- Test gap: ~118 missing tests (bind resolution, repeatable groups, cross-tier, conformance levels)
- `accessibility` documented in schema but NOT in spec §3.1 base properties table (tracked in open actions)
- Debug `console.log` calls in `index.ts` (tracked in open actions)

**Assessment:** Sound design decisions (global-key binding, Core/Progressive split, structural cycle detection). The `{param}` ABNF grammar prevents injection issues.

**Verdict:** **Archive** — extract the three follow-up items as tasks.

---

### 10. `docs/adr/0002-presentation-layer-approach-a.md`

**What it is:** Original proposal for inline presentation hints in the Definition. Four sub-objects: `widgetHint`, `layout`, `styleHints`, `accessibility`.

**Implementation status:** **Fully adopted** as normative Tier 1. Schema, spec, and tests all implement it. Theme and Component specs both reference it as the cascade baseline.

**Assessment:** Aged well. Clean design, correctly scoped as "90% solution." The `x-` extension mechanism is consistent with the rest of the spec.

**Verdict:** **Archive** — move to `docs/adr/` as a historical decision record.

---

### 11. `docs/adr/0004-presentation-layer-approach-c.md`

**What it is:** Proposal for a full component-tree-based presentation layer. ~30 built-in components, slot binding, custom component registry, FEL conditionals, responsive breakpoints, design tokens.

**Implementation status:** **Adopted** as the Component Specification. All core concepts implemented. Refinements: `Popover` dropped, `Signature` added, `AccessibilityBlock` added universally, `ConditionalGroup.fallback` simplified from children array to string.

**Assessment:** Correctly identified that hint-based approaches can't handle structural reorganization. Sound proposal, faithfully adopted.

**Verdict:** **Archive** — move to `docs/proposals/` alongside approach-a for consistency. Currently inconsistently placed at `docs/` root.

---

### 12. `docs/adr/0013-audit-spec-vs-schema.md`

**What it is:** Comprehensive gap analysis (2026-02-22) comparing all specs against their JSON Schemas. 261 tracked features. Final tally: 200 FULL, 9 PARTIAL, 3 MISSING, 49 N/A.

**Implementation status:** All 11 original top issues verified as resolved. 3 remaining MISSING items are JSON Schema fundamental limitations (acknowledged). 9 PARTIAL items are accepted trade-offs.

**Key decisions documented:** `mustUnderstand` removed, `labelOverride`/`hintOverride` removed, `bind` removed from layout containers, `null` replaced by `"none"` sentinel, `derivedFrom` changed to oneOf, `changelog.schema.json` created.

**Assessment:** Thorough and accurate. No drift between audit claims and actual codebase state.

**Verdict:** **Archive** — move to `docs/adr/` as a completed audit record.

---

### 13. `docs/adr/0001-linter-policy-and-modes.md` (unchanged)

**What it is:** ADR establishing a two-mode severity policy for the linter: `authoring` (lenient) and `strict` (CI-grade). Four escalation codes: W800, W802, W803, W804.

**Implementation status:** **Fully implemented.** `policy.py`, `component_matrix.py`, CLI `--mode` flag, and targeted tests all present and passing.

**Assessment:** Strong architectural decision. Centralized policy transform is the correct pattern — individual passes emit at natural severity, policy layer applies mode transforms.

**Concern:** Duplicate `validator/` tree (root-level copy + `src/` copy) is a maintenance smell.

**Verdict:** **Keep** — still relevant, actively used. Fix the duplicate `validator/` tree separately.

---

### 14. `docs/adr/0014-llm-spec-generation-plan.md`

**What it is:** Design and execution plan for the LLM doc generation workflow. AST-based markdown extraction with `<!-- llm:omit -->` markers, `*.llm.md` output, CI enforcement.

**Implementation status:** **Fully implemented.** `scripts/generate-llm-specs.mjs` exists. All 4 npm scripts work. All 7 specs have markers and generated companions. Budget system (`llm-budgets.json`) added beyond the plan.

**What's NOT done:** CI enforcement (no `.github/` directory exists at all).

**Assessment:** Sound design, well executed. The budget system is a welcome addition.

**Verdict:** **Archive** — move to `docs/adr/` as `0002-llm-spec-generation.md`.

---

### 15. `docs/adr/0015-e2e-testing-plan.md`

**What it is:** Phased roadmap for E2E testing. Three-layer architecture (FormEngine, web component, Playwright). Six phases, five marked complete.

**Implementation status:** Phase 6 is marked "PENDING" but is ~90% complete. Most stdlib functions are implemented in `interpreter.ts`. Cyclic dependency detection is implemented (with a stale `console.log`).

**What's genuinely NOT done:**
- `boolean()`, `date()` cast functions and `time(h,m,s)` constructor (tracked in open actions)
- Remote REST API binding for `choice` components (tracked in open actions)
- Debug `console.log` calls (tracked in open actions)

**Assessment:** The document is significantly stale — claiming Phase 6 is PENDING when 90% of it is done is misleading.

**Verdict:** **Act on it** — implement the 3 missing functions (`boolean()`, `date()`, `time()` constructor), remove the debug logs, then delete the file.

---

### 16. `adr/0016-feature-completeness-remediation.md`

**What it is:** A 12-phase vertical remediation plan addressing implementation gaps found by a cross-cutting audit. Covers schema naming alignment, `$ref` assembly, bind features, FEL completeness, shape composition, instances, web component fixes and new components, accessibility/responsive/custom components, Python mapping engine, extended engine features, and Python tooling.

**Implementation status (inferred from codebase state):**
- Phase 1 (Schema Alignment): **IN PROGRESS** — `interpreter.ts` and `index.ts` modified; naming fixes underway.
- Phase 2 (Definition Assembly): **IN PROGRESS** — `packages/formspec-engine/src/assembler.ts` added.
- Phase 10 (Python Mapping): **IN PROGRESS** — `src/formspec/mapping/` added (`engine.py`, `transforms.py`).
- Phase 12 (Python Tooling): **IN PROGRESS** — `src/formspec/registry.py` and `src/formspec/changelog.py` added.
- Phases 3-9, 11: status unclear — dependent on Phase 1/2 completion.

**Assessment:** Sound dependency ordering (schema alignment before feature work). The vertical-slice approach ensures each phase is independently committable. The plan correctly identifies `$ref` assembly as a full publish-time concern rather than a runtime shortcut.

**Verdict:** **Act on it** — execution is underway. Update status to `In Progress`. Each completed phase should be marked as it ships.

---

### 17. `adr/0017-playwright-e2e-reorganization-and-deduplication.md`

**What it is:** Reorganizes the Playwright suite from a flat 22-file layout into intent-based subdirectories: `smoke/` (component smoke tests), `integration/` (cross-feature flows), `components/` (component prop contracts), and a shared `helpers/` layer.

**Implementation status:** **Fully implemented.** New directories exist: `tests/e2e/playwright/{smoke,integration,components,helpers}/`. Shared helpers (`gotoHarness`, `mountDefinition`, `submitAndGetResponse`) extracted. Old flat files deleted (23 files removed per git status).

**Assessment:** The structural problem it addressed was real — mixing engine-only, browser-integration, and component-contract tests in a flat directory made ownership unclear. The intent-based split is the correct call for a growing suite.

**Verdict:** **Archive** — implementation complete. Update status to `Implemented`.

---

### 18. `adr/0018-python-unit-test-reorganization-and-ownership.md`

**What it is:** Maps 29 flat Python test files to an ownership-based structure under `tests/unit/{schema,runtime,support}`, deduplicates schema loading setup, and clarifies which tests belong to conformance vs runtime vs tooling layers.

**Implementation status:** **Fully implemented.** All 29 files reorganised under `tests/unit/{schema,runtime,support}/`. `tests/unit/support/schema_fixtures.py` centralises schema loading. `conftest.py` auto-attaches pytest markers by path. 1,882 tests collected.

**Assessment:** The ownership confusion it described is gone. Clean separation between schema/conformance tests and runtime package tests.

**Verdict:** **Archive** — implementation complete.

---

### 19. `adr/0019-theme-cascade-default-theme.md`

**What it is:** Implements the 5-level theme cascade (Tier 1 hints < theme defaults < theme selectors < theme item overrides < component document) as a pure-function resolver, adds `default-theme.json` as the baseline, strengthens types throughout, and fixes pre-existing ARIA bugs (`aria-description` → `aria-describedby`, unconditional `role="status"` removed).

**Implementation status:** **Fully implemented.** `packages/formspec-webcomponent/src/theme-resolver.ts` and `packages/formspec-webcomponent/src/default-theme.json` added. `types.ts`, `index.ts`, and all component files modified. ARIA fixes applied. `resolveItemPresentation()` exposed on `RenderContext`.

**Assessment:** This closes the largest single runtime gap identified in the original audit. The pure-function design (testable without a browser) is correct. Typing `SelectorMatch.dataType` as `FormspecDataType` prevents silent cascade misses at compile time.

**Verdict:** **Archive** — implementation complete.

---

### 20. `adr/0020-css-integration-and-design-system-interop.md`

**What it is:** Three additive spec escape hatches for CSS design system integration: `cssClass` (string | string[]) on any component document, `stylesheets` (array of URIs) on theme documents, and guidance on CSS custom property naming conventions for token exposure. All are optional and additive — no existing documents break.

**Implementation status:** **Fully implemented.** `cssClass` is in both `theme.schema.json` (on `PresentationBlock`) and `component.schema.json` (on all 34 components). `stylesheets` is in `theme.schema.json`. Renderer applies `cssClass` via `applyCssClass()` at field wrappers, group wrappers, and display elements. `loadStylesheets()` injects `<link>` tags with deduplication and `cleanupStylesheets()` removes them on disconnect.

**Assessment:** Pragmatic and complete. The open question around `$token.` in `cssClass` values remains unresolved but does not block usage.

**Verdict:** **Archive** — implementation complete.

---

### 21. `adr/0021-holistic-kitchen-sink-e2e-conformance-plan.md`

**What it is:** A phased plan for a single holistic end-to-end scenario that proves the full system works: authoring contracts (all 6 schema types), runtime behavior (engine + web component + FEL + validation), response artifacts, migration, and cross-implementation parity (TS vs Python).

**Implementation status:** **Fully implemented.** Complete multi-document bundle in `tests/e2e/fixtures/kitchen-sink-holistic/` (definition v1+v2, theme, component, mapping, registry, changelog, parity-cases). Python conformance runner (`tests/e2e/kitchen_sink/conformance_runner.py`) covers phases 0–1 and 5–8. Playwright spec (`tests/e2e/playwright/integration/kitchen-sink-holistic-conformance.spec.ts`) covers phases 2–4 and parity replay (phase 8). Smoke fixtures and smoke spec also added.

**Assessment:** Provides the holistic release-readiness signal the project needed. All 9 spec sections covered across the matrix.

**Verdict:** **Archive** — implementation complete. Run the conformance runner and Playwright suite to gate releases.

---

## Recommended Actions Summary

### Open actions

**Engine / FEL**

**#1 — Remove debug `console.log` calls** *(task #1)*
Remove 3 stray debug logs from `packages/formspec-engine/src/index.ts`:
- Line 478: `console.log("Detecting cycles for", ...)` in `detectCycles()`
- Line 504: `console.log("Cycle detection complete")` in `detectCycles()`
- Line 927: `console.log(\`Compiling FEL: ...\`)` in `compileFEL()`
No tests cover these; just delete the lines.

**#2 — Implement `boolean()`, `date()`, `time(h,m,s)` in FEL interpreter** *(task #3)*
Parity gap: Python has all three implemented and tested; TypeScript is missing `boolean()` and `date()` entirely, and `time()` has the wrong signature (1-arg extractor, not 3-arg constructor).
- `boolean(v)` — null→false, `"true"`/`"false"`→boolean, non-zero number→true
- `date(v)` — parse ISO date string; null→null
- `time(h, m, s)` — construct `"HH:MM:SS"` from three number args (replace/rename the existing 1-arg `time(d)` extractor)
Work order: (1) add failing unit tests in `packages/formspec-engine/tests/` mirroring `tests/unit/runtime/fel/test_fel_functions.py::TestCastFunctions`; (2) add cases to `tests/e2e/fixtures/fel-functions.json`; (3) add failing Playwright assertions in `tests/e2e/playwright/integration/fel-standard-library-ui.spec.ts` (which already tests `time(d)` and `number(v)` as models); (4) implement; (5) confirm green.
The E2E fixture `fel-functions.json` and the Playwright spec `fel-standard-library-ui.spec.ts` exist and cover 45+ functions — `boolean`, `date`, and `time(h,m,s)` are the only missing cast functions.

**#3 — Delete dead `PathResolver` class** *(task #4)*
`packages/formspec-engine/src/path-resolver.ts` is imported in `index.ts` but never called. The engine has 16+ inline path splits (`path.split(/[.\[\]]/)` etc.) that do the actual work. Delete the file, remove the import, confirm `npm run build` passes. Do NOT attempt to consolidate the inline splits — that is a larger design decision for ADR-0016 path-handling work.

**#4 — Execute ADR-0016 remaining phases (3–9, 11)** *(task #9)*
Phases 1, 2, 10, 12 are in progress (`assembler.ts` added, `mapping/` added, `registry.py`/`changelog.py` added). Remaining phases in dependency order:
- Phase 3: Core bind features (required, constraint, readonly, calculate — full spec compliance)
- Phase 4: FEL completeness and `$variables` block evaluation
- Phase 5: Shape composition + submit/draft semantics (`getResponse()` must run submit-timed validation)
- Phase 6: Instances and pre-population (`instance()` function, host-provided data)
- Phase 7: WebComponent props fixes (Wizard multi-page, accessible labels, etc.)
- Phase 8: New components — all 12 previously missing are now implemented; verify and mark done
- Phase 9: Accessibility, responsive overrides, custom components (`{param}` interpolation)
- Phase 11: Extended engine features (screener routing, `mustUnderstand`)
Phases 3, 4, 5 can proceed in parallel after Phase 2. Phases 7–9 sequential. Full change tables per phase in `thoughts/adr/0016-feature-completeness-remediation.md`.

---

**Web Component**

**#5 — Fix reactive reconciliation** *(task #5)*
`packages/formspec-webcomponent/src/index.ts` calls `this.innerHTML = ''` on every render, wiping and rebuilding the full DOM. This causes input focus loss on every state change and full teardown/rebuild on every signal update. Replace with incremental DOM updates. Options: lit-html, Preact/htm, or hand-rolled diffing. Prefer minimal — avoid a full framework if a small diffing utility suffices. Referenced in ADR-0011 (the last unresolved of its 4 pillars).

---

**Spec / Schema**

**#6 — Add `accessibility` to component-spec §3.1** *(task #2)*
`AccessibilityBlock` (`role`, `description`, `liveRegion`) is defined in `schemas/component.schema.json` for all 34 components but is completely absent from `specs/component/component-spec.md`. The §3.1 base properties table currently lists 7 properties (`component`, `bind`, `when`, `responsive`, `style`, `cssClass`, `children`) — `accessibility` must be added as the 8th. Also add a cross-spec contract test in `tests/unit/schema/contracts/test_cross_spec_contracts.py` that extracts the §3.1 table and asserts all schema-defined base properties are present, to prevent silent drift. Run `npm run docs:generate && npm run docs:check` after.
No automated check currently catches this gap — the §3.1 table is hand-maintained with no `schema-ref` block.

---

**Components**

**#7 — Add `Popover` component** *(task #6)*
Was in the original ADR-0009 plan; never implemented. Needs all three layers:
1. Schema — add discriminated `Popover` variant to `schemas/component.schema.json` (props: trigger bind, content slot, placement). Model on `Modal` and `Collapsible`.
2. Spec — add to `specs/component/component-spec.md` Progressive section with property table and examples.
3. Renderer — register in `packages/formspec-webcomponent/src/components/interactive.ts`. Consider the HTML Popover API (`popover` attribute) for the implementation.
Run `npm run docs:generate && npm run docs:check` after schema/spec changes.

---

**Tests**

**#8 — Close component E2E test gap (~118 tests)** *(task #7)*
~111 tests delivered vs ~229 planned (ADR-0010). Missing categories:
1. Repeatable group binding — components inside repeat groups with indexed paths (`items[0].name`), add/remove rows, bind resolution per instance
2. Cross-tier interaction — theme selector cascade + component document together; `when` vs theme `widgetHint` interaction
3. Responsive override merge — breakpoint overrides in component documents at the right viewport width
4. Exhaustive compatibility matrix — 18 Core components × supported `dataType` values → correct default widget + bind wiring
Tests go in `tests/e2e/playwright/components/` (ADR-0017 structure). Use harness helpers (`gotoHarness`, `mountDefinition`, `submitAndGetResponse`) from `tests/e2e/playwright/helpers/`.

**#9 — Remote REST API binding for `choice` components** *(task #8)*
`choice` and `multiChoice` fields support a `remoteOptions` bind for fetching option lists from a REST endpoint at runtime. Was in ADR-0015 Phase 6 scope; never built.
1. Engine (`packages/formspec-engine/src/index.ts`) — handle `bind.remoteOptions`: fetch URL, parse `{ value, label }` pairs, store in a signal, expose via engine API.
2. Web component — wire fetched options into `Select`, `RadioGroup`, `CheckboxGroup` renderers.
3. Error handling — loading state, fetch failure fallback.
4. Tests — use Playwright `page.route()` to mock the fetch; assert options appear in the rendered component.
Check `specs/component/component-spec.md` and `specs/core/spec.md` for the exact field name and response shape before implementing.
