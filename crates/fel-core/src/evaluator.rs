//! FEL tree-walking evaluator with base-10 decimal arithmetic and null propagation.
//!
//! Non-fatal errors produce a Diagnostic + FelNull (never panic).
//! Null propagation follows spec §3: most ops propagate, equality does NOT.
//!
//! The [`Evaluator`] owns `let` scopes and builtins; private `eval` / `fn_*` methods implement the tree walk.
#![allow(clippy::missing_docs_in_private_items)]
use intl_pluralrules::{PluralCategory, PluralRuleType, PluralRules};
use regex::RegexBuilder;
use rust_decimal::Decimal;
use rust_decimal::prelude::*;
use std::collections::HashMap;
use unic_langid::LanguageIdentifier;

use crate::ast::*;
use crate::error::Diagnostic;
use crate::types::*;

// ── Evaluation context ──────────────────────────────────────────

/// Resolves `$` field paths, `@` context, MIP queries, repeat navigation, and clock for FEL builtins.
pub trait Environment {
    /// Resolve `$a.b` style path as segment list (`["a","b"]`); empty slice is bare `$`.
    fn resolve_field(&self, segments: &[String]) -> FelValue;
    /// Resolve `@name`, `@name('arg')`, `@name.tail`.
    fn resolve_context(&self, name: &str, arg: Option<&str>, tail: &[String]) -> FelValue;

    /// `valid($path)` — default `true` when not overridden.
    fn mip_valid(&self, _path: &[String]) -> FelValue {
        FelValue::Boolean(true)
    }
    /// `relevant($path)` — default `true`.
    fn mip_relevant(&self, _path: &[String]) -> FelValue {
        FelValue::Boolean(true)
    }
    /// `readonly($path)` — default `false`.
    fn mip_readonly(&self, _path: &[String]) -> FelValue {
        FelValue::Boolean(false)
    }
    /// `required($path)` — default `false`.
    fn mip_required(&self, _path: &[String]) -> FelValue {
        FelValue::Boolean(false)
    }

    /// `prev()` in repeat scope — default null.
    fn repeat_prev(&self) -> FelValue {
        FelValue::Null
    }
    /// `next()` in repeat scope — default null.
    fn repeat_next(&self) -> FelValue {
        FelValue::Null
    }
    /// `parent()` in repeat scope — default null.
    fn repeat_parent(&self) -> FelValue {
        FelValue::Null
    }
    /// Calendar date for `today()` — default none (evaluator may still use literals).
    fn current_date(&self) -> Option<FelDate> {
        None
    }
    /// Date-time for `now()` — default none.
    fn current_datetime(&self) -> Option<FelDate> {
        None
    }
    /// Active locale code for `locale()` — default none (returns null).
    fn locale(&self) -> Option<&str> {
        None
    }
    /// Runtime metadata value for `runtimeMeta(key)` — default null.
    fn runtime_meta(&self, _key: &str) -> FelValue {
        FelValue::Null
    }
}

/// Flat `HashMap` environment for tests and simple hosts (no `@` context; fixed clock in default impl).
pub struct MapEnvironment {
    /// Top-level and nested values (nested via object values); keys may be dotted.
    pub fields: HashMap<String, FelValue>,
}

impl MapEnvironment {
    /// Empty field map.
    pub fn new() -> Self {
        Self {
            fields: HashMap::new(),
        }
    }

    /// Pre-populated field map.
    pub fn with_fields(fields: HashMap<String, FelValue>) -> Self {
        Self { fields }
    }
}

#[allow(missing_docs)]
impl Default for MapEnvironment {
    fn default() -> Self {
        Self::new()
    }
}

#[allow(missing_docs)]
impl Environment for MapEnvironment {
    fn resolve_field(&self, segments: &[String]) -> FelValue {
        if segments.is_empty() {
            return FelValue::Null;
        }
        let key = segments.join(".");
        if let Some(val) = self.fields.get(&key) {
            return val.clone();
        }
        // Walk nested objects
        let mut current = match self.fields.get(&segments[0]) {
            Some(v) => v.clone(),
            None => return FelValue::Null,
        };
        for seg in &segments[1..] {
            match &current {
                FelValue::Object(entries) => match entries.iter().find(|(k, _)| k == seg) {
                    Some((_, v)) => current = v.clone(),
                    None => return FelValue::Null,
                },
                _ => return FelValue::Null,
            }
        }
        current
    }

    fn resolve_context(&self, _name: &str, _arg: Option<&str>, _tail: &[String]) -> FelValue {
        FelValue::Null
    }

    fn current_date(&self) -> Option<FelDate> {
        Some(FelDate::Date {
            year: 2026,
            month: 3,
            day: 20,
        })
    }

    fn current_datetime(&self) -> Option<FelDate> {
        Some(FelDate::DateTime {
            year: 2026,
            month: 3,
            day: 20,
            hour: 0,
            minute: 0,
            second: 0,
        })
    }
}

/// Result of evaluation: a value plus any accumulated diagnostics.
#[derive(Debug, Clone)]
pub struct EvalResult {
    /// Computed value (may be null after errors).
    pub value: FelValue,
    /// Non-fatal issues (undefined functions, type errors, etc.).
    pub diagnostics: Vec<Diagnostic>,
}

/// Tree-walking evaluator with `let` scopes and diagnostic collection.
pub struct Evaluator<'a> {
    env: &'a dyn Environment,
    diagnostics: Vec<Diagnostic>,
    let_scopes: Vec<HashMap<String, FelValue>>,
}

/// Evaluate an expression against an environment.
pub fn evaluate(expr: &Expr, env: &dyn Environment) -> EvalResult {
    let mut evaluator = Evaluator {
        env,
        diagnostics: Vec::new(),
        let_scopes: Vec::new(),
    };
    let value = evaluator.eval(expr);
    EvalResult {
        value,
        diagnostics: evaluator.diagnostics,
    }
}

// Decimal constants
fn dec(n: i64) -> Decimal {
    Decimal::from(n)
}

impl<'a> Evaluator<'a> {
    fn diag(&mut self, msg: impl Into<String>) {
        self.diagnostics.push(Diagnostic::error(msg));
    }

    fn eval(&mut self, expr: &Expr) -> FelValue {
        match expr {
            Expr::Null => FelValue::Null,
            Expr::Boolean(b) => FelValue::Boolean(*b),
            Expr::Number(n) => FelValue::Number(*n),
            Expr::String(s) => FelValue::String(s.clone()),
            Expr::DateLiteral(s) => match parse_date_literal(s) {
                Some(d) => FelValue::Date(d),
                None => {
                    self.diag(format!("invalid date literal '{s}'"));
                    FelValue::Null
                }
            },
            Expr::DateTimeLiteral(s) => match parse_datetime_literal(s) {
                Some(d) => FelValue::Date(d),
                None => {
                    self.diag(format!("invalid datetime literal '{s}'"));
                    FelValue::Null
                }
            },
            Expr::Array(elems) => FelValue::Array(elems.iter().map(|e| self.eval(e)).collect()),
            Expr::Object(entries) => FelValue::Object(
                entries
                    .iter()
                    .map(|(k, v)| (k.clone(), self.eval(v)))
                    .collect(),
            ),
            Expr::FieldRef { name, path } => self.eval_field_ref(name, path),
            Expr::ContextRef { name, arg, tail } => {
                self.env.resolve_context(name, arg.as_deref(), tail)
            }
            Expr::UnaryOp { op, operand, .. } => {
                let val = self.eval(operand);
                self.eval_unary(*op, val)
            }
            Expr::BinaryOp { op, left, right } => self.eval_binary(*op, left, right),
            Expr::Ternary {
                condition,
                then_branch,
                else_branch,
            }
            | Expr::IfThenElse {
                condition,
                then_branch,
                else_branch,
            } => {
                let cond = self.eval(condition);
                match cond {
                    FelValue::Null => {
                        self.diag("if: condition evaluated to null");
                        FelValue::Null
                    }
                    FelValue::Boolean(true) => self.eval(then_branch),
                    FelValue::Boolean(false) => self.eval(else_branch),
                    _ => {
                        self.diag(format!(
                            "if: condition must be boolean, got {}",
                            cond.type_name()
                        ));
                        FelValue::Null
                    }
                }
            }
            Expr::Membership {
                value,
                container,
                negated,
            } => {
                let val = self.eval(value);
                let cont = self.eval(container);
                self.eval_membership(val, cont, *negated)
            }
            Expr::NullCoalesce { left, right } => {
                let l = self.eval(left);
                if l.is_null() { self.eval(right) } else { l }
            }
            Expr::LetBinding { name, value, body } => {
                let val = self.eval(value);
                self.let_scopes.push(HashMap::from([(name.clone(), val)]));
                let result = self.eval(body);
                self.let_scopes.pop();
                result
            }
            Expr::FunctionCall { name, args } => self.eval_function(name, args),
            Expr::PostfixAccess { expr, path } => {
                if let Expr::FieldRef {
                    name: Some(name),
                    path: base_path,
                } = expr.as_ref()
                {
                    let mut segments = vec![name.clone()];
                    let mut combined = Vec::with_capacity(base_path.len() + path.len());
                    combined.extend(base_path.iter().cloned());
                    combined.extend(path.iter().cloned());
                    if combined
                        .iter()
                        .all(|segment| matches!(segment, PathSegment::Dot(_)))
                    {
                        // Let-bound identifiers resolve in `eval_field_ref` before the environment.
                        // Skipping `eval(expr)` would merge path segments and call `resolve_field`
                        // only, so e.g. `let x = {a: 1} in x.a` would wrongly yield null.
                        let bound_in_let = self
                            .let_scopes
                            .iter()
                            .any(|scope| scope.contains_key(name));
                        if !bound_in_let {
                            for segment in &combined {
                                if let PathSegment::Dot(part) = segment {
                                    segments.push(part.clone());
                                }
                            }
                            return self.env.resolve_field(&segments);
                        }
                    }
                }
                let base = self.eval(expr);
                self.access_path(base, path)
            }
        }
    }

    // ── Field references ────────────────────────────────────────

    fn eval_field_ref(&mut self, name: &Option<String>, path: &[PathSegment]) -> FelValue {
        match name {
            None => {
                // Check let-scopes for bare $ (used by countWhere)
                for scope in self.let_scopes.iter().rev() {
                    if let Some(val) = scope.get("$") {
                        return if path.is_empty() {
                            val.clone()
                        } else {
                            self.access_path(val.clone(), path)
                        };
                    }
                }
                let base = self.env.resolve_field(&[]);
                if path.is_empty() {
                    base
                } else {
                    self.access_path(base, path)
                }
            }
            Some(n) => {
                // Check let-scopes first
                for scope in self.let_scopes.iter().rev() {
                    if let Some(val) = scope.get(n) {
                        return if path.is_empty() {
                            val.clone()
                        } else {
                            self.access_path(val.clone(), path)
                        };
                    }
                }
                // Build segments for environment resolution
                let mut segments = vec![n.clone()];
                let mut remaining_path = Vec::new();
                let mut hit_special = false;
                for seg in path {
                    if hit_special {
                        remaining_path.push(seg.clone());
                    } else {
                        match seg {
                            PathSegment::Dot(name) => segments.push(name.clone()),
                            _ => {
                                hit_special = true;
                                remaining_path.push(seg.clone());
                            }
                        }
                    }
                }
                let base = self.env.resolve_field(&segments);
                if matches!(base, FelValue::Null)
                    && path.iter().any(|seg| matches!(seg, PathSegment::Index(_)))
                {
                    let mut flat_segments = vec![n.clone()];
                    for seg in path {
                        match seg {
                            PathSegment::Dot(name) => flat_segments.push(name.clone()),
                            PathSegment::Index(idx) => {
                                if let Some(last) = flat_segments.last_mut() {
                                    last.push_str(&format!("[{idx}]"));
                                }
                            }
                            PathSegment::Wildcard => {
                                if let Some(last) = flat_segments.last_mut() {
                                    last.push_str("[*]");
                                }
                            }
                        }
                    }
                    let flat = self.env.resolve_field(&flat_segments);
                    if !matches!(flat, FelValue::Null) {
                        return flat;
                    }
                }
                if remaining_path.is_empty() {
                    base
                } else {
                    self.access_path(base, &remaining_path)
                }
            }
        }
    }

    fn access_path(&mut self, mut current: FelValue, path: &[PathSegment]) -> FelValue {
        for (i, seg) in path.iter().enumerate() {
            match seg {
                PathSegment::Dot(name) => match &current {
                    FelValue::Object(entries) => {
                        current = entries
                            .iter()
                            .find(|(k, _)| k == name)
                            .map(|(_, v)| v.clone())
                            .unwrap_or(FelValue::Null);
                    }
                    FelValue::Null => return FelValue::Null,
                    _ => {
                        self.diag(format!("cannot access '{name}' on {}", current.type_name()));
                        return FelValue::Null;
                    }
                },
                PathSegment::Index(idx) => match &current {
                    FelValue::Array(arr) => {
                        if *idx == 0 || *idx > arr.len() {
                            self.diag(format!("index {idx} out of bounds (len {})", arr.len()));
                            return FelValue::Null;
                        }
                        current = arr[*idx - 1].clone();
                    }
                    FelValue::Null => return FelValue::Null,
                    _ => {
                        self.diag(format!("cannot index into {}", current.type_name()));
                        return FelValue::Null;
                    }
                },
                PathSegment::Wildcard => match &current {
                    FelValue::Array(arr) => {
                        let remaining = &path[i + 1..];
                        if remaining.is_empty() {
                            return current;
                        }
                        return FelValue::Array(
                            arr.iter()
                                .map(|e| self.access_path(e.clone(), remaining))
                                .collect(),
                        );
                    }
                    FelValue::Null => return FelValue::Null,
                    _ => {
                        self.diag(format!("cannot wildcard on {}", current.type_name()));
                        return FelValue::Null;
                    }
                },
            }
        }
        current
    }

    // ── Unary operators ─────────────────────────────────────────

    fn eval_unary(&mut self, op: UnaryOp, val: FelValue) -> FelValue {
        match op {
            UnaryOp::Not => match val {
                FelValue::Null => FelValue::Null,
                FelValue::Boolean(b) => FelValue::Boolean(!b),
                _ => {
                    self.diag(format!("cannot apply 'not' to {}", val.type_name()));
                    FelValue::Null
                }
            },
            UnaryOp::Neg => match &val {
                FelValue::Null => FelValue::Null,
                FelValue::Number(n) => FelValue::Number(-n),
                FelValue::Array(arr) => {
                    FelValue::Array(arr.iter().map(|v| self.eval_unary(op, v.clone())).collect())
                }
                _ => {
                    self.diag(format!("cannot negate {}", val.type_name()));
                    FelValue::Null
                }
            },
        }
    }

    // ── Binary operators ────────────────────────────────────────

    fn eval_binary(&mut self, op: BinaryOp, left_expr: &Expr, right_expr: &Expr) -> FelValue {
        // Short-circuit for logical ops
        match op {
            BinaryOp::And => {
                let left = self.eval(left_expr);
                if left.is_null() {
                    return FelValue::Null;
                }
                let left_bool = match left {
                    FelValue::Boolean(b) => b,
                    other => {
                        self.diag(format!("cannot apply 'and' to {}", other.type_name()));
                        return FelValue::Null;
                    }
                };
                if !left_bool {
                    return FelValue::Boolean(false);
                }
                let right = self.eval(right_expr);
                if right.is_null() {
                    return FelValue::Null;
                }
                return match right {
                    FelValue::Boolean(b) => FelValue::Boolean(b),
                    other => {
                        self.diag(format!("cannot apply 'and' to {}", other.type_name()));
                        FelValue::Null
                    }
                };
            }
            BinaryOp::Or => {
                let left = self.eval(left_expr);
                if left.is_null() {
                    return FelValue::Null;
                }
                let left_bool = match left {
                    FelValue::Boolean(b) => b,
                    other => {
                        self.diag(format!("cannot apply 'or' to {}", other.type_name()));
                        return FelValue::Null;
                    }
                };
                if left_bool {
                    return FelValue::Boolean(true);
                }
                let right = self.eval(right_expr);
                if right.is_null() {
                    return FelValue::Null;
                }
                return match right {
                    FelValue::Boolean(b) => FelValue::Boolean(b),
                    other => {
                        self.diag(format!("cannot apply 'or' to {}", other.type_name()));
                        FelValue::Null
                    }
                };
            }
            _ => {}
        }

        let left = self.eval(left_expr);
        let right = self.eval(right_expr);

        // Equality does NOT propagate null
        match op {
            BinaryOp::Eq => return self.eval_equality(&left, &right),
            BinaryOp::NotEq => {
                return match self.eval_equality(&left, &right) {
                    FelValue::Boolean(b) => FelValue::Boolean(!b),
                    other => other,
                };
            }
            _ => {}
        }

        // Array broadcasting
        match (&left, &right) {
            (FelValue::Array(la), FelValue::Array(ra)) => {
                if la.len() != ra.len() {
                    self.diag(format!(
                        "array length mismatch: {} vs {}",
                        la.len(),
                        ra.len()
                    ));
                    return FelValue::Null;
                }
                return FelValue::Array(
                    la.iter()
                        .zip(ra.iter())
                        .map(|(l, r)| self.apply_binary(op, l, r))
                        .collect(),
                );
            }
            (FelValue::Array(la), _) => {
                return FelValue::Array(
                    la.iter()
                        .map(|l| self.apply_binary(op, l, &right))
                        .collect(),
                );
            }
            (_, FelValue::Array(ra)) => {
                return FelValue::Array(
                    ra.iter().map(|r| self.apply_binary(op, &left, r)).collect(),
                );
            }
            _ => {}
        }

        self.apply_binary(op, &left, &right)
    }

    fn apply_binary(&mut self, op: BinaryOp, left: &FelValue, right: &FelValue) -> FelValue {
        if left.is_null() || right.is_null() {
            return FelValue::Null;
        }

        match op {
            BinaryOp::Add => self.num_op(left, right, "+", |a, b| a + b),
            BinaryOp::Sub => self.num_op(left, right, "-", |a, b| a - b),
            BinaryOp::Mul => self.num_op(left, right, "*", |a, b| a * b),
            BinaryOp::Div => {
                if let (FelValue::Number(a), FelValue::Number(b)) = (left, right) {
                    if b.is_zero() {
                        self.diag("division by zero");
                        FelValue::Null
                    } else {
                        FelValue::Number(a / b)
                    }
                } else if let (FelValue::Money(m), FelValue::Number(n)) = (left, right) {
                    if n.is_zero() {
                        self.diag("division by zero");
                        FelValue::Null
                    } else {
                        FelValue::Money(FelMoney {
                            amount: m.amount / n,
                            currency: m.currency.clone(),
                        })
                    }
                } else if let (FelValue::Money(a), FelValue::Money(b)) = (left, right) {
                    if a.currency != b.currency {
                        self.diag(format!(
                            "currency mismatch: {} vs {}",
                            a.currency, b.currency
                        ));
                        FelValue::Null
                    } else if b.amount.is_zero() {
                        self.diag("division by zero");
                        FelValue::Null
                    } else {
                        FelValue::Number(a.amount / b.amount)
                    }
                } else {
                    self.diag(format!(
                        "cannot divide {} by {}",
                        left.type_name(),
                        right.type_name()
                    ));
                    FelValue::Null
                }
            }
            BinaryOp::Mod => {
                if let (FelValue::Number(a), FelValue::Number(b)) = (left, right) {
                    if b.is_zero() {
                        self.diag("modulo by zero");
                        FelValue::Null
                    } else {
                        FelValue::Number(a % b)
                    }
                } else if let (FelValue::Money(m), FelValue::Number(n)) = (left, right) {
                    if n.is_zero() {
                        self.diag("modulo by zero");
                        FelValue::Null
                    } else {
                        FelValue::Money(FelMoney {
                            amount: m.amount % n,
                            currency: m.currency.clone(),
                        })
                    }
                } else {
                    self.diag(format!(
                        "cannot modulo {} by {}",
                        left.type_name(),
                        right.type_name()
                    ));
                    FelValue::Null
                }
            }
            BinaryOp::Concat => {
                if let (FelValue::String(a), FelValue::String(b)) = (left, right) {
                    FelValue::String(format!("{a}{b}"))
                } else {
                    self.diag(format!(
                        "cannot concat {} and {}",
                        left.type_name(),
                        right.type_name()
                    ));
                    FelValue::Null
                }
            }
            BinaryOp::Lt => self.compare(left, right, |o| o.is_lt()),
            BinaryOp::Gt => self.compare(left, right, |o| o.is_gt()),
            BinaryOp::LtEq => self.compare(left, right, |o| o.is_le()),
            BinaryOp::GtEq => self.compare(left, right, |o| o.is_ge()),
            BinaryOp::Eq | BinaryOp::NotEq | BinaryOp::And | BinaryOp::Or => {
                unreachable!("handled above")
            }
        }
    }

    fn num_op(
        &mut self,
        left: &FelValue,
        right: &FelValue,
        sym: &str,
        f: fn(Decimal, Decimal) -> Decimal,
    ) -> FelValue {
        match (left, right) {
            (FelValue::Number(a), FelValue::Number(b)) => FelValue::Number(f(*a, *b)),
            (FelValue::Money(a), FelValue::Money(b)) if sym == "+" || sym == "-" => {
                if a.currency != b.currency {
                    self.diag(format!(
                        "currency mismatch: {} vs {}",
                        a.currency, b.currency
                    ));
                    FelValue::Null
                } else {
                    FelValue::Money(FelMoney {
                        amount: f(a.amount, b.amount),
                        currency: a.currency.clone(),
                    })
                }
            }
            (FelValue::Money(m), FelValue::Number(n)) if sym == "+" || sym == "-" => {
                FelValue::Money(FelMoney {
                    amount: f(m.amount, *n),
                    currency: m.currency.clone(),
                })
            }
            (FelValue::Money(m), FelValue::Number(n)) if sym == "*" => FelValue::Money(FelMoney {
                amount: m.amount * n,
                currency: m.currency.clone(),
            }),
            (FelValue::Number(n), FelValue::Money(m)) if sym == "*" => FelValue::Money(FelMoney {
                amount: *n * m.amount,
                currency: m.currency.clone(),
            }),
            _ => {
                self.diag(format!(
                    "cannot apply '{sym}' to {} and {}",
                    left.type_name(),
                    right.type_name()
                ));
                FelValue::Null
            }
        }
    }

    fn eval_equality(&mut self, left: &FelValue, right: &FelValue) -> FelValue {
        match (left, right) {
            (FelValue::Null, FelValue::Null) => FelValue::Boolean(true),
            (FelValue::Null, _) | (_, FelValue::Null) => FelValue::Boolean(false),
            (FelValue::Boolean(a), FelValue::Boolean(b)) => FelValue::Boolean(a == b),
            (FelValue::Number(a), FelValue::Number(b)) => FelValue::Boolean(a == b),
            (FelValue::String(a), FelValue::String(b)) => FelValue::Boolean(a == b),
            (FelValue::Date(a), FelValue::Date(b)) => FelValue::Boolean(a == b),
            (FelValue::Money(a), FelValue::Money(b)) => {
                FelValue::Boolean(a.currency == b.currency && a.amount == b.amount)
            }
            (FelValue::Array(a), FelValue::Array(b)) => {
                if a.len() != b.len() {
                    return FelValue::Boolean(false);
                }
                for (av, bv) in a.iter().zip(b.iter()) {
                    if !matches!(self.eval_equality(av, bv), FelValue::Boolean(true)) {
                        return FelValue::Boolean(false);
                    }
                }
                FelValue::Boolean(true)
            }
            (FelValue::Object(a), FelValue::Object(b)) => FelValue::Boolean(a == b),
            _ => {
                self.diag(format!(
                    "cannot compare {} with {}",
                    left.type_name(),
                    right.type_name()
                ));
                FelValue::Null
            }
        }
    }

    fn compare(
        &mut self,
        left: &FelValue,
        right: &FelValue,
        check: fn(std::cmp::Ordering) -> bool,
    ) -> FelValue {
        let ord = match (left, right) {
            (FelValue::Number(a), FelValue::Number(b)) => a.cmp(b),
            (FelValue::String(a), FelValue::String(b)) => a.cmp(b),
            (FelValue::Date(a), FelValue::Date(b)) => a.ordinal().cmp(&b.ordinal()),
            // 9f: Money vs Number comparison — specific diagnostic with fix suggestion
            (FelValue::Money(_), FelValue::Number(_))
            | (FelValue::Number(_), FelValue::Money(_)) => {
                self.diag("Type error: cannot compare money with number directly. Use moneyAmount($field) to extract the numeric amount.");
                return FelValue::Null;
            }
            // Money vs Money ordering — only equality is supported
            (FelValue::Money(_), FelValue::Money(_)) => {
                self.diag("Type error: cannot order money values directly. Use moneyAmount($field) to extract the numeric amount for ordering comparisons.");
                return FelValue::Null;
            }
            _ => {
                self.diag(format!(
                    "cannot compare {} with {}",
                    left.type_name(),
                    right.type_name()
                ));
                return FelValue::Null;
            }
        };
        FelValue::Boolean(check(ord))
    }

    fn eval_membership(&mut self, value: FelValue, container: FelValue, negated: bool) -> FelValue {
        match &container {
            FelValue::Array(arr) => {
                let found = arr
                    .iter()
                    .any(|e| matches!(self.eval_equality(&value, e), FelValue::Boolean(true)));
                FelValue::Boolean(if negated { !found } else { found })
            }
            FelValue::Null => FelValue::Null,
            _ => {
                self.diag(format!(
                    "membership requires array, got {}",
                    container.type_name()
                ));
                FelValue::Null
            }
        }
    }

    // ── Standard library functions ──────────────────────────────

    fn eval_function(&mut self, name: &str, args: &[Expr]) -> FelValue {
        match name {
            // Aggregates
            "sum" => self.fn_aggregate(args, "sum", |nums| nums.iter().copied().sum()),
            "count" => {
                let v = self.eval_arg(args, 0);
                self.fn_count(&v)
            }
            "avg" => self.fn_aggregate(args, "avg", |nums| {
                if nums.is_empty() {
                    Decimal::ZERO
                } else {
                    nums.iter().copied().sum::<Decimal>() / Decimal::from(nums.len() as i64)
                }
            }),
            "min" => self.fn_min_max(args, true),
            "max" => self.fn_min_max(args, false),
            "countWhere" => self.fn_count_where(args),
            "sumWhere" => self.fn_sum_where(args),
            "avgWhere" => self.fn_avg_where(args),
            "minWhere" => self.fn_min_where(args),
            "maxWhere" => self.fn_max_where(args),

            // String
            "length" => self.fn_length(args),
            "contains" => self.fn_str2(args, "contains", |s, sub| {
                FelValue::Boolean(s.contains(sub))
            }),
            "startsWith" => self.fn_str2(args, "startsWith", |s, p| {
                FelValue::Boolean(s.starts_with(p))
            }),
            "endsWith" => self.fn_str2(args, "endsWith", |s, p| FelValue::Boolean(s.ends_with(p))),
            "substring" => self.fn_substring(args),
            "replace" => self.fn_replace(args),
            "upper" => self.fn_str1(args, |s| FelValue::String(s.to_uppercase())),
            "lower" => self.fn_str1(args, |s| FelValue::String(s.to_lowercase())),
            "trim" => self.fn_str1(args, |s| FelValue::String(s.trim().to_string())),
            "matches" => self.fn_matches(args),
            "format" => self.fn_format(args),

            // Numeric
            "round" => self.fn_round(args),
            "floor" => self.fn_num1(args, |n| n.floor()),
            "ceil" => self.fn_num1(args, |n| n.ceil()),
            "abs" => self.fn_num1(args, |n| n.abs()),
            "power" => self.fn_power(args),

            // Date
            "today" => self.fn_today(),
            "now" => self.fn_now(),
            "year" => self.fn_date_part(args, |d| dec(d.year() as i64)),
            "month" => self.fn_date_part(args, |d| dec(d.month() as i64)),
            "day" => self.fn_date_part(args, |d| dec(d.day() as i64)),
            "hours" => self.fn_time_part(args, 0),
            "minutes" => self.fn_time_part(args, 1),
            "seconds" => self.fn_time_part(args, 2),
            "time" => self.fn_time(args),
            "timeDiff" => self.fn_time_diff(args),
            "dateDiff" => self.fn_date_diff(args),
            "dateAdd" => self.fn_date_add(args),

            // Logical
            "if" => self.fn_if(args),
            "coalesce" => self.fn_coalesce(args),
            "empty" => self.fn_empty(args),
            "present" => {
                let e = self.fn_empty(args);
                match e {
                    FelValue::Boolean(b) => FelValue::Boolean(!b),
                    o => o,
                }
            }
            "selected" => self.fn_selected(args),

            // Type checking
            "isNumber" => self.fn_is_type(args, "number"),
            "isString" => self.fn_is_type(args, "string"),
            "isDate" => self.fn_is_type(args, "date"),
            "isNull" => {
                let v = self.eval_arg(args, 0);
                FelValue::Boolean(v.is_null())
            }
            "typeOf" => {
                let v = self.eval_arg(args, 0);
                FelValue::String(v.type_name().to_string())
            }

            // Casting
            "number" => self.fn_cast_number(args),
            "string" => self.fn_cast_string(args),
            "boolean" => self.fn_cast_boolean(args),
            "date" => self.fn_cast_date(args),

            // Money
            "money" => self.fn_money(args),
            "moneyAmount" => {
                let v = self.eval_arg(args, 0);
                match v {
                    FelValue::Money(m) => FelValue::Number(m.amount),
                    _ => FelValue::Null,
                }
            }
            "moneyCurrency" => {
                let v = self.eval_arg(args, 0);
                match v {
                    FelValue::Money(m) => FelValue::String(m.currency),
                    _ => FelValue::Null,
                }
            }
            "moneyAdd" => self.fn_money_add(args),
            "moneySum" => self.fn_money_sum(args),
            "moneySumWhere" => self.fn_money_sum_where(args),

            // MIP state queries
            "valid" => self.fn_mip(args, "valid"),
            "relevant" => self.fn_mip(args, "relevant"),
            "readonly" => self.fn_mip(args, "readonly"),
            "required" => self.fn_mip(args, "required"),

            // Repeat navigation
            "prev" => self.env.repeat_prev(),
            "next" => self.env.repeat_next(),
            "parent" => self.env.repeat_parent(),
            "instance" => self.fn_instance(args),

            // Locale
            "locale" => self.fn_locale(),
            "runtimeMeta" => self.fn_runtime_meta(args),
            "pluralCategory" => self.fn_plural_category(args),

            _ => {
                self.diag(format!("undefined function: {name}"));
                FelValue::Null
            }
        }
    }

    fn eval_arg(&mut self, args: &[Expr], idx: usize) -> FelValue {
        if idx < args.len() {
            self.eval(&args[idx])
        } else {
            FelValue::Null
        }
    }

    fn get_array(&mut self, val: &FelValue, fn_name: &str) -> Option<Vec<FelValue>> {
        match val {
            FelValue::Array(a) => Some(a.clone()),
            FelValue::Null => None,
            _ => {
                self.diag(format!(
                    "{fn_name}: expected array, got {}",
                    val.type_name()
                ));
                None
            }
        }
    }

    // ── Aggregate helpers ───────────────────────────────────────

    fn fn_aggregate(
        &mut self,
        args: &[Expr],
        name: &str,
        f: fn(&[Decimal]) -> Decimal,
    ) -> FelValue {
        let val = self.eval_arg(args, 0);
        let arr = match self.get_array(&val, name) {
            Some(a) => a,
            None => return FelValue::Null,
        };
        if name == "sum" {
            let non_null: Vec<&FelValue> = arr.iter().filter(|v| !v.is_null()).collect();
            if !non_null.is_empty() && non_null.iter().all(|v| matches!(v, FelValue::Money(_))) {
                let total = non_null.iter().fold(Decimal::ZERO, |acc, value| {
                    acc + match value {
                        FelValue::Money(m) => m.amount,
                        _ => Decimal::ZERO,
                    }
                });
                return FelValue::Number(total);
            }
        }
        let nums: Vec<Decimal> = arr.iter().filter_map(|v| v.as_number()).collect();
        if nums.is_empty() && name == "avg" {
            self.diag(format!("{name}: no numeric elements"));
            return FelValue::Null;
        }
        FelValue::Number(f(&nums))
    }

    fn fn_count(&mut self, val: &FelValue) -> FelValue {
        match val {
            FelValue::Array(a) => {
                FelValue::Number(dec(a.iter().filter(|v| !v.is_null()).count() as i64))
            }
            FelValue::Null => FelValue::Null,
            _ => FelValue::Null,
        }
    }

    fn fn_min_max(&mut self, args: &[Expr], is_min: bool) -> FelValue {
        let name = if is_min { "min" } else { "max" };

        // Variadic scalar form: min(a, b, ...) — evaluate all args as an implicit array
        if args.len() >= 2 {
            let vals: Vec<FelValue> = args.iter().map(|a| self.eval(a)).collect();
            let non_null: Vec<&FelValue> = vals.iter().filter(|v| !v.is_null()).collect();
            if non_null.is_empty() {
                return FelValue::Null;
            }
            let mut best = non_null[0].clone();
            for elem in &non_null[1..] {
                let cmp = match (&best, *elem) {
                    (FelValue::Number(a), FelValue::Number(b)) => Some(a.cmp(b)),
                    (FelValue::String(a), FelValue::String(b)) => Some(a.cmp(b)),
                    (FelValue::Date(a), FelValue::Date(b)) => Some(a.ordinal().cmp(&b.ordinal())),
                    _ => {
                        self.diag(format!("{name}: mixed types"));
                        return FelValue::Null;
                    }
                };
                if let Some(ord) = cmp
                    && ((is_min && ord.is_gt()) || (!is_min && ord.is_lt()))
                {
                    best = (*elem).clone();
                }
            }
            return best;
        }

        // Aggregate form: min([1, 2, 3])
        let val = self.eval_arg(args, 0);
        let arr = match self.get_array(&val, name) {
            Some(a) => a,
            None => return FelValue::Null,
        };
        let non_null: Vec<&FelValue> = arr.iter().filter(|v| !v.is_null()).collect();
        if non_null.is_empty() {
            return FelValue::Null;
        }
        let mut best = non_null[0].clone();
        for elem in &non_null[1..] {
            let cmp = match (&best, *elem) {
                (FelValue::Number(a), FelValue::Number(b)) => Some(a.cmp(b)),
                (FelValue::String(a), FelValue::String(b)) => Some(a.cmp(b)),
                (FelValue::Date(a), FelValue::Date(b)) => Some(a.ordinal().cmp(&b.ordinal())),
                _ => {
                    self.diag(format!("{name}: mixed types"));
                    return FelValue::Null;
                }
            };
            if let Some(ord) = cmp
                && ((is_min && ord.is_gt()) || (!is_min && ord.is_lt()))
            {
                best = (*elem).clone();
            }
        }
        best
    }

    fn fn_count_where(&mut self, args: &[Expr]) -> FelValue {
        if args.len() < 2 {
            self.diag("countWhere: requires 2 arguments");
            return FelValue::Null;
        }
        let arr_val = self.eval(&args[0]);
        let arr = match self.get_array(&arr_val, "countWhere") {
            Some(a) => a,
            None => return FelValue::Null,
        };
        let mut count = 0i64;
        for elem in &arr {
            self.let_scopes
                .push(HashMap::from([("$".to_string(), elem.clone())]));
            let pred = self.eval(&args[1]);
            self.let_scopes.pop();
            if pred.is_truthy() {
                count += 1;
            }
        }
        FelValue::Number(dec(count))
    }

    /// Filter array elements by predicate (shared by *Where functions).
    fn filter_where(&mut self, args: &[Expr], fn_name: &str) -> Option<Vec<FelValue>> {
        if args.len() < 2 {
            self.diag(format!("{fn_name}: requires 2 arguments"));
            return None;
        }
        let arr_val = self.eval(&args[0]);
        let arr = self.get_array(&arr_val, fn_name)?;
        let mut matched = Vec::new();
        for elem in &arr {
            self.let_scopes
                .push(HashMap::from([("$".to_string(), elem.clone())]));
            let pred = self.eval(&args[1]);
            self.let_scopes.pop();
            if pred.is_truthy() {
                matched.push(elem.clone());
            }
        }
        Some(matched)
    }

    fn fn_sum_where(&mut self, args: &[Expr]) -> FelValue {
        let Some(matched) = self.filter_where(args, "sumWhere") else {
            return FelValue::Null;
        };
        let nums: Vec<Decimal> = matched.iter().filter_map(|v| v.as_number()).collect();
        FelValue::Number(nums.iter().copied().sum())
    }

    fn fn_avg_where(&mut self, args: &[Expr]) -> FelValue {
        let Some(matched) = self.filter_where(args, "avgWhere") else {
            return FelValue::Null;
        };
        let nums: Vec<Decimal> = matched.iter().filter_map(|v| v.as_number()).collect();
        if nums.is_empty() {
            return FelValue::Null;
        }
        FelValue::Number(nums.iter().copied().sum::<Decimal>() / Decimal::from(nums.len() as i64))
    }

    fn fn_min_where(&mut self, args: &[Expr]) -> FelValue {
        let Some(matched) = self.filter_where(args, "minWhere") else {
            return FelValue::Null;
        };
        let non_null: Vec<&FelValue> = matched.iter().filter(|v| !v.is_null()).collect();
        if non_null.is_empty() {
            return FelValue::Null;
        }
        let mut best = non_null[0].clone();
        for elem in &non_null[1..] {
            let cmp = match (&best, *elem) {
                (FelValue::Number(a), FelValue::Number(b)) => Some(a.cmp(b)),
                (FelValue::String(a), FelValue::String(b)) => Some(a.cmp(b)),
                (FelValue::Date(a), FelValue::Date(b)) => Some(a.ordinal().cmp(&b.ordinal())),
                _ => {
                    self.diag("minWhere: mixed types".to_string());
                    return FelValue::Null;
                }
            };
            if let Some(ord) = cmp
                && ord.is_gt()
            {
                best = (*elem).clone();
            }
        }
        best
    }

    fn fn_max_where(&mut self, args: &[Expr]) -> FelValue {
        let Some(matched) = self.filter_where(args, "maxWhere") else {
            return FelValue::Null;
        };
        let non_null: Vec<&FelValue> = matched.iter().filter(|v| !v.is_null()).collect();
        if non_null.is_empty() {
            return FelValue::Null;
        }
        let mut best = non_null[0].clone();
        for elem in &non_null[1..] {
            let cmp = match (&best, *elem) {
                (FelValue::Number(a), FelValue::Number(b)) => Some(a.cmp(b)),
                (FelValue::String(a), FelValue::String(b)) => Some(a.cmp(b)),
                (FelValue::Date(a), FelValue::Date(b)) => Some(a.ordinal().cmp(&b.ordinal())),
                _ => {
                    self.diag("maxWhere: mixed types".to_string());
                    return FelValue::Null;
                }
            };
            if let Some(ord) = cmp
                && ord.is_lt()
            {
                best = (*elem).clone();
            }
        }
        best
    }

    fn fn_money_sum_where(&mut self, args: &[Expr]) -> FelValue {
        let Some(matched) = self.filter_where(args, "moneySumWhere") else {
            return FelValue::Null;
        };
        let mut total: Option<FelMoney> = None;
        for elem in &matched {
            match elem {
                FelValue::Money(m) => match &total {
                    None => total = Some(m.clone()),
                    Some(t) => {
                        if t.currency != m.currency {
                            self.diag("moneySumWhere: mixed currencies");
                            return FelValue::Null;
                        }
                        total = Some(FelMoney {
                            amount: t.amount + m.amount,
                            currency: t.currency.clone(),
                        });
                    }
                },
                FelValue::Null => {}
                _ => {
                    self.diag("moneySumWhere: non-money element");
                    return FelValue::Null;
                }
            }
        }
        match total {
            Some(t) => FelValue::Money(t),
            None => FelValue::Null,
        }
    }

    // ── String helpers ──────────────────────────────────────────

    fn fn_str1(&mut self, args: &[Expr], f: fn(&str) -> FelValue) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::String(s) => f(&s),
            FelValue::Null => FelValue::Null,
            _ => FelValue::Null,
        }
    }

    fn fn_str2(&mut self, args: &[Expr], _name: &str, f: fn(&str, &str) -> FelValue) -> FelValue {
        let s = match self.eval_arg(args, 0) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let s2 = match self.eval_arg(args, 1) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        f(&s, &s2)
    }

    fn fn_length(&mut self, args: &[Expr]) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::String(s) => FelValue::Number(dec(s.chars().count() as i64)),
            FelValue::Array(a) => FelValue::Number(dec(a.len() as i64)),
            FelValue::Null => FelValue::Number(Decimal::ZERO),
            _ => FelValue::Null,
        }
    }

    fn fn_substring(&mut self, args: &[Expr]) -> FelValue {
        let s = match self.eval_arg(args, 0) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let start = match self.eval_arg(args, 1) {
            FelValue::Number(n) => n.to_i64().unwrap_or(1).max(1) as usize,
            _ => return FelValue::Null,
        };
        let chars: Vec<char> = s.chars().collect();
        let start_idx = start.saturating_sub(1);
        if args.len() > 2 {
            let len = match self.eval_arg(args, 2) {
                FelValue::Number(n) => n.to_i64().unwrap_or(0).max(0) as usize,
                _ => return FelValue::Null,
            };
            let end = (start_idx + len).min(chars.len());
            FelValue::String(chars[start_idx.min(chars.len())..end].iter().collect())
        } else {
            FelValue::String(chars[start_idx.min(chars.len())..].iter().collect())
        }
    }

    fn fn_replace(&mut self, args: &[Expr]) -> FelValue {
        let s = match self.eval_arg(args, 0) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let old = match self.eval_arg(args, 1) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let new = match self.eval_arg(args, 2) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        FelValue::String(s.replace(&old, &new))
    }

    fn fn_matches(&mut self, args: &[Expr]) -> FelValue {
        let s = match self.eval_arg(args, 0) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let pattern = match self.eval_arg(args, 1) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        match RegexBuilder::new(&pattern).size_limit(1_000_000).build() {
            Ok(re) => FelValue::Boolean(re.is_match(&s)),
            Err(e) => {
                self.diag(format!(
                    "matches: invalid regex pattern '{}': {}",
                    pattern, e
                ));
                FelValue::Null
            }
        }
    }

    fn fn_format(&mut self, args: &[Expr]) -> FelValue {
        if args.is_empty() {
            return FelValue::Null;
        }
        let template = match self.eval(&args[0]) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let values: Vec<String> = args[1..]
            .iter()
            .map(|arg| self.eval(arg).to_string())
            .collect();
        let mut result = template;
        for (i, value) in values.iter().enumerate() {
            result = result.replace(&format!("{{{i}}}"), value);
        }
        if result.contains("%s") {
            let mut sequential = String::with_capacity(result.len());
            let mut rest = result.as_str();
            let mut value_index = 0usize;
            while let Some(pos) = rest.find("%s") {
                sequential.push_str(&rest[..pos]);
                if let Some(value) = values.get(value_index) {
                    sequential.push_str(value);
                    value_index += 1;
                } else {
                    sequential.push_str("%s");
                }
                rest = &rest[pos + 2..];
            }
            sequential.push_str(rest);
            result = sequential;
        }
        FelValue::String(result)
    }

    // ── Numeric helpers ─────────────────────────────────────────

    fn fn_num1(&mut self, args: &[Expr], f: fn(Decimal) -> Decimal) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::Number(n) => FelValue::Number(f(n)),
            FelValue::Null => FelValue::Null,
            _ => FelValue::Null,
        }
    }

    fn fn_round(&mut self, args: &[Expr]) -> FelValue {
        let n = match self.eval_arg(args, 0) {
            FelValue::Number(n) => n,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let precision = if args.len() > 1 {
            match self.eval_arg(args, 1) {
                FelValue::Number(p) => p.to_i32().unwrap_or(0),
                _ => 0,
            }
        } else {
            0
        };
        // Banker's rounding (round half to even) — native in rust_decimal
        let rounded = n.round_dp_with_strategy(
            precision.max(0) as u32,
            rust_decimal::RoundingStrategy::MidpointNearestEven,
        );
        FelValue::Number(rounded)
    }

    fn fn_power(&mut self, args: &[Expr]) -> FelValue {
        let base = match self.eval_arg(args, 0) {
            FelValue::Number(n) => n,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let exp = match self.eval_arg(args, 1) {
            FelValue::Number(n) => n,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        // For non-negative integer exponents, use repeated multiplication
        if let Some(exp_u64) = exp.to_u64() {
            let mut result = Decimal::ONE;
            for _ in 0..exp_u64 {
                result = match result.checked_mul(base) {
                    Some(r) => r,
                    None => {
                        self.diag("power: overflow");
                        return FelValue::Null;
                    }
                };
            }
            return FelValue::Number(result);
        }
        // Negative or fractional exponent: fall back to f64 and convert back
        let base_f = base.to_f64().unwrap_or(0.0);
        let exp_f = exp.to_f64().unwrap_or(0.0);
        let result = base_f.powf(exp_f);
        if result.is_finite() {
            match Decimal::from_f64(result) {
                Some(d) => FelValue::Number(d),
                None => {
                    self.diag("power: overflow");
                    FelValue::Null
                }
            }
        } else {
            self.diag("power: overflow");
            FelValue::Null
        }
    }

    // ── Date helpers ────────────────────────────────────────────

    fn fn_today(&self) -> FelValue {
        self.env
            .current_date()
            .map(FelValue::Date)
            .unwrap_or(FelValue::Null)
    }

    fn fn_now(&self) -> FelValue {
        self.env
            .current_datetime()
            .map(FelValue::Date)
            .unwrap_or(FelValue::Null)
    }

    fn fn_date_part(&mut self, args: &[Expr], f: fn(&FelDate) -> Decimal) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::Date(d) => FelValue::Number(f(&d)),
            FelValue::String(s) => match self.coerce_string_to_date(&s) {
                Some(d) => FelValue::Number(f(&d)),
                None => FelValue::Null,
            },
            FelValue::Null => FelValue::Null,
            _ => FelValue::Null,
        }
    }

    fn fn_time_part(&mut self, args: &[Expr], idx: usize) -> FelValue {
        let s = match self.eval_arg(args, 0) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            _ => return FelValue::Null,
        };
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() != 3 {
            self.diag("invalid time string");
            return FelValue::Null;
        }
        match parts.get(idx).and_then(|p| p.parse::<Decimal>().ok()) {
            Some(n) => FelValue::Number(n),
            None => FelValue::Null,
        }
    }

    fn fn_time(&mut self, args: &[Expr]) -> FelValue {
        let h = match self.eval_arg(args, 0) {
            FelValue::Number(n) => n.to_i64().unwrap_or(0),
            _ => return FelValue::Null,
        };
        let m = match self.eval_arg(args, 1) {
            FelValue::Number(n) => n.to_i64().unwrap_or(0),
            _ => return FelValue::Null,
        };
        let s = match self.eval_arg(args, 2) {
            FelValue::Number(n) => n.to_i64().unwrap_or(0),
            _ => return FelValue::Null,
        };
        FelValue::String(format!("{h:02}:{m:02}:{s:02}"))
    }

    fn fn_time_diff(&mut self, args: &[Expr]) -> FelValue {
        let t1 = match self.eval_arg(args, 0) {
            FelValue::String(s) => s,
            _ => return FelValue::Null,
        };
        let t2 = match self.eval_arg(args, 1) {
            FelValue::String(s) => s,
            _ => return FelValue::Null,
        };
        match (parse_time_str(&t1), parse_time_str(&t2)) {
            (Some((h1, m1, s1)), Some((h2, m2, s2))) => {
                FelValue::Number(dec((h1 * 3600 + m1 * 60 + s1) - (h2 * 3600 + m2 * 60 + s2)))
            }
            _ => {
                self.diag("timeDiff: invalid time strings");
                FelValue::Null
            }
        }
    }

    fn fn_date_diff(&mut self, args: &[Expr]) -> FelValue {
        let d1 = match self.eval_arg(args, 0) {
            FelValue::Date(d) => d,
            FelValue::String(s) => match self.coerce_string_to_date(&s) {
                Some(d) => d,
                None => return FelValue::Null,
            },
            _ => return FelValue::Null,
        };
        let d2 = match self.eval_arg(args, 1) {
            FelValue::Date(d) => d,
            FelValue::String(s) => match self.coerce_string_to_date(&s) {
                Some(d) => d,
                None => return FelValue::Null,
            },
            _ => return FelValue::Null,
        };
        let unit = match self.eval_arg(args, 2) {
            FelValue::String(s) => s,
            _ => return FelValue::Null,
        };
        let result = match unit.as_str() {
            "days" => d1.ordinal_days() - d2.ordinal_days(),
            "months" => {
                (d1.year() as i64 * 12 + d1.month() as i64)
                    - (d2.year() as i64 * 12 + d2.month() as i64)
            }
            "years" => d1.year() as i64 - d2.year() as i64,
            _ => {
                self.diag(format!("dateDiff: unknown unit '{unit}'"));
                return FelValue::Null;
            }
        };
        FelValue::Number(dec(result))
    }

    fn fn_date_add(&mut self, args: &[Expr]) -> FelValue {
        let d = match self.eval_arg(args, 0) {
            FelValue::Date(d) => d,
            FelValue::String(s) => match self.coerce_string_to_date(&s) {
                Some(d) => d,
                None => return FelValue::Null,
            },
            _ => return FelValue::Null,
        };
        let n = match self.eval_arg(args, 1) {
            FelValue::Number(n) => n.to_i64().unwrap_or(0),
            _ => return FelValue::Null,
        };
        let unit = match self.eval_arg(args, 2) {
            FelValue::String(s) => s,
            _ => return FelValue::Null,
        };
        match unit.as_str() {
            "days" => FelValue::Date(date_add_days(&d, n)),
            "months" => {
                let total = d.year() as i64 * 12 + (d.month() as i64 - 1) + n;
                let new_year = (total.div_euclid(12)) as i32;
                let new_month = (total.rem_euclid(12) + 1) as u32;
                let max_day = days_in_month(new_year, new_month);
                let new_day = d.day().min(max_day);
                FelValue::Date(FelDate::Date {
                    year: new_year,
                    month: new_month,
                    day: new_day,
                })
            }
            "years" => {
                let new_year = d.year() + n as i32;
                let max_day = days_in_month(new_year, d.month());
                let new_day = d.day().min(max_day);
                FelValue::Date(FelDate::Date {
                    year: new_year,
                    month: d.month(),
                    day: new_day,
                })
            }
            _ => {
                self.diag(format!("dateAdd: unknown unit '{unit}'"));
                FelValue::Null
            }
        }
    }

    // ── Logical helpers ─────────────────────────────────────────

    fn fn_if(&mut self, args: &[Expr]) -> FelValue {
        if args.len() < 3 {
            self.diag("if: requires 3 arguments");
            return FelValue::Null;
        }
        let cond = self.eval(&args[0]);
        match cond {
            FelValue::Null => {
                self.diag("if: condition evaluated to null");
                FelValue::Null
            }
            FelValue::Boolean(true) => self.eval(&args[1]),
            FelValue::Boolean(false) => self.eval(&args[2]),
            _ => {
                self.diag(format!(
                    "if: condition must be boolean, got {}",
                    cond.type_name()
                ));
                FelValue::Null
            }
        }
    }

    fn fn_coalesce(&mut self, args: &[Expr]) -> FelValue {
        for arg in args {
            let val = self.eval(arg);
            if !val.is_null() {
                return val;
            }
        }
        FelValue::Null
    }

    fn fn_empty(&mut self, args: &[Expr]) -> FelValue {
        let val = self.eval_arg(args, 0);
        FelValue::Boolean(match &val {
            FelValue::Null => true,
            FelValue::String(s) => s.is_empty(),
            FelValue::Array(a) => a.is_empty(),
            _ => false,
        })
    }

    fn fn_selected(&mut self, args: &[Expr]) -> FelValue {
        let arr = match self.eval_arg(args, 0) {
            FelValue::Array(a) => a,
            _ => return FelValue::Boolean(false),
        };
        let val = self.eval_arg(args, 1);
        let found = arr
            .iter()
            .any(|e| matches!(self.eval_equality(e, &val), FelValue::Boolean(true)));
        FelValue::Boolean(found)
    }

    // ── Type checking ───────────────────────────────────────────

    fn fn_is_type(&mut self, args: &[Expr], type_name: &str) -> FelValue {
        let val = self.eval_arg(args, 0);
        FelValue::Boolean(val.type_name() == type_name)
    }

    // ── Casting ─────────────────────────────────────────────────

    fn fn_cast_number(&mut self, args: &[Expr]) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::Number(n) => FelValue::Number(n),
            FelValue::String(s) => match s.trim().parse::<Decimal>() {
                Ok(n) => FelValue::Number(n),
                Err(_) => {
                    self.diag(format!("number: cannot parse '{s}'"));
                    FelValue::Null
                }
            },
            FelValue::Boolean(b) => FelValue::Number(if b { Decimal::ONE } else { Decimal::ZERO }),
            FelValue::Null => FelValue::Null,
            v => {
                self.diag(format!("number: cannot convert {}", v.type_name()));
                FelValue::Null
            }
        }
    }

    fn fn_cast_string(&mut self, args: &[Expr]) -> FelValue {
        let val = self.eval_arg(args, 0);
        match &val {
            FelValue::Null => FelValue::String(String::new()),
            FelValue::String(_) => val,
            FelValue::Number(n) => FelValue::String(format_number(*n)),
            FelValue::Boolean(b) => FelValue::String(if *b { "true" } else { "false" }.into()),
            FelValue::Date(d) => FelValue::String(d.format_iso()),
            _ => FelValue::String(val.to_string()),
        }
    }

    fn fn_cast_boolean(&mut self, args: &[Expr]) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::Null => FelValue::Boolean(false),
            FelValue::Boolean(b) => FelValue::Boolean(b),
            FelValue::String(s) => match s.as_str() {
                "true" => FelValue::Boolean(true),
                "false" => FelValue::Boolean(false),
                _ => {
                    self.diag(format!("boolean: cannot convert '{s}'"));
                    FelValue::Null
                }
            },
            FelValue::Number(n) => {
                if n == Decimal::ZERO {
                    FelValue::Boolean(false)
                } else if n == Decimal::ONE {
                    FelValue::Boolean(true)
                } else {
                    self.diag(format!("boolean: cannot convert {n}"));
                    FelValue::Null
                }
            }
            v => {
                self.diag(format!("boolean: cannot convert {}", v.type_name()));
                FelValue::Null
            }
        }
    }

    fn fn_cast_date(&mut self, args: &[Expr]) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::Date(d) => FelValue::Date(d),
            FelValue::String(s) => {
                if let Some(d) = parse_date_literal(&format!("@{s}")) {
                    FelValue::Date(d)
                } else if let Some(d) = parse_datetime_literal(&format!("@{s}")) {
                    FelValue::Date(d)
                } else {
                    self.diag(format!("date: cannot parse '{s}'"));
                    FelValue::Null
                }
            }
            FelValue::Null => FelValue::Null,
            v => {
                self.diag(format!("date: cannot convert {}", v.type_name()));
                FelValue::Null
            }
        }
    }

    /// Try to coerce an ISO date/datetime string to FelDate. Returns None on failure.
    fn coerce_string_to_date(&self, s: &str) -> Option<FelDate> {
        parse_date_literal(&format!("@{s}")).or_else(|| parse_datetime_literal(&format!("@{s}")))
    }

    // ── Money helpers ───────────────────────────────────────────

    fn fn_money(&mut self, args: &[Expr]) -> FelValue {
        let amount = match self.eval_arg(args, 0) {
            FelValue::Number(n) => n,
            _ => return FelValue::Null,
        };
        let currency = match self.eval_arg(args, 1) {
            FelValue::String(s) => s,
            _ => return FelValue::Null,
        };
        FelValue::Money(FelMoney { amount, currency })
    }

    fn fn_money_add(&mut self, args: &[Expr]) -> FelValue {
        let a = match self.eval_arg(args, 0) {
            FelValue::Money(m) => m,
            _ => return FelValue::Null,
        };
        let b = match self.eval_arg(args, 1) {
            FelValue::Money(m) => m,
            _ => return FelValue::Null,
        };
        if a.currency != b.currency {
            self.diag("moneyAdd: currency mismatch");
            return FelValue::Null;
        }
        FelValue::Money(FelMoney {
            amount: a.amount + b.amount,
            currency: a.currency,
        })
    }

    fn fn_money_sum(&mut self, args: &[Expr]) -> FelValue {
        let val = self.eval_arg(args, 0);
        let arr = match self.get_array(&val, "moneySum") {
            Some(a) => a,
            None => return FelValue::Null,
        };
        let mut total: Option<FelMoney> = None;
        for elem in &arr {
            match elem {
                FelValue::Money(m) => match &total {
                    None => total = Some(m.clone()),
                    Some(t) => {
                        if t.currency != m.currency {
                            self.diag("moneySum: mixed currencies");
                            return FelValue::Null;
                        }
                        total = Some(FelMoney {
                            amount: t.amount + m.amount,
                            currency: t.currency.clone(),
                        });
                    }
                },
                FelValue::Null => {}
                _ => {
                    self.diag("moneySum: non-money element");
                    return FelValue::Null;
                }
            }
        }
        match total {
            Some(t) => FelValue::Money(t),
            None => FelValue::Null,
        }
    }

    fn fn_instance(&mut self, args: &[Expr]) -> FelValue {
        let name = match self.eval_arg(args, 0) {
            FelValue::String(s) => s,
            FelValue::Null => return FelValue::Null,
            other => {
                self.diag(format!(
                    "instance: first argument must be string, got {}",
                    other.type_name()
                ));
                return FelValue::Null;
            }
        };

        let tail = match args.get(1) {
            None => Vec::new(),
            Some(expr) => match self.eval(expr) {
                FelValue::String(path) => {
                    if path.is_empty() {
                        Vec::new()
                    } else {
                        path.split('.').map(|segment| segment.to_string()).collect()
                    }
                }
                FelValue::Null => return FelValue::Null,
                other => {
                    self.diag(format!(
                        "instance: path argument must be string, got {}",
                        other.type_name()
                    ));
                    return FelValue::Null;
                }
            },
        };

        self.env.resolve_context("instance", Some(&name), &tail)
    }

    // ── MIP state queries ───────────────────────────────────────

    fn fn_mip(&mut self, args: &[Expr], kind: &str) -> FelValue {
        if args.is_empty() {
            self.diag(format!("{kind}: requires 1 argument"));
            return FelValue::Null;
        }
        let path = extract_field_path(&args[0]);
        match kind {
            "valid" => self.env.mip_valid(&path),
            "relevant" => self.env.mip_relevant(&path),
            "readonly" => self.env.mip_readonly(&path),
            "required" => self.env.mip_required(&path),
            _ => FelValue::Null,
        }
    }

    // ── Locale functions ───────────────────────────────────────────

    /// `locale()` — returns the active locale code or null.
    fn fn_locale(&self) -> FelValue {
        match self.env.locale() {
            Some(code) => FelValue::String(code.to_string()),
            None => FelValue::Null,
        }
    }

    /// `runtimeMeta(key)` — reads from the runtime metadata bag.
    fn fn_runtime_meta(&mut self, args: &[Expr]) -> FelValue {
        let key = self.eval_arg(args, 0);
        match key {
            FelValue::String(k) => self.env.runtime_meta(&k),
            FelValue::Null => FelValue::Null,
            _ => {
                self.diag("runtimeMeta: key must be a string".to_string());
                FelValue::Null
            }
        }
    }

    /// `pluralCategory(count, locale?)` — returns CLDR cardinal plural category.
    ///
    /// Uses the explicit locale parameter if provided, otherwise the environment locale.
    /// Non-integer counts use the truncated integer part (toward zero), then cardinal rules apply to that integer.
    /// Returns one of: "zero", "one", "two", "few", "many", "other".
    fn fn_plural_category(&mut self, args: &[Expr]) -> FelValue {
        let count_val = self.eval_arg(args, 0);
        let count = match &count_val {
            FelValue::Number(n) => n,
            FelValue::Null => return FelValue::Null,
            _ => {
                self.diag("pluralCategory: count must be a number".to_string());
                return FelValue::Null;
            }
        };

        // Determine locale: explicit arg or environment
        let locale_code = if args.len() >= 2 {
            match self.eval_arg(args, 1) {
                FelValue::String(s) => Some(s),
                FelValue::Null => return FelValue::Null,
                _ => {
                    self.diag("pluralCategory: locale must be a string".to_string());
                    return FelValue::Null;
                }
            }
        } else {
            self.env.locale().map(|s| s.to_string())
        };

        let Some(locale_str) = locale_code else {
            return FelValue::Null;
        };

        let n = count.trunc().to_i64().unwrap_or(0);
        match fel_cardinal_plural_category(&locale_str, n) {
            Some(cat) => FelValue::String(cat.to_string()),
            None => FelValue::Null,
        }
    }
}

// ── Utility functions ───────────────────────────────────────────

fn extract_field_path(expr: &Expr) -> Vec<String> {
    match expr {
        Expr::FieldRef { name, path } => {
            let mut segs = Vec::new();
            if let Some(n) = name {
                segs.push(n.clone());
            }
            for seg in path {
                match seg {
                    PathSegment::Dot(n) => segs.push(n.clone()),
                    PathSegment::Index(idx) => {
                        if let Some(last) = segs.last_mut() {
                            last.push_str(&format!("[{idx}]"));
                        }
                    }
                    PathSegment::Wildcard => {
                        if let Some(last) = segs.last_mut() {
                            last.push_str("[*]");
                        }
                    }
                }
            }
            segs
        }
        _ => Vec::new(),
    }
}

fn parse_time_str(s: &str) -> Option<(i64, i64, i64)> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    Some((
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ))
}

/// BCP 47 tag for plural rules: empty host locale behaves like `en` (prior hand-rolled default).
fn language_id_for_plural_rules(locale_str: &str) -> LanguageIdentifier {
    let s = locale_str.trim();
    if s.is_empty() {
        return "en".parse().expect("en is valid BCP 47");
    }
    s.parse()
        .unwrap_or_else(|_| "en".parse().expect("en is valid BCP 47"))
}

/// Cardinal plural category string for FEL, using CLDR data from `intl_pluralrules`.
///
/// Unknown or unsupported locales fall back to English cardinal rules.
fn fel_cardinal_plural_category(locale_str: &str, n: i64) -> Option<&'static str> {
    let langid = language_id_for_plural_rules(locale_str);
    let rules = PluralRules::create(langid, PluralRuleType::CARDINAL).or_else(|_| {
        PluralRules::create(
            "en".parse::<LanguageIdentifier>()
                .expect("en is valid BCP 47"),
            PluralRuleType::CARDINAL,
        )
    });
    let pr = rules.ok()?;
    let cat = pr.select(n).ok()?;
    Some(plural_category_fel_name(cat))
}

fn plural_category_fel_name(cat: PluralCategory) -> &'static str {
    match cat {
        PluralCategory::ZERO => "zero",
        PluralCategory::ONE => "one",
        PluralCategory::TWO => "two",
        PluralCategory::FEW => "few",
        PluralCategory::MANY => "many",
        PluralCategory::OTHER => "other",
    }
}
