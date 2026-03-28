//! Helpers for `{{expression}}` message interpolation (locale spec §3.3.1).
#![allow(missing_docs)]
#![allow(clippy::missing_docs_in_private_items)]

use crate::ast::{Expr, UnaryOp};

/// True when the AST is only literals and unary `not`/`!`/`-` on such (locale §3.3.1).
pub fn expr_is_interpolation_static_literal(expr: &Expr) -> bool {
    match expr {
        Expr::Null
        | Expr::Boolean(_)
        | Expr::Number(_)
        | Expr::String(_)
        | Expr::DateLiteral(_)
        | Expr::DateTimeLiteral(_) => true,
        Expr::Array(elems) => elems.iter().all(expr_is_interpolation_static_literal),
        Expr::Object(entries) => entries
            .iter()
            .all(|(_, v)| expr_is_interpolation_static_literal(v)),
        Expr::UnaryOp {
            op: UnaryOp::Not | UnaryOp::Neg,
            operand,
            ..
        } => expr_is_interpolation_static_literal(operand),
        _ => false,
    }
}
