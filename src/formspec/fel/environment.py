"""FEL evaluation environment -- the data layer beneath the evaluator.

Resolves ``$field`` paths against primary instance data, manages a push/pop
scope stack for ``let``-bindings, provides ``RepeatContext`` for
``@current``/``@index``/``@count``, serves ``MipState`` lookups for
``valid()``/``relevant()``/``readonly()``/``required()``, and exposes named
secondary instances via ``@instance('name')``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .types import FelNull, FelValue, FelObject, from_python, is_null


@dataclass
class RepeatContext:
    """Per-iteration state for repeat groups: backs @current, @index (1-based), @count, parent(), and prev()/next() navigation."""
    current: FelValue  # The current row object
    index: int  # 1-based
    count: int
    parent: FelValue  # Parent context
    collection: list  # All rows


@dataclass
class MipState:
    """XForms-style Model Item Properties for a single field, queried by valid()/relevant()/etc. special forms."""
    valid: bool = True
    relevant: bool = True
    readonly: bool = False
    required: bool = False


class Environment:
    """Evaluation context providing field resolution, lexical scoping, repeat iteration, and MIP state.

    Primary data dict backs ``$field`` refs; scope stack backs ``let``-bindings;
    ``RepeatContext`` backs ``@current``/``@index``/``@count``; named instances
    back ``@instance('name')``.
    """

    def __init__(
        self,
        data: dict | None = None,
        instances: dict[str, dict] | None = None,
        mip_states: dict[str, MipState] | None = None,
        variables: dict[str, 'FelValue'] | None = None,
    ):
        """Set up with primary instance data, optional named secondary instances, optional per-field MIP states, and optional pre-computed named variables."""
        self.data = data or {}
        self.instances = instances or {}
        self.mip_states = mip_states or {}
        self.variables = variables or {}
        self._scope_stack: list[dict[str, FelValue]] = []
        self.repeat_context: RepeatContext | None = None

    def push_scope(self, bindings: dict[str, FelValue]) -> None:
        """Push a lexical scope frame. Key '' rebinds bare ``$`` (used by countWhere predicates)."""
        self._scope_stack.append(bindings)

    def pop_scope(self) -> None:
        """Pop the most recent lexical scope."""
        self._scope_stack.pop()

    def lookup_let_binding(self, name: str) -> FelValue | None:
        """Search scope stack innermost-first for a let-bound variable. Returns None if unbound."""
        for scope in reversed(self._scope_stack):
            if name in scope:
                return scope[name]
        return None

    def resolve_field(self, path: list[str]) -> FelValue:
        """Resolve a ``$field`` path through the resolution chain.

        Empty path (bare ``$``): scope stack -> repeat current -> full data dict.
        Non-empty: first segment checked against let-bindings, then walks primary
        instance data. Returns FelNull for missing paths.
        """
        if not path:
            # Bare $ -- check scope stack first (countWhere binds $ per-element)
            dollar_val = self.lookup_let_binding('')
            if dollar_val is not None:
                return dollar_val
            # Then repeat context
            if self.repeat_context:
                return self.repeat_context.current
            return from_python(self.data)

        # Check let-bindings first (for first segment only)
        let_val = self.lookup_let_binding(path[0])
        if let_val is not None:
            return self._resolve_tail(let_val, path[1:])

        # Resolve against instance data
        return self._resolve_path(self.data, path)

    def resolve_context(self, name: str, arg: str | None, tail: list[str]) -> FelValue:
        """Resolve ``@name(arg).tail`` context references.

        Supported: @current/.tail (repeat row), @index/@count (repeat metadata),
        @instance('name')/.tail (secondary data), @source/@target (mapping DSL).
        Unknown names -> FelNull.
        """
        if name == 'current':
            if self.repeat_context is None:
                return FelNull
            val = self.repeat_context.current
            return self._resolve_tail(val, tail)
        if name == 'index':
            if self.repeat_context is None:
                return FelNull
            from .types import FelNumber, fel_decimal
            return FelNumber(fel_decimal(self.repeat_context.index))
        if name == 'count':
            if self.repeat_context is None:
                return FelNull
            from .types import FelNumber, fel_decimal
            return FelNumber(fel_decimal(self.repeat_context.count))
        if name == 'instance':
            if arg is None or arg not in self.instances:
                return FelNull
            return self._resolve_path(self.instances[arg], tail)
        if name in ('source', 'target'):
            # Mapping DSL context references
            return self._resolve_path(self.data, [name] + tail)
        if name in self.variables:
            return self._resolve_tail(self.variables[name], tail)
        return FelNull

    def _resolve_path(self, obj: Any, path: list[str]) -> FelValue:
        """Walk nested dicts by string keys, converting the leaf to FelValue via from_python(). Missing key at any level -> FelNull."""
        current = obj
        for segment in path:
            if isinstance(current, dict):
                current = current.get(segment)
                if current is None:
                    return FelNull
            else:
                return FelNull
        return from_python(current)

    def _resolve_tail(self, val: FelValue, tail: list[str]) -> FelValue:
        """Walk remaining dot segments on a FelObject chain. Non-object or missing key -> FelNull."""
        if not tail:
            return val
        if isinstance(val, FelObject):
            current = val
            for seg in tail:
                if isinstance(current, FelObject) and seg in current.fields:
                    current = current.fields[seg]
                else:
                    return FelNull
            return current
        return FelNull
