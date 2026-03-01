# E2E Test Migration Tracker

**Reference:** `thoughts/e2e-test-review-report.md`
**Started:** 2026-03-01

## Current Status

- **Current Phase:** COMPLETE
- **Blockers:** None
- **Engine tests:** 194 pass (2026-03-01, post-Phase 6 gate)
- **Webcomponent tests:** 121 pass (2026-03-01, post-Phase 6 gate)
- **Playwright tests:** 81 pass (2026-03-01, post-Phase 6 gate)

---

## Phase 0: Infrastructure

- [x] **0.1** Create `packages/formspec-engine/tests/fixtures/` directory
- [x] **0.2** Copy `examples/grant-application/definition.json` → `packages/formspec-engine/tests/fixtures/grant-app-definition.json`
- [x] **0.3** Create `packages/formspec-engine/tests/helpers/grant-app.mjs` — helper to load the fixture definition and instantiate a FormEngine. Export: `createGrantEngine()`, plus thin wrappers `engineValue(engine, path)`, `engineVariable(engine, name)`, `getValidationReport(engine, mode)`, `getResponse(engine)`, `addRepeatInstance(engine, name)`, `removeRepeatInstance(engine, name, index)`
- [x] **0.4** Verify infrastructure: write a single smoke test in `packages/formspec-engine/tests/grant-app-smoke.test.mjs` that loads the grant definition, sets one value, reads it back. Run `npm run test:unit --workspace=packages/formspec-engine`. Must pass.
- [x] **GATE** All engine tests pass: `npm run test:unit --workspace=packages/formspec-engine`

**Commit:** `build: add grant-app fixture and helpers for engine test migrations`

---

## Phase 1: Delete fixture audits (~56 tests)

- [x] **1.1** In `schema-parity-phase1.spec.ts`: delete the 51 fixture-audit tests (Definition Enrichment tests that just read JSON structure, Theme Enrichment, Component Enrichment, and Response Enrichment `fs.readFileSync` tests). Keep only: dateTime/time/uri field round-trips (3 tests), initialValue today() (1 test), prePopulate readonly (1 test) — these 5 will be migrated in Phase 3.
- [x] **1.2** In `grant-app-data-types.spec.ts`: delete the 2 definition-introspection tests ("should have attachment dataType on narrativeDoc" and "should render money field with USD badge" if it's the fallback-to-definition-read version).
- [x] **1.3** In `grant-app-wizard-flow.spec.ts`: delete the 3 definition-introspection tests (migrations object, labels metadata, semanticType metadata). Delete the fragile FileUpload test with try/catch fallback.
- [x] **1.4** In `accessibility-responsive-custom-components.spec.ts`: delete the recursion-detection test (duplicate of existing `render-lifecycle.test.ts` unit test).
- [x] **GATE** Playwright passes: `npx playwright test` (235 pass, 2 pre-existing failures in unmodified files)

**Commit:** `test: delete ~56 fixture-audit and duplicate tests from E2E suite`

---

## Phase 2: Engine migrations — high-value files (~61 tests, 4 new engine files, 4 Playwright files deleted)

Port these 4 complete Playwright files to engine unit tests, then delete each Playwright file:

- [x] **2.1** Create `packages/formspec-engine/tests/fel-stdlib-grant-app.test.mjs`. Port all 17 tests from `fel-standard-library-ui.spec.ts` (upper, coalesce, round, year, dateDiff, dateAdd, abs, isNull, sum, precedence, matches, contains).
- [x] **2.2** Create `packages/formspec-engine/tests/validation-shapes-and-binds.test.mjs`. Port all 21 tests from `grant-app-validation.spec.ts` (bind constraints, whitespace normalization, ValidationReport shape, Response contract, shape rules with activeWhen/timing/or/not composition).
- [x] **2.3** Create `packages/formspec-engine/tests/budget-calculations.test.mjs`. Port all 11 tests from `grant-app-budget-calculations.spec.ts` (subtotal, precision, variables, repeat add/remove, cardinality validation).
- [x] **2.4** Create `packages/formspec-engine/tests/conformance-contract.test.mjs`. Port all 12 tests from `grant-app-conformance.spec.ts`. Deduplicate: drop tests already covered by 2.2 (endDate constraint, ValidationReport shape, Response contract).
- [x] **2.5** Run engine tests — all new tests pass: `npm run test:unit --workspace=packages/formspec-engine`
- [x] **2.6** Delete the 4 Playwright source files: `fel-standard-library-ui.spec.ts`, `grant-app-validation.spec.ts`, `grant-app-budget-calculations.spec.ts`, `grant-app-conformance.spec.ts`
- [x] **2.7** Playwright still passes: `npx playwright test`
- [x] **GATE** Both engine and Playwright pass

**Commit:** `test: migrate 61 FEL/validation/budget/conformance tests from E2E to engine unit tests`

---

## Phase 3: Engine migrations — remaining files (~72 tests, 6 new engine files + overflow into existing)

- [x] **3.1** Create `packages/formspec-engine/tests/writable-instances.test.mjs`. Port all 15 tests from `writable-instances.spec.ts`. The 3 "inline engine" tests at the end use minimal inline definitions — keep them inline. Delete the Playwright file.
- [x] **3.2** Create `packages/formspec-engine/tests/nested-repeats.test.mjs`. Port all 5 from `nested-repeats-and-calculations.spec.ts`. Delete the Playwright file.
- [x] **3.3** Create `packages/formspec-engine/tests/date-constraint-null-handling.test.mjs`. Port the 7 date-null-handling tests plus 2 additional INTEGRATION-MIGRATE tests (test 8: phaseTasks data storage, test 11: taskCost computation) from `grant-app-discovered-issues.spec.ts` — 9 tests total. Remove those 9 tests from the Playwright file (keep only the 3 E2E-KEEP tests: tests 9, 10, 12 — DOM text assertions for computed values).
- [x] **3.4** Create `packages/formspec-engine/tests/data-type-round-trips.test.mjs`. Port 11 INTEGRATION-MIGRATE tests from `grant-app-data-types.spec.ts` plus the 5 remaining tests from `schema-parity-phase1.spec.ts` (dateTime/time/uri round-trips, initialValue today, prePopulate readonly). Delete both Playwright files entirely.
- [x] **3.5** Create `packages/formspec-engine/tests/visibility-and-pruning.test.mjs`. Port 8 INTEGRATION-MIGRATE tests from `grant-app-visibility-and-pruning.spec.ts`. Drop the 2 in-file duplicates (tests 9-10). Trim Playwright file to keep only the 2 E2E-KEEP tests (DOM class assertions for indirectRate).
- [x] **3.6** Create `packages/formspec-engine/tests/edge-case-coercion.test.mjs`. Port 1 test from `edge-case-behaviors.spec.ts`. Delete the Playwright file.
- [x] **3.7** Port the 1 UNIT-MIGRATE test from `core-component-props-and-fixes.spec.ts` (removeRepeatInstance row shifting) into an appropriate engine test file.
- [x] **3.8** Remove remaining INTEGRATION-MIGRATE tests from Playwright files that still have E2E-KEEP tests: `grant-app-wizard-flow.spec.ts` (4 engine-read tests: orgSubType value, agencyData instance, versionAlgorithm, prePopulate), `grant-app-ux-fixes.spec.ts` (5 validation-error tests: website URL, negative quantity/unitCost/hourlyRate, zero values), `grant-app-component-props.spec.ts` (3 engine-only tests: toggle, focusAreas, subtotal), `component-tree-engine-alignment.spec.ts` (2 signal checks: requiredSignals, relevantSignals), `component-gap-coverage.spec.ts` (1 repeat path test), `renderer-parity-gaps.spec.ts` (1 engine round-trip: DatePicker.showTime datetime value). Port each to the appropriate engine test file created in this or the previous phase.
- [x] **GATE** Engine tests pass: `npm run test:unit --workspace=packages/formspec-engine` AND Playwright passes: `npx playwright test`

**Commit:** `test: migrate remaining ~47 engine-only tests; trim E2E files to browser-only assertions`

---

## Phase 4: Webcomponent migrations (~25 tests, 5 new webcomponent files)

**WARNING:** Tests that use `getComputedStyle` (boxShadow, rowGap, gridTemplateColumns, flexDirection, backgroundColor) MUST stay in Playwright — happy-dom does not compute CSS. Do NOT migrate any test whose E2E-KEEP rationale mentions `getComputedStyle`.

- [x] **4.1** Create `packages/formspec-webcomponent/tests/component-props.test.ts`. Port 6 static-attribute tests from `core-component-props-and-fixes.spec.ts`: NumberInput min/max/step, Select clearable/placeholder, DatePicker min/max, TextInput prefix/suffix, Tabs defaultTab, Page description. Remove from Playwright file.
- [x] **4.2** Create `packages/formspec-webcomponent/tests/layout-components.test.ts`. Port 7 from `progressive-component-rendering.spec.ts`: Divider, Collapsible defaultOpen, Panel chrome, Accordion defaultOpen, FileUpload drop zone, Signature canvas, ProgressBar static. Remove from Playwright file.
- [x] **4.3** Create `packages/formspec-webcomponent/tests/a11y-attributes.test.ts`. Port 3 from `accessibility-responsive-custom-components.spec.ts`: label/describedby, role/live-region, accessibility metadata. Remove from Playwright file.
- [x] **4.4** Create `packages/formspec-webcomponent/tests/custom-components.test.ts`. Port template expansion test. Create `compatibility-matrix.test.ts`. Port matrix test from `component-gap-coverage.spec.ts` using `vi.spyOn(console, 'warn')`. Remove from Playwright files.
- [x] **4.5** Port remaining COMPONENT-MIGRATE tests from `renderer-parity-gaps.spec.ts` (Popover text fallback, Popover field value, Grid data-columns, Stack horizontal class) and `component-tree-rendering.spec.ts` (DataTable/Summary tab-sync) into appropriate webcomponent test files. Remove from Playwright files. Note: ProgressBar reactive update (`progressive-component-rendering.spec.ts` test 14) is E2E-KEEP — do NOT migrate. The renderer-parity-gaps tests are borderline — if migrating to happy-dom requires excessive grant-app fixture setup, keep them in Playwright instead.
- [x] **GATE** Webcomponent tests pass: `npx vitest run --config packages/formspec-webcomponent/vitest.config.ts` AND Playwright passes: `npx playwright test`

**Commit:** `test: migrate ~25 component tests to webcomponent unit tests`

---

## Phase 5: E2E restructuring

- [x] **5.1** Create new directory structure under `tests/e2e/playwright/`: `grant-app/`, `screener/`, `components/`, `conformance/`, `smoke/`
- [x] **5.2** Move as-is files: `screener-routing.spec.ts` → `screener/`, `remote-options-binding.spec.ts` → `components/remote-options.spec.ts`, `kitchen-sink-holistic-conformance.spec.ts` → `conformance/kitchen-sink-holistic.spec.ts`. Note: kitchen-sink-holistic contains mixed sub-checks (some UNIT-MIGRATE, some E2E-KEEP) but MUST remain monolithic — complex setup dependencies between sub-checks make splitting counterproductive.
- [x] **5.3** Consolidate remaining grant-app E2E tests into: `grant-app/wizard-navigation.spec.ts`, `grant-app/field-interaction.spec.ts`, `grant-app/readonly-and-styling.spec.ts`, `grant-app/conditional-visibility.spec.ts`, `grant-app/budget-ui.spec.ts`, `grant-app/project-phases-ui.spec.ts`, `grant-app/review-and-submit.spec.ts`
- [x] **5.4** Consolidate remaining component E2E tests into: `components/interactive-components.spec.ts`, `components/responsive-and-a11y.spec.ts`, `components/grant-app-component-rendering.spec.ts`
- [x] **5.5** Rewrite `kitchen-sink-smoke.spec.ts` → `smoke/happy-path.spec.ts` using real `page.fill()` / `page.click()` instead of `engineSetValue()`
- [x] **5.6** Delete all now-empty original files and old `integration/` and `components/` directories
- [x] **GATE** Playwright passes: `npx playwright test`. No old files remain.

**Commit:** `refactor: restructure E2E tests by user-facing concern`

---

## Phase 6: Final cleanup

- [x] **6.1** Audit for remaining cross-file duplicate assertions. The report identified 8 specific duplicates — verify each was resolved during migration:
  - endDate constraint (was in 3 files → should be 1 in engine tests)
  - nonprofitPhoneHint visibility (was 4 tests → should be 2 in engine tests)
  - ValidationReport shape (was in 2 files → should be 1)
  - nonRelevantBehavior remove (was in 2 files → should be 1)
  - EIN constraint (was in 2 files → should be 1)
  - contactEmail constraint (was in 2 files → should be 1)
  - duration calculation (was in 3 files → should be 1)
  - Response contract definitionUrl/version (was in 2 files → should be 1)
- [x] **6.2** Run full suite: `npm run build --workspace=formspec-engine && npm run build --workspace=formspec-webcomponent && npm run test:unit --workspace=packages/formspec-engine && npm run test --workspace=formspec-webcomponent -- --config vitest.config.ts && npx playwright test`
- [x] **6.3** Update `thoughts/e2e-test-review-report.md` with final counts (actual E2E tests remaining, total migrated, total deleted).
- [x] **GATE** All three test layers pass. No fixture-audit or engine-only tests remain in Playwright.

**Commit:** `test: complete E2E test migration — 157 tests migrated, 56 deleted, 81 genuine E2E remain`

---

## Verification Commands

```bash
# Engine unit tests
npm run test:unit --workspace=packages/formspec-engine

# Webcomponent unit tests
npx vitest run --config packages/formspec-webcomponent/vitest.config.ts

# Playwright E2E
npx playwright test

# All together (build first)
npm run build && npm run test:unit --workspace=packages/formspec-engine && npx vitest run --config packages/formspec-webcomponent/vitest.config.ts && npx playwright test
```
