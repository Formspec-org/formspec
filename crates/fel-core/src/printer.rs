/// FEL AST → string printer — serializes an AST back to valid FEL source.
///
/// Used by the assembler to rewrite FEL expressions after AST transformations
/// (e.g., field path prefixing during $ref resolution).

use crate::ast::*;
use crate::types::format_number;

/// Print a FEL expression AST back to a source string.
pub fn print_expr(expr: &Expr) -> String {
    let mut buf = String::new();
    write_expr(&mut buf, expr, false);
    buf
}

fn write_expr(buf: &mut String, expr: &Expr, needs_parens: bool) {
    match expr {
        Expr::Null => buf.push_str("null"),
        Expr::Boolean(true) => buf.push_str("true"),
        Expr::Boolean(false) => buf.push_str("false"),
        Expr::Number(n) => buf.push_str(&format_number(*n)),
        Expr::String(s) => write_string_literal(buf, s),
        Expr::DateLiteral(s) => buf.push_str(s),
        Expr::DateTimeLiteral(s) => buf.push_str(s),

        Expr::Array(elems) => {
            buf.push('[');
            for (i, e) in elems.iter().enumerate() {
                if i > 0 { buf.push_str(", "); }
                write_expr(buf, e, false);
            }
            buf.push(']');
        }
        Expr::Object(entries) => {
            buf.push('{');
            for (i, (k, v)) in entries.iter().enumerate() {
                if i > 0 { buf.push_str(", "); }
                write_string_literal(buf, k);
                buf.push_str(": ");
                write_expr(buf, v, false);
            }
            buf.push('}');
        }

        Expr::FieldRef { name, path } => {
            buf.push('$');
            if let Some(n) = name {
                buf.push_str(n);
            }
            write_path_segments(buf, path);
        }
        Expr::ContextRef { name, arg, tail } => {
            buf.push('@');
            buf.push_str(name);
            if let Some(a) = arg {
                buf.push('(');
                write_string_literal(buf, a);
                buf.push(')');
            }
            for t in tail {
                buf.push('.');
                buf.push_str(t);
            }
        }

        Expr::UnaryOp { op, operand } => {
            match op {
                UnaryOp::Not => {
                    buf.push_str("not ");
                    write_expr(buf, operand, true);
                }
                UnaryOp::Neg => {
                    buf.push('-');
                    write_expr(buf, operand, true);
                }
            }
        }

        Expr::BinaryOp { op, left, right } => {
            if needs_parens { buf.push('('); }
            write_expr(buf, left, true);
            buf.push(' ');
            buf.push_str(binary_op_str(*op));
            buf.push(' ');
            write_expr(buf, right, true);
            if needs_parens { buf.push(')'); }
        }

        Expr::Ternary { condition, then_branch, else_branch } => {
            if needs_parens { buf.push('('); }
            write_expr(buf, condition, true);
            buf.push_str(" ? ");
            write_expr(buf, then_branch, false);
            buf.push_str(" : ");
            write_expr(buf, else_branch, false);
            if needs_parens { buf.push(')'); }
        }

        Expr::IfThenElse { condition, then_branch, else_branch } => {
            if needs_parens { buf.push('('); }
            buf.push_str("if ");
            write_expr(buf, condition, false);
            buf.push_str(" then ");
            write_expr(buf, then_branch, false);
            buf.push_str(" else ");
            write_expr(buf, else_branch, false);
            if needs_parens { buf.push(')'); }
        }

        Expr::Membership { value, container, negated } => {
            if needs_parens { buf.push('('); }
            write_expr(buf, value, true);
            if *negated {
                buf.push_str(" not in ");
            } else {
                buf.push_str(" in ");
            }
            write_expr(buf, container, true);
            if needs_parens { buf.push(')'); }
        }

        Expr::NullCoalesce { left, right } => {
            if needs_parens { buf.push('('); }
            write_expr(buf, left, true);
            buf.push_str(" ?? ");
            write_expr(buf, right, true);
            if needs_parens { buf.push(')'); }
        }

        Expr::LetBinding { name, value, body } => {
            if needs_parens { buf.push('('); }
            buf.push_str("let ");
            buf.push_str(name);
            buf.push_str(" = ");
            write_expr(buf, value, false);
            buf.push_str(" in ");
            write_expr(buf, body, false);
            if needs_parens { buf.push(')'); }
        }

        Expr::FunctionCall { name, args } => {
            buf.push_str(name);
            buf.push('(');
            for (i, arg) in args.iter().enumerate() {
                if i > 0 { buf.push_str(", "); }
                write_expr(buf, arg, false);
            }
            buf.push(')');
        }

        Expr::PostfixAccess { expr: inner, path } => {
            write_expr(buf, inner, true);
            write_path_segments(buf, path);
        }
    }
}

fn write_path_segments(buf: &mut String, segments: &[PathSegment]) {
    for seg in segments {
        match seg {
            PathSegment::Dot(name) => {
                buf.push('.');
                buf.push_str(name);
            }
            PathSegment::Index(idx) => {
                buf.push('[');
                buf.push_str(&idx.to_string());
                buf.push(']');
            }
            PathSegment::Wildcard => {
                buf.push_str("[*]");
            }
        }
    }
}

fn write_string_literal(buf: &mut String, s: &str) {
    buf.push('\'');
    for c in s.chars() {
        match c {
            '\'' => buf.push_str("\\'"),
            '\\' => buf.push_str("\\\\"),
            '\n' => buf.push_str("\\n"),
            '\t' => buf.push_str("\\t"),
            '\r' => buf.push_str("\\r"),
            _ => buf.push(c),
        }
    }
    buf.push('\'');
}

fn binary_op_str(op: BinaryOp) -> &'static str {
    match op {
        BinaryOp::Add => "+",
        BinaryOp::Sub => "-",
        BinaryOp::Mul => "*",
        BinaryOp::Div => "/",
        BinaryOp::Mod => "%",
        BinaryOp::Concat => "&",
        BinaryOp::Eq => "=",
        BinaryOp::NotEq => "!=",
        BinaryOp::Lt => "<",
        BinaryOp::Gt => ">",
        BinaryOp::LtEq => "<=",
        BinaryOp::GtEq => ">=",
        BinaryOp::And => "and",
        BinaryOp::Or => "or",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse;

    /// Round-trip: parse → print → parse → verify equality
    fn round_trip(input: &str) {
        let ast = parse(input).unwrap();
        let printed = print_expr(&ast);
        let reparsed = parse(&printed).unwrap_or_else(|e| {
            panic!("Failed to reparse printed output '{printed}' (from '{input}'): {e}");
        });
        assert_eq!(ast, reparsed, "Round-trip failed for '{input}' → '{printed}'");
    }

    #[test]
    fn test_literals() {
        round_trip("42");
        round_trip("3.14");
        round_trip("true");
        round_trip("false");
        round_trip("null");
        round_trip("'hello'");
        round_trip("'it\\'s'");
    }

    #[test]
    fn test_field_refs() {
        round_trip("$name");
        round_trip("$address.city");
        round_trip("$items[*].qty");
        round_trip("$items[1]");
    }

    #[test]
    fn test_context_refs() {
        round_trip("@current");
        round_trip("@index");
        round_trip("@total");
    }

    #[test]
    fn test_arithmetic() {
        round_trip("$a + $b");
        round_trip("$a - $b * $c");
        round_trip("($a + $b) * $c");
    }

    #[test]
    fn test_logical() {
        round_trip("$a and $b");
        round_trip("$a or $b");
        round_trip("not $a");
    }

    #[test]
    fn test_comparison() {
        round_trip("$a = $b");
        round_trip("$a != $b");
        round_trip("$a < $b");
        round_trip("$a >= 18");
    }

    #[test]
    fn test_functions() {
        round_trip("sum($items[*].qty)");
        round_trip("round($total, 2)");
        round_trip("if($a, $b, $c)");
    }

    #[test]
    fn test_ternary() {
        round_trip("$a ? $b : $c");
    }

    #[test]
    fn test_if_then_else() {
        round_trip("if $age >= 18 then 'adult' else 'minor'");
    }

    #[test]
    fn test_let_binding() {
        round_trip("let x = 5 in x + 1");
    }

    #[test]
    fn test_null_coalesce() {
        round_trip("$a ?? $b");
    }

    #[test]
    fn test_membership() {
        round_trip("$a in [1, 2, 3]");
        round_trip("$a not in [1, 2]");
    }

    #[test]
    fn test_array_object() {
        round_trip("[1, 2, 3]");
        round_trip("{'key': 'value'}");
    }

    #[test]
    fn test_complex() {
        round_trip("sum($items[*].qty * $items[*].price)");
        round_trip("if $age >= 18 then 'adult' else 'minor'");
        round_trip("let total = $a + $b in total * 1.1");
    }

    #[test]
    fn test_string_escaping() {
        round_trip("'hello\\nworld'");
        round_trip("'tab\\there'");
    }
}
