from __future__ import annotations

import copy

from formspec.evaluator import DefinitionEvaluator


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


def test_unknown_extensions_produce_unresolved_but_preserve_core_results() -> None:
    plain = DefinitionEvaluator(_base_definition())
    extended = DefinitionEvaluator(_definition_with_extensions())

    plain_missing = plain.process({})
    extended_missing = extended.process({})
    plain_present = plain.process({"name": "Al"})
    extended_present = extended.process({"name": "Al"})

    # Filter out UNRESOLVED_EXTENSION errors to compare core results
    def core_results(results):
        return [r for r in results if r.get("code") != "UNRESOLVED_EXTENSION"]

    assert core_results(extended_missing.results) == plain_missing.results
    assert core_results(extended_present.results) == plain_present.results

    # But the extended evaluator DOES emit UNRESOLVED_EXTENSION for the item-level extension
    unresolved = [r for r in extended_missing.results if r.get("code") == "UNRESOLVED_EXTENSION"]
    assert len(unresolved) == 1
    assert "x-item" in unresolved[0]["message"]


def test_unknown_extensions_are_preserved_on_loaded_definition_objects() -> None:
    evaluator = DefinitionEvaluator(_definition_with_extensions())

    assert evaluator._definition["extensions"] == {"x-root": {"source": "unit-test"}}
    assert evaluator._definition["items"][0]["extensions"] == {"x-item": {"widgetHint": "ignore-me"}}
    assert evaluator._definition["binds"][0]["extensions"] == {"x-bind": {"requiredPolicy": "do-not-care"}}
    assert evaluator._definition["shapes"][0]["extensions"] == {"x-shape": {"reviewQueue": "manual"}}
