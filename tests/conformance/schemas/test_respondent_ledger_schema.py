"""Conformance tests for respondent-ledger schemas."""

from copy import deepcopy
import json

import pytest
from jsonschema import Draft202012Validator, ValidationError

from tests.unit.support.schema_fixtures import ROOT_DIR, build_schema_registry, load_schema


LEDGER_SCHEMA = load_schema("respondent-ledger.schema.json")
EVENT_SCHEMA = load_schema("respondent-ledger-event.schema.json")
VALIDATION_RESULT_SCHEMA = load_schema("validation-result.schema.json")

_REGISTRY = build_schema_registry(LEDGER_SCHEMA, EVENT_SCHEMA, VALIDATION_RESULT_SCHEMA)


def _validate_event(instance: dict) -> None:
    Draft202012Validator(EVENT_SCHEMA, registry=_REGISTRY).validate(instance)


def _attachment_added_event() -> dict:
    with open(ROOT_DIR / "fixtures/respondent-ledger/attachment-added-binding.json") as f:
        return json.load(f)


def _attachment_removed_event() -> dict:
    event = _attachment_added_event()
    event["eventId"] = "evt-attachment-0002"
    event["sequence"] = 2
    event["eventType"] = "attachment.removed"
    event["priorEventHash"] = event["eventHash"]
    event["eventHash"] = "sha256:d63f1d5fe2a9f0d8a9b6e5f1234d7c3b2a1908776af4ed0d17b9f225e5c4cb01"
    event["priorAttachmentBindingHash"] = "sha256:b6a8a6f541534a1b2ce3f4dcaad106dd671e9b1b08fbde177a7fd9024adbd8fc"
    event.pop("attachmentBinding")
    event["changes"][0]["op"] = "remove"
    event["changes"][0].pop("afterHash", None)
    event["changes"][0].pop("displayAfter", None)
    event["changes"][0]["beforeHash"] = "sha256:1f74d3a1e85f2f7a6df1e7cf8a580f2e9b5c17231ce0a91d89d8e3bb18c3e19a"
    event["changes"][0]["displayBefore"] = "paystub-march.pdf"
    event["changes"][0]["reasonCode"] = "respondent-removal"
    return event


def test_attachment_added_fixture_is_schema_valid():
    _validate_event(_attachment_added_event())


def test_attachment_added_requires_binding():
    event = _attachment_added_event()
    event.pop("attachmentBinding")

    with pytest.raises(ValidationError):
        _validate_event(event)


def test_attachment_added_requires_null_prior_binding_hash():
    event = _attachment_added_event()
    event["attachmentBinding"]["prior_binding_hash"] = "sha256:b6a8a6f541534a1b2ce3f4dcaad106dd671e9b1b08fbde177a7fd9024adbd8fc"

    with pytest.raises(ValidationError):
        _validate_event(event)


def test_attachment_replaced_requires_prior_binding_hash():
    event = _attachment_added_event()
    event["eventType"] = "attachment.replaced"
    event["attachmentBinding"]["prior_binding_hash"] = "sha256:b6a8a6f541534a1b2ce3f4dcaad106dd671e9b1b08fbde177a7fd9024adbd8fc"
    _validate_event(event)

    missing_prior = deepcopy(event)
    missing_prior["attachmentBinding"]["prior_binding_hash"] = None
    with pytest.raises(ValidationError):
        _validate_event(missing_prior)


def test_attachment_removed_references_prior_binding_without_new_binding():
    _validate_event(_attachment_removed_event())


def test_attachment_removed_rejects_new_binding():
    event = _attachment_removed_event()
    event["attachmentBinding"] = _attachment_added_event()["attachmentBinding"]

    with pytest.raises(ValidationError):
        _validate_event(event)


def test_prior_event_hash_allows_null_for_first_trellis_wrapped_event():
    event = _attachment_added_event()
    event["priorEventHash"] = None
    _validate_event(event)
