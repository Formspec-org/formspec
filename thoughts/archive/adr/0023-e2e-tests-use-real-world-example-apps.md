# ADR-0023: E2E Tests Use Real-World Example Apps

**Status**: Accepted
**Date**: 2026-02-26
**Authors**: Claude (AI), exedev
**Deciders**: exedev
**Supersedes**: [ADR-0021: Holistic Kitchen-Sink E2E Conformance Plan](0021-holistic-kitchen-sink-e2e-conformance-plan.md)
**Depends on**: [ADR-0017: Playwright E2E Reorganization](0017-playwright-e2e-reorganization-and-deduplication.md)

---

## 1. Context and Problem Statement

ADR-0021 planned a holistic conformance suite driven by a bespoke "kitchen-sink" synthetic fixture bundle (`definition.v1.json`, `definition.v2.json`, `theme.json`, `component.json`, `mapping.json`, etc.). That plan has been partially implemented but creates a maintenance problem: synthetic fixtures diverge from real usage patterns, require their own schema upkeep independent of actual feature work, and produce test failures that do not map to user-visible behaviour.

In parallel, the grant application example (`examples/grant-application/`) was built out as a full-featured, real-world form covering:

- multi-page wizard layout
- all core data types (string, choice, money, date, decimal, attachment, boolean)
- repeatable groups with cross-group calculated aggregates
- conditional visibility and relevance
- bind constraints, shape rules, and full validation report
- component document with 5 pages, DataTable, CheckboxGroup, RadioGroup, Toggle, FileUpload, Collapsible/Summary

This is a richer, more credible coverage vehicle than any synthetic fixture. Synthetic fixtures are a maintenance liability with no real-world grounding.

The current state (post-ADR-0017 reorganisation) has 17 spec files. Only 5 use the grant application. 11 still use synthetic or inline fixtures. 1 (conformance) is intentionally kept separate.

---

## 2. Decision

**All Playwright E2E integration and smoke tests must be driven through real-world example applications, not synthetic fixtures or inline JSON definitions.**

The grant application (`examples/grant-application/`) is the primary example app. Future example apps may be added as the project grows and will be used as their features require.

Exceptions are narrow and explicit (see §6).

---

## 3. Rationale

- **Real-world fidelity**: The grant application exercises the engine, web component, FEL, and all three spec tiers in combination, exactly as an integrator would. Synthetic fixtures exercise the same code paths artificially.
- **Single source of truth**: Feature work updates `definition.json`, `component.json`, `theme.json`. Tests that ride on those files catch regressions automatically. Synthetic fixtures require a separate upkeep loop.
- **No backwards-compatibility burden**: This is a greenfield project. There are no synthetic fixtures worth preserving for historical reasons.
- **Confidence signal**: A test that passes on a real-world form is more meaningful than one that passes on a fixture designed to make the test pass.
- **ADR-0021 superseded**: The kitchen-sink conformance plan required building and maintaining a synthetic bundle across all six document types. The grant application already covers the critical paths. The remaining gaps (nested repeats, FEL stdlib breadth, TS↔Python parity) are better addressed by extending the grant app than by maintaining a parallel synthetic world.

---

## 4. Scope

### 4.1 In scope — migrate to grant app

| File | Current fixture | Priority |
|------|----------------|----------|
| `smoke/kitchen-sink-smoke.spec.ts` | `kitchen-sink-smoke.definition.json` | **HIGH** |
| `integration/edge-case-behaviors.spec.ts` | `fixtures/edge-cases.json` | **HIGH** |
| `integration/nested-repeats-and-calculations.spec.ts` | `fixtures/complex-scenarios.json` | **HIGH** (requires grant app extension first) |
| `integration/fel-standard-library-ui.spec.ts` | `fixtures/fel-functions.json` | **MEDIUM** |
| `integration/kitchen-sink-holistic-conformance.spec.ts` | `fixtures/kitchen-sink-holistic/` | **MEDIUM** (partial — see §6) |
| `components/core-component-props-and-fixes.spec.ts` | inline JSON | **MEDIUM** (partial — ~8/14 tests) |
| `components/component-tree-engine-alignment.spec.ts` | inline JSON | **MEDIUM** |
| `components/component-gap-coverage.spec.ts` | inline JSON | **LOW** |
| `components/component-tree-rendering.spec.ts` | inline JSON | **LOW** (requires Tab support in grant app) |

### 4.2 Out of scope — keep as dedicated suites (see §6)

- `components/progressive-component-rendering.spec.ts` — modal, popover, signature, rating, file upload; display/interactive components not present in grant app and not suitable for a business form context
- `components/accessibility-responsive-custom-components.spec.ts` — platform-level a11y attributes and custom component recursive detection
- `components/remote-options-binding.spec.ts` — infrastructure/data-loading contract

---

## 5. Task Breakdown

Tasks are ordered by dependency. Each task has clear acceptance criteria.

---

### Task T-01: Delete orphaned fixture
**Priority**: HIGH — immediate
**Effort**: trivial

Delete `tests/e2e/fixtures/data-types.json` — it is referenced by no spec files.

**Acceptance**: `grep -r "data-types.json" tests/` returns nothing.

---

### Task T-02: Migrate smoke test to grant app
**Priority**: HIGH
**Effort**: ~1 hour
**Depends on**: nothing

Rewrite `smoke/kitchen-sink-smoke.spec.ts` to use `mountGrantApplication`. The smoke test must verify the end-to-end happy path: wizard navigation, data entry, repeat row add, calculated summary, form submission, response contract.

Field mapping from old smoke fixture:
- wizard navigation → grant app's 5-page Wizard
- name field → `applicantInfo.contactName`
- checkbox toggle → `budget.usesSubcontractors`
- repeatable group → `budget.lineItems` (add row, fill unitCost + quantity, verify subtotal)
- summary display → `@grandTotal` variable in footer
- submit → `getResponse(page, 'submit')`

Delete `tests/e2e/fixtures/kitchen-sink-smoke.definition.json` and `kitchen-sink-smoke.component.json` after migration.

**Acceptance**:
- `npx playwright test smoke/` passes
- `tests/e2e/fixtures/kitchen-sink-smoke.*` files deleted
- no reference to old fixture names remains

---

### Task T-03: Migrate edge-case-behaviors to grant app
**Priority**: HIGH
**Effort**: ~30 minutes
**Depends on**: nothing

`edge-case-behaviors.spec.ts` has one test: numeric stability when quantity is empty (empty × price = 0, not NaN). Migrate to grant app using `budget.lineItems[0]` — set `unitCost` with empty `quantity`, assert `subtotal` is 0.

Delete `tests/e2e/fixtures/edge-cases.json` after migration.

**Acceptance**:
- test passes with `mountGrantApplication`
- `fixtures/edge-cases.json` deleted

---

### Task T-04: Extend grant app definition with nested repeats
**Priority**: HIGH
**Effort**: ~2 hours
**Depends on**: nothing (grant app extension, independent of test migration)

Add a `projectPhases` repeatable group to `examples/grant-application/definition.json`:

```
projectPhases[]
  phaseName          (string)
  phaseTasks[]
    taskName         (string)
    hours            (decimal)
    hourlyRate       (money)
    taskCost         (calculate: hours × hourlyRate)
  phaseTotal         (calculate: sum(phaseTasks[*].taskCost))
```

Add corresponding layout to `examples/grant-application/component.json` (a new Wizard page "Project Phases" between Budget and Subcontractors, using nested DataTable or Stack).

Update `examples/grant-application/README.md` to document the new page.

**Acceptance**:
- `npm run docs:generate && npm run docs:check` passes
- `npx playwright test integration/grant-app-budget-calculations.spec.ts` still passes (regression check)
- `getEngine().signals['projectPhases[0].phaseTasks[0].taskCost']` computes correctly when hours and rate are set

---

### Task T-05: Migrate nested-repeats-and-calculations to grant app
**Priority**: HIGH
**Effort**: ~1 hour
**Depends on**: T-04

Rewrite `integration/nested-repeats-and-calculations.spec.ts` using `mountGrantApplication` and the new `projectPhases` structure. Cover:
- add phase, add task within phase
- `taskCost` calculation (hours × rate)
- `phaseTotal` aggregates tasks within phase
- cross-phase total (add to `@grandTotal` or new variable)
- remove task, verify phaseTotal updates

Delete `tests/e2e/fixtures/complex-scenarios.json` after migration.

**Acceptance**:
- test passes with `mountGrantApplication`
- `fixtures/complex-scenarios.json` deleted
- nested path assertions use grant app field names

---

### Task T-06: Extend grant app FEL coverage for stdlib tests
**Priority**: MEDIUM
**Effort**: ~2 hours
**Depends on**: T-04 (definition must be stable)

The FEL stdlib test (`fel-standard-library-ui.spec.ts`) currently exercises ~15 stdlib functions via a synthetic fixture. Migrate by extending the grant app definition with compute fields that exercise untested stdlib functions. Candidates using natural grant app domain context:

| FEL function | Grant app binding |
|---|---|
| `upper()` | display-only: `upper(applicantInfo.orgName)` as a computed label |
| `round()` | `projectNarrative.indirectRate` rounded display |
| `year()` | display: `year(projectNarrative.startDate)` |
| `coalesce()` | fallback: `coalesce(applicantInfo.contactPhone, 'N/A')` |
| `isNull()` | conditional: `isNull(applicantInfo.ein)` |
| `contains()` | validation: `contains(applicantInfo.contactEmail, '@')` (already used) |
| `abs()` | budget: `abs(budget.requestedAmount - @grandTotal)` deviation |
| `power()` | display field for demonstration |
| `dateAdd()` | auto-compute: `dateAdd(projectNarrative.startDate, projectNarrative.duration, 'months')` |

Rewrite `fel-standard-library-ui.spec.ts` to use `mountGrantApplication` and assert these compute fields.

Delete `tests/e2e/fixtures/fel-functions.json` after migration.

**Acceptance**:
- all stdlib assertions pass via grant app fields
- `fixtures/fel-functions.json` deleted
- test still covers ≥12 distinct stdlib functions

---

### Task T-07: Migrate component-tree-engine-alignment to grant app
**Priority**: MEDIUM
**Effort**: ~30 minutes
**Depends on**: nothing

`component-tree-engine-alignment.spec.ts` tests that engine signals (relevance, required, value) align with the DOM on a minimal 3-field form. Migrate to grant app page 1 (Applicant Info): assert that `relevantSignals`, `requiredSignals`, and `signals` match what the DOM shows for `applicantInfo.orgName`, `applicantInfo.ein`, and `applicantInfo.orgType`.

**Acceptance**:
- test passes with `mountGrantApplication`
- no inline definition in the file

---

### Task T-08: Partially migrate core-component-props-and-fixes (8 of 14 tests)
**Priority**: MEDIUM
**Effort**: ~1.5 hours
**Depends on**: nothing

Split `core-component-props-and-fixes.spec.ts`:

**Migrate to new `grant-app-component-props.spec.ts`** (~8 tests):
- RadioGroup selection (grant app: `applicantInfo.orgType`)
- Wizard next/prev navigation (grant app Wizard)
- Toggle on/off labels (grant app: `budget.usesSubcontractors`)
- CheckboxGroup multi-select (grant app: `projectNarrative.focusAreas`)
- DataTable add/remove rows (grant app: `budget.lineItems`)
- DataTable cell calculation on edit (grant app: subtotal = qty × unitCost)
- Summary optionSet label resolution (grant app: Review & Submit page)
- Stack gap/alignment (grant app's main Stack layouts)

**Keep in `core-component-props-and-fixes.spec.ts`** (~6 tests, with their existing inline fixtures):
- TextInput prefix/suffix adornments
- Card subtitle/elevation variants
- Alert dismissible behaviour
- Select clearable + placeholder
- DatePicker minDate/maxDate
- Tabs defaultTab

**Acceptance**:
- `grant-app-component-props.spec.ts` uses `mountGrantApplication` exclusively
- `core-component-props-and-fixes.spec.ts` uses only inline fixtures for the remaining 6 tests
- all tests pass

---

### Task T-09: Migrate kitchen-sink-holistic-conformance (partial)
**Priority**: MEDIUM
**Effort**: ~2 hours
**Depends on**: T-04, T-05, T-06 (grant app must be fully extended first)

The conformance suite has two separable concerns:

**Migrate to grant app** (new `grant-app-conformance.spec.ts`):
- Engine identity pinning (definitionUrl, definitionVersion)
- Initial value hydration
- Mixed field type data entry with MIP transitions
- Validation report shape contract (valid, counts, results, timestamp)
- Non-relevant behaviour modes (remove / keep / empty) via orgType visibility
- Response contract (definitionUrl, definitionVersion, status, validationResults)
- Component `when` vs definition `relevant` distinction

**Keep in `kitchen-sink-holistic-conformance.spec.ts`**:
- TypeScript ↔ Python FEL parity (requires separate Python evaluator invocation; not grant-app-specific)
- Screener routing and assembly utilities (not implemented in grant app)
- Deterministic response canonicalization with fixed clock

Delete `tests/e2e/fixtures/kitchen-sink-holistic/` only after confirming the parity and assembly tests have been re-homed or explicitly deferred.

**Acceptance**:
- `grant-app-conformance.spec.ts` covers ≥7 of the 9 conformance checks
- remaining checks in `kitchen-sink-holistic-conformance.spec.ts` are explicitly annotated with why they cannot use the grant app
- `npx playwright test integration/` passes in full

---

### Task T-10: Add Tab layout to grant app (optional, enables T-11)
**Priority**: LOW
**Effort**: ~1.5 hours
**Depends on**: nothing
**Gate**: user decision required — this changes the grant app UX from Wizard to mixed Wizard+Tabs

Add a Tab component to one section of the grant app component document (e.g., the Review & Submit page uses Tabs to switch between "Summary", "Documents", and "Errors"). This enables the `component-tree-rendering.spec.ts` test of tab switching with DataTable and Summary components.

**Acceptance**:
- Tab component renders in grant app
- `grant-app-wizard-flow.spec.ts` still passes (tabs are additive, not replacing the wizard)

---

### Task T-11: Migrate component-tree-rendering to grant app
**Priority**: LOW
**Effort**: ~30 minutes
**Depends on**: T-10

Rewrite `component-tree-rendering.spec.ts` using `mountGrantApplication`. Test:
- basic component tree rendering (grant app page 1)
- conditional visibility via `when` (nonprofitPhoneHint text component)
- tab switching (if T-10 implemented) with DataTable and Summary update

**Acceptance**:
- test passes with `mountGrantApplication`
- no inline JSON in the file

---

### Task T-12: Migrate component-gap-coverage to grant app
**Priority**: LOW
**Effort**: ~30 minutes
**Depends on**: T-04 (nested repeats for richer repeat gap coverage)

Rewrite `component-gap-coverage.spec.ts` to cover repeat add/remove binding correctness and cross-tier `when` vs `relevant` distinction using grant app fields.

**Acceptance**:
- test uses `mountGrantApplication`
- covers ≥2 of the 3 original gap scenarios

---

### Task T-13: Delete harness.ts when no longer referenced
**Priority**: LOW (clean-up)
**Effort**: trivial
**Depends on**: all migration tasks complete

Once all migrated files no longer import from `helpers/harness.ts`, delete the file and any remaining references to `gotoHarness` and `mountDefinition`.

**Acceptance**:
- `grep -r "harness" tests/e2e/playwright/` returns only the conformance and kept-separate files (or nothing)
- `helpers/harness.ts` deleted

---

## 6. Explicit Exceptions (Tests That Stay Synthetic)

The following files are **not** required to use the grant application and must be explicitly annotated with a comment block explaining why:

```typescript
// ADR-0023 Exception: This test covers [reason] which is a platform-level
// concern not representable in a real-world business form. It intentionally
// uses a synthetic fixture.
```

| File | Reason |
|------|--------|
| `components/progressive-component-rendering.spec.ts` | Tests display/interactive components (Modal, Popover, Signature, Rating, Slider, Accordion, ProgressBar) that have no natural home in a business grant application |
| `components/accessibility-responsive-custom-components.spec.ts` | Tests platform-level a11y attribute plumbing and custom component recursive detection — framework concerns, not domain concerns |
| `components/remote-options-binding.spec.ts` | Tests infrastructure data-loading contract (remoteOptions fetch + 500 fallback) — requires mock server, not domain data |
| `integration/kitchen-sink-holistic-conformance.spec.ts` | TS↔Python FEL parity checks and form assembly require a synthetic fixture with explicit deterministic event traces and known Python evaluator output snapshots |

---

## 7. New Example Apps

As additional example applications are added (e.g., a tax filing form, an insurance claim form, an event registration form), each new example:

1. Must have its own `examples/<name>/definition.json`, `component.json`, `theme.json`
2. Must have a corresponding `tests/e2e/playwright/helpers/<name>.ts` harness
3. New E2E tests covering that example's feature surface must be added alongside it
4. Must be buildable via a Vite config and servable on a distinct port

---

## 8. Acceptance Criteria (ADR-level)

This ADR is considered implemented when:

- [x] T-01 through T-09 are complete
- [x] `npx playwright test` passes with no failures
- [x] All `integration/` and `smoke/` spec files use `mountGrantApplication` or are annotated with an ADR-0023 exception comment
- [x] All `components/` spec files either use `mountGrantApplication` or are annotated with an ADR-0023 exception comment
- [x] `tests/e2e/fixtures/` contains only: `kitchen-sink-holistic/` (all transitional fixtures deleted)
- [x] No spec file imports `mountDefinition` from `helpers/harness.ts` except files with ADR-0023 exception annotations

**Implementation notes (deviations from original task descriptions):**
- T-10 skipped: Adding Tabs to the grant app would distort its Wizard UX model; tab-sync test remains as ADR-0023 exception
- T-11 partial: Tests 1-2 migrated to grant app; test 3 (DataTable+Summary tab-sync) kept synthetic per T-10 skip
- T-12 partial: Test 1 migrated to `budget.lineItems`; test 2 dropped (redundant with grant-app-conformance coverage); test 3 (compatibility matrix) kept synthetic
- T-13 amended: `harness.ts` retained with ADR-0023 header comment; deletion deferred until all synthetic tests are resolved

---

## 9. Consequences

### Positive

- Tests break for real reasons — a failure in `grant-app-budget-calculations.spec.ts` means a real feature is broken
- Feature work on the grant app automatically exercises the E2E suite
- Reduced fixture maintenance — no separate synthetic JSON to update when schemas change
- More readable tests — domain field names (`applicantInfo.orgName`) are clearer than synthetic names (`user_email_1`)

### Negative / Tradeoffs

- Grant app definition and component document become load-bearing for the test suite — changes must be made carefully
- Some component edge cases (adornments, Card elevation, etc.) still require small inline fixtures
- FEL stdlib breadth test requires extending the grant app definition with several additional compute fields that have no functional purpose for the form itself

---

## 10. References

- `examples/grant-application/` — primary example app
- `tests/e2e/playwright/helpers/grant-app.ts` — grant app harness
- `thoughts/archive/adr/0017-playwright-e2e-reorganization-and-deduplication.md`
- `thoughts/archive/adr/0021-holistic-kitchen-sink-e2e-conformance-plan.md` (superseded)
