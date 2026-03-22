//! WASM bindings for Formspec — exposes FEL, linting, evaluation, assembly, mapping to TS.
//!
//! All exported functions accept and return JSON strings (or simple scalars) for complex types.
//! The binding layer performs conversion only; behavior lives in `fel-core`, `formspec-core`,
//! `formspec-eval`, and `formspec-lint`.
//!
//! ## Layout
//! - `convert` — shared JSON / item-tree / FEL map helpers
//! - `fel` — FEL eval, tokenize, rewrite, path utilities
//! - `document` — detect type, schema plan, lint
//! - `evaluate` — batch definition evaluation, screener
//! - `definition` — assemble definition with `$ref` fragments
//! - `mapping` — mapping rules + mapping document execution
//! - `registry` — registry parse, lookup, lifecycle, extension validation
//! - `changelog` — definition diff changelog
//! - `wasm_tests` — native `cargo test` coverage (`#[cfg(test)]` only)

mod changelog;
mod convert;
mod definition;
mod document;
mod evaluate;
mod fel;
mod mapping;
mod registry;

#[cfg(test)]
mod wasm_tests;
