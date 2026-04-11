# Group 2 Review — Rust Core DRY / Centralization

## Summary

11 commits that extract shared abstractions across the Rust crate stack — moving
host-agnostic JSON shaping, wire-key tables, item-tree traversal, and component
walks out of the WASM/Python bindings and into the shared library crates
(`fel-core`, `formspec-core`, `formspec-eval`, `formspec-lint`).

The refactors are sound in direction and largely well-executed. The crate
dependency graph is clean (no new edges; WASM and Py remain leaf consumers).
All 830+ Rust lib and integration tests pass cleanly after the full series.

Three findings require attention before merge. One is a genuine behavioral
divergence (medium), one is a structural oddity that will confuse future
contributors (medium), and one is a cosmetic nit left by the clippy-fix pass
(low). No critical issues.

---

## Findings

### Medium: `formspec-lint` retains a private `build_registry` that duplicates registry-doc parsing logic already in `formspec-eval::registry_constraints`

**File(s):**
- `crates/formspec-lint/src/extensions.rs:58-113` — `fn build_registry`
- `crates/formspec-eval/src/registry_constraints.rs:8-86` — `fn extension_constraints_from_registry_documents`

**Details:**
Both functions accept `&[Value]` (an array of raw registry JSON documents),
iterate the `entries` array, and parse `name` / `status` / `metadata.displayName`
/ `deprecationNotice`. They produce different output types (`MapRegistry` vs
`Vec<ExtensionConstraint>`) because lint needs lifecycle checks and eval needs
constraint payloads (pattern, min/max, baseType). The core parsing logic —
"iterate `doc.entries[]`, extract `name`/`status`/`deprecationNotice`" — is
duplicated across them.

The larger refactor added `map_registry_from_extension_entry_map` to
`formspec-core::extension_analysis`, but that function takes a *different* input
shape (`HashMap<String, Value>`, a pre-flattened map). There is currently no
shared helper that takes `&[Value]` registry documents and builds a `MapRegistry`.

This means the two divergent status-string parsers can drift. `build_registry`
maps `"stable" | "active"` → `Active`; `extension_constraints_from_registry_documents`
does not parse status into an enum at all (stores raw string). If a future commit
adds a new status string, one will need updating and the other won't.

**Recommendation:**
Add `map_registry_from_registry_documents(docs: &[Value]) -> MapRegistry` to
`formspec-core::extension_analysis`, delegating the per-entry parse to a shared
helper that already uses `registry_client::parse_registry_entry_status`. Have
`formspec-lint::extensions::build_registry` call it. This closes the divergence
without changing behavior. It is a net removal of ~50 lines of duplicated
parsing.

---

### Medium: `extension_analysis::JsonDefinitionItem::declared_extensions` checks both the `extensions` sub-object AND top-level `x-*` properties, but `formspec-lint::extensions::check_extensions` only checks the `extensions` sub-object

**File(s):**
- `crates/formspec-core/src/extension_analysis.rs:278-302` — `declared_extensions` implementation
- `crates/formspec-lint/src/extensions.rs:140-195` — `check_extensions_object`
- `schemas/definition.schema.json` — Item schema (only `extensions` sub-object is defined; no top-level `x-*` pattern properties)

**Details:**
`JsonDefinitionItem::declared_extensions` (used by the WASM `validateExtensionUsage`
binding) scans two places: (1) the `extensions: { "x-foo": true }` sub-object
and (2) top-level `"x-*"` properties on the item object directly (the `extra`
field). The lint pass only checks the `extensions` sub-object. The schema only
defines the `extensions` sub-object; there are no patternProperties or
additionalProperties for top-level `x-*` keys.

This is a pre-existing divergence (predates this commit group) but it was neither
addressed nor documented in the centralisation refactor. A user who places
`"x-formspec-url": true` as a top-level item property will get:
- A WASM `validateExtensionUsage` hit (treats it as declared)
- No lint diagnostic (not scanned)
- Schema validation error (unknown additional property)

The WASM path's handling of top-level `x-*` keys is almost certainly vestigial
code from an earlier design where extensions were top-level fields. The schema
is the ground truth here.

**Recommendation:**
Remove the `extra` scan from `JsonDefinitionItem::declared_extensions`. Only the
`extensions` sub-object should be checked. Add a test to `extension_analysis` to
confirm this. This aligns the WASM binding with the schema, with lint, and with
what the spec says.

---

### Low: `wire_keys::ChangelogRootKeys` uses `#[allow(missing_docs)]` to silence the crate-level `#![warn(missing_docs)]` rather than adding docs

**File(s):**
- `crates/formspec-core/src/wire_keys.rs:74-79`

**Details:**
The module comment (`//! Centralized JSON field names for host bindings`) and the
function-level doc (`/// Field names for the changelog root object in the given
wire style.`) are present, but the struct fields (`definition_url`, `from_version`,
`to_version`, `semver_impact`) have `#[allow(missing_docs)]` instead of
per-field comments. The crate has `#![warn(missing_docs)]` as policy. The
`#[allow]` works but defeats the policy on a public-facing struct.

The fields are self-explanatory, but using `#[allow]` here sets a precedent. All
the other wire-key functions in this module carry proper docs.

**Recommendation:**
Replace the `#[allow(missing_docs)]` with a single-line doc comment per field,
or add a `/// Field names matching the top-level changelog JSON structure.` struct
doc that implicitly covers the fields (using `#[non_exhaustive]` or similar to
signal the struct is for structured destructuring). One line each: `/// JSON key
for the definition URL.` is sufficient.

---

### Low: Residual clippy warning in `fel-core::prepare_host` (collapsible_if) acknowledged but not fixed

**File(s):**
- `crates/fel-core/src/prepare_host.rs:323`

**Details:**
Commit `8186c38` fixed the `collapsible_if` warning in
`formspec-core::runtime_mapping::engine` but noted the clippy run shows warnings
"aside from fel-core deps." The `prepare_host.rs:322-330` nested `if let` can be
collapsed to a single `if let … && n <= …` expression. Similarly,
`prepare_host.rs:122` uses `sort_by(|a, b| b.len().cmp(&a.len()))` where
`sort_by_key(|b| Reverse(b.len()))` is preferred.

These are in `fel-core`, not `formspec-core`, so they are technically out of
scope for this pass. But since `8186c38` was partially motivated by cleaning up
clippy output, the incomplete job is worth flagging.

**Recommendation:**
Apply the two mechanical clippy suggestions in `fel-core::prepare_host` in a
follow-up commit: collapse the nested `if let` and switch to `sort_by_key`.
These are purely cosmetic — no behavior change.

---

## What Works Well

**Wire-key centralization (commits `2d0ff12`, `9366cc4`):** The two-step extraction
of `JsonWireStyle` into `fel-core::wire_style` and the key-name tables into
`formspec-core::wire_keys` is a textbook application of the right pattern. Every
camelCase/snake_case divergence now lives in one `match` per concept. The API is
clean: functions return tuples or named structs, callers destructure. No
params-object inflation.

**WASM/Py binding thinning (commit `637ae54`):** The headline commit. `formspec-wasm`
dropped `convert.rs` entirely (161 lines). `formspec-py/mapping.rs` went from 465
lines to 14. `formspec-wasm/evaluate.rs` from 290 to 88. The binding layer is
now genuinely thin: deserialize → call shared API → serialize. The dispatch
pattern (`eval_host_context_from_json_map` returning an `EvalHostContextBundle`)
is a good DRY move that collapses four separate `parse_*` calls into one.

**`json_host.rs` helpers (commit `81cd601`):** Three tiny helpers
(`parse_value_str`, `parse_json_as`, `to_json_string`) with consistent error
prefixes. Dead simple, zero overhead, eliminates repeated `serde_json::from_str`
error-message formatting across every WASM endpoint.

**`definition_items` visitor (commits `063d611` through `ab7e6ba`):**
The `DefinitionItemKeyPolicy` enum is the right abstraction. Lint and eval
legitimately need different behavior on keyless nodes, and the policy enum makes
that explicit rather than forking the traversal. The `DefinitionItemVisitCtx`
struct carrying `json_path`, `dotted_path`, and `parent_dotted` together
eliminates the triple re-computation that was duplicated in every pass. The
commit sequence (shared DFS → policy parameterization → shallow variant for eval)
is correct layering order.

**`component_tree::visit_component_subtree` (commit `0675dfb`):**
The `child_path` callback design correctly handles the divergence between JSON
Pointer paths (schema validator uses `/children/0`) and JSONPath-style paths
(lint uses `.children[0]`). A single shared walker with a configurable path
formatter is the minimal solution.

**Semver consolidation (commit `0675dfb`):**
`formspec-eval::revalidate::items` had a duplicate `parse_semver` +
`version_satisfies` pair. Removing it in favor of
`registry_client::version_satisfies` is a clean win with no API surface change.

**Clippy fix (commit `8186c38`):**
Mechanical. The collapsed `if let … && …` form is more idiomatic Rust and the
intent is clearer. No behavioral change.

**Crate dependency graph:** No new edges introduced. The graph remains:

```
fel-core (no deps)
  ↓
formspec-core (← fel-core)
  ↓
formspec-eval, formspec-lint (← formspec-core, fel-core)
  ↓
formspec-wasm, formspec-py (← all above)
```

The WASM package gained `serde` as a direct dependency (previously implicit via
`serde_json`) for `DeserializeOwned` / `Serialize` bounds on `json_host` helpers.
This is correct and necessary.

---

## Verdict

**Ship with fixes.**

The two medium findings are real issues — one is residual duplication that the
refactor was the right moment to close, and one is a semantic divergence in the
WASM `validateExtensionUsage` API that will produce incorrect behavior for
top-level `x-*` item properties (even if that pattern is schema-invalid). Neither
blocks shipping but both should be addressed in a follow-up commit before users
encounter the WASM API inconsistency. The linting finding is purely cosmetic.

The core body of work — thinning the binding layers, centralizing wire-key
tables, extracting shared traversal primitives — is justified, well-scoped, and
improves maintainability substantially. The 830+ tests pass cleanly.
