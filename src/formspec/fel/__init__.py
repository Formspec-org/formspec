"""Formspec Expression Language (FEL) -- public API surface.

Re-exports from internal modules to provide a flat import namespace for
server-side evaluation, static dependency analysis, and conformance testing.

Pipeline: source -> parse() -> AST -> evaluate()/extract_dependencies()

Convenience entry points:
    evaluate(source, data, ...) -> EvalResult   -- parse + evaluate in one call
    extract_dependencies(source) -> DependencySet -- parse + static analysis
    register_extension(registry, ...) -- add user functions to a registry
    parse(source) -> AST node -- raw parse for advanced use
"""

__version__ = "1.0.0"

from .parser import parse
from .evaluator import Evaluator, EvalResult
from .environment import Environment, RepeatContext, MipState
from .functions import build_default_registry, FuncDef, BUILTIN_NAMES
from .dependencies import extract_dependencies as _extract_deps, DependencySet
from .extensions import register_extension
from .types import (
    FelNull, FelNumber, FelString, FelBoolean, FelDate,
    FelArray, FelMoney, FelObject, FelTrue, FelFalse,
    FelValue, fel_bool, from_python, to_python, typeof, is_null,
)
from .errors import (
    FelError, FelSyntaxError, FelDefinitionError, FelEvaluationError,
    Diagnostic, SourcePos, Severity,
)
from .runtime import FelRuntime, DefaultFelRuntime, RustFelRuntime, default_fel_runtime


def evaluate(
    source: str,
    data: dict | None = None,
    *,
    instances: dict[str, dict] | None = None,
    mip_states: dict[str, MipState] | None = None,
    extensions: dict[str, FuncDef] | None = None,
    variables: dict[str, 'FelValue'] | None = None,
) -> EvalResult:
    """Parse and evaluate a FEL expression in one call.

    Delegates to the default FEL runtime (Rust when available, Python fallback).

    Args:
        source: FEL expression (e.g. ``"$price * $quantity"``).
        data: Primary instance data dict for ``$field`` resolution.
        instances: Named data sources for ``@instance('name')`` lookups.
        mip_states: Per-field MIP states for ``valid()``/``relevant()``/etc.
        extensions: Extra FuncDefs to merge into the built-in registry.
        variables: Pre-computed named variable values for ``@name`` lookups.

    Raises:
        FelSyntaxError: If the expression cannot be parsed.
    """
    return default_fel_runtime().evaluate(
        source, data,
        instances=instances,
        mip_states=mip_states,
        extensions=extensions,
        variables=variables,
    )


def extract_dependencies(source: str) -> DependencySet:
    """Parse a FEL expression and statically extract all referenced dependencies.

    Delegates to the default FEL runtime (Rust when available, Python fallback).

    Raises:
        FelSyntaxError: If the expression cannot be parsed.
    """
    return default_fel_runtime().extract_dependencies(source)
