/// FEL runtime value types — zero external dependencies.
use std::fmt;

/// A FEL runtime value.
#[derive(Debug, Clone)]
pub enum FelValue {
    Null,
    Boolean(bool),
    Number(f64),
    String(String),
    Date(FelDate),
    Array(Vec<FelValue>),
    Object(Vec<(String, FelValue)>),
    Money(FelMoney),
}

/// A date or datetime value.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FelDate {
    Date { year: i32, month: u32, day: u32 },
    DateTime {
        year: i32,
        month: u32,
        day: u32,
        hour: u32,
        minute: u32,
        second: u32,
    },
}

/// A monetary value with currency.
#[derive(Debug, Clone)]
pub struct FelMoney {
    pub amount: f64,
    pub currency: String,
}

impl PartialEq for FelValue {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (FelValue::Null, FelValue::Null) => true,
            (FelValue::Boolean(a), FelValue::Boolean(b)) => a == b,
            (FelValue::Number(a), FelValue::Number(b)) => float_eq(*a, *b),
            (FelValue::String(a), FelValue::String(b)) => a == b,
            (FelValue::Date(a), FelValue::Date(b)) => a == b,
            (FelValue::Array(a), FelValue::Array(b)) => a == b,
            (FelValue::Money(a), FelValue::Money(b)) => {
                a.currency == b.currency && float_eq(a.amount, b.amount)
            }
            (FelValue::Object(a), FelValue::Object(b)) => a == b,
            _ => false,
        }
    }
}

impl PartialEq for FelMoney {
    fn eq(&self, other: &Self) -> bool {
        self.currency == other.currency && float_eq(self.amount, other.amount)
    }
}

/// Compare f64 with tolerance for decimal arithmetic.
fn float_eq(a: f64, b: f64) -> bool {
    if a == b {
        return true;
    }
    let diff = (a - b).abs();
    let max = a.abs().max(b.abs()).max(1e-15);
    diff / max < 1e-10
}

impl FelValue {
    pub fn type_name(&self) -> &'static str {
        match self {
            FelValue::Null => "null",
            FelValue::Boolean(_) => "boolean",
            FelValue::Number(_) => "number",
            FelValue::String(_) => "string",
            FelValue::Date(_) => "date",
            FelValue::Array(_) => "array",
            FelValue::Object(_) => "object",
            FelValue::Money(_) => "money",
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, FelValue::Null)
    }

    pub fn is_truthy(&self) -> bool {
        match self {
            FelValue::Null => false,
            FelValue::Boolean(b) => *b,
            FelValue::Number(n) => *n != 0.0,
            FelValue::String(s) => !s.is_empty(),
            FelValue::Array(a) => !a.is_empty(),
            _ => true,
        }
    }

    pub fn as_number(&self) -> Option<f64> {
        match self {
            FelValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_string(&self) -> Option<&str> {
        match self {
            FelValue::String(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            FelValue::Boolean(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_date(&self) -> Option<&FelDate> {
        match self {
            FelValue::Date(d) => Some(d),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&Vec<FelValue>> {
        match self {
            FelValue::Array(a) => Some(a),
            _ => None,
        }
    }

    pub fn as_money(&self) -> Option<&FelMoney> {
        match self {
            FelValue::Money(m) => Some(m),
            _ => None,
        }
    }
}

impl FelDate {
    pub fn year(&self) -> i32 {
        match self {
            FelDate::Date { year, .. } | FelDate::DateTime { year, .. } => *year,
        }
    }

    pub fn month(&self) -> u32 {
        match self {
            FelDate::Date { month, .. } | FelDate::DateTime { month, .. } => *month,
        }
    }

    pub fn day(&self) -> u32 {
        match self {
            FelDate::Date { day, .. } | FelDate::DateTime { day, .. } => *day,
        }
    }

    pub fn to_naive_date(&self) -> (i32, u32, u32) {
        (self.year(), self.month(), self.day())
    }

    /// Days since epoch (2000-01-01) for ordering.
    pub fn ordinal_days(&self) -> i64 {
        days_from_civil(self.year(), self.month(), self.day())
    }

    /// Full ordinal including time (seconds from epoch) for DateTime ordering.
    pub fn ordinal(&self) -> i64 {
        match self {
            FelDate::Date { .. } => self.ordinal_days() * 86400,
            FelDate::DateTime {
                hour,
                minute,
                second,
                ..
            } => self.ordinal_days() * 86400 + *hour as i64 * 3600 + *minute as i64 * 60 + *second as i64,
        }
    }

    pub fn format_iso(&self) -> String {
        match self {
            FelDate::Date { year, month, day } => {
                format!("{year:04}-{month:02}-{day:02}")
            }
            FelDate::DateTime {
                year,
                month,
                day,
                hour,
                minute,
                second,
            } => {
                format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}")
            }
        }
    }
}

/// Days from civil date (algorithm from Howard Hinnant).
fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let y = if month <= 2 { year as i64 - 1 } else { year as i64 };
    let m = if month <= 2 { month as i64 + 9 } else { month as i64 - 3 };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u64;
    let doy = (153 * m as u64 + 2) / 5 + day as u64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe as i64 - 719468
}

pub fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

/// Parse "@YYYY-MM-DD" into FelDate.
pub fn parse_date_literal(s: &str) -> Option<FelDate> {
    let s = s.strip_prefix('@')?;
    let parts: Vec<&str> = s.split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let year: i32 = parts[0].parse().ok()?;
    let month: u32 = parts[1].parse().ok()?;
    let day: u32 = parts[2].parse().ok()?;
    if month < 1 || month > 12 || day < 1 || day > days_in_month(year, month) {
        return None;
    }
    Some(FelDate::Date { year, month, day })
}

/// Parse "@YYYY-MM-DDTHH:MM:SS..." into FelDate.
pub fn parse_datetime_literal(s: &str) -> Option<FelDate> {
    let s = s.strip_prefix('@')?;
    // Strip timezone suffix
    let s = s.trim_end_matches('Z');
    let s = if s.len() > 19 { &s[..19] } else { s };
    let (date_part, time_part) = s.split_once('T')?;
    let dp: Vec<&str> = date_part.split('-').collect();
    let tp: Vec<&str> = time_part.split(':').collect();
    if dp.len() != 3 || tp.len() != 3 {
        return None;
    }
    Some(FelDate::DateTime {
        year: dp[0].parse().ok()?,
        month: dp[1].parse().ok()?,
        day: dp[2].parse().ok()?,
        hour: tp[0].parse().ok()?,
        minute: tp[1].parse().ok()?,
        second: tp[2].parse().ok()?,
    })
}

/// Add days to a date.
pub fn date_add_days(d: &FelDate, n: i64) -> FelDate {
    let total_days = d.ordinal_days() + n;
    civil_from_days(total_days)
}

/// Convert days since epoch back to civil date.
fn civil_from_days(z: i64) -> FelDate {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    FelDate::Date {
        year: y as i32,
        month: m as u32,
        day: d as u32,
    }
}

/// Format a number: strip trailing zeros.
pub fn format_number(n: f64) -> String {
    if n == n.floor() && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        // Use enough precision but strip trailing zeros
        let s = format!("{:.10}", n);
        let s = s.trim_end_matches('0');
        let s = s.trim_end_matches('.');
        s.to_string()
    }
}

impl fmt::Display for FelValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FelValue::Null => write!(f, "null"),
            FelValue::Boolean(b) => write!(f, "{b}"),
            FelValue::Number(n) => write!(f, "{}", format_number(*n)),
            FelValue::String(s) => write!(f, "{s}"),
            FelValue::Date(d) => write!(f, "{}", d.format_iso()),
            FelValue::Array(a) => {
                write!(f, "[")?;
                for (i, v) in a.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{v}")?;
                }
                write!(f, "]")
            }
            FelValue::Object(entries) => {
                write!(f, "{{")?;
                for (i, (k, v)) in entries.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{k}: {v}")?;
                }
                write!(f, "}}")
            }
            FelValue::Money(m) => write!(f, "{} {}", format_number(m.amount), m.currency),
        }
    }
}
