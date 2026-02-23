from __future__ import annotations

from formspec.validator.component import lint_component_semantics


def _definition() -> dict:
    return {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [
            {
                "key": "choiceField",
                "type": "field",
                "label": "Choice",
                "dataType": "choice",
                "options": [{"value": "a", "label": "A"}],
            },
            {
                "key": "intField",
                "type": "field",
                "label": "Int",
                "dataType": "integer",
            },
        ],
    }


def test_custom_component_cycle_is_reported() -> None:
    component_doc = {
        "components": {
            "A": {"tree": {"component": "B"}},
            "B": {"tree": {"component": "A"}},
        }
    }

    diagnostics = lint_component_semantics(component_doc)

    assert any(diag.code == "E807" for diag in diagnostics)


def test_missing_custom_component_params_is_reported() -> None:
    component_doc = {
        "components": {
            "CustomInput": {
                "params": ["field"],
                "tree": {"component": "TextInput", "bind": "{field}"},
            }
        },
        "tree": {"component": "CustomInput"},
    }

    diagnostics = lint_component_semantics(component_doc)

    assert any(diag.code == "E806" for diag in diagnostics)


def test_select_requires_options_source() -> None:
    definition = _definition()
    # Remove options source to trigger semantic diagnostic.
    definition["items"][0].pop("options")

    component_doc = {
        "tree": {
            "component": "Stack",
            "children": [{"component": "Select", "bind": "choiceField"}],
        }
    }

    diagnostics = lint_component_semantics(component_doc, definition_doc=definition)

    assert any(diag.code == "E803" for diag in diagnostics)


def test_duplicate_editable_input_bind_warning() -> None:
    component_doc = {
        "tree": {
            "component": "Stack",
            "children": [
                {"component": "NumberInput", "bind": "intField"},
                {"component": "Slider", "bind": "intField"},
            ],
        }
    }

    diagnostics = lint_component_semantics(component_doc, definition_doc=_definition())

    assert any(diag.code == "W803" for diag in diagnostics)
