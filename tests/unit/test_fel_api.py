"""Tests for the Rust-backed FEL public API."""

from decimal import Decimal

import formspec.fel as fel
from formspec.fel import (
    BUILTIN_NAMES,
    RESERVED_WORDS,
    DependencySet,
    EvalResult,
    evaluate,
    extract_dependencies,
    is_null,
    parse,
    to_python,
)
from formspec.fel.errors import FelSyntaxError


class TestPublicAPI:
    def test_parse_returns_opaque_handle(self):
        parsed = parse("1 + 2")
        assert parsed.source == "1 + 2"

    def test_parse_invalid_expression_raises(self):
        try:
            parse("if(1 then")
        except FelSyntaxError:
            return
        raise AssertionError("parse() should raise FelSyntaxError for invalid input")

    def test_evaluate_returns_eval_result(self):
        result = evaluate("1 + 2")
        assert isinstance(result, EvalResult)
        assert to_python(result.value) == Decimal("3")
        assert result.diagnostics == []

    def test_evaluate_with_data(self):
        result = evaluate("$x + $y", {"x": 10, "y": 20})
        assert to_python(result.value) == Decimal("30")

    def test_evaluate_with_instances(self):
        result = evaluate(
            "@instance('prior').income",
            instances={"prior": {"income": 50000}},
        )
        assert to_python(result.value) == Decimal("50000")

    def test_extract_dependencies_returns_set(self):
        deps = extract_dependencies("$a + $b.c")
        assert isinstance(deps, DependencySet)
        assert deps.fields == {"a", "b.c"}


class TestDependencies:
    def test_simple_fields(self):
        deps = extract_dependencies("$price * $quantity")
        assert deps.fields == {"price", "quantity"}

    def test_nested_fields(self):
        deps = extract_dependencies("$address.city")
        assert deps.fields == {"address.city"}

    def test_wildcard_detected(self):
        deps = extract_dependencies("sum($items[*].amount)")
        assert deps.has_wildcard
        assert "items.amount" in deps.fields

    def test_context_ref(self):
        deps = extract_dependencies("@current.amount")
        assert "current" in deps.context_refs

    def test_instance_ref(self):
        deps = extract_dependencies("@instance('prior').income")
        assert "prior" in deps.instance_refs

    def test_self_ref(self):
        deps = extract_dependencies("$ > 0")
        assert deps.has_self_ref

    def test_let_binding_excluded(self):
        deps = extract_dependencies("let x = $a in x + $b")
        assert deps.fields == {"a", "b"}

    def test_mip_deps(self):
        deps = extract_dependencies("valid($ein)")
        assert "ein" in deps.mip_deps

    def test_prev_next_flag(self):
        deps = extract_dependencies("prev()")
        assert deps.uses_prev_next


class TestRuntimeContract:
    def test_builtin_names_exposed(self):
        assert "sum" in BUILTIN_NAMES
        assert "instance" in BUILTIN_NAMES

    def test_reserved_words_exposed(self):
        assert {"true", "false", "null", "let"} <= RESERVED_WORDS

    def test_unknown_function_produces_diagnostic(self):
        result = evaluate("totallyUnknown(1)")
        assert is_null(result.value)
        assert any(
            diagnostic.message == "Undefined function: totallyUnknown"
            for diagnostic in result.diagnostics
        )

    def test_source_and_target_contexts_can_be_supplied_via_data(self):
        source_result = evaluate("@source.name", {"source": {"name": "src"}})
        target_result = evaluate("@target.code", {"target": {"code": "ABC"}})
        assert to_python(source_result.value) == "src"
        assert to_python(target_result.value) == "ABC"

    def test_variable_ref_uses_runtime_variables(self):
        variables = {"grandTotal": fel.from_python({"amount": "50000", "currency": "USD"})}
        result = evaluate("@grandTotal", {}, variables=variables)
        assert to_python(result.value) == {"amount": "50000", "currency": "USD"}
