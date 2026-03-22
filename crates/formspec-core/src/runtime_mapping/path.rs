//! Dot-path splitting and JSON get/set helpers.

use serde_json::Value;

// ── Path utilities ──────────────────────────────────────────────

/// Split a dotted/bracketed path into segments.
pub(crate) fn split_path(path: &str) -> Vec<String> {
    let mut segments = Vec::new();
    let mut current = String::new();

    for c in path.chars() {
        match c {
            '.' => {
                if !current.is_empty() {
                    segments.push(std::mem::take(&mut current));
                }
            }
            '[' => {
                if !current.is_empty() {
                    segments.push(std::mem::take(&mut current));
                }
            }
            ']' => {
                if !current.is_empty() {
                    segments.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(c),
        }
    }
    if !current.is_empty() {
        segments.push(current);
    }
    segments
}

/// Get a value at a path in a JSON object.
/// Supports `[*]` wildcard: when `*` is encountered on an array, returns the array itself.
pub(crate) fn get_by_path<'a>(obj: &'a Value, path: &str) -> &'a Value {
    let segments = split_path(path);
    let mut current = obj;
    for seg in &segments {
        if seg == "*" {
            // Wildcard: return the current value if it's an array, else null
            return if current.is_array() {
                current
            } else {
                &Value::Null
            };
        }
        match current {
            Value::Object(map) => {
                current = map.get(seg.as_str()).unwrap_or(&Value::Null);
            }
            Value::Array(arr) => {
                if let Ok(idx) = seg.parse::<usize>() {
                    current = arr.get(idx).unwrap_or(&Value::Null);
                } else {
                    return &Value::Null;
                }
            }
            _ => return &Value::Null,
        }
    }
    current
}

/// Set a value at a path in a JSON object, creating intermediate objects as needed.
pub(crate) fn set_by_path(obj: &mut Value, path: &str, value: Value) {
    let segments = split_path(path);
    if segments.is_empty() {
        return;
    }

    let mut current = obj;
    for (i, seg) in segments.iter().enumerate() {
        if i == segments.len() - 1 {
            // Last segment — set the value
            match current {
                Value::Object(map) => {
                    map.insert(seg.clone(), value);
                    return;
                }
                Value::Array(arr) => {
                    if let Ok(idx) = seg.parse::<usize>() {
                        while arr.len() <= idx {
                            arr.push(Value::Null);
                        }
                        arr[idx] = value;
                        return;
                    }
                }
                _ => return,
            }
        } else {
            // Intermediate segment — ensure container exists
            let next_is_index = segments
                .get(i + 1)
                .is_some_and(|s| s.parse::<usize>().is_ok());
            match current {
                Value::Object(map) => {
                    if !map.contains_key(seg.as_str()) {
                        if next_is_index {
                            map.insert(seg.clone(), Value::Array(vec![]));
                        } else {
                            map.insert(seg.clone(), Value::Object(serde_json::Map::new()));
                        }
                    }
                    current = map.get_mut(seg.as_str()).unwrap();
                }
                Value::Array(arr) => {
                    if let Ok(idx) = seg.parse::<usize>() {
                        while arr.len() <= idx {
                            arr.push(Value::Null);
                        }
                        if arr[idx].is_null() {
                            if next_is_index {
                                arr[idx] = Value::Array(vec![]);
                            } else {
                                arr[idx] = Value::Object(serde_json::Map::new());
                            }
                        }
                        current = &mut arr[idx];
                    } else {
                        return;
                    }
                }
                _ => return,
            }
        }
    }
}
