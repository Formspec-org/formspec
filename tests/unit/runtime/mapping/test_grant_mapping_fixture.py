from __future__ import annotations

import json
from pathlib import Path

from formspec.mapping import MappingEngine
from formspec.validator.schema import SchemaValidator


GRANT_APP_DIR = (
    Path(__file__).resolve().parents[4]
    / "examples"
    / "grant-application"
)
MAPPING_PATH = GRANT_APP_DIR / "mapping.json"
MAPPING_XML_PATH = GRANT_APP_DIR / "mapping-xml.json"
MAPPING_CSV_PATH = GRANT_APP_DIR / "mapping-csv.json"
SAMPLE_SUBMISSION_PATH = (
    GRANT_APP_DIR
    / "sample-submission.json"
)

EXPECTED_TRANSFORMS = {
    "preserve",
    "drop",
    "expression",
    "coerce",
    "valueMap",
    "flatten",
    "nest",
    "constant",
    "concat",
    "split",
}


def _load_mapping() -> dict:
    return json.loads(MAPPING_PATH.read_text(encoding="utf-8"))


def _load_sample_submission_data() -> dict:
    submission = json.loads(SAMPLE_SUBMISSION_PATH.read_text(encoding="utf-8"))
    return submission["data"]


def _load_mapping_from(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_grant_mapping_is_schema_valid() -> None:
    mapping = _load_mapping()
    result = SchemaValidator().validate(mapping, document_type="mapping")

    assert result.errors == []


def test_grant_mapping_exercises_bidirectional_deep_coverage() -> None:
    mapping = _load_mapping()
    rules = mapping["rules"]

    assert mapping["direction"] == "both"
    assert mapping["conformanceLevel"] == "bidirectional"
    assert mapping["autoMap"] is True
    assert mapping["defaults"]

    transforms = {rule["transform"] for rule in rules}
    assert transforms == EXPECTED_TRANSFORMS

    assert any(
        isinstance(rule.get("coerce"), dict)
        and rule["coerce"].get("from") == "string"
        and rule["coerce"].get("to") == "date"
        and rule["coerce"].get("format") == "YYYY-MM-DD"
        for rule in rules
    )

    assert any(
        isinstance(rule.get("valueMap"), dict)
        and {"forward", "reverse", "unmapped", "default"}.issubset(rule["valueMap"])
        for rule in rules
    )

    reverse_rules = [rule for rule in rules if "reverse" in rule]
    assert len(reverse_rules) >= 2
    assert len({rule["reverse"].get("transform") for rule in reverse_rules}) >= 2

    assert any(rule.get("bidirectional") is False for rule in rules)
    assert sum(1 for rule in rules if "reversePriority" in rule) >= 2
    assert any("default" in rule for rule in rules)
    assert sum(1 for rule in rules if "description" in rule) >= 3

    assert any(
        rule["transform"] in {"flatten", "nest"} and "separator" in rule
        for rule in rules
    )

    array_descriptors = [rule.get("array") for rule in rules if "array" in rule]
    assert array_descriptors
    assert all("rules" not in desc for desc in array_descriptors)
    assert any(desc.get("mode") == "indexed" for desc in array_descriptors)

    inner_rules = [
        inner_rule
        for desc in array_descriptors
        for inner_rule in desc.get("innerRules", [])
    ]
    assert inner_rules
    assert any("condition" in inner_rule for inner_rule in inner_rules)
    assert any("priority" in inner_rule for inner_rule in inner_rules)
    assert any("index" in inner_rule for inner_rule in inner_rules)


def test_grant_mapping_executes_forward_and_reverse() -> None:
    mapping = _load_mapping()
    engine = MappingEngine(mapping)

    source = _load_sample_submission_data()
    forward = engine.forward(source)

    assert forward["organization"]["name"] == "Community Health Partners, Inc."
    assert forward["organization"]["type_code"] == "NPO"
    assert forward["project"]["focus_areas_csv"] == "health|equity"
    assert forward["meta.source"] == "formspec"
    assert forward["meta"]["mappingVersion"] == "2026.02"
    assert "attachments" not in forward
    assert forward["budget"]["line_items"][0]["qty"] == 2.0
    assert "firstPhase" in forward["project"]["phase_slots"]

    reverse = engine.reverse(
        {
            "organization": {
                "name": "River University",
                "ein": "11-2223333",
                "type_code": "EDU",
                "contact": {
                    "name": "Alex Kim",
                    "email": "alex@river.edu",
                    "phone": "202-555-0101",
                    "display": "Alex Kim <alex@river.edu>",
                },
            },
            "project": {
                "title": "Health Innovation",
                "title_upper": "HEALTH INNOVATION",
                "abstract": "Pilot abstract",
                "start_date": "2026-10-01",
                "end_date": "2027-09-30",
                "duration_months": 12,
                "focus_areas_csv": "health|equity",
            },
            "budget": {
                "requested_amount": "250000.00",
                "currency": "USD",
                "indirect_rate_pct": "15%",
            },
        }
    )

    assert reverse["applicantInfo"]["orgName"] == "River University"
    assert reverse["applicantInfo"]["orgType"] == "university"
    assert reverse["applicantInfo"]["contactName"] == "Alex Kim"
    assert reverse["projectNarrative"]["projectTitle"] == "Health Innovation"
    assert reverse["budget"]["requestedAmount"]["amount"] == "250000.00"
    assert reverse["budget"]["requestedAmount"]["currency"] == "USD"


def test_grant_xml_mapping_is_schema_valid() -> None:
    mapping = _load_mapping_from(MAPPING_XML_PATH)
    result = SchemaValidator().validate(mapping, document_type="mapping")

    assert result.errors == []
    assert mapping["targetSchema"]["format"] == "xml"
    assert mapping["targetSchema"]["rootElement"] == "GrantApplication"
    assert mapping["targetSchema"]["namespaces"]
    assert mapping["targetSchema"]["url"] == (
        "https://example.gov/schemas/grants-management/v1/grant-application.xsd"
    )

    assert mapping["adapters"]["xml"] == {
        "declaration": True,
        "indent": 2,
        "cdata": ["GrantApplication.Project.Abstract"],
    }

    rules = mapping["rules"]
    assert len(rules) >= 5
    assert all(rule["targetPath"].startswith("GrantApplication.") for rule in rules)
    assert any("@currency" in rule["targetPath"] for rule in rules)


def test_grant_csv_mapping_is_schema_valid() -> None:
    mapping = _load_mapping_from(MAPPING_CSV_PATH)
    result = SchemaValidator().validate(mapping, document_type="mapping")

    assert result.errors == []
    assert mapping["targetSchema"]["format"] == "csv"
    assert mapping["targetSchema"]["name"] == "Grant Application CSV Export"

    assert mapping["adapters"]["csv"] == {
        "delimiter": ",",
        "quote": "\"",
        "header": True,
        "encoding": "utf-8",
        "lineEnding": "lf",
    }

    rules = mapping["rules"]
    assert len(rules) >= 5
    assert any(rule["transform"] == "flatten" for rule in rules)
    assert all("." not in rule["targetPath"] and "[" not in rule["targetPath"] for rule in rules)
