"""Stage 3A: FEL Property-Based Tests using Hypothesis.

Tests algebraic invariants of FEL expressions via property-based testing.
Each test generates random inputs and verifies that fundamental properties
(commutativity, null propagation, round-trips, etc.) always hold.
"""

import pytest
from decimal import Decimal
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

from formspec.fel import (
    evaluate, parse,
    FelNull, FelNumber, FelString, FelBoolean, FelTrue, FelFalse,
    FelArray, FelObject, FelMoney, is_null, from_python, to_python,
)
from formspec.fel.types import fel_decimal
from formspec.fel.errors import FelSyntaxError


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

fel_numbers = (
    st.decimals(min_value=-1000000, max_value=1000000,
                allow_nan=False, allow_infinity=False, places=4)
    .map(lambda d: FelNumber(fel_decimal(d)))
)

fel_strings = (
    st.text(
        alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'S'),
                               whitelist_characters=' ',
                               min_codepoint=32, max_codepoint=126),
        min_size=0, max_size=20,
    ).map(FelString)
)

fel_booleans = st.sampled_from([FelTrue, FelFalse])
fel_non_null = st.one_of(fel_numbers, fel_strings, fel_booleans)
fel_num_arrays = st.lists(fel_numbers, min_size=0, max_size=10).map(FelArray)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fel_literal(v):
    """Format a FelValue as a FEL source literal."""
    if isinstance(v, FelNumber):
        return str(v.value)
    if isinstance(v, FelString):
        escaped = v.value.replace('\\', '\\\\').replace('"', '\\"')
        return '"' + escaped + '"'
    if v is FelTrue:
        return 'true'
    if v is FelFalse:
        return 'false'
    if is_null(v):
        return 'null'
    if isinstance(v, FelArray):
        return '[' + ', '.join(_fel_literal(e) for e in v.elements) + ']'
    return 'null'


def _eval(expr, data=None):
    return evaluate(expr, data or {}).value


# ---------------------------------------------------------------------------
# 1. Parser crash fuzzing
# ---------------------------------------------------------------------------

_tokens = st.sampled_from([
    '1', '0', '42', '"hi"', "'x'", 'true', 'false', 'null',
    '$x', '$a.b', '+', '-', '*', '/', '%', '&', '=', '!=',
    '<', '>', '<=', '>=', 'and', 'or', 'not', '??', '?', ':',
    'in', '(', ')', '[', ']', ',', '.',
])
_expressions = st.lists(_tokens, min_size=1, max_size=8).map(' '.join)


@given(expr=_expressions)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_parser_never_crashes(expr):
    """parse() must either succeed or raise FelSyntaxError."""
    try:
        parse(expr)
    except FelSyntaxError:
        pass


# ---------------------------------------------------------------------------
# 2. Null propagation
# ---------------------------------------------------------------------------

@given(num=fel_numbers, op=st.sampled_from(['+', '-', '*', '/']))
@settings(max_examples=100)
def test_null_propagation(num, op):
    lit = _fel_literal(num)
    assert is_null(_eval(f'null {op} {lit}'))
    assert is_null(_eval(f'{lit} {op} null'))


# ---------------------------------------------------------------------------
# 3. Commutativity of equality
# ---------------------------------------------------------------------------

@given(a=fel_numbers, b=fel_numbers)
@settings(max_examples=100)
def test_equality_commutative_numbers(a, b):
    la, lb = _fel_literal(a), _fel_literal(b)
    assert _eval(f'{la} = {lb}') == _eval(f'{lb} = {la}')


@given(a=fel_strings, b=fel_strings)
@settings(max_examples=100)
def test_equality_commutative_strings(a, b):
    la, lb = _fel_literal(a), _fel_literal(b)
    assert _eval(f'{la} = {lb}') == _eval(f'{lb} = {la}')


# ---------------------------------------------------------------------------
# 4. Double negation
# ---------------------------------------------------------------------------

@given(b=fel_booleans)
@settings(max_examples=100)
def test_double_negation(b):
    lit = _fel_literal(b)
    assert _eval(f'not(not({lit}))') == b


# ---------------------------------------------------------------------------
# 5. Null coalesce identity
# ---------------------------------------------------------------------------

@given(x=fel_numbers)
@settings(max_examples=100)
def test_null_coalesce_identity(x):
    lit = _fel_literal(x)
    assert _eval(f'{lit} ?? {lit}') == x


# ---------------------------------------------------------------------------
# 6. Sum single-element
# ---------------------------------------------------------------------------

@given(x=fel_numbers)
@settings(max_examples=100)
def test_sum_single_element(x):
    lit = _fel_literal(x)
    assert _eval(f'sum([{lit}])') == x


# ---------------------------------------------------------------------------
# 7. empty/present duality
# ---------------------------------------------------------------------------

@given(x=st.one_of(fel_numbers, fel_strings, fel_num_arrays, st.just(FelNull)))
@settings(max_examples=100)
def test_empty_present_duality(x):
    lit = _fel_literal(x)
    assert _eval(f'empty({lit})') == _eval(f'not(present({lit}))')


# ---------------------------------------------------------------------------
# 8. Round-trip number cast
# ---------------------------------------------------------------------------

@given(n=st.integers(min_value=-1000000, max_value=1000000))
@settings(max_examples=100)
def test_number_string_roundtrip(n):
    result = _eval(f'number(string({n}))')
    expected = FelNumber(fel_decimal(Decimal(n)))
    assert result == expected


# ---------------------------------------------------------------------------
# 9. abs non-negative
# ---------------------------------------------------------------------------

@given(x=fel_numbers)
@settings(max_examples=100)
def test_abs_non_negative(x):
    lit = _fel_literal(x)
    assert _eval(f'abs({lit}) >= 0') == FelTrue


# ---------------------------------------------------------------------------
# 10. count single non-null
# ---------------------------------------------------------------------------

@given(x=fel_non_null)
@settings(max_examples=100)
def test_count_single_non_null(x):
    lit = _fel_literal(x)
    assert _eval(f'count([{lit}])') == FelNumber(fel_decimal(Decimal(1)))


# ---------------------------------------------------------------------------
# 11. min/max single-element
# ---------------------------------------------------------------------------

@given(x=fel_numbers)
@settings(max_examples=100)
def test_min_max_single_element(x):
    lit = _fel_literal(x)
    assert _eval(f'min([{lit}])') == x
    assert _eval(f'max([{lit}])') == x


# ---------------------------------------------------------------------------
# 12. from_python / to_python round-trip
# ---------------------------------------------------------------------------

_python_values = st.one_of(
    st.integers(min_value=-1000000, max_value=1000000),
    st.floats(min_value=-1000000, max_value=1000000,
              allow_nan=False, allow_infinity=False),
    st.text(min_size=0, max_size=20,
            alphabet=st.characters(min_codepoint=32, max_codepoint=126)),
    st.booleans(),
    st.just(None),
    st.lists(st.integers(min_value=-100, max_value=100), min_size=0, max_size=5),
)


@given(val=_python_values)
@settings(max_examples=100)
def test_from_to_python_roundtrip(val):
    """to_python(from_python(x)) preserves value for basic Python types."""
    fel_val = from_python(val)
    rt = to_python(fel_val)

    if val is None:
        assert rt is None
    elif isinstance(val, bool):
        assert rt is val
    elif isinstance(val, int):
        assert rt == Decimal(val)
    elif isinstance(val, float):
        assert isinstance(rt, Decimal)
        assert abs(float(rt) - val) < 1e-6
    elif isinstance(val, str):
        assert rt == val
    elif isinstance(val, list):
        assert isinstance(rt, list) and len(rt) == len(val)
        for orig, elem in zip(val, rt):
            assert elem == Decimal(orig)
