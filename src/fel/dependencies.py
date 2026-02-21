"""FEL dependency extraction — walk AST to find all field/context references."""

from __future__ import annotations

from dataclasses import dataclass, field

from . import ast_nodes as ast


@dataclass
class DependencySet:
    """All dependencies extracted from a FEL expression."""
    fields: set[str] = field(default_factory=set)  # e.g. {'firstName', 'address.city'}
    instance_refs: set[str] = field(default_factory=set)  # e.g. {'priorYear'}
    context_refs: set[str] = field(default_factory=set)  # e.g. {'@current', '@index'}
    mip_deps: set[str] = field(default_factory=set)  # e.g. {'ein'} from valid($ein)
    has_self_ref: bool = False  # bare $
    has_wildcard: bool = False  # $repeat[*].field
    uses_prev_next: bool = False  # prev() or next()


def extract_dependencies(node) -> DependencySet:
    """Walk an AST and extract all field/context references."""
    deps = DependencySet()
    let_vars: set[str] = set()
    _walk(node, deps, let_vars)
    return deps


def _walk(node, deps: DependencySet, let_vars: set[str]) -> None:
    if isinstance(node, ast.FieldRef):
        if not node.segments:
            deps.has_self_ref = True
            return
        path_parts = []
        for seg in node.segments:
            if isinstance(seg, ast.DotSegment):
                path_parts.append(seg.name)
            elif isinstance(seg, ast.WildcardSegment):
                deps.has_wildcard = True
            # IndexSegment doesn't contribute to path string
        if path_parts:
            name = path_parts[0]
            if name in let_vars:
                return  # let-bound variable, not a field dep
            deps.fields.add('.'.join(path_parts))
        return

    if isinstance(node, ast.ContextRef):
        deps.context_refs.add(f'@{node.name}')
        if node.name == 'instance' and node.arg:
            deps.instance_refs.add(node.arg)
        return

    if isinstance(node, ast.LetBinding):
        _walk(node.value, deps, let_vars)
        new_vars = let_vars | {node.name}
        _walk(node.body, deps, new_vars)
        return

    if isinstance(node, ast.FunctionCall):
        name = node.name
        # MIP functions: extract field path as mip_dep
        if name in ('valid', 'relevant', 'readonly', 'required'):
            if node.args and isinstance(node.args[0], ast.FieldRef):
                path = '.'.join(
                    s.name for s in node.args[0].segments
                    if isinstance(s, ast.DotSegment)
                )
                if path:
                    deps.mip_deps.add(path)
            return
        # prev/next: mark repeat dependency
        if name in ('prev', 'next'):
            deps.uses_prev_next = True
        # countWhere: don't extract $ from predicate
        if name == 'countWhere' and len(node.args) >= 2:
            _walk(node.args[0], deps, let_vars)
            # Skip walking predicate's $ refs (they're element-bound)
            _walk_skip_bare_dollar(node.args[1], deps, let_vars)
            return
        # Normal function: walk all args
        for arg in node.args:
            _walk(arg, deps, let_vars)
        return

    # Recurse into all child nodes
    if isinstance(node, ast.BinaryOp):
        _walk(node.left, deps, let_vars)
        _walk(node.right, deps, let_vars)
    elif isinstance(node, ast.UnaryOp):
        _walk(node.operand, deps, let_vars)
    elif isinstance(node, (ast.TernaryOp, ast.IfThenElse)):
        _walk(node.condition, deps, let_vars)
        _walk(node.then_expr, deps, let_vars)
        _walk(node.else_expr, deps, let_vars)
    elif isinstance(node, ast.MembershipOp):
        _walk(node.value, deps, let_vars)
        _walk(node.container, deps, let_vars)
    elif isinstance(node, ast.ArrayLiteral):
        for e in node.elements:
            _walk(e, deps, let_vars)
    elif isinstance(node, ast.ObjectLiteral):
        for _, v in node.entries:
            _walk(v, deps, let_vars)
    elif isinstance(node, ast.PostfixAccess):
        _walk(node.expr, deps, let_vars)


def _walk_skip_bare_dollar(node, deps: DependencySet, let_vars: set[str]) -> None:
    """Walk but skip bare $ references (for countWhere predicates)."""
    if isinstance(node, ast.FieldRef) and not node.segments:
        return  # Skip bare $
    _walk(node, deps, let_vars)
