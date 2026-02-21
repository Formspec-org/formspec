"""Tests for FEL built-in functions."""

import pytest
from decimal import Decimal
from datetime import date

from fel import evaluate, FelNull, FelNumber, FelString, FelArray, is_null


def val(expr, data=None):
    return evaluate(expr, data).value


def pv(expr, data=None):
    v = val(expr, data)
    if isinstance(v, FelNumber): return v.value
    if isinstance(v, FelString): return v.value
    from fel import FelBoolean, FelDate
    if isinstance(v, FelBoolean): return v.value
    if isinstance(v, FelDate): return v.value
    if is_null(v): return None
    return v


class TestAggregates:
    def test_sum_basic(self):
        assert pv('sum([1, 2, 3])') == Decimal('6')

    def test_sum_empty(self):
        assert pv('sum([])') == Decimal('0')

    def test_sum_nulls_skipped(self):
        assert pv('sum([1, null, 3])') == Decimal('4')

    def test_count_basic(self):
        assert pv('count([1, 2, 3])') == Decimal('3')

    def test_count_empty(self):
        assert pv('count([])') == Decimal('0')

    def test_count_skips_nulls(self):
        assert pv('count([1, null, 3])') == Decimal('2')

    def test_avg_basic(self):
        assert pv('avg([10, 20])') == Decimal('15')

    def test_avg_empty_is_null(self):
        """avg([]) signals error → null."""
        assert is_null(val('avg([])'))

    def test_avg_skips_nulls(self):
        assert pv('avg([null, 10, null, 20])') == Decimal('15')

    def test_min_basic(self):
        assert pv('min([3, 1, 2])') == Decimal('1')

    def test_min_empty_is_null(self):
        assert is_null(val('min([])'))

    def test_max_basic(self):
        assert pv('max([3, 1, 2])') == Decimal('3')

    def test_max_empty_is_null(self):
        assert is_null(val('max([])'))


class TestStringFunctions:
    def test_length(self):
        assert pv("length('hello')") == Decimal('5')

    def test_length_null(self):
        assert pv('length(null)') == Decimal('0')

    def test_contains(self):
        assert pv("contains('hello world', 'world')") is True

    def test_startsWith(self):
        assert pv("startsWith('hello', 'hel')") is True

    def test_endsWith(self):
        assert pv("endsWith('hello', 'llo')") is True

    def test_substring(self):
        assert pv("substring('hello', 2, 3)") == 'ell'

    def test_substring_no_length(self):
        assert pv("substring('hello', 2)") == 'ello'

    def test_replace(self):
        assert pv("replace('aXbXc', 'X', '-')") == 'a-b-c'

    def test_upper(self):
        assert pv("upper('hello')") == 'HELLO'

    def test_lower(self):
        assert pv("lower('HELLO')") == 'hello'

    def test_trim(self):
        assert pv("trim('  hi  ')") == 'hi'

    def test_matches(self):
        assert pv("matches('abc123', '[0-9]+')") is True

    def test_matches_no_match(self):
        assert pv("matches('abc', '^[0-9]+$')") is False

    def test_format(self):
        assert pv("format('{0} of {1}', 3, 10)") == '3 of 10'


class TestNumericFunctions:
    def test_round_default(self):
        assert pv('round(3.7)') == Decimal('4')

    def test_round_precision(self):
        assert pv('round(3.456, 2)') == Decimal('3.46')

    def test_round_bankers_even(self):
        """Banker's rounding: half rounds to even."""
        assert pv('round(2.5)') == Decimal('2')
        assert pv('round(3.5)') == Decimal('4')

    def test_floor(self):
        assert pv('floor(3.7)') == Decimal('3')

    def test_ceil(self):
        assert pv('ceil(3.2)') == Decimal('4')

    def test_abs(self):
        assert pv('abs(0 - 5)') == Decimal('5')

    def test_power(self):
        assert pv('power(2, 10)') == Decimal('1024')


class TestDateFunctions:
    def test_year(self):
        assert pv('year(@2025-07-10)') == Decimal('2025')

    def test_month(self):
        assert pv('month(@2025-07-10)') == Decimal('7')

    def test_day(self):
        assert pv('day(@2025-07-10)') == Decimal('10')

    def test_dateDiff_days(self):
        assert pv("dateDiff(@2025-01-10, @2025-01-01, 'days')") == Decimal('9')

    def test_dateDiff_years(self):
        assert pv("dateDiff(@2025-07-10, @2000-07-10, 'years')") == Decimal('25')

    def test_dateAdd_days(self):
        assert pv("dateAdd(@2025-01-01, 10, 'days')") == date(2025, 1, 11)

    def test_dateAdd_months_overflow(self):
        """Jan 31 + 1 month = Feb 28."""
        assert pv("dateAdd(@2025-01-31, 1, 'months')") == date(2025, 2, 28)

    def test_hours(self):
        assert pv("hours('14:30:00')") == Decimal('14')

    def test_minutes(self):
        assert pv("minutes('14:30:00')") == Decimal('30')

    def test_seconds(self):
        assert pv("seconds('14:30:00')") == Decimal('0')

    def test_time_construct(self):
        assert pv('time(14, 30, 0)') == '14:30:00'

    def test_timeDiff(self):
        assert pv("timeDiff('14:30:00', '13:00:00')") == Decimal('5400')


class TestLogicalFunctions:
    def test_if_true(self):
        assert pv("if(true, 'yes', 'no')") == 'yes'

    def test_if_false(self):
        assert pv("if(false, 'yes', 'no')") == 'no'

    def test_if_null_condition_error(self):
        r = evaluate('if(null, 1, 2)')
        assert is_null(r.value)
        assert len(r.diagnostics) >= 1

    def test_coalesce(self):
        assert pv('coalesce(null, null, 42)') == Decimal('42')

    def test_coalesce_all_null(self):
        assert is_null(val('coalesce(null, null)'))

    def test_empty_null(self):
        assert pv('empty(null)') is True

    def test_empty_string(self):
        assert pv("empty('')") is True

    def test_empty_array(self):
        assert pv('empty([])') is True

    def test_empty_non_empty(self):
        assert pv("empty('hi')") is False

    def test_present(self):
        assert pv("present('hi')") is True
        assert pv('present(null)') is False


class TestTypeFunctions:
    def test_isNumber(self):
        assert pv('isNumber(42)') is True
        assert pv("isNumber('x')") is False

    def test_isString(self):
        assert pv("isString('hello')") is True

    def test_isNull(self):
        assert pv('isNull(null)') is True
        assert pv('isNull(0)') is False

    def test_typeOf(self):
        assert pv('typeOf(42)') == 'number'
        assert pv("typeOf('x')") == 'string'
        assert pv('typeOf(true)') == 'boolean'
        assert pv('typeOf(null)') == 'null'


class TestCastFunctions:
    def test_number_from_string(self):
        assert pv("number('42')") == Decimal('42')

    def test_number_from_bool(self):
        assert pv('number(true)') == Decimal('1')
        assert pv('number(false)') == Decimal('0')

    def test_number_from_null(self):
        assert is_null(val('number(null)'))

    def test_string_from_number(self):
        assert pv('string(42)') == '42'

    def test_string_from_bool(self):
        assert pv('string(true)') == 'true'

    def test_string_from_null(self):
        """string(null) → '' (not null)."""
        assert pv('string(null)') == ''

    def test_boolean_from_string(self):
        assert pv("boolean('true')") is True
        assert pv("boolean('false')") is False

    def test_boolean_from_number(self):
        assert pv('boolean(0)') is False
        assert pv('boolean(1)') is True

    def test_boolean_from_null(self):
        assert pv('boolean(null)') is False

    def test_date_from_string(self):
        assert pv("date('2025-07-10')") == date(2025, 7, 10)

    def test_date_from_null(self):
        assert is_null(val('date(null)'))


class TestMoneyFunctions:
    def test_money_construct(self):
        from fel import FelMoney
        r = val("money(100, 'USD')")
        assert isinstance(r, FelMoney)
        assert r.amount == Decimal('100') and r.currency == 'USD'

    def test_moneyAmount(self):
        assert pv("moneyAmount(money(50, 'USD'))") == Decimal('50')

    def test_moneyCurrency(self):
        assert pv("moneyCurrency(money(50, 'USD'))") == 'USD'

    def test_moneyAdd(self):
        from fel import FelMoney
        r = val("moneyAdd(money(10, 'USD'), money(20, 'USD'))")
        assert isinstance(r, FelMoney)
        assert r.amount == Decimal('30')

    def test_moneyAdd_currency_mismatch(self):
        assert is_null(val("moneyAdd(money(10, 'USD'), money(20, 'EUR'))"))


# ===================================================================
# Stage 2A: Function coverage gaps
# ===================================================================


class TestSelectedFunction:

    def test_string_found(self):
        assert pv("selected(['a', 'b', 'c'], 'b')") is True

    def test_string_not_found(self):
        assert pv("selected(['a', 'b', 'c'], 'x')") is False

    def test_null_array(self):
        assert is_null(val('selected(null, "x")'))

    def test_number_found(self):
        assert pv('selected([1, 2, 3], 2)') is True

    def test_empty_array(self):
        assert pv('selected([], "a")') is False


class TestMoneySum:

    def test_basic_sum(self):
        from fel import FelMoney
        r = val("moneySum([money(10, 'USD'), money(20, 'USD')])")
        assert isinstance(r, FelMoney)
        assert r.amount == Decimal('30') and r.currency == 'USD'

    def test_empty_array_is_null(self):
        assert is_null(val('moneySum([])'))

    def test_currency_mismatch_returns_null(self):
        assert is_null(val("moneySum([money(10, 'USD'), money(20, 'EUR')])"))


class TestFormatFunction:

    def test_two_placeholders(self):
        assert pv("format('{0} and {1}', 'hello', 'world')") == 'hello and world'

    def test_number_arg(self):
        assert pv("format('value: {0}', 42)") == 'value: 42'


class TestDateDiffExtra:

    def test_months(self):
        assert pv("dateDiff(@2024-06-15, @2024-01-15, 'months')") == Decimal('5')

    def test_negative_days(self):
        assert pv("dateDiff(@2024-01-01, @2024-06-01, 'days')") == Decimal('-152')


class TestDateAddExtra:

    def test_add_years(self):
        assert pv("dateAdd(@2020-03-01, 4, 'years')") == date(2024, 3, 1)

    def test_leap_year_feb29_plus_one_year(self):
        """Feb 29 + 1 year clamps to Feb 28."""
        assert pv("dateAdd(@2024-02-29, 1, 'years')") == date(2025, 2, 28)


class TestStringEdgeCases:

    def test_matches_anchored_no_match(self):
        assert pv("matches('abc123', '^[a-z]+$')") is False

    def test_matches_anchored_match(self):
        assert pv("matches('abc', '^[a-z]+$')") is True

    def test_substring_zero_length(self):
        assert pv("substring('hello', 1, 0)") == ''

    def test_replace_no_match(self):
        assert pv("replace('hello', 'xyz', 'abc')") == 'hello'

    def test_trim_tabs(self):
        assert pv("trim('\thello\t')") == 'hello'


class TestNumericEdgeCases:

    def test_power_zero_exponent(self):
        assert pv('power(5, 0)') == Decimal('1')

    def test_power_negative_exponent(self):
        assert pv('power(2, -1)') == Decimal('0.5')

    def test_floor_negative(self):
        assert pv('floor(-3.2)') == Decimal('-4')

    def test_ceil_negative(self):
        assert pv('ceil(-3.2)') == Decimal('-3')


class TestCastEdgeCases:

    def test_number_invalid_string(self):
        assert is_null(val("number('abc')"))

    def test_date_invalid_string(self):
        assert is_null(val("date('not-a-date')"))

    def test_boolean_from_true_string(self):
        assert pv("boolean('true')") is True

    def test_boolean_from_false_string(self):
        assert pv("boolean('false')") is False

    def test_boolean_from_empty_string(self):
        assert is_null(val("boolean('')"))


class TestNumberToStrRegression:

    def test_small_decimal(self):
        assert pv('string(0.001)') == '0.001'

    def test_large_number(self):
        assert pv('string(10000000)') == '10000000'


class TestNowFunction:

    def test_now_returns_date_type(self):
        from fel import FelDate
        r = val('now()')
        assert isinstance(r, FelDate)


class TestIsDateFunction:

    def test_positive(self):
        assert pv('isDate(@2024-01-01)') is True

    def test_negative(self):
        assert pv('isDate(42)') is False
