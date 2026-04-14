//! FEL parser, evaluator, and dependency analysis with base-10 decimal arithmetic.
//!
//! Uses `rust_decimal` for base-10 arithmetic per spec S3.4.1 (minimum 18 significant digits).
//!
//! ## Docs
//!
//! - Human overview: crate `README.md` (architecture, pipeline, module map).
//! - API reference: `cargo doc -p fel-core --no-deps --open`.
//! - Markdown API export: `docs/rustdoc-md/API.md` (see crate README).
#![warn(missing_docs)]
#![warn(clippy::missing_docs_in_private_items)]

pub mod ast;
pub mod context_json;
pub mod convert;
pub mod dependencies;
pub mod environment;
pub mod error;
pub mod evaluator;
pub mod extensions;
pub mod interpolation;
pub mod iso_duration;
pub mod lexer;
pub mod parser;
pub mod prepare_host;
pub mod printer;
pub mod types;
pub mod wire_style;

// Re-export key types
pub use ast::Expr;
pub use context_json::formspec_environment_from_json_map;
pub use convert::{fel_to_json, field_map_from_json_str, json_object_to_field_map, json_to_fel};
pub use dependencies::{
    Dependencies, dependencies_to_json_value, dependencies_to_json_value_styled,
    extract_dependencies,
};
pub use environment::{FormspecEnvironment, MipState, RepeatContext};
pub use error::{
    Diagnostic, FelError, Severity, has_error_diagnostics, reject_undefined_functions,
    undefined_function_names_from_diagnostics,
};
pub use evaluator::{Environment, EvalResult, Evaluator, MapEnvironment, evaluate};
pub use extensions::{
    BuiltinFunctionCatalogEntry, ExtensionError, ExtensionRegistry, builtin_function_catalog,
    builtin_function_catalog_json_value,
};
pub use interpolation::expr_is_interpolation_static_literal;
pub use iso_duration::{IsoDurationParse, parse_iso8601_duration, parse_iso8601_duration_ms};
pub use lexer::{is_valid_fel_identifier, sanitize_fel_identifier};
pub use parser::parse;
pub use prepare_host::{
    PrepareFelHostInput, PrepareFelHostOptionsOwned, prepare_fel_expression_for_host,
    prepare_fel_expression_owned, prepare_fel_host_options_from_json_map,
};
pub use printer::print_expr;
pub use rust_decimal::Decimal;
pub use types::{FelDate, FelMoney, FelValue, parse_date_literal, parse_datetime_literal};
pub use wire_style::JsonWireStyle;

/// One lexeme from [`tokenize`] for host bindings and tooling (stable type names + source span).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PositionedToken {
    /// Logical token kind (e.g. `NumberLiteral`, `Identifier`).
    pub token_type: String,
    /// Lexeme text from the source.
    pub text: String,
    /// Start offset in Unicode scalar indices.
    pub start: usize,
    /// End offset (exclusive) in Unicode scalar indices.
    pub end: usize,
}

fn token_type_name(token: &lexer::Token) -> &'static str {
    match token {
        lexer::Token::Number(_) => "NumberLiteral",
        lexer::Token::StringLit(_) => "StringLiteral",
        lexer::Token::True => "True",
        lexer::Token::False => "False",
        lexer::Token::Null => "Null",
        lexer::Token::DateLiteral(_) => "DateLiteral",
        lexer::Token::DateTimeLiteral(_) => "DateTimeLiteral",
        lexer::Token::Identifier(_) => "Identifier",
        lexer::Token::Let => "Let",
        lexer::Token::In => "In",
        lexer::Token::If => "If",
        lexer::Token::Then => "Then",
        lexer::Token::Else => "Else",
        lexer::Token::And => "And",
        lexer::Token::Or => "Or",
        lexer::Token::Not => "Not",
        lexer::Token::Bang => "Bang",
        lexer::Token::Plus => "Plus",
        lexer::Token::Minus => "Minus",
        lexer::Token::Star => "Asterisk",
        lexer::Token::Slash => "Slash",
        lexer::Token::Percent => "Percent",
        lexer::Token::Ampersand => "Ampersand",
        lexer::Token::Eq => "Equals",
        lexer::Token::NotEq => "NotEquals",
        lexer::Token::Lt => "Less",
        lexer::Token::Gt => "Greater",
        lexer::Token::LtEq => "LessEqual",
        lexer::Token::GtEq => "GreaterEqual",
        lexer::Token::DoubleQuestion => "DoubleQuestion",
        lexer::Token::Question => "Question",
        lexer::Token::LParen => "LRound",
        lexer::Token::RParen => "RRound",
        lexer::Token::LBracket => "LSquare",
        lexer::Token::RBracket => "RSquare",
        lexer::Token::LBrace => "LCurly",
        lexer::Token::RBrace => "RCurly",
        lexer::Token::Comma => "Comma",
        lexer::Token::Dot => "Dot",
        lexer::Token::Colon => "Colon",
        lexer::Token::Dollar => "Dollar",
        lexer::Token::At => "At",
        lexer::Token::Eof => "EOF",
    }
}

/// Slice `input` by Unicode scalar indices `[start, end)` (used for token text in `tokenize`).
fn slice_by_char_offsets(input: &str, start: usize, end: usize) -> String {
    input
        .chars()
        .skip(start)
        .take(end.saturating_sub(start))
        .collect()
}

/// Tokenize FEL source into [`PositionedToken`]s (lexical analysis only; no parse).
pub fn tokenize(input: &str) -> Result<Vec<PositionedToken>, String> {
    let mut lexer = lexer::Lexer::new(input);
    let tokens = lexer.tokenize()?;
    Ok(tokens
        .into_iter()
        .map(|token| PositionedToken {
            token_type: token_type_name(&token.token).to_string(),
            text: slice_by_char_offsets(input, token.span.start, token.span.end),
            start: token.span.start,
            end: token.span.end,
        })
        .collect())
}

/// FEL lexer tokens as JSON (camelCase keys) for host bindings.
pub fn tokenize_to_json_value(input: &str) -> Result<serde_json::Value, String> {
    let tokens = tokenize(input)?;
    Ok(serde_json::Value::Array(
        tokens
            .into_iter()
            .map(|token| {
                serde_json::json!({
                    "tokenType": token.token_type,
                    "text": token.text,
                    "start": token.start,
                    "end": token.end,
                })
            })
            .collect(),
    ))
}

/// Evaluation diagnostics as JSON objects (`message`, `severity` wire string).
pub fn fel_diagnostics_to_json_value(diagnostics: &[Diagnostic]) -> serde_json::Value {
    serde_json::Value::Array(
        diagnostics
            .iter()
            .map(|d| {
                serde_json::json!({
                    "message": d.message,
                    "severity": d.severity.as_wire_str(),
                })
            })
            .collect(),
    )
}

/// Parse and evaluate a FEL expression with a flat field map.
pub fn eval_with_fields(
    input: &str,
    fields: std::collections::HashMap<String, FelValue>,
) -> Result<EvalResult, FelError> {
    let expr = parse(input)?;
    let env = MapEnvironment::with_fields(fields);
    Ok(evaluate(&expr, &env))
}
