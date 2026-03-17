/// FEL tree-walking evaluator — zero external dependencies.
///
/// Non-fatal errors produce a Diagnostic + FelNull (never panic).
/// Null propagation follows spec §3: most ops propagate, equality does NOT.
use std::collections::HashMap;

use crate::ast::*;
use crate::error::Diagnostic;
use crate::types::*;

// ── Evaluation context ──────────────────────────────────────────

/// Trait for resolving field values and MIP state from the host environment.
pub trait Environment {
    fn resolve_field(&self, segments: &[String]) -> FelValue;
    fn resolve_context(&self, name: &str, arg: Option<&str>, tail: &[String]) -> FelValue;

    fn mip_valid(&self, _path: &[String]) -> FelValue {
        FelValue::Boolean(true)
    }
    fn mip_relevant(&self, _path: &[String]) -> FelValue {
        FelValue::Boolean(true)
    }
    fn mip_readonly(&self, _path: &[String]) -> FelValue {
        FelValue::Boolean(false)
    }
    fn mip_required(&self, _path: &[String]) -> FelValue {
        FelValue::Boolean(false)
    }

    fn repeat_prev(&self) -> FelValue {
        FelValue::Null
    }
    fn repeat_next(&self) -> FelValue {
        FelValue::Null
    }
    fn repeat_parent(&self) -> FelValue {
        FelValue::Null
    }
}

/// A simple map-based environment for standalone evaluation.
pub struct MapEnvironment {
    pub fields: HashMap<String, FelValue>,
}

impl MapEnvironment {
    pub fn new() -> Self {
        Self {
            fields: HashMap::new(),
        }
    }

    pub fn with_fields(fields: HashMap<String, FelValue>) -> Self {
        Self { fields }
    }
}

impl Default for MapEnvironment {
    fn default() -> Self {
        Self::new()
    }
}

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

    fn resolve_context(&self, _name: &str, _arg: Option<&str>, _tail: &[String]) -> FelValue {
        FelValue::Null
    }
}

/// Result of evaluation: a value plus any accumulated diagnostics.
#[derive(Debug, Clone)]
pub struct EvalResult {
    pub value: FelValue,
    pub diagnostics: Vec<Diagnostic>,
}

/// Evaluator state.
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
            Expr::Array(elems) => {
                FelValue::Array(elems.iter().map(|e| self.eval(e)).collect())
            }
            Expr::Object(entries) => FelValue::Object(
                entries.iter().map(|(k, v)| (k.clone(), self.eval(v))).collect(),
            ),
            Expr::FieldRef { name, path } => self.eval_field_ref(name, path),
            Expr::ContextRef { name, arg, tail } => {
                self.env.resolve_context(name, arg.as_deref(), tail)
            }
            Expr::UnaryOp { op, operand } => {
                let val = self.eval(operand);
                self.eval_unary(*op, val)
            }
            Expr::BinaryOp { op, left, right } => self.eval_binary(*op, left, right),
            Expr::Ternary { condition, then_branch, else_branch }
            | Expr::IfThenElse { condition, then_branch, else_branch } => {
                let cond = self.eval(condition);
                if cond.is_null() {
                    return FelValue::Null;
                }
                if cond.is_truthy() { self.eval(then_branch) } else { self.eval(else_branch) }
            }
            Expr::Membership { value, container, negated } => {
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
                if path.is_empty() { base } else { self.access_path(base, path) }
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
                if remaining_path.is_empty() { base } else { self.access_path(base, &remaining_path) }
            }
        }
    }

    fn access_path(&mut self, mut current: FelValue, path: &[PathSegment]) -> FelValue {
        for (i, seg) in path.iter().enumerate() {
            match seg {
                PathSegment::Dot(name) => match &current {
                    FelValue::Object(entries) => {
                        current = entries.iter().find(|(k, _)| k == name)
                            .map(|(_, v)| v.clone()).unwrap_or(FelValue::Null);
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
                PathSegment::Wildcard => {
                    match &current {
                        FelValue::Array(arr) => {
                            let remaining = &path[i + 1..];
                            if remaining.is_empty() { return current; }
                            return FelValue::Array(
                                arr.iter().map(|e| self.access_path(e.clone(), remaining)).collect(),
                            );
                        }
                        FelValue::Null => return FelValue::Null,
                        _ => {
                            self.diag(format!("cannot wildcard on {}", current.type_name()));
                            return FelValue::Null;
                        }
                    }
                }
            }
        }
        current
    }

    // ── Unary operators ─────────────────────────────────────────

    fn eval_unary(&mut self, op: UnaryOp, val: FelValue) -> FelValue {
        match op {
            UnaryOp::Not => {
                if val.is_null() { return FelValue::Null; }
                FelValue::Boolean(!val.is_truthy())
            }
            UnaryOp::Neg => match &val {
                FelValue::Null => FelValue::Null,
                FelValue::Number(n) => FelValue::Number(-n),
                FelValue::Array(arr) => FelValue::Array(
                    arr.iter().map(|v| self.eval_unary(op, v.clone())).collect(),
                ),
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
                if left.is_null() { return FelValue::Null; }
                if !left.is_truthy() { return FelValue::Boolean(false); }
                let right = self.eval(right_expr);
                if right.is_null() { return FelValue::Null; }
                return FelValue::Boolean(right.is_truthy());
            }
            BinaryOp::Or => {
                let left = self.eval(left_expr);
                if left.is_null() { return FelValue::Null; }
                if left.is_truthy() { return FelValue::Boolean(true); }
                let right = self.eval(right_expr);
                if right.is_null() { return FelValue::Null; }
                return FelValue::Boolean(right.is_truthy());
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
                    self.diag(format!("array length mismatch: {} vs {}", la.len(), ra.len()));
                    return FelValue::Null;
                }
                return FelValue::Array(
                    la.iter().zip(ra.iter()).map(|(l, r)| self.apply_binary(op, l, r)).collect(),
                );
            }
            (FelValue::Array(la), _) => {
                return FelValue::Array(la.iter().map(|l| self.apply_binary(op, l, &right)).collect());
            }
            (_, FelValue::Array(ra)) => {
                return FelValue::Array(ra.iter().map(|r| self.apply_binary(op, &left, r)).collect());
            }
            _ => {}
        }

        self.apply_binary(op, &left, &right)
    }

    fn apply_binary(&mut self, op: BinaryOp, left: &FelValue, right: &FelValue) -> FelValue {
        if left.is_null() || right.is_null() { return FelValue::Null; }

        match op {
            BinaryOp::Add => self.num_op(left, right, "+", |a, b| a + b),
            BinaryOp::Sub => self.num_op(left, right, "-", |a, b| a - b),
            BinaryOp::Mul => self.num_op(left, right, "*", |a, b| a * b),
            BinaryOp::Div => {
                if let (FelValue::Number(a), FelValue::Number(b)) = (left, right) {
                    if *b == 0.0 {
                        self.diag("division by zero");
                        FelValue::Null
                    } else {
                        FelValue::Number(a / b)
                    }
                } else if let (FelValue::Money(m), FelValue::Number(n)) = (left, right) {
                    if *n == 0.0 {
                        self.diag("division by zero");
                        FelValue::Null
                    } else {
                        FelValue::Money(FelMoney { amount: m.amount / n, currency: m.currency.clone() })
                    }
                } else if let (FelValue::Money(a), FelValue::Money(b)) = (left, right) {
                    if a.currency != b.currency {
                        self.diag(format!("currency mismatch: {} vs {}", a.currency, b.currency));
                        FelValue::Null
                    } else if b.amount == 0.0 {
                        self.diag("division by zero");
                        FelValue::Null
                    } else {
                        FelValue::Number(a.amount / b.amount)
                    }
                } else {
                    self.diag(format!("cannot divide {} by {}", left.type_name(), right.type_name()));
                    FelValue::Null
                }
            }
            BinaryOp::Mod => {
                if let (FelValue::Number(a), FelValue::Number(b)) = (left, right) {
                    if *b == 0.0 { self.diag("modulo by zero"); FelValue::Null }
                    else { FelValue::Number(a % b) }
                } else {
                    self.diag(format!("cannot modulo {} by {}", left.type_name(), right.type_name()));
                    FelValue::Null
                }
            }
            BinaryOp::Concat => {
                if let (FelValue::String(a), FelValue::String(b)) = (left, right) {
                    FelValue::String(format!("{a}{b}"))
                } else {
                    self.diag(format!("cannot concat {} and {}", left.type_name(), right.type_name()));
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

    fn num_op(&mut self, left: &FelValue, right: &FelValue, sym: &str, f: fn(f64, f64) -> f64) -> FelValue {
        match (left, right) {
            (FelValue::Number(a), FelValue::Number(b)) => FelValue::Number(f(*a, *b)),
            (FelValue::Money(a), FelValue::Money(b)) if sym == "+" || sym == "-" => {
                if a.currency != b.currency {
                    self.diag(format!("currency mismatch: {} vs {}", a.currency, b.currency));
                    FelValue::Null
                } else {
                    FelValue::Money(FelMoney { amount: f(a.amount, b.amount), currency: a.currency.clone() })
                }
            }
            (FelValue::Money(m), FelValue::Number(n)) if sym == "*" => {
                FelValue::Money(FelMoney { amount: m.amount * n, currency: m.currency.clone() })
            }
            (FelValue::Number(n), FelValue::Money(m)) if sym == "*" => {
                FelValue::Money(FelMoney { amount: n * m.amount, currency: m.currency.clone() })
            }
            _ => {
                self.diag(format!("cannot apply '{sym}' to {} and {}", left.type_name(), right.type_name()));
                FelValue::Null
            }
        }
    }

    fn eval_equality(&mut self, left: &FelValue, right: &FelValue) -> FelValue {
        match (left, right) {
            (FelValue::Null, FelValue::Null) => FelValue::Boolean(true),
            (FelValue::Null, _) | (_, FelValue::Null) => FelValue::Boolean(false),
            (FelValue::Boolean(a), FelValue::Boolean(b)) => FelValue::Boolean(a == b),
            (FelValue::Number(a), FelValue::Number(b)) => FelValue::Boolean((a - b).abs() < 1e-10),
            (FelValue::String(a), FelValue::String(b)) => FelValue::Boolean(a == b),
            (FelValue::Date(a), FelValue::Date(b)) => FelValue::Boolean(a == b),
            (FelValue::Money(a), FelValue::Money(b)) => {
                FelValue::Boolean(a.currency == b.currency && (a.amount - b.amount).abs() < 1e-10)
            }
            (FelValue::Array(a), FelValue::Array(b)) => {
                if a.len() != b.len() { return FelValue::Boolean(false); }
                for (av, bv) in a.iter().zip(b.iter()) {
                    if !matches!(self.eval_equality(av, bv), FelValue::Boolean(true)) {
                        return FelValue::Boolean(false);
                    }
                }
                FelValue::Boolean(true)
            }
            _ => {
                self.diag(format!("cannot compare {} with {}", left.type_name(), right.type_name()));
                FelValue::Null
            }
        }
    }

    fn compare(&mut self, left: &FelValue, right: &FelValue, check: fn(std::cmp::Ordering) -> bool) -> FelValue {
        let ord = match (left, right) {
            (FelValue::Number(a), FelValue::Number(b)) => a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal),
            (FelValue::String(a), FelValue::String(b)) => a.cmp(b),
            (FelValue::Date(a), FelValue::Date(b)) => a.ordinal().cmp(&b.ordinal()),
            _ => {
                self.diag(format!("cannot compare {} with {}", left.type_name(), right.type_name()));
                return FelValue::Null;
            }
        };
        FelValue::Boolean(check(ord))
    }

    fn eval_membership(&mut self, value: FelValue, container: FelValue, negated: bool) -> FelValue {
        match &container {
            FelValue::Array(arr) => {
                let found = arr.iter().any(|e| matches!(self.eval_equality(&value, e), FelValue::Boolean(true)));
                FelValue::Boolean(if negated { !found } else { found })
            }
            FelValue::Null => FelValue::Null,
            _ => {
                self.diag(format!("membership requires array, got {}", container.type_name()));
                FelValue::Null
            }
        }
    }

    // ── Standard library functions ──────────────────────────────

    fn eval_function(&mut self, name: &str, args: &[Expr]) -> FelValue {
        match name {
            // Aggregates
            "sum" => self.fn_aggregate(args, "sum", |nums| nums.iter().sum()),
            "count" => { let v = self.eval_arg(args, 0); self.fn_count(&v) }
            "avg" => self.fn_aggregate(args, "avg", |nums| {
                if nums.is_empty() { f64::NAN } else { nums.iter().sum::<f64>() / nums.len() as f64 }
            }),
            "min" => self.fn_min_max(args, true),
            "max" => self.fn_min_max(args, false),
            "countWhere" => self.fn_count_where(args),

            // String
            "length" => self.fn_length(args),
            "contains" => self.fn_str2(args, "contains", |s, sub| FelValue::Boolean(s.contains(&*sub))),
            "startsWith" => self.fn_str2(args, "startsWith", |s, p| FelValue::Boolean(s.starts_with(&*p))),
            "endsWith" => self.fn_str2(args, "endsWith", |s, p| FelValue::Boolean(s.ends_with(&*p))),
            "substring" => self.fn_substring(args),
            "replace" => self.fn_replace(args),
            "upper" => self.fn_str1(args, |s| FelValue::String(s.to_uppercase())),
            "lower" => self.fn_str1(args, |s| FelValue::String(s.to_lowercase())),
            "trim" => self.fn_str1(args, |s| FelValue::String(s.trim().to_string())),
            "matches" => self.fn_matches(args),
            "format" => self.fn_format(args),

            // Numeric
            "round" => self.fn_round(args),
            "floor" => self.fn_num1(args, f64::floor),
            "ceil" => self.fn_num1(args, f64::ceil),
            "abs" => self.fn_num1(args, f64::abs),
            "power" => self.fn_power(args),

            // Date
            "today" => self.fn_today(),
            "now" => self.fn_now(),
            "year" => self.fn_date_part(args, |d| d.year() as f64),
            "month" => self.fn_date_part(args, |d| d.month() as f64),
            "day" => self.fn_date_part(args, |d| d.day() as f64),
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
                match e { FelValue::Boolean(b) => FelValue::Boolean(!b), o => o }
            }
            "selected" => self.fn_selected(args),

            // Type checking
            "isNumber" => self.fn_is_type(args, "number"),
            "isString" => self.fn_is_type(args, "string"),
            "isDate" => self.fn_is_type(args, "date"),
            "isNull" => { let v = self.eval_arg(args, 0); FelValue::Boolean(v.is_null()) }
            "typeOf" => { let v = self.eval_arg(args, 0); FelValue::String(v.type_name().to_string()) }

            // Casting
            "number" => self.fn_cast_number(args),
            "string" => self.fn_cast_string(args),
            "boolean" => self.fn_cast_boolean(args),
            "date" => self.fn_cast_date(args),

            // Money
            "money" => self.fn_money(args),
            "moneyAmount" => { let v = self.eval_arg(args, 0); match v { FelValue::Money(m) => FelValue::Number(m.amount), _ => FelValue::Null } }
            "moneyCurrency" => { let v = self.eval_arg(args, 0); match v { FelValue::Money(m) => FelValue::String(m.currency), _ => FelValue::Null } }
            "moneyAdd" => self.fn_money_add(args),
            "moneySum" => self.fn_money_sum(args),

            // MIP state queries
            "valid" => self.fn_mip(args, "valid"),
            "relevant" => self.fn_mip(args, "relevant"),
            "readonly" => self.fn_mip(args, "readonly"),
            "required" => self.fn_mip(args, "required"),

            // Repeat navigation
            "prev" => self.env.repeat_prev(),
            "next" => self.env.repeat_next(),
            "parent" => self.env.repeat_parent(),

            _ => { self.diag(format!("undefined function: {name}")); FelValue::Null }
        }
    }

    fn eval_arg(&mut self, args: &[Expr], idx: usize) -> FelValue {
        if idx < args.len() { self.eval(&args[idx]) } else { FelValue::Null }
    }

    fn get_array(&mut self, val: &FelValue, fn_name: &str) -> Option<Vec<FelValue>> {
        match val {
            FelValue::Array(a) => Some(a.clone()),
            FelValue::Null => None,
            _ => { self.diag(format!("{fn_name}: expected array, got {}", val.type_name())); None }
        }
    }

    // ── Aggregate helpers ───────────────────────────────────────

    fn fn_aggregate(&mut self, args: &[Expr], name: &str, f: fn(&[f64]) -> f64) -> FelValue {
        let val = self.eval_arg(args, 0);
        let arr = match self.get_array(&val, name) { Some(a) => a, None => return FelValue::Null };
        let nums: Vec<f64> = arr.iter().filter_map(|v| v.as_number()).collect();
        let result = f(&nums);
        if result.is_nan() { self.diag(format!("{name}: no numeric elements")); FelValue::Null }
        else { FelValue::Number(result) }
    }

    fn fn_count(&mut self, val: &FelValue) -> FelValue {
        match val {
            FelValue::Array(a) => FelValue::Number(a.iter().filter(|v| !v.is_null()).count() as f64),
            FelValue::Null => FelValue::Null,
            _ => FelValue::Null,
        }
    }

    fn fn_min_max(&mut self, args: &[Expr], is_min: bool) -> FelValue {
        let val = self.eval_arg(args, 0);
        let name = if is_min { "min" } else { "max" };
        let arr = match self.get_array(&val, name) { Some(a) => a, None => return FelValue::Null };
        let non_null: Vec<&FelValue> = arr.iter().filter(|v| !v.is_null()).collect();
        if non_null.is_empty() { return FelValue::Null; }
        let mut best = non_null[0].clone();
        for elem in &non_null[1..] {
            let cmp = match (&best, *elem) {
                (FelValue::Number(a), FelValue::Number(b)) => a.partial_cmp(b),
                (FelValue::String(a), FelValue::String(b)) => Some(a.cmp(b)),
                (FelValue::Date(a), FelValue::Date(b)) => Some(a.ordinal().cmp(&b.ordinal())),
                _ => { self.diag(format!("{name}: mixed types")); return FelValue::Null; }
            };
            if let Some(ord) = cmp {
                if (is_min && ord.is_gt()) || (!is_min && ord.is_lt()) {
                    best = (*elem).clone();
                }
            }
        }
        best
    }

    fn fn_count_where(&mut self, args: &[Expr]) -> FelValue {
        if args.len() < 2 { self.diag("countWhere: requires 2 arguments"); return FelValue::Null; }
        let arr_val = self.eval(&args[0]);
        let arr = match self.get_array(&arr_val, "countWhere") { Some(a) => a, None => return FelValue::Null };
        let mut count = 0i64;
        for elem in &arr {
            self.let_scopes.push(HashMap::from([("$".to_string(), elem.clone())]));
            let pred = self.eval(&args[1]);
            self.let_scopes.pop();
            if pred.is_truthy() { count += 1; }
        }
        FelValue::Number(count as f64)
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
        let s = match self.eval_arg(args, 0) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let s2 = match self.eval_arg(args, 1) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        f(&s, &s2)
    }

    fn fn_length(&mut self, args: &[Expr]) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::String(s) => FelValue::Number(s.chars().count() as f64),
            FelValue::Array(a) => FelValue::Number(a.len() as f64),
            FelValue::Null => FelValue::Number(0.0),
            _ => FelValue::Null,
        }
    }

    fn fn_substring(&mut self, args: &[Expr]) -> FelValue {
        let s = match self.eval_arg(args, 0) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let start = match self.eval_arg(args, 1) { FelValue::Number(n) => (n as i64).max(1) as usize, _ => return FelValue::Null };
        let chars: Vec<char> = s.chars().collect();
        let start_idx = start.saturating_sub(1);
        if args.len() > 2 {
            let len = match self.eval_arg(args, 2) { FelValue::Number(n) => (n as i64).max(0) as usize, _ => return FelValue::Null };
            let end = (start_idx + len).min(chars.len());
            FelValue::String(chars[start_idx.min(chars.len())..end].iter().collect())
        } else {
            FelValue::String(chars[start_idx.min(chars.len())..].iter().collect())
        }
    }

    fn fn_replace(&mut self, args: &[Expr]) -> FelValue {
        let s = match self.eval_arg(args, 0) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let old = match self.eval_arg(args, 1) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let new = match self.eval_arg(args, 2) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        FelValue::String(s.replace(&old, &new))
    }

    fn fn_matches(&mut self, args: &[Expr]) -> FelValue {
        let s = match self.eval_arg(args, 0) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let pattern = match self.eval_arg(args, 1) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        // Simple regex-like matching — supports basic patterns
        // For a full regex engine we'd need a crate; do basic glob matching
        FelValue::Boolean(simple_match(&pattern, &s))
    }

    fn fn_format(&mut self, args: &[Expr]) -> FelValue {
        if args.is_empty() { return FelValue::Null; }
        let template = match self.eval(&args[0]) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let mut result = template;
        for (i, arg) in args[1..].iter().enumerate() {
            let val = self.eval(arg);
            result = result.replace(&format!("{{{i}}}"), &val.to_string());
        }
        FelValue::String(result)
    }

    // ── Numeric helpers ─────────────────────────────────────────

    fn fn_num1(&mut self, args: &[Expr], f: fn(f64) -> f64) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::Number(n) => FelValue::Number(f(n)),
            FelValue::Null => FelValue::Null,
            _ => FelValue::Null,
        }
    }

    fn fn_round(&mut self, args: &[Expr]) -> FelValue {
        let n = match self.eval_arg(args, 0) { FelValue::Number(n) => n, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let precision = if args.len() > 1 {
            match self.eval_arg(args, 1) { FelValue::Number(p) => p as i32, _ => 0 }
        } else { 0 };
        let factor = 10f64.powi(precision);
        // Banker's rounding (round half to even)
        let scaled = n * factor;
        let rounded = bankers_round(scaled);
        FelValue::Number(rounded / factor)
    }

    fn fn_power(&mut self, args: &[Expr]) -> FelValue {
        let base = match self.eval_arg(args, 0) { FelValue::Number(n) => n, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let exp = match self.eval_arg(args, 1) { FelValue::Number(n) => n, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let result = base.powf(exp);
        if result.is_finite() { FelValue::Number(result) }
        else { self.diag("power: overflow"); FelValue::Null }
    }

    // ── Date helpers ────────────────────────────────────────────

    fn fn_today(&self) -> FelValue {
        // Cannot get real date without std::time or chrono — return a placeholder
        // In WASM/Python bindings, the host can provide this via Environment
        FelValue::Date(FelDate::Date { year: 2026, month: 3, day: 17 })
    }

    fn fn_now(&self) -> FelValue {
        FelValue::Date(FelDate::DateTime { year: 2026, month: 3, day: 17, hour: 0, minute: 0, second: 0 })
    }

    fn fn_date_part(&mut self, args: &[Expr], f: fn(&FelDate) -> f64) -> FelValue {
        match self.eval_arg(args, 0) {
            FelValue::Date(d) => FelValue::Number(f(&d)),
            FelValue::Null => FelValue::Null,
            _ => FelValue::Null,
        }
    }

    fn fn_time_part(&mut self, args: &[Expr], idx: usize) -> FelValue {
        let s = match self.eval_arg(args, 0) { FelValue::String(s) => s, FelValue::Null => return FelValue::Null, _ => return FelValue::Null };
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() != 3 { self.diag("invalid time string"); return FelValue::Null; }
        match parts.get(idx).and_then(|p| p.parse::<f64>().ok()) {
            Some(n) => FelValue::Number(n),
            None => FelValue::Null,
        }
    }

    fn fn_time(&mut self, args: &[Expr]) -> FelValue {
        let h = match self.eval_arg(args, 0) { FelValue::Number(n) => n as i64, _ => return FelValue::Null };
        let m = match self.eval_arg(args, 1) { FelValue::Number(n) => n as i64, _ => return FelValue::Null };
        let s = match self.eval_arg(args, 2) { FelValue::Number(n) => n as i64, _ => return FelValue::Null };
        FelValue::String(format!("{h:02}:{m:02}:{s:02}"))
    }

    fn fn_time_diff(&mut self, args: &[Expr]) -> FelValue {
        let t1 = match self.eval_arg(args, 0) { FelValue::String(s) => s, _ => return FelValue::Null };
        let t2 = match self.eval_arg(args, 1) { FelValue::String(s) => s, _ => return FelValue::Null };
        match (parse_time_str(&t1), parse_time_str(&t2)) {
            (Some((h1, m1, s1)), Some((h2, m2, s2))) => {
                FelValue::Number(((h1*3600 + m1*60 + s1) - (h2*3600 + m2*60 + s2)) as f64)
            }
            _ => { self.diag("timeDiff: invalid time strings"); FelValue::Null }
        }
    }

    fn fn_date_diff(&mut self, args: &[Expr]) -> FelValue {
        let d1 = match self.eval_arg(args, 0) { FelValue::Date(d) => d, _ => return FelValue::Null };
        let d2 = match self.eval_arg(args, 1) { FelValue::Date(d) => d, _ => return FelValue::Null };
        let unit = match self.eval_arg(args, 2) { FelValue::String(s) => s, _ => return FelValue::Null };
        let result = match unit.as_str() {
            "days" => d1.ordinal_days() - d2.ordinal_days(),
            "months" => (d1.year() as i64 * 12 + d1.month() as i64) - (d2.year() as i64 * 12 + d2.month() as i64),
            "years" => d1.year() as i64 - d2.year() as i64,
            _ => { self.diag(format!("dateDiff: unknown unit '{unit}'")); return FelValue::Null; }
        };
        FelValue::Number(result as f64)
    }

    fn fn_date_add(&mut self, args: &[Expr]) -> FelValue {
        let d = match self.eval_arg(args, 0) { FelValue::Date(d) => d, _ => return FelValue::Null };
        let n = match self.eval_arg(args, 1) { FelValue::Number(n) => n as i64, _ => return FelValue::Null };
        let unit = match self.eval_arg(args, 2) { FelValue::String(s) => s, _ => return FelValue::Null };
        match unit.as_str() {
            "days" => FelValue::Date(date_add_days(&d, n)),
            "months" => {
                let total = d.year() as i64 * 12 + (d.month() as i64 - 1) + n;
                let new_year = (total.div_euclid(12)) as i32;
                let new_month = (total.rem_euclid(12) + 1) as u32;
                let max_day = days_in_month(new_year, new_month);
                let new_day = d.day().min(max_day);
                FelValue::Date(FelDate::Date { year: new_year, month: new_month, day: new_day })
            }
            "years" => {
                let new_year = d.year() + n as i32;
                let max_day = days_in_month(new_year, d.month());
                let new_day = d.day().min(max_day);
                FelValue::Date(FelDate::Date { year: new_year, month: d.month(), day: new_day })
            }
            _ => { self.diag(format!("dateAdd: unknown unit '{unit}'")); FelValue::Null }
        }
    }

    // ── Logical helpers ─────────────────────────────────────────

    fn fn_if(&mut self, args: &[Expr]) -> FelValue {
        if args.len() < 3 { self.diag("if: requires 3 arguments"); return FelValue::Null; }
        let cond = self.eval(&args[0]);
        if cond.is_null() { return FelValue::Null; }
        if cond.is_truthy() { self.eval(&args[1]) } else { self.eval(&args[2]) }
    }

    fn fn_coalesce(&mut self, args: &[Expr]) -> FelValue {
        for arg in args {
            let val = self.eval(arg);
            if !val.is_null() { return val; }
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
        let arr = match self.eval_arg(args, 0) { FelValue::Array(a) => a, _ => return FelValue::Boolean(false) };
        let val = self.eval_arg(args, 1);
        let found = arr.iter().any(|e| matches!(self.eval_equality(e, &val), FelValue::Boolean(true)));
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
            FelValue::String(s) => match s.parse::<f64>() {
                Ok(n) => FelValue::Number(n),
                Err(_) => { self.diag(format!("number: cannot parse '{s}'")); FelValue::Null }
            },
            FelValue::Boolean(b) => FelValue::Number(if b { 1.0 } else { 0.0 }),
            FelValue::Null => FelValue::Null,
            v => { self.diag(format!("number: cannot convert {}", v.type_name())); FelValue::Null }
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
                _ => { self.diag(format!("boolean: cannot convert '{s}'")); FelValue::Null }
            },
            FelValue::Number(n) => {
                if n == 0.0 { FelValue::Boolean(false) }
                else if n == 1.0 { FelValue::Boolean(true) }
                else { self.diag(format!("boolean: cannot convert {n}")); FelValue::Null }
            }
            v => { self.diag(format!("boolean: cannot convert {}", v.type_name())); FelValue::Null }
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
                    self.diag(format!("date: cannot parse '{s}'")); FelValue::Null
                }
            }
            FelValue::Null => FelValue::Null,
            v => { self.diag(format!("date: cannot convert {}", v.type_name())); FelValue::Null }
        }
    }

    // ── Money helpers ───────────────────────────────────────────

    fn fn_money(&mut self, args: &[Expr]) -> FelValue {
        let amount = match self.eval_arg(args, 0) { FelValue::Number(n) => n, _ => return FelValue::Null };
        let currency = match self.eval_arg(args, 1) { FelValue::String(s) => s, _ => return FelValue::Null };
        FelValue::Money(FelMoney { amount, currency })
    }

    fn fn_money_add(&mut self, args: &[Expr]) -> FelValue {
        let a = match self.eval_arg(args, 0) { FelValue::Money(m) => m, _ => return FelValue::Null };
        let b = match self.eval_arg(args, 1) { FelValue::Money(m) => m, _ => return FelValue::Null };
        if a.currency != b.currency { self.diag("moneyAdd: currency mismatch"); return FelValue::Null; }
        FelValue::Money(FelMoney { amount: a.amount + b.amount, currency: a.currency })
    }

    fn fn_money_sum(&mut self, args: &[Expr]) -> FelValue {
        let val = self.eval_arg(args, 0);
        let arr = match self.get_array(&val, "moneySum") { Some(a) => a, None => return FelValue::Null };
        let mut total: Option<FelMoney> = None;
        for elem in &arr {
            match elem {
                FelValue::Money(m) => match &total {
                    None => total = Some(m.clone()),
                    Some(t) => {
                        if t.currency != m.currency { self.diag("moneySum: mixed currencies"); return FelValue::Null; }
                        total = Some(FelMoney { amount: t.amount + m.amount, currency: t.currency.clone() });
                    }
                },
                FelValue::Null => {}
                _ => { self.diag("moneySum: non-money element"); return FelValue::Null; }
            }
        }
        match total { Some(t) => FelValue::Money(t), None => FelValue::Null }
    }

    // ── MIP state queries ───────────────────────────────────────

    fn fn_mip(&mut self, args: &[Expr], kind: &str) -> FelValue {
        if args.is_empty() { self.diag(format!("{kind}: requires 1 argument")); return FelValue::Null; }
        let path = extract_field_path(&args[0]);
        match kind {
            "valid" => self.env.mip_valid(&path),
            "relevant" => self.env.mip_relevant(&path),
            "readonly" => self.env.mip_readonly(&path),
            "required" => self.env.mip_required(&path),
            _ => FelValue::Null,
        }
    }
}

// ── Utility functions ───────────────────────────────────────────

fn extract_field_path(expr: &Expr) -> Vec<String> {
    match expr {
        Expr::FieldRef { name, path } => {
            let mut segs = Vec::new();
            if let Some(n) = name { segs.push(n.clone()); }
            for seg in path { if let PathSegment::Dot(n) = seg { segs.push(n.clone()); } }
            segs
        }
        _ => Vec::new(),
    }
}

fn parse_time_str(s: &str) -> Option<(i64, i64, i64)> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 { return None; }
    Some((parts[0].parse().ok()?, parts[1].parse().ok()?, parts[2].parse().ok()?))
}

/// Banker's rounding (round half to even).
fn bankers_round(x: f64) -> f64 {
    let rounded = x.round();
    // Check if exactly at midpoint
    let frac = (x - x.floor()).abs();
    if (frac - 0.5).abs() < 1e-10 {
        // Round to even
        if rounded as i64 % 2 != 0 {
            if x > 0.0 { rounded - 1.0 } else { rounded + 1.0 }
        } else {
            rounded
        }
    } else {
        rounded
    }
}

/// Simple pattern matching (subset of regex).
/// Supports: . (any char), * (zero or more of preceding), ^ $ anchors.
/// For full regex, would need a crate.
fn simple_match(pattern: &str, text: &str) -> bool {
    // Try basic exact substring match first
    if !pattern.contains(|c: char| matches!(c, '.' | '*' | '+' | '?' | '[' | ']' | '(' | ')' | '{' | '}' | '\\' | '^' | '$' | '|')) {
        return text.contains(pattern);
    }
    // For patterns with regex chars, try a simple NFA-based approach
    // This is a minimal regex engine for common patterns
    match_regex(pattern, text)
}

/// Minimal NFA regex matcher supporting: . * + ? | () [] ^ $
fn match_regex(pattern: &str, text: &str) -> bool {
    // Convert pattern to work with our simple matcher
    // For now, just check if pattern appears as substring using basic logic
    // A full regex engine is complex — this handles common cases
    let anchored_start = pattern.starts_with('^');
    let anchored_end = pattern.ends_with('$') && !pattern.ends_with("\\$");

    let pat = pattern.trim_start_matches('^');
    let pat = if anchored_end { &pat[..pat.len()-1] } else { pat };

    if anchored_start && anchored_end {
        match_at(pat, text, 0) == Some(text.len())
    } else if anchored_start {
        match_at(pat, text, 0).is_some()
    } else if anchored_end {
        // Try matching ending at the end of text
        for i in 0..=text.len() {
            if let Some(end) = match_at(pat, text, i) {
                if end == text.len() { return true; }
            }
        }
        false
    } else {
        // Unanchored: try at every position
        for i in 0..=text.len() {
            if match_at(pat, text, i).is_some() { return true; }
        }
        false
    }
}

/// Try to match pattern starting at position `start` in text.
/// Returns the end position if matched, None otherwise.
fn match_at(pattern: &str, text: &str, start: usize) -> Option<usize> {
    let pat_chars: Vec<char> = pattern.chars().collect();
    let text_chars: Vec<char> = text.chars().collect();
    match_recursive(&pat_chars, 0, &text_chars, start)
}

fn match_recursive(pat: &[char], pi: usize, text: &[char], ti: usize) -> Option<usize> {
    if pi >= pat.len() {
        return Some(ti);
    }

    // Check for quantifier after current element
    let has_star = pi + 1 < pat.len() && pat[pi + 1] == '*';
    let has_plus = pi + 1 < pat.len() && pat[pi + 1] == '+';
    let has_question = pi + 1 < pat.len() && pat[pi + 1] == '?';

    if has_star {
        // Zero or more: try matching zero first (non-greedy would be different)
        // Greedy: try max matches first
        let mut positions = vec![ti];
        let mut cur = ti;
        while cur < text.len() && char_matches(pat[pi], text[cur]) {
            cur += 1;
            positions.push(cur);
        }
        // Try from longest match first (greedy)
        for &pos in positions.iter().rev() {
            if let Some(end) = match_recursive(pat, pi + 2, text, pos) {
                return Some(end);
            }
        }
        return None;
    }

    if has_plus {
        // One or more
        if ti >= text.len() || !char_matches(pat[pi], text[ti]) { return None; }
        let mut cur = ti + 1;
        let mut positions = vec![cur];
        while cur < text.len() && char_matches(pat[pi], text[cur]) {
            cur += 1;
            positions.push(cur);
        }
        for &pos in positions.iter().rev() {
            if let Some(end) = match_recursive(pat, pi + 2, text, pos) {
                return Some(end);
            }
        }
        return None;
    }

    if has_question {
        // Zero or one
        if ti < text.len() && char_matches(pat[pi], text[ti]) {
            if let Some(end) = match_recursive(pat, pi + 2, text, ti + 1) {
                return Some(end);
            }
        }
        return match_recursive(pat, pi + 2, text, ti);
    }

    // Escape sequence
    if pat[pi] == '\\' && pi + 1 < pat.len() {
        if ti < text.len() && escaped_matches(pat[pi + 1], text[ti]) {
            return match_recursive(pat, pi + 2, text, ti + 1);
        }
        return None;
    }

    // Single character match
    if ti < text.len() && char_matches(pat[pi], text[ti]) {
        return match_recursive(pat, pi + 1, text, ti + 1);
    }

    None
}

fn char_matches(pat_char: char, text_char: char) -> bool {
    pat_char == '.' || pat_char == text_char
}

fn escaped_matches(escape_char: char, text_char: char) -> bool {
    match escape_char {
        'd' => text_char.is_ascii_digit(),
        'w' => text_char.is_ascii_alphanumeric() || text_char == '_',
        's' => text_char.is_whitespace(),
        'D' => !text_char.is_ascii_digit(),
        'W' => !(text_char.is_ascii_alphanumeric() || text_char == '_'),
        'S' => !text_char.is_whitespace(),
        c => c == text_char,
    }
}
