from __future__ import annotations

from formspec.validator.references import check_references
from formspec.validator.tree import build_item_index


def _doc_with_repeat_group() -> dict:
    return {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [
            {
                "key": "groupA",
                "type": "group",
                "label": "Group",
                "repeatable": True,
                "children": [
                    {"key": "amount", "type": "field", "label": "Amount", "dataType": "integer"}
                ],
            }
        ],
    }


def test_valid_wildcard_path_resolves() -> None:
    document = _doc_with_repeat_group()
    document["binds"] = [{"path": "groupA[*].amount", "calculate": "1"}]

    index = build_item_index(document)
    diagnostics = check_references(document, index)

    assert diagnostics == []


def test_invalid_bind_path_reports_reference_error() -> None:
    document = _doc_with_repeat_group()
    document["binds"] = [{"path": "missingField", "calculate": "1"}]

    index = build_item_index(document)
    diagnostics = check_references(document, index)

    assert len(diagnostics) == 1
    assert diagnostics[0].code == "E300"
    assert diagnostics[0].path == "$.binds[0].path"


def test_option_set_reference_and_datatype_warning() -> None:
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [
            {
                "key": "f1",
                "type": "field",
                "label": "F1",
                "dataType": "boolean",
                "optionSet": "missingSet",
            }
        ],
        "optionSets": {},
    }

    index = build_item_index(document)
    diagnostics = check_references(document, index)
    codes = {diag.code for diag in diagnostics}

    assert "E302" in codes
    assert "W300" in codes
