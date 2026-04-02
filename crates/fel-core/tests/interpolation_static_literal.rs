//! Tests for locale interpolation static-literal predicate.
use fel_core::{expr_is_interpolation_static_literal, parse};

fn lit(expr: &str) -> bool {
    expr_is_interpolation_static_literal(&parse(expr).unwrap())
}

#[test]
fn literals_and_unary_chains() {
    assert!(lit("null"));
    assert!(lit("not null"));
    assert!(lit("!null"));
    assert!(lit("!!true"));
    assert!(lit("-5"));
}

#[test]
fn field_ref_is_not_static_literal() {
    assert!(!lit("bad"));
    assert!(!lit("!!!bad"));
}
