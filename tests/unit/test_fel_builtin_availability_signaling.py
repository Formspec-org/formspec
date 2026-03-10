from __future__ import annotations

from formspec.fel import evaluate, is_null


def test_unknown_function_produces_explicit_diagnostic() -> None:
    result = evaluate("totallyUnknown(1)")

    assert is_null(result.value)
    assert any(
        diagnostic.message == "Undefined function: totallyUnknown"
        for diagnostic in result.diagnostics
    )
