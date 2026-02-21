"""XML format adapter — §6.3 of the Mapping DSL spec.

Serializes internal JSON as XML 1.0 using stdlib ElementTree.

Target path conventions (applied by mapping engine before adapter sees them):
  a.b.c     → nested elements
  @attr     → attribute on containing element
  [0], [1]  → repeated sibling elements (index determines order)

The adapter receives a nested JSON dict where:
  - Regular keys become child elements
  - Keys starting with '@' become attributes on the parent element
  - List values become repeated child elements
  - Scalar values become text content
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from io import BytesIO
from typing import Any

from .base import Adapter, JsonValue

# Sentinel for CDATA wrapping (replaced in final string output)
_CDATA_SENTINEL = '\x00CDATA:'
_CDATA_END = '\x00'


class XmlAdapter(Adapter):
    """§6.3 XML adapter.

    Config:
        declaration (bool): Include <?xml?> declaration. Default true.
        indent (int): Spaces per level; 0 disables. Default 2.
        cdata (list[str]): Paths whose content is wrapped in CDATA.

    Requires root_element from targetSchema. Optional namespaces dict.
    """

    def __init__(
        self,
        config: dict | None = None,
        root_element: str = 'root',
        namespaces: dict[str, str] | None = None,
    ):
        cfg = config or {}
        self.declaration: bool = cfg.get('declaration', True)
        self.indent_size: int = cfg.get('indent', 2)
        self.cdata_paths: set[str] = set(cfg.get('cdata', []))
        self.root_element = root_element
        self.namespaces = namespaces or {}

        # Register namespace prefixes so ET uses them
        for prefix, uri in self.namespaces.items():
            if prefix:  # non-default
                ET.register_namespace(prefix, uri)
            else:
                ET.register_namespace('', uri)

    def serialize(self, value: JsonValue) -> bytes:
        """Convert a JSON dict to XML bytes."""
        if not isinstance(value, dict):
            raise ValueError('XML adapter requires a dict as top-level value')

        # Determine root tag
        default_ns = self.namespaces.get('')
        if default_ns:
            root_tag = f'{{{default_ns}}}{self.root_element}'
        else:
            root_tag = self.root_element

        root = ET.Element(root_tag)
        self._build_element(root, value, self.root_element)

        # Indent if configured
        if self.indent_size > 0:
            _indent_tree(root, level=0, indent=' ' * self.indent_size)

        # Serialize to string
        tree_bytes = ET.tostring(root, encoding='unicode', xml_declaration=False)

        # Replace CDATA sentinels
        tree_bytes = self._restore_cdata(tree_bytes)

        # Add declaration if requested
        parts = []
        if self.declaration:
            parts.append('<?xml version="1.0" encoding="UTF-8"?>')
            if tree_bytes and not tree_bytes.startswith('\n'):
                parts.append('\n')
        parts.append(tree_bytes)

        result = ''.join(parts)
        # Ensure trailing newline
        if not result.endswith('\n'):
            result += '\n'

        return result.encode('utf-8')

    def deserialize(self, data: bytes) -> JsonValue:
        """Convert XML bytes back to a JSON dict."""
        root = ET.fromstring(data)
        return self._parse_element(root)

    # ---------------------------------------------------------------
    # Build (JSON → XML)
    # ---------------------------------------------------------------

    def _build_element(self, elem: ET.Element, obj: dict, path: str) -> None:
        """Populate an XML element from a JSON dict."""
        for key, val in obj.items():
            if key.startswith('@'):
                # Attribute
                attr_name = key[1:]
                elem.set(attr_name, self._to_str(val))
            elif isinstance(val, dict):
                child_path = f'{path}.{key}'
                child = ET.SubElement(elem, key)
                self._build_element(child, val, child_path)
            elif isinstance(val, list):
                for item in val:
                    child_path = f'{path}.{key}'
                    child = ET.SubElement(elem, key)
                    if isinstance(item, dict):
                        self._build_element(child, item, child_path)
                    else:
                        text = self._to_str(item)
                        if child_path in self.cdata_paths:
                            child.text = f'{_CDATA_SENTINEL}{text}{_CDATA_END}'
                        else:
                            child.text = text
            else:
                child_path = f'{path}.{key}'
                child = ET.SubElement(elem, key)
                text = self._to_str(val)
                if child_path in self.cdata_paths:
                    child.text = f'{_CDATA_SENTINEL}{text}{_CDATA_END}'
                else:
                    child.text = text

    @staticmethod
    def _to_str(val: Any) -> str:
        """Convert a JSON value to string for XML text/attribute."""
        if val is None:
            return ''
        if isinstance(val, bool):
            return 'true' if val else 'false'
        return str(val)

    def _restore_cdata(self, xml_str: str) -> str:
        """Replace CDATA sentinels with actual CDATA sections."""
        from xml.sax.saxutils import unescape
        def _replace(m):
            # Content was XML-escaped by ET; unescape for raw CDATA
            content = unescape(m.group(1))
            return f'<![CDATA[{content}]]>'
        pattern = re.escape(_CDATA_SENTINEL) + '(.*?)' + re.escape(_CDATA_END)
        return re.sub(pattern, _replace, xml_str)

    # ---------------------------------------------------------------
    # Parse (XML → JSON)
    # ---------------------------------------------------------------

    def _parse_element(self, elem: ET.Element) -> dict:
        """Convert an XML element to a JSON dict."""
        result: dict = {}

        # Attributes
        for attr_name, attr_val in elem.attrib.items():
            # Strip namespace from attribute names
            local = self._local_name(attr_name)
            result[f'@{local}'] = attr_val

        # Child elements
        children: dict[str, list] = {}
        for child in elem:
            tag = self._local_name(child.tag)
            if tag not in children:
                children[tag] = []
            children[tag].append(child)

        for tag, elems in children.items():
            if len(elems) == 1:
                child = elems[0]
                if len(child) > 0 or child.attrib:
                    result[tag] = self._parse_element(child)
                else:
                    result[tag] = child.text or ''
            else:
                # Multiple siblings with same tag → array
                arr = []
                for child in elems:
                    if len(child) > 0 or child.attrib:
                        arr.append(self._parse_element(child))
                    else:
                        arr.append(child.text or '')
                result[tag] = arr

        # If element has only text content and no children/attrs
        if not result and elem.text and elem.text.strip():
            return elem.text  # type: ignore[return-value]

        # Mix of text + children: text goes in '#text' key
        if elem.text and elem.text.strip() and result:
            result['#text'] = elem.text

        return result

    @staticmethod
    def _local_name(tag: str) -> str:
        """Strip namespace URI from {uri}local tag."""
        if tag.startswith('{'):
            return tag.split('}', 1)[1]
        return tag


def _indent_tree(elem: ET.Element, level: int = 0, indent: str = '  ') -> None:
    """Add indentation to an ElementTree (in-place). Like ET.indent() in 3.9+."""
    i = '\n' + indent * level
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = i + indent
        for idx, child in enumerate(elem):
            _indent_tree(child, level + 1, indent)
            if idx < len(elem) - 1:
                if not child.tail or not child.tail.strip():
                    child.tail = i + indent
            else:
                if not child.tail or not child.tail.strip():
                    child.tail = i
    if level and (not elem.tail or not elem.tail.strip()):
        elem.tail = '\n' + indent * (level - 1)
