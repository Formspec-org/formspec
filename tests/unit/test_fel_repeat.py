"""Stage 1A: Repeat Context Tests.

Verify that FEL repeat context features — prev(), next(), parent(),
@current, @index, @count — evaluate correctly.

Because the public evaluate() API doesn't expose repeat_context,
these tests construct Evaluator + Environment directly.
"""

import pytest
from decimal import Decimal

from formspec.fel.parser import parse
from formspec.fel.evaluator import Evaluator
from formspec.fel.environment import Environment, RepeatContext
from formspec.fel.functions import build_default_registry
from formspec.fel.types import (
    FelNull, FelNumber, FelString, FelObject, FelArray,
    FelTrue, FelFalse, FelValue, fel_bool, from_python, is_null,
    fel_decimal,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _eval_in_repeat(expr_str: str, rc: RepeatContext, data=None) -> FelValue:
    """Evaluate an expression string inside a repeat context."""
    ast = parse(expr_str)
    env = Environment(data=data)
    env.repeat_context = rc
    ev = Evaluator(env, build_default_registry())
    return ev.evaluate(ast)


def _eval_no_repeat(expr_str: str, data=None) -> FelValue:
    """Evaluate an expression string with no repeat context."""
    ast = parse(expr_str)
    env = Environment(data=data)
    ev = Evaluator(env, build_default_registry())
    return ev.evaluate(ast)


def _make_rows(*dicts):
    """Create a list of plain dicts suitable for RepeatContext.collection."""
    return list(dicts)


def _make_rc(rows, index, parent=None):
    """Build a RepeatContext for *rows* at 1-based *index*."""
    current = from_python(rows[index - 1])
    return RepeatContext(
        current=current,
        index=index,
        count=len(rows),
        parent=parent if parent is not None else FelNull,
        collection=rows,
    )


# ---------------------------------------------------------------------------
# @current, @index, @count
# ---------------------------------------------------------------------------

class TestRepeatContextVariables:

    def test_current_amount_resolves(self):
        rows = _make_rows({"amount": 100, "name": "row1"}, {"amount": 200, "name": "row2"})
        rc = _make_rc(rows, index=1)
        result = _eval_in_repeat("@current.amount", rc)
        assert isinstance(result, FelNumber)
        assert result.value == fel_decimal(100)

    def test_index_returns_one_based_first(self):
        rows = _make_rows({"a": 1}, {"a": 2}, {"a": 3})
        rc = _make_rc(rows, index=1)
        assert _eval_in_repeat("@index", rc).value == fel_decimal(1)

    def test_index_returns_one_based_third(self):
        rows = _make_rows({"a": 1}, {"a": 2}, {"a": 3})
        rc = _make_rc(rows, index=3)
        assert _eval_in_repeat("@index", rc).value == fel_decimal(3)

    def test_count_returns_total(self):
        rows = _make_rows({"x": 1}, {"x": 2}, {"x": 3}, {"x": 4}, {"x": 5})
        rc = _make_rc(rows, index=2)
        assert _eval_in_repeat("@count", rc).value == fel_decimal(5)


# ---------------------------------------------------------------------------
# prev() and next()
# ---------------------------------------------------------------------------

class TestRepeatNavigation:

    def test_prev_at_index_2_returns_row1_amount(self):
        rows = _make_rows({"amount": 10}, {"amount": 20}, {"amount": 30})
        rc = _make_rc(rows, index=2)
        result = _eval_in_repeat("prev().amount", rc)
        assert result.value == fel_decimal(10)

    def test_prev_at_index_1_returns_null(self):
        rows = _make_rows({"amount": 10}, {"amount": 20})
        rc = _make_rc(rows, index=1)
        assert is_null(_eval_in_repeat("prev()", rc))

    def test_prev_field_at_index_1_returns_null(self):
        rows = _make_rows({"amount": 10}, {"amount": 20})
        rc = _make_rc(rows, index=1)
        assert is_null(_eval_in_repeat("prev().amount", rc))

    def test_next_at_index_1_returns_row2_amount(self):
        rows = _make_rows({"amount": 10}, {"amount": 20}, {"amount": 30})
        rc = _make_rc(rows, index=1)
        result = _eval_in_repeat("next().amount", rc)
        assert result.value == fel_decimal(20)

    def test_next_at_last_row_returns_null(self):
        rows = _make_rows({"amount": 10}, {"amount": 20}, {"amount": 30})
        rc = _make_rc(rows, index=3)
        assert is_null(_eval_in_repeat("next()", rc))


# ---------------------------------------------------------------------------
# parent()
# ---------------------------------------------------------------------------

class TestRepeatParent:

    def test_parent_total_returns_parent_field(self):
        parent_obj = from_python({"total": 999, "label": "invoice"})
        rows = _make_rows({"amount": 10}, {"amount": 20})
        rc = _make_rc(rows, index=1, parent=parent_obj)
        result = _eval_in_repeat("parent().total", rc)
        assert result.value == fel_decimal(999)


# ---------------------------------------------------------------------------
# Complex repeat expressions
# ---------------------------------------------------------------------------

class TestRepeatComplex:

    def test_cumulative_sum_via_prev(self):
        rows = _make_rows(
            {"amount": 100, "cumulative": 100},
            {"amount": 200, "cumulative": 300},
            {"amount": 50, "cumulative": 350},
        )
        rc = _make_rc(rows, index=3)
        result = _eval_in_repeat("prev().cumulative + @current.amount", rc)
        assert result.value == fel_decimal(350)

    def test_let_binding_with_current(self):
        rows = _make_rows({"amount": 75}, {"amount": 150})
        rc = _make_rc(rows, index=2)
        result = _eval_in_repeat("let x = @current.amount in x * 2", rc)
        assert result.value == fel_decimal(300)

    def test_countWhere_dollar_not_shadowed_by_current(self):
        """countWhere's $ refers to each array element, not @current."""
        rows = _make_rows({"amount": 999}, {"amount": 888})
        rc = _make_rc(rows, index=1)
        result = _eval_in_repeat("countWhere([10, 20, 30], $ > 15)", rc)
        assert result.value == fel_decimal(2)


# ---------------------------------------------------------------------------
# Outside repeat context
# ---------------------------------------------------------------------------

class TestOutsideRepeatContext:

    def test_current_outside_repeat_returns_null(self):
        assert is_null(_eval_no_repeat("@current"))

    def test_index_outside_repeat_returns_null(self):
        assert is_null(_eval_no_repeat("@index"))

    def test_count_outside_repeat_returns_null(self):
        assert is_null(_eval_no_repeat("@count"))
