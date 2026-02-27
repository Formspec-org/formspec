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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from formspec.validator.linter import lint
from formspec.mapping.engine import MappingEngine
from formspec.fel import evaluate
from formspec.fel.types import to_python
from formspec.evaluator import DefinitionEvaluator

EXAMPLE_DIR = Path(__file__).resolve().parent.parent
DEFINITION_PATH = EXAMPLE_DIR / "definition.json"
MAPPING_PATH = EXAMPLE_DIR / "mapping.json"

_definition: dict = json.loads(DEFINITION_PATH.read_text())
_mapping_doc: dict = json.loads(MAPPING_PATH.read_text())
_mapping_engine = MappingEngine(_mapping_doc)
_evaluator = DefinitionEvaluator(_definition)

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


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/definition")
def get_definition():
    return _definition


def _check_constraint(
    expression: str,
    field_data: dict,
    path: str,
    message: str,
    code: str,
    out: list,
) -> None:
    result = evaluate(expression, field_data)
    value = to_python(result.value)
    if value is False:
        out.append({
            "severity": "error",
            "path": path,
            "message": message,
            "constraintKind": "constraint",
            "code": code,
            "source": "bind",
        })


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

    data = request.data
    validation_results: list[dict] = []

    # Bind-level constraint re-validation (server-side defence-in-depth)
    applicant = data.get("applicantInfo", {})
    narrative = data.get("projectNarrative", {})

    # EIN format — use character class regex since FEL doesn't support \d shorthand
    if applicant.get("ein"):
        _check_constraint(
            r"matches($ein, '^[0-9]{2}-[0-9]{7}$')",
            {"ein": applicant["ein"]},
            "applicantInfo.ein",
            "EIN must be in the format XX-XXXXXXX.",
            "CONSTRAINT_FAILED",
            validation_results,
        )

    # Date ordering
    if narrative.get("startDate") and narrative.get("endDate"):
        _check_constraint(
            "$endDate > $startDate",
            {"startDate": narrative["startDate"], "endDate": narrative["endDate"]},
            "projectNarrative.endDate",
            "End date must be after start date.",
            "CONSTRAINT_FAILED",
            validation_results,
        )

    # Shape constraints — evaluated directly from the definition
    validation_results.extend(_evaluator.validate(data))

    mapped = _mapping_engine.forward(data)
    valid = not any(r["severity"] == "error" for r in validation_results)

    return SubmitResponse(
        valid=valid,
        validationResults=validation_results,
        mapped=mapped,
        diagnostics=diagnostics,
    )
