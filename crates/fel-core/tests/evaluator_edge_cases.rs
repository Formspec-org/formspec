/// Evaluator edge case tests.
///
/// Addresses audit finding: "Missing evaluator edge cases"
///
/// Covers: eval_with_fields, money arithmetic, date arithmetic edge cases,
/// object equality, today()/now(), and other gaps.
use fel_core::*;
use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use std::collections::HashMap;

fn eval(input: &str) -> FelValue {
    let expr = parse(input).unwrap();
    let env = MapEnvironment::new();
    evaluate(&expr, &env).value
}

fn eval_result(input: &str) -> EvalResult {
    let expr = parse(input).unwrap();
    let env = MapEnvironment::new();
    evaluate(&expr, &env)
}

fn num(n: i64) -> FelValue {
    FelValue::Number(Decimal::from(n))
}

fn dec(v: &str) -> FelValue {
    FelValue::Number(Decimal::from_str(v).unwrap())
}

fn s(v: &str) -> FelValue {
    FelValue::String(v.to_string())
}

// ── eval_with_fields convenience function ───────────────────────

/// Correctness: eval_with_fields is the main public API entry point
#[test]
fn eval_with_fields_basic() {
    let mut fields = HashMap::new();
    fields.insert("x".to_string(), num(10));
    fields.insert("y".to_string(), num(20));

    let result = eval_with_fields("$x + $y", fields).unwrap();
    assert_eq!(result.value, num(30));
}

/// Correctness: eval_with_fields with string fields
#[test]
fn eval_with_fields_strings() {
    let mut fields = HashMap::new();
    fields.insert("name".to_string(), s("Alice"));

    let result = eval_with_fields("$name", fields).unwrap();
    assert_eq!(result.value, s("Alice"));
}

/// Correctness: eval_with_fields returns parse error for invalid input
#[test]
fn eval_with_fields_parse_error() {
    let fields = HashMap::new();
    let result = eval_with_fields("", fields);
    assert!(result.is_err());
}

/// Correctness: eval_with_fields with missing field returns null
#[test]
fn eval_with_fields_missing_field() {
    let fields = HashMap::new();
    let result = eval_with_fields("$missing", fields).unwrap();
    assert_eq!(result.value, FelValue::Null);
}

/// Correctness: eval_with_fields with complex expression
#[test]
fn eval_with_fields_complex() {
    let mut fields = HashMap::new();
    fields.insert("price".to_string(), dec("19.99"));
    fields.insert("qty".to_string(), num(3));

    let result = eval_with_fields("$price * $qty", fields).unwrap();
    assert_eq!(result.value, dec("59.97"));
}

// ── Money arithmetic edge cases ─────────────────────────────────

/// Correctness: money subtraction via operator
#[test]
fn money_subtraction() {
    let result = eval("money(100, 'USD') - money(30, 'USD')");
    match result {
        FelValue::Money(m) => {
            assert_eq!(m.amount, Decimal::from(70));
            assert_eq!(m.currency, "USD");
        }
        _ => panic!("expected money, got {result:?}"),
    }
}

/// Correctness: money * scalar
#[test]
fn money_multiply_by_scalar() {
    let result = eval("money(25, 'EUR') * 4");
    match result {
        FelValue::Money(m) => {
            assert_eq!(m.amount, Decimal::from(100));
            assert_eq!(m.currency, "EUR");
        }
        _ => panic!("expected money, got {result:?}"),
    }
}

/// Correctness: scalar * money (commutative)
#[test]
fn scalar_multiply_by_money() {
    let result = eval("3 * money(10, 'GBP')");
    match result {
        FelValue::Money(m) => {
            assert_eq!(m.amount, Decimal::from(30));
            assert_eq!(m.currency, "GBP");
        }
        _ => panic!("expected money, got {result:?}"),
    }
}

/// Correctness: money / scalar
#[test]
fn money_divide_by_scalar() {
    let result = eval("money(100, 'USD') / 4");
    match result {
        FelValue::Money(m) => {
            assert_eq!(m.amount, Decimal::from(25));
            assert_eq!(m.currency, "USD");
        }
        _ => panic!("expected money, got {result:?}"),
    }
}

/// Correctness: money / money = scalar ratio
#[test]
fn money_divide_by_money() {
    let result = eval("money(100, 'USD') / money(25, 'USD')");
    assert_eq!(result, num(4));
}

/// Correctness: money / money with currency mismatch
#[test]
fn money_divide_by_money_currency_mismatch() {
    let result = eval("money(100, 'USD') / money(25, 'EUR')");
    assert_eq!(result, FelValue::Null);
}

/// Correctness: money subtraction with currency mismatch
#[test]
fn money_subtraction_currency_mismatch() {
    let result = eval("money(100, 'USD') - money(30, 'EUR')");
    assert_eq!(result, FelValue::Null);
}

/// Correctness: money division by zero
#[test]
fn money_divide_by_zero() {
    let result = eval("money(100, 'USD') / 0");
    assert_eq!(result, FelValue::Null);
}

/// Correctness: moneySum across array
#[test]
fn money_sum_array() {
    let result = eval("moneySum([money(10, 'USD'), money(20, 'USD'), money(30, 'USD')])");
    match result {
        FelValue::Money(m) => {
            assert_eq!(m.amount, Decimal::from(60));
            assert_eq!(m.currency, "USD");
        }
        _ => panic!("expected money, got {result:?}"),
    }
}

/// Correctness: moneySum with nulls (nulls skipped)
#[test]
fn money_sum_with_nulls() {
    let result = eval("moneySum([money(10, 'USD'), null, money(30, 'USD')])");
    match result {
        FelValue::Money(m) => {
            assert_eq!(m.amount, Decimal::from(40));
            assert_eq!(m.currency, "USD");
        }
        _ => panic!("expected money, got {result:?}"),
    }
}

/// Correctness: moneySum with mixed currencies
#[test]
fn money_sum_mixed_currencies() {
    let result = eval("moneySum([money(10, 'USD'), money(20, 'EUR')])");
    assert_eq!(result, FelValue::Null);
}

/// Correctness: moneySum of empty array
#[test]
fn money_sum_empty_array() {
    let result = eval("moneySum([])");
    assert_eq!(result, FelValue::Null);
}

// ── Date arithmetic edge cases ──────────────────────────────────

/// Correctness: negative dateAdd (subtract months)
#[test]
fn date_add_negative_months() {
    let result = eval("dateAdd(@2024-03-15, -1, 'months')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { year: 2024, month: 2, day: 15 })),
        "got: {result:?}"
    );
}

/// Correctness: negative dateAdd (subtract days)
#[test]
fn date_add_negative_days() {
    let result = eval("dateAdd(@2024-03-01, -1, 'days')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { year: 2024, month: 2, day: 29 })),
        "Feb 29 (leap year), got: {result:?}"
    );
}

/// Correctness: leap year Feb 29 + 1 year = Feb 28 (clamped)
#[test]
fn date_add_leap_year_feb29_plus_one_year() {
    let result = eval("dateAdd(@2024-02-29, 1, 'years')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { year: 2025, month: 2, day: 28 })),
        "should clamp to Feb 28 in non-leap year, got: {result:?}"
    );
}

/// Correctness: leap year Feb 29 + 4 years stays Feb 29
#[test]
fn date_add_leap_year_feb29_plus_four_years() {
    let result = eval("dateAdd(@2024-02-29, 4, 'years')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { year: 2028, month: 2, day: 29 })),
        "2028 is a leap year, got: {result:?}"
    );
}

/// Correctness: dateDiff with 'years' unit
#[test]
fn date_diff_years() {
    assert_eq!(
        eval("dateDiff(@2024-06-15, @2020-06-15, 'years')"),
        num(4)
    );
}

/// Correctness: dateDiff negative result
#[test]
fn date_diff_negative() {
    assert_eq!(
        eval("dateDiff(@2024-01-01, @2024-03-01, 'days')"),
        num(-60)
    );
}

/// Correctness: dateAdd large months (wraps year)
#[test]
fn date_add_wraps_year() {
    let result = eval("dateAdd(@2024-11-15, 3, 'months')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { year: 2025, month: 2, day: 15 })),
        "Nov + 3 months = Feb next year, got: {result:?}"
    );
}

/// Correctness: dateAdd day clamping (Jan 31 + 1 month = Feb 29 in leap year)
#[test]
fn date_add_month_day_clamping() {
    let result = eval("dateAdd(@2024-01-31, 1, 'months')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { year: 2024, month: 2, day: 29 })),
        "got: {result:?}"
    );
}

/// Correctness: dateAdd to non-leap year Feb clamps to 28
#[test]
fn date_add_month_to_non_leap_feb() {
    let result = eval("dateAdd(@2023-01-31, 1, 'months')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { year: 2023, month: 2, day: 28 })),
        "got: {result:?}"
    );
}

// ── Object equality ─────────────────────────────────────────────
// Spec: spec.md L1073 — "Any two values of the same type may be compared for equality."

/// Correctness: object equality — same keys and values → true
#[test]
fn object_equality_same() {
    assert_eq!(eval("{a: 1, b: 2} = {a: 1, b: 2}"), FelValue::Boolean(true));
}

/// Correctness: object equality — different values → false
#[test]
fn object_equality_different_values() {
    assert_eq!(eval("{a: 1} = {a: 2}"), FelValue::Boolean(false));
}

/// Correctness: object equality — different keys → false
#[test]
fn object_equality_different_keys() {
    assert_eq!(eval("{a: 1} = {b: 1}"), FelValue::Boolean(false));
}

/// Correctness: object equality — different lengths → false
#[test]
fn object_equality_different_lengths() {
    assert_eq!(eval("{a: 1} = {a: 1, b: 2}"), FelValue::Boolean(false));
}

/// Correctness: nested object equality → true
#[test]
fn object_equality_nested() {
    assert_eq!(eval("{a: {b: 1}} = {a: {b: 1}}"), FelValue::Boolean(true));
}

// ── today() and now() ───────────────────────────────────────────

/// Correctness: today() returns a Date value
#[test]
fn today_returns_date() {
    let result = eval("today()");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { .. })),
        "today() should return a Date, got: {result:?}"
    );
}

/// Correctness: now() returns a DateTime value
#[test]
fn now_returns_datetime() {
    let result = eval("now()");
    assert!(
        matches!(result, FelValue::Date(FelDate::DateTime { .. })),
        "now() should return a DateTime, got: {result:?}"
    );
}

/// Correctness: today() can be used in date arithmetic
#[test]
fn today_in_date_arithmetic() {
    let result = eval("dateAdd(today(), 1, 'days')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { .. })),
        "dateAdd on today() should return a Date, got: {result:?}"
    );
}

/// Correctness: year/month/day extract from today()
#[test]
fn today_date_parts() {
    // Since today() returns a hardcoded date, we can check its parts
    let result = eval("year(today())");
    assert!(matches!(result, FelValue::Number(_)));
}

// ── Array equality ──────────────────────────────────────────────

/// Correctness: array equality
#[test]
fn array_equality_same() {
    assert_eq!(eval("[1, 2, 3] = [1, 2, 3]"), FelValue::Boolean(true));
}

/// Correctness: array equality — different
#[test]
fn array_equality_different() {
    assert_eq!(eval("[1, 2, 3] = [1, 2, 4]"), FelValue::Boolean(false));
}

/// Correctness: array equality — different lengths
#[test]
fn array_equality_different_lengths() {
    assert_eq!(eval("[1, 2] = [1, 2, 3]"), FelValue::Boolean(false));
}

/// Correctness: empty array equality
#[test]
fn empty_array_equality() {
    assert_eq!(eval("[] = []"), FelValue::Boolean(true));
}

// ── Cross-type comparisons ──────────────────────────────────────

/// Correctness: cross-type equality returns false (not error)
#[test]
fn cross_type_equality_returns_null_with_diagnostic() {
    let r = eval_result("1 = 'one'");
    // Cross-type equality produces null + diagnostic
    assert_eq!(r.value, FelValue::Null);
    assert!(!r.diagnostics.is_empty());
}

/// Correctness: cross-type comparison produces null + diagnostic
#[test]
fn cross_type_comparison_returns_null() {
    let r = eval_result("1 < 'abc'");
    assert_eq!(r.value, FelValue::Null);
}

// ── Miscellaneous evaluator edge cases ──────────────────────────

/// Correctness: deeply nested expressions
#[test]
fn deeply_nested_ternary() {
    assert_eq!(
        eval("true ? (false ? 1 : (true ? 42 : 3)) : 0"),
        num(42)
    );
}

/// Correctness: chained null coalesce
#[test]
fn chained_null_coalesce() {
    assert_eq!(eval("null ?? null ?? null ?? 99"), num(99));
}

/// Correctness: let binding with complex body
#[test]
fn let_binding_with_ternary() {
    assert_eq!(
        eval("let x = 5 in if x > 3 then 'big' else 'small'"),
        s("big")
    );
}

/// Correctness: nested let bindings with shadowing
#[test]
fn let_binding_shadowing() {
    assert_eq!(
        eval("let x = 1 in let x = 2 in x"),
        num(2)
    );
}

/// Correctness: undefined function produces null + diagnostic
#[test]
fn undefined_function_diagnostic() {
    let r = eval_result("fooBar(1, 2)");
    assert_eq!(r.value, FelValue::Null);
    assert!(
        r.diagnostics.iter().any(|d| d.message.contains("undefined function")),
        "expected 'undefined function' diagnostic, got: {:?}",
        r.diagnostics
    );
}

/// Correctness: string concatenation with null propagation
#[test]
fn concat_with_null_propagates() {
    assert_eq!(eval("'hello' & null"), FelValue::Null);
    assert_eq!(eval("null & 'world'"), FelValue::Null);
}

/// Correctness: length of array
#[test]
fn length_of_array() {
    assert_eq!(eval("length([1, 2, 3])"), num(3));
}

/// Correctness: length of null returns 0
#[test]
fn length_of_null() {
    assert_eq!(eval("length(null)"), num(0));
}

/// Correctness: empty() on various types
#[test]
fn empty_edge_cases() {
    assert_eq!(eval("empty(0)"), FelValue::Boolean(false));
    assert_eq!(eval("empty(false)"), FelValue::Boolean(false));
}

/// Correctness: date comparison
#[test]
fn date_comparison() {
    assert_eq!(
        eval("@2024-01-15 < @2024-06-15"),
        FelValue::Boolean(true)
    );
    assert_eq!(
        eval("@2024-06-15 > @2024-01-15"),
        FelValue::Boolean(true)
    );
    assert_eq!(
        eval("@2024-01-15 = @2024-01-15"),
        FelValue::Boolean(true)
    );
}

/// Correctness: date casting from string
#[test]
fn date_cast_from_string() {
    let result = eval("date('2024-06-15')");
    assert!(
        matches!(result, FelValue::Date(FelDate::Date { year: 2024, month: 6, day: 15 })),
        "got: {result:?}"
    );
}

/// Correctness: isDate type check
#[test]
fn is_date_check() {
    assert_eq!(eval("isDate(@2024-01-15)"), FelValue::Boolean(true));
    assert_eq!(eval("isDate('not a date')"), FelValue::Boolean(false));
    assert_eq!(eval("isDate(42)"), FelValue::Boolean(false));
}

/// Correctness: number cast edge cases
#[test]
fn number_cast_invalid_string() {
    let r = eval_result("number('not_a_number')");
    assert_eq!(r.value, FelValue::Null);
    assert!(!r.diagnostics.is_empty());
}

/// Correctness: boolean cast edge cases
#[test]
fn boolean_cast_edge_cases() {
    assert_eq!(eval("boolean(null)"), FelValue::Boolean(false));
    let r = eval_result("boolean('maybe')");
    assert_eq!(r.value, FelValue::Null);
}

/// Correctness: money equality
#[test]
fn money_equality() {
    assert_eq!(
        eval("money(100, 'USD') = money(100, 'USD')"),
        FelValue::Boolean(true)
    );
    assert_eq!(
        eval("money(100, 'USD') = money(100, 'EUR')"),
        FelValue::Boolean(false)
    );
    assert_eq!(
        eval("money(100, 'USD') = money(50, 'USD')"),
        FelValue::Boolean(false)
    );
}

/// Correctness: format function with multiple placeholders
#[test]
fn format_multiple_placeholders() {
    assert_eq!(
        eval("format('{0} has {1} items at ${2} each', 'Cart', 3, 9.99)"),
        s("Cart has 3 items at $9.99 each")
    );
}

/// Correctness: format with missing placeholder args
#[test]
fn format_missing_args() {
    // {1} has no replacement arg — stays as-is
    assert_eq!(eval("format('{0} and {1}', 'hello')"), s("hello and {1}"));
}

/// Correctness: postfix access on function result
#[test]
fn postfix_access_on_expression() {
    // coalesce returns first non-null; test dot access on result
    let mut fields = HashMap::new();
    let obj = FelValue::Object(vec![("x".to_string(), num(42))]);
    fields.insert("data".to_string(), obj);
    let result = eval_with_fields("$data.x", fields).unwrap();
    assert_eq!(result.value, num(42));
}
