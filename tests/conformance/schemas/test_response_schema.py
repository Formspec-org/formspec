"""Conformance tests for Formspec response.schema.json and validationReport.schema.json."""

import json
from copy import deepcopy

import pytest
from jsonschema import Draft202012Validator, ValidationError, validate

from tests.unit.support.schema_fixtures import build_schema_registry, load_schema

# ---------------------------------------------------------------------------
# Schema loading
# ---------------------------------------------------------------------------

RESPONSE_SCHEMA = load_schema("response.schema.json")
VALIDATION_REPORT_SCHEMA = load_schema("validationReport.schema.json")
VALIDATION_RESULT_SCHEMA = load_schema("validationResult.schema.json")

# Build a resolver/registry so schemas can resolve cross-schema $refs.
_REGISTRY = build_schema_registry(RESPONSE_SCHEMA, VALIDATION_REPORT_SCHEMA, VALIDATION_RESULT_SCHEMA)


def _validate_response(instance: dict) -> None:
    v = Draft202012Validator(RESPONSE_SCHEMA, registry=_REGISTRY)
    v.validate(instance)


def _validate_report(instance: dict) -> None:
    v = Draft202012Validator(VALIDATION_REPORT_SCHEMA, registry=_REGISTRY)
    v.validate(instance)


# ---------------------------------------------------------------------------
# Helpers – minimal valid documents
# ---------------------------------------------------------------------------

def _minimal_response() -> dict:
    return {
        "$formspecResponse": "1.0",
        "definitionUrl": "https://example.com/forms/intake",
        "definitionVersion": "1.0.0",
        "status": "in-progress",
        "data": {},
        "authored": "2025-01-15T10:30:00Z",
    }


def _minimal_validation_result() -> dict:
    return {
        "$formspecValidationResult": "1.0",
        "path": "patient.name",
        "severity": "error",
        "constraintKind": "required",
        "message": "Field is required.",
    }


def _minimal_report() -> dict:
    return {
        "$formspecValidationReport": "1.0",
        "valid": True,
        "results": [],
        "counts": {"error": 0, "warning": 0, "info": 0},
        "timestamp": "2025-01-15T10:30:00Z",
    }


# ===================================================================
# RESPONSE SCHEMA TESTS
# ===================================================================


class TestResponseMinimalValid:
    """Minimal and fully-populated valid Response documents."""

    def test_minimal_response(self):
        _validate_response(_minimal_response())

    def test_response_with_all_optional_fields(self):
        doc = _minimal_response()
        doc["id"] = "550e8400-e29b-41d4-a716-446655440000"
        doc["author"] = {"id": "auth-1", "name": "Dr. Smith"}
        doc["subject"] = {"id": "subj-1", "type": "Patient"}
        doc["validationResults"] = [_minimal_validation_result()]
        doc["extensions"] = {"x-custom": "value"}
        _validate_response(doc)


class TestResponseEnums:
    """Status enum validation."""

    @pytest.mark.parametrize("status", [
        "in-progress",
        "completed",
        "amended",
        "stopped",
    ])
    def test_valid_status(self, status):
        doc = _minimal_response()
        doc["status"] = status
        _validate_response(doc)

    def test_invalid_status(self):
        doc = _minimal_response()
        doc["status"] = "draft"
        with pytest.raises(ValidationError, match="is not one of"):
            _validate_response(doc)


class TestResponseFormats:
    """Format enforcement for URI and date-time fields."""

    def test_definitionUrl_must_be_uri(self):
        doc = _minimal_response()
        doc["definitionUrl"] = "not a uri"
        with pytest.raises(ValidationError):
            v = Draft202012Validator(RESPONSE_SCHEMA, registry=_REGISTRY, format_checker=Draft202012Validator.FORMAT_CHECKER)
            v.validate(doc)

    def test_authored_must_be_datetime(self):
        doc = _minimal_response()
        doc["authored"] = "not-a-date"
        with pytest.raises(ValidationError):
            v = Draft202012Validator(RESPONSE_SCHEMA, registry=_REGISTRY, format_checker=Draft202012Validator.FORMAT_CHECKER)
            v.validate(doc)


class TestResponseAuthor:
    """Author sub-object validation."""

    def test_valid_author_with_id(self):
        doc = _minimal_response()
        doc["author"] = {"id": "auth-1"}
        _validate_response(doc)

    def test_author_missing_id(self):
        doc = _minimal_response()
        doc["author"] = {"name": "Dr. Smith"}
        with pytest.raises(ValidationError, match="'id' is a required property"):
            _validate_response(doc)

    def test_author_with_all_fields(self):
        doc = _minimal_response()
        doc["author"] = {"id": "auth-1", "name": "Dr. Smith"}
        _validate_response(doc)


class TestResponseSubject:
    """Subject sub-object validation."""

    def test_valid_subject_with_id(self):
        doc = _minimal_response()
        doc["subject"] = {"id": "subj-1"}
        _validate_response(doc)

    def test_subject_missing_id(self):
        doc = _minimal_response()
        doc["subject"] = {"type": "Patient"}
        with pytest.raises(ValidationError, match="'id' is a required property"):
            _validate_response(doc)


class TestResponseValidation:
    """ValidationResult array validation."""

    def test_valid_validation_result(self):
        doc = _minimal_response()
        doc["validationResults"] = [_minimal_validation_result()]
        _validate_response(doc)

    @pytest.mark.parametrize("field", [
        "path",
        "severity",
        "constraintKind",
        "message",
    ])
    def test_validation_result_missing_required_field(self, field):
        result = _minimal_validation_result()
        del result[field]
        doc = _minimal_response()
        doc["validationResults"] = [result]
        with pytest.raises(ValidationError, match=f"'{field}' is a required property"):
            _validate_response(doc)

    def test_invalid_severity_enum(self):
        result = _minimal_validation_result()
        result["severity"] = "critical"
        doc = _minimal_response()
        doc["validationResults"] = [result]
        with pytest.raises(ValidationError, match="is not one of"):
            _validate_response(doc)

    @pytest.mark.parametrize("kind", [
        "required",
        "type",
        "cardinality",
        "constraint",
        "shape",
        "external",
    ])
    def test_valid_constraintKind(self, kind):
        result = _minimal_validation_result()
        result["constraintKind"] = kind
        doc = _minimal_response()
        doc["validationResults"] = [result]
        _validate_response(doc)

    def test_invalid_constraintKind_enum(self):
        result = _minimal_validation_result()
        result["constraintKind"] = "regex"
        doc = _minimal_response()
        doc["validationResults"] = [result]
        with pytest.raises(ValidationError, match="is not one of"):
            _validate_response(doc)

    @pytest.mark.parametrize("source", ["bind", "shape", "external"])
    def test_valid_source_enum(self, source):
        result = _minimal_validation_result()
        result["source"] = source
        doc = _minimal_response()
        doc["validationResults"] = [result]
        _validate_response(doc)

    def test_invalid_source_enum(self):
        result = _minimal_validation_result()
        result["source"] = "custom"
        doc = _minimal_response()
        doc["validationResults"] = [result]
        with pytest.raises(ValidationError, match="is not one of"):
            _validate_response(doc)

    def test_additional_properties_on_validation_result_rejected(self):
        result = _minimal_validation_result()
        result["extra"] = "nope"
        doc = _minimal_response()
        doc["validationResults"] = [result]
        with pytest.raises(ValidationError, match="Additional properties are not allowed"):
            _validate_response(doc)


class TestResponseExtensions:
    """Extension property-name validation."""

    def test_valid_x_prefixed_extension(self):
        doc = _minimal_response()
        doc["extensions"] = {"x-myApp": {"foo": 1}}
        _validate_response(doc)

    def test_non_x_prefixed_extension_fails(self):
        doc = _minimal_response()
        doc["extensions"] = {"myApp": {"foo": 1}}
        with pytest.raises(ValidationError, match="does not match"):
            _validate_response(doc)

    def test_extensions_on_validation_result(self):
        result = _minimal_validation_result()
        result["extensions"] = {"x-detail": "extra info"}
        doc = _minimal_response()
        doc["validationResults"] = [result]
        _validate_response(doc)


class TestResponseData:
    """The data field must be an object."""

    def test_data_is_object(self):
        doc = _minimal_response()
        doc["data"] = {"key": "value"}
        _validate_response(doc)

    def test_data_as_string_fails(self):
        doc = _minimal_response()
        doc["data"] = "not an object"
        with pytest.raises(ValidationError, match="is not of type 'object'"):
            _validate_response(doc)

    def test_data_as_array_fails(self):
        doc = _minimal_response()
        doc["data"] = [1, 2, 3]
        with pytest.raises(ValidationError, match="is not of type 'object'"):
            _validate_response(doc)


# ===================================================================
# VALIDATION REPORT SCHEMA TESTS
# ===================================================================


class TestValidationReportMinimalValid:
    """Minimal and fully-populated valid Report documents."""

    def test_minimal_valid_report(self):
        _validate_report(_minimal_report())

    def test_report_with_optional_fields(self):
        doc = _minimal_report()
        doc["definitionUrl"] = "https://example.com/forms/intake"
        doc["definitionVersion"] = "1.0.0"
        doc["extensions"] = {"x-tool": "formspec-validator"}
        _validate_report(doc)


class TestValidationReportCounts:
    """Counts sub-object validation."""

    def test_valid_counts(self):
        doc = _minimal_report()
        doc["counts"] = {"error": 2, "warning": 1, "info": 0}
        _validate_report(doc)

    @pytest.mark.parametrize("field", ["error", "warning", "info"])
    def test_missing_count_field(self, field):
        doc = _minimal_report()
        del doc["counts"][field]
        with pytest.raises(ValidationError, match=f"'{field}' is a required property"):
            _validate_report(doc)

    def test_negative_count_value(self):
        doc = _minimal_report()
        doc["counts"]["error"] = -1
        with pytest.raises(ValidationError, match="-1 is less than the minimum of 0"):
            _validate_report(doc)

    def test_additional_properties_on_counts_rejected(self):
        doc = _minimal_report()
        doc["counts"]["fatal"] = 0
        with pytest.raises(ValidationError, match="Additional properties are not allowed"):
            _validate_report(doc)


class TestValidationReportFormats:
    """Format enforcement for date-time and URI fields."""

    def test_timestamp_must_be_datetime(self):
        doc = _minimal_report()
        doc["timestamp"] = "yesterday"
        with pytest.raises(ValidationError):
            v = Draft202012Validator(VALIDATION_REPORT_SCHEMA, registry=_REGISTRY, format_checker=Draft202012Validator.FORMAT_CHECKER)
            v.validate(doc)

    def test_definitionUrl_must_be_uri(self):
        doc = _minimal_report()
        doc["definitionUrl"] = "not a uri"
        with pytest.raises(ValidationError):
            v = Draft202012Validator(VALIDATION_REPORT_SCHEMA, registry=_REGISTRY, format_checker=Draft202012Validator.FORMAT_CHECKER)
            v.validate(doc)
