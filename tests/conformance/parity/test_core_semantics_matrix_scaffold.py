from __future__ import annotations

import json
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
MATRIX_PATH = ROOT_DIR / "tests" / "conformance" / "core-semantics-matrix.json"


def _load_matrix() -> dict:
    return json.loads(MATRIX_PATH.read_text(encoding="utf-8"))


def test_core_semantics_matrix_has_expected_shape() -> None:
    matrix = _load_matrix()

    assert matrix["scope"] == "core-semantics"
    assert matrix["version"] == "2026-03-05"
    assert isinstance(matrix["cases"], list)
    assert len(matrix["cases"]) >= 8


def test_core_semantics_matrix_entries_reference_real_files() -> None:
    matrix = _load_matrix()
    allowed_statuses = {"planned", "partial", "implemented"}
    case_ids: set[str] = set()

    for case in matrix["cases"]:
        case_id = case["id"]
        assert case_id not in case_ids
        case_ids.add(case_id)
        assert case["priority"] in {"p0", "p1", "p2"}
        assert case["specRefs"]

        for fixture_path in case["fixtures"]:
            assert (ROOT_DIR / fixture_path).is_file(), fixture_path

        for runtime in ("python", "engine"):
            runtime_entry = case[runtime]
            assert runtime_entry["status"] in allowed_statuses
            for test_path in runtime_entry["tests"]:
                assert (ROOT_DIR / test_path).is_file(), test_path


def test_core_semantics_matrix_contains_current_p0_runtime_focus() -> None:
    matrix = _load_matrix()
    case_ids = {case["id"] for case in matrix["cases"]}
    assert {
        "shape-repeat-targets",
        "shape-row-scope",
        "nonrelevant-suppression",
        "nrb-vs-excluded-value",
        "shape-timing-submit",
    } <= case_ids
