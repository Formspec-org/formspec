from __future__ import annotations

import json
import math
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from formspec.evaluator import DefinitionEvaluator
from formspec.fel import Environment, Evaluator, build_default_registry, parse
from formspec.fel.types import to_python
from formspec.registry import Registry


ROOT_DIR = Path(__file__).resolve().parents[3]
SUITE_DIR = ROOT_DIR / "tests" / "conformance" / "suite"
SUITE_SCHEMA_PATH = ROOT_DIR / "schemas" / "conformance-suite.schema.json"
REAL_EXAMPLES_MANIFEST_PATH = SUITE_DIR / "real-examples.manifest.json"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_suite_schema_validator() -> Draft202012Validator:
    return Draft202012Validator(_load_json(SUITE_SCHEMA_PATH))


def _load_real_examples_manifest() -> dict[str, Any]:
    return _load_json(REAL_EXAMPLES_MANIFEST_PATH)


def _discover_case_paths() -> list[Path]:
    return sorted(
        path for path in SUITE_DIR.glob("*.json") if path.name != REAL_EXAMPLES_MANIFEST_PATH.name
    )


def _result_sort_key(result: dict[str, Any]) -> str:
    return "|".join(
        str(result.get(part, ""))
        for part in ("path", "code", "severity", "constraintKind", "shapeId", "source", "sourceId")
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
    if math.isnan(value) or math.isinf(value):
        return str(value)
    if value == 0:
        return 0
    return float(f"{value:.12g}")


def _normalize_json(value: Any, *, parent_key: str | None = None) -> Any:
    if isinstance(value, Decimal):
        return _normalize_decimal(value)
    if isinstance(value, (datetime, date)):
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
    return value


def _compare_fel_values(comparator: str, actual: Any, expected: Any) -> tuple[bool, str]:
    if comparator == "tolerant-decimal":
        if (
            isinstance(actual, (int, float, Decimal))
            and not isinstance(actual, bool)
            and isinstance(expected, (int, float, Decimal))
            and not isinstance(expected, bool)
        ):
            diff = abs(float(actual) - float(expected))
            return (diff <= 1e-9, f"diff={diff}")
        return (
            _normalize_json(actual) == _normalize_json(expected),
            "fallback-normalized-compare",
        )

    if comparator == "normalized":
        return (
            _normalize_json(actual) == _normalize_json(expected),
            "normalized-json-compare",
        )

    return (
        _normalize_json(actual) == _normalize_json(expected),
        "exact-json-compare",
    )


def _load_payload(case_doc: dict[str, Any]) -> Any:
    if "payloadPath" in case_doc:
        payload = _load_json(ROOT_DIR / case_doc["payloadPath"])
    else:
        payload = case_doc.get("inputData")

    if isinstance(payload, dict) and "data" in payload and any(
        key in payload for key in ("definitionUrl", "definitionVersion", "validationResults", "status")
    ):
        return payload["data"]
    return payload


def _load_definition(case_doc: dict[str, Any]) -> dict[str, Any]:
    definition_path = case_doc.get("definitionPath")
    if not definition_path:
        raise ValueError("definitionPath is required for this case kind")
    return _load_json(ROOT_DIR / definition_path)


def _load_registries(case_doc: dict[str, Any]) -> list[Registry]:
    registries: list[Registry] = []
    for rel_path in case_doc.get("registryPaths", []):
        registries.append(Registry(_load_json(ROOT_DIR / rel_path)))
    return registries


def _run_fel_case(case_doc: dict[str, Any]) -> dict[str, Any]:
    values = {field["key"]: field.get("value") for field in case_doc.get("fields", [])}
    expression = case_doc["expression"]
    env = Environment(data=values)
    evaluator = Evaluator(env, build_default_registry())
    value = to_python(evaluator.evaluate(parse(expression)))
    return {"value": value}


def _run_processing_case(case_doc: dict[str, Any]) -> dict[str, Any]:
    evaluator = DefinitionEvaluator(_load_definition(case_doc), registries=_load_registries(case_doc))
    mode = case_doc.get("mode", "submit")
    payload = _load_payload(case_doc)
    result = evaluator.process(payload, mode=mode)
    return {
        "valid": result.valid,
        "counts": result.counts,
        "results": result.results,
        "data": result.data,
    }


def _run_validation_report_case(case_doc: dict[str, Any]) -> dict[str, Any]:
    processing = _run_processing_case(case_doc)
    return {
        "valid": processing["valid"],
        "counts": processing["counts"],
        "results": processing["results"],
    }


def _run_response_validation_case(case_doc: dict[str, Any]) -> dict[str, Any]:
    processing = _run_processing_case(case_doc)
    response: dict[str, Any] = {"validationResults": processing["results"]}
    if case_doc.get("compareResponseData"):
        response["data"] = processing["data"]
    return {
        "report": {
            "valid": processing["valid"],
            "counts": processing["counts"],
            "results": processing["results"],
        },
        "response": response,
    }


def _run_case(case_doc: dict[str, Any]) -> dict[str, Any]:
    kind = case_doc["kind"]
    if kind == "FEL_EVALUATION":
        return _run_fel_case(case_doc)
    if kind == "ENGINE_PROCESSING":
        return _run_processing_case(case_doc)
    if kind == "VALIDATION_REPORT":
        return _run_validation_report_case(case_doc)
    if kind == "RESPONSE_VALIDATION":
        return _run_response_validation_case(case_doc)
    raise ValueError(f"Unsupported case kind: {kind}")


CASE_PATHS = _discover_case_paths()


def test_shared_suite_manifest_references_existing_example_cases() -> None:
    manifest = _load_real_examples_manifest()
    listed = set(manifest.get("caseFiles", []))
    assert listed
    for rel_name in listed:
        assert (SUITE_DIR / rel_name).is_file(), rel_name


def test_shared_suite_case_ids_are_unique() -> None:
    ids: set[str] = set()
    validator = _load_suite_schema_validator()
    for path in CASE_PATHS:
        doc = _load_json(path)
        validator.validate(doc)
        case_id = doc["id"]
        assert case_id not in ids, case_id
        ids.add(case_id)


@pytest.mark.parametrize("case_path", CASE_PATHS, ids=lambda p: p.stem)
def test_shared_suite_case(case_path: Path) -> None:
    case_doc = _load_json(case_path)
    _load_suite_schema_validator().validate(case_doc)

    manifest = _load_real_examples_manifest()
    listed_examples = set(manifest.get("caseFiles", []))
    definition_path = case_doc.get("definitionPath", "")
    if isinstance(definition_path, str) and definition_path.startswith("examples/"):
        assert case_path.name in listed_examples, (
            f"{case_path.name} uses an examples/ definition and must be listed in "
            "tests/conformance/suite/real-examples.manifest.json"
        )

    if case_doc["kind"] == "FEL_EVALUATION":
        actual_fel = _run_case(case_doc)
        expected_fel = case_doc["expected"]
        actual_value = actual_fel.get("value")
        expected_value = expected_fel.get("value")
        matched, detail = _compare_fel_values(case_doc["comparator"], actual_value, expected_value)
        if not matched:
            pytest.fail(
                "\n".join(
                    [
                        f"Shared suite FEL mismatch for {case_doc['id']} ({case_doc['kind']})",
                        f"comparator: {case_doc['comparator']} ({detail})",
                        f"legacyCoverage: {json.dumps(case_doc['legacyCoverage'], indent=2)}",
                        f"actual: {json.dumps(_normalize_json(actual_fel), indent=2, default=str)}",
                        f"expected: {json.dumps(_normalize_json(expected_fel), indent=2, default=str)}",
                    ]
                )
            )
        return

    actual = _normalize_json(_run_case(case_doc))
    expected = _normalize_json(case_doc["expected"])
    if actual != expected:
        pytest.fail(
            "\n".join(
                [
                    f"Shared suite mismatch for {case_doc['id']} ({case_doc['kind']})",
                    f"legacyCoverage: {json.dumps(case_doc['legacyCoverage'], indent=2)}",
                    f"actual: {json.dumps(actual, indent=2, default=str)}",
                    f"expected: {json.dumps(expected, indent=2, default=str)}",
                ]
            )
        )
