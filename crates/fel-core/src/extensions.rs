//! FEL extension function registry with null propagation and conflict detection.
///
/// Extensions cannot shadow reserved words or built-in function names.
/// All extension functions are null-propagating: if any argument is null, the result is null.
use std::collections::HashMap;

use crate::types::FelValue;

/// A registered extension function.
pub struct ExtensionFunc {
    /// Human-readable name for diagnostics.
    pub name: String,
    /// Minimum number of arguments.
    pub min_args: usize,
    /// Maximum number of arguments (None = unbounded).
    pub max_args: Option<usize>,
    /// The implementation: receives pre-evaluated args, returns a value.
    /// Arguments are guaranteed non-null (null propagation handled by caller).
    pub func: Box<dyn Fn(&[FelValue]) -> FelValue + Send + Sync>,
}

/// Registry of extension functions.
pub struct ExtensionRegistry {
    extensions: HashMap<String, ExtensionFunc>,
}

/// Reserved words and builtin names that cannot be shadowed.
const RESERVED_WORDS: &[&str] = &[
    "true", "false", "null", "let", "in", "if", "then", "else", "and", "or", "not",
];

const BUILTIN_FUNCTIONS: &[&str] = &[
    // Aggregates
    "sum", "count", "avg", "min", "max", "countWhere",
    // String
    "length", "contains", "startsWith", "endsWith", "substring",
    "replace", "upper", "lower", "trim", "matches", "format",
    // Numeric
    "round", "floor", "ceil", "abs", "power",
    // Date
    "today", "now", "year", "month", "day",
    "hours", "minutes", "seconds", "time", "timeDiff", "dateDiff", "dateAdd",
    // Logical
    "if", "coalesce", "empty", "present", "selected",
    // Type checking
    "isNumber", "isString", "isDate", "isNull", "typeOf",
    // Casting
    "number", "string", "boolean", "date",
    // Money
    "money", "moneyAmount", "moneyCurrency", "moneyAdd", "moneySum",
    // MIP
    "valid", "relevant", "readonly", "required",
    // Repeat nav
    "prev", "next", "parent",
];

/// Error type for extension registration failures.
#[derive(Debug, Clone)]
pub enum ExtensionError {
    /// Name conflicts with a reserved word or built-in function.
    NameConflict(String),
}

impl std::fmt::Display for ExtensionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExtensionError::NameConflict(name) => {
                write!(f, "cannot register extension '{name}': conflicts with reserved word or built-in function")
            }
        }
    }
}

impl std::error::Error for ExtensionError {}

impl ExtensionRegistry {
    pub fn new() -> Self {
        Self {
            extensions: HashMap::new(),
        }
    }

    /// Register an extension function.
    ///
    /// Returns an error if the name conflicts with a reserved word or built-in.
    pub fn register(
        &mut self,
        name: impl Into<String>,
        min_args: usize,
        max_args: Option<usize>,
        func: impl Fn(&[FelValue]) -> FelValue + Send + Sync + 'static,
    ) -> Result<(), ExtensionError> {
        let name = name.into();

        if RESERVED_WORDS.contains(&name.as_str()) || BUILTIN_FUNCTIONS.contains(&name.as_str()) {
            return Err(ExtensionError::NameConflict(name));
        }

        self.extensions.insert(name.clone(), ExtensionFunc {
            name: name.clone(),
            min_args,
            max_args,
            func: Box::new(func),
        });
        Ok(())
    }

    /// Look up an extension function by name.
    pub fn get(&self, name: &str) -> Option<&ExtensionFunc> {
        self.extensions.get(name)
    }

    /// Check if a name is registered.
    pub fn contains(&self, name: &str) -> bool {
        self.extensions.contains_key(name)
    }

    /// Call an extension function with null propagation.
    ///
    /// If any argument is null, returns null without calling the function.
    /// Returns None if the extension is not found.
    pub fn call(&self, name: &str, args: &[FelValue]) -> Option<FelValue> {
        let ext = self.extensions.get(name)?;

        // Null propagation: any null arg → null result
        if args.iter().any(|a| a.is_null()) {
            return Some(FelValue::Null);
        }

        Some((ext.func)(args))
    }
}

impl Default for ExtensionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
/// Design note (spec: core/spec.md §3.12, registry/extension-registry.md §7):
///
/// ExtensionRegistry is intentionally isolated from the evaluator's built-in
/// function dispatch. The spec says extensions "MAY supplement but MUST NOT
/// override" built-ins. This is enforced structurally: the evaluator matches
/// built-in names first in `eval_function`, and only falls through to the
/// extension registry for unknown names. The registry itself independently
/// rejects registration of names that collide with built-ins or reserved words.
///
/// This two-layer defense is by design, not accident. The evaluator's match
/// arms guarantee built-in semantics can never be replaced at runtime, while
/// the registry's registration-time check gives early feedback to extension
/// authors. Neither layer alone would be sufficient: without the evaluator
/// guard, a bug in the registry could allow shadowing; without the registry
/// guard, extensions would silently be ignored instead of rejected.
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    fn num(n: i64) -> FelValue {
        FelValue::Number(Decimal::from(n))
    }

    fn s(v: &str) -> FelValue {
        FelValue::String(v.to_string())
    }

    #[test]
    fn test_register_and_call() {
        let mut registry = ExtensionRegistry::new();
        registry.register("double", 1, Some(1), |args| {
            match &args[0] {
                FelValue::Number(n) => FelValue::Number(*n * Decimal::from(2)),
                _ => FelValue::Null,
            }
        }).unwrap();

        assert!(registry.contains("double"));
        assert_eq!(registry.call("double", &[num(5)]), Some(num(10)));
    }

    #[test]
    fn test_null_propagation() {
        let mut registry = ExtensionRegistry::new();
        registry.register("identity", 1, Some(1), |args| args[0].clone()).unwrap();

        assert_eq!(registry.call("identity", &[FelValue::Null]), Some(FelValue::Null));
        assert_eq!(registry.call("identity", &[num(42)]), Some(num(42)));
    }

    #[test]
    fn test_cannot_shadow_reserved() {
        let mut registry = ExtensionRegistry::new();
        assert!(registry.register("if", 1, None, |_| FelValue::Null).is_err());
        assert!(registry.register("true", 0, None, |_| FelValue::Null).is_err());
        assert!(registry.register("and", 2, None, |_| FelValue::Null).is_err());
    }

    #[test]
    fn test_cannot_shadow_builtin() {
        let mut registry = ExtensionRegistry::new();
        assert!(registry.register("sum", 1, None, |_| FelValue::Null).is_err());
        assert!(registry.register("round", 1, None, |_| FelValue::Null).is_err());
        assert!(registry.register("today", 0, None, |_| FelValue::Null).is_err());
    }

    #[test]
    fn test_unknown_extension_returns_none() {
        let registry = ExtensionRegistry::new();
        assert_eq!(registry.call("unknownExt", &[num(1)]), None);
    }

    #[test]
    fn test_multi_arg_extension() {
        let mut registry = ExtensionRegistry::new();
        registry.register("concat3", 3, Some(3), |args| {
            let parts: Vec<String> = args.iter().map(|a| a.to_string()).collect();
            FelValue::String(parts.join("-"))
        }).unwrap();

        assert_eq!(
            registry.call("concat3", &[s("a"), s("b"), s("c")]),
            Some(s("a-b-c"))
        );
    }
}
