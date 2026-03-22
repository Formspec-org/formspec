//! Calculated-field JSON coercion (precision, money wrapping). See [`crate::fel_json`] for JSON→FEL normalization.

use serde_json::Value;

pub(crate) use crate::fel_json::json_to_runtime_fel;

use crate::types::ItemInfo;

pub(crate) fn coerce_calculated_json(item: &ItemInfo, mut json_val: Value) -> Value {
    if let Some(precision) = item.precision
        && let Some(number) = json_val.as_f64()
        && number.is_finite()
    {
        let factor = 10_f64.powi(precision as i32);
        json_val = serde_json::json!((number * factor).round() / factor);
    }

    if item.data_type.as_deref() == Some("money")
        && let Some(number) = json_val.as_f64()
    {
        json_val = serde_json::json!({
            "amount": number,
            "currency": item.currency.clone().unwrap_or_default(),
        });
    }

    json_val
}
