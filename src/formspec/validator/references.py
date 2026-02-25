"""Reference integrity checks for Formspec definition documents."""

from __future__ import annotations

import re

from .diagnostic import LintDiagnostic
from .tree import ItemTreeIndex, ItemRef

_SEGMENT_RE = re.compile(r"^([A-Za-z][A-Za-z0-9_]*)(?:\[(\*|\d+)\])?$")
# Per spec §4.3.1, optionSet is valid on choice and multiChoice fields in addition to
# plain scalar types that use inline option lists.
_OPTIONSET_COMPATIBLE_TYPES = {"string", "integer", "decimal", "choice", "multiChoice"}


def check_references(document: dict, index: ItemTreeIndex) -> list[LintDiagnostic]:
    diagnostics: list[LintDiagnostic] = []

    binds = document.get("binds", [])
    if isinstance(binds, list):
        for bind_index, bind in enumerate(binds):
            if not isinstance(bind, dict):
                continue
            path = bind.get("path")
            if not isinstance(path, str):
                continue
            message = validate_item_path(path, index)
            if message:
                diagnostics.append(
                    LintDiagnostic(
                        severity="error",
                        code="E300",
                        message=message,
                        path=f"$.binds[{bind_index}].path",
                        category="reference",
                    )
                )

    shapes = document.get("shapes", [])
    if isinstance(shapes, list):
        for shape_index, shape in enumerate(shapes):
            if not isinstance(shape, dict):
                continue
            target = shape.get("target")
            if not isinstance(target, str):
                continue
            message = validate_item_path(target, index)
            if message:
                diagnostics.append(
                    LintDiagnostic(
                        severity="error",
                        code="E301",
                        message=message,
                        path=f"$.shapes[{shape_index}].target",
                        category="reference",
                    )
                )

    option_sets = document.get("optionSets")
    option_set_keys = set(option_sets.keys()) if isinstance(option_sets, dict) else set()

    for item in index.by_full_path.values():
        diagnostics.extend(_check_item_option_set(item, option_set_keys))

    return diagnostics


def canonical_item_path(path: str) -> str:
    """Normalize bind/target paths to a dot-separated key path."""
    trimmed = path.strip()
    if trimmed.startswith("$."):
        trimmed = trimmed[2:]
    if trimmed.startswith("/"):
        trimmed = trimmed[1:]
    trimmed = trimmed.replace("/", ".")
    return ".".join(segment for segment in trimmed.split(".") if segment)


def validate_item_path(path: str, index: ItemTreeIndex) -> str | None:
    """Return an error message when the path does not resolve; otherwise None."""
    # "#" is the spec-defined sentinel for the form root scope (shapes §5.2).
    if path.strip() == "#":
        return None

    normalized = canonical_item_path(path)
    if not normalized:
        return "Path is empty"

    parsed_segments: list[tuple[str, str | None]] = []
    for raw_segment in normalized.split("."):
        match = _SEGMENT_RE.match(raw_segment)
        if not match:
            return f"Path '{path}' contains an invalid segment '{raw_segment}'"
        parsed_segments.append((match.group(1), match.group(2)))

    has_wildcard = any(mod == "*" for _, mod in parsed_segments)
    names = [name for name, _ in parsed_segments]

    if not has_wildcard:
        joined = ".".join(names)
        if joined in index.by_full_path:
            return None
        if len(names) == 1 and names[0] in index.by_key:
            return None
        return f"Path '{path}' does not resolve to any item"

    wildcard_pos = next(i for i, (_, mod) in enumerate(parsed_segments) if mod == "*")
    group_path = ".".join(names[: wildcard_pos + 1])

    group_ref = index.by_full_path.get(group_path)
    if group_ref is None and wildcard_pos == 0 and names[0] in index.by_key:
        candidate = index.by_key[names[0]]
        if candidate.item_type == "group":
            group_ref = candidate
            group_path = candidate.full_path

    if group_ref is None or group_ref.item_type != "group":
        return f"Wildcard path '{path}' does not reference a valid group"

    if group_ref.full_path not in index.repeatable_groups:
        return f"Wildcard path '{path}' targets group '{group_ref.full_path}' which is not repeatable"

    remainder = names[wildcard_pos + 1 :]
    if not remainder:
        return None

    suffix = ".".join(remainder)
    if _has_descendant(group_ref.full_path, suffix, index):
        return None

    return f"Wildcard path '{path}' does not resolve within repeatable group '{group_ref.full_path}'"


def _has_descendant(group_full_path: str, suffix: str, index: ItemTreeIndex) -> bool:
    prefix = f"{group_full_path}."
    exact = f"{prefix}{suffix}"
    if exact in index.by_full_path:
        return True

    for candidate in index.by_full_path:
        if not candidate.startswith(prefix):
            continue
        if candidate.endswith(f".{suffix}") or candidate == exact:
            return True
    return False


def _check_item_option_set(item: ItemRef, option_set_keys: set[str]) -> list[LintDiagnostic]:
    diagnostics: list[LintDiagnostic] = []
    if item.item_type != "field":
        return diagnostics

    option_set = item.item.get("optionSet")
    if not isinstance(option_set, str):
        return diagnostics

    path = f"{item.json_path}.optionSet"
    if option_set not in option_set_keys:
        diagnostics.append(
            LintDiagnostic(
                severity="error",
                code="E302",
                message=f"Field optionSet '{option_set}' is not defined in $.optionSets",
                path=path,
                category="reference",
            )
        )

    data_type = item.item.get("dataType")
    if data_type not in _OPTIONSET_COMPATIBLE_TYPES:
        diagnostics.append(
            LintDiagnostic(
                severity="warning",
                code="W300",
                message=(
                    "Field dataType is incompatible with optionSet; expected one of "
                    "string, integer, decimal"
                ),
                path=path,
                category="reference",
            )
        )

    return diagnostics
