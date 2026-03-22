from __future__ import annotations

import json
from pathlib import Path

from formspec.validate import discover_artifacts, validate_all


def _write_json(path: Path, doc: dict) -> None:
    path.write_text(json.dumps(doc), encoding="utf-8")


def _definition(version: str, key: str) -> dict:
    return {
        "$formspec": "1.0",
        "url": "https://example.org/forms/pinned-intake",
        "version": version,
        "title": f"Pinned Intake {version}",
        "status": "active",
        "items": [
            {"key": key, "type": "field", "dataType": "string", "label": key},
        ],
        "binds": [
            {"path": key, "required": "true"},
        ],
    }


def _response(version: str, data: dict) -> dict:
    return {
        "$formspecResponse": "1.0",
        "definitionUrl": "https://example.org/forms/pinned-intake",
        "definitionVersion": version,
        "status": "completed",
        "data": data,
        "authored": "2026-03-05T12:00:00Z",
    }


def _runtime_pass(report):
    return next(pass_result for pass_result in report.passes if pass_result.title == "Runtime evaluation")


def test_runtime_evaluation_uses_exact_pinned_definition_version(tmp_path: Path) -> None:
    _write_json(tmp_path / "intake-v1.json", _definition("1.0.0", "legacyField"))
    _write_json(tmp_path / "intake-v2.json", _definition("2.0.0", "renamedField"))
    _write_json(tmp_path / "response.json", _response("1.0.0", {"legacyField": "present"}))

    report = validate_all(discover_artifacts(tmp_path))
    runtime_pass = _runtime_pass(report)

    assert len(runtime_pass.items) == 1
    assert runtime_pass.items[0].error_count == 0


def test_runtime_evaluation_errors_when_pinned_definition_version_is_unavailable(tmp_path: Path) -> None:
    _write_json(tmp_path / "intake-v1.json", _definition("1.0.0", "legacyField"))
    _write_json(tmp_path / "intake-v2.json", _definition("2.0.0", "renamedField"))
    _write_json(tmp_path / "response.json", _response("3.0.0", {"legacyField": "present"}))

    report = validate_all(discover_artifacts(tmp_path))
    runtime_pass = _runtime_pass(report)

    assert len(runtime_pass.items) == 1
    assert runtime_pass.items[0].error_count == 1
    assert runtime_pass.items[0].runtime_results[0]["severity"] == "error"
    assert "https://example.org/forms/pinned-intake@3.0.0" in runtime_pass.items[0].runtime_results[0]["message"]
    assert "1.0.0, 2.0.0" in runtime_pass.items[0].runtime_results[0]["message"]
