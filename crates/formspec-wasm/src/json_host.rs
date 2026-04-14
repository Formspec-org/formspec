//! Shared JSON parse/stringify helpers for wasm_bindgen surfaces.

use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

/// Parse JSON text into a [`Value`]. `label` is the phrase after `invalid ` in error messages.
pub fn parse_value_str(s: &str, label: &str) -> Result<Value, String> {
    serde_json::from_str(s).map_err(|e| format!("invalid {label}: {e}"))
}

/// Deserialize JSON text into `T` with the same `invalid {label}:` error prefix.
pub fn parse_json_as<T: DeserializeOwned>(s: &str, label: &str) -> Result<T, String> {
    serde_json::from_str(s).map_err(|e| format!("invalid {label}: {e}"))
}

/// Serialize a value to a JSON string for host output.
pub fn to_json_string<T: Serialize + ?Sized>(value: &T) -> Result<String, String> {
    serde_json::to_string(value).map_err(|e| e.to_string())
}
