"""FEL runtime protocol — abstraction layer for swappable FEL backends.

Defines Protocol classes that both the built-in Python FEL implementation and
future Rust/PyO3 implementations can satisfy, enabling seamless backend swaps
while keeping the same test infrastructure and consumer code.

Usage::

    from formspec.fel.runtime import FelRuntime, default_fel_runtime

    # Use the default (Python) runtime
    rt = default_fel_runtime()
    result = rt.evaluate("1 + 2", {"x": 10})

    # Or inject a custom runtime (e.g. Rust/PyO3)
    evaluator = DefinitionEvaluator(definition, fel_runtime=custom_runtime)
"""

from __future__ import annotations

from typing import Any, Callable, Protocol, runtime_checkable

from .evaluator import EvalResult
from .dependencies import DependencySet
from .types import FelValue


@runtime_checkable
class FelRuntime(Protocol):
    """Pluggable FEL runtime — the single abstraction consumers depend on.

    Implementations:
    - ``DefaultFelRuntime`` — built-in Python parser + evaluator
    - (future) Rust/PyO3 backend
    """

    def parse(self, source: str) -> Any:
        """Parse a FEL expression into an AST (opaque to consumers).

        Raises:
            FelSyntaxError: If the expression cannot be parsed.
        """
        ...

    def evaluate(
        self,
        source: str,
        data: dict | None = None,
        *,
        instances: dict[str, dict] | None = None,
        mip_states: dict[str, Any] | None = None,
        extensions: dict[str, Any] | None = None,
        variables: dict[str, FelValue] | None = None,
    ) -> EvalResult:
        """Parse and evaluate a FEL expression in one call.

        Raises:
            FelSyntaxError: If the expression cannot be parsed.
        """
        ...

    def extract_dependencies(self, source: str) -> DependencySet:
        """Parse and statically extract all referenced dependencies.

        Raises:
            FelSyntaxError: If the expression cannot be parsed.
        """
        ...

    def register_function(
        self,
        name: str,
        impl: Callable,
        meta: dict | None = None,
    ) -> None:
        """Register an extension function into the runtime.

        Spec S3.12, S8.1: runtime-extensible function catalog.
        """
        ...


class DefaultFelRuntime:
    """FEL runtime backed by the built-in Python parser and evaluator."""

    def __init__(self) -> None:
        self._extension_functions: dict[str, Callable] = {}

    def register_function(
        self,
        name: str,
        impl: Callable,
        meta: dict | None = None,
    ) -> None:
        """Register an extension function into the runtime."""
        self._extension_functions[name] = impl

    def parse(self, source: str) -> Any:
        from .parser import parse as _parse
        return _parse(source)

    def evaluate(
        self,
        source: str,
        data: dict | None = None,
        *,
        instances: dict[str, dict] | None = None,
        mip_states: dict[str, Any] | None = None,
        extensions: dict[str, Any] | None = None,
        variables: dict[str, FelValue] | None = None,
    ) -> EvalResult:
        from .parser import parse as _parse
        from .evaluator import Evaluator
        from .environment import Environment
        from .functions import build_default_registry

        ast = _parse(source)
        env = Environment(
            data=data,
            instances=instances,
            mip_states=mip_states,
            variables=variables,
        )
        functions = build_default_registry()
        if self._extension_functions:
            functions.update(self._extension_functions)
        if extensions:
            functions.update(extensions)
        ev = Evaluator(env, functions)
        value = ev.evaluate(ast)
        return EvalResult(value=value, diagnostics=ev.diagnostics)

    def extract_dependencies(self, source: str) -> DependencySet:
        from .parser import parse as _parse
        from .dependencies import extract_dependencies as _extract

        ast = _parse(source)
        return _extract(ast)


class RustFelRuntime:
    """FEL runtime backed by the Rust/PyO3 ``formspec_rust`` module.

    Falls back to ``DefaultFelRuntime`` if the native module is not installed.
    Extension functions registered via ``register_function`` are NOT supported
    in the Rust backend — they are silently ignored (Rust evaluator has its own
    stdlib and doesn't accept dynamic JS/Python callbacks).
    """

    _available: bool | None = None

    def __init__(self) -> None:
        self._extension_functions: dict[str, Callable] = {}

    @classmethod
    def is_available(cls) -> bool:
        if cls._available is None:
            try:
                import formspec_rust as _  # noqa: F401
                cls._available = True
            except ImportError:
                cls._available = False
        return cls._available

    def register_function(
        self,
        name: str,
        impl: Callable,
        meta: dict | None = None,
    ) -> None:
        # Rust runtime doesn't support dynamic function registration from Python.
        self._extension_functions[name] = impl

    def parse(self, source: str) -> Any:
        import formspec_rust
        valid = formspec_rust.parse_fel(source)
        if not valid:
            from .errors import FelSyntaxError
            raise FelSyntaxError(f"FEL parse error: {source!r}")
        # Return a sentinel — the Rust module doesn't expose an AST object.
        return {"_rust_parsed": True, "source": source}

    def evaluate(
        self,
        source: str,
        data: dict | None = None,
        *,
        instances: dict[str, dict] | None = None,
        mip_states: dict[str, Any] | None = None,
        extensions: dict[str, Any] | None = None,
        variables: dict[str, FelValue] | None = None,
    ) -> EvalResult:
        import formspec_rust
        fields = dict(data or {})
        if variables:
            fields.update(variables)
        value = formspec_rust.eval_fel(source, fields)
        return EvalResult(value=value, diagnostics=[])

    def extract_dependencies(self, source: str) -> DependencySet:
        import formspec_rust
        raw = formspec_rust.extract_deps(source)
        return DependencySet(
            fields=set(raw.get("fields", [])),
            instance_refs=set(raw.get("instance_refs", [])),
            context_refs=set(raw.get("context_refs", [])),
            mip_deps=set(raw.get("mip_deps", [])),
            has_self_ref=raw.get("has_self_ref", False),
            has_wildcard=raw.get("has_wildcard", False),
            uses_prev_next=raw.get("uses_prev_next", False),
        )


# Singleton
_default_runtime: DefaultFelRuntime | RustFelRuntime | None = None


def default_fel_runtime() -> DefaultFelRuntime | RustFelRuntime:
    """Return the shared default FEL runtime instance.

    Prefers the Rust backend when ``formspec_rust`` is installed.
    """
    global _default_runtime
    if _default_runtime is None:
        if RustFelRuntime.is_available():
            _default_runtime = RustFelRuntime()
        else:
            _default_runtime = DefaultFelRuntime()
    return _default_runtime
