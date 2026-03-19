//! Pass 4: Expression compilation — parses all FEL expression slots in a definition,
//! producing `CompiledExpression` structs for downstream dependency analysis (pass 5)
//! and E400 diagnostics for parse errors.

use serde_json::Value;

use crate::types::LintDiagnostic;

/// A successfully parsed FEL expression with its location metadata.
#[derive(Debug, Clone)]
pub struct CompiledExpression {
    /// The original FEL source text.
    pub expression: String,
    /// JSONPath to the expression slot, e.g. `$.binds.name.calculate`.
    pub expression_path: String,
    /// The bind key this expression targets for dependency graph edges.
    /// `Some` for dataflow slots (calculate, relevant, readonly, required).
    /// `None` for constraint (allows self-reference without creating a dataflow edge).
    pub bind_target: Option<String>,
}

/// Result of compiling all FEL expression slots in a definition document.
#[derive(Debug)]
pub struct ExpressionCompilationResult {
    /// Successfully parsed expressions.
    pub compiled: Vec<CompiledExpression>,
    /// E400 diagnostics for unparseable expressions.
    pub diagnostics: Vec<LintDiagnostic>,
}

/// Walk all FEL expression slots in a definition document, parse each,
/// and return compiled expressions plus E400 diagnostics for parse failures.
pub fn compile_expressions(document: &Value) -> ExpressionCompilationResult {
    let mut compiled = Vec::new();
    let mut diagnostics = Vec::new();

    walk_binds(document.get("binds"), "$", &mut compiled, &mut diagnostics);
    walk_shapes(document.get("shapes"), &mut compiled, &mut diagnostics);
    walk_variables(document.get("variables"), &mut compiled, &mut diagnostics);
    walk_screener(document.get("screener"), &mut compiled, &mut diagnostics);

    ExpressionCompilationResult {
        compiled,
        diagnostics,
    }
}

// ── Binds ────────────────────────────────────────────────────────

/// All expression slots on a bind object.
const ALL_BIND_SLOTS: &[&str] = &[
    "calculate", "relevant", "required", "readonly", "constraint",
];

/// Dispatch to object or array format handler.
fn walk_binds(
    binds: Option<&Value>,
    path_prefix: &str,
    compiled: &mut Vec<CompiledExpression>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    if binds.and_then(|v| v.as_object()).is_some() {
        walk_binds_object(binds, path_prefix, compiled, diagnostics);
    } else if let Some(arr) = binds.and_then(|v| v.as_array()) {
        walk_binds_array(arr, path_prefix, compiled, diagnostics);
    }
}

fn walk_binds_object(
    binds: Option<&Value>,
    path_prefix: &str,
    compiled: &mut Vec<CompiledExpression>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    let binds = match binds.and_then(|v| v.as_object()) {
        Some(obj) => obj,
        None => return,
    };

    for (bind_key, bind_val) in binds {
        let obj = match bind_val.as_object() {
            Some(o) => o,
            None => continue,
        };

        // Standard expression slots
        for &slot in ALL_BIND_SLOTS {
            if let Some(expr_str) = obj.get(slot).and_then(|v| v.as_str()) {
                let expression_path = format!("{path_prefix}.binds.{bind_key}.{slot}");
                let bind_target = if slot == "constraint" {
                    None
                } else {
                    Some(bind_key.clone())
                };
                try_parse(expr_str, expression_path, bind_target, compiled, diagnostics);
            }
        }

        // `default` — only when the value starts with `=` (FEL heuristic)
        if let Some(default_str) = obj.get("default").and_then(|v| v.as_str()) {
            if let Some(fel_source) = default_str.strip_prefix('=') {
                let expression_path =
                    format!("{path_prefix}.binds.{bind_key}.default");
                try_parse(
                    fel_source,
                    expression_path,
                    Some(bind_key.clone()),
                    compiled,
                    diagnostics,
                );
            }
        }
    }
}

fn walk_binds_array(
    binds: &[Value],
    path_prefix: &str,
    compiled: &mut Vec<CompiledExpression>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    for (i, bind) in binds.iter().enumerate() {
        let obj = match bind.as_object() {
            Some(o) => o,
            None => continue,
        };

        let bind_key = match obj.get("path").and_then(|v| v.as_str()) {
            Some(k) => k,
            None => continue,
        };

        for &slot in ALL_BIND_SLOTS {
            if let Some(expr_str) = obj.get(slot).and_then(|v| v.as_str()) {
                let expression_path = format!("{path_prefix}.binds[{i}].{slot}");
                let bind_target = if slot == "constraint" {
                    None
                } else {
                    Some(bind_key.to_string())
                };
                try_parse(expr_str, expression_path, bind_target, compiled, diagnostics);
            }
        }

        if let Some(default_str) = obj.get("default").and_then(|v| v.as_str()) {
            if let Some(fel_source) = default_str.strip_prefix('=') {
                let expression_path = format!("{path_prefix}.binds[{i}].default");
                try_parse(
                    fel_source,
                    expression_path,
                    Some(bind_key.to_string()),
                    compiled,
                    diagnostics,
                );
            }
        }
    }
}

// ── Shapes ──────────────────────────────────────────────────────

fn walk_shapes(
    shapes: Option<&Value>,
    compiled: &mut Vec<CompiledExpression>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    let shapes = match shapes.and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return,
    };

    for (i, shape) in shapes.iter().enumerate() {
        // Direct expression slots
        for &slot in &["constraint", "activeWhen"] {
            if let Some(expr_str) = shape.get(slot).and_then(|v| v.as_str()) {
                let expression_path = format!("$.shapes[{i}].{slot}");
                try_parse(expr_str, expression_path, None, compiled, diagnostics);
            }
        }

        // Context object: all values are FEL strings
        if let Some(ctx) = shape.get("context").and_then(|v| v.as_object()) {
            for (ctx_key, ctx_val) in ctx {
                if let Some(expr_str) = ctx_val.as_str() {
                    let expression_path =
                        format!("$.shapes[{i}].context.{ctx_key}");
                    try_parse(expr_str, expression_path, None, compiled, diagnostics);
                }
            }
        }

        // Composed operators: and[], or[], xone[] (arrays of FEL strings), not (single string)
        for &array_op in &["and", "or", "xone"] {
            if let Some(arr) = shape.get(array_op).and_then(|v| v.as_array()) {
                for (j, item) in arr.iter().enumerate() {
                    if let Some(expr_str) = item.as_str() {
                        let expression_path =
                            format!("$.shapes[{i}].{array_op}[{j}]");
                        try_parse(expr_str, expression_path, None, compiled, diagnostics);
                    }
                }
            }
        }

        if let Some(not_str) = shape.get("not").and_then(|v| v.as_str()) {
            let expression_path = format!("$.shapes[{i}].not");
            try_parse(not_str, expression_path, None, compiled, diagnostics);
        }
    }
}

// ── Variables ───────────────────────────────────────────────────

fn walk_variables(
    variables: Option<&Value>,
    compiled: &mut Vec<CompiledExpression>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    let variables = match variables.and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return,
    };

    for (i, var) in variables.iter().enumerate() {
        if let Some(expr_str) = var.get("expression").and_then(|v| v.as_str()) {
            let expression_path = format!("$.variables[{i}].expression");
            try_parse(expr_str, expression_path, None, compiled, diagnostics);
        }
    }
}

// ── Screener ────────────────────────────────────────────────────

fn walk_screener(
    screener: Option<&Value>,
    compiled: &mut Vec<CompiledExpression>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    let screener = match screener.and_then(|v| v.as_object()) {
        Some(obj) => obj,
        None => return,
    };

    // Route conditions
    if let Some(routes) = screener.get("routes").and_then(|v| v.as_array()) {
        for (i, route) in routes.iter().enumerate() {
            if let Some(expr_str) = route.get("condition").and_then(|v| v.as_str()) {
                let expression_path =
                    format!("$.screener.routes[{i}].condition");
                try_parse(expr_str, expression_path, None, compiled, diagnostics);
            }
        }
    }

    // Screener binds (same slots as top-level binds)
    walk_binds(
        screener.get("binds"),
        "$.screener",
        compiled,
        diagnostics,
    );
}

// ── Parse helper ────────────────────────────────────────────────

fn try_parse(
    source: &str,
    expression_path: String,
    bind_target: Option<String>,
    compiled: &mut Vec<CompiledExpression>,
    diagnostics: &mut Vec<LintDiagnostic>,
) {
    match fel_core::parse(source) {
        Ok(_) => {
            compiled.push(CompiledExpression {
                expression: source.to_string(),
                expression_path,
                bind_target,
            });
        }
        Err(e) => {
            diagnostics.push(LintDiagnostic::error(
                "E400",
                4,
                &expression_path,
                format!("FEL parse error: {e}"),
            ));
        }
    }
}

// ── Tests ───────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn valid_bind_calculate_compiles_with_bind_target() {
        let doc = json!({
            "binds": {
                "total": { "calculate": "$a + $b" }
            }
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 1);

        let expr = &result.compiled[0];
        assert_eq!(expr.expression, "$a + $b");
        assert_eq!(expr.expression_path, "$.binds.total.calculate");
        assert_eq!(expr.bind_target, Some("total".to_string()));
    }

    #[test]
    fn invalid_expression_emits_e400() {
        let doc = json!({
            "binds": {
                "name": { "calculate": "1 + + 2" }
            }
        });
        let result = compile_expressions(&doc);

        assert!(result.compiled.is_empty());
        assert_eq!(result.diagnostics.len(), 1);

        let diag = &result.diagnostics[0];
        assert_eq!(diag.code, "E400");
        assert_eq!(diag.pass, 4);
        assert_eq!(diag.path, "$.binds.name.calculate");
        assert!(diag.message.contains("FEL parse error"));
    }

    #[test]
    fn constraint_has_no_bind_target() {
        let doc = json!({
            "binds": {
                "age": { "constraint": "$ >= 0" }
            }
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 1);
        assert_eq!(result.compiled[0].bind_target, None);
        assert_eq!(result.compiled[0].expression_path, "$.binds.age.constraint");
    }

    #[test]
    fn dataflow_slots_have_bind_target() {
        let doc = json!({
            "binds": {
                "x": {
                    "calculate": "1",
                    "relevant": "true",
                    "required": "true",
                    "readonly": "true"
                }
            }
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 4);
        for expr in &result.compiled {
            assert_eq!(expr.bind_target, Some("x".to_string()),
                "slot {} should have bind_target", expr.expression_path);
        }
    }

    #[test]
    fn shape_constraint_and_active_when_parsed() {
        let doc = json!({
            "shapes": [
                {
                    "constraint": "$total > 0",
                    "activeWhen": "$status = 'active'"
                }
            ]
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 2);

        let paths: Vec<&str> = result.compiled.iter().map(|e| e.expression_path.as_str()).collect();
        assert!(paths.contains(&"$.shapes[0].constraint"));
        assert!(paths.contains(&"$.shapes[0].activeWhen"));

        // Shape expressions have no bind_target
        for expr in &result.compiled {
            assert_eq!(expr.bind_target, None);
        }
    }

    #[test]
    fn shape_context_values_parsed() {
        let doc = json!({
            "shapes": [
                {
                    "constraint": "$total > 0",
                    "context": {
                        "total": "sum($items[*].amount)"
                    }
                }
            ]
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        let ctx_expr = result.compiled.iter()
            .find(|e| e.expression_path == "$.shapes[0].context.total")
            .expect("context expression should be compiled");
        assert_eq!(ctx_expr.expression, "sum($items[*].amount)");
    }

    #[test]
    fn shape_composed_operators_parsed() {
        let doc = json!({
            "shapes": [
                {
                    "and": ["$a > 0", "$b > 0"],
                    "or": ["$c = 1"],
                    "not": "$d = false",
                    "xone": ["$e", "$f"]
                }
            ]
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        let paths: Vec<&str> = result.compiled.iter().map(|e| e.expression_path.as_str()).collect();
        assert!(paths.contains(&"$.shapes[0].and[0]"));
        assert!(paths.contains(&"$.shapes[0].and[1]"));
        assert!(paths.contains(&"$.shapes[0].or[0]"));
        assert!(paths.contains(&"$.shapes[0].not"));
        assert!(paths.contains(&"$.shapes[0].xone[0]"));
        assert!(paths.contains(&"$.shapes[0].xone[1]"));
        assert_eq!(result.compiled.len(), 6);
    }

    #[test]
    fn screener_route_conditions_parsed() {
        let doc = json!({
            "screener": {
                "routes": [
                    { "condition": "$age >= 18", "target": "adult" },
                    { "condition": "$age < 18", "target": "minor" }
                ]
            }
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 2);
        assert_eq!(result.compiled[0].expression_path, "$.screener.routes[0].condition");
        assert_eq!(result.compiled[1].expression_path, "$.screener.routes[1].condition");
    }

    #[test]
    fn screener_binds_parsed() {
        let doc = json!({
            "screener": {
                "binds": {
                    "q1": { "required": "true", "constraint": "$ != ''" }
                },
                "routes": []
            }
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 2);

        let paths: Vec<&str> = result.compiled.iter().map(|e| e.expression_path.as_str()).collect();
        assert!(paths.contains(&"$.screener.binds.q1.required"));
        assert!(paths.contains(&"$.screener.binds.q1.constraint"));
    }

    #[test]
    fn variables_expression_parsed() {
        let doc = json!({
            "variables": [
                { "name": "totalDirect", "expression": "sum($items[*].amount)" }
            ]
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 1);
        assert_eq!(result.compiled[0].expression_path, "$.variables[0].expression");
        assert_eq!(result.compiled[0].expression, "sum($items[*].amount)");
    }

    #[test]
    fn default_with_equals_prefix_parsed() {
        let doc = json!({
            "binds": {
                "name": { "default": "=concat($first, ' ', $last)" }
            }
        });
        let result = compile_expressions(&doc);

        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 1);

        let expr = &result.compiled[0];
        assert_eq!(expr.expression, "concat($first, ' ', $last)");
        assert_eq!(expr.expression_path, "$.binds.name.default");
        assert_eq!(expr.bind_target, Some("name".to_string()));
    }

    #[test]
    fn default_without_equals_prefix_ignored() {
        let doc = json!({
            "binds": {
                "name": { "default": "some static value" }
            }
        });
        let result = compile_expressions(&doc);

        // Static defaults are not FEL — should not be compiled
        assert!(result.compiled.is_empty());
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn empty_document_no_panic() {
        let doc = json!({});
        let result = compile_expressions(&doc);

        assert!(result.compiled.is_empty());
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn null_document_no_panic() {
        let doc = Value::Null;
        let result = compile_expressions(&doc);

        assert!(result.compiled.is_empty());
        assert!(result.diagnostics.is_empty());
    }

    // ── Array-format binds (schema-canonical) ──────────────────

    #[test]
    fn array_format_binds_compiled() {
        let doc = json!({
            "binds": [{ "path": "total", "calculate": "$a + $b" }]
        });
        let result = compile_expressions(&doc);
        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 1);
        assert_eq!(result.compiled[0].bind_target, Some("total".to_string()));
        assert_eq!(result.compiled[0].expression_path, "$.binds[0].calculate");
    }

    #[test]
    fn array_format_binds_constraint_no_bind_target() {
        let doc = json!({
            "binds": [{ "path": "age", "constraint": "$ >= 0" }]
        });
        let result = compile_expressions(&doc);
        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 1);
        assert_eq!(result.compiled[0].bind_target, None);
        assert_eq!(result.compiled[0].expression_path, "$.binds[0].constraint");
    }

    #[test]
    fn array_format_binds_all_slots() {
        let doc = json!({
            "binds": [{
                "path": "x",
                "calculate": "1",
                "relevant": "true",
                "required": "true",
                "readonly": "true"
            }]
        });
        let result = compile_expressions(&doc);
        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 4);
        for expr in &result.compiled {
            assert_eq!(expr.bind_target, Some("x".to_string()));
        }
    }

    #[test]
    fn array_format_binds_default_with_equals() {
        let doc = json!({
            "binds": [{ "path": "name", "default": "=concat($first, ' ', $last)" }]
        });
        let result = compile_expressions(&doc);
        assert!(result.diagnostics.is_empty());
        assert_eq!(result.compiled.len(), 1);
        assert_eq!(result.compiled[0].expression, "concat($first, ' ', $last)");
        assert_eq!(result.compiled[0].expression_path, "$.binds[0].default");
        assert_eq!(result.compiled[0].bind_target, Some("name".to_string()));
    }

    #[test]
    fn array_format_binds_invalid_expression_emits_e400() {
        let doc = json!({
            "binds": [{ "path": "x", "calculate": "1 + + 2" }]
        });
        let result = compile_expressions(&doc);
        assert!(result.compiled.is_empty());
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].code, "E400");
        assert_eq!(result.diagnostics[0].path, "$.binds[0].calculate");
    }

    #[test]
    fn array_format_empty_binds_no_panic() {
        let doc = json!({ "binds": [] });
        let result = compile_expressions(&doc);
        assert!(result.compiled.is_empty());
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn mixed_valid_and_invalid_expressions() {
        let doc = json!({
            "binds": {
                "a": { "calculate": "$x + 1" },
                "b": { "calculate": "1 + + 2" },
                "c": { "relevant": "true" }
            }
        });
        let result = compile_expressions(&doc);

        assert_eq!(result.compiled.len(), 2, "two valid expressions");
        assert_eq!(result.diagnostics.len(), 1, "one parse error");
        assert_eq!(result.diagnostics[0].path, "$.binds.b.calculate");
    }

    #[test]
    fn invalid_screener_route_condition() {
        let doc = json!({
            "screener": {
                "routes": [
                    { "condition": "$age >= 18" },
                    { "condition": "bad ++" }
                ]
            }
        });
        let result = compile_expressions(&doc);

        assert_eq!(result.compiled.len(), 1);
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].path, "$.screener.routes[1].condition");
    }
}
