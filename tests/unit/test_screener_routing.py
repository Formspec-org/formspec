from __future__ import annotations

from formspec.evaluator import DefinitionEvaluator


def _definition_with_screener() -> dict:
    return {
        "$formspec": "1.0",
        "url": "https://example.org/screener",
        "version": "1.0.0",
        "status": "active",
        "title": "Screener Test",
        "items": [
            {"type": "field", "key": "applicantName", "dataType": "string", "label": "Applicant"},
        ],
        "screener": {
            "items": [
                {"type": "field", "key": "orgType", "dataType": "choice", "label": "Organization Type"},
                {"type": "field", "key": "isReturning", "dataType": "boolean", "label": "Returning"},
            ],
            "binds": [
                {"path": "orgType", "required": "true"},
            ],
            "routes": [
                {
                    "condition": "$orgType = 'nonprofit' and $isReturning = true",
                    "target": "https://example.org/forms/returning|1.0.0",
                    "label": "Returning",
                },
                {
                    "condition": "$orgType = 'nonprofit'",
                    "target": "https://example.org/forms/new|1.0.0",
                    "label": "New",
                },
                {
                    "condition": "true",
                    "target": "https://example.org/forms/general|1.0.0",
                    "label": "General",
                    "extensions": {"x-route-kind": "fallback"},
                },
            ],
        },
    }


def test_evaluate_screener_returns_first_matching_route_in_declaration_order() -> None:
    evaluator = DefinitionEvaluator(_definition_with_screener())

    returning = evaluator.evaluate_screener({"orgType": "nonprofit", "isReturning": True})
    new = evaluator.evaluate_screener({"orgType": "nonprofit", "isReturning": False})
    fallback = evaluator.evaluate_screener({"orgType": "forprofit", "isReturning": False})

    assert returning == {
        "target": "https://example.org/forms/returning|1.0.0",
        "label": "Returning",
    }
    assert new == {
        "target": "https://example.org/forms/new|1.0.0",
        "label": "New",
    }
    assert fallback == {
        "target": "https://example.org/forms/general|1.0.0",
        "label": "General",
        "extensions": {"x-route-kind": "fallback"},
    }


def test_screener_answers_are_not_written_into_main_form_data() -> None:
    evaluator = DefinitionEvaluator(_definition_with_screener())

    evaluator.evaluate_screener({"orgType": "nonprofit", "isReturning": True})
    result = evaluator.process({"applicantName": "Ada"})

    assert result.data == {"applicantName": "Ada"}
    assert "orgType" not in result.data
    assert "isReturning" not in result.data
