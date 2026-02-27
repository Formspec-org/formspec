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
        self._shapes_by_id = {s['id']: s for s in self._shapes}
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
                # context_refs contains '@name' — strip '@' prefix to match var_names
                raw_context_refs = extract_dependencies(expr).context_refs
                deps = {ref.lstrip('@') for ref in raw_context_refs} & var_names
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
        """Evaluate a composition element: shape id reference or inline FEL boolean."""
        shape = self._shapes_by_id.get(expr)
        if shape is not None:
            out: list[dict] = []
            return self._eval_shape(shape, data, variables, out)
        result = evaluate(expr, data, variables=variables)
        return result.value is FelTrue
