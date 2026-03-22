# formspec-wasm

`wasm-bindgen` crate exposing the Rust Formspec stack to TypeScript and browsers. Public API is `#[wasm_bindgen]` functions on the crate root modules (`evalFEL`, `lintDocument`, `evaluateDefinition`, …); inputs and outputs are mostly JSON strings.

## Layout

| Module | Role |
|--------|------|
| `convert` | Item-tree navigation, `json_to_field_map`, lint result JSON, registry status strings, repeat context |
| `fel` | FEL eval (with fields or full context), tokenize, print, deps, analysis, rewrites, builtins, path helpers |
| `document` | `detectDocumentType`, `planSchemaValidation`, `lintDocument` (+ registries) |
| `evaluate` | `evaluateDefinition`, `evaluateScreener`, context/trigger/registry parsing |
| `definition` | `assembleDefinition` |
| `mapping` | `executeMapping`, `executeMappingDoc`, mapping document/rule JSON parsing |
| `registry` | `parseRegistry`, `findRegistryEntry`, lifecycle, `wellKnownRegistryUrl`, extension usage validation |
| `changelog` | `generateChangelog` |
| `lib.rs` | Crate docs and `mod` wiring only |
| `wasm_tests` | Native `cargo test` for string-JSON helpers (`#[cfg(test)]` only) |

## Development

```bash
cargo test -p formspec-wasm
wasm-pack build crates/formspec-wasm   # when building for web
```

Release profile disables `wasm-opt` in `Cargo.toml` metadata (see `package.metadata.wasm-pack`).
