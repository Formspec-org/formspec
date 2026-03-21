//! Phase 2: Recalculate — evaluate computed values and bind expressions.

use serde_json::Value;
use std::collections::{HashMap, HashSet};

use fel_core::{
    FelValue, FormspecEnvironment, MipState, evaluate, extract_dependencies, fel_to_json,
    json_to_fel, parse,
};

use crate::rebuild::{is_repeat_group_array, parse_variables};
use crate::types::{ItemInfo, VariableDef, WhitespaceMode, strip_indices};

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
pub(crate) fn variable_deps(expr: &str, known_vars: &HashSet<&str>) -> Vec<String> {
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

// ── Scoped variable helpers ─────────────────────────────────────

/// Compute visible variables for a given item path.
///
/// Variables are stored with scope-qualified keys like `"#:name"` (global)
/// or `"section:name"` (group-scoped). Walk from global scope down through
/// ancestors of the item path, with nearer scopes overriding farther ones.
pub(crate) fn visible_variables(
    all_vars: &HashMap<String, Value>,
    item_path: &str,
) -> HashMap<String, Value> {
    let mut visible = HashMap::new();

    // Global scope variables
    for (key, val) in all_vars {
        if let Some(name) = key.strip_prefix("#:") {
            visible.insert(name.to_string(), val.clone());
        }
    }

    // Walk from root down to current path (nearest scope wins via overwrite)
    // Strip indices from the path so that `group[0].child` matches scope `group`
    let stripped = strip_indices(item_path);
    let parts: Vec<&str> = stripped.split('.').collect();
    for i in 1..=parts.len() {
        let ancestor = parts[..i].join(".");
        let prefix = format!("{ancestor}:");
        for (key, val) in all_vars {
            if let Some(name) = key.strip_prefix(&prefix) {
                visible.insert(name.to_string(), val.clone());
            }
        }
    }

    visible
}

// ── Phase 2: Recalculate ────────────────────────────────────────

/// Recalculate all computed values with full processing model.
///
/// Steps:
/// 1. Apply whitespace normalization
/// 2. Evaluate variables in topological order (scope-keyed)
/// 3. Evaluate relevance (with AND inheritance)
/// 4. Evaluate readonly (with OR inheritance)
/// 5. Evaluate required (no inheritance)
/// 6. Evaluate calculate expressions
pub fn recalculate(
    items: &mut [ItemInfo],
    data: &HashMap<String, Value>,
    definition: &Value,
    now_iso: Option<&str>,
    previous_validations: Option<&[crate::types::ValidationResult]>,
) -> (
    HashMap<String, Value>,
    HashMap<String, Value>,
    Option<String>,
) {
    let mut env = FormspecEnvironment::new();
    if let Some(now_iso) = now_iso {
        env.set_now_from_iso(now_iso);
    }
    let mut values = data.clone();

    // Populate environment with ALL data (including arrays) for variable evaluation.
    // Variables may aggregate over arrays (e.g., sum($items[*].amount)).
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
    let (_initial_var_values, scoped_var_values, cycle_err) =
        evaluate_variables_scoped(&var_defs, &mut env);

    // Set all variables in environment for global access (backwards compat)
    // For scoped resolution, we use scoped_var_values in evaluate_items_with_inheritance
    for (name, val) in &_initial_var_values {
        env.set_variable(name, json_to_fel(val));
    }

    // After variable evaluation, remove repeat group arrays from the env.
    // Flat indexed keys (e.g., rows[0].a) remain — FEL should resolve through
    // those instead to avoid 1-based array indexing conflicts.
    let array_keys: Vec<String> = values
        .iter()
        .filter(|(_, v)| is_repeat_group_array(v))
        .map(|(k, _)| k.clone())
        .collect();
    for k in &array_keys {
        env.data.remove(k);
    }

    let has_scoped = var_defs
        .iter()
        .any(|v| v.scope.as_deref().unwrap_or("#") != "#");
    let invalid_paths: HashSet<String> = previous_validations
        .unwrap_or(&[])
        .iter()
        .filter(|result| result.severity == "error" && !result.path.is_empty())
        .map(|result| result.path.clone())
        .collect();

    // Steps 3-6: Evaluate bind expressions with inheritance
    if has_scoped {
        evaluate_items_with_inheritance_scoped(
            items,
            &mut env,
            &mut values,
            true,
            false,
            &scoped_var_values,
            &invalid_paths,
        );
    } else {
        evaluate_items_with_inheritance(items, &mut env, &mut values, true, false, &invalid_paths);
    }

    settle_calculated_values(items, &mut env, &mut values, has_scoped.then_some(&scoped_var_values));
    populate_repeat_group_arrays(&*items, &values, &mut env);

    let (final_var_values, _, _) = evaluate_variables_scoped(&var_defs, &mut env);
    for (name, val) in &final_var_values {
        env.set_variable(name, json_to_fel(val));
    }

    (values, final_var_values, cycle_err)
}

/// Apply whitespace normalization to all items that have a whitespace bind.
pub(crate) fn apply_whitespace_to_items(
    items: &mut [ItemInfo],
    values: &mut HashMap<String, Value>,
) {
    for item in items.iter_mut() {
        if let Some(ref ws) = item.whitespace {
            let mode = WhitespaceMode::from_str_lossy(ws);
            if mode != WhitespaceMode::Preserve
                && let Some(Value::String(s)) = values.get(&item.path)
            {
                let transformed = mode.apply(s);
                values.insert(item.path.clone(), Value::String(transformed.clone()));
                item.value = Value::String(transformed);
            }
        }
        apply_whitespace_to_items(&mut item.children, values);
    }
}

/// Evaluate variables with scope-keyed storage.
/// Returns: (name-keyed values for output, scope-keyed values for per-bind filtering, cycle_err)
///
/// Variables with different scopes but the same name are stored separately
/// in `scoped_values` (e.g., `"#:rate"` and `"section:rate"`).
/// For the output map and backwards compat, last-evaluated wins for bare names.
fn evaluate_variables_scoped(
    var_defs: &[VariableDef],
    env: &mut FormspecEnvironment,
) -> (
    HashMap<String, Value>,
    HashMap<String, Value>,
    Option<String>,
) {
    let (order, cycle_err) = match topo_sort_variables(var_defs) {
        Ok(order) => (order, None),
        Err(cycle_msg) => {
            let order = var_defs.iter().map(|v| v.name.clone()).collect();
            (order, Some(cycle_msg))
        }
    };

    let mut var_values = HashMap::new(); // bare name → value (for output/backwards compat)
    let mut scoped_values = HashMap::new(); // "scope:name" → value (for per-bind filtering)

    // Evaluate each variable in topo order.
    // For duplicate names across scopes, evaluate ALL of them.
    for name in &order {
        // Find all var_defs with this name (may be multiple scopes)
        let matching: Vec<_> = var_defs.iter().filter(|v| v.name == *name).collect();
        for var in matching {
            if let Ok(parsed) = parse(&var.expression) {
                let result = evaluate(&parsed, env);
                let json_val = fel_to_json(&result.value);
                env.set_variable(name, result.value);
                var_values.insert(name.clone(), json_val.clone());

                let scope = var.scope.as_deref().unwrap_or("#");
                let scoped_key = format!("{scope}:{name}");
                scoped_values.insert(scoped_key, json_val);
            }
        }
    }

    (var_values, scoped_values, cycle_err)
}

fn populate_repeat_group_arrays(
    items: &[ItemInfo],
    values: &HashMap<String, Value>,
    env: &mut FormspecEnvironment,
) {
    for item in items {
        if item.repeatable
            && let Some(array) = build_repeat_group_array(&item.path, values)
        {
            env.set_field(&item.path, json_to_fel(&array));
        }
        populate_repeat_group_arrays(&item.children, values, env);
    }
}

fn build_repeat_group_array(group_path: &str, values: &HashMap<String, Value>) -> Option<Value> {
    let count = crate::rebuild::detect_repeat_count(group_path, values);
    if count == 0 {
        return None;
    }

    let mut rows = Vec::with_capacity(count);
    for index in 0..count {
        let prefix = format!("{group_path}[{index}].");
        let mut row = Value::Object(serde_json::Map::new());
        let mut has_values = false;
        for (path, value) in values {
            if let Some(relative) = path.strip_prefix(&prefix) {
                set_nested_json_path(&mut row, relative, value.clone());
                has_values = true;
            }
        }
        rows.push(if has_values {
            row
        } else {
            Value::Object(serde_json::Map::new())
        });
    }

    Some(Value::Array(rows))
}

fn set_nested_json_path(target: &mut Value, path: &str, value: Value) {
    let tokens = tokenize_json_path(path);
    if tokens.is_empty() {
        *target = value;
        return;
    }

    let mut current = target;
    for index in 0..tokens.len() - 1 {
        let next_is_index = matches!(tokens[index + 1], JsonPathToken::Index(_));
        match &tokens[index] {
            JsonPathToken::Key(key) => {
                if !current.is_object() {
                    *current = Value::Object(serde_json::Map::new());
                }
                let map = current.as_object_mut().expect("object ensured above");
                current = map.entry(key.clone()).or_insert_with(|| {
                    if next_is_index {
                        Value::Array(vec![])
                    } else {
                        Value::Object(serde_json::Map::new())
                    }
                });
            }
            JsonPathToken::Index(array_index) => {
                if !current.is_array() {
                    *current = Value::Array(vec![]);
                }
                let array = current.as_array_mut().expect("array ensured above");
                while array.len() <= *array_index {
                    array.push(Value::Null);
                }
                if array[*array_index].is_null() {
                    array[*array_index] = if next_is_index {
                        Value::Array(vec![])
                    } else {
                        Value::Object(serde_json::Map::new())
                    };
                }
                current = &mut array[*array_index];
            }
        }
    }

    match &tokens[tokens.len() - 1] {
        JsonPathToken::Key(key) => {
            if !current.is_object() {
                *current = Value::Object(serde_json::Map::new());
            }
            current
                .as_object_mut()
                .expect("object ensured above")
                .insert(key.clone(), value);
        }
        JsonPathToken::Index(array_index) => {
            if !current.is_array() {
                *current = Value::Array(vec![]);
            }
            let array = current.as_array_mut().expect("array ensured above");
            while array.len() <= *array_index {
                array.push(Value::Null);
            }
            array[*array_index] = value;
        }
    }
}

#[derive(Clone)]
enum JsonPathToken {
    Key(String),
    Index(usize),
}

fn tokenize_json_path(path: &str) -> Vec<JsonPathToken> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = path.chars().collect();
    let mut index = 0;

    while index < chars.len() {
        match chars[index] {
            '.' => {
                if !current.is_empty() {
                    tokens.push(JsonPathToken::Key(std::mem::take(&mut current)));
                }
                index += 1;
            }
            '[' => {
                if !current.is_empty() {
                    tokens.push(JsonPathToken::Key(std::mem::take(&mut current)));
                }
                let mut close = index + 1;
                while close < chars.len() && chars[close] != ']' {
                    close += 1;
                }
                if close > index + 1
                    && let Ok(array_index) = path[index + 1..close].parse::<usize>()
                {
                    tokens.push(JsonPathToken::Index(array_index));
                }
                index = close.saturating_add(1);
            }
            ch => {
                current.push(ch);
                index += 1;
            }
        }
    }

    if !current.is_empty() {
        tokens.push(JsonPathToken::Key(current));
    }

    tokens
}

/// Evaluate a single item's bind expressions with inheritance.
///
/// Handles: prev_relevant save, relevance (AND inheritance), default transition,
/// excludedValue, readonly (OR inheritance), required (only if relevant),
/// value loading, calculate evaluation, and MIP state update.
pub(crate) fn evaluate_single_item(
    item: &mut ItemInfo,
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
    parent_relevant: bool,
    parent_readonly: bool,
    invalid_paths: &HashSet<String>,
) {
    // Save previous relevance for transition detection (9c)
    item.prev_relevant = item.relevant;

    // Evaluate own relevance expression
    let own_relevant = if let Some(ref expr) = item.relevance {
        eval_bool(expr, env, true)
    } else {
        true
    };
    // AND inheritance: if parent is not relevant, child is not relevant
    item.relevant = own_relevant && parent_relevant;

    // 9c: Default on relevance transition — non-relevant → relevant + empty → apply default
    if item.relevant
        && !item.prev_relevant
        && let Some(ref default_val) = item.default_value
    {
        let current = values.get(&item.path);
        let is_empty = match current {
            None | Some(Value::Null) => true,
            Some(Value::String(s)) => s.is_empty(),
            _ => false,
        };
        if is_empty {
            values.insert(item.path.clone(), default_val.clone());
            env.set_field(&item.path, json_to_fel(default_val));
        }
    }

    // 9a: excludedValue — when non-relevant and excludedValue=="null", set FEL value to Null
    if !item.relevant
        && let Some(ref ev) = item.excluded_value
        && ev == "null"
    {
        env.set_field(&item.path, FelValue::Null);
    }

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
    if let Some(ref expr) = item.calculate
        && let Ok(parsed) = parse(expr)
    {
        let result = evaluate(&parsed, env);
        let json_val = fel_to_json(&result.value);
        values.insert(item.path.clone(), json_val.clone());
        item.value = json_val;
        env.set_field(&item.path, result.value);
    }

    // Update MIP state
    env.set_mip(
        &item.path,
        MipState {
            valid: !invalid_paths.contains(&item.path),
            relevant: item.relevant,
            readonly: item.readonly,
            required: item.required,
        },
    );
}

/// Evaluate items with bind inheritance rules:
/// - relevant: AND inheritance (parent false -> children false)
/// - readonly: OR inheritance (parent true -> children true)
/// - required: NO inheritance
pub(crate) fn evaluate_items_with_inheritance(
    items: &mut [ItemInfo],
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
    parent_relevant: bool,
    parent_readonly: bool,
    invalid_paths: &HashSet<String>,
) {
    for item in items.iter_mut() {
        evaluate_single_item(
            item,
            env,
            values,
            parent_relevant,
            parent_readonly,
            invalid_paths,
        );

        // Recurse into children with inherited state.
        if item.repeatable && !item.children.is_empty() {
            evaluate_repeat_children_with_aliases(
                &mut item.children,
                env,
                values,
                item.relevant,
                item.readonly,
                None,
                invalid_paths,
            );
        } else {
            evaluate_items_with_inheritance(
                &mut item.children,
                env,
                values,
                item.relevant,
                item.readonly,
                invalid_paths,
            );
        }
    }
}

/// Evaluate children of a repeatable group, adding bare-name field aliases
/// so `$sibling` resolves to the concrete indexed value in each row.
///
/// When `scoped_vars` is provided, variable scope filtering is applied per item
/// (propagated from `evaluate_items_with_inheritance_scoped`).
fn evaluate_repeat_children_with_aliases(
    children: &mut [ItemInfo],
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
    parent_relevant: bool,
    parent_readonly: bool,
    scoped_vars: Option<&HashMap<String, Value>>,
    invalid_paths: &HashSet<String>,
) {
    // Group children by instance index (e.g., "rows[0]." prefix)
    // and set bare-name aliases before evaluating each batch.
    let mut current_instance: Option<String> = None;
    let mut bare_names: Vec<String> = Vec::new();
    // Save original env values for bare names so we can restore after cleanup
    let mut saved_values: HashMap<String, Option<FelValue>> = HashMap::new();

    for item in children.iter_mut() {
        let instance_prefix = item.parent_path.as_deref().unwrap_or("");

        // When the instance changes, set up bare-name aliases
        if current_instance.as_deref() != Some(instance_prefix) {
            // Restore previous values for bare names
            for name in &bare_names {
                match saved_values.remove(name) {
                    Some(Some(val)) => env.set_field(name, val),
                    _ => {
                        env.data.remove(name);
                    }
                }
            }
            bare_names.clear();

            // Collect all sibling values for this instance
            current_instance = Some(instance_prefix.to_string());
            let prefix_dot = format!("{instance_prefix}.");
            for (k, v) in values.iter() {
                if let Some(bare) = k.strip_prefix(&prefix_dot)
                    && !bare.contains('.')
                {
                    // Save original value before overwriting
                    saved_values.insert(bare.to_string(), env.data.get(bare).cloned());
                    env.set_field(bare, json_to_fel(v));
                    bare_names.push(bare.to_string());
                }
            }
        }

        // Apply scoped variable filtering if provided
        if let Some(sv) = scoped_vars {
            let visible = visible_variables(sv, &item.path);
            env.variables.clear();
            for (name, val) in &visible {
                env.set_variable(name, json_to_fel(val));
            }
        }

        // Process this item
        evaluate_single_item(
            item,
            env,
            values,
            parent_relevant,
            parent_readonly,
            invalid_paths,
        );

        // Update bare-name alias with calculated value so siblings see it
        if item.calculate.is_some()
            && let Some(val) = values.get(&item.path)
        {
            env.set_field(&item.key, json_to_fel(val));
        }

        // Recurse into nested groups
        if item.repeatable && !item.children.is_empty() {
            evaluate_repeat_children_with_aliases(
                &mut item.children,
                env,
                values,
                item.relevant,
                item.readonly,
                scoped_vars,
                invalid_paths,
            );
        } else if let Some(sv) = scoped_vars {
            evaluate_items_with_inheritance_scoped(
                &mut item.children,
                env,
                values,
                item.relevant,
                item.readonly,
                sv,
                invalid_paths,
            );
        } else {
            evaluate_items_with_inheritance(
                &mut item.children,
                env,
                values,
                item.relevant,
                item.readonly,
                invalid_paths,
            );
        }
    }

    // Restore original values for bare names
    for name in &bare_names {
        match saved_values.remove(name) {
            Some(Some(val)) => env.set_field(name, val),
            _ => {
                env.data.remove(name);
            }
        }
    }
}

/// Variant of evaluate_items_with_inheritance that pre-filters variables
/// by scope before evaluating each item's expressions.
fn evaluate_items_with_inheritance_scoped(
    items: &mut [ItemInfo],
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
    parent_relevant: bool,
    parent_readonly: bool,
    scoped_vars: &HashMap<String, Value>,
    invalid_paths: &HashSet<String>,
) {
    for item in items.iter_mut() {
        // Compute visible variables for this item's path and set them in env
        let visible = visible_variables(scoped_vars, &item.path);
        env.variables.clear();
        for (name, val) in &visible {
            env.set_variable(name, json_to_fel(val));
        }

        evaluate_single_item(
            item,
            env,
            values,
            parent_relevant,
            parent_readonly,
            invalid_paths,
        );

        // Recurse: for repeatable groups, pass scoped_vars through
        if item.repeatable && !item.children.is_empty() {
            evaluate_repeat_children_with_aliases(
                &mut item.children,
                env,
                values,
                item.relevant,
                item.readonly,
                Some(scoped_vars),
                invalid_paths,
            );
        } else {
            evaluate_items_with_inheritance_scoped(
                &mut item.children,
                env,
                values,
                item.relevant,
                item.readonly,
                scoped_vars,
                invalid_paths,
            );
        }
    }
}

fn settle_calculated_values(
    items: &mut [ItemInfo],
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
    scoped_vars: Option<&HashMap<String, Value>>,
) {
    for _ in 0..100 {
        let changed = match scoped_vars {
            Some(scoped_vars) => {
                calculate_pass_items_scoped(items, env, values, scoped_vars)
            }
            None => calculate_pass_items(items, env, values),
        };
        if !changed {
            break;
        }
    }
}

fn calculate_pass_items(
    items: &mut [ItemInfo],
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
) -> bool {
    let mut changed = false;

    for item in items.iter_mut() {
        changed |= evaluate_calculate_only(item, env, values);

        if item.repeatable && !item.children.is_empty() {
            changed |= calculate_pass_repeat_children_with_aliases(
                &mut item.children,
                env,
                values,
                None,
            );
        } else {
            changed |= calculate_pass_items(&mut item.children, env, values);
        }
    }

    changed
}

fn calculate_pass_items_scoped(
    items: &mut [ItemInfo],
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
    scoped_vars: &HashMap<String, Value>,
) -> bool {
    let mut changed = false;

    for item in items.iter_mut() {
        let visible = visible_variables(scoped_vars, &item.path);
        env.variables.clear();
        for (name, val) in &visible {
            env.set_variable(name, json_to_fel(val));
        }

        changed |= evaluate_calculate_only(item, env, values);

        if item.repeatable && !item.children.is_empty() {
            changed |= calculate_pass_repeat_children_with_aliases(
                &mut item.children,
                env,
                values,
                Some(scoped_vars),
            );
        } else {
            changed |= calculate_pass_items_scoped(&mut item.children, env, values, scoped_vars);
        }
    }

    changed
}

fn calculate_pass_repeat_children_with_aliases(
    children: &mut [ItemInfo],
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
    scoped_vars: Option<&HashMap<String, Value>>,
) -> bool {
    let mut changed = false;
    let mut current_instance: Option<String> = None;
    let mut bare_names: Vec<String> = Vec::new();
    let mut saved_values: HashMap<String, Option<FelValue>> = HashMap::new();

    for item in children.iter_mut() {
        let instance_prefix = item.parent_path.as_deref().unwrap_or("");

        if current_instance.as_deref() != Some(instance_prefix) {
            for name in &bare_names {
                match saved_values.remove(name) {
                    Some(Some(val)) => env.set_field(name, val),
                    _ => {
                        env.data.remove(name);
                    }
                }
            }
            bare_names.clear();

            current_instance = Some(instance_prefix.to_string());
            let prefix_dot = format!("{instance_prefix}.");
            for (k, v) in values.iter() {
                if let Some(bare) = k.strip_prefix(&prefix_dot)
                    && !bare.contains('.')
                {
                    saved_values.insert(bare.to_string(), env.data.get(bare).cloned());
                    env.set_field(bare, json_to_fel(v));
                    bare_names.push(bare.to_string());
                }
            }
        }

        if let Some(scoped_vars) = scoped_vars {
            let visible = visible_variables(scoped_vars, &item.path);
            env.variables.clear();
            for (name, val) in &visible {
                env.set_variable(name, json_to_fel(val));
            }
        }

        changed |= evaluate_calculate_only(item, env, values);

        if item.calculate.is_some()
            && let Some(val) = values.get(&item.path)
        {
            env.set_field(&item.key, json_to_fel(val));
        }

        if item.repeatable && !item.children.is_empty() {
            changed |= calculate_pass_repeat_children_with_aliases(
                &mut item.children,
                env,
                values,
                scoped_vars,
            );
        } else if let Some(scoped_vars) = scoped_vars {
            changed |= calculate_pass_items_scoped(&mut item.children, env, values, scoped_vars);
        } else {
            changed |= calculate_pass_items(&mut item.children, env, values);
        }
    }

    for name in &bare_names {
        match saved_values.remove(name) {
            Some(Some(val)) => env.set_field(name, val),
            _ => {
                env.data.remove(name);
            }
        }
    }

    changed
}

fn evaluate_calculate_only(
    item: &mut ItemInfo,
    env: &mut FormspecEnvironment,
    values: &mut HashMap<String, Value>,
) -> bool {
    let Some(ref expr) = item.calculate else {
        return false;
    };
    let Ok(parsed) = parse(expr) else {
        return false;
    };

    let result = evaluate(&parsed, env);
    let json_val = fel_to_json(&result.value);
    let changed = values.get(&item.path) != Some(&json_val);

    values.insert(item.path.clone(), json_val.clone());
    item.value = json_val;
    env.set_field(&item.path, result.value);

    changed
}

pub(crate) fn eval_bool(expr: &str, env: &FormspecEnvironment, default: bool) -> bool {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rebuild::rebuild_item_tree;
    use crate::types::find_item_by_path;
    use serde_json::json;

    // ── Topological sort ─────────────────────────────────────────

    #[test]
    fn test_topo_sort_correct_order() {
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
        assert!(order.contains(&"x".to_string()));
        assert!(order.contains(&"y".to_string()));
    }

    // ── AND inheritance for relevance ────────────────────────────

    #[test]
    fn test_relevance_and_inheritance() {
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
        let mut items = rebuild_item_tree(&def);
        let _ = recalculate(&mut items, &data, &def, None, None);

        let parent = find_item_by_path(&items, "parent").unwrap();
        assert!(!parent.relevant, "parent should be non-relevant");
        let child = find_item_by_path(&items, "parent.child").unwrap();
        assert!(
            !child.relevant,
            "child should be non-relevant due to parent"
        );
    }

    #[test]
    fn test_relevance_child_irrelevant_parent_relevant() {
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
        let mut items = rebuild_item_tree(&def);
        let _ = recalculate(&mut items, &data, &def, None, None);

        let parent = find_item_by_path(&items, "parent").unwrap();
        assert!(parent.relevant, "parent should be relevant");
        let child = find_item_by_path(&items, "parent.child").unwrap();
        assert!(
            !child.relevant,
            "child should be non-relevant from own bind"
        );
    }

    // ── OR inheritance for readonly ──────────────────────────────

    #[test]
    fn test_readonly_or_inheritance() {
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
        let (values, _, _) = recalculate(&mut items, &data, &def, None, None);

        let child = find_item_by_path(&items, "section.field").unwrap();
        assert!(
            child.readonly,
            "child should be readonly due to OR inheritance from parent"
        );

        let parent = find_item_by_path(&items, "section").unwrap();
        assert!(parent.readonly, "parent should be explicitly readonly");

        let _ = values;
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
        let _ = recalculate(&mut items, &data, &def, None, None);

        let parent = find_item_by_path(&items, "section").unwrap();
        assert!(
            !parent.readonly,
            "parent should not inherit readonly from child"
        );

        let child = find_item_by_path(&items, "section.field").unwrap();
        assert!(child.readonly, "child should be explicitly readonly");
    }

    // ── Direct recalculate() test ────────────────────────────────

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
        let (values, var_values, _) = recalculate(&mut items, &data, &def, None, None);

        assert_eq!(values.get("total"), Some(&json!(100)));
        assert!(
            var_values.contains_key("taxRate"),
            "variable should be evaluated"
        );
    }

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
        let _ = recalculate(&mut items, &data, &def, None, None);

        let field = find_item_by_path(&items, "field").unwrap();
        assert!(
            !field.relevant,
            "field should be non-relevant when toggle is false"
        );
        assert!(field.readonly, "field should be readonly");
        assert!(!field.required, "required suppressed when non-relevant");
    }

    // ── variable_deps edge cases ─────────────────────────────────

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

    #[test]
    fn variable_deps_parse_failure_returns_empty() {
        let known: HashSet<&str> = ["x"].iter().cloned().collect();
        let deps = variable_deps("@@@ !!invalid!!", &known);
        assert!(deps.is_empty(), "parse failure should return empty vec");
    }

    #[test]
    fn variable_deps_filters_unknown_refs() {
        let known: HashSet<&str> = ["a"].iter().cloned().collect();
        let deps = variable_deps("@a + @b", &known);
        assert_eq!(deps, vec!["a"], "only known vars returned");
    }

    // ── 3-level inheritance ──────────────────────────────────────

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
        let mut items = rebuild_item_tree(&def);
        let _ = recalculate(&mut items, &data, &def, None, None);

        assert!(!find_item_by_path(&items, "grandparent").unwrap().relevant);
        assert!(
            !find_item_by_path(&items, "grandparent.parent")
                .unwrap()
                .relevant
        );
        assert!(
            !find_item_by_path(&items, "grandparent.parent.child")
                .unwrap()
                .relevant,
            "grandchild should be non-relevant via AND inheritance from grandparent"
        );
    }

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
        let _ = recalculate(&mut items, &data, &def, None, None);

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
        let _ = recalculate(&mut items, &data, &def, None, None);

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
        let (values, _, _) = recalculate(&mut items, &data, &def, None, None);

        assert_eq!(values.get("parent"), Some(&json!(42)));
        assert_eq!(values.get("parent.child"), None);
    }

    // ── Visible variables ────────────────────────────────────────

    #[test]
    fn visible_variables_unit_test() {
        let mut all_vars = HashMap::new();
        all_vars.insert("#:global_var".to_string(), json!(1));
        all_vars.insert("section:local_var".to_string(), json!(2));
        all_vars.insert("other:other_var".to_string(), json!(3));

        let visible = visible_variables(&all_vars, "section.field");
        assert_eq!(visible.get("global_var"), Some(&json!(1)));
        assert_eq!(visible.get("local_var"), Some(&json!(2)));
        assert_eq!(visible.get("other_var"), None);

        let visible_top = visible_variables(&all_vars, "top");
        assert_eq!(visible_top.get("global_var"), Some(&json!(1)));
        assert_eq!(visible_top.get("local_var"), None);
    }
}
