"""Cross-runtime fuzzing for ADR 0035.

These tests generate randomized cases and compare Python runtime behavior
against formspec-engine behavior executed through Node runners.
"""

from __future__ import annotations

import json
import random
import subprocess
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from formspec._rust import evaluate_definition
from formspec.fel import evaluate
from formspec.fel.types import to_python


ROOT_DIR = Path(__file__).resolve().parents[3]
FEL_RUNNER = ROOT_DIR / "tests" / "conformance" / "fuzzing" / "fel_cross_runtime_runner.mjs"
PROCESSING_RUNNER = ROOT_DIR / "tests" / "conformance" / "fuzzing" / "processing_cross_runtime_runner.mjs"
ENGINE_DIST_ENTRY = ROOT_DIR / "packages" / "formspec-engine" / "dist" / "index.js"


def _node_available() -> bool:
    try:
        probe = subprocess.run(["node", "--version"], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return False
    return probe.returncode == 0


pytestmark = pytest.mark.skipif(
    not _node_available() or not ENGINE_DIST_ENTRY.is_file(),
    reason="Node runtime or formspec-engine dist build is unavailable",
)


def _normalize_decimal(value: Decimal) -> str:
    normalized = value.normalize()
    text = format(normalized, "f")
    return "0" if text == "-0" else text


def _normalize_number(value: float | int) -> float | int | str:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if value != value or value in (float("inf"), float("-inf")):
        return str(value)
    if value == 0:
        return 0
    return float(f"{value:.12g}")


def _result_sort_key(result: dict[str, Any]) -> str:
    return "|".join(
        str(result.get(part, ""))
        for part in ("path", "code", "severity", "constraintKind", "shapeId", "source", "sourceId")
    )


def _normalize_json(value: Any, *, parent_key: str | None = None) -> Any:
    if isinstance(value, Decimal):
        return _normalize_decimal(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float):
        return _normalize_number(value)
    if isinstance(value, list):
        normalized = [_normalize_json(item, parent_key=parent_key) for item in value]
        if parent_key in {"results", "validationResults"}:
            normalized = sorted(normalized, key=lambda item: _result_sort_key(item if isinstance(item, dict) else {}))
        return normalized
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key in sorted(value.keys()):
            if key in {"timestamp", "authored", "kind"}:
                continue
            out[key] = _normalize_json(value[key], parent_key=key)
        return out
    if value is None:
        return None
    return value


def _run_node_cases(runner_path: Path, cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    proc = subprocess.run(
        ["node", str(runner_path)],
        input=json.dumps({"cases": cases}),
        text=True,
        capture_output=True,
        cwd=str(ROOT_DIR),
        check=False,
    )
    if proc.returncode != 0:
        pytest.fail(
            "\n".join(
                [
                    f"Node runner failed: {runner_path.name}",
                    f"returncode: {proc.returncode}",
                    f"stderr: {proc.stderr.strip()}",
                    f"stdout: {proc.stdout.strip()}",
                ]
            )
        )
    parsed = json.loads(proc.stdout)
    results = parsed.get("results")
    assert isinstance(results, list), f"{runner_path.name} did not return a results list"
    return results


def _compare_fel_values(comparator: str, py_value: Any, node_value: Any) -> tuple[bool, str]:
    def as_float_or_none(value: Any) -> float | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float, Decimal)):
            try:
                return float(value)
            except Exception:
                return None
        if isinstance(value, str):
            try:
                return float(value)
            except Exception:
                return None
        return None

    if comparator == "tolerant-decimal":
        left = as_float_or_none(py_value)
        right = as_float_or_none(node_value)
        if left is not None and right is not None:
            diff = abs(left - right)
            return (diff <= 1e-9, f"diff={diff}")
    else:
        left = as_float_or_none(py_value)
        right = as_float_or_none(node_value)
        if left is not None and right is not None:
            diff = abs(left - right)
            return (diff <= 1e-12, f"numeric-diff={diff}")

    normalized_left = _normalize_json(py_value)
    normalized_right = _normalize_json(node_value)
    return (normalized_left == normalized_right, "normalized-compare")


def _canonicalize_report(report: dict[str, Any]) -> dict[str, Any]:
    canonical_results: list[dict[str, Any]] = []
    for result in report.get("results", []):
        if not isinstance(result, dict):
            continue
        entry = {
            "code": result.get("code"),
            "path": result.get("path"),
            "severity": result.get("severity"),
            "constraintKind": result.get("constraintKind"),
            "shapeId": result.get("shapeId"),
            "source": result.get("source"),
            "sourceId": result.get("sourceId"),
        }
        canonical_results.append({k: v for k, v in entry.items() if v is not None})

    return _normalize_json(
        {
            "valid": report.get("valid"),
            "counts": report.get("counts", {}),
            "results": canonical_results,
        }
    )


def _random_word(rng: random.Random) -> str:
    alphabet = "abcdefghijklmnopqrstuvwxyz"
    return "".join(rng.choice(alphabet) for _ in range(rng.randint(3, 8)))


def _build_fel_case(case_index: int, rng: random.Random) -> dict[str, Any]:
    template = rng.choice(
        [
            "add",
            "subtract",
            "multiply",
            "if_bool",
            "coalesce",
            "membership",
            "date_compare",
            "string_concat",
            "abs",
            "number_string_roundtrip",
        ]
    )
    case_id = f"fuzz.fel.{case_index:04d}"

    if template == "add":
        a = rng.randint(-5000, 5000)
        b = rng.randint(-5000, 5000)
        return {
            "id": case_id,
            "expression": "a + b",
            "comparator": "tolerant-decimal",
            "fields": [
                {"key": "a", "dataType": "integer", "value": a},
                {"key": "b", "dataType": "integer", "value": b},
            ],
        }
    if template == "subtract":
        a = rng.randint(-5000, 5000)
        b = rng.randint(-5000, 5000)
        return {
            "id": case_id,
            "expression": "a - b",
            "comparator": "tolerant-decimal",
            "fields": [
                {"key": "a", "dataType": "integer", "value": a},
                {"key": "b", "dataType": "integer", "value": b},
            ],
        }
    if template == "multiply":
        a = rng.randint(-500, 500)
        b = rng.randint(-500, 500)
        return {
            "id": case_id,
            "expression": "a * b",
            "comparator": "tolerant-decimal",
            "fields": [
                {"key": "a", "dataType": "integer", "value": a},
                {"key": "b", "dataType": "integer", "value": b},
            ],
        }
    if template == "if_bool":
        a = rng.randint(-1000, 1000)
        b = rng.randint(-1000, 1000)
        flag = rng.choice([True, False])
        return {
            "id": case_id,
            "expression": "if(flag, a, b)",
            "comparator": "exact",
            "fields": [
                {"key": "flag", "dataType": "boolean", "value": flag},
                {"key": "a", "dataType": "integer", "value": a},
                {"key": "b", "dataType": "integer", "value": b},
            ],
        }
    if template == "coalesce":
        x = rng.choice([None, rng.randint(-1000, 1000)])
        y = rng.choice([None, rng.randint(-1000, 1000)])
        return {
            "id": case_id,
            "expression": "coalesce(x, y, 0)",
            "comparator": "exact",
            "fields": [
                {"key": "x", "dataType": "integer", "value": x},
                {"key": "y", "dataType": "integer", "value": y},
            ],
        }
    if template == "membership":
        tags = rng.sample(["new", "priority", "followup", "urgent"], k=rng.randint(1, 4))
        return {
            "id": case_id,
            "expression": "'priority' in tags",
            "comparator": "exact",
            "fields": [
                {"key": "tags", "dataType": "multiChoice", "value": tags},
            ],
        }
    if template == "date_compare":
        base = date(2026, 1, 1) + timedelta(days=rng.randint(0, 365))
        end = base + timedelta(days=rng.randint(-20, 20))
        return {
            "id": case_id,
            "expression": "endDate >= startDate",
            "comparator": "exact",
            "fields": [
                {"key": "startDate", "dataType": "date", "value": base.isoformat()},
                {"key": "endDate", "dataType": "date", "value": end.isoformat()},
            ],
        }
    if template == "string_concat":
        left = _random_word(rng)
        right = _random_word(rng)
        return {
            "id": case_id,
            "expression": "left & '-' & right",
            "comparator": "exact",
            "fields": [
                {"key": "left", "dataType": "string", "value": left},
                {"key": "right", "dataType": "string", "value": right},
            ],
        }
    if template == "abs":
        a = rng.randint(-1000, 1000)
        return {
            "id": case_id,
            "expression": "abs(a)",
            "comparator": "tolerant-decimal",
            "fields": [
                {"key": "a", "dataType": "integer", "value": a},
            ],
        }

    a = rng.randint(-1000, 1000)
    return {
        "id": case_id,
        "expression": "number(string(a))",
        "comparator": "tolerant-decimal",
        "fields": [
            {"key": "a", "dataType": "integer", "value": a},
        ],
    }


def _processing_definition() -> dict[str, Any]:
    return {
        "$formspec": "1.0",
        "url": "https://example.org/forms/fuzz-processing",
        "version": "1.0.0",
        "status": "active",
        "title": "Fuzz Processing",
        "items": [
            {"key": "age", "type": "field", "label": "Age", "dataType": "integer"},
            {"key": "consent", "type": "field", "label": "Consent", "dataType": "boolean"},
            {"key": "score", "type": "field", "label": "Score", "dataType": "decimal"},
            {"key": "band", "type": "field", "label": "Band", "dataType": "string"},
        ],
        "binds": [
            {"path": "age", "required": "true", "constraint": "age >= 0 and age <= 120"},
            {"path": "score", "required": "true", "constraint": "score >= 0 and score <= 100"},
            {"path": "consent", "required": "age >= 18"},
            {
                "path": "band",
                "calculate": "if(score >= 80, 'high', if(score >= 50, 'mid', 'low'))",
            },
        ],
        "shapes": [
            {
                "id": "adult_consent",
                "target": "#",
                "constraint": "(age < 18) or (consent = true)",
                "message": "Adults must provide consent",
                "severity": "error",
            }
        ],
    }


def _build_processing_case(case_index: int, rng: random.Random, definition: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {}

    if rng.random() < 0.9:
        payload["age"] = rng.choice([None, rng.randint(-20, 140)])
    if rng.random() < 0.9:
        payload["score"] = rng.choice([None, round(rng.uniform(-25, 125), 2)])
    payload["consent"] = rng.choice([True, False])

    return {
        "id": f"fuzz.processing.{case_index:04d}",
        "definition": definition,
        "payload": payload,
        "mode": "submit",
    }


def test_cross_runtime_fel_fuzzing_cases_agree() -> None:
    rng = random.Random(20260310)
    cases = [_build_fel_case(i, rng) for i in range(240)]
    node_results = _run_node_cases(FEL_RUNNER, cases)
    node_by_id = {result["id"]: result for result in node_results}

    failures: list[dict[str, Any]] = []
    for case_doc in cases:
        node_result = node_by_id.get(case_doc["id"])
        if not node_result:
            failures.append({"id": case_doc["id"], "reason": "missing-node-result"})
            continue
        if not node_result.get("ok"):
            failures.append({"id": case_doc["id"], "reason": "node-error", "node": node_result})
            continue

        data = {field["key"]: field.get("value") for field in case_doc["fields"]}
        py_eval = evaluate(case_doc["expression"], data)
        py_value = _normalize_json(to_python(py_eval.value))
        node_value = _normalize_json(node_result.get("value"))
        matched, detail = _compare_fel_values(case_doc["comparator"], py_value, node_value)
        if not matched:
            failures.append(
                {
                    "id": case_doc["id"],
                    "expression": case_doc["expression"],
                    "comparator": case_doc["comparator"],
                    "detail": detail,
                    "python": py_value,
                    "node": node_value,
                }
            )

    assert not failures, json.dumps(failures[:5], indent=2)


def test_cross_runtime_processing_fuzzing_cases_agree() -> None:
    rng = random.Random(20260311)
    definition = _processing_definition()
    cases = [_build_processing_case(i, rng, definition) for i in range(160)]
    node_results = _run_node_cases(PROCESSING_RUNNER, cases)
    node_by_id = {result["id"]: result for result in node_results}

    failures: list[dict[str, Any]] = []

    for case_doc in cases:
        node_result = node_by_id.get(case_doc["id"])
        if not node_result:
            failures.append({"id": case_doc["id"], "reason": "missing-node-result"})
            continue
        if not node_result.get("ok"):
            failures.append({"id": case_doc["id"], "reason": "node-error", "node": node_result})
            continue

        py_result = evaluate_definition(definition, case_doc["payload"])
        # Compute counts from results list
        counts: dict[str, int] = {}
        for r in py_result.results:
            sev = r.get("severity", "error") if isinstance(r, dict) else "error"
            counts[sev] = counts.get(sev, 0) + 1
        py_report = _canonicalize_report(
            {
                "valid": py_result.valid,
                "counts": counts,
                "results": py_result.results,
            }
        )
        node_report = _canonicalize_report(node_result.get("report", {}))
        if py_report != node_report:
            failures.append(
                {
                    "id": case_doc["id"],
                    "payload": case_doc["payload"],
                    "python": py_report,
                    "node": node_report,
                }
            )

    assert not failures, json.dumps(failures[:5], indent=2)
