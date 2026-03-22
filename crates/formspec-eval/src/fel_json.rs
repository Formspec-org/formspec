//! Money-aware JSON normalization for FEL field/variable loading (shared across pipeline stages).

use fel_core::{FelValue, json_to_fel};
use serde_json::Value;

fn normalize_money_like_json(value: &Value) -> Value {
    match value {
        Value::Array(array) => Value::Array(array.iter().map(normalize_money_like_json).collect()),
        Value::Object(object) => {
            let mut normalized: serde_json::Map<String, Value> = object
                .iter()
                .map(|(key, value)| (key.clone(), normalize_money_like_json(value)))
                .collect();
            if !normalized.contains_key("$type")
                && normalized.contains_key("amount")
                && normalized.contains_key("currency")
            {
                normalized.insert("$type".to_string(), Value::String("money".to_string()));
            }
            Value::Object(normalized)
        }
        _ => value.clone(),
    }
}

/// Convert response JSON to `FelValue` with the same money inference as recalculation and validation.
pub(crate) fn json_to_runtime_fel(value: &Value) -> FelValue {
    json_to_fel(&normalize_money_like_json(value))
}
