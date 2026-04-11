# ADR 0001: Linter Severity Policy and Modes

## Status
Accepted

## Context
The Formspec linter serves two workflows with different tolerance levels:

1. Authoring feedback during iterative document development.
2. CI enforcement where ambiguous behavior should fail fast.

Treating all findings as errors creates noisy authoring feedback and blocks deterministic fallback flows. Treating all findings as warnings weakens CI.

## Decision
Adopt two explicit linter modes:

- `authoring` (default): recoverable findings are warnings.
- `strict`: selected warning codes are escalated to errors.

Severity assignment principle:

- `error`: deterministic processing cannot continue safely.
- `warning`: processor can continue with a deterministic fallback.

Initial strict escalations:

- `W800` unresolved component bind reference
- `W802` compatibility accepted only through fallback policy
- `W803` duplicate editable input bindings
- `W804` unresolved nested Summary/DataTable binds

## Consequences
- Authoring mode improves signal-to-noise and encourages incremental fixes.
- Strict mode provides stable CI failure semantics without duplicating linter logic.
- Severity behavior is centralized in policy code rather than scattered across passes.

## Implementation Notes
- Policy logic is implemented in `src/validator/policy.py`.
- CLI mode selection is exposed via `python -m formspec.validator --mode ...`.
- Component compatibility and fallback semantics are centralized in `src/validator/component_matrix.py`.
