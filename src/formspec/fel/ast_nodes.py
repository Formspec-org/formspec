"""FEL AST node definitions.

All nodes are frozen dataclasses for immutability and safe sharing.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Union

from .errors import SourcePos

# ---------------------------------------------------------------------------
# Path segments (used in FieldRef and postfix access)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DotSegment:
    """Dot-access: `.name`"""
    name: str

@dataclass(frozen=True)
class IndexSegment:
    """Array index: `[n]` (1-based)"""
    index: int

@dataclass(frozen=True)
class WildcardSegment:
    """Wildcard index: `[*]`"""
    pass

PathSegment = Union[DotSegment, IndexSegment, WildcardSegment]

# ---------------------------------------------------------------------------
# Expression nodes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class NumberLiteral:
    value: Decimal
    pos: SourcePos

@dataclass(frozen=True)
class StringLiteral:
    value: str
    pos: SourcePos

@dataclass(frozen=True)
class BooleanLiteral:
    value: bool
    pos: SourcePos

@dataclass(frozen=True)
class NullLiteral:
    pos: SourcePos

@dataclass(frozen=True)
class DateLiteral:
    """Represents both date and datetime literals (FEL type is always 'date')."""
    value: Union[date, datetime]
    pos: SourcePos

@dataclass(frozen=True)
class ArrayLiteral:
    elements: tuple  # tuple[Expr, ...]
    pos: SourcePos

@dataclass(frozen=True)
class ObjectLiteral:
    entries: tuple  # tuple[tuple[str, Expr], ...]
    pos: SourcePos

@dataclass(frozen=True)
class FieldRef:
    """Field reference: `$`, `$x`, `$x.y`, `$x[1].y`, `$x[*].y`.

    An empty segments tuple represents bare `$` (self-reference).
    """
    segments: tuple  # tuple[PathSegment, ...]
    pos: SourcePos

@dataclass(frozen=True)
class ContextRef:
    """Context reference: `@current`, `@index`, `@instance('x').a.b`."""
    name: str
    arg: Union[str, None]  # string argument for @instance('name')
    tail: tuple  # tuple[str, ...]  — dot-chained identifiers
    pos: SourcePos

@dataclass(frozen=True)
class UnaryOp:
    op: str  # 'not' or '-'
    operand: object  # Expr
    pos: SourcePos

@dataclass(frozen=True)
class BinaryOp:
    op: str  # +, -, *, /, %, &, =, !=, <, >, <=, >=, ??, and, or
    left: object  # Expr
    right: object  # Expr
    pos: SourcePos

@dataclass(frozen=True)
class TernaryOp:
    """Ternary conditional: `condition ? then_expr : else_expr`."""
    condition: object  # Expr
    then_expr: object  # Expr
    else_expr: object  # Expr
    pos: SourcePos

@dataclass(frozen=True)
class IfThenElse:
    """Keyword conditional: `if condition then expr else expr`."""
    condition: object  # Expr
    then_expr: object  # Expr
    else_expr: object  # Expr
    pos: SourcePos

@dataclass(frozen=True)
class LetBinding:
    """Let binding: `let name = value in body`."""
    name: str
    value: object  # Expr
    body: object  # Expr
    pos: SourcePos

@dataclass(frozen=True)
class FunctionCall:
    """Function call: `name(args...)`. Includes `if()` special form."""
    name: str
    args: tuple  # tuple[Expr, ...]
    pos: SourcePos

@dataclass(frozen=True)
class MembershipOp:
    """Membership test: `value in container` or `value not in container`."""
    value: object  # Expr
    container: object  # Expr
    negated: bool
    pos: SourcePos

@dataclass(frozen=True)
class PostfixAccess:
    """Postfix dot/index access on an expression: `expr.field`, `expr[n]`.

    Enables `prev().field_name`, `(expr).field`, etc.
    """
    expr: object  # Expr
    segments: tuple  # tuple[PathSegment, ...]
    pos: SourcePos


# Union type for all expression nodes
Expr = Union[
    NumberLiteral, StringLiteral, BooleanLiteral, NullLiteral, DateLiteral,
    ArrayLiteral, ObjectLiteral, FieldRef, ContextRef,
    UnaryOp, BinaryOp, TernaryOp, IfThenElse, LetBinding,
    FunctionCall, MembershipOp, PostfixAccess,
]
