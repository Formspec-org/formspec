"""Formspec Reference Server — serves any example in the examples/ directory.

Run from repo root:
    PYTHONPATH=src uvicorn examples.refrences.server.main:app --reload --port 8000

Or from the server directory:
    PYTHONPATH=../../../src uvicorn main:app --reload --port 8000
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "src"))

from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from formspec.changelog import generate_changelog
from formspec.registry import Registry
from formspec.validator.linter import lint
from formspec.validator.schema import SchemaValidator
from formspec.mapping.engine import MappingEngine
from formspec.adapters import get_adapter
from formspec.evaluator import DefinitionEvaluator
from formspec.fel import evaluate as fel_evaluate, extract_dependencies, to_python, typeof, FelSyntaxError


# ── Example discovery ──
EXAMPLES_DIR = Path(__file__).resolve().parents[1].parent

_CONTENT_TYPES = {"json": "application/json", "csv": "text/csv", "xml": "application/xml"}


def _safe_examples_path(rel: str) -> Path:
    """Resolve a relative path under EXAMPLES_DIR, rejecting traversal."""
    base = EXAMPLES_DIR.resolve()
    p = (EXAMPLES_DIR / rel).resolve()
    if not str(p).startswith(str(base) + os.sep):
        raise HTTPException(status_code=400, detail="Invalid artifact path")
    return p


_json_cache: dict[Path, dict] = {}


def _load_json(path: Path) -> dict:
    """Load JSON from disk with a simple in-memory cache."""
    if path in _json_cache:
        return _json_cache[path]
    doc = json.loads(path.read_text())
    _json_cache[path] = doc
    return doc


def _build_indices() -> tuple[dict[str, Path], dict[str, list[Path]]]:
    """Index definition urls and mapping docs across examples/* (excluding the refrences app itself)."""
    sv = SchemaValidator()
    defs_by_url: dict[str, Path] = {}
    mappings_by_defref: dict[str, list[Path]] = {}

    for ex_dir in EXAMPLES_DIR.iterdir():
        if not ex_dir.is_dir():
            continue
        if ex_dir.name == "refrences":
            continue
        for f in sorted(ex_dir.glob("*.json")):
            try:
                doc = _load_json(f)
            except Exception:
                continue
            dtype = sv.detect_document_type(doc)
            if dtype == "definition":
                url = doc.get("url")
                if isinstance(url, str) and url:
                    defs_by_url[url] = f
            elif dtype == "mapping":
                ref = doc.get("definitionRef")
                if isinstance(ref, str) and ref:
                    mappings_by_defref.setdefault(ref, []).append(f)

    return defs_by_url, mappings_by_defref


DEFS_BY_URL, MAPPINGS_BY_DEFREF = _build_indices()


def _load_definition_from_query(definition_file: str | None, definition_url: str | None) -> dict:
    if definition_file:
        path = _safe_examples_path(definition_file)
        return _load_json(path)
    if definition_url:
        path = DEFS_BY_URL.get(definition_url)
        if not path:
            raise HTTPException(status_code=404, detail=f"Definition not found for URL: {definition_url}")
        return _load_json(path)

    # Default: grant-application
    return _load_json(_safe_examples_path("grant-application/definition.json"))


def _load_mapping_doc(mapping_file: str | None, definition_url: str | None) -> dict | None:
    if mapping_file:
        path = _safe_examples_path(mapping_file)
        return _load_json(path)
    if definition_url:
        candidates = MAPPINGS_BY_DEFREF.get(definition_url, [])
        if candidates:
            # Prefer a file literally named 'mapping.json' if present.
            for c in candidates:
                if c.name == "mapping.json":
                    return _load_json(c)
            return _load_json(candidates[0])
    return None


REGISTRIES_DIR = _REPO_ROOT / "registries"


def _load_registry_doc(registry_file: str | None) -> dict | None:
    if not registry_file:
        return None
    # Check repo-root registries/ dir first
    reg_path = (REGISTRIES_DIR / registry_file).resolve()
    if str(reg_path).startswith(str(REGISTRIES_DIR.resolve()) + os.sep) and reg_path.exists():
        return _load_json(reg_path)
    path = _safe_examples_path(registry_file)
    return _load_json(path)

app = FastAPI(title="Formspec Reference Server")

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
    """Canonical ValidationReport shape (valid, results, counts, timestamp,
    definitionUrl, definitionVersion) plus server-only extras (mapped, diagnostics)."""
    definitionUrl: str
    definitionVersion: str
    valid: bool
    results: list[dict]
    counts: dict[str, int]
    timestamp: str
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


class ChangelogRequest(BaseModel):
    old: dict
    new: dict


def _json_safe(val: Any) -> Any:
    from decimal import Decimal
    if isinstance(val, Decimal):
        return int(val) if val == val.to_integral_value() else float(val)
    return val


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/definition")
def get_definition(definitionFile: str | None = None, definitionUrl: str | None = None):
    return _load_definition_from_query(definitionFile, definitionUrl)


@app.get("/api/prior-year-data")
def prior_year_data():
    return {
        "priorAwardAmount": 250000,
        "performanceRating": "satisfactory",
        "programYear": "FY2025",
        "completionRate": 0.92,
        "reportingStatus": "compliant",
    }


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
def export(
    format: str,
    request: ExportRequest,
    mappingFile: str | None = None,
    definitionFile: str | None = None,
    definitionUrl: str | None = None,
):
    if format not in _CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Use json, csv, or xml.")

    definition = _load_definition_from_query(definitionFile, definitionUrl)
    mapping_doc = _load_mapping_doc(mappingFile, definition.get("url"))
    if not mapping_doc:
        raise HTTPException(status_code=400, detail="No mapping document specified or discoverable for this definition.")

    engine = MappingEngine(mapping_doc)
    mapped = engine.forward(request.data)

    adapter_config = mapping_doc.get("adapters", {}).get(format)
    target_schema = mapping_doc.get("targetSchema")
    adapter = get_adapter(format, config=adapter_config, target_schema=target_schema)
    content = adapter.serialize(mapped)
    return Response(content=content, media_type=_CONTENT_TYPES[format])


@app.post("/submit", response_model=SubmitResponse)
def submit(request: SubmitRequest):
    definition = _load_definition_from_query(None, request.definitionUrl)
    mapping_doc = _load_mapping_doc(None, request.definitionUrl)

    # Load registry for extension constraint enforcement
    reg_doc = _load_registry_doc("formspec-common.registry.json")
    registries = [Registry(reg_doc)] if reg_doc else []

    evaluator = DefinitionEvaluator(definition, registries=registries)
    mapping_engine = MappingEngine(mapping_doc) if mapping_doc else None

    registry_documents = [reg_doc] if reg_doc else []
    lint_diags = lint(definition, mode="authoring", registry_documents=registry_documents)
    diagnostics = [
        f"[{d.severity}] {d.path or '(root)'}: {d.message}"
        for d in lint_diags
        if d.severity in ("error", "warning")
    ]

    result = evaluator.process(request.data)
    mapped = mapping_engine.forward(result.data) if mapping_engine else {}

    return SubmitResponse(
        definitionUrl=request.definitionUrl,
        definitionVersion=request.definitionVersion,
        valid=result.valid,
        results=result.results,
        counts=result.counts,
        timestamp=datetime.now(timezone.utc).isoformat(),
        mapped=mapped,
        diagnostics=diagnostics,
    )


@app.get("/registry/validate")
def registry_validate(registryFile: str | None = None):
    reg_doc = _load_registry_doc(registryFile)
    if not reg_doc:
        return {"errors": ["No registry loaded"]}
    return {"errors": Registry(reg_doc).validate()}


@app.get("/registry")
def registry(
    registryFile: str | None = None,
    name: str | None = None,
    category: str | None = None,
    status: str | None = None,
):
    reg_doc = _load_registry_doc(registryFile)
    if not reg_doc:
        return {"entries": []}
    reg = Registry(reg_doc)
    if name:
        entries = reg.find(name, category=category, status=status)
    elif category:
        entries = reg.list_by_category(category)
    elif status:
        entries = reg.list_by_status(status)
    else:
        entries = reg.entries
    return {"entries": [e.raw for e in entries]}


@app.get("/dependencies")
def dependencies(definitionFile: str | None = None, definitionUrl: str | None = None):
    definition = _load_definition_from_query(definitionFile, definitionUrl)
    graph = {}
    for bind in definition.get("binds", []):
        path = bind.get("path", "")
        for expr_key in ("calculate", "relevant", "constraint", "required", "readonly"):
            expr = bind.get(expr_key)
            if not expr:
                continue
            try:
                deps = extract_dependencies(expr)
                key = path if expr_key == "calculate" else f"{path}.{expr_key}"
                graph[key] = {
                    "depends_on": sorted(deps.fields),
                    "expression": expr,
                }
            except Exception:
                pass
    return graph


@app.post("/changelog")
def changelog(request: ChangelogRequest):
    url = request.new.get("url", request.old.get("url", ""))
    return generate_changelog(request.old, request.new, url)
