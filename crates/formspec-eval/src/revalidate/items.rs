//! Bind-level validation: required, type, constraint, cardinality, extension constraints.
#![allow(clippy::missing_docs_in_private_items)]

use std::collections::HashMap;

use chrono::NaiveDate;
use fancy_regex::Regex;
use formspec_core::registry_client::version_satisfies;
use serde_json::Value;
use url::Url;

use fel_core::{FormspecEnvironment, evaluate, parse};

use crate::convert::resolve_value_by_path;
use crate::fel_json::json_to_runtime_fel;
use crate::rebuild::detect_repeat_count;
use crate::types::{
    ExtensionConstraint, ItemInfo, ValidationResult, resolve_qualified_repeat_refs,
};

use crate::value_predicate::{is_empty_for_required_bind, value_skips_optional_bind_checks};

use super::env::{bind_sibling_aliases, restore_sibling_aliases};
use super::expr::constraint_passes;

pub(super) fn validate_items(
    items: &[ItemInfo],
    env: &mut FormspecEnvironment,
    values: &HashMap<String, Value>,
    ext_by_name: &HashMap<&str, &ExtensionConstraint>,
    formspec_version: &str,
    repeat_counts: Option<&HashMap<String, u64>>,
    results: &mut Vec<ValidationResult>,
) {
    for item in items {
        // Skip non-relevant items (validation suppressed per S5.6)
        if !item.relevant {
            continue;
        }

        // 9d: resolve value by walking nested objects for dotted paths
        let val = resolve_value_by_path(values, &item.path);

        // Required check
        if item.required && is_empty_for_required_bind(&val) {
            results.push(ValidationResult {
                path: item.path.clone(),
                severity: "error".to_string(),
                constraint_kind: "required".to_string(),
                code: "REQUIRED".to_string(),
                message: "Required".to_string(),
                constraint: None,
                source: "bind".to_string(),
                shape_id: None,
                context: None,
            });
        }

        // Type mismatch check — covers all 13 spec dataTypes
        if !val.is_null() && let Some(ref dt) = item.data_type {
            let mismatch = match dt.as_str() {
                // String-family: must be a JSON string
                "string" | "text" => !val.is_string(),
                "choice" => {
                    !val.as_str().map_or(false, |s| {
                        item.option_values.is_empty() || item.option_values.iter().any(|o| o == s)
                    })
                }

                // Numeric: integer must be whole, decimal any number
                "integer" => {
                    !(val.is_i64()
                        || val.is_u64()
                        || val.is_f64() && {
                            let f = val.as_f64().unwrap();
                            f.fract() == 0.0
                        })
                }
                "number" | "decimal" => !val.is_number(),

                "boolean" => !val.is_boolean(),

                // Date: string in YYYY-MM-DD format with valid ranges
                "date" => !val.as_str().map_or(false, is_valid_date),

                // DateTime: string in ISO 8601 date-time format
                "dateTime" => !val.as_str().map_or(false, is_valid_datetime),

                // Time: string in HH:MM:SS format
                "time" => !val.as_str().map_or(false, is_valid_time),

                // URI: string with a scheme component
                "uri" => !val.as_str().map_or(false, is_valid_uri),

                // multiChoice: array where every element is a string (and in options if defined)
                "multiChoice" => {
                    !val.as_array().map_or(false, |arr| {
                        arr.iter().all(|v| {
                            v.as_str().map_or(false, |s| {
                                item.option_values.is_empty()
                                    || item.option_values.iter().any(|o| o == s)
                            })
                        })
                    })
                }

                // money: object with amount (string or number) + currency (string, 3 uppercase letters)
                // Spec requires string amounts in responses, but we accept numeric for Postel's Law.
                "money" => {
                    !val.as_object().map_or(false, |obj| {
                        let amount_ok = obj.get("amount").map_or(false, |a| {
                            // Accept string decimal
                            a.as_str().map_or(false, |s| {
                                !s.is_empty()
                                    && s.bytes()
                                        .all(|b| b.is_ascii_digit() || b == b'.' || b == b'-')
                                    && s.parse::<f64>().is_ok()
                            })
                            // Also accept numeric (Postel's Law — inbound values may use numbers)
                            || a.is_number()
                        });
                        let currency_ok = obj
                            .get("currency")
                            .and_then(Value::as_str)
                            .map_or(false, |s| {
                                s.len() == 3 && s.bytes().all(|b| b.is_ascii_uppercase())
                            });
                        amount_ok && currency_ok
                    })
                }

                // attachment: object with contentType (string).
                // url/data completeness is a submission-level check, not a type check.
                // If the item declares accepted MIME types, contentType must match one.
                "attachment" => {
                    !val.as_object().map_or(false, |obj| {
                        let ct = obj.get("contentType").and_then(Value::as_str);
                        ct.map_or(false, |s| {
                            if item.accept_types.is_empty() {
                                !s.is_empty()
                            } else {
                                item.accept_types.iter().any(|accepted| {
                                    // Support wildcard like "image/*"
                                    if let Some(prefix) = accepted.strip_suffix("/*") {
                                        s.starts_with(prefix)
                                            && s.as_bytes().get(prefix.len()) == Some(&b'/')
                                    } else {
                                        s == accepted
                                    }
                                })
                            }
                        })
                    })
                }

                _ => false,
            };
            if mismatch {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "type".to_string(),
                    code: "TYPE_MISMATCH".to_string(),
                    message: format!("Invalid {dt}"),
                    constraint: None,
                    source: "bind".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
        }

        // Constraint check — skip for empty values (§3.8.1).
        // "A constraint that cannot be evaluated due to null inputs is not considered
        // violated."  The `required` bind, not `constraint`, enforces non-emptiness.
        if !value_skips_optional_bind_checks(&val)
            && let Some(ref expr) = item.constraint
        {
            let normalized_expr = resolve_qualified_repeat_refs(expr, &item.path);
            let saved_aliases = bind_sibling_aliases(env, values, &item.path);
            // Temporarily bind bare $ to this field's value
            let prev_dollar = env.data.remove("");
            env.data.insert(String::new(), json_to_runtime_fel(&val));

            match parse(&normalized_expr) {
                Ok(parsed) => {
                    let result = evaluate(&parsed, env);
                    if !constraint_passes(&result) {
                        results.push(ValidationResult {
                            path: item.path.clone(),
                            severity: "error".to_string(),
                            constraint_kind: "constraint".to_string(),
                            code: "CONSTRAINT_FAILED".to_string(),
                            message: item
                                .constraint_message
                                .clone()
                                .unwrap_or_else(|| format!("Constraint failed: {expr}")),
                            constraint: Some(expr.clone()),
                            source: "bind".to_string(),
                            shape_id: None,
                            context: None,
                        });
                    }
                }
                Err(e) => {
                    // A constraint that cannot parse must not silently pass.
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "constraint".to_string(),
                        code: "CONSTRAINT_PARSE_ERROR".to_string(),
                        message: item
                            .constraint_message
                            .clone()
                            .unwrap_or_else(|| format!("Constraint expression error: {e}")),
                        constraint: Some(expr.clone()),
                        source: "bind".to_string(),
                        shape_id: None,
                        context: None,
                    });
                }
            }

            // Restore previous bare $ binding
            env.data.remove("");
            if let Some(prev) = prev_dollar {
                env.data.insert(String::new(), prev);
            }
            restore_sibling_aliases(env, saved_aliases);
        }

        // Extension constraint enforcement
        validate_extension_constraints(item, &val, ext_by_name, formspec_version, results);

        // Cardinality check for repeatable groups
        if item.repeatable {
            let count = repeat_counts
                .and_then(|m| m.get(&item.path).copied())
                .map(|n| n as usize)
                .unwrap_or_else(|| detect_repeat_count(&item.path, values));
            if let Some(min) = item.repeat_min
                && (count as u64) < min
            {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "cardinality".to_string(),
                    code: "MIN_REPEAT".to_string(),
                    message: format!("Minimum {min} entries required"),
                    constraint: None,
                    source: "bind".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
            if let Some(max) = item.repeat_max
                && (count as u64) > max
            {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "error".to_string(),
                    constraint_kind: "cardinality".to_string(),
                    code: "MAX_REPEAT".to_string(),
                    message: format!("Maximum {max} entries allowed"),
                    constraint: None,
                    source: "bind".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
        }

        validate_items(
            &item.children,
            env,
            values,
            ext_by_name,
            formspec_version,
            repeat_counts,
            results,
        );
    }
}

// ── Format validators for date/time/uri types ─────────────────────

/// YYYY-MM-DD — parsed and validated by chrono.
fn is_valid_date(s: &str) -> bool {
    // Require exactly YYYY-MM-DD format (10 chars) to reject looser chrono parses.
    s.len() == 10 && NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
}

/// ISO 8601 date-time — must have T separator, valid date, valid time, optional timezone.
fn is_valid_datetime(s: &str) -> bool {
    // Try RFC 3339 (strict ISO 8601 profile with timezone)
    if chrono::DateTime::parse_from_rfc3339(s).is_ok() {
        return true;
    }
    // Also accept without timezone: YYYY-MM-DDThh:mm:ss
    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").is_ok()
}

/// HH:MM or HH:MM:SS with valid ranges — parsed by chrono.
fn is_valid_time(s: &str) -> bool {
    (s.len() == 5 && chrono::NaiveTime::parse_from_str(s, "%H:%M").is_ok())
        || (s.len() == 8 && chrono::NaiveTime::parse_from_str(s, "%H:%M:%S").is_ok())
}

/// RFC 3986 URI — parsed by the `url` crate.
fn is_valid_uri(s: &str) -> bool {
    !s.is_empty() && Url::parse(s).is_ok()
}

/// Check extension constraints (pattern, maxLength, min/max, status, compatibility) for a field.
fn validate_extension_constraints(
    item: &ItemInfo,
    val: &Value,
    ext_by_name: &HashMap<&str, &ExtensionConstraint>,
    formspec_version: &str,
    results: &mut Vec<ValidationResult>,
) {
    for ext_name in &item.extensions {
        let Some(constraint) = ext_by_name.get(ext_name.as_str()) else {
            // Extension not found in any loaded registry
            results.push(ValidationResult {
                path: item.path.clone(),
                severity: "error".to_string(),
                constraint_kind: "extension".to_string(),
                code: "UNRESOLVED_EXTENSION".to_string(),
                message: format!(
                    "Unresolved extension '{ext_name}': no matching registry entry loaded"
                ),
                constraint: None,
                source: "extension".to_string(),
                shape_id: None,
                context: None,
            });
            continue;
        };

        // Status enforcement (§7.4)
        match constraint.status.as_str() {
            "retired" => {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "warning".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_RETIRED".to_string(),
                    message: format!("Extension '{ext_name}' is retired"),
                    constraint: None,
                    source: "extension".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
            "deprecated" => {
                let message = match &constraint.deprecation_notice {
                    Some(notice) => notice.clone(),
                    None => format!("Extension '{ext_name}' is deprecated"),
                };
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "info".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_DEPRECATED".to_string(),
                    message,
                    constraint: None,
                    source: "extension".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
            _ => {} // stable, draft — no status warnings
        }

        // Compatibility check (§7.3)
        if let Some(ref compat_range) = constraint.compatibility_version {
            if !version_satisfies(formspec_version, compat_range) {
                results.push(ValidationResult {
                    path: item.path.clone(),
                    severity: "warning".to_string(),
                    constraint_kind: "extension".to_string(),
                    code: "EXTENSION_COMPATIBILITY_MISMATCH".to_string(),
                    message: format!(
                        "Extension '{ext_name}' requires formspec version {compat_range}"
                    ),
                    constraint: None,
                    source: "extension".to_string(),
                    shape_id: None,
                    context: None,
                });
            }
        }

        // Skip value constraints if the value is null/empty (§3.8.1)
        if value_skips_optional_bind_checks(val) {
            continue;
        }

        let label = constraint
            .display_name
            .as_deref()
            .unwrap_or(ext_name.as_str());

        // Pattern constraint (string values only)
        if let Some(ref pattern) = constraint.pattern {
            if let Some(s) = val.as_str() {
                if let Ok(re) = Regex::new(pattern) {
                    if !re.is_match(s).unwrap_or(false) {
                        results.push(ValidationResult {
                            path: item.path.clone(),
                            severity: "error".to_string(),
                            constraint_kind: "extension".to_string(),
                            code: "PATTERN_MISMATCH".to_string(),
                            message: format!("Must be a valid {label}"),
                            constraint: None,
                            source: "extension".to_string(),
                            shape_id: None,
                            context: None,
                        });
                    }
                }
            }
        }

        // MaxLength constraint (string values only)
        if let Some(max_len) = constraint.max_length {
            if let Some(s) = val.as_str() {
                if s.len() as u64 > max_len {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "MAX_LENGTH_EXCEEDED".to_string(),
                        message: format!("{label} must be at most {max_len} characters"),
                        constraint: None,
                        source: "extension".to_string(),
                        shape_id: None,
                        context: None,
                    });
                }
            }
        }

        // Minimum constraint (numeric values)
        if let Some(min) = constraint.minimum {
            if let Some(n) = val.as_f64() {
                if n < min {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "RANGE_UNDERFLOW".to_string(),
                        message: format!("{label} must be at least {min}"),
                        constraint: None,
                        source: "extension".to_string(),
                        shape_id: None,
                        context: None,
                    });
                }
            }
        }

        // Maximum constraint (numeric values)
        if let Some(max) = constraint.maximum {
            if let Some(n) = val.as_f64() {
                if n > max {
                    results.push(ValidationResult {
                        path: item.path.clone(),
                        severity: "error".to_string(),
                        constraint_kind: "extension".to_string(),
                        code: "RANGE_OVERFLOW".to_string(),
                        message: format!("{label} must be at most {max}"),
                        constraint: None,
                        source: "extension".to_string(),
                        shape_id: None,
                        context: None,
                    });
                }
            }
        }
    }
}
