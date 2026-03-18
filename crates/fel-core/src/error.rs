//! FEL error types and diagnostic messages.
use std::fmt;

#[derive(Debug, Clone)]
pub enum FelError {
    Parse(String),
    Eval(String),
}

impl fmt::Display for FelError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FelError::Parse(msg) => write!(f, "parse error: {msg}"),
            FelError::Eval(msg) => write!(f, "evaluation error: {msg}"),
        }
    }
}

impl std::error::Error for FelError {}

/// A non-fatal diagnostic recorded during evaluation.
#[derive(Debug, Clone)]
pub struct Diagnostic {
    pub severity: Severity,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Error,
    Warning,
    Info,
}

impl Diagnostic {
    pub fn error(msg: impl Into<String>) -> Self {
        Diagnostic {
            severity: Severity::Error,
            message: msg.into(),
        }
    }

    pub fn warning(msg: impl Into<String>) -> Self {
        Diagnostic {
            severity: Severity::Warning,
            message: msg.into(),
        }
    }
}
