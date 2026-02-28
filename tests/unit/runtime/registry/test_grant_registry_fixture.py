from __future__ import annotations

import json
from pathlib import Path

from formspec.registry import Registry
from formspec.validator.schema import SchemaValidator


GRANT_REGISTRY_PATH = (
    Path(__file__).resolve().parents[4]
    / "examples"
    / "grant-application"
    / "registry.json"
)


def _load_registry() -> dict:
    return json.loads(GRANT_REGISTRY_PATH.read_text(encoding="utf-8"))


def test_grant_registry_fixture_is_schema_valid() -> None:
    result = SchemaValidator().validate(_load_registry(), document_type="registry")
    assert result.errors == []


def test_grant_registry_runtime_query_by_name_category_and_version() -> None:
    registry = Registry(_load_registry())

    ssn = registry.find_one(
        "x-grants-gov-ssn",
        category="dataType",
        status="stable",
        version=">=1.0.0",
    )
    assert ssn is not None
    assert ssn.base_type == "string"
    assert ssn.raw["compatibility"]["mappingDslVersion"] == ">=1.0.0 <2.0.0"

    fiscal_year = registry.find_one(
        "x-grants-gov-fiscal-year",
        category="function",
        version=">=0.9.0 <1.0.0",
    )
    assert fiscal_year is not None
    assert fiscal_year.returns == "integer"
    assert registry.find("x-grants-gov-fiscal-year", version=">=1.0.0") == []


def test_grant_registry_runtime_lists_cover_all_categories_and_statuses() -> None:
    registry = Registry(_load_registry())

    categories = {entry.category for entry in registry.entries}
    statuses = {entry.status for entry in registry.entries}
    assert categories == {"dataType", "function", "constraint", "property", "namespace"}
    assert statuses == {"draft", "stable", "deprecated", "retired"}

    assert len(registry.list_by_category("dataType")) == 1
    assert len(registry.list_by_category("function")) == 1
    assert len(registry.list_by_category("constraint")) == 1
    assert len(registry.list_by_category("property")) == 1
    assert len(registry.list_by_category("namespace")) == 1

    assert len(registry.list_by_status("stable")) == 2
    assert len(registry.list_by_status("draft")) == 1
    assert len(registry.list_by_status("deprecated")) == 1
    assert len(registry.list_by_status("retired")) == 1


def test_grant_registry_runtime_namespace_and_deprecation_metadata() -> None:
    registry = Registry(_load_registry())

    namespace = registry.find_one("x-grants-gov", category="namespace")
    assert namespace is not None
    assert namespace.members == [
        "x-grants-gov-ssn",
        "x-grants-gov-fiscal-year",
        "x-grants-gov-duns-valid",
        "x-grants-gov-agency-code",
    ]

    deprecated = registry.find_one("x-grants-gov-duns-valid", status="deprecated")
    assert deprecated is not None
    assert "x-grants-gov-uei-valid" in (deprecated.deprecation_notice or "")

    assert registry.validate() == []
