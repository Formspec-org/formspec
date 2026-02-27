"""Tests for DefinitionEvaluator: variable evaluation and shape constraint checking."""
import pytest
from formspec.evaluator import DefinitionEvaluator
from formspec.fel.types import to_python


# ── Variable evaluation ──────────────────────────────────────────────────────

class TestEvaluateVariables:
    def test_single_variable(self):
        defn = {
            'variables': [{'name': 'total', 'expression': 'sum($items[*].amount)'}]
        }
        ev = DefinitionEvaluator(defn)
        data = {'items': [{'amount': 100}, {'amount': 200}]}
        variables = ev.evaluate_variables(data)
        assert to_python(variables['total']) == pytest.approx(300)

    def test_variable_depending_on_variable(self):
        """indirectCosts depends on totalDirect — topo sort must evaluate totalDirect first."""
        defn = {
            'variables': [
                {'name': 'indirectCosts', 'expression': 'moneyAmount(@totalDirect) * 0.1'},
                {'name': 'totalDirect',   'expression': 'money(sum($items[*].amount), "USD")'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        data = {'items': [{'amount': 1000}]}
        variables = ev.evaluate_variables(data)
        assert to_python(variables['totalDirect']) == {'amount': '1000', 'currency': 'USD'}
        assert to_python(variables['indirectCosts']) == pytest.approx(100)

    def test_no_variables(self):
        ev = DefinitionEvaluator({})
        assert ev.evaluate_variables({}) == {}

    def test_circular_dependency_raises(self):
        defn = {
            'variables': [
                {'name': 'a', 'expression': '@b + 1'},
                {'name': 'b', 'expression': '@a + 1'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        with pytest.raises(ValueError, match="Circular"):
            ev.evaluate_variables({})


# ── Shape evaluation ─────────────────────────────────────────────────────────

class TestValidate:
    def _ev(self, shapes, variables=None):
        defn = {'shapes': shapes}
        if variables:
            defn['variables'] = variables
        return DefinitionEvaluator(defn)

    def test_passing_constraint_no_result(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Must be positive', 'code': 'POS',
            'constraint': '$value > 0',
        }])
        assert ev.validate({'value': 5}) == []

    def test_failing_constraint_emits_result(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Must be positive', 'code': 'POS',
            'constraint': '$value > 0',
        }])
        results = ev.validate({'value': -1})
        assert len(results) == 1
        assert results[0]['code'] == 'POS'
        assert results[0]['severity'] == 'error'
        assert results[0]['shapeId'] == 's1'

    def test_active_when_false_skips_shape(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'activeWhen': '$enabled',
            'constraint': '$value > 100',
        }])
        # constraint would fail, but activeWhen is false
        assert ev.validate({'enabled': False, 'value': 0}) == []

    def test_active_when_true_applies_shape(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'activeWhen': '$enabled',
            'constraint': '$value > 100',
        }])
        results = ev.validate({'enabled': True, 'value': 0})
        assert len(results) == 1

    def test_or_composition_passes_if_any_true(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'warning',
            'message': 'Need one', 'code': 'C',
            'or': ['present($email)', 'present($phone)'],
        }])
        assert ev.validate({'email': 'x@y.com', 'phone': None}) == []
        assert ev.validate({'email': None, 'phone': None}) != []

    def test_and_composition_fails_if_any_false(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Need both', 'code': 'C',
            'and': ['present($a)', 'present($b)'],
        }])
        assert ev.validate({'a': 'x', 'b': 'y'}) == []
        assert ev.validate({'a': 'x', 'b': None}) != []

    def test_xone_passes_exactly_one(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'info',
            'message': 'Exactly one', 'code': 'C',
            'xone': ['$a > 0', '$b > 0'],
        }])
        assert ev.validate({'a': 1, 'b': 0}) == []   # exactly one
        assert ev.validate({'a': 1, 'b': 1}) != []   # both pass → fail
        assert ev.validate({'a': 0, 'b': 0}) != []   # neither → fail

    def test_shape_uses_variable(self):
        """Shape constraint referencing @grandTotal via pre-computed variable."""
        ev = self._ev(
            shapes=[{
                'id': 'budgetMatch', 'target': 'budget.requestedAmount',
                'severity': 'error', 'message': 'Mismatch', 'code': 'BM',
                'constraint': 'abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1',
            }],
            variables=[
                {'name': 'totalDirect', 'expression': 'money(sum($budget.lineItems[*].amount), "USD")'},
                {'name': 'grandTotal',  'expression': '@totalDirect'},
            ]
        )
        data = {
            'budget': {
                'lineItems': [{'amount': 1000}, {'amount': 500}],
                'requestedAmount': {'amount': '1500', 'currency': 'USD'},
            }
        }
        assert ev.validate(data) == []  # amounts match

    def test_shape_variable_mismatch_emits_result(self):
        ev = self._ev(
            shapes=[{
                'id': 'budgetMatch', 'target': 'budget.requestedAmount',
                'severity': 'error', 'message': 'Mismatch', 'code': 'BM',
                'constraint': 'abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1',
            }],
            variables=[
                {'name': 'grandTotal', 'expression': 'money(sum($budget.lineItems[*].amount), "USD")'},
            ]
        )
        data = {
            'budget': {
                'lineItems': [{'amount': 1000}],
                'requestedAmount': {'amount': '999', 'currency': 'USD'},
            }
        }
        results = ev.validate(data)
        assert len(results) == 1
        assert results[0]['code'] == 'BM'
