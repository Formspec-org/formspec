/// FEL (Formspec Expression Language) — parser, evaluator, and dependency analysis.
///
/// Zero external dependencies — pure Rust std library only.

pub mod ast;
pub mod dependencies;
pub mod error;
pub mod evaluator;
pub mod lexer;
pub mod parser;
pub mod types;

// Re-export key types
pub use ast::Expr;
pub use dependencies::{extract_dependencies, Dependencies};
pub use error::{Diagnostic, FelError, Severity};
pub use evaluator::{evaluate, Environment, EvalResult, Evaluator, MapEnvironment};
pub use parser::parse;
pub use types::{FelDate, FelMoney, FelValue};

/// Parse and evaluate a FEL expression with a flat field map.
pub fn eval_with_fields(
    input: &str,
    fields: std::collections::HashMap<String, FelValue>,
) -> Result<EvalResult, FelError> {
    let expr = parse(input)?;
    let env = MapEnvironment::with_fields(fields);
    Ok(evaluate(&expr, &env))
}
