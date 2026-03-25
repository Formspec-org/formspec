/// Comprehensive FEL evaluator tests.
use fel_core::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::*;

// ── Helpers ─────────────────────────────────────────────────────

fn eval(input: &str) -> FelValue {
    let expr = parse(input).unwrap();
    let env = MapEnvironment::new();
    evaluate(&expr, &env).value
}

fn eval_fields(input: &str, fields: Vec<(&str, FelValue)>) -> FelValue {
    let expr = parse(input).unwrap();
    let env = MapEnvironment::with_fields(
        fields
            .into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect(),
    );
    evaluate(&expr, &env).value
}

fn num(n: impl Into<Decimal>) -> FelValue {
    FelValue::Number(n.into())
}

fn dec(v: &str) -> FelValue {
    FelValue::Number(Decimal::from_str(v).unwrap())
}

fn s(v: &str) -> FelValue {
    FelValue::String(v.to_string())
}

fn arr(vals: Vec<FelValue>) -> FelValue {
    FelValue::Array(vals)
}

// ── Literals ────────────────────────────────────────────────────

#[test]
fn test_number_literals() {
    assert_eq!(eval("0"), num(0));
    assert_eq!(eval("42"), num(42));
    assert_eq!(eval("3.14"), dec("3.14"));
    assert_eq!(eval("1e3"), num(1000));
}

#[test]
fn test_string_literals() {
    assert_eq!(eval("'hello'"), s("hello"));
    assert_eq!(eval("\"world\""), s("world"));
    assert_eq!(eval("'it\\'s'"), s("it's"));
}

#[test]
fn test_boolean_literals() {
    assert_eq!(eval("true"), FelValue::Boolean(true));
    assert_eq!(eval("false"), FelValue::Boolean(false));
}

#[test]
fn test_null_literal() {
    assert_eq!(eval("null"), FelValue::Null);
}

#[test]
fn test_date_literal() {
    let result = eval("@2024-01-15");
    assert!(matches!(
        result,
        FelValue::Date(FelDate::Date {
            year: 2024,
            month: 1,
            day: 15
        })
    ));
}

#[test]
fn test_datetime_literal() {
    let result = eval("@2024-01-15T10:30:00");
    assert!(matches!(
        result,
        FelValue::Date(FelDate::DateTime {
            year: 2024,
            month: 1,
            day: 15,
            hour: 10,
            minute: 30,
            second: 0
        })
    ));
}

// ── Arithmetic ──────────────────────────────────────────────────

#[test]
fn test_basic_arithmetic() {
    assert_eq!(eval("1 + 2"), num(3));
    assert_eq!(eval("10 - 3"), num(7));
    assert_eq!(eval("4 * 5"), num(20));
    assert_eq!(eval("15 / 3"), num(5));
    assert_eq!(eval("17 % 5"), num(2));
}

#[test]
fn test_arithmetic_precedence() {
    assert_eq!(eval("2 + 3 * 4"), num(14));
    assert_eq!(eval("(2 + 3) * 4"), num(20));
    assert_eq!(eval("10 - 2 * 3"), num(4));
}

#[test]
fn test_division_by_zero() {
    assert_eq!(eval("1 / 0"), FelValue::Null);
    assert_eq!(eval("1 % 0"), FelValue::Null);
}

#[test]
fn test_unary_negation() {
    assert_eq!(eval("-5"), num(-5));
    assert_eq!(eval("-(3 + 2)"), num(-5));
}

// ── Comparison ──────────────────────────────────────────────────

#[test]
fn test_equality() {
    assert_eq!(eval("1 = 1"), FelValue::Boolean(true));
    assert_eq!(eval("1 = 2"), FelValue::Boolean(false));
    assert_eq!(eval("'a' = 'a'"), FelValue::Boolean(true));
    assert_eq!(eval("null = null"), FelValue::Boolean(true));
    assert_eq!(eval("null = 1"), FelValue::Boolean(false));
    assert_eq!(eval("1 != 2"), FelValue::Boolean(true));
    assert_eq!(eval("1 != 1"), FelValue::Boolean(false));
}

#[test]
fn test_ordering() {
    assert_eq!(eval("1 < 2"), FelValue::Boolean(true));
    assert_eq!(eval("2 > 1"), FelValue::Boolean(true));
    assert_eq!(eval("1 <= 1"), FelValue::Boolean(true));
    assert_eq!(eval("1 >= 2"), FelValue::Boolean(false));
    assert_eq!(eval("'a' < 'b'"), FelValue::Boolean(true));
}

// ── Logical ─────────────────────────────────────────────────────

#[test]
fn test_logical_and_or() {
    assert_eq!(eval("true and true"), FelValue::Boolean(true));
    assert_eq!(eval("true and false"), FelValue::Boolean(false));
    assert_eq!(eval("false or true"), FelValue::Boolean(true));
    assert_eq!(eval("false or false"), FelValue::Boolean(false));
}

#[test]
fn test_short_circuit_and() {
    assert_eq!(eval("false and (1/0 = 1)"), FelValue::Boolean(false));
}

#[test]
fn test_short_circuit_or() {
    assert_eq!(eval("true or (1/0 = 1)"), FelValue::Boolean(true));
}

#[test]
fn test_logical_not() {
    assert_eq!(eval("not true"), FelValue::Boolean(false));
    assert_eq!(eval("not false"), FelValue::Boolean(true));
}

#[test]
fn test_null_propagation_logical() {
    assert_eq!(eval("null and true"), FelValue::Null);
    assert_eq!(eval("null or true"), FelValue::Null);
    assert_eq!(eval("not null"), FelValue::Null);
}

// ── String concatenation ────────────────────────────────────────

#[test]
fn test_string_concat() {
    assert_eq!(eval("'hello' & ' ' & 'world'"), s("hello world"));
}

// ── Null coalesce ───────────────────────────────────────────────

#[test]
fn test_null_coalesce() {
    assert_eq!(eval("null ?? 42"), num(42));
    assert_eq!(eval("5 ?? 42"), num(5));
    assert_eq!(eval("null ?? null ?? 3"), num(3));
}

// ── Membership ──────────────────────────────────────────────────

#[test]
fn test_in_operator() {
    assert_eq!(eval("1 in [1, 2, 3]"), FelValue::Boolean(true));
    assert_eq!(eval("4 in [1, 2, 3]"), FelValue::Boolean(false));
    assert_eq!(eval("'a' not in ['b', 'c']"), FelValue::Boolean(true));
}

// ── Ternary and if/then/else ────────────────────────────────────

#[test]
fn test_ternary() {
    assert_eq!(eval("true ? 'yes' : 'no'"), s("yes"));
    assert_eq!(eval("false ? 'yes' : 'no'"), s("no"));
}

#[test]
fn test_if_then_else() {
    assert_eq!(eval("if true then 'yes' else 'no'"), s("yes"));
    assert_eq!(eval("if false then 'yes' else 'no'"), s("no"));
}

#[test]
fn test_if_function() {
    assert_eq!(eval("if(true, 'yes', 'no')"), s("yes"));
    assert_eq!(eval("if(false, 'yes', 'no')"), s("no"));
}

// ── Let binding ─────────────────────────────────────────────────

#[test]
fn test_let_binding() {
    assert_eq!(eval("let x = 5 in x + 1"), num(6));
    assert_eq!(eval("let x = 10 in let y = 20 in x + y"), num(30));
}

#[test]
fn test_let_binding_property_access_on_bound_object() {
    assert_eq!(eval("let x = {a: 1} in x.a"), num(1));
}

#[test]
fn test_let_binding_multi_level_property_access() {
    assert_eq!(eval("let x = {a: {b: 2}} in x.a.b"), num(2));
    assert_eq!(eval("let x = {a: {b: {c: 3}}} in x.a.b.c"), num(3));
}

// ── Field references ────────────────────────────────────────────

#[test]
fn test_field_ref() {
    let result = eval_fields("$name", vec![("name", s("Alice"))]);
    assert_eq!(result, s("Alice"));
}

#[test]
fn test_nested_field_ref() {
    let addr = FelValue::Object(vec![("city".to_string(), s("NYC"))]);
    let result = eval_fields("$address.city", vec![("address", addr)]);
    assert_eq!(result, s("NYC"));
}

#[test]
fn test_wildcard_projection() {
    let items = arr(vec![
        FelValue::Object(vec![("qty".to_string(), num(2))]),
        FelValue::Object(vec![("qty".to_string(), num(5))]),
        FelValue::Object(vec![("qty".to_string(), num(3))]),
    ]);
    let result = eval_fields("$items[*].qty", vec![("items", items)]);
    assert_eq!(result, arr(vec![num(2), num(5), num(3)]));
}

#[test]
fn test_indexed_access() {
    let items = arr(vec![num(10), num(20), num(30)]);
    // 1-based indexing
    let result = eval_fields("$items[1]", vec![("items", items)]);
    assert_eq!(result, num(10));
}

// ── Array broadcasting ──────────────────────────────────────────

#[test]
fn test_array_scalar_broadcast() {
    assert_eq!(eval("[1, 2, 3] + 10"), arr(vec![num(11), num(12), num(13)]));
    assert_eq!(eval("5 * [1, 2, 3]"), arr(vec![num(5), num(10), num(15)]));
}

#[test]
fn test_array_array_zip() {
    assert_eq!(
        eval("[1, 2, 3] + [10, 20, 30]"),
        arr(vec![num(11), num(22), num(33)])
    );
}

// ── Aggregate functions ─────────────────────────────────────────

#[test]
fn test_sum() {
    assert_eq!(eval("sum([1, 2, 3])"), num(6));
    assert_eq!(eval("sum([1, null, 3])"), num(4)); // nulls skipped
}

#[test]
fn test_count() {
    assert_eq!(eval("count([1, 2, null, 4])"), num(3)); // non-null count
}

#[test]
fn test_avg() {
    assert_eq!(eval("avg([2, 4, 6])"), num(4));
}

#[test]
fn test_min_max() {
    assert_eq!(eval("min([3, 1, 2])"), num(1));
    assert_eq!(eval("max([3, 1, 2])"), num(3));
    assert_eq!(eval("min(['b', 'a', 'c'])"), s("a"));
    assert_eq!(eval("max(['b', 'a', 'c'])"), s("c"));
}

// ── String functions ────────────────────────────────────────────

#[test]
fn test_string_functions() {
    assert_eq!(eval("length('hello')"), num(5));
    assert_eq!(
        eval("contains('hello world', 'world')"),
        FelValue::Boolean(true)
    );
    assert_eq!(eval("startsWith('hello', 'hel')"), FelValue::Boolean(true));
    assert_eq!(eval("endsWith('hello', 'llo')"), FelValue::Boolean(true));
    assert_eq!(eval("upper('hello')"), s("HELLO"));
    assert_eq!(eval("lower('HELLO')"), s("hello"));
    assert_eq!(eval("trim('  hi  ')"), s("hi"));
    assert_eq!(eval("replace('hello', 'l', 'r')"), s("herro"));
    assert_eq!(eval("substring('hello', 2, 3)"), s("ell"));
}

// ── Numeric functions ───────────────────────────────────────────

#[test]
fn test_numeric_functions() {
    assert_eq!(eval("round(3.5)"), num(4)); // banker's rounding
    assert_eq!(eval("round(2.5)"), num(2)); // banker's rounding: .5 → even
    assert_eq!(eval("round(3.14159, 2)"), dec("3.14"));
    assert_eq!(eval("floor(3.7)"), num(3));
    assert_eq!(eval("ceil(3.2)"), num(4));
    assert_eq!(eval("abs(-5)"), num(5));
    assert_eq!(eval("power(2, 10)"), num(1024));
}

// ── Date functions ──────────────────────────────────────────────

#[test]
fn test_date_functions() {
    assert_eq!(eval("year(@2024-06-15)"), num(2024));
    assert_eq!(eval("month(@2024-06-15)"), num(6));
    assert_eq!(eval("day(@2024-06-15)"), num(15));
}

#[test]
fn test_date_diff() {
    assert_eq!(eval("dateDiff(@2024-03-01, @2024-01-01, 'days')"), num(60));
    assert_eq!(eval("dateDiff(@2024-06-01, @2024-01-01, 'months')"), num(5));
}

#[test]
fn test_date_add() {
    let result = eval("dateAdd(@2024-01-31, 1, 'months')");
    // Jan 31 + 1 month → Feb 29 (2024 is leap year, day clamped)
    assert!(matches!(
        result,
        FelValue::Date(FelDate::Date {
            year: 2024,
            month: 2,
            day: 29
        })
    ));
}

// ── Time functions ──────────────────────────────────────────────

#[test]
fn test_time_functions() {
    assert_eq!(eval("hours('10:30:45')"), num(10));
    assert_eq!(eval("minutes('10:30:45')"), num(30));
    assert_eq!(eval("seconds('10:30:45')"), num(45));
    assert_eq!(eval("time(10, 30, 45)"), s("10:30:45"));
    assert_eq!(eval("timeDiff('10:30:00', '08:15:00')"), num(8100));
}

// ── Logical functions ───────────────────────────────────────────

#[test]
fn test_coalesce() {
    assert_eq!(eval("coalesce(null, null, 42)"), num(42));
    assert_eq!(eval("coalesce(1, 2, 3)"), num(1));
}

#[test]
fn test_empty_present() {
    assert_eq!(eval("empty(null)"), FelValue::Boolean(true));
    assert_eq!(eval("empty('')"), FelValue::Boolean(true));
    assert_eq!(eval("empty([])"), FelValue::Boolean(true));
    assert_eq!(eval("empty('x')"), FelValue::Boolean(false));
    assert_eq!(eval("present('hello')"), FelValue::Boolean(true));
    assert_eq!(eval("present(null)"), FelValue::Boolean(false));
}

#[test]
fn test_selected() {
    assert_eq!(
        eval("selected(['a', 'b', 'c'], 'b')"),
        FelValue::Boolean(true)
    );
    assert_eq!(
        eval("selected(['a', 'b', 'c'], 'd')"),
        FelValue::Boolean(false)
    );
}

// ── Type checking ───────────────────────────────────────────────

#[test]
fn test_type_functions() {
    assert_eq!(eval("isNumber(42)"), FelValue::Boolean(true));
    assert_eq!(eval("isNumber('x')"), FelValue::Boolean(false));
    assert_eq!(eval("isString('x')"), FelValue::Boolean(true));
    assert_eq!(eval("isNull(null)"), FelValue::Boolean(true));
    assert_eq!(eval("isNull(0)"), FelValue::Boolean(false));
    assert_eq!(eval("typeOf(42)"), s("number"));
    assert_eq!(eval("typeOf('x')"), s("string"));
    assert_eq!(eval("typeOf(null)"), s("null"));
}

// ── Casting ─────────────────────────────────────────────────────

#[test]
fn test_casting() {
    assert_eq!(eval("number('42')"), num(42));
    assert_eq!(eval("number(true)"), num(1));
    assert_eq!(eval("string(42)"), s("42"));
    assert_eq!(eval("string(null)"), s(""));
    assert_eq!(eval("boolean('true')"), FelValue::Boolean(true));
    assert_eq!(eval("boolean(0)"), FelValue::Boolean(false));
    assert_eq!(eval("boolean(1)"), FelValue::Boolean(true));
}

// ── Money functions ─────────────────────────────────────────────

#[test]
fn test_money() {
    let result = eval("money(100.50, 'USD')");
    assert!(matches!(result, FelValue::Money(FelMoney { .. })));

    assert_eq!(eval("moneyAmount(money(100.50, 'USD'))"), dec("100.50"));
    assert_eq!(eval("moneyCurrency(money(100.50, 'USD'))"), s("USD"));
}

#[test]
fn test_money_add() {
    let result = eval("moneyAdd(money(100, 'USD'), money(50, 'USD'))");
    match result {
        FelValue::Money(m) => {
            assert_eq!(m.amount, Decimal::from(150));
            assert_eq!(m.currency, "USD");
        }
        _ => panic!("expected money"),
    }
}

#[test]
fn test_money_currency_mismatch() {
    assert_eq!(
        eval("moneyAdd(money(100, 'USD'), money(50, 'EUR'))"),
        FelValue::Null
    );
}

// ── Null propagation ────────────────────────────────────────────

#[test]
fn test_null_propagation() {
    assert_eq!(eval("null + 1"), FelValue::Null);
    assert_eq!(eval("1 + null"), FelValue::Null);
    assert_eq!(eval("null * 5"), FelValue::Null);
    assert_eq!(eval("null < 1"), FelValue::Null);
}

#[test]
fn test_equality_no_propagation() {
    // Equality does NOT propagate null — spec §3
    assert_eq!(eval("null = null"), FelValue::Boolean(true));
    assert_eq!(eval("null = 1"), FelValue::Boolean(false));
    assert_eq!(eval("1 = null"), FelValue::Boolean(false));
    assert_eq!(eval("null != 1"), FelValue::Boolean(true));
}

// ── Format function ─────────────────────────────────────────────

#[test]
fn test_format() {
    assert_eq!(
        eval("format('{0} is {1}', 'sky', 'blue')"),
        s("sky is blue")
    );
}

// ── Nested/complex expressions ──────────────────────────────────

#[test]
fn test_complex_expression() {
    let items = arr(vec![
        FelValue::Object(vec![
            ("qty".to_string(), num(3)),
            ("price".to_string(), num(10)),
        ]),
        FelValue::Object(vec![
            ("qty".to_string(), num(2)),
            ("price".to_string(), num(25)),
        ]),
    ]);
    // sum of qty * price: 30 + 50 = 80
    let result = eval_fields(
        "sum($items[*].qty * $items[*].price)",
        vec![("items", items)],
    );
    assert_eq!(result, num(80));
}

#[test]
fn test_conditional_with_fields() {
    let result = eval_fields(
        "if $age >= 18 then 'adult' else 'minor'",
        vec![("age", num(21))],
    );
    assert_eq!(result, s("adult"));
}

// ── Undefined function ──────────────────────────────────────────

#[test]
fn test_undefined_function() {
    let expr = parse("unknownFunc(1)").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    assert_eq!(result.value, FelValue::Null);
    assert!(!result.diagnostics.is_empty());
}

// ── MIP state queries ───────────────────────────────────────────

#[test]
fn test_mip_defaults() {
    assert_eq!(eval("valid($name)"), FelValue::Boolean(true));
    assert_eq!(eval("relevant($name)"), FelValue::Boolean(true));
    assert_eq!(eval("readonly($name)"), FelValue::Boolean(false));
    assert_eq!(eval("required($name)"), FelValue::Boolean(false));
}

// ── countWhere ──────────────────────────────────────────────────

#[test]
fn test_count_where() {
    assert_eq!(eval("countWhere([1, 2, 3, 4, 5], $ > 3)"), num(2));
    assert_eq!(eval("countWhere([1, 2, 3], $ = 2)"), num(1));
}

// ── Aggregate functions on empty arrays (spec §3.5.1) ───────────

/// Spec: core/spec.md §3.5.1 (lines 1220-1225) — sum([]) must return 0.
#[test]
fn test_sum_empty_array() {
    assert_eq!(eval("sum([])"), num(0));
}

/// Spec: core/spec.md §3.5.1 — count([]) must return 0.
#[test]
fn test_count_empty_array() {
    assert_eq!(eval("count([])"), num(0));
}

/// Spec: core/spec.md §3.5.1 — avg([]) must signal error (division by zero).
#[test]
fn test_avg_empty_array() {
    let expr = parse("avg([])").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    assert_eq!(result.value, FelValue::Null, "avg([]) must return null");
    assert!(
        !result.diagnostics.is_empty(),
        "avg([]) must produce a diagnostic"
    );
}

/// Spec: core/spec.md §3.5.1 — min([]) must return null.
#[test]
fn test_min_empty_array() {
    assert_eq!(eval("min([])"), FelValue::Null);
}

/// Spec: core/spec.md §3.5.1 — max([]) must return null.
#[test]
fn test_max_empty_array() {
    assert_eq!(eval("max([])"), FelValue::Null);
}

// ── Arity checks on aggregate functions (spec §3.10) ────────────

/// Spec: core/spec.md §3.10, fel-grammar.md §7 —
/// Wrong argument count on aggregate functions must be rejected.
#[test]
fn test_aggregate_arity_sum_no_args() {
    let expr = parse("sum()").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    // sum with no args evaluates with a missing arg (null) → null
    assert_eq!(result.value, FelValue::Null);
}

/// Spec: core/spec.md §3.10 — countWhere requires exactly 2 arguments.
#[test]
fn test_count_where_wrong_arity() {
    let expr = parse("countWhere([1, 2, 3])").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    assert_eq!(
        result.value,
        FelValue::Null,
        "countWhere with 1 arg must fail"
    );
    assert!(
        !result.diagnostics.is_empty(),
        "countWhere arity mismatch must produce diagnostic"
    );
}

// ── Type mismatch in casting (spec §3.4.3) ──────────────────────

/// Spec: core/spec.md §3.4.3 (line 1183) — number("abc") must signal error.
#[test]
fn test_number_cast_invalid_string() {
    let expr = parse("number('abc')").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    assert_eq!(
        result.value,
        FelValue::Null,
        "number('abc') must return null"
    );
    assert!(
        !result.diagnostics.is_empty(),
        "number('abc') must produce a diagnostic"
    );
}

/// Spec: core/spec.md §3.4.3 (line 1193) — date("not-a-date") must signal error.
#[test]
fn test_date_cast_invalid_string() {
    let expr = parse("date('not-a-date')").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    assert_eq!(
        result.value,
        FelValue::Null,
        "date('not-a-date') must return null"
    );
    assert!(
        !result.diagnostics.is_empty(),
        "date('not-a-date') must produce a diagnostic"
    );
}

// ── Decimal precision (spec S3.4.1) ─────────────────────────────

#[test]
fn test_decimal_precision_18_digits() {
    // Spec requires minimum 18 significant decimal digits.
    // f64 fails this (15-17 digits); rust_decimal gives 28-29.
    assert_eq!(eval("123456789012345678 + 1"), dec("123456789012345679"));
    assert_eq!(
        eval("0.123456789012345678 + 0"),
        dec("0.123456789012345678")
    );
}

#[test]
fn test_decimal_exact_money_arithmetic() {
    // Classic floating point failure: 0.1 + 0.2 != 0.3 in f64
    // With Decimal: exact
    assert_eq!(eval("0.1 + 0.2"), dec("0.3"));
    assert_eq!(eval("0.1 + 0.2 = 0.3"), FelValue::Boolean(true));
}

#[test]
fn test_bankers_rounding_decimal() {
    // Banker's rounding uses rust_decimal native MidpointNearestEven
    assert_eq!(eval("round(0.5)"), num(0)); // 0.5 → 0 (even)
    assert_eq!(eval("round(1.5)"), num(2)); // 1.5 → 2 (even)
    assert_eq!(eval("round(2.5)"), num(2)); // 2.5 → 2 (even)
    assert_eq!(eval("round(3.5)"), num(4)); // 3.5 → 4 (even)
    assert_eq!(eval("round(4.5)"), num(4)); // 4.5 → 4 (even)
}

// ── matches() — regex via regex crate ──────────────────────────

#[test]
fn test_matches_literal_substring() {
    assert_eq!(
        eval("matches('hello world', 'world')"),
        FelValue::Boolean(true)
    );
    assert_eq!(
        eval("matches('hello world', 'xyz')"),
        FelValue::Boolean(false)
    );
}

#[test]
fn test_matches_anchored() {
    assert_eq!(eval("matches('hello', '^hello$')"), FelValue::Boolean(true));
    assert_eq!(
        eval("matches('hello world', '^hello$')"),
        FelValue::Boolean(false)
    );
    assert_eq!(
        eval("matches('hello world', '^hello')"),
        FelValue::Boolean(true)
    );
    assert_eq!(
        eval("matches('hello world', 'world$')"),
        FelValue::Boolean(true)
    );
}

#[test]
fn test_matches_character_classes_with_quantifiers() {
    // These were broken by the off-by-two bug in the hand-rolled engine
    assert_eq!(eval(r"matches('abc123', '\\d+')"), FelValue::Boolean(true));
    assert_eq!(eval(r"matches('abc', '\\d+')"), FelValue::Boolean(false));
    assert_eq!(
        eval(r"matches('hello_world', '\\w+')"),
        FelValue::Boolean(true)
    );
    assert_eq!(
        eval(r"matches('hello world', '\\s+')"),
        FelValue::Boolean(true)
    );
    assert_eq!(eval(r"matches('abc', '\\s+')"), FelValue::Boolean(false));
}

#[test]
fn test_matches_character_class_star() {
    assert_eq!(eval(r"matches('', '\\d*')"), FelValue::Boolean(true));
    assert_eq!(eval(r"matches('123', '\\d*')"), FelValue::Boolean(true));
    assert_eq!(eval(r"matches('abc', '\\w*')"), FelValue::Boolean(true));
}

#[test]
fn test_matches_character_class_question() {
    assert_eq!(eval(r"matches('a', '\\d?a')"), FelValue::Boolean(true));
    assert_eq!(eval(r"matches('1a', '\\d?a')"), FelValue::Boolean(true));
}

#[test]
fn test_matches_full_anchored_digit_pattern() {
    // Full string must be digits only
    assert_eq!(eval(r"matches('12345', '^\\d+$')"), FelValue::Boolean(true));
    assert_eq!(
        eval(r"matches('123abc', '^\\d+$')"),
        FelValue::Boolean(false)
    );
}

#[test]
fn test_matches_alternation() {
    assert_eq!(eval("matches('cat', 'cat|dog')"), FelValue::Boolean(true));
    assert_eq!(eval("matches('dog', 'cat|dog')"), FelValue::Boolean(true));
    assert_eq!(eval("matches('fish', 'cat|dog')"), FelValue::Boolean(false));
}

#[test]
fn test_matches_grouping() {
    assert_eq!(eval("matches('abcabc', '(abc)+')"), FelValue::Boolean(true));
}

#[test]
fn test_matches_character_set() {
    assert_eq!(eval("matches('a', '[abc]')"), FelValue::Boolean(true));
    assert_eq!(eval("matches('d', '[abc]')"), FelValue::Boolean(false));
}

#[test]
fn test_matches_dot_wildcard() {
    assert_eq!(eval("matches('abc', 'a.c')"), FelValue::Boolean(true));
    assert_eq!(eval("matches('aXc', 'a.c')"), FelValue::Boolean(true));
    assert_eq!(eval("matches('ac', 'a.c')"), FelValue::Boolean(false));
}

#[test]
fn test_matches_null_propagation() {
    assert_eq!(eval("matches(null, 'abc')"), FelValue::Null);
    assert_eq!(eval("matches('abc', null)"), FelValue::Null);
}

#[test]
fn test_matches_invalid_regex_returns_null_with_diagnostic() {
    let expr = parse("matches('abc', '[invalid')").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    assert_eq!(result.value, FelValue::Null);
    assert!(!result.diagnostics.is_empty());
    assert!(result.diagnostics[0].message.contains("invalid regex"));
}

// ── 9f: Money comparison diagnostic ────────────────────────────

#[test]
fn test_money_number_comparison_returns_null_with_diagnostic() {
    // money(...) < number should return Null + diagnostic
    let expr = parse("money(100, 'USD') < 200").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    assert_eq!(result.value, FelValue::Null);
    assert!(!result.diagnostics.is_empty(), "should have diagnostic");
    assert!(
        result.diagnostics[0]
            .message
            .contains("cannot compare money with number"),
        "diagnostic message should mention money/number mismatch, got: {}",
        result.diagnostics[0].message
    );
}

#[test]
fn test_number_money_comparison_returns_null_with_diagnostic() {
    // number > money(...) should also return Null + diagnostic
    let expr = parse("200 > money(100, 'USD')").unwrap();
    let env = MapEnvironment::new();
    let result = evaluate(&expr, &env);
    assert_eq!(result.value, FelValue::Null);
    assert!(!result.diagnostics.is_empty());
}

// ── GAP-1: *Where predicate aggregate functions ─────────────────

#[test]
fn test_sum_where() {
    assert_eq!(eval("sumWhere([1, 2, 3, 4, 5], $ > 3)"), num(9)); // 4 + 5
    assert_eq!(eval("sumWhere([10, 20, 30], $ < 25)"), num(30)); // 10 + 20
}

#[test]
fn test_sum_where_empty_match() {
    assert_eq!(eval("sumWhere([1, 2, 3], $ > 100)"), num(0));
}

#[test]
fn test_avg_where() {
    assert_eq!(eval("avgWhere([1, 2, 3, 4, 5], $ > 3)"), dec("4.5")); // (4+5)/2
}

#[test]
fn test_avg_where_no_match() {
    // avgWhere with no matching elements should return null (no values to average)
    assert_eq!(eval("avgWhere([1, 2, 3], $ > 100)"), FelValue::Null);
}

#[test]
fn test_min_where() {
    assert_eq!(eval("minWhere([1, 2, 3, 4, 5], $ > 2)"), num(3));
}

#[test]
fn test_min_where_no_match() {
    assert_eq!(eval("minWhere([1, 2, 3], $ > 100)"), FelValue::Null);
}

#[test]
fn test_max_where() {
    assert_eq!(eval("maxWhere([1, 2, 3, 4, 5], $ < 4)"), num(3));
}

#[test]
fn test_max_where_no_match() {
    assert_eq!(eval("maxWhere([1, 2, 3], $ > 100)"), FelValue::Null);
}

#[test]
fn test_money_sum_where() {
    assert_eq!(
        eval("moneySumWhere([money(100, 'USD'), money(200, 'USD'), money(300, 'USD')], moneyAmount($) > 150)"),
        FelValue::Money(FelMoney { amount: Decimal::from(500), currency: "USD".to_string() })
    ); // 200 + 300
}

#[test]
fn test_money_sum_where_no_match() {
    assert_eq!(
        eval("moneySumWhere([money(100, 'USD'), money(200, 'USD')], moneyAmount($) > 1000)"),
        FelValue::Null
    );
}

#[test]
fn test_where_functions_require_two_args() {
    for func in &["sumWhere", "avgWhere", "minWhere", "maxWhere", "moneySumWhere"] {
        let expr = parse(&format!("{func}([1, 2, 3])")).unwrap();
        let env = MapEnvironment::new();
        let result = evaluate(&expr, &env);
        assert_eq!(
            result.value,
            FelValue::Null,
            "{func} with 1 arg should return Null"
        );
        assert!(
            !result.diagnostics.is_empty(),
            "{func} with 1 arg should produce diagnostic"
        );
    }
}
