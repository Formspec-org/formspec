# ADR 0035: Test Suite Reorganization and Unification

## Status
Accepted

## BLUF
Replace legacy parity coverage one behavior at a time instead of deleting it wholesale.

For each migrated behavior:

1. Write the new shared conformance case.
2. Run the new case and the overlapping legacy test together.
3. Intentionally break the covered behavior and confirm both tests fail.
4. Restore the implementation and confirm both tests pass.
5. Delete the legacy parity test only after the replacement has proven it catches the same regression.

Build the new native parity runners first, migrate high-value cases through that duplication loop, and remove the old Playwright and matrix-based parity infrastructure only after the replacement is green in CI.

## Implementation Status
Update as of 2026-03-10:

- Implemented:
  - shared conformance schema at `schemas/conformance-suite.schema.json`
  - shared case directory at `tests/conformance/suite/`
  - native Python runner at `tests/conformance/parity/test_shared_suite.py`
  - native Node runner at `packages/formspec-engine/tests/shared-suite.test.mjs`
  - initial shared cases for six FEL parity scenarios plus real-example-backed submit-valid cases for grant-application, clinical-intake, grant-report, and invoice
  - removal of the legacy Playwright parity runner, Python subprocess evaluator, matrix JSON, and both scaffold tests
  - re-homing of synthetic kitchen-sink coverage into engine integration tests and browser UI coverage
  - cross-runtime fuzzing under `tests/conformance/fuzzing/` via:
    - `fel_cross_runtime_runner.mjs`
    - `processing_cross_runtime_runner.mjs`
    - `test_cross_runtime_fuzzing.py`
- Not yet implemented:
  - a recorded, per-case proof trail for the duplication loop described in this ADR

This means the architectural migration is in place, but the full process described below was not captured for every migrated behavior.

## Remaining Work
As of 2026-03-10, the only substantive work still open for this ADR is documentation of the migration proof trail.

- Still needed:
  - record, per migrated legacy parity behavior, the overlap run, intentional break, dual failure, restoration, and legacy-test removal decision
- Already complete:
  - shared declarative conformance cases
  - native Python and Node parity runners
  - curated real-example parity coverage for `grant-application`, `clinical-intake`, `grant-report`, and `invoice`
  - cross-runtime fuzzing for FEL and processing semantics
  - removal of the legacy Playwright and matrix-based parity infrastructure

## Context
The Formspec test suite grew organically across multiple languages (Python, TypeScript) and layers. We previously tried to achieve cross-runtime parity between the TypeScript client engine and the Python backend engine using two mechanisms:

1. A declarative `core-semantics-matrix.json` that mapped manual Python tests to manual TypeScript tests.
2. A large Playwright-based parity runner (`tests/conformance/parity/kitchen-sink-holistic.spec.ts`) that executed the TS engine in a browser while spawning Python subprocesses to compare outputs.

Those choices were directionally useful, but the architecture is wrong.

- Playwright is for user-visible E2E behavior. It is the wrong tool for pure runtime parity or mathematical FEL semantics.
- The matrix is an honor system. Mapping two manually authored tests to the same ID does not structurally guarantee they exercise the same inputs or edge cases.
- The browser-plus-subprocess runner couples unrelated environments, increases brittleness, and slows feedback.

At the same time, a full overcorrection would also be wrong. The repository guidance in `CLAUDE.md` is explicit:

- prefer the fewest tests that give the most confidence
- use integration tests as the default and most valuable layer
- keep Playwright for workflows that cross the component/engine/DOM boundary
- do not force abstractions when a smaller direct solution is clearer

That means the answer is not "move everything into one giant shared JSON harness." Parity-sensitive semantics should be centralized. High-value public-API integration tests should remain first-class.

## Decision

### 1. Remove Browser-Driven Runtime Parity
We will delete the Playwright parity runner and its subprocess callout pattern.

- Delete `tests/conformance/parity/kitchen-sink-holistic.spec.ts`
- Delete `tests/e2e/kitchen_sink/python_fel_eval.py`
- Remove any remaining parity logic that depends on Playwright driving a browser while spawning Python

Pure runtime parity does not belong in a browser runner.

### 2. Remove the Matrix / Honor-System Mapping
We will retire the manual matrix approach as the primary parity mechanism.

- Delete `tests/conformance/core-semantics-matrix.json`
- Delete matrix scaffolding such as `test_core_semantics_matrix_scaffold.py`
- Delete `packages/formspec-engine/tests/conformance-matrix-scaffold.test.mjs`

Manual mapping between separate test files is not a reliable source of truth for parity.

### 3. Establish a Small Shared Conformance Core
Cross-runtime parity will be driven by shared declarative cases executed natively in each runtime.

- Cases live in `tests/conformance/suite/*.json`
- A Python runner executes the same cases against `src/formspec`
- A Node runner executes the same cases against `packages/formspec-engine`

The shared suite is reserved for behavior where cross-runtime agreement is itself the requirement:

- FEL evaluation
- engine processing semantics
- normalized `ValidationReport` parity
- normalized `Response.validationResults` parity
- other runtime-level semantics that are expected to be identical across implementations

This shared suite is the source of truth for cross-runtime semantics. It is not a replacement for all other testing.

### 4. Keep Runtime-Specific Integration Tests
We will preserve hand-written integration tests that exercise public APIs and real fixtures.

- TypeScript integration tests around `FormEngine`, `getValidationReport()`, and `getResponse()`
- Python integration tests around `DefinitionEvaluator.process(...)`
- example-driven tests that exercise real definitions, registries, and fixture payloads

These tests are not migration targets by default. They provide confidence that each runtime behaves correctly through its public surface, which the shared conformance suite does not replace.

### 5. Use Real Examples Through Native Runners, Not Blind Directory Walks
When example fixtures are used for parity, they will be selected through a curated manifest rather than discovered by blindly walking `examples/`.

The manifest should declare, per case:

- definition path
- optional registry path(s)
- payload fixture path(s)
- execution mode (`continuous`, `submit`, or both)
- whether the case expects validation-report parity only or full response parity

This keeps the parity surface explicit and avoids conflating executable fixtures with themes, mappings, changelogs, components, or illustrative snapshots.

### 6. Prefer Canonical Expected Outputs for Deterministic Cases
Where a case is deterministic and spec-important, the shared conformance suite should assert canonical expected normalized output, not only Python-vs-TypeScript agreement.

Both runtimes must match the same expected result for:

- evaluation outputs
- validation report counts and results
- response validation metadata where applicable

Cross-runtime agreement alone is necessary but not sufficient, because both runtimes can agree on the same bug.

### 7. Add Cross-Runtime Fuzzing as a Supplement, Not the Only Oracle
We will use fuzzing to explore complex and deeply nested edge cases that curated fixtures miss.

- keep fuzzing under `tests/conformance/fuzzing/`
- compare either normalized outputs or normalized error structures across runtimes

Fuzzing supplements the curated conformance suite. It does not replace explicit, canonical examples.

### 8. Keep Playwright Focused on User-Visible Workflows
Playwright remains responsible for:

- rendering behavior
- navigation and wizard flows
- submission UX
- validation feedback in the UI
- full-stack browser workflows that cross the component/engine/DOM boundary

Playwright is not the owner of runtime parity.

## Execution Plan

### Phase 1: Define Shared Conformance Case Format
- Create `schemas/conformance-suite.schema.json`
- Create `tests/conformance/suite/`
- Support at least:
  - `FEL_EVALUATION`
  - `ENGINE_PROCESSING`
  - `VALIDATION_REPORT`
  - `RESPONSE_VALIDATION`

### Phase 2: Implement Native Runners
- Implement Python runner in `tests/conformance/parity/test_shared_suite.py`
- Implement Node runner in `packages/formspec-engine/tests/shared-suite.test.mjs`
- Ensure both runners consume the exact same JSON cases

### Phase 3: Add Minimal Replacement Coverage
- Port a small, high-value slice of existing parity coverage into the shared suite
- Include both deterministic canonical cases and at least one real example-backed case
- Run the replacement runners in CI and confirm they provide useful signal before removing legacy coverage

Status on 2026-03-10:

- Completed for the first slice:
  - six FEL parity cases migrated from the kitchen-sink parity fixture
  - one grant-application submit-valid case added through the manifest-driven example flow
- Not recorded in-repo:
  - the full intentional-break overlap proof for each migrated legacy case

Each migrated parity case follows a strict duplication loop:

1. Write the new shared conformance case for one specific legacy parity behavior.
2. Run the new case and the overlapping legacy test together.
3. If both pass, review the exact behavior they claim to cover.
4. Intentionally alter the implementation to break that behavior.
5. Re-run the new case and the legacy test and confirm both fail for the expected reason.
6. Revert the intentional break.
7. Keep the new case and remove the overlapping legacy parity coverage only after the replacement has proven it catches the same regression.

This is the migration form of red/green/refactor:

- red: write the new overlapping test and prove it can fail on the targeted regression
- green: restore the implementation and confirm both suites pass
- refactor: remove the redundant legacy parity coverage once the replacement is demonstrated

### Phase 4: Add Curated Example Parity Cases
- Create a manifest-driven set of real example parity cases
- Start with high-value examples such as:
  - `grant-application`
  - `clinical-intake`
  - `grant-report`
  - `invoice`
- Compare normalized validation artifacts natively in Python and Node

Status on 2026-03-10:

- Completed:
  - `grant-application.submit-valid`
  - `clinical-intake.submit-valid`
  - `grant-report.short-submit-valid`
  - `invoice.single-submit-valid`
  - manifest coverage in `tests/conformance/suite/real-examples.manifest.json`

### Phase 5: Remove Legacy Parity Infrastructure
- Delete `tests/conformance/parity/kitchen-sink-holistic.spec.ts`
- Delete `tests/e2e/kitchen_sink/python_fel_eval.py`
- Delete matrix scaffolding and `core-semantics-matrix.json`
- Remove only after the replacement runners and initial shared cases are green in CI

Status on 2026-03-10:

- Completed in repository state
- The replacement runners and initial shared cases are green locally
- The stricter migration-proof loop from this ADR should be treated as guidance for future migrations and expansions, since it was not preserved as an auditable artifact for the initial deletion set

### Phase 6: Preserve and Prune Intentionally
- Keep valuable runtime-specific integration tests that exercise public APIs
- Port only the tests whose main purpose is cross-runtime semantics duplication
- For each migrated legacy parity test, document which shared case replaced it before deletion
- Do not migrate or delete useful integration coverage just for uniformity

Status on 2026-03-10:

- Partially completed:
  - migrated shared-suite cases include `legacyCoverage` references to the replaced parity behaviors
  - useful runtime-specific integration coverage remains in place
- Still open:
  - the stricter per-case migration proof trail described in this ADR was not recorded as an auditable artifact

### Phase 7: Expand Fuzzing
- Add cross-runtime fuzzing for FEL and processing semantics
- Normalize values and error structures before comparison

Status on 2026-03-10:

- Completed:
  - Node FEL runner at `tests/conformance/fuzzing/fel_cross_runtime_runner.mjs`
  - Node processing runner at `tests/conformance/fuzzing/processing_cross_runtime_runner.mjs`
  - Python fuzz harness at `tests/conformance/fuzzing/test_cross_runtime_fuzzing.py`
  - cross-runtime FEL fuzzing cases with normalized comparison
  - cross-runtime processing fuzzing cases with normalized report comparison

## Consequences

### Positive
- Parity testing moves to the correct layer and no longer depends on browsers or subprocess coupling
- Shared semantics gain real structural guarantees instead of matrix bookkeeping
- Public-API integration tests remain intact, preserving high-confidence coverage on real runtime behavior
- Example fixtures can be reused deliberately without turning `examples/` into an implicit test API
- The suite better matches the repository's stated testing philosophy in `CLAUDE.md`
- Migration risk is lower because parity signal is replaced before legacy infrastructure is removed

### Negative
- We still need to build and maintain two native runners
- A curated manifest requires judgment instead of naive auto-discovery
- Some duplicated-looking tests will remain, because not all duplication is waste
- Migration takes slightly longer because old and new parity infrastructure will overlap briefly during replacement
- Each migrated case costs an extra verification step because the replacement must prove it detects the same breakage before legacy coverage is removed
