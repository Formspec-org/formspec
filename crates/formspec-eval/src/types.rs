//! Core types for the Formspec evaluator.

use serde_json::Value;
use std::collections::HashMap;

// ── Item tree ───────────────────────────────────────────────────

/// A node in the evaluation item tree.
#[derive(Debug, Clone)]
pub struct ItemInfo {
    /// Item key (leaf name, not full path).
    pub key: String,
    /// Full dotted path from root (e.g. "address.city").
    pub path: String,
    /// Data type (string, number, boolean, date, etc.).
    pub data_type: Option<String>,
    /// Current value.
    pub value: Value,
    /// Whether the item is relevant (visible).
    pub relevant: bool,
    /// Whether the item is required.
    pub required: bool,
    /// Whether the item is readonly.
    pub readonly: bool,
    /// Calculated expression (if any).
    pub calculate: Option<String>,
    /// Constraint expression (if any).
    pub constraint: Option<String>,
    /// Author-provided constraint failure message (if any).
    pub constraint_message: Option<String>,
    /// Relevance expression (if any).
    pub relevance: Option<String>,
    /// Required expression (if any).
    pub required_expr: Option<String>,
    /// Readonly expression (if any).
    pub readonly_expr: Option<String>,
    /// Whitespace normalization mode (if any).
    pub whitespace: Option<String>,
    /// Non-relevant behavior override for this bind.
    pub nrb: Option<String>,
    /// Excluded value behavior when non-relevant ("null" or "keep").
    pub excluded_value: Option<String>,
    /// Default value to apply on non-relevant → relevant transition when field is empty.
    pub default_value: Option<Value>,
    /// Initial value for field seeding (literal or "=expr").
    pub initial_value: Option<Value>,
    /// Previous relevance state (for tracking transitions).
    pub prev_relevant: bool,
    /// Parent path (None for top-level items).
    pub parent_path: Option<String>,
    /// Whether this group is repeatable.
    pub repeatable: bool,
    /// Minimum repeat count (for repeatable groups).
    pub repeat_min: Option<u64>,
    /// Maximum repeat count (for repeatable groups).
    pub repeat_max: Option<u64>,
    /// Extension names declared on this item (only enabled ones, value=true).
    pub extensions: Vec<String>,
    /// Pre-populate instance name (e.g. "userProfile").
    pub pre_populate_instance: Option<String>,
    /// Pre-populate path within the instance (e.g. "contactEmail").
    pub pre_populate_path: Option<String>,
    /// Child items.
    pub children: Vec<ItemInfo>,
}

/// A definition variable with optional scope.
#[derive(Debug, Clone)]
pub struct VariableDef {
    pub name: String,
    pub expression: String,
    pub scope: Option<String>,
}

/// Validation result for a single field.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidationResult {
    /// Path to the field.
    pub path: String,
    /// Severity: error, warning, info.
    pub severity: String,
    /// Constraint kind: required, constraint, type, cardinality, shape.
    pub constraint_kind: String,
    /// Validation code: REQUIRED, CONSTRAINT_FAILED, TYPE_MISMATCH, etc.
    pub code: String,
    /// Human-readable message.
    pub message: String,
    /// Original constraint expression when available.
    pub constraint: Option<String>,
    /// Source of the validation: bind, shape, definition.
    pub source: String,
    /// Shape ID (for shape validations only).
    pub shape_id: Option<String>,
    /// Evaluated shape failure context values.
    pub context: Option<HashMap<String, Value>>,
}

/// When to evaluate shape rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EvalTrigger {
    /// Evaluate only shapes with timing "continuous" (or no timing).
    Continuous,
    /// Evaluate shapes with timing "continuous" or "submit" (skip "demand").
    Submit,
    /// Evaluate only shapes with timing "demand".
    Demand,
    /// Skip all shape evaluation.
    Disabled,
}

/// Optional runtime context injected into a single evaluation cycle.
#[derive(Debug, Clone, Default)]
pub struct EvalContext {
    pub now_iso: Option<String>,
    pub previous_validations: Option<Vec<ValidationResult>>,
}

/// Pre-parsed extension constraint data from a registry entry.
/// Passed into the evaluator from the PyO3 layer — no registry parsing here.
#[derive(Debug, Clone)]
pub struct ExtensionConstraint {
    /// Extension name (e.g. "x-formspec-email").
    pub name: String,
    /// Display name for human-readable messages (e.g. "Email address").
    pub display_name: Option<String>,
    /// Regex pattern constraint (anchored).
    pub pattern: Option<String>,
    /// Maximum string length.
    pub max_length: Option<u64>,
    /// Minimum numeric value.
    pub minimum: Option<f64>,
    /// Maximum numeric value.
    pub maximum: Option<f64>,
    /// Base data type this extension expects (e.g. "string", "decimal").
    pub base_type: Option<String>,
    /// Lifecycle status: "stable", "deprecated", "retired", "draft".
    pub status: String,
    /// Deprecation notice text (when status is "deprecated").
    pub deprecation_notice: Option<String>,
    /// Formspec version compatibility range (e.g. ">=1.0.0 <2.0.0").
    pub compatibility_version: Option<String>,
}

/// NRB (Non-Relevant Behavior) mode.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum NrbMode {
    /// Remove the field from output data.
    Remove,
    /// Set the field to null.
    Empty,
    /// Leave the field value unchanged.
    Keep,
}

impl NrbMode {
    pub(crate) fn from_str_lossy(s: &str) -> Self {
        match s {
            "empty" => NrbMode::Empty,
            "keep" => NrbMode::Keep,
            _ => NrbMode::Remove,
        }
    }
}

/// Whitespace normalization mode.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WhitespaceMode {
    Trim,
    Normalize,
    Remove,
    Preserve,
}

impl WhitespaceMode {
    pub(crate) fn from_str_lossy(s: &str) -> Self {
        match s {
            "trim" => WhitespaceMode::Trim,
            "normalize" => WhitespaceMode::Normalize,
            "remove" => WhitespaceMode::Remove,
            _ => WhitespaceMode::Preserve,
        }
    }

    pub(crate) fn apply(self, s: &str) -> String {
        match self {
            WhitespaceMode::Trim => s.trim().to_string(),
            WhitespaceMode::Normalize => s.split_whitespace().collect::<Vec<_>>().join(" "),
            WhitespaceMode::Remove => s.chars().filter(|c| !c.is_whitespace()).collect(),
            WhitespaceMode::Preserve => s.to_string(),
        }
    }
}

/// Result of the full evaluation cycle.
#[derive(Debug, Clone)]
pub struct EvaluationResult {
    /// All field values after recalculation (post-NRB).
    pub values: HashMap<String, Value>,
    /// Validation results.
    pub validations: Vec<ValidationResult>,
    /// Fields marked non-relevant.
    pub non_relevant: Vec<String>,
    /// Evaluated variable values.
    pub variables: HashMap<String, Value>,
    /// Required state by path.
    pub required: HashMap<String, bool>,
    /// Readonly state by path.
    pub readonly: HashMap<String, bool>,
}

// ── Path helpers ────────────────────────────────────────────────

pub(crate) fn find_item_by_path<'a>(items: &'a [ItemInfo], path: &str) -> Option<&'a ItemInfo> {
    for item in items {
        if item.path == path {
            return Some(item);
        }
        if let Some(found) = find_item_by_path(&item.children, path) {
            return Some(found);
        }
    }
    None
}

pub(crate) fn find_item_by_path_mut<'a>(
    items: &'a mut [ItemInfo],
    path: &str,
) -> Option<&'a mut ItemInfo> {
    for item in items.iter_mut() {
        if item.path == path {
            return Some(item);
        }
        if let Some(found) = find_item_by_path_mut(&mut item.children, path) {
            return Some(found);
        }
    }
    None
}

pub(crate) fn strip_indices(path: &str) -> String {
    let mut result = String::new();
    let mut chars = path.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '[' {
            for inner in chars.by_ref() {
                if inner == ']' {
                    break;
                }
            }
        } else {
            result.push(ch);
        }
    }

    result
}

pub(crate) fn to_wildcard_path(path: &str) -> String {
    let mut result = String::new();
    let mut chars = path.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '[' {
            let mut segment = String::new();
            let mut closed = false;

            for inner in chars.by_ref() {
                if inner == ']' {
                    closed = true;
                    break;
                }
                segment.push(inner);
            }

            result.push('[');
            if closed && !segment.is_empty() && segment.chars().all(|inner| inner.is_ascii_digit()) {
                result.push('*');
            } else {
                result.push_str(&segment);
            }
            if closed {
                result.push(']');
            }
        } else {
            result.push(ch);
        }
    }

    result
}

pub(crate) fn parent_path(path: &str) -> Option<String> {
    path.rfind('.').map(|pos| path[..pos].to_string())
}

pub(crate) fn collect_non_relevant(items: &[ItemInfo], out: &mut Vec<String>) {
    for item in items {
        if !item.relevant {
            out.push(item.path.clone());
        }
        collect_non_relevant(&item.children, out);
    }
}

pub(crate) fn collect_mip_state(
    items: &[ItemInfo],
    required: &mut HashMap<String, bool>,
    readonly: &mut HashMap<String, bool>,
) {
    for item in items {
        required.insert(item.path.clone(), item.required);
        readonly.insert(item.path.clone(), item.readonly);
        collect_mip_state(&item.children, required, readonly);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_indices() {
        assert_eq!(strip_indices("items[0].total"), "items.total");
        assert_eq!(strip_indices("a[1].b[2].c"), "a.b.c");
        assert_eq!(strip_indices("simple"), "simple");
        assert_eq!(strip_indices("naïve[0].café"), "naïve.café");
    }

    #[test]
    fn test_to_wildcard_path() {
        assert_eq!(to_wildcard_path("items[0].total"), "items[*].total");
        assert_eq!(to_wildcard_path("a[1].b[2].c"), "a[*].b[*].c");
        assert_eq!(to_wildcard_path("items[*].total"), "items[*].total");
        assert_eq!(to_wildcard_path("naïve[12].café"), "naïve[*].café");
    }

    #[test]
    fn test_whitespace_mode_apply() {
        assert_eq!(WhitespaceMode::Trim.apply("  hello  "), "hello");
        assert_eq!(
            WhitespaceMode::Normalize.apply("  hello   world  "),
            "hello world"
        );
        assert_eq!(WhitespaceMode::Remove.apply("a b c"), "abc");
        assert_eq!(WhitespaceMode::Preserve.apply("  hi  "), "  hi  ");
    }

    #[test]
    fn test_nrb_mode_from_str() {
        assert_eq!(NrbMode::from_str_lossy("remove"), NrbMode::Remove);
        assert_eq!(NrbMode::from_str_lossy("empty"), NrbMode::Empty);
        assert_eq!(NrbMode::from_str_lossy("keep"), NrbMode::Keep);
        assert_eq!(NrbMode::from_str_lossy("unknown"), NrbMode::Remove);
    }

    // ── Finding 43: Unicode whitespace ───────────────────────────

    #[test]
    fn whitespace_trim_handles_unicode_whitespace() {
        let input = "\u{00A0}hello\u{2003}";
        let result = WhitespaceMode::Trim.apply(input);
        assert_eq!(
            result, "hello",
            "trim strips Unicode whitespace (NBSP, em space)"
        );
    }

    #[test]
    fn whitespace_normalize_collapses_unicode() {
        let input = "hello\u{00A0}\u{2003}world";
        let result = WhitespaceMode::Normalize.apply(input);
        assert_eq!(
            result, "hello world",
            "normalize collapses Unicode whitespace to single ASCII space"
        );
    }

    #[test]
    fn whitespace_remove_strips_unicode() {
        let input = "a\u{00A0}b\u{2003}c";
        let result = WhitespaceMode::Remove.apply(input);
        assert_eq!(result, "abc", "remove strips Unicode whitespace characters");
    }
}
