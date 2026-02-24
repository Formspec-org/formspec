"""Reusable test helpers for constructing minimal Formspec documents."""

from __future__ import annotations


def minimal_field(
    key: str = "f1",
    data_type: str = "string",
    **field_overrides,
) -> dict:
    field = {
        "key": key,
        "type": "field",
        "label": key.upper() if key else "F",
        "dataType": data_type,
    }
    field.update(field_overrides)
    return field


def minimal_group(
    key: str = "g1",
    children: list[dict] | None = None,
    **group_overrides,
) -> dict:
    group = {
        "key": key,
        "type": "group",
        "label": key.upper() if key else "G",
        "children": children or [minimal_field(key="c1")],
    }
    group.update(group_overrides)
    return group


def minimal_display(key: str = "d1", **display_overrides) -> dict:
    display = {
        "key": key,
        "type": "display",
        "label": key.upper() if key else "D",
    }
    display.update(display_overrides)
    return display


def base_definition(**overrides) -> dict:
    doc = {
        "$formspec": "1.0",
        "url": "https://example.com/forms/test",
        "version": "1.0.0",
        "status": "draft",
        "title": "Test Form",
        "items": [minimal_field()],
    }
    doc.update(overrides)
    return doc
