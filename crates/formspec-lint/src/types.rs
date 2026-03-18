//! Shared types for the formspec lint pipeline (diagnostics, modes, results).

/// Shared types for the formspec lint pipeline.

use std::cmp::Ordering;
use std::collections::HashSet;

use serde_json::Value;

use formspec_core::DocumentType;

// ── Severity ────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LintSeverity {
    Error,
    Warning,
    Info,
}

impl LintSeverity {
    /// Numeric rank for sorting: lower = more severe.
    fn rank(self) -> u8 {
        match self {
            LintSeverity::Error => 0,
            LintSeverity::Warning => 1,
            LintSeverity::Info => 2,
        }
    }
}

impl PartialOrd for LintSeverity {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for LintSeverity {
    fn cmp(&self, other: &Self) -> Ordering {
        self.rank().cmp(&other.rank())
    }
}

// ── Lint mode ───────────────────────────────────────────────────

/// Controls which diagnostics are emitted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LintMode {
    /// Full checking — all diagnostics emitted. Used for CI/publishing.
    Runtime,
    /// Authoring mode — suppresses certain warnings that are noisy during editing
    /// (e.g., W300 incompatible dataType for optionSet).
    Authoring,
}

impl Default for LintMode {
    fn default() -> Self {
        LintMode::Runtime
    }
}

// ── Diagnostic ──────────────────────────────────────────────────

/// A lint diagnostic.
#[derive(Debug, Clone)]
pub struct LintDiagnostic {
    /// Error/warning code (e.g., "E100", "E201", "W300").
    pub code: String,
    /// Pass number (1-7).
    pub pass: u8,
    /// Severity: error, warning, info.
    pub severity: LintSeverity,
    /// JSONPath to the problematic element.
    pub path: String,
    /// Human-readable message.
    pub message: String,
}

impl LintDiagnostic {
    /// Whether this diagnostic should be suppressed in the given lint mode.
    pub fn suppressed_in(&self, mode: LintMode) -> bool {
        match mode {
            LintMode::Runtime => false,
            LintMode::Authoring => {
                // Suppress W300 (incompatible dataType) in authoring mode
                self.code == "W300"
            }
        }
    }
}

/// Sort diagnostics: pass ASC, severity (error > warning > info), path ASC.
pub fn sort_diagnostics(diags: &mut [LintDiagnostic]) {
    diags.sort_by(|a, b| {
        a.pass
            .cmp(&b.pass)
            .then(a.severity.cmp(&b.severity))
            .then(a.path.cmp(&b.path))
    });
}

// ── Lint options ────────────────────────────────────────────────

/// Options for the lint pipeline.
#[derive(Debug, Clone)]
pub struct LintOptions {
    /// Lint mode (Runtime or Authoring).
    pub mode: LintMode,
    /// Optional registry documents for extension resolution (E600).
    /// Each value should be a JSON registry document with `entries` array.
    pub registry_documents: Vec<Value>,
}

impl Default for LintOptions {
    fn default() -> Self {
        Self {
            mode: LintMode::Runtime,
            registry_documents: Vec::new(),
        }
    }
}

// ── Lint result ─────────────────────────────────────────────────

/// Result of linting.
#[derive(Debug, Clone)]
pub struct LintResult {
    /// Document type (if detected).
    pub document_type: Option<DocumentType>,
    /// All diagnostics from all passes (sorted).
    pub diagnostics: Vec<LintDiagnostic>,
    /// Whether the document is valid (no errors).
    pub valid: bool,
}

// ── Item helpers ────────────────────────────────────────────────

/// Collect all item keys from the item tree, including from children.
pub fn collect_keys(items: &[Value], keys: &mut HashSet<String>) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|v| v.as_str()) {
            keys.insert(key.to_string());
        }
        if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
            collect_keys(children, keys);
        }
    }
}

/// Collect all repeatable group keys (items that have `repeat` or `repeat.min`/`repeat.max`).
pub fn collect_repeatable_groups(items: &[Value], groups: &mut HashSet<String>) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|v| v.as_str()) {
            if item.get("repeat").is_some() {
                groups.insert(key.to_string());
            }
            if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
                collect_repeatable_groups(children, groups);
            }
        }
    }
}

/// Collect item keys that are children of a specific group key.
pub fn collect_group_children(items: &[Value], group_key: &str) -> HashSet<String> {
    let mut result = HashSet::new();
    find_group_children(items, group_key, &mut result);
    result
}

fn find_group_children(items: &[Value], group_key: &str, result: &mut HashSet<String>) {
    for item in items {
        if let Some(key) = item.get("key").and_then(|v| v.as_str()) {
            if key == group_key {
                // Found the group, collect all its children's keys
                if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
                    collect_keys(children, result);
                }
                return;
            }
            if let Some(children) = item.get("children").and_then(|v| v.as_array()) {
                find_group_children(children, group_key, result);
            }
        }
    }
}

/// Collect optionSets defined at the definition level.
pub fn collect_option_sets(doc: &Value) -> HashSet<String> {
    let mut names = HashSet::new();
    if let Some(option_sets) = doc.get("optionSets").and_then(|v| v.as_object()) {
        for key in option_sets.keys() {
            names.insert(key.clone());
        }
    }
    names
}
