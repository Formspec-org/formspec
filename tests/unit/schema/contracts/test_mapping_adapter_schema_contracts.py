"""Schema contracts for mapping adapter definitions."""

import pytest

from tests.unit.support.schema_fixtures import load_schema


class TestAdapterSchemaAlignment:
    """Verify adapter configs align with mapping.schema.json definitions."""

    @pytest.fixture(scope="class")
    def mapping_schema(self):
        return load_schema("mapping.schema.json")

    def test_json_adapter_properties(self, mapping_schema):
        props = mapping_schema["$defs"]["JsonAdapter"]["properties"]
        assert "pretty" in props
        assert "sortKeys" in props
        assert "nullHandling" in props

    def test_xml_adapter_properties(self, mapping_schema):
        props = mapping_schema["$defs"]["XmlAdapter"]["properties"]
        assert "declaration" in props
        assert "indent" in props
        assert "cdata" in props

    def test_csv_adapter_properties(self, mapping_schema):
        props = mapping_schema["$defs"]["CsvAdapter"]["properties"]
        assert "delimiter" in props
        assert "quote" in props
        assert "header" in props
        assert "encoding" in props
        assert "lineEnding" in props

    def test_json_null_handling_enum(self, mapping_schema):
        null_handling = mapping_schema["$defs"]["JsonAdapter"]["properties"]["nullHandling"]
        assert set(null_handling["enum"]) == {"include", "omit"}

    def test_csv_line_ending_enum(self, mapping_schema):
        line_ending = mapping_schema["$defs"]["CsvAdapter"]["properties"]["lineEnding"]
        assert set(line_ending["enum"]) == {"crlf", "lf"}

    def test_target_format_enum(self, mapping_schema):
        format_schema = mapping_schema["$defs"]["TargetSchema"]["properties"]["format"]
        enum_values = format_schema["anyOf"][0]["enum"]
        assert "json" in enum_values
        assert "xml" in enum_values
        assert "csv" in enum_values
