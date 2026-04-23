from __future__ import annotations

import json
from pathlib import Path

from formspec.validate import discover_artifacts, validate_all


def _write_json(path: Path, doc: dict) -> None:
    path.write_text(json.dumps(doc), encoding="utf-8")


def _handoff(initiation_mode: str = "publicIntake", case_ref: str | None = None) -> dict:
    doc = {
        "$formspecIntakeHandoff": "1.0",
        "handoffId": "handoff-public-2026-0001",
        "initiationMode": initiation_mode,
        "definitionRef": {
            "url": "https://example.gov/forms/benefits-intake",
            "version": "1.0.0",
        },
        "responseRef": "urn:formspec:response:resp-2026-0001",
        "responseHash": "sha256:0123456789abcdef",
        "validationReportRef": "urn:formspec:validation-report:vr-2026-0001",
        "intakeSessionId": "session-2026-0001",
        "ledgerHeadRef": "urn:formspec:respondent-ledger-event:evt-2026-0003",
        "occurredAt": "2026-04-22T17:15:00Z",
    }
    if case_ref is not None:
        doc["caseRef"] = case_ref
    return doc


def _pass(report, title: str):
    return next(pass_result for pass_result in report.passes if pass_result.title == title)


def test_discover_and_validate_public_intake_handoff(tmp_path: Path) -> None:
    _write_json(tmp_path / "handoff.json", _handoff())

    artifacts = discover_artifacts(tmp_path)
    assert len(artifacts.intake_handoffs) == 1
    assert artifacts.intake_handoffs[0].initiation_mode == "publicIntake"
    assert artifacts.intake_handoffs[0].case_ref is None

    report = validate_all(artifacts)
    schema_pass = _pass(report, "Intake handoff schema validation")

    assert schema_pass.items[0].error_count == 0


def test_public_intake_handoff_with_case_ref_fails_validation(tmp_path: Path) -> None:
    _write_json(
        tmp_path / "handoff.json",
        _handoff(case_ref="urn:wos:case:case-2026-0042"),
    )

    report = validate_all(discover_artifacts(tmp_path))
    schema_pass = _pass(report, "Intake handoff schema validation")

    assert schema_pass.items[0].error_count > 0
