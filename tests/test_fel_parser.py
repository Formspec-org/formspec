"""Tests for the FEL scannerless recursive-descent parser."""

import pytest
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal

from fel.parser import parse, RESERVED_WORDS
from fel.ast_nodes import (
    ArrayLiteral, BinaryOp, BooleanLiteral, ContextRef, DateLiteral,
    DotSegment, FieldRef, FunctionCall, IfThenElse, IndexSegment,
    LetBinding, MembershipOp, NullLiteral, NumberLiteral, ObjectLiteral,
    PostfixAccess, StringLiteral, TernaryOp, UnaryOp, WildcardSegment,
)
from fel.errors import FelSyntaxError


class TestLiterals:
    def test_integer(self):
        n = parse('42')
        assert isinstance(n, NumberLiteral)
        assert n.value == Decimal('42')

    def test_decimal(self):
        n = parse('3.14')
        assert n.value == Decimal('3.14')

    def test_exponent(self):
        n = parse('1e10')
        assert n.value == Decimal('1e10')

    def test_negative_exponent(self):
        n = parse('2.5E-3')
        assert n.value == Decimal('2.5E-3')

    def test_zero(self):
        assert parse('0').value == Decimal('0')

    def test_leading_dot_rejected(self):
        with pytest.raises(FelSyntaxError):
            parse('.5')

    def test_string_double_quoted(self):
        s = parse('"hello"')
        assert isinstance(s, StringLiteral)
        assert s.value == 'hello'

    def test_string_single_quoted(self):
        s = parse("'world'")
        assert s.value == 'world'

    def test_string_escapes(self):
        s = parse(r"'a\nb\tc\\d'")
        assert s.value == 'a\nb\tc\\d'

    def test_string_unicode_escape(self):
        s = parse(r"'\u0041'")
        assert s.value == 'A'

    def test_string_unrecognized_escape(self):
        with pytest.raises(FelSyntaxError, match='Unrecognized escape'):
            parse(r"'\a'")

    def test_unterminated_string(self):
        with pytest.raises(FelSyntaxError, match='Unterminated'):
            parse("'hello")

    def test_true(self):
        b = parse('true')
        assert isinstance(b, BooleanLiteral)
        assert b.value is True

    def test_false(self):
        assert parse('false').value is False

    def test_null(self):
        assert isinstance(parse('null'), NullLiteral)

    def test_date_literal(self):
        d = parse('@2025-07-10')
        assert isinstance(d, DateLiteral)
        assert d.value == date(2025, 7, 10)

    def test_datetime_literal_utc(self):
        d = parse('@2025-07-10T14:30:00Z')
        assert isinstance(d, DateLiteral)
        assert d.value == datetime(2025, 7, 10, 14, 30, 0, tzinfo=timezone.utc)

    def test_datetime_literal_offset(self):
        d = parse('@2025-07-10T14:30:00+05:30')
        tz = timezone(timedelta(hours=5, minutes=30))
        assert d.value == datetime(2025, 7, 10, 14, 30, 0, tzinfo=tz)

    def test_datetime_literal_negative_offset(self):
        d = parse('@2025-07-10T14:30:00-08:00')
        tz = timezone(timedelta(hours=-8))
        assert d.value == datetime(2025, 7, 10, 14, 30, 0, tzinfo=tz)


class TestFieldRefs:
    def test_bare_dollar(self):
        f = parse('$')
        assert isinstance(f, FieldRef)
        assert f.segments == ()

    def test_simple_field(self):
        f = parse('$firstName')
        assert isinstance(f, FieldRef)
        assert f.segments == (DotSegment('firstName'),)

    def test_dotted_path(self):
        f = parse('$address.city')
        assert f.segments == (DotSegment('address'), DotSegment('city'))

    def test_indexed_access(self):
        f = parse('$items[1]')
        assert f.segments == (DotSegment('items'), IndexSegment(1))

    def test_wildcard_access(self):
        f = parse('$items[*].amount')
        assert f.segments == (
            DotSegment('items'), WildcardSegment(), DotSegment('amount')
        )

    def test_chained_subscripts(self):
        f = parse('$a[1].nested[*].value')
        assert f.segments == (
            DotSegment('a'), IndexSegment(1), DotSegment('nested'),
            WildcardSegment(), DotSegment('value')
        )

    def test_field_can_be_reserved_word(self):
        """Field keys via $ are not subject to reserved word restriction."""
        f = parse('$true')
        assert f.segments == (DotSegment('true'),)


class TestContextRefs:
    def test_current(self):
        c = parse('@current')
        assert isinstance(c, ContextRef)
        assert c.name == 'current' and c.arg is None and c.tail == ()

    def test_index(self):
        c = parse('@index')
        assert c.name == 'index'

    def test_count(self):
        c = parse('@count')
        assert c.name == 'count'

    def test_instance_with_arg(self):
        c = parse("@instance('priorYear')")
        assert c.name == 'instance' and c.arg == 'priorYear'

    def test_instance_with_tail(self):
        c = parse("@instance('priorYear').totalIncome")
        assert c.arg == 'priorYear' and c.tail == ('totalIncome',)

    def test_source_ref(self):
        c = parse('@source.fieldA')
        assert c.name == 'source' and c.tail == ('fieldA',)

    def test_multi_segment_tail(self):
        c = parse("@instance('x').a.b.c")
        assert c.tail == ('a', 'b', 'c')


class TestOperators:
    def test_addition(self):
        n = parse('1 + 2')
        assert isinstance(n, BinaryOp)
        assert n.op == '+'

    def test_subtraction(self):
        assert parse('$a - $b').op == '-'

    def test_multiplication(self):
        assert parse('$a * $b').op == '*'

    def test_division(self):
        assert parse('$a / $b').op == '/'

    def test_modulo(self):
        assert parse('$a % $b').op == '%'

    def test_string_concat(self):
        assert parse("$a & $b").op == '&'

    def test_equality(self):
        assert parse('$x = 5').op == '='

    def test_inequality(self):
        assert parse('$x != 5').op == '!='

    def test_less_than(self):
        assert parse('$a < $b').op == '<'

    def test_less_equal(self):
        assert parse('$a <= $b').op == '<='

    def test_greater_than(self):
        assert parse('$a > $b').op == '>'

    def test_greater_equal(self):
        assert parse('$a >= $b').op == '>='

    def test_null_coalesce(self):
        assert parse('$x ?? 0').op == '??'

    def test_logical_and(self):
        assert parse('$a and $b').op == 'and'

    def test_logical_or(self):
        assert parse('$a or $b').op == 'or'

    def test_unary_not(self):
        n = parse('not $flag')
        assert isinstance(n, UnaryOp) and n.op == 'not'

    def test_unary_minus_field(self):
        n = parse('-$x')
        assert isinstance(n, UnaryOp) and n.op == '-'
        assert isinstance(n.operand, FieldRef)

    def test_unary_minus_expr(self):
        n = parse('-(1 + 2)')
        assert isinstance(n, UnaryOp) and n.op == '-'


class TestPrecedence:
    def test_mul_before_add(self):
        n = parse('1 + 2 * 3')
        assert n.op == '+'
        assert isinstance(n.right, BinaryOp) and n.right.op == '*'

    def test_and_before_or(self):
        n = parse('$a or $b and $c')
        assert n.op == 'or'
        assert n.right.op == 'and'

    def test_comparison_before_equality(self):
        n = parse('$a = $b < $c')
        assert n.op == '='
        assert n.right.op == '<'

    def test_parens_override(self):
        n = parse('(1 + 2) * 3')
        assert n.op == '*'
        assert n.left.op == '+'

    def test_null_coalesce_before_comparison(self):
        # $a ?? 0 > 5  =>  ($a ?? 0) > 5
        n = parse('$a ?? 0 > 5')
        assert n.op == '>'
        assert n.left.op == '??'


class TestMembership:
    def test_in(self):
        n = parse("$status in ['a', 'b']")
        assert isinstance(n, MembershipOp)
        assert not n.negated

    def test_not_in(self):
        n = parse("$x not in [1, 2, 3]")
        assert isinstance(n, MembershipOp)
        assert n.negated


class TestTernary:
    def test_basic_ternary(self):
        n = parse("$a > 0 ? 'pos' : 'neg'")
        assert isinstance(n, TernaryOp)

    def test_nested_ternary(self):
        n = parse("$a ? $b ? 1 : 2 : 3")
        assert isinstance(n, TernaryOp)

    def test_ternary_not_confused_with_null_coalesce(self):
        """$x ?? $y should parse as null-coalesce, not ternary."""
        n = parse('$x ?? $y')
        assert isinstance(n, BinaryOp) and n.op == '??'


class TestIfThenElse:
    def test_keyword_form(self):
        n = parse("if $a then 'yes' else 'no'")
        assert isinstance(n, IfThenElse)

    def test_function_form(self):
        n = parse("if($a, 'yes', 'no')")
        assert isinstance(n, FunctionCall)
        assert n.name == 'if'
        assert len(n.args) == 3

    def test_nested_if_keyword(self):
        n = parse("if $a then if $b then 1 else 2 else 3")
        assert isinstance(n, IfThenElse)
        assert isinstance(n.then_expr, IfThenElse)


class TestLetBinding:
    def test_basic_let(self):
        n = parse('let x = 1 in x + 2')
        assert isinstance(n, LetBinding)
        assert n.name == 'x'

    def test_let_value_restricted(self):
        """let value skips membership 'in' to avoid ambiguity."""
        # let x = $y in $z  =>  let binding, not membership
        n = parse('let x = $y in $z')
        assert isinstance(n, LetBinding)
        assert isinstance(n.body, FieldRef)

    def test_let_value_membership_parenthesized(self):
        """Membership in let-value must be parenthesized."""
        n = parse("let x = ($a in [1, 2]) in x")
        assert isinstance(n, LetBinding)
        assert isinstance(n.value, MembershipOp)

    def test_nested_let(self):
        n = parse('let x = 1 in let y = 2 in x + y')
        assert isinstance(n, LetBinding)
        assert isinstance(n.body, LetBinding)


class TestFunctionCalls:
    def test_no_args(self):
        n = parse('today()')
        assert isinstance(n, FunctionCall)
        assert n.name == 'today' and n.args == ()

    def test_one_arg(self):
        n = parse('abs($x)')
        assert n.name == 'abs' and len(n.args) == 1

    def test_multiple_args(self):
        n = parse('round($x, 2)')
        assert n.name == 'round' and len(n.args) == 2

    def test_nested_calls(self):
        n = parse('sum(abs($x))')
        assert n.name == 'sum'
        assert isinstance(n.args[0], FunctionCall)

    def test_reserved_word_as_function_rejected(self):
        with pytest.raises(FelSyntaxError):
            parse('and(1, 2)')

    def test_reserved_word_not_as_function_rejected(self):
        with pytest.raises(FelSyntaxError):
            parse('or(1, 2)')


class TestPostfixAccess:
    def test_function_dot_access(self):
        """prev().field should parse."""
        n = parse('prev().cumulative_total')
        assert isinstance(n, PostfixAccess)
        assert isinstance(n.expr, FunctionCall)
        assert n.segments == (DotSegment('cumulative_total'),)

    def test_parent_dot_access(self):
        n = parse('parent().section_total')
        assert isinstance(n, PostfixAccess)
        assert n.expr.name == 'parent'

    def test_paren_dot_access(self):
        n = parse('($a).field')
        assert isinstance(n, PostfixAccess)

    def test_if_call_postfix(self):
        n = parse("if($a, $b, $c).field")
        assert isinstance(n, PostfixAccess)
        assert n.expr.name == 'if'


class TestArrayLiteral:
    def test_empty(self):
        n = parse('[]')
        assert isinstance(n, ArrayLiteral) and n.elements == ()

    def test_numbers(self):
        n = parse('[1, 2, 3]')
        assert len(n.elements) == 3

    def test_strings(self):
        n = parse("['a', 'b']")
        assert len(n.elements) == 2


class TestObjectLiteral:
    def test_empty(self):
        n = parse('{}')
        assert isinstance(n, ObjectLiteral) and n.entries == ()

    def test_simple(self):
        n = parse('{a: 1, b: 2}')
        assert len(n.entries) == 2
        assert n.entries[0][0] == 'a'

    def test_string_keys(self):
        n = parse('{"key": 1}')
        assert n.entries[0][0] == 'key'

    def test_duplicate_keys_rejected(self):
        with pytest.raises(FelSyntaxError, match='Duplicate key'):
            parse('{a: 1, a: 2}')


class TestWhitespaceAndComments:
    def test_spaces(self):
        parse('  1  +  2  ')

    def test_newlines(self):
        parse('1\n+\n2')

    def test_line_comment(self):
        n = parse('1 + // comment\n2')
        assert isinstance(n, BinaryOp)

    def test_block_comment(self):
        n = parse('1 + /* comment */ 2')
        assert isinstance(n, BinaryOp)

    def test_block_comment_not_nested(self):
        """/* a /* b */ should end at first */."""
        # '/* a /* b */ c */' parses as comment '/* a /* b */' then tokens c * /
        # Parsing just the comment part + a valid expression:
        n = parse('/* a /* b */ 42')
        assert isinstance(n, NumberLiteral)
        assert n.value == Decimal('42')

    def test_unterminated_block_comment(self):
        with pytest.raises(FelSyntaxError, match='Unterminated block comment'):
            parse('/* never ends')


class TestEdgeCases:
    def test_pipe_operator_rejected(self):
        with pytest.raises(FelSyntaxError, match='reserved for future'):
            parse('$a |> $b')

    def test_identifier_starting_with_reserved_prefix(self):
        """'notify' should not be parsed as 'not' + 'ify'."""
        n = parse('notify()')
        assert isinstance(n, FunctionCall) and n.name == 'notify'

    def test_informal_not_parsed_as_in(self):
        """'informal' should not be parsed as 'in' + 'formal'."""
        n = parse('informal()')
        assert n.name == 'informal'

    def test_true_prefix_is_identifier(self):
        """'trueValue' should not match 'true' + 'Value'."""
        n = parse('trueValue()')
        assert n.name == 'trueValue'

    def test_empty_expression_rejected(self):
        with pytest.raises(FelSyntaxError):
            parse('')

    def test_complex_expression(self):
        """A realistic complex expression should parse without error."""
        expr = "sum($lineItems[*].quantity * $lineItems[*].unitPrice)"
        n = parse(expr)
        assert isinstance(n, FunctionCall) and n.name == 'sum'

    def test_source_positions_tracked(self):
        n = parse('  42')
        assert n.pos.line == 1
        assert n.pos.col == 3

    def test_multiline_positions(self):
        n = parse('1 +\n  2')
        assert n.right.pos.line == 2
        assert n.right.pos.col == 3

    def test_self_ref_in_constraint(self):
        """$ > 0 is valid."""
        n = parse('$ > 0')
        assert isinstance(n, BinaryOp)
        assert isinstance(n.left, FieldRef) and n.left.segments == ()

    def test_countWhere_parses(self):
        """countWhere($items[*].amount, $ > 10000) should parse."""
        n = parse('countWhere($items[*].amount, $ > 10000)')
        assert n.name == 'countWhere'
        assert len(n.args) == 2

    def test_all_reserved_words(self):
        """Verify all 11 reserved words."""
        assert RESERVED_WORDS == {
            'true', 'false', 'null', 'and', 'or', 'not', 'in',
            'if', 'then', 'else', 'let'
        }
