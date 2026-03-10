"""Conformance and Spec Examples for FEL."""

import pytest
from decimal import Decimal

from formspec.fel import parse, evaluate, is_null
from formspec.fel.errors import FelSyntaxError
from formspec.fel import FelTrue, FelNumber, FelString
from formspec.fel.parser import RESERVED_WORDS


class TestConformanceGrammar:
    """Conformance points from fel-grammar.md §7."""

    def test_point1_accept_valid(self):
        """MUST accept all valid expressions."""
        valid = [
            '42', "'hello'", 'true', 'false', 'null',
            '$x + $y', '$a and $b', 'not $flag',
            'if(true, 1, 2)', "if $a then 'y' else 'n'",
            'let x = 1 in x + 2',
            "$x ?? 0", "'a' & 'b'",
            '$items[*].amount', '$items[1].name',
            '@current.amount', '@index', '@count',
            "@instance('x').field",
            '@2025-07-10', '@2025-07-10T14:30:00Z',
            'sum($a)', 'today()', 'round($x, 2)',
            '{a: 1, b: 2}', '[1, 2, 3]',
            '$x in [1, 2]', '$x not in [1, 2]',
            'prev().field', 'parent().total',
        ]
        for expr in valid:
            parse(expr)  # Should not raise

    def test_point2_reject_invalid(self):
        """MUST reject invalid input with diagnostic."""
        invalid = [
            '', '+ +', '1 1', '(()', '}}',
        ]
        for expr in invalid:
            with pytest.raises(FelSyntaxError):
                parse(expr)

    def test_point3_whitespace_insignificant(self):
        assert parse('1+2').op == parse('  1  +  2  ').op

    def test_point4_escape_sequences(self):
        assert parse(r"'\n'").value == '\n'
        assert parse(r"'\t'").value == '\t'
        assert parse(r"'\\'").value == '\\'
        with pytest.raises(FelSyntaxError):
            parse(r"'\a'")

    def test_point5_reserved_words_not_function_names(self):
        for word in RESERVED_WORDS:
            if word in ('true', 'false', 'null', 'if'):
                continue  # These have special handling
            with pytest.raises(FelSyntaxError):
                parse(f'{word}()')

    def test_point6_pipe_rejected(self):
        with pytest.raises(FelSyntaxError, match='reserved for future'):
            parse('$a |> $b')

    def test_point7_precedence_preserved(self):
        ast = parse('1 + 2 * 3')
        from formspec.fel.ast_nodes import BinaryOp
        assert ast.op == '+'
        assert ast.right.op == '*'


class TestConformanceSemantics:
    """Semantic conformance from spec.md §3."""

    def test_no_implicit_coercion(self):
        """Type mismatches produce errors, not coercions."""
        r = evaluate("'hello' + 5")
        assert is_null(r.value)
        assert len(r.diagnostics) >= 1

    def test_division_by_zero_null(self):
        r = evaluate('1 / 0')
        assert is_null(r.value)
        assert any('zero' in d.message.lower() for d in r.diagnostics)

    def test_short_circuit_and(self):
        """false and <error> should not evaluate right side."""
        r = evaluate("false and ('x' + 1 = 2)")
        assert r.value.value is False
        assert len(r.diagnostics) == 0  # No type error

    def test_short_circuit_or(self):
        r = evaluate("true or ('x' + 1 = 2)")
        assert r.value.value is True
        assert len(r.diagnostics) == 0

    def test_null_equals_null_true(self):
        assert evaluate('null = null').value is FelTrue

    def test_null_not_truthy(self):
        """0 is not false, '' is not false, null is not false."""
        r = evaluate('0 and true')
        assert is_null(r.value)  # Type error: 0 is not boolean


class TestSpecExamples:
    """Examples directly from spec.md §3."""

    def test_field_ref_example(self):
        assert evaluate('$firstName', {'firstName': 'Ada'}).value.value == 'Ada'

    def test_nested_field_ref(self):
        data = {'demographics': {'dob': '1815-12-10'}}
        assert evaluate('$demographics.dob', data).value.value == '1815-12-10'

    def test_string_concat_example(self):
        data = {'firstName': 'Ada', 'lastName': 'Lovelace'}
        r = evaluate("$firstName & ' ' & $lastName", data)
        assert r.value.value == 'Ada Lovelace'

    def test_null_coalesce_example(self):
        r = evaluate("$middleName ?? 'N/A'", {'middleName': None})
        assert r.value.value == 'N/A'

    def test_membership_example(self):
        r = evaluate("$status in ['active', 'pending']", {'status': 'active'})
        assert r.value is FelTrue

    def test_if_function_example(self):
        data = {'a': True}
        r = evaluate("if($a, 'yes', 'no')", data)
        assert r.value.value == 'yes'

    def test_line_item_sum(self):
        data = {'lineItems': [
            {'quantity': 2, 'unitPrice': 10.00},
            {'quantity': 5, 'unitPrice': 3.50},
            {'quantity': 1, 'unitPrice': 25.00},
        ]}
        r = evaluate(
            'sum($lineItems[*].quantity * $lineItems[*].unitPrice)',
            data
        )
        assert r.value.value == Decimal('62.5')

    def test_today_returns_date(self):
        from datetime import date
        from formspec.fel import FelDate
        r = evaluate('today()')
        assert isinstance(r.value, FelDate)

    def test_decimal_precision(self):
        """0.1 + 0.2 = 0.3 (spec §3.4.1 rationale)."""
        r = evaluate('0.1 + 0.2')
        assert r.value.value == Decimal('0.3')


# ===================================================================
# Stage 4A: Spec-Example Exhaustiveness
# ===================================================================


class TestSpecSection3Examples:
    """Verify every example from §3 of spec.md is tested."""

    def test_s3_2_2_wildcard_extraction(self):
        """$lineItems[*].amount extracts an array of amounts."""
        data = {'lineItems': [{'amount': 100}, {'amount': 200}, {'amount': 300}]}
        r = evaluate('$lineItems[*].amount', data)
        from formspec.fel import FelArray, FelNumber
        assert isinstance(r.value, FelArray)
        assert len(r.value.elements) == 3
        assert r.value.elements[1].value == Decimal('200')

    def test_s3_2_3_cross_instance(self):
        """§3.2.3: @instance('orgProfile').ein"""
        r = evaluate(
            '@instance("orgProfile").ein',
            data={},
            instances={'orgProfile': {'ein': '12-3456789'}}
        )
        assert r.value == FelString('12-3456789')

    def test_s3_3_precedence_mul_before_add_eval(self):
        """2 + 3 * 4 = 14 (evaluator, not just parser)."""
        r = evaluate('2 + 3 * 4')
        assert r.value == FelNumber(Decimal('14'))

    def test_s3_5_5_selected_example(self):
        """selected($colors, "red")"""
        r = evaluate('selected($colors, "red")', {'colors': ['red', 'blue']})
        assert r.value is FelTrue

    def test_s3_8_1_null_plus_5(self):
        """null + 5 → null (spec §3.8.1 example 1)."""
        r = evaluate('null + 5')
        assert is_null(r.value)

    def test_s3_8_1_hello_concat_null(self):
        """'hello' & null → null (spec §3.8.1 example 2)."""
        r = evaluate("'hello' & null")
        assert is_null(r.value)

    def test_s3_8_1_null_lt_5(self):
        """null < 5 → null (spec §3.8.1 example 3)."""
        r = evaluate('null < 5')
        assert is_null(r.value)

    def test_s3_8_3_missing_field_resolves_to_null(self):
        """Reference to absent field → null."""
        r = evaluate('$nonexistent', {'other': 1})
        assert is_null(r.value)

    def test_s3_9_broadcast_example(self):
        """§3.9: $lineItems[*].amount * $taxRate with scalar broadcast."""
        data = {
            'lineItems': [{'amount': 200}, {'amount': 175}, {'amount': 250}],
            'taxRate': 2,
        }
        r = evaluate('$lineItems[*].amount * $taxRate', data)
        from formspec.fel import FelArray
        assert isinstance(r.value, FelArray)
        vals = [e.value for e in r.value.elements]
        assert vals[0] == Decimal('400')
        assert vals[1] == Decimal('350')
        assert vals[2] == Decimal('500')

    def test_s3_10_2_division_by_zero_diagnostic(self):
        """§3.10.2: division by zero signals evaluation error."""
        r = evaluate('10 / 0')
        assert is_null(r.value)
        assert len(r.diagnostics) >= 1


