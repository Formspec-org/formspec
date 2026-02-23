"""Tree indexing for Formspec definition items."""

from __future__ import annotations

from dataclasses import dataclass, field

from .diagnostic import LintDiagnostic


@dataclass(frozen=True, slots=True)
class ItemRef:
    key: str
    full_path: str
    json_path: str
    parent_full_path: str | None
    item_type: str
    item: dict


@dataclass(slots=True)
class ItemTreeIndex:
    by_key: dict[str, ItemRef] = field(default_factory=dict)
    by_full_path: dict[str, ItemRef] = field(default_factory=dict)
    repeatable_groups: set[str] = field(default_factory=set)
    diagnostics: list[LintDiagnostic] = field(default_factory=list)


def build_item_index(document: dict) -> ItemTreeIndex:
    """Build a flattened index of all items in a definition document."""
    index = ItemTreeIndex()
    items = document.get("items", [])
    if not isinstance(items, list):
        return index

    for i, item in enumerate(items):
        _walk_item(item, f"$.items[{i}]", (), None, index)

    return index


def _walk_item(
    item: object,
    json_path: str,
    chain: tuple[str, ...],
    parent_full_path: str | None,
    index: ItemTreeIndex,
) -> None:
    if not isinstance(item, dict):
        return

    key = item.get("key")
    if not isinstance(key, str):
        return

    full_path = ".".join((*chain, key))
    item_type = item.get("type") if isinstance(item.get("type"), str) else ""
    ref = ItemRef(
        key=key,
        full_path=full_path,
        json_path=json_path,
        parent_full_path=parent_full_path,
        item_type=item_type,
        item=item,
    )

    if key in index.by_key:
        prior = index.by_key[key]
        index.diagnostics.append(
            LintDiagnostic(
                severity="error",
                code="E200",
                message=(
                    f"Duplicate item key '{key}' creates ambiguous references "
                    f"(first seen at {prior.json_path})"
                ),
                path=json_path,
                category="tree",
            )
        )
    else:
        index.by_key[key] = ref

    if full_path in index.by_full_path:
        index.diagnostics.append(
            LintDiagnostic(
                severity="error",
                code="E201",
                message=f"Duplicate item path '{full_path}'",
                path=json_path,
                category="tree",
            )
        )
    else:
        index.by_full_path[full_path] = ref

    if item_type == "group" and item.get("repeatable") is True:
        index.repeatable_groups.add(full_path)

    children = item.get("children")
    if isinstance(children, list):
        next_chain = (*chain, key)
        for child_index, child in enumerate(children):
            _walk_item(
                child,
                f"{json_path}.children[{child_index}]",
                next_chain,
                full_path,
                index,
            )
