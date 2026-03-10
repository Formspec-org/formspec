# ADR 0033: Core Semantics Conformance Matrix (Historical)

## Status
Superseded by ADR 0035 on 2026-03-10.

## Historical Decision
ADR 0033 introduced `tests/conformance/core-semantics-matrix.json` as a machine-readable inventory for cross-runtime semantics.

That matrix and its scaffold tests have now been retired. Shared runtime parity is owned by:

- `schemas/conformance-suite.schema.json`
- `tests/conformance/suite/*.json`
- `tests/conformance/parity/test_shared_suite.py`
- `packages/formspec-engine/tests/shared-suite.test.mjs`

## Superseding Guidance
Use ADR 0035 as the canonical architecture for parity and conformance ownership.
