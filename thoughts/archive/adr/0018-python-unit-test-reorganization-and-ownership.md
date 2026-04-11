# ADR-0018: Python Unit Test Reorganization and Ownership Mapping

**Status**: Accepted  
**Date**: 2026-02-24  
**Authors**: Codex (AI), exedev  
**Deciders**: exedev

---

## 1. Context and Problem Statement

The Python unit tests under `tests/` are mostly flat and mix multiple intents:

- JSON Schema conformance and spec-contract checks
- runtime package behavior checks (`formspec.fel`, `formspec.validator`, `formspec.mapping`, `formspec.adapters`, `formspec.registry`, `formspec.changelog`)

Current inventory (excluding `tests/e2e/`):

- 29 unit test files
- 1,881 collected tests
- 12,341 lines of test code

Because files are flat and naming is uneven, ownership is unclear (for example, which tests exercise a schema artifact vs a `src/formspec/*` package module).

## 2. Decision Drivers

- **Clear ownership by sub-package**: every test file should have an obvious primary owner.
- **Separation by intent**: schema/spec conformance should not be mixed with runtime package tests.
- **Lower maintenance overhead**: deduplicate schema loader/registry setup and repeated document builders.
- **Predictable targeted runs**: allow package-focused runs (`fel`, `validator`, `schema/contracts`) without filename guesswork.
- **Incremental migration safety**: move files with minimal assertion churn first.

## 3. Considered Options

### Option A: Keep flat layout and only add docs mapping

Pros: lowest churn.  
Cons: ownership ambiguity and mixed intent remain.

### Option B: Reorganize unit tests by intent + package ownership (chosen)

Pros: clear ownership, easier selective runs, cleaner onboarding, cleaner future CI partitioning.  
Cons: short-term file-move churn and path updates.

### Option C: Rebuild tests from scratch by new taxonomy

Pros: perfect clean slate.  
Cons: unnecessary regression risk and lost continuity.

## 4. Decision

Adopt **Option B**.

Reorganize Python unit tests into explicit ownership groups:

- `tests/unit/schema/` for schema and spec-contract conformance
- `tests/unit/runtime/` for `src/formspec/*` package behavior
- `tests/unit/support/` for shared fixtures/builders

This ADR also defines the authoritative current file-to-owner map to remove ambiguity.

## 5. Current Ownership Map (Authoritative Baseline)

### 5.1 Schema / Spec-Contract Ownership (`schemas/` + `specs/`, no runtime package owner)

- `tests/unit/schema/definition/test_definition_schema.py` (141 tests): `schemas/definition.schema.json`
- `tests/unit/schema/definition/test_presentation_hints.py` (111): definition Tier-1 presentation hint constraints
- `tests/unit/schema/response/test_response_schema.py` (48): `response.schema.json` + `validationReport.schema.json`
- `tests/unit/schema/mapping/test_mapping_schema.py` (98): `mapping.schema.json`
- `tests/unit/schema/registry/test_registry_schema.py` (72): `registry.schema.json`
- `tests/unit/schema/theme/test_theme_schema.py` (201): `theme.schema.json` (+ definition interaction assertions)
- `tests/unit/schema/component/test_component_schema.py` (111): `component.schema.json`
- `tests/unit/schema/contracts/test_spec_examples.py` (224): spec markdown JSON examples vs schemas
- `tests/unit/schema/contracts/test_cross_spec_contracts.py` (172): spec prose vs schema structural contracts
- `tests/unit/schema/contracts/test_mapping_adapter_schema_contracts.py` (6): mapping adapter schema `$defs` contracts
- `tests/unit/schema/contracts/test_property_based.py` (50): generative schema conformance across core schemas

### 5.2 Runtime Package Ownership (`src/formspec/*`)

- `formspec.fel` (434 total tests):
  - `tests/unit/runtime/fel/test_fel_parser.py` (109)
  - `tests/unit/runtime/fel/test_fel_evaluator.py` (105)
  - `tests/unit/runtime/fel/test_fel_functions.py` (109)
  - `tests/unit/runtime/fel/test_fel_api.py` (55)
  - `tests/unit/runtime/fel/test_fel_repeat.py` (16)
  - `tests/unit/runtime/fel/test_fel_mip.py` (14)
  - `tests/unit/runtime/fel/test_fel_integration.py` (13)
  - `tests/unit/runtime/fel/test_fel_property_based.py` (13)
- `formspec.validator` (23 total tests):
  - `tests/unit/runtime/validator/test_validator_schema.py` (3)
  - `tests/unit/runtime/validator/test_validator_references.py` (3)
  - `tests/unit/runtime/validator/test_validator_expressions.py` (3)
  - `tests/unit/runtime/validator/test_validator_component_semantics.py` (4)
  - `tests/unit/runtime/validator/test_validator_linter.py` (6)
  - `tests/unit/runtime/validator/test_validator_cli.py` (4)
- `formspec.mapping` + `formspec.adapters` integration:
  - `tests/unit/runtime/mapping/test_mapping_engine.py` (50) primary owner: `formspec.mapping`, secondary: `formspec.adapters`
- `formspec.adapters`:
  - `tests/unit/runtime/adapters/test_adapters.py` (83) adapter runtime behavior
- `formspec.registry`:
  - `tests/unit/runtime/registry/test_registry.py` (35)
- `formspec.changelog`:
  - `tests/unit/runtime/changelog/test_changelog.py` (22)

## 6. Target Structure

```text
tests/
  unit/
    schema/
      definition/
      response/
      mapping/
      registry/
      theme/
      component/
      contracts/
    runtime/
      fel/
      validator/
      mapping/
      adapters/
      registry/
      changelog/
    support/
      helpers.py
      schema_fixtures.py
  e2e/
```

Notes:

- Keep existing test filenames initially to reduce risk; only move paths first.
- `schema/contracts/` contains cross-schema and spec-prose tests (`spec_examples`, `cross_spec_contracts`, schema property-based tests).

## 7. Scope of Deduplication

### 7.1 Consolidate schema loading and registry setup

Unify repeated schema path loading and Draft 2020-12 registry wiring used across:

- `test_response_schema.py`
- `test_spec_examples.py`
- `test_property_based.py`
- `test_theme_schema.py`
- `test_mapping_schema.py`
- `test_registry_schema.py`

### 7.2 Consolidate repeated document builders

Promote shared minimal document fixtures/builders into `tests/unit/support/` for repeated patterns currently redefined across runtime tests.

### 7.3 Separate schema-contract checks from runtime adapter behavior

`test_adapters.py` currently includes mapping-schema alignment assertions; keep runtime adapter behavior in `runtime/adapters` and move pure schema-shape checks to `schema/contracts`.

### 7.4 Standardize run selectors

Add stable pytest markers/groups for:

- `schema`
- `schema_contract`
- `runtime`
- `fel`
- `validator`
- `mapping`
- `adapters`

## 8. Implementation Plan

1. Create `tests/unit/{schema,runtime,support}` directories.
2. Move files by ownership map (no logic changes yet).
3. Update imports (`tests.helpers` and any path assumptions).
4. Extract shared schema fixture helpers into `tests/unit/support/schema_fixtures.py`.
5. Move adapter schema-alignment assertions to `schema/contracts`.
6. Update docs (`tests/README.md`) and workflow path filters referencing moved files.
7. Validate with full run and targeted runs per ownership group.

## 9. Consequences

### Positive

- Clear answer to “which sub-package does this test cover?”
- Cleaner package-focused triage when failures occur.
- Less duplicated fixture/setup code.
- Easier future CI sharding by ownership group.

### Negative / Tradeoffs

- Temporary churn from file moves.
- One-time updates to docs/workflows and local habits.
- Possible short-lived merge conflicts while test paths stabilize.

## 10. Non-Goals

- Rewriting assertions for semantic changes during the move.
- Changing production package boundaries.
- Merging Python unit tests with Playwright E2E suites.

## 11. Acceptance Criteria

- Every Python unit test file sits under an ownership folder matching this ADR.
- Ownership ambiguity is removed for all current files.
- Shared schema fixture/registry setup is centralized.
- Targeted runs by group work (`schema`, `runtime/fel`, `runtime/validator`, etc.).
- Full Python unit suite still passes after migration.
