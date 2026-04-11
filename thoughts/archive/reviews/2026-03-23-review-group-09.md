# Group 9 Review — Python/Rust Bridge Hardening

## Summary

Three commits that collectively harden the Python-Rust FFI boundary, align conformance tests with current schema shapes, and fix linting semantic errors. The bridge hardening (b8db976) is the most structurally important: it adds an import-time contract check that fails fast with a clear reinstall message when the Rust extension is stale or missing exports. The conformance alignment (89d078c) is largely correct but contains two genuine behavior-confirming test fixes buried among schema-marker additions. The linting alignment (6184b95) fixes two real bugs. Overall the group ships mostly clean work with two medium-priority issues that don't block behavior but leave gaps worth closing.

---

## Findings

### [High]: `ensureCurrentFormspecRust` guard does not check for `context` parameter

**File(s):** `packages/formspec-core/tests/python.ts:17-34`

**Details:**
`hasCurrentEvaluateDefSignature` detects a stale Rust extension by checking that the `evaluate_def` function signature includes `registry_documents=None` and `instances=None`. However, the `context` parameter was added to `evaluate_def` in commit 9641ec2 (after b8db976) and is not in the guard check. A developer with a binary built from the b8db976 era — before 9641ec2 — would pass the guard (both `registry_documents` and `instances` present), but `context` would be missing. The call in `_rust.py:evaluate_definition` passes `context` positionally as the 6th argument:

```python
raw = formspec_rust.evaluate_def(
    definition, data, mode, registry_documents, instances, context
)
```

On a stale binary, this 6th positional argument silently goes into the wrong slot or raises a `TypeError` at runtime — not at import time where the contract check lives.

**Recommendation:** Add `context=None` to the string check in `hasCurrentEvaluateDefSignature`. Also add `"apply_migrations_to_response_data"` and `"rewrite_fel_for_assembly"` to the exports check inside the same function (currently it checks 8 exports, but `_REQUIRED_EXPORTS` in `_rust.py` has 10 — those two are checked in the Python contract guard but not in the TS one). Both guards should track the same contract.

---

### [High]: Import-time contract check in `_rust.py` has a stale expected parameter list at commit b8db976

**File(s):** `src/formspec/_rust.py:84-98` (commit b8db976 state vs current `new` branch state)

**Details:**
The original hardening commit (b8db976) set `expected_params = ["definition", "data", "trigger", "registry_documents", "instances"]` — 5 parameters. The current `new` branch state has 6 parameters (adding `"context"`), which is correct for the binary produced by the current Rust code. This discrepancy was fixed in 9641ec2, so the current branch state is consistent. This is not a bug in the final state, but it shows the contract guard was immediately stale on commit and had to be patched one commit later.

**Recommendation:** This is a maintenance process concern, not a shipping blocker. The final state is correct. Going forward, treat the contract guard as a contract test — it should be updated in the same commit that changes the Rust function signature, not as a follow-on fix.

---

### [Medium]: `_severity_from_str` maps `"info"` to `WARNING` with no comment

**File(s):** `src/formspec/_rust.py:169-174`

**Details:**
```python
def _severity_from_str(raw: str | None) -> Severity:
    if raw == "warning":
        return Severity.WARNING
    if raw == "info":
        return Severity.WARNING   # <-- info → WARNING silently
    return Severity.ERROR
```

`Severity` only has `ERROR` and `WARNING` — there is no `INFO` variant. This means any `"info"` severity diagnostic from the Rust runtime gets silently promoted to `WARNING`. There is no test covering what happens when Rust emits an `"info"` severity diagnostic. The `Severity` enum docstring says "ERROR halts nothing but signals a problem; WARNING is advisory" — there is no acknowledged INFO tier.

The behavior is defensible (better to over-report than under-report) but the silent promotion is invisible to callers. If the Rust runtime ever emits `"info"` for purely informational hints (not warnings), callers will treat them as warnings.

**Recommendation:** Add an `INFO` variant to `Severity` if the Rust runtime can emit it, or document the deliberate demotion with a comment. A test covering this path would prevent future confusion.

---

### [Medium]: fastapi and httpx added to `pyproject.toml` test dependencies with no current test consumers

**File(s):** `pyproject.toml:12-13`

**Details:**
`fastapi>=0.110` and `httpx>=0.27` were added to the `[project.optional-dependencies] test` section in b8db976. Neither is imported anywhere in `tests/`. The worktree at `.claude/worktrees/tailwind-adapter/tests/e2e/api/conftest.py` uses them, suggesting they were added in anticipation of an unreleased API test suite, but that suite is not in the main working tree.

These are non-trivial dependencies (fastapi pulls in starlette, pydantic v2, and anyio; httpx pulls in httpcore). They will be installed whenever any developer runs `pip install -e '.[test]'` without providing any test value. Per the project philosophy: don't add things before they're needed.

**Recommendation:** Remove both entries from `pyproject.toml` until the API test suite lands in the main tree. Add them in the same commit that adds the tests.

---

### [Low]: `resolve_path` hardcodes `"E300"` inside `validate_simple_key`, but the code path is safe

**File(s):** `crates/formspec-lint/src/references.rs:218-222`

**Details:**
Inside `resolve_path`, when the path has no dots or brackets, it calls `validate_simple_key(path, "$", label, "E300", index)`. The error code `"E300"` is hardcoded here even though `resolve_path` is also used to validate shape targets (which should emit `"E301"`). However, `validate_path` extracts only the error *message* from the `Result::Err` variant and then creates a new `LintDiagnostic` with the correct caller-supplied `error_code`. So E301 shape target errors do get the right code. The hardcoded `"E300"` is never used — it only appears in an intermediate `LintDiagnostic` that is immediately destructured for its message string.

This is confusing to read and could become a real bug if `validate_simple_key` is ever called directly. The code is correct but fragile.

**Recommendation:** Extract just the message string directly rather than constructing a throwaway diagnostic. Alternatively, change `validate_simple_key` to return `Option<String>` (the message only) rather than `Option<LintDiagnostic>`. This would make the intent explicit.

---

### [Low]: Conformance test marker-injection fixes actual schema gaps, not just test gaps

**File(s):** `tests/conformance/spec/test_spec_examples.py`, `tests/conformance/fuzzing/test_property_based.py`, `examples/grant-application/fixtures/submission-amended.json`

**Details:**
The `_normalize_spec_doc` helper and the fuzzing generator additions add `$formspecResponse: "1.0"`, `$formspecValidationResult: "1.0"`, etc. to documents before validating them against schemas. This is correct: those marker fields are required by the schemas but are optional or absent from spec examples in the prose documentation. The tests were previously papering over missing markers with schema-level `additionalProperties: false` tolerance.

However, this fix is correct only if the spec examples are intentionally abbreviated (showing partial documents) rather than complete examples. If the spec intends the examples to be copy-paste-ready, the examples themselves should include the marker fields. The grant-application fixture `submission-amended.json` now has `$formspecValidationResult: "1.0"` inline — that's the right place for a production fixture. But the spec prose examples still lack the markers.

**Recommendation:** Low priority, but worth an audit of spec prose examples to add marker fields where the example is meant to be a complete, validatable document.

---

### [Positive]: `instantiate_wildcard_expr` index off-by-one fix is correct

**File(s):** `crates/formspec-eval/src/rebuild.rs:417`

**Details:**
The change from `index + 1` to `index` in `instantiate_wildcard_expr` aligns wildcard instantiation with 0-based array indexing throughout the Rust engine. The old code was generating `$items[1].qty` for the first instance (index=0), which would miss index 0 entirely and double-count index 1. This is a genuine behavioral correctness fix for repeatable group FEL evaluation. The test updates in the same diff confirm the fix.

---

### [Positive]: Accordion bind exception is correct and spec-traceable

**File(s):** `crates/formspec-lint/src/pass_component.rs:42-52`, `skills/formspec-specs/references/component-spec.md:37`

**Details:**
Removing `"Accordion"` from `CONTAINER_NO_BIND` is justified: the spec update in the same commit explicitly extends S4.4 to allow Accordion (alongside DataTable) to bind repeatable groups. The spec change and the Rust lint change are co-committed. The test `accordion_bind_no_w801` provides direct regression coverage.

---

### [Positive]: E806 custom component param check is semantically correct after fix

**File(s):** `crates/formspec-lint/src/pass_component.rs:232-252`

**Details:**
The old check was `node.get(param_name).is_none()` — looking for params as top-level node properties. The new check looks in `node.get("params")` as an object. This matches the component schema where custom component params are nested under a `params` object, not at the top level. The test updates reflect the correct document shape. This was a real semantic bug.

---

## Verdict

**Ship with fixes.**

The two High findings are actually about the same underlying issue: the TS-side `ensureCurrentFormspecRust` guard was not updated when the `context` parameter was added to `evaluate_def`. Since the contract check at Python import time (`_assert_rust_extension_contract`) was correctly updated in 9641ec2, Python-side startup is safe. The TS guard is the gap — it can let a stale binary through that will then fail at runtime in the TS-invoked Python process. This is worth a targeted fix before merging.

The Medium findings (severity mapping, premature dependencies) are minor housekeeping items that don't affect correctness in the current test suite but accumulate as technical debt.

Everything else in this group is correct, well-reasoned, and improves the codebase.
