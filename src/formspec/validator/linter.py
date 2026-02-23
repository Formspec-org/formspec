"""Main linter orchestration for Formspec static analysis."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .component import lint_component_semantics
from .dependencies import analyze_dependencies
from .diagnostic import LintDiagnostic, sort_key
from .expressions import compile_expressions
from .policy import LintMode, LintPolicy
from .references import check_references
from .schema import SchemaValidator, has_structural_schema_errors
from .theme import lint_theme_semantics
from .tree import build_item_index


@dataclass(slots=True)
class FormspecLinter:
    schema_validator: SchemaValidator
    policy: LintPolicy

    def __init__(
        self,
        schema_validator: SchemaValidator | None = None,
        policy: LintPolicy | None = None,
    ):
        self.schema_validator = schema_validator or SchemaValidator()
        self.policy = policy or LintPolicy()

    def lint(
        self,
        document: Any,
        *,
        schema_only: bool = False,
        no_fel: bool = False,
        component_definition: dict[str, Any] | None = None,
    ) -> list[LintDiagnostic]:
        schema_result = self.schema_validator.validate(document)
        diagnostics = list(schema_result.diagnostics)

        if schema_result.document_type is None:
            return sorted(self.policy.apply(diagnostics), key=sort_key)

        if schema_only:
            return sorted(self.policy.apply(diagnostics), key=sort_key)

        # Stop semantic passes for documents that are structurally invalid.
        if has_structural_schema_errors(schema_result.errors):
            return sorted(self.policy.apply(diagnostics), key=sort_key)

        if not isinstance(document, dict):
            return sorted(self.policy.apply(diagnostics), key=sort_key)

        if schema_result.document_type == "definition":
            tree_index = build_item_index(document)
            diagnostics.extend(tree_index.diagnostics)
            diagnostics.extend(check_references(document, tree_index))

            if not no_fel:
                compilation = compile_expressions(document)
                diagnostics.extend(compilation.diagnostics)
                dependencies = analyze_dependencies(compilation.compiled)
                diagnostics.extend(dependencies.diagnostics)

        elif schema_result.document_type == "theme":
            diagnostics.extend(lint_theme_semantics(document))

        elif schema_result.document_type == "component":
            diagnostics.extend(
                lint_component_semantics(
                    document,
                    definition_doc=component_definition,
                )
            )

        return sorted(self.policy.apply(diagnostics), key=sort_key)


def lint(
    document: Any,
    *,
    schema_only: bool = False,
    no_fel: bool = False,
    mode: LintMode = "authoring",
    component_definition: dict[str, Any] | None = None,
) -> list[LintDiagnostic]:
    """Convenience API for one-shot linting."""
    return FormspecLinter(policy=LintPolicy(mode=mode)).lint(
        document,
        schema_only=schema_only,
        no_fel=no_fel,
        component_definition=component_definition,
    )
