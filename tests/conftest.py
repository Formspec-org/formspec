"""Shared fixtures and marker assignment for the Python test suite."""

from __future__ import annotations

import pytest

from tests.unit.support.schema_fixtures import *  # noqa: F401,F403


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Attach stable markers based on test ownership folders."""
    for item in items:
        path = str(item.fspath)

        if "tests/conformance/schemas/" in path:
            item.add_marker("schema")
        if "tests/conformance/spec/" in path:
            item.add_marker("schema_contract")
        if "tests/unit/" in path:
            item.add_marker("runtime")
        if "test_fel_" in path:
            item.add_marker("fel")
        if "test_validator_" in path:
            item.add_marker("validator")
        if "test_mapping_" in path:
            item.add_marker("mapping")
        if "test_adapters.py" in path:
            item.add_marker("adapters")
