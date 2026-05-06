//! Lift parsed FEL into the structured condition-group shape used by Studio (`fel-condition-builder`).
//!
//! Conservative: only homogeneous `and` / `or` chains and leaf patterns supported by the TS builder.
// Rust guideline compliant 2026-02-21

use fel_core::ast::{BinaryOp, Expr, PathSegment, UnaryOp};
use fel_core::{Error, parse, print_expr};
use serde_json::{Value, json};

/// JSON result for [`try_lift_condition_group`]: `lifted` with `logic` + `conditions`, or `unlifted`.
pub fn try_lift_condition_group(expression: &str) -> Value {
    match parse(expression) {
        Ok(expr) => lift_parsed(&expr),
        Err(Error::Parse(pe)) => json!({
            "status": "unlifted",
            "reason": pe.message,
            "span": pe.span.map(|s| json!({ "start": s.start, "end": s.end })),
            "valid": false,
        }),
    }
}

fn lift_parsed(expr: &Expr) -> Value {
    if let Expr::Boolean(true) = expr {
        return json!({
            "status": "lifted",
            "logic": "and",
            "conditions": [{
                "field": "",
                "operator": "is_true",
                "value": ""
            }]
        });
    }
    if let Expr::Boolean(false) = expr {
        return json!({
            "status": "lifted",
            "logic": "and",
            "conditions": [{
                "field": "",
                "operator": "is_false",
                "value": ""
            }]
        });
    }

    let (logic, parts) = if let Some(parts) = try_flatten_and_chain(expr) {
        ("and", parts)
    } else if let Some(parts) = try_flatten_or_chain(expr) {
        ("or", parts)
    } else {
        return json!({
            "status": "unlifted",
            "reason": "mixed or unsupported logical structure (not a homogeneous and/or chain)",
            "valid": true,
        });
    };

    let mut conditions = Vec::new();
    for part in parts {
        match lift_leaf(part) {
            Some(c) => conditions.push(c),
            None => {
                return json!({
                    "status": "unlifted",
                    "reason": "one or more conjuncts are not supported condition shapes",
                    "valid": true,
                });
            }
        }
    }

    json!({
        "status": "lifted",
        "logic": logic,
        "conditions": conditions,
    })
}

fn try_flatten_and_chain<'a>(expr: &'a Expr) -> Option<Vec<&'a Expr>> {
    match expr {
        Expr::BinaryOp {
            op: BinaryOp::And,
            left,
            right,
        } => {
            let mut v = try_flatten_and_chain(left)?;
            v.extend(try_flatten_and_chain(right)?);
            Some(v)
        }
        Expr::BinaryOp {
            op: BinaryOp::Or, ..
        } => None,
        _ => Some(vec![expr]),
    }
}

fn try_flatten_or_chain<'a>(expr: &'a Expr) -> Option<Vec<&'a Expr>> {
    match expr {
        Expr::BinaryOp {
            op: BinaryOp::Or,
            left,
            right,
        } => {
            let mut v = try_flatten_or_chain(left)?;
            v.extend(try_flatten_or_chain(right)?);
            Some(v)
        }
        Expr::BinaryOp {
            op: BinaryOp::And, ..
        } => None,
        _ => Some(vec![expr]),
    }
}

fn field_ref_to_field_key(name: &Option<String>, path: &[PathSegment]) -> Option<String> {
    if name.is_none() && path.is_empty() {
        return Some("$".to_owned());
    }
    let mut s = String::new();
    if let Some(n) = name {
        s.push_str(n);
    } else {
        return None;
    }
    for seg in path {
        match seg {
            PathSegment::Dot(part) => {
                s.push('.');
                s.push_str(part);
            }
            PathSegment::Index(i) => {
                s.push('[');
                s.push_str(&i.to_string());
                s.push(']');
            }
            PathSegment::Wildcard => s.push_str("[*]"),
        }
    }
    Some(s)
}

fn rhs_allowed(source: &str) -> bool {
    if source.contains(':') || source.contains('?') {
        return false;
    }
    if source.starts_with('@') {
        return true;
    }
    let cleaned: String = source.chars().filter(|&c| c != '-').collect();
    !(cleaned.contains('*')
        || cleaned.contains('+')
        || cleaned.contains('/')
        || cleaned.contains('%'))
}

fn lift_leaf(expr: &Expr) -> Option<Value> {
    if let Some(v) = lift_unary_not_is_null(expr) {
        return Some(v);
    }
    if let Some(v) = lift_nullary_predicate(expr) {
        return Some(v);
    }
    if let Some(v) = lift_string_predicate(expr) {
        return Some(v);
    }
    if let Some(v) = lift_money_comparison(expr) {
        return Some(v);
    }
    lift_comparison(expr)
}

fn lift_unary_not_is_null(expr: &Expr) -> Option<Value> {
    let Expr::UnaryOp {
        op: UnaryOp::Not,
        operand,
        ..
    } = expr
    else {
        return None;
    };
    let Expr::FunctionCall { name, args } = operand.as_ref() else {
        return None;
    };
    if name != "isNull" || args.len() != 1 {
        return None;
    }
    let field = field_from_simple_ref(&args[0])?;
    Some(json!({
        "field": field,
        "operator": "is_not_null",
        "value": ""
    }))
}

fn lift_nullary_predicate(expr: &Expr) -> Option<Value> {
    let Expr::FunctionCall { name, args } = expr else {
        return None;
    };
    if args.len() != 1 {
        return None;
    }
    let field = field_from_simple_ref(&args[0])?;
    let op = match name.as_str() {
        "isNull" => "is_null",
        "empty" => "is_empty",
        "present" => "is_present",
        _ => return None,
    };
    Some(json!({ "field": field, "operator": op, "value": "" }))
}

fn lift_string_predicate(expr: &Expr) -> Option<Value> {
    let Expr::FunctionCall { name, args } = expr else {
        return None;
    };
    if args.len() != 2 {
        return None;
    }
    let field = field_from_simple_ref(&args[0])?;
    let rhs = print_expr(&args[1]);
    if !rhs_allowed(&rhs) {
        return None;
    }
    let value = normalize_string_condition_value(&rhs);
    let op = match name.as_str() {
        "contains" => "contains",
        "startsWith" => "starts_with",
        _ => return None,
    };
    Some(json!({ "field": field, "operator": op, "value": value }))
}

fn lift_money_comparison(expr: &Expr) -> Option<Value> {
    let Expr::BinaryOp { op, left, right } = expr else {
        return None;
    };
    let outer_op = money_op_str(*op)?;
    let Expr::FunctionCall { name, args } = left.as_ref() else {
        return None;
    };
    if name != "moneyAmount" || args.len() != 1 {
        return None;
    }
    let field = field_from_simple_ref(&args[0])?;
    let rhs = print_expr(right.as_ref());
    if !rhs_allowed(&rhs) {
        return None;
    }
    Some(json!({
        "field": field,
        "operator": outer_op,
        "value": normalize_string_condition_value(&rhs),
    }))
}

fn money_op_str(op: BinaryOp) -> Option<&'static str> {
    Some(match op {
        BinaryOp::Eq => "money_eq",
        BinaryOp::NotEq => "money_neq",
        BinaryOp::Gt => "money_gt",
        BinaryOp::GtEq => "money_gte",
        BinaryOp::Lt => "money_lt",
        BinaryOp::LtEq => "money_lte",
        _ => return None,
    })
}

fn lift_comparison(expr: &Expr) -> Option<Value> {
    let Expr::BinaryOp { op, left, right } = expr else {
        return None;
    };
    let field = match left.as_ref() {
        Expr::FieldRef { name, path } => field_ref_to_field_key(name, path)?,
        Expr::VarRef { name, path } => field_ref_to_field_key(&Some(name.clone()), path)?,
        _ => return None,
    };
    let rhs = print_expr(right.as_ref());
    if !rhs_allowed(&rhs) {
        return None;
    }
    match op {
        BinaryOp::Eq => {
            if let Expr::Boolean(true) = right.as_ref() {
                return Some(json!({ "field": field, "operator": "is_true", "value": "" }));
            }
            if let Expr::Boolean(false) = right.as_ref() {
                return Some(json!({ "field": field, "operator": "is_false", "value": "" }));
            }
            Some(json!({
                "field": field,
                "operator": "eq",
                "value": normalize_string_condition_value(&rhs),
            }))
        }
        BinaryOp::NotEq => Some(json!({
            "field": field,
            "operator": "neq",
            "value": normalize_string_condition_value(&rhs),
        })),
        BinaryOp::Gt => Some(json!({
            "field": field,
            "operator": "gt",
            "value": normalize_string_condition_value(&rhs),
        })),
        BinaryOp::GtEq => Some(json!({
            "field": field,
            "operator": "gte",
            "value": normalize_string_condition_value(&rhs),
        })),
        BinaryOp::Lt => Some(json!({
            "field": field,
            "operator": "lt",
            "value": normalize_string_condition_value(&rhs),
        })),
        BinaryOp::LtEq => Some(json!({
            "field": field,
            "operator": "lte",
            "value": normalize_string_condition_value(&rhs),
        })),
        _ => None,
    }
}

fn field_from_simple_ref(expr: &Expr) -> Option<String> {
    match expr {
        Expr::FieldRef { name, path } => field_ref_to_field_key(name, path),
        Expr::VarRef { name, path } => field_ref_to_field_key(&Some(name.clone()), path),
        _ => None,
    }
}

/// Mirror TS `normalizeStringValue`: double-quoted string literal → single-quoted FEL string.
fn normalize_string_condition_value(printed: &str) -> String {
    if printed.len() >= 2 && printed.starts_with('"') && printed.ends_with('"') {
        let inner = &printed[1..printed.len() - 1];
        return format!("'{inner}'");
    }
    printed.to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lifted_logic(v: &Value) -> String {
        v["logic"].as_str().unwrap().to_string()
    }

    fn cond_field(v: &Value, i: usize) -> String {
        v["conditions"][i]["field"].as_str().unwrap().to_string()
    }

    fn cond_op(v: &Value, i: usize) -> String {
        v["conditions"][i]["operator"].as_str().unwrap().to_string()
    }

    fn cond_val(v: &Value, i: usize) -> String {
        v["conditions"][i]["value"].as_str().unwrap().to_string()
    }

    #[test]
    fn lift_simple_and_chain() {
        let v = try_lift_condition_group("$a = 1 and $b > 2");
        assert_eq!(v["status"], "lifted");
        assert_eq!(lifted_logic(&v), "and");
        assert_eq!(cond_field(&v, 0), "a");
        assert_eq!(cond_op(&v, 0), "eq");
        assert_eq!(cond_val(&v, 0), "1");
        assert_eq!(cond_field(&v, 1), "b");
        assert_eq!(cond_op(&v, 1), "gt");
        assert_eq!(cond_val(&v, 1), "2");
    }

    #[test]
    fn lift_or_chain() {
        let v = try_lift_condition_group("$x = 1 or $y = 2");
        assert_eq!(v["status"], "lifted");
        assert_eq!(lifted_logic(&v), "or");
    }

    #[test]
    fn unlift_mixed_and_or() {
        let v = try_lift_condition_group("$a = 1 and $b = 2 or $c = 3");
        assert_eq!(v["status"], "unlifted");
        assert_eq!(v["valid"], true);
    }

    #[test]
    fn unlift_parse_error() {
        let v = try_lift_condition_group("$a ==");
        assert_eq!(v["status"], "unlifted");
        assert_eq!(v["valid"], false);
        assert!(
            v["span"].is_object(),
            "parse failure should surface span for tooling: {v:?}"
        );
    }

    #[test]
    fn lift_predicates() {
        let v = try_lift_condition_group("isNull($k) and not isNull($m)");
        assert_eq!(v["status"], "lifted");
        assert_eq!(cond_op(&v, 0), "is_null");
        assert_eq!(cond_field(&v, 0), "k");
        assert_eq!(cond_op(&v, 1), "is_not_null");
        assert_eq!(cond_field(&v, 1), "m");
    }

    #[test]
    fn lift_money() {
        let v = try_lift_condition_group("moneyAmount($price) >= 10");
        assert_eq!(v["status"], "lifted");
        assert_eq!(cond_op(&v, 0), "money_gte");
        assert_eq!(cond_field(&v, 0), "price");
        assert_eq!(cond_val(&v, 0), "10");
    }

    #[test]
    fn lift_true_false_literals() {
        let t = try_lift_condition_group("true");
        assert_eq!(t["status"], "lifted");
        assert_eq!(cond_op(&t, 0), "is_true");
        let f = try_lift_condition_group("false");
        assert_eq!(f["status"], "lifted");
        assert_eq!(cond_op(&f, 0), "is_false");
    }

    #[test]
    fn lift_contains_starts_with() {
        let v = try_lift_condition_group(r#"contains($name, "al")"#);
        assert_eq!(v["status"], "lifted");
        assert_eq!(cond_op(&v, 0), "contains");
        assert_eq!(cond_val(&v, 0), "'al'");
        let w = try_lift_condition_group("startsWith($code, 'x')");
        assert_eq!(w["status"], "lifted");
        assert_eq!(cond_op(&w, 0), "starts_with");
    }

    #[test]
    fn lift_dollar_root() {
        let v = try_lift_condition_group("$ = 1");
        assert_eq!(v["status"], "lifted");
        assert_eq!(cond_field(&v, 0), "$");
    }
}
