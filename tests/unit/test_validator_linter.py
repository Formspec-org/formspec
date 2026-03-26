from __future__ import annotations

import json
from pathlib import Path

import pytest

from formspec._rust import lint

REGISTRY_PATH = Path(__file__).resolve().parents[2] / "registries" / "formspec-common.registry.json"
REGISTRY_DOC = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def test_schema_only_skips_semantic_passes() -> None:
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "a", "type": "field", "label": "A", "dataType": "integer"}],
        "binds": [{"path": "missing"}],
    }

    diagnostics = lint(document, schema_only=True)

    assert diagnostics == []


def test_no_fel_skips_expression_pass() -> None:
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "a", "type": "field", "label": "A", "dataType": "integer"}],
        "binds": [{"path": "a", "calculate": "if(1 then"}],
    }

    diagnostics = lint(document, no_fel=True)

    assert not any(diag.code == "E400" for diag in diagnostics)


def test_theme_semantic_missing_token_reference() -> None:
    document = {
        "$formspecTheme": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tokens": {"color.primary": "#112233"},
        "defaults": {"style": {"borderColor": "$token.color.missing"}},
    }

    diagnostics = lint(document)

    assert any(diag.code == "W704" and diag.severity == "warning" for diag in diagnostics)


def test_component_root_must_be_layout_component() -> None:
    document = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tree": {"component": "TextInput", "bind": "name"},
    }

    diagnostics = lint(document)

    assert any(diag.code == "E800" for diag in diagnostics)


def test_component_compatibility_warning_escalates_in_strict_mode() -> None:
    component_doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tree": {
            "component": "Stack",
            "children": [{"component": "TextInput", "bind": "a"}],
        },
    }
    definition_doc = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [
            {"key": "a", "type": "field", "label": "A", "dataType": "integer"},
        ],
    }

    authoring = lint(component_doc, component_definition=definition_doc)
    strict = lint(component_doc, mode="strict", component_definition=definition_doc)

    assert any(diag.code == "W802" and diag.severity == "warning" for diag in authoring)
    assert any(diag.code == "W802" and diag.severity == "error" for diag in strict)



# ── Extension resolution linting ────────────────────────────────────


def _definition_with_extension(ext_name: str, ext_value=True) -> dict:
    return {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{
            "key": "a",
            "type": "field",
            "label": "A",
            "dataType": "string",
            "extensions": {ext_name: ext_value},
        }],
    }


def test_unresolved_extension_emits_E600() -> None:
    """Extension declared but no registry provided — should produce E600."""
    document = _definition_with_extension("x-formspec-email")

    diagnostics = lint(document)

    assert any(
        diag.code == "E600" and diag.severity == "error" for diag in diagnostics
    ), f"Expected E600 for unresolved extension, got: {[d.code for d in diagnostics]}"


def test_unresolved_extension_names_extension_in_message() -> None:
    """E600 message should include the unresolved extension name."""
    document = _definition_with_extension("x-acme-widget")

    diagnostics = lint(document)

    e600 = [d for d in diagnostics if d.code == "E600"]
    assert len(e600) == 1
    assert "x-acme-widget" in e600[0].message


def test_resolved_extension_no_E600() -> None:
    """Extension declared with matching registry — no E600."""
    document = _definition_with_extension("x-formspec-email")

    diagnostics = lint(document, registry_documents=[REGISTRY_DOC])

    assert not any(diag.code == "E600" for diag in diagnostics)


def test_disabled_extension_no_E600() -> None:
    """Extension set to false — no E600 even without registry."""
    document = _definition_with_extension("x-acme-widget", ext_value=False)

    diagnostics = lint(document)

    assert not any(diag.code == "E600" for diag in diagnostics)


def test_unknown_extension_with_registry_emits_E600() -> None:
    """Registry loaded but extension not in it — should still E600."""
    document = _definition_with_extension("x-acme-unknown")

    diagnostics = lint(document, registry_documents=[REGISTRY_DOC])

    assert any(diag.code == "E600" for diag in diagnostics)
