# Implement Native Shared Parity Suite and Retire Legacy Matrix/Playwright Parity

## Summary
Build a native, shared conformance layer for cross-runtime semantics, migrate legacy parity one behavior at a time through a strict duplication loop, re-home the remaining kitchen-sink checks to the correct layer, then delete the matrix and Playwright-based parity infrastructure. Do this as a full migration package, including ADR/doc alignment, so the repo ends in a coherent state.

## Key Changes
### Shared conformance core
- Add `schemas/conformance-suite.schema.json` and make it the contract for `tests/conformance/suite/*.json`.
- Use four case kinds in v1: `FEL_EVALUATION`, `ENGINE_PROCESSING`, `VALIDATION_REPORT`, and `RESPONSE_VALIDATION`.
- Require each case file to declare: `id`, `kind`, optional `definitionPath`, optional `registryPaths`, either `payloadPath` or inline `inputData`, optional `mode`, optional `skipScreener`, canonical `expected`, and `legacyCoverage` listing the legacy test path/check it replaces.
- Keep `FEL_EVALUATION` compatible with the existing comparator policy from `parity-cases.json`: `exact`, `normalized`, or `tolerant-decimal`.
- For processing/validation cases, use exact compare after shared normalization only.
- Standardize normalization in both runtimes: strip `timestamp` and `authored`, drop impl-only fields like `kind`, sort `results` and `validationResults` by `path|code|severity|constraintKind|shapeId|source|sourceId`, and normalize dates/decimals to JSON-stable forms before compare.
- Limit v1 response parity to normalized validation artifacts by default: `ValidationReport` and `Response.validationResults`. Only compare full `response.data` when a case explicitly opts in.

### Native runners
- Add `tests/conformance/parity/test_shared_suite.py` as the Python runner.
- Add `packages/formspec-engine/tests/shared-suite.test.mjs` as the Node runner.
- Python runner behavior:
  - `FEL_EVALUATION`: evaluate with `formspec.fel` directly.
  - `ENGINE_PROCESSING`, `VALIDATION_REPORT`, `RESPONSE_VALIDATION`: run `DefinitionEvaluator.process(data, mode=...)`.
  - Load registries when `registryPaths` are present.
- Node runner behavior:
  - Load engine from `dist/index.js` so it runs through the same built surface as existing engine tests.
  - `FEL_EVALUATION`: construct a minimal definition from declared fields and use `compileExpression`.
  - Processing/validation cases: instantiate `FormEngine`, optionally `skipScreener()`, apply payload values with a shared recursive setter helper, then call `getValidationReport({ mode })` and/or `getResponse({ mode })`.
- Make failure output include case id, case kind, normalized actual vs expected, and `legacyCoverage` metadata.

### First migration slice
- Port the existing six FEL parity cases from `tests/e2e/fixtures/kitchen-sink-holistic/parity-cases.json` into the shared suite first. This is the first legacy overlap and the first deletion target.
- Add one real-example-backed validation case immediately after that using `examples/grant-application/definition.json` plus `examples/grant-application/fixtures/sample-submission.json` input data, with canonical expected output of a valid submit-time report and empty `response.validationResults`.
- Keep example-backed parity manifest-driven. Add a lightweight manifest file under `tests/conformance/suite/` for real examples rather than walking `examples/` automatically.

### Re-home mixed kitchen-sink responsibilities
- Move `P8-TS-PY-FEL-PARITY` to the shared suite.
- Move `P8-DETERMINISTIC-RESPONSES` to engine integration tests near existing response/runtime diagnostics coverage.
- Move engine-only checks from `kitchen-sink-holistic.spec.ts` into `node:test` integration coverage: identity pinning, initial hydration, mixed types, validation/report contract, non-relevant behavior, and screener/assembly.
- Keep UI-specific checks in browser/component coverage only: component/theme runtime and `when` vs `relevant`.
- Do not delete the whole kitchen-sink file until every remaining check in it has a new owner or has been intentionally dropped with justification.

### Governance and docs alignment
- Update ADR 0033 so it no longer declares `tests/conformance/core-semantics-matrix.json` canonical. Mark it superseded by ADR 0035 or rewrite it as historical context.
- Update contributor-facing docs that currently point to the matrix/parity runner, starting with `tests/README.md` and `e2e-test-strategy.md`.
- Run a final cleanup sweep over direct references to `core-semantics-matrix.json`, `kitchen-sink-holistic.spec.ts`, `python_fel_eval.py`, and the matrix scaffold tests so no “Accepted” or instructional doc contradicts the new architecture.

## Migration Sequence
1. Add the conformance-suite schema and the two native runners without deleting any legacy parity infrastructure.
2. Port the six kitchen-sink FEL parity cases into shared JSON and wire both runners to pass them.
3. Run the new shared FEL cases and the overlapping legacy Playwright kitchen-sink parity test together.
4. Review the exact legacy overlap and record it in `legacyCoverage`.
5. Temporarily break one deterministic FEL behavior in one runtime only, locally and on a disposable patch. Recommended mutation: make a simple stdlib branch such as `coalesce` return the wrong branch in the TS engine.
6. Re-run the new shared FEL cases and the legacy kitchen-sink parity test and confirm both fail for the same reason.
7. Revert the intentional break and confirm both pass again.
8. Remove only the overlapped FEL parity behavior from the legacy kitchen-sink coverage. If that requires splitting the file before final deletion, do that rather than deleting unrelated checks early.
9. Add the first real-example-backed grant-application validation case, then repeat the same duplication loop against the most direct legacy or runtime-specific overlapping test.
10. Re-home the remaining kitchen-sink checks to engine integration or browser/component tests, one behavior family at a time.
11. Delete `tests/conformance/core-semantics-matrix.json`, `tests/conformance/parity/test_core_semantics_matrix_scaffold.py`, `packages/formspec-engine/tests/conformance-matrix-scaffold.test.mjs`, `tests/e2e/kitchen_sink/python_fel_eval.py`, and the now-empty `tests/conformance/parity/kitchen-sink-holistic.spec.ts` only after the replacement suite and re-homed tests are green in CI.

## Test Plan
- New Python runner passes under `python3 -m pytest tests/conformance/parity/test_shared_suite.py -q`.
- New Node runner passes under the existing engine unit test entrypoint.
- During each duplication step, run the new shared case and the overlapping legacy test in the same verification pass.
- For the first slice, the mandatory overlap proof is:
  - new shared FEL cases pass
  - legacy kitchen-sink parity test passes
  - intentional one-runtime mutation makes both fail
  - reverted implementation makes both pass again
- Add targeted verification for the re-homed engine integration checks and browser/component checks before deleting the corresponding kitchen-sink coverage.
- Final acceptance criteria:
  - shared suite is the sole owner of runtime parity
  - no accepted ADR or contributor doc still names the matrix as canonical
  - no Playwright test performs TS↔Python parity via subprocess spawning
  - all surviving kitchen-sink behavior has an explicit new home or an explicit deletion rationale

## Assumptions and Defaults
- Scope is the full migration package, not infra-only work.
- The first replacement slice is FEL parity because it has the cleanest existing overlap and the least ambiguity.
- The first real-example-backed shared case is grant-application submit-valid, because it uses a stable example and a deterministic empty validation result.
- Intentional breakage is a local verification step only and must never land in a committed change.
- Engine tests continue to load the built package from `dist`, matching the current `formspec-engine` test pattern.
- The shared suite remains small and high-signal; runtime-specific integration tests are preserved unless their only purpose is duplicate parity coverage.
