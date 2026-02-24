#!/usr/bin/env python3
"""Evaluate FEL parity cases with the Python evaluator.

Input (stdin JSON):
{
  "cases": [
    {"id":"...", "expression":"...", "fields":[{"key":"x","value":1}]}
  ]
}

Output (stdout JSON):
{
  "results": [
    {"id":"...", "ok": true, "value": ...}
  ]
}
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from formspec.fel import Environment, Evaluator, build_default_registry, parse
from formspec.fel.types import to_python


def normalize(value: Any) -> Any:
    if isinstance(value, Decimal):
        # Preserve precision as string for deterministic cross-runtime compare.
        return format(value, "f")
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, list):
        return [normalize(v) for v in value]
    if isinstance(value, dict):
        return {k: normalize(v) for k, v in value.items()}
    return value


def evaluate_case(case: dict[str, Any]) -> dict[str, Any]:
    case_id = case.get("id", "unknown")
    expression = case["expression"]
    data = {f["key"]: f.get("value") for f in case.get("fields", [])}

    try:
        env = Environment(data=data)
        evaluator = Evaluator(env, build_default_registry())
        ast_node = parse(expression)
        value = evaluator.evaluate(ast_node)
        python_value = normalize(to_python(value))

        diagnostics = [
            {
                "severity": d.severity.value if hasattr(d.severity, "value") else str(d.severity),
                "message": d.message,
            }
            for d in evaluator.diagnostics
        ]

        return {
            "id": case_id,
            "ok": True,
            "value": python_value,
            "diagnostics": diagnostics,
        }
    except Exception as exc:  # pragma: no cover - explicit fallback path
        return {
            "id": case_id,
            "ok": False,
            "error": str(exc),
        }


def main() -> int:
    payload = json.load(sys.stdin)
    cases = payload.get("cases", [])
    results = [evaluate_case(case) for case in cases]
    json.dump({"results": results}, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
