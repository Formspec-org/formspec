"""Diagnostic types for Formspec static linting."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

LintSeverity = Literal["error", "warning", "info"]
LintCategory = Literal[
    "schema",
    "reference",
    "expression",
    "dependency",
    "tree",
    "theme",
    "component",
]


@dataclass(frozen=True, slots=True)
class LintDiagnostic:
    """A single linter finding mapped to a JSON-path-like location."""

    severity: LintSeverity
    code: str
    message: str
    path: str
    category: LintCategory
    detail: str | None = None


def sort_key(diag: LintDiagnostic) -> tuple[str, int, str, str]:
    """Stable sort key for diagnostics."""
    severity_order = {"error": 0, "warning": 1, "info": 2}
    return (diag.path, severity_order[diag.severity], diag.code, diag.message)
