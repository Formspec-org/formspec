"""Tests for the FEL evaluator — operators, types, null handling."""

import pytest
from decimal import Decimal
from datetime import date

import fel
from fel import (
    evaluate, FelNull, FelNumber, FelString, FelBoolean, FelDate,
    FelArray, FelTrue, FelFalse, is_null,
)


def val(expr, data=None):
    """Evaluate and return the raw FelValue."""
    return evaluate(expr, data).value


def pyval(expr, data=None):
    """Evaluate and return Python-native value."""
    v = val(expr, data)
    if isinstance(v, FelNumber): return v.value
    if isinstance(v, FelString): return v.value
    if isinstance(v, FelBoolean): return v.value
    if isinstance(v, FelDate): return v.value
    if is_null(v): return None
    if isinstance(v, FelArray): return [pyval_inner(e) for e in v.elements]
    return v


def pyval_inner(v):
    if isinstance(v, FelNumber): return v.value
    if isinstance(v, FelString): return v.value
    if isinstance(v, FelBoolean): return v.value
    if is_null(v): return None
    return v


def diags(expr, data=None):
    """Evaluate and return diagnostic count."""
    return len(evaluate(expr, data).diagnostics)


class TestArithmetic:
    def test_add(self):
        assert pyval('1 + 2') == Decimal('3')

    def test_subtract(self):
        assert pyval('10 - 3') == Decimal('7')

    def test_multiply(self):
        assert pyval('4 * 5') == Decimal('20')

    def test_divide(self):
        assert pyval('10 / 4') == Decimal('2.5')

    def test_modulo(self):
        assert pyval('10 % 3') == Decimal('1')

    def test_decimal_precision(self):
        """0.1 + 0.2 must equal 0.3 (decimal, not float)."""
        assert pyval('0.1 + 0.2') == Decimal('0.3')

    def test_unary_minus(self):
        assert pyval('-5') == Decimal('-5')

    def test_unary_minus_field(self):
        assert pyval('-$x', {'x': 10}) == Decimal('-10')

    def test_division_by_zero(self):
        assert is_null(val('1 / 0'))
        assert diags('1 / 0') == 1

    def test_modulo_by_zero(self):
        assert is_null(val('1 % 0'))
        assert diags('1 % 0') == 1

    def test_modulo_sign_of_dividend(self):
        """Modulo follows sign of dividend, not divisor."""
        assert pyval('7 % 3') == Decimal('1')
        # -7 % 3 needs parenthesization: -(7) % 3 or (-7) not unary minus eating it
        # Actually unary minus binds tighter than %, so -7 % 3 = (-7) % 3
        assert pyval('(0 - 7) % 3') == Decimal('-1')

    def test_type_error_arithmetic(self):
        assert is_null(val("'hello' + 5"))
        assert diags("'hello' + 5") == 1


class TestComparison:
    def test_less_than(self):
        assert pyval('1 < 2') is True

    def test_greater_than(self):
        assert pyval('2 > 1') is True

    def test_less_equal(self):
        assert pyval('2 <= 2') is True

    def test_greater_equal(self):
        assert pyval('3 >= 2') is True

    def test_string_comparison(self):
        assert pyval("'abc' < 'abd'") is True

    def test_date_comparison(self):
        assert pyval('@2025-01-01 < @2025-12-31') is True

    def test_cross_type_error(self):
        assert is_null(val("1 < 'hello'"))
        assert diags("1 < 'hello'") == 1


class TestEquality:
    def test_number_equal(self):
        assert pyval('5 = 5') is True

    def test_number_not_equal(self):
        assert pyval('5 != 3') is True

    def test_string_equal(self):
        assert pyval("'abc' = 'abc'") is True

    def test_null_equals_null(self):
        """null = null → true (special case, not propagation)."""
        assert pyval('null = null') is True

    def test_null_not_equals_value(self):
        assert pyval('null = 5') is False
        assert pyval('5 = null') is False

    def test_null_not_equal(self):
        assert pyval('null != null') is False
        assert pyval('null != 5') is True

    def test_cross_type_equality_error(self):
        assert is_null(val("1 = 'hello'"))


class TestLogical:
    def test_and_true(self):
        assert pyval('true and true') is True

    def test_and_short_circuit(self):
        """false and X → false without evaluating X."""
        assert pyval('false and true') is False

    def test_or_short_circuit(self):
        assert pyval('true or false') is True

    def test_not(self):
        assert pyval('not true') is False
        assert pyval('not false') is True

    def test_and_type_error(self):
        assert is_null(val('1 and true'))

    def test_or_type_error(self):
        assert is_null(val("'x' or false"))


class TestNullPropagation:
    """Tests for §3.8 null propagation rules."""

    def test_arithmetic_null(self):
        assert is_null(val('null + 5'))
        assert is_null(val('10 * null'))

    def test_concat_null(self):
        assert is_null(val("'hello' & null"))

    def test_comparison_null(self):
        assert is_null(val('null < 5'))
        assert is_null(val('5 > null'))

    def test_not_null(self):
        assert is_null(val('not null'))

    def test_and_null_left(self):
        """null and X → null (null propagation from left)."""
        assert is_null(val('null and true'))

    def test_and_false_short_circuits_over_null(self):
        """false and null → false (short-circuit wins)."""
        assert pyval('false and null') is False

    def test_or_null_left(self):
        assert is_null(val('null or false'))

    def test_or_true_short_circuits_over_null(self):
        assert pyval('true or null') is True

    def test_null_coalesce(self):
        assert pyval('null ?? 42') == Decimal('42')
        assert pyval('5 ?? 42') == Decimal('5')


class TestStringConcat:
    def test_basic(self):
        assert pyval("'a' & 'b'") == 'ab'

    def test_with_fields(self):
        assert pyval("$f & ' ' & $l", {'f': 'A', 'l': 'B'}) == 'A B'

    def test_type_error(self):
        assert is_null(val("'x' & 5"))


class TestMembership:
    def test_in(self):
        assert pyval("'a' in ['a', 'b', 'c']") is True

    def test_not_in(self):
        assert pyval("'x' not in ['a', 'b']") is True

    def test_in_false(self):
        assert pyval("5 in [1, 2, 3]") is False

    def test_in_null(self):
        assert is_null(val('null in [1, 2]'))


class TestTernary:
    def test_true_branch(self):
        assert pyval("true ? 'yes' : 'no'") == 'yes'

    def test_false_branch(self):
        assert pyval("false ? 'yes' : 'no'") == 'no'

    def test_null_condition(self):
        assert is_null(val("null ? 1 : 2"))


class TestIfThenElse:
    def test_keyword_form(self):
        assert pyval("if true then 'yes' else 'no'") == 'yes'

    def test_function_form(self):
        assert pyval("if(true, 'yes', 'no')") == 'yes'

    def test_if_function_null_condition_error(self):
        """if() with null condition signals error (§3.8.1)."""
        r = evaluate('if(null, 1, 2)')
        assert is_null(r.value)
        assert len(r.diagnostics) >= 1


class TestLetBinding:
    def test_basic(self):
        assert pyval('let x = 5 in x + 1') == Decimal('6')

    def test_nested(self):
        assert pyval('let x = 1 in let y = 2 in x + y') == Decimal('3')

    def test_shadowing(self):
        assert pyval('let x = 1 in let x = 2 in x') == Decimal('2')


class TestFieldRefs:
    def test_simple(self):
        assert pyval('$name', {'name': 'Ada'}) == 'Ada'

    def test_nested(self):
        assert pyval('$address.city', {'address': {'city': 'London'}}) == 'London'

    def test_missing_field(self):
        assert is_null(val('$missing', {}))

    def test_bare_dollar_resolves_to_data(self):
        """Bare $ outside repeat context resolves to the entire data object."""
        r = val('$', {'x': 1})
        # Returns a FelObject wrapping the data
        from fel import FelObject
        assert isinstance(r, FelObject)

    def test_wildcard(self):
        data = {'items': [{'amount': 10}, {'amount': 20}]}
        result = val('$items[*].amount', data)
        assert isinstance(result, FelArray)
        assert len(result) == 2

    def test_index_access(self):
        data = {'items': [{'name': 'a'}, {'name': 'b'}]}
        assert pyval('$items[1].name', data) == 'a'

    def test_index_out_of_bounds(self):
        data = {'items': [{'name': 'a'}]}
        assert is_null(val('$items[5].name', data))


class TestElementWiseArrays:
    """Tests for §3.9 element-wise operations."""

    def test_equal_length(self):
        data = {'items': [
            {'qty': 2, 'price': 10},
            {'qty': 5, 'price': 3},
        ]}
        r = val('$items[*].qty * $items[*].price', data)
        assert isinstance(r, FelArray)
        assert r.elements[0].value == Decimal('20')
        assert r.elements[1].value == Decimal('15')

    def test_sum_of_elementwise(self):
        data = {'items': [
            {'qty': 2, 'price': 10},
            {'qty': 5, 'price': 3.5},
            {'qty': 1, 'price': 25},
        ]}
        r = pyval('sum($items[*].qty * $items[*].price)', data)
        assert r == Decimal('62.5')

    def test_mismatched_length(self):
        data = {'a': [1, 2], 'b': [1, 2, 3]}
        assert is_null(val('$a * $b', data))  # Can't do element-wise on raw arrays via field ref


class TestCountWhere:
    def test_basic(self):
        """countWhere rebinds $ to each element."""
        assert pyval('countWhere([1, 2, 3, 4, 5], $ > 3)') == Decimal('2')

    def test_all_match(self):
        assert pyval('countWhere([10, 20, 30], $ > 0)') == Decimal('3')

    def test_none_match(self):
        assert pyval('countWhere([1, 2, 3], $ > 100)') == Decimal('0')

    def test_empty_array(self):
        assert pyval('countWhere([], $ > 0)') == Decimal('0')

    def test_with_field_data(self):
        data = {'items': [{'amount': 10}, {'amount': 5000}, {'amount': 20000}]}
        assert pyval('countWhere($items[*].amount, $ > 10000)', data) == Decimal('1')


class TestReviewBugFixes:
    def test_avg_empty_diagnostic(self):
        """avg([]) must signal an error (division by zero)."""
        r = evaluate('avg([])')
        assert is_null(r.value)
        assert len(r.diagnostics) >= 1

    def test_string_of_100(self):
        """string(100) should be '100', not '1E+2'."""
        assert pyval('string(100)') == '100'

    def test_string_of_large_number(self):
        assert pyval('string(1000000)') == '1000000'

    def test_from_python_bad_money(self):
        """Dicts with amount/currency but bad amount should be objects."""
        from fel.types import from_python, FelObject
        r = from_python({'amount': 'not-a-number', 'currency': 'USD'})
        assert isinstance(r, FelObject)
