"""Formspec Expression Language (FEL) — Python reference implementation.

Public API:
    parse(source) → AST node
    evaluate(source, data, ...) → EvalResult
    extract_dependencies(source) → DependencySet
    register_extension(registry, name, impl, min_args, max_args)
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


def evaluate(
    source: str,
    data: dict | None = None,
    *,
    instances: dict[str, dict] | None = None,
    mip_states: dict[str, MipState] | None = None,
    extensions: dict[str, FuncDef] | None = None,
) -> EvalResult:
    """Parse and evaluate a FEL expression in one call.

    Args:
        source: FEL expression string
        data: Instance data (field values)
        instances: Secondary data sources for @instance()
        mip_states: MIP states for valid()/relevant()/etc.
        extensions: Additional function definitions

    Returns:
        EvalResult with value and diagnostics.
    """
    ast = parse(source)
    env = Environment(data=data, instances=instances, mip_states=mip_states)
    functions = build_default_registry()
    if extensions:
        functions.update(extensions)
    ev = Evaluator(env, functions)
    value = ev.evaluate(ast)
    return EvalResult(value=value, diagnostics=ev.diagnostics)


def extract_dependencies(source: str) -> DependencySet:
    """Parse a FEL expression and extract all field/context references."""
    ast = parse(source)
    return _extract_deps(ast)
