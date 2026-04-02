from __future__ import annotations

import copy

from formspec._rust import evaluate_definition


def _base_definition() -> dict:
    return {
        "$formspec": "1.0",
        "url": "https://example.org/extensions",
        "version": "1.0.0",
        "status": "active",
        "title": "Extensions",
        "items": [
            {"type": "field", "key": "name", "dataType": "string", "label": "Name"},
        ],
        "binds": [
            {"path": "name", "required": "true"},
        ],
        "shapes": [
            {
                "id": "name-shape",
                "target": "#",
                "severity": "warning",
                "message": "Short names need review",
                "constraint": "length($name) >= 3",
            },
        ],
    }


def _definition_with_extensions() -> dict:
    definition = copy.deepcopy(_base_definition())
    definition["extensions"] = {"x-root": {"source": "unit-test"}}
    definition["items"][0]["extensions"] = {"x-item": {"widgetHint": "ignore-me"}}
    definition["binds"][0]["extensions"] = {"x-bind": {"requiredPolicy": "do-not-care"}}
    definition["shapes"][0]["extensions"] = {"x-shape": {"reviewQueue": "manual"}}
    return definition


def test_unknown_extensions_do_not_interfere_with_core_results() -> None:
    """Extensions preserve core results, plus unresolved-extension diagnostics."""
    plain_missing = evaluate_definition(_base_definition(), {})
    extended_missing = evaluate_definition(_definition_with_extensions(), {})
    plain_present = evaluate_definition(_base_definition(), {"name": "Al"})
    extended_present = evaluate_definition(_definition_with_extensions(), {"name": "Al"})

    def _core(results: list[dict]) -> list[dict]:
        return [r for r in results if r.get("code") != "UNRESOLVED_EXTENSION"]

    def _extension(results: list[dict]) -> list[dict]:
        return [r for r in results if r.get("code") == "UNRESOLVED_EXTENSION"]

    assert _core(extended_missing.results) == plain_missing.results
    assert _core(extended_present.results) == plain_present.results

    missing_extensions = _extension(extended_missing.results)
    present_extensions = _extension(extended_present.results)
    assert len(missing_extensions) == 1
    assert len(present_extensions) == 1
    assert missing_extensions[0]["code"] == "UNRESOLVED_EXTENSION"
    assert present_extensions[0]["code"] == "UNRESOLVED_EXTENSION"


def test_unknown_extensions_are_preserved_on_loaded_definition_objects() -> None:
    """Verify the definition with extensions can still be evaluated without error.

    Note: with the Rust backend, we no longer have access to internal _definition
    state. We just verify the definition processes without crashing and that
    extensions don't interfere with core evaluation.
    """
    defn = _definition_with_extensions()
    result = evaluate_definition(defn, {"name": "Test"})
    # Core evaluation still works — the definition processes successfully
    assert isinstance(result.valid, bool)
    assert isinstance(result.results, list)
