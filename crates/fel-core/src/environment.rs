//! FEL evaluation environment with field resolution, repeats, MIP state, and instances.
///
/// Provides `FormspecEnvironment`, a concrete `Environment` impl backed by
/// nested data dicts, repeat context, MIP states, named instances, and variables.
use rust_decimal::Decimal;
use std::collections::HashMap;

use crate::evaluator::Environment;
use crate::types::FelValue;

// ── Data structures ─────────────────────────────────────────────

/// Repeat-group iteration context (§4.3).
#[derive(Debug, Clone)]
pub struct RepeatContext {
    /// The current row value.
    pub current: FelValue,
    /// 1-based index within the repeat group.
    pub index: usize,
    /// Total instance count.
    pub count: usize,
    /// Parent repeat context (for nested repeats).
    pub parent: Option<Box<RepeatContext>>,
    /// All rows in the collection (for prev/next navigation).
    pub collection: Vec<FelValue>,
}

/// XForms Model Item Properties for a single field path.
#[derive(Debug, Clone)]
pub struct MipState {
    pub valid: bool,
    pub relevant: bool,
    pub readonly: bool,
    pub required: bool,
}

impl Default for MipState {
    fn default() -> Self {
        Self {
            valid: true,
            relevant: true,
            readonly: false,
            required: false,
        }
    }
}

// ── FormspecEnvironment ─────────────────────────────────────────

/// A full-featured environment for FEL evaluation within a Formspec engine.
///
/// Supports:
/// - Field resolution via `$field.path` (walks nested data dict)
/// - Named instances via `@instance('name')`
/// - Repeat context via `@current`, `@index`, `@count`
/// - MIP state queries via `valid()`, `relevant()`, etc.
/// - Definition variables via `@variableName`
/// - Mapping context via `@source`, `@target`
pub struct FormspecEnvironment {
    /// Primary data dict — backs `$field` references.
    pub data: HashMap<String, FelValue>,
    /// Named secondary instances — backs `@instance('name')`.
    pub instances: HashMap<String, FelValue>,
    /// MIP states per dotted field path.
    pub mip_states: HashMap<String, MipState>,
    /// Definition variables — backs `@variableName`.
    pub variables: HashMap<String, FelValue>,
    /// Current repeat context (if inside a repeat iteration).
    pub repeat_context: Option<RepeatContext>,
}

impl FormspecEnvironment {
    pub fn new() -> Self {
        Self {
            data: HashMap::new(),
            instances: HashMap::new(),
            mip_states: HashMap::new(),
            variables: HashMap::new(),
            repeat_context: None,
        }
    }

    /// Set a field value by dotted path (e.g., "address.city").
    pub fn set_field(&mut self, path: &str, value: FelValue) {
        self.data.insert(path.to_string(), value);
    }

    /// Set a named instance.
    pub fn set_instance(&mut self, name: &str, value: FelValue) {
        self.instances.insert(name.to_string(), value);
    }

    /// Set MIP state for a field path.
    pub fn set_mip(&mut self, path: &str, state: MipState) {
        self.mip_states.insert(path.to_string(), state);
    }

    /// Set a variable value.
    pub fn set_variable(&mut self, name: &str, value: FelValue) {
        self.variables.insert(name.to_string(), value);
    }

    /// Enter a repeat context.
    pub fn push_repeat(&mut self, current: FelValue, index: usize, count: usize, collection: Vec<FelValue>) {
        let parent = self.repeat_context.take().map(Box::new);
        self.repeat_context = Some(RepeatContext {
            current,
            index,
            count,
            parent,
            collection,
        });
    }

    /// Leave the current repeat context, restoring the parent.
    pub fn pop_repeat(&mut self) {
        if let Some(ctx) = self.repeat_context.take() {
            self.repeat_context = ctx.parent.map(|b| *b);
        }
    }
}

impl Default for FormspecEnvironment {
    fn default() -> Self {
        Self::new()
    }
}

/// Walk a nested value by string path segments.
fn resolve_path(val: &FelValue, segments: &[String]) -> FelValue {
    let mut current = val.clone();
    for seg in segments {
        match &current {
            FelValue::Object(entries) => {
                match entries.iter().find(|(k, _)| k == seg) {
                    Some((_, v)) => current = v.clone(),
                    None => return FelValue::Null,
                }
            }
            _ => return FelValue::Null,
        }
    }
    current
}

impl Environment for FormspecEnvironment {
    fn resolve_field(&self, segments: &[String]) -> FelValue {
        if segments.is_empty() {
            // Bare $ — return repeat context current or full data
            if let Some(ctx) = &self.repeat_context {
                return ctx.current.clone();
            }
            return FelValue::Null;
        }

        let key = segments.join(".");
        // Check flat lookup first (handles dotted keys like "address.city")
        if let Some(val) = self.data.get(&key) {
            return val.clone();
        }
        // Check first segment then walk
        if let Some(val) = self.data.get(&segments[0]) {
            if segments.len() == 1 {
                return val.clone();
            }
            return resolve_path(val, &segments[1..]);
        }
        FelValue::Null
    }

    fn resolve_context(&self, name: &str, arg: Option<&str>, tail: &[String]) -> FelValue {
        match name {
            "current" => {
                if let Some(ctx) = &self.repeat_context {
                    let base = ctx.current.clone();
                    if tail.is_empty() { base } else { resolve_path(&base, tail) }
                } else {
                    FelValue::Null
                }
            }
            "index" => {
                if let Some(ctx) = &self.repeat_context {
                    FelValue::Number(Decimal::from(ctx.index as i64))
                } else {
                    FelValue::Null
                }
            }
            "count" => {
                if let Some(ctx) = &self.repeat_context {
                    FelValue::Number(Decimal::from(ctx.count as i64))
                } else {
                    FelValue::Null
                }
            }
            "instance" => {
                if let Some(inst_name) = arg {
                    if let Some(val) = self.instances.get(inst_name) {
                        if tail.is_empty() { val.clone() } else { resolve_path(val, tail) }
                    } else {
                        FelValue::Null
                    }
                } else {
                    FelValue::Null
                }
            }
            // Definition variables: @variableName
            _ => {
                if let Some(val) = self.variables.get(name) {
                    if tail.is_empty() { val.clone() } else { resolve_path(val, tail) }
                } else {
                    FelValue::Null
                }
            }
        }
    }

    fn mip_valid(&self, path: &[String]) -> FelValue {
        let key = path.join(".");
        FelValue::Boolean(self.mip_states.get(&key).map_or(true, |s| s.valid))
    }

    fn mip_relevant(&self, path: &[String]) -> FelValue {
        let key = path.join(".");
        FelValue::Boolean(self.mip_states.get(&key).map_or(true, |s| s.relevant))
    }

    fn mip_readonly(&self, path: &[String]) -> FelValue {
        let key = path.join(".");
        FelValue::Boolean(self.mip_states.get(&key).map_or(false, |s| s.readonly))
    }

    fn mip_required(&self, path: &[String]) -> FelValue {
        let key = path.join(".");
        FelValue::Boolean(self.mip_states.get(&key).map_or(false, |s| s.required))
    }

    fn repeat_prev(&self) -> FelValue {
        if let Some(ctx) = &self.repeat_context {
            if ctx.index > 1 {
                return ctx.collection.get(ctx.index - 2).cloned().unwrap_or(FelValue::Null);
            }
        }
        FelValue::Null
    }

    fn repeat_next(&self) -> FelValue {
        if let Some(ctx) = &self.repeat_context {
            if ctx.index < ctx.count {
                return ctx.collection.get(ctx.index).cloned().unwrap_or(FelValue::Null);
            }
        }
        FelValue::Null
    }

    fn repeat_parent(&self) -> FelValue {
        if let Some(ctx) = &self.repeat_context {
            if let Some(parent) = &ctx.parent {
                return parent.current.clone();
            }
        }
        FelValue::Null
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &str) -> FelValue {
        FelValue::String(v.to_string())
    }

    fn num(n: i64) -> FelValue {
        FelValue::Number(Decimal::from(n))
    }

    #[test]
    fn test_basic_field_resolution() {
        let mut env = FormspecEnvironment::new();
        env.set_field("name", s("Alice"));
        env.set_field("age", num(30));

        assert_eq!(env.resolve_field(&["name".into()]), s("Alice"));
        assert_eq!(env.resolve_field(&["age".into()]), num(30));
        assert_eq!(env.resolve_field(&["missing".into()]), FelValue::Null);
    }

    #[test]
    fn test_nested_field_resolution() {
        let mut env = FormspecEnvironment::new();
        let addr = FelValue::Object(vec![
            ("city".to_string(), s("NYC")),
            ("zip".to_string(), s("10001")),
        ]);
        env.set_field("address", addr);

        assert_eq!(
            env.resolve_field(&["address".into(), "city".into()]),
            s("NYC")
        );
        assert_eq!(
            env.resolve_field(&["address".into(), "missing".into()]),
            FelValue::Null
        );
    }

    #[test]
    fn test_repeat_context() {
        let mut env = FormspecEnvironment::new();
        let items = vec![num(10), num(20), num(30)];
        env.push_repeat(num(20), 2, 3, items);

        // @current
        assert_eq!(
            env.resolve_context("current", None, &[]),
            num(20)
        );
        // @index (1-based)
        assert_eq!(
            env.resolve_context("index", None, &[]),
            num(2)
        );
        // @count
        assert_eq!(
            env.resolve_context("count", None, &[]),
            num(3)
        );
        // prev() — item at index 1 (0-indexed: 0)
        assert_eq!(env.repeat_prev(), num(10));
        // next() — item at index 3 (0-indexed: 2)
        assert_eq!(env.repeat_next(), num(30));
    }

    #[test]
    fn test_nested_repeat_context() {
        let mut env = FormspecEnvironment::new();
        let outer = vec![s("A"), s("B")];
        env.push_repeat(s("A"), 1, 2, outer);

        let inner = vec![num(1), num(2), num(3)];
        env.push_repeat(num(2), 2, 3, inner);

        // Inner context active
        assert_eq!(env.resolve_context("current", None, &[]), num(2));
        // parent() returns outer current
        assert_eq!(env.repeat_parent(), s("A"));

        env.pop_repeat();
        // Outer context restored
        assert_eq!(env.resolve_context("current", None, &[]), s("A"));
    }

    #[test]
    fn test_named_instances() {
        let mut env = FormspecEnvironment::new();
        let config = FelValue::Object(vec![
            ("maxRetries".to_string(), num(3)),
        ]);
        env.set_instance("config", config);

        assert_eq!(
            env.resolve_context("instance", Some("config"), &["maxRetries".into()]),
            num(3)
        );
        assert_eq!(
            env.resolve_context("instance", Some("missing"), &[]),
            FelValue::Null
        );
    }

    #[test]
    fn test_variables() {
        let mut env = FormspecEnvironment::new();
        env.set_variable("total", num(100));

        assert_eq!(
            env.resolve_context("total", None, &[]),
            num(100)
        );
    }

    #[test]
    fn test_mip_states() {
        let mut env = FormspecEnvironment::new();
        env.set_mip("email", MipState {
            valid: false,
            relevant: true,
            readonly: false,
            required: true,
        });

        assert_eq!(env.mip_valid(&["email".into()]), FelValue::Boolean(false));
        assert_eq!(env.mip_relevant(&["email".into()]), FelValue::Boolean(true));
        assert_eq!(env.mip_readonly(&["email".into()]), FelValue::Boolean(false));
        assert_eq!(env.mip_required(&["email".into()]), FelValue::Boolean(true));

        // Default MIP for unknown fields
        assert_eq!(env.mip_valid(&["unknown".into()]), FelValue::Boolean(true));
        assert_eq!(env.mip_required(&["unknown".into()]), FelValue::Boolean(false));
    }

    #[test]
    fn test_bare_dollar_in_repeat() {
        let mut env = FormspecEnvironment::new();
        let items = vec![num(10), num(20)];
        env.push_repeat(num(10), 1, 2, items);

        // Bare $ resolves to repeat context current
        assert_eq!(env.resolve_field(&[]), num(10));
    }
}
