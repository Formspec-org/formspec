//! FEL error types and diagnostic messages.
use std::fmt;

/// Failure from [`crate::parse`] or fatal-style evaluation errors surfaced as `Err`.
#[derive(Debug, Clone)]
pub enum FelError {
    /// Lex/parse failure (message from lexer or parser).
    Parse(String),
    /// Evaluation failure where the API returns `Err` instead of diagnostics.
    Eval(String),
}

#[allow(missing_docs)]
impl fmt::Display for FelError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FelError::Parse(msg) => write!(f, "parse error: {msg}"),
            FelError::Eval(msg) => write!(f, "evaluation error: {msg}"),
        }
    }
}

#[allow(missing_docs)]
impl std::error::Error for FelError {}

/// A non-fatal diagnostic recorded during evaluation.
#[derive(Debug, Clone)]
pub struct Diagnostic {
    /// Severity for hosts and JSON wire encoding.
    pub severity: Severity,
    /// Human-readable explanation.
    pub message: String,
}

/// Diagnostic severity for tooling and JSON wire format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    /// Blocking / error-level.
    Error,
    /// Warning-level.
    Warning,
    /// Informational.
    Info,
}

impl Severity {
    /// Wire string used in JSON diagnostics (`error` / `warning` / `info`).
    pub fn as_wire_str(self) -> &'static str {
        match self {
            Self::Error => "error",
            Self::Warning => "warning",
            Self::Info => "info",
        }
    }
}

impl Diagnostic {
    /// Build an error-severity diagnostic.
    pub fn error(msg: impl Into<String>) -> Self {
        Diagnostic {
            severity: Severity::Error,
            message: msg.into(),
        }
    }

    /// Build a warning-severity diagnostic.
    pub fn warning(msg: impl Into<String>) -> Self {
        Diagnostic {
            severity: Severity::Warning,
            message: msg.into(),
        }
    }
}

/// Names from `undefined function: …` diagnostics (host bindings reject these as unsupported).
pub fn undefined_function_names_from_diagnostics(diagnostics: &[Diagnostic]) -> Vec<String> {
    diagnostics
        .iter()
        .filter_map(|d| {
            d.message
                .strip_prefix("undefined function: ")
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        })
        .collect()
}

/// Returns `true` if any diagnostic has error severity.
pub fn has_error_diagnostics(diagnostics: &[Diagnostic]) -> bool {
    diagnostics.iter().any(|d| d.severity == Severity::Error)
}

/// Returns `Err` when any undefined-function diagnostic is present (WASM / strict hosts).
pub fn reject_undefined_functions(diagnostics: &[Diagnostic]) -> Result<(), String> {
    let names = undefined_function_names_from_diagnostics(diagnostics);
    if names.is_empty() {
        Ok(())
    } else {
        Err(format!("Unsupported FEL function: {}", names.join(", ")))
    }
}
