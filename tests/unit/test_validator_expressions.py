from __future__ import annotations

from formspec.validator.dependencies import analyze_dependencies
from formspec.validator.expressions import compile_expressions


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
        {"path": "/a", "calculate": "if(1 then"},
    ])

    result = compile_expressions(document)

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "E400"
    assert result.diagnostics[0].path == "$.binds[0].calculate"


def test_default_plain_string_is_not_forced_to_parse() -> None:
    document = _definition_with_binds([
        {"path": "/a", "default": "hello world"},
    ])

    result = compile_expressions(document)

    assert result.diagnostics == []
    assert result.compiled == []


def test_dependency_cycle_is_detected() -> None:
    document = _definition_with_binds(
        [
            {"path": "/a", "calculate": "$b"},
            {"path": "/b", "calculate": "$a"},
        ]
    )

    compilation = compile_expressions(document)
    deps = analyze_dependencies(compilation.compiled)

    assert deps.diagnostics
    assert deps.diagnostics[0].code == "E500"
