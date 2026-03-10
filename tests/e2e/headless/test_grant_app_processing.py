"""Headless pipeline execution of Grant Application examples."""

import json
from pathlib import Path
import pytest
from formspec.evaluator import DefinitionEvaluator
from formspec.registry import Registry

def _load_grant_def():
    p = Path(__file__).resolve().parents[3] / "examples" / "grant-application" / "definition.json"
    return json.loads(p.read_text())

def _load_common_registry():
    p = Path(__file__).resolve().parents[3] / "registries" / "formspec-common.registry.json"
    return Registry(json.loads(p.read_text()))

def _valid_grant_data():
    """Minimal valid grant application data."""
    return {
        'applicantInfo': {
            'orgName': 'Test Nonprofit',
            'ein': '12-3456789',
            'orgType': 'nonprofit',
            'contactName': 'Jane Doe',
            'contactEmail': 'jane@example.com',
            'contactPhone': '(202) 555-0100',
        },
        'projectNarrative': {
            'projectTitle': 'Research Project',
            'abstract': 'A meaningful research project that addresses an important problem.',
            'startDate': '2026-06-01',
            'endDate': '2027-06-01',
            'indirectRate': 10,
            'focusAreas': ['health'],
        },
        'budget': {
            'lineItems': [
                {'category': 'personnel', 'description': 'Staff', 'quantity': 1, 'unitCost': 50000, 'subtotal': 0},
            ],
            'requestedAmount': {'amount': '55000', 'currency': 'USD'},
            'usesSubcontractors': False,
        },
        'projectPhases': [
            {
                'phaseName': 'Phase 1',
                'phaseTasks': [
                    {'taskName': 'Task 1', 'hours': 100, 'hourlyRate': {'amount': '50', 'currency': 'USD'}, 'taskCost': None},
                ],
            },
        ],
        'subcontractors': [],
        'attachments': {
            'narrativeDoc': {'url': 'https://example.com/doc.pdf', 'contentType': 'application/pdf', 'size': 1024},
        },
    }

@pytest.fixture
def evaluator():
    defn = _load_grant_def()
    reg = _load_common_registry()
    return DefinitionEvaluator(defn, registries=[reg])

class TestGrantApplicationIntegration:
    def test_valid_submission_passes(self, evaluator):
        data = _valid_grant_data()
        result = evaluator.process(data)
        errors = [r for r in result.results if r['severity'] == 'error']
        # Should be valid (no errors) — if there are errors, print them for debugging
        assert errors == [], f"Unexpected errors: {errors}"
        assert result.valid is True

    def test_variables_computed(self, evaluator):
        data = _valid_grant_data()
        result = evaluator.process(data)
        assert 'totalDirect' in result.variables
        assert 'indirectCosts' in result.variables
        assert 'grandTotal' in result.variables

    def test_line_item_subtotal_calculated(self, evaluator):
        data = _valid_grant_data()
        data['budget']['lineItems'] = [
            {'category': 'personnel', 'description': 'Staff', 'quantity': 3, 'unitCost': 10000, 'subtotal': 0},
            {'category': 'travel', 'description': 'Travel', 'quantity': 2, 'unitCost': 5000, 'subtotal': 0},
        ]
        data['budget']['requestedAmount'] = {'amount': '40000', 'currency': 'USD'}
        result = evaluator.process(data)
        assert result.data['budget']['lineItems'][0]['subtotal'] == pytest.approx(30000)
        assert result.data['budget']['lineItems'][1]['subtotal'] == pytest.approx(10000)

    def test_missing_required_fields(self, evaluator):
        data = _valid_grant_data()
        data['applicantInfo']['orgName'] = ''
        data['applicantInfo']['contactName'] = None
        result = evaluator.process(data)
        required_errors = [r for r in result.results if r['code'] == 'REQUIRED']
        paths = {r['path'] for r in required_errors}
        assert 'applicantInfo.orgName' in paths
        assert 'applicantInfo.contactName' in paths

    def test_ein_constraint_violation(self, evaluator):
        data = _valid_grant_data()
        data['applicantInfo']['ein'] = 'bad-ein'
        result = evaluator.process(data)
        constraint_errors = [r for r in result.results if r['code'] in ('CONSTRAINT_FAILED', 'PATTERN_MISMATCH')]
        paths = {r['path'] for r in constraint_errors}
        assert 'applicantInfo.ein' in paths

    def test_email_constraint_violation(self, evaluator):
        data = _valid_grant_data()
        data['applicantInfo']['contactEmail'] = 'no-at-sign'
        result = evaluator.process(data)
        constraint_errors = [r for r in result.results if r['code'] in ('CONSTRAINT_FAILED', 'PATTERN_MISMATCH')]
        paths = {r['path'] for r in constraint_errors}
        assert 'applicantInfo.contactEmail' in paths

    def test_project_website_rejects_invalid_domain_or_scheme(self, evaluator):
        data = _valid_grant_data()
        data['applicantInfo']['projectWebsite'] = 'example/project'
        result = evaluator.process(data)
        constraint_errors = [r for r in result.results if r['code'] in ('CONSTRAINT_FAILED', 'PATTERN_MISMATCH')]
        paths = {r['path'] for r in constraint_errors}
        assert 'applicantInfo.projectWebsite' in paths

    def test_project_website_allows_valid_https_url_with_path(self, evaluator):
        data = _valid_grant_data()
        data['applicantInfo']['projectWebsite'] = 'https://example.org/programs/telehealth'
        result = evaluator.process(data)
        website_errors = [r for r in result.results if r.get('path') == 'applicantInfo.projectWebsite' and r['code'] in ('CONSTRAINT_FAILED', 'PATTERN_MISMATCH')]
        assert website_errors == []

    def test_date_ordering_constraint(self, evaluator):
        data = _valid_grant_data()
        data['projectNarrative']['startDate'] = '2027-01-01'
        data['projectNarrative']['endDate'] = '2026-01-01'
        result = evaluator.process(data)
        constraint_errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        paths = {r['path'] for r in constraint_errors}
        assert 'projectNarrative.endDate' in paths

    def test_budget_match_shape(self, evaluator):
        data = _valid_grant_data()
        # Set a mismatched requestedAmount (lineItems subtotal = 50000, requested = 99999)
        data['budget']['requestedAmount'] = {'amount': '99999', 'currency': 'USD'}
        result = evaluator.process(data)
        shape_errors = [r for r in result.results if r.get('shapeId') == 'budgetMatch']
        assert len(shape_errors) == 1

    def test_subcontractors_nrb_keep(self, evaluator):
        """Subcontractors has nonRelevantBehavior=keep, so data preserved even when non-relevant."""
        data = _valid_grant_data()
        data['budget']['usesSubcontractors'] = False
        data['subcontractors'] = [{'subName': 'Acme', 'subOrg': 'Corp', 'subAmount': 1000, 'subScope': 'work'}]
        result = evaluator.process(data)
        # subcontractors should be kept (nrb=keep on bind), not removed
        assert 'subcontractors' in result.data

    def test_whitespace_normalization_on_ein(self, evaluator):
        data = _valid_grant_data()
        data['applicantInfo']['ein'] = '  12-3456789  '
        result = evaluator.process(data)
        assert result.data['applicantInfo']['ein'] == '12-3456789'
