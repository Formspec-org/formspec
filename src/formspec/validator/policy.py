"""Lint policy and mode-specific severity behavior."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal

from .diagnostic import LintDiagnostic

LintMode = Literal["authoring", "strict"]

# Warnings that should be treated as hard failures in strict CI mode.
_STRICT_ESCALATIONS = frozenset(
    {
        "W800",  # unresolved bind references in component trees
        "W802",  # tolerated compatibility fallback
        "W803",  # duplicate editable input bindings
        "W804",  # summary/datatable nested bind resolution issues
    }
)


@dataclass(frozen=True, slots=True)
class LintPolicy:
    mode: LintMode = "authoring"

    def apply(self, diagnostics: list[LintDiagnostic]) -> list[LintDiagnostic]:
        """Apply mode-specific severity transforms to diagnostics."""
        if self.mode == "authoring":
            return diagnostics

        transformed: list[LintDiagnostic] = []
        for diagnostic in diagnostics:
            if diagnostic.severity == "warning" and diagnostic.code in _STRICT_ESCALATIONS:
                transformed.append(replace(diagnostic, severity="error"))
            else:
                transformed.append(diagnostic)
        return transformed


def make_policy(mode: LintMode = "authoring") -> LintPolicy:
    return LintPolicy(mode=mode)
