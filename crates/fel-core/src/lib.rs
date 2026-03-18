/// FEL (Formspec Expression Language) — parser, evaluator, and dependency analysis.
///
/// Uses rust_decimal for base-10 arithmetic per spec S3.4.1 (minimum 18 significant digits).

pub mod ast;
pub mod dependencies;
pub mod environment;
pub mod error;
pub mod evaluator;
pub mod extensions;
pub mod lexer;
pub mod parser;
pub mod printer;
pub mod types;

// Re-export key types
pub use ast::Expr;
pub use dependencies::{extract_dependencies, Dependencies};
pub use environment::{FormspecEnvironment, MipState, RepeatContext};
pub use error::{Diagnostic, FelError, Severity};
pub use evaluator::{evaluate, Environment, EvalResult, Evaluator, MapEnvironment};
pub use extensions::{ExtensionError, ExtensionRegistry};
pub use parser::parse;
pub use printer::print_expr;
pub use rust_decimal::Decimal;
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
