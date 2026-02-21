"""FEL tree-walking evaluator.

Implements full FEL semantics: type strictness, null propagation,
short-circuit evaluation, element-wise array operations, decimal arithmetic.
"""

from __future__ import annotations

import decimal
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Callable

from . import ast_nodes as ast
from .errors import Diagnostic, FelSyntaxError, SourcePos, Severity
from .types import (
    FelArray, FelBoolean, FelDate, FelMoney, FelNull, FelNumber,
    FelObject, FelString, FelTrue, FelFalse, FelValue,
    _FelNullType, fel_bool, fel_decimal, from_python, is_null, typeof,
)
from .environment import Environment


@dataclass
class EvalResult:
    """Result of evaluating a FEL expression."""
    value: FelValue
    diagnostics: list[Diagnostic] = field(default_factory=list)


class Evaluator:
    """Tree-walking FEL evaluator."""

    def __init__(self, env: Environment, functions: dict | None = None):
        self.env = env
        self.diagnostics: list[Diagnostic] = []
        # Function registry: name -> FuncDef (set up by functions module)
        self._functions = functions or {}

    def evaluate(self, node) -> FelValue:
        """Evaluate an AST node, return a FelValue."""
        if isinstance(node, ast.NumberLiteral):
            return FelNumber(node.value)
        if isinstance(node, ast.StringLiteral):
            return FelString(node.value)
        if isinstance(node, ast.BooleanLiteral):
            return FelTrue if node.value else FelFalse
        if isinstance(node, ast.NullLiteral):
            return FelNull
        if isinstance(node, ast.DateLiteral):
            return FelDate(node.value)
        if isinstance(node, ast.ArrayLiteral):
            return FelArray(tuple(self.evaluate(e) for e in node.elements))
        if isinstance(node, ast.ObjectLiteral):
            return FelObject({k: self.evaluate(v) for k, v in node.entries})
        if isinstance(node, ast.FieldRef):
            return self._eval_field_ref(node)
        if isinstance(node, ast.ContextRef):
            return self.env.resolve_context(node.name, node.arg, list(node.tail))
        if isinstance(node, ast.BinaryOp):
            return self._eval_binary_op(node)
        if isinstance(node, ast.UnaryOp):
            return self._eval_unary_op(node)
        if isinstance(node, ast.TernaryOp):
            return self._eval_conditional(node.condition, node.then_expr, node.else_expr, node.pos)
        if isinstance(node, ast.IfThenElse):
            return self._eval_conditional(node.condition, node.then_expr, node.else_expr, node.pos)
        if isinstance(node, ast.LetBinding):
            return self._eval_let(node)
        if isinstance(node, ast.FunctionCall):
            return self._eval_function_call(node)
        if isinstance(node, ast.MembershipOp):
            return self._eval_membership(node)
        if isinstance(node, ast.PostfixAccess):
            return self._eval_postfix(node)
        self._diag(f"Unknown AST node type: {type(node).__name__}", None)
        return FelNull

    # -- Field references --------------------------------------------------

    def _eval_field_ref(self, node: ast.FieldRef) -> FelValue:
        path = []
        for seg in node.segments:
            if isinstance(seg, ast.DotSegment):
                path.append(seg.name)
            elif isinstance(seg, ast.IndexSegment):
                # Will be handled during resolution
                path.append(seg)
            elif isinstance(seg, ast.WildcardSegment):
                path.append(seg)
        return self._resolve_complex_path(path)

    def _resolve_complex_path(self, path) -> FelValue:
        """Resolve a path that may contain index/wildcard segments."""
        # Simple case: all string segments
        if all(isinstance(s, str) for s in path):
            return self.env.resolve_field(path)

        # Complex case with index/wildcard
        current = self.env.data
        for i, seg in enumerate(path):
            if isinstance(seg, str):
                if isinstance(current, dict):
                    current = current.get(seg)
                    if current is None:
                        return FelNull
                else:
                    return FelNull
            elif isinstance(seg, ast.IndexSegment):
                if not isinstance(current, list):
                    return FelNull
                idx = seg.index - 1  # 1-based to 0-based
                if idx < 0 or idx >= len(current):
                    self._diag(f"Index {seg.index} out of bounds (1..{len(current)})", None)
                    return FelNull
                current = current[idx]
            elif isinstance(seg, ast.WildcardSegment):
                if not isinstance(current, list):
                    return FelNull
                # Remaining path applied to each element
                remaining = path[i + 1:]
                results = []
                for item in current:
                    val = self._resolve_sub_path(item, remaining)
                    results.append(val)
                return FelArray(tuple(results))
        return from_python(current)

    def _resolve_sub_path(self, obj, path) -> FelValue:
        current = obj
        for seg in path:
            if isinstance(seg, str):
                if isinstance(current, dict):
                    current = current.get(seg)
                    if current is None:
                        return FelNull
                else:
                    return FelNull
            # Nested index/wildcard could be handled recursively
        return from_python(current)

    # -- Binary operators --------------------------------------------------

    def _eval_binary_op(self, node: ast.BinaryOp) -> FelValue:
        op = node.op

        # Short-circuit operators
        if op == 'and':
            return self._eval_and(node)
        if op == 'or':
            return self._eval_or(node)
        if op == '??':
            return self._eval_null_coalesce(node)

        left = self.evaluate(node.left)
        right = self.evaluate(node.right)

        # Element-wise array wrapper
        if isinstance(left, FelArray) or isinstance(right, FelArray):
            return self._apply_elementwise(op, left, right, node.pos)

        return self._apply_scalar_op(op, left, right, node.pos)

    def _apply_elementwise(self, op: str, left: FelValue, right: FelValue, pos) -> FelValue:
        """Apply operator element-wise on arrays, with scalar broadcast."""
        if isinstance(left, FelArray) and isinstance(right, FelArray):
            if len(left) != len(right):
                self._diag(f"Array length mismatch: {len(left)} vs {len(right)}", pos)
                return FelNull
            return FelArray(tuple(
                self._apply_scalar_op(op, l, r, pos)
                for l, r in zip(left.elements, right.elements)
            ))
        if isinstance(left, FelArray):
            return FelArray(tuple(
                self._apply_scalar_op(op, l, right, pos)
                for l in left.elements
            ))
        if isinstance(right, FelArray):
            return FelArray(tuple(
                self._apply_scalar_op(op, left, r, pos)
                for r in right.elements
            ))
        return self._apply_scalar_op(op, left, right, pos)

    def _apply_scalar_op(self, op: str, left: FelValue, right: FelValue, pos) -> FelValue:
        """Apply a binary operator to scalar values."""
        # Equality: special null handling (not propagation)
        if op == '=':
            return self._eval_eq(left, right, pos)
        if op == '!=':
            result = self._eval_eq(left, right, pos)
            if is_null(result):
                return FelNull
            return FelTrue if result is FelFalse else FelFalse

        # All other operators: null propagation
        if is_null(left) or is_null(right):
            return FelNull

        # Arithmetic
        if op in ('+', '-', '*', '/', '%'):
            return self._eval_arithmetic(op, left, right, pos)
        # String concatenation
        if op == '&':
            return self._eval_concat(left, right, pos)
        # Comparison
        if op in ('<', '>', '<=', '>='):
            return self._eval_comparison(op, left, right, pos)

        self._diag(f"Unknown operator: {op}", pos)
        return FelNull

    def _eval_eq(self, left: FelValue, right: FelValue, pos) -> FelValue:
        """Equality with special null semantics per §3.3."""
        if is_null(left) and is_null(right):
            return FelTrue
        if is_null(left) or is_null(right):
            return FelFalse
        # Type check
        if type(left) != type(right):
            self._diag(f"Type mismatch in equality: {typeof(left)} vs {typeof(right)}", pos)
            return FelNull
        if isinstance(left, FelNumber):
            return fel_bool(left.value == right.value)
        if isinstance(left, FelString):
            return fel_bool(left.value == right.value)
        if isinstance(left, FelBoolean):
            return fel_bool(left.value == right.value)
        if isinstance(left, FelDate):
            return fel_bool(left.value == right.value)
        if isinstance(left, FelMoney):
            return fel_bool(left.amount == right.amount and left.currency == right.currency)
        return FelFalse

    def _eval_arithmetic(self, op: str, left: FelValue, right: FelValue, pos) -> FelValue:
        if not isinstance(left, FelNumber) or not isinstance(right, FelNumber):
            self._diag(f"Arithmetic requires numbers, got {typeof(left)} {op} {typeof(right)}", pos)
            return FelNull
        try:
            ctx = decimal.Context(prec=34, rounding=decimal.ROUND_HALF_EVEN)
            if op == '+':
                return FelNumber(ctx.add(left.value, right.value))
            if op == '-':
                return FelNumber(ctx.subtract(left.value, right.value))
            if op == '*':
                return FelNumber(ctx.multiply(left.value, right.value))
            if op == '/':
                if right.value == 0:
                    self._diag("Division by zero", pos)
                    return FelNull
                return FelNumber(ctx.divide(left.value, right.value))
            if op == '%':
                if right.value == 0:
                    self._diag("Modulo by zero", pos)
                    return FelNull
                # Python Decimal remainder follows sign of dividend
                return FelNumber(ctx.remainder(left.value, right.value))
        except (decimal.InvalidOperation, decimal.Overflow) as e:
            self._diag(f"Arithmetic error: {e}", pos)
            return FelNull
        return FelNull

    def _eval_concat(self, left: FelValue, right: FelValue, pos) -> FelValue:
        if not isinstance(left, FelString) or not isinstance(right, FelString):
            self._diag(f"Concatenation requires strings, got {typeof(left)} & {typeof(right)}", pos)
            return FelNull
        return FelString(left.value + right.value)

    def _eval_comparison(self, op: str, left: FelValue, right: FelValue, pos) -> FelValue:
        if type(left) != type(right):
            self._diag(f"Comparison type mismatch: {typeof(left)} vs {typeof(right)}", pos)
            return FelNull
        if isinstance(left, FelNumber):
            a, b = left.value, right.value
        elif isinstance(left, FelString):
            a, b = left.value, right.value
        elif isinstance(left, FelDate):
            a, b = left.value, right.value
        else:
            self._diag(f"Cannot compare {typeof(left)} values", pos)
            return FelNull
        if op == '<':
            return fel_bool(a < b)
        if op == '>':
            return fel_bool(a > b)
        if op == '<=':
            return fel_bool(a <= b)
        if op == '>=':
            return fel_bool(a >= b)
        return FelNull

    # -- Short-circuit operators -------------------------------------------

    def _eval_and(self, node: ast.BinaryOp) -> FelValue:
        left = self.evaluate(node.left)
        if is_null(left):
            return FelNull
        if not isinstance(left, FelBoolean):
            self._diag(f"'and' requires boolean, got {typeof(left)}", node.pos)
            return FelNull
        if left is FelFalse:
            return FelFalse  # Short-circuit
        right = self.evaluate(node.right)
        if is_null(right):
            return FelNull
        if not isinstance(right, FelBoolean):
            self._diag(f"'and' requires boolean, got {typeof(right)}", node.pos)
            return FelNull
        return right

    def _eval_or(self, node: ast.BinaryOp) -> FelValue:
        left = self.evaluate(node.left)
        if is_null(left):
            return FelNull
        if not isinstance(left, FelBoolean):
            self._diag(f"'or' requires boolean, got {typeof(left)}", node.pos)
            return FelNull
        if left is FelTrue:
            return FelTrue  # Short-circuit
        right = self.evaluate(node.right)
        if is_null(right):
            return FelNull
        if not isinstance(right, FelBoolean):
            self._diag(f"'or' requires boolean, got {typeof(right)}", node.pos)
            return FelNull
        return right

    def _eval_null_coalesce(self, node: ast.BinaryOp) -> FelValue:
        left = self.evaluate(node.left)
        if is_null(left):
            return self.evaluate(node.right)
        return left

    # -- Unary operators ---------------------------------------------------

    def _eval_unary_op(self, node: ast.UnaryOp) -> FelValue:
        operand = self.evaluate(node.operand)
        if node.op == 'not':
            if is_null(operand):
                return FelNull
            if not isinstance(operand, FelBoolean):
                self._diag(f"'not' requires boolean, got {typeof(operand)}", node.pos)
                return FelNull
            return FelFalse if operand is FelTrue else FelTrue
        if node.op == '-':
            if is_null(operand):
                return FelNull
            if not isinstance(operand, FelNumber):
                self._diag(f"Unary '-' requires number, got {typeof(operand)}", node.pos)
                return FelNull
            return FelNumber(-operand.value)
        return FelNull

    # -- Conditional -------------------------------------------------------

    def _eval_conditional(self, condition_node, then_node, else_node, pos) -> FelValue:
        cond = self.evaluate(condition_node)
        if is_null(cond):
            # For keyword if-then-else / ternary in expression context,
            # null condition propagates as null
            return FelNull
        if not isinstance(cond, FelBoolean):
            self._diag(f"Condition requires boolean, got {typeof(cond)}", pos)
            return FelNull
        if cond is FelTrue:
            return self.evaluate(then_node)
        return self.evaluate(else_node)

    # -- Let binding -------------------------------------------------------

    def _eval_let(self, node: ast.LetBinding) -> FelValue:
        val = self.evaluate(node.value)
        self.env.push_scope({node.name: val})
        try:
            return self.evaluate(node.body)
        finally:
            self.env.pop_scope()

    # -- Membership --------------------------------------------------------

    def _eval_membership(self, node: ast.MembershipOp) -> FelValue:
        val = self.evaluate(node.value)
        container = self.evaluate(node.container)
        if is_null(val) or is_null(container):
            return FelNull
        if not isinstance(container, FelArray):
            self._diag(f"'in' requires array on right side, got {typeof(container)}", node.pos)
            return FelNull
        found = False
        for elem in container.elements:
            eq = self._eval_eq(val, elem, node.pos)
            if isinstance(eq, FelBoolean) and eq is FelTrue:
                found = True
                break
        result = fel_bool(found)
        if node.negated:
            return FelFalse if result is FelTrue else FelTrue
        return result

    # -- Postfix access ----------------------------------------------------

    def _eval_postfix(self, node: ast.PostfixAccess) -> FelValue:
        val = self.evaluate(node.expr)
        for seg in node.segments:
            if is_null(val):
                return FelNull
            if isinstance(seg, ast.DotSegment):
                if isinstance(val, FelObject):
                    val = val.fields.get(seg.name, FelNull)
                else:
                    return FelNull
            elif isinstance(seg, ast.IndexSegment):
                if isinstance(val, FelArray):
                    idx = seg.index - 1
                    if 0 <= idx < len(val):
                        val = val.elements[idx]
                    else:
                        self._diag(f"Index {seg.index} out of bounds", node.pos)
                        return FelNull
                else:
                    return FelNull
            elif isinstance(seg, ast.WildcardSegment):
                if isinstance(val, FelArray):
                    # Wildcard on a FelArray: collect remaining-path from each element
                    remaining = node.segments[node.segments.index(seg) + 1:]
                    if not remaining:
                        continue  # No further segments, val is already the array
                    results = []
                    for elem in val.elements:
                        cur = elem
                        for rseg in remaining:
                            if is_null(cur):
                                break
                            if isinstance(rseg, ast.DotSegment) and isinstance(cur, FelObject):
                                cur = cur.fields.get(rseg.name, FelNull)
                            else:
                                cur = FelNull
                                break
                        results.append(cur)
                    return FelArray(tuple(results))
                else:
                    return FelNull
        return val

    # -- Function calls ----------------------------------------------------

    def _eval_function_call(self, node: ast.FunctionCall) -> FelValue:
        name = node.name
        if name not in self._functions:
            self._diag(f"Undefined function: {name}", node.pos)
            return FelNull
        func_def = self._functions[name]

        # Arity check
        nargs = len(node.args)
        if nargs < func_def.min_args:
            self._diag(f"{name}() requires at least {func_def.min_args} args, got {nargs}", node.pos)
            return FelNull
        if func_def.max_args is not None and nargs > func_def.max_args:
            self._diag(f"{name}() takes at most {func_def.max_args} args, got {nargs}", node.pos)
            return FelNull

        # Special-form functions: receive AST nodes + evaluator
        if func_def.special_form:
            return func_def.impl(self, node.args, node.pos)

        # Normal functions: evaluate arguments
        args = [self.evaluate(a) for a in node.args]

        # Auto null-propagation
        if func_def.propagate_null:
            for a in args:
                if is_null(a):
                    return FelNull

        try:
            return func_def.impl(*args)
        except Exception as e:
            self._diag(f"Error in {name}(): {e}", node.pos)
            return FelNull

    # -- Diagnostics -------------------------------------------------------

    def _diag(self, message: str, pos: SourcePos | None) -> None:
        self.diagnostics.append(Diagnostic(message, pos))
