//! Formspec Definition Evaluator — 4-phase batch processor.
use serde_json::Value;
use std::collections::{HashMap, HashSet};

use fel_core::{FelValue, FormspecEnvironment, MipState, evaluate, extract_dependencies, parse};

// ── Item tree ───────────────────────────────────────────────────

/// A node in the evaluation item tree.
#[derive(Debug, Clone)]
pub struct ItemInfo {
    /// Item key (leaf name, not full path).
    pub key: String,
    /// Full dotted path from root (e.g. "address.city").
    pub path: String,
    /// Data type (string, number, boolean, date, etc.).
    pub data_type: Option<String>,
    /// Current value.
    pub value: Value,
    /// Whether the item is relevant (visible).
    pub relevant: bool,
    /// Whether the item is required.
    pub required: bool,
    /// Whether the item is readonly.
    pub readonly: bool,
    /// Calculated expression (if any).
    pub calculate: Option<String>,
    /// Constraint expression (if any).
    pub constraint: Option<String>,
    /// Author-provided constraint failure message (if any).
    pub constraint_message: Option<String>,
    /// Relevance expression (if any).
    pub relevance: Option<String>,
    /// Required expression (if any).
    pub required_expr: Option<String>,
    /// Readonly expression (if any).
    pub readonly_expr: Option<String>,
    /// Whitespace normalization mode (if any).
    pub whitespace: Option<String>,
    /// Non-relevant behavior override for this bind.
    pub nrb: Option<String>,
    /// Parent path (None for top-level items).
    pub parent_path: Option<String>,
    /// Child items.
    pub children: Vec<ItemInfo>,
}

/// A definition variable with optional scope.
#[derive(Debug, Clone)]
pub struct VariableDef {
    pub name: String,
    pub expression: String,
    pub scope: Option<String>,
}

/// Validation result for a single field.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidationResult {
    /// Path to the field.
    pub path: String,
    /// Severity: error, warning, info.
    pub severity: String,
    /// Constraint kind: bind, shape, schema.
    pub kind: String,
    /// Human-readable message.
    pub message: String,
}

/// NRB (Non-Relevant Behavior) mode.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum NrbMode {
    /// Remove the field from output data.
    Remove,
    /// Set the field to null.
    Empty,
    /// Leave the field value unchanged.
    Keep,
}

impl NrbMode {
    fn from_str(s: &str) -> Self {
        match s {
            "empty" => NrbMode::Empty,
            "keep" => NrbMode::Keep,
            _ => NrbMode::Remove,
        }
    }
}

/// Whitespace normalization mode.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WhitespaceMode {
    Trim,
    Normalize,
    Remove,
    Preserve,
}

impl WhitespaceMode {
    fn from_str(s: &str) -> Self {
        match s {
            "trim" => WhitespaceMode::Trim,
            "normalize" => WhitespaceMode::Normalize,
            "remove" => WhitespaceMode::Remove,
            _ => WhitespaceMode::Preserve,
        }
    }

    fn apply(self, s: &str) -> String {
        match self {
            WhitespaceMode::Trim => s.trim().to_string(),
            WhitespaceMode::Normalize => s.split_whitespace().collect::<Vec<_>>().join(" "),
            WhitespaceMode::Remove => s.chars().filter(|c| !c.is_whitespace()).collect(),
            WhitespaceMode::Preserve => s.to_string(),
        }
    }
}

/// Result of the full evaluation cycle.
#[derive(Debug, Clone)]
pub struct EvaluationResult {
    /// All field values after recalculation (post-NRB).
    pub values: HashMap<String, Value>,
    /// Validation results.
    pub validations: Vec<ValidationResult>,
    /// Fields marked non-relevant.
    pub non_relevant: Vec<String>,
    /// Evaluated variable values.
    pub variables: HashMap<String, Value>,
}

// ── Topological sort for variables ──────────────────────────────

/// Topologically sort variables by their dependencies.
/// Returns the variable names in evaluation order.
/// Errors on circular dependencies.
pub fn topo_sort_variables(variables: &[VariableDef]) -> Result<Vec<String>, String> {
    let var_names: HashSet<&str> = variables.iter().map(|v| v.name.as_str()).collect();
    let mut resolved: Vec<String> = Vec::new();
    let mut remaining: Vec<&str> = variables.iter().map(|v| v.name.as_str()).collect();

    while !remaining.is_empty() {
        let mut progress = false;
        let mut next_remaining = Vec::new();

        for &name in &remaining {
            let var = variables.iter().find(|v| v.name == name).unwrap();
            let deps = variable_deps(&var.expression, &var_names);
            if deps.iter().all(|d| resolved.iter().any(|r| r == d)) {
                resolved.push(name.to_string());
                progress = true;
            } else {
                next_remaining.push(name);
            }
        }

        remaining = next_remaining;
        if !progress {
            let cycle: Vec<String> = remaining.iter().map(|s| s.to_string()).collect();
            return Err(format!("Circular variable dependencies: {:?}", cycle));
        }
    }

    Ok(resolved)
}

/// Extract variable-level dependencies from a FEL expression.
/// Only returns names that are in `known_vars` (context refs like @varName).
fn variable_deps(expr: &str, known_vars: &HashSet<&str>) -> Vec<String> {
    match parse(expr) {
        Ok(ast) => {
            let deps = extract_dependencies(&ast);
            deps.context_refs
                .iter()
                .filter_map(|r| {
                    let name = r.strip_prefix('@')?;
                    // Strip any tail after dot or paren
                    let base = name.split('.').next().unwrap_or(name);
                    let base = base.split('(').next().unwrap_or(base);
                    if known_vars.contains(base) {
                        Some(base.to_string())
                    } else {
                        None
                    }
                })
                .collect()
        }
        Err(_) => vec![],
    }
}

// ── Phase 1: Rebuild ────────────────────────────────────────────

/// Build the item tree from a definition JSON.
pub fn rebuild_item_tree(definition: &Value) -> Vec<ItemInfo> {
    let items = definition.get("items").and_then(|v| v.as_array());
    let binds = definition.get("binds");

    match items {
        Some(items) => items
            .iter()
            .map(|item| build_item_info(item, binds, None))
            .collect(),
        None => vec![],
    }
}

/// Parse variables from definition JSON.
pub fn parse_variables(definition: &Value) -> Vec<VariableDef> {
    definition
        .get("variables")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| {
                    let name = v.get("name")?.as_str()?;
                    let expression = v.get("expression")?.as_str()?;
                    let scope = v.get("scope").and_then(|s| s.as_str()).map(String::from);
                    Some(VariableDef {
                        name: name.to_string(),
                        expression: expression.to_string(),
                        scope,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn resolve_bind<'a>(
    binds: Option<&'a Value>,
    key: &str,
) -> Option<&'a serde_json::Map<String, Value>> {
    let binds = binds?;
    // Support both object-style and array-style binds
    match binds {
        Value::Object(map) => map.get(key)?.as_object(),
        Value::Array(arr) => {
            for bind in arr {
                if bind.get("path").and_then(|v| v.as_str()) == Some(key) {
                    return bind.as_object();
                }
            }
            None
        }
        _ => None,
    }
}

fn build_item_info(item: &Value, binds: Option<&Value>, parent_path: Option<&str>) -> ItemInfo {
    let key = item
        .get("key")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let data_type = item
        .get("dataType")
        .and_then(|v| v.as_str())
        .map(String::from);

    let path = match parent_path {
        Some(prefix) => format!("{}.{}", prefix, key),
        None => key.clone(),
    };

    // Look up bind for this path
    let bind = resolve_bind(binds, &path).or_else(|| resolve_bind(binds, &key));

    let children = item
        .get("children")
        .and_then(|v| v.as_array())
        .map(|kids| {
            kids.iter()
                .map(|k| build_item_info(k, binds, Some(&path)))
                .collect()
        })
        .unwrap_or_default();

    ItemInfo {
        key,
        path: path.clone(),
        data_type,
        value: Value::Null,
        relevant: true,
        required: false,
        readonly: false,
        calculate: bind
            .and_then(|b| b.get("calculate"))
            .and_then(|v| v.as_str())
            .map(String::from),
        constraint: bind
            .and_then(|b| b.get("constraint"))
            .and_then(|v| v.as_str())
            .map(String::from),
        constraint_message: bind
            .and_then(|b| b.get("constraintMessage"))
            .and_then(|v| v.as_str())
            .map(String::from),
        relevance: bind
            .and_then(|b| b.get("relevant"))
            .and_then(|v| v.as_str())
            .map(String::from),
        required_expr: bind
            .and_then(|b| b.get("required"))
            .and_then(|v| v.as_str())
            .map(String::from),
        readonly_expr: bind
            .and_then(|b| b.get("readonly"))
            .and_then(|v| v.as_str())
            .map(String::from),
        whitespace: bind
            .and_then(|b| b.get("whitespace"))
            .and_then(|v| v.as_str())
            .map(String::from),
        nrb: bind
            .and_then(|b| b.get("nonRelevantBehavior"))
            .and_then(|v| v.as_str())
            .map(String::from),
        parent_path: parent_path.map(String::from),
        children,
    }
}

// ── Wildcard bind expansion ─────────────────────────────────────

/// Expand wildcard paths against actual repeat data.
/// For example, `items[*].total` with 3 items returns:
/// `["items[0].total", "items[1].total", "items[2].total"]`
pub fn expand_wildcard_path(pattern: &str, data: &HashMap<String, Value>) -> Vec<String> {
    if !pattern.contains("[*]") {
        return vec![pattern.to_string()];
    }

    let parts: Vec<&str> = pattern.splitn(2, "[*]").collect();
    if parts.len() != 2 {
        return vec![pattern.to_string()];
    }

    let base = parts[0];
    let suffix = parts[1].strip_prefix('.').unwrap_or(parts[1]);

    // Find the count by looking at the data for the base path
    let count = detect_repeat_count(base, data);

    (0..count)
        .map(|i| {
            if suffix.is_empty() {
                format!("{}[{}]", base, i)
            } else {
                format!("{}[{}].{}", base, i, suffix)
            }
        })
        .collect()
}

/// Detect the repeat count for a given base path by looking at the data keys.
fn detect_repeat_count(base: &str, data: &HashMap<String, Value>) -> usize {
    let mut max_index = 0usize;
    let prefix = format!("{}[", base);
    for key in data.keys() {
        if let Some(rest) = key.strip_prefix(&prefix) {
            if let Some(idx_str) = rest.split(']').next() {
                if let Ok(idx) = idx_str.parse::<usize>() {
                    max_index = max_index.max(idx + 1);
                }
            }
        }
    }
    max_index
}

// ── Phase 2: Recalculate ────────────────────────────────────────

/// Recalculate all computed values with full processing model.
///
/// Steps:
/// 1. Apply whitespace normalization
/// 2. Evaluate variables in topological order
/// 3. Evaluate relevance (with AND inheritance)
/// 4. Evaluate readonly (with OR inheritance)
/// 5. Evaluate required (no inheritance)
/// 6. Evaluate calculate expressions
pub fn recalculate(
    items: &mut [ItemInfo],
    data: &HashMap<String, Value>,
    definition: &Value,
) -> (HashMap<String, Value>, HashMap<String, Value>) {
    let mut env = FormspecEnvironment::new();
    let mut values = data.clone();

    // Populate environment with current data
    for (k, v) in &values {
        env.set_field(k, json_to_fel(v));
    }

    // Step 1: Apply whitespace normalization
    apply_whitespace_to_items(items, &mut values);

    // Re-populate environment after whitespace changes
    for (k, v) in &values {
        env.set_field(k, json_to_fel(v));
    }

    // Step 2: Evaluate variables in topological order
    let var_defs = parse_variables(definition);
    let var_values = evaluate_variables(&var_defs, &mut env);

    // Set variables in environment
    for (name, val) in &var_values {
        env.set_variable(name, json_to_fel(val));
    }

    // Steps 3-6: Evaluate bind expressions with inheritance
    evaluate_items_with_inheritance(items, &mut env, &mut values, true, false);

    (values, var_values)
}

/// Apply whitespace normalization to all items that have a whitespace bind.
fn apply_whitespace_to_items(items: &mut [ItemInfo], values: &mut HashMap<String, Value>) {
    for item in items.iter_mut() {
        if let Some(ref ws) = item.whitespace {
            let mode = WhitespaceMode::from_str(ws);
            if mode != WhitespaceMode::Preserve {
                if let Some(Value::String(s)) = values.get(&item.path) {
                    let transformed = mode.apply(s);
                    values.insert(item.path.clone(), Value::String(transformed.clone()));
                    item.value = Value::String(transformed);
                }
            }
        }
        apply_whitespace_to_items(&mut item.children, values);
    }
}

/// Evaluate variables in topological order, returning their computed values.
fn evaluate_variables(
    var_defs: &[VariableDef],
    env: &mut FormspecEnvironment,
) -> HashMap<String, Value> {
    let order = match topo_sort_variables(var_defs) {
        Ok(order) => order,
        Err(_) => {
            // On circular deps, evaluate in declaration order (best effort)
            var_defs.iter().map(|v| v.name.clone()).collect()
        }
    };

    let mut var_values = HashMap::new();

    for name in &order {
        if let Some(var) = var_defs.iter().find(|v| &v.name == name) {
            if let Ok(parsed) = parse(&var.expression) {
                let result = evaluate(&parsed, env);
                let json_val = fel_to_json(&result.value);
                env.set_variable(name, result.value);
                var_values.insert(name.clone(), json_val);
            }
        }
    }

    var_values
}

/// Evaluate items with bind inheritance rules:
/// - relevant: AND inheritance (parent false -> children false)
/// - readonly: OR inheritance (parent true -> children true)
/// - required: NO inheritance
fn evaluate_items_with_inheritance(
    items: &mut [ItemInfo],
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
    parent_relevant: bool,
    parent_readonly: bool,
) {
    for item in items.iter_mut() {
        // Evaluate own relevance expression
        let own_relevant = if let Some(ref expr) = item.relevance {
            eval_bool(expr, env, true)
        } else {
            true
        };
        // AND inheritance: if parent is not relevant, child is not relevant
        item.relevant = own_relevant && parent_relevant;

        // Evaluate own readonly expression
        let own_readonly = if let Some(ref expr) = item.readonly_expr {
            eval_bool(expr, env, false)
        } else {
            false
        };
        // OR inheritance: if parent is readonly, child is readonly
        item.readonly = own_readonly || parent_readonly;

        // Required: no inheritance, only evaluate if relevant
        if item.relevant {
            if let Some(ref expr) = item.required_expr {
                item.required = eval_bool(expr, env, false);
            }
        } else {
            item.required = false;
        }

        // Load current value from data
        if let Some(val) = values.get(&item.path) {
            item.value = val.clone();
        }

        // Evaluate calculate (continues even when non-relevant per S5.6)
        if let Some(ref expr) = item.calculate {
            if let Ok(parsed) = parse(expr) {
                let result = evaluate(&parsed, env);
                let json_val = fel_to_json(&result.value);
                values.insert(item.path.clone(), json_val.clone());
                item.value = json_val;
                env.set_field(&item.path, result.value);
            }
        }

        // Update MIP state
        env.set_mip(
            &item.path,
            MipState {
                valid: true, // updated in Phase 3
                relevant: item.relevant,
                readonly: item.readonly,
                required: item.required,
            },
        );

        // Recurse into children with inherited state
        evaluate_items_with_inheritance(
            &mut item.children,
            env,
            values,
            item.relevant,
            item.readonly,
        );
    }
}

fn eval_bool(expr: &str, env: &FormspecEnvironment, default: bool) -> bool {
    match parse(expr) {
        Ok(parsed) => {
            let result = evaluate(&parsed, env);
            match result.value {
                FelValue::Boolean(b) => b,
                FelValue::Null => default,
                _ => default,
            }
        }
        Err(_) => default,
    }
}

// ── Phase 3: Revalidate ─────────────────────────────────────────

/// Validate all constraints and shapes.
pub fn revalidate(
    items: &[ItemInfo],
    values: &HashMap<String, Value>,
    shapes: Option<&[Value]>,
) -> Vec<ValidationResult> {
    let mut results = Vec::new();
    let env = build_validation_env(values);
    let shapes_by_id: HashMap<String, &Value> = shapes
        .unwrap_or(&[])
        .iter()
        .filter_map(|shape| {
            shape
                .get("id")
                .and_then(|v| v.as_str())
                .map(|id| (id.to_string(), shape))
        })
        .collect();

    // Bind constraints
    validate_items(items, &env, values, &mut results);

    // Shape rules
    if let Some(shapes) = shapes {
        for shape in shapes {
            validate_shape(shape, &shapes_by_id, &env, &mut results);
        }
    }

    results
}

fn validate_items(
    items: &[ItemInfo],
    env: &FormspecEnvironment,
    values: &HashMap<String, Value>,
    results: &mut Vec<ValidationResult>,
) {
    for item in items {
        // Skip non-relevant items (validation suppressed per S5.6)
        if !item.relevant {
            continue;
        }

        let val = values.get(&item.path).unwrap_or(&Value::Null);

        // Required check
        if item.required {
            let is_empty = match val {
                Value::Null => true,
                Value::String(s) => s.trim().is_empty(),
                Value::Array(arr) => arr.is_empty(),
                _ => false,
            };
            if is_empty {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    kind: "bind".to_string(),
                    message: "Required field is empty".to_string(),
                });
            }
        }

        // Constraint check
        if let Some(ref expr) = item.constraint {
            if let Ok(parsed) = parse(expr) {
                let result = evaluate(&parsed, env);
                if !constraint_passes(&result.value) {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        kind: "bind".to_string(),
                        message: item
                            .constraint_message
                            .clone()
                            .unwrap_or_else(|| format!("Constraint failed: {expr}")),
                    });
                }
            }
        }

        validate_items(&item.children, env, values, results);
    }
}

fn validate_shape(
    shape: &Value,
    shapes_by_id: &HashMap<String, &Value>,
    env: &FormspecEnvironment,
    results: &mut Vec<ValidationResult>,
) {
    let target = shape.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let severity = shape
        .get("severity")
        .and_then(|v| v.as_str())
        .unwrap_or("error");
    let message = shape
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("Shape constraint failed");

    // Check activeWhen
    if let Some(active_when) = shape.get("activeWhen").and_then(|v| v.as_str()) {
        if !eval_bool(active_when, env, true) {
            return;
        }
    }

    let mut visiting = HashSet::new();
    if !shape_passes(shape, shapes_by_id, env, &mut visiting) {
        results.push(ValidationResult {
            path: target.to_string(),
            severity: severity.to_string(),
            kind: "shape".to_string(),
            message: message.to_string(),
        });
    }
}

fn constraint_passes(value: &FelValue) -> bool {
    value.is_null() || value.is_truthy()
}

fn evaluate_shape_expression(expr: &str, env: &FormspecEnvironment) -> FelValue {
    match parse(expr) {
        Ok(parsed) => evaluate(&parsed, env).value,
        Err(_) => FelValue::Null,
    }
}

fn evaluate_composition_element(
    expr: &str,
    shapes_by_id: &HashMap<String, &Value>,
    env: &FormspecEnvironment,
    visiting: &mut HashSet<String>,
) -> FelValue {
    if let Some(shape) = shapes_by_id.get(expr) {
        return FelValue::Boolean(shape_passes(shape, shapes_by_id, env, visiting));
    }
    evaluate_shape_expression(expr, env)
}

fn shape_passes(
    shape: &Value,
    shapes_by_id: &HashMap<String, &Value>,
    env: &FormspecEnvironment,
    visiting: &mut HashSet<String>,
) -> bool {
    let shape_id = shape
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    if let Some(ref id) = shape_id {
        if !visiting.insert(id.clone()) {
            return true;
        }
    }

    // activeWhen follows the existing batch evaluator contract: null defaults to active.
    if let Some(active_when) = shape.get("activeWhen").and_then(|v| v.as_str()) {
        if !eval_bool(active_when, env, true) {
            if let Some(id) = shape_id {
                visiting.remove(&id);
            }
            return true;
        }
    }

    let passes = if let Some(expr) = shape.get("constraint").and_then(|v| v.as_str()) {
        constraint_passes(&evaluate_shape_expression(expr, env))
    } else {
        true
    } && shape
        .get("and")
        .and_then(|v| v.as_array())
        .map(|clauses| {
            clauses.iter().all(|clause| {
                clause
                    .as_str()
                    .map(|expr| {
                        constraint_passes(&evaluate_composition_element(
                            expr,
                            shapes_by_id,
                            env,
                            visiting,
                        ))
                    })
                    .unwrap_or(true)
            })
        })
        .unwrap_or(true)
        && shape
            .get("or")
            .and_then(|v| v.as_array())
            .map(|clauses| {
                clauses.iter().any(|clause| {
                    clause
                        .as_str()
                        .map(|expr| {
                            constraint_passes(&evaluate_composition_element(
                                expr,
                                shapes_by_id,
                                env,
                                visiting,
                            ))
                        })
                        .unwrap_or(false)
                })
            })
            .unwrap_or(true)
        && shape
            .get("not")
            .and_then(|v| v.as_str())
            .map(|expr| {
                let value = evaluate_composition_element(expr, shapes_by_id, env, visiting);
                value.is_null() || !value.is_truthy()
            })
            .unwrap_or(true)
        && shape
            .get("xone")
            .and_then(|v| v.as_array())
            .map(|clauses| {
                clauses
                    .iter()
                    .filter(|clause| {
                        clause
                            .as_str()
                            .map(|expr| {
                                let value = evaluate_composition_element(
                                    expr,
                                    shapes_by_id,
                                    env,
                                    visiting,
                                );
                                !value.is_null() && value.is_truthy()
                            })
                            .unwrap_or(false)
                    })
                    .count()
                    == 1
            })
            .unwrap_or(true);

    if let Some(id) = shape_id {
        visiting.remove(&id);
    }

    passes
}

fn build_validation_env(values: &HashMap<String, Value>) -> FormspecEnvironment {
    let mut env = FormspecEnvironment::new();
    for (k, v) in values {
        env.set_field(k, json_to_fel(v));
    }
    env
}

// ── Phase 4: NRB + Notify ───────────────────────────────────────

/// Get the NRB mode for a given path using the lookup precedence:
/// exact path -> wildcard -> stripped indices -> parent -> definition default.
pub fn resolve_nrb(path: &str, items: &[ItemInfo], definition_default: &str) -> NrbMode {
    // Look up exact match in items
    if let Some(item) = find_item_by_path(items, path) {
        if let Some(ref nrb) = item.nrb {
            return NrbMode::from_str(nrb);
        }
    }

    // Try wildcard version (replace [N] with [*])
    let wildcard_path = to_wildcard_path(path);
    if wildcard_path != path {
        if let Some(item) = find_item_by_path(items, &wildcard_path) {
            if let Some(ref nrb) = item.nrb {
                return NrbMode::from_str(nrb);
            }
        }
    }

    // Try stripped indices version
    let stripped = strip_indices(path);
    if stripped != path {
        if let Some(item) = find_item_by_path(items, &stripped) {
            if let Some(ref nrb) = item.nrb {
                return NrbMode::from_str(nrb);
            }
        }
    }

    // Try parent path
    if let Some(parent) = parent_path(path) {
        return resolve_nrb(&parent, items, definition_default);
    }

    NrbMode::from_str(definition_default)
}

/// Apply NRB to non-relevant fields.
pub fn apply_nrb(
    values: &mut HashMap<String, Value>,
    items: &[ItemInfo],
    definition_default: &str,
) {
    let non_relevant: Vec<(String, NrbMode)> =
        collect_non_relevant_with_nrb(items, definition_default);

    for (path, mode) in non_relevant {
        match mode {
            NrbMode::Remove => {
                values.remove(&path);
            }
            NrbMode::Empty => {
                values.insert(path, Value::Null);
            }
            NrbMode::Keep => {
                // Leave unchanged
            }
        }
    }
}

fn collect_non_relevant_with_nrb(
    items: &[ItemInfo],
    definition_default: &str,
) -> Vec<(String, NrbMode)> {
    let mut result = Vec::new();
    for item in items {
        if !item.relevant {
            let mode = item
                .nrb
                .as_deref()
                .map(NrbMode::from_str)
                .unwrap_or_else(|| NrbMode::from_str(definition_default));
            result.push((item.path.clone(), mode));
        }
        result.extend(collect_non_relevant_with_nrb(
            &item.children,
            definition_default,
        ));
    }
    result
}

/// Produce the final evaluation result.
pub fn evaluate_definition(definition: &Value, data: &HashMap<String, Value>) -> EvaluationResult {
    // Phase 1: Rebuild
    let mut items = rebuild_item_tree(definition);

    // Phase 2: Recalculate (with variables, whitespace, inheritance)
    let (mut values, var_values) = recalculate(&mut items, data, definition);

    // Phase 3: Revalidate
    let shapes = definition.get("shapes").and_then(|v| v.as_array());
    let validations = revalidate(&items, &values, shapes.map(|v| v.as_slice()));

    // Collect non-relevant fields
    let mut non_relevant = Vec::new();
    collect_non_relevant(&items, &mut non_relevant);

    // Phase 4: Apply NRB
    let default_nrb = definition
        .get("nonRelevantBehavior")
        .and_then(|v| v.as_str())
        .unwrap_or("remove");
    apply_nrb(&mut values, &items, default_nrb);

    // Convert variable FelValues to JSON for output
    let variables = var_values;

    EvaluationResult {
        values,
        validations,
        non_relevant,
        variables,
    }
}

fn collect_non_relevant(items: &[ItemInfo], out: &mut Vec<String>) {
    for item in items {
        if !item.relevant {
            out.push(item.path.clone());
        }
        collect_non_relevant(&item.children, out);
    }
}

// ── Helpers ─────────────────────────────────────────────────────

fn find_item_by_path<'a>(items: &'a [ItemInfo], path: &str) -> Option<&'a ItemInfo> {
    for item in items {
        if item.path == path {
            return Some(item);
        }
        if let Some(found) = find_item_by_path(&item.children, path) {
            return Some(found);
        }
    }
    None
}

fn strip_indices(path: &str) -> String {
    let mut result = String::new();
    let mut i = 0;
    let bytes = path.as_bytes();
    while i < bytes.len() {
        if bytes[i] == b'[' {
            // Skip until closing ]
            while i < bytes.len() && bytes[i] != b']' {
                i += 1;
            }
            if i < bytes.len() {
                i += 1; // skip ]
            }
        } else {
            result.push(bytes[i] as char);
            i += 1;
        }
    }
    result
}

fn to_wildcard_path(path: &str) -> String {
    let mut result = String::new();
    let mut i = 0;
    let bytes = path.as_bytes();
    while i < bytes.len() {
        if bytes[i] == b'[' {
            result.push('[');
            i += 1;
            // Check if it's a numeric index
            if i < bytes.len() && bytes[i].is_ascii_digit() {
                result.push('*');
                while i < bytes.len() && bytes[i] != b']' {
                    i += 1;
                }
            }
        } else {
            result.push(bytes[i] as char);
            i += 1;
        }
    }
    result
}

fn parent_path(path: &str) -> Option<String> {
    if let Some(pos) = path.rfind('.') {
        Some(path[..pos].to_string())
    } else {
        None
    }
}

fn json_to_fel(val: &Value) -> FelValue {
    match val {
        Value::Null => FelValue::Null,
        Value::Bool(b) => FelValue::Boolean(*b),
        Value::Number(n) => {
            if let Some(d) =
                rust_decimal::prelude::FromPrimitive::from_f64(n.as_f64().unwrap_or(0.0))
            {
                FelValue::Number(d)
            } else {
                FelValue::Null
            }
        }
        Value::String(s) => FelValue::String(s.clone()),
        Value::Array(arr) => FelValue::Array(arr.iter().map(json_to_fel).collect()),
        Value::Object(map) => FelValue::Object(
            map.iter()
                .map(|(k, v)| (k.clone(), json_to_fel(v)))
                .collect(),
        ),
    }
}

fn fel_to_json(val: &FelValue) -> Value {
    match val {
        FelValue::Null => Value::Null,
        FelValue::Boolean(b) => Value::Bool(*b),
        FelValue::Number(n) => {
            if n.fract().is_zero() {
                if let Some(i) = rust_decimal::prelude::ToPrimitive::to_i64(n) {
                    return Value::Number(serde_json::Number::from(i));
                }
            }
            rust_decimal::prelude::ToPrimitive::to_f64(n)
                .and_then(serde_json::Number::from_f64)
                .map(Value::Number)
                .unwrap_or(Value::Null)
        }
        FelValue::String(s) => Value::String(s.clone()),
        FelValue::Date(d) => Value::String(d.format_iso()),
        FelValue::Array(arr) => Value::Array(arr.iter().map(fel_to_json).collect()),
        FelValue::Object(entries) => {
            let map: serde_json::Map<String, Value> = entries
                .iter()
                .map(|(k, v)| (k.clone(), fel_to_json(v)))
                .collect();
            Value::Object(map)
        }
        FelValue::Money(m) => {
            let mut map = serde_json::Map::new();
            map.insert(
                "amount".to_string(),
                fel_to_json(&FelValue::Number(m.amount)),
            );
            map.insert("currency".to_string(), Value::String(m.currency.clone()));
            Value::Object(map)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── Existing tests (preserved) ──────────────────────────────

    #[test]
    fn test_rebuild_item_tree() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" },
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "name": { "required": "true" },
                "age": { "calculate": "$name" }
            }
        });
        let items = rebuild_item_tree(&def);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].key, "name");
        assert!(items[0].required_expr.is_some());
        assert_eq!(items[1].key, "age");
        assert!(items[1].calculate.is_some());
    }

    #[test]
    fn test_evaluate_calculate() {
        let def = json!({
            "items": [
                { "key": "a", "dataType": "integer" },
                { "key": "b", "dataType": "integer" },
                { "key": "total", "dataType": "integer" }
            ],
            "binds": {
                "total": { "calculate": "$a + $b" }
            }
        });

        let mut data = HashMap::new();
        data.insert("a".to_string(), json!(10));
        data.insert("b".to_string(), json!(20));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.values.get("total"), Some(&json!(30)));
    }

    #[test]
    fn test_required_validation() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });

        let data = HashMap::new(); // name is missing/null
        let result = evaluate_definition(&def, &data);
        assert!(!result.validations.is_empty());
        assert_eq!(result.validations[0].kind, "bind");
        assert!(result.validations[0].message.contains("Required"));
    }

    #[test]
    fn test_relevance_suppresses_validation() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true", "relevant": "false" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        // Required validation suppressed because field is non-relevant
        assert!(result.validations.is_empty());
        assert!(result.non_relevant.contains(&"name".to_string()));
    }

    #[test]
    fn test_constraint_validation() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "age": { "constraint": "$age >= 18" }
            }
        });

        let mut data = HashMap::new();
        data.insert("age".to_string(), json!(15));

        let result = evaluate_definition(&def, &data);
        assert!(!result.validations.is_empty());
        assert!(result.validations[0].message.contains("Constraint failed"));
    }

    // ── New tests: Topological sort ─────────────────────────────

    #[test]
    fn test_topo_sort_correct_order() {
        // c depends on b, b depends on a
        let vars = vec![
            VariableDef {
                name: "c".to_string(),
                expression: "@b + 1".to_string(),
                scope: None,
            },
            VariableDef {
                name: "a".to_string(),
                expression: "42".to_string(),
                scope: None,
            },
            VariableDef {
                name: "b".to_string(),
                expression: "@a * 2".to_string(),
                scope: None,
            },
        ];

        let order = topo_sort_variables(&vars).unwrap();
        assert_eq!(order.len(), 3);

        // a must come before b, b must come before c
        let pos_a = order.iter().position(|n| n == "a").unwrap();
        let pos_b = order.iter().position(|n| n == "b").unwrap();
        let pos_c = order.iter().position(|n| n == "c").unwrap();
        assert!(pos_a < pos_b, "a must be evaluated before b");
        assert!(pos_b < pos_c, "b must be evaluated before c");
    }

    #[test]
    fn test_topo_sort_cycle_detection() {
        let vars = vec![
            VariableDef {
                name: "x".to_string(),
                expression: "@y + 1".to_string(),
                scope: None,
            },
            VariableDef {
                name: "y".to_string(),
                expression: "@x + 1".to_string(),
                scope: None,
            },
        ];

        let result = topo_sort_variables(&vars);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("Circular"),
            "Error should mention circular: {}",
            err
        );
    }

    #[test]
    fn test_topo_sort_independent_vars() {
        // No dependencies between variables
        let vars = vec![
            VariableDef {
                name: "x".to_string(),
                expression: "10".to_string(),
                scope: None,
            },
            VariableDef {
                name: "y".to_string(),
                expression: "20".to_string(),
                scope: None,
            },
        ];

        let order = topo_sort_variables(&vars).unwrap();
        assert_eq!(order.len(), 2);
        // Both should appear (order is arbitrary for independent vars)
        assert!(order.contains(&"x".to_string()));
        assert!(order.contains(&"y".to_string()));
    }

    // ── New tests: AND inheritance for relevance ────────────────

    #[test]
    fn test_relevance_and_inheritance() {
        // Parent is not relevant -> child must also be not relevant
        let def = json!({
            "items": [
                {
                    "key": "parent",
                    "children": [
                        { "key": "child", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "parent": { "relevant": "false" },
                "parent.child": { "required": "true" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);

        // Child should be non-relevant due to AND inheritance
        assert!(
            result.non_relevant.contains(&"parent".to_string()),
            "parent should be non-relevant"
        );
        assert!(
            result.non_relevant.contains(&"parent.child".to_string()),
            "child should be non-relevant due to parent"
        );
        // Required validation should be suppressed
        assert!(
            result.validations.is_empty(),
            "no validations when parent is non-relevant"
        );
    }

    #[test]
    fn test_relevance_child_irrelevant_parent_relevant() {
        // Parent is relevant, but child has its own relevance = false
        let def = json!({
            "items": [
                {
                    "key": "parent",
                    "children": [
                        { "key": "child", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "parent.child": { "relevant": "false" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);

        // Parent should be relevant, child should not
        assert!(
            !result.non_relevant.contains(&"parent".to_string()),
            "parent should be relevant"
        );
        assert!(
            result.non_relevant.contains(&"parent.child".to_string()),
            "child should be non-relevant from own bind"
        );
    }

    // ── New tests: OR inheritance for readonly ──────────────────

    #[test]
    fn test_readonly_or_inheritance() {
        // Parent is readonly -> child must also be readonly
        let def = json!({
            "items": [
                {
                    "key": "section",
                    "children": [
                        { "key": "field", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "section": { "readonly": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("section.field".to_string(), json!("test"));

        let mut items = rebuild_item_tree(&def);
        let (values, _) = recalculate(&mut items, &data, &def);

        // The child should inherit readonly from parent
        let child = find_item_by_path(&items, "section.field").unwrap();
        assert!(
            child.readonly,
            "child should be readonly due to OR inheritance from parent"
        );

        // Parent should also be readonly
        let parent = find_item_by_path(&items, "section").unwrap();
        assert!(parent.readonly, "parent should be explicitly readonly");

        let _ = values; // suppress unused
    }

    #[test]
    fn test_readonly_child_not_inherited_when_parent_not_readonly() {
        let def = json!({
            "items": [
                {
                    "key": "section",
                    "children": [
                        { "key": "field", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "section.field": { "readonly": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("section.field".to_string(), json!("test"));

        let mut items = rebuild_item_tree(&def);
        let _ = recalculate(&mut items, &data, &def);

        // Parent should NOT be readonly (child's readonly doesn't propagate up)
        let parent = find_item_by_path(&items, "section").unwrap();
        assert!(
            !parent.readonly,
            "parent should not inherit readonly from child"
        );

        // Child should be readonly from its own bind
        let child = find_item_by_path(&items, "section.field").unwrap();
        assert!(child.readonly, "child should be explicitly readonly");
    }

    // ── New tests: Wildcard bind expansion ──────────────────────

    #[test]
    fn test_wildcard_expansion() {
        let mut data = HashMap::new();
        data.insert("items[0].total".to_string(), json!(10));
        data.insert("items[1].total".to_string(), json!(20));
        data.insert("items[2].total".to_string(), json!(30));

        let expanded = expand_wildcard_path("items[*].total", &data);
        assert_eq!(expanded.len(), 3);
        assert_eq!(expanded[0], "items[0].total");
        assert_eq!(expanded[1], "items[1].total");
        assert_eq!(expanded[2], "items[2].total");
    }

    #[test]
    fn test_wildcard_expansion_no_data() {
        let data = HashMap::new();
        let expanded = expand_wildcard_path("items[*].total", &data);
        assert!(expanded.is_empty(), "no data means zero expansion");
    }

    #[test]
    fn test_wildcard_expansion_non_wildcard() {
        let data = HashMap::new();
        let expanded = expand_wildcard_path("simple.path", &data);
        assert_eq!(expanded, vec!["simple.path"]);
    }

    // ── New tests: NRB modes ────────────────────────────────────

    #[test]
    fn test_nrb_remove_mode() {
        let def = json!({
            "items": [
                { "key": "hidden", "dataType": "string" }
            ],
            "binds": {
                "hidden": { "relevant": "false" }
            },
            "nonRelevantBehavior": "remove"
        });

        let mut data = HashMap::new();
        data.insert("hidden".to_string(), json!("secret"));

        let result = evaluate_definition(&def, &data);
        // Field should be removed from values
        assert!(
            !result.values.contains_key("hidden"),
            "non-relevant field should be removed in 'remove' mode"
        );
    }

    #[test]
    fn test_nrb_empty_mode() {
        let def = json!({
            "items": [
                { "key": "hidden", "dataType": "string" }
            ],
            "binds": {
                "hidden": { "relevant": "false", "nonRelevantBehavior": "empty" }
            }
        });

        let mut data = HashMap::new();
        data.insert("hidden".to_string(), json!("secret"));

        let result = evaluate_definition(&def, &data);
        // Field should be set to null
        assert_eq!(
            result.values.get("hidden"),
            Some(&Value::Null),
            "non-relevant field should be null in 'empty' mode"
        );
    }

    #[test]
    fn test_nrb_keep_mode() {
        let def = json!({
            "items": [
                { "key": "hidden", "dataType": "string" }
            ],
            "binds": {
                "hidden": { "relevant": "false", "nonRelevantBehavior": "keep" }
            }
        });

        let mut data = HashMap::new();
        data.insert("hidden".to_string(), json!("secret"));

        let result = evaluate_definition(&def, &data);
        // Field should keep its value
        assert_eq!(
            result.values.get("hidden"),
            Some(&json!("secret")),
            "non-relevant field should keep value in 'keep' mode"
        );
    }

    // ── New tests: Variable evaluation ──────────────────────────

    #[test]
    fn test_variable_evaluation_order() {
        let def = json!({
            "items": [
                { "key": "result", "dataType": "integer" }
            ],
            "binds": {
                "result": { "calculate": "@total" }
            },
            "variables": [
                { "name": "base", "expression": "10" },
                { "name": "total", "expression": "@base * 2" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        // base=10, total=20, result should be 20
        assert_eq!(
            result.values.get("result"),
            Some(&json!(20)),
            "variable chain should evaluate correctly"
        );
    }

    // ── New tests: Whitespace normalization ─────────────────────

    #[test]
    fn test_whitespace_trim() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "whitespace": "trim" }
            }
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("  hello world  "));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("name"),
            Some(&json!("hello world")),
            "trim should remove leading/trailing whitespace"
        );
    }

    #[test]
    fn test_whitespace_normalize() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "whitespace": "normalize" }
            }
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("  hello   world  "));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("name"),
            Some(&json!("hello world")),
            "normalize should collapse whitespace runs to single space"
        );
    }

    #[test]
    fn test_whitespace_remove() {
        let def = json!({
            "items": [
                { "key": "code", "dataType": "string" }
            ],
            "binds": {
                "code": { "whitespace": "remove" }
            }
        });

        let mut data = HashMap::new();
        data.insert("code".to_string(), json!("AB CD EF"));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("code"),
            Some(&json!("ABCDEF")),
            "remove should strip all whitespace"
        );
    }

    // ── New tests: Integration ──────────────────────────────────

    #[test]
    fn test_full_processing_model_integration() {
        // A realistic form: parent group with relevance, child with required,
        // variables, and calculate.
        let def = json!({
            "items": [
                { "key": "showDetails", "dataType": "boolean" },
                {
                    "key": "details",
                    "children": [
                        { "key": "firstName", "dataType": "string" },
                        { "key": "lastName", "dataType": "string" },
                        { "key": "fullName", "dataType": "string" }
                    ]
                }
            ],
            "binds": {
                "details": { "relevant": "$showDetails" },
                "details.firstName": { "required": "true" },
                "details.lastName": { "required": "true" },
                "details.fullName": { "calculate": "$details.firstName & \" \" & $details.lastName" }
            }
        });

        // When showDetails is false, everything under details should be non-relevant
        let mut data = HashMap::new();
        data.insert("showDetails".to_string(), json!(false));

        let result = evaluate_definition(&def, &data);
        assert!(result.non_relevant.contains(&"details".to_string()));
        assert!(
            result
                .non_relevant
                .contains(&"details.firstName".to_string())
        );
        assert!(
            result
                .non_relevant
                .contains(&"details.lastName".to_string())
        );
        // No validation errors because non-relevant
        assert!(result.validations.is_empty());

        // When showDetails is true, required kicks in
        let mut data2 = HashMap::new();
        data2.insert("showDetails".to_string(), json!(true));
        data2.insert("details.firstName".to_string(), json!("John"));
        data2.insert("details.lastName".to_string(), json!("Doe"));

        let result2 = evaluate_definition(&def, &data2);
        assert!(result2.non_relevant.is_empty());
        assert!(result2.validations.is_empty());
        assert_eq!(
            result2.values.get("details.fullName"),
            Some(&json!("John Doe"))
        );
    }

    // ── Helper function tests ───────────────────────────────────

    #[test]
    fn test_strip_indices() {
        assert_eq!(strip_indices("items[0].total"), "items.total");
        assert_eq!(strip_indices("a[1].b[2].c"), "a.b.c");
        assert_eq!(strip_indices("simple"), "simple");
    }

    #[test]
    fn test_to_wildcard_path() {
        assert_eq!(to_wildcard_path("items[0].total"), "items[*].total");
        assert_eq!(to_wildcard_path("a[1].b[2].c"), "a[*].b[*].c");
        assert_eq!(to_wildcard_path("items[*].total"), "items[*].total");
    }

    #[test]
    fn test_whitespace_mode_apply() {
        assert_eq!(WhitespaceMode::Trim.apply("  hello  "), "hello");
        assert_eq!(
            WhitespaceMode::Normalize.apply("  hello   world  "),
            "hello world"
        );
        assert_eq!(WhitespaceMode::Remove.apply("a b c"), "abc");
        assert_eq!(WhitespaceMode::Preserve.apply("  hi  "), "  hi  ");
    }

    #[test]
    fn test_nrb_mode_from_str() {
        assert_eq!(NrbMode::from_str("remove"), NrbMode::Remove);
        assert_eq!(NrbMode::from_str("empty"), NrbMode::Empty);
        assert_eq!(NrbMode::from_str("keep"), NrbMode::Keep);
        assert_eq!(NrbMode::from_str("unknown"), NrbMode::Remove);
    }

    // ══════════════════════════════════════════════════════════════
    // AUDIT FIXES — all tests below address gaps from the 2026-03-19
    // formspec-eval test audit.
    // ══════════════════════════════════════════════════════════════

    // ── CRITICAL: Shape validation with real assertions ──────────

    /// Spec: spec.md §5.2.1 L2576 — shape constraint producing false MUST yield a ValidationResult
    #[test]
    fn shape_failing_constraint_produces_validation_result() {
        let def = json!({
            "items": [
                { "key": "a", "dataType": "integer" },
                { "key": "b", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "b",
                "constraint": "$a > $b",
                "severity": "error",
                "message": "a must exceed b"
            }]
        });

        let mut data = HashMap::new();
        data.insert("a".to_string(), json!(1));
        data.insert("b".to_string(), json!(10));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1, "one shape violation expected");
        assert_eq!(result.validations[0].kind, "shape");
        assert_eq!(result.validations[0].path, "b");
        assert_eq!(result.validations[0].message, "a must exceed b");
        assert_eq!(result.validations[0].severity, "error");
    }

    /// Spec: spec.md §5.2.1 L2576 — shape severity field is respected (warning vs error)
    #[test]
    fn shape_severity_warning_is_propagated() {
        let def = json!({
            "items": [
                { "key": "score", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "score",
                "constraint": "$score > 50",
                "severity": "warning",
                "message": "Score is low"
            }]
        });

        let mut data = HashMap::new();
        data.insert("score".to_string(), json!(30));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(
            result.validations[0].severity, "warning",
            "shape severity must be 'warning' when declared as such"
        );
    }

    /// Spec: spec.md §5.2.1 L2581 — activeWhen=false suppresses shape evaluation
    #[test]
    fn shape_active_when_false_suppresses_validation() {
        let def = json!({
            "items": [
                { "key": "mode", "dataType": "string" },
                { "key": "value", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "value",
                "constraint": "$value > 0",
                "activeWhen": "$mode = 'strict'",
                "severity": "error",
                "message": "Value must be positive in strict mode"
            }]
        });

        let mut data = HashMap::new();
        data.insert("mode".to_string(), json!("relaxed"));
        data.insert("value".to_string(), json!(-5));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "shape must not fire when activeWhen evaluates to false"
        );
    }

    /// Spec: spec.md §5.2.1 L2581 — activeWhen=true allows shape to fire
    #[test]
    fn shape_active_when_true_allows_validation() {
        let def = json!({
            "items": [
                { "key": "mode", "dataType": "string" },
                { "key": "value", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "value",
                "constraint": "$value > 0",
                "activeWhen": "$mode = 'strict'",
                "severity": "error",
                "message": "Value must be positive"
            }]
        });

        let mut data = HashMap::new();
        data.insert("mode".to_string(), json!("strict"));
        data.insert("value".to_string(), json!(-5));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(result.validations[0].message, "Value must be positive");
    }

    /// Spec: spec.md §5.2.1 — shape with passing constraint produces no result
    #[test]
    fn shape_passing_constraint_produces_no_result() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "x",
                "constraint": "$x > 0",
                "severity": "error",
                "message": "Must be positive"
            }]
        });

        let mut data = HashMap::new();
        data.insert("x".to_string(), json!(42));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "passing shape constraint must not produce a validation result"
        );
    }

    #[test]
    fn shape_composition_operators_follow_ts_null_semantics() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" },
                { "key": "contactEmail", "dataType": "string" },
                { "key": "contactPhone", "dataType": "string" },
                { "key": "amount", "dataType": "integer" },
                { "key": "optA", "dataType": "boolean" },
                { "key": "optB", "dataType": "boolean" }
            ],
            "shapes": [
                {
                    "id": "adultCheck",
                    "target": "#",
                    "message": "Must be adult",
                    "constraint": "$age >= 18"
                },
                {
                    "id": "contactCheck",
                    "target": "#",
                    "message": "Need contact info",
                    "or": ["present($contactEmail)", "present($contactPhone)"]
                },
                {
                    "id": "composedEligibility",
                    "target": "#",
                    "message": "Composite failed",
                    "and": ["adultCheck", "contactCheck"]
                },
                {
                    "id": "datesDiffer",
                    "target": "#",
                    "message": "Dates must differ",
                    "not": "$amount > 0"
                },
                {
                    "id": "exactlyOne",
                    "target": "#",
                    "message": "Select exactly one",
                    "xone": ["$optA = true", "$optB = true", "$age > 99"]
                }
            ]
        });

        let mut data = HashMap::new();
        data.insert("contactEmail".to_string(), json!("person@example.org"));
        data.insert("optA".to_string(), json!(true));

        let result = evaluate_definition(&def, &data);

        assert!(
            result
                .validations
                .iter()
                .all(|validation| validation.message != "Composite failed"),
            "null adultCheck should pass inside and-composition when contactCheck passes"
        );
        assert!(
            result
                .validations
                .iter()
                .all(|validation| validation.message != "Need contact info"),
            "or-composition should pass when one branch passes"
        );
        assert!(
            result
                .validations
                .iter()
                .all(|validation| validation.message != "Dates must differ"),
            "not-composition should pass when the inner comparison is null"
        );
        assert!(
            result
                .validations
                .iter()
                .all(|validation| validation.message != "Select exactly one"),
            "xone should count one true branch and ignore null branches"
        );
    }

    // ── CRITICAL: Constraint edge cases ──────────────────────────

    /// Spec: spec.md §4.3.1 L2244 — constraint returning true passes
    #[test]
    fn constraint_returning_true_passes() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "age": { "constraint": "$age >= 18" }
            }
        });

        let mut data = HashMap::new();
        data.insert("age".to_string(), json!(21));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "constraint returning true must produce no validation error"
        );
    }

    /// Spec: spec.md §3.8 L1575 — constraint returning null MUST be treated as passing
    #[test]
    fn constraint_returning_null_passes() {
        // When the field has no value, $age is null, and $age >= 18 propagates null.
        // Per spec §3.8 table: constraint context treats null as true (passes).
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "age": { "constraint": "$age >= 18" }
            }
        });

        let data = HashMap::new(); // age is null

        let result = evaluate_definition(&def, &data);
        // No constraint violation — null is treated as passing
        let constraint_violations: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.message.contains("Constraint"))
            .collect();
        assert!(
            constraint_violations.is_empty(),
            "constraint returning null must pass (spec §3.8 L1575)"
        );
    }

    #[test]
    fn bind_constraint_uses_constraint_message_when_present() {
        let def = json!({
            "items": [
                { "key": "amount", "dataType": "integer" }
            ],
            "binds": {
                "amount": {
                    "constraint": "$amount > 0",
                    "constraintMessage": "Must be positive"
                }
            }
        });

        let mut data = HashMap::new();
        data.insert("amount".to_string(), json!(0));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(result.validations[0].message, "Must be positive");
    }

    /// Spec: spec.md §4.3.1 L2242 — required with empty string "" fails
    #[test]
    fn required_with_empty_string_fails() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!(""));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.validations.len(),
            1,
            "empty string must fail required check"
        );
        assert_eq!(result.validations[0].kind, "bind");
        assert!(result.validations[0].message.contains("Required"));
    }

    /// Spec: spec.md §4.3.1 L2242 — required with whitespace-only string fails
    #[test]
    fn required_with_whitespace_only_string_fails() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("   "));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.validations.len(),
            1,
            "whitespace-only string must fail required check (trim then empty)"
        );
    }

    // ── CRITICAL: NRB resolution precedence ──────────────────────

    /// Spec: spec.md §5.6 L2774 / resolve_nrb — exact path match takes highest precedence
    #[test]
    fn nrb_resolve_exact_path_match() {
        let items = vec![ItemInfo {
            key: "items".to_string(),
            path: "items".to_string(),
            data_type: None,
            value: Value::Null,
            relevant: false,
            required: false,
            readonly: false,
            calculate: None,
            constraint: None,
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: Some("keep".to_string()),
            parent_path: None,
            children: vec![],
        }];

        let mode = resolve_nrb("items", &items, "remove");
        assert_eq!(
            mode,
            NrbMode::Keep,
            "exact path match should return item's NRB"
        );
    }

    /// Spec: spec.md §5.6 L2774 / resolve_nrb — wildcard path fallback
    /// items[0].total should match items[*].total when no exact match exists
    #[test]
    fn nrb_resolve_wildcard_path_fallback() {
        // Create an item at the wildcard path items[*].total with nrb=keep
        let wildcard_item = ItemInfo {
            key: "total".to_string(),
            path: "items[*].total".to_string(),
            data_type: None,
            value: Value::Null,
            relevant: false,
            required: false,
            readonly: false,
            calculate: None,
            constraint: None,
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: Some("keep".to_string()),
            parent_path: Some("items[*]".to_string()),
            children: vec![],
        };

        let items = vec![wildcard_item];

        // Resolve for a concrete indexed path
        let mode = resolve_nrb("items[0].total", &items, "remove");
        assert_eq!(
            mode,
            NrbMode::Keep,
            "wildcard path items[*].total should match items[0].total"
        );
    }

    /// Spec: spec.md §5.6 L2774 / resolve_nrb — stripped indices fallback
    /// items[0].total should match items.total when no exact or wildcard match exists
    #[test]
    fn nrb_resolve_stripped_indices_fallback() {
        let stripped_item = ItemInfo {
            key: "total".to_string(),
            path: "items.total".to_string(),
            data_type: None,
            value: Value::Null,
            relevant: false,
            required: false,
            readonly: false,
            calculate: None,
            constraint: None,
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: Some("empty".to_string()),
            parent_path: Some("items".to_string()),
            children: vec![],
        };

        let items = vec![stripped_item];

        let mode = resolve_nrb("items[0].total", &items, "remove");
        assert_eq!(
            mode,
            NrbMode::Empty,
            "stripped-indices path items.total should match items[0].total"
        );
    }

    /// Spec: spec.md §5.6 L2774 / resolve_nrb — parent path fallback
    /// details.name should inherit NRB from details when no direct match exists
    #[test]
    fn nrb_resolve_parent_path_fallback() {
        let parent_item = ItemInfo {
            key: "details".to_string(),
            path: "details".to_string(),
            data_type: None,
            value: Value::Null,
            relevant: false,
            required: false,
            readonly: false,
            calculate: None,
            constraint: None,
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: Some("keep".to_string()),
            parent_path: None,
            children: vec![],
        };

        let items = vec![parent_item];

        let mode = resolve_nrb("details.name", &items, "remove");
        assert_eq!(
            mode,
            NrbMode::Keep,
            "parent path 'details' NRB should apply to 'details.name'"
        );
    }

    /// Spec: spec.md §5.6 L2774 / resolve_nrb — definition default is last resort
    #[test]
    fn nrb_resolve_definition_default_last_resort() {
        let items: Vec<ItemInfo> = vec![];

        let mode = resolve_nrb("totally.unknown.path", &items, "empty");
        assert_eq!(
            mode,
            NrbMode::Empty,
            "when no path matches, definition default must be used"
        );
    }

    /// Spec: spec.md §5.6 L2774 / resolve_nrb — precedence: exact > wildcard > stripped > parent > default
    #[test]
    fn nrb_resolve_precedence_exact_wins_over_wildcard() {
        let exact_item = ItemInfo {
            key: "total".to_string(),
            path: "items[0].total".to_string(),
            data_type: None,
            value: Value::Null,
            relevant: false,
            required: false,
            readonly: false,
            calculate: None,
            constraint: None,
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: Some("empty".to_string()),
            parent_path: Some("items[0]".to_string()),
            children: vec![],
        };

        let wildcard_item = ItemInfo {
            key: "total".to_string(),
            path: "items[*].total".to_string(),
            data_type: None,
            value: Value::Null,
            relevant: false,
            required: false,
            readonly: false,
            calculate: None,
            constraint: None,
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: Some("keep".to_string()),
            parent_path: Some("items[*]".to_string()),
            children: vec![],
        };

        let items = vec![exact_item, wildcard_item];

        let mode = resolve_nrb("items[0].total", &items, "remove");
        assert_eq!(
            mode,
            NrbMode::Empty,
            "exact path must take precedence over wildcard"
        );
    }

    // ── HIGH: Calculate continues when non-relevant (spec §5.6) ──

    /// Spec: spec.md §5.6 L2786 — "A non-relevant node's calculate Bind MUST continue to evaluate"
    #[test]
    fn calculate_continues_when_non_relevant() {
        let def = json!({
            "items": [
                { "key": "hidden", "dataType": "integer" },
                { "key": "visible", "dataType": "integer" }
            ],
            "binds": {
                "hidden": { "relevant": "false", "calculate": "1 + 1", "nonRelevantBehavior": "keep" },
                "visible": { "calculate": "$hidden * 10" }
            }
        });

        let data = HashMap::new();

        let result = evaluate_definition(&def, &data);

        // hidden is non-relevant but its calculate should still run
        assert!(result.non_relevant.contains(&"hidden".to_string()));
        // The calculated value should be available to other expressions
        // hidden=2, visible=2*10=20
        assert_eq!(
            result.values.get("visible"),
            Some(&json!(20)),
            "non-relevant field's calculated value must be available to downstream expressions"
        );
        // hidden itself has keep NRB, so its value is preserved in output
        assert_eq!(
            result.values.get("hidden"),
            Some(&json!(2)),
            "non-relevant field with NRB=keep should retain its calculated value"
        );
    }

    /// Spec: spec.md §5.6 L2769 — validation suppressed for non-relevant despite calculate running
    #[test]
    fn non_relevant_field_suppresses_validation_even_with_calculate() {
        let def = json!({
            "items": [
                { "key": "field", "dataType": "integer" }
            ],
            "binds": {
                "field": {
                    "relevant": "false",
                    "calculate": "0 - 5",
                    "constraint": "$field > 0",
                    "nonRelevantBehavior": "keep"
                }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);

        // Calculate runs (value is -5), but constraint must NOT fire
        assert!(
            result.validations.is_empty(),
            "validation must be suppressed for non-relevant fields even when calculate runs"
        );
    }

    // ── HIGH: Array-style binds ──────────────────────────────────

    /// Spec: spec.md §4.3 — binds may be an array of {path, ...} objects
    #[test]
    fn array_style_binds_are_resolved() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" },
                { "key": "greeting", "dataType": "string" }
            ],
            "binds": [
                { "path": "name", "required": "true" },
                { "path": "greeting", "calculate": "'Hello ' & $name" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("name".to_string(), json!("Alice"));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("greeting"),
            Some(&json!("Hello Alice")),
            "array-style binds should be resolved and calculate should work"
        );
    }

    /// Spec: spec.md §4.3 — array-style binds: required validation works
    #[test]
    fn array_style_binds_required_validation() {
        let def = json!({
            "items": [
                { "key": "email", "dataType": "string" }
            ],
            "binds": [
                { "path": "email", "required": "true" }
            ]
        });

        let data = HashMap::new();

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.validations.len(),
            1,
            "required validation must work with array-style binds"
        );
        assert!(result.validations[0].message.contains("Required"));
    }

    // ── HIGH: json_to_fel / fel_to_json round-trip ───────────────

    /// Round-trip: Null
    #[test]
    fn round_trip_null() {
        let json_val = json!(null);
        let fel_val = json_to_fel(&json_val);
        let back = fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    /// Round-trip: Boolean true
    #[test]
    fn round_trip_boolean_true() {
        let json_val = json!(true);
        let fel_val = json_to_fel(&json_val);
        let back = fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    /// Round-trip: Boolean false
    #[test]
    fn round_trip_boolean_false() {
        let json_val = json!(false);
        let fel_val = json_to_fel(&json_val);
        let back = fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    /// Round-trip: String
    #[test]
    fn round_trip_string() {
        let json_val = json!("hello world");
        let fel_val = json_to_fel(&json_val);
        let back = fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    /// Round-trip: Number (integer)
    #[test]
    fn round_trip_number_integer() {
        let json_val = json!(42);
        let fel_val = json_to_fel(&json_val);
        let back = fel_to_json(&fel_val);
        assert_eq!(back, json_val);
    }

    /// Round-trip: Number (decimal)
    #[test]
    fn round_trip_number_decimal() {
        let json_val = json!(3.14);
        let fel_val = json_to_fel(&json_val);
        let back = fel_to_json(&fel_val);
        // Floating-point round-trip: verify approximate equality
        let back_f = back.as_f64().expect("should be a number");
        assert!(
            (back_f - 3.14).abs() < 0.001,
            "decimal round-trip: got {back_f}"
        );
    }

    /// Round-trip: Array
    #[test]
    fn round_trip_array() {
        let json_val = json!([1, "two", true, null]);
        let fel_val = json_to_fel(&json_val);
        let back = fel_to_json(&fel_val);
        assert_eq!(back.as_array().unwrap().len(), 4);
        assert_eq!(back[0], json!(1));
        assert_eq!(back[1], json!("two"));
        assert_eq!(back[2], json!(true));
        assert_eq!(back[3], json!(null));
    }

    /// Round-trip: Object
    #[test]
    fn round_trip_object() {
        let json_val = json!({"name": "Alice", "age": 30});
        let fel_val = json_to_fel(&json_val);
        let back = fel_to_json(&fel_val);
        assert_eq!(back.get("name"), Some(&json!("Alice")));
        assert_eq!(back.get("age"), Some(&json!(30)));
    }

    /// Round-trip: Money type (FelValue::Money -> JSON object)
    #[test]
    fn round_trip_money() {
        use rust_decimal::prelude::FromPrimitive;
        let money = FelValue::Money(fel_core::FelMoney {
            amount: rust_decimal::Decimal::from_f64(99.99).unwrap(),
            currency: "USD".to_string(),
        });
        let json_val = fel_to_json(&money);
        assert_eq!(json_val.get("currency"), Some(&json!("USD")));
        let amount = json_val.get("amount").and_then(|v| v.as_f64()).unwrap();
        assert!((amount - 99.99).abs() < 0.01, "money amount round-trip");
    }

    /// Round-trip: Date type (FelValue::Date -> JSON ISO string)
    #[test]
    fn round_trip_date() {
        let date = FelValue::Date(fel_core::FelDate::Date {
            year: 2025,
            month: 6,
            day: 15,
        });
        let json_val = fel_to_json(&date);
        assert_eq!(json_val, json!("2025-06-15"));
    }

    // ── MEDIUM: Repeatable groups / indexed paths ────────────────

    /// Spec: spec.md §4.3.3 — repeat-indexed binds and evaluation
    #[test]
    fn repeatable_group_with_indexed_binds() {
        let def = json!({
            "items": [
                {
                    "key": "items",
                    "children": [
                        { "key": "qty", "dataType": "integer" },
                        { "key": "price", "dataType": "decimal" },
                        { "key": "total", "dataType": "decimal" }
                    ]
                }
            ],
            "binds": {
                "items.total": { "calculate": "$items.qty * $items.price" }
            }
        });

        let mut data = HashMap::new();
        data.insert("items.qty".to_string(), json!(3));
        data.insert("items.price".to_string(), json!(10));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.values.get("items.total"),
            Some(&json!(30)),
            "repeatable group child calculate should evaluate"
        );
    }

    // ── MEDIUM: Error resilience ─────────────────────────────────

    /// Malformed FEL in calculate should not crash; field gets no calculated value
    #[test]
    fn malformed_fel_in_calculate_degrades_gracefully() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "binds": {
                "x": { "calculate": "!!! invalid ((( syntax" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        // Should not panic — the field just doesn't get a calculated value
        // The value should be null (no data, no valid calculate)
        assert!(
            result.values.get("x").is_none() || result.values.get("x") == Some(&Value::Null),
            "malformed calculate should degrade gracefully"
        );
    }

    /// Malformed FEL in constraint should not crash; no validation error produced
    #[test]
    fn malformed_fel_in_constraint_degrades_gracefully() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "binds": {
                "x": { "constraint": "((( broken >>>" }
            }
        });

        let mut data = HashMap::new();
        data.insert("x".to_string(), json!(5));

        let result = evaluate_definition(&def, &data);
        // Should not panic — malformed constraint should silently pass
        let constraint_errors: Vec<_> = result
            .validations
            .iter()
            .filter(|v| v.message.contains("Constraint"))
            .collect();
        assert!(
            constraint_errors.is_empty(),
            "malformed constraint expression should not produce a validation error"
        );
    }

    /// Malformed FEL in relevance should not crash; field defaults to relevant
    #[test]
    fn malformed_fel_in_relevance_degrades_gracefully() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "string" }
            ],
            "binds": {
                "x": { "relevant": "<<< garbage >>>" }
            }
        });

        let mut data = HashMap::new();
        data.insert("x".to_string(), json!("hello"));

        let result = evaluate_definition(&def, &data);
        // Per eval_bool default=true for relevance, so field stays relevant
        assert!(
            !result.non_relevant.contains(&"x".to_string()),
            "malformed relevance should default to true (field stays relevant)"
        );
    }

    // ── MEDIUM: ValidationResult field specifics ─────────────────

    /// Spec: spec.md §2.5.1 L862 — required violations use kind="bind"
    #[test]
    fn validation_result_required_kind_is_bind() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ],
            "binds": {
                "name": { "required": "true" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(
            result.validations[0].kind, "bind",
            "required violations should have kind='bind'"
        );
        assert_eq!(result.validations[0].severity, "error");
    }

    /// Spec: spec.md §2.5.1 L866 — constraint violations use kind="bind"
    #[test]
    fn validation_result_constraint_kind_is_bind() {
        let def = json!({
            "items": [
                { "key": "age", "dataType": "integer" }
            ],
            "binds": {
                "age": { "constraint": "$age >= 0" }
            }
        });

        let mut data = HashMap::new();
        data.insert("age".to_string(), json!(-1));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(
            result.validations[0].kind, "bind",
            "constraint violations should have kind='bind'"
        );
    }

    /// Spec: spec.md §2.5.1 L867 — shape violations use kind="shape"
    #[test]
    fn validation_result_shape_kind_is_shape() {
        let def = json!({
            "items": [
                { "key": "x", "dataType": "integer" }
            ],
            "shapes": [{
                "target": "x",
                "constraint": "$x > 100",
                "severity": "error",
                "message": "x too small"
            }]
        });

        let mut data = HashMap::new();
        data.insert("x".to_string(), json!(5));

        let result = evaluate_definition(&def, &data);
        assert_eq!(result.validations.len(), 1);
        assert_eq!(
            result.validations[0].kind, "shape",
            "shape violations should have kind='shape'"
        );
    }

    // ── LOW: Variable scope ──────────────────────────────────────

    /// The `scope` field on VariableDef is parsed but not used in evaluation.
    /// This test documents the current behavior: scope is stored but has no
    /// effect on variable resolution.
    // NOTE: scope is intentionally unused in the current implementation.
    // The spec does not yet define scope semantics for variables, so it is
    // parsed and preserved for forward-compatibility but not enforced.
    #[test]
    fn variable_scope_is_parsed_but_unused() {
        let def = json!({
            "items": [
                { "key": "result", "dataType": "integer" }
            ],
            "binds": {
                "result": { "calculate": "@scoped_var" }
            },
            "variables": [
                { "name": "scoped_var", "expression": "42", "scope": "local" }
            ]
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);

        // Variable should evaluate normally despite having a scope value
        assert_eq!(
            result.values.get("result"),
            Some(&json!(42)),
            "scope field should not prevent variable evaluation"
        );
        assert_eq!(result.variables.get("scoped_var"), Some(&json!(42)));
    }

    // ── LOW: parse_variables edge cases ──────────────────────────

    /// Malformed variable definition (missing name) is silently skipped
    #[test]
    fn parse_variables_skips_missing_name() {
        let def = json!({
            "variables": [
                { "expression": "42" },
                { "name": "valid", "expression": "10" }
            ]
        });

        let vars = parse_variables(&def);
        assert_eq!(vars.len(), 1, "variable without name should be skipped");
        assert_eq!(vars[0].name, "valid");
    }

    /// Malformed variable definition (missing expression) is silently skipped
    #[test]
    fn parse_variables_skips_missing_expression() {
        let def = json!({
            "variables": [
                { "name": "broken" },
                { "name": "valid", "expression": "10" }
            ]
        });

        let vars = parse_variables(&def);
        assert_eq!(
            vars.len(),
            1,
            "variable without expression should be skipped"
        );
        assert_eq!(vars[0].name, "valid");
    }

    /// No variables key at all returns empty vec
    #[test]
    fn parse_variables_no_variables_key() {
        let def = json!({ "items": [] });
        let vars = parse_variables(&def);
        assert!(vars.is_empty());
    }

    /// Empty variables array returns empty vec
    #[test]
    fn parse_variables_empty_array() {
        let def = json!({ "variables": [] });
        let vars = parse_variables(&def);
        assert!(vars.is_empty());
    }

    // ── Finding 34: Nested wildcard expansion ────────────────────

    /// Spec: core/spec.md §4.3.3 (line 2287) — wildcard paths support `group[*].field` syntax.
    /// Current `expand_wildcard_path` uses `splitn(2, "[*]")` which only expands the FIRST
    /// wildcard. Nested wildcards like `items[*].subitems[*].value` are a known limitation:
    /// only the outer wildcard is expanded, leaving the inner `[*]` literal in the result.
    #[test]
    fn expand_wildcard_path_nested_wildcards_only_expands_first() {
        let mut data = HashMap::new();
        data.insert("items[0].subitems[0].value".to_string(), json!(1));
        data.insert("items[0].subitems[1].value".to_string(), json!(2));
        data.insert("items[1].subitems[0].value".to_string(), json!(3));

        let expanded = expand_wildcard_path("items[*].subitems[*].value", &data);
        // splitn(2, "[*]") splits at the first [*] only, so the suffix still contains [*]
        // This means we get paths like "items[0].subitems[*].value" — not fully expanded.
        assert_eq!(expanded.len(), 2, "only outer wildcard expanded");
        assert_eq!(expanded[0], "items[0].subitems[*].value");
        assert_eq!(expanded[1], "items[1].subitems[*].value");
    }

    // ── Finding 35: Sparse repeat indices ────────────────────────

    /// Spec: core/spec.md §2.1.2 (line 262) — repeat count detection.
    /// `detect_repeat_count` returns max-index+1, not actual count of present indices.
    /// Sparse data (e.g., indices 0 and 5 with gaps) returns 6, not 2.
    #[test]
    fn detect_repeat_count_sparse_indices_returns_max_plus_one() {
        let mut data = HashMap::new();
        data.insert("items[0].name".to_string(), json!("first"));
        data.insert("items[5].name".to_string(), json!("sixth"));
        // indices 1-4 are absent

        let count = detect_repeat_count("items", &data);
        assert_eq!(count, 6, "returns max_index+1 (6), not actual count (2)");
    }

    // ── Finding 36: Required with non-null/non-string values ─────

    /// Spec: core/spec.md §4.3.1 (line 2242) — "empty" means null, empty string, or empty array.
    /// Spec: core/spec.md §3.4.3 (line 1175) — "There is no 'truthy' or 'falsy' concept. The number 0 is not false."
    #[test]
    fn required_with_zero_passes() {
        let def = json!({
            "items": [{ "key": "count", "dataType": "integer" }],
            "binds": { "count": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("count".to_string(), json!(0));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "0 is not empty — required should pass"
        );
    }

    /// Spec: core/spec.md §4.3.1 (line 2242), §3.4.3 (line 1175) — false is not empty.
    #[test]
    fn required_with_false_passes() {
        let def = json!({
            "items": [{ "key": "flag", "dataType": "boolean" }],
            "binds": { "flag": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("flag".to_string(), json!(false));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "false is not empty — required should pass"
        );
    }

    /// Spec: core/spec.md §4.3.1 (line 2242) — empty array IS empty.
    #[test]
    fn required_with_empty_array_fails() {
        let def = json!({
            "items": [{ "key": "tags", "dataType": "string" }],
            "binds": { "tags": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("tags".to_string(), json!([]));

        let result = evaluate_definition(&def, &data);
        assert_eq!(
            result.validations.len(),
            1,
            "empty array is empty — required should fail"
        );
        assert_eq!(result.validations[0].kind, "bind");
    }

    /// Spec: core/spec.md §4.3.1 (line 2242) — empty object is NOT listed as empty.
    #[test]
    fn required_with_empty_object_passes() {
        let def = json!({
            "items": [{ "key": "meta", "dataType": "string" }],
            "binds": { "meta": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("meta".to_string(), json!({}));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "empty object is not in the spec's 'empty' list — required should pass"
        );
    }

    /// Spec: core/spec.md §4.3.1 (line 2242) — non-empty array passes required.
    #[test]
    fn required_with_non_empty_array_passes() {
        let def = json!({
            "items": [{ "key": "tags", "dataType": "string" }],
            "binds": { "tags": { "required": "true" } }
        });
        let mut data = HashMap::new();
        data.insert("tags".to_string(), json!(["a"]));

        let result = evaluate_definition(&def, &data);
        assert!(
            result.validations.is_empty(),
            "non-empty array passes required"
        );
    }

    // ── Finding 37: 3-level inheritance ──────────────────────────

    /// Spec: core/spec.md §4.3.2 (lines 2252-2274) — relevant uses AND inheritance.
    /// Any non-relevant ancestor makes all descendants non-relevant.
    #[test]
    fn relevant_and_inheritance_three_levels() {
        let def = json!({
            "items": [{
                "key": "grandparent",
                "children": [{
                    "key": "parent",
                    "children": [
                        { "key": "child", "dataType": "string" }
                    ]
                }]
            }],
            "binds": {
                "grandparent": { "relevant": "false" }
            }
        });

        let data = HashMap::new();
        let result = evaluate_definition(&def, &data);
        assert!(result.non_relevant.contains(&"grandparent".to_string()));
        assert!(
            result
                .non_relevant
                .contains(&"grandparent.parent".to_string())
        );
        assert!(
            result
                .non_relevant
                .contains(&"grandparent.parent.child".to_string()),
            "grandchild should be non-relevant via AND inheritance from grandparent"
        );
    }

    /// Spec: core/spec.md §4.3.2 (lines 2252-2274) — readonly uses OR inheritance.
    /// Any readonly ancestor makes all descendants readonly.
    #[test]
    fn readonly_or_inheritance_three_levels() {
        let def = json!({
            "items": [{
                "key": "grandparent",
                "children": [{
                    "key": "parent",
                    "children": [
                        { "key": "child", "dataType": "string" }
                    ]
                }]
            }],
            "binds": {
                "grandparent": { "readonly": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("grandparent.parent.child".to_string(), json!("val"));

        let mut items = rebuild_item_tree(&def);
        let _ = recalculate(&mut items, &data, &def);

        let child = find_item_by_path(&items, "grandparent.parent.child").unwrap();
        assert!(
            child.readonly,
            "grandchild should be readonly via OR inheritance from grandparent"
        );

        let parent = find_item_by_path(&items, "grandparent.parent").unwrap();
        assert!(
            parent.readonly,
            "parent should be readonly via OR inheritance from grandparent"
        );
    }

    /// Spec: core/spec.md §4.3.2 (lines 2252-2274) — required is NOT inherited.
    #[test]
    fn required_not_inherited_three_levels() {
        let def = json!({
            "items": [{
                "key": "grandparent",
                "children": [{
                    "key": "parent",
                    "children": [
                        { "key": "child", "dataType": "string" }
                    ]
                }]
            }],
            "binds": {
                "grandparent": { "required": "true" }
            }
        });

        let data = HashMap::new();
        let mut items = rebuild_item_tree(&def);
        let _ = recalculate(&mut items, &data, &def);

        let grandparent = find_item_by_path(&items, "grandparent").unwrap();
        assert!(
            grandparent.required,
            "grandparent has explicit required bind"
        );

        let parent = find_item_by_path(&items, "grandparent.parent").unwrap();
        assert!(!parent.required, "parent should NOT inherit required");

        let child = find_item_by_path(&items, "grandparent.parent.child").unwrap();
        assert!(!child.required, "grandchild should NOT inherit required");
    }

    /// Spec: core/spec.md §4.3.2 (lines 2252-2274) — calculate is NOT inherited.
    #[test]
    fn calculate_not_inherited() {
        let def = json!({
            "items": [{
                "key": "parent",
                "children": [
                    { "key": "child", "dataType": "integer" }
                ]
            }],
            "binds": {
                "parent": { "calculate": "42" }
            }
        });

        let data = HashMap::new();
        let mut items = rebuild_item_tree(&def);
        let (values, _) = recalculate(&mut items, &data, &def);

        // Parent has calculate, child does not
        assert_eq!(values.get("parent"), Some(&json!(42)));
        // Child should not have a calculated value
        assert_eq!(values.get("parent.child"), None);
    }

    // ── Finding 39: variable_deps edge cases ─────────────────────

    /// Spec: core/spec.md §4.5 (lines 2374-2401), specs/fel/fel-grammar.md §6
    /// Dotted context refs like `@obj.field` should resolve to the base variable name `obj`.
    #[test]
    fn variable_deps_dotted_context_ref() {
        let known: HashSet<&str> = ["config"].iter().cloned().collect();
        let deps = variable_deps("@config.threshold + 1", &known);
        assert_eq!(
            deps,
            vec!["config"],
            "dotted ref @config.threshold resolves to base 'config'"
        );
    }

    /// Spec: core/spec.md §4.5 — parse failure returns empty deps.
    #[test]
    fn variable_deps_parse_failure_returns_empty() {
        let known: HashSet<&str> = ["x"].iter().cloned().collect();
        // Deliberately broken expression
        let deps = variable_deps("@@@ !!invalid!!", &known);
        assert!(deps.is_empty(), "parse failure should return empty vec");
    }

    /// Spec: core/spec.md §4.5 — unknown context refs are filtered out.
    #[test]
    fn variable_deps_filters_unknown_refs() {
        let known: HashSet<&str> = ["a"].iter().cloned().collect();
        let deps = variable_deps("@a + @b", &known);
        assert_eq!(deps, vec!["a"], "only known vars returned");
    }

    // ── Finding 40: Bind resolution fallback ─────────────────────

    /// Spec: core/spec.md §4.3 (line 2216), §4.3.1 (line 2239)
    /// `resolve_bind` tries full path first, then falls back to bare key.
    /// This means a nested item with key "name" could match a top-level bind keyed "name"
    /// if no bind exists for its full path. Document this potentially ambiguous behavior.
    #[test]
    fn bind_resolution_fallback_to_bare_key() {
        let def = json!({
            "items": [{
                "key": "group",
                "children": [
                    { "key": "name", "dataType": "string" }
                ]
            }],
            "binds": {
                "name": { "required": "true" }
            }
        });

        // No bind for "group.name", but there IS a bind for bare "name".
        // The fallback in build_item_info: resolve_bind(binds, &path).or_else(|| resolve_bind(binds, &key))
        // will match the bare "name" bind for the nested "group.name" item.
        let items = rebuild_item_tree(&def);
        let child = find_item_by_path(&items, "group.name").unwrap();
        assert!(
            child.required_expr.is_some(),
            "nested item 'group.name' falls back to bare-key bind 'name' — \
             this could match the wrong bind if multiple items share a key"
        );
    }

    /// Spec: core/spec.md §4.3 — full path takes priority over bare key.
    #[test]
    fn bind_resolution_full_path_takes_priority() {
        let def = json!({
            "items": [{
                "key": "group",
                "children": [
                    { "key": "name", "dataType": "string" }
                ]
            }],
            "binds": {
                "name": { "required": "true" },
                "group.name": { "required": "false" }
            }
        });

        // Full path "group.name" should be preferred over bare "name"
        let items = rebuild_item_tree(&def);
        let child = find_item_by_path(&items, "group.name").unwrap();
        assert_eq!(
            child.required_expr.as_deref(),
            Some("false"),
            "full path bind 'group.name' takes priority over bare key 'name'"
        );
    }

    // ── Finding 41: Direct recalculate() test ────────────────────

    /// Spec: core/spec.md §2.4 (line 1356), §3.6.3 (line 1398)
    /// Test `recalculate()` directly — verify it returns (values, var_values) correctly.
    #[test]
    fn recalculate_returns_values_and_variables() {
        let def = json!({
            "items": [
                { "key": "price", "dataType": "number" },
                { "key": "qty", "dataType": "integer" },
                { "key": "total", "dataType": "number" }
            ],
            "binds": {
                "total": { "calculate": "$price * $qty" }
            },
            "variables": [
                { "name": "taxRate", "expression": "0.1" }
            ]
        });

        let mut data = HashMap::new();
        data.insert("price".to_string(), json!(25));
        data.insert("qty".to_string(), json!(4));

        let mut items = rebuild_item_tree(&def);
        let (values, var_values) = recalculate(&mut items, &data, &def);

        // Calculated value
        assert_eq!(values.get("total"), Some(&json!(100)));
        // Variable evaluated
        assert!(
            var_values.contains_key("taxRate"),
            "variable should be evaluated"
        );
    }

    /// Spec: core/spec.md §2.4 — recalculate sets item relevance/readonly/required state.
    #[test]
    fn recalculate_sets_item_state() {
        let def = json!({
            "items": [
                { "key": "toggle", "dataType": "boolean" },
                { "key": "field", "dataType": "string" }
            ],
            "binds": {
                "field": { "relevant": "$toggle", "readonly": "true", "required": "true" }
            }
        });

        let mut data = HashMap::new();
        data.insert("toggle".to_string(), json!(false));

        let mut items = rebuild_item_tree(&def);
        let _ = recalculate(&mut items, &data, &def);

        let field = find_item_by_path(&items, "field").unwrap();
        assert!(
            !field.relevant,
            "field should be non-relevant when toggle is false"
        );
        assert!(field.readonly, "field should be readonly");
        // required is suppressed when non-relevant
        assert!(!field.required, "required suppressed when non-relevant");
    }

    // ── Finding 42: Direct revalidate() test ─────────────────────

    /// Spec: core/spec.md §5, §2.4
    /// Test `revalidate()` directly with hand-built items for isolated validation phase.
    #[test]
    fn revalidate_with_hand_built_items() {
        let items = vec![ItemInfo {
            key: "email".to_string(),
            path: "email".to_string(),
            data_type: Some("string".to_string()),
            value: Value::Null,
            relevant: true,
            required: true,
            readonly: false,
            calculate: None,
            constraint: Some("contains($email, \"@\")".to_string()),
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: None,
            parent_path: None,
            children: vec![],
        }];

        // email is required and null → required error
        let values: HashMap<String, Value> = HashMap::new();
        let results = revalidate(&items, &values, None);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "email");
        assert_eq!(results[0].kind, "bind");
        assert!(results[0].message.contains("Required"));
    }

    /// Spec: core/spec.md §5 — non-relevant items skip validation entirely.
    #[test]
    fn revalidate_skips_non_relevant() {
        let items = vec![ItemInfo {
            key: "hidden".to_string(),
            path: "hidden".to_string(),
            data_type: Some("string".to_string()),
            value: Value::Null,
            relevant: false,
            required: true,
            readonly: false,
            calculate: None,
            constraint: Some("false".to_string()),
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: None,
            parent_path: None,
            children: vec![],
        }];

        let values: HashMap<String, Value> = HashMap::new();
        let results = revalidate(&items, &values, None);
        assert!(
            results.is_empty(),
            "non-relevant items should be skipped entirely"
        );
    }

    /// Spec: core/spec.md §5 — constraint that evaluates to true produces no error.
    #[test]
    fn revalidate_constraint_passes() {
        let items = vec![ItemInfo {
            key: "age".to_string(),
            path: "age".to_string(),
            data_type: Some("integer".to_string()),
            value: json!(25),
            relevant: true,
            required: false,
            readonly: false,
            calculate: None,
            constraint: Some("$age >= 18".to_string()),
            constraint_message: None,
            relevance: None,
            required_expr: None,
            readonly_expr: None,
            whitespace: None,
            nrb: None,
            parent_path: None,
            children: vec![],
        }];

        let mut values = HashMap::new();
        values.insert("age".to_string(), json!(25));

        let results = revalidate(&items, &values, None);
        assert!(
            results.is_empty(),
            "constraint $age >= 18 should pass for 25"
        );
    }

    // ── Finding 43: Unicode whitespace ───────────────────────────

    /// Spec: core/spec.md §4.3.1 (line 2247) — whitespace normalization.
    /// The spec says "trim"/"normalize"/"remove" but does NOT define what "whitespace" means.
    /// The implementation uses Rust's `char::is_whitespace()` which covers Unicode whitespace
    /// including non-breaking space (U+00A0) and em space (U+2003).
    #[test]
    fn whitespace_trim_handles_unicode_whitespace() {
        // U+00A0 = non-breaking space, U+2003 = em space
        let input = "\u{00A0}hello\u{2003}";
        let result = WhitespaceMode::Trim.apply(input);
        assert_eq!(
            result, "hello",
            "trim strips Unicode whitespace (NBSP, em space)"
        );
    }

    /// Spec: core/spec.md §4.3.1 (line 2247) — normalize collapses Unicode whitespace.
    #[test]
    fn whitespace_normalize_collapses_unicode() {
        let input = "hello\u{00A0}\u{2003}world";
        let result = WhitespaceMode::Normalize.apply(input);
        assert_eq!(
            result, "hello world",
            "normalize collapses Unicode whitespace to single ASCII space"
        );
    }

    /// Spec: core/spec.md §4.3.1 (line 2247) — remove strips Unicode whitespace.
    #[test]
    fn whitespace_remove_strips_unicode() {
        let input = "a\u{00A0}b\u{2003}c";
        let result = WhitespaceMode::Remove.apply(input);
        assert_eq!(result, "abc", "remove strips Unicode whitespace characters");
    }

    // ── Finding 44: Multiple shapes targeting same path ──────────

    /// Spec: core/spec.md §5.2 (line 2547), §5.4 — multiple shapes fire independently
    /// and results accumulate in the validation report.
    #[test]
    fn multiple_shapes_same_path_accumulate() {
        let def = json!({
            "items": [
                { "key": "value", "dataType": "integer" }
            ],
            "shapes": [
                {
                    "target": "value",
                    "constraint": "$value > 0",
                    "severity": "error",
                    "message": "Must be positive"
                },
                {
                    "target": "value",
                    "constraint": "$value < 100",
                    "severity": "warning",
                    "message": "Should be under 100"
                }
            ]
        });

        // value = -5 fails both shapes
        let mut data = HashMap::new();
        data.insert("value".to_string(), json!(-5));

        let result = evaluate_definition(&def, &data);
        let shape_results: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.kind == "shape")
            .collect();
        // First shape fails ($value > 0 is false for -5)
        // Second shape passes ($value < 100 is true for -5)
        assert_eq!(shape_results.len(), 1, "only the > 0 shape should fail");
        assert_eq!(shape_results[0].message, "Must be positive");
        assert_eq!(shape_results[0].severity, "error");
    }

    /// Spec: core/spec.md §5.2, §5.4 — when both shapes fail, both results appear.
    #[test]
    fn multiple_shapes_both_fail() {
        let def = json!({
            "items": [
                { "key": "value", "dataType": "integer" }
            ],
            "shapes": [
                {
                    "target": "value",
                    "constraint": "$value > 10",
                    "severity": "error",
                    "message": "Must be greater than 10"
                },
                {
                    "target": "value",
                    "constraint": "$value < 0",
                    "severity": "warning",
                    "message": "Must be negative"
                }
            ]
        });

        // value = 5: fails > 10, and fails < 0
        let mut data = HashMap::new();
        data.insert("value".to_string(), json!(5));

        let result = evaluate_definition(&def, &data);
        let shape_results: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.kind == "shape")
            .collect();
        assert_eq!(
            shape_results.len(),
            2,
            "both shapes should fire independently"
        );

        let messages: Vec<&str> = shape_results.iter().map(|r| r.message.as_str()).collect();
        assert!(messages.contains(&"Must be greater than 10"));
        assert!(messages.contains(&"Must be negative"));
    }

    /// Spec: core/spec.md §5.2, §5.4 — shapes with different severities preserve their severity.
    #[test]
    fn multiple_shapes_preserve_severities() {
        let def = json!({
            "items": [
                { "key": "score", "dataType": "integer" }
            ],
            "shapes": [
                {
                    "target": "score",
                    "constraint": "$score >= 0",
                    "severity": "error",
                    "message": "Score must not be negative"
                },
                {
                    "target": "score",
                    "constraint": "$score <= 100",
                    "severity": "info",
                    "message": "Score should be at most 100"
                }
            ]
        });

        // score = 150: passes >= 0 but fails <= 100
        let mut data = HashMap::new();
        data.insert("score".to_string(), json!(150));

        let result = evaluate_definition(&def, &data);
        let shape_results: Vec<&ValidationResult> = result
            .validations
            .iter()
            .filter(|v| v.kind == "shape")
            .collect();
        assert_eq!(shape_results.len(), 1);
        assert_eq!(shape_results[0].severity, "info");
        assert_eq!(shape_results[0].message, "Score should be at most 100");
    }
}
