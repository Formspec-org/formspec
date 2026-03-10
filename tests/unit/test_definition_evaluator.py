"""Tests for DefinitionEvaluator: 4-phase server-side form processor."""
import pytest
from formspec.evaluator import DefinitionEvaluator, ProcessingResult
from formspec.fel.types import to_python


# ── ProcessingResult + process() scaffold ────────────────────────────────────

class TestProcessingResult:
    def test_process_returns_processing_result(self):
        ev = DefinitionEvaluator({})
        result = ev.process({})
        assert isinstance(result, ProcessingResult)

    def test_processing_result_fields(self):
        ev = DefinitionEvaluator({})
        result = ev.process({})
        assert result.valid is True
        assert result.results == []
        assert isinstance(result.data, dict)
        assert isinstance(result.variables, dict)
        assert result.counts == {'error': 0, 'warning': 0, 'info': 0}

    def test_validate_wraps_process(self):
        """validate() returns just the results list from process()."""
        ev = DefinitionEvaluator({'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'constraint': '$x > 0',
        }]})
        results = ev.validate({'x': -1})
        assert len(results) == 1
        assert results[0]['code'] == 'F'

    def test_process_valid_false_on_error(self):
        ev = DefinitionEvaluator({'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'constraint': '$x > 0',
        }]})
        result = ev.process({'x': -1})
        assert result.valid is False
        assert result.counts['error'] == 1

    def test_process_valid_true_on_warning_only(self):
        ev = DefinitionEvaluator({'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'warning',
            'message': 'Warn', 'code': 'W',
            'constraint': '$x > 0',
        }]})
        result = ev.process({'x': -1})
        assert result.valid is True
        assert result.counts['warning'] == 1

    def test_process_returns_data_copy(self):
        ev = DefinitionEvaluator({})
        data = {'name': 'test'}
        result = ev.process(data)
        assert result.data == {'name': 'test'}
        assert result.data is not data  # must be a copy


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
        with pytest.raises(ValueError, match="Circular"):
            DefinitionEvaluator(defn)

    def test_process_populates_variables(self):
        defn = {
            'variables': [{'name': 'total', 'expression': 'sum($items[*].amount)'}]
        }
        ev = DefinitionEvaluator(defn)
        result = ev.process({'items': [{'amount': 100}, {'amount': 200}]})
        assert to_python(result.variables['total']) == pytest.approx(300)

    def test_scoped_variable_resolves_from_nearest_group_scope(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'rate', 'dataType': 'decimal'},
                {
                    'type': 'group', 'key': 'order',
                    'children': [
                        {'type': 'field', 'key': 'amount', 'dataType': 'decimal'},
                        {'type': 'field', 'key': 'tax', 'dataType': 'decimal'},
                    ],
                },
            ],
            'variables': [
                {'name': 'globalRate', 'expression': 'rate'},
                {'name': 'localTax', 'expression': 'amount * @globalRate', 'scope': 'order'},
            ],
            'binds': [
                {'path': 'order.tax', 'calculate': '@localTax'},
            ],
        })

        result = ev.process({'rate': 0.1, 'order': {'amount': 200, 'tax': None}})
        assert result.data['order']['tax'] == pytest.approx(20)

    def test_scoped_variable_is_not_visible_outside_its_scope(self):
        ev = DefinitionEvaluator({
            'items': [
                {
                    'type': 'group', 'key': 'order',
                    'children': [
                        {'type': 'field', 'key': 'amount', 'dataType': 'decimal'},
                        {'type': 'field', 'key': 'tax', 'dataType': 'decimal'},
                    ],
                },
                {'type': 'field', 'key': 'summaryTax', 'dataType': 'decimal'},
            ],
            'variables': [
                {'name': 'localTax', 'expression': 'amount * 0.1', 'scope': 'order'},
            ],
            'binds': [
                {'path': 'order.tax', 'calculate': '@localTax'},
                {'path': 'summaryTax', 'calculate': '@localTax'},
            ],
        })

        result = ev.process({'order': {'amount': 200, 'tax': None}, 'summaryTax': None})
        assert result.data['order']['tax'] == pytest.approx(20)
        assert result.data['summaryTax'] is None

    def test_scoped_variable_resolves_for_repeat_descendants(self):
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'items', 'repeatable': True,
                'children': [
                    {'type': 'field', 'key': 'amount', 'dataType': 'decimal'},
                    {'type': 'field', 'key': 'fee', 'dataType': 'decimal'},
                ],
            }],
            'variables': [
                {'name': 'rowRate', 'expression': '0.2', 'scope': 'items'},
            ],
            'binds': [
                {'path': 'items[*].fee', 'calculate': 'amount * @rowRate'},
            ],
        })

        result = ev.process({'items': [{'amount': 100, 'fee': None}, {'amount': 50, 'fee': None}]})
        assert result.data['items'][0]['fee'] == pytest.approx(20)
        assert result.data['items'][1]['fee'] == pytest.approx(10)


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
        assert ev.validate({'a': 1, 'b': 0}) == []
        assert ev.validate({'a': 1, 'b': 1}) != []
        assert ev.validate({'a': 0, 'b': 0}) != []

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
        assert ev.validate(data) == []

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

    def test_or_composition_with_shape_id_reference(self):
        """Composition element that is a shape id recurses into that shape."""
        ev = self._ev([
            {
                'id': 'hasEmail', 'target': '#', 'severity': 'error',
                'message': 'No email', 'code': 'E',
                'constraint': 'present($email)',
            },
            {
                'id': 'hasPhone', 'target': '#', 'severity': 'error',
                'message': 'No phone', 'code': 'P',
                'constraint': 'present($phone)',
            },
            {
                'id': 'contactProvided', 'target': '#', 'severity': 'warning',
                'message': 'Need one contact method', 'code': 'C',
                'or': ['hasEmail', 'hasPhone'],
            },
        ])
        results = ev.validate({'email': 'x@y.com', 'phone': None})
        assert not any(r['code'] == 'C' for r in results)
        results = ev.validate({'email': None, 'phone': None})
        assert any(r['code'] == 'C' for r in results)

    def test_not_composition(self):
        ev = self._ev([{
            'id': 's1', 'target': '#', 'severity': 'warning',
            'message': 'Contains placeholder', 'code': 'PH',
            'not': 'contains($text, "TBD")',
        }])
        assert ev.validate({'text': 'Real content'}) == []
        assert ev.validate({'text': 'Content TBD'}) != []

    def test_wildcard_target_shape_emits_concrete_repeat_path(self):
        ev = self._ev([{
            'id': 'nonNegativeRowAmount',
            'target': 'rows[*].amount',
            'severity': 'error',
            'message': 'Amount must be non-negative',
            'code': 'ROW_AMOUNT',
            'constraint': '$ >= 0',
        }])
        data = {'rows': [{'amount': 10}, {'amount': -5}]}
        results = ev.validate(data)
        assert len(results) == 1
        assert results[0]['code'] == 'ROW_AMOUNT'
        assert results[0]['path'] == 'rows[2].amount'

    def test_wildcard_target_shape_uses_row_scope_for_sibling_references(self):
        ev = self._ev([{
            'id': 'childAgeRule',
            'target': 'rows[*].age',
            'severity': 'error',
            'message': 'Child age invalid',
            'code': 'CHILD_AGE',
            'activeWhen': '$role = "child"',
            'constraint': '$ < 19 or ($ < 22 and $isStudent = true)',
        }])
        data = {
            'rows': [
                {'role': 'adult', 'age': 40, 'isStudent': False},
                {'role': 'child', 'age': 21, 'isStudent': False},
            ]
        }
        results = ev.validate(data)
        assert len(results) == 1
        assert results[0]['code'] == 'CHILD_AGE'
        assert results[0]['path'] == 'rows[2].age'


# ── Item registry + bind index ───────────────────────────────────────────────

class TestItemRegistry:
    def test_flat_fields(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
                {'type': 'field', 'key': 'age', 'dataType': 'integer'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        assert 'name' in ev._items
        assert ev._items['name'].data_type == 'string'
        assert 'age' in ev._items
        assert ev._items['age'].data_type == 'integer'

    def test_nested_group(self):
        defn = {
            'items': [{
                'type': 'group', 'key': 'address',
                'children': [
                    {'type': 'field', 'key': 'city', 'dataType': 'string'},
                    {'type': 'field', 'key': 'zip', 'dataType': 'string'},
                ]
            }]
        }
        ev = DefinitionEvaluator(defn)
        assert 'address' in ev._items
        assert ev._items['address'].item_type == 'group'
        assert 'address.city' in ev._items
        assert 'address.zip' in ev._items

    def test_repeatable_group(self):
        defn = {
            'items': [{
                'type': 'group', 'key': 'items', 'repeatable': True,
                'minRepeat': 1, 'maxRepeat': 10,
                'children': [
                    {'type': 'field', 'key': 'name', 'dataType': 'string'},
                ]
            }]
        }
        ev = DefinitionEvaluator(defn)
        info = ev._items['items']
        assert info.repeatable is True
        assert info.min_repeat == 1
        assert info.max_repeat == 10
        assert 'items.name' in ev._items

    def test_field_with_children(self):
        defn = {
            'items': [{
                'type': 'group', 'key': 'info',
                'children': [{
                    'type': 'field', 'key': 'orgType', 'dataType': 'choice',
                    'children': [
                        {'type': 'field', 'key': 'orgSubType', 'dataType': 'string'},
                    ]
                }]
            }]
        }
        ev = DefinitionEvaluator(defn)
        assert 'info.orgType' in ev._items
        assert 'info.orgType.orgSubType' in ev._items

    def test_display_item(self):
        defn = {
            'items': [
                {'type': 'display', 'key': 'hint', 'label': 'Some hint'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        assert 'hint' in ev._items
        assert ev._items['hint'].item_type == 'display'


class TestBindIndex:
    def test_single_bind(self):
        defn = {
            'binds': [
                {'path': 'name', 'required': 'true'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        assert 'name' in ev._binds
        assert ev._binds['name']['required'] == 'true'

    def test_merge_binds_for_same_path(self):
        defn = {
            'binds': [
                {'path': 'email', 'required': 'true'},
                {'path': 'email', 'constraint': 'matches($email, ".+@.+")'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        assert ev._binds['email']['required'] == 'true'
        assert 'constraint' in ev._binds['email']

    def test_wildcard_bind_path(self):
        defn = {
            'binds': [
                {'path': 'items[*].amount', 'required': 'true'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        assert 'items[*].amount' in ev._binds


# ── Repeat expansion ─────────────────────────────────────────────────────────

class TestRepeatExpansion:
    def test_flat_repeat(self):
        defn = {
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'children': [
                    {'type': 'field', 'key': 'value', 'dataType': 'integer'},
                ]
            }]
        }
        ev = DefinitionEvaluator(defn)
        data = {'rows': [{'value': 1}, {'value': 2}, {'value': 3}]}
        counts, paths = ev._expand_repeats(data)
        assert counts['rows'] == 3
        assert 'rows[1].value' in paths
        assert 'rows[2].value' in paths
        assert 'rows[3].value' in paths

    def test_nested_repeat(self):
        defn = {
            'items': [{
                'type': 'group', 'key': 'phases', 'repeatable': True,
                'children': [{
                    'type': 'group', 'key': 'tasks', 'repeatable': True,
                    'children': [
                        {'type': 'field', 'key': 'name', 'dataType': 'string'},
                    ]
                }]
            }]
        }
        ev = DefinitionEvaluator(defn)
        data = {
            'phases': [
                {'tasks': [{'name': 'a'}, {'name': 'b'}]},
                {'tasks': [{'name': 'c'}]},
            ]
        }
        counts, paths = ev._expand_repeats(data)
        assert counts['phases'] == 2
        assert 'phases[1].tasks[1].name' in paths
        assert 'phases[1].tasks[2].name' in paths
        assert 'phases[2].tasks[1].name' in paths

    def test_no_repeats(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ]
        }
        ev = DefinitionEvaluator(defn)
        counts, paths = ev._expand_repeats({'name': 'test'})
        assert counts == {}
        assert 'name' in paths


# ── Whitespace transforms ────────────────────────────────────────────────────

class TestWhitespace:
    def _make(self, whitespace_mode):
        return DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'val', 'dataType': 'string'}],
            'binds': [{'path': 'val', 'whitespace': whitespace_mode}],
        })

    def test_trim(self):
        ev = self._make('trim')
        result = ev.process({'val': '  hello world  '})
        assert result.data['val'] == 'hello world'

    def test_normalize(self):
        ev = self._make('normalize')
        result = ev.process({'val': '  hello   world  '})
        assert result.data['val'] == 'hello world'

    def test_remove(self):
        ev = self._make('remove')
        result = ev.process({'val': ' he llo '})
        assert result.data['val'] == 'hello'

    def test_preserve(self):
        ev = self._make('preserve')
        result = ev.process({'val': '  hello  '})
        assert result.data['val'] == '  hello  '

    def test_no_whitespace_bind(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'val', 'dataType': 'string'}],
        })
        result = ev.process({'val': '  hello  '})
        assert result.data['val'] == '  hello  '

    def test_non_string_value_unchanged(self):
        ev = self._make('trim')
        result = ev.process({'val': 42})
        assert result.data['val'] == 42


# ── Relevance evaluation ─────────────────────────────────────────────────────

class TestRelevance:
    def test_relevant_true(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'relevant': 'true'}],
        })
        result = ev.process({'name': 'test'})
        assert ev._eval_relevance(result.data, result.variables)['name'] is True

    def test_relevant_false(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        })
        relevance = ev._eval_relevance({'name': 'test', 'show': False}, {})
        assert relevance['name'] is False

    def test_and_inheritance(self):
        """Non-relevant parent → children also non-relevant."""
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'parent',
                'children': [
                    {'type': 'field', 'key': 'child', 'dataType': 'string'},
                ]
            }],
            'binds': [{'path': 'parent', 'relevant': 'false'}],
        })
        relevance = ev._eval_relevance({'parent': {'child': 'x'}}, {})
        assert relevance['parent'] is False
        assert relevance['parent.child'] is False

    def test_no_relevant_bind_defaults_true(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
        })
        relevance = ev._eval_relevance({'name': 'test'}, {})
        assert relevance['name'] is True


# ── Required + readonly evaluation ───────────────────────────────────────────

class TestRequired:
    def test_required_true(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': 'true'}],
        })
        required = ev._eval_required({'name': ''}, {})
        assert required['name'] is True

    def test_required_no_inheritance(self):
        """Required does NOT cascade to children."""
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'parent',
                'children': [
                    {'type': 'field', 'key': 'child', 'dataType': 'string'},
                ]
            }],
            'binds': [{'path': 'parent', 'required': 'true'}],
        })
        required = ev._eval_required({'parent': {'child': ''}}, {})
        assert required.get('parent.child', False) is False


class TestReadonly:
    def test_readonly_true(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'readonly': 'true'}],
        })
        readonly = ev._eval_readonly({'name': 'x'}, {})
        assert readonly['name'] is True

    def test_or_inheritance(self):
        """Readonly parent → children also readonly."""
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'parent',
                'children': [
                    {'type': 'field', 'key': 'child', 'dataType': 'string'},
                ]
            }],
            'binds': [{'path': 'parent', 'readonly': 'true'}],
        })
        readonly = ev._eval_readonly({'parent': {'child': 'x'}}, {})
        assert readonly['parent'] is True
        assert readonly['parent.child'] is True


# ── Calculate with repeat scoping ────────────────────────────────────────────

class TestCalculate:
    def test_simple_calculate(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'a', 'dataType': 'integer'},
                {'type': 'field', 'key': 'b', 'dataType': 'integer'},
                {'type': 'field', 'key': 'total', 'dataType': 'integer'},
            ],
            'binds': [{'path': 'total', 'calculate': '$a + $b'}],
        })
        result = ev.process({'a': 10, 'b': 20, 'total': 0})
        assert result.data['total'] == 30

    def test_repeat_scoped_calculate(self):
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'children': [
                    {'type': 'field', 'key': 'qty', 'dataType': 'integer'},
                    {'type': 'field', 'key': 'price', 'dataType': 'decimal'},
                    {'type': 'field', 'key': 'total', 'dataType': 'decimal'},
                ]
            }],
            'binds': [{'path': 'rows[*].total', 'calculate': '$qty * $price'}],
        })
        result = ev.process({
            'rows': [
                {'qty': 2, 'price': 10, 'total': 0},
                {'qty': 3, 'price': 5, 'total': 0},
            ]
        })
        assert result.data['rows'][0]['total'] == pytest.approx(20)
        assert result.data['rows'][1]['total'] == pytest.approx(15)

    def test_calculate_with_precision(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'val', 'dataType': 'decimal', 'precision': 2},
            ],
            'binds': [{'path': 'val', 'calculate': '10 / 3'}],
        })
        result = ev.process({'val': 0})
        assert result.data['val'] == pytest.approx(3.33, abs=0.005)


# ── Bind validation ──────────────────────────────────────────────────────────

class TestBindValidation:
    def test_required_empty_string_fails(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': 'true'}],
        })
        result = ev.process({'name': ''})
        errors = [r for r in result.results if r['code'] == 'REQUIRED']
        assert len(errors) == 1
        assert errors[0]['path'] == 'name'

    def test_required_null_fails(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': 'true'}],
        })
        result = ev.process({'name': None})
        errors = [r for r in result.results if r['code'] == 'REQUIRED']
        assert len(errors) == 1

    def test_required_with_value_passes(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': 'true'}],
        })
        result = ev.process({'name': 'Alice'})
        errors = [r for r in result.results if r['code'] == 'REQUIRED']
        assert len(errors) == 0

    def test_constraint_failing(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'age', 'dataType': 'integer'}],
            'binds': [{'path': 'age', 'constraint': '$age >= 18', 'constraintMessage': 'Must be 18+'}],
        })
        result = ev.process({'age': 15})
        errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(errors) == 1
        assert errors[0]['message'] == 'Must be 18+'

    def test_constraint_passing(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'age', 'dataType': 'integer'}],
            'binds': [{'path': 'age', 'constraint': '$age >= 18'}],
        })
        result = ev.process({'age': 21})
        errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(errors) == 0

    def test_non_relevant_fields_skip_validation(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [
                {'path': 'name', 'required': 'true', 'relevant': '$show'},
            ],
        })
        result = ev.process({'show': False, 'name': ''})
        errors = [r for r in result.results if r['code'] == 'REQUIRED']
        assert len(errors) == 0

    def test_bare_dollar_constraint_passes_positive(self):
        """Regression: bare $ in constraint must resolve to the field value, not FelNull."""
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'amount', 'dataType': 'integer'}],
            'binds': [{'path': 'amount', 'constraint': '$ >= 0'}],
        })
        result = ev.process({'amount': 45000})
        errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(errors) == 0

    def test_bare_dollar_constraint_fails_negative(self):
        """Regression: bare $ in constraint must detect actual violations."""
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'amount', 'dataType': 'integer'}],
            'binds': [{'path': 'amount', 'constraint': '$ >= 0'}],
        })
        result = ev.process({'amount': -5})
        errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(errors) == 1

    def test_bare_dollar_constraint_skipped_when_empty(self):
        """Constraint with bare $ is skipped when field is empty/null."""
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'amount', 'dataType': 'integer'}],
            'binds': [{'path': 'amount', 'constraint': '$ >= 0'}],
        })
        result = ev.process({'amount': None})
        errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(errors) == 0

    def test_bare_dollar_wildcard_constraint(self):
        """Regression: bare $ in wildcard bind constraints resolves to the row field value."""
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'children': [
                    {'type': 'field', 'key': 'amount', 'dataType': 'integer'},
                ]
            }],
            'binds': [{'path': 'rows[*].amount', 'constraint': '$ >= 0'}],
        })
        result = ev.process({'rows': [{'amount': 100}, {'amount': -1}]})
        errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(errors) == 1
        assert 'rows[2]' in errors[0]['path']

    def test_shape_bare_dollar_with_target(self):
        """Regression: shape constraint with target injects target value as bare $."""
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'score', 'dataType': 'integer'}],
            'shapes': [{
                'id': 'scoreRange', 'target': 'score', 'severity': 'error',
                'message': 'Score out of range', 'code': 'SCORE',
                'constraint': '$ >= 0 and $ <= 100',
            }],
        })
        assert ev.validate({'score': 50}) == []
        results = ev.validate({'score': 150})
        assert len(results) == 1
        assert results[0]['code'] == 'SCORE'

    def test_default_bind_relevance_with_numeric_constraint(self):
        """Regression: multiChoice → relevance + default=0 + constraint $ >= 0.

        When a field has default=0 (applied on re-relevance) and a constraint
        $ >= 0, the constraint must pass for the default value. Previously the
        evaluator passed raw Python int as $ without from_python() conversion,
        causing the constraint to always evaluate to FelNull.
        """
        ev = DefinitionEvaluator({
            'items': [
                {
                    'type': 'field', 'key': 'topics', 'dataType': 'multiChoice',
                    'options': [
                        {'value': 'employment', 'label': 'Employment'},
                        {'value': 'housing', 'label': 'Housing'},
                    ]
                },
                {
                    'type': 'group', 'key': 'expenditures',
                    'children': [
                        {'type': 'field', 'key': 'employment', 'dataType': 'decimal'},
                        {'type': 'field', 'key': 'housing', 'dataType': 'decimal'},
                    ]
                },
            ],
            'binds': [
                {
                    'path': 'expenditures.employment',
                    'relevant': "selected($topics, 'employment')",
                    'default': 0,
                    'constraint': '$ >= 0',
                    'constraintMessage': 'Cannot be negative',
                },
                {
                    'path': 'expenditures.housing',
                    'relevant': "selected($topics, 'housing')",
                    'default': 0,
                    'constraint': '$ >= 0',
                    'constraintMessage': 'Cannot be negative',
                },
            ],
        })
        # Scenario: employment selected with default value 0 → constraint passes
        result = ev.process({
            'topics': ['employment'],
            'expenditures': {'employment': 0, 'housing': 0},
        })
        constraint_errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(constraint_errors) == 0

        # Scenario: employment selected with positive value → constraint passes
        result = ev.process({
            'topics': ['employment'],
            'expenditures': {'employment': 45000, 'housing': 0},
        })
        constraint_errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(constraint_errors) == 0

        # Scenario: negative value → constraint fails
        result = ev.process({
            'topics': ['employment'],
            'expenditures': {'employment': -100, 'housing': 0},
        })
        constraint_errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert len(constraint_errors) == 1
        assert 'expenditures.employment' in constraint_errors[0]['path']

    def test_type_validation_string(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
        })
        result = ev.process({'name': 42})
        errors = [r for r in result.results if r['code'] == 'TYPE_ERROR']
        assert len(errors) == 1

    def test_type_validation_null_passes(self):
        """Null/empty always valid for type check."""
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
        })
        result = ev.process({'name': None})
        errors = [r for r in result.results if r['code'] == 'TYPE_ERROR']
        assert len(errors) == 0

    def test_constraint_null_in_bind_context_passes(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'amount', 'dataType': 'integer'}],
            'binds': [{'path': 'amount', 'constraint': '$missing > 0'}],
        })
        result = ev.process({'amount': 5})
        errors = [r for r in result.results if r['code'] == 'CONSTRAINT_FAILED']
        assert errors == []


class TestBindContextNullSemantics:
    def test_relevant_null_defaults_true(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'relevant': '$missing > 0'}],
        })
        relevance = ev._eval_relevance({'name': 'x'}, {})
        assert relevance['name'] is True

    def test_required_null_defaults_false(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': '$missing > 0'}],
        })
        required = ev._eval_required({'name': ''}, {})
        assert required['name'] is False

    def test_readonly_null_defaults_false(self):
        ev = DefinitionEvaluator({
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'readonly': '$missing > 0'}],
        })
        readonly = ev._eval_readonly({'name': 'x'}, {})
        assert readonly['name'] is False


# ── Cardinality validation ───────────────────────────────────────────────────

class TestCardinality:
    def test_min_repeat(self):
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'minRepeat': 2, 'maxRepeat': 5,
                'children': [
                    {'type': 'field', 'key': 'val', 'dataType': 'string'},
                ]
            }]
        })
        result = ev.process({'rows': [{'val': 'a'}]})
        errors = [r for r in result.results if r['code'] == 'MIN_REPEAT']
        assert len(errors) == 1

    def test_max_repeat(self):
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'minRepeat': 1, 'maxRepeat': 2,
                'children': [
                    {'type': 'field', 'key': 'val', 'dataType': 'string'},
                ]
            }]
        })
        result = ev.process({'rows': [{'val': 'a'}, {'val': 'b'}, {'val': 'c'}]})
        errors = [r for r in result.results if r['code'] == 'MAX_REPEAT']
        assert len(errors) == 1

    def test_cardinality_ok(self):
        ev = DefinitionEvaluator({
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'minRepeat': 1, 'maxRepeat': 3,
                'children': [
                    {'type': 'field', 'key': 'val', 'dataType': 'string'},
                ]
            }]
        })
        result = ev.process({'rows': [{'val': 'a'}, {'val': 'b'}]})
        errors = [r for r in result.results if r['code'] in ('MIN_REPEAT', 'MAX_REPEAT')]
        assert len(errors) == 0


# ── Shape timing ─────────────────────────────────────────────────────────────

class TestShapeTiming:
    def test_submit_shape_skipped_in_continuous(self):
        ev = DefinitionEvaluator({'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'constraint': '$x > 0',
            'timing': 'submit',
        }]})
        result = ev.process({'x': -1}, mode='continuous')
        assert len(result.results) == 0

    def test_submit_shape_included_in_submit(self):
        ev = DefinitionEvaluator({'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'constraint': '$x > 0',
            'timing': 'submit',
        }]})
        result = ev.process({'x': -1}, mode='submit')
        assert len(result.results) == 1

    def test_continuous_shape_always_included(self):
        ev = DefinitionEvaluator({'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'constraint': '$x > 0',
        }]})
        result = ev.process({'x': -1}, mode='continuous')
        assert len(result.results) == 1


# ── NonRelevantBehavior ──────────────────────────────────────────────────────

class TestNonRelevantBehavior:
    def test_remove_default(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        })
        result = ev.process({'show': False, 'name': 'hidden'})
        assert 'name' not in result.data

    def test_remove_explicit(self):
        ev = DefinitionEvaluator({
            'nonRelevantBehavior': 'remove',
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        })
        result = ev.process({'show': False, 'name': 'hidden'})
        assert 'name' not in result.data

    def test_empty_mode(self):
        ev = DefinitionEvaluator({
            'nonRelevantBehavior': 'empty',
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        })
        result = ev.process({'show': False, 'name': 'hidden'})
        assert result.data['name'] is None

    def test_keep_mode(self):
        ev = DefinitionEvaluator({
            'nonRelevantBehavior': 'keep',
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        })
        result = ev.process({'show': False, 'name': 'hidden'})
        assert result.data['name'] == 'hidden'

    def test_bind_level_override(self):
        ev = DefinitionEvaluator({
            'nonRelevantBehavior': 'remove',
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show', 'nonRelevantBehavior': 'keep'}],
        })
        result = ev.process({'show': False, 'name': 'kept'})
        assert result.data['name'] == 'kept'

    def test_relevant_field_unaffected(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        })
        result = ev.process({'show': True, 'name': 'visible'})
        assert result.data['name'] == 'visible'

    def test_wildcard_required_suppressed_for_nonrelevant_repeat_field(self):
        ev = DefinitionEvaluator({
            'items': [
                {
                    'type': 'group', 'key': 'rows', 'repeatable': True,
                    'children': [
                        {'type': 'field', 'key': 'enabled', 'dataType': 'boolean'},
                        {'type': 'field', 'key': 'note', 'dataType': 'string'},
                    ],
                }
            ],
            'binds': [
                {'path': 'rows[*].note', 'relevant': '$enabled'},
                {'path': 'rows[*].note', 'required': 'true'},
            ],
        })
        result = ev.process({'rows': [{'enabled': False, 'note': ''}]})
        required_errors = [r for r in result.results if r['code'] == 'REQUIRED']
        assert required_errors == []

    def test_shape_target_nonrelevant_field_emits_no_result(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'secret', 'dataType': 'string'},
            ],
            'binds': [
                {'path': 'secret', 'relevant': '$show'},
            ],
            'shapes': [{
                'id': 'secret-shape',
                'target': 'secret',
                'message': 'Secret must be present',
                'code': 'SECRET',
                'constraint': 'present($)',
            }],
        })
        result = ev.process({'show': False, 'secret': ''})
        assert [r for r in result.results if r['code'] == 'SECRET'] == []

    def test_excluded_value_null_hides_hidden_value_from_shapes_while_keep_preserves_output(self):
        ev = DefinitionEvaluator({
            'nonRelevantBehavior': 'keep',
            'items': [
                {'type': 'field', 'key': 'showSecret', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'secret', 'dataType': 'string'},
            ],
            'binds': [
                {
                    'path': 'secret',
                    'relevant': '$showSecret',
                    'excludedValue': 'null',
                    'nonRelevantBehavior': 'keep',
                },
            ],
            'shapes': [{
                'id': 'hidden-secret-visible-to-shape',
                'target': '#',
                'message': 'Hidden secret should not be visible to FEL',
                'code': 'HIDDEN_SECRET',
                'constraint': 'present($secret) = false',
            }],
        })
        result = ev.process({'showSecret': False, 'secret': 'retain-me'})
        assert [r for r in result.results if r['code'] == 'HIDDEN_SECRET'] == []
        assert result.data['secret'] == 'retain-me'


class TestCreationTimeInitializers:
    def test_initial_value_literal_applied_when_field_missing(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'status', 'dataType': 'string', 'initialValue': 'draft'},
            ],
        })
        result = ev.process({})
        assert result.data['status'] == 'draft'

    def test_prepopulate_reads_from_instance_when_field_missing(self):
        ev = DefinitionEvaluator({
            'instances': {
                'profile': {
                    'data': {
                        'email': 'person@example.org',
                    }
                }
            },
            'items': [
                {
                    'type': 'field',
                    'key': 'email',
                    'dataType': 'string',
                    'prePopulate': {'instance': 'profile', 'path': 'email', 'editable': False},
                },
            ],
        })
        result = ev.process({})
        assert result.data['email'] == 'person@example.org'


class TestDefaultRelevanceTransition:
    def test_default_applies_only_on_nonrelevant_to_relevant_transition_when_empty(self):
        ev = DefinitionEvaluator({
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'coupon', 'dataType': 'string'},
            ],
            'binds': [
                {'path': 'coupon', 'relevant': '$show', 'default': 'AUTO10'},
            ],
        })

        first = ev.process({'show': False, 'coupon': ''})
        assert 'coupon' not in first.data

        second = ev.process({'show': True, 'coupon': ''})
        assert second.data['coupon'] == 'AUTO10'

        third = ev.process({'show': False, 'coupon': 'MANUAL'})
        assert 'coupon' not in third.data

        fourth = ev.process({'show': True, 'coupon': 'MANUAL'})
        assert fourth.data['coupon'] == 'MANUAL'


# ── Integration: Grant Application ───────────────────────────────────────────

import json
from pathlib import Path

_GRANT_DEF_PATH = Path(__file__).resolve().parents[4] / 'examples' / 'grant-application' / 'definition.json'


def _load_grant_def():
    return json.loads(_GRANT_DEF_PATH.read_text())


def _valid_grant_data():
    """Minimal valid grant application data."""
    return {
        'applicantInfo': {
            'orgName': 'Test Nonprofit',
            'ein': '12-3456789',
            'orgType': 'nonprofit',
            'contactName': 'Jane Doe',
            'contactEmail': 'jane@example.com',
            'contactPhone': '(202) 555-0100',
        },
        'projectNarrative': {
            'projectTitle': 'Research Project',
            'abstract': 'A meaningful research project that addresses an important problem.',
            'startDate': '2026-06-01',
            'endDate': '2027-06-01',
            'indirectRate': 10,
            'focusAreas': ['health'],
        },
        'budget': {
            'lineItems': [
                {'category': 'personnel', 'description': 'Staff', 'quantity': 1, 'unitCost': 50000, 'subtotal': 0},
            ],
            'requestedAmount': {'amount': '55000', 'currency': 'USD'},
            'usesSubcontractors': False,
        },
        'projectPhases': [
            {
                'phaseName': 'Phase 1',
                'phaseTasks': [
                    {'taskName': 'Task 1', 'hours': 100, 'hourlyRate': {'amount': '50', 'currency': 'USD'}, 'taskCost': None},
                ],
            },
        ],
        'subcontractors': [],
        'attachments': {
            'narrativeDoc': {'url': 'https://example.com/doc.pdf', 'contentType': 'application/pdf', 'size': 1024},
        },
    }
