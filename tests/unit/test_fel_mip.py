"""Stage 1B: MIP-State Function Tests.

Verify that FEL MIP functions (valid, relevant, readonly, required)
evaluate correctly against the MipState entries in the environment.
"""

import pytest

from formspec.fel.parser import parse
from formspec.fel.evaluator import Evaluator
from formspec.fel.environment import Environment, MipState
from formspec.fel.functions import build_default_registry
from formspec.fel.types import FelNull, FelTrue, FelFalse, FelString, is_null


def _eval_with_mip(expr_str, mip_states, data=None):
    """Parse and evaluate *expr_str* with the given mip_states dict."""
    ast = parse(expr_str)
    env = Environment(data=data, mip_states=mip_states)
    ev = Evaluator(env, build_default_registry())
    result = ev.evaluate(ast)
    return result, ev.diagnostics


def test_valid_returns_true_when_valid():
    result, diags = _eval_with_mip('valid($ein)', {'ein': MipState(valid=True)})
    assert result is FelTrue and diags == []


def test_valid_returns_false_when_invalid():
    result, diags = _eval_with_mip('valid($ein)', {'ein': MipState(valid=False)})
    assert result is FelFalse and diags == []


def test_relevant_returns_true():
    result, _ = _eval_with_mip('relevant($status)', {'status': MipState(relevant=True)})
    assert result is FelTrue


def test_relevant_returns_false():
    result, _ = _eval_with_mip('relevant($status)', {'status': MipState(relevant=False)})
    assert result is FelFalse


def test_readonly_true_and_false():
    r1, _ = _eval_with_mip('readonly($name)', {'name': MipState(readonly=True)})
    r2, _ = _eval_with_mip('readonly($name)', {'name': MipState(readonly=False)})
    assert r1 is FelTrue and r2 is FelFalse


def test_required_true_and_false():
    r1, _ = _eval_with_mip('required($email)', {'email': MipState(required=True)})
    r2, _ = _eval_with_mip('required($email)', {'email': MipState(required=False)})
    assert r1 is FelTrue and r2 is FelFalse


@pytest.mark.parametrize("fn,expected", [
    ("valid", True),
    ("relevant", True),
    ("readonly", False),
    ("required", False),
])
def test_unknown_field_returns_spec_defaults(fn, expected):
    """Field $unknown is NOT in mip_states — should fall back to spec defaults."""
    result, diags = _eval_with_mip(f'{fn}($unknown)', {})
    assert result is (FelTrue if expected else FelFalse)
    assert diags == []


def test_mip_in_compound_expression():
    result, _ = _eval_with_mip(
        'if(not(valid($ein)), "Fix EIN", "")',
        {'ein': MipState(valid=False)},
    )
    assert result == FelString('Fix EIN')


def test_mip_with_dotted_path():
    result, _ = _eval_with_mip('valid($address.zip)', {'address.zip': MipState(valid=False)})
    assert result is FelFalse


def test_mip_with_indexed_path():
    result, _ = _eval_with_mip('valid($rows[2].amount)', {'rows[2].amount': MipState(valid=False)})
    assert result is FelFalse


def test_multiple_mip_checks():
    both = {'a': MipState(valid=True), 'b': MipState(valid=True)}
    r1, _ = _eval_with_mip('valid($a) and valid($b)', both)
    assert r1 is FelTrue

    one_bad = {'a': MipState(valid=True), 'b': MipState(valid=False)}
    r2, _ = _eval_with_mip('valid($a) and valid($b)', one_bad)
    assert r2 is FelFalse


def test_non_field_ref_argument_gives_diagnostic():
    result, diags = _eval_with_mip('valid(42)', {})
    assert is_null(result)
    assert len(diags) == 1
    assert 'requires a field reference argument' in diags[0].message
