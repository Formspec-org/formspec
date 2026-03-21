# Python Package Rust Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Complete — all 8 tasks executed. 23 Python files deleted, `_rust.py` bridge operational, 1990 Python tests passing.
**Goal:** Replace 23 Python files with a single `_rust.py` bridge module + updated `validate.py`, using `pythonize` for zero-copy PyO3 and `msgspec.Struct` for result types.

**Architecture:** All Rust calls go through `_rust.py`. FEL types (`types.py`, `errors.py`, `keywords.py`) and adapters stay as-is. `validate.py` is rewired. Everything else is deleted.

**Tech Stack:** Python 3.11+, msgspec>=0.18, PyO3 0.24, pythonize 0.22, maturin

**Spec:** `thoughts/specs/2026-03-20-python-package-rust-rewrite.md`

**Rollback policy:** If Rust gaps are discovered (behavior Python tests relied on that Rust doesn't implement), **patch the Rust crate first**. Do not resurrect deleted Python files or add Python fallbacks.

**Spec errata discovered during planning:**
- Spec's `DependencySet` fields (`variables`, `instances`, `functions`) are wrong — the actual Rust `extract_deps` returns `instance_refs`, `context_refs`, `mip_deps`, `has_self_ref`, `has_wildcard`, `uses_prev_next`. The plan uses the correct (Rust-matching) field names.
- Spec's "Rust return shapes" for `lint_document` says it returns a list — it actually returns `{"document_type", "valid", "diagnostics": [...]}`. The plan's wrapper code accesses `raw.get("diagnostics")` which is correct.
- `Severity` enum in `errors.py` has no `INFO` level — only `ERROR` and `WARNING`. The mapping of Rust `"info"` → Python `Severity.WARNING` is a deliberate lossy mapping, not a bug. It matches the existing behavior.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `crates/formspec-py/Cargo.toml` | Add `pythonize` dependency |
| Modify | `crates/formspec-py/src/lib.rs` | Change `&str` params to `&Bound<'_, PyAny>` + `pythonize::depythonize` |
| Create | `src/formspec/_rust.py` | All `formspec_rust` wrappers, result types, FEL value hydration |
| Modify | `src/formspec/__init__.py` | Re-export from `_rust` instead of deleted modules |
| Modify | `src/formspec/fel/__init__.py` | Re-export from `_rust` instead of `runtime` and `metadata` |
| Rewrite | `src/formspec/validate.py` | Replace class-based calls with `_rust` function calls |
| Modify | `.github/workflows/ci.yml` | Add `msgspec` to pip install |
| Delete | 23 files (see below) | — |
| Modify | 15+ test files | Update imports and adapt class→function call patterns |

### Files to delete

```
src/formspec/evaluator.py
src/formspec/protocols.py
src/formspec/factories.py
src/formspec/registry.py
src/formspec/changelog.py
src/formspec/mapping/__init__.py
src/formspec/mapping/engine.py
src/formspec/mapping/transforms.py
src/formspec/validator/__init__.py
src/formspec/validator/__main__.py
src/formspec/validator/linter.py
src/formspec/validator/schema.py
src/formspec/validator/tree.py
src/formspec/validator/references.py
src/formspec/validator/expressions.py
src/formspec/validator/dependencies.py
src/formspec/validator/component.py
src/formspec/validator/component_matrix.py
src/formspec/validator/diagnostic.py
src/formspec/validator/policy.py
src/formspec/validator/theme.py
src/formspec/fel/runtime.py
src/formspec/fel/metadata.py
src/formspec/fel/extensions.py
```

---

## Task 1: Add `pythonize` to Rust and change PyO3 signatures

**Files:**
- Modify: `crates/formspec-py/Cargo.toml`
- Modify: `crates/formspec-py/src/lib.rs`

This task changes the Rust PyO3 binding layer to accept Python objects directly instead of JSON strings. The internal crates are unaffected — only the `formspec-py` boundary changes.

### Identify which functions take `&str` JSON params

These functions in `lib.rs` currently take JSON strings that must change to `&Bound<'_, PyAny>`:

- `detect_type(json_str: &str)` → line 188
- `lint_document(py, json_str: &str)` → line 204
- `evaluate_def(py, definition_json: &str, data_json: &str)` → line 250
- `parse_registry(py, registry_json: &str)` → line 299
- `find_registry_entry(py, registry_json: &str, name: &str, version: Option<&str>)` → line 326
- `generate_changelog(py, old_json: &str, new_json: &str, definition_url: &str)` → line 401
- `execute_mapping_doc(py, doc_json: &str, source_json: &str, direction: &str)` → line 464

Functions that already take `&PyDict` or `&str` expression strings (NOT JSON docs) stay unchanged:

- `eval_fel` — takes `expression: &str` + `fields: Option<&Bound<'_, PyDict>>` (correct)
- `eval_fel_detailed` — takes `expression: &str` + multiple `Option<&Bound<'_, PyDict>>` (correct)
- `parse_fel` — takes `expression: &str` (correct — it's a FEL string, not JSON)
- `get_dependencies` — takes `expression: &str` (correct)
- `extract_deps` — takes `expression: &str` (correct)
- `analyze_expression` — takes `expression: &str` (correct)
- `list_builtin_functions` — takes no args (correct)
- `validate_lifecycle` — takes `from_status: &str, to_status: &str` (correct — enum strings, not JSON)
- `well_known_url` — takes `base_url: &str` (correct — a URL string, not JSON)

- [ ] **Step 1: Add pythonize dependency**

In `crates/formspec-py/Cargo.toml`, add to `[dependencies]`:

```toml
pythonize = "0.22"
```

- [ ] **Step 2: Add import in lib.rs**

At the top of `crates/formspec-py/src/lib.rs`, after the existing use statements:

```rust
use pythonize::depythonize;
```

- [ ] **Step 3: Change `detect_type` signature**

Before (line ~188):
```rust
#[pyfunction]
fn detect_type(json_str: &str) -> PyResult<Option<String>> {
    let doc: Value = serde_json::from_str(json_str)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid JSON: {e}")))?;
    Ok(detect_document_type(&doc).map(|dt| dt.schema_key().to_string()))
}
```

After:
```rust
#[pyfunction]
fn detect_type(document: &Bound<'_, PyAny>) -> PyResult<Option<String>> {
    let doc: Value = depythonize(document)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    Ok(detect_document_type(&doc).map(|dt| dt.schema_key().to_string()))
}
```

- [ ] **Step 4: Change `lint_document` signature**

Before (line ~204):
```rust
#[pyfunction]
fn lint_document(py: Python, json_str: &str) -> PyResult<PyObject> {
    let doc: Value = serde_json::from_str(json_str)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid JSON: {e}")))?;
```

After:
```rust
#[pyfunction]
fn lint_document(py: Python, document: &Bound<'_, PyAny>) -> PyResult<PyObject> {
    let doc: Value = depythonize(document)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
```

(The rest of the function body stays the same — it operates on `doc: Value`.)

- [ ] **Step 5: Change `evaluate_def` signature**

Before (line ~250):
```rust
#[pyfunction]
fn evaluate_def(py: Python, definition_json: &str, data_json: &str) -> PyResult<PyObject> {
    let definition: Value = serde_json::from_str(definition_json).map_err(|e| {
        pyo3::exceptions::PyValueError::new_err(format!("invalid definition JSON: {e}"))
    })?;
    let data_val: Value = serde_json::from_str(data_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid data JSON: {e}")))?;
```

After:
```rust
#[pyfunction]
fn evaluate_def(py: Python, definition: &Bound<'_, PyAny>, data: &Bound<'_, PyAny>) -> PyResult<PyObject> {
    let definition: Value = depythonize(definition)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let data_val: Value = depythonize(data)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
```

- [ ] **Step 6: Change `parse_registry` signature**

Before (line ~299):
```rust
#[pyfunction]
fn parse_registry(py: Python, registry_json: &str) -> PyResult<PyObject> {
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid JSON: {e}")))?;
```

After:
```rust
#[pyfunction]
fn parse_registry(py: Python, registry: &Bound<'_, PyAny>) -> PyResult<PyObject> {
    let val: Value = depythonize(registry)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
```

- [ ] **Step 7: Change `find_registry_entry` signature**

Before (line ~326):
```rust
#[pyfunction]
fn find_registry_entry(
    py: Python,
    registry_json: &str,
    name: &str,
    version_constraint: &str,
) -> PyResult<PyObject> {
    let val: Value = serde_json::from_str(registry_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(format!("invalid JSON: {e}")))?;
```

After:
```rust
#[pyfunction]
fn find_registry_entry(
    py: Python,
    registry: &Bound<'_, PyAny>,
    name: &str,
    version_constraint: &str,
) -> PyResult<PyObject> {
    let val: Value = depythonize(registry)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
```

Note: `version_constraint` stays `&str` (not `Option`). Empty string means "no constraint". The Python wrapper sends `version or ""` to handle `None`.

- [ ] **Step 8: Change `generate_changelog` signature**

Before (line ~401):
```rust
#[pyfunction]
fn generate_changelog(
    py: Python,
    old_def_json: &str,
    new_def_json: &str,
    definition_url: &str,
) -> PyResult<PyObject> {
    let old_def: Value = serde_json::from_str(old_def_json).map_err(|e| {
        pyo3::exceptions::PyValueError::new_err(format!("invalid old definition JSON: {e}"))
    })?;
    let new_def: Value = serde_json::from_str(new_def_json).map_err(|e| {
        pyo3::exceptions::PyValueError::new_err(format!("invalid new definition JSON: {e}"))
    })?;
```

After:
```rust
#[pyfunction]
fn generate_changelog(
    py: Python,
    old_def_obj: &Bound<'_, PyAny>,
    new_def_obj: &Bound<'_, PyAny>,
    definition_url: &str,
) -> PyResult<PyObject> {
    let old_def: Value = depythonize(old_def_obj)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let new_def: Value = depythonize(new_def_obj)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
```

(`definition_url` stays `&str` — it's a URL string, not a JSON document.)

- [ ] **Step 9: Change `execute_mapping_doc` signature**

Before (line ~464):
```rust
#[pyfunction]
fn execute_mapping_doc(
    py: Python,
    doc_json: &str,
    source_json: &str,
    direction: &str,
) -> PyResult<PyObject> {
    let doc_val: Value = serde_json::from_str(doc_json).map_err(|e| {
        pyo3::exceptions::PyValueError::new_err(format!("invalid mapping doc JSON: {e}"))
    })?;
    let source: Value = serde_json::from_str(source_json).map_err(|e| {
        pyo3::exceptions::PyValueError::new_err(format!("invalid source JSON: {e}"))
    })?;
```

After:
```rust
#[pyfunction]
fn execute_mapping_doc(
    py: Python,
    doc_obj: &Bound<'_, PyAny>,
    source_obj: &Bound<'_, PyAny>,
    direction: &str,
) -> PyResult<PyObject> {
    let doc_val: Value = depythonize(doc_obj)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let source: Value = depythonize(source_obj)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
```

(`direction` stays `&str` — it's an enum string, not a JSON document.)

- [ ] **Step 10: Build and install the updated PyO3 module**

```bash
cargo build -p formspec-py 2>&1 | head -20
```

Expected: clean build with no errors.

Then reinstall into the Python environment so `import formspec_rust` picks up the new signatures:

```bash
pip install --no-build-isolation ./crates/formspec-py
```

- [ ] **Step 11: Run Rust tests**

```bash
cargo test -p formspec-py --no-default-features 2>&1 | tail -20
```

Expected: all existing Rust-side tests pass. The Rust tests use in-process calls (not through PyO3), so the signature changes don't affect them.

- [ ] **Step 12: Commit**

```bash
git add crates/formspec-py/Cargo.toml crates/formspec-py/src/lib.rs
git commit -m "build(formspec-py): switch PyO3 from JSON strings to pythonize

Replace serde_json::from_str with pythonize::depythonize for all
document-accepting PyO3 functions. Python callers now pass dicts
directly instead of JSON strings — zero serialization overhead."
```

---

## Task 2: Create `_rust.py` — result types and FEL bridge

**Files:**
- Create: `src/formspec/_rust.py`
- Test: `tests/unit/test_rust_bridge.py`

This task creates the bridge module with result types and the FEL functions (parse, evaluate, extract_dependencies). FEL is the most complex part due to value hydration. Other functions are added in Task 3.

- [ ] **Step 1: Write the failing test for FEL parse**

Create `tests/unit/test_rust_bridge.py`:

```python
"""Tests for the _rust bridge module — verifies Python↔Rust boundary."""

from formspec._rust import parse, ParsedExpression


def test_parse_valid_expression():
    result = parse("1 + 2")
    assert isinstance(result, ParsedExpression)
    assert result.source == "1 + 2"


def test_parse_invalid_expression_raises():
    from formspec.fel.errors import FelSyntaxError
    import pytest

    with pytest.raises(FelSyntaxError):
        parse("1 +")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python3 -m pytest tests/unit/test_rust_bridge.py::test_parse_valid_expression -v
```

Expected: `ModuleNotFoundError: No module named 'formspec._rust'`

- [ ] **Step 3: Create `_rust.py` with result types and FEL parse**

Create `src/formspec/_rust.py`:

```python
"""Thin wrappers over formspec_rust (PyO3) — the only Rust bridge in the package."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

import msgspec
import formspec_rust

from .fel.errors import Diagnostic, FelSyntaxError, Severity
from .fel.types import (
    FelArray,
    FelBoolean,
    FelDate,
    FelFalse,
    FelMoney,
    FelNull,
    FelNumber,
    FelObject,
    FelString,
    FelTrue,
    FelValue,
    fel_decimal,
    from_python,
    is_null,
    to_python,
)


# ── Result types ─────────────────────────────────────────────────


class ProcessingResult(msgspec.Struct, frozen=True):
    """Output of evaluate_definition()."""
    valid: bool
    results: list[dict]
    data: dict
    variables: dict
    non_relevant: list[str]


class MappingDiagnostic(msgspec.Struct, frozen=True):
    rule_index: int
    source_path: str | None
    target_path: str
    message: str


class MappingResult(msgspec.Struct, frozen=True):
    direction: str
    output: dict
    rules_applied: int
    diagnostics: list[MappingDiagnostic]


class LintDiagnostic(msgspec.Struct, frozen=True):
    code: str
    severity: str
    path: str
    message: str


class RegistryInfo(msgspec.Struct, frozen=True):
    publisher: dict
    published: str
    entry_count: int
    validation_issues: list[str]


class ParsedExpression(msgspec.Struct, frozen=True):
    """Opaque syntax-validated handle — source only, no AST exposed."""
    source: str


class EvalResult(msgspec.Struct, frozen=True):
    # Note: EvalResult is constructed manually, NOT via msgspec.convert(),
    # because FelValue is a custom union type that msgspec cannot auto-hydrate.
    value: FelValue
    diagnostics: list[Diagnostic]


class DependencySet(msgspec.Struct, frozen=True):
    fields: set[str]
    instance_refs: set[str]
    context_refs: set[str]
    mip_deps: set[str]
    has_self_ref: bool
    has_wildcard: bool
    uses_prev_next: bool


# ── Private helpers ──────────────────────────────────────────────


def _severity_from_str(raw: str | None) -> Severity:
    if raw == "warning":
        return Severity.WARNING
    if raw == "info":
        return Severity.WARNING
    return Severity.ERROR


def _deserialize_value(value: object) -> FelValue:
    """Convert Rust's tagged return value to a FEL type."""
    if isinstance(value, dict) and "__fel_type__" in value:
        tagged_type = value["__fel_type__"]
        if tagged_type == "number":
            return FelNumber(fel_decimal(value.get("value")))
        if tagged_type in {"date", "datetime"}:
            return from_python(_parse_iso_date_like(value.get("value")))
        if tagged_type == "money":
            return from_python(
                {"amount": value.get("amount"), "currency": value.get("currency")}
            )
    if isinstance(value, list):
        return from_python([to_python(_deserialize_value(item)) for item in value])
    if isinstance(value, dict):
        return from_python(
            {key: to_python(_deserialize_value(item)) for key, item in value.items()}
        )
    return from_python(value)


def _parse_iso_date_like(value: object) -> object:
    if not isinstance(value, str):
        return value
    if "T" in value:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return value
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return value


def _normalize_context_ref(ref: str) -> str:
    if "." in ref:
        return ref.split(".", 1)[0]
    return ref


def _normalize_diagnostic_message(message: str) -> str:
    if message.startswith("undefined function: "):
        return "Undefined function: " + message.split(": ", 1)[1]
    return message


def _serialize_value(value: object) -> object:
    """Convert FEL type to Python-native for Rust consumption."""
    if is_null(value) or isinstance(
        value,
        (FelNumber, FelString, FelBoolean, FelDate, FelArray, FelMoney, FelObject),
    ):
        return to_python(value)
    return value


def _serialize_mip_states(
    mip_states: dict[str, object] | None,
) -> dict[str, dict[str, bool]] | None:
    if not mip_states:
        return None
    serialized: dict[str, dict[str, bool]] = {}
    for path, state in mip_states.items():
        if isinstance(state, dict):
            serialized[path] = {
                "valid": bool(state.get("valid", True)),
                "relevant": bool(state.get("relevant", True)),
                "readonly": bool(state.get("readonly", False)),
                "required": bool(state.get("required", False)),
            }
        else:
            serialized[path] = {
                "valid": bool(getattr(state, "valid", True)),
                "relevant": bool(getattr(state, "relevant", True)),
                "readonly": bool(getattr(state, "readonly", False)),
                "required": bool(getattr(state, "required", False)),
            }
    return serialized


def _serialize_variables(
    data: dict[str, object],
    variables: dict[str, FelValue] | None,
) -> dict[str, object] | None:
    serialized: dict[str, object] = {}
    if variables:
        serialized.update(
            {name: _serialize_value(value) for name, value in variables.items()}
        )
    for contextual_name in ("source", "target"):
        if contextual_name in data and contextual_name not in serialized:
            serialized[contextual_name] = data[contextual_name]
    return serialized or None


# ── FEL functions ────────────────────────────────────────────────


def parse(source: str) -> ParsedExpression:
    """Validate FEL syntax and return an opaque handle."""
    valid = formspec_rust.parse_fel(source)
    if not valid:
        raise FelSyntaxError(f"FEL parse error: {source!r}")
    return ParsedExpression(source=source)


def evaluate(
    source: str,
    data: dict | None = None,
    *,
    instances: dict[str, dict] | None = None,
    mip_states: dict[str, object] | None = None,
    extensions: dict[str, object] | None = None,
    variables: dict[str, FelValue] | None = None,
) -> EvalResult:
    """Evaluate a FEL expression through the Rust runtime."""
    if extensions:
        raise NotImplementedError(
            "Dynamic Python FEL extensions are no longer supported by the Rust runtime."
        )

    payload = formspec_rust.eval_fel_detailed(
        source,
        data or {},
        instances or None,
        _serialize_mip_states(mip_states),
        _serialize_variables(data or {}, variables),
        datetime.now().isoformat(timespec="seconds"),
    )
    value = _deserialize_value(payload.get("value"))
    diagnostics = [
        Diagnostic(
            message=_normalize_diagnostic_message(str(raw.get("message", ""))),
            pos=None,
            severity=_severity_from_str(raw.get("severity")),
        )
        for raw in payload.get("diagnostics", [])
        if isinstance(raw, dict)
    ]
    return EvalResult(value=value, diagnostics=diagnostics)


def extract_dependencies(source: str) -> DependencySet:
    """Extract static dependencies from a FEL expression."""
    raw = formspec_rust.extract_deps(source)
    return DependencySet(
        fields={field.replace("[*]", "") for field in raw.get("fields", [])},
        instance_refs=set(raw.get("instance_refs", [])),
        context_refs={_normalize_context_ref(r) for r in raw.get("context_refs", [])},
        mip_deps=set(raw.get("mip_deps", [])),
        has_self_ref=bool(raw.get("has_self_ref", False)),
        has_wildcard=bool(raw.get("has_wildcard", False)),
        uses_prev_next=bool(raw.get("uses_prev_next", False)),
    )


def builtin_function_catalog() -> list[dict[str, str]]:
    """Return Rust-exported builtin function metadata."""
    return list(formspec_rust.list_builtin_functions())


BUILTIN_NAMES: frozenset[str] = frozenset(
    entry["name"] for entry in builtin_function_catalog()
)
```

- [ ] **Step 4: Run FEL parse tests**

```bash
python3 -m pytest tests/unit/test_rust_bridge.py -v
```

Expected: both tests pass.

- [ ] **Step 5: Add evaluate and extract_dependencies tests**

Append to `tests/unit/test_rust_bridge.py`:

```python
from formspec._rust import evaluate, extract_dependencies, EvalResult, DependencySet
from formspec.fel.types import FelNumber, FelNull, FelString, is_null


def test_evaluate_simple_arithmetic():
    result = evaluate("1 + 2")
    assert isinstance(result, EvalResult)
    assert isinstance(result.value, FelNumber)
    assert float(result.value) == 3.0


def test_evaluate_with_data():
    result = evaluate("$x + $y", {"x": 10, "y": 20})
    assert isinstance(result.value, FelNumber)
    assert float(result.value) == 30.0


def test_evaluate_null_field():
    result = evaluate("$missing", {})
    assert is_null(result.value)


def test_evaluate_string():
    result = evaluate("'hello'")
    assert isinstance(result.value, FelString)
    assert str(result.value) == "hello"


def test_extract_dependencies_fields():
    deps = extract_dependencies("$x + $y")
    assert isinstance(deps, DependencySet)
    assert "x" in deps.fields
    assert "y" in deps.fields


def test_extract_dependencies_variables():
    deps = extract_dependencies("@myVar")
    assert "myVar" in deps.context_refs
```

- [ ] **Step 6: Run all bridge tests**

```bash
python3 -m pytest tests/unit/test_rust_bridge.py -v
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/formspec/_rust.py tests/unit/test_rust_bridge.py
git commit -m "feat(python): create _rust.py bridge with FEL functions and result types

Single bridge module wrapping all formspec_rust PyO3 calls.
Includes msgspec.Struct result types and FEL value hydration.
FEL parse, evaluate, extract_dependencies, and builtin_function_catalog."
```

---

## Task 3: Add remaining `_rust.py` functions (lint, eval, mapping, registry, changelog)

**Files:**
- Modify: `src/formspec/_rust.py`
- Test: `tests/unit/test_rust_bridge.py`

- [ ] **Step 1: Write failing tests for lint and detect_document_type**

Append to `tests/unit/test_rust_bridge.py`:

```python
from formspec._rust import (
    lint,
    detect_document_type,
    LintDiagnostic,
)


def test_detect_document_type_definition():
    doc = {"url": "test://def", "version": "1.0.0", "items": []}
    assert detect_document_type(doc) == "definition"


def test_detect_document_type_unknown():
    assert detect_document_type({"random": True}) is None


def test_lint_valid_definition():
    doc = {
        "url": "test://example",
        "version": "1.0.0",
        "items": [{"type": "field", "key": "name", "dataType": "string"}],
    }
    results = lint(doc)
    assert isinstance(results, list)
    assert all(isinstance(d, LintDiagnostic) for d in results)


def test_lint_returns_diagnostics_for_bad_doc():
    doc = {"url": "test://bad"}  # missing required fields
    results = lint(doc)
    assert len(results) > 0
    assert any(d.severity == "error" for d in results)
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/unit/test_rust_bridge.py::test_detect_document_type_definition -v
```

Expected: `ImportError` — functions don't exist yet.

- [ ] **Step 3: Add lint, detect_document_type, evaluate_definition, execute_mapping, registry, and changelog functions**

Append to `src/formspec/_rust.py`:

```python
# ── Linting ──────────────────────────────────────────────────────


def detect_document_type(document: dict) -> str | None:
    """Detect document type from a Formspec document dict."""
    return formspec_rust.detect_type(document)


def lint(
    document: dict,
    *,
    schema_only: bool = False,  # TODO: not yet passed to Rust
    no_fel: bool = False,  # TODO: not yet passed to Rust
    component_definition: dict | None = None,  # TODO: not yet passed to Rust
    registry_documents: list[dict] | None = None,  # TODO: not yet passed to Rust
) -> list[LintDiagnostic]:
    """Run the Rust linter on a Formspec document.

    Note: schema_only, no_fel, component_definition, and registry_documents are
    accepted for API compatibility but currently ignored — the Rust lint_document
    function does not yet accept these parameters.
    """
    raw = formspec_rust.lint_document(document)
    diagnostics = raw.get("diagnostics", [])
    return [
        LintDiagnostic(
            code=d.get("code", ""),
            severity=d.get("severity", "error"),
            path=d.get("path", ""),
            message=d.get("message", ""),
        )
        for d in diagnostics
    ]


# ── Evaluation ───────────────────────────────────────────────────


def evaluate_definition(definition: dict, data: dict) -> ProcessingResult:
    """Evaluate a definition against data using the Rust batch evaluator."""
    raw = formspec_rust.evaluate_def(definition, data)
    validations = raw.get("validations", [])
    is_valid = not any(v.get("severity") == "error" for v in validations)
    return ProcessingResult(
        valid=is_valid,
        results=validations,
        data=raw.get("values", {}),
        variables=raw.get("variables", {}),
        non_relevant=raw.get("non_relevant", []),
    )


# ── Mapping ──────────────────────────────────────────────────────


def execute_mapping(
    mapping_doc: dict,
    source: dict,
    direction: str = "forward",
) -> MappingResult:
    """Execute a mapping document against source data."""
    raw = formspec_rust.execute_mapping_doc(mapping_doc, source, direction)
    diags = [
        MappingDiagnostic(
            rule_index=d.get("rule_index", 0),
            source_path=d.get("source_path"),
            target_path=d.get("target_path", ""),
            message=d.get("message", ""),
        )
        for d in raw.get("diagnostics", [])
    ]
    return MappingResult(
        direction=raw.get("direction", direction),
        output=raw.get("output", {}),
        rules_applied=raw.get("rules_applied", 0),
        diagnostics=diags,
    )


# ── Registry ─────────────────────────────────────────────────────


def parse_registry(registry: dict) -> RegistryInfo:
    """Parse a registry document and return summary info."""
    raw = formspec_rust.parse_registry(registry)
    return RegistryInfo(
        publisher=raw.get("publisher", {}),
        published=raw.get("published", ""),
        entry_count=raw.get("entry_count", 0),
        validation_issues=raw.get("validation_issues", []),
    )


def find_registry_entry(
    registry: dict,
    name: str,
    version: str | None = None,
) -> dict | None:
    """Find a registry entry by name and optional version constraint."""
    return formspec_rust.find_registry_entry(registry, name, version or "")


def validate_lifecycle_transition(from_status: str, to_status: str) -> bool:
    """Check if a lifecycle status transition is valid."""
    return formspec_rust.validate_lifecycle(from_status, to_status)


def well_known_registry_url(base_url: str) -> str:
    """Return the well-known URL for a registry base URL."""
    return formspec_rust.well_known_url(base_url)


# ── Changelog ────────────────────────────────────────────────────


def generate_changelog(
    old_def: dict,
    new_def: dict,
    definition_url: str = "",
) -> dict:
    """Generate a changelog between two definition versions."""
    return formspec_rust.generate_changelog(old_def, new_def, definition_url)


# ── Path utility (inlined from deleted validator.references) ─────


def canonical_item_path(path: str) -> str:
    """Normalize bind/target path ($.foo, /foo, foo.bar) to dot-separated key form."""
    trimmed = path.strip()
    if trimmed.startswith("$."):
        trimmed = trimmed[2:]
    if trimmed.startswith("/"):
        trimmed = trimmed[1:]
    trimmed = trimmed.replace("/", ".")
    return ".".join(segment for segment in trimmed.split(".") if segment)
```

- [ ] **Step 4: Write tests for the remaining functions**

Append to `tests/unit/test_rust_bridge.py`:

```python
from formspec._rust import (
    evaluate_definition,
    ProcessingResult,
    execute_mapping,
    MappingResult,
    parse_registry,
    RegistryInfo,
    find_registry_entry,
    validate_lifecycle_transition,
    well_known_registry_url,
    generate_changelog,
    canonical_item_path,
)


def test_evaluate_definition_simple():
    definition = {
        "url": "test://eval",
        "version": "1.0.0",
        "items": [{"type": "field", "key": "name", "dataType": "string"}],
    }
    result = evaluate_definition(definition, {"name": "Alice"})
    assert isinstance(result, ProcessingResult)
    assert isinstance(result.valid, bool)
    assert isinstance(result.data, dict)


def test_execute_mapping_forward():
    mapping_doc = {
        "rules": [
            {
                "sourcePath": "name",
                "targetPath": "fullName",
                "transform": "preserve",
            }
        ]
    }
    result = execute_mapping(mapping_doc, {"name": "Alice"}, "forward")
    assert isinstance(result, MappingResult)
    assert result.direction == "forward"
    assert result.output.get("fullName") == "Alice"


def test_validate_lifecycle_valid():
    assert validate_lifecycle_transition("draft", "stable") is True


def test_validate_lifecycle_invalid():
    assert validate_lifecycle_transition("retired", "draft") is False


def test_well_known_registry_url():
    url = well_known_registry_url("https://example.com")
    assert isinstance(url, str)
    assert "example.com" in url


def test_generate_changelog_returns_dict():
    old_def = {"url": "test://def", "version": "1.0.0", "items": []}
    new_def = {
        "url": "test://def",
        "version": "2.0.0",
        "items": [{"type": "field", "key": "name", "dataType": "string"}],
    }
    result = generate_changelog(old_def, new_def, "test://def")
    assert isinstance(result, dict)


def test_canonical_item_path():
    assert canonical_item_path("$.foo.bar") == "foo.bar"
    assert canonical_item_path("/foo/bar") == "foo.bar"
    assert canonical_item_path("foo.bar") == "foo.bar"
```

- [ ] **Step 5: Run all bridge tests**

```bash
python3 -m pytest tests/unit/test_rust_bridge.py -v
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/formspec/_rust.py tests/unit/test_rust_bridge.py
git commit -m "feat(python): add lint, eval, mapping, registry, changelog to _rust.py

Complete the bridge module with all Rust-backed functions.
Includes canonical_item_path utility inlined from deleted validator."
```

---

## Task 4: Update `__init__.py` files and install `msgspec`

**Files:**
- Modify: `src/formspec/__init__.py`
- Modify: `src/formspec/fel/__init__.py`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update `src/formspec/__init__.py`**

Replace the entire file:

```python
"""Formspec Python package — Rust-backed form processing, linting, mapping, and tooling."""

from ._rust import (
    # Result types
    ProcessingResult,
    MappingResult,
    MappingDiagnostic,
    LintDiagnostic,
    RegistryInfo,
    # Evaluation
    evaluate_definition,
    # Linting
    lint,
    detect_document_type,
    # Mapping
    execute_mapping,
    # Registry
    parse_registry,
    find_registry_entry,
    validate_lifecycle_transition,
    well_known_registry_url,
    # Changelog
    generate_changelog,
    # Path utility
    canonical_item_path,
)
```

- [ ] **Step 2: Update `src/formspec/fel/__init__.py`**

Replace the entire file:

```python
"""Public FEL runtime API for Python — Rust-backed via formspec_rust."""

from __future__ import annotations

from formspec._rust import (
    BUILTIN_NAMES,
    DependencySet,
    EvalResult,
    ParsedExpression,
    builtin_function_catalog,
    evaluate,
    extract_dependencies,
    parse,
)
from .errors import (
    Diagnostic,
    FelDefinitionError,
    FelError,
    FelEvaluationError,
    FelSyntaxError,
    Severity,
    SourcePos,
)
from .keywords import RESERVED_WORDS
from .types import (
    FelArray,
    FelBoolean,
    FelDate,
    FelFalse,
    FelMoney,
    FelNull,
    FelNumber,
    FelObject,
    FelString,
    FelTrue,
    FelValue,
    fel_bool,
    from_python,
    is_null,
    to_python,
    typeof,
)

__version__ = "1.0.0"

__all__ = [
    "BUILTIN_NAMES",
    "DependencySet",
    "Diagnostic",
    "EvalResult",
    "FelArray",
    "FelBoolean",
    "FelDate",
    "FelDefinitionError",
    "FelError",
    "FelEvaluationError",
    "FelFalse",
    "FelMoney",
    "FelNull",
    "FelNumber",
    "FelObject",
    "FelString",
    "FelSyntaxError",
    "FelTrue",
    "FelValue",
    "ParsedExpression",
    "RESERVED_WORDS",
    "Severity",
    "SourcePos",
    "builtin_function_catalog",
    "evaluate",
    "extract_dependencies",
    "fel_bool",
    "from_python",
    "is_null",
    "parse",
    "to_python",
    "typeof",
]
```

Note: `FelRuntime` is listed in `__all__` for backwards compat but won't resolve — remove it if no consumers import it. Check during test pass.

- [ ] **Step 3: Add `msgspec` to CI**

In `.github/workflows/ci.yml`, update the pip install line:

```yaml
      - run: pip install maturin pytest hypothesis "jsonschema[format]" msgspec
```

- [ ] **Step 4: Verify FEL tests still pass through the new re-exports**

```bash
python3 -m pytest tests/unit/test_fel_api.py tests/unit/test_fel_evaluator.py tests/unit/test_fel_functions.py -v 2>&1 | tail -20
```

Expected: all pass — these import from `formspec.fel` which now re-exports from `_rust`.

- [ ] **Step 5: Commit**

```bash
git add src/formspec/__init__.py src/formspec/fel/__init__.py .github/workflows/ci.yml
git commit -m "feat(python): rewire __init__.py files to re-export from _rust

Package entry points now import from _rust instead of deleted modules.
Add msgspec to CI dependencies."
```

---

## Task 5: Rewrite `validate.py`

**Files:**
- Rewrite: `src/formspec/validate.py`

`validate.py` is pure Python orchestration. It needs import updates and class→function call rewiring. The structure (discovery, 10 passes, terminal output) stays identical.

- [ ] **Step 1: Update imports at top of validate.py**

Replace lines 25-34:

```python
from formspec._rust import (
    evaluate_definition,
    execute_mapping,
    generate_changelog,
    lint,
    detect_document_type,
    parse_registry,
    find_registry_entry,
    extract_dependencies,
    canonical_item_path,
    LintDiagnostic,
    ProcessingResult,
    RegistryInfo,
)
from formspec.fel.errors import FelSyntaxError
```

- [ ] **Step 2: Update `discover_artifacts` to use `detect_document_type`**

Replace line 147 (`sv = SchemaValidator()`) — remove it. Replace line 165 (`doc_type = sv.detect_document_type(doc)`) with:

```python
doc_type = detect_document_type(doc)
```

- [ ] **Step 3: Update `_pass_response_schema` to use `lint`**

Replace the body of `_pass_response_schema` (lines 351-369). `SchemaValidator().validate(doc)` becomes `lint(doc)`:

```python
def _pass_response_schema(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.responses:
        return PassResult(title="Response fixture schema validation", empty=True)

    pr = PassResult(title="Response fixture schema validation")
    for resp in arts.responses:
        diags = lint(resp.doc)
        errors = [d for d in diags if d.severity == "error"]
        warnings = [d for d in diags if d.severity == "warning"]
        pr.items.append(
            PassItemResult(
                label=resp.path.name,
                error_count=len(errors),
                warning_count=len(warnings),
                diagnostics=diags,
            )
        )
    return pr
```

- [ ] **Step 4: Update `_pass_runtime_evaluation`**

Replace lines 372-441. `DefinitionEvaluator(definition).process(data)` becomes `evaluate_definition(definition, data)`. Remove `create_form_processor`, `Registry`, and the registries construction:

```python
def _pass_runtime_evaluation(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.responses or not arts.definitions:
        return PassResult(title="Runtime evaluation", empty=True)

    pr = PassResult(title="Runtime evaluation")
    for resp in arts.responses:
        identity = (resp.definition_url, resp.definition_version)
        da = arts.definition_versions.get(identity)
        if not da:
            message = (
                "No definition found for pinned response "
                f"{resp.definition_url}@{resp.definition_version}"
            )
            available_versions = sorted(
                version
                for (url, version) in arts.definition_versions
                if url == resp.definition_url
            )
            if available_versions:
                message += f"; available versions: {', '.join(available_versions)}"

            pr.items.append(
                PassItemResult(
                    label=resp.path.name,
                    error_count=1,
                    runtime_results=[
                        {"severity": "error", "message": message, "path": ""}
                    ],
                )
            )
            continue

        data = resp.doc.get("data", {})
        result = evaluate_definition(da.doc, data)
        errors = [r for r in result.results if r.get("severity") == "error"]
        warnings = [r for r in result.results if r.get("severity") == "warning"]

        mode = "submit" if resp.status == "completed" else "continuous"
        if mode == "submit":
            pr.items.append(
                PassItemResult(
                    label=f"{resp.path.name} ({mode})",
                    error_count=len(errors),
                    warning_count=len(warnings),
                    runtime_results=result.results,
                )
            )
        else:
            summary = f"valid={result.valid}, {len(errors)} error(s), {len(warnings)} warning(s) (expected for in-progress)"
            pr.items.append(
                PassItemResult(
                    label=f"{resp.path.name} ({mode})",
                    runtime_results=[
                        {"severity": "info", "message": summary, "path": ""}
                    ],
                )
            )
    return pr
```

- [ ] **Step 5: Update `_pass_mapping_forward`**

Replace `create_mapping_engine(mapping.doc)` + `engine.forward(data)` with `execute_mapping(mapping.doc, data, "forward")`:

```python
def _pass_mapping_forward(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.mappings:
        return PassResult(title="Mapping engine (forward transform)", empty=True)

    pr = PassResult(title="Mapping engine (forward transform)")

    completed: dict[str, list[ResponseArtifact]] = {}
    for resp in arts.responses:
        if resp.status == "completed":
            completed.setdefault(resp.definition_url, []).append(resp)

    for mapping in arts.mappings:
        matching_responses = completed.get(mapping.definition_ref, [])
        if not matching_responses:
            pr.items.append(
                PassItemResult(
                    label=f"{mapping.path.name} (no matching completed responses)"
                )
            )
            continue

        for resp in matching_responses:
            data = resp.doc.get("data", {})
            try:
                result = execute_mapping(mapping.doc, data, "forward")
                keys = len(result.output)
                pr.items.append(
                    PassItemResult(
                        label=f"forward({resp.path.name}) via {mapping.path.name}",
                        runtime_results=[
                            {
                                "severity": "info",
                                "message": f"{keys} top-level keys in output",
                                "path": "",
                            }
                        ],
                    )
                )
            except Exception as e:
                pr.items.append(
                    PassItemResult(
                        label=f"forward({resp.path.name}) via {mapping.path.name}",
                        error_count=1,
                        runtime_results=[
                            {"severity": "error", "message": str(e), "path": ""}
                        ],
                    )
                )
    return pr
```

- [ ] **Step 6: Update `_pass_changelog_generation`**

Replace `SchemaValidator()` usage with `lint()`. `generate_changelog` import already updated:

```python
def _pass_changelog_generation(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.changelog_pairs:
        return PassResult(title="Changelog generation", empty=True)

    pr = PassResult(title="Changelog generation")

    for parent, child in arts.changelog_pairs:
        pair_label = f"{parent.path.name} → {child.path.name}"
        try:
            changelog = generate_changelog(parent.doc, child.doc, child.url)
        except Exception as e:
            pr.items.append(
                PassItemResult(
                    label=f"generate_changelog({pair_label})",
                    error_count=1,
                    runtime_results=[
                        {"severity": "error", "message": str(e), "path": ""}
                    ],
                )
            )
            continue

        changes = changelog.get("changes", [])
        impact = changelog.get("semver_impact", "unknown")
        pr.items.append(
            PassItemResult(
                label=f"generate_changelog({pair_label})",
                runtime_results=[
                    {
                        "severity": "info",
                        "message": f"{len(changes)} change(s), semver_impact={impact}",
                        "path": "",
                    }
                ],
            )
        )

        # Validate the generated changelog against schema via lint
        diags = lint(changelog)
        errors = [d for d in diags if d.severity == "error"]
        warnings = [d for d in diags if d.severity == "warning"]
        pr.items.append(
            PassItemResult(
                label="generated changelog schema",
                error_count=len(errors),
                warning_count=len(warnings),
                diagnostics=diags,
            )
        )
    return pr
```

- [ ] **Step 7: Update `_pass_registry`**

Replace `Registry(doc)` with `parse_registry(doc)` and `registry.find_one(name)` with `find_registry_entry(doc, name)`:

```python
def _pass_registry(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.registries:
        return PassResult(title="Extension registry", empty=True)

    all_defs = {**arts.definitions, **arts.fragments}
    pr = PassResult(title="Extension registry")

    for reg_file in arts.registries:
        try:
            info = parse_registry(reg_file.doc)
        except Exception as e:
            pr.items.append(
                PassItemResult(
                    label=f"Registry parse ({reg_file.path.name})",
                    error_count=1,
                    runtime_results=[
                        {"severity": "error", "message": str(e), "path": ""}
                    ],
                )
            )
            continue

        if info.validation_issues:
            pr.items.append(
                PassItemResult(
                    label=f"registry.validate() ({reg_file.path.name})",
                    error_count=len(info.validation_issues),
                    runtime_results=[
                        {"severity": "error", "message": issue, "path": ""}
                        for issue in info.validation_issues
                    ],
                )
            )
        else:
            pr.items.append(
                PassItemResult(
                    label=f"registry.validate() ({reg_file.path.name})",
                    runtime_results=[
                        {
                            "severity": "info",
                            "message": "0 consistency issues",
                            "path": "",
                        }
                    ],
                )
            )

    for da in all_defs.values():
        ext_names: set[str] = set()
        for item in _walk_items(da.doc.get("items", [])):
            for ext_key in item.get("extensions", {}).keys():
                ext_names.add(ext_key)

        if not ext_names:
            continue

        for ext_name in sorted(ext_names):
            found = False
            for reg_file in arts.registries:
                entry = find_registry_entry(reg_file.doc, ext_name)
                if entry:
                    version = entry.get("version", "?")
                    status = entry.get("status", "?")
                    pr.items.append(
                        PassItemResult(
                            label=f"{da.path.name}: {ext_name}",
                            runtime_results=[
                                {
                                    "severity": "info",
                                    "message": f"v{version} ({status})",
                                    "path": "",
                                }
                            ],
                        )
                    )
                    found = True
                    break
            if not found:
                pr.items.append(
                    PassItemResult(
                        label=f"{da.path.name}: {ext_name}",
                        error_count=1,
                        runtime_results=[
                            {
                                "severity": "error",
                                "message": "not found in registry",
                                "path": "",
                            }
                        ],
                    )
                )
    return pr
```

- [ ] **Step 8: Update `_normalize_dep_path` to use local `canonical_item_path`**

The import at line 33 (`from formspec.validator.references import canonical_item_path`) was already updated in step 1 to import from `formspec._rust`.

- [ ] **Step 9: Verify validate.py still works with existing examples**

```bash
python3 -m formspec.validate examples/grant-report/ --registry registries/formspec-common.registry.json 2>&1 | head -30
```

Expected: colored output with pass results — no ImportErrors.

- [ ] **Step 10: Commit**

```bash
git add src/formspec/validate.py
git commit -m "refactor(validate): rewire CLI to use _rust bridge functions

Replace all class-based calls (DefinitionEvaluator, FormspecLinter,
SchemaValidator, MappingEngine, Registry) with _rust function calls."
```

---

## Task 6: Delete old files

**Files:**
- Delete: 24 files listed in File Map

- [ ] **Step 1: Delete all old files**

Use `--ignore-unmatch` in case some files were already deleted in prior commits:

```bash
git rm --ignore-unmatch src/formspec/evaluator.py \
  src/formspec/protocols.py \
  src/formspec/factories.py \
  src/formspec/registry.py \
  src/formspec/changelog.py \
  src/formspec/mapping/__init__.py \
  src/formspec/mapping/engine.py \
  src/formspec/mapping/transforms.py \
  src/formspec/validator/__init__.py \
  src/formspec/validator/__main__.py \
  src/formspec/validator/linter.py \
  src/formspec/validator/schema.py \
  src/formspec/validator/tree.py \
  src/formspec/validator/references.py \
  src/formspec/validator/expressions.py \
  src/formspec/validator/dependencies.py \
  src/formspec/validator/component.py \
  src/formspec/validator/component_matrix.py \
  src/formspec/validator/diagnostic.py \
  src/formspec/validator/policy.py \
  src/formspec/validator/theme.py \
  src/formspec/fel/runtime.py \
  src/formspec/fel/metadata.py \
  src/formspec/fel/extensions.py
```

- [ ] **Step 2: Remove empty directories**

```bash
rmdir src/formspec/mapping src/formspec/validator 2>/dev/null; true
```

- [ ] **Step 3: Verify package still imports cleanly**

```bash
python3 -c "import formspec; from formspec.fel import evaluate, parse; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(python): delete 24 files replaced by _rust.py bridge

All evaluation, linting, mapping, registry, and changelog logic
now comes from Rust via formspec_rust. Only FEL types, adapters,
and validate.py orchestration remain as Python code."
```

---

## Task 7: Update test imports and adapt tests

**Files:**
- Modify: 15+ test files

This is the largest task by file count but each change is mechanical: update imports and change class construction to function calls.

### Import mapping reference

| Old import | New import |
|---|---|
| `from formspec.evaluator import DefinitionEvaluator` | `from formspec._rust import evaluate_definition` |
| `from formspec.evaluator import DefinitionEvaluator, ProcessingResult` | `from formspec._rust import evaluate_definition, ProcessingResult` |
| `from formspec.validator.linter import FormspecLinter` | `from formspec._rust import lint` |
| `from formspec.validator.policy import LintPolicy` | remove — no longer needed |
| `from formspec.validator.schema import SchemaValidator` | `from formspec._rust import detect_document_type, lint` |
| `from formspec.validator import LintDiagnostic, lint` | `from formspec._rust import LintDiagnostic, lint` |
| `from formspec.validator.references import check_references` | rewrite to use `lint()` |
| `from formspec.validator.tree import build_item_index` | rewrite to use `lint()` |
| `from formspec.validator.component import lint_component_semantics` | rewrite to use `lint()` |
| `from formspec.validator.theme import lint_theme_semantics` | rewrite to use `lint()` |
| `from formspec.validator.dependencies import analyze_dependencies` | rewrite to use `lint()` |
| `from formspec.validator.expressions import compile_expressions` | rewrite to use `lint()` |
| `from formspec.mapping import MappingEngine` | `from formspec._rust import execute_mapping` |
| `from formspec.registry import Registry, ...` | `from formspec._rust import parse_registry, find_registry_entry, ...` |
| `from formspec.changelog import generate_changelog` | `from formspec._rust import generate_changelog` |
| `from formspec.factories import create_form_processor, create_mapping_engine` | remove — use functions directly |
| `from formspec.validate import discover_artifacts, validate_all` | unchanged — validate.py still exists |

### Call pattern mapping reference

| Old pattern | New pattern |
|---|---|
| `DefinitionEvaluator(definition).process(data)` | `evaluate_definition(definition, data)` |
| `DefinitionEvaluator(definition, registries=registries).process(data)` | `evaluate_definition(definition, data)` (registries not supported — linting covers extension validation) |
| `DefinitionEvaluator(definition).validate(data)` | `evaluate_definition(definition, data).results` |
| `DefinitionEvaluator(definition).evaluate_screener(answers)` | Screener not in Rust `evaluate_def` — mark test as skipped or delete |
| `DefinitionEvaluator(definition).evaluate_variables(data)` | `evaluate_definition(definition, data).variables` |
| `FormspecLinter().lint(doc)` | `lint(doc)` |
| `FormspecLinter().lint(doc, registry_documents=regs)` | `lint(doc, registry_documents=regs)` |
| `LintPolicy(mode="strict")` | remove — Rust lint handles policy internally |
| `SchemaValidator().detect_document_type(doc)` | `detect_document_type(doc)` |
| `SchemaValidator().validate(doc)` | `lint(doc)` |
| `MappingEngine(mapping_doc).forward(data)` | `execute_mapping(mapping_doc, data, "forward").output` |
| `MappingEngine(mapping_doc).reverse(data)` | `execute_mapping(mapping_doc, data, "reverse").output` |
| `Registry(doc)` / `registry.validate()` | `parse_registry(doc).validation_issues` |
| `Registry(doc)` / `registry.find_one(name)` | `find_registry_entry(doc, name)` |

- [ ] **Step 1: Update test files one at a time**

For each test file that imports deleted modules, update imports and call patterns per the mapping tables above. Work through them in this order:

1. `tests/unit/test_fel_api.py` — may need minor adjustments for `DependencySet` field names
2. `tests/unit/test_fel_evaluator.py` — same
3. `tests/unit/test_fel_functions.py` — likely unchanged (imports from `formspec.fel`)
4. `tests/unit/test_fel_builtin_availability_signaling.py` — likely unchanged
5. `tests/unit/test_definition_evaluator.py` — `DefinitionEvaluator` → `evaluate_definition`
6. `tests/unit/test_screener_routing.py` — may need skip/delete if screener isn't in Rust eval
7. `tests/unit/test_extension_preservation.py` — `DefinitionEvaluator` → `evaluate_definition`
8. `tests/unit/test_mapping_engine.py` — `MappingEngine` → `execute_mapping`
9. `tests/unit/test_registry.py` — `Registry` → `parse_registry`, `find_registry_entry`
10. `tests/unit/test_changelog.py` — `generate_changelog` import path change
11. `tests/unit/test_validator_linter.py` — `FormspecLinter` → `lint`
12. `tests/unit/test_validator_schema.py` — `SchemaValidator` → `detect_document_type` + `lint`
13. `tests/unit/test_validator_references.py` — rewrite to use `lint()` assertions
14. `tests/unit/test_validator_expressions.py` — rewrite to use `lint()` assertions
15. `tests/unit/test_validator_component_semantics.py` — rewrite to use `lint()` assertions
16. `tests/unit/test_validator_theme_semantics.py` — rewrite to use `lint()` assertions
17. `tests/unit/test_adapters.py` — likely unchanged (adapters are kept)
18. `tests/unit/test_response_pinning_version_substitution.py` — `validate.py` imports unchanged
19. `tests/conformance/spec/test_fel_spec_examples.py` — imports from `formspec.fel` (unchanged)
20. `tests/conformance/spec/test_cross_spec_contracts.py` — check imports
21. `tests/conformance/fuzzing/test_fel_property_based.py` — imports from `formspec.fel` (unchanged)
22. `tests/conformance/fuzzing/test_cross_runtime_fuzzing.py` — `DefinitionEvaluator` → `evaluate_definition`
23. `tests/conformance/registry/test_registry_entry_constraints.py` — `Registry` + `DefinitionEvaluator`
24. `tests/conformance/roundtrip/test_roundtrip_contracts.py` — `MappingEngine` → `execute_mapping`
25. `tests/integration/test_definition_schema_acceptance.py` — `DefinitionEvaluator` + `SchemaValidator`
26. `tests/integration/cli/test_validator_cli.py` — `from formspec.validator.__main__` is deleted
27. `tests/integration/fixtures/test_core_fixtures.py` — `MappingEngine`, `Registry`, `SchemaValidator`
28. `tests/e2e/headless/test_grant_app_processing.py` — `DefinitionEvaluator`, `Registry`
29. `tests/e2e/headless/test_edge_case_payloads.py` — `DefinitionEvaluator`, `SchemaValidator`
30. `tests/e2e/kitchen_sink/conformance_runner.py` — multiple old imports

After updating each file, run its tests to verify:

```bash
python3 -m pytest tests/unit/test_<name>.py -v 2>&1 | tail -5
```

- [ ] **Step 2: Handle `validator.__main__` CLI test**

`tests/integration/cli/test_validator_cli.py` imports `from formspec.validator.__main__ import main`. This module is deleted. The CLI entry point needs to move. Options:

a) Move the CLI to `formspec.validate` (it already has a `main()`) and update the test import.
b) Delete the test if it's redundant with `validate.py`'s own CLI.

Check what the test does and decide. If the test exercises `python -m formspec.validator`, that CLI path no longer exists. Update it to exercise `python -m formspec.validate` instead.

- [ ] **Step 3: Run the full test suite**

```bash
python3 -m pytest tests/ --ignore=tests/e2e -v 2>&1 | tail -30
```

Expected: all tests pass or are explicitly skipped (e.g., screener tests if not supported).

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test(python): update all test imports for _rust bridge

Replace class-based imports with function imports.
Rewrite individual validator pass tests as lint() integration tests."
```

---

## Task 8: Final verification and cleanup

**Files:**
- Possibly modify: `src/formspec/_rust.py`, various test files

- [ ] **Step 1: Run conformance tests**

```bash
python3 -m pytest tests/conformance/ -v 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 2: Run integration tests**

```bash
python3 -m pytest tests/integration/ -v 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Run unit tests**

```bash
python3 -m pytest tests/unit/ -v 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 4: Run the validate CLI on the example project**

```bash
python3 -m formspec.validate examples/grant-report/ --registry registries/formspec-common.registry.json
```

Expected: colored output with pass results, exit code 0.

- [ ] **Step 5: Verify Rust tests still pass**

```bash
cargo test -p formspec-py --no-default-features 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Clean up any unused imports in `_rust.py`**

Review `_rust.py` for any imports that are no longer needed after test adjustments.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "test(python): verify full suite passes after Rust bridge rewrite

All conformance, integration, and unit tests pass through the
new _rust.py bridge. Python package is now a thin wrapper over
formspec_rust with zero duplicated logic."
```
