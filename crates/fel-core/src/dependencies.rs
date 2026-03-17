/// Static dependency extraction from FEL AST.
///
/// Walks the AST without evaluation to find field references,
/// context references, MIP dependencies, and structural flags.
use std::collections::HashSet;

use crate::ast::*;

/// Dependencies extracted from a FEL expression.
#[derive(Debug, Clone, Default)]
pub struct Dependencies {
    /// Field paths referenced (e.g., `["firstName", "address.city"]`).
    pub fields: HashSet<String>,
    /// Context references (e.g., `["@current", "@index"]`).
    pub context_refs: HashSet<String>,
    /// Instance references from `@instance('name')`.
    pub instance_refs: HashSet<String>,
    /// MIP dependencies: fields used in valid/relevant/readonly/required.
    pub mip_deps: HashSet<String>,
    /// Whether bare `$` (self-reference) appears.
    pub has_self_ref: bool,
    /// Whether any `[*]` wildcard appears.
    pub has_wildcard: bool,
    /// Whether prev() or next() is called.
    pub uses_prev_next: bool,
}

/// Extract dependencies from an AST expression.
pub fn extract_dependencies(expr: &Expr) -> Dependencies {
    let mut deps = Dependencies::default();
    let mut let_vars: Vec<String> = Vec::new();
    walk(expr, &mut deps, &mut let_vars);
    deps
}

fn walk(expr: &Expr, deps: &mut Dependencies, let_vars: &mut Vec<String>) {
    match expr {
        Expr::FieldRef { name, path } => {
            match name {
                None => {
                    deps.has_self_ref = true;
                }
                Some(n) => {
                    // Skip let-bound variables
                    if !let_vars.contains(n) {
                        let mut full_path = n.clone();
                        for seg in path {
                            match seg {
                                PathSegment::Dot(name) => {
                                    full_path.push('.');
                                    full_path.push_str(name);
                                }
                                PathSegment::Index(i) => {
                                    full_path.push_str(&format!("[{i}]"));
                                }
                                PathSegment::Wildcard => {
                                    deps.has_wildcard = true;
                                    full_path.push_str("[*]");
                                }
                            }
                        }
                        deps.fields.insert(full_path);
                    }
                }
            }
            // Check for wildcards in path
            for seg in path {
                if matches!(seg, PathSegment::Wildcard) {
                    deps.has_wildcard = true;
                }
            }
        }

        Expr::ContextRef { name, arg, tail } => {
            if name == "instance" {
                if let Some(instance_name) = arg {
                    deps.instance_refs.insert(instance_name.clone());
                }
            }
            let mut ref_str = format!("@{name}");
            if let Some(a) = arg {
                ref_str.push_str(&format!("('{a}')"));
            }
            for t in tail {
                ref_str.push('.');
                ref_str.push_str(t);
            }
            deps.context_refs.insert(ref_str);
        }

        Expr::FunctionCall { name, args } => {
            match name.as_str() {
                "valid" | "relevant" | "readonly" | "required" => {
                    // MIP: extract field path from first arg
                    if let Some(first) = args.first() {
                        let path = extract_field_path_str(first);
                        if !path.is_empty() {
                            deps.mip_deps.insert(path);
                        }
                    }
                    // Still walk args for other deps
                    for arg in args {
                        walk(arg, deps, let_vars);
                    }
                }
                "prev" | "next" => {
                    deps.uses_prev_next = true;
                }
                "countWhere" => {
                    // First arg: normal walk
                    if let Some(first) = args.first() {
                        walk(first, deps, let_vars);
                    }
                    // Second arg: bare $ is rebound, so don't count it
                    // But still walk for other refs
                    if let Some(second) = args.get(1) {
                        let mut inner_vars = let_vars.clone();
                        inner_vars.push("$".to_string());
                        walk(second, deps, &mut inner_vars);
                    }
                }
                _ => {
                    for arg in args {
                        walk(arg, deps, let_vars);
                    }
                }
            }
        }

        Expr::LetBinding { name, value, body } => {
            walk(value, deps, let_vars);
            let_vars.push(name.clone());
            walk(body, deps, let_vars);
            let_vars.pop();
        }

        Expr::BinaryOp { left, right, .. } => {
            walk(left, deps, let_vars);
            walk(right, deps, let_vars);
        }

        Expr::UnaryOp { operand, .. } => {
            walk(operand, deps, let_vars);
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
            walk(condition, deps, let_vars);
            walk(then_branch, deps, let_vars);
            walk(else_branch, deps, let_vars);
        }

        Expr::Membership {
            value, container, ..
        } => {
            walk(value, deps, let_vars);
            walk(container, deps, let_vars);
        }

        Expr::NullCoalesce { left, right } => {
            walk(left, deps, let_vars);
            walk(right, deps, let_vars);
        }

        Expr::PostfixAccess { expr, path } => {
            walk(expr, deps, let_vars);
            for seg in path {
                if matches!(seg, PathSegment::Wildcard) {
                    deps.has_wildcard = true;
                }
            }
        }

        Expr::Array(elems) => {
            for elem in elems {
                walk(elem, deps, let_vars);
            }
        }

        Expr::Object(entries) => {
            for (_, val) in entries {
                walk(val, deps, let_vars);
            }
        }

        // Leaf nodes — no deps
        Expr::Null
        | Expr::Boolean(_)
        | Expr::Number(_)
        | Expr::String(_)
        | Expr::DateLiteral(_)
        | Expr::DateTimeLiteral(_) => {}
    }
}

fn extract_field_path_str(expr: &Expr) -> String {
    match expr {
        Expr::FieldRef { name, path } => {
            let mut result = name.as_deref().unwrap_or("").to_string();
            for seg in path {
                match seg {
                    PathSegment::Dot(name) => {
                        if !result.is_empty() {
                            result.push('.');
                        }
                        result.push_str(name);
                    }
                    PathSegment::Index(i) => result.push_str(&format!("[{i}]")),
                    PathSegment::Wildcard => result.push_str("[*]"),
                }
            }
            result
        }
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser;

    fn deps(input: &str) -> Dependencies {
        let expr = parser::parse(input).unwrap();
        extract_dependencies(&expr)
    }

    #[test]
    fn test_simple_field_ref() {
        let d = deps("$name");
        assert!(d.fields.contains("name"));
    }

    #[test]
    fn test_nested_field_ref() {
        let d = deps("$address.city");
        assert!(d.fields.contains("address.city"));
    }

    #[test]
    fn test_wildcard_detection() {
        let d = deps("$items[*].qty");
        assert!(d.has_wildcard);
        assert!(d.fields.contains("items[*].qty"));
    }

    #[test]
    fn test_bare_dollar() {
        let d = deps("$");
        assert!(d.has_self_ref);
    }

    #[test]
    fn test_context_ref() {
        let d = deps("@index");
        assert!(d.context_refs.contains("@index"));
    }

    #[test]
    fn test_instance_ref() {
        let d = deps("@instance('priorYear').total");
        assert!(d.instance_refs.contains("priorYear"));
    }

    #[test]
    fn test_let_binding_excludes_bound_var() {
        let d = deps("let x = $a in x + $b");
        assert!(d.fields.contains("a"));
        assert!(d.fields.contains("b"));
        assert!(!d.fields.contains("x"));
    }

    #[test]
    fn test_mip_deps() {
        let d = deps("valid($name)");
        assert!(d.mip_deps.contains("name"));
    }

    #[test]
    fn test_prev_next_detection() {
        let d = deps("prev()");
        assert!(d.uses_prev_next);
    }

    #[test]
    fn test_multiple_fields() {
        let d = deps("$a + $b * $c");
        assert_eq!(d.fields.len(), 3);
        assert!(d.fields.contains("a"));
        assert!(d.fields.contains("b"));
        assert!(d.fields.contains("c"));
    }
}
