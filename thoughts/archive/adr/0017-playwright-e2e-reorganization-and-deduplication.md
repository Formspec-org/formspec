# ADR-0017: Playwright E2E Reorganization and Deduplication

**Status**: Implemented
**Date**: 2026-02-24
**Authors**: Codex (AI), exedev
**Deciders**: exedev

---

## 1. Context and Problem Statement

The Playwright suite under `tests/e2e/playwright/` has grown quickly and now mixes distinct test intents:

- UI/browser integration behavior
- component rendering and prop contracts
- engine-only behavior executed through browser `page.evaluate()`

The current structure increases maintenance cost and makes behavior ownership unclear. The audit of the current suite found:

- 22 spec files (`~3,732` lines total)
- repeated setup boilerplate (`goto` + harness wait + mount definition) across most files
- repeated submit-capture boilerplate (`formspec-submit` listener)
- overlapping behavior assertions across multiple suites (especially response pruning, repeat behavior, and component-layer integration)
- one unfinished test and one skipped demo scenario in committed specs

## 2. Decision Drivers

- **Single ownership per behavior**: Each behavior should have one primary suite.
- **Separation by intent**: UI integration tests should be separated from engine-only coverage.
- **Lower maintenance overhead**: Remove copy-paste setup/submit blocks via shared helpers.
- **Predictable CI selection**: Suite layout should support targeted runs (integration vs components vs smoke, plus package unit tests).
- **Incremental migration safety**: Reorganization should be staged without breaking ongoing feature work.

## 3. Considered Options

### Option A: Keep current files and only add helpers

Pros: low initial churn.  
Cons: keeps overlapping behavior ownership and phase/milestone naming drift.

### Option B: Full reorganization by test intent with deduplication (chosen)

Pros: clear ownership, less overlap, easier onboarding and targeted CI runs.  
Cons: moderate short-term file churn and migration effort.

### Option C: Rewrite entire E2E suite from scratch

Pros: clean slate.  
Cons: high regression risk and unnecessary loss of proven scenarios.

## 4. Decision

Adopt **Option B**.

Reorganize `tests/e2e/playwright/` by intent and deduplicate overlapping scenarios:

- `helpers/`: shared harness and response helpers
- `integration/`: end-to-end form flows and response semantics
- `components/`: rendering/props/a11y/responsive/custom component behavior
- `engine-browser/`: temporary browser-hosted engine tests (later migrated to package unit tests; now removed)
- `smoke/`: minimal high-signal sanity flow(s)

Behavior overlap will be reduced so each behavior has one authoritative suite.

## 5. Scope of Consolidation

### 5.1 Consolidate high-overlap response/pruning scenarios

Unify overlapping pruning/non-relevant coverage currently spread across:

- `milestone1.spec.ts`
- `edge-cases.spec.ts` (deep pruning)
- `cart.spec.ts` (hidden field not in submit response)
- `tier3-alignment.spec.ts` (irrelevant field pruned)
- `bind-features.spec.ts` (`nonRelevantBehavior` modes)

### 5.2 Merge schema-shape response assertions into one place

`schema-compliance.spec.ts` currently overlaps setup and fixture usage with `cart.spec.ts`. Consolidate response schema assertions into one canonical integration suite.

### 5.3 Keep component coverage broad, but remove duplicate assertions

Retain dedicated phase suites for broad component surface area, but remove repeated assertions for the same component contracts across:

- `component-layer.spec.ts`
- `tier3-alignment.spec.ts`
- `webcomponent-phase7.spec.ts`

### 5.4 Isolate engine-only tests from UI-focused E2E

Specs that mostly instantiate `new FormEngine(...)` in browser context should move under `engine-browser/` immediately, then be migrated to package-level tests:

- `shape-validation.spec.ts`
- `fel-phase4.spec.ts`
- `extended-features.spec.ts`
- `instances.spec.ts`
- `assembly.spec.ts`
- engine-only sections in `bind-features.spec.ts` and `webcomponent-phase7.spec.ts`

## 6. Implementation Plan

1. [x] Add shared helpers (`gotoHarness`, `mountDefinition`, `submitAndGetResponse`) in `tests/e2e/playwright/helpers/harness.ts`.
2. [x] Move files into intent-based folders with minimal assertion changes.
3. [x] Run naming pass for suites and tests to encode intent and expected outcome.
4. [x] Replace repeated harness and submit boilerplate in integration specs with shared helpers.
5. [x] Validate discovery after migration (`npx playwright test --list`).
6. [x] Consolidate remaining duplicated response/pruning assertions into single authoritative suites.
7. [x] Add stable test tags/grep conventions for CI subsets (follow-up task).

## 7. Consequences

### Positive

- Reduced duplicate assertions and setup boilerplate.
- Clearer ownership boundaries for behaviors.
- Easier onboarding and faster targeted test runs.
- Better signal when regressions occur.

### Negative / Tradeoffs

- Short-term churn in file paths and import references.
- Temporary merge conflicts while active feature work continues.
- Need for one migration pass to stabilize CI and developer docs.

## 8. Non-Goals

- Replacing Playwright with another test runner.
- Rewriting all fixtures immediately.
- Removing broad component coverage introduced in recent phase suites.

## 9. Acceptance Criteria

- Playwright suite is discoverable and runnable after migration.
- Shared helpers replace repeated setup/submit blocks in migrated integration files.
- Directory structure reflects intent (`integration`, `components`, `helpers`, `smoke`) with engine behavior covered in package unit tests.
- Test and suite names follow an explicit `should ... when ...` outcome pattern.

## 10. Implementation Summary (2026-02-24)

- Reorganized all Playwright specs into:
  - `tests/e2e/playwright/integration/`
  - `tests/e2e/playwright/components/`
  - `tests/e2e/playwright/smoke/`
  - `tests/e2e/playwright/helpers/`
- Renamed files to intent-focused names (e.g., `core-component-props-and-fixes.spec.ts`, `response-schema-contract.spec.ts`, `definition-assembly.spec.ts`).
- Introduced shared helper utilities in `helpers/harness.ts` and refactored integration specs to use them.
- Performed a strict naming pass on test titles:
  - all tests now follow `should ... when ...`
  - suite names are prefixed by domain (`Integration:`, `Components:`, `Smoke:`)
- Migrated all `engine-browser/` Playwright coverage to package-level unit tests:
  - `packages/formspec-engine/tests/*.test.mjs` (37 tests)
  - removed duplicated Playwright specs from `tests/e2e/playwright/engine-browser/`
- Consolidated integration duplication after migration:
  - removed cyclical dependency guardrail from Playwright integration (`edge-case-behaviors.spec.ts`)
  - reduced Playwright pruning suite to browser-flow coverage only (`response-pruning-behaviors.spec.ts`)
- Added stable CI grep conventions in root scripts:
  - `npm run test:e2e:integration`
  - `npm run test:e2e:components`
  - `npm run test:e2e:smoke`
- Verified migration with `npx playwright test --list` (51 tests / 16 files discovered) and `npm run test:unit` (37 tests passing).

## 11. Follow-up Work

- Add package-level unit tests for `formspec-webcomponent` component rendering contracts so deterministic DOM/prop assertions can move out of browser E2E.
