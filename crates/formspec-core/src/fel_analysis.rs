//! FEL static analysis and expression rewriting for field references and variables.
//!
//! Parses FEL to extract field references, variables, and function calls, and supports
//! AST rewriting via callbacks (for `$ref` fragment imports and similar).
//!
//! Private walkers (`collect_info`, `rewrite_expr`, `collect_rewrite_targets`, `parse_field_ref_from_path`)
//! implement AST traversal; the public API wraps them.
#![allow(clippy::missing_docs_in_private_items)]

use std::collections::{HashMap, HashSet};

use fel_core::ast::{BinaryOp, Expr, PathSegment, UnaryOp};
use fel_core::extensions::builtin_function_catalog;
use fel_core::{Error, parse};
use serde_json::{Value, json};

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
    /// Non-fatal warnings (arity mismatches, etc.).
    pub warnings: Vec<FelAnalysisWarning>,
    /// Field path references (e.g., `$name`, `$address.city`).
    pub references: HashSet<String>,
    /// Variable references via `@name` (excluding reserved: current, index, count, instance).
    pub variables: HashSet<String>,
    /// Function names called in the expression.
    pub functions: HashSet<String>,
}

/// A parse/analysis error with a human-readable message.
#[derive(Debug, Clone)]
pub struct FelAnalysisError {
    /// Error text from the FEL parser or evaluator.
    pub message: String,
}

/// A non-fatal analysis warning.
#[derive(Debug, Clone)]
pub struct FelAnalysisWarning {
    /// Warning text.
    pub message: String,
}

/// Field/variable/navigation targets that can be rewritten in a FEL expression.
#[allow(missing_docs)]
#[derive(Debug, Clone, Default)]
pub struct FelRewriteTargets {
    pub field_paths: HashSet<String>,
    pub current_paths: HashSet<String>,
    pub variables: HashSet<String>,
    pub instance_names: HashSet<String>,
    pub navigation_targets: Vec<NavigationTarget>,
}

/// A literal navigation target passed to `prev` / `next` / `parent`.
#[allow(missing_docs)]
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
            let mut function_calls: Vec<(String, usize)> = Vec::new();
            collect_info(
                &expr,
                &mut references,
                &mut variables,
                &mut functions,
                &mut function_calls,
            );

            let warnings = check_function_arity(&function_calls);

            FelAnalysis {
                valid: true,
                errors: vec![],
                warnings,
                references,
                variables,
                functions,
            }
        }
        Err(e) => FelAnalysis {
            valid: false,
            errors: vec![FelAnalysisError {
                message: match e {
                    Error::Parse(m) | Error::Eval(m) => m,
                },
            }],
            warnings: vec![],
            references: HashSet::new(),
            variables: HashSet::new(),
            functions: HashSet::new(),
        },
    }
}

/// Check function call arity against the builtin catalog.
fn check_function_arity(calls: &[(String, usize)]) -> Vec<FelAnalysisWarning> {
    let catalog: HashMap<&str, (usize, Option<usize>)> = builtin_function_catalog()
        .iter()
        .map(|entry| {
            let min = entry
                .parameters
                .iter()
                .filter(|p| p.required && !p.variadic)
                .count();
            let max = if entry.parameters.iter().any(|p| p.variadic) {
                None
            } else {
                Some(entry.parameters.len())
            };
            (entry.name, (min, max))
        })
        .collect();

    let mut warnings = Vec::new();
    for (name, arg_count) in calls {
        let Some(&(min, max)) = catalog.get(name.as_str()) else {
            continue; // unknown function — no arity to check
        };
        if *arg_count < min {
            warnings.push(FelAnalysisWarning {
                message: format!("{name}() requires at least {min} arg(s), got {arg_count}"),
            });
        } else if let Some(mx) = max {
            if *arg_count > mx {
                warnings.push(FelAnalysisWarning {
                    message: format!("{name}() accepts at most {mx} arg(s), got {arg_count}"),
                });
            }
        }
    }
    warnings
}

// ── Operator type checking (ARCH-3) ────────────────────────────────────────

/// Coarse FEL type tag for comparison type-checking. Not a full type system --
/// just enough to detect known-bad operator combinations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CoarseType {
    Number,
    String,
    Date,
    Money,
    Boolean,
    Unknown,
}

/// Infer the coarse type of an expression using field data types, literal types,
/// and known function return types. Returns `Unknown` when the type is ambiguous
/// or depends on runtime values.
fn infer_coarse_type(expr: &Expr, field_types: &HashMap<String, String>) -> CoarseType {
    match expr {
        Expr::Number(_) => CoarseType::Number,
        Expr::String(_) => CoarseType::String,
        Expr::Boolean(_) => CoarseType::Boolean,
        Expr::DateLiteral(_) | Expr::DateTimeLiteral(_) => CoarseType::Date,
        Expr::Null => CoarseType::Unknown,

        Expr::FieldRef { name, path } => {
            let mut segments = Vec::new();
            if let Some(n) = name {
                segments.push(n.clone());
            }
            for seg in path {
                match seg {
                    PathSegment::Dot(s) => segments.push(s.clone()),
                    PathSegment::Index(_) | PathSegment::Wildcard => {}
                }
            }
            let key = segments.join(".");
            match field_types.get(&key).map(|s| s.as_str()) {
                Some("date") => CoarseType::Date,
                Some("dateTime") => CoarseType::Date,
                Some("number" | "integer" | "decimal") => CoarseType::Number,
                Some("money") => CoarseType::Money,
                Some("string" | "text") => CoarseType::String,
                Some("boolean") => CoarseType::Boolean,
                _ => CoarseType::Unknown,
            }
        }

        Expr::FunctionCall { name, .. } => match name.as_str() {
            "today" | "now" | "date" | "dateAdd" => CoarseType::Date,
            "moneyAmount" | "number" | "sum" | "count" | "avg" | "min" | "max" | "length"
            | "round" | "floor" | "ceil" | "abs" | "power" | "year" | "month" | "day" | "hours"
            | "minutes" | "seconds" | "dateDiff" | "timeDiff" => CoarseType::Number,
            "money" | "moneyAdd" | "moneySum" => CoarseType::Money,
            "contains" | "startsWith" | "endsWith" | "matches" | "empty" | "present"
            | "isNumber" | "isString" | "isDate" | "isNull" | "selected" | "valid" | "relevant"
            | "readonly" | "required" => CoarseType::Boolean,
            "string" | "upper" | "lower" | "trim" | "substring" | "replace" | "format"
            | "moneyCurrency" | "typeOf" | "locale" | "time" => CoarseType::String,
            _ => CoarseType::Unknown,
        },

        Expr::UnaryOp {
            op: UnaryOp::Neg, ..
        } => CoarseType::Number,
        Expr::UnaryOp {
            op: UnaryOp::Not, ..
        } => CoarseType::Boolean,

        _ => CoarseType::Unknown,
    }
}

/// Check comparison operators for known-bad type combinations.
///
/// Walks the AST looking for `BinaryOp` nodes with relational or equality
/// operators, infers the coarse types of both operands, and warns on:
/// - Money vs Number (suggest `moneyAmount()`)
/// - Date vs String (suggest `date()` cast)
fn check_comparison_types(
    expr: &Expr,
    field_types: &HashMap<String, String>,
    warnings: &mut Vec<FelAnalysisWarning>,
) {
    match expr {
        Expr::BinaryOp { op, left, right } => {
            let is_comparison = matches!(
                op,
                BinaryOp::Eq
                    | BinaryOp::NotEq
                    | BinaryOp::Lt
                    | BinaryOp::Gt
                    | BinaryOp::LtEq
                    | BinaryOp::GtEq
            );

            if is_comparison {
                let left_type = infer_coarse_type(left, field_types);
                let right_type = infer_coarse_type(right, field_types);

                if left_type != CoarseType::Unknown
                    && right_type != CoarseType::Unknown
                    && left_type != right_type
                {
                    match (left_type, right_type) {
                        (CoarseType::Money, CoarseType::Number)
                        | (CoarseType::Number, CoarseType::Money) => {
                            warnings.push(FelAnalysisWarning {
                                message: "Comparing money with number: use moneyAmount() to extract the numeric amount".to_string(),
                            });
                        }
                        (CoarseType::Date, CoarseType::String)
                        | (CoarseType::String, CoarseType::Date) => {
                            warnings.push(FelAnalysisWarning {
                                message: "Comparing date with string: use date() to convert the string, or declare the field as dataType \"date\"".to_string(),
                            });
                        }
                        _ => {
                            // Other mismatches: generic warning
                            warnings.push(FelAnalysisWarning {
                                message: format!(
                                    "Type mismatch in comparison: {:?} vs {:?}",
                                    left_type, right_type
                                ),
                            });
                        }
                    }
                }
            }

            // Recurse into sub-expressions
            check_comparison_types(left, field_types, warnings);
            check_comparison_types(right, field_types, warnings);
        }
        Expr::UnaryOp { operand, .. } => {
            check_comparison_types(operand, field_types, warnings);
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
            check_comparison_types(condition, field_types, warnings);
            check_comparison_types(then_branch, field_types, warnings);
            check_comparison_types(else_branch, field_types, warnings);
        }
        Expr::FunctionCall { args, .. } => {
            for arg in args {
                check_comparison_types(arg, field_types, warnings);
            }
        }
        Expr::Membership {
            value, container, ..
        } => {
            check_comparison_types(value, field_types, warnings);
            check_comparison_types(container, field_types, warnings);
        }
        Expr::NullCoalesce { left, right } => {
            check_comparison_types(left, field_types, warnings);
            check_comparison_types(right, field_types, warnings);
        }
        Expr::LetBinding { value, body, .. } => {
            check_comparison_types(value, field_types, warnings);
            check_comparison_types(body, field_types, warnings);
        }
        Expr::Array(elems) => {
            for e in elems {
                check_comparison_types(e, field_types, warnings);
            }
        }
        Expr::Object(entries) => {
            for (_, v) in entries {
                check_comparison_types(v, field_types, warnings);
            }
        }
        Expr::PostfixAccess { expr, .. } => {
            check_comparison_types(expr, field_types, warnings);
        }
        // Leaves with no sub-expressions
        _ => {}
    }
}

/// Analyze a FEL expression with field data type context for type-aware warnings.
///
/// `field_types` maps field path (e.g. "revenue") to data type (e.g. "money").
/// Produces the same output as [`analyze_fel`] plus additional warnings for
/// type-mismatched comparisons (money vs number, date vs string).
pub fn analyze_fel_with_field_types(
    expression: &str,
    field_types: &HashMap<String, String>,
) -> FelAnalysis {
    let mut result = analyze_fel(expression);
    if result.valid && !field_types.is_empty() {
        if let Ok(expr) = parse(expression) {
            let mut type_warnings = Vec::new();
            check_comparison_types(&expr, field_types, &mut type_warnings);
            result.warnings.extend(type_warnings);
        }
    }
    result
}

/// Extract field dependencies from an expression (safe on parse failure).
pub fn get_fel_dependencies(expression: &str) -> HashSet<String> {
    match parse(expression) {
        Ok(expr) => {
            let mut refs = HashSet::new();
            let mut vars = HashSet::new();
            let mut fns = HashSet::new();
            let mut calls = Vec::new();
            collect_info(&expr, &mut refs, &mut vars, &mut fns, &mut calls);
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
    function_calls: &mut Vec<(String, usize)>,
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
            function_calls.push((name.clone(), args.len()));
            for arg in args {
                collect_info(arg, references, variables, functions, function_calls);
            }
        }
        Expr::UnaryOp { operand, .. } => {
            collect_info(operand, references, variables, functions, function_calls);
        }
        Expr::BinaryOp { left, right, .. } => {
            collect_info(left, references, variables, functions, function_calls);
            collect_info(right, references, variables, functions, function_calls);
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
            collect_info(condition, references, variables, functions, function_calls);
            collect_info(
                then_branch,
                references,
                variables,
                functions,
                function_calls,
            );
            collect_info(
                else_branch,
                references,
                variables,
                functions,
                function_calls,
            );
        }
        Expr::Membership {
            value, container, ..
        } => {
            collect_info(value, references, variables, functions, function_calls);
            collect_info(container, references, variables, functions, function_calls);
        }
        Expr::NullCoalesce { left, right } => {
            collect_info(left, references, variables, functions, function_calls);
            collect_info(right, references, variables, functions, function_calls);
        }
        Expr::LetBinding { value, body, .. } => {
            collect_info(value, references, variables, functions, function_calls);
            collect_info(body, references, variables, functions, function_calls);
        }
        Expr::Array(elems) => {
            for e in elems {
                collect_info(e, references, variables, functions, function_calls);
            }
        }
        Expr::Object(entries) => {
            for (_, v) in entries {
                collect_info(v, references, variables, functions, function_calls);
            }
        }
        Expr::PostfixAccess { expr, .. } => {
            collect_info(expr, references, variables, functions, function_calls);
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
                    && let Some(new_name) = rewrite(orig_name)
                {
                    return Expr::ContextRef {
                        name: name.clone(),
                        arg: Some(new_name),
                        tail: tail.clone(),
                    };
                }
            } else if name == "current" {
                if let Some(ref rewrite) = opts.rewrite_current_path
                    && !tail.is_empty()
                {
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
                && let Some(new_name) = rewrite(name)
            {
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
                && let Some(first) = rewritten_args.first_mut()
            {
                *first = Expr::String(new_name);
            }
            Expr::FunctionCall {
                name: name.clone(),
                args: rewritten_args,
            }
        }
        Expr::UnaryOp { op, operand, bang } => Expr::UnaryOp {
            op: *op,
            operand: Box::new(rewrite_expr(operand, opts)),
            bang: *bang,
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
                && let Some(Expr::String(target_name)) = args.first()
            {
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

// ── JSON projections + rewrite map parsing (WASM / tooling) ─────

/// Static analysis result as JSON (`valid`, `errors`, `warnings`, `references`, `variables`, `functions`).
pub fn fel_analysis_to_json_value(result: &FelAnalysis) -> Value {
    json!({
        "valid": result.valid,
        "errors": result.errors.iter().map(|e| &e.message).collect::<Vec<_>>(),
        "warnings": result.warnings.iter().map(|w| &w.message).collect::<Vec<_>>(),
        "references": result.references.iter().collect::<Vec<_>>(),
        "variables": result.variables.iter().collect::<Vec<_>>(),
        "functions": result.functions.iter().collect::<Vec<_>>(),
    })
}

/// [`FelRewriteTargets`] as sorted JSON (camelCase keys) for `collectFELRewriteTargets`.
pub fn fel_rewrite_targets_to_json_value(targets: &FelRewriteTargets) -> Value {
    let mut field_paths: Vec<_> = targets.field_paths.iter().cloned().collect();
    field_paths.sort();
    let mut current_paths: Vec<_> = targets.current_paths.iter().cloned().collect();
    current_paths.sort();
    let mut variables: Vec<_> = targets.variables.iter().cloned().collect();
    variables.sort();
    let mut instance_names: Vec<_> = targets.instance_names.iter().cloned().collect();
    instance_names.sort();
    let navigation_targets = targets
        .navigation_targets
        .iter()
        .map(|entry| {
            json!({
                "functionName": entry.function_name,
                "name": entry.name,
            })
        })
        .collect::<Vec<_>>();
    json!({
        "fieldPaths": field_paths,
        "currentPaths": current_paths,
        "variables": variables,
        "instanceNames": instance_names,
        "navigationTargets": navigation_targets,
    })
}

/// Build [`RewriteOptions`] from the camelCase JSON map used by `rewriteFELReferences` / `rewriteMessageTemplate`.
pub fn rewrite_options_from_camel_case_json(rewrites: &Value) -> RewriteOptions {
    let empty = serde_json::Map::new();
    let rewrites_obj = rewrites.as_object().unwrap_or(&empty);
    let field_paths = rewrites_obj.get("fieldPaths").and_then(Value::as_object);
    let current_paths = rewrites_obj.get("currentPaths").and_then(Value::as_object);
    let variables = rewrites_obj.get("variables").and_then(Value::as_object);
    let instance_names = rewrites_obj.get("instanceNames").and_then(Value::as_object);
    let navigation_targets = rewrites_obj
        .get("navigationTargets")
        .and_then(Value::as_object);

    RewriteOptions {
        rewrite_field_path: field_paths.map(|entries| {
            let map = entries.clone();
            Box::new(move |path: &str| {
                map.get(path)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as RewriteFn
        }),
        rewrite_current_path: current_paths.map(|entries| {
            let map = entries.clone();
            Box::new(move |path: &str| {
                map.get(path)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as RewriteFn
        }),
        rewrite_variable: variables.map(|entries| {
            let map = entries.clone();
            Box::new(move |name: &str| {
                map.get(name)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as RewriteFn
        }),
        rewrite_instance_name: instance_names.map(|entries| {
            let map = entries.clone();
            Box::new(move |name: &str| {
                map.get(name)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as RewriteFn
        }),
        rewrite_navigation_target: navigation_targets.map(|entries| {
            let map = entries.clone();
            Box::new(move |name: &str, fn_name: &str| {
                let key = format!("{fn_name}:{name}");
                map.get(&key)
                    .and_then(Value::as_str)
                    .map(|value| value.to_string())
            }) as RewriteFn2
        }),
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::missing_docs_in_private_items)]
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
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns, &mut Vec::new());
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
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns, &mut Vec::new());
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
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns, &mut Vec::new());
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
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns, &mut Vec::new());
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
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns, &mut Vec::new());
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
        collect_info(&rewritten, &mut refs, &mut vars, &mut fns, &mut Vec::new());
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

    // ── BUG-5: Arity checking at analysis time ──────────────────

    #[test]
    fn arity_too_few_args_produces_warning() {
        // sum() requires 1 arg, calling with 0 should warn
        let result = analyze_fel("sum()");
        assert!(result.valid, "expression should still parse");
        assert!(
            result
                .warnings
                .iter()
                .any(|w| w.message.contains("sum") && w.message.contains("arg")),
            "should warn about arity mismatch for sum(), got warnings: {:?}",
            result.warnings
        );
    }

    #[test]
    fn arity_too_many_args_produces_warning() {
        // abs() takes 1 arg, calling with 3 should warn
        let result = analyze_fel("abs(1, 2, 3)");
        assert!(result.valid, "expression should still parse");
        assert!(
            result
                .warnings
                .iter()
                .any(|w| w.message.contains("abs") && w.message.contains("arg")),
            "should warn about arity mismatch for abs(), got warnings: {:?}",
            result.warnings
        );
    }

    #[test]
    fn arity_correct_args_no_warning() {
        let result = analyze_fel("sum($items[*].qty) + round($total, 2)");
        assert!(result.valid);
        assert!(
            result.warnings.is_empty(),
            "correct arity should produce no warnings, got: {:?}",
            result.warnings
        );
    }

    #[test]
    fn arity_optional_param_accepted() {
        // round(number, number?) — both 1 and 2 args should be fine
        let result1 = analyze_fel("round(1)");
        assert!(
            !result1.warnings.iter().any(|w| w.message.contains("round")),
            "round with 1 arg should not warn"
        );
        let result2 = analyze_fel("round(1, 2)");
        assert!(
            !result2.warnings.iter().any(|w| w.message.contains("round")),
            "round with 2 args should not warn"
        );
    }

    #[test]
    fn arity_variadic_accepts_many() {
        // coalesce(...any) — any number of args >= 1
        let result = analyze_fel("coalesce(1, 2, 3, 4, 5)");
        assert!(
            !result
                .warnings
                .iter()
                .any(|w| w.message.contains("coalesce")),
            "coalesce is variadic, should not warn"
        );
    }

    #[test]
    fn arity_zero_param_function_warns_on_args() {
        // today() takes 0 args
        let result = analyze_fel("today(1)");
        assert!(result.valid);
        assert!(
            result
                .warnings
                .iter()
                .any(|w| w.message.contains("today") && w.message.contains("arg")),
            "today with args should warn, got: {:?}",
            result.warnings
        );
    }

    #[test]
    fn arity_unknown_function_no_arity_warning() {
        // Unknown functions can't have arity checked — only report "unknown function"
        let result = analyze_fel("myCustomFunc(1, 2)");
        assert!(
            !result.warnings.iter().any(|w| w.message.contains("arg")),
            "unknown function should not get arity warnings"
        );
    }

    // ── ARCH-3: Operator type checking ────────────────────────────────────

    #[test]
    fn type_check_money_vs_number_warns() {
        let mut field_types = HashMap::new();
        field_types.insert("revenue".to_string(), "money".to_string());

        let result = analyze_fel_with_field_types("$revenue > 0", &field_types);
        assert!(result.valid);
        assert!(
            result
                .warnings
                .iter()
                .any(|w| w.message.contains("moneyAmount")),
            "should warn about money vs number comparison, got: {:?}",
            result.warnings
        );
    }

    #[test]
    fn type_check_money_amount_no_warning() {
        let mut field_types = HashMap::new();
        field_types.insert("revenue".to_string(), "money".to_string());

        let result = analyze_fel_with_field_types("moneyAmount($revenue) > 0", &field_types);
        assert!(result.valid);
        let type_warnings: Vec<_> = result
            .warnings
            .iter()
            .filter(|w| w.message.contains("money") || w.message.contains("Money"))
            .collect();
        assert!(
            type_warnings.is_empty(),
            "moneyAmount() extracts number, no type warning expected, got: {:?}",
            type_warnings
        );
    }

    #[test]
    fn type_check_date_vs_string_warns() {
        // When a string-typed field is compared with today(), should warn
        let mut field_types = HashMap::new();
        field_types.insert("deadline".to_string(), "string".to_string());

        let result = analyze_fel_with_field_types("$deadline >= today()", &field_types);
        assert!(result.valid);
        assert!(
            result.warnings.iter().any(|w| w.message.contains("date")),
            "should warn about string vs date comparison, got: {:?}",
            result.warnings
        );
    }

    #[test]
    fn type_check_date_vs_date_no_warning() {
        // When a date-typed field is compared with today(), no warning
        let mut field_types = HashMap::new();
        field_types.insert("deadline".to_string(), "date".to_string());

        let result = analyze_fel_with_field_types("$deadline >= today()", &field_types);
        assert!(result.valid);
        let type_warnings: Vec<_> = result
            .warnings
            .iter()
            .filter(|w| {
                w.message.contains("date")
                    || w.message.contains("Date")
                    || w.message.contains("string")
                    || w.message.contains("String")
            })
            .collect();
        assert!(
            type_warnings.is_empty(),
            "date vs date should not warn, got: {:?}",
            type_warnings
        );
    }

    #[test]
    fn type_check_no_field_types_no_warning() {
        // Without field type context, no type warnings
        let result = analyze_fel_with_field_types("$revenue > 0", &HashMap::new());
        assert!(result.valid);
        let type_warnings: Vec<_> = result
            .warnings
            .iter()
            .filter(|w| w.message.contains("money") || w.message.contains("date"))
            .collect();
        assert!(
            type_warnings.is_empty(),
            "without field types, no type warnings expected"
        );
    }

    #[test]
    fn type_check_number_vs_number_no_warning() {
        let mut field_types = HashMap::new();
        field_types.insert("age".to_string(), "number".to_string());

        let result = analyze_fel_with_field_types("$age >= 18", &field_types);
        assert!(result.valid);
        let type_warnings: Vec<_> = result
            .warnings
            .iter()
            .filter(|w| {
                w.message.contains("mismatch")
                    || w.message.contains("money")
                    || w.message.contains("date")
            })
            .collect();
        assert!(type_warnings.is_empty(), "number vs number should not warn");
    }

    #[test]
    fn type_check_nested_comparison_in_if() {
        let mut field_types = HashMap::new();
        field_types.insert("balance".to_string(), "money".to_string());

        let result = analyze_fel_with_field_types(
            "if($balance > 0, \"positive\", \"negative\")",
            &field_types,
        );
        assert!(result.valid);
        assert!(
            result
                .warnings
                .iter()
                .any(|w| w.message.contains("moneyAmount")),
            "should detect money vs number in nested if() comparison, got: {:?}",
            result.warnings
        );
    }
}
