"""Component document semantic checks (E800-E807, W800-W804).

Validates the component tree: root must be a layout component, bind references must resolve
to definition fields, input components must be type-compatible with their bound field,
editable bindings must be unique, Wizard children must be Pages, custom component params
must be provided, and custom component reference graphs must be acyclic.
"""

from __future__ import annotations

from dataclasses import dataclass

from .component_matrix import (
    INPUT_COMPONENTS,
    classify_compatibility,
    requires_options_source,
)
from .diagnostic import LintDiagnostic
from .references import canonical_item_path

_LAYOUT_ROOTS = {
    "Page",
    "Stack",
    "Grid",
    "Wizard",
    "Columns",
    "Tabs",
    "Accordion",
    "Panel",
    "Card",
    "Collapsible",
    "ConditionalGroup",
    "Modal",
}

_LAYOUT_COMPONENTS = {"Page", "Stack", "Grid", "Wizard", "Spacer"}
_CONTAINER_COMPONENTS = {
    "Card",
    "Collapsible",
    "ConditionalGroup",
    "Columns",
    "Tabs",
    "Accordion",
    "Panel",
    "Modal",
    "Popover",
    "DataTable",
}

_BUILTIN_COMPONENTS = {
    "Page",
    "Stack",
    "Grid",
    "Wizard",
    "Spacer",
    "TextInput",
    "NumberInput",
    "DatePicker",
    "Select",
    "CheckboxGroup",
    "Toggle",
    "FileUpload",
    "Heading",
    "Text",
    "Divider",
    "Card",
    "Collapsible",
    "ConditionalGroup",
    "Columns",
    "Tabs",
    "Accordion",
    "RadioGroup",
    "MoneyInput",
    "Slider",
    "Rating",
    "Signature",
    "Alert",
    "Badge",
    "ProgressBar",
    "Summary",
    "DataTable",
    "Panel",
    "Modal",
    "Popover",
}


@dataclass(frozen=True, slots=True)
class FieldInfo:
    """Resolved field metadata from the definition document, used for bind compatibility checks."""

    key: str
    full_path: str
    data_type: str
    has_options_source: bool


@dataclass(slots=True)
class _WalkContext:
    """Mutable accumulator threaded through the recursive tree walk."""

    custom_names: set[str]
    custom_defs: dict[str, dict]
    fields: dict[str, FieldInfo]
    first_editable_binding: dict[str, str]


def lint_component_semantics(
    component_doc: dict,
    definition_doc: dict | None = None,
) -> list[LintDiagnostic]:
    """Entry point: validate component tree structure, bind integrity, type compatibility, and custom component cycles."""
    diagnostics: list[LintDiagnostic] = []

    root_tree = component_doc.get("tree")
    custom_components = component_doc.get("components")
    custom_defs = custom_components if isinstance(custom_components, dict) else {}
    custom_names = set(custom_defs.keys())

    if isinstance(root_tree, dict):
        root_name = root_tree.get("component")
        if isinstance(root_name, str) and root_name not in _LAYOUT_ROOTS:
            diagnostics.append(
                LintDiagnostic(
                    severity="error",
                    code="E800",
                    message=f"Root component '{root_name}' must be a layout component",
                    path="$.tree.component",
                    category="component",
                )
            )

    diagnostics.extend(_detect_custom_component_cycles(custom_defs))

    context = _WalkContext(
        custom_names=custom_names,
        custom_defs=custom_defs,
        fields=_build_field_lookup(definition_doc) if isinstance(definition_doc, dict) else {},
        first_editable_binding={},
    )

    if isinstance(root_tree, dict):
        diagnostics.extend(_walk_component_tree(root_tree, "$.tree", context))

    if isinstance(custom_defs, dict):
        for name, component_def in custom_defs.items():
            if not isinstance(component_def, dict):
                continue
            tree = component_def.get("tree")
            if isinstance(tree, dict):
                diagnostics.extend(
                    _walk_component_tree(
                        tree,
                        f"$.components[{name!r}].tree",
                        context,
                    )
                )

    return diagnostics


def _walk_component_tree(
    node: dict,
    path: str,
    context: _WalkContext,
) -> list[LintDiagnostic]:
    """Recursive tree walk: run all per-node checks then recurse into children."""
    diagnostics: list[LintDiagnostic] = []
    component_name = node.get("component")

    if isinstance(component_name, str):
        diagnostics.extend(_check_component_reference(component_name, path, context))
        diagnostics.extend(_check_custom_component_params(component_name, node, path, context))
        diagnostics.extend(_check_wizard_children(component_name, node, path))
        diagnostics.extend(_check_binds(component_name, node, path, context))
        diagnostics.extend(_check_summary_items(component_name, node, path, context.fields))
        diagnostics.extend(_check_datatable_columns(component_name, node, path, context.fields))

    children = node.get("children")
    if isinstance(children, list):
        for i, child in enumerate(children):
            if isinstance(child, dict):
                diagnostics.extend(
                    _walk_component_tree(child, f"{path}.children[{i}]", context)
                )

    return diagnostics


def _check_component_reference(
    component_name: str,
    path: str,
    context: _WalkContext,
) -> list[LintDiagnostic]:
    """E801: component name must be a built-in or defined custom component."""
    if component_name in _BUILTIN_COMPONENTS or component_name in context.custom_names:
        return []

    return [
        LintDiagnostic(
            severity="error",
            code="E801",
            message=f"Custom component '{component_name}' is not defined in $.components",
            path=f"{path}.component",
            category="component",
        )
    ]


def _check_custom_component_params(
    component_name: str,
    node: dict,
    path: str,
    context: _WalkContext,
) -> list[LintDiagnostic]:
    """E806: custom component invocations must provide all required params."""
    if component_name not in context.custom_names:
        return []

    template = context.custom_defs.get(component_name)
    if not isinstance(template, dict):
        return []

    required_params_raw = template.get("params")
    required_params = [p for p in required_params_raw if isinstance(p, str)] if isinstance(required_params_raw, list) else []
    if not required_params:
        return []

    provided_raw = node.get("params")
    provided = set(provided_raw.keys()) if isinstance(provided_raw, dict) else set()

    missing = [name for name in required_params if name not in provided]
    if not missing:
        return []

    return [
        LintDiagnostic(
            severity="error",
            code="E806",
            message=(
                f"Custom component '{component_name}' is missing required params: {missing}"
            ),
            path=f"{path}.params",
            category="component",
        )
    ]


def _check_wizard_children(component_name: str, node: dict, path: str) -> list[LintDiagnostic]:
    """E805: Wizard direct children must all be Page components."""
    if component_name != "Wizard":
        return []

    diagnostics: list[LintDiagnostic] = []
    children = node.get("children")
    if not isinstance(children, list):
        return diagnostics

    for index, child in enumerate(children):
        if not isinstance(child, dict):
            continue
        if child.get("component") != "Page":
            diagnostics.append(
                LintDiagnostic(
                    severity="error",
                    code="E805",
                    message="Wizard children must be Page components",
                    path=f"{path}.children[{index}].component",
                    category="component",
                )
            )

    return diagnostics


def _check_binds(
    component_name: str,
    node: dict,
    path: str,
    context: _WalkContext,
) -> list[LintDiagnostic]:
    """Central bind validation: W800 (unresolved), W801 (layout/container), E802/W802 (type compat), E803 (options), E804 (richtext), W803 (dup editable)."""
    bind_value = node.get("bind")
    if not isinstance(bind_value, str):
        return []

    diagnostics: list[LintDiagnostic] = []

    if component_name in _LAYOUT_COMPONENTS:
        diagnostics.append(
            LintDiagnostic(
                severity="warning",
                code="W801",
                message=f"Layout component '{component_name}' should not declare a bind",
                path=f"{path}.bind",
                category="component",
            )
        )
        return diagnostics

    if component_name in _CONTAINER_COMPONENTS and component_name != "DataTable":
        diagnostics.append(
            LintDiagnostic(
                severity="warning",
                code="W801",
                message=(
                    f"Container component '{component_name}' should not declare a bind "
                    "(DataTable is the only exception)"
                ),
                path=f"{path}.bind",
                category="component",
            )
        )
        return diagnostics

    field = _resolve_field(bind_value, context.fields)
    if field is None:
        diagnostics.append(
            LintDiagnostic(
                severity="warning",
                code="W800",
                message=(
                    f"Component bind '{bind_value}' does not resolve to a field in the supplied definition"
                ),
                path=f"{path}.bind",
                category="component",
            )
        )
        return diagnostics

    if component_name in INPUT_COMPONENTS:
        diagnostics.extend(
            _check_input_component_compatibility(component_name, bind_value, field, path)
        )
        diagnostics.extend(_check_editable_uniqueness(component_name, field, path, context))

    if component_name == "TextInput" and node.get("inputMode") == "richtext" and field.data_type != "string":
        diagnostics.append(
            LintDiagnostic(
                severity="error",
                code="E804",
                message="TextInput with inputMode='richtext' must bind to a string field",
                path=f"{path}.bind",
                category="component",
            )
        )

    return diagnostics


def _check_input_component_compatibility(
    component_name: str,
    bind_value: str,
    field: FieldInfo,
    path: str,
) -> list[LintDiagnostic]:
    """E802 (incompatible type), W802 (fallback warning), E803 (missing options source)."""
    diagnostics: list[LintDiagnostic] = []

    compat = classify_compatibility(component_name, field.data_type)
    if compat == "incompatible":
        diagnostics.append(
            LintDiagnostic(
                severity="error",
                code="E802",
                message=(
                    f"Component '{component_name}' is incompatible with field type "
                    f"'{field.data_type}' for bind '{bind_value}'"
                ),
                path=f"{path}.bind",
                category="component",
            )
        )
    elif compat == "compatible_with_warning":
        diagnostics.append(
            LintDiagnostic(
                severity="warning",
                code="W802",
                message=(
                    f"Component '{component_name}' binds '{field.data_type}' via fallback compatibility; "
                    "prefer a type-specific component"
                ),
                path=f"{path}.bind",
                category="component",
            )
        )

    if requires_options_source(component_name) and not field.has_options_source:
        diagnostics.append(
            LintDiagnostic(
                severity="error",
                code="E803",
                message=(
                    f"Component '{component_name}' requires field options from `options` or `optionSet`; "
                    f"bind '{bind_value}' has neither"
                ),
                path=f"{path}.bind",
                category="component",
            )
        )

    return diagnostics


def _check_editable_uniqueness(
    component_name: str,
    field: FieldInfo,
    path: str,
    context: _WalkContext,
) -> list[LintDiagnostic]:
    """W803: warn when multiple input components bind to the same field."""
    if component_name not in INPUT_COMPONENTS:
        return []

    current_path = f"{path}.bind"
    if field.full_path in context.first_editable_binding:
        prior_path = context.first_editable_binding[field.full_path]
        return [
            LintDiagnostic(
                severity="warning",
                code="W803",
                message=(
                    f"Multiple editable inputs bind to '{field.full_path}' "
                    f"(first at {prior_path})"
                ),
                path=current_path,
                category="component",
            )
        ]

    context.first_editable_binding[field.full_path] = current_path
    return []


def _check_summary_items(
    component_name: str,
    node: dict,
    path: str,
    fields: dict[str, FieldInfo],
) -> list[LintDiagnostic]:
    """W804: Summary component item binds must resolve to definition fields."""
    if component_name != "Summary":
        return []

    diagnostics: list[LintDiagnostic] = []
    items = node.get("items")
    if not isinstance(items, list):
        return diagnostics

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        bind_value = item.get("bind")
        if not isinstance(bind_value, str):
            continue
        if _resolve_field(bind_value, fields) is None:
            diagnostics.append(
                LintDiagnostic(
                    severity="warning",
                    code="W804",
                    message=f"Summary item bind '{bind_value}' does not resolve to a field",
                    path=f"{path}.items[{index}].bind",
                    category="component",
                )
            )

    return diagnostics


def _check_datatable_columns(
    component_name: str,
    node: dict,
    path: str,
    fields: dict[str, FieldInfo],
) -> list[LintDiagnostic]:
    """W804: DataTable column binds must resolve to definition fields."""
    if component_name != "DataTable":
        return []

    diagnostics: list[LintDiagnostic] = []
    columns = node.get("columns")
    if not isinstance(columns, list):
        return diagnostics

    for index, column in enumerate(columns):
        if not isinstance(column, dict):
            continue
        bind_value = column.get("bind")
        if not isinstance(bind_value, str):
            continue
        if _resolve_field(bind_value, fields) is None:
            diagnostics.append(
                LintDiagnostic(
                    severity="warning",
                    code="W804",
                    message=f"DataTable column bind '{bind_value}' does not resolve to a field",
                    path=f"{path}.columns[{index}].bind",
                    category="component",
                )
            )

    return diagnostics


def _detect_custom_component_cycles(custom_defs: dict[str, dict]) -> list[LintDiagnostic]:
    """E807: detect cycles in the custom component reference graph via DFS."""
    graph: dict[str, set[str]] = {name: set() for name in custom_defs}

    for name, definition in custom_defs.items():
        if not isinstance(definition, dict):
            continue
        tree = definition.get("tree")
        if isinstance(tree, dict):
            graph[name] = _collect_custom_refs(tree, set(custom_defs.keys()))

    diagnostics: list[LintDiagnostic] = []
    visited: set[str] = set()
    in_stack: set[str] = set()
    stack: list[str] = []

    def dfs(node: str) -> None:
        if node in in_stack:
            start = stack.index(node)
            cycle = stack[start:] + [node]
            diagnostics.append(
                LintDiagnostic(
                    severity="error",
                    code="E807",
                    message=f"Custom component cycle detected: {' -> '.join(cycle)}",
                    path=f"$.components[{node!r}].tree",
                    category="component",
                )
            )
            return

        if node in visited:
            return

        visited.add(node)
        in_stack.add(node)
        stack.append(node)

        for dep in sorted(graph.get(node, set())):
            dfs(dep)

        stack.pop()
        in_stack.remove(node)

    for component_name in sorted(graph):
        dfs(component_name)

    # Deduplicate exact duplicate cycle messages.
    seen: set[tuple[str, str]] = set()
    unique: list[LintDiagnostic] = []
    for diagnostic in diagnostics:
        key = (diagnostic.path, diagnostic.message)
        if key in seen:
            continue
        seen.add(key)
        unique.append(diagnostic)

    return unique


def _collect_custom_refs(node: dict, custom_names: set[str]) -> set[str]:
    """Recursively collect custom component names referenced in a component subtree."""
    refs: set[str] = set()

    component_name = node.get("component")
    if isinstance(component_name, str) and component_name in custom_names:
        refs.add(component_name)

    children = node.get("children")
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict):
                refs.update(_collect_custom_refs(child, custom_names))

    return refs


def _resolve_field(bind_value: str, fields: dict[str, FieldInfo]) -> FieldInfo | None:
    """Resolve a bind value to a FieldInfo, trying canonical full path then short key fallback."""
    canonical = canonical_item_path(bind_value)
    field = fields.get(canonical)
    if field is not None:
        return field

    short_name = canonical.split(".")[-1]
    return fields.get(short_name)


def _build_field_lookup(definition_doc: dict | None) -> dict[str, FieldInfo]:
    """Walk definition items to build a field lookup keyed by both full path and short key."""
    if not isinstance(definition_doc, dict):
        return {}

    lookup: dict[str, FieldInfo] = {}

    def walk(items: object, chain: tuple[str, ...]) -> None:
        if not isinstance(items, list):
            return

        for item in items:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            if not isinstance(key, str):
                continue

            full = ".".join((*chain, key))
            if item.get("type") == "field":
                data_type = item.get("dataType")
                if isinstance(data_type, str):
                    has_options = isinstance(item.get("optionSet"), str) or item.get("options") is not None
                    info = FieldInfo(
                        key=key,
                        full_path=full,
                        data_type=data_type,
                        has_options_source=has_options,
                    )
                    lookup.setdefault(full, info)
                    lookup.setdefault(key, info)

            walk(item.get("children"), (*chain, key))

    walk(definition_doc.get("items"), ())
    return lookup
