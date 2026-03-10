"""§3-5 Mapping engine — bidirectional rule-based data transformation.

Applies declarative field rules (with priority ordering, FEL condition guards,
and pluggable transforms) to map between Formspec Response dicts and external
target-schema dicts in both forward and reverse directions.
"""

from __future__ import annotations

import copy
import re
from typing import Any

from ..fel import parse, Evaluator, Environment, build_default_registry
from ..fel.types import to_python, FelBoolean, FelTrue
from .transforms import TRANSFORMS, TransformContext, _DROP_SENTINEL


class MappingEngine:
    """Bidirectional rule engine: evaluates a mapping document's rules to transform data.

    Accepts a validated mapping document (mapping.schema.json) and exposes
    forward() (Response -> target) and reverse() (target -> Response) methods.
    """

    def __init__(self, mapping_doc: dict):
        self.doc = mapping_doc
        self.rules: list[dict] = mapping_doc.get('rules', [])
        self.defaults: dict = mapping_doc.get('defaults', {})
        self.auto_map: bool = mapping_doc.get('autoMap', False)
        self.direction: str = mapping_doc.get('direction', 'forward')
        self.target_schema: dict = mapping_doc.get('targetSchema', {})

    def forward(self, source_data: dict) -> dict:
        """Transform Formspec Response data to the target schema, applying rules by descending priority."""
        # Sort rules by priority (higher first)
        sorted_rules = sorted(self.rules, key=lambda r: r.get('priority', 0), reverse=True)

        ctx = TransformContext(source_data=source_data)
        result = dict(self.defaults)

        for rule in sorted_rules:
            self._apply_rule_forward(rule, source_data, result, ctx)

        # autoMap: copy unmentioned fields
        if self.auto_map:
            mentioned_sources = {r.get('sourcePath') for r in self.rules if r.get('sourcePath')}
            for key, value in source_data.items():
                if key not in mentioned_sources and key not in result:
                    result[key] = value

        return result

    def reverse(self, target_data: dict) -> dict:
        """Transform target-schema data back to Formspec Response format; skips non-bidirectional rules."""
        # Sort by reversePriority (higher first), fall back to priority
        sorted_rules = sorted(
            self.rules,
            key=lambda r: r.get('reversePriority', r.get('priority', 0)),
            reverse=True,
        )

        ctx = TransformContext(source_data=target_data, target_data=target_data)
        result = {}

        for rule in sorted_rules:
            if not rule.get('bidirectional', True):
                continue
            self._apply_rule_reverse(rule, target_data, result, ctx)

        return result

    def _apply_rule_forward(
        self, rule: dict, source: dict, target: dict, ctx: TransformContext
    ) -> None:
        """Execute one rule forward: resolve source, run transform, write to target (or delegate to array handler)."""
        # Check condition guard
        if not self._check_condition(rule, ctx):
            return

        transform_name = rule.get('transform', 'preserve')
        transform_fn = TRANSFORMS.get(transform_name)
        if transform_fn is None:
            raise ValueError(f"Unknown transform type: {transform_name}")

        source_path = rule.get('sourcePath')
        target_path = rule.get('targetPath')

        # Array descriptor handling
        array_desc = rule.get('array')
        if array_desc:
            self._apply_array_rule_forward(rule, array_desc, source, target, ctx)
            return

        # Get source value
        source_value = _resolve_path(source, source_path) if source_path else None

        # Apply transform
        result_value = transform_fn(source_value, rule, ctx)

        # Set target value (unless dropped)
        if target_path and not isinstance(result_value, type(_DROP_SENTINEL)):
            _set_path(target, target_path, result_value)

    def _apply_rule_reverse(
        self, rule: dict, target: dict, source: dict, ctx: TransformContext
    ) -> None:
        """Execute one rule in reverse: swap source/target paths, auto-invert valueMaps if needed."""
        # Use reverse override if present
        reverse_override = rule.get('reverse')
        if reverse_override:
            effective_rule = {**rule, **reverse_override}
        else:
            effective_rule = rule

        # Check condition guard
        if not self._check_condition(effective_rule, ctx):
            return

        transform_name = effective_rule.get('transform', 'preserve')

        # For reverse: swap source/target paths
        target_path = rule.get('targetPath')
        source_path = rule.get('sourcePath')

        # For valueMap, auto-invert if no explicit reverse
        if transform_name == 'valueMap' and not reverse_override:
            effective_rule = dict(effective_rule)
            vm = effective_rule.get('valueMap', {})
            if 'forward' in vm:
                if 'reverse' in vm:
                    effective_rule['valueMap'] = {
                        **vm, 'forward': vm['reverse'],
                    }
                else:
                    # Auto-invert
                    inverted = {str(v): k for k, v in vm['forward'].items()}
                    effective_rule['valueMap'] = {
                        **vm, 'forward': inverted,
                    }
            else:
                inverted = {str(v): k for k, v in vm.items()}
                effective_rule['valueMap'] = inverted

        transform_fn = TRANSFORMS.get(transform_name)
        if transform_fn is None:
            raise ValueError(f"Unknown transform type: {transform_name}")

        # Reverse: read from target_path, write to source_path
        value = _resolve_path(target, target_path) if target_path else None
        reverse_ctx = TransformContext(source_data=target, target_data=target)
        result_value = transform_fn(value, effective_rule, reverse_ctx)

        if source_path and not isinstance(result_value, type(_DROP_SENTINEL)):
            _set_path(source, source_path, result_value)

    def _apply_array_rule_forward(
        self, rule: dict, array_desc: dict, source: dict, target: dict, ctx: TransformContext
    ) -> None:
        """§4.12 Array descriptors: dispatch 'whole', 'each', or 'indexed' mode on source arrays."""
        mode = array_desc.get('mode', 'each')
        source_path = rule.get('sourcePath')
        target_path = rule.get('targetPath')
        source_value = _resolve_path(source, source_path) if source_path else None

        if mode == 'whole':
            # Treat entire array as single value
            transform_name = rule.get('transform', 'preserve')
            transform_fn = TRANSFORMS.get(transform_name)
            result = transform_fn(source_value, rule, ctx)
            if target_path and not isinstance(result, type(_DROP_SENTINEL)):
                _set_path(target, target_path, result)

        elif mode == 'each':
            # Apply transform (or inner rules) per element
            if not isinstance(source_value, list):
                return
            inner_rules = array_desc.get('innerRules')
            results = []
            for i, element in enumerate(source_value):
                if inner_rules:
                    item_result = {}
                    elem_ctx = TransformContext(
                        source_data=element if isinstance(element, dict) else source,
                        target_data=ctx.target_data,
                    )
                    for inner_rule in inner_rules:
                        inner_source = inner_rule.get('sourcePath')
                        inner_target = inner_rule.get('targetPath')
                        transform_name = inner_rule.get('transform', 'preserve')
                        transform_fn = TRANSFORMS.get(transform_name)
                        val = _resolve_path(element, inner_source) if inner_source and isinstance(element, dict) else element
                        result_val = transform_fn(val, inner_rule, elem_ctx)
                        if inner_target and not isinstance(result_val, type(_DROP_SENTINEL)):
                            _set_path(item_result, inner_target, result_val)
                    results.append(item_result)
                else:
                    transform_name = rule.get('transform', 'preserve')
                    transform_fn = TRANSFORMS.get(transform_name)
                    result_val = transform_fn(element, rule, ctx)
                    if not isinstance(result_val, type(_DROP_SENTINEL)):
                        results.append(result_val)
            if target_path:
                _set_path(target, target_path, results)

        elif mode == 'indexed':
            # Map by positional index
            if not isinstance(source_value, list):
                return
            inner_rules = array_desc.get('innerRules', [])
            for inner_rule in inner_rules:
                idx = inner_rule.get('index', 0)
                if idx < len(source_value):
                    element = source_value[idx]
                    inner_target = inner_rule.get('targetPath')
                    transform_name = inner_rule.get('transform', 'preserve')
                    transform_fn = TRANSFORMS.get(transform_name)
                    val = element
                    result_val = transform_fn(val, inner_rule, ctx)
                    full_target = f"{target_path}.{inner_target}" if target_path and inner_target else (inner_target or target_path)
                    if full_target and not isinstance(result_val, type(_DROP_SENTINEL)):
                        _set_path(target, full_target, result_val)

    def _check_condition(self, rule: dict, ctx: TransformContext) -> bool:
        """§4.13 Condition guard — evaluate the rule's FEL condition; returns False to skip the rule."""
        condition = rule.get('condition')
        if not condition:
            return True

        data = dict(ctx.source_data) if ctx.source_data else {}
        data['source'] = ctx.source_data
        if ctx.target_data:
            data['target'] = ctx.target_data
        env = Environment(data=data)
        functions = build_default_registry()
        ev = Evaluator(env, functions)
        ast_node = parse(condition)
        result = ev.evaluate(ast_node)

        if isinstance(result, FelBoolean):
            return result is FelTrue
        return False


def _resolve_path(data: Any, path: str | None) -> Any:
    """Walk a dot-notation path (with optional [n] indices) into a nested dict/list, returning None on miss."""
    if path is None:
        return data
    if not path:
        return data

    segments = _parse_path(path)
    current = data
    for seg in segments:
        if current is None:
            return None
        if isinstance(seg, int):
            if isinstance(current, list) and 0 <= seg < len(current):
                current = current[seg]
            else:
                return None
        elif isinstance(current, dict):
            current = current.get(seg)
        else:
            return None
    return current


def _set_path(data: dict, path: str, value: Any) -> None:
    """Set a value at a dot-notation path, auto-creating intermediate dicts and lists."""
    if not path:
        return

    segments = _parse_path(path)
    current = data
    for i, seg in enumerate(segments[:-1]):
        next_seg = segments[i + 1]
        if isinstance(seg, int):
            # Ensure list is large enough
            while len(current) <= seg:
                current.append({} if isinstance(next_seg, str) else [])
            if current[seg] is None:
                current[seg] = {} if isinstance(next_seg, str) else []
            current = current[seg]
        else:
            if seg not in current or current[seg] is None:
                current[seg] = [] if isinstance(next_seg, int) else {}
            elif not isinstance(current[seg], (dict, list)):
                # Promote scalar to dict with #text (XML text+attribute pattern)
                current[seg] = {'#text': current[seg]}
            current = current[seg]

    last = segments[-1]
    if isinstance(last, int):
        if isinstance(current, list):
            while len(current) <= last:
                current.append(None)
            current[last] = value
    else:
        current[last] = value


def _parse_path(path: str) -> list[str | int]:
    """Parse 'a.b[0].c' into ['a', 'b', 0, 'c'] — segment list for path traversal."""
    segments: list[str | int] = []
    for part in path.split('.'):
        # Check for bracket index: fieldName[0]
        m = re.match(r'^(\w+)\[(\d+)\]$', part)
        if m:
            segments.append(m.group(1))
            segments.append(int(m.group(2)))
        else:
            # Check for bare index: [0]
            m = re.match(r'^\[(\d+)\]$', part)
            if m:
                segments.append(int(m.group(1)))
            else:
                segments.append(part)
    return segments
