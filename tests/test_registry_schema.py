"""Conformance tests for registry.schema.json."""
import copy
import json
import os

import pytest
from jsonschema import Draft202012Validator, ValidationError, validate

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "schemas", "registry.schema.json")

with open(SCHEMA_PATH) as f:
    SCHEMA = json.load(f)


def _validate(instance):
    validate(instance, SCHEMA, cls=Draft202012Validator)


# ---------------------------------------------------------------------------
# Reusable fixtures / helpers
# ---------------------------------------------------------------------------

def _minimal_registry(entries=None):
    """Return a minimal valid registry document."""
    return {
        "$formspecRegistry": "1.0",
        "publisher": {"name": "Acme Corp", "url": "https://acme.example.com"},
        "published": "2025-01-15T00:00:00Z",
        "entries": entries if entries is not None else [],
    }


def _minimal_entry(category="property", **overrides):
    """Return a minimal valid registry entry for the given *category*."""
    entry = {
        "name": "x-acme-widget",
        "category": category,
        "version": "1.0.0",
        "status": "draft",
        "description": "A test extension",
        "compatibility": {"formspecVersion": ">=1.0"},
    }
    # Conditional requirements per category
    if category == "dataType":
        entry["baseType"] = "string"
    elif category == "function":
        entry["parameters"] = [{"name": "input", "type": "string"}]
        entry["returns"] = "string"
    elif category == "constraint":
        entry["parameters"] = [{"name": "value", "type": "integer"}]
    entry.update(overrides)
    return entry


# ===================================================================
# TestRegistryMinimalValid
# ===================================================================
class TestRegistryMinimalValid:
    """A minimal valid registry document should pass validation."""

    def test_minimal_empty_entries(self):
        _validate(_minimal_registry())

    def test_registry_with_entries(self):
        entry = _minimal_entry("property")
        _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestRegistryRequired
# ===================================================================
class TestRegistryRequired:
    """Each required top-level property must be present."""

    @pytest.mark.parametrize("field", [
        "$formspecRegistry",
        "publisher",
        "published",
        "entries",
    ])
    def test_missing_required(self, field):
        doc = _minimal_registry()
        del doc[field]
        with pytest.raises(ValidationError):
            _validate(doc)


# ===================================================================
# TestRegistryVersion
# ===================================================================
class TestRegistryVersion:
    """$formspecRegistry must be exactly '1.0'."""

    def test_valid_version(self):
        doc = _minimal_registry()
        doc["$formspecRegistry"] = "1.0"
        _validate(doc)

    @pytest.mark.parametrize("bad", ["2.0", "1.1", "1", ""])
    def test_invalid_version(self, bad):
        doc = _minimal_registry()
        doc["$formspecRegistry"] = bad
        with pytest.raises(ValidationError):
            _validate(doc)


# ===================================================================
# TestRegistryPublisher
# ===================================================================
class TestRegistryPublisher:

    def test_valid_publisher_with_name_and_url(self):
        _validate(_minimal_registry())

    def test_publisher_missing_name(self):
        doc = _minimal_registry()
        del doc["publisher"]["name"]
        with pytest.raises(ValidationError):
            _validate(doc)

    def test_publisher_missing_url(self):
        doc = _minimal_registry()
        del doc["publisher"]["url"]
        with pytest.raises(ValidationError):
            _validate(doc)

    def test_publisher_additional_properties_rejected(self):
        doc = _minimal_registry()
        doc["publisher"]["extra"] = "not allowed"
        with pytest.raises(ValidationError):
            _validate(doc)


# ===================================================================
# TestRegistryAdditionalProperties
# ===================================================================
class TestRegistryAdditionalProperties:

    def test_unknown_top_level_property_rejected(self):
        doc = _minimal_registry()
        doc["unknown"] = True
        with pytest.raises(ValidationError):
            _validate(doc)


# ===================================================================
# TestRegistryExtensions
# ===================================================================
class TestRegistryExtensions:

    def test_valid_x_prefixed_extension(self):
        doc = _minimal_registry()
        doc["extensions"] = {"x-custom": {"key": "value"}}
        _validate(doc)

    def test_non_x_prefixed_extension_fails(self):
        doc = _minimal_registry()
        doc["extensions"] = {"custom": {"key": "value"}}
        with pytest.raises(ValidationError):
            _validate(doc)


# ===================================================================
# TestEntryMinimalValid
# ===================================================================
class TestEntryMinimalValid:

    @pytest.mark.parametrize("category", [
        "dataType", "function", "constraint", "property", "namespace",
    ])
    def test_minimal_entry(self, category):
        entry = _minimal_entry(category)
        _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryRequired
# ===================================================================
class TestEntryRequired:

    @pytest.mark.parametrize("field", [
        "name", "category", "version", "status", "description", "compatibility",
    ])
    def test_missing_required_field(self, field):
        entry = _minimal_entry("property")
        del entry[field]
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryName
# ===================================================================
class TestEntryName:

    @pytest.mark.parametrize("name", ["x-foo", "x-my-ext", "x-gov-grants-v2"])
    def test_valid_name(self, name):
        entry = _minimal_entry("property", name=name)
        _validate(_minimal_registry(entries=[entry]))

    @pytest.mark.parametrize("name", [
        "noprefix",       # no x- prefix
        "X-Upper",        # uppercase
        "x- spaces",      # spaces
        "x-trailing-",    # trailing hyphen
    ])
    def test_invalid_name(self, name):
        entry = _minimal_entry("property", name=name)
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryCategory
# ===================================================================
class TestEntryCategory:

    @pytest.mark.parametrize("category", [
        "dataType", "function", "constraint", "property", "namespace",
    ])
    def test_valid_category(self, category):
        entry = _minimal_entry(category)
        _validate(_minimal_registry(entries=[entry]))

    def test_invalid_category(self):
        entry = _minimal_entry("property")
        entry["category"] = "invalid"
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryVersion
# ===================================================================
class TestEntryVersion:

    @pytest.mark.parametrize("ver", ["1.0.0", "0.1.0", "10.20.30"])
    def test_valid_semver(self, ver):
        entry = _minimal_entry("property", version=ver)
        _validate(_minimal_registry(entries=[entry]))

    @pytest.mark.parametrize("ver", ["1.0", "v1.0.0", "1"])
    def test_invalid_semver(self, ver):
        entry = _minimal_entry("property", version=ver)
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryStatus
# ===================================================================
class TestEntryStatus:

    @pytest.mark.parametrize("status", ["draft", "stable", "deprecated", "retired"])
    def test_valid_status(self, status):
        entry = _minimal_entry("property", status=status)
        _validate(_minimal_registry(entries=[entry]))

    def test_invalid_status(self):
        entry = _minimal_entry("property", status="unknown")
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryCompatibility
# ===================================================================
class TestEntryCompatibility:

    def test_valid_compatibility(self):
        entry = _minimal_entry("property",
                               compatibility={"formspecVersion": ">=1.0"})
        _validate(_minimal_registry(entries=[entry]))

    def test_missing_formspec_version(self):
        entry = _minimal_entry("property", compatibility={})
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))

    def test_additional_properties_rejected(self):
        entry = _minimal_entry("property",
                               compatibility={
                                   "formspecVersion": ">=1.0",
                                   "extra": "nope",
                               })
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryCategoryConditionals
# ===================================================================
class TestEntryCategoryConditionals:
    """if/then conditionals based on category."""

    def test_datatype_requires_basetype(self):
        entry = _minimal_entry("dataType")
        del entry["baseType"]
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))

    def test_function_requires_parameters(self):
        entry = _minimal_entry("function")
        del entry["parameters"]
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))

    def test_function_requires_returns(self):
        entry = _minimal_entry("function")
        del entry["returns"]
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))

    def test_constraint_requires_parameters(self):
        entry = _minimal_entry("constraint")
        del entry["parameters"]
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))

    def test_property_no_extra_fields_required(self):
        entry = _minimal_entry("property")
        _validate(_minimal_registry(entries=[entry]))

    def test_namespace_no_extra_fields_required(self):
        entry = _minimal_entry("namespace")
        _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryBaseType
# ===================================================================
class TestEntryBaseType:

    @pytest.mark.parametrize("bt", [
        "string", "integer", "decimal", "boolean",
        "date", "dateTime", "time", "uri",
    ])
    def test_valid_basetype(self, bt):
        entry = _minimal_entry("dataType", baseType=bt)
        _validate(_minimal_registry(entries=[entry]))

    def test_invalid_basetype(self):
        entry = _minimal_entry("dataType", baseType="blob")
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))


# ===================================================================
# TestEntryAdditionalProperties
# ===================================================================
class TestEntryAdditionalProperties:

    def test_unknown_entry_property_rejected(self):
        entry = _minimal_entry("property")
        entry["notAField"] = "bad"
        with pytest.raises(ValidationError):
            _validate(_minimal_registry(entries=[entry]))
