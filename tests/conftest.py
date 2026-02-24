"""Shared fixtures and marker assignment for the Python test suite."""

from __future__ import annotations

import pytest

from tests.unit.support.schema_fixtures import *  # noqa: F401,F403


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Attach stable markers based on test ownership folders."""
    for item in items:
        path = str(item.fspath)

        if "tests/unit/schema/" in path:
            item.add_marker("schema")
        if "tests/unit/schema/contracts/" in path:
            item.add_marker("schema_contract")
        if "tests/unit/runtime/" in path:
            item.add_marker("runtime")
        if "tests/unit/runtime/fel/" in path:
            item.add_marker("fel")
        if "tests/unit/runtime/validator/" in path:
            item.add_marker("validator")
        if "tests/unit/runtime/mapping/" in path:
            item.add_marker("mapping")
        if "tests/unit/runtime/adapters/" in path:
            item.add_marker("adapters")
