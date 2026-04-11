# Definition Evaluator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `DefinitionEvaluator` to `src/formspec/` that evaluates definition variables and shape constraints against submitted data, eliminating manual duplication in the reference server.

**Architecture:** Two targeted changes to existing code (add `variables` param to `Environment` and `evaluate()`), plus one new ~100-line `evaluator.py` module. The dep extractor and FEL evaluator already exist — this is pure orchestration. The reference server then replaces its hand-rolled budget math with a single call.

**Tech Stack:** Python, existing `formspec.fel` package (evaluate, extract_dependencies, FelValue types)

---

### Task 1: `@name` variable resolution in Environment

The Python `Environment.resolve_context` returns `FelNull` for any unknown context name, including `@grandTotal` (a spec-defined variable ref). Fix it.

**Files:**
- Modify: `src/formspec/fel/environment.py`
- Modify: `src/formspec/fel/__init__.py`
- Test: `tests/unit/runtime/fel/test_fel_api.py`

**Step 1: Write the failing tests**

Add to `tests/unit/runtime/fel/test_fel_api.py` inside `class TestEvaluate`:

```python
def test_evaluate_variable_ref(self):
    """@name should resolve to the passed variable value, not FelNull."""
    from formspec.fel.types import FelMoney, fel_decimal
    variables = {'grandTotal': FelMoney(fel_decimal('50000'), 'USD')}
    result = evaluate('moneyAmount(@grandTotal)', data={}, variables=variables)
    assert to_python(result.value) == {'amount': '50000', 'currency': 'USD'}

def test_evaluate_variable_ref_unknown_still_null(self):
    """Unknown @name with no variables dict stays FelNull."""
    result = evaluate('@unknownVar', data={})
    assert is_null(result.value)

def test_evaluate_variable_ref_in_shape_constraint(self):
    """Shape-style constraint referencing a pre-computed variable."""
    from formspec.fel.types import FelMoney, fel_decimal, FelTrue
    variables = {'grandTotal': FelMoney(fel_decimal('50000'), 'USD')}
    data = {'budget': {'requestedAmount': {'amount': '50000', 'currency': 'USD'}}}
    result = evaluate(
        'abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1',
        data=data,
        variables=variables,
    )
    assert result.value is FelTrue
```

**Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/unit/runtime/fel/test_fel_api.py::TestEvaluate::test_evaluate_variable_ref -v
```

Expected: `FAILED` — `evaluate()` has no `variables` parameter.

**Step 3: Add `variables` to `Environment`**

In `src/formspec/fel/environment.py`, change `__init__` and `resolve_context`:

```python
def __init__(
    self,
    data: dict | None = None,
    instances: dict[str, dict] | None = None,
    mip_states: dict[str, MipState] | None = None,
    variables: dict[str, 'FelValue'] | None = None,   # ADD THIS
):
    """Set up with primary instance data, optional named secondary instances, optional per-field MIP states, and optional pre-computed named variables."""
    self.data = data or {}
    self.instances = instances or {}
    self.mip_states = mip_states or {}
    self.variables = variables or {}                   # ADD THIS
    self._scope_stack: list[dict[str, FelValue]] = []
    self.repeat_context: RepeatContext | None = None
```

In `resolve_context`, add one branch before `return FelNull`:

```python
        if name in ('source', 'target'):
            # Mapping DSL context references
            return self._resolve_path(self.data, [name] + tail)
        if name in self.variables:                     # ADD THIS BLOCK
            return self._resolve_tail(self.variables[name], tail)
        return FelNull
```

**Step 4: Thread `variables` through `evaluate()` in `src/formspec/fel/__init__.py`**

```python
def evaluate(
    source: str,
    data: dict | None = None,
    *,
    instances: dict[str, dict] | None = None,
    mip_states: dict[str, MipState] | None = None,
    extensions: dict[str, FuncDef] | None = None,
    variables: dict[str, 'FelValue'] | None = None,   # ADD THIS
) -> EvalResult:
    """Parse and evaluate a FEL expression in one call.

    ...
    variables: Pre-computed named variable values for ``@name`` lookups.
    ...
    """
    ast = parse(source)
    env = Environment(data=data, instances=instances, mip_states=mip_states, variables=variables)  # ADD variables=
    functions = build_default_registry()
    if extensions:
        functions.update(extensions)
    ev = Evaluator(env, functions)
    value = ev.evaluate(ast)
    return EvalResult(value=value, diagnostics=ev.diagnostics)
```

**Step 5: Run tests to verify they pass**

```bash
python3 -m pytest tests/unit/runtime/fel/test_fel_api.py -v
```

Expected: All passing, including the three new tests.

**Step 6: Commit**

```bash
git add src/formspec/fel/environment.py src/formspec/fel/__init__.py tests/unit/runtime/fel/test_fel_api.py
git commit -m "feat(fel): add @name variable resolution to Environment and evaluate()"
```

---

### Task 2: `DefinitionEvaluator`

New module that evaluates definition variables in dep order, then runs shape constraints — using the FEL evaluator for everything.

**Files:**
- Create: `src/formspec/evaluator.py`
- Create: `tests/unit/runtime/evaluator/__init__.py`
- Create: `tests/unit/runtime/evaluator/test_definition_evaluator.py`

**Step 1: Write the failing tests**

Create `tests/unit/runtime/evaluator/__init__.py` (empty).

Create `tests/unit/runtime/evaluator/test_definition_evaluator.py`:

```python
"""Tests for DefinitionEvaluator: variable evaluation and shape constraint checking."""
import pytest
from formspec.evaluator import DefinitionEvaluator
from formspec.fel.types import FelMoney, FelNumber, fel_decimal, to_python


# ── Variable evaluation ──────────────────────────────────────────────────────

class TestEvaluateVariables:
    def test_single_variable(self):
        defn = {
            'variables': [{'name': 'total', 'expression': 'sum($items[*].amount)'}]
        }
        ev = DefinitionEvaluator(defn)
        data = {'items': [{'amount': 100}, {'amount': 200}]}
        variables = ev.evaluate_variables(data)
        assert to_python(variables['total']) == pytest.approx(300)

    def test_variable_depending_on_variable(self):
        """indirectCosts depends on totalDirect — topo sort must evaluate totalDirect first."""
        defn = {
            'variables': [
                {'name': 'indirectCosts', 'expression': 'moneyAmount(@totalDirect) * 0.1'},
                {'name': 'totalDirect',   'expression': 'sum($items[*].amount)'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        data = {'items': [{'amount': 1000}]}
        variables = ev.evaluate_variables(data)
        assert to_python(variables['totalDirect']) == pytest.approx(1000)
        assert to_python(variables['indirectCosts']) == pytest.approx(100)

    def test_no_variables(self):
        ev = DefinitionEvaluator({})
        assert ev.evaluate_variables({}) == {}

    def test_circular_dependency_raises(self):
        defn = {
            'variables': [
                {'name': 'a', 'expression': '@b + 1'},
                {'name': 'b', 'expression': '@a + 1'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        with pytest.raises(ValueError, match="Circular"):
            ev.evaluate_variables({})


# ── Shape evaluation ─────────────────────────────────────────────────────────

class TestValidate:
    def _ev(self, shapes, variables=None):
        defn = {'shapes': shapes}
        if variables:
            defn['variables'] = variables
        return DefinitionEvaluator(defn)

    def test_passing_constraint_no_result(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Must be positive', 'code': 'POS',
            'constraint': '$value > 0',
        }])
        assert ev.validate({'value': 5}) == []

    def test_failing_constraint_emits_result(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Must be positive', 'code': 'POS',
            'constraint': '$value > 0',
        }])
        results = ev.validate({'value': -1})
        assert len(results) == 1
        assert results[0]['code'] == 'POS'
        assert results[0]['severity'] == 'error'
        assert results[0]['shapeId'] == 's1'

    def test_active_when_false_skips_shape(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'activeWhen': '$enabled',
            'constraint': '$value > 100',
        }])
        # constraint would fail, but activeWhen is false
        assert ev.validate({'enabled': False, 'value': 0}) == []

    def test_active_when_true_applies_shape(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'activeWhen': '$enabled',
            'constraint': '$value > 100',
        }])
        results = ev.validate({'enabled': True, 'value': 0})
        assert len(results) == 1

    def test_or_composition_passes_if_any_true(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'warning',
            'message': 'Need one', 'code': 'C',
            'or': ['present($email)', 'present($phone)'],
        }])
        assert ev.validate({'email': 'x@y.com', 'phone': None}) == []
        assert ev.validate({'email': None, 'phone': None}) != []

    def test_and_composition_fails_if_any_false(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Need both', 'code': 'C',
            'and': ['present($a)', 'present($b)'],
        }])
        assert ev.validate({'a': 'x', 'b': 'y'}) == []
        assert ev.validate({'a': 'x', 'b': None}) != []

    def test_xone_passes_exactly_one(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'info',
            'message': 'Exactly one', 'code': 'C',
            'xone': ['$a > 0', '$b > 0'],
        }])
        assert ev.validate({'a': 1, 'b': 0}) == []   # exactly one
        assert ev.validate({'a': 1, 'b': 1}) != []   # both pass → fail
        assert ev.validate({'a': 0, 'b': 0}) != []   # neither → fail

    def test_shape_uses_variable(self):
        """Shape constraint referencing @grandTotal via pre-computed variable."""
        ev = self._ev(
            shapes=[{
                'id': 'budgetMatch', 'target': 'budget.requestedAmount',
                'severity': 'error', 'message': 'Mismatch', 'code': 'BM',
                'constraint': 'abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1',
            }],
            variables=[
                {'name': 'totalDirect', 'expression': 'money(sum($budget.lineItems[*].amount), "USD")'},
                {'name': 'grandTotal',  'expression': '@totalDirect'},
            ]
        )
        data = {
            'budget': {
                'lineItems': [{'amount': 1000}, {'amount': 500}],
                'requestedAmount': {'amount': '1500', 'currency': 'USD'},
            }
        }
        assert ev.validate(data) == []  # amounts match

    def test_shape_variable_mismatch_emits_result(self):
        ev = self._ev(
            shapes=[{
                'id': 'budgetMatch', 'target': 'budget.requestedAmount',
                'severity': 'error', 'message': 'Mismatch', 'code': 'BM',
                'constraint': 'abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1',
            }],
            variables=[
                {'name': 'grandTotal', 'expression': 'money(sum($budget.lineItems[*].amount), "USD")'},
            ]
        )
        data = {
            'budget': {
                'lineItems': [{'amount': 1000}],
                'requestedAmount': {'amount': '999', 'currency': 'USD'},  # off by more than 1
            }
        }
        results = ev.validate(data)
        assert len(results) == 1
        assert results[0]['code'] == 'BM'
```

**Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/unit/runtime/evaluator/test_definition_evaluator.py -v
```

Expected: `ERROR — cannot import name 'DefinitionEvaluator' from 'formspec.evaluator'`

**Step 3: Implement `src/formspec/evaluator.py`**

```python
"""Server-side definition evaluator: computes variables and evaluates shape constraints.

Usage::

    from formspec.evaluator import DefinitionEvaluator

    ev = DefinitionEvaluator(definition)
    results = ev.validate(response_data)   # list of ValidationResult-format dicts
"""

from __future__ import annotations

from .fel import evaluate, extract_dependencies, FelTrue, FelValue


class DefinitionEvaluator:
    """Evaluates a definition's variables and shape constraints against submitted data.

    Instantiate once per definition; call validate() for each submitted response.
    Variable expressions are evaluated in dependency order (topologically sorted).
    Shape constraints and composition (and/or/not/xone) use the FEL evaluator.
    """

    def __init__(self, definition: dict) -> None:
        self._variables = {v['name']: v for v in definition.get('variables', [])}
        self._shapes = definition.get('shapes', [])
        self._var_order = self._topo_sort_variables()

    def _topo_sort_variables(self) -> list[str]:
        """Return variable names in evaluation order (dependencies before dependents)."""
        var_names = set(self._variables)
        resolved: list[str] = []
        remaining = list(self._variables)
        while remaining:
            progress = False
            for name in list(remaining):
                expr = self._variables[name]['expression']
                deps = extract_dependencies(expr).context_refs & var_names
                if all(d in resolved for d in deps):
                    resolved.append(name)
                    remaining.remove(name)
                    progress = True
            if not progress:
                raise ValueError(f"Circular variable dependencies: {remaining}")
        return resolved

    def evaluate_variables(self, data: dict) -> dict[str, FelValue]:
        """Evaluate all definition variables in dependency order."""
        variables: dict[str, FelValue] = {}
        for name in self._var_order:
            expr = self._variables[name]['expression']
            result = evaluate(expr, data, variables=variables)
            variables[name] = result.value
        return variables

    def validate(self, data: dict) -> list[dict]:
        """Evaluate all shape constraints against data. Returns ValidationResult-format dicts."""
        variables = self.evaluate_variables(data)
        results: list[dict] = []
        for shape in self._shapes:
            self._eval_shape(shape, data, variables, results)
        return results

    def _eval_shape(
        self,
        shape: dict,
        data: dict,
        variables: dict[str, FelValue],
        out: list[dict],
    ) -> bool:
        """Evaluate one shape. Appends to out on failure. Returns True if shape passes."""
        if 'activeWhen' in shape:
            guard = evaluate(shape['activeWhen'], data, variables=variables)
            if guard.value is not FelTrue:
                return True

        passed = True

        if 'constraint' in shape:
            result = evaluate(shape['constraint'], data, variables=variables)
            passed = result.value is FelTrue

        if passed and 'and' in shape:
            passed = all(self._eval_expr(e, data, variables) for e in shape['and'])

        if passed and 'or' in shape:
            passed = any(self._eval_expr(e, data, variables) for e in shape['or'])

        if passed and 'not' in shape:
            passed = not self._eval_expr(shape['not'], data, variables)

        if passed and 'xone' in shape:
            passing = sum(1 for e in shape['xone'] if self._eval_expr(e, data, variables))
            passed = passing == 1

        if not passed:
            out.append({
                'severity': shape.get('severity', 'error'),
                'path': shape.get('target', '#'),
                'message': shape['message'],
                'constraintKind': 'shape',
                'code': shape.get('code', 'SHAPE_FAILED'),
                'source': 'shape',
                'shapeId': shape['id'],
            })

        return passed

    def _eval_expr(self, expr: str, data: dict, variables: dict[str, FelValue]) -> bool:
        """Evaluate a FEL expression string as a boolean. Non-true result → False."""
        result = evaluate(expr, data, variables=variables)
        return result.value is FelTrue
```

**Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/unit/runtime/evaluator/test_definition_evaluator.py -v
```

Expected: All passing.

**Step 5: Run full Python suite to check for regressions**

```bash
python3 -m pytest tests/unit/ -v
```

Expected: All passing.

**Step 6: Commit**

```bash
git add src/formspec/evaluator.py tests/unit/runtime/evaluator/
git commit -m "feat: add DefinitionEvaluator for server-side variable and shape evaluation"
```

---

### Task 3: Simplify the reference server

Replace the hand-rolled budget math and shape checks in `main.py` with `DefinitionEvaluator`.

**Files:**
- Modify: `examples/grant-application/server/main.py`

**Step 1: Read `main.py` and identify the dead code**

The block to remove is lines 91–178: the `_check_constraint` helper, the manual variable calculations (`total_direct`, `indirect_rate`, `indirect`, `grand_total`), and the four manual shape checks (budget match, budget over threshold, subcontractor cap).

The bind-level checks (EIN format, date ordering, lines 112–130) use `_check_constraint` via the public FEL API and are fine to keep as-is — they're server-side re-validation of bind constraints, not shape evaluation.

**Step 2: Replace the manual shape logic**

After the existing imports, add:
```python
from formspec.evaluator import DefinitionEvaluator
```

After `_mapping_engine = MappingEngine(_mapping_doc)`, add:
```python
_evaluator = DefinitionEvaluator(_definition)
```

In `submit()`, replace lines 132–178 (the manual budget block) with:
```python
    # Shape constraints — evaluated from the definition directly
    validation_results.extend(_evaluator.validate(data))
```

The final `submit()` function should look like:

```python
@app.post("/submit", response_model=SubmitResponse)
def submit(request: SubmitRequest):
    if request.definitionUrl != _definition["url"]:
        raise HTTPException(status_code=400, detail=f"Unknown definition URL: {request.definitionUrl}")

    lint_diags = lint(_definition, mode="authoring")
    diagnostics = [
        f"[{d.severity}] {d.path or '(root)'}: {d.message}"
        for d in lint_diags
        if d.severity in ("error", "warning")
    ]

    data = request.data
    validation_results: list[dict] = []

    # Bind-level constraint re-validation (server defence-in-depth)
    applicant = data.get("applicantInfo", {})
    narrative = data.get("projectNarrative", {})

    if applicant.get("ein"):
        _check_constraint(
            r"matches($ein, '^[0-9]{2}-[0-9]{7}$')",
            {"ein": applicant["ein"]},
            "applicantInfo.ein",
            "EIN must be in the format XX-XXXXXXX.",
            "CONSTRAINT_FAILED",
            validation_results,
        )

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
```

Note: update `_check_constraint` to accept `out: list` as a parameter instead of closing over `validation_results`:

```python
def _check_constraint(expression: str, field_data: dict, path: str, message: str, code: str, out: list) -> None:
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
```

**Step 3: Start the server and verify it responds**

```bash
cd /home/exedev/formspec
PYTHONPATH=src uvicorn examples.grant_application.server.main:app --port 8000 &
curl -s http://localhost:8000/health
```

Expected: `{"ok":true}`

Kill the server: `kill %1`

**Step 4: Run the Python test suite**

```bash
python3 -m pytest tests/unit/ -v
```

Expected: All passing.

**Step 5: Commit**

```bash
git add examples/grant-application/server/main.py
git commit -m "refactor(grant-app): replace manual shape logic with DefinitionEvaluator"
```

---

## Summary

| Task | Files changed | Lines delta |
|---|---|---|
| 1. `@name` resolution | `environment.py`, `__init__.py`, `test_fel_api.py` | +15 impl, +20 tests |
| 2. `DefinitionEvaluator` | new `evaluator.py`, new `test_definition_evaluator.py` | +95 impl, +120 tests |
| 3. Simplify server | `main.py` | −60 (removes manual duplication) |
