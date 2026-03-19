"""Factory functions for creating processor instances — seam for backend swapping."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .evaluator import DefinitionEvaluator
    from .fel.runtime import FelRuntime
    from .mapping.engine import MappingEngine
    from .registry import Registry


def create_form_processor(
    definition: dict,
    registries: list[Registry] | None = None,
    fel_runtime: FelRuntime | None = None,
) -> DefinitionEvaluator:
    """Create a form processor (DefinitionEvaluator) instance.

    Consumers should use this instead of direct ``DefinitionEvaluator(...)``
    construction to enable transparent backend swapping (e.g. Rust/PyO3).
    """
    from .evaluator import DefinitionEvaluator

    return DefinitionEvaluator(definition, registries=registries, fel_runtime=fel_runtime)


def create_mapping_engine(
    mapping_doc: dict,
    fel_runtime: FelRuntime | None = None,
) -> MappingEngine:
    """Create a mapping engine instance.

    Consumers should use this instead of direct ``MappingEngine(...)``
    construction to enable transparent backend swapping.
    """
    from .mapping.engine import MappingEngine

    return MappingEngine(mapping_doc, fel_runtime=fel_runtime)
