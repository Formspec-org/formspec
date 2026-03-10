from __future__ import annotations

import json
import signal
from pathlib import Path

from tests.unit.support.schema_fixtures import load_schema

from formspec.validator.schema import SchemaValidator

_EXAMPLES_DIR = Path(__file__).resolve().parents[2] / "examples"


def _with_timeout(seconds: int):
    """Decorator that fails a test if it exceeds *seconds* wall-clock time (Unix only)."""
    def decorator(fn):
        def wrapper(*args, **kwargs):
            def _alarm_handler(signum, frame):
                raise TimeoutError(
                    f"{fn.__name__} did not complete within {seconds}s"
                )
            old = signal.signal(signal.SIGALRM, _alarm_handler)
            signal.alarm(seconds)
            try:
                return fn(*args, **kwargs)
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old)
        wrapper.__name__ = fn.__name__
        wrapper.__doc__ = fn.__doc__
        return wrapper
    return decorator


def test_detect_definition_doc_type() -> None:
    validator = SchemaValidator()
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "f1", "type": "field", "label": "F1", "dataType": "string"}],
    }
    result = validator.validate(document)
    assert result.document_type == "definition"
    assert result.diagnostics == []


def test_schema_error_maps_to_diagnostic_path() -> None:
    validator = SchemaValidator()
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "f1", "type": "field", "label": "F1", "dataType": "blob"}],
    }

    result = validator.validate(document)

    assert result.document_type == "definition"
    assert result.diagnostics
    assert any(diag.path == "$.items[0].dataType" for diag in result.diagnostics)
    assert all(diag.category == "schema" for diag in result.diagnostics)


def test_unknown_document_type_is_reported() -> None:
    validator = SchemaValidator()
    result = validator.validate({"hello": "world"})

    assert result.document_type is None
    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "E100"


def test_detect_validation_result_doc_type() -> None:
    validator = SchemaValidator()
    document = {
        "path": "applicant.email",
        "severity": "error",
        "constraintKind": "required",
        "message": "This field is required.",
    }

    result = validator.validate(document)

    assert result.document_type == "validation_result"
    assert result.diagnostics == []


def test_detect_fel_functions_doc_type() -> None:
    validator = SchemaValidator()
    schema = load_schema("fel-functions.schema.json")
    document = {
        "version": schema["version"],
        "functions": [schema["functions"][0]],
    }

    result = validator.validate(document)

    assert result.document_type == "fel_functions"
    assert result.diagnostics == []


# ---------------------------------------------------------------------------
# Component document validation (Bug 1: oneOf + unevaluatedProperties hang)
# ---------------------------------------------------------------------------


@_with_timeout(10)
def test_component_validation_completes_on_large_tree() -> None:
    """Validates the grant-application component.json (115 nodes) in bounded time.

    Before the fix, jsonschema's oneOf + unevaluatedProperties caused
    exponential backtracking that hung indefinitely on large component trees.
    """
    doc = json.loads((_EXAMPLES_DIR / "grant-application" / "component.json").read_text())
    validator = SchemaValidator()
    result = validator.validate(doc)

    assert result.document_type == "component"
    assert result.diagnostics == [], (
        f"Expected no schema errors, got {len(result.diagnostics)}: "
        + "; ".join(d.message for d in result.diagnostics[:5])
    )


@_with_timeout(10)
def test_component_validation_detects_errors() -> None:
    """Component validation should still report genuine schema violations."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tree": {
            "component": "Stack",
            "children": [
                {"component": "TextInput", "bind": "name", "bogusProperty": 42},
            ],
        },
    }
    validator = SchemaValidator()
    result = validator.validate(doc)

    assert result.document_type == "component"
    assert any("bogusProperty" in d.message for d in result.diagnostics)


@_with_timeout(10)
def test_component_validation_valid_small_tree() -> None:
    """A small, valid component document should pass validation cleanly."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tree": {
            "component": "Stack",
            "children": [
                {"component": "Heading", "level": 1, "text": "Hello"},
                {"component": "TextInput", "bind": "name"},
            ],
        },
    }
    validator = SchemaValidator()
    result = validator.validate(doc)

    assert result.document_type == "component"
    assert result.diagnostics == []


@_with_timeout(10)
def test_component_validation_custom_component_ref() -> None:
    """Custom component references should validate against CustomComponentRef schema."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "components": {
            "MyWidget": {
                "params": ["field"],
                "tree": {"component": "TextInput", "bind": "{field}"},
            }
        },
        "tree": {
            "component": "Stack",
            "children": [
                {"component": "MyWidget", "params": {"field": "name"}},
            ],
        },
    }
    validator = SchemaValidator()
    result = validator.validate(doc)

    assert result.document_type == "component"
    assert result.diagnostics == []
