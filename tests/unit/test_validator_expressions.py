from __future__ import annotations

from formspec._rust import lint


def _definition_with_binds(binds: list[dict]) -> dict:
    return {
        "$formspec": "1.0",
        "url": "https://example.com/forms/x",
        "version": "1.0.0",
        "status": "draft",
        "title": "X",
        "items": [
            {"key": "a", "type": "field", "label": "A", "dataType": "integer"},
            {"key": "b", "type": "field", "label": "B", "dataType": "integer"},
        ],
        "binds": binds,
    }


def test_invalid_fel_syntax_in_bind_is_reported() -> None:
    document = _definition_with_binds([
        {"path": "a", "calculate": "if(1 then"},
    ])

    diagnostics = lint(document)

    e400 = [d for d in diagnostics if d.code == "E400"]
    assert len(e400) == 1
    assert e400[0].path == "$.binds[0].calculate"


def test_default_plain_string_is_not_forced_to_parse() -> None:
    document = _definition_with_binds([
        {"path": "a", "default": "hello world"},
    ])

    diagnostics = lint(document)

    assert diagnostics == []


def test_dependency_cycle_is_detected() -> None:
    document = _definition_with_binds(
        [
            {"path": "a", "calculate": "$b"},
            {"path": "b", "calculate": "$a"},
        ]
    )

    diagnostics = lint(document)

    e500 = [d for d in diagnostics if d.code == "E500"]
    assert len(e500) >= 1
    assert e500[0].code == "E500"
