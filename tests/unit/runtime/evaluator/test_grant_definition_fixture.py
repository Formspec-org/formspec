from __future__ import annotations

import json
from pathlib import Path

from formspec.validator.schema import SchemaValidator


GRANT_APP_DIR = (
    Path(__file__).resolve().parents[4]
    / "examples"
    / "grant-application"
)
DEFINITION_PATH = GRANT_APP_DIR / "definition.json"
CONTACT_FRAGMENT_PATH = GRANT_APP_DIR / "contact-fragment.json"

EXPECTED_PAGE_NAMES = {
    "Applicant Info",
    "Project Narrative",
    "Budget",
    "Project Phases",
    "Subcontractors",
    "Review & Submit",
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


def test_grant_definition_and_contact_fragment_are_schema_valid() -> None:
    validator = SchemaValidator()

    definition_result = validator.validate(
        _load_json(DEFINITION_PATH),
        document_type="definition",
    )
    assert definition_result.errors == []

    fragment_result = validator.validate(
        _load_json(CONTACT_FRAGMENT_PATH),
        document_type="definition",
    )
    assert fragment_result.errors == []


def test_grant_definition_exercises_ref_keyprefix_and_migration_coverage() -> None:
    definition = _load_json(DEFINITION_PATH)
    all_items = _iter_items(definition["items"])

    ref_groups = [
        item
        for item in all_items
        if item.get("type") == "group" and "$ref" in item
    ]
    assert ref_groups
    assert any("#contactCore" in item["$ref"] for item in ref_groups)
    assert any(item.get("keyPrefix") == "altContact" for item in ref_groups)

    migration = definition["migrations"]["from"]["0.9.0"]
    assert isinstance(migration["description"], str) and migration["description"]

    transforms = {entry["transform"] for entry in migration["fieldMap"]}
    assert transforms == {"preserve", "drop", "expression"}
    assert any(entry["transform"] == "drop" and entry["target"] is None for entry in migration["fieldMap"])
    assert any(
        entry["transform"] == "expression"
        and isinstance(entry.get("expression"), str)
        and "$" in entry["expression"]
        for entry in migration["fieldMap"]
    )

    assert migration["defaults"]["budget.requestedAmount.currency"] == "USD"
    assert migration["defaults"]["projectNarrative.selfAssessment"] == 3


def test_grant_definition_uses_presentation_layout_page_path() -> None:
    definition = _load_json(DEFINITION_PATH)
    all_items = _iter_items(definition["items"])

    presented_items = [item for item in all_items if isinstance(item.get("presentation"), dict)]
    assert presented_items
    assert all("page" not in item["presentation"] for item in presented_items)

    page_names = {
        item["presentation"]["layout"]["page"]
        for item in all_items
        if isinstance(item.get("presentation"), dict)
        and isinstance(item["presentation"].get("layout"), dict)
        and isinstance(item["presentation"]["layout"].get("page"), str)
    }
    assert EXPECTED_PAGE_NAMES.issubset(page_names)


def test_grant_definition_includes_shape_id_composition() -> None:
    definition = _load_json(DEFINITION_PATH)
    shapes = definition.get("shapes", [])
    shape_ids = {shape.get("id") for shape in shapes if isinstance(shape.get("id"), str)}

    has_shape_id_reference = False
    for shape in shapes:
        for key in ("and", "or", "xone"):
            entries = shape.get(key)
            if isinstance(entries, list) and any(
                isinstance(entry, str) and entry in shape_ids
                for entry in entries
            ):
                has_shape_id_reference = True
                break
        if has_shape_id_reference:
            break
        not_entry = shape.get("not")
        if isinstance(not_entry, str) and not_entry in shape_ids:
            has_shape_id_reference = True
            break

    assert has_shape_id_reference


def test_grant_definition_exercises_pdf_and_csv_label_contexts() -> None:
    definition = _load_json(DEFINITION_PATH)
    all_items = _iter_items(definition["items"])

    csv_pdf_labeled_keys = {
        item["key"]
        for item in all_items
        if isinstance(item.get("labels"), dict)
        and isinstance(item["labels"].get("pdf"), str)
        and isinstance(item["labels"].get("csv"), str)
    }

    assert {"orgName", "ein", "projectTitle"}.issubset(csv_pdf_labeled_keys)
