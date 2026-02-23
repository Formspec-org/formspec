from __future__ import annotations

from formspec.validator.linter import FormspecLinter
from formspec.validator.policy import LintPolicy


def test_schema_only_skips_semantic_passes() -> None:
    linter = FormspecLinter()
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "a", "type": "field", "label": "A", "dataType": "integer"}],
        "binds": [{"path": "missing"}],
    }

    diagnostics = linter.lint(document, schema_only=True)

    assert diagnostics == []


def test_no_fel_skips_expression_pass() -> None:
    linter = FormspecLinter()
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "a", "type": "field", "label": "A", "dataType": "integer"}],
        "binds": [{"path": "/a", "calculate": "if(1 then"}],
    }

    diagnostics = linter.lint(document, no_fel=True)

    assert not any(diag.code == "E400" for diag in diagnostics)


def test_theme_semantic_missing_token_reference() -> None:
    linter = FormspecLinter()
    document = {
        "$formspecTheme": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tokens": {"color.primary": "#112233"},
        "defaults": {"style": {"borderColor": "$token.color.missing"}},
    }

    diagnostics = linter.lint(document)

    assert any(diag.code == "W704" and diag.severity == "warning" for diag in diagnostics)


def test_component_root_must_be_layout_component() -> None:
    linter = FormspecLinter()
    document = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tree": {"component": "TextInput", "bind": "name"},
    }

    diagnostics = linter.lint(document)

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

    authoring = FormspecLinter(policy=LintPolicy(mode="authoring")).lint(
        component_doc,
        component_definition=definition_doc,
    )
    strict = FormspecLinter(policy=LintPolicy(mode="strict")).lint(
        component_doc,
        component_definition=definition_doc,
    )

    assert any(diag.code == "W802" and diag.severity == "warning" for diag in authoring)
    assert any(diag.code == "W802" and diag.severity == "error" for diag in strict)


def test_wizard_children_must_be_page() -> None:
    linter = FormspecLinter()
    document = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/forms/x"},
        "tree": {
            "component": "Wizard",
            "children": [{"component": "Stack"}],
        },
    }

    diagnostics = linter.lint(document)

    assert any(diag.code == "E805" for diag in diagnostics)
