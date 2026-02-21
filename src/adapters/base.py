"""Adapter base class — §6.1 of the Mapping DSL spec.

Adapters decouple transform logic from wire formats.
"""

from abc import ABC, abstractmethod
from typing import Any

# Internal representation: plain Python JSON-compatible values
JsonValue = Any  # dict | list | str | int | float | bool | None


class Adapter(ABC):
    """Abstract adapter interface per §6.1."""

    @abstractmethod
    def serialize(self, value: JsonValue) -> bytes:
        """Convert internal JSON value to wire-format bytes."""
        ...

    @abstractmethod
    def deserialize(self, data: bytes) -> JsonValue:
        """Convert wire-format bytes to internal JSON value."""
        ...
