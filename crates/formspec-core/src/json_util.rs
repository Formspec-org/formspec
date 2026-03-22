//! Small JSON helpers shared across bindings.

use std::collections::HashMap;

use serde_json::Value;

/// Clone a JSON object into a `String` → `Value` map; non-objects yield an empty map.
pub fn json_object_to_string_map(val: &Value) -> HashMap<String, Value> {
    val.as_object()
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default()
}
