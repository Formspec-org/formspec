"""FEL built-in function registry and implementations.

All 50+ functions from spec.md §3.5, with correct null handling per §3.8.2.
"""

from __future__ import annotations

import decimal
import math
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Callable

from . import ast_nodes as ast
from .errors import Diagnostic, SourcePos
from .types import (
    FelArray, FelBoolean, FelDate, FelMoney, FelNull, FelNumber,
    FelObject, FelString, FelTrue, FelFalse, FelValue,
    _FelNullType, fel_bool, fel_decimal, from_python, is_null, typeof,
)


@dataclass
class FuncDef:
    name: str
    impl: Callable
    min_args: int
    max_args: int | None  # None = variadic
    propagate_null: bool = True  # Auto null-propagate before calling
    special_form: bool = False  # Receives AST nodes, not evaluated values


def _ctx():
    return decimal.Context(prec=34, rounding=decimal.ROUND_HALF_EVEN)


# =========================================================================
# Aggregate functions (§3.5.1)
# =========================================================================

def _fn_sum(arr: FelValue) -> FelValue:
    if not isinstance(arr, FelArray):
        return FelNull
    total = Decimal(0)
    ctx = _ctx()
    for e in arr.elements:
        if is_null(e):
            continue
        if not isinstance(e, FelNumber):
            return FelNull
        total = ctx.add(total, e.value)
    return FelNumber(total)


def _fn_count(arr: FelValue) -> FelValue:
    if not isinstance(arr, FelArray):
        return FelNull
    return FelNumber(fel_decimal(sum(1 for e in arr.elements if not is_null(e))))


def _fn_avg(arr: FelValue) -> FelValue:
    if not isinstance(arr, FelArray):
        return FelNull
    non_null = [e for e in arr.elements if not is_null(e)]
    if not non_null:
        # avg([]) is a division-by-zero error per spec.
        # We can't record a diagnostic from a non-special-form function,
        # so we raise and let the evaluator catch it.
        raise ValueError("avg() of empty array (division by zero)")
    total = Decimal(0)
    ctx = _ctx()
    for e in non_null:
        if not isinstance(e, FelNumber):
            return FelNull
        total = ctx.add(total, e.value)
    return FelNumber(ctx.divide(total, Decimal(len(non_null))))


def _fn_min(arr: FelValue) -> FelValue:
    if not isinstance(arr, FelArray):
        return FelNull
    non_null = [e for e in arr.elements if not is_null(e)]
    if not non_null:
        return FelNull
    # Works for numbers, strings, dates
    result = non_null[0]
    for e in non_null[1:]:
        if type(e) != type(result):
            return FelNull
        if isinstance(e, FelNumber) and e.value < result.value:
            result = e
        elif isinstance(e, FelString) and e.value < result.value:
            result = e
        elif isinstance(e, FelDate) and e.value < result.value:
            result = e
    return result


def _fn_max(arr: FelValue) -> FelValue:
    if not isinstance(arr, FelArray):
        return FelNull
    non_null = [e for e in arr.elements if not is_null(e)]
    if not non_null:
        return FelNull
    result = non_null[0]
    for e in non_null[1:]:
        if type(e) != type(result):
            return FelNull
        if isinstance(e, FelNumber) and e.value > result.value:
            result = e
        elif isinstance(e, FelString) and e.value > result.value:
            result = e
        elif isinstance(e, FelDate) and e.value > result.value:
            result = e
    return result


def _fn_countWhere(evaluator, args, pos) -> FelValue:
    """Special form: countWhere(array, predicate).
    Second arg is evaluated per-element with $ rebound."""
    if len(args) != 2:
        evaluator._diag("countWhere() requires exactly 2 arguments", pos)
        return FelNull
    arr = evaluator.evaluate(args[0])
    if not isinstance(arr, FelArray):
        evaluator._diag("countWhere() first arg must be array", pos)
        return FelNull
    count = 0
    pred_ast = args[1]
    for elem in arr.elements:
        evaluator.env.push_scope({'': elem})  # bare $ resolves to elem
        try:
            result = evaluator.evaluate(pred_ast)
            if isinstance(result, FelBoolean) and result is FelTrue:
                count += 1
        finally:
            evaluator.env.pop_scope()
    return FelNumber(fel_decimal(count))


# =========================================================================
# String functions (§3.5.2)
# =========================================================================

def _fn_length(val: FelValue) -> FelValue:
    if is_null(val):
        return FelNumber(Decimal(0))
    if not isinstance(val, FelString):
        return FelNull
    return FelNumber(fel_decimal(len(val.value)))


def _fn_contains(s: FelValue, sub: FelValue) -> FelValue:
    if not isinstance(s, FelString) or not isinstance(sub, FelString):
        return FelNull
    return fel_bool(sub.value in s.value)


def _fn_startsWith(s: FelValue, prefix: FelValue) -> FelValue:
    if not isinstance(s, FelString) or not isinstance(prefix, FelString):
        return FelNull
    return fel_bool(s.value.startswith(prefix.value))


def _fn_endsWith(s: FelValue, suffix: FelValue) -> FelValue:
    if not isinstance(s, FelString) or not isinstance(suffix, FelString):
        return FelNull
    return fel_bool(s.value.endswith(suffix.value))


def _fn_substring(s: FelValue, start: FelValue, length: FelValue = None) -> FelValue:
    if not isinstance(s, FelString) or not isinstance(start, FelNumber):
        return FelNull
    idx = int(start.value) - 1  # 1-based to 0-based
    if length is None:
        return FelString(s.value[idx:])
    if not isinstance(length, FelNumber):
        return FelNull
    ln = int(length.value)
    return FelString(s.value[idx:idx + ln])


def _fn_replace(s: FelValue, old: FelValue, new: FelValue) -> FelValue:
    if not all(isinstance(x, FelString) for x in (s, old, new)):
        return FelNull
    return FelString(s.value.replace(old.value, new.value))


def _fn_upper(s: FelValue) -> FelValue:
    if not isinstance(s, FelString): return FelNull
    return FelString(s.value.upper())


def _fn_lower(s: FelValue) -> FelValue:
    if not isinstance(s, FelString): return FelNull
    return FelString(s.value.lower())


def _fn_trim(s: FelValue) -> FelValue:
    if not isinstance(s, FelString): return FelNull
    return FelString(s.value.strip())


def _fn_matches(s: FelValue, pattern: FelValue) -> FelValue:
    if not isinstance(s, FelString) or not isinstance(pattern, FelString):
        return FelNull
    try:
        return fel_bool(bool(re.search(pattern.value, s.value)))
    except re.error:
        return FelNull


def _fn_format(s: FelValue, *args: FelValue) -> FelValue:
    if not isinstance(s, FelString): return FelNull
    result = s.value
    for i, arg in enumerate(args):
        placeholder = '{' + str(i) + '}'
        if isinstance(arg, FelString):
            val = arg.value
        elif isinstance(arg, FelNumber):
            val = _number_to_str(arg.value)
        elif isinstance(arg, FelBoolean):
            val = 'true' if arg.value else 'false'
        elif isinstance(arg, FelDate):
            val = arg.value.isoformat() if isinstance(arg.value, date) else str(arg.value)
        elif is_null(arg):
            val = ''
        else:
            val = str(arg)
        result = result.replace(placeholder, val)
    return FelString(result)


# =========================================================================
# Numeric functions (§3.5.3)
# =========================================================================

def _fn_round(n: FelValue, precision: FelValue = None) -> FelValue:
    if not isinstance(n, FelNumber): return FelNull
    prec = 0
    if precision is not None:
        if not isinstance(precision, FelNumber): return FelNull
        prec = int(precision.value)
    if prec >= 0:
        quant = Decimal(10) ** -prec
    else:
        quant = Decimal(10) ** (-prec)
    return FelNumber(n.value.quantize(Decimal(10) ** -prec, rounding=decimal.ROUND_HALF_EVEN))


def _fn_floor(n: FelValue) -> FelValue:
    if not isinstance(n, FelNumber): return FelNull
    return FelNumber(n.value.to_integral_value(rounding=decimal.ROUND_FLOOR))


def _fn_ceil(n: FelValue) -> FelValue:
    if not isinstance(n, FelNumber): return FelNull
    return FelNumber(n.value.to_integral_value(rounding=decimal.ROUND_CEILING))


def _fn_abs(n: FelValue) -> FelValue:
    if not isinstance(n, FelNumber): return FelNull
    return FelNumber(abs(n.value))


def _fn_power(base: FelValue, exp: FelValue) -> FelValue:
    if not isinstance(base, FelNumber) or not isinstance(exp, FelNumber): return FelNull
    try:
        ctx = _ctx()
        return FelNumber(ctx.power(base.value, exp.value))
    except (decimal.InvalidOperation, decimal.Overflow):
        return FelNull


# =========================================================================
# Date functions (§3.5.4)
# =========================================================================

def _fn_today() -> FelValue:
    return FelDate(date.today())


def _fn_now() -> FelValue:
    return FelDate(datetime.now())


def _fn_year(d: FelValue) -> FelValue:
    if not isinstance(d, FelDate): return FelNull
    return FelNumber(fel_decimal(d.value.year))


def _fn_month(d: FelValue) -> FelValue:
    if not isinstance(d, FelDate): return FelNull
    return FelNumber(fel_decimal(d.value.month))


def _fn_day(d: FelValue) -> FelValue:
    if not isinstance(d, FelDate): return FelNull
    return FelNumber(fel_decimal(d.value.day))


def _fn_hours(t: FelValue) -> FelValue:
    if not isinstance(t, FelString): return FelNull
    try:
        parts = t.value.split(':')
        return FelNumber(fel_decimal(int(parts[0])))
    except (ValueError, IndexError):
        return FelNull


def _fn_minutes(t: FelValue) -> FelValue:
    if not isinstance(t, FelString): return FelNull
    try:
        parts = t.value.split(':')
        return FelNumber(fel_decimal(int(parts[1])))
    except (ValueError, IndexError):
        return FelNull


def _fn_seconds(t: FelValue) -> FelValue:
    if not isinstance(t, FelString): return FelNull
    try:
        parts = t.value.split(':')
        return FelNumber(fel_decimal(int(parts[2])))
    except (ValueError, IndexError):
        return FelNull


def _fn_time(h: FelValue, m: FelValue, s: FelValue) -> FelValue:
    if not all(isinstance(x, FelNumber) for x in (h, m, s)): return FelNull
    return FelString(f"{int(h.value):02d}:{int(m.value):02d}:{int(s.value):02d}")


def _fn_timeDiff(t1: FelValue, t2: FelValue) -> FelValue:
    if not isinstance(t1, FelString) or not isinstance(t2, FelString): return FelNull
    def _parse_time(s):
        parts = s.split(':')
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    try:
        return FelNumber(fel_decimal(_parse_time(t1.value) - _parse_time(t2.value)))
    except (ValueError, IndexError):
        return FelNull


def _fn_dateDiff(d1: FelValue, d2: FelValue, unit: FelValue) -> FelValue:
    if not isinstance(d1, FelDate) or not isinstance(d2, FelDate) or not isinstance(unit, FelString):
        return FelNull
    v1, v2 = d1.value, d2.value
    if isinstance(v1, datetime): v1 = v1.date()
    if isinstance(v2, datetime): v2 = v2.date()
    u = unit.value
    if u == 'days':
        return FelNumber(fel_decimal((v1 - v2).days))
    if u == 'months':
        months = (v1.year - v2.year) * 12 + (v1.month - v2.month)
        if v1.day < v2.day:
            months -= 1 if months > 0 else -1 if months < 0 else 0
        return FelNumber(fel_decimal(months))
    if u == 'years':
        years = v1.year - v2.year
        if (v1.month, v1.day) < (v2.month, v2.day):
            years -= 1 if years > 0 else -1 if years < 0 else 0
        return FelNumber(fel_decimal(years))
    return FelNull


def _fn_dateAdd(d: FelValue, n: FelValue, unit: FelValue) -> FelValue:
    if not isinstance(d, FelDate) or not isinstance(n, FelNumber) or not isinstance(unit, FelString):
        return FelNull
    v = d.value
    if isinstance(v, datetime): v = v.date()
    amt = int(n.value)
    u = unit.value
    if u == 'days':
        return FelDate(v + timedelta(days=amt))
    if u == 'months':
        month = v.month + amt
        year = v.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        import calendar
        max_day = calendar.monthrange(year, month)[1]
        day = min(v.day, max_day)
        return FelDate(date(year, month, day))
    if u == 'years':
        import calendar
        year = v.year + amt
        max_day = calendar.monthrange(year, v.month)[1]
        day = min(v.day, max_day)
        return FelDate(date(year, v.month, day))
    return FelNull


# =========================================================================
# Logical functions (§3.5.5)
# =========================================================================

def _fn_if_special(evaluator, args, pos) -> FelValue:
    """Special form: if(condition, then, else).
    Null condition → evaluation error → null + diagnostic."""
    if len(args) != 3:
        evaluator._diag("if() requires exactly 3 arguments", pos)
        return FelNull
    cond = evaluator.evaluate(args[0])
    if is_null(cond):
        evaluator._diag("if() condition is null", pos)
        return FelNull
    if not isinstance(cond, FelBoolean):
        evaluator._diag(f"if() condition must be boolean, got {typeof(cond)}", pos)
        return FelNull
    if cond is FelTrue:
        return evaluator.evaluate(args[1])
    return evaluator.evaluate(args[2])


def _fn_coalesce(*args: FelValue) -> FelValue:
    for a in args:
        if not is_null(a):
            return a
    return FelNull


def _fn_empty(val: FelValue) -> FelValue:
    if is_null(val):
        return FelTrue
    if isinstance(val, FelString) and val.value == '':
        return FelTrue
    if isinstance(val, FelArray) and len(val) == 0:
        return FelTrue
    return FelFalse


def _fn_present(val: FelValue) -> FelValue:
    r = _fn_empty(val)
    return FelFalse if r is FelTrue else FelTrue


def _fn_selected(arr: FelValue, val: FelValue) -> FelValue:
    if not isinstance(arr, FelArray):
        return FelNull
    for e in arr.elements:
        if isinstance(e, type(val)):
            if isinstance(e, FelString) and e.value == val.value:
                return FelTrue
            if isinstance(e, FelNumber) and e.value == val.value:
                return FelTrue
    return FelFalse


# =========================================================================
# Type-checking functions (§3.5.6)
# =========================================================================

def _fn_isNumber(val: FelValue) -> FelValue:
    return fel_bool(isinstance(val, FelNumber))


def _fn_isString(val: FelValue) -> FelValue:
    return fel_bool(isinstance(val, FelString))


def _fn_isDate(val: FelValue) -> FelValue:
    return fel_bool(isinstance(val, FelDate))


def _fn_isNull(val: FelValue) -> FelValue:
    return fel_bool(is_null(val))


def _fn_typeOf(val: FelValue) -> FelValue:
    return FelString(typeof(val))


# =========================================================================
# Cast functions (§3.4.3)
# =========================================================================

def _fn_cast_number(val: FelValue) -> FelValue:
    if is_null(val):
        return FelNull
    if isinstance(val, FelNumber):
        return val
    if isinstance(val, FelString):
        try:
            return FelNumber(Decimal(val.value))
        except decimal.InvalidOperation:
            return FelNull
    if isinstance(val, FelBoolean):
        return FelNumber(Decimal(1) if val.value else Decimal(0))
    return FelNull


def _number_to_str(d: Decimal) -> str:
    """Convert Decimal to string, no trailing zeros."""
    # Remove trailing zeros
    normalized = d.normalize()
    # Use fixed-point notation to avoid scientific notation like '1E+2'
    # Decimal.__format__ with 'f' gives fixed-point
    if normalized == 0:
        return '0'
    s = format(normalized, 'f')
    # Remove unnecessary trailing zeros after decimal point
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    return s


def _fn_cast_string(val: FelValue) -> FelValue:
    if is_null(val):
        return FelString('')
    if isinstance(val, FelString):
        return val
    if isinstance(val, FelNumber):
        return FelString(_number_to_str(val.value))
    if isinstance(val, FelBoolean):
        return FelString('true' if val.value else 'false')
    if isinstance(val, FelDate):
        v = val.value
        if isinstance(v, datetime):
            return FelString(v.date().isoformat())
        return FelString(v.isoformat())
    return FelNull


def _fn_cast_boolean(val: FelValue) -> FelValue:
    if is_null(val):
        return FelFalse
    if isinstance(val, FelBoolean):
        return val
    if isinstance(val, FelString):
        if val.value == 'true':
            return FelTrue
        if val.value == 'false':
            return FelFalse
        return FelNull  # Error: invalid string for boolean
    if isinstance(val, FelNumber):
        return FelFalse if val.value == 0 else FelTrue
    return FelNull


def _fn_cast_date(val: FelValue) -> FelValue:
    if is_null(val):
        return FelNull
    if isinstance(val, FelDate):
        return val
    if isinstance(val, FelString):
        try:
            return FelDate(date.fromisoformat(val.value))
        except ValueError:
            return FelNull
    return FelNull


# =========================================================================
# Money functions (§3.5.7)
# =========================================================================

def _fn_money(amount: FelValue, currency: FelValue) -> FelValue:
    if not isinstance(amount, FelNumber) or not isinstance(currency, FelString):
        return FelNull
    return FelMoney(amount.value, currency.value)


def _fn_moneyAmount(m: FelValue) -> FelValue:
    if not isinstance(m, FelMoney): return FelNull
    return FelNumber(m.amount)


def _fn_moneyCurrency(m: FelValue) -> FelValue:
    if not isinstance(m, FelMoney): return FelNull
    return FelString(m.currency)


def _fn_moneyAdd(a: FelValue, b: FelValue) -> FelValue:
    if not isinstance(a, FelMoney) or not isinstance(b, FelMoney):
        return FelNull
    if a.currency != b.currency:
        return FelNull
    return FelMoney(_ctx().add(a.amount, b.amount), a.currency)


def _fn_moneySum(arr: FelValue) -> FelValue:
    if not isinstance(arr, FelArray): return FelNull
    if len(arr) == 0: return FelNull
    non_null = [e for e in arr.elements if not is_null(e)]
    if not non_null: return FelNull
    if not all(isinstance(e, FelMoney) for e in non_null): return FelNull
    currency = non_null[0].currency
    if not all(e.currency == currency for e in non_null): return FelNull
    ctx = _ctx()
    total = Decimal(0)
    for e in non_null:
        total = ctx.add(total, e.amount)
    return FelMoney(total, currency)


# =========================================================================
# MIP-state functions (§3.5.8) — special forms
# =========================================================================

def _make_mip_fn(attr: str):
    def _mip_fn(evaluator, args, pos) -> FelValue:
        if len(args) != 1:
            evaluator._diag(f"{attr}() requires 1 argument", pos)
            return FelNull
        # Extract field path from AST
        arg = args[0]
        if isinstance(arg, ast.FieldRef):
            path = '.'.join(s.name for s in arg.segments if isinstance(s, ast.DotSegment))
            if path in evaluator.env.mip_states:
                return fel_bool(getattr(evaluator.env.mip_states[path], attr))
            return FelTrue if attr == 'valid' else FelFalse
        evaluator._diag(f"{attr}() requires a field reference argument", pos)
        return FelNull
    return _mip_fn


# =========================================================================
# Repeat navigation functions (§3.5.9) — return FelObject
# =========================================================================

def _fn_prev_special(evaluator, args, pos) -> FelValue:
    rc = evaluator.env.repeat_context
    if rc is None:
        evaluator._diag("prev() called outside repeat context", pos)
        return FelNull
    if rc.index <= 1:
        return FelNull
    return from_python(rc.collection[rc.index - 2])


def _fn_next_special(evaluator, args, pos) -> FelValue:
    rc = evaluator.env.repeat_context
    if rc is None:
        evaluator._diag("next() called outside repeat context", pos)
        return FelNull
    if rc.index >= rc.count:
        return FelNull
    return from_python(rc.collection[rc.index])


def _fn_parent_special(evaluator, args, pos) -> FelValue:
    rc = evaluator.env.repeat_context
    if rc is None:
        evaluator._diag("parent() called outside repeat context", pos)
        return FelNull
    return rc.parent


# =========================================================================
# Registry
# =========================================================================

def build_default_registry() -> dict[str, FuncDef]:
    """Build the default function registry with all built-in functions."""
    r = {}

    def reg(name, impl, mn, mx=None, null_prop=True, special=False):
        r[name] = FuncDef(name, impl, mn, mx, null_prop, special)

    # Aggregates (null-handling: they handle nulls internally)
    reg('sum', _fn_sum, 1, 1, null_prop=False)
    reg('count', _fn_count, 1, 1, null_prop=False)
    reg('avg', _fn_avg, 1, 1, null_prop=False)
    reg('min', _fn_min, 1, 1, null_prop=False)
    reg('max', _fn_max, 1, 1, null_prop=False)
    reg('countWhere', _fn_countWhere, 2, 2, special=True)

    # String
    reg('length', _fn_length, 1, 1, null_prop=False)
    reg('contains', _fn_contains, 2, 2)
    reg('startsWith', _fn_startsWith, 2, 2)
    reg('endsWith', _fn_endsWith, 2, 2)
    reg('substring', _fn_substring, 2, 3)
    reg('replace', _fn_replace, 3, 3)
    reg('upper', _fn_upper, 1, 1)
    reg('lower', _fn_lower, 1, 1)
    reg('trim', _fn_trim, 1, 1)
    reg('matches', _fn_matches, 2, 2)
    reg('format', _fn_format, 1, None)  # variadic

    # Numeric
    reg('round', _fn_round, 1, 2)
    reg('floor', _fn_floor, 1, 1)
    reg('ceil', _fn_ceil, 1, 1)
    reg('abs', _fn_abs, 1, 1)
    reg('power', _fn_power, 2, 2)

    # Date
    reg('today', _fn_today, 0, 0)
    reg('now', _fn_now, 0, 0)
    reg('year', _fn_year, 1, 1)
    reg('month', _fn_month, 1, 1)
    reg('day', _fn_day, 1, 1)
    reg('hours', _fn_hours, 1, 1)
    reg('minutes', _fn_minutes, 1, 1)
    reg('seconds', _fn_seconds, 1, 1)
    reg('time', _fn_time, 3, 3)
    reg('timeDiff', _fn_timeDiff, 2, 2)
    reg('dateDiff', _fn_dateDiff, 3, 3)
    reg('dateAdd', _fn_dateAdd, 3, 3)

    # Logical (if is special form, others handle nulls internally)
    reg('if', _fn_if_special, 3, 3, special=True)
    reg('coalesce', _fn_coalesce, 1, None, null_prop=False)
    reg('empty', _fn_empty, 1, 1, null_prop=False)
    reg('present', _fn_present, 1, 1, null_prop=False)
    reg('selected', _fn_selected, 2, 2, null_prop=False)

    # Type-checking (handle nulls internally)
    reg('isNumber', _fn_isNumber, 1, 1, null_prop=False)
    reg('isString', _fn_isString, 1, 1, null_prop=False)
    reg('isDate', _fn_isDate, 1, 1, null_prop=False)
    reg('isNull', _fn_isNull, 1, 1, null_prop=False)
    reg('typeOf', _fn_typeOf, 1, 1, null_prop=False)

    # Cast (handle nulls per §3.8.2)
    reg('number', _fn_cast_number, 1, 1, null_prop=False)
    reg('string', _fn_cast_string, 1, 1, null_prop=False)
    reg('boolean', _fn_cast_boolean, 1, 1, null_prop=False)
    reg('date', _fn_cast_date, 1, 1, null_prop=False)

    # Money
    reg('money', _fn_money, 2, 2)
    reg('moneyAmount', _fn_moneyAmount, 1, 1)
    reg('moneyCurrency', _fn_moneyCurrency, 1, 1)
    reg('moneyAdd', _fn_moneyAdd, 2, 2)
    reg('moneySum', _fn_moneySum, 1, 1, null_prop=False)

    # MIP-state (special forms)
    reg('valid', _make_mip_fn('valid'), 1, 1, special=True)
    reg('relevant', _make_mip_fn('relevant'), 1, 1, special=True)
    reg('readonly', _make_mip_fn('readonly'), 1, 1, special=True)
    reg('required', _make_mip_fn('required'), 1, 1, special=True)

    # Repeat navigation (special forms)
    reg('prev', _fn_prev_special, 0, 0, special=True)
    reg('next', _fn_next_special, 0, 0, special=True)
    reg('parent', _fn_parent_special, 0, 0, special=True)

    return r


BUILTIN_NAMES = frozenset(build_default_registry().keys())
