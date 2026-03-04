"""Server-side form processor: 4-phase batch evaluation of definitions.

Phases: rebuild (init) → recalculate → revalidate → apply NRB.

Usage::

    from formspec.evaluator import DefinitionEvaluator, ProcessingResult

    ev = DefinitionEvaluator(definition)
    result = ev.process(submitted_data)  # ProcessingResult
    results = ev.validate(submitted_data)  # list[dict] convenience
"""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_EVEN

from .fel import (
    evaluate, extract_dependencies, parse,
    FelTrue, FelValue, Environment, Evaluator as FelEvaluator,
)
from .fel.types import from_python, to_python
from .fel.functions import build_default_registry


@dataclass
class ItemInfo:
    """Metadata for a single item in the definition tree."""
    item_type: str          # 'field', 'group', 'display'
    data_type: str | None   # 'string', 'integer', etc. (None for groups/display)
    repeatable: bool
    min_repeat: int | None
    max_repeat: int | None
    parent: str | None      # full path of parent, or None for top-level
    children: list[str]     # full paths of direct children
    precision: int | None   # decimal precision


@dataclass
class ProcessingResult:
    """Output of DefinitionEvaluator.process()."""
    valid: bool
    results: list[dict]
    data: dict
    variables: dict[str, FelValue]
    counts: dict[str, int]


# Type validation lookup: dataType → acceptable Python types
_TYPE_CHECKS: dict[str, tuple[type, ...]] = {
    'string': (str,),
    'text': (str,),
    'integer': (int,),
    'decimal': (int, float, Decimal),
    'boolean': (bool,),
    'date': (str,),         # ISO date string
    'dateTime': (str,),
    'time': (str,),
    'choice': (str,),
    'multiChoice': (list,),
    'attachment': (dict,),
    'money': (dict,),
}


class DefinitionEvaluator:
    """4-phase batch processor for formspec definitions.

    Instantiate once per definition; call process() for each submission.
    """

    def __init__(self, definition: dict) -> None:
        self._definition = definition
        self._default_nrb = definition.get('nonRelevantBehavior', 'remove')

        # Phase 1a: Build item registry
        self._items: dict[str, ItemInfo] = {}
        self._build_item_registry(definition.get('items', []), parent_path=None)

        # Phase 1b: Build bind index (merge multiple binds for same path)
        self._binds: dict[str, dict] = {}
        for bind in definition.get('binds', []):
            path = bind['path']
            if path in self._binds:
                # Merge: later bind properties override earlier ones
                self._binds[path] = {**self._binds[path], **bind}
            else:
                self._binds[path] = dict(bind)

        # Phase 1c: Variables — topo-sort
        self._variables = {v['name']: v for v in definition.get('variables', [])}
        self._var_order = self._topo_sort_variables()

        # Phase 1d: Shapes
        self._shapes = definition.get('shapes', [])
        self._shapes_by_id = {s['id']: s for s in self._shapes}

        # Phase 1e: Instances
        self._instances = {}
        for name, inst in definition.get('instances', {}).items():
            if isinstance(inst, dict) and 'data' in inst:
                self._instances[name] = inst['data']

        # Cache parsed ASTs for bind expressions
        self._ast_cache: dict[str, object] = {}

    # ── Phase 1: Rebuild ─────────────────────────────────────────────────

    def _build_item_registry(self, items: list[dict], parent_path: str | None) -> None:
        for item in items:
            key = item.get('key', '')
            full_path = f'{parent_path}.{key}' if parent_path else key
            children_items = item.get('children', [])
            child_paths = []

            info = ItemInfo(
                item_type=item.get('type', 'field'),
                data_type=item.get('dataType'),
                repeatable=item.get('repeatable', False),
                min_repeat=item.get('minRepeat'),
                max_repeat=item.get('maxRepeat'),
                parent=parent_path,
                children=child_paths,
                precision=item.get('precision'),
            )
            self._items[full_path] = info

            # Recurse into children
            for child in children_items:
                child_key = child.get('key', '')
                child_full = f'{full_path}.{child_key}'
                child_paths.append(child_full)
            self._build_item_registry(children_items, full_path)

    def _topo_sort_variables(self) -> list[str]:
        var_names = set(self._variables)
        resolved: list[str] = []
        remaining = list(self._variables)
        while remaining:
            progress = False
            for name in list(remaining):
                expr = self._variables[name]['expression']
                raw_context_refs = extract_dependencies(expr).context_refs
                deps = {ref.lstrip('@') for ref in raw_context_refs} & var_names
                if all(d in resolved for d in deps):
                    resolved.append(name)
                    remaining.remove(name)
                    progress = True
            if not progress:
                raise ValueError(f"Circular variable dependencies: {remaining}")
        return resolved

    def _expand_repeats(self, data: dict) -> tuple[dict[str, int], set[str]]:
        """Walk data alongside item registry to find repeat counts and concrete paths."""
        counts: dict[str, int] = {}
        paths: set[str] = set()
        self._walk_for_repeats(data, '', counts, paths)
        return counts, paths

    def _walk_for_repeats(
        self, data: object, prefix: str,
        counts: dict[str, int], paths: set[str],
    ) -> None:
        for item_path, info in self._items.items():
            # Only process items whose parent matches our current prefix
            expected_parent = prefix.rstrip('.') if prefix else None
            if info.parent != expected_parent:
                continue

            key = item_path.rsplit('.', 1)[-1] if '.' in item_path else item_path

            if info.repeatable and isinstance(data, dict):
                arr = data.get(key, [])
                if isinstance(arr, list):
                    count = len(arr)
                    counts[item_path] = count
                    for i, row in enumerate(arr, 1):
                        concrete_prefix = f'{item_path}[{i}]'
                        # Add paths for children within this instance
                        self._add_concrete_child_paths(info, concrete_prefix, row, counts, paths)
            elif info.item_type in ('field', 'display'):
                if isinstance(data, dict):
                    paths.add(item_path)
            elif info.item_type == 'group' and not info.repeatable:
                if isinstance(data, dict):
                    paths.add(item_path)
                    sub_data = data.get(key, {})
                    self._walk_for_repeats(sub_data, item_path + '.', counts, paths)

    def _add_concrete_child_paths(
        self, parent_info: ItemInfo, prefix: str, row_data: object,
        counts: dict[str, int], paths: set[str],
    ) -> None:
        for child_path in parent_info.children:
            child_info = self._items.get(child_path)
            if not child_info:
                continue
            child_key = child_path.rsplit('.', 1)[-1] if '.' in child_path else child_path
            concrete = f'{prefix}.{child_key}'

            if child_info.repeatable and isinstance(row_data, dict):
                arr = row_data.get(child_key, [])
                if isinstance(arr, list):
                    nested_base = child_path
                    counts.setdefault(nested_base, 0)
                    counts[nested_base] = max(counts.get(nested_base, 0), len(arr))
                    for j, sub_row in enumerate(arr, 1):
                        nested_prefix = f'{concrete}[{j}]'
                        self._add_concrete_child_paths(child_info, nested_prefix, sub_row, counts, paths)
            elif child_info.item_type in ('field', 'display'):
                paths.add(concrete)
                # Recurse into field children (dependent sub-questions)
                if child_info.children:
                    sub_data = row_data.get(child_key, {}) if isinstance(row_data, dict) else {}
                    self._add_concrete_child_paths(child_info, concrete, sub_data, counts, paths)
            elif child_info.item_type == 'group' and not child_info.repeatable:
                paths.add(concrete)
                sub_data = row_data.get(child_key, {}) if isinstance(row_data, dict) else {}
                self._add_concrete_child_paths(child_info, concrete, sub_data, counts, paths)

    # ── Phase 2: Recalculate ─────────────────────────────────────────────

    def _parse_cached(self, expr: str):
        if expr not in self._ast_cache:
            self._ast_cache[expr] = parse(expr)
        return self._ast_cache[expr]

    def _eval_fel(self, expr: str, data: dict, variables: dict[str, FelValue],
                  scope: dict | None = None):
        """Evaluate a FEL expression, optionally with a scope pushed."""
        if scope is not None:
            ast = self._parse_cached(expr)
            env = Environment(
                data=data,
                variables=variables,
                instances=self._instances,
            )
            env.push_scope({k: from_python(v) for k, v in scope.items()})
            functions = build_default_registry()
            ev = FelEvaluator(env, functions)
            result = ev.evaluate(ast)
            env.pop_scope()
            return result
        else:
            return evaluate(expr, data, variables=variables, instances=self._instances).value

    def _apply_whitespace(self, data: dict) -> None:
        """Apply whitespace transforms to string fields in-place."""
        for path, bind in self._binds.items():
            ws = bind.get('whitespace')
            if not ws or ws == 'preserve':
                continue
            if '[*]' in path:
                self._apply_whitespace_wildcard(data, path, ws)
            else:
                val = _get_nested(data, path)
                if isinstance(val, str):
                    _set_nested(data, path, _transform_whitespace(val, ws))

    def _apply_whitespace_wildcard(self, data: dict, path: str, ws: str) -> None:
        parts = path.split('[*].')
        if len(parts) != 2:
            return
        base_path, field_name = parts
        arr = _get_nested(data, base_path)
        if not isinstance(arr, list):
            return
        for row in arr:
            if isinstance(row, dict) and field_name in row:
                val = row[field_name]
                if isinstance(val, str):
                    row[field_name] = _transform_whitespace(val, ws)

    def evaluate_variables(self, data: dict) -> dict[str, FelValue]:
        """Evaluate all definition variables in dependency order."""
        variables: dict[str, FelValue] = {}
        for name in self._var_order:
            expr = self._variables[name]['expression']
            result = evaluate(expr, data, variables=variables, instances=self._instances)
            variables[name] = result.value
        return variables

    def _eval_relevance(self, data: dict, variables: dict[str, FelValue]) -> dict[str, bool]:
        """Evaluate relevant binds. Apply AND inheritance (parent false → children false)."""
        relevance: dict[str, bool] = {}
        # First pass: evaluate explicit relevant binds
        for path, info in self._items.items():
            bind = self._get_bind_for_path(path)
            if bind and 'relevant' in bind:
                val = self._eval_fel(bind['relevant'], data, variables)
                relevance[path] = val is FelTrue
            else:
                relevance[path] = True

        # Second pass: AND inheritance
        for path, info in self._items.items():
            if info.parent and info.parent in relevance:
                if not relevance[info.parent]:
                    relevance[path] = False

        return relevance

    def _eval_required(self, data: dict, variables: dict[str, FelValue]) -> dict[str, bool]:
        """Evaluate required binds. No inheritance."""
        required: dict[str, bool] = {}
        for path in self._items:
            bind = self._get_bind_for_path(path)
            if bind and 'required' in bind:
                val = self._eval_fel(bind['required'], data, variables)
                required[path] = val is FelTrue
        return required

    def _eval_readonly(self, data: dict, variables: dict[str, FelValue]) -> dict[str, bool]:
        """Evaluate readonly binds. OR inheritance (parent true → children true)."""
        readonly: dict[str, bool] = {}
        for path in self._items:
            bind = self._get_bind_for_path(path)
            if bind and 'readonly' in bind:
                val = self._eval_fel(bind['readonly'], data, variables)
                readonly[path] = val is FelTrue
            else:
                readonly[path] = False

        # OR inheritance
        for path, info in self._items.items():
            if info.parent and info.parent in readonly:
                if readonly[info.parent]:
                    readonly[path] = True

        return readonly

    def _eval_calculates(self, data: dict, variables: dict[str, FelValue]) -> None:
        """Evaluate calculate binds, writing results back to data. Handles repeat scoping."""
        for path, bind in self._binds.items():
            calc = bind.get('calculate')
            if not calc:
                continue

            if '[*]' in path:
                self._eval_calculate_wildcard(data, path, calc, variables)
            else:
                val = self._eval_fel(calc, data, variables)
                py_val = to_python(val)
                py_val = self._apply_precision(path, py_val)
                _set_nested(data, path, py_val)

    def _eval_calculate_wildcard(
        self, data: dict, path: str, calc: str, variables: dict[str, FelValue],
    ) -> None:
        """Evaluate a wildcard calculate bind (e.g. rows[*].total) across all instances."""
        # Split on first [*]
        parts = path.split('[*]', 1)
        base = parts[0].rstrip('.')
        suffix = parts[1].lstrip('.') if len(parts) > 1 else ''

        arr = _get_nested(data, base)
        if not isinstance(arr, list):
            return

        for i, row in enumerate(arr):
            if not isinstance(row, dict):
                continue
            # Use scope stack for bare field references within the row
            result = self._eval_fel(calc, data, variables, scope=row)
            py_val = to_python(result)
            py_val = self._apply_precision(path, py_val)
            if suffix and '.' not in suffix:
                row[suffix] = py_val
            elif suffix:
                _set_nested(row, suffix, py_val)

    def _apply_precision(self, path: str, value):
        """Apply precision rounding if the item declares precision."""
        # Look up precision from item registry
        # For wildcard paths, strip [*] to find base item
        clean_path = re.sub(r'\[\*\]', '', path).strip('.')
        # Try both the clean path and original for lookup
        info = self._items.get(clean_path)
        if not info:
            # Try looking up just the leaf under the parent
            for item_path, item_info in self._items.items():
                if clean_path.endswith(item_path) or item_path.endswith(clean_path.split('.')[-1]):
                    info = item_info
                    break

        if info and info.precision is not None and isinstance(value, (int, float, Decimal)):
            d = Decimal(str(value))
            quant = Decimal(10) ** -info.precision
            return float(d.quantize(quant, rounding=ROUND_HALF_EVEN))
        return value

    def _get_bind_for_path(self, path: str) -> dict | None:
        """Look up bind for a path, checking exact match first."""
        if path in self._binds:
            return self._binds[path]
        return None

    def _eval_constraint(
        self, expr: str, data: dict, variables: dict[str, FelValue],
        self_value=None, row: dict | None = None,
    ) -> bool:
        """Evaluate a FEL constraint. Injects self_value as bare $ (scope key '').
        If row is provided, row fields are also pushed into scope (for wildcard binds)."""
        if self_value is not None or row is not None:
            scope = {}
            if row is not None:
                scope.update(row)
            if self_value is not None:
                scope[''] = self_value
            result = self._eval_fel(expr, data, variables, scope=scope)
        else:
            result = self._eval_fel(expr, data, variables)
        return result is FelTrue

    # ── Phase 3: Revalidate ──────────────────────────────────────────────

    def _validate_binds(
        self, data: dict, variables: dict[str, FelValue],
        relevance: dict[str, bool], required: dict[str, bool],
        repeat_counts: dict[str, int],
    ) -> list[dict]:
        """Validate bind constraints on all fields."""
        results: list[dict] = []

        # Field-level validation
        for path, info in self._items.items():
            if info.item_type == 'display':
                continue
            if not relevance.get(path, True):
                continue

            val = _get_nested(data, path)
            bind = self._get_bind_for_path(path)

            # Skip type validation for calculated fields (their values come from FEL)
            has_calculate = bind and 'calculate' in bind
            if not has_calculate and val is not None and val != '' and info.data_type:
                expected = _TYPE_CHECKS.get(info.data_type)
                if expected and not isinstance(val, expected):
                    results.append({
                        'severity': 'error',
                        'path': path,
                        'message': f'Expected {info.data_type}, got {type(val).__name__}',
                        'constraintKind': 'type',
                        'code': 'TYPE_ERROR',
                        'source': 'bind',
                    })

            # Required check
            if required.get(path, False) and _is_empty(val):
                results.append({
                    'severity': 'error',
                    'path': path,
                    'message': f'{path} is required',
                    'constraintKind': 'required',
                    'code': 'REQUIRED',
                    'source': 'bind',
                })

            if bind and 'constraint' in bind and not _is_empty(val):
                if not self._eval_constraint(bind['constraint'], data, variables, self_value=val):
                    msg = bind.get('constraintMessage', f'Constraint failed for {path}')
                    results.append({
                        'severity': 'error',
                        'path': path,
                        'message': msg,
                        'constraintKind': 'constraint',
                        'code': 'CONSTRAINT_FAILED',
                        'source': 'bind',
                    })

        # Wildcard bind validation (constraints on repeat fields)
        for bind_path, bind in self._binds.items():
            if '[*]' not in bind_path:
                continue
            if 'constraint' not in bind and 'required' not in bind:
                continue
            self._validate_wildcard_bind(data, variables, bind_path, bind, relevance, results)

        # Cardinality
        for path, info in self._items.items():
            if not info.repeatable:
                continue
            if not relevance.get(path, True):
                continue
            count = repeat_counts.get(path, 0)
            if info.min_repeat is not None and count < info.min_repeat:
                results.append({
                    'severity': 'error',
                    'path': path,
                    'message': f'{path} requires at least {info.min_repeat} entries (has {count})',
                    'constraintKind': 'cardinality',
                    'code': 'MIN_REPEAT',
                    'source': 'bind',
                })
            if info.max_repeat is not None and count > info.max_repeat:
                results.append({
                    'severity': 'error',
                    'path': path,
                    'message': f'{path} allows at most {info.max_repeat} entries (has {count})',
                    'constraintKind': 'cardinality',
                    'code': 'MAX_REPEAT',
                    'source': 'bind',
                })

        return results

    def _validate_wildcard_bind(
        self, data: dict, variables: dict[str, FelValue],
        bind_path: str, bind: dict,
        relevance: dict[str, bool],
        results: list[dict],
    ) -> None:
        """Validate a wildcard bind across all repeat instances."""
        parts = bind_path.split('[*]', 1)
        base = parts[0].rstrip('.')
        suffix = parts[1].lstrip('.') if len(parts) > 1 else ''

        arr = _get_nested(data, base)
        if not isinstance(arr, list):
            return

        for i, row in enumerate(arr, 1):
            if not isinstance(row, dict):
                continue
            concrete_path = f'{base}[{i}].{suffix}' if suffix else f'{base}[{i}]'

            val = row.get(suffix) if suffix and '.' not in suffix else None

            # Required
            if 'required' in bind:
                req_val = self._eval_fel(bind['required'], data, variables, scope=row)
                if req_val is FelTrue and _is_empty(val):
                    results.append({
                        'severity': 'error',
                        'path': concrete_path,
                        'message': f'{concrete_path} is required',
                        'constraintKind': 'required',
                        'code': 'REQUIRED',
                        'source': 'bind',
                    })

            if 'constraint' in bind and not _is_empty(val):
                if not self._eval_constraint(bind['constraint'], data, variables, self_value=val, row=row):
                    msg = bind.get('constraintMessage', f'Constraint failed for {concrete_path}')
                    results.append({
                        'severity': 'error',
                        'path': concrete_path,
                        'message': msg,
                        'constraintKind': 'constraint',
                        'code': 'CONSTRAINT_FAILED',
                        'source': 'bind',
                    })

    def _eval_shapes(
        self, data: dict, variables: dict[str, FelValue], mode: str,
    ) -> list[dict]:
        """Evaluate shape constraints, respecting timing."""
        results: list[dict] = []
        for shape in self._shapes:
            timing = shape.get('timing', 'continuous')
            if timing == 'submit' and mode != 'submit':
                continue
            self._eval_shape(shape, data, variables, results)
        return results

    def _eval_shape(
        self, shape: dict, data: dict, variables: dict[str, FelValue],
        out: list[dict],
    ) -> bool:
        if 'activeWhen' in shape:
            guard = evaluate(shape['activeWhen'], data, variables=variables, instances=self._instances)
            if guard.value is not FelTrue:
                return True

        passed = True

        if 'constraint' in shape:
            target = shape.get('target')
            target_val = _get_nested(data, target) if (target and target != '#') else None
            passed = self._eval_constraint(shape['constraint'], data, variables, self_value=target_val)

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
        shape = self._shapes_by_id.get(expr)
        if shape is not None:
            out: list[dict] = []
            return self._eval_shape(shape, data, variables, out)
        result = evaluate(expr, data, variables=variables, instances=self._instances)
        return result.value is FelTrue

    # ── Phase 4: Apply NRB ───────────────────────────────────────────────

    def _apply_nrb(self, data: dict, relevance: dict[str, bool]) -> dict:
        """Apply nonRelevantBehavior to the output data."""
        for path in list(relevance.keys()):
            if relevance[path]:
                continue  # relevant — leave alone

            nrb = self._get_nrb_for_path(path)

            if nrb == 'remove':
                _delete_nested(data, path)
            elif nrb == 'empty':
                _set_nested(data, path, None)
            # 'keep' — do nothing

        return data

    def _get_nrb_for_path(self, path: str) -> str:
        """Get nonRelevantBehavior: field bind → ancestor binds → definition default."""
        bind = self._get_bind_for_path(path)
        if bind and 'nonRelevantBehavior' in bind:
            return bind['nonRelevantBehavior']

        # Walk ancestors
        info = self._items.get(path)
        if info and info.parent:
            parent_bind = self._get_bind_for_path(info.parent)
            if parent_bind and 'nonRelevantBehavior' in parent_bind:
                return parent_bind['nonRelevantBehavior']

        return self._default_nrb

    # ── Public API ───────────────────────────────────────────────────────

    def process(self, data: dict, *, mode: str = 'submit') -> ProcessingResult:
        """Run all 4 phases and return a ProcessingResult."""
        # Deep copy to avoid mutating caller's data
        data = copy.deepcopy(data)

        # Phase 1: Expand repeats
        repeat_counts, concrete_paths = self._expand_repeats(data)

        # Phase 2: Recalculate
        self._apply_whitespace(data)
        # Calculate binds first (so computed fields have values for variable expressions)
        self._eval_calculates(data, {})
        variables = self.evaluate_variables(data)
        relevance = self._eval_relevance(data, variables)
        required = self._eval_required(data, variables)
        readonly = self._eval_readonly(data, variables)

        # Phase 3: Revalidate
        bind_results = self._validate_binds(data, variables, relevance, required, repeat_counts)
        shape_results = self._eval_shapes(data, variables, mode)
        all_results = bind_results + shape_results

        # Phase 4: Apply NRB
        self._apply_nrb(data, relevance)

        # Build counts
        counts = {'error': 0, 'warning': 0, 'info': 0}
        for r in all_results:
            sev = r.get('severity', 'error')
            if sev in counts:
                counts[sev] += 1

        valid = counts['error'] == 0

        return ProcessingResult(
            valid=valid,
            results=all_results,
            data=data,
            variables=variables,
            counts=counts,
        )

    def validate(self, data: dict, *, mode: str = 'submit') -> list[dict]:
        """Convenience: return just the validation results."""
        return self.process(data, mode=mode).results


# ── Utility functions ────────────────────────────────────────────────────────

def _get_nested(data: dict, path: str):
    """Get a value from a nested dict by dotted path."""
    parts = path.split('.')
    current = data
    for part in parts:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
        if current is None:
            return None
    return current


def _set_nested(data: dict, path: str, value) -> None:
    """Set a value in a nested dict by dotted path, creating intermediates."""
    parts = path.split('.')
    current = data
    for part in parts[:-1]:
        if not isinstance(current, dict):
            return
        if part not in current:
            current[part] = {}
        current = current[part]
    if isinstance(current, dict):
        current[parts[-1]] = value


def _delete_nested(data: dict, path: str) -> None:
    """Delete a key from a nested dict by dotted path."""
    parts = path.split('.')
    current = data
    for part in parts[:-1]:
        if not isinstance(current, dict):
            return
        current = current.get(part)
        if current is None:
            return
    if isinstance(current, dict):
        current.pop(parts[-1], None)


def _is_empty(value) -> bool:
    """Check if a value is empty (null, empty string, empty list)."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == '':
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


def _transform_whitespace(value: str, mode: str) -> str:
    """Apply whitespace transformation."""
    if mode == 'trim':
        return value.strip()
    elif mode == 'normalize':
        return ' '.join(value.split())
    elif mode == 'remove':
        return re.sub(r'\s+', '', value)
    return value
