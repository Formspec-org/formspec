from __future__ import annotations

import pytest

from formspec._rust import evaluate_definition, evaluate_screener


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
    defn = _definition_with_screener()
    # Both conditions match: nonprofit AND returning.
    # The first route ("Returning") should win because it appears first.
    answers = {"orgType": "nonprofit", "isReturning": True}
    result = evaluate_screener(defn, answers)
    assert result is not None
    assert result["target"] == "https://example.org/forms/returning|1.0.0"
    assert result["label"] == "Returning"

    # Only nonprofit — second route matches first.
    answers2 = {"orgType": "nonprofit", "isReturning": False}
    result2 = evaluate_screener(defn, answers2)
    assert result2 is not None
    assert result2["target"] == "https://example.org/forms/new|1.0.0"
    assert result2["label"] == "New"

    # Fallback — no specific match.
    answers3 = {"orgType": "forprofit"}
    result3 = evaluate_screener(defn, answers3)
    assert result3 is not None
    assert result3["target"] == "https://example.org/forms/general|1.0.0"


def test_screener_answers_are_not_written_into_main_form_data() -> None:
    defn = _definition_with_screener()
    answers = {"orgType": "nonprofit", "isReturning": True}

    # Run screener
    route = evaluate_screener(defn, answers)
    assert route is not None

    # Now evaluate the main form with empty data.
    # Screener answers must NOT appear in the output.
    result = evaluate_definition(defn, {})
    assert "orgType" not in result.data
    assert "isReturning" not in result.data
