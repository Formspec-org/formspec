# Server Backend Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 new endpoints to the grant-application reference server exposing all Formspec Python subsystems (FEL eval, multi-format export, changelog, registry, dependencies).

**Architecture:** Expand `examples/grant-application/server/main.py` with new FastAPI routes. Each endpoint wraps one Formspec subsystem. Tests in `tests/server/test_server.py` using pytest + FastAPI TestClient with existing fixture files.

**Tech Stack:** FastAPI, pytest, httpx (TestClient), formspec Python package.

---

### Task 1: Test scaffold + health check baseline

**Files:**
- Create: `tests/server/__init__.py`
- Create: `tests/server/conftest.py`
- Create: `tests/server/test_health.py`

**Step 1: Create test directory and conftest with TestClient fixture**

```python
# tests/server/__init__.py
(empty)

# tests/server/conftest.py
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure src/ is importable
_REPO = Path(__file__).resolve().parents[2]
if str(_REPO / "src") not in sys.path:
    sys.path.insert(0, str(_REPO / "src"))

from examples.grant_application.server.main import app

@pytest.fixture
def client():
    return TestClient(app)
```

**Step 2: Write a baseline health test**

```python
# tests/server/test_health.py
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}

def test_get_definition(client):
    r = client.get("/definition")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "binds" in body
```

**Step 3: Run tests to verify green**

Run: `python3 -m pytest tests/server/test_health.py -v`
Expected: 2 PASS

**Step 4: Commit**

```
test: add server test scaffold with health check baseline
```

---

### Task 2: POST /evaluate — FEL expression evaluation

**Files:**
- Create: `tests/server/test_evaluate.py`
- Modify: `examples/grant-application/server/main.py`

**Step 1: Write failing tests**

```python
# tests/server/test_evaluate.py
def test_evaluate_simple_arithmetic(client):
    r = client.post("/evaluate", json={
        "expression": "1 + 2",
        "data": {},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["value"] == 3
    assert body["type"] == "number"
    assert body["diagnostics"] == []

def test_evaluate_field_reference(client):
    r = client.post("/evaluate", json={
        "expression": "$price * $quantity",
        "data": {"price": 10, "quantity": 5},
    })
    assert r.status_code == 200
    assert r.json()["value"] == 50

def test_evaluate_string_function(client):
    r = client.post("/evaluate", json={
        "expression": "upper('hello')",
        "data": {},
    })
    assert r.status_code == 200
    assert r.json()["value"] == "HELLO"
    assert r.json()["type"] == "string"

def test_evaluate_syntax_error(client):
    r = client.post("/evaluate", json={
        "expression": "1 + + 2",
        "data": {},
    })
    assert r.status_code == 400
    assert "error" in r.json()

def test_evaluate_missing_expression(client):
    r = client.post("/evaluate", json={"data": {}})
    assert r.status_code == 422
```

**Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/server/test_evaluate.py -v`
Expected: FAIL — 404 (route not found)

**Step 3: Implement the endpoint**

Add to `main.py`:

```python
from formspec.fel import evaluate as fel_evaluate, to_python, typeof, FelSyntaxError

class EvaluateRequest(BaseModel):
    expression: str
    data: dict

class EvaluateResponse(BaseModel):
    value: Any
    type: str
    diagnostics: list[str]

@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate(request: EvaluateRequest):
    try:
        result = fel_evaluate(request.expression, data=request.data)
    except FelSyntaxError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)})
    return EvaluateResponse(
        value=to_python(result.value),
        type=typeof(result.value),
        diagnostics=[str(d) for d in result.diagnostics],
    )
```

**Step 4: Run tests to verify green**

Run: `python3 -m pytest tests/server/test_evaluate.py -v`
Expected: 5 PASS

**Step 5: Commit**

```
feat(server): add POST /evaluate endpoint for FEL expression evaluation
```

---

### Task 3: POST /export/{format} — Multi-format export

**Files:**
- Create: `tests/server/test_export.py`
- Modify: `examples/grant-application/server/main.py`

**Step 1: Write failing tests**

```python
# tests/server/test_export.py
import json

def test_export_json(client):
    r = client.post("/export/json", json={"data": {"applicantInfo": {"orgName": "Test Org"}}})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")

def test_export_csv(client):
    r = client.post("/export/csv", json={"data": {"applicantInfo": {"orgName": "Test Org"}}})
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]

def test_export_xml(client):
    r = client.post("/export/xml", json={"data": {"applicantInfo": {"orgName": "Test Org"}}})
    assert r.status_code == 200
    assert "xml" in r.headers["content-type"]

def test_export_invalid_format(client):
    r = client.post("/export/yaml", json={"data": {}})
    assert r.status_code == 400
```

**Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/server/test_export.py -v`
Expected: FAIL — 404/405

**Step 3: Implement the endpoint**

Add to `main.py` — load all three mapping docs at startup, then route by format:

```python
from fastapi.responses import Response
from formspec.adapters import get_adapter

MAPPING_CSV_PATH = EXAMPLE_DIR / "mapping-csv.json"
MAPPING_XML_PATH = EXAMPLE_DIR / "mapping-xml.json"

_mapping_docs = {
    "json": json.loads(MAPPING_PATH.read_text()),
    "csv": json.loads(MAPPING_CSV_PATH.read_text()),
    "xml": json.loads(MAPPING_XML_PATH.read_text()),
}
_mapping_engines = {fmt: MappingEngine(doc) for fmt, doc in _mapping_docs.items()}

_CONTENT_TYPES = {"json": "application/json", "csv": "text/csv", "xml": "application/xml"}

class ExportRequest(BaseModel):
    data: dict

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
```

**Step 4: Run tests to verify green**

Run: `python3 -m pytest tests/server/test_export.py -v`
Expected: 4 PASS

**Step 5: Commit**

```
feat(server): add POST /export/{format} endpoint for JSON/CSV/XML export
```

---

### Task 4: POST /changelog — Definition version diffing

**Files:**
- Create: `tests/server/test_changelog.py`
- Modify: `examples/grant-application/server/main.py`

**Step 1: Write failing tests**

```python
# tests/server/test_changelog.py
def test_changelog_identical_definitions(client):
    """Two identical definitions should produce no changes."""
    defn = client.get("/definition").json()
    r = client.post("/changelog", json={"old": defn, "new": defn})
    assert r.status_code == 200
    body = r.json()
    assert body["semverImpact"] == "patch"  # or no changes
    assert isinstance(body["changes"], list)

def test_changelog_added_item(client):
    """Adding an item should be classified as compatible/minor."""
    defn = client.get("/definition").json()
    modified = {**defn, "version": "1.1.0"}
    # Add a new item
    modified["items"] = [*defn["items"], {
        "name": "newField",
        "type": "field",
        "dataType": "string",
        "label": "New Field",
    }]
    r = client.post("/changelog", json={"old": defn, "new": modified})
    assert r.status_code == 200
    body = r.json()
    assert any(c["type"] == "added" for c in body["changes"])
    assert body["semverImpact"] in ("minor", "patch")

def test_changelog_missing_old(client):
    r = client.post("/changelog", json={"new": {"items": []}})
    assert r.status_code == 422
```

**Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/server/test_changelog.py -v`
Expected: FAIL — 404

**Step 3: Implement the endpoint**

```python
from formspec.changelog import generate_changelog

class ChangelogRequest(BaseModel):
    old: dict
    new: dict

@app.post("/changelog")
def changelog(request: ChangelogRequest):
    url = request.new.get("url", request.old.get("url", ""))
    return generate_changelog(request.old, request.new, url)
```

**Step 4: Run tests to verify green**

Run: `python3 -m pytest tests/server/test_changelog.py -v`
Expected: 3 PASS

**Step 5: Commit**

```
feat(server): add POST /changelog endpoint for definition version diffing
```

---

### Task 5: GET /registry — Extension registry queries

**Files:**
- Create: `tests/server/test_registry.py`
- Modify: `examples/grant-application/server/main.py`

**Step 1: Write failing tests**

```python
# tests/server/test_registry.py
def test_registry_list_all(client):
    r = client.get("/registry")
    assert r.status_code == 200
    body = r.json()
    assert "entries" in body
    assert len(body["entries"]) > 0

def test_registry_filter_by_category(client):
    r = client.get("/registry?category=dataType")
    assert r.status_code == 200
    body = r.json()
    for entry in body["entries"]:
        assert entry["category"] == "dataType"

def test_registry_filter_by_status(client):
    r = client.get("/registry?status=stable")
    assert r.status_code == 200
    for entry in r.json()["entries"]:
        assert entry["status"] == "stable"

def test_registry_filter_by_name(client):
    r = client.get("/registry?name=x-grants-gov-ssn")
    assert r.status_code == 200
    body = r.json()
    assert len(body["entries"]) >= 1
    assert body["entries"][0]["name"] == "x-grants-gov-ssn"

def test_registry_validate(client):
    r = client.get("/registry/validate")
    assert r.status_code == 200
    body = r.json()
    assert "errors" in body
```

**Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/server/test_registry.py -v`
Expected: FAIL — 404

**Step 3: Implement the endpoints**

```python
from formspec.registry import Registry

REGISTRY_PATH = EXAMPLE_DIR / "registry.json"
_registry = Registry(json.loads(REGISTRY_PATH.read_text()))

@app.get("/registry")
def registry(name: str | None = None, category: str | None = None, status: str | None = None):
    if name:
        entries = _registry.find(name, category=category, status=status)
    elif category:
        entries = _registry.list_by_category(category)
    elif status:
        entries = _registry.list_by_status(status)
    else:
        entries = _registry.entries
    return {"entries": [e.raw for e in entries]}

@app.get("/registry/validate")
def registry_validate():
    return {"errors": _registry.validate()}
```

**Step 4: Run tests to verify green**

Run: `python3 -m pytest tests/server/test_registry.py -v`
Expected: 5 PASS

**Step 5: Commit**

```
feat(server): add GET /registry endpoint for extension queries
```

---

### Task 6: GET /dependencies — Field dependency graph

**Files:**
- Create: `tests/server/test_dependencies.py`
- Modify: `examples/grant-application/server/main.py`

**Step 1: Write failing tests**

```python
# tests/server/test_dependencies.py
def test_dependencies_returns_graph(client):
    r = client.get("/dependencies")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)
    # Should have at least some entries from the grant-app binds
    assert len(body) > 0

def test_dependencies_structure(client):
    r = client.get("/dependencies")
    body = r.json()
    # Each entry should have depends_on (list) and expression (str)
    for path, info in body.items():
        assert "depends_on" in info
        assert "expression" in info
        assert isinstance(info["depends_on"], list)
        assert isinstance(info["expression"], str)

def test_dependencies_known_field(client):
    """lineItemTotal has calculate: '$unitCost * $quantity'"""
    r = client.get("/dependencies")
    body = r.json()
    assert "lineItemTotal" in body
    assert "unitCost" in body["lineItemTotal"]["depends_on"]
    assert "quantity" in body["lineItemTotal"]["depends_on"]
```

**Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/server/test_dependencies.py -v`
Expected: FAIL — 404

**Step 3: Implement the endpoint**

```python
from formspec.fel import extract_dependencies

@app.get("/dependencies")
def dependencies():
    graph = {}
    for bind in _definition.get("binds", []):
        path = bind.get("path", "")
        for expr_key in ("calculate", "relevant", "constraint", "required", "readonly"):
            expr = bind.get(expr_key)
            if not expr:
                continue
            try:
                deps = extract_dependencies(expr)
                key = f"{path}" if expr_key == "calculate" else f"{path}.{expr_key}"
                graph[key] = {
                    "depends_on": sorted(deps.fields),
                    "expression": expr,
                }
            except Exception:
                pass  # skip unparseable expressions
    return graph
```

Note: use just `path` as the key for `calculate` (primary expression), and `path.exprType` for other expression types, so `lineItemTotal` maps directly.

**Step 4: Run tests to verify green**

Run: `python3 -m pytest tests/server/test_dependencies.py -v`
Expected: 3 PASS

**Step 5: Commit**

```
feat(server): add GET /dependencies endpoint for field dependency graph
```

---

### Task 7: Full suite run + final commit

**Step 1: Run all server tests together**

Run: `python3 -m pytest tests/server/ -v`
Expected: All tests PASS (approx 20 tests)

**Step 2: Run existing test suite to verify no regressions**

Run: `python3 -m pytest tests/ -v --ignore=tests/e2e`
Expected: All existing tests still pass

**Step 3: Final commit if any cleanup needed**

```
test: verify all server endpoint tests pass with no regressions
```
