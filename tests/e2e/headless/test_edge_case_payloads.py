from __future__ import annotations

import json
from pathlib import Path

import pytest

from formspec.evaluator import DefinitionEvaluator
from formspec.validator.schema import SchemaValidator


ROOT_DIR = Path(__file__).resolve().parents[3]

FIXTURE_PATHS = {
    "microgrant": ROOT_DIR / "tests" / "fixtures" / "fixture-microgrant-screener.json",
    "household": ROOT_DIR / "tests" / "fixtures" / "fixture-household-benefits-renewal.json",
    "clinical": ROOT_DIR / "tests" / "fixtures" / "fixture-clinical-adverse-event.json",
    "vendor": ROOT_DIR / "tests" / "fixtures" / "fixture-vendor-conflict-disclosure.json",
    "tax": ROOT_DIR / "tests" / "fixtures" / "fixture-multi-state-tax-filing.json",
}


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _iter_items(items: list[dict]) -> list[dict]:
    flattened: list[dict] = []
    for item in items:
        flattened.append(item)
        children = item.get("children", [])
        if isinstance(children, list):
            flattened.extend(_iter_items(children))
    return flattened


@pytest.fixture(scope="module")
def validator() -> SchemaValidator:
    return SchemaValidator()


@pytest.fixture(scope="module")
def fixtures() -> dict[str, dict]:
    return {name: _load_json(path) for name, path in FIXTURE_PATHS.items()}


@pytest.mark.parametrize("fixture_name", sorted(FIXTURE_PATHS))
def test_edge_case_definition_fixtures_are_schema_valid(
    fixture_name: str,
    fixtures: dict[str, dict],
    validator: SchemaValidator,
) -> None:
    result = validator.validate(fixtures[fixture_name], document_type="definition")
    assert result.errors == []


def test_microgrant_fixture_exercises_screener_instances_and_submit_shapes(
    fixtures: dict[str, dict],
) -> None:
    definition = fixtures["microgrant"]

    assert "screener" in definition
    assert {"orgProfile", "grantRules"}.issubset(definition["instances"])
    assert definition["formPresentation"]["defaultCurrency"] == "USD"

    all_items = _iter_items(definition["items"])
    money_fields = {
        item["key"]
        for item in all_items
        if item.get("type") == "field" and item.get("dataType") == "money"
    }
    assert {"requestAmount", "subawardAmount"}.issubset(money_fields)

    binds_by_path = {bind["path"]: bind for bind in definition["binds"]}
    assert binds_by_path["project.subawardRows"]["excludedValue"] == "null"
    assert binds_by_path["project.subawardRows"]["nonRelevantBehavior"] == "remove"
    assert binds_by_path["project.indirectRate"]["default"] == 10

    submit_shape_ids = {
        shape["id"]
        for shape in definition["shapes"]
        if shape.get("timing") == "submit"
    }
    assert "microgrant-attestation" in submit_shape_ids
    assert any("xone" in shape for shape in definition["shapes"])


def test_household_fixture_exercises_nested_repeats_migrations_and_household_shapes(
    fixtures: dict[str, dict],
) -> None:
    definition = fixtures["household"]

    assert definition["versionAlgorithm"] == "date"
    assert definition["nonRelevantBehavior"] == "keep"
    assert "migrations" in definition
    migration = definition["migrations"]["from"]["2025.06.01"]
    transforms = {entry["transform"] for entry in migration["fieldMap"]}
    assert transforms == {"preserve", "drop", "expression"}

    household_group = next(item for item in definition["items"] if item["key"] == "household")
    child_keys = {child["key"] for child in household_group["children"]}
    assert {"householdMembers", "householdExpenses"}.issubset(child_keys)

    member_group = next(child for child in household_group["children"] if child["key"] == "householdMembers")
    assert member_group["repeatable"] is True
    assert member_group["minRepeat"] == 1
    nested_field_keys = {child["key"] for child in member_group["children"]}
    assert {"memberNoSsn", "memberCareExplanation", "memberMonthlyIncome"}.issubset(nested_field_keys)

    shape_ids = {shape["id"] for shape in definition["shapes"]}
    assert {
        "renewal-contact-channel",
        "renewal-at-least-one-adult",
        "renewal-child-age-rule",
        "renewal-budget-warning",
    }.issubset(shape_ids)


def test_clinical_fixture_exercises_calculations_attachments_and_submit_gates(
    fixtures: dict[str, dict],
) -> None:
    definition = fixtures["clinical"]

    all_items = _iter_items(definition["items"])
    semantic_types = {
        item["key"]: item["semanticType"]
        for item in all_items
        if isinstance(item.get("semanticType"), str)
    }
    assert semantic_types["subjectId"] == "clinical:subject-id"
    assert any(item.get("dataType") == "attachment" for item in all_items)

    binds_by_path = {bind["path"]: bind for bind in definition["binds"]}
    assert "calculate" in binds_by_path["event.severityScore"]
    assert binds_by_path["event.reportAttachment"]["required"].startswith(
        "$event.eventUnexpected = true"
    )
    assert binds_by_path["event.followUpDueDate"]["default"] == "=dateAdd(today(), 7, 'days')"

    shape_by_id = {shape["id"]: shape for shape in definition["shapes"]}
    assert shape_by_id["ae-hospitalization-proof"]["timing"] == "submit"
    assert shape_by_id["ae-ongoing-outcome"]["xone"]


def test_vendor_fixture_exercises_mixed_severity_review_rules(
    fixtures: dict[str, dict],
) -> None:
    definition = fixtures["vendor"]

    assert definition["nonRelevantBehavior"] == "keep"
    assert definition["extensions"]["x-agency"] == "procurement-office"

    all_items = _iter_items(definition["items"])
    attachment_keys = {
        item["key"]
        for item in all_items
        if item.get("type") == "field" and item.get("dataType") == "attachment"
    }
    assert "partySupportingAttachment" in attachment_keys

    binds_by_path = {bind["path"]: bind for bind in definition["binds"]}
    assert binds_by_path["relationships.relatedParties[*].partyAgencyName"]["excludedValue"] == "null"
    assert binds_by_path["relationships.relatedParties[*].partySupportingAttachment"]["nonRelevantBehavior"] == "remove"

    severities = {shape["severity"] for shape in definition["shapes"]}
    assert {"error", "warning", "info"} <= severities
    assert any(shape.get("timing") == "submit" for shape in definition["shapes"])


def test_tax_fixture_exercises_source_option_sets_and_cross_section_consistency(
    fixtures: dict[str, dict],
) -> None:
    definition = fixtures["tax"]

    state_codes = definition["optionSets"]["stateCodes"]
    assert state_codes["source"] == "https://example.org/reference/us-states"
    assert state_codes["valueField"] == "code"
    assert state_codes["labelField"] == "name"

    all_items = _iter_items(definition["items"])
    repeatable_keys = {
        item["key"]
        for item in all_items
        if item.get("type") == "group" and item.get("repeatable") is True
    }
    assert {"stateAllocations", "residencyPeriods"}.issubset(repeatable_keys)

    binds_by_path = {bind["path"]: bind for bind in definition["binds"]}
    assert "calculate" in binds_by_path["income.totalWages"]
    assert binds_by_path["income.standardDeduction"]["relevant"] == "$income.deductionMethod = 'standard'"
    assert binds_by_path["allocations.stateAllocations"]["disabledDisplay"] == "protected"

    shape_by_id = {shape["id"]: shape for shape in definition["shapes"]}
    assert shape_by_id["tax-allocation-percent-total"]["activeWhen"] == "count($filer.secondaryStates) > 0"
    assert shape_by_id["tax-allocation-income-total"]["timing"] == "submit"
    assert shape_by_id["tax-electronic-consent"]["constraint"] == "$review.agreeElectronic = true"


def test_microgrant_payload_emits_expected_shape_failures_and_removes_hidden_fields(
    fixtures: dict[str, dict],
) -> None:
    evaluator = DefinitionEvaluator(fixtures["microgrant"])
    result = evaluator.process(
        {
            "applicant": {
                "orgLegalName": "Neighborhood Arts Collective",
                "orgEin": "123456789",
                "applicantProgramArea": "arts",
                "hasFiscalSponsor": False,
            },
            "project": {
                "projectTitle": "Summer Murals",
                "requestAmount": {"amount": "1000", "currency": "USD"},
                "hasSubawards": True,
                "subawardRows": [
                    {
                        "subawardName": "Community Partner",
                        "subawardAmount": {"amount": "800", "currency": "USD"},
                    }
                ],
                "indirectCostPolicy": "none",
                "indirectRate": 12.5,
                "indirectExplanation": "Should disappear",
            },
            "contact": {
                "contactEmail": "",
                "contactPhone": "",
            },
            "certifications": {
                "attestationAccepted": False,
            },
        },
        mode="submit",
    )

    shape_ids = {entry["shapeId"] for entry in result.results if entry.get("source") == "shape"}
    assert {"microgrant-contact-channel", "microgrant-subaward-cap", "microgrant-attestation"} <= shape_ids
    assert "indirectRate" not in result.data["project"]
    assert "indirectExplanation" not in result.data["project"]


def test_clinical_payload_emits_chronology_and_submit_time_failures(
    fixtures: dict[str, dict],
) -> None:
    evaluator = DefinitionEvaluator(fixtures["clinical"])
    result = evaluator.process(
        {
            "participant": {
                "subjectId": "SUBJ-204",
                "siteCode": "SITE-11",
            },
            "event": {
                "eventTerm": "Syncope",
                "eventUnexpected": False,
                "eventSeverity": "moderate",
                "severityScore": None,
                "onsetDate": "2026-03-01",
                "onsetTime": "08:00:00",
                "ongoing": True,
                "resolutionDate": "2026-02-28",
                "resolutionTime": "09:00:00",
                "resolvedOutcome": "recovering",
                "causedHospitalization": True,
                "seriousnessReasons": [],
                "seriousnessNarrative": "",
                "eventNarrative": "Participant briefly lost consciousness during visit.",
                "followUpNeeded": False,
                "reportAttachment": None,
            },
        },
        mode="submit",
    )

    shape_ids = {entry["shapeId"] for entry in result.results if entry.get("source") == "shape"}
    assert {"ae-chronology", "ae-ongoing-outcome", "ae-hospitalization-proof"} <= shape_ids
    assert result.data["event"]["severityScore"] == 2


def test_tax_payload_submit_adds_submit_only_shape_failures_beyond_continuous_mode(
    fixtures: dict[str, dict],
) -> None:
    evaluator = DefinitionEvaluator(fixtures["tax"])
    payload = {
        "filer": {
            "filingStatus": "single",
            "primaryState": "MD",
            "secondaryStates": ["VA", "DC"],
            "taxYear": 2025,
        },
        "income": {
            "residentWages": {"amount": "100", "currency": "USD"},
            "nonResidentWages": {"amount": "100", "currency": "USD"},
            "totalWages": None,
            "deductionMethod": "standard",
            "standardDeduction": None,
            "itemizedDeductions": None,
            "itemizedExplanation": "",
        },
        "allocations": {
            "stateAllocations": [
                {
                    "allocationState": "VA",
                    "allocationPercent": 60,
                    "allocationIncome": {"amount": "100", "currency": "USD"},
                },
                {
                    "allocationState": "DC",
                    "allocationPercent": 30,
                    "allocationIncome": {"amount": "50", "currency": "USD"},
                },
            ]
        },
        "residency": {
            "residencyPeriods": [
                {
                    "residencyState": "MD",
                    "residencyStart": "2025-01-01",
                    "residencyEnd": "2025-12-31",
                }
            ]
        },
        "review": {
            "preparerNotes": "Needs manual review",
            "agreeElectronic": True,
        },
    }

    continuous = evaluator.process(payload, mode="continuous")
    submit = evaluator.process(payload, mode="submit")

    continuous_shape_ids = {
        entry["shapeId"] for entry in continuous.results if entry.get("source") == "shape"
    }
    submit_shape_ids = {
        entry["shapeId"] for entry in submit.results if entry.get("source") == "shape"
    }

    assert "tax-allocation-percent-total" in continuous_shape_ids
    assert "tax-allocation-income-total" not in continuous_shape_ids
    assert {"tax-allocation-percent-total", "tax-allocation-income-total"} <= submit_shape_ids
    assert submit.data["income"]["totalWages"] == {"amount": "200", "currency": "USD"}


def test_household_payload_emits_cross_member_failures_and_keeps_hidden_values(
    fixtures: dict[str, dict],
) -> None:
    evaluator = DefinitionEvaluator(fixtures["household"])
    result = evaluator.process(
        {
            "household": {
                "renewalStreet": "100 Main Street",
                "renewalCity": "Springfield",
                "renewalState": "MD",
                "renewalPostalCode": "20001",
                "householdMembers": [
                    {
                        "memberFullName": "Teen Applicant",
                        "memberRole": "child",
                        "memberAge": 21,
                        "memberIsStudent": False,
                        "memberMonthlyIncome": 0,
                        "memberNoSsn": False,
                        "memberNeedsCare": False,
                        "memberCareExplanation": "Hidden but kept",
                    }
                ],
                "householdExpenses": [
                    {
                        "expenseType": "rent",
                        "expenseMonthlyAmount": 1200,
                    }
                ],
                "householdExpenseNote": "High rent burden",
            },
            "renewalContact": {
                "renewalEmail": "",
                "renewalPhone": "",
            },
        },
        mode="submit",
    )

    shape_ids = {entry["shapeId"] for entry in result.results if entry.get("source") == "shape"}
    assert {"renewal-contact-channel", "renewal-at-least-one-adult", "renewal-child-age-rule", "renewal-budget-warning"} <= shape_ids
    assert result.data["household"]["householdMembers"][0]["memberCareExplanation"] == "Hidden but kept"


def test_vendor_payload_emits_mixed_severity_results_and_submit_gate(
    fixtures: dict[str, dict],
) -> None:
    evaluator = DefinitionEvaluator(fixtures["vendor"])
    result = evaluator.process(
        {
            "vendorProfile": {
                "vendorLegalName": "Acme Supply Partners",
                "vendorEin": "987654321",
                "vendorContactEmail": "",
                "vendorContactPhone": "",
            },
            "relationships": {
                "relatedParties": [
                    {
                        "partyName": "Jordan Lee",
                        "partyRelationshipKind": "gift",
                        "partyIsAgencyOfficial": True,
                        "partyAgencyName": "Department of Purchasing",
                        "partyGiftValue": {"amount": "700", "currency": "USD"},
                        "partyGiftDescription": "Conference hospitality",
                        "partySupportingAttachment": None,
                    }
                ]
            },
            "certifications": {
                "needsAgencyReview": True,
                "reviewNotes": "Escalate for ethics review",
                "attestationAccepted": False,
            },
        },
        mode="submit",
    )

    shape_results = {
        (entry["shapeId"], entry["severity"])
        for entry in result.results
        if entry.get("source") == "shape"
    }
    assert ("vendor-contact-channel", "error") in shape_results
    assert ("vendor-official-attachment-warning", "warning") in shape_results
    assert ("vendor-gift-review", "info") in shape_results
    assert ("vendor-attestation", "error") in shape_results
