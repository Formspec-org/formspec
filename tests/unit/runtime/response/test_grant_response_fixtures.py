from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from tests.unit.support.schema_fixtures import build_schema_registry, load_schema


GRANT_APP_DIR = (
    Path(__file__).resolve().parents[4]
    / "examples"
    / "grant-application"
)
SAMPLE_SUBMISSION_PATH = GRANT_APP_DIR / "sample-submission.json"
IN_PROGRESS_SUBMISSION_PATH = GRANT_APP_DIR / "submission-in-progress.json"
AMENDED_SUBMISSION_PATH = GRANT_APP_DIR / "submission-amended.json"
STOPPED_SUBMISSION_PATH = GRANT_APP_DIR / "submission-stopped.json"

RESPONSE_SCHEMA = load_schema("response.schema.json")
VALIDATION_REPORT_SCHEMA = load_schema("validationReport.schema.json")
VALIDATION_RESULT_SCHEMA = load_schema("validationResult.schema.json")
_REGISTRY = build_schema_registry(
    RESPONSE_SCHEMA,
    VALIDATION_REPORT_SCHEMA,
    VALIDATION_RESULT_SCHEMA,
)


def _load_submission(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    "path",
    [
        SAMPLE_SUBMISSION_PATH,
        IN_PROGRESS_SUBMISSION_PATH,
        AMENDED_SUBMISSION_PATH,
        STOPPED_SUBMISSION_PATH,
    ],
)
def test_grant_response_fixtures_are_schema_valid(path: Path) -> None:
    submission = _load_submission(path)
    validator = Draft202012Validator(RESPONSE_SCHEMA, registry=_REGISTRY)
    errors = list(validator.iter_errors(submission))

    assert errors == []


def test_grant_response_fixtures_cover_full_lifecycle_statuses() -> None:
    statuses = {
        _load_submission(path)["status"]
        for path in [
            SAMPLE_SUBMISSION_PATH,
            IN_PROGRESS_SUBMISSION_PATH,
            AMENDED_SUBMISSION_PATH,
            STOPPED_SUBMISSION_PATH,
        ]
    }

    assert statuses == {"completed", "in-progress", "amended", "stopped"}


def test_amended_submission_carries_validation_metadata() -> None:
    submission = _load_submission(AMENDED_SUBMISSION_PATH)
    validation_results = submission["validationResults"]

    assert submission["status"] == "amended"
    assert validation_results
    assert {r["constraintKind"] for r in validation_results}.issuperset({"type", "external"})

    external_results = [
        result
        for result in validation_results
        if result["constraintKind"] == "external"
    ]
    assert external_results
    assert all(result.get("source") == "external" for result in external_results)
    assert all(result.get("sourceId") for result in external_results)

    assert all(result.get("code") for result in validation_results)
    assert submission["extensions"]["x-amendment"]["amendedFromResponseId"]


def test_stopped_submission_preserves_partial_data_with_validation_context() -> None:
    submission = _load_submission(STOPPED_SUBMISSION_PATH)

    assert submission["status"] == "stopped"
    assert "applicantInfo" in submission["data"]
    assert "projectNarrative" in submission["data"]
    assert any(result["severity"] == "error" for result in submission["validationResults"])
    assert any(
        result.get("source") == "external" and result.get("sourceId")
        for result in submission["validationResults"]
    )
