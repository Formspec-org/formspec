"""Pass 1: JSON Schema validation against Formspec document schemas (E100, E101).

Loads all schemas from the schemas/ directory into a jsonschema registry, detects
document type by heuristic, and classifies structural errors that gate downstream passes.
"""

from __future__ import annotations

import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from jsonschema import Draft202012Validator, ValidationError
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from .diagnostic import LintDiagnostic

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
                format_checker=Draft202012Validator.FORMAT_CHECKER,
            )
            for doc_type, schema in self.schemas.items()
        }

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
