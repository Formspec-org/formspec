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
    /// Strict mode — all diagnostics emitted, and component compatibility warnings
    /// (W800, W802, W803, W804) are promoted to errors.
    Strict,
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
    pub fn error(
        code: &str,
        pass: u8,
        path: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code: code.to_string(),
            pass,
            severity: LintSeverity::Error,
            path: path.into(),
            message: message.into(),
        }
    }

    /// Create a warning diagnostic.
    pub fn warning(
        code: &str,
        pass: u8,
        path: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code: code.to_string(),
            pass,
            severity: LintSeverity::Warning,
            path: path.into(),
            message: message.into(),
        }
    }

    /// Create an info diagnostic.
    pub fn info(code: &str, pass: u8, path: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            pass,
            severity: LintSeverity::Info,
            path: path.into(),
            message: message.into(),
        }
    }

    /// Whether this diagnostic should be suppressed in the given lint mode.
    pub fn suppressed_in(&self, mode: LintMode) -> bool {
        match mode {
            LintMode::Runtime | LintMode::Strict => false,
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
    /// Lint mode (Runtime, Authoring, or Strict).
    pub mode: LintMode,
    /// Optional registry documents for extension resolution (E600).
    /// Each value should be a JSON registry document with `entries` array.
    pub registry_documents: Vec<Value>,
    /// Optional paired definition document for cross-artifact validation.
    /// Used by pass 6 (theme: W705-W707) and pass 7 (components: W800/E802-E803).
    /// When `None`, cross-artifact checks are skipped (single-document mode).
    pub definition_document: Option<Value>,
    /// When `true`, run only pass 1 (document type detection) and return early.
    /// Useful for fast schema-level validation without semantic analysis.
    pub schema_only: bool,
    /// When `true`, skip FEL-related passes (pass 4: expression compilation,
    /// pass 5: dependency cycle detection). Useful when FEL is handled externally.
    pub no_fel: bool,
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── Finding 45: LintSeverity ordering ────────────────────────

    /// Spec: Diagnostic sorting relies on Error < Warning < Info ordering.
    /// This ordering drives diagnostic sorting in sort_diagnostics.
    #[test]
    fn severity_ord_error_less_than_warning_less_than_info() {
        assert!(LintSeverity::Error < LintSeverity::Warning);
        assert!(LintSeverity::Warning < LintSeverity::Info);
        assert!(LintSeverity::Error < LintSeverity::Info);
        // Reflexive equality
        assert_eq!(
            LintSeverity::Error.cmp(&LintSeverity::Error),
            std::cmp::Ordering::Equal
        );
    }

    // ── Finding 46: suppressed_in by mode ────────────────────────

    /// Spec: W300 and W802 are suppressed in Authoring mode but not Runtime.
    #[test]
    fn w300_suppressed_in_authoring_not_runtime() {
        let diag = LintDiagnostic::warning("W300", 3, "$.test", "test");
        assert!(
            diag.suppressed_in(LintMode::Authoring),
            "W300 should be suppressed in Authoring"
        );
        assert!(
            !diag.suppressed_in(LintMode::Runtime),
            "W300 should NOT be suppressed in Runtime"
        );
    }

    /// Spec: W802 component compatibility warning suppressed during authoring.
    #[test]
    fn w802_suppressed_in_authoring_not_runtime() {
        let diag = LintDiagnostic::warning("W802", 7, "$.test", "test");
        assert!(
            diag.suppressed_in(LintMode::Authoring),
            "W802 should be suppressed in Authoring"
        );
        assert!(
            !diag.suppressed_in(LintMode::Runtime),
            "W802 should NOT be suppressed in Runtime"
        );
    }

    /// Spec: No diagnostics are suppressed in Runtime mode.
    #[test]
    fn runtime_mode_suppresses_nothing() {
        for code in &["E100", "E300", "W300", "W700", "W802", "E500"] {
            let diag = LintDiagnostic::warning(code, 1, "$", "test");
            assert!(
                !diag.suppressed_in(LintMode::Runtime),
                "Runtime mode should never suppress, but suppressed {code}"
            );
        }
    }

    /// Spec: No diagnostics are suppressed in Strict mode.
    #[test]
    fn strict_mode_suppresses_nothing() {
        for code in &["E100", "E300", "W300", "W700", "W802", "E500", "W800", "W804"] {
            let diag = LintDiagnostic::warning(code, 1, "$", "test");
            assert!(
                !diag.suppressed_in(LintMode::Strict),
                "Strict mode should never suppress, but suppressed {code}"
            );
        }
    }

    /// Spec: Only W300 and W802 are suppressed in Authoring; others are not.
    #[test]
    fn authoring_mode_does_not_suppress_other_codes() {
        for code in &["E100", "E300", "W700", "W704", "E500", "E800"] {
            let diag = LintDiagnostic::warning(code, 1, "$", "test");
            assert!(
                !diag.suppressed_in(LintMode::Authoring),
                "Authoring mode should NOT suppress {code}"
            );
        }
    }

    // ── Finding 47: sort_diagnostics stability ───────────────────

    /// Spec: sort_diagnostics orders by (pass ASC, severity ASC, path ASC).
    /// Diagnostics with identical (pass, severity, path) preserve relative order (stable sort).
    #[test]
    fn sort_diagnostics_all_severities_with_duplicates() {
        let mut diags = vec![
            LintDiagnostic::info("W704", 6, "$.tokens.z", "info z"),
            LintDiagnostic::error("E300", 3, "$.binds.a", "error a"),
            LintDiagnostic::warning("W300", 3, "$.binds.b", "warning b"),
            LintDiagnostic::error("E300", 3, "$.binds.a", "error a duplicate"),
            LintDiagnostic::warning("W700", 6, "$.tokens.a", "warning a"),
            LintDiagnostic::error("E710", 6, "$.pages.a", "error page"),
        ];
        sort_diagnostics(&mut diags);

        // Verify non-decreasing sort order
        for window in diags.windows(2) {
            let a = &window[0];
            let b = &window[1];
            let order = a
                .pass
                .cmp(&b.pass)
                .then(a.severity.cmp(&b.severity))
                .then(a.path.cmp(&b.path));
            assert!(
                order != std::cmp::Ordering::Greater,
                "Sort violation: ({}, {:?}, {}) should not come after ({}, {:?}, {})",
                a.pass,
                a.severity,
                a.path,
                b.pass,
                b.severity,
                b.path,
            );
        }

        // Verify stability: the two E300 diagnostics at pass 3, path $.binds.a
        // should keep their original relative order.
        let e300s: Vec<&str> = diags
            .iter()
            .filter(|d| d.code == "E300" && d.path == "$.binds.a")
            .map(|d| d.message.as_str())
            .collect();
        assert_eq!(
            e300s,
            vec!["error a", "error a duplicate"],
            "Identical (pass, severity, path) diagnostics should preserve insertion order"
        );
    }
}
