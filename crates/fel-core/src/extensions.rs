//! FEL extension function registry with null propagation and conflict detection.
///
/// Extensions cannot shadow reserved words or built-in function names.
/// All extension functions are null-propagating: if any argument is null, the result is null.
use std::collections::HashMap;

use crate::types::FelValue;

/// Type alias for extension function implementations.
pub type ExtensionFn = Box<dyn Fn(&[FelValue]) -> FelValue + Send + Sync>;

/// Metadata for a built-in FEL function exposed to tooling surfaces.
pub struct BuiltinFunctionCatalogEntry {
    pub name: &'static str,
    pub category: &'static str,
    pub signature: &'static str,
    pub description: &'static str,
}

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
    pub func: ExtensionFn,
}

/// Registry of extension functions.
pub struct ExtensionRegistry {
    extensions: HashMap<String, ExtensionFunc>,
}

/// Reserved words and builtin names that cannot be shadowed.
const RESERVED_WORDS: &[&str] = &[
    "true", "false", "null", "let", "in", "if", "then", "else", "and", "or", "not",
];

const BUILTIN_FUNCTIONS: &[BuiltinFunctionCatalogEntry] = &[
    BuiltinFunctionCatalogEntry {
        name: "sum",
        category: "aggregate",
        signature: "sum(array<number>) -> number",
        description: "Returns the sum of numeric elements in an array.",
    },
    BuiltinFunctionCatalogEntry {
        name: "count",
        category: "aggregate",
        signature: "count(array<any>) -> number",
        description: "Counts non-null elements in an array.",
    },
    BuiltinFunctionCatalogEntry {
        name: "avg",
        category: "aggregate",
        signature: "avg(array<number>) -> number",
        description: "Returns the arithmetic mean of numeric array elements.",
    },
    BuiltinFunctionCatalogEntry {
        name: "min",
        category: "aggregate",
        signature: "min(array<any>) -> any",
        description: "Returns the smallest non-null element in an array.",
    },
    BuiltinFunctionCatalogEntry {
        name: "max",
        category: "aggregate",
        signature: "max(array<any>) -> any",
        description: "Returns the largest non-null element in an array.",
    },
    BuiltinFunctionCatalogEntry {
        name: "countWhere",
        category: "aggregate",
        signature: "countWhere(array<any>, predicate) -> number",
        description: "Counts elements whose predicate evaluates to true.",
    },
    BuiltinFunctionCatalogEntry {
        name: "length",
        category: "string",
        signature: "length(string | array<any>) -> number",
        description: "Returns the number of characters in a string or elements in an array.",
    },
    BuiltinFunctionCatalogEntry {
        name: "contains",
        category: "string",
        signature: "contains(string, string) -> boolean",
        description: "Returns true when the first string contains the second as a substring.",
    },
    BuiltinFunctionCatalogEntry {
        name: "startsWith",
        category: "string",
        signature: "startsWith(string, string) -> boolean",
        description: "Returns true when a string starts with the given prefix.",
    },
    BuiltinFunctionCatalogEntry {
        name: "endsWith",
        category: "string",
        signature: "endsWith(string, string) -> boolean",
        description: "Returns true when a string ends with the given suffix.",
    },
    BuiltinFunctionCatalogEntry {
        name: "substring",
        category: "string",
        signature: "substring(string, number, number?) -> string",
        description: "Extracts a substring using 1-based start and optional length.",
    },
    BuiltinFunctionCatalogEntry {
        name: "replace",
        category: "string",
        signature: "replace(string, string, string) -> string",
        description: "Replaces occurrences of a substring with a new value.",
    },
    BuiltinFunctionCatalogEntry {
        name: "upper",
        category: "string",
        signature: "upper(string) -> string",
        description: "Converts a string to uppercase.",
    },
    BuiltinFunctionCatalogEntry {
        name: "lower",
        category: "string",
        signature: "lower(string) -> string",
        description: "Converts a string to lowercase.",
    },
    BuiltinFunctionCatalogEntry {
        name: "trim",
        category: "string",
        signature: "trim(string) -> string",
        description: "Removes leading and trailing whitespace from a string.",
    },
    BuiltinFunctionCatalogEntry {
        name: "matches",
        category: "string",
        signature: "matches(string, string) -> boolean",
        description: "Returns true when a string matches a regular expression pattern.",
    },
    BuiltinFunctionCatalogEntry {
        name: "format",
        category: "string",
        signature: "format(string, ...any) -> string",
        description: "Interpolates indexed placeholders like {0} and sequential %s markers with argument values.",
    },
    BuiltinFunctionCatalogEntry {
        name: "round",
        category: "numeric",
        signature: "round(number, number?) -> number",
        description: "Rounds a number using banker’s rounding with optional precision.",
    },
    BuiltinFunctionCatalogEntry {
        name: "floor",
        category: "numeric",
        signature: "floor(number) -> number",
        description: "Rounds a number down to the nearest integer.",
    },
    BuiltinFunctionCatalogEntry {
        name: "ceil",
        category: "numeric",
        signature: "ceil(number) -> number",
        description: "Rounds a number up to the nearest integer.",
    },
    BuiltinFunctionCatalogEntry {
        name: "abs",
        category: "numeric",
        signature: "abs(number) -> number",
        description: "Returns the absolute value of a number.",
    },
    BuiltinFunctionCatalogEntry {
        name: "power",
        category: "numeric",
        signature: "power(number, number) -> number",
        description: "Raises a base to a numeric exponent.",
    },
    BuiltinFunctionCatalogEntry {
        name: "today",
        category: "date",
        signature: "today() -> date",
        description: "Returns the current local date from the runtime context.",
    },
    BuiltinFunctionCatalogEntry {
        name: "now",
        category: "date",
        signature: "now() -> dateTime",
        description: "Returns the current local datetime from the runtime context.",
    },
    BuiltinFunctionCatalogEntry {
        name: "year",
        category: "date",
        signature: "year(date) -> number",
        description: "Extracts the year component from a date.",
    },
    BuiltinFunctionCatalogEntry {
        name: "month",
        category: "date",
        signature: "month(date) -> number",
        description: "Extracts the month component from a date.",
    },
    BuiltinFunctionCatalogEntry {
        name: "day",
        category: "date",
        signature: "day(date) -> number",
        description: "Extracts the day component from a date.",
    },
    BuiltinFunctionCatalogEntry {
        name: "hours",
        category: "date",
        signature: "hours(string) -> number",
        description: "Extracts the hour component from a HH:MM:SS time string.",
    },
    BuiltinFunctionCatalogEntry {
        name: "minutes",
        category: "date",
        signature: "minutes(string) -> number",
        description: "Extracts the minute component from a HH:MM:SS time string.",
    },
    BuiltinFunctionCatalogEntry {
        name: "seconds",
        category: "date",
        signature: "seconds(string) -> number",
        description: "Extracts the second component from a HH:MM:SS time string.",
    },
    BuiltinFunctionCatalogEntry {
        name: "time",
        category: "date",
        signature: "time(number, number, number) -> string",
        description: "Builds a HH:MM:SS time string from numeric parts.",
    },
    BuiltinFunctionCatalogEntry {
        name: "timeDiff",
        category: "date",
        signature: "timeDiff(laterTime, earlierTime) -> number",
        description: "Returns the difference in seconds between laterTime and earlierTime.",
    },
    BuiltinFunctionCatalogEntry {
        name: "dateDiff",
        category: "date",
        signature: "dateDiff(laterDate, earlierDate, unit) -> number",
        description: "Returns the difference between laterDate and earlierDate in the requested unit.",
    },
    BuiltinFunctionCatalogEntry {
        name: "dateAdd",
        category: "date",
        signature: "dateAdd(date, number, unit) -> date",
        description: "Adds a number of days, months, or years to a date.",
    },
    BuiltinFunctionCatalogEntry {
        name: "if",
        category: "logical",
        signature: "if(boolean, any, any) -> any",
        description: "Returns the second argument when the condition is true, otherwise the third.",
    },
    BuiltinFunctionCatalogEntry {
        name: "coalesce",
        category: "logical",
        signature: "coalesce(...any) -> any",
        description: "Returns the first non-null argument.",
    },
    BuiltinFunctionCatalogEntry {
        name: "empty",
        category: "logical",
        signature: "empty(any) -> boolean",
        description: "Returns true for null, empty strings, and empty arrays.",
    },
    BuiltinFunctionCatalogEntry {
        name: "present",
        category: "logical",
        signature: "present(any) -> boolean",
        description: "Returns true when a value is not empty.",
    },
    BuiltinFunctionCatalogEntry {
        name: "selected",
        category: "logical",
        signature: "selected(array<any>, any) -> boolean",
        description: "Returns true when a choice value is present in a selected choices array.",
    },
    BuiltinFunctionCatalogEntry {
        name: "isNumber",
        category: "type",
        signature: "isNumber(any) -> boolean",
        description: "Returns true when a value is a number.",
    },
    BuiltinFunctionCatalogEntry {
        name: "isString",
        category: "type",
        signature: "isString(any) -> boolean",
        description: "Returns true when a value is a string.",
    },
    BuiltinFunctionCatalogEntry {
        name: "isDate",
        category: "type",
        signature: "isDate(any) -> boolean",
        description: "Returns true when a value is a date or datetime.",
    },
    BuiltinFunctionCatalogEntry {
        name: "isNull",
        category: "type",
        signature: "isNull(any) -> boolean",
        description: "Returns true when a value is null.",
    },
    BuiltinFunctionCatalogEntry {
        name: "typeOf",
        category: "type",
        signature: "typeOf(any) -> string",
        description: "Returns the FEL type name of a value.",
    },
    BuiltinFunctionCatalogEntry {
        name: "number",
        category: "cast",
        signature: "number(any) -> number",
        description: "Casts strings, booleans, and numbers to number values.",
    },
    BuiltinFunctionCatalogEntry {
        name: "string",
        category: "cast",
        signature: "string(any) -> string",
        description: "Casts a value to its string representation.",
    },
    BuiltinFunctionCatalogEntry {
        name: "boolean",
        category: "cast",
        signature: "boolean(any) -> boolean",
        description: "Casts a value to boolean using FEL conversion rules.",
    },
    BuiltinFunctionCatalogEntry {
        name: "date",
        category: "cast",
        signature: "date(any) -> date",
        description: "Parses an ISO date or datetime string into a FEL date value.",
    },
    BuiltinFunctionCatalogEntry {
        name: "money",
        category: "money",
        signature: "money(number, string) -> money",
        description: "Constructs a money value from an amount and currency code.",
    },
    BuiltinFunctionCatalogEntry {
        name: "moneyAmount",
        category: "money",
        signature: "moneyAmount(money) -> number",
        description: "Extracts the numeric amount from a money value.",
    },
    BuiltinFunctionCatalogEntry {
        name: "moneyCurrency",
        category: "money",
        signature: "moneyCurrency(money) -> string",
        description: "Extracts the currency code from a money value.",
    },
    BuiltinFunctionCatalogEntry {
        name: "moneyAdd",
        category: "money",
        signature: "moneyAdd(money, money) -> money",
        description: "Adds two money values with the same currency.",
    },
    BuiltinFunctionCatalogEntry {
        name: "moneySum",
        category: "money",
        signature: "moneySum(array<money>) -> money",
        description: "Sums money values in an array when all currencies match.",
    },
    BuiltinFunctionCatalogEntry {
        name: "valid",
        category: "mip",
        signature: "valid(fieldRef) -> boolean",
        description: "Returns whether a field currently has zero validation errors.",
    },
    BuiltinFunctionCatalogEntry {
        name: "relevant",
        category: "mip",
        signature: "relevant(fieldRef) -> boolean",
        description: "Returns whether a field is currently relevant.",
    },
    BuiltinFunctionCatalogEntry {
        name: "readonly",
        category: "mip",
        signature: "readonly(fieldRef) -> boolean",
        description: "Returns whether a field is currently readonly.",
    },
    BuiltinFunctionCatalogEntry {
        name: "required",
        category: "mip",
        signature: "required(fieldRef) -> boolean",
        description: "Returns whether a field is currently required.",
    },
    BuiltinFunctionCatalogEntry {
        name: "prev",
        category: "repeat",
        signature: "prev() -> object | null",
        description: "Returns the previous repeat row object, or null at the boundary.",
    },
    BuiltinFunctionCatalogEntry {
        name: "next",
        category: "repeat",
        signature: "next() -> object | null",
        description: "Returns the next repeat row object, or null at the boundary.",
    },
    BuiltinFunctionCatalogEntry {
        name: "parent",
        category: "repeat",
        signature: "parent() -> object | null",
        description: "Returns the parent repeat row or enclosing group object.",
    },
    BuiltinFunctionCatalogEntry {
        name: "instance",
        category: "instance",
        signature: "instance(string, string?) -> any",
        description: "Reads data from a named instance, optionally at a dotted path.",
    },
];

pub fn builtin_function_catalog() -> &'static [BuiltinFunctionCatalogEntry] {
    BUILTIN_FUNCTIONS
}

/// Built-in catalog as a JSON array for WASM / tooling.
pub fn builtin_function_catalog_json_value() -> serde_json::Value {
    serde_json::Value::Array(
        builtin_function_catalog()
            .iter()
            .map(|e| {
                serde_json::json!({
                    "name": e.name,
                    "category": e.category,
                    "signature": e.signature,
                    "description": e.description,
                })
            })
            .collect(),
    )
}

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
                write!(
                    f,
                    "cannot register extension '{name}': conflicts with reserved word or built-in function"
                )
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

        if RESERVED_WORDS.contains(&name.as_str())
            || BUILTIN_FUNCTIONS
                .iter()
                .any(|entry| entry.name == name.as_str())
        {
            return Err(ExtensionError::NameConflict(name));
        }

        self.extensions.insert(
            name.clone(),
            ExtensionFunc {
                name: name.clone(),
                min_args,
                max_args,
                func: Box::new(func),
            },
        );
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
        registry
            .register("double", 1, Some(1), |args| match &args[0] {
                FelValue::Number(n) => FelValue::Number(*n * Decimal::from(2)),
                _ => FelValue::Null,
            })
            .unwrap();

        assert!(registry.contains("double"));
        assert_eq!(registry.call("double", &[num(5)]), Some(num(10)));
    }

    #[test]
    fn test_null_propagation() {
        let mut registry = ExtensionRegistry::new();
        registry
            .register("identity", 1, Some(1), |args| args[0].clone())
            .unwrap();

        assert_eq!(
            registry.call("identity", &[FelValue::Null]),
            Some(FelValue::Null)
        );
        assert_eq!(registry.call("identity", &[num(42)]), Some(num(42)));
    }

    #[test]
    fn test_cannot_shadow_reserved() {
        let mut registry = ExtensionRegistry::new();
        assert!(
            registry
                .register("if", 1, None, |_| FelValue::Null)
                .is_err()
        );
        assert!(
            registry
                .register("true", 0, None, |_| FelValue::Null)
                .is_err()
        );
        assert!(
            registry
                .register("and", 2, None, |_| FelValue::Null)
                .is_err()
        );
    }

    #[test]
    fn test_cannot_shadow_builtin() {
        let mut registry = ExtensionRegistry::new();
        assert!(
            registry
                .register("sum", 1, None, |_| FelValue::Null)
                .is_err()
        );
        assert!(
            registry
                .register("round", 1, None, |_| FelValue::Null)
                .is_err()
        );
        assert!(
            registry
                .register("today", 0, None, |_| FelValue::Null)
                .is_err()
        );
    }

    #[test]
    fn test_unknown_extension_returns_none() {
        let registry = ExtensionRegistry::new();
        assert_eq!(registry.call("unknownExt", &[num(1)]), None);
    }

    #[test]
    fn test_multi_arg_extension() {
        let mut registry = ExtensionRegistry::new();
        registry
            .register("concat3", 3, Some(3), |args| {
                let parts: Vec<String> = args.iter().map(|a| a.to_string()).collect();
                FelValue::String(parts.join("-"))
            })
            .unwrap();

        assert_eq!(
            registry.call("concat3", &[s("a"), s("b"), s("c")]),
            Some(s("a-b-c"))
        );
    }
}
