"""Layer 4: Round-Trip Serialization Tests + Format Adapter Tests.

Tests the adapters package (JSON, XML, CSV) per Mapping DSL §6.
Verifies serialization, deserialization, round-trip fidelity,
and adapter-specific behavior.
"""

import json
import csv
import io
import xml.etree.ElementTree as ET

import pytest

from formspec.adapters import get_adapter, JsonAdapter, XmlAdapter, CsvAdapter
from formspec.adapters.base import Adapter


# ===================================================================
# Factory tests
# ===================================================================


class TestAdapterFactory:

    def test_json_format(self):
        a = get_adapter('json')
        assert isinstance(a, JsonAdapter)

    def test_xml_format(self):
        a = get_adapter('xml', target_schema={'rootElement': 'Doc'})
        assert isinstance(a, XmlAdapter)

    def test_csv_format(self):
        a = get_adapter('csv')
        assert isinstance(a, CsvAdapter)

    def test_unknown_format_raises(self):
        with pytest.raises(ValueError, match='Unrecognized'):
            get_adapter('protobuf')

    def test_custom_format_raises(self):
        with pytest.raises(ValueError, match='not registered'):
            get_adapter('x-protobuf')

    def test_all_adapters_are_adapters(self):
        for fmt in ('json', 'xml', 'csv'):
            a = get_adapter(fmt, target_schema={'rootElement': 'R'})
            assert isinstance(a, Adapter)


# ===================================================================
# JSON Adapter (§6.2)
# ===================================================================


class TestJsonAdapterSerialize:

    def test_default_compact(self):
        a = JsonAdapter()
        b = a.serialize({'a': 1})
        assert b'\n' not in b  # compact, no indentation

    def test_pretty(self):
        a = JsonAdapter({'pretty': True})
        b = a.serialize({'a': 1})
        assert b'\n' in b

    def test_sort_keys(self):
        a = JsonAdapter({'sortKeys': True})
        b = a.serialize({'z': 1, 'a': 2})
        keys = list(json.loads(b).keys())
        assert keys == ['a', 'z']

    def test_null_handling_include(self):
        a = JsonAdapter({'nullHandling': 'include'})
        b = a.serialize({'a': 1, 'b': None})
        obj = json.loads(b)
        assert 'b' in obj and obj['b'] is None

    def test_null_handling_omit(self):
        a = JsonAdapter({'nullHandling': 'omit'})
        b = a.serialize({'a': 1, 'b': None})
        obj = json.loads(b)
        assert 'b' not in obj

    def test_null_omit_nested(self):
        a = JsonAdapter({'nullHandling': 'omit'})
        b = a.serialize({'a': {'b': None, 'c': 1}, 'd': None})
        obj = json.loads(b)
        assert obj == {'a': {'c': 1}}

    def test_null_omit_in_array(self):
        """Null array elements are preserved (only dict keys omitted)."""
        a = JsonAdapter({'nullHandling': 'omit'})
        b = a.serialize({'arr': [1, None, 3]})
        obj = json.loads(b)
        assert obj == {'arr': [1, None, 3]}

    def test_unicode(self):
        a = JsonAdapter()
        b = a.serialize({'name': 'élève'})
        assert 'élève'.encode('utf-8') in b

    def test_outputs_bytes(self):
        a = JsonAdapter()
        assert isinstance(a.serialize({}), bytes)


class TestJsonAdapterDeserialize:

    def test_basic(self):
        a = JsonAdapter()
        assert a.deserialize(b'{"a": 1}') == {'a': 1}

    def test_unicode(self):
        a = JsonAdapter()
        assert a.deserialize('{"x": "é"}'.encode('utf-8')) == {'x': 'é'}


class TestJsonRoundTrip:

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


# ===================================================================
# XML Adapter (§6.3)
# ===================================================================


class TestXmlAdapterSerialize:

    def test_basic_elements(self):
        a = XmlAdapter(root_element='doc')
        b = a.serialize({'name': 'Alice', 'age': '30'})
        root = ET.fromstring(b)
        assert root.tag == 'doc'
        assert root.find('name').text == 'Alice'
        assert root.find('age').text == '30'

    def test_attributes(self):
        a = XmlAdapter(root_element='order')
        b = a.serialize({'@id': '123', 'item': 'Widget'})
        root = ET.fromstring(b)
        assert root.get('id') == '123'
        assert root.find('item').text == 'Widget'

    def test_nested_elements(self):
        a = XmlAdapter(root_element='root')
        b = a.serialize({'address': {'street': '123 Main', 'city': 'Springfield'}})
        root = ET.fromstring(b)
        assert root.find('address/street').text == '123 Main'
        assert root.find('address/city').text == 'Springfield'

    def test_array_repeated_elements(self):
        a = XmlAdapter(root_element='root')
        b = a.serialize({'item': ['A', 'B', 'C']})
        root = ET.fromstring(b)
        items = root.findall('item')
        assert len(items) == 3
        assert [i.text for i in items] == ['A', 'B', 'C']

    def test_array_of_dicts(self):
        a = XmlAdapter(root_element='root')
        b = a.serialize({'item': [{'name': 'A'}, {'name': 'B'}]})
        root = ET.fromstring(b)
        items = root.findall('item')
        assert len(items) == 2
        assert items[0].find('name').text == 'A'

    def test_declaration_included(self):
        a = XmlAdapter({'declaration': True}, root_element='r')
        b = a.serialize({})
        assert b.startswith(b'<?xml version="1.0"')

    def test_declaration_excluded(self):
        a = XmlAdapter({'declaration': False}, root_element='r')
        b = a.serialize({})
        assert not b.startswith(b'<?xml')

    def test_indent_zero_compact(self):
        a = XmlAdapter({'indent': 0, 'declaration': False}, root_element='r')
        b = a.serialize({'a': '1'})
        # Should not have indentation newlines (other than trailing)
        text = b.decode().strip()
        assert '\n' not in text or text.count('\n') <= 1

    def test_cdata_wrapping(self):
        a = XmlAdapter({'cdata': ['doc.notes']}, root_element='doc')
        b = a.serialize({'notes': 'x & y'})
        text = b.decode()
        assert '<![CDATA[x & y]]>' in text

    def test_namespace_default(self):
        a = XmlAdapter(
            root_element='Order',
            namespaces={'': 'urn:example:orders:v2'},
        )
        b = a.serialize({'item': 'Widget'})
        text = b.decode()
        assert 'xmlns="urn:example:orders:v2"' in text

    def test_boolean_serialization(self):
        a = XmlAdapter(root_element='r')
        b = a.serialize({'flag': True, 'off': False})
        root = ET.fromstring(b)
        assert root.find('flag').text == 'true'
        assert root.find('off').text == 'false'

    def test_none_serialization(self):
        a = XmlAdapter(root_element='r')
        b = a.serialize({'val': None})
        root = ET.fromstring(b)
        assert root.find('val').text in ('', None)

    def test_numeric_serialization(self):
        a = XmlAdapter(root_element='r')
        b = a.serialize({'num': 42, 'dec': 3.14})
        root = ET.fromstring(b)
        assert root.find('num').text == '42'
        assert root.find('dec').text == '3.14'

    def test_outputs_bytes(self):
        a = XmlAdapter(root_element='r')
        assert isinstance(a.serialize({}), bytes)

    def test_non_dict_raises(self):
        a = XmlAdapter(root_element='r')
        with pytest.raises(ValueError, match='dict'):
            a.serialize([1, 2, 3])


class TestXmlAdapterDeserialize:

    def test_basic(self):
        a = XmlAdapter(root_element='r')
        xml = b'<r><name>Alice</name><age>30</age></r>'
        assert a.deserialize(xml) == {'name': 'Alice', 'age': '30'}

    def test_attributes(self):
        a = XmlAdapter(root_element='r')
        xml = b'<r id="123"><item>W</item></r>'
        result = a.deserialize(xml)
        assert result['@id'] == '123'
        assert result['item'] == 'W'

    def test_nested(self):
        a = XmlAdapter(root_element='r')
        xml = b'<r><addr><city>NY</city></addr></r>'
        assert a.deserialize(xml) == {'addr': {'city': 'NY'}}

    def test_repeated_elements_become_array(self):
        a = XmlAdapter(root_element='r')
        xml = b'<r><item>A</item><item>B</item></r>'
        result = a.deserialize(xml)
        assert result['item'] == ['A', 'B']


class TestXmlRoundTrip:

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


# ===================================================================
# CSV Adapter (§6.4)
# ===================================================================


class TestCsvAdapterSerialize:

    def test_basic_list_of_dicts(self):
        a = CsvAdapter()
        rows = [{'name': 'Alice', 'age': '30'}, {'name': 'Bob', 'age': '25'}]
        b = a.serialize(rows)
        text = b.decode()
        assert 'name,age' in text or 'age,name' in text
        assert 'Alice' in text

    def test_crlf_line_ending(self):
        a = CsvAdapter({'lineEnding': 'crlf'})
        b = a.serialize([{'a': '1'}])
        assert b'\r\n' in b

    def test_lf_line_ending(self):
        a = CsvAdapter({'lineEnding': 'lf'})
        b = a.serialize([{'a': '1'}])
        assert b'\r\n' not in b
        assert b'\n' in b

    def test_custom_delimiter(self):
        a = CsvAdapter({'delimiter': '\t'})
        b = a.serialize([{'a': '1', 'b': '2'}])
        assert b'\t' in b

    def test_header_included(self):
        a = CsvAdapter({'header': True})
        b = a.serialize([{'x': '1'}])
        lines = b.decode().strip().split('\r\n')
        assert lines[0] == 'x'

    def test_header_excluded(self):
        a = CsvAdapter({'header': False})
        b = a.serialize([{'x': '1', 'y': '2'}])
        lines = b.decode().strip().split('\r\n')
        # First line should be data, not headers
        assert lines[0] == '1,2'

    def test_repeat_group_expansion(self):
        """Dict with one list key expands into multiple rows."""
        a = CsvAdapter()
        data = {
            'orderId': 'ORD-99',
            'items': [{'sku': 'A1', 'qty': '2'}, {'sku': 'B3', 'qty': '5'}],
        }
        b = a.serialize(data)
        lines = b.decode().strip().split('\r\n')
        assert len(lines) == 3  # header + 2 data rows
        assert 'ORD-99' in lines[1]
        assert 'ORD-99' in lines[2]

    def test_single_dict_one_row(self):
        a = CsvAdapter()
        b = a.serialize({'name': 'Alice', 'age': '30'})
        lines = b.decode().strip().split('\r\n')
        assert len(lines) == 2  # header + 1 row

    def test_empty_list(self):
        a = CsvAdapter()
        assert a.serialize([]) == b''

    def test_boolean_serialization(self):
        a = CsvAdapter()
        b = a.serialize([{'flag': True, 'off': False}])
        text = b.decode()
        assert 'true' in text
        assert 'false' in text

    def test_none_serialization(self):
        a = CsvAdapter()
        b = a.serialize([{'val': None}])
        # None becomes empty string — csv module may quote it
        lines = b.decode().strip().split('\r\n')
        assert lines[1] in ('', '""')

    def test_outputs_bytes(self):
        a = CsvAdapter()
        assert isinstance(a.serialize([{'a': '1'}]), bytes)

    def test_quoting_special_chars(self):
        a = CsvAdapter()
        b = a.serialize([{'val': 'hello, world'}])
        text = b.decode()
        assert '"hello, world"' in text


class TestCsvAdapterDeserialize:

    def test_basic_with_header(self):
        a = CsvAdapter()
        data = b'name,age\r\nAlice,30\r\nBob,25\r\n'
        result = a.deserialize(data)
        assert result == [
            {'name': 'Alice', 'age': '30'},
            {'name': 'Bob', 'age': '25'},
        ]

    def test_without_header(self):
        a = CsvAdapter({'header': False})
        data = b'Alice,30\r\nBob,25\r\n'
        result = a.deserialize(data)
        assert result == [['Alice', '30'], ['Bob', '25']]

    def test_custom_delimiter(self):
        a = CsvAdapter({'delimiter': '\t'})
        data = b'a\tb\n1\t2\n'
        result = a.deserialize(data)
        assert result == [{'a': '1', 'b': '2'}]

    def test_quoted_fields(self):
        a = CsvAdapter()
        data = b'val\r\n"hello, world"\r\n'
        result = a.deserialize(data)
        assert result == [{'val': 'hello, world'}]

    def test_empty_input(self):
        a = CsvAdapter()
        assert a.deserialize(b'') == []


class TestCsvRoundTrip:

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


# ===================================================================
# Cross-adapter contract tests
# ===================================================================


class TestCrossAdapterContracts:

    def test_serialize_returns_bytes(self):
        """All adapters return bytes from serialize."""
        data_json = {'a': 1}
        data_xml = {'a': '1'}
        data_csv = [{'a': '1'}]

        assert isinstance(JsonAdapter().serialize(data_json), bytes)
        assert isinstance(XmlAdapter(root_element='r').serialize(data_xml), bytes)
        assert isinstance(CsvAdapter().serialize(data_csv), bytes)

    def test_all_produce_parseable_output(self):
        """Serialized output is parseable by the respective format parser."""
        # JSON
        ja = JsonAdapter()
        json.loads(ja.serialize({'test': True}))

        # XML
        xa = XmlAdapter(root_element='test')
        ET.fromstring(xa.serialize({'val': 'hello'}))

        # CSV
        ca = CsvAdapter()
        reader = csv.reader(io.StringIO(ca.serialize([{'a': '1'}]).decode()))
        rows = list(reader)
        assert len(rows) >= 1

    def test_default_configs_match_spec(self):
        """Default config values match mapping spec §6."""
        ja = JsonAdapter()
        assert ja.pretty is False
        assert ja.sort_keys is False
        assert ja.null_handling == 'include'

        xa = XmlAdapter(root_element='r')
        assert xa.declaration is True
        assert xa.indent_size == 2
        assert xa.cdata_paths == set()

        ca = CsvAdapter()
        assert ca.delimiter == ','
        assert ca.quote == '"'
        assert ca.header is True
        assert ca.encoding == 'utf-8'
        assert ca.line_ending == 'crlf'
