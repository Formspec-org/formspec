//! FEL static analysis and expression rewriting for field references and variables.

/// FEL static analysis and path rewriting.
///
/// Analyzes FEL expressions to extract field references, variables, function calls,
/// and provides expression rewriting via callbacks (for $ref fragment imports, etc.).
use std::collections::HashSet;

use fel_core::ast::{Expr, PathSegment};
use fel_core::{FelError, parse};

/// Callback that rewrites a single string reference, returning `None` to keep the original.
type RewriteFn = Box<dyn Fn(&str) -> Option<String>>;

/// Callback that rewrites a two-argument reference (e.g. navigation function + field name).
type RewriteFn2 = Box<dyn Fn(&str, &str) -> Option<String>>;

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

/// Field/variable/navigation targets that can be rewritten in a FEL expression.
#[derive(Debug, Clone, Default)]
pub struct FelRewriteTargets {
    pub field_paths: HashSet<String>,
    pub current_paths: HashSet<String>,
    pub variables: HashSet<String>,
    pub instance_names: HashSet<String>,
    pub navigation_targets: Vec<NavigationTarget>,
}

/// A literal navigation target passed to prev()/next()/parent().
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct NavigationTarget {
    pub function_name: String,
    pub name: String,
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

/// Collect every rewriteable target referenced by a FEL expression.
pub fn collect_fel_rewrite_targets(expression: &str) -> FelRewriteTargets {
    match parse(expression) {
        Ok(expr) => {
            let mut targets = FelRewriteTargets::default();
            collect_rewrite_targets(&expr, &mut targets);
            targets
        }
        Err(_) => FelRewriteTargets::default(),
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
        Expr::ContextRef {
            name,
            arg: _,
            tail: _,
        } => {
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
        Expr::Ternary {
            condition,
            then_branch,
            else_branch,
        }
        | Expr::IfThenElse {
            condition,
            then_branch,
            else_branch,
        } => {
            collect_info(condition, references, variables, functions);
            collect_info(then_branch, references, variables, functions);
            collect_info(else_branch, references, variables, functions);
        }
        Expr::Membership {
            value, container, ..
        } => {
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
        Expr::Null
        | Expr::Boolean(_)
        | Expr::Number(_)
        | Expr::String(_)
        | Expr::DateLiteral(_)
        | Expr::DateTimeLiteral(_) => {}
    }
}

// ── Expression rewriting ────────────────────────────────────────

/// Options for rewriting references in a FEL expression.
///
/// Each callback receives the current value and returns the replacement.
/// Return `None` to keep the original.
pub struct RewriteOptions {
    /// Rewrite `$field.path` references.
    pub rewrite_field_path: Option<RewriteFn>,
    /// Rewrite the dotted tail of `@current.foo.bar`.
    pub rewrite_current_path: Option<RewriteFn>,
    /// Rewrite `@variable` names.
    pub rewrite_variable: Option<RewriteFn>,
    /// Rewrite `@instance('name')` names.
    pub rewrite_instance_name: Option<RewriteFn>,
    /// Rewrite literal field-name arguments to prev()/next()/parent().
    pub rewrite_navigation_target: Option<RewriteFn2>,
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
                if let (Some(rewrite), Some(orig_name)) = (&opts.rewrite_instance_name, arg)
                    && let Some(new_name) = rewrite(orig_name) {
                        return Expr::ContextRef {
                            name: name.clone(),
                            arg: Some(new_name),
                            tail: tail.clone(),
                        };
                    }
            } else if name == "current" {
                if let Some(ref rewrite) = opts.rewrite_current_path
                    && !tail.is_empty() {
                        let current_path = tail.join(".");
                        if let Some(new_path) = rewrite(&current_path) {
                            return Expr::ContextRef {
                                name: name.clone(),
                                arg: arg.clone(),
                                tail: if new_path.is_empty() {
                                    vec![]
                                } else {
                                    new_path
                                        .split('.')
                                        .filter(|segment| !segment.is_empty())
                                        .map(|segment| segment.to_string())
                                        .collect()
                                },
                            };
                        }
                    }
            } else if !RESERVED_CONTEXT_NAMES.contains(&name.as_str())
                && let Some(ref rewrite) = opts.rewrite_variable
                    && let Some(new_name) = rewrite(name) {
                        return Expr::ContextRef {
                            name: new_name,
                            arg: arg.clone(),
                            tail: tail.clone(),
                        };
                    }
            expr.clone()
        }
        Expr::FunctionCall { name, args } => {
            let mut rewritten_args: Vec<Expr> =
                args.iter().map(|a| rewrite_expr(a, opts)).collect();
            if let Some(ref rewrite) = opts.rewrite_navigation_target
                && matches!(name.as_str(), "prev" | "next" | "parent")
                    && let Some(Expr::String(current)) = rewritten_args.first()
                        && let Some(new_name) = rewrite(current, name)
                            && let Some(first) = rewritten_args.first_mut() {
                                *first = Expr::String(new_name);
                            }
            Expr::FunctionCall {
                name: name.clone(),
                args: rewritten_args,
            }
        }
        Expr::UnaryOp { op, operand } => Expr::UnaryOp {
            op: *op,
            operand: Box::new(rewrite_expr(operand, opts)),
        },
        Expr::BinaryOp { op, left, right } => Expr::BinaryOp {
            op: *op,
            left: Box::new(rewrite_expr(left, opts)),
            right: Box::new(rewrite_expr(right, opts)),
        },
        Expr::Ternary {
            condition,
            then_branch,
            else_branch,
        } => Expr::Ternary {
            condition: Box::new(rewrite_expr(condition, opts)),
            then_branch: Box::new(rewrite_expr(then_branch, opts)),
            else_branch: Box::new(rewrite_expr(else_branch, opts)),
        },
        Expr::IfThenElse {
            condition,
            then_branch,
            else_branch,
        } => Expr::IfThenElse {
            condition: Box::new(rewrite_expr(condition, opts)),
            then_branch: Box::new(rewrite_expr(then_branch, opts)),
            else_branch: Box::new(rewrite_expr(else_branch, opts)),
        },
        Expr::Membership {
            value,
            container,
            negated,
        } => Expr::Membership {
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
            entries
                .iter()
                .map(|(k, v)| (k.clone(), rewrite_expr(v, opts)))
                .collect(),
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
        return Expr::FieldRef {
            name: None,
            path: vec![],
        };
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
    Expr::FieldRef {
        name,
        path: segments,
    }
}

fn collect_rewrite_targets(expr: &Expr, targets: &mut FelRewriteTargets) {
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
                targets
                    .field_paths
                    .insert(segments.join(".").replace(".[", "["));
            }
        }
        Expr::ContextRef { name, arg, tail } => {
            if name == "current" {
                if !tail.is_empty() {
                    targets.current_paths.insert(tail.join("."));
                }
            } else if name == "instance" {
                if let Some(instance_name) = arg {
                    targets.instance_names.insert(instance_name.clone());
                }
            } else if !RESERVED_CONTEXT_NAMES.contains(&name.as_str()) {
                targets.variables.insert(name.clone());
            }
        }
        Expr::FunctionCall { name, args } => {
            if matches!(name.as_str(), "prev" | "next" | "parent")
                && let Some(Expr::String(target_name)) = args.first() {
                    let nav = NavigationTarget {
                        function_name: name.clone(),
                        name: target_name.clone(),
                    };
                    if !targets.navigation_targets.contains(&nav) {
                        targets.navigation_targets.push(nav);
                    }
                }
            for arg in args {
                collect_rewrite_targets(arg, targets);
            }
        }
        Expr::UnaryOp { operand, .. } => collect_rewrite_targets(operand, targets),
        Expr::BinaryOp { left, right, .. } => {
            collect_rewrite_targets(left, targets);
            collect_rewrite_targets(right, targets);
        }
        Expr::Ternary {
            condition,
            then_branch,
            else_branch,
        }
        | Expr::IfThenElse {
            condition,
            then_branch,
            else_branch,
        } => {
            collect_rewrite_targets(condition, targets);
            collect_rewrite_targets(then_branch, targets);
            collect_rewrite_targets(else_branch, targets);
        }
        Expr::Membership {
            value, container, ..
        } => {
            collect_rewrite_targets(value, targets);
            collect_rewrite_targets(container, targets);
        }
        Expr::NullCoalesce { left, right } => {
            collect_rewrite_targets(left, targets);
            collect_rewrite_targets(right, targets);
        }
        Expr::LetBinding { value, body, .. } => {
            collect_rewrite_targets(value, targets);
            collect_rewrite_targets(body, targets);
        }
        Expr::Array(elems) => {
            for elem in elems {
                collect_rewrite_targets(elem, targets);
            }
        }
        Expr::Object(entries) => {
            for (_, value) in entries {
                collect_rewrite_targets(value, targets);
            }
        }
        Expr::PostfixAccess { expr, .. } => collect_rewrite_targets(expr, targets),
        Expr::Null
        | Expr::Boolean(_)
        | Expr::Number(_)
        | Expr::String(_)
        | Expr::DateLiteral(_)
        | Expr::DateTimeLiteral(_) => {}
    }
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
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: Some(Box::new(|path| Some(format!("prefix_{path}")))),
                rewrite_current_path: None,
                rewrite_variable: None,
                rewrite_instance_name: None,
                rewrite_navigation_target: None,
            },
        );

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
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: None,
                rewrite_current_path: None,
                rewrite_variable: Some(Box::new(|name| {
                    if name == "total" {
                        Some("grandTotal".to_string())
                    } else {
                        None
                    }
                })),
                rewrite_instance_name: None,
                rewrite_navigation_target: None,
            },
        );

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
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: Some(Box::new(|path| {
                    if path == "change" {
                        Some("changed".to_string())
                    } else {
                        None
                    }
                })),
                rewrite_current_path: None,
                rewrite_variable: None,
                rewrite_instance_name: None,
                rewrite_navigation_target: None,
            },
        );

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

    // ── rewrite_instance_name callback — fel_analysis ────────────

    /// Spec: fel-grammar.md §6.3 — "rewrite_instance_name rewrites @instance('name') arg"
    #[test]
    fn rewrite_instance_name_callback() {
        let expr = parse("@instance('group1')").unwrap();
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: None,
                rewrite_current_path: None,
                rewrite_variable: None,
                rewrite_instance_name: Some(Box::new(|name| {
                    if name == "group1" {
                        Some("newGroup".to_string())
                    } else {
                        None
                    }
                })),
                rewrite_navigation_target: None,
            },
        );
        let printed = fel_core::print_expr(&rewritten);
        assert!(
            printed.contains("newGroup"),
            "expected 'newGroup' in rewritten expr: {printed}"
        );
    }

    /// Spec: fel-grammar.md §6.3 — "rewrite_instance_name returns None leaves original"
    #[test]
    fn rewrite_instance_name_none_preserves() {
        let expr = parse("@instance('keep')").unwrap();
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: None,
                rewrite_current_path: None,
                rewrite_variable: None,
                rewrite_instance_name: Some(Box::new(|_| None)),
                rewrite_navigation_target: None,
            },
        );
        let printed = fel_core::print_expr(&rewritten);
        assert!(
            printed.contains("keep"),
            "original should be preserved: {printed}"
        );
    }

    // ── Complex nested expressions in rewriting ──────────────────

    /// Spec: fel-grammar.md §5 — "Rewriting works inside ternary branches"
    #[test]
    fn rewrite_inside_ternary() {
        let expr = parse("if $flag then $a else $b").unwrap();
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: Some(Box::new(|path| Some(format!("pre.{path}")))),
                rewrite_current_path: None,
                rewrite_variable: None,
                rewrite_instance_name: None,
                rewrite_navigation_target: None,
            },
        );
        let mut refs = HashSet::new();
        let mut vars = HashSet::new();
        let mut fns = HashSet::new();
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns);
        assert!(refs.contains("pre.flag"));
        assert!(refs.contains("pre.a"));
        assert!(refs.contains("pre.b"));
    }

    /// Spec: fel-grammar.md §5 — "Rewriting works inside function args"
    #[test]
    fn rewrite_inside_function_args() {
        let expr = parse("sum($items[*].qty) + max($items[*].price)").unwrap();
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: Some(Box::new(|path| Some(format!("order.{path}")))),
                rewrite_current_path: None,
                rewrite_variable: None,
                rewrite_instance_name: None,
                rewrite_navigation_target: None,
            },
        );
        let mut refs = HashSet::new();
        let mut vars = HashSet::new();
        let mut fns = HashSet::new();
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns);
        assert!(refs.contains("order.items[*].qty"), "refs: {refs:?}");
        assert!(refs.contains("order.items[*].price"), "refs: {refs:?}");
    }

    /// Spec: fel-grammar.md §5 — "Rewriting works inside let-binding value and body"
    #[test]
    fn rewrite_inside_let_binding() {
        let expr = parse("let x = $a in $b + x").unwrap();
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: Some(Box::new(|path| Some(format!("p.{path}")))),
                rewrite_current_path: None,
                rewrite_variable: None,
                rewrite_instance_name: None,
                rewrite_navigation_target: None,
            },
        );
        let mut refs = HashSet::new();
        let mut vars = HashSet::new();
        let mut fns = HashSet::new();
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns);
        assert!(refs.contains("p.a"), "refs: {refs:?}");
        assert!(refs.contains("p.b"), "refs: {refs:?}");
    }

    #[test]
    fn rewrite_current_path_segments() {
        let expr = parse("@current.address.street").unwrap();
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: None,
                rewrite_current_path: Some(Box::new(|path| {
                    if path == "address.street" {
                        Some("contact.primaryStreet".to_string())
                    } else {
                        None
                    }
                })),
                rewrite_variable: None,
                rewrite_instance_name: None,
                rewrite_navigation_target: None,
            },
        );
        let printed = fel_core::print_expr(&rewritten);
        assert_eq!(printed, "@current.contact.primaryStreet");
    }

    #[test]
    fn rewrite_navigation_literal_targets_only() {
        let expr = parse("prev('amount') + next(concat('amount', @suffix))").unwrap();
        let rewritten = rewrite_fel_references(
            &expr,
            &RewriteOptions {
                rewrite_field_path: None,
                rewrite_current_path: None,
                rewrite_variable: None,
                rewrite_instance_name: None,
                rewrite_navigation_target: Some(Box::new(|name, fn_name| {
                    if fn_name == "prev" && name == "amount" {
                        Some("pref_amount".to_string())
                    } else {
                        None
                    }
                })),
            },
        );
        let printed = fel_core::print_expr(&rewritten);
        assert_eq!(
            printed,
            "prev('pref_amount') + next(concat('amount', @suffix))"
        );
    }

    #[test]
    fn collect_rewrite_targets_captures_all_categories() {
        let targets = collect_fel_rewrite_targets(
            "$total + @current.line.amount + prev('amount') + @instance('lookup') + @var",
        );
        assert!(targets.field_paths.contains("total"));
        assert!(targets.current_paths.contains("line.amount"));
        assert!(targets.instance_names.contains("lookup"));
        assert!(targets.variables.contains("var"));
        assert!(targets.navigation_targets.contains(&NavigationTarget {
            function_name: "prev".to_string(),
            name: "amount".to_string(),
        }));
    }

    // ── Object and array literal analysis ────────────────────────

    /// Spec: fel-grammar.md §3.5 — "Object literal values are analyzed for references"
    #[test]
    fn analyze_object_literal() {
        let result = analyze_fel("{name: $first, addr: $city}");
        assert!(result.valid);
        assert!(result.references.contains("first"));
        assert!(result.references.contains("city"));
    }

    /// Spec: fel-grammar.md §3.4 — "Array literal elements are analyzed for references"
    #[test]
    fn analyze_array_literal() {
        let result = analyze_fel("[$a, $b, $c]");
        assert!(result.valid);
        assert!(result.references.contains("a"));
        assert!(result.references.contains("b"));
        assert!(result.references.contains("c"));
    }

    // ── PostfixAccess analysis ───────────────────────────────────

    /// Spec: fel-grammar.md §3.6 — "PostfixAccess inner expression is analyzed"
    #[test]
    fn analyze_postfix_access() {
        let result = analyze_fel("$obj.name");
        assert!(result.valid);
        // FieldRef with path segments captures the full dotted path
        assert!(
            result.references.contains("obj.name") || result.references.contains("obj"),
            "refs: {:?}",
            result.references
        );
    }

    // ── LetBinding analysis ──────────────────────────────────────

    /// Spec: fel-grammar.md §7 — "Let binding value and body are both analyzed"
    #[test]
    fn analyze_let_binding() {
        let result = analyze_fel("let total = $qty * $price in total + $tax");
        assert!(result.valid);
        assert!(
            result.references.contains("qty"),
            "refs: {:?}",
            result.references
        );
        assert!(
            result.references.contains("price"),
            "refs: {:?}",
            result.references
        );
        assert!(
            result.references.contains("tax"),
            "refs: {:?}",
            result.references
        );
    }

    // ── Membership analysis ──────────────────────────────────────

    /// Spec: fel-grammar.md §5.2 — "Membership (in/not-in) operands are analyzed"
    #[test]
    fn analyze_membership_expression() {
        let result = analyze_fel("$val in $list");
        assert!(result.valid);
        assert!(result.references.contains("val"));
        assert!(result.references.contains("list"));
    }

    // ── NullCoalesce analysis ────────────────────────────────────

    /// Spec: fel-grammar.md §5.3 — "NullCoalesce operands are analyzed"
    #[test]
    fn analyze_null_coalesce() {
        let result = analyze_fel("$primary ?? $fallback");
        assert!(result.valid);
        assert!(result.references.contains("primary"));
        assert!(result.references.contains("fallback"));
    }

    /// Spec: fel/fel-grammar.md §4-5 — PostfixAccess on a function call result.
    /// `someFunc($x).name` parses as PostfixAccess { expr: FunctionCall, path: [Dot("name")] }.
    /// The analysis should collect `$x` as a reference but NOT collect `.name`
    /// as a field reference — it's a property access on a computed result.
    #[test]
    fn test_analyze_postfix_access() {
        let result = analyze_fel("coalesce($obj, null).name");
        assert!(result.valid);
        // $obj is a field reference
        assert!(
            result.references.contains("obj"),
            "should contain 'obj', got: {:?}",
            result.references
        );
        // ".name" is postfix access on the function result, not a field reference.
        // It should NOT appear in references.
        assert!(
            !result.references.contains("name"),
            "postfix .name should not be a field reference"
        );
        // coalesce is a function call
        assert!(result.functions.contains("coalesce"));
    }
}
