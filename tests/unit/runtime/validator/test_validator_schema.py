from __future__ import annotations

from formspec.validator.schema import SchemaValidator


def test_detect_definition_doc_type() -> None:
    validator = SchemaValidator()
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "f1", "type": "field", "label": "F1", "dataType": "string"}],
    }
    result = validator.validate(document)
    assert result.document_type == "definition"
    assert result.diagnostics == []


def test_schema_error_maps_to_diagnostic_path() -> None:
    validator = SchemaValidator()
    document = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [{"key": "f1", "type": "field", "label": "F1", "dataType": "blob"}],
    }

    result = validator.validate(document)

    assert result.document_type == "definition"
    assert result.diagnostics
    assert any(diag.path == "$.items[0].dataType" for diag in result.diagnostics)
    assert all(diag.category == "schema" for diag in result.diagnostics)


def test_unknown_document_type_is_reported() -> None:
    validator = SchemaValidator()
    result = validator.validate({"hello": "world"})

    assert result.document_type is None
    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "E100"
