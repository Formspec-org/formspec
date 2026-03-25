//! WASM bindings for Formspec — exposes FEL, evaluation, assembly, mapping, and (with `lint`) linting to TS.
//!
//! All exported functions accept and return JSON strings (or simple scalars) for complex types.
//! The binding layer performs conversion only; behavior lives in `fel-core`, `formspec-core`,
//! `formspec-eval`, and (feature `lint`) `formspec-lint`.
//!
//! ## Layout
//! - `changeset` — changeset dependency analysis (key extraction, connected components)
//! - `fel` — FEL eval, tokenize, rewrite, path utilities
//! - `document` — `document-api`: detect type, schema plan; `lint`: lintDocument*
//! - `evaluate` — batch definition evaluation, screener (always in runtime WASM)
//! - `definition` — always: option sets + migrations; `definition-assembly`: `assembleDefinition`
//! - `mapping` — `mapping-api`
//! - `registry` — `registry-api`
//! - `changelog` — `changelog-api`
//! - `fel` — core eval + analysis + path utils always; `fel-authoring`: tokenize/parse/print/rewrites/catalog
//! - `wasm_tests` — native `cargo test` coverage (`#[cfg(test)]` only)

mod changeset;
#[cfg(feature = "changelog-api")]
mod changelog;
mod definition;
#[cfg(feature = "document-api")]
mod document;
mod evaluate;
mod fel;
mod json_host;
#[cfg(feature = "mapping-api")]
mod mapping;
#[cfg(feature = "registry-api")]
mod registry;
mod split_abi;
mod value_coerce;

#[cfg(test)]
mod wasm_tests;
