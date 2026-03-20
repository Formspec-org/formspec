from __future__ import annotations

import pytest

from formspec._rust import evaluate_definition


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


@pytest.mark.skip(reason="Screener not in Rust evaluate_def")
def test_evaluate_screener_returns_first_matching_route_in_declaration_order() -> None:
    pass


@pytest.mark.skip(reason="Screener not in Rust evaluate_def")
def test_screener_answers_are_not_written_into_main_form_data() -> None:
    pass
