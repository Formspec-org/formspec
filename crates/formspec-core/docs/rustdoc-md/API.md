# formspec-core — generated API (Markdown)

Generated: 2026-03-22T12:40:24.046Z (do not edit by hand; regenerate via npm script / cargo doc-md + this bundler)

Bundled from [cargo-doc-md](https://github.com/Crazytieguy/cargo-doc-md). Nested module paths are preserved in headings. Relative links may not resolve; search by heading.

---

## doc-md index

# Documentation Index

Generated markdown documentation for this project.

## Dependencies (1)

- [`formspec-core`](formspec_core/index.md)

---

Generated with [cargo-doc-md](https://github.com/Crazytieguy/cargo-doc-md)

---

## Source: formspec_core/index.md

# formspec_core

Formspec core processing — FEL, paths, schemas, assembly, mappings, extensions.

Depends on the `fel_core` crate and holds the non-reactive processing layer used by WASM,
Python, and batch evaluators. Human overview: crate `README.md`. Markdown API export:
`docs/rustdoc-md/API.md` (regenerate with `npm run docs:formspec-core`).

## Modules

### [`formspec_core`](formspec_core.md)

*14 modules*

### [`assembler`](assembler.md)

*1 enum, 1 trait, 2 functions, 3 structs*

### [`changelog`](changelog.md)

*1 function, 2 structs, 4 enums*

### [`component_tree`](component_tree.md)

*1 function*

### [`definition_items`](definition_items.md)

*1 enum, 1 struct, 8 functions*

### [`extension_analysis`](extension_analysis.md)

*2 traits, 3 enums, 3 functions, 4 structs*

### [`fel_analysis`](fel_analysis.md)

*5 structs, 7 functions*

### [`fel_rewrite_exact`](fel_rewrite_exact.md)

*2 functions*

### [`json_artifacts`](json_artifacts.md)

*2 functions*

### [`json_util`](json_util.md)

*1 function*

### [`path_utils`](path_utils.md)

*1 struct, 1 trait, 10 functions*

### [`registry_client`](registry_client.md)

*5 functions*

### [`registry_client::types`](registry_client/types.md)

*2 enums, 4 structs*

### [`registry_client::version`](registry_client/version.md)

*1 function*

### [`registry_client::wire_json`](registry_client/wire_json.md)

*4 functions*

### [`runtime_mapping::document`](runtime_mapping/document.md)

*1 function*

### [`runtime_mapping::engine`](runtime_mapping/engine.md)

*1 function*

### [`runtime_mapping::parse`](runtime_mapping/parse.md)

*4 functions*

### [`runtime_mapping::types`](runtime_mapping/types.md)

*6 enums, 6 structs*

### [`runtime_mapping::wire_json`](runtime_mapping/wire_json.md)

*3 functions*

### [`schema_validator`](schema_validator.md)

*1 enum, 1 trait, 4 functions, 4 structs*

### [`wire_keys`](wire_keys.md)

*1 struct, 9 functions*

---

## Source: formspec_core/formspec_core.md

**formspec_core**

# Module: formspec_core

## Contents

**Modules**

- [`assembler`](#assembler) - Resolves $ref inclusions and assembles self-contained definitions with FEL rewriting.
- [`changelog`](#changelog) - Changelog — diffs two definition versions into a structured changelog.
- [`component_tree`](#component_tree) - Pre-order traversal for component/theme JSON nodes (`component` + `children`).
- [`definition_items`](#definition_items) - Depth-first traversal of definition `items` / `children` JSON arrays.
- [`extension_analysis`](#extension_analysis) - Validates extension usage in item trees against a registry catalog.
- [`fel_analysis`](#fel_analysis) - FEL static analysis and expression rewriting for field references and variables.
- [`fel_rewrite_exact`](#fel_rewrite_exact) - Exact-text FEL rewriting that preserves non-reference source text.
- [`json_artifacts`](#json_artifacts) - `serde_json::Value` projections for WASM and Python FFI (use with `json_to_python` on the Py side).
- [`json_util`](#json_util) - Small JSON helpers shared across bindings.
- [`path_utils`](#path_utils) - Dotted path normalization and tree item navigation by path.
- [`registry_client`](#registry_client) - Registry client — parses registry documents, resolves extensions, validates lifecycle.
- [`runtime_mapping`](#runtime_mapping) - Bidirectional mapping engine for transforming data between formats.
- [`schema_validator`](#schema_validator) - Schema validation with document type detection and validation dispatch.
- [`wire_keys`](#wire_keys) - Centralized JSON field names for host bindings (`JsonWireStyle`).

---

## Module: assembler

Resolves $ref inclusions and assembles self-contained definitions with FEL rewriting.

## Internal helpers

Private functions walk `items`, merge referenced fragments (`resolve_*`, `perform_assembly`),
hoist binds/shapes/variables (`import_*`), and rewrite FEL paths (`rewrite_*`, `split_path_segments`).

## Module: changelog

Changelog — diffs two definition versions into a structured changelog.

Compares two Formspec definition JSON documents section-by-section and
produces an ordered list of `Change` records with impact classification.

Private `diff_*` / `merge_*` / `classify_*` helpers implement the section-by-section comparison.

## Module: component_tree

Pre-order traversal for component/theme JSON nodes (`component` + `children`).

## Module: definition_items

Depth-first traversal of definition `items` / `children` JSON arrays.

Call sites choose [`DefinitionItemKeyPolicy`]:

- **Lint / static analysis** use [`DefinitionItemKeyPolicy::RequireStringKey`]: only visit nodes
  whose `key` is a JSON string (including `""`). Skip other elements and **do not** recurse into
  their `children`.
- **Runtime eval item-tree rebuild** uses [`visit_definition_items_json_shallow`] with
  [`DefinitionItemKeyPolicy::CoerceNonStringKeyToEmpty`] at each `items` / `children` array, then
  recurses into `children` with the same policy (see `formspec-eval` `rebuild_item_tree`).
  [`coerce_definition_item_key_segment`] implements the coerce key segment for that policy.
- **Extension diagnostic prefixes** (lint pass 3b): map [`DefinitionItemVisitCtx::dotted_path`] via
  [`extension_item_diagnostic_path_from_dotted`] to stable `$.items[key=…]`-style paths.

## Spec cross-references (`specs/*.llm.md`)

Normative shape and behavior for items and paths:

- `specs/core/spec.llm.md` — **§3 Item** (structural tree nodes identified by `key`), **§4 Bind**
  (dot-separated paths onto those keys), **Processing model · Phase 1: Rebuild** (re-index items
  / dependency structure after definition change).
- `specs/core/definition-spec.llm.md` — *Semantic capsule*: stable `key` identifiers as the
  binding surface across rendering, validation, and mapping.
- `specs/component/component-spec.llm.md` — slot `bind` resolves by item `key` (not arbitrary
  FEL paths).

Conformant definitions: Item `key` is required with pattern `^[a-zA-Z][a-zA-Z0-9_]*$` in
`schemas/definition.schema.json`. The two policies here are **tooling/runtime** choices for
walking JSON before or aside from full schema validation: skip ill-formed nodes vs coerce and
keep descending.

## Module: extension_analysis

Validates extension usage in item trees against a registry catalog.

Checks for unresolved, retired, and deprecated extensions on definition items.

`walk_items` recurses the [`ExtensionItem`] tree; [`JsonDefinitionItem`] is the JSON-backed adapter.

## Module: fel_analysis

FEL static analysis and expression rewriting for field references and variables.

Parses FEL to extract field references, variables, and function calls, and supports
AST rewriting via callbacks (for `$ref` fragment imports and similar).

Private walkers (`collect_info`, `rewrite_expr`, `collect_rewrite_targets`, `parse_field_ref_from_path`)
implement AST traversal; the public API wraps them.

## Module: fel_rewrite_exact

Exact-text FEL rewriting that preserves non-reference source text.

`ExactRewriteParser` mirrors FEL precedence and records non-overlapping text replacements;
see `apply_replacements` for how spans are stitched back into the source.

## Module: json_artifacts

`serde_json::Value` projections for WASM and Python FFI (use with `json_to_python` on the Py side).

Private `*_str` helpers stringify changelog enums; `change_to_object` builds each change row.

## Module: json_util

Small JSON helpers shared across bindings.

## Module: path_utils

Dotted path normalization and tree item navigation by path.

Paths use dot notation: `group.field`, `parent.child.leaf`.
Indices `[N]` and wildcards `[*]` are stripped during normalization.

## Module: registry_client

Registry client — parses registry documents, resolves extensions, validates lifecycle.

## Module: runtime_mapping

Bidirectional mapping engine for transforming data between formats.

Executes mapping rules to transform data between Formspec response format and external formats
(forward: Formspec → external, reverse: external → Formspec). Implementation is split across
`types`, `path`, `env`, `transforms`, `engine`, and `document`.

## Module: schema_validator

Schema validation with document type detection and validation dispatch.

Uses dependency inversion: JSON Schema validation is provided by the host via
[`JsonSchemaValidator`]. This module detects document types, translates paths, and
plans per-component validation for component trees.

## Module: wire_keys

Centralized JSON field names for host bindings (`JsonWireStyle`).

---

## Source: formspec_core/assembler.md

**formspec_core > assembler**

# Module: assembler

## Contents

**Structs**

- [`AssemblyProvenance`](#assemblyprovenance) - Source record for one merged definition fragment (URL, version, optional key prefix).
- [`AssemblyResult`](#assemblyresult) - Output of [`assemble_definition`]: merged definition plus warnings, errors, provenance.
- [`MapResolver`](#mapresolver) - In-memory [`RefResolver`] backed by a URI → JSON map.

**Enums**

- [`AssemblyError`](#assemblyerror) - Failure while resolving `$ref` or merging assembled fragments.

**Functions**

- [`assemble_definition`](#assemble_definition) - Walk `definition["items"]`, expand `$ref` objects using `resolver`, and merge fragments.
- [`assembly_result_to_json_value`](#assembly_result_to_json_value) - Assembly output for host bindings (camelCase vs snake_case provenance keys).

**Traits**

- [`RefResolver`](#refresolver) - Resolves a `$ref` URI string to a JSON fragment.

---

## formspec_core::assembler::AssemblyError

*Enum*

Failure while resolving `$ref` or merging assembled fragments.

**Variants:**

- `CircularRef(String)` - A `$ref` cycle was detected.
- `KeyCollision{ key: String, source: String }` - Two sources contributed the same item `key`.
- `RefNotFound(String)` - `$ref` target was not found in the resolver.
- `ResolutionError(String)` - Resolver or merge failed with a message.

**Traits:** Error

**Trait Implementations:**

- **Display**
  - `fn fmt(self: &Self, f: & mut std::fmt::Formatter) -> std::fmt::Result`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> AssemblyError`

## formspec_core::assembler::AssemblyProvenance

*Struct*

Source record for one merged definition fragment (URL, version, optional key prefix).

**Fields:**

- `url: String` - Source document URL or identifier.
- `version: String` - Version string from the source document.
- `key_prefix: Option<String>` - Optional key prefix applied when merging items from this fragment.
- `fragment: Option<String>` - Optional JSON Pointer–style fragment path within the resolved document.

**Traits:** Eq

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **PartialEq**
  - `fn eq(self: &Self, other: &AssemblyProvenance) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> AssemblyProvenance`

## formspec_core::assembler::AssemblyResult

*Struct*

Output of [`assemble_definition`]: merged definition plus warnings, errors, provenance.

**Fields:**

- `definition: serde_json::Value` - Assembled definition JSON (typically includes merged `items`).
- `warnings: Vec<String>` - Non-fatal issues (e.g. skipped optional refs).
- `errors: Vec<AssemblyError>` - Fatal assembly problems.
- `assembled_from: Vec<AssemblyProvenance>` - Ordered list of fragments that contributed to the result.

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> AssemblyResult`

## formspec_core::assembler::MapResolver

*Struct*

In-memory [`RefResolver`] backed by a URI → JSON map.

**Methods:**

- `fn new() -> Self` - Empty resolver.
- `fn add(self: & mut Self, uri: &str, fragment: Value)` - Insert or replace a resolved fragment for `uri`.
- `fn merge_from_json_object(self: & mut Self, fragments: &Value)` - Load URI → fragment entries from a JSON object (non-objects yield no inserts).

**Trait Implementations:**

- **RefResolver**
  - `fn resolve(self: &Self, ref_uri: &str) -> Option<Value>`
- **Default**
  - `fn default() -> Self`

## formspec_core::assembler::RefResolver

*Trait*

Resolves a `$ref` URI string to a JSON fragment.

**Methods:**

- `resolve`: Return the resolved JSON value, or `None` if unknown.

## formspec_core::assembler::assemble_definition

*Function*

Walk `definition["items"]`, expand `$ref` objects using `resolver`, and merge fragments.

Item keys are rewritten when fragments supply `keyPrefix`. FEL in binds and message
templates is rewritten to match merged keys (see `rewrite_fel_source_references`).

```rust
fn assemble_definition(definition: &serde_json::Value, resolver: &dyn RefResolver) -> AssemblyResult
```

## formspec_core::assembler::assembly_result_to_json_value

*Function*

Assembly output for host bindings (camelCase vs snake_case provenance keys).

```rust
fn assembly_result_to_json_value(result: &AssemblyResult, style: crate::JsonWireStyle) -> serde_json::Value
```

---

## Source: formspec_core/changelog.md

**formspec_core > changelog**

# Module: changelog

## Contents

**Structs**

- [`Change`](#change) - A single atomic change between two definition versions.
- [`Changelog`](#changelog) - Structured diff between two definition versions.

**Enums**

- [`ChangeImpact`](#changeimpact) - Severity classification of a single change.
- [`ChangeTarget`](#changetarget) - Definition subsystem affected by a change.
- [`ChangeType`](#changetype) - Kind of change between two definition versions.
- [`SemverImpact`](#semverimpact) - Semantic version bump implied by the aggregate impact.

**Functions**

- [`generate_changelog`](#generate_changelog) - Diff two Formspec definition JSON documents and produce a changelog.

---

## formspec_core::changelog::Change

*Struct*

A single atomic change between two definition versions.

**Fields:**

- `change_type: ChangeType`
- `target: ChangeTarget`
- `path: String`
- `impact: ChangeImpact`
- `key: Option<String>`
- `description: Option<String>`
- `before: Option<serde_json::Value>`
- `after: Option<serde_json::Value>`
- `migration_hint: Option<String>`

## formspec_core::changelog::ChangeImpact

*Enum*

Severity classification of a single change.

**Variants:**

- `Cosmetic`
- `Compatible`
- `Breaking`

**Traits:** Eq, Copy

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **PartialOrd**
  - `fn partial_cmp(self: &Self, other: &ChangeImpact) -> $crate::option::Option<$crate::cmp::Ordering>`
- **PartialEq**
  - `fn eq(self: &Self, other: &ChangeImpact) -> bool`
- **Ord**
  - `fn cmp(self: &Self, other: &ChangeImpact) -> $crate::cmp::Ordering`
- **Clone**
  - `fn clone(self: &Self) -> ChangeImpact`

## formspec_core::changelog::ChangeTarget

*Enum*

Definition subsystem affected by a change.

**Variants:**

- `Item`
- `Bind`
- `Shape`
- `OptionSet`
- `DataSource`
- `Screener`
- `Migration`
- `Metadata`

**Traits:** Eq

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> ChangeTarget`
- **PartialEq**
  - `fn eq(self: &Self, other: &ChangeTarget) -> bool`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::changelog::ChangeType

*Enum*

Kind of change between two definition versions.

**Variants:**

- `Added`
- `Removed`
- `Modified`

**Traits:** Eq

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> ChangeType`
- **PartialEq**
  - `fn eq(self: &Self, other: &ChangeType) -> bool`

## formspec_core::changelog::Changelog

*Struct*

Structured diff between two definition versions.

**Fields:**

- `definition_url: String`
- `from_version: String`
- `to_version: String`
- `semver_impact: SemverImpact`
- `changes: Vec<Change>`

## formspec_core::changelog::SemverImpact

*Enum*

Semantic version bump implied by the aggregate impact.

**Variants:**

- `Patch`
- `Minor`
- `Major`

**Traits:** Eq, Copy

**Trait Implementations:**

- **PartialEq**
  - `fn eq(self: &Self, other: &SemverImpact) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> SemverImpact`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::changelog::generate_changelog

*Function*

Diff two Formspec definition JSON documents and produce a changelog.

Walks items, binds, shapes, optionSets, dataSources, screener, migrations,
and metadata sections. Each difference produces a `Change` with an impact
classification. The aggregate `semver_impact` is the maximum across all changes.

```rust
fn generate_changelog(old_def: &serde_json::Value, new_def: &serde_json::Value, definition_url: &str) -> Changelog
```

---

## Source: formspec_core/component_tree.md

**formspec_core > component_tree**

# Module: component_tree

## Contents

**Functions**

- [`visit_component_subtree`](#visit_component_subtree) - Visit each object node that has a string `component` field, then recurse into `children`.

---

## formspec_core::component_tree::visit_component_subtree

*Function*

Visit each object node that has a string `component` field, then recurse into `children`.

`child_path(parent, index)` selects JSON Pointer (`/tree/children/0`) vs JSONPath-style
(`$.tree.children[0]`) paths for diagnostics.

```rust
fn visit_component_subtree<F, impl FnMut(&Value, &str)>(node: &serde_json::Value, path: &str, child_path: &F, visit: & mut impl Trait)
```

---

## Source: formspec_core/definition_items.md

**formspec_core > definition_items**

# Module: definition_items

## Contents

**Structs**

- [`DefinitionItemVisitCtx`](#definitionitemvisitctx) - One definition item with canonical paths for diagnostics and binds.

**Enums**

- [`DefinitionItemKeyPolicy`](#definitionitemkeypolicy) - How to interpret `item["key"]` when walking definition `items` / `children`.

**Functions**

- [`coerce_definition_item_key_segment`](#coerce_definition_item_key_segment) - Key segment for runtime item-tree rebuild: missing or non-string `key` → `""`.
- [`definition_item_dotted_path`](#definition_item_dotted_path) - Dotted bind path from an optional parent prefix and this node's key segment (may be `""`).
- [`definition_item_key_segment`](#definition_item_key_segment) - Resolve the key segment for `item` under `policy`.
- [`extension_item_diagnostic_path_from_dotted`](#extension_item_diagnostic_path_from_dotted) - Map a bind-style dotted item path to the extensions-pass diagnostic prefix.
- [`visit_definition_items_from_document`](#visit_definition_items_from_document) - Walk `document["items"]` when present; no-op if missing or not an array.
- [`visit_definition_items_json`](#visit_definition_items_json) - Visit every object with a string `key` under `items`, depth-first ([`DefinitionItemKeyPolicy::RequireStringKey`]).
- [`visit_definition_items_json_shallow`](#visit_definition_items_json_shallow) - Visit each element of a definition `items` or `children` array **once** (no recursion).
- [`visit_definition_items_json_with_policy`](#visit_definition_items_json_with_policy) - Visit definition items under a JSON array with an explicit key policy.

---

## formspec_core::definition_items::DefinitionItemKeyPolicy

*Enum*

How to interpret `item["key"]` when walking definition `items` / `children`.

**Variants:**

- `RequireStringKey` - Only visit objects whose `key` is a JSON string (including `""`).
- `CoerceNonStringKeyToEmpty` - Missing or non-string `key` is treated as `""`.

**Traits:** Copy, Eq

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> DefinitionItemKeyPolicy`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **PartialEq**
  - `fn eq(self: &Self, other: &DefinitionItemKeyPolicy) -> bool`

## formspec_core::definition_items::DefinitionItemVisitCtx

*Struct*

One definition item with canonical paths for diagnostics and binds.

**Generic Parameters:**

- 'a

**Fields:**

- `item: &'a serde_json::Value` - Raw JSON object for this definition item.
- `key: &'a str` - Resolved key segment (may be `""` when policy coerces).
- `index: usize` - Index of this node within its parent's `items` or `children` array.
- `json_path: String` - JSONPath-style location, e.g. `$.items[0]` or `$.items[0].children[1]`.
- `dotted_path: String` - Dotted field path (`name`, `address.street`).
- `parent_dotted: Option<String>` - Parent dotted path; `None` for top-level items under `document.items`.

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> DefinitionItemVisitCtx<'a>`

## formspec_core::definition_items::coerce_definition_item_key_segment

*Function*

Key segment for runtime item-tree rebuild: missing or non-string `key` → `""`.

```rust
fn coerce_definition_item_key_segment(item: &serde_json::Value) -> &str
```

## formspec_core::definition_items::definition_item_dotted_path

*Function*

Dotted bind path from an optional parent prefix and this node's key segment (may be `""`).

```rust
fn definition_item_dotted_path(parent_dotted: Option<&str>, key_segment: &str) -> String
```

## formspec_core::definition_items::definition_item_key_segment

*Function*

Resolve the key segment for `item` under `policy`.

Returns `None` only for [`DefinitionItemKeyPolicy::RequireStringKey`] when `key` is not a JSON
string.

```rust
fn definition_item_key_segment(item: &serde_json::Value, policy: DefinitionItemKeyPolicy) -> Option<&str>
```

## formspec_core::definition_items::extension_item_diagnostic_path_from_dotted

*Function*

Map a bind-style dotted item path to the extensions-pass diagnostic prefix.

The lint extensions pass reports locations like `$.items[key=rootKey].nestedKey` (key-stable,
not `$.items[0]`). That string is derived from the same dotted paths as
[`visit_definition_items_json`] / [`DefinitionItemVisitCtx::dotted_path`]: the first segment is
wrapped as `$.items[key=…]`; further segments are appended with dots.

```rust
fn extension_item_diagnostic_path_from_dotted(dotted: &str) -> String
```

## formspec_core::definition_items::visit_definition_items_from_document

*Function*

Walk `document["items"]` when present; no-op if missing or not an array.

```rust
fn visit_definition_items_from_document<impl FnMut(&DefinitionItemVisitCtx<'_>)>(document: &serde_json::Value, visitor: & mut impl Trait)
```

## formspec_core::definition_items::visit_definition_items_json

*Function*

Visit every object with a string `key` under `items`, depth-first ([`DefinitionItemKeyPolicy::RequireStringKey`]).

```rust
fn visit_definition_items_json<impl FnMut(&DefinitionItemVisitCtx<'_>)>(items: &[serde_json::Value], json_array_parent: &str, parent_dotted: Option<&str>, visitor: & mut impl Trait)
```

## formspec_core::definition_items::visit_definition_items_json_shallow

*Function*

Visit each element of a definition `items` or `children` array **once** (no recursion).

For each index `i`, builds the same [`DefinitionItemVisitCtx`] as the depth-first visitor:
`json_path` is `{json_array_parent}[{i}]`, `dotted_path` from [`definition_item_dotted_path`].

Used by `formspec-eval` to rebuild the eval `ItemInfo` tree: recurse by walking
`ctx.item["children"]` and calling this again with `json_array_parent =
format!("{}.children", ctx.json_path)`.

```rust
fn visit_definition_items_json_shallow<impl FnMut(&DefinitionItemVisitCtx<'_>)>(items: &[serde_json::Value], json_array_parent: &str, parent_dotted: Option<&str>, policy: DefinitionItemKeyPolicy, visitor: & mut impl Trait)
```

## formspec_core::definition_items::visit_definition_items_json_with_policy

*Function*

Visit definition items under a JSON array with an explicit key policy.

`json_array_parent` is the path to the **array** (no `[i]` suffix), e.g. `$.items` or
`$.items[0].children`.

```rust
fn visit_definition_items_json_with_policy<impl FnMut(&DefinitionItemVisitCtx<'_>)>(items: &[serde_json::Value], json_array_parent: &str, parent_dotted: Option<&str>, policy: DefinitionItemKeyPolicy, visitor: & mut impl Trait)
```

---

## Source: formspec_core/extension_analysis.md

**formspec_core > extension_analysis**

# Module: extension_analysis

## Contents

**Structs**

- [`ExtensionUsageIssue`](#extensionusageissue) - A single extension usage validation issue.
- [`JsonDefinitionItem`](#jsondefinitionitem) - Definition item node parsed from JSON (`key`, `children`, `extensions`, top-level `x-*` flags).
- [`MapRegistry`](#mapregistry) - Simple HashMap-based registry for testing.
- [`RegistryEntryInfo`](#registryentryinfo) - Minimal registry entry info needed for extension validation.

**Enums**

- [`ExtensionErrorCode`](#extensionerrorcode) - Error codes for extension validation.
- [`ExtensionSeverity`](#extensionseverity) - Severity levels for extension validation issues.
- [`RegistryEntryStatus`](#registryentrystatus) - Lifecycle status of a registry entry.

**Functions**

- [`json_definition_items_tree_from_value`](#json_definition_items_tree_from_value) - Parse a JSON value as a root `items` array for extension validation.
- [`map_registry_from_extension_entry_map`](#map_registry_from_extension_entry_map) - Build a [`MapRegistry`] from a JSON object mapping extension name → partial entry objects
- [`validate_extension_usage`](#validate_extension_usage) - Validate extension usage in an item tree against a registry.

**Traits**

- [`ExtensionItem`](#extensionitem) - Minimal item interface for extension validation.
- [`RegistryLookup`](#registrylookup) - Callback trait for looking up registry entries.

---

## formspec_core::extension_analysis::ExtensionErrorCode

*Enum*

Error codes for extension validation.

**Variants:**

- `UnresolvedExtension`
- `ExtensionRetired`
- `ExtensionDeprecated`

**Methods:**

- `fn as_wire_str(self: Self) -> &'static str` - Uppercase wire token for JSON (`UNRESOLVED_EXTENSION`, etc.).

**Traits:** Eq, Copy

**Trait Implementations:**

- **PartialEq**
  - `fn eq(self: &Self, other: &ExtensionErrorCode) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> ExtensionErrorCode`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::extension_analysis::ExtensionItem

*Trait*

Minimal item interface for extension validation.

**Methods:**

- `key`: The item's key.
- `declared_extensions`: Extensions declared on this item (extension name → enabled).
- `children`: Child items.

## formspec_core::extension_analysis::ExtensionSeverity

*Enum*

Severity levels for extension validation issues.

**Variants:**

- `Error`
- `Warning`
- `Info`

**Methods:**

- `fn as_wire_str(self: Self) -> &'static str` - Wire string for JSON output (`error` / `warning` / `info`).

**Traits:** Eq, Copy

**Trait Implementations:**

- **PartialEq**
  - `fn eq(self: &Self, other: &ExtensionSeverity) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> ExtensionSeverity`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::extension_analysis::ExtensionUsageIssue

*Struct*

A single extension usage validation issue.

**Fields:**

- `path: String` - Dotted path to the item declaring the extension.
- `extension: String` - The extension name (e.g., "x-formspec-url").
- `severity: ExtensionSeverity` - Severity level.
- `code: ExtensionErrorCode` - Error code for programmatic handling.
- `message: String` - Human-readable message.

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> ExtensionUsageIssue`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::extension_analysis::JsonDefinitionItem

*Struct*

Definition item node parsed from JSON (`key`, `children`, `extensions`, top-level `x-*` flags).

**Methods:**

- `fn from_json(value: &Value) -> Option<Self>` - Parse a single item object; returns `None` if `key` is missing or not a string.
- `fn tree_from_items_json(items: &[Value]) -> Vec<JsonDefinitionItem>` - Parse a root items array (definition `items` tree).

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **ExtensionItem**
  - `fn key(self: &Self) -> &str`
  - `fn declared_extensions(self: &Self) -> Vec<String>`
  - `fn children(self: &Self) -> &[Self]`

## formspec_core::extension_analysis::MapRegistry

*Struct*

Simple HashMap-based registry for testing.

**Methods:**

- `fn new() -> Self` - Empty registry.
- `fn add(self: & mut Self, entry: RegistryEntryInfo)` - Insert or replace an entry keyed by [`RegistryEntryInfo::name`].

**Trait Implementations:**

- **Default**
  - `fn default() -> Self`
- **RegistryLookup**
  - `fn lookup(self: &Self, extension_name: &str) -> Option<RegistryEntryInfo>`

## formspec_core::extension_analysis::RegistryEntryInfo

*Struct*

Minimal registry entry info needed for extension validation.

**Fields:**

- `name: String` - Extension name (e.g. `x-formspec-url`).
- `status: RegistryEntryStatus` - Lifecycle state from the registry document.
- `display_name: Option<String>` - Optional human-readable title from the registry.
- `deprecation_notice: Option<String>` - Optional deprecation message when status is deprecated.

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> RegistryEntryInfo`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::extension_analysis::RegistryEntryStatus

*Enum*

Lifecycle status of a registry entry.

**Variants:**

- `Draft`
- `Active`
- `Deprecated`
- `Retired`

**Traits:** Eq, Copy

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **PartialEq**
  - `fn eq(self: &Self, other: &RegistryEntryStatus) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> RegistryEntryStatus`

## formspec_core::extension_analysis::RegistryLookup

*Trait*

Callback trait for looking up registry entries.

**Methods:**

- `lookup`: Return registry metadata for `extension_name`, or `None` if unknown.

## formspec_core::extension_analysis::json_definition_items_tree_from_value

*Function*

Parse a JSON value as a root `items` array for extension validation.

```rust
fn json_definition_items_tree_from_value(val: &serde_json::Value) -> Result<Vec<JsonDefinitionItem>, String>
```

## formspec_core::extension_analysis::map_registry_from_extension_entry_map

*Function*

Build a [`MapRegistry`] from a JSON object mapping extension name → partial entry objects
(`status`, `displayName`, `deprecationNotice`, …) as produced by WASM callers.

```rust
fn map_registry_from_extension_entry_map(entries: &std::collections::HashMap<String, serde_json::Value>) -> MapRegistry
```

## formspec_core::extension_analysis::validate_extension_usage

*Function*

Validate extension usage in an item tree against a registry.

```rust
fn validate_extension_usage<I>(items: &[I], registry: &dyn RegistryLookup) -> Vec<ExtensionUsageIssue>
```

---

## Source: formspec_core/fel_analysis.md

**formspec_core > fel_analysis**

# Module: fel_analysis

## Contents

**Structs**

- [`FelAnalysis`](#felanalysis) - Result of statically analyzing a FEL expression.
- [`FelAnalysisError`](#felanalysiserror) - Parse/analysis error (`message`, optional `span`).
- [`FelRewriteTargets`](#felrewritetargets) - Field/variable/navigation targets that can be rewritten in a FEL expression.
- [`NavigationTarget`](#navigationtarget) - A literal navigation target passed to `prev` / `next` / `parent`.
- [`RewriteOptions`](#rewriteoptions) - Options for rewriting references in a FEL expression.

**Functions**

- [`analyze_fel`](#analyze_fel) - Analyze a FEL expression string, extracting structural information.
- [`collect_fel_rewrite_targets`](#collect_fel_rewrite_targets) - Collect every rewriteable target referenced by a FEL expression.
- [`fel_analysis_to_json_value`](#fel_analysis_to_json_value) - Static analysis result as JSON (`valid`, `errors`, `warnings`, `references`, `variables`, `functions`).
- [`fel_rewrite_targets_to_json_value`](#fel_rewrite_targets_to_json_value) - [`FelRewriteTargets`] as sorted JSON (camelCase keys) for `collectFELRewriteTargets`.
- [`get_fel_dependencies`](#get_fel_dependencies) - Extract field dependencies from an expression (safe on parse failure).
- [`rewrite_fel_references`](#rewrite_fel_references) - Rewrite references in a FEL expression AST.
- [`rewrite_options_from_camel_case_json`](#rewrite_options_from_camel_case_json) - Build [`RewriteOptions`] from the camelCase JSON map used by `rewriteFELReferences` / `rewriteMessageTemplate`.

---

## formspec_core::fel_analysis::FelAnalysis

*Struct*

Result of statically analyzing a FEL expression.

**Fields:**

- `valid: bool` - Whether the expression parsed successfully.
- `errors: Vec<FelAnalysisError>` - Parse errors, if any.
- `warnings: Vec<FelAnalysisWarning>` - Non-fatal warnings (e.g. arity or type hints).
- `references: std::collections::HashSet<String>` - Field path references (e.g., `$name`, `$address.city`).
- `variables: std::collections::HashSet<String>` - Variable references via `@name` (excluding reserved: current, index, count, instance).
- `functions: std::collections::HashSet<String>` - Function names called in the expression.

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> FelAnalysis`

## formspec_core::fel_analysis::FelAnalysisError

*Struct*

A parse/analysis error with a human-readable message.

**Fields:**

- `message: String` - Error text from the FEL parser or evaluator.
- `span: Option<Range<usize>>` - Byte range into the expression when the parser attached a span.

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> FelAnalysisError`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::fel_analysis::FelRewriteTargets

*Struct*

Field/variable/navigation targets that can be rewritten in a FEL expression.

**Fields:**

- `field_paths: std::collections::HashSet<String>`
- `current_paths: std::collections::HashSet<String>`
- `variables: std::collections::HashSet<String>`
- `instance_names: std::collections::HashSet<String>`
- `navigation_targets: Vec<NavigationTarget>`

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> FelRewriteTargets`
- **Default**
  - `fn default() -> FelRewriteTargets`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::fel_analysis::NavigationTarget

*Struct*

A literal navigation target passed to `prev` / `next` / `parent`.

**Fields:**

- `function_name: String`
- `name: String`

**Traits:** Eq

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> NavigationTarget`
- **Hash**
  - `fn hash<__H>(self: &Self, state: & mut __H)`
- **PartialEq**
  - `fn eq(self: &Self, other: &NavigationTarget) -> bool`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::fel_analysis::RewriteOptions

*Struct*

Options for rewriting references in a FEL expression.

Each callback receives the current value and returns the replacement.
Return `None` to keep the original.

**Fields:**

- `rewrite_field_path: Option<Box<dyn Fn>>` - Rewrite `$field.path` references.
- `rewrite_current_path: Option<Box<dyn Fn>>` - Rewrite the dotted tail of `@current.foo.bar`.
- `rewrite_variable: Option<Box<dyn Fn>>` - Rewrite `@variable` names.
- `rewrite_instance_name: Option<Box<dyn Fn>>` - Rewrite `@instance('name')` names.
- `rewrite_navigation_target: Option<Box<dyn Fn>>` - Rewrite literal field-name arguments to prev()/next()/parent().

## formspec_core::fel_analysis::analyze_fel

*Function*

Analyze a FEL expression string, extracting structural information.

```rust
fn analyze_fel(expression: &str) -> FelAnalysis
```

## formspec_core::fel_analysis::collect_fel_rewrite_targets

*Function*

Collect every rewriteable target referenced by a FEL expression.

```rust
fn collect_fel_rewrite_targets(expression: &str) -> FelRewriteTargets
```

## formspec_core::fel_analysis::fel_analysis_to_json_value

*Function*

Static analysis result as JSON (`valid`, `errors`, `references`, `variables`, `functions`). Each `errors[]` item is `{"message": string, "span": {"start": number, "end": number} | null}`.

```rust
fn fel_analysis_to_json_value(result: &FelAnalysis) -> serde_json::Value
```

## formspec_core::fel_analysis::fel_rewrite_targets_to_json_value

*Function*

[`FelRewriteTargets`] as sorted JSON (camelCase keys) for `collectFELRewriteTargets`.

```rust
fn fel_rewrite_targets_to_json_value(targets: &FelRewriteTargets) -> serde_json::Value
```

## formspec_core::fel_analysis::get_fel_dependencies

*Function*

Extract field dependencies from an expression (safe on parse failure).

```rust
fn get_fel_dependencies(expression: &str) -> std::collections::HashSet<String>
```

## formspec_core::fel_analysis::rewrite_fel_references

*Function*

Rewrite references in a FEL expression AST.

Returns a new AST with transformed references.

```rust
fn rewrite_fel_references(expr: &fel_core::ast::Expr, options: &RewriteOptions) -> fel_core::ast::Expr
```

## formspec_core::fel_analysis::rewrite_options_from_camel_case_json

*Function*

Build [`RewriteOptions`] from the camelCase JSON map used by `rewriteFELReferences` / `rewriteMessageTemplate`.

```rust
fn rewrite_options_from_camel_case_json(rewrites: &serde_json::Value) -> RewriteOptions
```

---

## Source: formspec_core/fel_rewrite_exact.md

**formspec_core > fel_rewrite_exact**

# Module: fel_rewrite_exact

## Contents

**Functions**

- [`rewrite_fel_source_references`](#rewrite_fel_source_references) - Rewrite `$` / `@` references in source text using span-aware lexing (preserves non-ref text).
- [`rewrite_message_template`](#rewrite_message_template) - Rewrite each `{{ ... }}` FEL substring in a message template via [`rewrite_fel_source_references`].

---

## formspec_core::fel_rewrite_exact::rewrite_fel_source_references

*Function*

Rewrite `$` / `@` references in source text using span-aware lexing (preserves non-ref text).

On parse failure, returns `expression` unchanged.

```rust
fn rewrite_fel_source_references(expression: &str, options: &crate::fel_analysis::RewriteOptions) -> String
```

## formspec_core::fel_rewrite_exact::rewrite_message_template

*Function*

Rewrite each `{{ ... }}` FEL substring in a message template via [`rewrite_fel_source_references`].

```rust
fn rewrite_message_template(message: &str, options: &crate::fel_analysis::RewriteOptions) -> String
```

---

## Source: formspec_core/json_artifacts.md

**formspec_core > json_artifacts**

# Module: json_artifacts

## Contents

**Functions**

- [`changelog_to_json_value`](#changelog_to_json_value) - Serialize a generated changelog for FFI consumers.
- [`extension_usage_issues_to_json_value`](#extension_usage_issues_to_json_value) - Serialize extension usage validation issues (camelCase keys for JS).

---

## formspec_core::json_artifacts::changelog_to_json_value

*Function*

Serialize a generated changelog for FFI consumers.

```rust
fn changelog_to_json_value(result: &crate::changelog::Changelog, style: JsonWireStyle) -> serde_json::Value
```

## formspec_core::json_artifacts::extension_usage_issues_to_json_value

*Function*

Serialize extension usage validation issues (camelCase keys for JS).

```rust
fn extension_usage_issues_to_json_value(issues: &[crate::extension_analysis::ExtensionUsageIssue]) -> serde_json::Value
```

---

## Source: formspec_core/json_util.md

**formspec_core > json_util**

# Module: json_util

## Contents

**Functions**

- [`json_object_to_string_map`](#json_object_to_string_map) - Clone a JSON object into a `String` → `Value` map; non-objects yield an empty map.

---

## formspec_core::json_util::json_object_to_string_map

*Function*

Clone a JSON object into a `String` → `Value` map; non-objects yield an empty map.

```rust
fn json_object_to_string_map(val: &serde_json::Value) -> std::collections::HashMap<String, serde_json::Value>
```

---

## Source: formspec_core/path_utils.md

**formspec_core > path_utils**

# Module: path_utils

## Contents

**Structs**

- [`ItemLocation`](#itemlocation) - A resolved position in a tree: the parent slice, index within it, and the item itself.

**Functions**

- [`definition_item_location_to_json_value`](#definition_item_location_to_json_value) - `itemLocationAtPath` JSON (`parentPath` / `parent_path`, …) or null.
- [`item_at_path`](#item_at_path) - Find an item by normalized dotted path, walking children at each segment.
- [`item_location_at_path`](#item_location_at_path) - Resolve the location triple (parent, index, item) for a dotted path.
- [`json_definition_item_at_path`](#json_definition_item_at_path) - Resolve an item in a JSON `items` array by dotted path (`key` / `children` shape).
- [`json_definition_item_location_at_path`](#json_definition_item_location_at_path) - `(index, item)` within its parent `children` slice for a dotted path.
- [`leaf_key`](#leaf_key) - Extract the last segment from a dotted path.
- [`normalize_indexed_path`](#normalize_indexed_path) - Strip all repeat indices from a dotted path.
- [`normalize_path_segment`](#normalize_path_segment) - Strip repeat indices from a single path segment: `lineItems[0]` → `lineItems`.
- [`parent_path`](#parent_path) - Extract the parent path from a dotted path.
- [`split_normalized_path`](#split_normalized_path) - Split a normalized dotted path into segments, filtering empties.

**Traits**

- [`TreeItem`](#treeitem) - A generic tree node shape for path traversal.

---

## formspec_core::path_utils::ItemLocation

*Struct*

A resolved position in a tree: the parent slice, index within it, and the item itself.

**Generic Parameters:**

- 'a
- T

**Fields:**

- `parent: &'a [T]` - Sibling slice containing [`Self::item`].
- `index: usize` - Index of [`Self::item`] within `parent`.
- `item: &'a T` - The resolved node.

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::path_utils::TreeItem

*Trait*

A generic tree node shape for path traversal.

**Methods:**

- `key`: Stable segment key for this node (matches one dotted path segment).
- `children`: Child nodes for the next path segment.

## formspec_core::path_utils::definition_item_location_to_json_value

*Function*

`itemLocationAtPath` JSON (`parentPath` / `parent_path`, …) or null.

```rust
fn definition_item_location_to_json_value(items: &[serde_json::Value], path: &str, style: crate::JsonWireStyle) -> serde_json::Value
```

## formspec_core::path_utils::item_at_path

*Function*

Find an item by normalized dotted path, walking children at each segment.

```rust
fn item_at_path<'a, T>(items: &'a [T], path: &str) -> Option<&'a T>
```

## formspec_core::path_utils::item_location_at_path

*Function*

Resolve the location triple (parent, index, item) for a dotted path.

```rust
fn item_location_at_path<'a, T>(items: &'a [T], path: &str) -> Option<ItemLocation<'a, T>>
```

## formspec_core::path_utils::json_definition_item_at_path

*Function*

Resolve an item in a JSON `items` array by dotted path (`key` / `children` shape).

```rust
fn json_definition_item_at_path<'a>(items: &'a [serde_json::Value], path: &str) -> Option<&'a serde_json::Value>
```

## formspec_core::path_utils::json_definition_item_location_at_path

*Function*

`(index, item)` within its parent `children` slice for a dotted path.

```rust
fn json_definition_item_location_at_path<'a>(items: &'a [serde_json::Value], path: &str) -> Option<(usize, &'a serde_json::Value)>
```

## formspec_core::path_utils::leaf_key

*Function*

Extract the last segment from a dotted path.
`group.child.field` → `field`
`field` → `field`

```rust
fn leaf_key(path: &str) -> &str
```

## formspec_core::path_utils::normalize_indexed_path

*Function*

Strip all repeat indices from a dotted path.
`group[0].items[1].field` → `group.items.field`

```rust
fn normalize_indexed_path(path: &str) -> String
```

## formspec_core::path_utils::normalize_path_segment

*Function*

Strip repeat indices from a single path segment: `lineItems[0]` → `lineItems`.

```rust
fn normalize_path_segment(segment: &str) -> &str
```

## formspec_core::path_utils::parent_path

*Function*

Extract the parent path from a dotted path.
`group.child.field` → `group.child`
`field` → `""`

```rust
fn parent_path(path: &str) -> &str
```

## formspec_core::path_utils::split_normalized_path

*Function*

Split a normalized dotted path into segments, filtering empties.

```rust
fn split_normalized_path(path: &str) -> Vec<&str>
```

---

## Source: formspec_core/registry_client.md

**formspec_core > registry_client**

# Module: registry_client

## Contents

**Functions**

- [`extension_category_to_wire`](#extension_category_to_wire) - Serialize extension category for JSON / FFI consumers.
- [`parse_registry_entry_status`](#parse_registry_entry_status) - Parse registry entry status strings (`draft`, `stable`, `active`, …).
- [`registry_entry_status_to_wire`](#registry_entry_status_to_wire) - Serialize status for JSON / FFI consumers (`active` → `"stable"`).
- [`validate_lifecycle_transition`](#validate_lifecycle_transition) - Check whether a lifecycle transition is valid per the spec.
- [`well_known_url`](#well_known_url) - Construct the well-known registry URL for a base URL.

---

## formspec_core::registry_client::extension_category_to_wire

*Function*

Serialize extension category for JSON / FFI consumers.

```rust
fn extension_category_to_wire(category: ExtensionCategory) -> &'static str
```

## formspec_core::registry_client::parse_registry_entry_status

*Function*

Parse registry entry status strings (`draft`, `stable`, `active`, …).

```rust
fn parse_registry_entry_status(s: &str) -> Option<crate::extension_analysis::RegistryEntryStatus>
```

## formspec_core::registry_client::registry_entry_status_to_wire

*Function*

Serialize status for JSON / FFI consumers (`active` → `"stable"`).

```rust
fn registry_entry_status_to_wire(status: crate::extension_analysis::RegistryEntryStatus) -> &'static str
```

## formspec_core::registry_client::validate_lifecycle_transition

*Function*

Check whether a lifecycle transition is valid per the spec.

```text
draft      → {draft, stable}
stable     → {stable, deprecated}
deprecated → {deprecated, retired, stable}  // un-deprecation allowed
retired    → {}  // terminal
```

```rust
fn validate_lifecycle_transition(from: crate::extension_analysis::RegistryEntryStatus, to: crate::extension_analysis::RegistryEntryStatus) -> bool
```

## formspec_core::registry_client::well_known_url

*Function*

Construct the well-known registry URL for a base URL.

```rust
fn well_known_url(base_url: &str) -> String
```

---

## Source: formspec_core/registry_client/types.md

**formspec_core > registry_client > types**

# Module: registry_client::types

## Contents

**Structs**

- [`Parameter`](#parameter) - Function/constraint parameter declaration.
- [`Publisher`](#publisher) - Organization publishing a registry document.
- [`Registry`](#registry) - A parsed registry document with indexed entries.
- [`RegistryEntry`](#registryentry) - A single extension record with full metadata.

**Enums**

- [`ExtensionCategory`](#extensioncategory) - Extension mechanism category.
- [`RegistryError`](#registryerror) - Errors from registry parsing and validation.

---

## formspec_core::registry_client::types::ExtensionCategory

*Enum*

Extension mechanism category.

**Variants:**

- `DataType`
- `Function`
- `Constraint`
- `Property`
- `Namespace`

**Traits:** Eq, Copy

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **PartialEq**
  - `fn eq(self: &Self, other: &ExtensionCategory) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> ExtensionCategory`

## formspec_core::registry_client::types::Parameter

*Struct*

Function/constraint parameter declaration.

**Fields:**

- `name: String`
- `param_type: String`
- `description: Option<String>`

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> Parameter`

## formspec_core::registry_client::types::Publisher

*Struct*

Organization publishing a registry document.

**Fields:**

- `name: String`
- `url: String`
- `contact: Option<String>`

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> Publisher`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::registry_client::types::Registry

*Struct*

A parsed registry document with indexed entries.

**Fields:**

- `publisher: Publisher`
- `published: String`

**Methods:**

- `fn from_json(value: &Value) -> Result<Self, RegistryError>` - Parse a registry document from a JSON value.
- `fn find(self: &Self, name: &str, version_constraint: Option<&str>) -> Vec<&RegistryEntry>` - Find all entries matching `name`, optionally filtered by a version constraint.
- `fn find_one(self: &Self, name: &str, version_constraint: Option<&str>) -> Option<&RegistryEntry>` - Find the highest-version entry matching `name` and optional constraint.
- `fn list_by_category(self: &Self, category: ExtensionCategory) -> Vec<&RegistryEntry>` - List all entries in a given category.
- `fn list_by_status(self: &Self, status: RegistryEntryStatus) -> Vec<&RegistryEntry>` - List all entries with a given lifecycle status.
- `fn validate(self: &Self) -> Vec<String>` - Validate registry entries against structural rules.

**Trait Implementations:**

- **RegistryLookup**
  - `fn lookup(self: &Self, extension_name: &str) -> Option<RegistryEntryInfo>`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::registry_client::types::RegistryEntry

*Struct*

A single extension record with full metadata.

**Fields:**

- `name: String`
- `category: ExtensionCategory`
- `version: String`
- `status: crate::extension_analysis::RegistryEntryStatus`
- `description: String`
- `deprecation_notice: Option<String>`
- `base_type: Option<String>`
- `parameters: Option<Vec<Parameter>>`
- `returns: Option<String>`

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> RegistryEntry`

## formspec_core::registry_client::types::RegistryError

*Enum*

Errors from registry parsing and validation.

**Variants:**

- `MissingField(String)` - Missing required top-level field.
- `InvalidField(String)` - Field has wrong type.
- `InvalidEntry(usize, String)` - Entry-level parse error (index, message).

**Traits:** Eq, Error

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> RegistryError`
- **PartialEq**
  - `fn eq(self: &Self, other: &RegistryError) -> bool`
- **Display**
  - `fn fmt(self: &Self, f: & mut std::fmt::Formatter) -> std::fmt::Result`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

---

## Source: formspec_core/registry_client/version.md

**formspec_core > registry_client > version**

# Module: registry_client::version

## Contents

**Functions**

- [`version_satisfies`](#version_satisfies) - Check if `version` satisfies a space-separated constraint string.

---

## formspec_core::registry_client::version::version_satisfies

*Function*

Check if `version` satisfies a space-separated constraint string.
Each token is an operator+version (e.g. `>=1.0.0`) or an exact version.
All tokens must match (AND semantics).

```rust
fn version_satisfies(version: &str, constraint: &str) -> bool
```

---

## Source: formspec_core/registry_client/wire_json.md

**formspec_core > registry_client > wire_json**

# Module: registry_client::wire_json

## Contents

**Functions**

- [`registry_entry_count_from_raw`](#registry_entry_count_from_raw) - Entry count from raw registry JSON (`entries` array length).
- [`registry_entry_to_json_value`](#registry_entry_to_json_value) - Single registry entry for `findRegistryEntry` / `find_registry_entry`.
- [`registry_parse_summary_to_json_value`](#registry_parse_summary_to_json_value) - `parseRegistry` / `parse_registry` summary object.
- [`version_constraint_option`](#version_constraint_option) - Empty string means “no constraint” for `find_one` host inputs.

---

## formspec_core::registry_client::wire_json::registry_entry_count_from_raw

*Function*

Entry count from raw registry JSON (`entries` array length).

```rust
fn registry_entry_count_from_raw(val: &serde_json::Value) -> usize
```

## formspec_core::registry_client::wire_json::registry_entry_to_json_value

*Function*

Single registry entry for `findRegistryEntry` / `find_registry_entry`.

```rust
fn registry_entry_to_json_value(entry: &super::RegistryEntry, style: crate::JsonWireStyle) -> serde_json::Value
```

## formspec_core::registry_client::wire_json::registry_parse_summary_to_json_value

*Function*

`parseRegistry` / `parse_registry` summary object.

```rust
fn registry_parse_summary_to_json_value(registry: &super::Registry, raw: &serde_json::Value, issues: &[String], style: crate::JsonWireStyle) -> serde_json::Value
```

## formspec_core::registry_client::wire_json::version_constraint_option

*Function*

Empty string means “no constraint” for `find_one` host inputs.

```rust
fn version_constraint_option(s: &str) -> Option<&str>
```

---

## Source: formspec_core/runtime_mapping/document.md

**formspec_core > runtime_mapping > document**

# Module: runtime_mapping::document

## Contents

**Functions**

- [`execute_mapping_doc`](#execute_mapping_doc) - Execute a full mapping document (rules + defaults + autoMap).

---

## formspec_core::runtime_mapping::document::execute_mapping_doc

*Function*

Execute a full mapping document (rules + defaults + autoMap).

```rust
fn execute_mapping_doc(doc: &super::types::MappingDocument, source: &serde_json::Value, direction: super::types::MappingDirection) -> super::types::MappingResult
```

---

## Source: formspec_core/runtime_mapping/engine.md

**formspec_core > runtime_mapping > engine**

# Module: runtime_mapping::engine

## Contents

**Functions**

- [`execute_mapping`](#execute_mapping) - Execute a set of mapping rules in a given direction.

---

## formspec_core::runtime_mapping::engine::execute_mapping

*Function*

Execute a set of mapping rules in a given direction.

```rust
fn execute_mapping(rules: &[MappingRule], source: &serde_json::Value, direction: MappingDirection) -> MappingResult
```

---

## Source: formspec_core/runtime_mapping/parse.md

**formspec_core > runtime_mapping > parse**

# Module: runtime_mapping::parse

## Contents

**Functions**

- [`parse_coerce_type`](#parse_coerce_type) - Parse a coerce type from a mapping rule JSON `coerce` field.
- [`parse_mapping_direction_field`](#parse_mapping_direction_field) - Parse optional top-level `"direction"` restriction on a mapping document.
- [`parse_mapping_document_from_value`](#parse_mapping_document_from_value) - Parse a full mapping document (rules, defaults, autoMap, optional direction lock).
- [`parse_mapping_rules_from_value`](#parse_mapping_rules_from_value) - Parse a JSON array of mapping rules into runtime structures.

---

## formspec_core::runtime_mapping::parse::parse_coerce_type

*Function*

Parse a coerce type from a mapping rule JSON `coerce` field.

Accepts string shorthand (`"number"`) or object form (`{"from": "string", "to": "number"}`).
The object `"from"` field is ignored for runtime dispatch.

```rust
fn parse_coerce_type(val: &serde_json::Value) -> Option<super::types::CoerceType>
```

## formspec_core::runtime_mapping::parse::parse_mapping_direction_field

*Function*

Parse optional top-level `"direction"` restriction on a mapping document.

```rust
fn parse_mapping_direction_field(val: &serde_json::Value) -> Option<super::types::MappingDirection>
```

## formspec_core::runtime_mapping::parse::parse_mapping_document_from_value

*Function*

Parse a full mapping document (rules, defaults, autoMap, optional direction lock).

```rust
fn parse_mapping_document_from_value(val: &serde_json::Value) -> Result<super::types::MappingDocument, String>
```

## formspec_core::runtime_mapping::parse::parse_mapping_rules_from_value

*Function*

Parse a JSON array of mapping rules into runtime structures.

```rust
fn parse_mapping_rules_from_value(val: &serde_json::Value) -> Result<Vec<super::types::MappingRule>, String>
```

---

## Source: formspec_core/runtime_mapping/types.md

**formspec_core > runtime_mapping > types**

# Module: runtime_mapping::types

## Contents

**Structs**

- [`ArrayDescriptor`](#arraydescriptor) - Array iteration descriptor.
- [`MappingDiagnostic`](#mappingdiagnostic) - A diagnostic from mapping execution.
- [`MappingDocument`](#mappingdocument) - A complete mapping document with rules, defaults, and autoMap.
- [`MappingResult`](#mappingresult) - Result of a mapping execution.
- [`MappingRule`](#mappingrule) - A mapping rule — one transform in the pipeline.
- [`ReverseOverride`](#reverseoverride) - Reverse-direction transform override.

**Enums**

- [`ArrayMode`](#arraymode) - Array iteration mode.
- [`CoerceType`](#coercetype) - Target types for coercion.
- [`MappingDirection`](#mappingdirection) - Transform direction.
- [`MappingErrorCode`](#mappingerrorcode) - Structured error codes for mapping diagnostics.
- [`TransformType`](#transformtype) - Supported transform types.
- [`UnmappedStrategy`](#unmappedstrategy) - Strategy for values not found in a value map.

---

## formspec_core::runtime_mapping::types::ArrayDescriptor

*Struct*

Array iteration descriptor.

**Fields:**

- `mode: ArrayMode` - Iteration mode: "each", "indexed", or "whole".
- `inner_rules: Vec<MappingRule>` - Sub-rules applied per element (each/indexed modes).

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> ArrayDescriptor`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::runtime_mapping::types::ArrayMode

*Enum*

Array iteration mode.

**Variants:**

- `Each` - Process each element individually.
- `Indexed` - Access elements by index.
- `Whole` - Treat the array as a single value (default).

**Traits:** Eq, Copy

**Trait Implementations:**

- **PartialEq**
  - `fn eq(self: &Self, other: &ArrayMode) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> ArrayMode`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::runtime_mapping::types::CoerceType

*Enum*

Target types for coercion.

**Variants:**

- `String`
- `Number`
- `Integer`
- `Boolean`
- `Date`
- `DateTime`
- `Array`

**Traits:** Eq, Copy

**Trait Implementations:**

- **PartialEq**
  - `fn eq(self: &Self, other: &CoerceType) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> CoerceType`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::runtime_mapping::types::MappingDiagnostic

*Struct*

A diagnostic from mapping execution.

**Fields:**

- `rule_index: usize`
- `source_path: Option<String>`
- `target_path: String`
- `error_code: MappingErrorCode`
- `message: String`

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> MappingDiagnostic`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::runtime_mapping::types::MappingDirection

*Enum*

Transform direction.

**Variants:**

- `Forward`
- `Reverse`

**Traits:** Eq, Copy

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **PartialEq**
  - `fn eq(self: &Self, other: &MappingDirection) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> MappingDirection`

## formspec_core::runtime_mapping::types::MappingDocument

*Struct*

A complete mapping document with rules, defaults, and autoMap.

**Fields:**

- `rules: Vec<MappingRule>`
- `defaults: Option<serde_json::Map<String, serde_json::Value>>` - Key-value defaults pre-populated into the output before rules execute (forward only).
- `auto_map: bool` - When true, generate synthetic preserve rules for unmapped top-level source keys.
- `direction_restriction: Option<MappingDirection>` - When set, [`execute_mapping_doc`](super::document::execute_mapping_doc) only permits this direction.

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> MappingDocument`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::runtime_mapping::types::MappingErrorCode

*Enum*

Structured error codes for mapping diagnostics.

**Variants:**

- `UnmappedValue`
- `CoerceFailure`
- `FelRuntime`
- `InvalidDocument` - Document-level restriction violated (e.g. forward-only doc executed in reverse).

**Methods:**

- `fn as_str(self: &Self) -> &'static str` - Uppercase wire token for JSON diagnostics.

**Traits:** Eq, Copy

**Trait Implementations:**

- **PartialEq**
  - `fn eq(self: &Self, other: &MappingErrorCode) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> MappingErrorCode`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::runtime_mapping::types::MappingResult

*Struct*

Result of a mapping execution.

**Fields:**

- `direction: MappingDirection`
- `output: serde_json::Value`
- `rules_applied: usize`
- `diagnostics: Vec<MappingDiagnostic>`

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> MappingResult`

## formspec_core::runtime_mapping::types::MappingRule

*Struct*

A mapping rule — one transform in the pipeline.

**Fields:**

- `source_path: Option<String>` - Source path (dot notation).
- `target_path: String` - Target path (dot notation).
- `transform: TransformType` - Transform type.
- `condition: Option<String>` - Optional FEL condition guard.
- `priority: i32` - Priority (higher = earlier in forward).
- `reverse_priority: Option<i32>` - Reverse priority (if different from forward).
- `default: Option<serde_json::Value>` - Fallback value when source resolves to null/absent.
- `bidirectional: bool` - Whether this rule participates in reverse execution (default true).
- `array: Option<ArrayDescriptor>` - Array descriptor for iterating over array source values.
- `reverse: Option<Box<ReverseOverride>>` - Reverse-direction transform override.

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> MappingRule`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::runtime_mapping::types::ReverseOverride

*Struct*

Reverse-direction transform override.

**Fields:**

- `transform: TransformType`

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> ReverseOverride`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::runtime_mapping::types::TransformType

*Enum*

Supported transform types.

**Variants:**

- `Preserve` - Copy value as-is.
- `Drop` - Drop the value (skip this rule).
- `Constant(serde_json::Value)` - Inject a constant value (no source path required).
- `ValueMap{ forward: Vec<(serde_json::Value, serde_json::Value)>, unmapped: UnmappedStrategy }` - Map values through a lookup table.
- `Coerce(CoerceType)` - Coerce to a target type.
- `Expression(String)` - Evaluate a FEL expression.
- `Flatten{ separator: String }` - Flatten nested/array structure to a scalar string using separator.
- `Nest{ separator: String }` - Expand flat string into nested object by splitting on separator.
- `Concat(String)` - FEL expression that must evaluate to a string ($ = source value, full doc in scope).
- `Split(String)` - FEL expression that must return array or object ($ = source value, full doc in scope).

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> TransformType`

## formspec_core::runtime_mapping::types::UnmappedStrategy

*Enum*

Strategy for values not found in a value map.

Spec: mapping/mapping-spec.md §4.6 — ValueMap unmapped strategies.
The spec defines exactly four strategies: "error", "drop", "passthrough", "default".

**Variants:**

- `PassThrough` - `"passthrough"` — copy the source value through unchanged.
- `Drop` - `"drop"` — omit the target field entirely (returns None from apply_value_map).
- `Error` - `"error"` — produce a runtime mapping diagnostic.
- `Default` - `"default"` — use the default value from the rule's `default` property.

**Traits:** Eq, Copy

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **PartialEq**
  - `fn eq(self: &Self, other: &UnmappedStrategy) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> UnmappedStrategy`

---

## Source: formspec_core/runtime_mapping/wire_json.md

**formspec_core > runtime_mapping > wire_json**

# Module: runtime_mapping::wire_json

## Contents

**Functions**

- [`mapping_direction_wire`](#mapping_direction_wire) - Serialize [`MappingDirection`] to the wire string (`forward` / `reverse`).
- [`mapping_result_to_json_value`](#mapping_result_to_json_value) - Mapping execute result (`executeMapping` / `execute_mapping_doc`).
- [`parse_mapping_direction_wire`](#parse_mapping_direction_wire) - Parse wire direction string into [`MappingDirection`].

---

## formspec_core::runtime_mapping::wire_json::mapping_direction_wire

*Function*

Serialize [`MappingDirection`] to the wire string (`forward` / `reverse`).

```rust
fn mapping_direction_wire(d: super::types::MappingDirection) -> &'static str
```

## formspec_core::runtime_mapping::wire_json::mapping_result_to_json_value

*Function*

Mapping execute result (`executeMapping` / `execute_mapping_doc`).

```rust
fn mapping_result_to_json_value(result: &super::types::MappingResult, style: crate::JsonWireStyle) -> serde_json::Value
```

## formspec_core::runtime_mapping::wire_json::parse_mapping_direction_wire

*Function*

Parse wire direction string into [`MappingDirection`].

```rust
fn parse_mapping_direction_wire(s: &str) -> Result<super::types::MappingDirection, String>
```

---

## Source: formspec_core/schema_validator.md

**formspec_core > schema_validator**

# Module: schema_validator

## Contents

**Structs**

- [`ComponentValidationTarget`](#componentvalidationtarget) - A single component subtree node that needs host-side schema execution.
- [`SchemaValidationError`](#schemavalidationerror) - A schema validation error with path and message.
- [`SchemaValidationPlan`](#schemavalidationplan) - Validation dispatch plan returned to host runtimes that execute JSON Schema locally.
- [`SchemaValidationResult`](#schemavalidationresult) - Result of schema validation.

**Enums**

- [`DocumentType`](#documenttype) - All recognized Formspec document types.

**Functions**

- [`detect_document_type`](#detect_document_type) - Detect the document type from a JSON value by examining marker fields.
- [`json_pointer_to_jsonpath`](#json_pointer_to_jsonpath) - Convert a JSON Pointer (e.g., `/items/0/key`) to a JSONPath (e.g., `$.items\[0\].key`).
- [`schema_validation_plan`](#schema_validation_plan) - Build the validation execution plan for a document.
- [`validate_document`](#validate_document) - Validate a Formspec document, auto-detecting its type and running schema validation.

**Traits**

- [`JsonSchemaValidator`](#jsonschemavalidator) - Trait for JSON Schema validation — implemented by the host/binding layer.

---

## formspec_core::schema_validator::ComponentValidationTarget

*Struct*

A single component subtree node that needs host-side schema execution.

**Fields:**

- `pointer: String` - JSON Pointer to the node root (e.g. `/tree/children/0`).
- `component: String` - Component type string used to pick the correct schema definition.
- `node: serde_json::Value` - Raw node value to validate.

**Trait Implementations:**

- **Clone**
  - `fn clone(self: &Self) -> ComponentValidationTarget`
- **Serialize**
  - `fn serialize<__S>(self: &Self, __serializer: __S) -> _serde::__private228::Result<<__S as >::Ok, <__S as >::Error>`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::schema_validator::DocumentType

*Enum*

All recognized Formspec document types.

**Variants:**

- `Definition`
- `Theme`
- `Mapping`
- `Component`
- `Response`
- `ValidationReport`
- `ValidationResult`
- `Registry`
- `Changelog`
- `FelFunctions`

**Methods:**

- `fn schema_key(self: &Self) -> &'static str` - Schema key for this document type (used as discriminator).
- `fn from_schema_key(key: &str) -> Option<Self>` - Parse the public schema key string used by the TS/Python layers.

**Traits:** Eq, Copy

**Trait Implementations:**

- **PartialEq**
  - `fn eq(self: &Self, other: &DocumentType) -> bool`
- **Clone**
  - `fn clone(self: &Self) -> DocumentType`
- **Hash**
  - `fn hash<__H>(self: &Self, state: & mut __H)`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`

## formspec_core::schema_validator::JsonSchemaValidator

*Trait*

Trait for JSON Schema validation — implemented by the host/binding layer.

This allows the WASM layer to use AJV and the PyO3 layer to use jsonschema-rs
without coupling `formspec-core` to either.

**Methods:**

- `validate`: Validate a document against the schema for the given document type.

## formspec_core::schema_validator::SchemaValidationError

*Struct*

A schema validation error with path and message.

**Fields:**

- `path: String` - JSONPath to the invalid element (e.g., `$.items\[0\].key`).
- `message: String` - Human-readable error message.

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> SchemaValidationError`

## formspec_core::schema_validator::SchemaValidationPlan

*Struct*

Validation dispatch plan returned to host runtimes that execute JSON Schema locally.

**Fields:**

- `document_type: Option<String>` - Detected or explicitly requested document type.
- `mode: String` - Strategy discriminator: `unknown`, `document`, or `component`.
- `component_targets: Vec<ComponentValidationTarget>` - Per-node validation targets for component documents.
- `error: Option<String>` - Populated only for `unknown` mode.

**Trait Implementations:**

- **Serialize**
  - `fn serialize<__S>(self: &Self, __serializer: __S) -> _serde::__private228::Result<<__S as >::Ok, <__S as >::Error>`
- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> SchemaValidationPlan`

## formspec_core::schema_validator::SchemaValidationResult

*Struct*

Result of schema validation.

**Fields:**

- `document_type: Option<DocumentType>` - Detected document type (None if detection failed).
- `errors: Vec<SchemaValidationError>` - Validation errors.

**Trait Implementations:**

- **Debug**
  - `fn fmt(self: &Self, f: & mut $crate::fmt::Formatter) -> $crate::fmt::Result`
- **Clone**
  - `fn clone(self: &Self) -> SchemaValidationResult`

## formspec_core::schema_validator::detect_document_type

*Function*

Detect the document type from a JSON value by examining marker fields.

```rust
fn detect_document_type(doc: &serde_json::Value) -> Option<DocumentType>
```

## formspec_core::schema_validator::json_pointer_to_jsonpath

*Function*

Convert a JSON Pointer (e.g., `/items/0/key`) to a JSONPath (e.g., `$.items\[0\].key`).

```rust
fn json_pointer_to_jsonpath(pointer: &str) -> String
```

## formspec_core::schema_validator::schema_validation_plan

*Function*

Build the validation execution plan for a document.

Non-component documents validate as a single root document. Component documents use
the same shallow-document + per-node strategy as the host validators to avoid
whole-tree oneOf backtracking.

```rust
fn schema_validation_plan(doc: &serde_json::Value, document_type_override: Option<DocumentType>) -> SchemaValidationPlan
```

## formspec_core::schema_validator::validate_document

*Function*

Validate a Formspec document, auto-detecting its type and running schema validation.

```rust
fn validate_document(doc: &serde_json::Value, validator: &dyn JsonSchemaValidator) -> SchemaValidationResult
```

---

## Source: formspec_core/wire_keys.md

**formspec_core > wire_keys**

# Module: wire_keys

## Contents

**Structs**

- [`ChangelogRootKeys`](#changelogrootkeys) - Top-level changelog object keys for [`crate::json_artifacts::changelog_to_json_value`].

**Functions**

- [`assembly_provenance_keys`](#assembly_provenance_keys) - Keys for [`crate::assembler::assembly_result_to_json_value`] provenance rows + root.
- [`changelog_change_keys`](#changelog_change_keys) - Per-change object keys inside changelog JSON.
- [`changelog_root_keys`](#changelog_root_keys) - Field names for the changelog root object in the given wire style.
- [`evaluation_batch_keys`](#evaluation_batch_keys) - Batch evaluation JSON keys: non-relevant paths, validation `constraintKind`, `shapeId`.
- [`item_location_parent_key`](#item_location_parent_key) - Parent path key for [`crate::path_utils::definition_item_location_to_json_value`].
- [`lint_document_type_key`](#lint_document_type_key) - Document type field for lint result JSON.
- [`mapping_result_host_keys`](#mapping_result_host_keys) - Keys for [`crate::runtime_mapping::mapping_result_to_json_value`].
- [`registry_entry_keys`](#registry_entry_keys) - Keys for [`crate::registry_client::registry_entry_to_json_value`].
- [`registry_parse_summary_keys`](#registry_parse_summary_keys) - Keys for [`crate::registry_client::registry_parse_summary_to_json_value`].

---

## formspec_core::wire_keys::ChangelogRootKeys

*Struct*

Top-level changelog object keys for [`crate::json_artifacts::changelog_to_json_value`].

**Fields:**

- `definition_url: &'static str`
- `from_version: &'static str`
- `to_version: &'static str`
- `semver_impact: &'static str`

## formspec_core::wire_keys::assembly_provenance_keys

*Function*

Keys for [`crate::assembler::assembly_result_to_json_value`] provenance rows + root.

```rust
fn assembly_provenance_keys(style: fel_core::JsonWireStyle) -> (&'static str, &'static str)
```

## formspec_core::wire_keys::changelog_change_keys

*Function*

Per-change object keys inside changelog JSON.

```rust
fn changelog_change_keys(style: fel_core::JsonWireStyle) -> (&'static str, &'static str)
```

## formspec_core::wire_keys::changelog_root_keys

*Function*

Field names for the changelog root object in the given wire style.

```rust
fn changelog_root_keys(style: fel_core::JsonWireStyle) -> ChangelogRootKeys
```

## formspec_core::wire_keys::evaluation_batch_keys

*Function*

Batch evaluation JSON keys: non-relevant paths, validation `constraintKind`, `shapeId`.

```rust
fn evaluation_batch_keys(style: fel_core::JsonWireStyle) -> (&'static str, &'static str, &'static str)
```

## formspec_core::wire_keys::item_location_parent_key

*Function*

Parent path key for [`crate::path_utils::definition_item_location_to_json_value`].

```rust
fn item_location_parent_key(style: fel_core::JsonWireStyle) -> &'static str
```

## formspec_core::wire_keys::lint_document_type_key

*Function*

Document type field for lint result JSON.

```rust
fn lint_document_type_key(style: fel_core::JsonWireStyle) -> &'static str
```

## formspec_core::wire_keys::mapping_result_host_keys

*Function*

Keys for [`crate::runtime_mapping::mapping_result_to_json_value`].

```rust
fn mapping_result_host_keys(style: fel_core::JsonWireStyle) -> (&'static str, &'static str, &'static str, &'static str, &'static str)
```

## formspec_core::wire_keys::registry_entry_keys

*Function*

Keys for [`crate::registry_client::registry_entry_to_json_value`].

```rust
fn registry_entry_keys(style: fel_core::JsonWireStyle) -> (&'static str, &'static str)
```

## formspec_core::wire_keys::registry_parse_summary_keys

*Function*

Keys for [`crate::registry_client::registry_parse_summary_to_json_value`].

```rust
fn registry_parse_summary_keys(style: fel_core::JsonWireStyle) -> (&'static str, &'static str)
```

---
