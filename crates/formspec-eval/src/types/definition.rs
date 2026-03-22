//! Definition-level variable declarations.

/// A definition variable with optional scope.
#[derive(Debug, Clone)]
pub struct VariableDef {
    pub name: String,
    pub expression: String,
    pub scope: Option<String>,
}
