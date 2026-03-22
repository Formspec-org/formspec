//! Formspec Definition Evaluator — 4-phase batch processor.
//!
//! ## Layout
//! The main path is [`pipeline::evaluate_definition_full_with_instances_and_context`]:
//! 1. [`rebuild`] — definition → item tree, initial values, repeat expansion, wildcard binds
//! 2. [`recalculate`] — relevance, required, readonly, variables, calculate
//! 3. [`revalidate`] — required/type/constraint, extensions, shapes
//! 4. [`nrb`] — output shaping for non-relevant fields
//!
//! Cross-cutting: [`convert`] (path resolution), `fel_json` (money-aware JSON→`FelValue` for env fields),
//! [`runtime_seed`] (prePopulate / previous non-relevant). [`screener`] evaluates routes in an isolated env.

mod fel_json;
mod value_predicate;

pub mod convert;
pub mod nrb;
pub mod rebuild;
pub mod recalculate;
pub mod revalidate;
pub mod screener;
pub mod types;

mod pipeline;
mod runtime_seed;

pub use convert::resolve_value_by_path;
pub use nrb::{apply_nrb, resolve_nrb};
pub use pipeline::{
    evaluate_definition, evaluate_definition_full, evaluate_definition_full_with_context,
    evaluate_definition_full_with_instances, evaluate_definition_full_with_instances_and_context,
    evaluate_definition_with_context, evaluate_definition_with_trigger,
    evaluate_definition_with_trigger_and_context,
};
pub use rebuild::{expand_repeat_instances, expand_wildcard_path, rebuild_item_tree};
pub use rebuild::parse_variables;
pub use recalculate::{recalculate, topo_sort_variables};
pub use revalidate::revalidate;
pub use screener::{ScreenerRouteResult, evaluate_screener};
pub use types::{
    EvalContext, EvalTrigger, EvaluationResult, ExtensionConstraint, ItemInfo, NrbMode,
    ValidationResult, VariableDef, WhitespaceMode,
};
