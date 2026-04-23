"""Conformance tests for Formspec intake-handoff.schema.json."""

from __future__ import annotations

import re
from copy import deepcopy

import pytest
from jsonschema import Draft202012Validator, ValidationError

from tests.unit.support.schema_fixtures import build_schema_registry, load_schema

INTAKE_HANDOFF_SCHEMA = load_schema("intake-handoff.schema.json")
_REGISTRY = build_schema_registry(INTAKE_HANDOFF_SCHEMA)


def _validator() -> Draft202012Validator:
    return Draft202012Validator(
        INTAKE_HANDOFF_SCHEMA,
        registry=_REGISTRY,
        format_checker=Draft202012Validator.FORMAT_CHECKER,
    )


def _validate(instance: dict) -> None:
    _validator().validate(instance)


def _minimal_public_intake() -> dict:
    return {
        "$formspecIntakeHandoff": "1.0",
        "handoffId": "handoff-public-2026-0001",
        "initiationMode": "publicIntake",
        "definitionRef": {
            "url": "https://example.gov/forms/benefits-intake",
            "version": "1.0.0",
        },
        "responseRef": "urn:formspec:response:resp-2026-0001",
        "responseHash": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "validationReportRef": "urn:formspec:validation-report:vr-2026-0001",
        "intakeSessionId": "session-2026-0001",
        "ledgerHeadRef": "urn:formspec:respondent-ledger-event:evt-2026-0003",
        "occurredAt": "2026-04-22T17:15:00Z",
    }


def _minimal_workflow_intake() -> dict:
    handoff = _minimal_public_intake()
    handoff["handoffId"] = "handoff-workflow-2026-0001"
    handoff["initiationMode"] = "workflowInitiated"
    handoff["caseRef"] = "urn:wos:case:case-2026-0042"
    return handoff


class TestIntakeHandoffModes:
    """The two case-initiation modes are first-class and mutually constrained."""

    def test_public_intake_is_valid_without_case_ref(self) -> None:
        _validate(_minimal_public_intake())

    def test_public_intake_allows_explicit_null_case_ref(self) -> None:
        doc = _minimal_public_intake()
        doc["caseRef"] = None
        _validate(doc)

    def test_public_intake_rejects_preexisting_case_ref(self) -> None:
        doc = _minimal_public_intake()
        doc["caseRef"] = "urn:wos:case:case-2026-0042"

        with pytest.raises(ValidationError):
            _validate(doc)

    def test_workflow_initiated_requires_case_ref(self) -> None:
        doc = _minimal_workflow_intake()
        del doc["caseRef"]

        with pytest.raises(ValidationError, match="'caseRef' is a required property"):
            _validate(doc)

    def test_workflow_initiated_rejects_null_case_ref(self) -> None:
        doc = _minimal_workflow_intake()
        doc["caseRef"] = None

        with pytest.raises(ValidationError):
            _validate(doc)


class TestIntakeHandoffShape:
    """The handoff preserves references needed for validation, replay, and anchoring."""

    @pytest.mark.parametrize(
        "field",
        [
            "$formspecIntakeHandoff",
            "handoffId",
            "initiationMode",
            "definitionRef",
            "responseRef",
            "responseHash",
            "validationReportRef",
            "intakeSessionId",
            "ledgerHeadRef",
            "occurredAt",
        ],
    )
    def test_required_fields(self, field: str) -> None:
        doc = _minimal_public_intake()
        del doc[field]

        with pytest.raises(
            ValidationError,
            match=re.escape(f"'{field}' is a required property"),
        ):
            _validate(doc)

    def test_optional_actor_and_subject_refs_are_valid(self) -> None:
        doc = _minimal_workflow_intake()
        doc["actorRef"] = "urn:iam:actor:user-123"
        doc["subjectRef"] = "urn:party:person:applicant-456"

        _validate(doc)

    def test_definition_ref_requires_url_and_version(self) -> None:
        for missing_field in ["url", "version"]:
            doc = _minimal_public_intake()
            bad_ref = deepcopy(doc["definitionRef"])
            del bad_ref[missing_field]
            doc["definitionRef"] = bad_ref

            with pytest.raises(
                ValidationError,
                match=re.escape(f"'{missing_field}' is a required property"),
            ):
                _validate(doc)

    def test_hash_must_be_algorithm_prefixed(self) -> None:
        doc = _minimal_public_intake()
        doc["responseHash"] = "0123456789abcdef"

        with pytest.raises(ValidationError):
            _validate(doc)

    def test_unknown_top_level_properties_are_rejected(self) -> None:
        doc = _minimal_public_intake()
        doc["caseCreated"] = True

        with pytest.raises(ValidationError, match="Additional properties are not allowed"):
            _validate(doc)

    def test_extensions_must_be_namespaced(self) -> None:
        doc = _minimal_public_intake()
        doc["extensions"] = {"custom": "no prefix"}

        with pytest.raises(ValidationError):
            _validate(doc)

    def test_x_namespaced_extensions_are_valid(self) -> None:
        doc = _minimal_public_intake()
        doc["extensions"] = {"x-wos-intake-channel": "public-portal"}

        _validate(doc)
