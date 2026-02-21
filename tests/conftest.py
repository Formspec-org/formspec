"""Shared fixtures for Formspec conformance test suite."""
import json
import os
import pytest

SCHEMA_DIR = os.path.join(os.path.dirname(__file__), "..")


def _load_schema(name):
    path = os.path.join(SCHEMA_DIR, name)
    with open(path) as f:
        return json.load(f)


@pytest.fixture(scope="session")
def definition_schema():
    return _load_schema("definition.schema.json")


@pytest.fixture(scope="session")
def response_schema():
    return _load_schema("response.schema.json")


@pytest.fixture(scope="session")
def validation_report_schema():
    return _load_schema("validationReport.schema.json")


@pytest.fixture(scope="session")
def mapping_schema():
    return _load_schema("mapping.schema.json")


@pytest.fixture(scope="session")
def registry_schema():
    return _load_schema("registry.schema.json")
