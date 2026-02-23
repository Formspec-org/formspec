"""FEL extension function registration."""

from __future__ import annotations

from .errors import FelDefinitionError
from .functions import FuncDef, BUILTIN_NAMES
from .parser import RESERVED_WORDS


_PROHIBITED_NAMES = RESERVED_WORDS | BUILTIN_NAMES


def register_extension(
    registry: dict[str, FuncDef],
    name: str,
    impl,
    min_args: int,
    max_args: int | None = None,
) -> None:
    """Register an extension function.

    Extension functions:
    - MUST NOT collide with reserved words or built-in names
    - Are always null-propagating (not special forms)
    - MUST be pure and total
    """
    if name in _PROHIBITED_NAMES:
        raise FelDefinitionError(
            f"Extension function name '{name}' collides with a "
            f"reserved word or built-in function"
        )
    registry[name] = FuncDef(
        name=name,
        impl=impl,
        min_args=min_args,
        max_args=max_args,
        propagate_null=True,
        special_form=False,
    )
