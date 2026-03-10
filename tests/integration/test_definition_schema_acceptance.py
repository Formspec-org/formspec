from __future__ import annotations

import json
from pathlib import Path

import pytest

from formspec.evaluator import DefinitionEvaluator
from formspec.validator.schema import SchemaValidator


ROOT_DIR = Path(__file__).resolve().parents[2]
FIXTURE_PATHS = [
    "tests/fixtures/fixture-microgrant-screener.json",
    "tests/fixtures/fixture-household-benefits-renewal.json",
    "tests/fixtures/fixture-clinical-adverse-event.json",
    "tests/fixtures/fixture-vendor-conflict-disclosure.json",
    "tests/fixtures/fixture-multi-state-tax-filing.json",
]


def _load_definition(relative_path: str) -> dict:
    return json.loads((ROOT_DIR / relative_path).read_text(encoding="utf-8"))


@pytest.mark.parametrize("relative_path", FIXTURE_PATHS)
def test_schema_valid_definitions_are_accepted_by_definition_evaluator(relative_path: str) -> None:
    definition = _load_definition(relative_path)

    schema_result = SchemaValidator().validate(definition, document_type="definition")
    assert schema_result.errors == []

    evaluator = DefinitionEvaluator(definition)

    assert evaluator is not None
    assert evaluator._items
    assert evaluator._definition["url"] == definition["url"]
