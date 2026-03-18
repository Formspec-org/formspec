//! FEL static analysis and expression rewriting for field references and variables.

/// FEL static analysis and path rewriting.
///
/// Analyzes FEL expressions to extract field references, variables, function calls,
/// and provides expression rewriting via callbacks (for $ref fragment imports, etc.).
use std::collections::HashSet;

use fel_core::ast::{Expr, PathSegment};
use fel_core::{parse, FelError};

// ── Analysis result ─────────────────────────────────────────────

/// Result of statically analyzing a FEL expression.
#[derive(Debug, Clone)]
pub struct FelAnalysis {
    /// Whether the expression parsed successfully.
    pub valid: bool,
    /// Parse errors, if any.
    pub errors: Vec<FelAnalysisError>,
    /// Field path references (e.g., `$name`, `$address.city`).
    pub references: HashSet<String>,
    /// Variable references via `@name` (excluding reserved: current, index, count, instance).
    pub variables: HashSet<String>,
    /// Function names called in the expression.
    pub functions: HashSet<String>,
}

/// A parse/analysis error with location info.
#[derive(Debug, Clone)]
pub struct FelAnalysisError {
    pub message: String,
}

/// Analyze a FEL expression string, extracting structural information.
pub fn analyze_fel(expression: &str) -> FelAnalysis {
    match parse(expression) {
        Ok(expr) => {
            let mut references = HashSet::new();
            let mut variables = HashSet::new();
            let mut functions = HashSet::new();
            collect_info(&expr, &mut references, &mut variables, &mut functions);
            FelAnalysis {
                valid: true,
                errors: vec![],
                references,
                variables,
                functions,
            }
        }
        Err(e) => FelAnalysis {
            valid: false,
            errors: vec![FelAnalysisError {
                message: match e {
                    FelError::Parse(m) | FelError::Eval(m) => m,
                },
            }],
            references: HashSet::new(),
            variables: HashSet::new(),
            functions: HashSet::new(),
        },
    }
}

/// Extract field dependencies from an expression (safe on parse failure).
pub fn get_fel_dependencies(expression: &str) -> HashSet<String> {
    match parse(expression) {
        Ok(expr) => {
            let mut refs = HashSet::new();
            let mut vars = HashSet::new();
            let mut fns = HashSet::new();
            collect_info(&expr, &mut refs, &mut vars, &mut fns);
            refs
        }
        Err(_) => HashSet::new(),
    }
}

// ── AST walking ─────────────────────────────────────────────────

const RESERVED_CONTEXT_NAMES: &[&str] = &["current", "index", "count", "instance"];

fn collect_info(
    expr: &Expr,
    references: &mut HashSet<String>,
    variables: &mut HashSet<String>,
    functions: &mut HashSet<String>,
) {
    match expr {
        Expr::FieldRef { name, path } => {
            let mut segments = Vec::new();
            if let Some(n) = name {
                segments.push(n.clone());
            }
            for seg in path {
                match seg {
                    PathSegment::Dot(s) => segments.push(s.clone()),
                    PathSegment::Index(i) => segments.push(format!("[{i}]")),
                    PathSegment::Wildcard => segments.push("[*]".to_string()),
                }
            }
            if !segments.is_empty() {
                references.insert(segments.join(".").replace(".[", "["));
            }
        }
        Expr::ContextRef { name, arg: _, tail: _ } => {
            if !RESERVED_CONTEXT_NAMES.contains(&name.as_str()) {
                variables.insert(name.clone());
            }
        }
        Expr::FunctionCall { name, args } => {
            functions.insert(name.clone());
            for arg in args {
                collect_info(arg, references, variables, functions);
            }
        }
        Expr::UnaryOp { operand, .. } => {
            collect_info(operand, references, variables, functions);
        }
        Expr::BinaryOp { left, right, .. } => {
            collect_info(left, references, variables, functions);
            collect_info(right, references, variables, functions);
        }
        Expr::Ternary { condition, then_branch, else_branch }
        | Expr::IfThenElse { condition, then_branch, else_branch } => {
            collect_info(condition, references, variables, functions);
            collect_info(then_branch, references, variables, functions);
            collect_info(else_branch, references, variables, functions);
        }
        Expr::Membership { value, container, .. } => {
            collect_info(value, references, variables, functions);
            collect_info(container, references, variables, functions);
        }
        Expr::NullCoalesce { left, right } => {
            collect_info(left, references, variables, functions);
            collect_info(right, references, variables, functions);
        }
        Expr::LetBinding { value, body, .. } => {
            collect_info(value, references, variables, functions);
            collect_info(body, references, variables, functions);
        }
        Expr::Array(elems) => {
            for e in elems {
                collect_info(e, references, variables, functions);
            }
        }
        Expr::Object(entries) => {
            for (_, v) in entries {
                collect_info(v, references, variables, functions);
            }
        }
        Expr::PostfixAccess { expr, .. } => {
            collect_info(expr, references, variables, functions);
        }
        // Literals — no references
        Expr::Null | Expr::Boolean(_) | Expr::Number(_) | Expr::String(_)
        | Expr::DateLiteral(_) | Expr::DateTimeLiteral(_) => {}
    }
}

// ── Expression rewriting ────────────────────────────────────────

/// Options for rewriting references in a FEL expression.
///
/// Each callback receives the current value and returns the replacement.
/// Return `None` to keep the original.
pub struct RewriteOptions {
    /// Rewrite `$field.path` references.
    pub rewrite_field_path: Option<Box<dyn Fn(&str) -> Option<String>>>,
    /// Rewrite `@variable` names.
    pub rewrite_variable: Option<Box<dyn Fn(&str) -> Option<String>>>,
    /// Rewrite `@instance('name')` names.
    pub rewrite_instance_name: Option<Box<dyn Fn(&str) -> Option<String>>>,
}

/// Rewrite references in a FEL expression AST.
///
/// Returns a new AST with transformed references.
pub fn rewrite_fel_references(expr: &Expr, options: &RewriteOptions) -> Expr {
    rewrite_expr(expr, options)
}

fn rewrite_expr(expr: &Expr, opts: &RewriteOptions) -> Expr {
    match expr {
        Expr::FieldRef { name, path } => {
            if let Some(ref rewrite) = opts.rewrite_field_path {
                // Build the full path string
                let mut segments = Vec::new();
                if let Some(n) = name {
                    segments.push(n.clone());
                }
                for seg in path {
                    match seg {
                        PathSegment::Dot(s) => segments.push(s.clone()),
                        PathSegment::Index(i) => segments.push(format!("[{i}]")),
                        PathSegment::Wildcard => segments.push("[*]".to_string()),
                    }
                }
                let original = segments.join(".").replace(".[", "[");
                if let Some(new_path) = rewrite(&original) {
                    // Parse the new path back into name + segments
                    return parse_field_ref_from_path(&new_path);
                }
            }
            expr.clone()
        }
        Expr::ContextRef { name, arg, tail } => {
            if name == "instance" {
                if let (Some(rewrite), Some(orig_name)) = (&opts.rewrite_instance_name, arg) {
                    if let Some(new_name) = rewrite(orig_name) {
                        return Expr::ContextRef {
                            name: name.clone(),
                            arg: Some(new_name),
                            tail: tail.clone(),
                        };
                    }
                }
            } else if !RESERVED_CONTEXT_NAMES.contains(&name.as_str()) {
                if let Some(ref rewrite) = opts.rewrite_variable {
                    if let Some(new_name) = rewrite(name) {
                        return Expr::ContextRef {
                            name: new_name,
                            arg: arg.clone(),
                            tail: tail.clone(),
                        };
                    }
                }
            }
            expr.clone()
        }
        Expr::FunctionCall { name, args } => Expr::FunctionCall {
            name: name.clone(),
            args: args.iter().map(|a| rewrite_expr(a, opts)).collect(),
        },
        Expr::UnaryOp { op, operand } => Expr::UnaryOp {
            op: *op,
            operand: Box::new(rewrite_expr(operand, opts)),
        },
        Expr::BinaryOp { op, left, right } => Expr::BinaryOp {
            op: *op,
            left: Box::new(rewrite_expr(left, opts)),
            right: Box::new(rewrite_expr(right, opts)),
        },
        Expr::Ternary { condition, then_branch, else_branch } => Expr::Ternary {
            condition: Box::new(rewrite_expr(condition, opts)),
            then_branch: Box::new(rewrite_expr(then_branch, opts)),
            else_branch: Box::new(rewrite_expr(else_branch, opts)),
        },
        Expr::IfThenElse { condition, then_branch, else_branch } => Expr::IfThenElse {
            condition: Box::new(rewrite_expr(condition, opts)),
            then_branch: Box::new(rewrite_expr(then_branch, opts)),
            else_branch: Box::new(rewrite_expr(else_branch, opts)),
        },
        Expr::Membership { value, container, negated } => Expr::Membership {
            value: Box::new(rewrite_expr(value, opts)),
            container: Box::new(rewrite_expr(container, opts)),
            negated: *negated,
        },
        Expr::NullCoalesce { left, right } => Expr::NullCoalesce {
            left: Box::new(rewrite_expr(left, opts)),
            right: Box::new(rewrite_expr(right, opts)),
        },
        Expr::LetBinding { name, value, body } => Expr::LetBinding {
            name: name.clone(),
            value: Box::new(rewrite_expr(value, opts)),
            body: Box::new(rewrite_expr(body, opts)),
        },
        Expr::Array(elems) => Expr::Array(elems.iter().map(|e| rewrite_expr(e, opts)).collect()),
        Expr::Object(entries) => Expr::Object(
            entries.iter().map(|(k, v)| (k.clone(), rewrite_expr(v, opts))).collect(),
        ),
        Expr::PostfixAccess { expr: inner, path } => Expr::PostfixAccess {
            expr: Box::new(rewrite_expr(inner, opts)),
            path: path.clone(),
        },
        // Literals pass through unchanged
        _ => expr.clone(),
    }
}

/// Parse a dotted path string back into a FieldRef AST node.
fn parse_field_ref_from_path(path: &str) -> Expr {
    let parts: Vec<&str> = path.split('.').collect();
    if parts.is_empty() {
        return Expr::FieldRef { name: None, path: vec![] };
    }
    let name = Some(parts[0].to_string());
    let mut segments = Vec::new();
    for &part in &parts[1..] {
        if let Some(idx_str) = part.strip_prefix('[').and_then(|s| s.strip_suffix(']')) {
            if idx_str == "*" {
                segments.push(PathSegment::Wildcard);
            } else if let Ok(idx) = idx_str.parse::<usize>() {
                segments.push(PathSegment::Index(idx));
            } else {
                segments.push(PathSegment::Dot(part.to_string()));
            }
        } else {
            segments.push(PathSegment::Dot(part.to_string()));
        }
    }
    Expr::FieldRef { name, path: segments }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_simple_expression() {
        let result = analyze_fel("$name + 1");
        assert!(result.valid);
        assert!(result.references.contains("name"));
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_analyze_nested_references() {
        let result = analyze_fel("$address.city & ', ' & $address.state");
        assert!(result.valid);
        assert!(result.references.contains("address.city"));
        assert!(result.references.contains("address.state"));
    }

    #[test]
    fn test_analyze_variables() {
        let result = analyze_fel("@total + @subtotal");
        assert!(result.valid);
        assert!(result.variables.contains("total"));
        assert!(result.variables.contains("subtotal"));
    }

    #[test]
    fn test_analyze_reserved_context_not_variable() {
        let result = analyze_fel("@current + @index + @count");
        assert!(result.valid);
        assert!(result.variables.is_empty()); // current, index, count are reserved
    }

    #[test]
    fn test_analyze_functions() {
        let result = analyze_fel("sum($items[*].qty) + round($total, 2)");
        assert!(result.valid);
        assert!(result.functions.contains("sum"));
        assert!(result.functions.contains("round"));
    }

    #[test]
    fn test_analyze_invalid_expression() {
        let result = analyze_fel("1 + + 2");
        assert!(!result.valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_get_dependencies() {
        let refs = get_fel_dependencies("if $age >= 18 then $category else 'minor'");
        assert!(refs.contains("age"));
        assert!(refs.contains("category"));
    }

    #[test]
    fn test_get_dependencies_on_parse_error() {
        let refs = get_fel_dependencies("invalid ++ expr");
        assert!(refs.is_empty());
    }

    #[test]
    fn test_rewrite_field_paths() {
        let expr = parse("$name + $age").unwrap();
        let rewritten = rewrite_fel_references(&expr, &RewriteOptions {
            rewrite_field_path: Some(Box::new(|path| {
                Some(format!("prefix_{path}"))
            })),
            rewrite_variable: None,
            rewrite_instance_name: None,
        });

        // Check the rewritten AST has the prefixed names
        let mut refs = HashSet::new();
        let mut vars = HashSet::new();
        let mut fns = HashSet::new();
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns);
        assert!(refs.contains("prefix_name"));
        assert!(refs.contains("prefix_age"));
        assert!(!refs.contains("name"));
        assert!(!refs.contains("age"));
    }

    #[test]
    fn test_rewrite_variables() {
        let expr = parse("@total * 2").unwrap();
        let rewritten = rewrite_fel_references(&expr, &RewriteOptions {
            rewrite_field_path: None,
            rewrite_variable: Some(Box::new(|name| {
                if name == "total" { Some("grandTotal".to_string()) } else { None }
            })),
            rewrite_instance_name: None,
        });

        let mut refs = HashSet::new();
        let mut vars = HashSet::new();
        let mut fns = HashSet::new();
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns);
        assert!(vars.contains("grandTotal"));
        assert!(!vars.contains("total"));
    }

    #[test]
    fn test_rewrite_preserves_non_matching() {
        let expr = parse("$keep + $change").unwrap();
        let rewritten = rewrite_fel_references(&expr, &RewriteOptions {
            rewrite_field_path: Some(Box::new(|path| {
                if path == "change" { Some("changed".to_string()) } else { None }
            })),
            rewrite_variable: None,
            rewrite_instance_name: None,
        });

        let mut refs = HashSet::new();
        let mut vars = HashSet::new();
        let mut fns = HashSet::new();
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns);
        assert!(refs.contains("keep"));
        assert!(refs.contains("changed"));
    }

    #[test]
    fn test_wildcard_in_references() {
        let result = analyze_fel("sum($items[*].price)");
        assert!(result.references.contains("items[*].price"));
    }
}
