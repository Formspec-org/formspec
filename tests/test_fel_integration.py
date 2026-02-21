"""Stage 7: Integration / End-to-End Smoke Tests.

Full-pipeline tests simulating realistic form-evaluation scenarios.
Each test calls evaluate() one or more times in dependency order,
exercising parsing → environment → evaluation → typed results.
"""

import pytest
from decimal import Decimal

from fel import (
    evaluate, parse, extract_dependencies,
    FelNull, FelNumber, FelString, FelBoolean, FelTrue, FelFalse,
    FelArray, FelMoney, FelObject, is_null, from_python,
    Environment, RepeatContext, MipState, Evaluator, EvalResult,
)
from fel.functions import build_default_registry
from fel.types import fel_decimal, _FEL_CONTEXT


class TestTaxFormCalculation:
    def test_multi_field_dependency_chain(self):
        data = {"wages": 50000, "interest": 1200, "deduction": 13850}
        r1 = evaluate("$wages + $interest", data)
        assert r1.value == FelNumber(Decimal("51200"))
        data["total_income"] = 51200
        r2 = evaluate("$total_income - $deduction", data)
        assert r2.value == FelNumber(Decimal("37350"))


class TestConditionalVisibility:
    def test_relevant_expression(self):
        assert evaluate('$type = "business"', {"type": "business"}).value is FelTrue
        assert evaluate('$type = "business"', {"type": "personal"}).value is FelFalse


class TestRequiredValidation:
    def test_required_above_threshold(self):
        assert evaluate("$amount > 10000", {"amount": 15000}).value is FelTrue
        assert evaluate("$amount > 10000", {"amount": 5000}).value is FelFalse


class TestRepeatedSectionTotals:
    def test_line_item_grand_total(self):
        data = {
            "items": [
                {"qty": 2, "price": 10},
                {"qty": 5, "price": 3.50},
                {"qty": 1, "price": 25},
            ]
        }
        r = evaluate("sum($items[*].qty * $items[*].price)", data)
        assert r.value == FelNumber(Decimal("62.5"))


class TestCrossInstanceLookup:
    def test_instance_reference(self):
        r = evaluate(
            '@instance("orgProfile").ein',
            data={},
            instances={"orgProfile": {"ein": "12-3456789"}},
        )
        assert r.value == FelString("12-3456789")


class TestValidationConstraint:
    def test_date_ordering_constraint(self):
        data = {"startDate": "2024-01-01", "endDate": "2024-06-15"}
        r = evaluate("date($endDate) > date($startDate)", data)
        assert r.value is FelTrue
        data2 = {"startDate": "2024-06-15", "endDate": "2024-01-01"}
        r2 = evaluate("date($endDate) > date($startDate)", data2)
        assert r2.value is FelFalse


class TestMultiStepChain:
    def test_four_step_dependency(self):
        data = {"a": 10}
        rb = evaluate("$a * 2", data)
        data["b"] = float(rb.value.value)
        rc = evaluate("$b + 5", data)
        data["c"] = float(rc.value.value)
        rd = evaluate("$c / 3", data)
        expected = _FEL_CONTEXT.divide(Decimal("25"), Decimal("3"))
        assert rd.value.value == expected


class TestYearOverYear:
    def test_yoy_warning_threshold(self):
        data = {"currentYear": 150000, "priorYear": 100000}
        r = evaluate("abs($currentYear - $priorYear) / $priorYear > 0.25", data)
        assert r.value is FelTrue
        data2 = {"currentYear": 110000, "priorYear": 100000}
        r2 = evaluate("abs($currentYear - $priorYear) / $priorYear > 0.25", data2)
        assert r2.value is FelFalse


class TestMoneyWorkflow:
    def test_invoice_calculation(self):
        r_sub = evaluate('moneySum([money(1000, "USD"), money(2500, "USD"), money(500, "USD")])')
        assert isinstance(r_sub.value, FelMoney)
        assert r_sub.value.amount == Decimal("4000")
        assert r_sub.value.currency == "USD"

        r_tax = evaluate('money(moneyAmount(money(4000, "USD")) * 0.08, "USD")')
        assert isinstance(r_tax.value, FelMoney)
        assert r_tax.value.amount == Decimal("320")

        r_total = evaluate('moneyAdd(money(4000, "USD"), money(320, "USD"))')
        assert r_total.value.amount == Decimal("4320")


class TestNestedConditional:
    def test_ein_validation_expression(self):
        expr = (
            'if(empty($ein), "Required", '
            'if(not(matches($ein, "^[0-9]{2}-[0-9]{7}$")), '
            '"Invalid format", ""))'
        )
        assert evaluate(expr, {"ein": None}).value == FelString("Required")
        assert evaluate(expr, {"ein": "bad"}).value == FelString("Invalid format")
        assert evaluate(expr, {"ein": "12-3456789"}).value == FelString("")


class TestDiagnosticIsolation:
    def test_diagnostics_dont_leak_between_calls(self):
        r1 = evaluate("1 + 2")
        assert r1.value == FelNumber(Decimal("3")) and len(r1.diagnostics) == 0
        r2 = evaluate("1 / 0")
        assert is_null(r2.value) and len(r2.diagnostics) >= 1
        r3 = evaluate("3 * 4")
        assert r3.value == FelNumber(Decimal("12")) and len(r3.diagnostics) == 0


class TestSourceTargetContext:
    def test_source_reference(self):
        r = evaluate("@source.name", data={"source": {"name": "test_src"}})
        assert r.value == FelString("test_src")

    def test_target_reference(self):
        r = evaluate("@target.code", data={"target": {"code": "ABC"}})
        assert r.value == FelString("ABC")
