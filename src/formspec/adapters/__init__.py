"""Formspec Mapping DSL — Format Adapters (§6).

Provides serialization/deserialization for JSON, XML, and CSV formats.

Public API:
    get_adapter(format, config, target_schema) → Adapter
    JsonAdapter, XmlAdapter, CsvAdapter
"""

from .base import Adapter, JsonValue
from .json_adapter import JsonAdapter
from .xml_adapter import XmlAdapter
from .csv_adapter import CsvAdapter


def get_adapter(
    format: str,
    config: dict | None = None,
    target_schema: dict | None = None,
) -> Adapter:
    """Factory: create an adapter for the given format.

    Args:
        format: 'json', 'xml', 'csv', or 'x-*' custom identifier.
        config: Adapter-specific configuration dict.
        target_schema: The targetSchema object from the mapping document.

    Returns:
        An Adapter instance.

    Raises:
        ValueError: If the format is unrecognized.
    """
    ts = target_schema or {}

    if format == 'json':
        return JsonAdapter(config)
    elif format == 'xml':
        return XmlAdapter(
            config=config,
            root_element=ts.get('rootElement', 'root'),
            namespaces=ts.get('namespaces'),
        )
    elif format == 'csv':
        return CsvAdapter(config)
    elif format.startswith('x-'):
        raise ValueError(
            f"Custom adapter '{format}' is not registered. "
            f"Custom adapters must be provided by the implementation."
        )
    else:
        raise ValueError(
            f"Unrecognized adapter format: '{format}'. "
            f"Must be 'json', 'xml', 'csv', or 'x-*' prefix."
        )
