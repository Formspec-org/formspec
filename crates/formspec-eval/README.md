# formspec-eval

Rust **batch evaluator** for Formspec definitions: turn a JSON definition plus flat response data into computed field values, relevance/required/readonly state, and a structured validation report. It implements the same **processing-model phases** as the TypeScript `formspec-engine` reference (rebuild → recalculate → revalidate → NRB), using [`fel-core`](../fel-core) for FEL parse/eval.

## When to use this crate

- Server-side or CLI evaluation where you already have `serde_json::Value` maps.
- WASM / Python bindings that need parity with the engine’s batch semantics (see sibling crates in this workspace).
- Unit or integration tests that exercise the full pipeline without a browser.

For interactive, signal-driven UI state, use the TypeScript engine instead.

## Evaluation pipeline

The primary entry point is **`evaluate_definition_full_with_instances_and_context`** (and the thinner wrappers re-exported from the crate root). Rough order:

| Phase | Module | Role |
|--------|--------|------|
| 1 | `rebuild` | Parse `items` / `binds`, seed `initialValue`, expand repeats, apply wildcard binds |
| 2 | `recalculate` | Relevance, required, readonly, whitespace, variables, calculated fields (fixpoint) |
| 3 | `revalidate` | Required/type/bind constraints, registry extension checks, shape rules |
| 4 | `nrb` | Apply non-relevant behavior to output values (remove / empty / keep) |

Cross-cutting pieces:

- **`convert`** — Resolve values by dotted paths (flat map + nested objects).
- **`fel_json`** (private) — Money-shaped JSON normalization before `json_to_fel`, shared with screener and validation env construction.
- **`runtime_seed`** — `prePopulate` and previous non-relevant field hints from `EvalContext`.
- **`screener`** — Optional; evaluates `screener.routes` in an **isolated** FEL environment (does not mutate form data).

## Public API (crate root)

Re-exported for convenience:

- **`evaluate_definition*`** — Full pipeline; pass `EvalTrigger` for shape timing, `ExtensionConstraint` slices from registries, optional named `instances`, and `EvalContext` (`now`, `previous_non_relevant`, …).
- **`rebuild_item_tree`**, **`parse_variables`**, **`expand_repeat_instances`**, **`expand_wildcard_path`** — Definition and repeat helpers when you need to split the pipeline.
- **`recalculate`**, **`topo_sort_variables`** — Phase 2 alone (advanced).
- **`revalidate`** — Phase 3 alone (advanced).
- **`apply_nrb`**, **`resolve_nrb`** — Phase 4 and NRB lookup.
- **`evaluate_screener`** — Screener routing only.
- **`resolve_value_by_path`** — Path resolution helper.
- **`types`** — `EvaluationResult`, `ItemInfo`, `ValidationResult`, `EvalContext`, etc.

For full type documentation, run `cargo doc -p formspec-eval --open` from the repo root (or see generated API docs if your workspace publishes them).

## Tests

```bash
# From repository root
cargo test -p formspec-eval
```

- **Library tests** — Per-module unit tests under `src/**` (including `rebuild::tests`, `recalculate`, `revalidate`, …).
- **Integration tests** — `tests/integration/` exercises `evaluate_*` end-to-end against many spec scenarios (`[[test]]` name `integration` in `Cargo.toml`).

## Layout (source)

```
src/
  lib.rs, pipeline.rs, runtime_seed.rs
  fel_json.rs, value_predicate.rs   # internal shared helpers
  convert.rs, nrb.rs, screener.rs
  rebuild/    # phase 1 submodules
  recalculate/
  revalidate/
  types/
tests/integration/
```

## Dependencies

- **`fel-core`** — FEL lexer/parser/evaluator and `FormspecEnvironment`.
- **`serde_json`** — Definition and data interchange.
- **`fancy-regex`** — Extension `pattern` checks in revalidation.
- **`rust_decimal`** — Decimal handling where the pipeline needs it.

`fel-core` is also listed under **`dev-dependencies`** so integration tests can assert `json_to_fel` / `fel_to_json` round-trips without going through the public `formspec-eval` API.

## See also

- Repository root **`CLAUDE.md`** / **`AGENTS.md`** — Monorepo conventions, spec locations, and full build commands.
- **`packages/formspec-engine`** — Client-side reactive engine (conceptual twin to this batch path).
