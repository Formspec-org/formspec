"""Pass 1: JSON Schema validation against Formspec document schemas (E100, E101).

Loads all schemas from the schemas/ directory into a jsonschema registry, detects
document type by heuristic, and classifies structural errors that gate downstream passes.
"""

from __future__ import annotations

import copy
import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import urllib.parse

from jsonschema import Draft202012Validator, FormatChecker, ValidationError
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from .diagnostic import LintDiagnostic

# Custom format checker: validates URI formats with urllib (no network, no rfc3987)
# and delegates all other formats to the default checker.
_SAFE_FORMAT_CHECKER = FormatChecker()

@_SAFE_FORMAT_CHECKER.checks("uri", raises=ValueError)
def _check_uri(instance):
    if not isinstance(instance, str):
        return True
    parsed = urllib.parse.urlparse(instance)
    if not parsed.scheme:
        raise ValueError(f"Not a valid URI: {instance!r}")
    return True

@_SAFE_FORMAT_CHECKER.checks("uri-reference", raises=ValueError)
def _check_uri_reference(instance):
    if not isinstance(instance, str):
        return True
    urllib.parse.urlparse(instance)
    return True


DocumentType = Literal[
    "definition",
    "response",
    "validation_report",
    "validation_result",
    "mapping",
    "registry",
    "theme",
    "component",
    "changelog",
    "fel_functions",
]

SCHEMA_FILES: dict[DocumentType, str] = {
    "definition": "definition.schema.json",
    "response": "response.schema.json",
    "validation_report": "validationReport.schema.json",
    "validation_result": "validationResult.schema.json",
    "mapping": "mapping.schema.json",
    "registry": "registry.schema.json",
    "theme": "theme.schema.json",
    "component": "component.schema.json",
    "changelog": "changelog.schema.json",
    "fel_functions": "fel-functions.schema.json",
}


def _schemas_dir() -> Path:
    """Resolve the monorepo schemas/ directory relative to this file."""
    return Path(__file__).resolve().parents[3] / "schemas"


def _load_schema(path: Path) -> dict[str, Any]:
    """Load and parse a JSON schema file from disk."""
    with open(path) as f:
        return json.load(f)


def _to_json_path(path: Sequence[Any]) -> str:
    """Convert a jsonschema absolute_path tuple to a JSONPath string (e.g. '$.items[0].key')."""
    json_path = "$"
    for part in path:
        if isinstance(part, int):
            json_path += f"[{part}]"
        elif isinstance(part, str) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", part):
            json_path += f".{part}"
        else:
            json_path += f"[{json.dumps(part)}]"
    return json_path


@dataclass(frozen=True, slots=True)
class SchemaValidationResult:
    """Output of schema validation: detected type, lint diagnostics, and raw jsonschema errors."""

    document_type: DocumentType | None
    diagnostics: list[LintDiagnostic]
    errors: list[ValidationError]


# ---------------------------------------------------------------------------
# Component schema helpers — avoid exponential oneOf + unevaluatedProperties
# ---------------------------------------------------------------------------

def _build_component_type_map(schema: dict[str, Any]) -> dict[str, str]:
    """Return {component_const_name: $defs_key} for all built-in component types.

    E.g. {"Page": "Page", "TextInput": "TextInput", ...}.
    Component names happen to match $defs keys 1:1 in the current schema.
    """
    defs = schema.get("$defs", {})
    any_component = defs.get("AnyComponent", {})
    type_map: dict[str, str] = {}
    for ref_obj in any_component.get("oneOf", []):
        ref = ref_obj.get("$ref", "")
        def_name = ref.rsplit("/", 1)[-1]
        if def_name == "CustomComponentRef":
            continue
        comp_def = defs.get(def_name, {})
        const = comp_def.get("properties", {}).get("component", {}).get("const")
        if const:
            type_map[const] = def_name
    return type_map


def _make_shallow_component_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Create a copy of the component schema with AnyComponent replaced by a
    permissive stub.  This lets jsonschema validate top-level document
    structure (version, targetDefinition, etc.) without descending into the
    expensive oneOf on every tree node.
    """
    shallow = copy.deepcopy(schema)
    # Replace AnyComponent with a permissive object schema
    shallow["$defs"]["AnyComponent"] = {
        "type": "object",
        "required": ["component"],
        "properties": {
            "component": {"type": "string", "minLength": 1}
        },
    }
    # Also neuter ChildrenArray so it doesn't recurse through AnyComponent
    shallow["$defs"]["ChildrenArray"] = {
        "type": "array",
        "items": {"$ref": "#/$defs/AnyComponent"},
    }
    return shallow


def _walk_component_nodes(
    node: Any,
    path: tuple[str | int, ...],
) -> list[tuple[tuple[str | int, ...], dict[str, Any]]]:
    """Yield (json_path_parts, node_dict) for every component node in the tree."""
    if not isinstance(node, dict) or "component" not in node:
        return []
    results: list[tuple[tuple[str | int, ...], dict[str, Any]]] = [(path, node)]
    # Recurse into children arrays
    children = node.get("children")
    if isinstance(children, list):
        for i, child in enumerate(children):
            results.extend(
                _walk_component_nodes(child, (*path, "children", i))
            )
    return results


class SchemaValidator:
    """Loads all Formspec JSON schemas into a Draft 2020-12 registry and validates documents against them."""

    def __init__(self, schema_dir: Path | None = None):
        """Load all schemas, build cross-referencing validator registry."""
        self.schema_dir = schema_dir or _schemas_dir()
        self.schemas: dict[DocumentType, dict[str, Any]] = {
            doc_type: _load_schema(self.schema_dir / filename)
            for doc_type, filename in SCHEMA_FILES.items()
        }

        resources = []
        for doc_type, schema in self.schemas.items():
            schema_id = schema.get("$id", f"urn:formspec:{doc_type}")
            resources.append(
                (
                    schema_id,
                    Resource.from_contents(schema, default_specification=DRAFT202012),
                )
            )

        registry = Registry().with_resources(resources)
        self.validators: dict[DocumentType, Draft202012Validator] = {
            doc_type: Draft202012Validator(
                schema,
                registry=registry,
                format_checker=_SAFE_FORMAT_CHECKER,
            )
            for doc_type, schema in self.schemas.items()
        }

        # Build component-specific validation infrastructure
        comp_schema = self.schemas.get("component")
        if comp_schema:
            self._component_type_map = _build_component_type_map(comp_schema)
            self._component_defs = comp_schema.get("$defs", {})

            # Shallow schema: AnyComponent replaced with a permissive stub so
            # that tree recursion doesn't trigger the expensive oneOf.
            shallow_schema = _make_shallow_component_schema(comp_schema)
            shallow_id = shallow_schema.get("$id", "urn:formspec:component")
            shallow_resources = list(resources) + [
                (
                    shallow_id,
                    Resource.from_contents(shallow_schema, default_specification=DRAFT202012),
                )
            ]
            shallow_registry = Registry().with_resources(shallow_resources)

            # Top-level validator: checks document structure with neutered AnyComponent
            self._component_shallow_validator = Draft202012Validator(
                shallow_schema,
                registry=shallow_registry,
                format_checker=_SAFE_FORMAT_CHECKER,
            )

            # Per-type validators: validate individual nodes against their specific
            # $defs schema, using the shallow registry so children refs don't explode.
            self._component_node_validators: dict[str, Draft202012Validator] = {}
            for comp_name, def_key in self._component_type_map.items():
                # Use the shallow schema's $id so $ref resolves against it
                node_schema = {"$ref": f"{shallow_id}#/$defs/{def_key}"}
                v = Draft202012Validator(
                    node_schema,
                    registry=shallow_registry,
                    format_checker=_SAFE_FORMAT_CHECKER,
                )
                self._component_node_validators[comp_name] = v

            # CustomComponentRef validator for unknown component names
            custom_ref_schema = {"$ref": f"{shallow_id}#/$defs/CustomComponentRef"}
            self._component_custom_ref_validator = Draft202012Validator(
                custom_ref_schema,
                registry=shallow_registry,
                format_checker=_SAFE_FORMAT_CHECKER,
            )

    def detect_document_type(self, document: Any) -> DocumentType | None:
        """Heuristic type detection using sentinel keys ($formspec, $formspecTheme, etc.)."""
        if not isinstance(document, dict):
            return None

        if "$formspec" in document:
            return "definition"
        if "$formspecTheme" in document:
            return "theme"
        if "$formspecComponent" in document:
            return "component"
        if "$formspecRegistry" in document:
            return "registry"

        keys = set(document.keys())
        if {"path", "severity", "constraintKind", "message"}.issubset(keys):
            return "validation_result"
        if {"version", "functions"}.issubset(keys):
            return "fel_functions"
        if {"fromVersion", "toVersion", "changes"}.issubset(keys):
            return "changelog"
        if {"definitionUrl", "data"}.issubset(keys):
            return "response"
        if {"valid", "counts", "results"}.issubset(keys):
            return "validation_report"
        if {"targetSchema", "rules"}.issubset(keys):
            return "mapping"

        return None

    def _validate_component(self, document: dict[str, Any]) -> list[ValidationError]:
        """Validate a component document using pre-dispatched per-node validation.

        Instead of running the full schema (with its 37-variant oneOf at
        AnyComponent) against the entire document — which causes exponential
        backtracking in jsonschema — we:

        1. Validate top-level structure with a "shallow" schema where
           AnyComponent is a permissive stub.
        2. Walk the component tree and validate each node individually
           against its specific type schema (O(n) total).
        """
        errors: list[ValidationError] = []

        # Step 1: validate top-level document structure
        for err in self._component_shallow_validator.iter_errors(document):
            errors.append(err)

        # Step 2: walk tree nodes and validate each against its specific type
        tree = document.get("tree")
        if isinstance(tree, dict):
            self._validate_component_tree(tree, ("tree",), errors)

        # Step 3: walk custom component template trees
        components = document.get("components")
        if isinstance(components, dict):
            for comp_name, comp_def in components.items():
                if isinstance(comp_def, dict):
                    template_tree = comp_def.get("tree")
                    if isinstance(template_tree, dict):
                        self._validate_component_tree(
                            template_tree,
                            ("components", comp_name, "tree"),
                            errors,
                        )

        return errors

    def _validate_component_tree(
        self,
        tree: dict[str, Any],
        base_path: tuple[str | int, ...],
        errors: list[ValidationError],
    ) -> None:
        """Walk a component tree and validate each node against its specific type schema."""
        for path_parts, node in _walk_component_nodes(tree, base_path):
            comp_name = node.get("component", "")
            if comp_name in self._component_node_validators:
                validator = self._component_node_validators[comp_name]
            else:
                validator = self._component_custom_ref_validator

            for err in validator.iter_errors(node):
                # Prefix the error's path with the node's location in the document
                err.absolute_path.extendleft(reversed(path_parts))
                errors.append(err)

    def validate(
        self,
        document: Any,
        document_type: DocumentType | None = None,
    ) -> SchemaValidationResult:
        """Validate document against its schema. Emits E100 (unknown type) or E101 (schema violation)."""
        detected = document_type or self.detect_document_type(document)
        if detected is None:
            return SchemaValidationResult(
                document_type=None,
                diagnostics=[
                    LintDiagnostic(
                        severity="error",
                        code="E100",
                        message="Unable to detect Formspec document type",
                        path="$",
                        category="schema",
                    )
                ],
                errors=[],
            )

        if detected == "component":
            errors = sorted(
                self._validate_component(document),
                key=lambda e: list(e.absolute_path),
            )
        else:
            validator = self.validators[detected]
            errors = sorted(validator.iter_errors(document), key=lambda e: list(e.absolute_path))

        diagnostics: list[LintDiagnostic] = []
        for error in errors:
            diagnostics.append(
                LintDiagnostic(
                    severity="error",
                    code="E101",
                    message=error.message,
                    path=_to_json_path(error.absolute_path),
                    category="schema",
                    detail=str(error),
                )
            )

        return SchemaValidationResult(detected, diagnostics, errors)


def is_structural_schema_error(error: ValidationError) -> bool:
    """True when a schema violation makes the item/rule tree too broken for semantic passes."""
    path = list(error.absolute_path)

    if not path and error.validator in {"type", "required"}:
        return True

    if path and path[0] in {"items", "tree", "changes", "rules"}:
        if error.validator in {"type", "minItems", "required", "anyOf", "oneOf"}:
            return True

    if not path and error.validator == "required":
        missing = _missing_required_name(error.message)
        if missing in {"items", "tree", "rules", "changes"}:
            return True

    return False


def has_structural_schema_errors(errors: Sequence[ValidationError]) -> bool:
    """True if any error is structural, used to gate all downstream linter passes."""
    return any(is_structural_schema_error(error) for error in errors)


def _missing_required_name(message: str) -> str | None:
    """Extract the property name from a jsonschema 'X is a required property' message."""
    match = re.search(r"'([^']+)' is a required property", message)
    if not match:
        return None
    return match.group(1)
