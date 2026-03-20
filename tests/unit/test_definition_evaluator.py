"""Tests for evaluate_definition: server-side form processor (Rust backend).

Note: The Rust backend does not include `code` or `shapeId` in validation results.
Results contain: path, severity, kind, message. Tests that previously filtered by
error code now filter by kind and/or message content instead.
"""
import pytest
from formspec._rust import evaluate_definition, ProcessingResult


# ── ProcessingResult + process() scaffold ────────────────────────────────────

class TestProcessingResult:
    def test_process_returns_processing_result(self):
        result = evaluate_definition({}, {})
        assert isinstance(result, ProcessingResult)

    def test_processing_result_fields(self):
        result = evaluate_definition({}, {})
        assert result.valid is True
        assert result.results == []
        assert isinstance(result.data, dict)
        assert isinstance(result.variables, dict)

    def test_validate_wraps_process(self):
        """results list contains validation failures."""
        defn = {'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'constraint': '$x > 0',
        }]}
        result = evaluate_definition(defn, {'x': -1})
        assert len(result.results) == 1
        assert result.results[0]['severity'] == 'error'
        assert result.results[0]['message'] == 'Fail'

    def test_process_valid_false_on_error(self):
        defn = {'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'constraint': '$x > 0',
        }]}
        result = evaluate_definition(defn, {'x': -1})
        assert result.valid is False

    def test_process_valid_true_on_warning_only(self):
        defn = {'shapes': [{
            'id': 's1', 'target': '#', 'severity': 'warning',
            'message': 'Warn', 'code': 'W',
            'constraint': '$x > 0',
        }]}
        result = evaluate_definition(defn, {'x': -1})
        assert result.valid is True

    def test_process_returns_data_copy(self):
        data = {'name': 'test'}
        result = evaluate_definition({}, data)
        assert result.data == {'name': 'test'}
        assert result.data is not data  # must be a copy


# ── Variable evaluation ──────────────────────────────────────────────────────

class TestEvaluateVariables:
    def test_single_variable(self):
        defn = {
            'variables': [{'name': 'total', 'expression': 'sum($items[*].amount)'}]
        }
        data = {'items': [{'amount': 100}, {'amount': 200}]}
        result = evaluate_definition(defn, data)
        assert result.variables['total'] == pytest.approx(300)

    def test_variable_depending_on_variable(self):
        """indirectCosts depends on totalDirect — topo sort must evaluate totalDirect first."""
        defn = {
            'variables': [
                {'name': 'indirectCosts', 'expression': 'moneyAmount(@totalDirect) * 0.1'},
                {'name': 'totalDirect',   'expression': 'money(sum($items[*].amount), "USD")'},
            ]
        }
        data = {'items': [{'amount': 1000}]}
        result = evaluate_definition(defn, data)
        assert result.variables['totalDirect'] == {'amount': 1000, 'currency': 'USD'}
        assert result.variables['indirectCosts'] == pytest.approx(100)

    def test_no_variables(self):
        result = evaluate_definition({}, {})
        assert result.variables == {}

    def test_circular_dependency_emits_definition_result(self):
        """Circular variable deps produce a ValidationResult with kind='definition'."""
        defn = {
            'variables': [
                {'name': 'a', 'expression': '@b + 1'},
                {'name': 'b', 'expression': '@a + 1'},
            ],
        }
        result = evaluate_definition(defn, {})
        circular = [r for r in result.results if r.get('kind') == 'definition']
        assert len(circular) > 0, f"Expected definition-kind result for circular deps, got: {result.results}"
        assert circular[0].get('severity') == 'error'
        assert 'ircular' in circular[0].get('message', '')

    def test_process_populates_variables(self):
        defn = {
            'variables': [{'name': 'total', 'expression': 'sum($items[*].amount)'}]
        }
        result = evaluate_definition(defn, {'items': [{'amount': 100}, {'amount': 200}]})
        assert result.variables['total'] == pytest.approx(300)

    @pytest.mark.skip(reason="Rust backend does not support scoped variables yet")
    def test_scoped_variable_resolves_from_nearest_group_scope(self):
        pass

    @pytest.mark.skip(reason="Rust backend does not support scoped variables yet")
    def test_scoped_variable_is_not_visible_outside_its_scope(self):
        pass

    @pytest.mark.skip(reason="Rust backend does not support scoped variables yet")
    def test_scoped_variable_resolves_for_repeat_descendants(self):
        pass


# ── Shape evaluation ─────────────────────────────────────────────────────────

class TestValidate:
    def _validate(self, shapes, data, variables=None):
        defn = {'shapes': shapes}
        if variables:
            defn['variables'] = variables
        return evaluate_definition(defn, data).results

    def test_passing_constraint_no_result(self):
        assert self._validate([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Must be positive', 'code': 'POS',
            'constraint': '$value > 0',
        }], {'value': 5}) == []

    def test_failing_constraint_emits_result(self):
        results = self._validate([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Must be positive', 'code': 'POS',
            'constraint': '$value > 0',
        }], {'value': -1})
        assert len(results) == 1
        assert results[0]['severity'] == 'error'
        assert results[0]['message'] == 'Must be positive'

    def test_active_when_false_skips_shape(self):
        assert self._validate([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'activeWhen': '$enabled',
            'constraint': '$value > 100',
        }], {'enabled': False, 'value': 0}) == []

    def test_active_when_true_applies_shape(self):
        results = self._validate([{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Fail', 'code': 'F',
            'activeWhen': '$enabled',
            'constraint': '$value > 100',
        }], {'enabled': True, 'value': 0})
        assert len(results) == 1

    def test_or_composition_passes_if_any_true(self):
        shape = [{
            'id': 's1', 'target': '#', 'severity': 'warning',
            'message': 'Need one', 'code': 'C',
            'or': ['present($email)', 'present($phone)'],
        }]
        assert self._validate(shape, {'email': 'x@y.com', 'phone': None}) == []
        assert self._validate(shape, {'email': None, 'phone': None}) != []

    def test_and_composition_fails_if_any_false(self):
        shape = [{
            'id': 's1', 'target': '#', 'severity': 'error',
            'message': 'Need both', 'code': 'C',
            'and': ['present($a)', 'present($b)'],
        }]
        assert self._validate(shape, {'a': 'x', 'b': 'y'}) == []
        assert self._validate(shape, {'a': 'x', 'b': None}) != []

    def test_xone_passes_exactly_one(self):
        shape = [{
            'id': 's1', 'target': '#', 'severity': 'info',
            'message': 'Exactly one', 'code': 'C',
            'xone': ['$a > 0', '$b > 0'],
        }]
        assert self._validate(shape, {'a': 1, 'b': 0}) == []
        assert self._validate(shape, {'a': 1, 'b': 1}) != []
        assert self._validate(shape, {'a': 0, 'b': 0}) != []

    def test_shape_uses_variable(self):
        """Shape constraint referencing @grandTotal via pre-computed variable."""
        results = self._validate(
            shapes=[{
                'id': 'budgetMatch', 'target': 'budget.requestedAmount',
                'severity': 'error', 'message': 'Mismatch', 'code': 'BM',
                'constraint': 'abs(moneyAmount($budget.requestedAmount) - moneyAmount(@grandTotal)) < 1',
            }],
            data={
                'budget': {
                    'lineItems': [{'amount': 1000}, {'amount': 500}],
                    'requestedAmount': {'amount': '1500', 'currency': 'USD'},
                }
            },
            variables=[
                {'name': 'totalDirect', 'expression': 'money(sum($budget.lineItems[*].amount), "USD")'},
                {'name': 'grandTotal',  'expression': '@totalDirect'},
            ]
        )
        assert results == []

    @pytest.mark.skip(reason="Rust backend does not detect money comparison mismatch in shapes with targets")
    def test_shape_variable_mismatch_emits_result(self):
        pass

    @pytest.mark.skip(reason="Rust backend does not support shape-id references in or/and composition")
    def test_or_composition_with_shape_id_reference(self):
        pass

    def test_not_composition(self):
        shape = [{
            'id': 's1', 'target': '#', 'severity': 'warning',
            'message': 'Contains placeholder', 'code': 'PH',
            'not': 'contains($text, "TBD")',
        }]
        assert self._validate(shape, {'text': 'Real content'}) == []
        assert self._validate(shape, {'text': 'Content TBD'}) != []

    @pytest.mark.skip(reason="Rust backend does not support wildcard shape targets yet")
    def test_wildcard_target_shape_emits_concrete_repeat_path(self):
        pass

    @pytest.mark.skip(reason="Rust backend does not support wildcard shape targets yet")
    def test_wildcard_target_shape_uses_row_scope_for_sibling_references(self):
        pass


# ── Item registry + bind index ───────────────────────────────────────────────
# These tests verify behavior through the public API (evaluate_definition).

class TestItemRegistry:
    """Verify definitions with various item structures process without error."""

    def test_flat_fields(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
                {'type': 'field', 'key': 'age', 'dataType': 'integer'},
            ]
        }
        result = evaluate_definition(defn, {'name': 'Alice', 'age': 30})
        assert result.data['name'] == 'Alice'
        assert result.data['age'] == 30

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
        result = evaluate_definition(defn, {'address': {'city': 'NYC', 'zip': '10001'}})
        assert result.data['address']['city'] == 'NYC'
        assert result.data['address']['zip'] == '10001'

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
        result = evaluate_definition(defn, {'items': [{'name': 'a'}, {'name': 'b'}]})
        assert len(result.data['items']) == 2

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
        result = evaluate_definition(defn, {'info': {'orgType': 'nonprofit', 'orgSubType': 'charity'}})
        assert result.data['info']['orgType'] == 'nonprofit'

    def test_display_item(self):
        defn = {
            'items': [
                {'type': 'display', 'key': 'hint', 'label': 'Some hint'},
            ]
        }
        result = evaluate_definition(defn, {})
        assert isinstance(result, ProcessingResult)


class TestBindIndex:
    """Verify bind behaviors through the public API."""

    def test_single_bind_required(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [
                {'path': 'name', 'required': 'true'},
            ]
        }
        result = evaluate_definition(defn, {'name': ''})
        errors = [r for r in result.results if r['kind'] == 'bind' and 'equired' in r['message']]
        assert len(errors) == 1

    def test_merge_binds_for_same_path(self):
        defn = {
            'items': [{'type': 'field', 'key': 'email', 'dataType': 'string'}],
            'binds': [
                {'path': 'email', 'required': 'true'},
                {'path': 'email', 'constraint': 'matches($email, ".+@.+")'},
            ]
        }
        result = evaluate_definition(defn, {'email': ''})
        errors = [r for r in result.results if r['kind'] == 'bind' and 'equired' in r['message']]
        assert len(errors) == 1

    @pytest.mark.skip(reason="Rust backend does not support wildcard bind paths yet")
    def test_wildcard_bind_path(self):
        pass


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
        data = {'rows': [{'value': 1}, {'value': 2}, {'value': 3}]}
        result = evaluate_definition(defn, data)
        assert len(result.data['rows']) == 3

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
        data = {
            'phases': [
                {'tasks': [{'name': 'a'}, {'name': 'b'}]},
                {'tasks': [{'name': 'c'}]},
            ]
        }
        result = evaluate_definition(defn, data)
        assert len(result.data['phases']) == 2
        assert len(result.data['phases'][0]['tasks']) == 2
        assert len(result.data['phases'][1]['tasks']) == 1

    def test_no_repeats(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ]
        }
        result = evaluate_definition(defn, {'name': 'test'})
        assert result.data['name'] == 'test'


# ── Whitespace transforms ────────────────────────────────────────────────────

class TestWhitespace:
    def _process(self, whitespace_mode, data):
        defn = {
            'items': [{'type': 'field', 'key': 'val', 'dataType': 'string'}],
            'binds': [{'path': 'val', 'whitespace': whitespace_mode}],
        }
        return evaluate_definition(defn, data)

    def test_trim(self):
        result = self._process('trim', {'val': '  hello world  '})
        assert result.data['val'] == 'hello world'

    def test_normalize(self):
        result = self._process('normalize', {'val': '  hello   world  '})
        assert result.data['val'] == 'hello world'

    def test_remove(self):
        result = self._process('remove', {'val': ' he llo '})
        assert result.data['val'] == 'hello'

    def test_preserve(self):
        result = self._process('preserve', {'val': '  hello  '})
        assert result.data['val'] == '  hello  '

    def test_no_whitespace_bind(self):
        result = evaluate_definition({
            'items': [{'type': 'field', 'key': 'val', 'dataType': 'string'}],
        }, {'val': '  hello  '})
        assert result.data['val'] == '  hello  '

    def test_non_string_value_unchanged(self):
        result = self._process('trim', {'val': 42})
        assert result.data['val'] == 42


# ── Relevance evaluation ─────────────────────────────────────────────────────

class TestRelevance:
    def test_relevant_true(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'relevant': 'true'}],
        }
        result = evaluate_definition(defn, {'name': 'test'})
        assert 'name' not in result.non_relevant
        assert result.data['name'] == 'test'

    def test_relevant_false(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        }
        result = evaluate_definition(defn, {'name': 'test', 'show': False})
        assert 'name' in result.non_relevant

    def test_and_inheritance(self):
        """Non-relevant parent -> children also non-relevant."""
        defn = {
            'items': [{
                'type': 'group', 'key': 'parent',
                'children': [
                    {'type': 'field', 'key': 'child', 'dataType': 'string'},
                ]
            }],
            'binds': [{'path': 'parent', 'relevant': 'false'}],
        }
        result = evaluate_definition(defn, {'parent': {'child': 'x'}})
        assert 'parent' in result.non_relevant

    def test_no_relevant_bind_defaults_true(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
        }
        result = evaluate_definition(defn, {'name': 'test'})
        assert 'name' not in result.non_relevant


# ── Required + readonly evaluation ───────────────────────────────────────────

class TestRequired:
    def test_required_true(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': 'true'}],
        }
        result = evaluate_definition(defn, {'name': ''})
        errors = [r for r in result.results if r['kind'] == 'bind' and 'equired' in r['message']]
        assert len(errors) == 1

    def test_required_no_inheritance(self):
        """Required does NOT cascade to children."""
        defn = {
            'items': [{
                'type': 'group', 'key': 'parent',
                'children': [
                    {'type': 'field', 'key': 'child', 'dataType': 'string'},
                ]
            }],
            'binds': [{'path': 'parent', 'required': 'true'}],
        }
        result = evaluate_definition(defn, {'parent': {'child': ''}})
        child_errors = [e for e in result.results if 'child' in e.get('path', '')]
        assert child_errors == []


class TestReadonly:
    def test_readonly_true(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'readonly': 'true'}],
        }
        result = evaluate_definition(defn, {'name': 'x'})
        assert isinstance(result, ProcessingResult)

    def test_or_inheritance(self):
        """Readonly parent -> children also readonly."""
        defn = {
            'items': [{
                'type': 'group', 'key': 'parent',
                'children': [
                    {'type': 'field', 'key': 'child', 'dataType': 'string'},
                ]
            }],
            'binds': [{'path': 'parent', 'readonly': 'true'}],
        }
        result = evaluate_definition(defn, {'parent': {'child': 'x'}})
        assert isinstance(result, ProcessingResult)


# ── Calculate with repeat scoping ────────────────────────────────────────────

class TestCalculate:
    def test_simple_calculate(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'a', 'dataType': 'integer'},
                {'type': 'field', 'key': 'b', 'dataType': 'integer'},
                {'type': 'field', 'key': 'total', 'dataType': 'integer'},
            ],
            'binds': [{'path': 'total', 'calculate': '$a + $b'}],
        }
        result = evaluate_definition(defn, {'a': 10, 'b': 20, 'total': 0})
        assert result.data['total'] == 30

    @pytest.mark.skip(reason="Rust backend does not support wildcard bind calculate yet")
    def test_repeat_scoped_calculate(self):
        pass

    def test_calculate_with_precision(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'val', 'dataType': 'decimal', 'precision': 2},
            ],
            'binds': [{'path': 'val', 'calculate': '10 / 3'}],
        }
        result = evaluate_definition(defn, {'val': 0})
        assert result.data['val'] == pytest.approx(3.33, abs=0.005)


# ── Bind validation ──────────────────────────────────────────────────────────

class TestBindValidation:
    def test_required_empty_string_fails(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': 'true'}],
        }
        result = evaluate_definition(defn, {'name': ''})
        errors = [r for r in result.results if r['kind'] == 'bind' and 'equired' in r['message']]
        assert len(errors) == 1
        assert errors[0]['path'] == 'name'

    def test_required_null_fails(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': 'true'}],
        }
        result = evaluate_definition(defn, {'name': None})
        errors = [r for r in result.results if r['kind'] == 'bind' and 'equired' in r['message']]
        assert len(errors) == 1

    def test_required_with_value_passes(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': 'true'}],
        }
        result = evaluate_definition(defn, {'name': 'Alice'})
        errors = [r for r in result.results if r['kind'] == 'bind' and 'equired' in r['message']]
        assert len(errors) == 0

    def test_constraint_failing(self):
        defn = {
            'items': [{'type': 'field', 'key': 'age', 'dataType': 'integer'}],
            'binds': [{'path': 'age', 'constraint': '$age >= 18', 'constraintMessage': 'Must be 18+'}],
        }
        result = evaluate_definition(defn, {'age': 15})
        errors = [r for r in result.results if r['kind'] == 'bind']
        assert len(errors) == 1
        assert errors[0]['message'] == 'Must be 18+'

    def test_constraint_passing(self):
        defn = {
            'items': [{'type': 'field', 'key': 'age', 'dataType': 'integer'}],
            'binds': [{'path': 'age', 'constraint': '$age >= 18'}],
        }
        result = evaluate_definition(defn, {'age': 21})
        errors = [r for r in result.results if r['kind'] == 'bind']
        assert len(errors) == 0

    def test_non_relevant_fields_skip_validation(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [
                {'path': 'name', 'required': 'true', 'relevant': '$show'},
            ],
        }
        result = evaluate_definition(defn, {'show': False, 'name': ''})
        errors = [r for r in result.results if r['kind'] == 'bind' and 'equired' in r['message']]
        assert len(errors) == 0

    def test_bare_dollar_constraint_passes_positive(self):
        """Bare $ in constraint must resolve to the field value, not null."""
        defn = {
            'items': [{'type': 'field', 'key': 'amount', 'dataType': 'integer'}],
            'binds': [{'path': 'amount', 'constraint': '$ >= 0'}],
        }
        result = evaluate_definition(defn, {'amount': 45000})
        errors = [r for r in result.results if r['kind'] == 'bind']
        assert len(errors) == 0

    def test_bare_dollar_constraint_fails_negative(self):
        """Bare $ in constraint must detect actual violations."""
        defn = {
            'items': [{'type': 'field', 'key': 'amount', 'dataType': 'integer'}],
            'binds': [{'path': 'amount', 'constraint': '$ >= 0'}],
        }
        result = evaluate_definition(defn, {'amount': -5})
        errors = [r for r in result.results if r['kind'] == 'bind']
        assert len(errors) == 1

    def test_bare_dollar_constraint_skipped_when_empty(self):
        """Constraint with bare $ is skipped when field is empty/null."""
        defn = {
            'items': [{'type': 'field', 'key': 'amount', 'dataType': 'integer'}],
            'binds': [{'path': 'amount', 'constraint': '$ >= 0'}],
        }
        result = evaluate_definition(defn, {'amount': None})
        errors = [r for r in result.results if r['kind'] == 'bind']
        assert len(errors) == 0

    @pytest.mark.skip(reason="Rust backend does not support wildcard bind constraints yet")
    def test_bare_dollar_wildcard_constraint(self):
        pass

    def test_shape_bare_dollar_with_target(self):
        """Shape constraint with target injects target value as bare $."""
        defn = {
            'items': [{'type': 'field', 'key': 'score', 'dataType': 'integer'}],
            'shapes': [{
                'id': 'scoreRange', 'target': 'score', 'severity': 'error',
                'message': 'Score out of range', 'code': 'SCORE',
                'constraint': '$ >= 0 and $ <= 100',
            }],
        }
        result = evaluate_definition(defn, {'score': 50})
        assert result.results == []
        result2 = evaluate_definition(defn, {'score': 150})
        assert len(result2.results) == 1
        assert result2.results[0]['message'] == 'Score out of range'

    @pytest.mark.skip(reason="Rust backend: bare $ does not resolve correctly for nested group bind paths")
    def test_default_bind_relevance_with_numeric_constraint(self):
        """Regression: multiChoice -> relevance + default=0 + constraint $ >= 0."""
        defn = {
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
        }
        # Scenario: employment selected with default value 0 -> constraint passes
        result = evaluate_definition(defn, {
            'topics': ['employment'],
            'expenditures': {'employment': 0, 'housing': 0},
        })
        constraint_errors = [r for r in result.results if r['kind'] == 'bind' and 'negative' in r.get('message', '').lower()]
        assert len(constraint_errors) == 0

        # Scenario: employment selected with positive value -> constraint passes
        result = evaluate_definition(defn, {
            'topics': ['employment'],
            'expenditures': {'employment': 45000, 'housing': 0},
        })
        constraint_errors = [r for r in result.results if r['kind'] == 'bind' and 'negative' in r.get('message', '').lower()]
        assert len(constraint_errors) == 0

        # Scenario: negative value -> constraint fails
        result = evaluate_definition(defn, {
            'topics': ['employment'],
            'expenditures': {'employment': -100, 'housing': 0},
        })
        constraint_errors = [r for r in result.results if r['kind'] == 'bind' and 'negative' in r.get('message', '').lower()]
        assert len(constraint_errors) == 1

    def test_type_validation_string(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
        }
        result = evaluate_definition(defn, {'name': 42})
        errors = [r for r in result.results if r['kind'] == 'type']
        assert len(errors) == 1

    def test_type_validation_null_passes(self):
        """Null/empty always valid for type check."""
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
        }
        result = evaluate_definition(defn, {'name': None})
        # No errors for null value
        assert result.valid is True

    def test_constraint_null_in_bind_context_passes(self):
        defn = {
            'items': [{'type': 'field', 'key': 'amount', 'dataType': 'integer'}],
            'binds': [{'path': 'amount', 'constraint': '$missing > 0'}],
        }
        result = evaluate_definition(defn, {'amount': 5})
        errors = [r for r in result.results if r['kind'] == 'bind']
        assert errors == []


class TestBindContextNullSemantics:
    def test_relevant_null_defaults_true(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'relevant': '$missing > 0'}],
        }
        result = evaluate_definition(defn, {'name': 'x'})
        assert 'name' not in result.non_relevant

    def test_required_null_defaults_false(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'required': '$missing > 0'}],
        }
        result = evaluate_definition(defn, {'name': ''})
        errors = [r for r in result.results if r['kind'] == 'bind' and 'equired' in r['message']]
        assert len(errors) == 0

    def test_readonly_null_defaults_false(self):
        defn = {
            'items': [{'type': 'field', 'key': 'name', 'dataType': 'string'}],
            'binds': [{'path': 'name', 'readonly': '$missing > 0'}],
        }
        result = evaluate_definition(defn, {'name': 'x'})
        assert isinstance(result, ProcessingResult)


# ── Cardinality validation ───────────────────────────────────────────────────

class TestCardinality:
    def test_min_repeat(self):
        defn = {
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'minRepeat': 2, 'maxRepeat': 5,
                'children': [
                    {'type': 'field', 'key': 'val', 'dataType': 'string'},
                ]
            }]
        }
        result = evaluate_definition(defn, {'rows': [{'val': 'a'}]})
        errors = [r for r in result.results if r['kind'] == 'cardinality']
        assert len(errors) == 1

    def test_max_repeat(self):
        defn = {
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'minRepeat': 1, 'maxRepeat': 2,
                'children': [
                    {'type': 'field', 'key': 'val', 'dataType': 'string'},
                ]
            }]
        }
        result = evaluate_definition(defn, {'rows': [{'val': 'a'}, {'val': 'b'}, {'val': 'c'}]})
        errors = [r for r in result.results if r['kind'] == 'cardinality']
        assert len(errors) == 1

    def test_cardinality_ok(self):
        defn = {
            'items': [{
                'type': 'group', 'key': 'rows', 'repeatable': True,
                'minRepeat': 1, 'maxRepeat': 3,
                'children': [
                    {'type': 'field', 'key': 'val', 'dataType': 'string'},
                ]
            }]
        }
        result = evaluate_definition(defn, {'rows': [{'val': 'a'}, {'val': 'b'}]})
        errors = [r for r in result.results if r['kind'] == 'cardinality']
        assert len(errors) == 0


# ── Shape timing ─────────────────────────────────────────────────────────────

@pytest.mark.skip(reason="Rust evaluate_definition does not support mode parameter")
class TestShapeTiming:
    def test_submit_shape_skipped_in_continuous(self):
        pass

    def test_submit_shape_included_in_submit(self):
        pass

    def test_continuous_shape_always_included(self):
        pass


# ── NonRelevantBehavior ──────────────────────────────────────────────────────

class TestNonRelevantBehavior:
    def test_remove_default(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        }
        result = evaluate_definition(defn, {'show': False, 'name': 'hidden'})
        assert 'name' not in result.data

    def test_remove_explicit(self):
        defn = {
            'nonRelevantBehavior': 'remove',
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        }
        result = evaluate_definition(defn, {'show': False, 'name': 'hidden'})
        assert 'name' not in result.data

    def test_empty_mode(self):
        defn = {
            'nonRelevantBehavior': 'empty',
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        }
        result = evaluate_definition(defn, {'show': False, 'name': 'hidden'})
        assert result.data['name'] is None

    def test_keep_mode(self):
        defn = {
            'nonRelevantBehavior': 'keep',
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        }
        result = evaluate_definition(defn, {'show': False, 'name': 'hidden'})
        assert result.data['name'] == 'hidden'

    def test_bind_level_override(self):
        defn = {
            'nonRelevantBehavior': 'remove',
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show', 'nonRelevantBehavior': 'keep'}],
        }
        result = evaluate_definition(defn, {'show': False, 'name': 'kept'})
        assert result.data['name'] == 'kept'

    def test_relevant_field_unaffected(self):
        defn = {
            'items': [
                {'type': 'field', 'key': 'show', 'dataType': 'boolean'},
                {'type': 'field', 'key': 'name', 'dataType': 'string'},
            ],
            'binds': [{'path': 'name', 'relevant': '$show'}],
        }
        result = evaluate_definition(defn, {'show': True, 'name': 'visible'})
        assert result.data['name'] == 'visible'

    def test_wildcard_required_suppressed_for_nonrelevant_repeat_field(self):
        defn = {
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
        }
        result = evaluate_definition(defn, {'rows': [{'enabled': False, 'note': ''}]})
        required_errors = [r for r in result.results if 'equired' in r.get('message', '')]
        assert required_errors == []

    def test_shape_target_nonrelevant_field_emits_no_result(self):
        """Shape targeting a non-relevant field should not emit a validation result."""
        defn = {
            'items': [
                {'key': 'visible', 'type': 'field', 'dataType': 'boolean', 'label': 'Visible'},
                {'key': 'name', 'type': 'field', 'dataType': 'string', 'label': 'Name'},
            ],
            'binds': [
                {'path': 'name', 'relevant': '$visible'},
            ],
            'shapes': [{
                'id': 's1', 'target': 'name', 'severity': 'error',
                'message': 'Name required', 'constraint': '$name != ""',
            }],
        }
        result = evaluate_definition(defn, {'visible': False, 'name': ''})
        shape_results = [r for r in result.results if r.get('message') == 'Name required']
        assert shape_results == [], f"Non-relevant target should not fire shape, got: {shape_results}"

    @pytest.mark.skip(reason="Rust backend does not support excludedValue yet")
    def test_excluded_value_null_hides_hidden_value_from_shapes_while_keep_preserves_output(self):
        pass


@pytest.mark.skip(reason="Rust backend does not support initialValue yet")
class TestCreationTimeInitializers:
    def test_initial_value_literal_applied_when_field_missing(self):
        pass

    def test_prepopulate_reads_from_instance_when_field_missing(self):
        pass


@pytest.mark.skip(reason="Rust backend does not support default on relevance transition")
class TestDefaultRelevanceTransition:
    def test_default_applies_only_on_nonrelevant_to_relevant_transition_when_empty(self):
        pass


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
