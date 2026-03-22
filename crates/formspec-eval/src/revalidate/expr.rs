//! FEL expression evaluation for validation (shape and bind constraint truthiness).

use fel_core::{FelValue, FormspecEnvironment, evaluate, parse};

pub(super) fn constraint_passes(value: &FelValue) -> bool {
    value.is_null() || value.is_truthy()
}

pub(super) fn evaluate_shape_expression(expr: &str, env: &FormspecEnvironment) -> FelValue {
    match parse(expr) {
        Ok(parsed) => evaluate(&parsed, env).value,
        Err(_) => FelValue::Null,
    }
}
