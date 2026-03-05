# Formspec Studio v2 Prod-MVP Testing Plan

Date: 2026-03-05  
Status: Updated for Ralph Step 30 (testing plan reviewed and iterated with added P2 sub-form E2E coverage)

## 1) Objective

Define a production-MVP testing strategy for Formspec Studio v2 that gives high confidence in correctness across:

- Unit logic (state, transforms, pure helpers)
- Integration behavior (UI + state + inspector/surface interactions)
- End-to-end user workflows (real browser, real app wiring)

This plan is intentionally implementation-oriented so Step 28 can reorganize current tests into this structure and inventory coverage against it.

## 2) Scope

In scope:

- `form-builder/` Studio app behavior and artifacts (`definition`, `component`, `theme`, `mapping`, version/changelog state)
- Interactions that mutate project state and must preserve schema validity
- Runtime preview synchronization and command-driven workflows
- Keyboard-first and mouse-first critical UX paths

Out of scope for prod-MVP:

- Visual snapshot/golden pixel testing
- Full browser matrix beyond Chromium
- Load/performance benchmarking beyond basic smoke checks

## 3) Quality Gates (Prod-MVP)

A build is prod-MVP ready only if all are true:

1. Unit suite passes with zero failures.
2. Integration suite passes with zero failures.
3. Studio E2E P0 scenarios pass on Chromium in CI.
4. No flaky test is left enabled without mitigation (retry-only is not a fix).
5. Any new feature ships with at least one test at the highest-value layer.

## 4) Test Layer Strategy

## 4.1 Unit Tests (fast, pure logic)

Tooling:

- Vitest
- Node test environment

Primary target modules:

- `src/state/mutations.ts`
- `src/state/wiring.ts`
- `src/state/versioning.ts`
- `src/state/import-export.ts`
- `src/state/extensions.ts`
- pure command/filter/helper functions

What must be covered:

- Path rewrite correctness on rename/move/delete
- Bind lifecycle (create on demand, GC empty bind)
- Shape composition rewrites and identifier integrity
- Mapping rule transformations and round-trip helper logic
- Version impact classification (patch/minor/major)
- Import/export parsing and structural guardrails

Success profile:

- deterministic assertions
- no DOM or browser dependency
- fastest feedback path for regressions in model logic

## 4.2 Integration Tests (UI + state wiring)

Tooling:

- Vitest
- `@testing-library/preact`
- `happy-dom` where DOM behavior is required

Primary target surfaces:

- `Shell`
- `FormSurface`
- `Inspector` and section routing
- `CommandPalette`
- `DiagnosticsBar`
- `FELEditor`

What must be covered:

- selection routing and section focus behavior
- inline edits and inspector edits writing to shared project state
- slash insertion and keyboard navigation
- diagnostics aggregation and navigation back to source
- JSON editor live sync and parse error handling
- toolbar and command palette command execution paths

Success profile:

- tests interact through public component behavior
- minimal mocking (mock only unstable external seams)
- verifies integrated behavior, not implementation details

## 4.3 End-to-End Tests (browser truth)

Tooling:

- Playwright
- Chromium project

Primary target workflow groups:

- create/edit form flow
- logic and validation flow
- preview flow
- import/export/template flow
- advanced tooling flow (mapping, extensions, versioning)

What must be covered:

- user-visible behaviors across UI boundaries
- keyboard shortcuts (`Cmd/Ctrl+K`, `Cmd/Ctrl+Shift+J`, etc.)
- persistence-sensitive operations (publish/version and bundle IO)

Success profile:

- no selector fragility (prefer role/text/testid strategy)
- deterministic fixtures and seeded initial state
- one failure should indicate one behavior regression

## 5) Prod-MVP Scenario Matrix

Priority legend:

- P0 = release-blocking
- P1 = required before wider beta
- P2 = useful hardening after MVP stabilization

| ID | Scenario | Layer | Priority |
|---|---|---|---|
| STUDIO-P0-001 | Create form via slash commands and inline label editing | E2E | P0 |
| STUDIO-P0-002 | Configure required + show-when logic and verify conditional behavior in preview | E2E | P0 |
| STUDIO-P0-003 | Rename/move items and verify path/FEL rewrites stay valid | Unit + Integration | P0 |
| STUDIO-P0-004 | Inspector routing by selection type (field/group/display/form) | Integration | P0 |
| STUDIO-P0-005 | Structural diagnostics and engine diagnostics navigate to offending node | Integration + E2E | P0 |
| STUDIO-P0-006 | JSON editor round-trip: visual->JSON->visual with parse/validation guardrails | Integration | P0 |
| STUDIO-P0-007 | Import/export bundle basic success path | E2E | P0 |
| STUDIO-P1-001 | Shapes builder composition editing + reference rewrites | Unit + Integration | P1 |
| STUDIO-P1-002 | Theme selector rules and token editing update artifacts correctly | Unit + Integration | P1 |
| STUDIO-P1-003 | Mapping editor row edits and round-trip test UI | Integration + E2E | P1 |
| STUDIO-P1-004 | Extension registry load influences autocomplete/templates | Unit + Integration | P1 |
| STUDIO-P1-005 | Version publish flow creates changelog and resets pending diff | Unit + Integration + E2E | P1 |
| STUDIO-P2-001 | Responsive breakpoint slider + per-breakpoint overrides | Integration + E2E | P2 |
| STUDIO-P2-002 | Sub-form `$ref` composition and linked group editing protections | Unit + E2E | P2 |

## 6) Test Organization (Implemented in Step 28)

`form-builder/` tests are now reorganized by layer and naming convention:

- `form-builder/src/state/__tests__/state-layer.unit.test.ts`
- `form-builder/src/state/__tests__/extensions.unit.test.ts`
- `form-builder/src/components/__tests__/fel-editor.integration.test.tsx`
- `form-builder/src/components/__tests__/form-surface.integration.test.tsx`
- `form-builder/src/components/__tests__/inspector.integration.test.tsx`
- `form-builder/src/components/__tests__/logic-builders.integration.test.tsx`
- `form-builder/src/components/__tests__/shell-layout.integration.test.tsx`
- `tests/e2e/playwright/studio/studio-core-workflows.spec.ts`

Current verification after Step 30:

- `npm run --workspace=form-builder test` => 7 files, 80 tests, all passing.
- `npm run test:studio:unit` => passing.
- `npm run test:studio:integration` => passing.
- `npm run test:studio:e2e` => suite and config implemented; execution is blocked in this sandbox by local port-binding restrictions (`listen EPERM` from Playwright-managed webServer).

## 7) Coverage Inventory by Existing Test File (Step 28)

| Test file | Layer | Primary scenario IDs covered |
|---|---|---|
| `src/state/__tests__/state-layer.unit.test.ts` | Unit | STUDIO-P0-003, STUDIO-P1-001, STUDIO-P1-002, STUDIO-P1-003, STUDIO-P1-005, STUDIO-P2-001, STUDIO-P2-002 |
| `src/state/__tests__/extensions.unit.test.ts` | Unit | STUDIO-P1-004 |
| `src/components/__tests__/form-surface.integration.test.tsx` | Integration | STUDIO-P0-001, STUDIO-P0-002, STUDIO-P0-004, STUDIO-P2-002 |
| `src/components/__tests__/logic-builders.integration.test.tsx` | Integration | STUDIO-P0-002 |
| `src/components/__tests__/fel-editor.integration.test.tsx` | Integration | STUDIO-P1-004 |
| `src/components/__tests__/inspector.integration.test.tsx` | Integration | STUDIO-P0-004, STUDIO-P0-007, STUDIO-P1-001, STUDIO-P1-002, STUDIO-P1-003, STUDIO-P1-004, STUDIO-P1-005, STUDIO-P2-001, STUDIO-P2-002 |
| `src/components/__tests__/shell-layout.integration.test.tsx` | Integration | STUDIO-P0-003, STUDIO-P0-004, STUDIO-P0-005, STUDIO-P0-006, STUDIO-P2-001 |
| `tests/e2e/playwright/studio/studio-core-workflows.spec.ts` | E2E | STUDIO-P0-001, STUDIO-P0-002, STUDIO-P0-007, STUDIO-P1-003, STUDIO-P1-005, STUDIO-P2-002 |

## 8) Scenario Coverage Inventory (Step 28)

Status legend:

- Covered = implemented at intended layer(s) except E2E where explicitly noted
- Partial = meaningful coverage exists, but required layer(s) still missing
- Missing = no meaningful coverage

| ID | Status | Current evidence |
|---|---|---|
| STUDIO-P0-001 | Covered | Studio E2E scenario implemented in `studio-core-workflows.spec.ts` + existing integration coverage |
| STUDIO-P0-002 | Covered | Studio E2E preview behavior scenario implemented + existing integration logic-builder coverage |
| STUDIO-P0-003 | Covered | `state-layer.unit` + `shell-layout.integration` rename/move rewrite assertions |
| STUDIO-P0-004 | Covered | `inspector.integration`, `shell-layout.integration`, and `form-surface.integration` now include display routing assertion |
| STUDIO-P0-005 | Covered | `shell-layout.integration` covers Ajv + engine diagnostics aggregation and navigation |
| STUDIO-P0-006 | Covered | `shell-layout.integration` covers visual<->JSON sync with parse guardrails |
| STUDIO-P0-007 | Covered | Studio E2E bundle export/import flow implemented + existing integration coverage |
| STUDIO-P1-001 | Covered | `state-layer.unit` + `inspector.integration` cover shape composition edits and rewrite behavior |
| STUDIO-P1-002 | Covered | `state-layer.unit` + `inspector.integration` cover tokens and selector rules |
| STUDIO-P1-003 | Covered | Studio E2E mapping editor + round-trip flow implemented + existing unit/integration coverage |
| STUDIO-P1-004 | Covered | Dedicated `extensions.unit` + existing `fel-editor.integration` and `inspector.integration` |
| STUDIO-P1-005 | Covered | Studio E2E publish flow implemented + existing unit/integration coverage |
| STUDIO-P2-001 | Covered | `state-layer.unit`, `shell-layout.integration`, `inspector.integration` cover breakpoints and responsive overrides |
| STUDIO-P2-002 | Covered | Added Studio E2E linked sub-form import scenario + existing unit/integration coverage for `$ref` assembly and linked metadata |

## 9) Explicit Gaps After Step 30

All P0/P1/P2 matrix scenarios are now implemented in tests. Remaining hardening work is CI stabilization for Studio Playwright runtime execution in environments that allow local webServer binding.

## 10) Execution Plan for Remaining Ralph Steps

Step 29 (implement/complete plan):

1. Created `tests/e2e/playwright/studio/` and implemented Studio P0/P1 E2E scenarios.
2. Added missing integration and unit tests listed in Section 9.
3. Wired studio-specific commands: `test:studio:unit`, `test:studio:integration`, `test:studio:e2e`.
4. Ran unit/integration verification and documented the sandbox-specific E2E execution blocker.

Step 30 (review/iterate implementation):

1. Re-ran Studio unit and integration suites to validate baseline health.
2. Added `STUDIO-P2-002` to `studio-core-workflows.spec.ts` with browser-level linked sub-form import assertions.
3. Verified exported bundle metadata for linked sub-forms (`x-linkedSubform`) and imported bind rewrite evidence.
4. Updated this plan’s scenario inventory to mark P2 sub-form E2E coverage as implemented.

## 11) Command Baseline

Studio verification commands:

- `npm run --workspace=form-builder test`
- `npm run test:studio:unit`
- `npm run test:studio:integration`
- `npm run test:studio:e2e`

## 12) Residual Risks After Step 30

- Root script path fixed to `form-builder`.
- Studio E2E folder/config and P0/P1/P2 scenarios are implemented.
- Integration tests continue to avoid heavy mocking for preview/extension pathways.
- E2E tests use deterministic `data-testid` selectors and explicit visibility assertions.
- Current residual risk: this sandbox blocks Playwright webServer startup (`listen EPERM`), so local runtime execution of Studio E2E needs an environment that permits local port binding.
