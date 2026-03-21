# Python Package Rewrite — Rust-Backed Thin Wrappers

**Date:** 2026-03-20
**Status:** Implemented — spec served its purpose. See errata in companion plan.

## Goal

Replace the current Python package (`src/formspec/`) with a minimal wrapper layer over the existing Rust/PyO3 exports. The Rust crates already implement everything the Python package does — evaluator, linter, mapping, registry, changelog — and expose it through `formspec_rust` (PyO3). The Python package is a 36-file duplicate. This rewrite deletes ~23 files and replaces them with a single `_rust.py` bridge module.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Classes vs. functions | Functions only | `DefinitionEvaluator`, `MappingEngine`, `FormspecLinter`, `SchemaValidator`, `Registry` are all stateful wrappers around stateless Rust calls. The classes hold a dict and pass it through — no value add. |
| Linter granularity | Monolithic `lint()` only | Individual passes (`compile_expressions`, `check_references`, etc.) are implementation details. Tests should assert on diagnostics, not which pass produced them. Rust exposes only the monolithic `lint_document()`. |
| `SchemaValidator` | Dropped — replaced by `detect_document_type()` + `lint(..., schema_only=True)` | Two functions are clearer than a class that wraps them. |
| FEL type system | Kept (`types.py`, `errors.py`, `keywords.py`) | Types carry semantic meaning (`FelMoney` vs `dict`). Test suite is built around them. |
| Adapters | Kept as-is (pure Python) | No Rust equivalent exists. JSON/CSV/XML adapters are simple, stable, rarely touched. |
| Serialization format | Direct PyO3 via `pythonize` crate | No serialization overhead on the Python side. `pythonize::depythonize` walks the Python object tree and builds `serde_json::Value` directly — one pass, no intermediate string. |
| Result types | `msgspec.Struct` (frozen) | Fast, typed, attribute-accessible. `msgspec.convert()` to hydrate from Rust's returned Python dicts. |
| Protocols / factories | Deleted | Protocols described classes that no longer exist. Factories created classes that no longer exist. |

## Package Structure

### New

```
src/formspec/
  __init__.py          # public API re-exports
  _rust.py             # all formspec_rust wrappers (~15 functions)
  fel/
    __init__.py         # re-exports + convenience functions (parse, evaluate, extract_dependencies)
    types.py            # FEL value types (unchanged)
    errors.py           # FEL error/diagnostic classes (unchanged)
    keywords.py         # RESERVED_WORDS (unchanged)
  adapters/             # unchanged (pure Python, no Rust equivalent)
    __init__.py
    base.py
    json_adapter.py
    csv_adapter.py
    xml_adapter.py
  validate.py           # CLI orchestrator, rewired to _rust functions
```

### Deleted (23 files)

- `evaluator.py` (1298 lines) — replaced by `_rust.evaluate_definition()`
- `protocols.py` — protocols described classes that no longer exist
- `factories.py` — factories created classes that no longer exist
- `registry.py` — replaced by `_rust.parse_registry()`, `find_registry_entry()`, etc.
- `changelog.py` — replaced by `_rust.generate_changelog()`
- `mapping/__init__.py`, `mapping/engine.py`, `mapping/transforms.py` — replaced by `_rust.execute_mapping()`
- `validator/__init__.py`, `validator/__main__.py`, `validator/linter.py`, `validator/schema.py`, `validator/tree.py`, `validator/references.py`, `validator/expressions.py`, `validator/dependencies.py`, `validator/component.py`, `validator/component_matrix.py`, `validator/diagnostic.py`, `validator/policy.py`, `validator/theme.py` — replaced by `_rust.lint()`
- `fel/runtime.py` — absorbed into `_rust.py`
- `fel/metadata.py` — absorbed into `_rust.py`
- `fel/extensions.py` — tombstone that always raises `NotImplementedError`

### Kept As-Is (7 files)

- `fel/types.py` — FEL value types
- `fel/errors.py` — FEL error classes
- `fel/keywords.py` — `RESERVED_WORDS` frozenset
- `adapters/__init__.py`, `adapters/base.py`, `adapters/json_adapter.py`, `adapters/csv_adapter.py`, `adapters/xml_adapter.py` — pure Python serialization adapters

## `_rust.py` — Public API

All functions are thin wrappers over `formspec_rust`. Each accepts Python-native types, passes them directly to PyO3 (no serialization), and wraps the result in a typed `msgspec.Struct`.

### FEL

```python
def parse(source: str) -> ParsedExpression
def evaluate(source: str, data: dict | None = None, *,
             instances: dict[str, dict] | None = None,
             mip_states: dict[str, object] | None = None,
             extensions: dict[str, object] | None = None,
             variables: dict[str, FelValue] | None = None) -> EvalResult
def extract_dependencies(source: str) -> DependencySet
def builtin_function_catalog() -> list[dict]
```

### Evaluation

```python
def evaluate_definition(definition: dict, data: dict) -> ProcessingResult
```

### Linting

```python
def lint(document: dict, *,
         schema_only: bool = False,
         no_fel: bool = False,
         component_definition: dict | None = None,
         registry_documents: list[dict] | None = None) -> list[LintDiagnostic]
def detect_document_type(document: dict) -> str | None
```

### Mapping

```python
def execute_mapping(mapping_doc: dict, source: dict,
                    direction: str = "forward") -> MappingResult
```

### Registry

```python
def parse_registry(registry: dict) -> RegistryInfo
def find_registry_entry(registry: dict, name: str,
                        version: str | None = None) -> dict | None
def validate_lifecycle_transition(from_status: str, to_status: str) -> bool
def well_known_registry_url(base_url: str) -> str
```

### Changelog

```python
def generate_changelog(old_def: dict, new_def: dict,
                       definition_url: str = "") -> dict
```

## Result Types

All `msgspec.Struct, frozen=True`:

```python
class ProcessingResult(msgspec.Struct, frozen=True):
    valid: bool
    results: list[dict]         # validation results
    data: dict                  # processed values
    variables: dict             # evaluated variables
    non_relevant: list[str]     # NRB-excluded paths

class MappingResult(msgspec.Struct, frozen=True):
    direction: str
    output: dict
    rules_applied: int
    diagnostics: list[MappingDiagnostic]

class MappingDiagnostic(msgspec.Struct, frozen=True):
    rule_index: int
    source_path: str | None
    target_path: str
    message: str

class LintDiagnostic(msgspec.Struct, frozen=True):
    code: str
    severity: str               # "error", "warning", "info"
    path: str
    message: str

class RegistryInfo(msgspec.Struct, frozen=True):
    publisher: dict
    published: str
    entry_count: int
    validation_issues: list[str]

class ParsedExpression(msgspec.Struct, frozen=True):
    """Opaque syntax-validated handle. Used for pre-validation before evaluate().
    Contains only the source string — no AST or token data is exposed."""
    source: str

class EvalResult(msgspec.Struct, frozen=True):
    value: FelValue                    # wrapped in FEL types (from fel/types.py)
    diagnostics: list[Diagnostic]      # from fel/errors.py

class DependencySet(msgspec.Struct, frozen=True):
    fields: set[str]       # field references ($field, $group.field)
    variables: set[str]    # variable references (@var)
    instances: set[str]    # instance references (@instance('name'))
    functions: set[str]    # function calls (sum, if, coalesce, etc.)
```

### FEL value hydration

`EvalResult.value` requires custom deserialization — `msgspec.convert()` cannot automatically map Rust's Python-native return values to FEL types. The `_rust.py` module must include a `_deserialize_value()` helper (ported from the current `runtime.py`) that dispatches on Python type:

- `None` → `FelNull`
- `bool` → `FelTrue` / `FelFalse`
- `int`, `float` → `FelNumber(Decimal(...))`
- `str` → `FelString` (or `FelDate` if ISO date pattern)
- `list` → `FelArray`
- `dict` with `amount`+`currency` → `FelMoney`
- `dict` otherwise → `FelObject`

### Rust return shapes

The `_rust.py` module uses `msgspec.convert()` to hydrate result structs. The Rust functions return Python dicts with these shapes:

- **`evaluate_def`** → `{"values": dict, "validations": [{"path", "severity", "kind", "message"}], "non_relevant": [str], "variables": dict}`
- **`lint_document`** → `[{"code", "severity", "path", "message", "pass": int}]`
- **`execute_mapping_doc`** → `{"direction": str, "output": dict, "rules_applied": int, "diagnostics": [{"rule_index", "source_path", "target_path", "message"}]}`
- **`parse_registry`** → `{"publisher": {"name", "url", "contact"}, "published": str, "entry_count": int, "validation_issues": [str]}`

### `BUILTIN_NAMES`

Module-level constant in `_rust.py`, eagerly computed at import time:

```python
BUILTIN_NAMES: frozenset[str] = frozenset(
    entry["name"] for entry in builtin_function_catalog()
)
```

## Rust Changes (`formspec-py/src/lib.rs` only)

### Add dependency

```toml
# crates/formspec-py/Cargo.toml
[dependencies]
pythonize = "0.22"
```

### Change function signatures

Before:

```rust
#[pyfunction]
fn evaluate_def(py: Python, definition_json: &str, data_json: &str) -> PyResult<PyObject> {
    let definition: Value = serde_json::from_str(definition_json)?;
    let data: Value = serde_json::from_str(data_json)?;
    // ...
}
```

After:

```rust
#[pyfunction]
fn evaluate_def(py: Python, definition: &Bound<'_, PyAny>, data: &Bound<'_, PyAny>) -> PyResult<PyObject> {
    let definition: Value = pythonize::depythonize(definition)?;
    let data: Value = pythonize::depythonize(data)?;
    // ...
}
```

### Scope

- Only `crates/formspec-py/src/lib.rs` changes
- No changes to `formspec-wasm` or any core crate
- The WASM binding layer uses `serde-wasm-bindgen` independently

### Architecture

```
                    ┌─────────────────┐
                    │    fel-core      │
                    │  formspec-core   │
                    │  formspec-eval   │  ← all operate on serde_json::Value
                    │  formspec-lint   │
                    └────────┬────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
        ┌────────┴────────┐    ┌─────────┴─────────┐
        │  formspec-py    │    │  formspec-wasm     │
        │  (PyO3)         │    │  (wasm-bindgen)    │
        │                 │    │                    │
        │  PyAny → Value  │    │  JsValue → Value   │
        │  via pythonize  │    │  via serde-wasm-   │
        │                 │    │      bindgen        │
        └─────────────────┘    └────────────────────┘
```

## `fel/__init__.py` — Convenience Re-exports

The FEL subpackage keeps its current public API by re-exporting from `_rust` and the kept files:

```python
from formspec._rust import parse, evaluate, extract_dependencies, builtin_function_catalog
from .types import (FelArray, FelBoolean, FelDate, FelFalse, FelMoney,
                    FelNull, FelNumber, FelObject, FelString, FelTrue,
                    FelValue, fel_bool, from_python, is_null, to_python, typeof)
from .errors import (Diagnostic, FelDefinitionError, FelError,
                     FelEvaluationError, FelSyntaxError, Severity, SourcePos)
from .keywords import RESERVED_WORDS
from formspec._rust import ParsedExpression, EvalResult, DependencySet
from formspec._rust import BUILTIN_NAMES
```

## `validate.py` — CLI Orchestrator

Rewired to call `_rust` functions instead of the deleted Python classes:

- `DefinitionEvaluator(definition).process(data)` → `_rust.evaluate_definition(definition, data)`
- `FormspecLinter().lint(doc)` → `_rust.lint(doc)`
- `SchemaValidator().detect_type(doc)` → `_rust.detect_document_type(doc)`
- `MappingEngine(doc).forward(data)` → `_rust.execute_mapping(doc, data, "forward")`
- `Registry.from_documents(docs)` → `_rust.parse_registry(doc)` (per registry document)
- `generate_changelog(old, new)` → `_rust.generate_changelog(old, new)`

Same external interface: `discover_artifacts()`, `validate_all()`, `print_report()`.

## Test Strategy

### Existing tests — updated imports, same assertions

Tests that imported deleted classes get import path updates:

| Old import | New import |
|---|---|
| `from formspec.evaluator import DefinitionEvaluator, ProcessingResult` | `from formspec._rust import evaluate_definition, ProcessingResult` |
| `from formspec.validator.linter import FormspecLinter` | `from formspec._rust import lint` |
| `from formspec.validator.schema import SchemaValidator` | `from formspec._rust import detect_document_type, lint` |
| `from formspec.mapping import MappingEngine` | `from formspec._rust import execute_mapping` |
| `from formspec.registry import Registry, ...` | `from formspec._rust import parse_registry, find_registry_entry, ...` |
| `from formspec.changelog import generate_changelog` | `from formspec._rust import generate_changelog` |

Tests that import from `formspec.fel` are unchanged — same API, same types.

### Tests that exercised individual validator passes

These tested internal pass functions (`compile_expressions`, `check_references`, `build_item_index`, `lint_component_semantics`, `lint_theme_semantics`, `analyze_dependencies`). Since those functions are deleted, these tests become integration tests against `lint()` with targeted assertions on diagnostic codes.

### New tests for `_rust.py`

Boundary tests verifying:

- Round-trip fidelity: Python dict → Rust → Python struct matches expected values
- FEL value wrapping: Rust results correctly wrapped in `FelNumber`, `FelMoney`, etc.
- Error propagation: Rust errors surface as appropriate Python exceptions
- `msgspec.Struct` hydration: all result type fields populated correctly
- Edge cases: empty dicts, None values, deeply nested structures

## Dependencies

### New Python dependency

```
msgspec>=0.18
```

### New Rust dependency

```toml
# crates/formspec-py/Cargo.toml
pythonize = "0.22"
```

## Migration Checklist

1. Add `pythonize` to `formspec-py/Cargo.toml`
2. Change all `formspec-py` function signatures from `&str` to `&Bound<'_, PyAny>`
3. Rebuild PyO3: `cargo build -p formspec-py`
4. Create `src/formspec/_rust.py` with all wrapper functions
5. Update `src/formspec/fel/__init__.py` to re-export from `_rust`
6. Rewrite `src/formspec/validate.py` to use `_rust` functions
7. Delete 23 files
8. Update test imports
9. Run full test suite

## `detect_document_type()` Return Values

Returns one of the following strings, or `None` if the document type cannot be determined:

- `"definition"` — form definition
- `"response"` — form response / submission
- `"mapping"` — mapping document
- `"theme"` — theme document
- `"component"` — component document
- `"registry"` — extension registry
- `"changelog"` — changelog document
- `"validation_result"` — validation report
- `"fel_functions"` — FEL function definitions

## Rollback Policy

If Rust gaps are discovered during implementation (behavior the Python tests rely on that Rust doesn't implement), **patch the Rust crate first**. Do not resurrect deleted Python files. The Python package is a thin wrapper — if the wrapper doesn't work, the fix belongs in the Rust layer, not in a Python reimplementation.
