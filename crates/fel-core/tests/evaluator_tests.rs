/// Comprehensive FEL evaluator tests.
use fel_core::*;

// ── Helpers ─────────────────────────────────────────────────────

fn eval(input: &str) -> FelValue {
    let expr = parse(input).unwrap();
    let env = MapEnvironment::new();
    evaluate(&expr, &env).value
}

fn eval_fields(input: &str, fields: Vec<(&str, FelValue)>) -> FelValue {
    let expr = parse(input).unwrap();
    let env = MapEnvironment::with_fields(
        fields.into_iter().map(|(k, v)| (k.to_string(), v)).collect(),
    );
    evaluate(&expr, &env).value
}

fn num(n: f64) -> FelValue {
    FelValue::Number(n)
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
    assert_eq!(eval("0"), num(0.0));
    assert_eq!(eval("42"), num(42.0));
    assert_eq!(eval("3.14"), num(3.14));
    assert_eq!(eval("1e3"), num(1000.0));
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
    assert!(matches!(result, FelValue::Date(FelDate::Date { year: 2024, month: 1, day: 15 })));
}

#[test]
fn test_datetime_literal() {
    let result = eval("@2024-01-15T10:30:00");
    assert!(matches!(result, FelValue::Date(FelDate::DateTime { year: 2024, month: 1, day: 15, hour: 10, minute: 30, second: 0 })));
}

// ── Arithmetic ──────────────────────────────────────────────────

#[test]
fn test_basic_arithmetic() {
    assert_eq!(eval("1 + 2"), num(3.0));
    assert_eq!(eval("10 - 3"), num(7.0));
    assert_eq!(eval("4 * 5"), num(20.0));
    assert_eq!(eval("15 / 3"), num(5.0));
    assert_eq!(eval("17 % 5"), num(2.0));
}

#[test]
fn test_arithmetic_precedence() {
    assert_eq!(eval("2 + 3 * 4"), num(14.0));
    assert_eq!(eval("(2 + 3) * 4"), num(20.0));
    assert_eq!(eval("10 - 2 * 3"), num(4.0));
}

#[test]
fn test_division_by_zero() {
    assert_eq!(eval("1 / 0"), FelValue::Null);
    assert_eq!(eval("1 % 0"), FelValue::Null);
}

#[test]
fn test_unary_negation() {
    assert_eq!(eval("-5"), num(-5.0));
    assert_eq!(eval("-(3 + 2)"), num(-5.0));
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
    // false and X → false (X not evaluated)
    assert_eq!(eval("false and (1/0 = 1)"), FelValue::Boolean(false));
}

#[test]
fn test_short_circuit_or() {
    // true or X → true (X not evaluated)
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
    assert_eq!(eval("null ?? 42"), num(42.0));
    assert_eq!(eval("5 ?? 42"), num(5.0));
    assert_eq!(eval("null ?? null ?? 3"), num(3.0));
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
    assert_eq!(eval("let x = 5 in x + 1"), num(6.0));
    assert_eq!(eval("let x = 10 in let y = 20 in x + y"), num(30.0));
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
        FelValue::Object(vec![("qty".to_string(), num(2.0))]),
        FelValue::Object(vec![("qty".to_string(), num(5.0))]),
        FelValue::Object(vec![("qty".to_string(), num(3.0))]),
    ]);
    let result = eval_fields("$items[*].qty", vec![("items", items)]);
    assert_eq!(result, arr(vec![num(2.0), num(5.0), num(3.0)]));
}

#[test]
fn test_indexed_access() {
    let items = arr(vec![num(10.0), num(20.0), num(30.0)]);
    // 1-based indexing
    let result = eval_fields("$items[1]", vec![("items", items)]);
    assert_eq!(result, num(10.0));
}

// ── Array broadcasting ──────────────────────────────────────────

#[test]
fn test_array_scalar_broadcast() {
    assert_eq!(eval("[1, 2, 3] + 10"), arr(vec![num(11.0), num(12.0), num(13.0)]));
    assert_eq!(eval("5 * [1, 2, 3]"), arr(vec![num(5.0), num(10.0), num(15.0)]));
}

#[test]
fn test_array_array_zip() {
    assert_eq!(eval("[1, 2, 3] + [10, 20, 30]"), arr(vec![num(11.0), num(22.0), num(33.0)]));
}

// ── Aggregate functions ─────────────────────────────────────────

#[test]
fn test_sum() {
    assert_eq!(eval("sum([1, 2, 3])"), num(6.0));
    assert_eq!(eval("sum([1, null, 3])"), num(4.0)); // nulls skipped
}

#[test]
fn test_count() {
    assert_eq!(eval("count([1, 2, null, 4])"), num(3.0)); // non-null count
}

#[test]
fn test_avg() {
    assert_eq!(eval("avg([2, 4, 6])"), num(4.0));
}

#[test]
fn test_min_max() {
    assert_eq!(eval("min([3, 1, 2])"), num(1.0));
    assert_eq!(eval("max([3, 1, 2])"), num(3.0));
    assert_eq!(eval("min(['b', 'a', 'c'])"), s("a"));
    assert_eq!(eval("max(['b', 'a', 'c'])"), s("c"));
}

// ── String functions ────────────────────────────────────────────

#[test]
fn test_string_functions() {
    assert_eq!(eval("length('hello')"), num(5.0));
    assert_eq!(eval("contains('hello world', 'world')"), FelValue::Boolean(true));
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
    assert_eq!(eval("round(3.5)"), num(4.0));     // banker's rounding
    assert_eq!(eval("round(2.5)"), num(2.0));     // banker's rounding: .5 → even
    assert_eq!(eval("round(3.14159, 2)"), num(3.14));
    assert_eq!(eval("floor(3.7)"), num(3.0));
    assert_eq!(eval("ceil(3.2)"), num(4.0));
    assert_eq!(eval("abs(-5)"), num(5.0));
    assert_eq!(eval("power(2, 10)"), num(1024.0));
}

// ── Date functions ──────────────────────────────────────────────

#[test]
fn test_date_functions() {
    assert_eq!(eval("year(@2024-06-15)"), num(2024.0));
    assert_eq!(eval("month(@2024-06-15)"), num(6.0));
    assert_eq!(eval("day(@2024-06-15)"), num(15.0));
}

#[test]
fn test_date_diff() {
    assert_eq!(eval("dateDiff(@2024-03-01, @2024-01-01, 'days')"), num(60.0));
    assert_eq!(eval("dateDiff(@2024-06-01, @2024-01-01, 'months')"), num(5.0));
}

#[test]
fn test_date_add() {
    let result = eval("dateAdd(@2024-01-31, 1, 'months')");
    // Jan 31 + 1 month → Feb 29 (2024 is leap year, day clamped)
    assert!(matches!(result, FelValue::Date(FelDate::Date { year: 2024, month: 2, day: 29 })));
}

// ── Time functions ──────────────────────────────────────────────

#[test]
fn test_time_functions() {
    assert_eq!(eval("hours('10:30:45')"), num(10.0));
    assert_eq!(eval("minutes('10:30:45')"), num(30.0));
    assert_eq!(eval("seconds('10:30:45')"), num(45.0));
    assert_eq!(eval("time(10, 30, 45)"), s("10:30:45"));
    assert_eq!(eval("timeDiff('10:30:00', '08:15:00')"), num(8100.0));
}

// ── Logical functions ───────────────────────────────────────────

#[test]
fn test_coalesce() {
    assert_eq!(eval("coalesce(null, null, 42)"), num(42.0));
    assert_eq!(eval("coalesce(1, 2, 3)"), num(1.0));
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
    assert_eq!(eval("selected(['a', 'b', 'c'], 'b')"), FelValue::Boolean(true));
    assert_eq!(eval("selected(['a', 'b', 'c'], 'd')"), FelValue::Boolean(false));
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
    assert_eq!(eval("number('42')"), num(42.0));
    assert_eq!(eval("number(true)"), num(1.0));
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

    assert_eq!(eval("moneyAmount(money(100.50, 'USD'))"), num(100.50));
    assert_eq!(eval("moneyCurrency(money(100.50, 'USD'))"), s("USD"));
}

#[test]
fn test_money_add() {
    let result = eval("moneyAdd(money(100, 'USD'), money(50, 'USD'))");
    match result {
        FelValue::Money(m) => {
            assert_eq!(m.amount, 150.0);
            assert_eq!(m.currency, "USD");
        }
        _ => panic!("expected money"),
    }
}

#[test]
fn test_money_currency_mismatch() {
    assert_eq!(eval("moneyAdd(money(100, 'USD'), money(50, 'EUR'))"), FelValue::Null);
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
    assert_eq!(eval("format('{0} is {1}', 'sky', 'blue')"), s("sky is blue"));
}

// ── Nested/complex expressions ──────────────────────────────────

#[test]
fn test_complex_expression() {
    let items = arr(vec![
        FelValue::Object(vec![("qty".to_string(), num(3.0)), ("price".to_string(), num(10.0))]),
        FelValue::Object(vec![("qty".to_string(), num(2.0)), ("price".to_string(), num(25.0))]),
    ]);
    // sum of qty * price: 30 + 50 = 80
    let result = eval_fields("sum($items[*].qty * $items[*].price)", vec![("items", items)]);
    assert_eq!(result, num(80.0));
}

#[test]
fn test_conditional_with_fields() {
    let result = eval_fields(
        "if $age >= 18 then 'adult' else 'minor'",
        vec![("age", num(21.0))],
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
    assert_eq!(eval("countWhere([1, 2, 3, 4, 5], $ > 3)"), num(2.0));
    assert_eq!(eval("countWhere([1, 2, 3], $ = 2)"), num(1.0));
}
