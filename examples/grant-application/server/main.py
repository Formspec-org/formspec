"""Grant Application — Formspec reference server.

Run from repo root:
    PYTHONPATH=src uvicorn examples.grant_application.server.main:app --reload --port 8000

Or from the server directory:
    PYTHONPATH=../../../src uvicorn main:app --reload --port 8000
"""

import json
import sys
from pathlib import Path

# Allow running from the examples directory or repo root
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "src"))

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from formspec.validator.linter import lint
from formspec.mapping.engine import MappingEngine
from formspec.adapters import get_adapter
from formspec.evaluator import DefinitionEvaluator
from formspec.fel import evaluate as fel_evaluate, to_python, typeof, FelSyntaxError

EXAMPLE_DIR = Path(__file__).resolve().parent.parent
DEFINITION_PATH = EXAMPLE_DIR / "definition.json"
MAPPING_PATH = EXAMPLE_DIR / "mapping.json"

_definition: dict = json.loads(DEFINITION_PATH.read_text())
_mapping_doc: dict = json.loads(MAPPING_PATH.read_text())
_mapping_engine = MappingEngine(_mapping_doc)
_evaluator = DefinitionEvaluator(_definition)

MAPPING_CSV_PATH = EXAMPLE_DIR / "mapping-csv.json"
MAPPING_XML_PATH = EXAMPLE_DIR / "mapping-xml.json"

_mapping_docs = {
    "json": _mapping_doc,
    "csv": json.loads(MAPPING_CSV_PATH.read_text()),
    "xml": json.loads(MAPPING_XML_PATH.read_text()),
}
_mapping_engines = {fmt: MappingEngine(doc) for fmt, doc in _mapping_docs.items()}

_CONTENT_TYPES = {"json": "application/json", "csv": "text/csv", "xml": "application/xml"}

app = FastAPI(title="Grant Application — Formspec Reference Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SubmitRequest(BaseModel):
    definitionUrl: str
    definitionVersion: str
    status: str
    authored: str
    data: dict
    author: dict | None = None
    subject: dict | None = None


class SubmitResponse(BaseModel):
    valid: bool
    validationResults: list[dict]
    mapped: dict
    diagnostics: list[str]


class EvaluateRequest(BaseModel):
    expression: str
    data: dict


class EvaluateResponse(BaseModel):
    value: Any
    type: str
    diagnostics: list[str]


class ExportRequest(BaseModel):
    data: dict


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/definition")
def get_definition():
    return _definition


@app.get("/api/prior-year-data")
def prior_year_data():
    """Mock prior-year performance data (replaces external agency API)."""
    return {
        "priorAwardAmount": 250000,
        "performanceRating": "satisfactory",
        "programYear": "FY2025",
        "completionRate": 0.92,
        "reportingStatus": "compliant",
    }


def _json_safe(val: Any) -> Any:
    """Convert Decimals to int/float so Pydantic serialises them as JSON numbers."""
    from decimal import Decimal
    if isinstance(val, Decimal):
        return int(val) if val == val.to_integral_value() else float(val)
    return val


@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate(request: EvaluateRequest):
    try:
        result = fel_evaluate(request.expression, data=request.data)
    except FelSyntaxError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)})
    return EvaluateResponse(
        value=_json_safe(to_python(result.value)),
        type=typeof(result.value),
        diagnostics=[str(d) for d in result.diagnostics],
    )


@app.post("/export/{format}")
def export(format: str, request: ExportRequest):
    if format not in _mapping_engines:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Use json, csv, or xml.")
    mapped = _mapping_engines[format].forward(request.data)
    adapter_config = _mapping_docs[format].get("adapters", {}).get(format)
    target_schema = _mapping_docs[format].get("targetSchema")
    adapter = get_adapter(format, config=adapter_config, target_schema=target_schema)
    content = adapter.serialize(mapped)
    return Response(content=content, media_type=_CONTENT_TYPES[format])


@app.post("/submit", response_model=SubmitResponse)
def submit(request: SubmitRequest):
    if request.definitionUrl != _definition["url"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown definition URL: {request.definitionUrl}",
        )

    lint_diags = lint(_definition, mode="authoring")
    diagnostics = [
        f"[{d.severity}] {d.path or '(root)'}: {d.message}"
        for d in lint_diags
        if d.severity in ("error", "warning")
    ]

    result = _evaluator.process(request.data)

    mapped = _mapping_engine.forward(result.data)

    return SubmitResponse(
        valid=result.valid,
        validationResults=result.results,
        mapped=mapped,
        diagnostics=diagnostics,
    )
