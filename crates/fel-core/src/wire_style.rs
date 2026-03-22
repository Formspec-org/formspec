//! Host JSON key convention shared across FEL dependency wire and Formspec FFI surfaces.

/// JSON object key style for WASM (`camelCase`) vs Python (`snake_case`) bindings.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JsonWireStyle {
    /// JavaScript / `wasm-bindgen` (camelCase keys).
    JsCamel,
    /// Python `formspec_rust` surface (snake_case keys).
    PythonSnake,
}
