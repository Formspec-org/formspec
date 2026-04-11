# Rust Crates Code Review — 2026-03-21

Comprehensive review of all 6 Rust crates in `crates/`. Each crate was reviewed file-by-file for correctness, safety, API design, Rust idioms, code quality, and test coverage.

| Crate | Tests | Critical | High | Medium | Low | Nit |
|---|---|---|---|---|---|---|
| **fel-core** | 385 | 2 | 4 | 8 | 7 | 5 |
| **formspec-core** | 273 | 0 | 3 | 7 | 8 | 5 |
| **formspec-eval** | 144 | 0 | 3 | 7 | 8 | 4 |
| **formspec-lint** | 272 | 0 | 3 | 8 | 7 | 4 |
| **formspec-wasm** | — | 0 | 2 | 4 | 5 | 4 |
| **formspec-py** | 80 | 0 | 2 | 7 | 6 | 5 |

All crates pass clippy with no warnings and are `rustfmt` clean. No `unsafe` code found anywhere.

---

## Cross-Cutting Patterns

These issues appear across multiple crates and should be addressed systematically:

1. **Non-deterministic `HashSet` iteration in output** — formspec-wasm (`analyze_fel_wasm`), formspec-py (`extract_deps`, `analyze_expression`). Sort before serialization.
2. **Missing standard derives** (`PartialEq`, `Eq`, `Debug`, `Hash`) on public types — all crates. Makes test assertions harder and limits composability.
3. **`rust_decimal` as runtime dep when only used in tests** — formspec-lint and formspec-wasm. Should be `[dev-dependencies]`.
4. **Stringly-typed fields where enums would be safer** — `ItemInfo.data_type`, `ValidationResult.severity`, linter diagnostic codes, `NrbMode`, `WhitespaceMode`.
5. **Truncation casts without guards** (`f as i64`, `u64 as usize`, `i64 as i32`) — formspec-core runtime mapping, formspec-wasm on 32-bit WASM target.
6. **Duplicated constants/logic across crates** — `RESERVED_CONTEXT_NAMES` in formspec-core (defined identically in `fel_analysis.rs` and `fel_rewrite_exact.rs`), `parse_registry_status` vs `parse_status_str` in formspec-wasm.

---

## fel-core

**Crate path:** `crates/fel-core/`
**Purpose:** FEL (Formspec Expression Language) lexer, parser, AST, evaluator, dependency extraction, and printer.
**Tests:** 385 passing. Clippy clean. Fmt clean.

### Critical

#### C1. `power()` with large non-negative integer exponent is O(n) and unbounded

**File:** `evaluator.rs:1185-1196`

```rust
if let Some(exp_u64) = exp.to_u64() {
    let mut result = Decimal::ONE;
    for _ in 0..exp_u64 {
        result = match result.checked_mul(base) { ... };
    }
    return FelValue::Number(result);
}
```

If a user writes `power(2, 4294967295)` (or any huge u64), this loop runs billions of times. Even though `checked_mul` will eventually overflow and return early, a malicious expression can cause a multi-second (or multi-minute) hang.

**Fix:** Cap `exp_u64` at a reasonable maximum (e.g., 10,000) before entering the loop, emitting a diagnostic for larger values.

#### C2. Regex denial-of-service: `size_limit` alone is not sufficient

**File:** `evaluator.rs:1092`

```rust
match RegexBuilder::new(&pattern).size_limit(1_000_000).build() {
```

The `size_limit` caps the compiled NFA size but does not prevent all pathological runtime. More importantly, there's no `dfa_size_limit` set, so the DFA cache can grow unbounded on complex patterns against long strings.

**Fix:** Add `.dfa_size_limit(256_000)` and consider documenting that user-supplied patterns must be trusted or sandboxed.

### High

#### H1. Hardcoded date in `MapEnvironment` makes `today()`/`now()` silently wrong

**File:** `evaluator.rs:104-122`

`MapEnvironment` is a public type (re-exported from `lib.rs`) and is the "simple" environment users reach for first. Its `today()` returns a hardcoded March 20, 2026. This will silently produce wrong results for any caller who doesn't realize they need `FormspecEnvironment` instead.

**Fix:** `MapEnvironment` should return `None` (producing `FelValue::Null`) and let callers who need date functions use `FormspecEnvironment`.

#### H2. `parse_datetime_literal` timezone stripping is fragile

**File:** `types.rs:259-261`

```rust
let s = s.trim_end_matches('Z');
let s = if s.len() > 19 { &s[..19] } else { s };
```

Timezone info is silently discarded with no diagnostic. `@2024-01-15T10:30:00+09:00` and `@2024-01-15T10:30:00-05:00` parse to the same datetime.

#### H3. Lexer `read_date_literal` does not validate the time component

**File:** `lexer.rs:293-327`

The lexer blindly advances 8 characters for the time part (`HH:MM:SS`) after seeing `T`, without checking that those characters are actually digits and colons. `@2024-01-15Tgarbage` produces a `DateTimeLiteral` token containing nonsense. The date portion is carefully validated; the time portion is not.

#### H4. `_input` field in `Lexer` is unused

**File:** `lexer.rs:75`

```rust
_input: &'a str,
```

The field is genuinely never read. The entire input is consumed via `chars: Vec<char>`. This wastes memory (stores both the original `&str` and the `Vec<char>`). The lifetime `'a` on `Lexer` exists solely because of this unused field.

### Medium

#### M1. `days_in_month` unreachable fallback returns 30

**File:** `types.rs:237`

After handling months 1-12, the `_ =>` arm returns 30 for invalid months like 0 or 13. The `debug_assert!` only fires in debug builds. In release builds, `days_in_month(2024, 13)` silently returns 30.

#### M2. `FelValue` does not implement `Eq`

**File:** `types.rs:7`

`FelValue` only has `PartialEq`. `Decimal` does implement `Eq`, so this could be derived. Missing `Eq` means `FelValue` can't be used in `HashSet` or as a `HashMap` key.

#### M3. `FelError` does not implement `PartialEq`

**File:** `error.rs:4-8`

Makes testing error variants awkward — tests have to use `is_err()` and string matching rather than matching the variant directly.

#### M4. Object equality is order-dependent

**File:** `evaluator.rs:698`

`Object` is `Vec<(String, FelValue)>`, so `{a: 1, b: 2} = {b: 2, a: 1}` returns `false`. If the spec says objects are unordered maps, this is a bug.

#### M5. `civil_from_days_pub` is a wrapper with no value

**File:** `types.rs:316-318`

Public function exists solely so tests can call the private `civil_from_days`. The `_pub` suffix is a code smell. Either make `civil_from_days` public directly or use `#[cfg(test)]` visibility.

#### M6. `as_array` returns `Option<&Vec<FelValue>>` instead of `Option<&[FelValue]>`

**File:** `types.rs:122-127`

Returning `&Vec<T>` instead of `&[T]` is not idiomatic Rust.

#### M7. `fn_format` applies both `{N}` and `%s` replacement, potentially double-substituting

**File:** `evaluator.rs:1104-1139`

The format function first replaces `{0}`, `{1}`, etc., then checks for `%s` and does sequential replacement using the same `values` vector. `format("{0} %s", "hello", "world")` produces `"hello hello"` — `{0}` becomes `"hello"`, then `%s` gets `values[0]` which is also `"hello"`, and `"world"` is ignored.

#### M8. `num_op` uses string matching for operator dispatch

**File:** `evaluator.rs:637-673`

The operator is passed as `&str` (`"+"`, `"-"`, `"*"`) and matched with string comparison. Should use the `BinaryOp` enum for type safety.

### Low

#### L1. Unnecessary `.clone()` in parser

**File:** `parser.rs:85, 445, 451, 533, 551, 578, 651`

`self.peek().clone()` clones the entire `Token` enum (which contains `String`s and `Decimal`) just to match on it. A reference match would avoid these heap allocations.

#### L2. `eat_identifier` clones token string twice

**File:** `parser.rs:85-96`

The first `.clone()` on `self.peek()` clones the string inside `Identifier`. Then `name.clone()` clones it again. Double allocation for every identifier parsed.

#### L3. No `Hash` derive on `FelDate`

**File:** `types.rs:19`

`FelDate` has `PartialEq, Eq` but no `Hash`. Prevents use as map keys.

#### L4. `let_vars` uses `Vec` for O(n) `contains` checks

**File:** `dependencies.rs:31-32, 43, 49`

Linear search in a `Vec<String>`, plus `"$".to_string()` allocates a new String on every check. A `HashSet` would be more appropriate.

#### L5. `Span` fields are stored but AST nodes don't carry span information

**File:** `lexer.rs:62-66`

`SpannedToken` wraps span data, but AST nodes do not carry span information. Error messages from the evaluator cannot point to source locations. Design gap rather than a bug.

#### L6. `dependencies.rs` marks `parent()` as `uses_prev_next`

**File:** `dependencies.rs:113-115`

The field is called `uses_prev_next`, but `parent()` is semantically different from `prev()`/`next()`. A separate `uses_parent` flag would be cleaner.

#### L7. `BuiltinFunctionCatalogEntry` does not derive common traits

**File:** `extensions.rs:13-18`

No derives at all — no `Debug`, `Clone`, `PartialEq`.

### Nit

#### N1. `ExtensionFunc` field `name` is redundant with the HashMap key

**File:** `extensions.rs:22-31, 465-468`

Three allocations (the key, `name.clone()` inside the struct) for the same string.

#### N2. Doc comment on `lib.rs` uses `///` instead of `//!`

**File:** `lib.rs:2-3`

The second line uses `///` (item doc comment) instead of `//!` (module doc comment), so it attaches to the next item rather than the module.

#### N3. `_name` parameter in `fn_str2` is unused

**File:** `evaluator.rs:1015`

Parameter was presumably intended for diagnostics but is never read.

#### N4. `is_date_literal_ahead` has a redundant length check

**File:** `lexer.rs:278-284`

After confirming `self.pos + 11 <= self.chars.len()`, the slice is guaranteed to have 11 characters. The subsequent `slice.len() < 11` check is dead code.

#### N5. Missing `#[must_use]` on key public functions

Functions like `parse`, `evaluate`, `print_expr`, `extract_dependencies`, `json_to_fel`, `fel_to_json` return values that should never be silently discarded.

### Test Coverage Gaps

1. No tests for the `extensions` module being used through the evaluator (the registry exists but isn't wired into the evaluator).
2. No tests for `PostfixAccess` with chained operations like `someFunc().field[0].nested`.
3. No tests for integer overflow in date arithmetic (e.g., `dateAdd(@2024-01-01, 9999999999999, 'days')`).
4. No property-based / fuzz tests for the parser.

---

## formspec-core

**Crate path:** `crates/formspec-core/`
**Purpose:** Non-reactive processing layer — FEL analysis, path utilities, schema validation, definition assembly, runtime mapping, extension validation, changelog generation, and registry client.
**Tests:** 273 passing. Clippy clean. Fmt clean.

### High

#### H1. Assembler variables section is dead code

**File:** `assembler.rs:119-127`

The variables section in `assemble_definition` copies variables verbatim without resolving `$ref` fragments. But more importantly, this block is dead logic: it copies `definition.get("variables")` into `result.definition`, which was already cloned from `definition` on line 98. The copy is identical to what was already there. Either this is a placeholder that was never completed, or dead code that should be removed.

#### H2. Key collision detection runs AFTER items are already merged

**File:** `assembler.rs:302-318`

The collision check in `apply_fragment` runs after the fragment's items have already been prefixed and merged into `children` (lines 230-244). By the time the collision check fires, the colliding data is already in the output. While it pushes an error, it returns the partially-corrupted merged result rather than the pre-merge state.

**Fix:** Run collision detection before the merge, or return a clean result on collision.

#### H3. `json_pointer_to_jsonpath` silently misinterprets leading-zero segments

**File:** `schema_validator.rs:217-232`

Per RFC 6901, JSON Pointer segments are opaque strings. `"01"` is the literal property name `"01"`, not array index `1`. The function treats any segment that parses as `usize` as an array index, which means `"/items/01/key"` becomes `"$.items[1].key"` instead of `"$.items.01.key"`. Documented in a test but not fixed.

### Medium

#### M1. `Change` struct missing common derives

**File:** `changelog.rs:46-56`

`Change` and `Changelog` lack `Debug`, `Clone`, `PartialEq` derives, unlike every other public type in the crate. Impossible to debug-print changelogs, compare changes in tests, or clone a `Changelog`.

#### M2. O(n^2) lookup in changelog diff loops

**File:** `changelog.rs:160-164, 277-278`

```rust
if let Some(&(_, new_val)) = new_map.iter().find(|(k, _)| *k == key)
```

Called in a loop over all old keys, making modification detection O(n^2). Values should be in a `HashMap` for O(1) lookup.

#### M3. `f as i64` truncation without warning in runtime mapping

**File:** `runtime_mapping.rs:512-513`

```rust
Value::Number(serde_json::Number::from(f as i64))
```

For values outside `i64` range, this is a truncating cast. A diagnostic should be emitted. The `_rule_idx` and `_target_path` parameters are available but unused.

#### M4. `as_f64().unwrap_or(0.0)` for boolean coercion of numbers

**File:** `runtime_mapping.rs:529`

`as_f64()` returns `None` for numbers that can't be represented as f64. Treating those as `0.0` (thus `false`) is silent data loss.

#### M5. FEL parse failure silently returns original expression

**File:** `assembler.rs:369`

When `rewrite_fel_string` fails to parse the FEL expression, it silently returns the original. Invalid FEL in imported fragment binds will pass through without any warning in the `AssemblyResult`.

#### M6. `current()` saturating index hides parser bugs

**File:** `fel_rewrite_exact.rs:88-89`

```rust
fn current(&self) -> &SpannedToken {
    &self.tokens[self.pos.min(self.tokens.len().saturating_sub(1))]
}
```

Silently returns the last token when `pos` is out of bounds, masking parser bugs that over-advance the position.

#### M7. `normalize_path_segment` correctness note

**File:** `path_utils.rs:7-11`

`str::find('[')` returns a byte offset, and `&segment[..idx]` does byte slicing. Safe because `'['` is single-byte ASCII, but fragile if a different multi-byte delimiter were ever added.

### Low

#### L1. No Serde derives on changelog types

**File:** `changelog.rs`

None of the changelog types have Serde derives. Since changelogs are described in a JSON schema, serialization will eventually be needed.

#### L2. `ExtensionItem` trait returns owned `Vec<String>`

**File:** `extension_analysis.rs:97-105`

Allocates a new `Vec<String>` for every item visited during tree walking. A `&[String]` or `Cow` return would avoid per-item allocation.

#### L3. `find_one()` discards full `find()` results

**File:** `registry_client.rs:128-143`

`find()` allocates and sorts a `Vec`, then `find_one()` calls `find()` and takes only the first element. Could short-circuit.

#### L4. `split_path` does not handle escaped dots

**File:** `runtime_mapping.rs:146-173`

Property names containing dots or brackets in the source data would be incorrectly split.

#### L5. `get_by_path` returns `&Value::Null` via conceptually misleading lifetime

**File:** `runtime_mapping.rs:177`

The function signature implies the returned reference is borrowed from `obj`, but in the null case it's a reference to a static `Value::Null`. Clippy doesn't flag this, but it's conceptually misleading.

#### L6. `assemble_definition` takes `&Value` but clones it immediately

**File:** `assembler.rs:96`

Accepting `Value` (owned) would avoid one allocation when callers are about to drop the original.

#### L7. `RewriteFn`/`RewriteFn2` are not `Send + Sync`

**File:** `fel_analysis.rs:13-16`

Makes `RewriteOptions` `!Send + !Sync`. If the crate is used in async contexts, this will be a friction point.

#### L8. `parse_version` silently ignores pre-release identifiers

**File:** `registry_client.rs:268-275`

`"1.0.0-beta.1"` parses as `(1, 0, 0)` — two different pre-release versions compare as equal.

### Nit

#### N1. `_ref_uri` has underscore prefix but is used

**File:** `assembler.rs:212, 313`

The leading underscore suggests "unused" but `_ref_uri` is actually used on line 313 in the `KeyCollision` error.

#### N2. Duplicated `RESERVED_CONTEXT_NAMES` constant

**File:** `fel_analysis.rs:116`, `fel_rewrite_exact.rs:8`

Defined identically in both files. Should be a single constant re-exported from one location.

#### N3. Boolean-to-number coercion readability

**File:** `runtime_mapping.rs:505`

`Value::Number(serde_json::Number::from(if *b { 1 } else { 0 }))` — `i32::from(*b)` would be clearer.

#### N4. `AssemblyError` doesn't derive `PartialEq` or `Eq`

**File:** `assembler.rs:18-27`

All other error enums in the crate derive `PartialEq, Eq`, making them easy to test with `assert_eq!`. `AssemblyError` only derives `Debug, Clone`.

#### N5. No public doc-tests in any module

Zero doc-tests. Public functions like `analyze_fel`, `assemble_definition`, `validate_extension_usage` would benefit from `///` doc examples.

---

## formspec-eval

**Crate path:** `crates/formspec-eval/`
**Purpose:** 4-phase batch evaluator (rebuild, recalculate, revalidate, NRB) for Formspec definitions.
**Tests:** 144 passing. Clippy clean. Fmt clean.

### High

#### H1. `bytes[i] as char` is unsound for non-ASCII paths

**File:** `types.rs:191-233`

Both `strip_indices` and `to_wildcard_path` iterate over `path.as_bytes()` and cast individual bytes to `char` via `bytes[i] as char`. This produces garbage for any multi-byte UTF-8 character. A field key like `"nom_de_l'employé"` will be silently corrupted. These functions are used in NRB resolution (`nrb.rs:21,30`), wildcard expansion, and dependency graphs.

**Fix:** Iterate over `path.chars()` or `path.char_indices()`.

#### H2. `unwrap()` in non-test code: `topo_sort_variables`

**File:** `recalculate.rs:29`

```rust
let var = variables.iter().find(|v| v.name == name).unwrap();
```

In a public function, not under `#[cfg(test)]`. Could panic with duplicate variable names across scopes.

**Fix:** Replace with `.expect()` at minimum, or return an error.

#### H3. Operator precedence issue in integer type check

**File:** `revalidate.rs:120-125`

```rust
!(val.is_i64()
    || val.is_u64()
    || val.is_f64() && {
        let f = val.as_f64().unwrap();
        f.fract() == 0.0
    })
```

Correct but fragile — relies on `&&` binding tighter than `||`. The `unwrap()` is guarded only by short-circuit evaluation.

**Fix:** Add explicit parentheses: `|| (val.is_f64() && val.as_f64().unwrap().fract() == 0.0)`.

### Medium

#### M1. `resolve_nrb` parent recursion doesn't use `items` hierarchy

**File:** `nrb.rs:39-42`

`parent_path` does `rfind('.')` on the path string — a syntactic operation that doesn't consult the `ItemInfo` tree's `parent_path` field. For indexed paths like `"items[0].total"`, recursion tries paths that don't correspond to actual `ItemInfo` entries.

#### M2. `collect_non_relevant_with_nrb` ignores parent NRB resolution

**File:** `nrb.rs:70-90`

This function only checks the item's own `nrb` field then falls back to the definition default, skipping the wildcard/stripped-indices/parent precedence chain that `resolve_nrb` implements. `apply_nrb` (which uses this function) may apply a different NRB mode than `resolve_nrb` would for the same path.

#### M3. `topo_sort_variables` does not handle duplicate names across scopes correctly

**File:** `recalculate.rs:19-47`

Deduplication via `HashSet<&str>` collapses multiple variables with the same name but different scopes into a single entry. The topo sort order may not correctly sequence scope-variant dependencies.

#### M4. Unknown shape timing values evaluated in Submit mode

**File:** `revalidate.rs:54-66`

If a shape has `"timing": "invalid_value"`, it will be skipped in `Continuous` mode but evaluated in `Submit` mode (since it's not `"demand"`). The spec probably wants unknown timing values treated as `"continuous"`.

#### M5. `expand_wildcard_path` only expands the first `[*]`

**File:** `rebuild.rs:167`

```rust
let parts: Vec<&str> = pattern.splitn(2, "[*]").collect();
```

For nested wildcards like `"items[*].subitems[*].value"`, only the outer `[*]` is expanded. Documented in a test as intentional, but means nested repeat groups with wildcard binds cannot be fully expanded.

#### M6. `ItemInfo` has many `String` fields that could be enums

**File:** `types.rs:10-59`

Fields like `data_type`, `nrb`, `excluded_value`, and `whitespace` are `Option<String>` but have a small set of valid values. Parsing happens at use-site rather than construction time, losing the chance to reject invalid values early.

#### M7. `detect_repeat_count` with sparse indices returns `max_index + 1`

**File:** `rebuild.rs:233-251`

If data has keys `items[0].name` and `items[5].name` but nothing in between, returns 6 — creating 4 empty instances that may cause false validation errors.

### Low

#### L1. `ValidationResult` uses stringly-typed fields

**File:** `types.rs:70-86`

`severity`, `constraint_kind`, `code`, and `source` are all `String` with fixed known values. Using enums would prevent typos.

#### L2. Missing `PartialEq` derive on `ItemInfo`

**File:** `types.rs:10`

Only derives `Debug, Clone`. Tests use field-by-field assertions instead of `assert_eq!`.

#### L3. `EvaluationResult` lacks `PartialEq`

**File:** `types.rs:151`

Same issue — makes testing harder.

#### L4. Two separate env population loops in `recalculate`

**File:** `recalculate.rs:136-146`

Environment is populated, whitespace applied, then the entire env is repopulated. O(2n) — could be optimized to only update changed fields.

#### L5. `instantiate_wildcard_expr` can match false prefixes

**File:** `rebuild.rs:303-307`

`str::replace` is a naive string replace, not tokenizer-aware. If a FEL string literal contained `$row[*]`, it would be incorrectly rewritten.

#### L6. `resolve_value_by_path` does not document empty string path behavior

**File:** `convert.rs:8-45`

Empty path returns `Value::Null`. Behavior is tested but not documented.

#### L7. `collect_non_relevant` collects children redundantly

**File:** `types.rs:239-246`

Recurses into children unconditionally — if a parent is non-relevant, all its descendants appear in the output too. Creates redundancy.

#### L8. `.map(|s| s.to_string())` instead of `.map(str::to_string)`

**File:** `screener.rs:50-55`

Idiomatic Rust would use the function pointer form.

### Nit

#### N1. No doc comments on most public items

Most public functions have minimal or no `///` doc comments. Zero doc-tests.

#### N2. `make_item_with_parent` in NRB tests creates unused `parent_path` data

**File:** `nrb.rs:124`

The `parent_path` field set by this helper is not actually used by any NRB logic in `collect_non_relevant_with_nrb`. The test helper creates an illusion of testing parent-path behavior that isn't exercised.

#### N3. `path.clone()` in `build_item_info` could be avoided

**File:** `rebuild.rs:95`

Could be restructured to build children first and avoid the clone.

#### N4. Some test names use redundant `test_` prefix

Later tests in the same files drop the prefix, suggesting these are older tests that predate the `#[test]` convention.

### Test Coverage Gaps

1. No tests for non-ASCII field keys or paths (would expose H1).
2. No tests for `EvalTrigger::Disabled` mode suppressing bind validation.

---

## formspec-lint

**Crate path:** `crates/formspec-lint/`
**Purpose:** 8-pass static analysis pipeline for Formspec documents.
**Tests:** 272 passing. Clippy clean. Fmt clean.

### High

#### H1. `validate_dotted_path` accepts any sub-path if the base key exists

**File:** `references.rs:214-238`

The fallback checks only that the first segment (base key) exists. If `"address"` exists, then `address.typo`, `address.completely.invented.path` all silently pass. This is documented and tested as intentional, but it's a false-negative-by-design that weakens the linter's value.

**Recommendation:** Emit a W-level warning when the full dotted path is not in `by_full_path` but the base key exists.

#### H2. Unused `rust_decimal` dependency

**File:** `Cargo.toml:12`

`rust_decimal = "1"` is declared but never imported or used. Adds unnecessary compile time and binary size.

**Fix:** Remove the dependency.

#### H3. `is_css_color` does not validate functional notation content

**File:** `pass_theme.rs:62-66`

`rgb(not, valid, at all)` passes validation because the check only verifies the wrapper format `rgb(...)`.

**Recommendation:** Validate that content inside `rgb()`/`hsl()` contains only digits, decimals, commas, whitespace, and `%`.

### Medium

#### M1. `collect_fields` overwrites bare key with last item of that name

**File:** `pass_component.rs:116-145`

When multiple items share the same bare key at different nesting levels, the loop does `lookup.insert(key.to_string(), info)` — last one wins. Bind resolution for bare key could match against the wrong field's dataType.

**Recommendation:** Skip bare key insertion when the key is ambiguous (mirror the `ambiguous_keys` pattern from `tree.rs`).

#### M2. `collect_definition_item_keys` has same bare-key-last-wins pattern

**File:** `pass_theme.rs:307-330`

Same pattern as M1. Impact is lower since it's a `HashSet<String>` (just presence checks), so the behavior is correct.

#### M3. `walk_binds_object` re-extracts the value after checking it's an object

**File:** `expressions.rs:66-71`

Confirms the value is an object, then passes the un-typed `Option<&Value>` to `walk_binds_object` which checks again.

#### M4. `LintDiagnostic` fields are all `String` where `Cow`/`&'static str` could reduce allocations

**File:** `types.rs:69-80`

For `code` specifically, these are always string literals like `"E100"`. Using `&'static str` would eliminate one allocation per diagnostic.

#### M5. Two parallel tree-walking functions that do nearly the same thing

**File:** `extensions.rs:133, 172`

`walk_items` and `collect_extensions_recursive` both walk the item tree extracting extensions. ~30 lines of near-identical recursion.

#### M6. `.unwrap()` after `is_none()` check instead of `let-else`

**File:** `lib.rs:48-62`

```rust
if doc_type.is_none() { ... return ... }
let doc_type = doc_type.unwrap();
```

**Fix:** Use `let Some(doc_type) = doc_type else { ... return ... };`

#### M7. `CompatRule` is not public

**File:** `component_matrix.rs:18`

Callers can query compatibility but cannot introspect the rules (e.g., to generate documentation).

#### M8. `is_builtin` linear scan on 37-element array

**File:** `pass_component.rs:91-93`

`ALL_BUILTINS.contains()` is O(n) per lookup. A `HashSet` or `phf` map would be more idiomatic. Impact negligible for realistic documents.

### Low

#### L1. Missing `PartialEq, Eq` derives on `LintResult`

**File:** `types.rs:174-182`

Only derives `Debug, Clone`. Adding `PartialEq` would make test assertions cleaner.

#### L2. `LintDiagnostic` is missing `PartialEq, Eq, Hash`

**File:** `types.rs:68-80`

Prevents using diagnostics in sets or comparing them in tests.

#### L3. Duplicate integration tests

**File:** `lib.rs:355-461`

`test_diagnostic_sorting` duplicates `diagnostic_sorting_uses_lexicographic_tuple`. `test_pass_gating_on_structural_errors` duplicates `pass_gating_stops_on_structural_errors`. `test_lint_mode_authoring_suppresses_w300` duplicates `lint_mode_authoring_suppresses_w300`.

#### L4. Logic bug in test: `test_diagnostic_sorting` assertion

**File:** `lib.rs:371-386`

The assertion uses `||` chaining that does NOT enforce lexicographic tuple ordering. Would pass for incorrectly-sorted results. The other sort test at line 253-258 uses correct tuple comparison.

**Fix:** Use `(a.pass, a.severity, &a.path) <= (b.pass, b.severity, &b.path)`.

#### L5. `CompiledExpression` stores full expression text

**File:** `expressions.rs:13`

Source string stored for every parsed expression, only used by `dependencies.rs` to extract `$ref` dependencies. The AST itself is discarded.

#### L6. Extension path format inconsistency

**File:** `extensions.rs:144-148`

For top-level items: `$.items[key=field]`. For nested: `{prefix}.{key}`. Different from the JSONPath convention used elsewhere.

#### L7. Extension walker doesn't track array index in path

**File:** `extensions.rs`

Uses key-based paths rather than index-based JSONPaths, making it impossible to correlate extension diagnostics with schema validation diagnostics.

### Nit

#### N1. `schema_validation` is private while other pass modules are public

Intentional since schema validation is only called from `lib.rs`, but the asymmetry is worth noting.

#### N2. `.expect()` on embedded schema parsing

**File:** `schema_validation.rs:70`

Fine for `include_str!` data, but would panic if schemas ever become runtime-loaded.

#### N3. Module visibility asymmetry

`schema_validation` is `mod` (private), all other pass modules are `pub mod`.

#### N4. Strict mode promotion happens after sorting

**File:** `lib.rs:141-146`

Promotion of W800/W802/W803/W804 to errors happens after `sort_diagnostics`. A promoted-to-error diagnostic would be sorted as a warning.

**Fix:** Move strict-mode promotion before `sort_diagnostics`, or re-sort after.

---

## formspec-wasm

**Crate path:** `crates/formspec-wasm/`
**Purpose:** WASM binding layer exposing Rust FEL evaluator, linter, mapping engine, registry client, and changelog to TypeScript via `wasm-bindgen`.
**Tests:** Inner-function tests only. No WASM-specific tests.

### High

#### H1. Massive code duplication in `RewriteOptions` construction

**File:** `lib.rs:307-351` and `lib.rs:373-418`

`rewrite_fel_references_wasm` and `rewrite_message_template_wasm` contain the exact same ~45-line `RewriteOptions` construction logic.

**Fix:** Extract a `build_rewrite_options(rewrites: &Value) -> RewriteOptions` helper.

#### H2. `parse_registry_status` silently defaults unknown strings to `Active`

**File:** `lib.rs:855-862`

A typo like `"actve"` silently becomes `Active`. Meanwhile `parse_status_str` (line 1265-1272) handles the same concept differently — returns `Option`, accepts `"stable"` alias.

**Fix:** Consolidate into one function.

### Medium

#### M1. `u64 -> usize` truncation on 32-bit WASM target

**File:** `lib.rs:1088-1089`

`as usize` on `wasm32` is 32 bits. A `u64` value greater than `u32::MAX` would silently truncate. Practically impossible, but technically unsound.

#### M2. `i64 as i32` truncation in mapping rule priority parsing

**File:** `lib.rs:1232, 1236`

Same class of issue. Use `i32::try_from(n).unwrap_or(0)`.

#### M3. `rust_decimal` is only used in `#[cfg(test)]` but listed as runtime dep

**File:** `Cargo.toml:16`

Adds unnecessary weight to the WASM binary.

**Fix:** Move to `[dev-dependencies]`.

#### M4. 1938-line monolithic file

**File:** `lib.rs`

Consider splitting into modules by domain: `fel.rs`, `mapping.rs`, `registry.rs`, `changelog.rs`, `lint.rs`, `eval.rs`, `helpers.rs`.

### Low

#### L1. `analyze_fel_wasm` uses unsorted `HashSet` iteration

**File:** `lib.rs:249-251`

`HashSet::iter()` has non-deterministic order. The sibling function `collect_fel_rewrite_targets_wasm` explicitly sorts its sets. This one does not — inconsistent.

#### L2. `json_item_at_path` and `json_item_location_at_path` share duplicated traversal

**File:** `lib.rs:30-75`

Nearly identical path-splitting and tree-traversal code. Only difference is return type.

#### L3. Missing test coverage for many `#[wasm_bindgen]` functions

Functions with no tests: `detect_doc_type`, `detect_document_type`, `plan_schema_validation_wasm`, `lint_document`, `lint_document_with_registries`, `validate_extension_usage_wasm`, `assemble_definition_wasm`, `execute_mapping_doc_wasm`, `item_at_path_wasm`, `item_location_at_path_wasm`, `rewrite_fel_references_wasm`, `rewrite_message_template_wasm`, `list_builtin_functions`, `normalize_path`, `json_pointer_to_jsonpath_wasm`, `validate_lifecycle_transition_wasm`, `well_known_registry_url`, `eval_fel_with_context`.

#### L4. `push_repeat_context` depth limit of 32 is arbitrary and undocumented

**File:** `lib.rs:1072-1074`

Silently drops data for deeply nested repeat contexts rather than returning an error.

#### L5. `status_to_str` maps `Active -> "stable"` but `parse_status_str` maps `"active" -> Active`

**File:** `lib.rs:1268, 1278`

Round-trip is asymmetric: `"active"` -> `Active` -> `"stable"`. Likely intentional but undocumented.

### Nit

#### N1. `WasmExtensionItem` derives `Debug` but not `Clone`

**File:** `lib.rs:779`

Internal type, but `Clone` would be derivable and useful.

#### N2. `detect_doc_type` returns `JsValue` while everything else returns `String`

**File:** `lib.rs:478`

Breaks the "everything returns JSON strings" contract described in the module doc comment. Consider returning `"null"` as a string for consistency.

#### N3. Unnecessary `.cloned()` in `parse_mapping_document_inner`

**File:** `lib.rs:1251`

Creates a full deep clone of the rules array, then immediately passes by reference. Could use a reference instead.

#### N4. `json!()` wrapping `collect::<Vec<_>>()` is redundant

**File:** `lib.rs:424, 903`

`json!()` wrapping a `Vec<Value>` just converts it to `Value::Array`. Could use `Value::Array(...)` directly.

---

## formspec-py

**Crate path:** `crates/formspec-py/`
**Purpose:** PyO3 bindings exposing Rust FEL evaluation, linting, definition evaluation, registry, changelog, and mapping to Python.
**Tests:** 80 passing (inner-function tests). No Python-side integration tests.

### High

#### H1. `json_to_python` silently drops `u64` values that exceed `i64::MAX`

**File:** `lib.rs:914-921`

`serde_json::Number` can represent `u64` values above `i64::MAX`. The conversion tries `n.as_i64()` first, then `n.as_f64()`. For large `u64` values, `as_f64()` silently loses precision.

**Fix:** Add a `n.as_u64()` branch after `as_i64()`.

#### H2. `evaluate_def` silently coerces non-object `data` to empty map

**File:** `lib.rs:312-316, 381-384`

If the Python caller passes a non-dict `data` argument, `depythonize` produces a non-object `Value`, `as_object()` returns `None`, and `unwrap_or_default()` produces an empty `HashMap`. The function evaluates with no data and returns as if no answers were provided — with no error.

**Fix:** Return `PyTypeError` if the deserialized value is not an object.

### Medium

#### M1. `type PyObject = Py<PyAny>` shadows the real type

**File:** `lib.rs:11`

Unnecessary alias in PyO3 0.28. `Py<PyAny>` is perfectly clear and is the canonical name.

#### M2. `python_to_fel` date parsing prepends `@` to potentially already-`@`-prefixed string

**File:** `lib.rs:761-764`

If `text` already contains a leading `@`, the format call produces `@@2024-01-01` which then fails to parse.

**Fix:** Defensive check: `if text.starts_with('@') { text.clone() } else { format!("@{text}") }`.

#### M3. `python_to_fel` money — missing `amount` silently becomes 0

**File:** `lib.rs:770-784`

When a dict has `"__fel_type__": "money"` but no `amount` key, `unwrap_or_else(|| "0".to_string())` silently provides a default. Could mask bugs in the Python caller.

#### M4. Untagged money auto-detection risks false positives

**File:** `lib.rs:790-809`

Any Python dict with both `currency` and `amount` keys is treated as money. A financial report record `{"currency": "USD", "amount": 100, "date": "2024-01-01", "category": "revenue"}` would be interpreted as `FelValue::Money`, losing all other keys.

#### M5. `lint_document` returns `pass` key as integer

**File:** `lib.rs:266`

The `d.pass` field is `u8` set directly as a Python integer. Docstring doesn't specify the type. Python callers may expect a string.

#### M6. `find_registry_entry` `version_constraint` is required string, not optional

**File:** `lib.rs:431-447`

Python callers must pass `""` to mean "no constraint". API would be cleaner with `Option<&str>` and `#[pyfunction(signature = (registry, name, version_constraint=None))]`.

#### M7. `eval_fel` vs `eval_fel_detailed` use different environment types

**File:** `lib.rs:42-58, 72-98`

`eval_fel` uses `MapEnvironment`, `eval_fel_detailed` uses `FormspecEnvironment`. The naming doesn't make this distinction obvious to Python callers.

### Low

#### L1. HashSet iteration order is nondeterministic

**File:** `lib.rs:126-134, 156-170`

`extract_deps` and `analyze_expression` collect `HashSet` contents without sorting. Python lists will have arbitrary ordering between runs.

#### L2. Missing `#[pyfunction(signature = ...)]` on several functions

**File:** `lib.rs` (various)

Explicit signatures improve generated Python stubs.

#### L3. Redundant `.into_any().unbind()` pattern

**File:** `lib.rs:825-860, 863-908, 910-938`

~15 call sites with the same conversion chain. A local helper would reduce noise.

#### L4. Missing `shapeId` key when `v.shape_id` is `None`

**File:** `lib.rs:340-343`

Dict has `shapeId` for some entries and not others. Python callers doing `entry["shapeId"]` will get `KeyError` for non-shape validations.

**Fix:** Always set the key: `entry.set_item("shapeId", v.shape_id.as_deref())?;`

#### L5. `registry_entry_count` bypasses `Registry::from_json`

**File:** `lib.rs:943-948, 421`

Uses manual JSON walking instead of the `Registry` struct's data. If `Registry` ever changes how it counts entries, this raw count would diverge.

#### L6. `get_dependencies` non-deterministic ordering

**File:** `lib.rs:112`

Same `HashSet` ordering issue as L1.

### Nit

#### N1. Stale TODO comment

**File:** `lib.rs:1868-1870`

TODO says "Extract parse_mapping_document_inner for native testability" but this was already done.

#### N2. Inconsistent camelCase vs snake_case in Python-facing keys

`constraintKind` and `shapeId` are camelCase (mirroring the spec), while `non_relevant`, `document_type`, `rule_index`, etc. are snake_case. Inconsistency may confuse Python consumers.

#### N3. Module-level doc comment is duplicated

**File:** `lib.rs:1-7`

Both `//!` and `///` say the same thing. The `///` attaches to the first `use` statement, which is meaningless.

#### N4. `rust_decimal::prelude::*` wildcard import

**File:** `lib.rs:15`

Wildcard imports make it harder to understand what's in scope. Could import only what's needed.

#### N5. `cast` vs `downcast` naming awareness

**File:** `lib.rs:690, 734, 741`

Uses `obj.cast::<PyDict>()` which is correct in PyO3 0.28 (renamed from `downcast`). Just noting for awareness.
