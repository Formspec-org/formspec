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
    FelTrue, FelValue, Environment, Evaluator as FelEvaluator, FelNull,
)
from .fel.types import from_python, to_python
from .fel.functions import build_default_registry
from .registry import Registry, RegistryEntry, _version_satisfies

_UNSET = object()


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
    extensions: dict | None = None
    initial_value: object = None
    pre_populate: dict | None = None


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

    def __init__(self, definition: dict, registries: list[Registry] | None = None) -> None:
        self._definition = definition
        self._default_nrb = definition.get('nonRelevantBehavior', 'remove')
        self._last_relevance: dict[str, bool] = {}
        self._registries = registries or []

        # Index registry entries by name for fast lookup during validation
        self._registry_entries: dict[str, RegistryEntry] = {}
        for reg in self._registries:
            for entry in reg.entries:
                # If multiple registries provide the same entry, the last one wins
                self._registry_entries[entry.name] = entry

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
                extensions=item.get('extensions'),
                initial_value=item.get('initialValue'),
                pre_populate=item.get('prePopulate'),
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

    def _eval_fel(
        self, expr: str, data: dict, variables: dict[str, FelValue],
        scope: dict | None = None, path: str | None = None,
    ):
        """Evaluate a FEL expression, optionally with a scope pushed."""
        if path is not None:
            variables = self._evaluate_variables_for_path(data, path)
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
        """Evaluate definition-wide variables in dependency order."""
        return self._evaluate_variables_for_path(data, None)

    def _evaluate_variables_for_path(self, data: dict, path: str | None) -> dict[str, FelValue]:
        """Evaluate variables visible at a given concrete evaluation path."""
        variables: dict[str, FelValue] = {}
        for name in self._var_order:
            variable = self._variables[name]
            scope_path = variable.get('scope', '#')
            scope = self._resolve_variable_scope(data, path, scope_path)
            if scope_path != '#' and scope is None:
                continue
            expr = variable['expression']
            result = self._eval_fel(expr, data, variables, scope=scope)
            variables[name] = result
        return variables

    def _resolve_variable_scope(self, data: dict, path: str | None, scope_path: str | None):
        if scope_path in (None, '#'):
            return None
        if path is None:
            return None
        concrete_scope_path = _concrete_scope_path(path, scope_path)
        if concrete_scope_path is None:
            return None
        scope_value = _get_path(data, concrete_scope_path)
        return scope_value if isinstance(scope_value, dict) else None

    def _eval_relevance(
        self, data: dict, variables: dict[str, FelValue], concrete_paths: set[str] | None = None,
    ) -> dict[str, bool]:
        """Evaluate relevant binds. Apply AND inheritance (parent false → children false)."""
        concrete_paths = concrete_paths or set()
        relevance: dict[str, bool] = {path: True for path in self._items}
        for path in concrete_paths:
            relevance[path] = True
        # First pass: evaluate explicit relevant binds
        for bind_path, bind in self._binds.items():
            if 'relevant' not in bind:
                continue
            if '[*]' in bind_path:
                for concrete_path, _, scope in _resolve_target_contexts(data, bind_path):
                    val = self._eval_fel(bind['relevant'], data, variables, scope=scope, path=concrete_path)
                    relevance[concrete_path] = val is FelTrue or val is FelNull
            else:
                val = self._eval_fel(bind['relevant'], data, variables, path=bind_path)
                relevance[bind_path] = val is FelTrue or val is FelNull

        # Second pass: AND inheritance
        for path, info in self._items.items():
            if info.parent and info.parent in relevance:
                if not relevance[info.parent]:
                    relevance[path] = False

        for path in sorted(concrete_paths, key=lambda p: p.count('.') + p.count('[')):
            if not relevance.get(path, True):
                continue
            for ancestor in _concrete_ancestors(path):
                if relevance.get(ancestor) is False:
                    relevance[path] = False
                    break
            if not relevance.get(path, True):
                continue
            definition_path = _strip_indices(path)
            for ancestor in _definition_ancestors(definition_path):
                if relevance.get(ancestor) is False:
                    relevance[path] = False
                    break

        return relevance

    def _eval_required(self, data: dict, variables: dict[str, FelValue]) -> dict[str, bool]:
        """Evaluate required binds. No inheritance."""
        required: dict[str, bool] = {}
        for path in self._items:
            bind = self._get_bind_for_path(path)
            if bind and 'required' in bind:
                val = self._eval_fel(bind['required'], data, variables, path=path)
                required[path] = val is FelTrue
        return required

    def _eval_readonly(self, data: dict, variables: dict[str, FelValue]) -> dict[str, bool]:
        """Evaluate readonly binds. OR inheritance (parent true → children true)."""
        readonly: dict[str, bool] = {}
        for path in self._items:
            bind = self._get_bind_for_path(path)
            if bind and 'readonly' in bind:
                val = self._eval_fel(bind['readonly'], data, variables, path=path)
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
                val = self._eval_fel(calc, data, variables, path=path)
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
            concrete_path = f'{base}[{i + 1}].{suffix}' if suffix else f'{base}[{i + 1}]'
            result = self._eval_fel(calc, data, variables, scope=row, path=concrete_path)
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

    def _get_bind_property_for_path(self, path: str, prop: str, default=None):
        for candidate in _bind_lookup_candidates(path):
            bind = self._binds.get(candidate)
            if bind and prop in bind:
                return bind[prop]
        return default

    def _eval_constraint(
        self, expr: str, data: dict, variables: dict[str, FelValue],
        self_value=_UNSET, row: dict | None = None, path: str | None = None,
        null_passes: bool = False,
    ) -> bool:
        """Evaluate a FEL constraint. Injects self_value as bare $ (scope key '').
        If row is provided, row fields are also pushed into scope (for wildcard binds)."""
        if self_value is not _UNSET or row is not None:
            scope = {}
            if row is not None:
                scope.update(row)
            if self_value is not _UNSET:
                scope[''] = self_value
            result = self._eval_fel(expr, data, variables, scope=scope, path=path)
        else:
            result = self._eval_fel(expr, data, variables, path=path)
        return result is FelTrue or (null_passes and result is FelNull)

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
                if not self._eval_constraint(
                    bind['constraint'], data, variables, self_value=val, path=path, null_passes=True,
                ):
                    msg = bind.get('constraintMessage', f'Constraint failed for {path}')
                    results.append({
                        'severity': 'error',
                        'path': path,
                        'message': msg,
                        'constraintKind': 'constraint',
                        'code': 'CONSTRAINT_FAILED',
                        'source': 'bind',
                    })

            # Registry-defined constraints
            if info.extensions:
                for ext_name, enabled in info.extensions.items():
                    if not enabled:
                        continue
                    entry = self._registry_entries.get(ext_name)
                    if not entry:
                        results.append({
                            'severity': 'error',
                            'path': path,
                            'message': f"Unresolved extension '{ext_name}': no matching registry entry loaded",
                            'constraintKind': 'constraint',
                            'code': 'UNRESOLVED_EXTENSION',
                            'source': 'bind',
                        })
                        continue

                    # §7.3 Compatibility check
                    formspec_version = self._definition.get('$formspec', '1.0')
                    required_range = (entry.compatibility or {}).get('formspecVersion')
                    if required_range and not _version_satisfies(formspec_version, required_range):
                        results.append({
                            'severity': 'warning',
                            'path': path,
                            'message': f"Extension '{ext_name}' requires formspec {required_range} but definition uses {formspec_version}",
                            'constraintKind': 'constraint',
                            'code': 'EXTENSION_COMPATIBILITY_MISMATCH',
                            'source': 'bind',
                        })

                    # §7.4 Status enforcement
                    if entry.status == 'retired':
                        results.append({
                            'severity': 'warning',
                            'path': path,
                            'message': f"Extension '{ext_name}' is retired and should not be used",
                            'constraintKind': 'constraint',
                            'code': 'EXTENSION_RETIRED',
                            'source': 'bind',
                        })
                    elif entry.status == 'deprecated':
                        notice = entry.deprecation_notice or f"Extension '{ext_name}' is deprecated"
                        results.append({
                            'severity': 'info',
                            'path': path,
                            'message': notice,
                            'constraintKind': 'constraint',
                            'code': 'EXTENSION_DEPRECATED',
                            'source': 'bind',
                        })

                    if _is_empty(val) or not entry.constraints:
                        continue
                    
                    constraints = entry.constraints
                    
                    # Pattern validation
                    display_name = (entry.metadata or {}).get('displayName')
                    pattern = constraints.get('pattern')
                    if pattern and not re.search(pattern, str(val)):
                        msg = bind.get('constraintMessage') if bind else None
                        if not msg and display_name:
                            msg = f"Must be a valid {display_name}"
                        results.append({
                            'severity': 'error',
                            'path': path,
                            'message': msg or f"Value does not match pattern: {pattern}",
                            'constraintKind': 'constraint',
                            'code': 'PATTERN_MISMATCH',
                            'source': 'bind',
                        })
                    
                    # MaxLength validation
                    max_len = constraints.get('maxLength')
                    if max_len is not None and len(str(val)) > max_len:
                        msg = bind.get('constraintMessage') if bind else None
                        results.append({
                            'severity': 'error',
                            'path': path,
                            'message': msg or f"Value is too long (max {max_len} characters)",
                            'constraintKind': 'constraint',
                            'code': 'MAX_LENGTH_EXCEEDED',
                            'source': 'bind',
                        })
                    
                    # Range validation (min/max)
                    try:
                        num_val = float(val) if isinstance(val, (int, float, Decimal, str)) else None
                        if num_val is not None:
                            minimum = constraints.get('minimum')
                            if minimum is not None and num_val < float(minimum):
                                msg = bind.get('constraintMessage') if bind else None
                                results.append({
                                    'severity': 'error',
                                    'path': path,
                                    'message': msg or f"Value must be at least {minimum}",
                                    'constraintKind': 'constraint',
                                    'code': 'RANGE_UNDERFLOW',
                                    'source': 'bind',
                                })
                            
                            maximum = constraints.get('maximum')
                            if maximum is not None and num_val > float(maximum):
                                msg = bind.get('constraintMessage') if bind else None
                                results.append({
                                    'severity': 'error',
                                    'path': path,
                                    'message': msg or f"Value must be at most {maximum}",
                                    'constraintKind': 'constraint',
                                    'code': 'RANGE_OVERFLOW',
                                    'source': 'bind',
                                })
                    except (ValueError, TypeError):
                        pass

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
            if not relevance.get(concrete_path, relevance.get(_strip_indices(concrete_path), True)):
                continue

            val = row.get(suffix) if suffix and '.' not in suffix else None

            # Required
            if 'required' in bind:
                req_val = self._eval_fel(bind['required'], data, variables, scope=row, path=concrete_path)
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
                if not self._eval_constraint(
                    bind['constraint'], data, variables,
                    self_value=val, row=row, path=concrete_path, null_passes=True,
                ):
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
        self, data: dict, variables: dict[str, FelValue], mode: str, relevance: dict[str, bool],
    ) -> list[dict]:
        """Evaluate shape constraints, respecting timing."""
        results: list[dict] = []
        for shape in self._shapes:
            timing = shape.get('timing', 'continuous')
            if timing == 'submit' and mode != 'submit':
                continue
            self._eval_shape(shape, data, variables, results, relevance)
        return results

    def _eval_shape(
        self, shape: dict, data: dict, variables: dict[str, FelValue],
        out: list[dict], relevance: dict[str, bool],
    ) -> bool:
        target = shape.get('target', '#')
        contexts = self._resolve_shape_targets(data, target)
        if not contexts:
            return True

        passed = True
        for target_path, target_val, scope in contexts:
            if target_path != '#' and not relevance.get(target_path, relevance.get(_strip_indices(target_path), True)):
                continue
            if not self._eval_shape_at_target(shape, data, variables, out, target_path, target_val, scope):
                passed = False
        return passed

    def _eval_shape_at_target(
        self, shape: dict, data: dict, variables: dict[str, FelValue],
        out: list[dict], target_path: str, target_val, scope: dict | None,
    ) -> bool:
        if 'activeWhen' in shape:
            if not self._eval_expr(shape['activeWhen'], data, variables, self_value=target_val, row=scope, path=target_path):
                return True

        passed = True

        if 'constraint' in shape:
            passed = self._eval_constraint(shape['constraint'], data, variables, self_value=target_val, row=scope, path=target_path)

        if passed and 'and' in shape:
            passed = all(self._eval_expr(e, data, variables, self_value=target_val, row=scope, path=target_path) for e in shape['and'])

        if passed and 'or' in shape:
            passed = any(self._eval_expr(e, data, variables, self_value=target_val, row=scope, path=target_path) for e in shape['or'])

        if passed and 'not' in shape:
            passed = not self._eval_expr(shape['not'], data, variables, self_value=target_val, row=scope, path=target_path)

        if passed and 'xone' in shape:
            passing = sum(1 for e in shape['xone'] if self._eval_expr(e, data, variables, self_value=target_val, row=scope, path=target_path))
            passed = passing == 1

        if not passed:
            out.append({
                'severity': shape.get('severity', 'error'),
                'path': target_path,
                'message': shape['message'],
                'constraintKind': 'shape',
                'code': shape.get('code', 'SHAPE_FAILED'),
                'source': 'shape',
                'shapeId': shape['id'],
            })

        return passed

    def _resolve_shape_targets(self, data: dict, target: str) -> list[tuple[str, object, dict | None]]:
        if target == '#':
            return [('#', None, None)]
        return _resolve_target_contexts(data, target)

    def _eval_expr(
        self, expr: str, data: dict, variables: dict[str, FelValue],
        self_value=_UNSET, row: dict | None = None, path: str | None = None,
    ) -> bool:
        shape = self._shapes_by_id.get(expr)
        if shape is not None:
            out: list[dict] = []
            return self._eval_shape(shape, data, variables, out, {'#': True})
        if self_value is not _UNSET or row is not None:
            return self._eval_constraint(expr, data, variables, self_value=self_value, row=row, path=path)
        result = self._eval_fel(expr, data, variables, path=path)
        return result is FelTrue

    # ── Phase 4: Apply NRB ───────────────────────────────────────────────

    def _apply_nrb(self, data: dict, relevance: dict[str, bool]) -> dict:
        """Apply nonRelevantBehavior to the output data."""
        for path in list(relevance.keys()):
            if relevance[path]:
                continue  # relevant — leave alone

            nrb = self._get_nrb_for_path(path)

            if nrb == 'remove':
                _delete_path(data, path)
            elif nrb == 'empty':
                _set_path(data, path, None)
            # 'keep' — do nothing

        return data

    def _get_nrb_for_path(self, path: str) -> str:
        """Get nonRelevantBehavior: field bind → ancestor binds → definition default."""
        return self._get_bind_property_for_path(path, 'nonRelevantBehavior', self._default_nrb)

    def _get_excluded_value_for_path(self, path: str) -> str:
        return self._get_bind_property_for_path(path, 'excludedValue', 'preserve')

    def _apply_excluded_values(self, data: dict, relevance: dict[str, bool]) -> dict:
        for path, is_relevant in relevance.items():
            if is_relevant or path == '#':
                continue
            if self._get_excluded_value_for_path(path) != 'null':
                continue
            _set_path(data, path, None)
        return data

    def _apply_initializers(self, data: dict) -> None:
        self._apply_initializers_to_items(self._definition.get('items', []), data, data)

    def _apply_initializers_to_items(self, items: list[dict], container: dict, root_data: dict) -> None:
        for item in items:
            key = item.get('key')
            if not key:
                continue
            item_type = item.get('type', 'field')

            if item_type == 'group':
                if item.get('repeatable', False):
                    arr = container.get(key, [])
                    if isinstance(arr, list):
                        for row in arr:
                            if isinstance(row, dict):
                                self._apply_initializers_to_items(item.get('children', []), row, root_data)
                    continue

                subcontainer = container.get(key)
                created = False
                if not isinstance(subcontainer, dict):
                    subcontainer = {}
                    created = True
                self._apply_initializers_to_items(item.get('children', []), subcontainer, root_data)
                if created and subcontainer:
                    container[key] = subcontainer
                continue

            if key not in container:
                value = self._evaluate_initializer(item, root_data)
                if value is not _UNSET:
                    container[key] = value

            if item.get('children'):
                subcontainer = container.get(key)
                if isinstance(subcontainer, dict):
                    self._apply_initializers_to_items(item['children'], subcontainer, root_data)

    def _evaluate_initializer(self, item: dict, root_data: dict):
        pre_populate = item.get('prePopulate')
        if isinstance(pre_populate, dict):
            instance_name = pre_populate.get('instance')
            instance_path = pre_populate.get('path')
            if instance_name and instance_path:
                return _get_nested(self._instances.get(instance_name, {}), instance_path)

        initial_value = item.get('initialValue', _UNSET)
        if initial_value is _UNSET:
            return _UNSET
        if isinstance(initial_value, str) and initial_value.startswith('='):
            result = self._eval_fel(initial_value[1:], root_data, {})
            return to_python(result)
        return copy.deepcopy(initial_value)

    def _apply_relevance_defaults(self, data: dict, relevance: dict[str, bool]) -> bool:
        changed = False
        for path, is_relevant in relevance.items():
            if not is_relevant:
                continue
            if self._last_relevance.get(path, True):
                continue
            default_value = self._get_bind_property_for_path(path, 'default', _UNSET)
            if default_value is _UNSET:
                continue
            current_value = _get_path(data, path)
            if not _is_empty(current_value):
                continue
            _set_path(data, path, copy.deepcopy(default_value))
            changed = True
        return changed

    # ── Public API ───────────────────────────────────────────────────────

    def process(self, data: dict, *, mode: str = 'submit') -> ProcessingResult:
        """Run all 4 phases and return a ProcessingResult."""
        # Deep copy to avoid mutating caller's data
        data = copy.deepcopy(data)
        self._apply_initializers(data)

        # Phase 1: Expand repeats
        repeat_counts, concrete_paths = self._expand_repeats(data)

        # Phase 2: Recalculate
        self._apply_whitespace(data)
        # Calculate binds first (so computed fields have values for variable expressions)
        self._eval_calculates(data, {})
        variables = self.evaluate_variables(data)
        relevance = self._eval_relevance(data, variables, concrete_paths)
        if self._apply_relevance_defaults(data, relevance):
            self._eval_calculates(data, {})
            variables = self.evaluate_variables(data)
            relevance = self._eval_relevance(data, variables, concrete_paths)
        eval_data = self._apply_excluded_values(copy.deepcopy(data), relevance)
        variables = self.evaluate_variables(eval_data)
        required = self._eval_required(eval_data, variables)
        readonly = self._eval_readonly(eval_data, variables)

        # Phase 3: Revalidate
        bind_results = self._validate_binds(eval_data, variables, relevance, required, repeat_counts)
        shape_results = self._eval_shapes(eval_data, variables, mode, relevance)
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
        self._last_relevance = dict(relevance)

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

    def evaluate_screener(
        self, answers: dict,
    ) -> dict[str, object] | None:
        """Evaluate screener routes in declaration order against screener-only answers."""
        screener = self._definition.get('screener')
        if not isinstance(screener, dict):
            return None

        routes = screener.get('routes')
        if not isinstance(routes, list):
            return None

        for route in routes:
            if not isinstance(route, dict):
                continue
            condition = route.get('condition')
            target = route.get('target')
            if not isinstance(condition, str) or not isinstance(target, str):
                continue

            try:
                result = evaluate(condition, answers, instances=self._instances).value
            except Exception:
                continue

            if result is not FelTrue:
                continue

            match: dict[str, object] = {'target': target}
            if 'label' in route:
                match['label'] = route['label']
            if 'extensions' in route:
                match['extensions'] = copy.deepcopy(route['extensions'])
            return match

        return None


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


def _path_tokens(path: str) -> list[object]:
    tokens: list[object] = []
    for segment in path.split('.'):
        key_match = re.match(r'^([a-zA-Z][a-zA-Z0-9_]*)', segment)
        if key_match:
            tokens.append(key_match.group(1))
        for index in re.findall(r'\[(\d+)\]', segment):
            tokens.append(int(index))
    return tokens


def _set_path(data: dict, path: str, value) -> None:
    tokens = _path_tokens(path)
    if not tokens:
        return
    current = data
    for token in tokens[:-1]:
        if isinstance(token, str):
            if not isinstance(current, dict):
                return
            if token not in current or current[token] is None:
                current[token] = {}
            current = current[token]
        else:
            if not isinstance(current, list):
                return
            index = token - 1
            if index < 0 or index >= len(current):
                return
            current = current[index]
    last = tokens[-1]
    if isinstance(last, str):
        if isinstance(current, dict):
            current[last] = value
    else:
        if isinstance(current, list):
            index = last - 1
            if 0 <= index < len(current):
                current[index] = value


def _get_path(data: dict, path: str):
    tokens = _path_tokens(path)
    if not tokens:
        return None
    current = data
    for token in tokens:
        if isinstance(token, str):
            if not isinstance(current, dict):
                return None
            current = current.get(token)
        else:
            if not isinstance(current, list):
                return None
            index = token - 1
            if index < 0 or index >= len(current):
                return None
            current = current[index]
        if current is None:
            return None
    return current


def _delete_path(data: dict, path: str) -> None:
    tokens = _path_tokens(path)
    if not tokens:
        return
    current = data
    for token in tokens[:-1]:
        if isinstance(token, str):
            if not isinstance(current, dict):
                return
            current = current.get(token)
        else:
            if not isinstance(current, list):
                return
            index = token - 1
            if index < 0 or index >= len(current):
                return
            current = current[index]
        if current is None:
            return
    last = tokens[-1]
    if isinstance(last, str):
        if isinstance(current, dict):
            current.pop(last, None)
    else:
        if isinstance(current, list):
            index = last - 1
            if 0 <= index < len(current):
                current[index] = None


def _is_empty(value) -> bool:
    """Check if a value is empty (null, empty string, empty list)."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == '':
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    # Money values are objects; treat "no amount" as empty so required/constraints behave.
    if isinstance(value, dict) and 'amount' in value and 'currency' in value and len(value) == 2:
        amt = value.get('amount')
        if amt is None:
            return True
        if isinstance(amt, str) and amt.strip() == '':
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


_TARGET_SEGMENT_RE = re.compile(r'^(?P<key>[a-zA-Z][a-zA-Z0-9_]*)(?:\[(?P<index>\*|\d+)\])?$')


def _strip_indices(path: str) -> str:
    return re.sub(r'\[\d+\]', '', path)


def _definition_ancestors(path: str) -> list[str]:
    ancestors: list[str] = []
    current = path
    while '.' in current:
        current = current.rsplit('.', 1)[0]
        ancestors.append(current)
    return ancestors


def _concrete_ancestors(path: str) -> list[str]:
    ancestors: list[str] = []
    current = path
    while '.' in current:
        current = current.rsplit('.', 1)[0]
        ancestors.append(current)
    return ancestors


def _concrete_scope_path(path: str, scope_path: str) -> str | None:
    for candidate in [path, *_concrete_ancestors(path)]:
        if _strip_indices(candidate) == scope_path:
            return candidate
    return None


def _to_wildcard_path(path: str) -> str:
    return re.sub(r'\[\d+\]', '[*]', path)


def _bind_lookup_candidates(path: str) -> list[str]:
    candidates: list[str] = []
    current: str | None = path
    while current:
        for candidate in (current, _to_wildcard_path(current), _strip_indices(current)):
            if candidate not in candidates:
                candidates.append(candidate)
        current = current.rsplit('.', 1)[0] if '.' in current else None
    return candidates


def _resolve_target_contexts(data: dict, target: str) -> list[tuple[str, object, dict | None]]:
    """Resolve a shape target path to concrete runtime paths and evaluation scopes."""
    parts = target.split('.')
    resolved: list[tuple[str, object, dict | None]] = []

    def walk(container: object, index: int, concrete_parts: list[str]) -> None:
        if index >= len(parts) or not isinstance(container, dict):
            return

        match = _TARGET_SEGMENT_RE.match(parts[index])
        if not match:
            return

        key = match.group('key')
        segment_index = match.group('index')
        node = container.get(key)
        concrete_key = key

        if segment_index is None:
            if index == len(parts) - 1:
                resolved.append(('.'.join(concrete_parts + [concrete_key]), node, container))
                return
            walk(node, index + 1, concrete_parts + [concrete_key])
            return

        if not isinstance(node, list):
            return

        if segment_index == '*':
            for position, entry in enumerate(node, 1):
                concrete_segment = f'{key}[{position}]'
                if index == len(parts) - 1:
                    scope = entry if isinstance(entry, dict) else container
                    resolved.append(('.'.join(concrete_parts + [concrete_segment]), entry, scope))
                else:
                    walk(entry, index + 1, concrete_parts + [concrete_segment])
            return

        position = int(segment_index)
        if position < 1 or position > len(node):
            return
        entry = node[position - 1]
        concrete_segment = f'{key}[{position}]'
        if index == len(parts) - 1:
            scope = entry if isinstance(entry, dict) else container
            resolved.append(('.'.join(concrete_parts + [concrete_segment]), entry, scope))
            return
        walk(entry, index + 1, concrete_parts + [concrete_segment])

    walk(data, 0, [])
    return resolved
