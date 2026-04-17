//! Structured evaluation traces for FEL.
//!
//! A [`Trace`] is an ordered sequence of [`TraceStep`]s that records what the
//! evaluator did while producing a result. Traces are opt-in: the hot-path
//! [`crate::evaluate`] function does not allocate or emit any steps. Use
//! [`crate::evaluate_with_trace`] to capture one.
//!
//! Traces are designed for human and LLM consumption, not for re-evaluation.
//! Values are projected to `serde_json::Value` — losing FEL type fidelity
//! (money, date) but gaining universal readability. Add new variants as the
//! need arises; this v0 set covers field resolution, function calls, binary
//! ops, conditional branches, and short-circuit skips.
use serde::Serialize;

/// A single recorded event during FEL evaluation.
///
/// The variant set is intentionally narrow: only events that help explain
/// *why* an expression produced its result. Non-covered AST nodes omit steps
/// rather than emitting noise — correctness over completeness.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind")]
pub enum TraceStep {
    /// A `$field` reference was resolved against the environment.
    FieldResolved {
        /// Dotted path as written in source (e.g. `foo`, `items[2].amount`).
        path: String,
        /// Value returned by the environment, projected to JSON.
        value: serde_json::Value,
    },
    /// A function call completed and returned a value.
    ///
    /// Emitted only for functions that eagerly evaluate all arguments. Lazy
    /// or short-circuiting functions (`if`, `countWhere`, `every`, `some`,
    /// etc.) rely on other step kinds to explain themselves.
    FunctionCalled {
        /// Function name as written in source.
        name: String,
        /// Argument values, in order.
        args: Vec<serde_json::Value>,
        /// Return value.
        result: serde_json::Value,
    },
    /// A binary operator produced a result from two operand values.
    ///
    /// Covers arithmetic (`+ - * /`), comparison (`< <= == != > >=`), and
    /// `and`/`or` when both sides were actually evaluated. Short-circuited
    /// `and`/`or` emit [`TraceStep::ShortCircuit`] instead.
    BinaryOp {
        /// Operator symbol (`+`, `==`, `and`, ...).
        op: String,
        /// Left-hand value.
        lhs: serde_json::Value,
        /// Right-hand value.
        rhs: serde_json::Value,
        /// Result value.
        result: serde_json::Value,
    },
    /// A conditional (`if(...)` call or `if-then-else` / ternary) selected a branch.
    IfBranch {
        /// The evaluated condition value.
        condition_value: serde_json::Value,
        /// Which branch was taken: `"then"` or `"else"`.
        branch_taken: &'static str,
    },
    /// A logical operator short-circuited; the right-hand side was not evaluated.
    ShortCircuit {
        /// Operator symbol (`and` or `or`).
        op: String,
        /// Human-readable reason (e.g. `"left of 'and' was false, skipped right"`).
        reason: String,
    },
}

/// An ordered record of everything the evaluator emitted during one run.
///
/// Steps are appended in evaluation order. A consumer (linter, MCP tool,
/// error-explainer) can render the sequence top-to-bottom to reconstruct
/// *why* the expression produced its result.
#[derive(Debug, Clone, Default, Serialize)]
pub struct Trace {
    /// Steps in evaluation order.
    pub steps: Vec<TraceStep>,
}

impl Trace {
    /// Create an empty trace.
    pub fn new() -> Self {
        Self::default()
    }

    /// Append a step.
    pub fn push(&mut self, step: TraceStep) {
        self.steps.push(step);
    }

    /// Number of recorded steps.
    pub fn len(&self) -> usize {
        self.steps.len()
    }

    /// True when no steps have been recorded.
    pub fn is_empty(&self) -> bool {
        self.steps.is_empty()
    }
}
