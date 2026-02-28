from __future__ import annotations

import json
from pathlib import Path

from formspec.validator.schema import SchemaValidator


CHANGELOG_PATH = (
    Path(__file__).resolve().parents[4]
    / "examples"
    / "grant-application"
    / "changelog.json"
)


EXPECTED_TYPES = {"added", "removed", "modified", "moved", "renamed"}
EXPECTED_IMPACTS = {"breaking", "compatible", "cosmetic"}
EXPECTED_TARGETS = {
    "item",
    "bind",
    "shape",
    "optionSet",
    "dataSource",
    "screener",
    "migration",
    "metadata",
}


def _load_changelog() -> dict:
    return json.loads(CHANGELOG_PATH.read_text(encoding="utf-8"))


def test_grant_changelog_is_schema_valid() -> None:
    changelog = _load_changelog()
    result = SchemaValidator().validate(changelog, document_type="changelog")

    assert result.errors == []


def test_grant_changelog_exercises_required_coverage_dimensions() -> None:
    changelog = _load_changelog()
    changes = changelog["changes"]

    assert changelog["fromVersion"] == "1.0.0"
    assert changelog["toVersion"] == "1.1.0"
    assert changelog["semverImpact"] == "minor"

    assert len(changes) >= 5
    assert {change["type"] for change in changes} == EXPECTED_TYPES
    assert EXPECTED_IMPACTS.issubset({change["impact"] for change in changes})
    assert {change["target"] for change in changes} == EXPECTED_TARGETS

    for change in changes:
        if change["type"] in {"modified", "removed", "renamed", "moved"}:
            assert "before" in change
            assert "after" in change

    migration_hints = {
        change.get("migrationHint")
        for change in changes
        if "migrationHint" in change
    }
    assert "preserve" in migration_hints
    assert "drop" in migration_hints
    assert any(
        isinstance(hint, str) and "$old" in hint
        for hint in migration_hints
    )

    item_changes = [change for change in changes if change["target"] == "item"]
    assert item_changes
    assert all("key" in change for change in item_changes)
