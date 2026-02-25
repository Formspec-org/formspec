"""FEL expression parsing pass for Formspec linting."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from formspec.fel.errors import FelSyntaxError
from formspec.fel.parser import parse

from .diagnostic import LintDiagnostic
from .references import canonical_item_path

# Fields that contribute to the data-flow dependency graph (value → value).
_BIND_DATAFLOW_FIELDS = ("calculate", "relevant", "readonly", "required")
# Fields that are validation predicates; they may freely reference their own target
# without creating a real dependency cycle, so they are compiled without bind_target.
_BIND_VALIDATION_FIELDS = ("constraint",)
_BIND_EXPRESSION_FIELDS = _BIND_DATAFLOW_FIELDS + _BIND_VALIDATION_FIELDS


@dataclass(frozen=True, slots=True)
class CompiledExpression:
    ast: Any
    expression: str
    expression_path: str
    bind_target: str | None = None
    bind_path_pointer: str | None = None


@dataclass(slots=True)
class ExpressionCompilationResult:
    compiled: list[CompiledExpression] = field(default_factory=list)
    diagnostics: list[LintDiagnostic] = field(default_factory=list)


def compile_expressions(document: dict) -> ExpressionCompilationResult:
    """Compile all FEL-bearing expression slots in a definition document."""
    result = ExpressionCompilationResult()

    binds = document.get("binds", [])
    if isinstance(binds, list):
        for bind_index, bind in enumerate(binds):
            if not isinstance(bind, dict):
                continue
            bind_path_value = bind.get("path")
            bind_target = canonical_item_path(bind_path_value) if isinstance(bind_path_value, str) else None
            bind_path_pointer = f"$.binds[{bind_index}].path" if bind_target else None

            for field_name in _BIND_DATAFLOW_FIELDS:
                expression = bind.get(field_name)
                if isinstance(expression, str):
                    _parse_one(
                        result,
                        expression,
                        f"$.binds[{bind_index}].{field_name}",
                        "bind",
                        bind_target,
                        bind_path_pointer,
                    )

            # Validation predicates: parse for syntax but do not wire into the
            # dependency graph, so self-referential constraints are not flagged.
            for field_name in _BIND_VALIDATION_FIELDS:
                expression = bind.get(field_name)
                if isinstance(expression, str):
                    _parse_one(
                        result,
                        expression,
                        f"$.binds[{bind_index}].{field_name}",
                        "bind",
                        bind_target=None,
                        bind_path_pointer=None,
                    )

            if isinstance(bind.get("default"), str):
                default_value = bind["default"]
                if _looks_like_fel(default_value):
                    _parse_one(
                        result,
                        default_value,
                        f"$.binds[{bind_index}].default",
                        "bind",
                        bind_target,
                        bind_path_pointer,
                    )

    shapes = document.get("shapes", [])
    if isinstance(shapes, list):
        for shape_index, shape in enumerate(shapes):
            if not isinstance(shape, dict):
                continue
            constraint = shape.get("constraint")
            if isinstance(constraint, str):
                _parse_one(
                    result,
                    constraint,
                    f"$.shapes[{shape_index}].constraint",
                    "shape",
                )

            active_when = shape.get("activeWhen")
            if isinstance(active_when, str):
                _parse_one(
                    result,
                    active_when,
                    f"$.shapes[{shape_index}].activeWhen",
                    "shape",
                )

            context = shape.get("context")
            if isinstance(context, dict):
                for key, expr in context.items():
                    if isinstance(expr, str):
                        _parse_one(
                            result,
                            expr,
                            f"$.shapes[{shape_index}].context[{key!r}]",
                            "shape",
                        )

    screener = document.get("screener")
    if isinstance(screener, dict):
        routes = screener.get("routes")
        if isinstance(routes, list):
            for route_index, route in enumerate(routes):
                if not isinstance(route, dict):
                    continue
                condition = route.get("condition")
                if isinstance(condition, str):
                    _parse_one(
                        result,
                        condition,
                        f"$.screener.routes[{route_index}].condition",
                        "route",
                    )

    return result


def _parse_one(
    result: ExpressionCompilationResult,
    expression: str,
    path: str,
    owner_kind: str,
    bind_target: str | None = None,
    bind_path_pointer: str | None = None,
) -> None:
    try:
        ast = parse(expression)
    except FelSyntaxError as exc:
        result.diagnostics.append(
            LintDiagnostic(
                severity="error",
                code="E400",
                message=f"Invalid FEL syntax in {owner_kind} expression",
                path=path,
                category="expression",
                detail=str(exc),
            )
        )
        return

    result.compiled.append(
        CompiledExpression(
            ast=ast,
            expression=expression,
            expression_path=path,
            bind_target=bind_target,
            bind_path_pointer=bind_path_pointer,
        )
    )


def _looks_like_fel(value: str) -> bool:
    text = value.strip()
    if not text:
        return False

    if text in {"true", "false", "null"}:
        return True
    if text.startswith(("$", ".", "@", "(", "[", "{", "'", '"')):
        return True
    if re.fullmatch(r"-?\d+(?:\.\d+)?", text):
        return True
    if re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*\(", text):
        return True

    # Treat operator-bearing strings as candidate expressions.
    if any(token in text for token in (" + ", " - ", " * ", " / ", " < ", " > ", " = ", " and ", " or ", "?", ":")):
        return True

    return False
