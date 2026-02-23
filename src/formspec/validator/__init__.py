"""Formspec static linter API."""

from .diagnostic import LintDiagnostic
from .linter import FormspecLinter, lint
from .policy import LintPolicy, make_policy

__all__ = ["FormspecLinter", "LintDiagnostic", "LintPolicy", "make_policy", "lint"]
