"""Dependency graph construction and cycle detection for bind expressions."""

from __future__ import annotations

from dataclasses import dataclass, field

from formspec.fel.dependencies import extract_dependencies as extract_ast_dependencies

from .diagnostic import LintDiagnostic
from .expressions import CompiledExpression


@dataclass(slots=True)
class DependencyAnalysisResult:
    graph: dict[str, set[str]] = field(default_factory=dict)
    diagnostics: list[LintDiagnostic] = field(default_factory=list)


def analyze_dependencies(compiled_expressions: list[CompiledExpression]) -> DependencyAnalysisResult:
    result = DependencyAnalysisResult()
    bind_path_lookup: dict[str, str] = {}

    for compiled in compiled_expressions:
        if not compiled.bind_target:
            continue

        deps = extract_ast_dependencies(compiled.ast)
        node = compiled.bind_target
        result.graph.setdefault(node, set()).update(deps.fields)
        if compiled.bind_path_pointer and node not in bind_path_lookup:
            bind_path_lookup[node] = compiled.bind_path_pointer

    cycles = _find_cycles(result.graph)
    for cycle in cycles:
        first = cycle[0]
        result.diagnostics.append(
            LintDiagnostic(
                severity="error",
                code="E500",
                message=f"Dependency cycle detected: {' -> '.join(cycle)}",
                path=bind_path_lookup.get(first, "$.binds"),
                category="dependency",
            )
        )

    return result


def _find_cycles(graph: dict[str, set[str]]) -> list[list[str]]:
    visited: set[str] = set()
    in_stack: set[str] = set()
    stack: list[str] = []
    cycles: list[list[str]] = []
    seen_cycles: set[tuple[str, ...]] = set()

    def dfs(node: str) -> None:
        if node in in_stack:
            cycle_start = stack.index(node)
            cycle = stack[cycle_start:] + [node]
            signature = _canonical_cycle_signature(cycle)
            if signature not in seen_cycles:
                seen_cycles.add(signature)
                cycles.append(cycle)
            return

        if node in visited:
            return

        visited.add(node)
        in_stack.add(node)
        stack.append(node)

        for dep in sorted(graph.get(node, set())):
            if dep not in graph:
                continue
            dfs(dep)

        stack.pop()
        in_stack.remove(node)

    for node in sorted(graph):
        dfs(node)

    return cycles


def _canonical_cycle_signature(cycle: list[str]) -> tuple[str, ...]:
    """Normalize cycle signatures so rotations are deduplicated."""
    nodes = cycle[:-1]
    if not nodes:
        return tuple(cycle)

    rotations = [tuple(nodes[i:] + nodes[:i]) for i in range(len(nodes))]
    normalized = min(rotations)
    return normalized
