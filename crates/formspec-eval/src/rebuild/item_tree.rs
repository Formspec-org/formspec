//! Build `ItemInfo` tree from definition `items` and merge `binds` (object or array style).
//!
//! # Item `key` policy (eval vs lint)
//!
//! Runtime rebuild uses [`formspec_core::DefinitionItemKeyPolicy::CoerceNonStringKeyToEmpty`]
//! semantics via [`formspec_core::coerce_definition_item_key_segment`] and
//! [`formspec_core::definition_item_dotted_path`]: missing or non-string `key` becomes `""`, every
//! array element is turned into an [`ItemInfo`], and `children` are always walked.
//!
//! That **differs** from lint’s [`formspec_core::visit_definition_items_json`], which applies
//! [`formspec_core::DefinitionItemKeyPolicy::RequireStringKey`] and skips keyless nodes (and their
//! subtrees). We intentionally do **not** drive this module from
//! `visit_definition_items_json_with_policy` using require semantics — that would change
//! evaluation. Shared helpers only align dotted-path spelling with `formspec_core`; the recursive
//! shape stays eval-specific.
//!
//! ## Spec cross-references (`specs/*.llm.md`)
//!
//! - `specs/core/spec.llm.md` — **§3 Item**, **§4 Bind** (bind `path` / targets align with dotted
//!   item keys; schema text requires paths to resolve to definition items), **Phase 1: Rebuild**
//!   (structural re-index and dependency graph after definition changes).
//! - `specs/core/definition-spec.llm.md` — item tree + stable keys as the binding surface for
//!   behavior and data shape.
//!
//! Valid definitions satisfy Item `key` constraints in `schemas/definition.schema.json`. Coercing
//! missing or non-string keys to `""` is **defensive** so eval can still traverse malformed JSON;
//! it does not relax the normative spec for published definitions.

use formspec_core::definition_items::{coerce_definition_item_key_segment, definition_item_dotted_path};
use serde_json::Value;

use crate::types::{ItemInfo, VariableDef};

pub(super) fn bool_or_string_expr(value: &Value) -> Option<String> {
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

fn resolve_bind<'a>(binds: Option<&'a Value>, key: &str) -> Option<serde_json::Map<String, Value>> {
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
    let key = coerce_definition_item_key_segment(item).to_string();
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

    let path = definition_item_dotted_path(parent_path, &key);

    // Look up bind for this path
    let mut bind = resolve_bind(binds, &path)
        .or_else(|| resolve_bind(binds, &key))
        .unwrap_or_default();
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
        default_value: Some(&bind)
            .and_then(|b| b.get("default"))
            .and_then(|v| match v {
                Value::String(s) if s.starts_with('=') => None,
                other => Some(other.clone()),
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
