//! WASM bindings for Formspec — exposes FEL, evaluation, assembly, mapping, and (with `lint`) linting to TS.
//!
//! All exported functions accept and return JSON strings (or simple scalars) for complex types.
//! The binding layer performs conversion only; behavior lives in `fel-core`, `formspec-core`,
//! `formspec-eval`, and (feature `lint`) `formspec-lint`.
//!
//! ## Layout
//! - `fel` — FEL eval, tokenize, rewrite, path utilities
//! - `document` — detect type, schema plan; lint only when `feature = "lint"`
//! - `evaluate` — batch definition evaluation, screener
//! - `definition` — assemble definition with `$ref` fragments
//! - `mapping` — mapping rules + mapping document execution
//! - `registry` — registry parse, lookup, lifecycle, extension validation
//! - `changelog` — definition diff changelog
//! - `wasm_tests` — native `cargo test` coverage (`#[cfg(test)]` only)

mod changelog;
mod definition;
mod document;
mod evaluate;
mod fel;
mod json_host;
mod mapping;
mod registry;
mod split_abi;
mod value_coerce;

#[cfg(test)]
mod wasm_tests;
