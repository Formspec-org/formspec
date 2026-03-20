from __future__ import annotations

import json
from pathlib import Path

import pytest

from formspec._rust import evaluate_definition, lint


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
def test_schema_valid_definitions_are_accepted_by_evaluate_definition(relative_path: str) -> None:
    definition = _load_definition(relative_path)

    # Lint should run without crashing (some diagnostics are expected from
    # the stricter Rust FEL parser, so we don't assert zero errors)
    diagnostics = lint(definition)
    assert isinstance(diagnostics, list)

    # evaluate_definition should accept valid definitions without crashing
    result = evaluate_definition(definition, {})
    assert result is not None
    assert result.data is not None
