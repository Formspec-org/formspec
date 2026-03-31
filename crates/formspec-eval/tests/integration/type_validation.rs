//! Comprehensive tests for dataType type-mismatch validation (TYPE_MISMATCH).
//!
//! Covers all 13 spec dataTypes: string, text, integer, decimal, boolean,
//! date, dateTime, time, uri, attachment, choice, multiChoice, money.
//!
//! Each dataType has:
//! - Valid values that must NOT produce TYPE_MISMATCH
//! - Invalid values that MUST produce TYPE_MISMATCH
//! - Edge cases at type boundaries

use formspec_eval::{evaluate_definition, evaluate_definition_full_with_instances, EvalTrigger};
use serde_json::{json, Value};
use std::collections::HashMap;

/// Helper: build a minimal definition with one field of the given dataType.
fn def_with_field(key: &str, data_type: &str) -> Value {
    json!({
        "$formspec": "1.0",
        "url": "test://type-validation",
        "version": "1.0.0",
        "title": "Type Validation Test",
        "items": [
            { "key": key, "type": "field", "dataType": data_type, "label": key }
        ]
    })
}

/// Helper: evaluate a definition with a single field value and return TYPE_MISMATCH results.
fn type_mismatches(data_type: &str, value: Value) -> Vec<String> {
    let def = def_with_field("field", data_type);
    let mut data = HashMap::new();
    if !value.is_null() {
        data.insert("field".to_string(), value);
    }
    let result = evaluate_definition(&def, &data);
    result
        .validations
        .iter()
        .filter(|r| r.code == "TYPE_MISMATCH")
        .map(|r| r.message.clone())
        .collect()
}

/// Assert the value produces NO TYPE_MISMATCH for the given dataType.
fn assert_valid(data_type: &str, value: Value) {
    let mismatches = type_mismatches(data_type, value.clone());
    assert!(
        mismatches.is_empty(),
        "{data_type}: expected {value} to be valid, got TYPE_MISMATCH: {mismatches:?}"
    );
}

/// Assert the value DOES produce TYPE_MISMATCH for the given dataType.
fn assert_invalid(data_type: &str, value: Value) {
    let mismatches = type_mismatches(data_type, value.clone());
    assert!(
        !mismatches.is_empty(),
        "{data_type}: expected {value} to be invalid (TYPE_MISMATCH), but it passed"
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// string
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn string_accepts_any_string() {
    assert_valid("string", json!("hello"));
    assert_valid("string", json!(""));
    assert_valid("string", json!("  with  spaces  "));
    assert_valid("string", json!("multi\nline"));
    assert_valid("string", json!("unicode: 日本語 🎉"));
}

#[test]
fn string_rejects_non_strings() {
    assert_invalid("string", json!(42));
    assert_invalid("string", json!(3.14));
    assert_invalid("string", json!(true));
    assert_invalid("string", json!(false));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// text (identical to string at data level)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn text_accepts_any_string() {
    assert_valid("text", json!("short"));
    assert_valid("text", json!("multi\nline\ntext"));
    assert_valid("text", json!(""));
    assert_valid("text", json!("A very long paragraph that spans multiple sentences. It has depth and nuance."));
}

#[test]
fn text_rejects_non_strings() {
    assert_invalid("text", json!(42));
    assert_invalid("text", json!(true));
    assert_invalid("text", json!(3.14));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// integer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn integer_accepts_whole_numbers() {
    assert_valid("integer", json!(0));
    assert_valid("integer", json!(42));
    assert_valid("integer", json!(-100));
    assert_valid("integer", json!(999999));
    assert_valid("integer", json!(1_000_000_000));
}

#[test]
fn integer_rejects_fractional_numbers() {
    assert_invalid("integer", json!(3.14));
    assert_invalid("integer", json!(-0.5));
    assert_invalid("integer", json!(1.1));
}

#[test]
fn integer_rejects_non_numbers() {
    assert_invalid("integer", json!("42"));
    assert_invalid("integer", json!(true));
    assert_invalid("integer", json!("not a number"));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// decimal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn decimal_accepts_any_number() {
    assert_valid("decimal", json!(0));
    assert_valid("decimal", json!(3.14));
    assert_valid("decimal", json!(-999.99));
    assert_valid("decimal", json!(42));
}

#[test]
fn decimal_rejects_non_numbers() {
    assert_invalid("decimal", json!("3.14"));
    assert_invalid("decimal", json!(true));
    assert_invalid("decimal", json!("not a number"));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// boolean
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn boolean_accepts_true_false() {
    assert_valid("boolean", json!(true));
    assert_valid("boolean", json!(false));
}

#[test]
fn boolean_rejects_non_booleans() {
    assert_invalid("boolean", json!(0));
    assert_invalid("boolean", json!(1));
    assert_invalid("boolean", json!("true"));
    assert_invalid("boolean", json!("false"));
    assert_invalid("boolean", json!("yes"));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// date — ISO 8601 YYYY-MM-DD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn date_accepts_valid_iso_dates() {
    assert_valid("date", json!("2025-03-31"));
    assert_valid("date", json!("1990-01-01"));
    assert_valid("date", json!("2000-12-31"));
    assert_valid("date", json!("2025-02-28"));
}

#[test]
fn date_rejects_non_strings() {
    assert_invalid("date", json!(20250331));
    assert_invalid("date", json!(true));
}

#[test]
fn date_rejects_invalid_date_strings() {
    assert_invalid("date", json!("not-a-date"));
    assert_invalid("date", json!("2025-13-01")); // month 13
    assert_invalid("date", json!("2025-00-15")); // month 0
    assert_invalid("date", json!("2025-02-30")); // Feb 30
    assert_invalid("date", json!("03-31-2025")); // US format
    assert_invalid("date", json!("2025/03/31")); // slashes
    assert_invalid("date", json!("31-03-2025")); // day first
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// dateTime — ISO 8601 date-time
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn datetime_accepts_valid_iso_datetimes() {
    assert_valid("dateTime", json!("2025-03-31T09:00:00Z"));
    assert_valid("dateTime", json!("2025-01-15T10:30:00+05:00"));
    assert_valid("dateTime", json!("2025-12-31T23:59:59Z"));
    assert_valid("dateTime", json!("2025-03-31T00:00:00Z"));
    assert_valid("dateTime", json!("2025-03-31T14:30:00-04:00"));
}

#[test]
fn datetime_rejects_non_strings() {
    assert_invalid("dateTime", json!(1711843200));
    assert_invalid("dateTime", json!(true));
}

#[test]
fn datetime_rejects_invalid_datetime_strings() {
    assert_invalid("dateTime", json!("not-a-datetime"));
    assert_invalid("dateTime", json!("2025-03-31")); // date only, no time
    assert_invalid("dateTime", json!("09:00:00")); // time only
    assert_invalid("dateTime", json!("2025-13-31T09:00:00Z")); // month 13
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// time — HH:MM:SS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn time_accepts_valid_times() {
    assert_valid("time", json!("09:00:00"));
    assert_valid("time", json!("00:00:00"));
    assert_valid("time", json!("23:59:59"));
    assert_valid("time", json!("14:30:00"));
    // HH:MM without seconds is also valid
    assert_valid("time", json!("09:00"));
    assert_valid("time", json!("14:30"));
}

#[test]
fn time_rejects_non_strings() {
    assert_invalid("time", json!(90000));
    assert_invalid("time", json!(true));
}

#[test]
fn time_rejects_invalid_time_strings() {
    assert_invalid("time", json!("not-a-time"));
    assert_invalid("time", json!("24:00:00")); // hour 24
    assert_invalid("time", json!("12:60:00")); // minute 60
    assert_invalid("time", json!("9:00:00")); // single digit hour
    assert_invalid("time", json!("9:00")); // single digit hour in HH:MM
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// uri — RFC 3986
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn uri_accepts_valid_uris() {
    assert_valid("uri", json!("https://example.com"));
    assert_valid("uri", json!("http://example.com/path?q=1#frag"));
    assert_valid("uri", json!("ftp://files.example.com/doc.pdf"));
    assert_valid("uri", json!("mailto:user@example.com"));
    assert_valid("uri", json!("urn:isbn:0451450523"));
}

#[test]
fn uri_rejects_non_strings() {
    assert_invalid("uri", json!(42));
    assert_invalid("uri", json!(true));
}

#[test]
fn uri_rejects_invalid_uris() {
    assert_invalid("uri", json!("not a uri"));
    assert_invalid("uri", json!("://missing-scheme"));
    assert_invalid("uri", json!("")); // empty string
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// choice — must be a string
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn choice_accepts_strings() {
    assert_valid("choice", json!("option_a"));
    assert_valid("choice", json!(""));
    assert_valid("choice", json!("any_string_value"));
}

#[test]
fn choice_rejects_non_strings() {
    assert_invalid("choice", json!(1));
    assert_invalid("choice", json!(true));
    assert_invalid("choice", json!(["option_a"]));
}

#[test]
fn choice_validates_against_options_list() {
    let def = json!({
        "$formspec": "1.0",
        "url": "test://choice-validation",
        "version": "1.0.0",
        "title": "Choice Test",
        "items": [{
            "key": "color",
            "type": "field",
            "dataType": "choice",
            "label": "Color",
            "options": [
                { "value": "red", "label": "Red" },
                { "value": "blue", "label": "Blue" },
                { "value": "green", "label": "Green" }
            ]
        }]
    });

    // Valid option
    let mut data = HashMap::new();
    data.insert("color".to_string(), json!("red"));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "valid option 'red' should not produce TYPE_MISMATCH");

    // Invalid option
    data.insert("color".to_string(), json!("purple"));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "invalid option 'purple' should produce TYPE_MISMATCH");
}

#[test]
fn multichoice_validates_against_options_list() {
    let def = json!({
        "$formspec": "1.0",
        "url": "test://multichoice-validation",
        "version": "1.0.0",
        "title": "MultiChoice Test",
        "items": [{
            "key": "colors",
            "type": "field",
            "dataType": "multiChoice",
            "label": "Colors",
            "options": [
                { "value": "red", "label": "Red" },
                { "value": "blue", "label": "Blue" }
            ]
        }]
    });

    // Valid options
    let mut data = HashMap::new();
    data.insert("colors".to_string(), json!(["red", "blue"]));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "valid options should not produce TYPE_MISMATCH");

    // One invalid option
    data.insert("colors".to_string(), json!(["red", "purple"]));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "invalid option 'purple' in array should produce TYPE_MISMATCH");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// multiChoice — array of strings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn multichoice_accepts_string_arrays() {
    assert_valid("multiChoice", json!(["a", "b", "c"]));
    assert_valid("multiChoice", json!(["single"]));
    assert_valid("multiChoice", json!([]));
}

#[test]
fn multichoice_rejects_non_arrays() {
    assert_invalid("multiChoice", json!("option_a"));
    assert_invalid("multiChoice", json!(42));
    assert_invalid("multiChoice", json!(true));
}

#[test]
fn multichoice_rejects_arrays_with_non_strings() {
    assert_invalid("multiChoice", json!([1, 2, 3]));
    assert_invalid("multiChoice", json!(["a", 1, "b"]));
    assert_invalid("multiChoice", json!([true, false]));
    assert_invalid("multiChoice", json!([null]));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// money — { amount: string, currency: string }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn money_accepts_valid_money_objects() {
    assert_valid("money", json!({"amount": "50000.00", "currency": "USD"}));
    assert_valid("money", json!({"amount": "0.01", "currency": "EUR"}));
    assert_valid("money", json!({"amount": "999999.99", "currency": "GBP"}));
}

#[test]
fn money_rejects_non_objects() {
    assert_invalid("money", json!(1250.00));
    assert_invalid("money", json!("1250.00"));
    assert_invalid("money", json!(true));
}

#[test]
fn money_rejects_missing_fields() {
    assert_invalid("money", json!({"amount": "100.00"})); // missing currency
    assert_invalid("money", json!({"currency": "USD"})); // missing amount
    assert_invalid("money", json!({})); // empty object
}

#[test]
fn money_rejects_wrong_field_types() {
    // Numeric amount is accepted (Postel's Law) — only non-numeric/non-string fails
    assert_invalid("money", json!({"amount": true, "currency": "USD"})); // amount is boolean
    assert_invalid("money", json!({"amount": "100.00", "currency": 840})); // currency is number
}

#[test]
fn money_rejects_non_decimal_amount() {
    assert_invalid("money", json!({"amount": "abc", "currency": "USD"}));
    assert_invalid("money", json!({"amount": "", "currency": "USD"}));
    assert_invalid("money", json!({"amount": "twelve", "currency": "USD"}));
    assert_invalid("money", json!({"amount": "1e10", "currency": "USD"})); // scientific notation
    assert_invalid("money", json!({"amount": "Infinity", "currency": "USD"}));
}

#[test]
fn money_rejects_invalid_currency_format() {
    assert_invalid("money", json!({"amount": "100.00", "currency": "usd"})); // lowercase
    assert_invalid("money", json!({"amount": "100.00", "currency": "US"})); // too short
    assert_invalid("money", json!({"amount": "100.00", "currency": "USDX"})); // too long
    assert_invalid("money", json!({"amount": "100.00", "currency": "U$D"})); // non-alpha
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// attachment — { contentType: string, url|data: string }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn attachment_accepts_valid_attachments() {
    assert_valid("attachment", json!({"contentType": "application/pdf", "url": "https://example.com/doc.pdf"}));
    assert_valid("attachment", json!({"contentType": "image/png", "data": "iVBORw0KGgo="}));
    assert_valid("attachment", json!({"contentType": "text/plain", "url": "https://example.com/file.txt", "size": 1024}));
}

#[test]
fn attachment_rejects_non_objects() {
    assert_invalid("attachment", json!("file.pdf"));
    assert_invalid("attachment", json!(42));
    assert_invalid("attachment", json!(true));
}

#[test]
fn attachment_rejects_missing_content_type() {
    assert_invalid("attachment", json!({"url": "https://example.com/doc.pdf"}));
}

#[test]
fn attachment_accepts_content_type_only() {
    // url/data completeness is a submission-level check, not a type check
    assert_valid("attachment", json!({"contentType": "application/pdf"}));
}

#[test]
fn attachment_validates_accept_mime_types() {
    let def = json!({
        "$formspec": "1.0",
        "url": "test://attachment-accept",
        "version": "1.0.0",
        "title": "Attachment Test",
        "items": [{
            "key": "photo",
            "type": "field",
            "dataType": "attachment",
            "label": "Photo",
            "accept": ["image/png", "image/jpeg"]
        }]
    });

    // Accepted type
    let mut data = HashMap::new();
    data.insert("photo".to_string(), json!({"contentType": "image/png", "url": "https://example.com/photo.png"}));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "image/png should be accepted");

    // Rejected type
    data.insert("photo".to_string(), json!({"contentType": "application/pdf", "url": "https://example.com/doc.pdf"}));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "application/pdf should be rejected when only image types accepted");
}

#[test]
fn attachment_accept_wildcard() {
    let def = json!({
        "$formspec": "1.0",
        "url": "test://attachment-wildcard",
        "version": "1.0.0",
        "title": "Attachment Wildcard Test",
        "items": [{
            "key": "file",
            "type": "field",
            "dataType": "attachment",
            "label": "File",
            "accept": ["image/*", "application/pdf"]
        }]
    });

    let mut data = HashMap::new();

    // Wildcard match
    data.insert("file".to_string(), json!({"contentType": "image/webp", "url": "https://example.com/photo.webp"}));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "image/webp should match image/*");

    // Exact match
    data.insert("file".to_string(), json!({"contentType": "application/pdf", "url": "https://example.com/doc.pdf"}));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "application/pdf should match exactly");

    // No match
    data.insert("file".to_string(), json!({"contentType": "text/plain", "url": "https://example.com/file.txt"}));
    let result = evaluate_definition(&def, &data);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "text/plain should not match image/* or application/pdf");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Null values — never produce TYPE_MISMATCH (required check handles nulls)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn null_never_type_mismatches() {
    for dt in &[
        "string", "text", "integer", "decimal", "boolean", "date", "dateTime",
        "time", "uri", "choice", "multiChoice", "money", "attachment",
    ] {
        assert_valid(dt, json!(null));
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cross-type: every non-null wrong-type value should be caught
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// For each dataType, verify that a representative set of wrong-type values
/// all produce TYPE_MISMATCH. This catches regressions where a new dataType
/// accidentally accepts values from another type family.
#[test]
fn cross_type_wrong_family_detection() {
    // Number given to string-family types
    for dt in &["string", "text", "choice", "date", "dateTime", "time", "uri"] {
        assert_invalid(dt, json!(42));
    }
    // String given to number-family types
    for dt in &["integer", "decimal"] {
        assert_invalid(dt, json!("hello"));
    }
    // Boolean given to everything except boolean
    for dt in &[
        "string", "text", "integer", "decimal", "date", "dateTime",
        "time", "uri", "choice",
    ] {
        assert_invalid(dt, json!(true));
    }
    // String given to composite types
    assert_invalid("multiChoice", json!("a"));
    assert_invalid("money", json!("100.00"));
    assert_invalid("attachment", json!("file.pdf"));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// choicesFrom — dynamic options from instance data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[test]
fn choice_choices_from_validates_against_instance_options() {
    let def = json!({
        "$formspec": "1.0",
        "url": "test://choices-from",
        "version": "1.0.0",
        "title": "ChoicesFrom Test",
        "items": [{
            "key": "country",
            "type": "field",
            "dataType": "choice",
            "label": "Country",
            "choicesFrom": { "instance": "countryCodes" }
        }],
        "instances": {
            "countryCodes": {
                "data": [
                    { "value": "us", "label": "United States" },
                    { "value": "gb", "label": "United Kingdom" },
                    { "value": "ca", "label": "Canada" }
                ]
            }
        }
    });

    let mut instances = HashMap::new();
    instances.insert("countryCodes".to_string(), json!([
        { "value": "us", "label": "United States" },
        { "value": "gb", "label": "United Kingdom" },
        { "value": "ca", "label": "Canada" }
    ]));

    // Valid: value in instance options
    let mut data = HashMap::new();
    data.insert("country".to_string(), json!("us"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "valid option 'us' should not produce TYPE_MISMATCH");

    // Invalid: value not in instance options
    data.insert("country".to_string(), json!("de"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "invalid option 'de' should produce TYPE_MISMATCH");
}

#[test]
fn choice_choices_from_missing_instance_falls_back_to_string_validation() {
    let def = json!({
        "$formspec": "1.0",
        "url": "test://choices-from-missing",
        "version": "1.0.0",
        "title": "ChoicesFrom Missing Instance Test",
        "items": [{
            "key": "country",
            "type": "field",
            "dataType": "choice",
            "label": "Country",
            "choicesFrom": { "instance": "countryCodes" }
        }]
    });

    // No instances provided — should accept any string (graceful degradation)
    let instances = HashMap::new();
    let mut data = HashMap::new();
    data.insert("country".to_string(), json!("anything_goes"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "missing instance should fall back to string-only validation");
}

#[test]
fn multichoice_choices_from_validates_array_elements() {
    let def = json!({
        "$formspec": "1.0",
        "url": "test://multichoice-choices-from",
        "version": "1.0.0",
        "title": "MultiChoice ChoicesFrom Test",
        "items": [{
            "key": "countries",
            "type": "field",
            "dataType": "multiChoice",
            "label": "Countries",
            "choicesFrom": { "instance": "countryCodes" }
        }]
    });

    let mut instances = HashMap::new();
    instances.insert("countryCodes".to_string(), json!([
        { "value": "us", "label": "United States" },
        { "value": "gb", "label": "United Kingdom" }
    ]));

    // Valid: all values in instance options
    let mut data = HashMap::new();
    data.insert("countries".to_string(), json!(["us", "gb"]));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "valid multiChoice should not produce TYPE_MISMATCH");

    // Invalid: one value not in instance options
    data.insert("countries".to_string(), json!(["us", "de"]));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "multiChoice with invalid option 'de' should produce TYPE_MISMATCH");
}

#[test]
fn choice_choices_from_string_form() {
    // choicesFrom as a plain string (instance name only)
    let def = json!({
        "$formspec": "1.0",
        "url": "test://choices-from-string",
        "version": "1.0.0",
        "title": "ChoicesFrom String Test",
        "items": [{
            "key": "color",
            "type": "field",
            "dataType": "choice",
            "label": "Color",
            "choicesFrom": "palette"
        }]
    });

    let mut instances = HashMap::new();
    instances.insert("palette".to_string(), json!([
        { "value": "red", "label": "Red" },
        { "value": "blue", "label": "Blue" }
    ]));

    let mut data = HashMap::new();
    data.insert("color".to_string(), json!("red"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "'red' should be valid");

    data.insert("color".to_string(), json!("green"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "'green' not in palette instance");
}

#[test]
fn choice_choices_from_with_custom_value_field() {
    // Instance data uses "code" instead of "value"
    let def = json!({
        "$formspec": "1.0",
        "url": "test://choices-from-value-field",
        "version": "1.0.0",
        "title": "ChoicesFrom ValueField Test",
        "items": [{
            "key": "state",
            "type": "field",
            "dataType": "choice",
            "label": "State",
            "choicesFrom": { "instance": "states", "valueField": "code" }
        }]
    });

    let mut instances = HashMap::new();
    instances.insert("states".to_string(), json!([
        { "code": "CA", "name": "California" },
        { "code": "NY", "name": "New York" }
    ]));

    let mut data = HashMap::new();
    data.insert("state".to_string(), json!("CA"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "'CA' should match code field");

    data.insert("state".to_string(), json!("TX"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "'TX' not in states instance");
}

#[test]
fn choice_choices_from_with_nested_path() {
    // Instance data has options nested under a path
    let def = json!({
        "$formspec": "1.0",
        "url": "test://choices-from-path",
        "version": "1.0.0",
        "title": "ChoicesFrom Path Test",
        "items": [{
            "key": "dept",
            "type": "field",
            "dataType": "choice",
            "label": "Department",
            "choicesFrom": { "instance": "org", "path": "departments" }
        }]
    });

    let mut instances = HashMap::new();
    instances.insert("org".to_string(), json!({
        "name": "Acme Corp",
        "departments": [
            { "value": "eng", "label": "Engineering" },
            { "value": "sales", "label": "Sales" }
        ]
    }));

    let mut data = HashMap::new();
    data.insert("dept".to_string(), json!("eng"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "'eng' should be valid via nested path");

    data.insert("dept".to_string(), json!("hr"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(!mismatches.is_empty(), "'hr' not in departments");
}

#[test]
fn choice_choices_from_null_value_skips_validation() {
    // Null values should not produce TYPE_MISMATCH regardless of choicesFrom
    let def = json!({
        "$formspec": "1.0",
        "url": "test://choices-from-null",
        "version": "1.0.0",
        "title": "ChoicesFrom Null Test",
        "items": [{
            "key": "color",
            "type": "field",
            "dataType": "choice",
            "label": "Color",
            "choicesFrom": { "instance": "colors" }
        }]
    });

    let mut instances = HashMap::new();
    instances.insert("colors".to_string(), json!([
        { "value": "red", "label": "Red" }
    ]));

    let data = HashMap::new(); // no value = null
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "null should never produce TYPE_MISMATCH");
}

#[test]
fn choice_choices_from_instance_not_array_falls_back() {
    // Instance data at the resolved path is not an array — graceful degradation
    let def = json!({
        "$formspec": "1.0",
        "url": "test://choices-from-not-array",
        "version": "1.0.0",
        "title": "ChoicesFrom Non-Array Test",
        "items": [{
            "key": "color",
            "type": "field",
            "dataType": "choice",
            "label": "Color",
            "choicesFrom": { "instance": "config" }
        }]
    });

    let mut instances = HashMap::new();
    instances.insert("config".to_string(), json!({
        "theme": "dark",
        "version": 2
    }));

    let mut data = HashMap::new();
    data.insert("color".to_string(), json!("anything"));
    let result = evaluate_definition_full_with_instances(&def, &data, EvalTrigger::Continuous, &[], &instances);
    let mismatches: Vec<_> = result.validations.iter().filter(|r| r.code == "TYPE_MISMATCH").collect();
    assert!(mismatches.is_empty(), "non-array instance should fall back to string-only validation");
}
