"""Tests for the Mapping DSL execution engine (Phase 10).

Tests cover: all 10 transform types, condition guards, bidirectional mapping,
priority ordering, array descriptors, path resolution, autoMap, defaults,
and custom adapter registration.
"""

import pytest
from formspec.mapping import MappingEngine
from formspec.adapters import get_adapter, register_adapter, Adapter, _custom_adapters


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_doc(rules, **kwargs):
    """Build a minimal mapping document."""
    doc = {
        'version': '1.0.0',
        'definitionRef': 'https://example.com/form',
        'definitionVersion': '>=1.0.0',
        'targetSchema': {'format': 'json'},
        'rules': rules,
    }
    doc.update(kwargs)
    return doc


# ===========================================================================
# Transform: preserve
# ===========================================================================

class TestPreserve:
    def test_basic_copy(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'name', 'targetPath': 'fullName', 'transform': 'preserve'},
        ]))
        result = engine.forward({'name': 'Alice'})
        assert result['fullName'] == 'Alice'

    def test_nested_paths(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'address.city', 'targetPath': 'location.city', 'transform': 'preserve'},
        ]))
        result = engine.forward({'address': {'city': 'Portland'}})
        assert result['location']['city'] == 'Portland'

    def test_missing_source_returns_none(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'missing', 'targetPath': 'out', 'transform': 'preserve'},
        ]))
        result = engine.forward({'other': 'val'})
        assert result['out'] is None

    def test_default_on_missing(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'missing', 'targetPath': 'out', 'transform': 'preserve', 'default': 'fallback'},
        ]))
        result = engine.forward({})
        assert result['out'] == 'fallback'


# ===========================================================================
# Transform: drop
# ===========================================================================

class TestDrop:
    def test_field_not_in_output(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'secret', 'targetPath': 'secret', 'transform': 'drop'},
            {'sourcePath': 'name', 'targetPath': 'name', 'transform': 'preserve'},
        ]))
        result = engine.forward({'secret': 'hunter2', 'name': 'Bob'})
        assert 'secret' not in result
        assert result['name'] == 'Bob'


# ===========================================================================
# Transform: expression
# ===========================================================================

class TestExpression:
    def test_simple_expression(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'price',
                'targetPath': 'priceWithTax',
                'transform': 'expression',
                'expression': '$ * 1.1',
            },
        ]))
        result = engine.forward({'price': 100})
        assert abs(result['priceWithTax'] - 110) < 0.01

    def test_expression_with_source_ref(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'first',
                'targetPath': 'full',
                'transform': 'expression',
                'expression': 'source.first & " " & source.last',
            },
        ]))
        result = engine.forward({'first': 'John', 'last': 'Doe'})
        assert result['full'] == 'John Doe'


# ===========================================================================
# Transform: constant
# ===========================================================================

class TestConstant:
    def test_static_value(self):
        engine = MappingEngine(_make_doc([
            {
                'targetPath': 'type',
                'transform': 'constant',
                'expression': '"patient"',
            },
        ]))
        result = engine.forward({})
        assert result['type'] == 'patient'

    def test_computed_constant(self):
        engine = MappingEngine(_make_doc([
            {
                'targetPath': 'version',
                'transform': 'constant',
                'expression': '1 + 2',
            },
        ]))
        result = engine.forward({})
        # FEL returns Decimal, to_python converts to Decimal
        assert float(result['version']) == 3


# ===========================================================================
# Transform: coerce
# ===========================================================================

class TestCoerce:
    def test_string_to_integer(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'age',
                'targetPath': 'age',
                'transform': 'coerce',
                'coerce': 'integer',
            },
        ]))
        result = engine.forward({'age': '25'})
        assert result['age'] == 25

    def test_number_to_string(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'code',
                'targetPath': 'code',
                'transform': 'coerce',
                'coerce': {'from': 'number', 'to': 'string'},
            },
        ]))
        result = engine.forward({'code': 42})
        assert result['code'] == '42'

    def test_string_to_boolean(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'active',
                'targetPath': 'active',
                'transform': 'coerce',
                'coerce': 'boolean',
            },
        ]))
        assert engine.forward({'active': 'true'})['active'] is True
        assert engine.forward({'active': 'false'})['active'] is False

    def test_value_to_array(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'tag',
                'targetPath': 'tags',
                'transform': 'coerce',
                'coerce': 'array',
            },
        ]))
        result = engine.forward({'tag': 'urgent'})
        assert result['tags'] == ['urgent']

    def test_none_uses_default(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'missing',
                'targetPath': 'val',
                'transform': 'coerce',
                'coerce': 'string',
                'default': 'N/A',
            },
        ]))
        result = engine.forward({})
        assert result['val'] == 'N/A'


# ===========================================================================
# Transform: valueMap
# ===========================================================================

class TestValueMap:
    def test_shorthand_map(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'status',
                'targetPath': 'state',
                'transform': 'valueMap',
                'valueMap': {'active': 'A', 'inactive': 'I'},
            },
        ]))
        assert engine.forward({'status': 'active'})['state'] == 'A'
        assert engine.forward({'status': 'inactive'})['state'] == 'I'

    def test_full_form_map(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'gender',
                'targetPath': 'sex',
                'transform': 'valueMap',
                'valueMap': {
                    'forward': {'male': 'M', 'female': 'F'},
                    'unmapped': 'passthrough',
                },
            },
        ]))
        assert engine.forward({'gender': 'male'})['sex'] == 'M'
        assert engine.forward({'gender': 'other'})['sex'] == 'other'

    def test_unmapped_error(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'val',
                'targetPath': 'out',
                'transform': 'valueMap',
                'valueMap': {'forward': {'a': '1'}, 'unmapped': 'error'},
            },
        ]))
        with pytest.raises(ValueError, match="No mapping found"):
            engine.forward({'val': 'unknown'})

    def test_unmapped_default(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'val',
                'targetPath': 'out',
                'transform': 'valueMap',
                'valueMap': {'forward': {'a': '1'}, 'unmapped': 'default', 'default': 'X'},
            },
        ]))
        assert engine.forward({'val': 'unknown'})['out'] == 'X'


# ===========================================================================
# Transform: flatten
# ===========================================================================

class TestFlatten:
    def test_dict_to_string(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'addr',
                'targetPath': 'addr_flat',
                'transform': 'flatten',
                'separator': '|',
            },
        ]))
        result = engine.forward({'addr': {'city': 'NYC', 'state': 'NY'}})
        # Flattened dict produces key=value pairs
        assert 'city=NYC' in result['addr_flat']
        assert 'state=NY' in result['addr_flat']

    def test_list_to_string(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'tags',
                'targetPath': 'tags_str',
                'transform': 'flatten',
                'separator': ',',
            },
        ]))
        result = engine.forward({'tags': ['a', 'b', 'c']})
        assert result['tags_str'] == 'a,b,c'


# ===========================================================================
# Transform: nest
# ===========================================================================

class TestNest:
    def test_string_to_nested(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'path',
                'targetPath': 'nested',
                'transform': 'nest',
                'separator': '.',
            },
        ]))
        result = engine.forward({'path': 'a.b.c'})
        assert isinstance(result['nested'], dict)
        assert 'a' in result['nested']


# ===========================================================================
# Transform: concat
# ===========================================================================

class TestConcat:
    def test_concat_expression(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'first',
                'targetPath': 'display',
                'transform': 'concat',
                'expression': 'source.first & " " & source.last',
            },
        ]))
        result = engine.forward({'first': 'Jane', 'last': 'Smith'})
        assert result['display'] == 'Jane Smith'


# ===========================================================================
# Transform: split
# ===========================================================================

class TestSplit:
    def test_split_expression(self):
        """Split transform evaluates FEL expression on the source value."""
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'fullName',
                'targetPath': 'upper_name',
                'transform': 'split',
                'expression': 'upper($)',
            },
        ]))
        result = engine.forward({'fullName': 'Jane Smith'})
        assert result['upper_name'] == 'JANE SMITH'


# ===========================================================================
# Condition guards (§4.13)
# ===========================================================================

class TestConditionGuards:
    def test_condition_true_executes(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'premium',
                'targetPath': 'tier',
                'transform': 'constant',
                'expression': '"gold"',
                'condition': 'source.premium = true',
            },
        ]))
        result = engine.forward({'premium': True})
        assert result['tier'] == 'gold'

    def test_condition_false_skips(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'premium',
                'targetPath': 'tier',
                'transform': 'constant',
                'expression': '"gold"',
                'condition': 'source.premium = true',
            },
        ]))
        result = engine.forward({'premium': False})
        assert 'tier' not in result

    def test_multiple_conditional_rules(self):
        engine = MappingEngine(_make_doc([
            {
                'targetPath': 'category',
                'transform': 'constant',
                'expression': '"child"',
                'condition': 'source.age < 18',
            },
            {
                'targetPath': 'category',
                'transform': 'constant',
                'expression': '"adult"',
                'condition': 'source.age >= 18',
            },
        ]))
        assert engine.forward({'age': 10})['category'] == 'child'
        assert engine.forward({'age': 25})['category'] == 'adult'


# ===========================================================================
# Priority ordering (§3.4)
# ===========================================================================

class TestPriority:
    def test_higher_priority_executes_first(self):
        """Higher priority rules execute first; last write wins for same path."""
        engine = MappingEngine(_make_doc([
            {
                'targetPath': 'val',
                'transform': 'constant',
                'expression': '"low"',
                'priority': 1,
            },
            {
                'targetPath': 'val',
                'transform': 'constant',
                'expression': '"high"',
                'priority': 10,
            },
        ]))
        # Priority 10 executes first, then priority 1 overwrites
        result = engine.forward({})
        assert result['val'] == 'low'

    def test_default_priority_zero(self):
        engine = MappingEngine(_make_doc([
            {
                'targetPath': 'a',
                'transform': 'constant',
                'expression': '"first"',
            },
            {
                'targetPath': 'b',
                'transform': 'constant',
                'expression': '"second"',
                'priority': 5,
            },
        ]))
        result = engine.forward({})
        assert result['a'] == 'first'
        assert result['b'] == 'second'


# ===========================================================================
# Bidirectional / Reverse (§5)
# ===========================================================================

class TestReverse:
    def test_basic_reverse(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'name', 'targetPath': 'fullName', 'transform': 'preserve'},
        ]))
        result = engine.reverse({'fullName': 'Alice'})
        assert result['name'] == 'Alice'

    def test_bidirectional_false_skips_reverse(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'name', 'targetPath': 'fullName', 'transform': 'preserve'},
            {
                'sourcePath': 'internal',
                'targetPath': 'computed',
                'transform': 'preserve',
                'bidirectional': False,
            },
        ]))
        result = engine.reverse({'fullName': 'Bob', 'computed': 'skip'})
        assert result['name'] == 'Bob'
        assert 'internal' not in result

    def test_reverse_value_map_auto_invert(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'status',
                'targetPath': 'state',
                'transform': 'valueMap',
                'valueMap': {
                    'forward': {'active': 'A', 'inactive': 'I'},
                    'unmapped': 'passthrough',
                },
            },
        ]))
        result = engine.reverse({'state': 'A'})
        assert result['status'] == 'active'

    def test_reverse_override(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'name',
                'targetPath': 'display',
                'transform': 'expression',
                'expression': 'upper($)',
                'reverse': {
                    'transform': 'expression',
                    'expression': 'lower($)',
                },
            },
        ]))
        result = engine.reverse({'display': 'ALICE'})
        assert result['name'] == 'alice'


# ===========================================================================
# Array descriptors (§4.12)
# ===========================================================================

class TestArrayDescriptor:
    def test_each_mode(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'items',
                'targetPath': 'entries',
                'transform': 'preserve',
                'array': {'mode': 'each'},
            },
        ]))
        result = engine.forward({'items': [1, 2, 3]})
        assert result['entries'] == [1, 2, 3]

    def test_each_with_inner_rules(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'people',
                'targetPath': 'contacts',
                'transform': 'preserve',
                'array': {
                    'mode': 'each',
                    'innerRules': [
                        {'sourcePath': 'name', 'targetPath': 'fullName', 'transform': 'preserve'},
                        {'sourcePath': 'age', 'targetPath': 'years', 'transform': 'preserve'},
                    ],
                },
            },
        ]))
        result = engine.forward({
            'people': [
                {'name': 'Alice', 'age': 30},
                {'name': 'Bob', 'age': 25},
            ]
        })
        assert result['contacts'] == [
            {'fullName': 'Alice', 'years': 30},
            {'fullName': 'Bob', 'years': 25},
        ]

    def test_whole_mode(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'tags',
                'targetPath': 'tagStr',
                'transform': 'flatten',
                'separator': ',',
                'array': {'mode': 'whole'},
            },
        ]))
        result = engine.forward({'tags': ['a', 'b', 'c']})
        assert result['tagStr'] == 'a,b,c'

    def test_indexed_mode(self):
        engine = MappingEngine(_make_doc([
            {
                'sourcePath': 'parts',
                'targetPath': 'name',
                'transform': 'preserve',
                'array': {
                    'mode': 'indexed',
                    'innerRules': [
                        {'index': 0, 'targetPath': 'first', 'transform': 'preserve'},
                        {'index': 1, 'targetPath': 'last', 'transform': 'preserve'},
                    ],
                },
            },
        ]))
        result = engine.forward({'parts': ['John', 'Doe']})
        assert result['name']['first'] == 'John'
        assert result['name']['last'] == 'Doe'


# ===========================================================================
# Path resolution
# ===========================================================================

class TestPathResolution:
    def test_simple_path(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'x', 'targetPath': 'y', 'transform': 'preserve'},
        ]))
        assert engine.forward({'x': 42})['y'] == 42

    def test_nested_path(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'a.b.c', 'targetPath': 'd.e', 'transform': 'preserve'},
        ]))
        result = engine.forward({'a': {'b': {'c': 'deep'}}})
        assert result['d']['e'] == 'deep'

    def test_bracket_index_path(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'items[0].name', 'targetPath': 'first', 'transform': 'preserve'},
        ]))
        result = engine.forward({'items': [{'name': 'Alpha'}, {'name': 'Beta'}]})
        assert result['first'] == 'Alpha'

    def test_target_creates_intermediate_dicts(self):
        engine = MappingEngine(_make_doc([
            {'sourcePath': 'val', 'targetPath': 'deep.nested.path', 'transform': 'preserve'},
        ]))
        result = engine.forward({'val': 'hello'})
        assert result['deep']['nested']['path'] == 'hello'


# ===========================================================================
# Defaults and autoMap
# ===========================================================================

class TestDefaultsAndAutoMap:
    def test_document_defaults(self):
        engine = MappingEngine(_make_doc(
            [{'sourcePath': 'name', 'targetPath': 'name', 'transform': 'preserve'}],
            defaults={'type': 'patient', 'version': 1},
        ))
        result = engine.forward({'name': 'Alice'})
        assert result['type'] == 'patient'
        assert result['version'] == 1
        assert result['name'] == 'Alice'

    def test_auto_map_copies_unmentioned(self):
        engine = MappingEngine(_make_doc(
            [{'sourcePath': 'name', 'targetPath': 'fullName', 'transform': 'preserve'}],
            autoMap=True,
        ))
        result = engine.forward({'name': 'Alice', 'age': 30, 'email': 'a@b.com'})
        assert result['fullName'] == 'Alice'
        assert result['age'] == 30
        assert result['email'] == 'a@b.com'

    def test_auto_map_does_not_duplicate(self):
        engine = MappingEngine(_make_doc(
            [{'sourcePath': 'name', 'targetPath': 'name', 'transform': 'preserve'}],
            autoMap=True,
        ))
        result = engine.forward({'name': 'Alice', 'extra': 'val'})
        assert result['name'] == 'Alice'
        assert result['extra'] == 'val'


# ===========================================================================
# Custom adapter registration
# ===========================================================================

class TestCustomAdapterRegistration:
    def setup_method(self):
        # Clean up any registered adapters between tests
        _custom_adapters.clear()

    def test_register_and_use_custom_adapter(self):
        class YamlAdapter(Adapter):
            def __init__(self, config=None):
                pass
            def serialize(self, value):
                return b'yaml-output'
            def deserialize(self, data):
                return {'yaml': True}

        register_adapter('x-yaml', YamlAdapter)
        adapter = get_adapter('x-yaml')
        assert adapter.serialize({}) == b'yaml-output'
        assert adapter.deserialize(b'') == {'yaml': True}

    def test_unregistered_custom_adapter_raises(self):
        with pytest.raises(ValueError, match="not registered"):
            get_adapter('x-unknown')

    def test_non_x_prefix_raises(self):
        with pytest.raises(ValueError, match="must start with 'x-'"):
            register_adapter('custom', type)


# ===========================================================================
# Integration: full pipeline
# ===========================================================================

class TestFullPipeline:
    def test_forward_then_reverse_roundtrip(self):
        doc = _make_doc([
            {'sourcePath': 'firstName', 'targetPath': 'name.given', 'transform': 'preserve'},
            {'sourcePath': 'lastName', 'targetPath': 'name.family', 'transform': 'preserve'},
            {'sourcePath': 'age', 'targetPath': 'age', 'transform': 'coerce', 'coerce': 'string'},
        ])
        engine = MappingEngine(doc)

        source = {'firstName': 'John', 'lastName': 'Doe', 'age': 30}
        target = engine.forward(source)
        assert target['name']['given'] == 'John'
        assert target['name']['family'] == 'Doe'
        assert target['age'] == '30'

        # Reverse: coerce back is still preserve (string→string)
        restored = engine.reverse(target)
        assert restored['firstName'] == 'John'
        assert restored['lastName'] == 'Doe'
        assert restored['age'] == '30'  # coerce reverse gives string back

    def test_complex_mapping_with_conditions_and_valuemap(self):
        doc = _make_doc([
            {'sourcePath': 'name', 'targetPath': 'patientName', 'transform': 'preserve'},
            {
                'sourcePath': 'gender',
                'targetPath': 'sex',
                'transform': 'valueMap',
                'valueMap': {
                    'forward': {'male': 'M', 'female': 'F', 'other': 'O'},
                    'unmapped': 'passthrough',
                },
            },
            {
                'targetPath': 'isMinor',
                'transform': 'constant',
                'expression': 'true',
                'condition': 'source.age < 18',
            },
            {
                'targetPath': 'isMinor',
                'transform': 'constant',
                'expression': 'false',
                'condition': 'source.age >= 18',
            },
        ])
        engine = MappingEngine(doc)

        result = engine.forward({'name': 'Alex', 'gender': 'male', 'age': 15})
        assert result['patientName'] == 'Alex'
        assert result['sex'] == 'M'
        assert result['isMinor'] is True

        result = engine.forward({'name': 'Sam', 'gender': 'female', 'age': 25})
        assert result['isMinor'] is False

    def test_forward_with_adapter_serialize(self):
        doc = _make_doc([
            {'sourcePath': 'name', 'targetPath': 'name', 'transform': 'preserve'},
        ])
        engine = MappingEngine(doc)
        result = engine.forward({'name': 'Test'})

        adapter = get_adapter('json', {'pretty': False})
        output = adapter.serialize(result)
        assert b'"name": "Test"' in output or b'"name":"Test"' in output

    def test_multiple_rules_same_target(self):
        """When multiple rules write to the same target, last writer wins."""
        doc = _make_doc([
            {
                'targetPath': 'label',
                'transform': 'constant',
                'expression': '"default"',
                'priority': 0,
            },
            {
                'targetPath': 'label',
                'transform': 'constant',
                'expression': '"override"',
                'condition': 'source.override = true',
                'priority': 0,
            },
        ])
        engine = MappingEngine(doc)

        # Without override: only first rule fires
        result = engine.forward({'override': False})
        assert result['label'] == 'default'

        # With override: both fire, second overwrites
        result = engine.forward({'override': True})
        assert result['label'] == 'override'
