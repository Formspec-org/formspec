"""Fixtures for grant-application server tests."""

import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure src/ is importable
_REPO = Path(__file__).resolve().parents[2]
if str(_REPO / "src") not in sys.path:
    sys.path.insert(0, str(_REPO / "src"))

# The example directory uses a hyphen ("grant-application"), which is not a
# valid Python identifier, so we import by file location instead.
_SERVER_MAIN = _REPO / "examples" / "grant-application" / "server" / "main.py"
_spec = importlib.util.spec_from_file_location("grant_app_main", _SERVER_MAIN)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

app = _mod.app


@pytest.fixture
def client():
    return TestClient(app)
