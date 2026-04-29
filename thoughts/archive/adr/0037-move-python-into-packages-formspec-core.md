# ADR 0037: Move `src/formspec/` into `packages/formspec-core/`

## Status

Superseded — the package name `packages/formspec-core/` was claimed by `@formspec-org/core` (TypeScript), a different package providing the core project model and command-dispatch layer. Python remains at `src/formspec/`. If this migration is still desired, a different package name is needed (e.g. `packages/formspec-python/` or `packages/formspec-py/`).

## Context

The Python implementation lives in `src/formspec/` while all TypeScript packages live under `packages/`. This creates an inconsistent monorepo layout and the Python code lacks proper packaging (no `pyproject.toml` with metadata, deps, or entry points). Moving it into `packages/formspec-core/` with a proper `pyproject.toml` unifies the layout and makes the package pip-installable.

## Target Structure

```
packages/formspec-core/
├── pyproject.toml              ← NEW
├── src/
│   └── formspec/               ← MOVED from src/formspec/
│       ├── __init__.py
│       ├── fel/
│       ├── validator/
│       ├── adapters/
│       ├── mapping/
│       ├── changelog.py
│       ├── evaluator.py
│       ├── registry.py
│       └── validate.py
└── tests/                      ← MOVED from tests/ (Python only)
    ├── conftest.py
    ├── __init__.py
    ├── unit/
    ├── conformance/
    ├── integration/
    ├── e2e/{api,headless,kitchen_sink}/
    └── fixtures/
```

**Stays at repo root:** `tests/e2e/browser/` (Playwright TS), `tests/component/` (Playwright TS), `tests/e2e/fixtures/` (used by browser tests), `tests/debug-dom.spec.ts`

---

## Step 1: Create `packages/formspec-core/pyproject.toml`

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "formspec"
version = "0.1.0"
description = "Formspec core — FEL evaluator, validator, mapping engine, and adapters"
requires-python = ">=3.11"
dependencies = [
    "jsonschema>=4.20",
    "referencing>=0.30",
]

[project.scripts]
formspec-validate = "formspec.validate:main"
formspec-lint = "formspec.validator.__main__:main"

[tool.hatch.build.targets.wheel]
packages = ["src/formspec"]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
markers = [
    "schema: JSON schema and schema/spec contract tests",
    "schema_contract: cross-schema and prose-contract schema tests",
    "runtime: runtime package behavior tests",
    "fel: formspec.fel runtime tests",
    "validator: formspec.validator runtime tests",
    "mapping: mapping runtime tests",
    "adapters: adapter runtime tests",
]
```

---

## Step 2: Move source files

```bash
mkdir -p packages/formspec-core/src
git mv src/formspec packages/formspec-core/src/formspec
rmdir src
```

---

## Step 3: Move Python tests

```bash
# Create target dirs
mkdir -p packages/formspec-core/tests/e2e

# Move Python test directories
git mv tests/conftest.py      packages/formspec-core/tests/conftest.py
git mv tests/__init__.py      packages/formspec-core/tests/__init__.py
git mv tests/unit             packages/formspec-core/tests/unit
git mv tests/conformance      packages/formspec-core/tests/conformance
git mv tests/integration      packages/formspec-core/tests/integration
git mv tests/fixtures         packages/formspec-core/tests/fixtures

# Move Python E2E subdirs (browser/ and fixtures/ stay at root)
git mv tests/e2e/api          packages/formspec-core/tests/e2e/api
git mv tests/e2e/headless     packages/formspec-core/tests/e2e/headless
git mv tests/e2e/kitchen_sink packages/formspec-core/tests/e2e/kitchen_sink
git mv tests/e2e/__init__.py  packages/formspec-core/tests/e2e/__init__.py
git mv tests/e2e/runner.py    packages/formspec-core/tests/e2e/runner.py
```

---

## Step 4: Fix `parents[N]` path depths in moved test files

All Python tests move +2 levels deeper (`tests/X` → `packages/formspec-core/tests/X`), so every `parents[N]` that resolves to repo root needs `N += 2`.

| File (new path under `packages/formspec-core/`) | Current | New | Notes |
|---|---|---|---|
| `tests/unit/support/schema_fixtures.py:12` | `parents[3]` | `parents[5]` | |
| `tests/conformance/parity/test_shared_suite.py:19` | `parents[3]` | `parents[5]` | |
| `tests/conformance/schemas/test_conformance_suite_schema.py:14` | `parents[3]` | `parents[5]` | |
| `tests/conformance/registry/test_registry_entry_constraints.py:26` | `parents[3]` | `parents[5]` | |
| `tests/conformance/schemas/test_registry_schema.py:13` | `parents[3]` | `parents[5]` | |
| `tests/conformance/spec/test_cross_spec_contracts.py:1218` | `parents[3]` | `parents[5]` | |
| `tests/integration/fixtures/test_core_fixtures.py:14,206,392,398,558` | `parents[3]` | `parents[5]` | 5 occurrences |
| `tests/integration/test_definition_schema_acceptance.py:12` | `parents[2]` | `parents[4]` | |
| `tests/unit/test_definition_evaluator.py:1244` | `parents[4]` | `parents[4]` | **NO CHANGE** — currently broken (was at `runtime/evaluator/`) but `parents[4]` is correct for new location |
| `tests/unit/test_validator_schema.py:11` | `parents[2]` | `parents[4]` | |
| `tests/unit/test_validator_linter.py:9` | `parents[2]` | `parents[4]` | |
| `tests/e2e/api/conftest.py:11` | `parents[3]` | `parents[5]` | Also update `/ "src"` → `/ "packages" / "formspec-core" / "src"` on line 12 |
| `tests/e2e/headless/test_edge_case_payloads.py:12` | `parents[3]` | `parents[5]` | |
| `tests/e2e/headless/test_grant_app_processing.py:10,14` | `parents[3]` | `parents[5]` | 2 occurrences |
| `tests/e2e/kitchen_sink/conformance_runner.py:31` | `parents[3]` | `parents[5]` | |

**Additionally for `tests/e2e/api/conftest.py`:**
- Line 12: change `_REPO / "src"` → `_REPO / "packages" / "formspec-core" / "src"` (or just rely on pytest pythonpath and remove the sys.path hack entirely)

---

## Step 5: Update root config and build files

### `pyproject.toml` (root)
Strip Python pytest config entirely — it now lives in `packages/formspec-core/pyproject.toml`. Keep the file only if there are other root-level tool configs, otherwise delete.

### `Makefile`
- Line 19: `PYTHONPATH=src` → `PYTHONPATH=packages/formspec-core/src`
- Line 24: `PYTHONPATH=src` → `PYTHONPATH=packages/formspec-core/src`, and `src/formspec/API.llm.md` → `packages/formspec-core/src/formspec/API.llm.md`
- Line 80: `src/formspec/API.llm.md` → `packages/formspec-core/src/formspec/API.llm.md`

### `package.json` (root)
- `test:kitchen-sink:python` script: `PYTHONPATH=src` → `PYTHONPATH=packages/formspec-core/src`

### `examples/refrences/package.json`
- `dev:server` script: `PYTHONPATH=../../src` → `PYTHONPATH=../../packages/formspec-core/src`

### `examples/refrences/server/main.py`
- Line 4 (docstring): update PYTHONPATH instruction
- Line 18: `_REPO_ROOT / "src"` → `_REPO_ROOT / "packages" / "formspec-core" / "src"`

---

## Step 6: Update documentation

### `CLAUDE.md`
- Monorepo structure: replace `src/formspec/` block with `packages/formspec-core/` entry
- Build commands: update all `PYTHONPATH=src` references
- Test locations: update Python test paths
- API LLM docs paths: `src/formspec/API.llm.md` → `packages/formspec-core/src/formspec/API.llm.md`

### Example READMEs (low priority, documentation only)
- `examples/clinical-intake/README.md` — PYTHONPATH instruction
- `examples/grant-application/README.md` — PYTHONPATH instruction
- `examples/invoice/README.md` — PYTHONPATH instruction

### ADRs — leave as-is (historical records)

---

## Step 7: Update CI

### `.github/workflows/docs-check.yml`
- Review for hardcoded test paths referencing old locations

---

## What Does NOT Change

- All Python imports (`from formspec.fel import ...`) — namespace is identical
- Internal package code — zero changes inside `formspec/**/*.py`
- TypeScript packages — unaffected
- Playwright/browser tests — stay at repo root
- JSON schemas, specs, registries — stay at repo root

---

## Verification

```bash
# 1. Python tests pass from package dir
cd packages/formspec-core && python3 -m pytest tests/ -v

# 2. Python tests pass from repo root
python3 -m pytest packages/formspec-core/tests/ -v

# 3. CLI modules still work
PYTHONPATH=packages/formspec-core/src python3 -m formspec.validate \
  examples/grant-application/ --registry registries/formspec-common.registry.json
PYTHONPATH=packages/formspec-core/src python3 -m formspec.validator \
  examples/grant-application/definition.json

# 4. API docs generate
make api-docs

# 5. Playwright tests unaffected
npm test

# 6. Example server runs
cd examples/refrences && npm run dev:server
```

## Decision

Accepted. Proceed with the migration.
