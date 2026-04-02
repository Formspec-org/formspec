# Definition Advisories — Bind Consistency Rules

**Date:** 2026-03-31
**Status:** Draft
**Scope:** Core spec prose (new section), `formspec-lint` Rust crate, Python validator

## Problem

The Core specification defines two error classes in S3.10: **definition errors** (S3.10.1) which MUST halt processing, and **evaluation errors** (S3.10.2) which produce null and record diagnostics. There is a gap between these two classes: a definition can be structurally valid and internally consistent — passing all definition error checks — while containing bind combinations that produce behavior the author almost certainly did not intend. These are not errors: the processing model (S2.4) handles every bind combination deterministically. But they are strong signals of author confusion, and a conformant processor that can detect them SHOULD surface them.

Examples:
- A field marked `required: "true"` + `readonly: "true"` with no value source (`calculate`, `initialValue`, `prePopulate`) — the user can never fill it, and it will always fail required validation.
- A field with `prePopulate` + `calculate` — the pre-populated value is immediately overwritten by the calculate expression on the first recalculation cycle, making the pre-population pointless.
- A field with `required: "true"` + `readonly: "true"` + `calculate` — the required check is redundant because the calculate expression always produces a value (or null, which the author should fix in the expression, not via required).

These patterns are derivable from existing normative semantics (S2.1.4, S4.2.3, S4.3.1) but are not called out, and no existing spec language addresses "definition quality" as a category between hard errors and runtime validation.

## Proposed Spec Section: S3.10.3 Definition Advisories

The following normative prose would be added to the Core spec as section 3.10.3, immediately after the existing 3.10.2 (Evaluation Errors) and before 3.11 (Reserved Words). This introduces a third error class: definition advisories.

---

### 3.10.3 Definition Advisories

A **definition advisory** is a static analysis finding about a Definition document that does not indicate a structural or syntactic error, but identifies a bind combination whose runtime behavior is unlikely to match author intent. Definition advisories are distinct from definition errors (§3.10.1) in two critical ways:

1. A definition advisory MUST NOT halt processing. The Definition remains valid and the processing cycle (§2.4) proceeds normally.
2. A definition advisory MUST NOT affect the `valid` status of a lint or validation result. These findings are advisory — they inform the author, not the processor.

A conformant processor MAY detect and report definition advisories. When reported, each advisory MUST include a code, the bind path, a severity (`warning` or `info`), and a human-readable message.

The following definition advisories are defined by this specification:

#### DA-01: Required and Read-Only Without Value Source

A Bind that declares both `required` and `readonly` as effectively `true` — whether via literal `"true"` expressions or via expressions that are always true — without the targeted field having a value source, creates a field that the user cannot edit and that has no mechanism to receive a value.

A **value source** is any of the following:
- A `calculate` expression on any Bind targeting the same path
- An `initialValue` property on the targeted Item (§4.2.3)
- A `prePopulate` declaration on the targeted Item (§4.2.3)

> **Note:** The `default` Bind property (§2.1.4, §4.3.1) is intentionally excluded from this list. `default` only fires on relevance transitions (non-relevant to relevant), not on initial form load or Response creation. A field with `required: "true"`, `readonly: "true"`, and `default: "someValue"` will still be empty on first render — the `default` value is never assigned unless the field first becomes non-relevant and then becomes relevant again. This does not qualify as a reliable value source for the purposes of this advisory.

**Rationale.** Per §2.1.4, `readonly: "true"` means the field's value "MUST NOT be modified by user input." (Note: §4.3.1 uses the weaker "SHOULD NOT be modified by direct user input," but §2.1.4 is normatively stronger and takes precedence for the purpose of this advisory.) Per §4.3.1, `required: "true"` means the field "MUST have a non-empty value for the Response to pass validation." When both hold and no value source exists, the field will always produce a required-violation `ValidationResult` at the Revalidate phase (§2.4, Phase 3), and the user has no way to resolve it.

Processors SHOULD NOT emit this advisory when the `required` or `readonly` expression is dynamic (i.e., references field values), because the combination may be intentionally conditional. This check applies only when both expressions are statically determinable to be `true`.

> **Definition: statically determinable to be `true`.** An expression is *statically determinable to be `true`* if a processor can determine, without evaluating the expression against Instance data, that it will always produce `true`. The minimum floor for conformance is recognizing the literal string `"true"`. Processors MAY implement deeper analysis — for example, constant folding of expressions like `"1 = 1"` or `"true and true"` — but are not required to. Any expression containing a field reference (`$key`) is NOT statically determinable.

A conformant processor that detects this pattern SHOULD report it with severity `warning`.

#### DA-02: Pre-Population Overwritten by Calculate

A field that has both a `prePopulate` declaration (§4.2.3) and a `calculate` Bind targeting the same path results in the pre-populated value being overwritten on the first Recalculate cycle (§2.4, Phase 2). The pre-population is effectively dead code.

**Rationale.** Per §4.2.3, `prePopulate` is "Syntactic sugar: a processor MUST treat `prePopulate` as equivalent to an `initialValue` expression plus a `readonly` bind." Per §4.3.1, `calculate` "replaces the node's value on each recalculation cycle." The calculate expression always runs after initialization, overwriting whatever `prePopulate` set. The same reasoning applies when `initialValue` and `calculate` target the same field, though `initialValue` + `calculate` is a more plausible intentional pattern (setting a seed value for a calculation that may reference it via `$`).

A conformant processor that detects `prePopulate` + `calculate` on the same field SHOULD report it with severity `warning`. Processors MAY additionally report `initialValue` + `calculate` on the same field with severity `info` as a "verify intentional" advisory, since the combination is sometimes used deliberately.

> **Note on `prePopulate.editable`.** The `editable` flag on `prePopulate` (§4.2.3, default `true`) does not affect this analysis. DA-02 is about the *value* being overwritten by `calculate`, not about the readonly state of the field. Whether `editable` is `true` or `false`, the calculate expression replaces the pre-populated value on the first recalculation cycle regardless.

#### DA-03: Redundant Required on Calculated Read-Only Field

A field with `required: "true"`, `readonly: "true"` (or implicitly readonly via `calculate`), and a `calculate` Bind has a `required` check that is usually redundant. The `calculate` expression will produce a value on each recalculation cycle (or `null` on evaluation error per §3.10.2). In the common case, the `required` check is always satisfied. When the expression does produce `null`, it may be intentional (e.g., a conditional formula that deliberately yields null for certain inputs) or indicative of an expression bug. In either case, the correct response is typically to address the formula logic rather than to rely on `required` validation to catch it — but the `info` severity reflects that this pattern is not always a mistake.

**Rationale.** Per §4.3.1, a node with a `calculate` Bind is "implicitly `readonly` unless `readonly` is explicitly set to `"false"`." In the typical case, the field's value is entirely determined by its expression. If the expression always produces a non-empty value, `required` is always satisfied. If the expression sometimes produces `null` (due to upstream nulls or evaluation errors), the correct fix is to address the expression — adding `required` turns a symptom (null from a broken expression) into a validation error visible to the end user, which conflicts with the spirit of the design rationale in §3.10.2: "form users should not be punished for a Definition author's mistake." (Note: §3.10.2 addresses evaluation error handling specifically, not bind analysis. This is an analogical extension of that principle to the static analysis domain — the same user-protection rationale applies, but it is not a direct application of §3.10.2's normative text.)

A conformant processor MAY report this pattern with severity `info`.

---

## Lint Code Taxonomy

### Code Range Assignment

The W900 range is reserved for **bind consistency** advisories. This is a new range, positioned after the existing ranges:

| Range | Pass | Domain |
|-------|------|--------|
| E100 | 1 | Document type detection |
| E101 | 1b | JSON Schema validation |
| E200–E201 | 2 | Tree indexing, duplicate keys |
| E300–E302, W300 | 3 | Reference validation (paths, targets, optionSets) |
| E400 | 4 | FEL expression compilation |
| E500 | 5 | Dependency cycle detection |
| E600–E602 | 3b | Extension resolution |
| W700–W711, E710 | 6 | Theme validation |
| E800–E807, W800–W804 | 7 | Component validation |
| **W900–W902** | **8** | **Bind consistency advisories** |

### Code Definitions

| Code | Severity | Advisory | Summary |
|------|----------|----------|---------|
| W900 | warning | DA-01 | Required + readonly without value source |
| W901 | warning | DA-02 | prePopulate overwritten by calculate |
| W902 | info | DA-03 | Redundant required on calculated field |

### Pass Placement

Bind consistency checks require:
- The tree index from Pass 2 (to resolve item properties: `initialValue`, `prePopulate`)
- The bind-to-item path mapping from Pass 3 (to correlate binds with items)
- Optionally, expression compilation results from Pass 4 (to determine if `required`/`readonly` are statically `true`)

This makes Pass 8 the natural home — after all existing passes (1 through 7, including 1b and 3b) have completed, the bind consistency pass can cross-reference bind properties with item declarations.

## Severity Policy

### Warning (W900, W901)

The bind combination produces behavior the author almost certainly did not intend. In both cases, the Definition is valid and the processing model handles it deterministically, but the outcome (a permanently failing required check, or a silently discarded pre-population) has no plausible intentional use case.

Warning severity means:
- Reported in Runtime mode (default lint)
- Reported in Strict mode
- Suppressed in Authoring mode (this is a design requirement for the Rust implementation: W900-W902 must be added to the `suppressed_in` set for `LintMode::Authoring`, following the same pattern as W300 and W802 — these checks are noisy during active editing when the author may be mid-construction)
- NEVER affects the `valid` status of a lint result
- NEVER halts processing

### Info (W902)

The bind combination is technically correct and may occasionally be intentional, but indicates unnecessary complexity in the common case. An author who sees this diagnostic should verify the pattern is deliberate.

Info severity means:
- Reported in Runtime mode
- Reported in Strict mode
- Suppressed in Authoring mode (same design requirement as W900/W901 above)
- NEVER affects the `valid` status of a lint result
- NEVER halts processing

### Never Errors

These are NEVER errors. The processing model (S2.4) handles all bind combinations deterministically. A required + readonly field with no value source is not "broken" — it will simply always fail required validation, which is a perfectly valid (if almost certainly unintentional) state. Promoting these to errors would reject valid definitions and conflict with the spirit of §3.10.2's design principle that "form users should not be punished for a Definition author's mistake." (This is an analogical extension — §3.10.2 addresses runtime evaluation errors, but the same user-protection rationale applies to static analysis: an advisory that blocks the author's work is not advisory.)

## Migration Notes

### Spec Integration

1. **Section numbering.** Insert as §3.10.3, between §3.10.2 (Evaluation Errors) and §3.11 (Reserved Words). No renumbering needed — the new section fits naturally within the §3.10 Error Handling umbrella. Note: §3.10 is currently titled "Error Handling" but with the addition of definition advisories, its scope expands beyond errors to include non-error static analysis findings. The section should be retitled to **"Error Handling and Static Analysis"**, and the preamble updated accordingly (see item 2 below).

2. **Section preamble update.** The §3.10 preamble currently reads: "FEL distinguishes between two classes of errors: **definition errors** (detected at load time) and **evaluation errors** (detected at runtime during expression evaluation)." This needs updating to: "FEL distinguishes between three classes of findings: **definition errors** (detected at load time), **evaluation errors** (detected at runtime during expression evaluation), and **definition advisories** (static analysis findings about bind consistency)."

3. **Cross-references.** Add forward reference from §4.3.1 (Bind Properties) noting that certain bind combinations trigger definition advisories per §3.10.3. Specifically, add a note after the bind property table: "Certain combinations of bind properties, while individually valid, may produce unexpected runtime behavior. See §3.10.3 for definition advisories that detect common problematic patterns."

4. **Conformance.** Definition advisories are OPTIONAL to implement. They are not listed in the Core conformance requirements (§1.4.1) and need not be. A processor that does not detect or report advisories is still conformant. If a processor does report advisories, it MUST follow the severity and behavior constraints defined in §3.10.3.

### Schema Changes

**None required.** Definition advisories are a static analysis concept — they are findings *about* definitions, not structural elements *within* definitions. The `definition.schema.json` does not need modification. The lint diagnostic output structure (`LintDiagnostic` with code, severity, path, message) already accommodates these findings without schema changes.

If the project later formalizes a lint diagnostic schema, the W900 range should be documented there.

### Rust Implementation (`formspec-lint`)

1. **New module:** `crates/formspec-lint/src/bind_consistency.rs` — contains the three check functions.

2. **Pipeline integration:** Add Pass 8 in `lib.rs` after the existing definition passes (2-5), gated on `doc_type == DocumentType::Definition`:
   ```rust
   // Pass 8: Bind consistency advisories (W900/W901/W902)
   diagnostics.extend(bind_consistency::check_bind_consistency(doc, &tree_index));
   ```

3. **Authoring mode suppression:** Add W900, W901, W902 to the `suppressed_in` match arm for `LintMode::Authoring` in `types.rs`.

4. **Strict mode:** W900-W902 are NOT promoted to errors in strict mode (unlike W800/W802/W803/W804). They are advisory by spec definition. This is a deliberate difference from component compatibility warnings.

5. **Detection logic:**

   **W900 (required + readonly, no value source):**
   - First, **aggregate all bind properties per path** across all bind objects. Multiple binds may target the same path — one bind may declare `required` and another may declare `readonly`. The detection logic must merge these before checking combinations.
   - For each unique path with both `required` and `readonly` present (from any bind targeting that path):
     - Check if both are statically `"true"` (literal string). If either is a dynamic expression, skip.
     - Look up the path in the tree index. Find the corresponding item.
     - Check if the item has `initialValue` or `prePopulate`. If yes, skip.
     - Check if any bind has `calculate` targeting the same path. If yes, skip.
     - Emit W900.

   **W901 (prePopulate + calculate):**
   - Walk `$.items` recursively. For each field item with `prePopulate`:
     - Check if any bind has `calculate` and targets this item's path.
     - If yes, emit W901 at the bind's path.

   **W902 (required + readonly + calculate):**
   - Walk `$.binds[]`. For each bind with both `required` and `calculate`:
     - The field is implicitly readonly (§4.3.1). Check if `required` is statically `"true"`.
     - If yes, emit W902 at the bind's path.

6. **Pass number:** Use `pass: 8` for all W900-range diagnostics.

### Python Implementation

The Python validator (`src/formspec/validate.py`) and any future Python linter should implement the same three checks. The detection logic is identical. Python conformance tests should cover all three patterns plus the skip conditions (dynamic expressions, presence of value sources).

### Test Coverage

Each rule needs tests for:
- **Positive case:** the pattern is present and the advisory fires
- **Skip — dynamic expression:** `required` or `readonly` is a non-literal FEL expression (should not fire)
- **Skip — value source present:** `initialValue`, `prePopulate`, or `calculate` provides a value (W900 should not fire)
- **Skip — only prePopulate without calculate:** no advisory (W901 requires both)
- **Interaction with relevance:** a field that is conditionally non-relevant can still trigger the advisory (the advisory is about the static bind definition, not runtime state)
- **Repeat context:** binds targeting `group[*].field` paths should still be checked

## Open Questions

1. **Should `initialValue` + `calculate` get its own advisory?** The current proposal mentions it in the DA-02 rationale as "more plausible" but does not assign a code. It could be W903 at `info` severity. Deferred pending real-world usage data.

2. **Should dynamic expression analysis go deeper?** The current proposal only checks for literal `"true"` in W900/W902. A smarter analysis could detect `"1 = 1"` or `"true and true"` as effectively static. This is an implementation quality concern, not a spec concern — the spec says "statically determinable to be `true`" and leaves the depth of analysis to the processor.

3. **Should W900 fire when `required` is dynamic but `readonly` is static (or vice versa)?** The current proposal says no — if either is dynamic, the combination may be conditionally intentional. This is the conservative choice. Revisit if real-world false negatives are common.

## Architecture and Convergence Plan

### Implementation Convergence (A1)

The TypeScript implementation of definition advisories in `formspec-studio-core` (`buildDefinitionAdvisoryIssues`, `buildAdvisories`) is **transitional**. The long-term architecture is:

1. **Short-term (current):** TypeScript implementation in `studio-core` provides advisory detection for the Studio UI. This is a stopgap — it duplicates logic that belongs in the Rust `formspec-lint` crate.
2. **Long-term:** Advisory rules migrate to Rust as `formspec-lint` Pass 8, exposed via WASM. Studio calls the WASM-exposed Pass 8; the TypeScript implementation is deleted. This aligns with the project's architecture doctrine (CLAUDE.md): spec business logic lives in Rust crates, TypeScript is for orchestration and thin bridges to WASM.

The TS implementation MUST NOT diverge from the spec semantics defined in §3.10.3. When Rust Pass 8 ships, any behavioral differences between the TS and Rust implementations are bugs in the TS code.

### MCP Surface (A2)

**Short-term:** The `formspec_audit` MCP tool calls `project.diagnose()`, which runs the Rust linter (no Pass 8 yet). To surface advisories to AI agents before Rust Pass 8 ships, `formspec_audit` should import `buildDefinitionAdvisoryIssues` from `studio-core` and include the results in audit output.

**Long-term:** Rust lint Pass 8 powers both the Studio UI (via WASM) and the MCP audit tool (via `diagnose()`). The `studio-core` import is removed from `audit.ts` when the Rust implementation ships.

### Studio Authoring Mode (A3)

Studio runs definition advisories **continuously** — not deferred to save/check. This means authors will see advisories fire mid-construction, before they have finished configuring a field (e.g., they set `required: "true"` and `readonly: "true"` but haven't added the `calculate` expression yet). This mid-construction noise is an accepted tradeoff for immediate feedback.

The `LintMode::Authoring` suppression defined in the Severity Policy section applies to the **Rust linter pipeline** (CI, publish, batch validation), not to the Studio UI. Studio's real-time advisory display is a separate concern — it runs the TS `buildAdvisories` function on each render, outside the lint pipeline entirely.

### Mapping False Positives (A4)

Forms that use **mapping rules** (Mapping spec) for value population will see persistent W900 advisories on fields that are legitimately `required: "true"` + `readonly: "true"` but receive their values from mapping transforms rather than `calculate`/`initialValue`/`prePopulate`. The current advisory system has no visibility into mapping documents.

This is a known false positive. **Future work:** extend the value source check to inspect loaded mapping documents for rules targeting the field's path. A mapping rule that writes to the field would suppress W900, acting as an additional value source. Until that analysis is implemented, W900 advisories on mapping-populated fields should be understood as informational noise, not authoring errors.
