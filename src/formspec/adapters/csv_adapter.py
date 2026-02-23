"""CSV format adapter — §6.4 of the Mapping DSL spec.

Serializes internal JSON as RFC 4180 delimited text.

Structural constraint: all target paths MUST be simple identifiers
(no dot-notation or brackets). Repeat groups emit one row per item;
non-repeat fields are duplicated across rows.
"""

from __future__ import annotations

import csv
import io
from typing import Any

from .base import Adapter, JsonValue


class CsvAdapter(Adapter):
    """§6.4 CSV adapter.

    Config:
        delimiter (str): Field delimiter. Default ",".
        quote (str): Quote character. Default '"'.
        header (bool): Emit header row. Default true.
        encoding (str): Character encoding. Default "utf-8".
        lineEnding (str): "crlf" or "lf". Default "crlf".
    """

    def __init__(self, config: dict | None = None):
        cfg = config or {}
        self.delimiter: str = cfg.get('delimiter', ',')
        self.quote: str = cfg.get('quote', '"')
        self.header: bool = cfg.get('header', True)
        self.encoding: str = cfg.get('encoding', 'utf-8')
        self.line_ending: str = cfg.get('lineEnding', 'crlf')

    def serialize(self, value: JsonValue) -> bytes:
        """Convert JSON to CSV bytes.

        Accepts:
        - A list of flat dicts (each dict is a row)
        - A single flat dict (one row)
        - A dict with one list-valued key (repeat group expansion)
        """
        rows = self._normalize_rows(value)
        if not rows:
            return b''

        # Collect all field names in order (preserving insertion order)
        fieldnames = list(dict.fromkeys(
            key for row in rows for key in row
        ))

        buf = io.StringIO()
        writer = csv.writer(
            buf,
            delimiter=self.delimiter,
            quotechar=self.quote,
            quoting=csv.QUOTE_MINIMAL,
            lineterminator='\n',  # We'll fix line endings after
        )

        if self.header:
            writer.writerow(fieldnames)

        for row in rows:
            writer.writerow(self._to_str(row.get(f, '')) for f in fieldnames)

        text = buf.getvalue()

        # Apply line ending
        if self.line_ending == 'crlf':
            text = text.replace('\n', '\r\n')

        return text.encode(self.encoding)

    def deserialize(self, data: bytes) -> JsonValue:
        """Convert CSV bytes to a list of dicts."""
        text = data.decode(self.encoding)
        # Normalize line endings
        text = text.replace('\r\n', '\n').replace('\r', '\n')

        reader = csv.reader(
            io.StringIO(text),
            delimiter=self.delimiter,
            quotechar=self.quote,
        )

        rows_out = []
        if self.header:
            try:
                headers = next(reader)
            except StopIteration:
                return []
            for row in reader:
                if not row or (len(row) == 1 and row[0] == ''):
                    continue
                rows_out.append(dict(zip(headers, row)))
        else:
            for row in reader:
                if not row or (len(row) == 1 and row[0] == ''):
                    continue
                rows_out.append(row)

        return rows_out

    # ---------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------

    def _normalize_rows(self, value: JsonValue) -> list[dict]:
        """Convert various input shapes to a list of flat dicts."""
        if isinstance(value, list):
            # Already a list of rows
            return [r if isinstance(r, dict) else {'value': r} for r in value]

        if isinstance(value, dict):
            # Check for repeat group: a dict with one list-valued key
            scalar_fields = {}
            list_key = None
            list_val = None
            for k, v in value.items():
                if isinstance(v, list) and list_key is None:
                    list_key = k
                    list_val = v
                else:
                    scalar_fields[k] = v

            if list_key is not None and list_val:
                # Expand: each list item becomes a row, scalars duplicated
                rows = []
                for item in list_val:
                    row = dict(scalar_fields)
                    if isinstance(item, dict):
                        row.update(item)
                    else:
                        row[list_key] = item
                    rows.append(row)
                return rows

            # Single flat dict = one row
            return [value]

        return []

    @staticmethod
    def _to_str(val: Any) -> str:
        if val is None:
            return ''
        if isinstance(val, bool):
            return 'true' if val else 'false'
        return str(val)
