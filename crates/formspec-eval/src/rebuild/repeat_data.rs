//! Flat data augmentation for nested repeat groups and repeat-instance counting.

use serde_json::Value;
use std::collections::HashMap;

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
