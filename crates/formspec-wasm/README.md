# formspec-wasm

`wasm-bindgen` crate exposing the Rust Formspec stack to TypeScript and browsers. Public API is `#[wasm_bindgen]` functions on the crate root modules (`evalFEL`, `lintDocument`, `evaluateDefinition`, …); inputs and outputs are mostly JSON strings.

## Cargo features

| Feature | Default | Effect |
|---------|---------|--------|
| `lint` | **yes** | Enables `formspec-lint` and exports `lintDocument` / `lintDocumentWithRegistries`. |

**ADR 0050:** `packages/formspec-engine` builds **runtime** WASM with `cargo … --no-default-features` (no `lint`) and **tools** WASM with default features. The TypeScript bridge loads runtime first and tools lazily.

Sibling binding: **[`formspec-py`](../formspec-py/)** (`formspec_rust`) targets the same stack for Python. Mapping JSON parsing (e.g. `parse_coerce_type`, including `array` coercion) is kept aligned with that crate where practical.

## Layout

| Module | Role |
|--------|------|
| `convert` | Item-tree navigation, `json_to_field_map`, lint result JSON, registry status strings, repeat context |
| `fel` | FEL eval (with fields or full context), `prepareFelExpression`, `rewriteFelForAssembly`, tokenize, print, deps, analysis, rewrites, builtins, path helpers |
| `document` | `detectDocumentType`, `planSchemaValidation`, `lintDocument` (+ registries) |
| `evaluate` | `evaluateDefinition`, `evaluateScreener`, context/trigger/registry parsing |
| `value_coerce` | `coerceFieldValue` (item/bind/definition/value JSON strings) |
| `definition` | `assembleDefinition`, `resolveOptionSetsOnDefinition`, `applyMigrationsToResponseData` |
| `mapping` | `executeMapping`, `executeMappingDoc`, mapping document/rule JSON parsing |
| `registry` | `parseRegistry`, `findRegistryEntry`, lifecycle, `wellKnownRegistryUrl`, extension usage validation |
| `changelog` | `generateChangelog` |
| `lib.rs` | Crate docs and `mod` wiring only |
| `wasm_tests` | Native `cargo test` for string-JSON helpers (`#[cfg(test)]` only) |

## Development

```bash
cargo test -p formspec-wasm
cargo test -p formspec-wasm --no-default-features   # same graph as runtime WASM
# Runtime WASM (no lint):
wasm-pack build crates/formspec-wasm --target web --no-opt -- --no-default-features
# Full / tools WASM:
wasm-pack build crates/formspec-wasm --target web --no-opt
```

Release profile disables `wasm-opt` in `Cargo.toml` metadata (see `package.metadata.wasm-pack`).
