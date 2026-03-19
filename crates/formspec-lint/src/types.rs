//! Shared types for the formspec lint pipeline (diagnostics, modes, results).

/// Shared types for the formspec lint pipeline.

use std::cmp::Ordering;

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

impl LintMode {
    /// Whether this mode is the relaxed authoring mode.
    pub fn is_authoring(self) -> bool {
        self == LintMode::Authoring
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
    /// Create an error diagnostic.
    pub fn error(code: &str, pass: u8, path: impl Into<String>, message: impl Into<String>) -> Self {
        Self { code: code.to_string(), pass, severity: LintSeverity::Error, path: path.into(), message: message.into() }
    }

    /// Create a warning diagnostic.
    pub fn warning(code: &str, pass: u8, path: impl Into<String>, message: impl Into<String>) -> Self {
        Self { code: code.to_string(), pass, severity: LintSeverity::Warning, path: path.into(), message: message.into() }
    }

    /// Create an info diagnostic.
    pub fn info(code: &str, pass: u8, path: impl Into<String>, message: impl Into<String>) -> Self {
        Self { code: code.to_string(), pass, severity: LintSeverity::Info, path: path.into(), message: message.into() }
    }

    /// Whether this diagnostic should be suppressed in the given lint mode.
    pub fn suppressed_in(&self, mode: LintMode) -> bool {
        match mode {
            LintMode::Runtime => false,
            LintMode::Authoring => {
                // W300: incompatible dataType for optionSet (noisy during editing)
                // W802: compatible-with-warning fallback (authoring mode allows it)
                self.code == "W300" || self.code == "W802"
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
#[derive(Debug, Clone, Default)]
pub struct LintOptions {
    /// Lint mode (Runtime or Authoring).
    pub mode: LintMode,
    /// Optional registry documents for extension resolution (E600).
    /// Each value should be a JSON registry document with `entries` array.
    pub registry_documents: Vec<Value>,
    /// Optional paired definition document for cross-artifact validation.
    /// Used by pass 6 (theme: W705-W707) and pass 7 (components: W800/E802-E803).
    /// When `None`, cross-artifact checks are skipped (single-document mode).
    pub definition_document: Option<Value>,
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

