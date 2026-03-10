"""Tests for FEL public API, dependencies, extensions, conformance."""

import pytest
from decimal import Decimal

import formspec.fel as fel
from formspec.fel import (
    parse, evaluate, extract_dependencies,
    FelNull, FelNumber, FelString, FelTrue, FelFalse,
    is_null, to_python, EvalResult, DependencySet,
)
from formspec.fel.errors import FelSyntaxError, FelDefinitionError
from formspec.fel.extensions import register_extension
from formspec.fel.functions import build_default_registry, BUILTIN_NAMES
from formspec.fel.parser import RESERVED_WORDS


class TestPublicAPI:
    def test_parse_returns_ast(self):
        ast = parse('1 + 2')
        from formspec.fel.ast_nodes import BinaryOp
        assert isinstance(ast, BinaryOp)

    def test_evaluate_returns_eval_result(self):
        r = evaluate('1 + 2')
        assert isinstance(r, EvalResult)
        assert isinstance(r.value, FelNumber)
        assert r.diagnostics == []

    def test_evaluate_with_data(self):
        r = evaluate('$x + $y', {'x': 10, 'y': 20})
        assert r.value.value == Decimal('30')

    def test_evaluate_with_instances(self):
        r = evaluate(
            "@instance('prior').income",
            instances={'prior': {'income': 50000}}
        )
        assert r.value.value == Decimal('50000')

    def test_extract_dependencies_returns_set(self):
        d = extract_dependencies('$a + $b.c')
        assert isinstance(d, DependencySet)
        assert d.fields == {'a', 'b.c'}


class TestDependencies:
    def test_simple_fields(self):
        d = extract_dependencies('$price * $quantity')
        assert d.fields == {'price', 'quantity'}

    def test_nested_fields(self):
        d = extract_dependencies('$address.city')
        assert d.fields == {'address.city'}

    def test_wildcard_detected(self):
        d = extract_dependencies('sum($items[*].amount)')
        assert d.has_wildcard
        assert 'items.amount' in d.fields

    def test_context_ref(self):
        d = extract_dependencies('@current.amount')
        assert '@current' in d.context_refs

    def test_instance_ref(self):
        d = extract_dependencies("@instance('prior').income")
        assert 'prior' in d.instance_refs

    def test_self_ref(self):
        d = extract_dependencies('$ > 0')
        assert d.has_self_ref

    def test_let_binding_excluded(self):
        d = extract_dependencies('let x = $a in x + $b')
        assert d.fields == {'a', 'b'}

    def test_mip_deps(self):
        d = extract_dependencies('valid($ein)')
        assert 'ein' in d.mip_deps

    def test_prev_next_flag(self):
        d = extract_dependencies('prev()')
        assert d.uses_prev_next


class TestExtensions:
    def test_register_extension(self):
        reg = build_default_registry()
        def bmi(w, h):
            return FelNumber((w.value / ((h.value / 100) ** 2)).quantize(Decimal('0.1')))
        register_extension(reg, 'bmi', bmi, 2, 2)
        assert 'bmi' in reg

    def test_extension_name_collision_reserved(self):
        reg = build_default_registry()
        with pytest.raises(FelDefinitionError, match='collides'):
            register_extension(reg, 'and', lambda: None, 0)

    def test_extension_name_collision_builtin(self):
        reg = build_default_registry()
        with pytest.raises(FelDefinitionError, match='collides'):
            register_extension(reg, 'sum', lambda: None, 1)

    def test_extension_function_called(self):
        from formspec.fel.functions import FuncDef
        def double(x):
            return FelNumber(x.value * 2)
        ext = {'double': FuncDef('double', double, 1, 1, True, False)}
        r = evaluate('double(21)', extensions=ext)
        assert r.value.value == Decimal('42')


# ===================================================================
# Stage 8: Dependency Extraction Edge Cases
# ===================================================================


class TestDependencyEdgeCases:

    def test_bare_dollar_excluded_from_fields(self):
        """Bare $ in countWhere predicate: no field dep for $."""
        d = extract_dependencies('countWhere($items[*].x, $ > 10)')
        assert 'items.x' in d.fields
        # bare $ should not appear as a field name
        assert '' not in d.fields

    def test_countWhere_predicate_includes_other_fields(self):
        """Fields used inside countWhere predicate are tracked."""
        d = extract_dependencies('countWhere($items[*].x, $ > $threshold)')
        assert 'items.x' in d.fields
        assert 'threshold' in d.fields

    def test_postfix_deps_flag_prev_next(self):
        """prev().cumulative tracks prev/next flag."""
        d = extract_dependencies('prev().cumulative')
        assert d.uses_prev_next

    def test_let_binding_name_excluded(self):
        """Let-bound variable name not in field deps."""
        d = extract_dependencies('let x = $a in x + $b')
        assert 'a' in d.fields
        assert 'b' in d.fields
        assert 'x' not in d.fields

    def test_object_literal_deps(self):
        """Fields inside object literal are tracked."""
        d = extract_dependencies('{a: $x, b: $y}.a')
        assert 'x' in d.fields
        assert 'y' in d.fields


class TestEvaluate:

    def test_evaluate_variable_ref(self):
        """@name should resolve to the passed variable value, not FelNull."""
        from formspec.fel.types import FelMoney, fel_decimal
        variables = {'grandTotal': FelMoney(fel_decimal('50000'), 'USD')}
        result = evaluate('@grandTotal', data={}, variables=variables)
        assert to_python(result.value) == {'amount': '50000', 'currency': 'USD'}

    def test_evaluate_variable_ref_unknown_still_null(self):
        """Unknown @name with no variables dict stays FelNull."""
        result = evaluate('@unknownVar', data={})
        assert is_null(result.value)

    def test_evaluate_variable_ref_in_shape_constraint(self):
        """Shape-style constraint referencing a pre-computed variable."""
        from formspec.fel.types import FelMoney, fel_decimal
        variables = {'grandTotal': FelMoney(fel_decimal('50000'), 'USD')}
        data = {'budget': {'requestedAmount': {'amount': '50000', 'currency': 'USD'}}}
        result = evaluate(
            'abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1',
            data=data,
            variables=variables,
        )
        assert result.value is FelTrue

    def test_evaluate_variable_ref_with_tail(self):
        """@varName.field should traverse tail on FelObject variable values."""
        from formspec.fel.types import FelObject, FelString
        variables = {'orgProfile': FelObject({'ein': FelString('12-3456789')})}
        result = evaluate('@orgProfile.ein', data={}, variables=variables)
        assert result.value == FelString('12-3456789')
