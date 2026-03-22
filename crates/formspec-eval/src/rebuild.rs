//! Phase 1: Rebuild — build the item tree from a definition JSON.

use serde_json::Value;
use std::collections::HashMap;

use crate::types::{ItemInfo, VariableDef, find_item_by_path_mut, internal_path_to_fel_path};

fn bool_or_string_expr(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Bool(flag) => Some(flag.to_string()),
        _ => None,
    }
}

/// Build the item tree from a definition JSON.
pub fn rebuild_item_tree(definition: &Value) -> Vec<ItemInfo> {
    let items = definition.get("items").and_then(|v| v.as_array());
    let binds = definition.get("binds");
    let default_currency = definition
        .get("formPresentation")
        .and_then(|v| v.get("defaultCurrency"))
        .and_then(|v| v.as_str());

    match items {
        Some(items) => items
            .iter()
            .map(|item| build_item_info(item, binds, None, default_currency))
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
) -> Option<serde_json::Map<String, Value>> {
    let binds = binds?;
    // Support both object-style and array-style binds
    match binds {
        Value::Object(map) => map.get(key)?.as_object().cloned(),
        Value::Array(arr) => {
            let mut merged = serde_json::Map::new();
            for bind in arr {
                if bind.get("path").and_then(|v| v.as_str()) == Some(key) {
                    if let Some(bind_obj) = bind.as_object() {
                        for (field, value) in bind_obj {
                            merged.insert(field.clone(), value.clone());
                        }
                    }
                }
            }
            if merged.is_empty() {
                None
            } else {
                Some(merged)
            }
        }
        _ => None,
    }
}

fn build_item_info(
    item: &Value,
    binds: Option<&Value>,
    parent_path: Option<&str>,
    default_currency: Option<&str>,
) -> ItemInfo {
    let key = item
        .get("key")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let item_type = item
        .get("type")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| {
            if item.get("children").is_some() || item.get("repeatable").is_some() {
                "group".to_string()
            } else {
                "field".to_string()
            }
        });
    let data_type = item
        .get("dataType")
        .and_then(|v| v.as_str())
        .map(String::from);
    let currency = item
        .get("currency")
        .and_then(|v| v.as_str())
        .or(default_currency)
        .map(String::from);

    let path = match parent_path {
        Some(prefix) => format!("{}.{}", prefix, key),
        None => key.clone(),
    };

    // Look up bind for this path
    let mut bind = resolve_bind(binds, &path).or_else(|| resolve_bind(binds, &key)).unwrap_or_default();
    for field in [
        "calculate",
        "constraint",
        "constraintMessage",
        "relevant",
        "required",
        "readonly",
        "default",
        "precision",
        "disabledDisplay",
        "whitespace",
        "nonRelevantBehavior",
        "excludedValue",
    ] {
        if let Some(value) = item.get(field) {
            bind.insert(field.to_string(), value.clone());
        }
    }
    if bind.get("relevant").is_none()
        && let Some(value) = item.get("visible")
    {
        bind.insert("relevant".to_string(), value.clone());
    }

    let children = item
        .get("children")
        .and_then(|v| v.as_array())
        .map(|kids| {
            kids.iter()
                .map(|k| build_item_info(k, binds, Some(&path), default_currency))
                .collect()
        })
        .unwrap_or_default();

    ItemInfo {
        key,
        path: path.clone(),
        item_type,
        data_type,
        currency,
        value: Value::Null,
        relevant: true,
        required: false,
        readonly: false,
        calculate: Some(&bind)
            .and_then(|b| b.get("calculate"))
            .and_then(|v| v.as_str())
            .map(String::from),
        precision: Some(&bind)
            .and_then(|b| b.get("precision"))
            .and_then(|v| v.as_u64())
            .and_then(|value| u32::try_from(value).ok()),
        constraint: Some(&bind)
            .and_then(|b| b.get("constraint"))
            .and_then(|v| v.as_str())
            .map(String::from),
        constraint_message: Some(&bind)
            .and_then(|b| b.get("constraintMessage"))
            .and_then(|v| v.as_str())
            .map(String::from),
        relevance: Some(&bind)
            .and_then(|b| b.get("relevant"))
            .and_then(bool_or_string_expr),
        required_expr: Some(&bind)
            .and_then(|b| b.get("required"))
            .and_then(bool_or_string_expr),
        readonly_expr: Some(&bind)
            .and_then(|b| b.get("readonly"))
            .and_then(bool_or_string_expr),
        whitespace: Some(&bind)
            .and_then(|b| b.get("whitespace"))
            .and_then(|v| v.as_str())
            .map(String::from),
        nrb: Some(&bind)
            .and_then(|b| b.get("nonRelevantBehavior"))
            .and_then(|v| v.as_str())
            .map(String::from),
        excluded_value: Some(&bind)
            .and_then(|b| b.get("excludedValue"))
            .and_then(|v| v.as_str())
            .map(String::from),
        default_value: Some(&bind).and_then(|b| b.get("default")).and_then(|v| {
            match v {
                Value::String(s) if s.starts_with('=') => None,
                other => Some(other.clone()),
            }
        }),
        default_expression: Some(&bind)
            .and_then(|b| b.get("default"))
            .and_then(|v| v.as_str())
            .filter(|s| s.starts_with('='))
            .map(|s| s[1..].to_string()),
        initial_value: item.get("initialValue").cloned(),
        prev_relevant: true,
        parent_path: parent_path.map(String::from),
        repeatable: item
            .get("repeatable")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        repeat_min: item.get("minRepeat").and_then(|v| v.as_u64()),
        repeat_max: item.get("maxRepeat").and_then(|v| v.as_u64()),
        extensions: item
            .get("extensions")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .filter(|(_, v)| !v.is_null() && v.as_bool() != Some(false))
                    .map(|(k, _)| k.clone())
                    .collect()
            })
            .unwrap_or_default(),
        pre_populate_instance: item
            .get("prePopulate")
            .and_then(|pp| pp.get("instance"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        pre_populate_path: item
            .get("prePopulate")
            .and_then(|pp| pp.get("path"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
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

    let mut expanded = Vec::new();
    for i in 0..count {
        let concrete = if suffix.is_empty() {
            format!("{}[{}]", base, i)
        } else {
            format!("{}[{}].{}", base, i, suffix)
        };
        expanded.extend(expand_wildcard_path(&concrete, data));
    }
    expanded
}

/// Augment nested data with indexed paths for repeat groups.
/// `{"rows": [{"a": 1}]}` adds `{"rows[0].a": 1}` while keeping the original `rows` key.
/// This lets FEL resolve `$rows[0].a` via flat lookup while preserving nested output format.
pub(crate) fn augment_nested_data(data: &HashMap<String, Value>) -> HashMap<String, Value> {
    let mut augmented = data.clone();
    for (key, value) in data {
        augment_array_value(&mut augmented, key, value);
    }
    augmented
}

fn augment_array_value(out: &mut HashMap<String, Value>, prefix: &str, value: &Value) {
    if !is_repeat_group_array(value) {
        return;
    }
    // Array of objects = repeat group instances — add indexed paths
    if let Value::Array(arr) = value {
        for (i, elem) in arr.iter().enumerate() {
            let indexed = format!("{prefix}[{i}]");
            if let Value::Object(map) = elem {
                for (k, v) in map {
                    let path = format!("{indexed}.{k}");
                    out.insert(path.clone(), v.clone());
                    // Recurse for nested repeat groups
                    augment_array_value(out, &path, v);
                }
            }
        }
    }
}

/// Check if a value is an array of objects (repeat group data).
/// These should not be set in the FEL env to avoid 1-based array indexing conflicts.
pub(crate) fn is_repeat_group_array(v: &Value) -> bool {
    if let Value::Array(arr) = v {
        !arr.is_empty() && arr.iter().all(|e| e.is_object())
    } else {
        false
    }
}

/// Detect the repeat count for a given base path by looking at the data keys.
/// Supports both indexed-key format (`base[0].field`, `base[1].field`) and
/// array-valued format (`base` -> `[...]`).
pub(crate) fn detect_repeat_count(base: &str, data: &HashMap<String, Value>) -> usize {
    // Check if data[base] is an array (flat data format)
    if let Some(Value::Array(arr)) = data.get(base) {
        return arr.len();
    }

    // Check indexed-key format (expanded data format)
    let mut max_index = 0usize;
    let prefix = format!("{}[", base);
    for key in data.keys() {
        if let Some(rest) = key.strip_prefix(&prefix)
            && let Some(idx_str) = rest.split(']').next()
            && let Ok(idx) = idx_str.parse::<usize>()
        {
            max_index = max_index.max(idx + 1);
        }
    }
    max_index
}

// ── Repeat instance expansion ───────────────────────────────────

/// Expand repeatable groups into concrete indexed instances based on data.
///
/// For each repeatable group, counts instances in data and clones the
/// template children N times with indexed paths: `group[0].child`, `group[1].child`.
pub fn expand_repeat_instances(items: &mut [ItemInfo], data: &HashMap<String, Value>) {
    expand_repeat_instances_inner(items, data);
}

fn rebase_item_paths(item: &mut ItemInfo, from: &str, to: &str) {
    if item.path == from {
        item.path = to.to_string();
    } else if let Some(relative) = item.path.strip_prefix(&format!("{from}.")) {
        item.path = format!("{to}.{relative}");
    }

    if let Some(parent_path) = item.parent_path.clone() {
        if parent_path == from {
            item.parent_path = Some(to.to_string());
        } else if let Some(relative) = parent_path.strip_prefix(&format!("{from}.")) {
            item.parent_path = Some(format!("{to}.{relative}"));
        }
    }

    for child in &mut item.children {
        rebase_item_paths(child, from, to);
    }
}

fn expand_repeat_instances_inner(items: &mut [ItemInfo], data: &HashMap<String, Value>) {
    for item in items.iter_mut() {
        if item.repeatable {
            let count = detect_repeat_count(&item.path, data).max(item.repeat_min.unwrap_or(0) as usize);
            if count > 0 {
                // Clone template children into concrete indexed instances
                let template_children = item.children.clone();
                let mut expanded = Vec::new();
                for i in 0..count {
                    for child in &template_children {
                        let mut concrete = child.clone();
                        let original_path = concrete.path.clone();
                        let indexed_path = format!("{}[{}].{}", item.path, i, child.key);
                        rebase_item_paths(&mut concrete, &original_path, &indexed_path);
                        concrete.parent_path = Some(format!("{}[{}]", item.path, i));
                        // Recursively expand nested repeatables
                        expand_repeat_instances_inner(std::slice::from_mut(&mut concrete), data);
                        expanded.push(concrete);
                    }
                }
                item.children = expanded;
            }
        } else {
            // Recurse into non-repeatable groups
            expand_repeat_instances_inner(&mut item.children, data);
        }
    }
}

// ── Wildcard bind resolution ────────────────────────────────────

/// Check if a bind path is a wildcard path (contains `[*]`).
pub(crate) fn is_wildcard_bind(path: &str) -> bool {
    path.contains("[*]")
}

/// Resolve a wildcard bind expression by replacing `[*]` references with
/// a concrete index. E.g., `$items[*].qty * $items[*].price` with index 2
/// becomes `$items[2].qty * $items[2].price`.
pub(crate) fn instantiate_wildcard_expr(expr: &str, base: &str, index: usize) -> String {
    let wildcard_pattern = format!("${}[*]", base);
    let concrete = format!("${}[{}]", base, index);
    expr.replace(&wildcard_pattern, &concrete)
}

/// Extract the base path from a wildcard bind path.
/// E.g., `items[*].total` → `items`.
pub(crate) fn wildcard_base(path: &str) -> Option<&str> {
    path.find("[*]").map(|pos| &path[..pos])
}

/// Apply wildcard binds to expanded concrete items.
///
/// For each wildcard bind (path contains `[*]`), find matching concrete items
/// and set their bind properties (calculate, constraint, etc.) with the
/// wildcard expression instantiated for their concrete index.
pub(crate) fn apply_wildcard_binds(
    items: &mut [ItemInfo],
    binds: Option<&Value>,
    data: &HashMap<String, Value>,
) {
    let wildcard_binds = collect_wildcard_binds(binds);
    if wildcard_binds.is_empty() {
        return;
    }

    for (bind_path, bind_obj) in &wildcard_binds {
        let concrete_paths = {
            let from_data = expand_wildcard_path(bind_path, data);
            if from_data.is_empty() {
                collect_matching_item_paths(items, bind_path)
            } else {
                from_data
            }
        };
        for concrete_path in concrete_paths {
            if let Some(item) = find_item_by_path_mut(items, &concrete_path) {
                let inst = |expr: &str| -> String { instantiate_concrete_expr(expr, bind_path, &concrete_path) };
                if let Some(expr) = bind_obj.get("calculate").and_then(|v| v.as_str()) {
                    item.calculate = Some(inst(expr));
                }
                if let Some(expr) = bind_obj.get("constraint").and_then(|v| v.as_str()) {
                    item.constraint = Some(inst(expr));
                }
                if let Some(msg) = bind_obj.get("constraintMessage").and_then(|v| v.as_str()) {
                    item.constraint_message = Some(msg.to_string());
                }
                if let Some(expr) = bind_obj.get("relevant").and_then(bool_or_string_expr) {
                    item.relevance = Some(inst(&expr));
                }
                if let Some(expr) = bind_obj.get("required").and_then(bool_or_string_expr) {
                    item.required_expr = Some(inst(&expr));
                }
                if let Some(expr) = bind_obj.get("readonly").and_then(bool_or_string_expr) {
                    item.readonly_expr = Some(inst(&expr));
                }
                if let Some(ws) = bind_obj.get("whitespace").and_then(|v| v.as_str()) {
                    item.whitespace = Some(ws.to_string());
                }
                if let Some(nrb) = bind_obj.get("nonRelevantBehavior").and_then(|v| v.as_str()) {
                    item.nrb = Some(nrb.to_string());
                }
                if let Some(ev) = bind_obj.get("excludedValue").and_then(|v| v.as_str()) {
                    item.excluded_value = Some(ev.to_string());
                }
                if let Some(default_val) = bind_obj.get("default") {
                    match default_val {
                        Value::String(s) if s.starts_with('=') => {
                            item.default_expression = Some(inst(&s[1..]));
                            item.default_value = None;
                        }
                        other => {
                            item.default_value = Some(other.clone());
                            item.default_expression = None;
                        }
                    }
                }
            }
        }
    }
}

fn collect_matching_item_paths(items: &[ItemInfo], wildcard_path: &str) -> Vec<String> {
    let mut paths = Vec::new();
    collect_matching_item_paths_inner(items, wildcard_path, &mut paths);
    paths
}

fn collect_matching_item_paths_inner(items: &[ItemInfo], wildcard_path: &str, out: &mut Vec<String>) {
    for item in items {
        if wildcard_path_matches(wildcard_path, &item.path) {
            out.push(item.path.clone());
        }
        collect_matching_item_paths_inner(&item.children, wildcard_path, out);
    }
}

fn wildcard_path_matches(pattern: &str, path: &str) -> bool {
    let parts: Vec<&str> = pattern.split("[*]").collect();
    if parts.len() == 1 {
        return pattern == path;
    }

    let mut remainder = path;
    for (index, part) in parts.iter().enumerate() {
        if index == 0 {
            let Some(stripped) = remainder.strip_prefix(part) else {
                return false;
            };
            remainder = stripped;
            continue;
        }

        if !remainder.starts_with('[') {
            return false;
        }
        let Some(end) = remainder.find(']') else {
            return false;
        };
        if remainder[1..end].parse::<usize>().is_err() {
            return false;
        }
        remainder = &remainder[end + 1..];
        let Some(stripped) = remainder.strip_prefix(part) else {
            return false;
        };
        remainder = stripped;
    }

    remainder.is_empty()
}

fn instantiate_concrete_expr(expr: &str, wildcard_path: &str, concrete_path: &str) -> String {
    let wildcard_parts: Vec<&str> = wildcard_path.split('.').collect();
    let concrete_parts: Vec<&str> = concrete_path.split('.').collect();
    let mut result = expr.to_string();
    let mut wildcard_prefix = Vec::new();
    let mut concrete_prefix = Vec::new();

    for (wildcard_part, concrete_part) in wildcard_parts.iter().zip(concrete_parts.iter()) {
        wildcard_prefix.push(*wildcard_part);
        concrete_prefix.push(*concrete_part);
        if !wildcard_part.contains("[*]") {
            continue;
        }
        let wildcard_ref = format!("${}", wildcard_prefix.join("."));
        let concrete_ref = format!("${}", internal_path_to_fel_path(&concrete_prefix.join(".")));
        result = result.replace(&wildcard_ref, &concrete_ref);
    }

    result
}

/// Collect wildcard bind entries from the binds object/array.
fn collect_wildcard_binds(binds: Option<&Value>) -> Vec<(String, serde_json::Map<String, Value>)> {
    let mut merged: HashMap<String, serde_json::Map<String, Value>> = HashMap::new();
    match binds {
        Some(Value::Object(map)) => {
            for (path, val) in map {
                if is_wildcard_bind(path)
                    && let Some(obj) = val.as_object()
                {
                    merged.insert(path.clone(), obj.clone());
                }
            }
        }
        Some(Value::Array(arr)) => {
            for bind in arr {
                if let Some(path) = bind.get("path").and_then(|v| v.as_str())
                    && is_wildcard_bind(path)
                    && let Some(obj) = bind.as_object()
                {
                    let entry = merged.entry(path.to_string()).or_default();
                    for (field, value) in obj {
                        entry.insert(field.clone(), value.clone());
                    }
                }
            }
        }
        _ => {}
    }
    merged.into_iter().collect()
}

/// Seed initial values for fields that are missing from data (9e).
/// If initialValue is a string starting with "=", evaluate as FEL expression.
/// Otherwise use as literal.
pub(crate) fn seed_initial_values(
    items: &[ItemInfo],
    data: &mut HashMap<String, Value>,
    now_iso: Option<&str>,
) {
    for item in items {
        if let Some(ref init_val) = item.initial_value
            && !data.contains_key(&item.path)
        {
            match init_val {
                Value::String(s) if s.starts_with('=') => {
                    // FEL expression — evaluate in a temporary env with current data
                    let expr_str = &s[1..];
                    if let Ok(parsed) = fel_core::parse(expr_str) {
                        let mut env = fel_core::FormspecEnvironment::new();
                        if let Some(now_iso) = now_iso {
                            env.set_now_from_iso(now_iso);
                        }
                        for (k, v) in data.iter() {
                            env.set_field(k, fel_core::json_to_fel(v));
                        }
                        let result = fel_core::evaluate(&parsed, &env);
                        data.insert(item.path.clone(), fel_core::fel_to_json(&result.value));
                    }
                }
                _ => {
                    data.insert(item.path.clone(), init_val.clone());
                }
            }
        }
        seed_initial_values(&item.children, data, now_iso);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::find_item_by_path;
    use serde_json::json;

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

    // ── Finding 34: Nested wildcard expansion ────────────────────

    #[test]
    fn expand_wildcard_path_nested_wildcards_expands_all_levels() {
        let mut data = HashMap::new();
        data.insert("items[0].subitems[0].value".to_string(), json!(1));
        data.insert("items[0].subitems[1].value".to_string(), json!(2));
        data.insert("items[1].subitems[0].value".to_string(), json!(3));

        let expanded = expand_wildcard_path("items[*].subitems[*].value", &data);
        assert_eq!(expanded.len(), 3);
        assert_eq!(expanded[0], "items[0].subitems[0].value");
        assert_eq!(expanded[1], "items[0].subitems[1].value");
        assert_eq!(expanded[2], "items[1].subitems[0].value");
    }

    // ── Finding 35: Sparse repeat indices ────────────────────────

    #[test]
    fn detect_repeat_count_sparse_indices_returns_max_plus_one() {
        let mut data = HashMap::new();
        data.insert("items[0].name".to_string(), json!("first"));
        data.insert("items[5].name".to_string(), json!("sixth"));

        let count = detect_repeat_count("items", &data);
        assert_eq!(count, 6, "returns max_index+1 (6), not actual count (2)");
    }

    // ── parse_variables edge cases ──────────────────────────────

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

    #[test]
    fn parse_variables_no_variables_key() {
        let def = json!({ "items": [] });
        let vars = parse_variables(&def);
        assert!(vars.is_empty());
    }

    #[test]
    fn parse_variables_empty_array() {
        let def = json!({ "variables": [] });
        let vars = parse_variables(&def);
        assert!(vars.is_empty());
    }

    // ── Bind resolution fallback ─────────────────────────────────

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

        let items = rebuild_item_tree(&def);
        let child = find_item_by_path(&items, "group.name").unwrap();
        assert!(
            child.required_expr.is_some(),
            "nested item 'group.name' falls back to bare-key bind 'name' — \
             this could match the wrong bind if multiple items share a key"
        );
    }

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

        let items = rebuild_item_tree(&def);
        let child = find_item_by_path(&items, "group.name").unwrap();
        assert_eq!(
            child.required_expr.as_deref(),
            Some("false"),
            "full path bind 'group.name' takes priority over bare key 'name'"
        );
    }

    // ── Repeat instance expansion ────────────────────────────────

    #[test]
    fn repeat_instance_expansion_creates_concrete_items() {
        let def = json!({
            "items": [
                {
                    "key": "items",
                    "repeatable": true,
                    "children": [
                        { "key": "name", "dataType": "string" }
                    ]
                }
            ]
        });

        let mut items = rebuild_item_tree(&def);
        let mut data = HashMap::new();
        data.insert("items[0].name".to_string(), json!("first"));
        data.insert("items[1].name".to_string(), json!("second"));

        expand_repeat_instances(&mut items, &data);

        assert!(
            find_item_by_path(&items, "items[0].name").is_some(),
            "items[0].name should exist after expansion"
        );
        assert!(
            find_item_by_path(&items, "items[1].name").is_some(),
            "items[1].name should exist after expansion"
        );
    }

    #[test]
    fn expand_repeat_instances_no_repeatables() {
        let def = json!({
            "items": [
                { "key": "name", "dataType": "string" }
            ]
        });

        let mut items = rebuild_item_tree(&def);
        let data = HashMap::new();
        expand_repeat_instances(&mut items, &data);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].key, "name");
    }

    // ── Wildcard expr instantiation ─────────────────────────────

    #[test]
    fn instantiate_wildcard_expr_no_prefix_collision() {
        let result = instantiate_wildcard_expr("$myrow[*].field + $row[*].field", "row", 0);
        assert_eq!(
            result, "$myrow[*].field + $row[0].field",
            "must not replace inside $myrow — only $row"
        );
    }

    #[test]
    fn instantiate_wildcard_expr_dotted_base() {
        let result = instantiate_wildcard_expr(
            "$section.rows[*].qty * $section.rows[*].price",
            "section.rows",
            3,
        );
        assert_eq!(result, "$section.rows[3].qty * $section.rows[3].price");
    }

    #[test]
    fn instantiate_wildcard_expr_no_match() {
        let result = instantiate_wildcard_expr("$other[*].x", "items", 0);
        assert_eq!(result, "$other[*].x");
    }

    // ── augment_nested_data ──────────────────────────────────────

    #[test]
    fn augment_nested_data_skips_primitive_arrays() {
        let mut data = HashMap::new();
        data.insert("tags".to_string(), json!(["a", "b", "c"]));
        let flat = augment_nested_data(&data);
        assert!(!flat.contains_key("tags[0]"));
        assert_eq!(flat.get("tags"), Some(&json!(["a", "b", "c"])));
    }
}
