"""Fixtures for reference server tests."""

import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure src/ is importable
_REPO = Path(__file__).resolve().parents[3]
if str(_REPO / "src") not in sys.path:
    sys.path.insert(0, str(_REPO / "src"))

# The example directory uses a non-standard name, so we import by file location.
_SERVER_MAIN = _REPO / "examples" / "refrences" / "server" / "main.py"
_spec = importlib.util.spec_from_file_location("refrences_server_main", _SERVER_MAIN)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

app = _mod.app


@pytest.fixture
def client():
    return TestClient(app)
