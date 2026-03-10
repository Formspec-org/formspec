"""Conformance tests for adapter and mapping engine round-trips.

Ensures that bidirectional mapping and adapter serializations
conform to the round-trip invariants defined by the Formspec standard.
"""

import xml.etree.ElementTree as ET
import pytest

from formspec.adapters import JsonAdapter, XmlAdapter, CsvAdapter
from formspec.mapping import MappingEngine


class TestJsonRoundTripContracts:

    @pytest.mark.parametrize('value', [
        {},
        {'a': 1, 'b': 'hello', 'c': True, 'd': None, 'e': [1, 2, 3]},
        {'nested': {'deep': {'value': 42}}},
        [1, 'two', 3.0, True, None],
        [],
        {'arr': [{'x': 1}, {'x': 2}]},
        42,
        'hello',
        True,
        None,
    ])
    def test_identity(self, value):
        """deserialize(serialize(v)) == v for all JSON values."""
        a = JsonAdapter()
        assert a.deserialize(a.serialize(value)) == value

    def test_pretty_roundtrip(self):
        a = JsonAdapter({'pretty': True, 'sortKeys': True})
        data = {'z': [1, 2], 'a': {'nested': True}}
        assert a.deserialize(a.serialize(data)) == data

    def test_null_omit_roundtrip_strips_nulls(self):
        """With nullHandling=omit, round-trip strips null values."""
        a = JsonAdapter({'nullHandling': 'omit'})
        data = {'a': 1, 'b': None, 'c': {'d': None, 'e': 2}}
        expected = {'a': 1, 'c': {'e': 2}}
        assert a.deserialize(a.serialize(data)) == expected


class TestXmlRoundTripContracts:

    @pytest.mark.parametrize('data', [
        {'name': 'Alice', 'age': '30'},
        {'@id': '123', 'item': 'Widget'},
        {'address': {'street': '123 Main', 'city': 'NY'}},
        {'items': [{'name': 'A', 'qty': '2'}, {'name': 'B', 'qty': '5'}]},
    ])
    def test_roundtrip_string_values(self, data):
        """XML round-trip preserves structure (all leaf values are strings)."""
        a = XmlAdapter(root_element='doc')
        assert a.deserialize(a.serialize(data)) == data

    def test_roundtrip_with_attributes_and_children(self):
        a = XmlAdapter(root_element='order')
        data = {'@id': '99', '@status': 'active', 'customer': 'Acme',
                'line': [{'@seq': '1', 'sku': 'A'}, {'@seq': '2', 'sku': 'B'}]}
        assert a.deserialize(a.serialize(data)) == data

    def test_serialize_produces_valid_xml(self):
        """Serialized output must be parseable by ET."""
        a = XmlAdapter(root_element='r')
        data = {'a': 'x & y', 'b': '<tag>', 'c': '"quoted"'}
        b = a.serialize(data)
        ET.fromstring(b)  # must not raise

    def test_empty_dict_roundtrip(self):
        a = XmlAdapter(root_element='r')
        b = a.serialize({})
        result = a.deserialize(b)
        assert result == {}


class TestCsvRoundTripContracts:

    @pytest.mark.parametrize('rows', [
        [{'name': 'Alice', 'age': '30'}],
        [{'a': '1', 'b': '2'}, {'a': '3', 'b': '4'}],
        [{'val': 'hello, world'}],  # comma in value
        [{'val': 'line1\nline2'}],  # newline in value
        [{'val': '"quoted"'}],  # quotes in value
    ])
    def test_roundtrip(self, rows):
        """CSV round-trip preserves string values."""
        a = CsvAdapter()
        assert a.deserialize(a.serialize(rows)) == rows

    def test_roundtrip_custom_delimiter(self):
        a = CsvAdapter({'delimiter': '|', 'lineEnding': 'lf'})
        rows = [{'x': '1', 'y': '2'}, {'x': '3', 'y': '4'}]
        assert a.deserialize(a.serialize(rows)) == rows

    def test_repeat_expansion_roundtrip_produces_flat_rows(self):
        """Repeat expansion then round-trip gives flat rows (no nesting)."""
        a = CsvAdapter()
        data = {
            'id': 'ORD-99',
            'items': [{'sku': 'A1', 'qty': '2'}, {'sku': 'B3', 'qty': '5'}],
        }
        result = a.deserialize(a.serialize(data))
        assert len(result) == 2
        assert result[0]['id'] == 'ORD-99'
        assert result[0]['sku'] == 'A1'
        assert result[1]['sku'] == 'B3'


class TestMappingEngineRoundTripContracts:

    def test_forward_then_reverse_roundtrip(self):
        doc = {
            'version': '1.0.0',
            'definitionRef': 'https://example.com/form',
            'definitionVersion': '>=1.0.0',
            'targetSchema': {'format': 'json'},
            'rules': [
                {'sourcePath': 'firstName', 'targetPath': 'name.given', 'transform': 'preserve'},
                {'sourcePath': 'lastName', 'targetPath': 'name.family', 'transform': 'preserve'},
                {'sourcePath': 'age', 'targetPath': 'age', 'transform': 'coerce', 'coerce': 'string'},
            ]
        }
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
