//! Integration tests for `evaluate_with_trace`.
//!
//! These tests assert on the shape of emitted [`TraceStep`]s for small FEL
//! programs. They are the contract for the v0 trace API and the regression
//! guard for the non-tracing hot path.
use fel_core::{FelValue, MapEnvironment, Trace, TraceStep, evaluate, evaluate_with_trace, parse};
use rust_decimal::Decimal;
use serde_json::json;
use std::collections::HashMap;

fn env_with(fields: &[(&str, FelValue)]) -> MapEnvironment {
    let mut map = HashMap::new();
    for (k, v) in fields {
        map.insert((*k).to_string(), v.clone());
    }
    MapEnvironment::with_fields(map)
}

fn trace_for(source: &str, env: &MapEnvironment) -> Trace {
    let expr = parse(source).expect("parse should succeed");
    let (_result, trace) = evaluate_with_trace(&expr, env);
    trace
}

#[test]
fn field_ref_emits_single_field_resolved_step() {
    let env = env_with(&[("foo", FelValue::Number(Decimal::from(42)))]);
    let trace = trace_for("$foo", &env);

    assert_eq!(trace.steps.len(), 1);
    match &trace.steps[0] {
        TraceStep::FieldResolved { path, value } => {
            assert_eq!(path, "foo");
            assert_eq!(value, &json!(42));
        }
        other => panic!("expected FieldResolved, got {other:?}"),
    }
}

#[test]
fn addition_of_two_fields_emits_two_resolutions_and_one_binary_op() {
    let env = env_with(&[
        ("a", FelValue::Number(Decimal::from(3))),
        ("b", FelValue::Number(Decimal::from(4))),
    ]);
    let trace = trace_for("$a + $b", &env);

    assert_eq!(trace.steps.len(), 3, "got trace: {:?}", trace.steps);
    match &trace.steps[0] {
        TraceStep::FieldResolved { path, value } => {
            assert_eq!(path, "a");
            assert_eq!(value, &json!(3));
        }
        other => panic!("expected FieldResolved($a), got {other:?}"),
    }
    match &trace.steps[1] {
        TraceStep::FieldResolved { path, value } => {
            assert_eq!(path, "b");
            assert_eq!(value, &json!(4));
        }
        other => panic!("expected FieldResolved($b), got {other:?}"),
    }
    match &trace.steps[2] {
        TraceStep::BinaryOp {
            op,
            lhs,
            rhs,
            result,
        } => {
            assert_eq!(op, "+");
            assert_eq!(lhs, &json!(3));
            assert_eq!(rhs, &json!(4));
            assert_eq!(result, &json!(7));
        }
        other => panic!("expected BinaryOp, got {other:?}"),
    }
}

#[test]
fn if_call_records_comparison_and_then_branch() {
    let env = env_with(&[("x", FelValue::Number(Decimal::from(5)))]);
    let trace = trace_for("if($x > 0, 'pos', 'neg')", &env);

    let kinds: Vec<&'static str> = trace
        .steps
        .iter()
        .map(|s| match s {
            TraceStep::FieldResolved { .. } => "FieldResolved",
            TraceStep::FunctionCalled { .. } => "FunctionCalled",
            TraceStep::BinaryOp { .. } => "BinaryOp",
            TraceStep::IfBranch { .. } => "IfBranch",
            TraceStep::ShortCircuit { .. } => "ShortCircuit",
        })
        .collect();

    assert!(
        kinds.contains(&"BinaryOp"),
        "expected comparison BinaryOp in trace: {kinds:?}"
    );
    let if_branch = trace
        .steps
        .iter()
        .find_map(|s| match s {
            TraceStep::IfBranch {
                condition_value,
                branch_taken,
            } => Some((condition_value.clone(), *branch_taken)),
            _ => None,
        })
        .expect("IfBranch step");
    assert_eq!(if_branch.0, json!(true));
    assert_eq!(if_branch.1, "then");
}

#[test]
fn sum_emits_function_called_step() {
    let env = MapEnvironment::new();
    let trace = trace_for("sum([1, 2, 3])", &env);

    let call = trace
        .steps
        .iter()
        .find_map(|s| match s {
            TraceStep::FunctionCalled { name, args, result } => {
                Some((name.clone(), args.clone(), result.clone()))
            }
            _ => None,
        })
        .expect("FunctionCalled step");
    assert_eq!(call.0, "sum");
    assert_eq!(call.2, json!(6));
    // One array arg.
    assert_eq!(call.1.len(), 1);
    assert_eq!(call.1[0], json!([1, 2, 3]));
}

/// Regression: eager-function args that contain field references must only
/// emit FieldResolved steps from the *real* evaluation — the pre-eval used
/// to capture arg values for the trace record must not duplicate sub-steps.
/// Without suppression, `sum([$x, $y])` would emit FieldResolved x4 instead
/// of x2.
#[test]
fn eager_function_with_field_ref_args_does_not_duplicate_sub_steps() {
    let env = env_with(&[
        ("x", FelValue::Number(Decimal::from(5))),
        ("y", FelValue::Number(Decimal::from(3))),
    ]);
    let trace = trace_for("sum([$x, $y])", &env);

    let field_resolved_paths: Vec<&str> = trace
        .steps
        .iter()
        .filter_map(|s| match s {
            TraceStep::FieldResolved { path, .. } => Some(path.as_str()),
            _ => None,
        })
        .collect();
    // Each field should appear exactly once.
    assert_eq!(
        field_resolved_paths,
        vec!["x", "y"],
        "expected one FieldResolved per field; trace: {:?}",
        trace.steps,
    );

    // FunctionCalled step is still present and captures the array value.
    let call = trace
        .steps
        .iter()
        .find_map(|s| match s {
            TraceStep::FunctionCalled { name, args, result } => {
                Some((name.clone(), args.clone(), result.clone()))
            }
            _ => None,
        })
        .expect("FunctionCalled step");
    assert_eq!(call.0, "sum");
    assert_eq!(call.1, vec![json!([5, 3])]);
    assert_eq!(call.2, json!(8));
}

#[test]
fn short_circuit_and_skips_right_operand() {
    // Right side references an undefined field. If the short-circuit is
    // honoured, the field is never resolved and no FieldResolved step is
    // emitted for it.
    let env = MapEnvironment::new();
    let trace = trace_for("false and $undefined", &env);

    let has_skipped_ref = trace
        .steps
        .iter()
        .any(|s| matches!(s, TraceStep::FieldResolved { path, .. } if path == "undefined"));
    assert!(
        !has_skipped_ref,
        "right side must not be resolved: {:?}",
        trace.steps
    );

    let short = trace
        .steps
        .iter()
        .find_map(|s| match s {
            TraceStep::ShortCircuit { op, reason } => Some((op.clone(), reason.clone())),
            _ => None,
        })
        .expect("ShortCircuit step");
    assert_eq!(short.0, "and");
    assert!(
        short.1.contains("false"),
        "reason should mention the false left: {}",
        short.1
    );
}

#[test]
fn short_circuit_or_skips_right_operand() {
    let env = MapEnvironment::new();
    let trace = trace_for("true or $undefined", &env);

    let has_skipped_ref = trace
        .steps
        .iter()
        .any(|s| matches!(s, TraceStep::FieldResolved { path, .. } if path == "undefined"));
    assert!(!has_skipped_ref);

    let short = trace.steps.iter().any(|s| {
        matches!(
            s,
            TraceStep::ShortCircuit { op, .. } if op == "or"
        )
    });
    assert!(short, "expected an 'or' ShortCircuit step");
}

#[test]
fn tracing_and_non_tracing_paths_agree_on_result() {
    let env = env_with(&[
        ("a", FelValue::Number(Decimal::from(7))),
        ("b", FelValue::Number(Decimal::from(11))),
        ("n", FelValue::Number(Decimal::from(4))),
        (
            "items",
            FelValue::Array(vec![
                FelValue::Number(Decimal::from(1)),
                FelValue::Number(Decimal::from(2)),
                FelValue::Number(Decimal::from(3)),
            ]),
        ),
        ("maybe", FelValue::Null),
        ("fallback", FelValue::Number(Decimal::from(99))),
    ]);

    // Exercise every expression kind the evaluator supports: the ones that
    // emit trace steps *and* the ones that deliberately don't. Either way,
    // the value and diagnostic count must match the plain evaluator — this
    // is the primary regression guard for anyone touching the evaluator.
    for source in [
        // Already covered: arithmetic, comparison, sum, short-circuit logic.
        "$a + $b",
        "if($a > $b, 'bigger', 'smaller')",
        "sum([$a, $b, 2])",
        "false and true",
        "true or false",
        "$a * ($b - 1)",
        // F4: expression kinds that deliberately emit no trace steps today.
        // Their *values* still have to match the plain path.
        "-$a",                          // UnaryOp
        "let x = $a + 1 in x * 2",      // LetBinding
        "coalesce($maybe, $fallback)",  // lazy function
        "length($items)",               // pure eager fn on an array
        "$items[*]",                    // wildcard postfix access
        "$a in [1, 7, 42]",             // Membership
        "{ key: $a, doubled: $a * 2 }", // Object literal
        "[$a, $b, $n]",                 // Array literal
    ] {
        let expr = parse(source).expect("parse");
        let plain = evaluate(&expr, &env);
        let (traced, _) = evaluate_with_trace(&expr, &env);
        assert_eq!(
            fel_core::fel_to_json(&plain.value),
            fel_core::fel_to_json(&traced.value),
            "value mismatch for: {source}"
        );
        assert_eq!(
            plain.diagnostics.len(),
            traced.diagnostics.len(),
            "diagnostic count mismatch for: {source}"
        );
    }
}

#[test]
fn else_branch_of_ternary_is_recorded() {
    let env = env_with(&[("x", FelValue::Number(Decimal::from(-3)))]);
    let trace = trace_for("if($x > 0, 'pos', 'neg')", &env);
    let branch = trace
        .steps
        .iter()
        .find_map(|s| match s {
            TraceStep::IfBranch { branch_taken, .. } => Some(*branch_taken),
            _ => None,
        })
        .expect("IfBranch step");
    assert_eq!(branch, "else");
}
