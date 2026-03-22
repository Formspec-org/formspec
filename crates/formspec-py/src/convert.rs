//! Python ↔ FEL / JSON conversion helpers for the PyO3 `formspec_rust` module.

use std::collections::HashMap;

use pyo3::prelude::*;
use pyo3::types::{PyBool, PyDict, PyList};
use pythonize::depythonize;
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use serde::de::DeserializeOwned;
use serde_json::Value;

use fel_core::{FelValue, FormspecEnvironment, MipState};
use formspec_core::extension_analysis::RegistryEntryStatus;
use formspec_core::registry_client;

use crate::PyObject;

pub(crate) use formspec_core::json_object_to_string_map;

/// Deserialize a Python object into `T` (typically `serde_json::Value`), mapping errors to `PyValueError`.
pub(crate) fn depythonize_json<T: DeserializeOwned>(obj: &Bound<'_, PyAny>) -> PyResult<T> {
    depythonize(obj).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))
}

/// Parse a FEL source string into an AST; maps [`fel_core::FelError`] to `PyValueError`.
pub(crate) fn parse_fel_expr(source: &str) -> PyResult<fel_core::Expr> {
    fel_core::parse(source).map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))
}

fn merge_fel_dict_into_env(
    py: Python,
    env: &mut FormspecEnvironment,
    dict: &Bound<'_, PyDict>,
    mut apply: impl FnMut(&mut FormspecEnvironment, &str, FelValue),
) -> PyResult<()> {
    for (key, value) in dict.iter() {
        let k: String = key.extract()?;
        apply(env, &k, python_to_fel(py, &value)?);
    }
    Ok(())
}

pub(crate) fn pydict_to_field_map(
    py: Python,
    dict: &Bound<'_, PyDict>,
) -> PyResult<HashMap<String, FelValue>> {
    let mut map = HashMap::new();
    for (key, value) in dict.iter() {
        let k: String = key.extract()?;
        let v = python_to_fel(py, &value)?;
        map.insert(k, v);
    }
    Ok(map)
}

pub(crate) fn build_formspec_env(
    py: Python,
    fields: Option<&Bound<'_, PyDict>>,
    instances: Option<&Bound<'_, PyDict>>,
    mip_states: Option<&Bound<'_, PyDict>>,
    variables: Option<&Bound<'_, PyDict>>,
    now_iso: Option<&str>,
) -> PyResult<FormspecEnvironment> {
    let mut env = FormspecEnvironment::new();

    if let Some(dict) = fields {
        merge_fel_dict_into_env(py, &mut env, dict, |e, k, v| e.set_field(k, v))?;
    }

    if let Some(dict) = instances {
        merge_fel_dict_into_env(py, &mut env, dict, |e, k, v| e.set_instance(k, v))?;
    }

    if let Some(dict) = mip_states {
        for (key, value) in dict.iter() {
            let k: String = key.extract()?;
            env.set_mip(&k, pyany_to_mip_state(&value)?);
        }
    }

    if let Some(dict) = variables {
        merge_fel_dict_into_env(py, &mut env, dict, |e, k, v| e.set_variable(k, v))?;
    }

    if let Some(now) = now_iso {
        env.set_now_from_iso(now);
    }

    Ok(env)
}

pub(crate) fn pyany_to_mip_state(obj: &Bound<'_, PyAny>) -> PyResult<MipState> {
    if let Ok(dict) = obj.cast::<PyDict>() {
        return Ok(MipState {
            valid: dict
                .get_item("valid")?
                .and_then(|value| value.extract::<bool>().ok())
                .unwrap_or(true),
            relevant: dict
                .get_item("relevant")?
                .and_then(|value| value.extract::<bool>().ok())
                .unwrap_or(true),
            readonly: dict
                .get_item("readonly")?
                .and_then(|value| value.extract::<bool>().ok())
                .unwrap_or(false),
            required: dict
                .get_item("required")?
                .and_then(|value| value.extract::<bool>().ok())
                .unwrap_or(false),
        });
    }

    Ok(MipState::default())
}

#[allow(clippy::only_used_in_recursion)]
pub(crate) fn python_to_fel(py: Python, obj: &Bound<'_, PyAny>) -> PyResult<FelValue> {
    if obj.is_none() {
        return Ok(FelValue::Null);
    }
    if let Ok(b) = obj.extract::<bool>() {
        return Ok(FelValue::Boolean(b));
    }
    if let Ok(i) = obj.extract::<i64>() {
        return Ok(FelValue::Number(Decimal::from(i)));
    }
    if let Ok(f) = obj.extract::<f64>() {
        return Ok(match Decimal::from_f64(f) {
            Some(d) => FelValue::Number(d),
            None => FelValue::Null, // NaN, Infinity → Null, not zero
        });
    }
    if let Ok(s) = obj.extract::<String>() {
        return Ok(FelValue::String(s));
    }
    if let Ok(list) = obj.cast::<PyList>() {
        let mut arr = Vec::new();
        for item in list.iter() {
            arr.push(python_to_fel(py, &item)?);
        }
        return Ok(FelValue::Array(arr));
    }
    if let Ok(dict) = obj.cast::<PyDict>() {
        let tagged_type = dict
            .get_item("__fel_type__")?
            .and_then(|value| value.extract::<String>().ok());
        if let Some(tagged_type) = tagged_type.as_deref() {
            match tagged_type {
                "number" => {
                    if let Some(raw) = dict.get_item("value")?
                        && let Ok(text) = raw.extract::<String>()
                    {
                        return Ok(match Decimal::from_str_exact(&text) {
                            Ok(d) => FelValue::Number(d),
                            Err(_) => FelValue::Null,
                        });
                    }
                }
                "date" | "datetime" => {
                    if let Some(raw) = dict.get_item("value")?
                        && let Ok(text) = raw.extract::<String>()
                    {
                        if let Some(date) = fel_core::parse_datetime_literal(&format!("@{text}")) {
                            return Ok(FelValue::Date(date));
                        }
                        if let Some(date) = fel_core::parse_date_literal(&format!("@{text}")) {
                            return Ok(FelValue::Date(date));
                        }
                    }
                }
                "money" => {
                    let amount_str = dict
                        .get_item("amount")?
                        .and_then(|value| value.extract::<String>().ok())
                        .unwrap_or_else(|| "0".to_string());
                    let currency = dict
                        .get_item("currency")?
                        .and_then(|value| value.extract::<String>().ok())
                        .unwrap_or_default();
                    return Ok(match Decimal::from_str_exact(&amount_str) {
                        Ok(d) => FelValue::Money(fel_core::FelMoney {
                            amount: d,
                            currency,
                        }),
                        Err(_) => FelValue::Null,
                    });
                }
                _ => {}
            }
        }

        let currency = dict
            .get_item("currency")?
            .and_then(|value| value.extract::<String>().ok());
        if let Some(currency) = currency
            && let Some(amount_obj) = dict.get_item("amount")?
        {
            // Try numeric extraction first (int → Decimal, float → Decimal)
            let maybe_decimal = if let Ok(i) = amount_obj.extract::<i64>() {
                Some(Decimal::from(i))
            } else if let Ok(f) = amount_obj.extract::<f64>() {
                Decimal::from_f64(f)
            } else if let Ok(s) = amount_obj.extract::<String>() {
                Decimal::from_str_exact(&s).ok()
            } else {
                None
            };
            if let Some(amount) = maybe_decimal {
                return Ok(FelValue::Money(fel_core::FelMoney { amount, currency }));
            }
        }

        let mut entries = Vec::new();
        for (k, v) in dict.iter() {
            let key: String = k.extract()?;
            let val = python_to_fel(py, &v)?;
            entries.push((key, val));
        }
        return Ok(FelValue::Object(entries));
    }
    Ok(FelValue::Null)
}

pub(crate) fn fel_to_python(py: Python, val: &FelValue) -> PyResult<PyObject> {
    match val {
        FelValue::Null => Ok(py.None()),
        FelValue::Boolean(b) => Ok(PyBool::new(py, *b).to_owned().into_any().unbind()),
        FelValue::Number(n) => {
            if n.fract().is_zero()
                && let Some(i) = n.to_i64()
            {
                return Ok(i.into_pyobject(py)?.into_any().unbind());
            }
            if let Some(f) = n.to_f64() {
                Ok(f.into_pyobject(py)?.into_any().unbind())
            } else {
                Ok(py.None())
            }
        }
        FelValue::String(s) => Ok(s.into_pyobject(py)?.into_any().unbind()),
        FelValue::Date(d) => Ok(d.format_iso().into_pyobject(py)?.into_any().unbind()),
        FelValue::Array(arr) => {
            let list = PyList::empty(py);
            for item in arr {
                list.append(fel_to_python(py, item)?)?;
            }
            Ok(list.into())
        }
        FelValue::Object(entries) => {
            let dict = PyDict::new(py);
            for (k, v) in entries {
                dict.set_item(k, fel_to_python(py, v)?)?;
            }
            Ok(dict.into())
        }
        FelValue::Money(m) => {
            let dict = PyDict::new(py);
            dict.set_item("amount", fel_to_python(py, &FelValue::Number(m.amount))?)?;
            dict.set_item("currency", &m.currency)?;
            Ok(dict.into())
        }
    }
}

pub(crate) fn fel_to_python_tagged(py: Python, val: &FelValue) -> PyResult<PyObject> {
    match val {
        FelValue::Null => Ok(py.None()),
        FelValue::Boolean(b) => Ok(PyBool::new(py, *b).to_owned().into_any().unbind()),
        FelValue::Number(n) => {
            let dict = PyDict::new(py);
            dict.set_item("__fel_type__", "number")?;
            dict.set_item("value", n.to_string())?;
            Ok(dict.into())
        }
        FelValue::String(s) => Ok(s.into_pyobject(py)?.into_any().unbind()),
        FelValue::Date(d) => {
            let dict = PyDict::new(py);
            dict.set_item(
                "__fel_type__",
                match d {
                    fel_core::FelDate::Date { .. } => "date",
                    fel_core::FelDate::DateTime { .. } => "datetime",
                },
            )?;
            dict.set_item("value", d.format_iso())?;
            Ok(dict.into())
        }
        FelValue::Array(arr) => {
            let list = PyList::empty(py);
            for item in arr {
                list.append(fel_to_python_tagged(py, item)?)?;
            }
            Ok(list.into())
        }
        FelValue::Object(entries) => {
            let dict = PyDict::new(py);
            for (k, v) in entries {
                dict.set_item(k, fel_to_python_tagged(py, v)?)?;
            }
            Ok(dict.into())
        }
        FelValue::Money(m) => {
            let dict = PyDict::new(py);
            dict.set_item("__fel_type__", "money")?;
            dict.set_item("amount", m.amount.to_string())?;
            dict.set_item("currency", &m.currency)?;
            Ok(dict.into())
        }
    }
}

pub(crate) fn json_to_python(py: Python, val: &Value) -> PyResult<PyObject> {
    match val {
        Value::Null => Ok(py.None()),
        Value::Bool(b) => Ok(PyBool::new(py, *b).to_owned().into_any().unbind()),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(i.into_pyobject(py)?.into_any().unbind())
            } else if let Some(f) = n.as_f64() {
                Ok(f.into_pyobject(py)?.into_any().unbind())
            } else {
                Ok(py.None())
            }
        }
        Value::String(s) => Ok(s.into_pyobject(py)?.into_any().unbind()),
        Value::Array(arr) => {
            let list = PyList::empty(py);
            for item in arr {
                list.append(json_to_python(py, item)?)?;
            }
            Ok(list.into())
        }
        Value::Object(map) => {
            let dict = PyDict::new(py);
            for (k, v) in map {
                dict.set_item(k, json_to_python(py, v)?)?;
            }
            Ok(dict.into())
        }
    }
}

// ── Registry helpers ────────────────────────────────────────────

pub(crate) fn parse_status_str(s: &str) -> Option<RegistryEntryStatus> {
    registry_client::parse_registry_entry_status(s)
}

pub(crate) fn status_str(s: RegistryEntryStatus) -> &'static str {
    registry_client::registry_entry_status_to_wire(s)
}

pub(crate) fn category_str(c: registry_client::ExtensionCategory) -> &'static str {
    registry_client::extension_category_to_wire(c)
}
