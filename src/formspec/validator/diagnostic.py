"""Diagnostic dataclass and severity/category type aliases used by all linter passes."""

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
    "extension",
]


@dataclass(frozen=True, slots=True)
class LintDiagnostic:
    """Frozen diagnostic emitted by any linter pass: severity + coded rule + JSON-path location."""

    severity: LintSeverity
    code: str
    message: str
    path: str
    category: LintCategory
    detail: str | None = None


def sort_key(diag: LintDiagnostic) -> tuple[str, int, str, str]:
    """Deterministic sort key: path, then severity (error first), then code, then message."""
    severity_order = {"error": 0, "warning": 1, "info": 2}
    return (diag.path, severity_order[diag.severity], diag.code, diag.message)
