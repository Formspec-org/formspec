"""JSON format adapter — §6.2 of the Mapping DSL spec.

Identity serialization: internal JSON → JSON bytes.
"""

import json
from typing import Any

from .base import Adapter, JsonValue


def _strip_nulls(value: Any) -> Any:
    """Recursively remove keys with None values from dicts."""
    if isinstance(value, dict):
        return {k: _strip_nulls(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [_strip_nulls(item) for item in value]
    return value


class JsonAdapter(Adapter):
    """§6.2 JSON adapter.

    Config:
        pretty (bool): Emit indented JSON. Default false.
        sortKeys (bool): Sort object keys. Default false.
        nullHandling (str): "include" or "omit". Default "include".
    """

    def __init__(self, config: dict | None = None):
        cfg = config or {}
        self.pretty: bool = cfg.get('pretty', False)
        self.sort_keys: bool = cfg.get('sortKeys', False)
        self.null_handling: str = cfg.get('nullHandling', 'include')

    def serialize(self, value: JsonValue) -> bytes:
        data = value
        if self.null_handling == 'omit':
            data = _strip_nulls(data)
        indent = 2 if self.pretty else None
        return json.dumps(
            data,
            indent=indent,
            sort_keys=self.sort_keys,
            ensure_ascii=False,
        ).encode('utf-8')

    def deserialize(self, data: bytes) -> JsonValue:
        return json.loads(data)
