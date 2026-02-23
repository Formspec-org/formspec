"""FEL error types and diagnostics."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


@dataclass(frozen=True)
class SourcePos:
    """Position in source text."""
    offset: int
    line: int
    col: int

    def __str__(self) -> str:
        return f"{self.line}:{self.col}"


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"


@dataclass(frozen=True)
class Diagnostic:
    """Non-fatal diagnostic recorded during evaluation."""
    message: str
    pos: SourcePos | None
    severity: Severity = Severity.ERROR

    def __str__(self) -> str:
        loc = f" at {self.pos}" if self.pos else ""
        return f"[{self.severity.value}]{loc}: {self.message}"


class FelError(Exception):
    """Base class for all FEL errors."""
    def __init__(self, message: str, pos: SourcePos | None = None):
        self.pos = pos
        loc = f" at {pos}" if pos else ""
        super().__init__(f"{message}{loc}")


class FelSyntaxError(FelError):
    """Raised when a FEL expression cannot be parsed."""
    pass


class FelDefinitionError(FelError):
    """Raised for load-time errors (cycles, undefined refs, arity mismatches)."""
    pass


class FelEvaluationError(FelError):
    """Raised for runtime evaluation errors (type errors, div/zero, bounds)."""
    pass
