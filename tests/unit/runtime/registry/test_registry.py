"""Tests for the Formspec Extension Registry (Phase 12).

Tests cover: registry parsing, entry lookup by name/version/category/status,
lifecycle transition validation, well-known URL construction, and validation.
"""

import pytest
from formspec.registry import (
    Registry,
    RegistryEntry,
    validate_lifecycle_transition,
    well_known_url,
    WELL_KNOWN_PATH,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _registry_doc():
    """Build a sample registry document."""
    return {
        '$formspecRegistry': '1.0',
        'publisher': {
            'name': 'Test Org',
            'url': 'https://test.org',
        },
        'published': '2025-07-10T14:30:00Z',
        'entries': [
            {
                'name': 'x-currency',
                'category': 'dataType',
                'version': '1.0.0',
                'status': 'stable',
                'description': 'Custom currency type',
                'compatibility': {'formspecVersion': '>=1.0.0 <2.0.0'},
                'baseType': 'decimal',
            },
            {
                'name': 'x-currency',
                'category': 'dataType',
                'version': '2.0.0',
                'status': 'stable',
                'description': 'Custom currency type v2',
                'compatibility': {'formspecVersion': '>=2.0.0 <3.0.0'},
                'baseType': 'decimal',
            },
            {
                'name': 'x-currency',
                'category': 'dataType',
                'version': '0.9.0',
                'status': 'deprecated',
                'description': 'Old currency type',
                'compatibility': {'formspecVersion': '>=0.5.0 <1.0.0'},
                'baseType': 'decimal',
                'deprecationNotice': 'Use version 1.0.0+',
            },
            {
                'name': 'x-custom-validate',
                'category': 'function',
                'version': '1.0.0',
                'status': 'stable',
                'description': 'Custom validation function',
                'compatibility': {'formspecVersion': '>=1.0.0'},
                'parameters': [
                    {'name': 'value', 'type': 'string'},
                    {'name': 'pattern', 'type': 'string'},
                ],
                'returns': 'boolean',
            },
            {
                'name': 'x-luhn-check',
                'category': 'constraint',
                'version': '1.0.0',
                'status': 'draft',
                'description': 'Luhn algorithm constraint',
                'compatibility': {'formspecVersion': '>=1.0.0'},
                'parameters': [
                    {'name': 'value', 'type': 'string'},
                ],
            },
        ],
    }


# ===========================================================================
# Registry parsing
# ===========================================================================

class TestRegistryParsing:
    def test_parses_entries(self):
        reg = Registry(_registry_doc())
        assert len(reg.entries) == 5

    def test_publisher_info(self):
        reg = Registry(_registry_doc())
        assert reg.publisher['name'] == 'Test Org'
        assert reg.published == '2025-07-10T14:30:00Z'

    def test_entry_fields(self):
        reg = Registry(_registry_doc())
        entry = reg.entries[0]
        assert entry.name == 'x-currency'
        assert entry.category == 'dataType'
        assert entry.version == '1.0.0'
        assert entry.status == 'stable'
        assert entry.base_type == 'decimal'


# ===========================================================================
# Lookup
# ===========================================================================

class TestLookup:
    def test_find_by_name(self):
        reg = Registry(_registry_doc())
        results = reg.find('x-currency')
        assert len(results) == 3
        # Sorted by version descending
        assert results[0].version == '2.0.0'
        assert results[1].version == '1.0.0'
        assert results[2].version == '0.9.0'

    def test_find_by_name_and_version(self):
        reg = Registry(_registry_doc())
        results = reg.find('x-currency', version='>=1.0.0 <2.0.0')
        assert len(results) == 1
        assert results[0].version == '1.0.0'

    def test_find_by_category(self):
        reg = Registry(_registry_doc())
        results = reg.find('x-currency', category='dataType')
        assert len(results) == 3

    def test_find_by_status(self):
        reg = Registry(_registry_doc())
        results = reg.find('x-currency', status='deprecated')
        assert len(results) == 1
        assert results[0].version == '0.9.0'

    def test_find_no_match(self):
        reg = Registry(_registry_doc())
        results = reg.find('x-nonexistent')
        assert results == []

    def test_find_one(self):
        reg = Registry(_registry_doc())
        entry = reg.find_one('x-currency')
        assert entry is not None
        assert entry.version == '2.0.0'  # highest version

    def test_find_one_no_match(self):
        reg = Registry(_registry_doc())
        entry = reg.find_one('x-nonexistent')
        assert entry is None

    def test_find_one_with_version_constraint(self):
        reg = Registry(_registry_doc())
        entry = reg.find_one('x-currency', version='>=1.0.0 <2.0.0')
        assert entry is not None
        assert entry.version == '1.0.0'


# ===========================================================================
# List by category/status
# ===========================================================================

class TestListBy:
    def test_list_by_category(self):
        reg = Registry(_registry_doc())
        data_types = reg.list_by_category('dataType')
        assert len(data_types) == 3
        assert all(e.category == 'dataType' for e in data_types)

    def test_list_by_status(self):
        reg = Registry(_registry_doc())
        stable = reg.list_by_status('stable')
        assert len(stable) == 3
        assert all(e.status == 'stable' for e in stable)

    def test_list_by_category_empty(self):
        reg = Registry(_registry_doc())
        result = reg.list_by_category('namespace')
        assert result == []


# ===========================================================================
# Lifecycle transitions
# ===========================================================================

class TestLifecycleTransitions:
    def test_draft_to_stable(self):
        assert validate_lifecycle_transition('draft', 'stable') is True

    def test_draft_to_deprecated(self):
        assert validate_lifecycle_transition('draft', 'deprecated') is True

    def test_draft_to_retired(self):
        assert validate_lifecycle_transition('draft', 'retired') is True

    def test_stable_to_deprecated(self):
        assert validate_lifecycle_transition('stable', 'deprecated') is True

    def test_stable_to_retired(self):
        assert validate_lifecycle_transition('stable', 'retired') is True

    def test_deprecated_to_retired(self):
        assert validate_lifecycle_transition('deprecated', 'retired') is True

    def test_deprecated_to_stable(self):
        """Un-deprecation is allowed."""
        assert validate_lifecycle_transition('deprecated', 'stable') is True

    def test_retired_is_terminal(self):
        assert validate_lifecycle_transition('retired', 'draft') is False
        assert validate_lifecycle_transition('retired', 'stable') is False
        assert validate_lifecycle_transition('retired', 'deprecated') is False

    def test_invalid_from_status(self):
        assert validate_lifecycle_transition('invalid', 'stable') is False

    def test_same_status_transitions(self):
        assert validate_lifecycle_transition('draft', 'draft') is True
        assert validate_lifecycle_transition('stable', 'stable') is True
        assert validate_lifecycle_transition('deprecated', 'deprecated') is True


# ===========================================================================
# Well-known URL
# ===========================================================================

class TestWellKnownUrl:
    def test_well_known_path(self):
        assert WELL_KNOWN_PATH == '/.well-known/formspec-extensions'

    def test_construct_url(self):
        url = well_known_url('https://example.org')
        assert url == 'https://example.org/.well-known/formspec-extensions'

    def test_trailing_slash_stripped(self):
        url = well_known_url('https://example.org/')
        assert url == 'https://example.org/.well-known/formspec-extensions'


# ===========================================================================
# Validation
# ===========================================================================

class TestValidation:
    def test_valid_registry_no_errors(self):
        reg = Registry(_registry_doc())
        errors = reg.validate()
        assert errors == []

    def test_invalid_name_detected(self):
        doc = _registry_doc()
        doc['entries'].append({
            'name': 'bad-name',  # missing x- prefix
            'category': 'function',
            'version': '1.0.0',
            'status': 'stable',
            'description': 'Invalid',
            'compatibility': {'formspecVersion': '>=1.0.0'},
            'parameters': [{'name': 'x', 'type': 'string'}],
            'returns': 'string',
        })
        reg = Registry(doc)
        errors = reg.validate()
        assert any('bad-name' in e for e in errors)

    def test_deprecated_without_notice_detected(self):
        doc = _registry_doc()
        doc['entries'].append({
            'name': 'x-missing-notice',
            'category': 'function',
            'version': '1.0.0',
            'status': 'deprecated',
            'description': 'Missing notice',
            'compatibility': {'formspecVersion': '>=1.0.0'},
            'parameters': [{'name': 'x', 'type': 'string'}],
            'returns': 'string',
        })
        reg = Registry(doc)
        errors = reg.validate()
        assert any('deprecationNotice' in e for e in errors)

    def test_datatype_without_basetype_detected(self):
        doc = _registry_doc()
        doc['entries'].append({
            'name': 'x-no-base',
            'category': 'dataType',
            'version': '1.0.0',
            'status': 'stable',
            'description': 'Missing baseType',
            'compatibility': {'formspecVersion': '>=1.0.0'},
        })
        reg = Registry(doc)
        errors = reg.validate()
        assert any('baseType' in e for e in errors)

    def test_function_without_params_detected(self):
        doc = _registry_doc()
        doc['entries'].append({
            'name': 'x-no-params',
            'category': 'function',
            'version': '1.0.0',
            'status': 'stable',
            'description': 'Missing params',
            'compatibility': {'formspecVersion': '>=1.0.0'},
        })
        reg = Registry(doc)
        errors = reg.validate()
        assert any('parameters' in e for e in errors)
        assert any('returns' in e for e in errors)


# ===========================================================================
# Version constraint matching
# ===========================================================================

class TestVersionConstraint:
    def test_exact_match(self):
        reg = Registry(_registry_doc())
        results = reg.find('x-currency', version='1.0.0')
        assert len(results) == 1
        assert results[0].version == '1.0.0'

    def test_greater_than(self):
        reg = Registry(_registry_doc())
        results = reg.find('x-currency', version='>1.0.0')
        assert len(results) == 1
        assert results[0].version == '2.0.0'

    def test_less_or_equal(self):
        reg = Registry(_registry_doc())
        results = reg.find('x-currency', version='<=1.0.0')
        assert len(results) == 2  # 1.0.0 and 0.9.0
