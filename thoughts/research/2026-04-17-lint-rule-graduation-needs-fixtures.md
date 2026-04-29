# Lint rule graduation requires triggering fixtures

**Date:** 2026-04-17
**Status:** Informational — follow-up work scoped
**Related:** TODO #26 (populate draft metadata), commit `42004918` (new registry assertion)

## What just happened

All 29 draft rules in `specs/lint-codes.json` now carry a `specRef` and a
`suggestedFix`. They remain at `state: "draft"`. Only 8 rules are at
`state: "tested"` (E101, E300, E500, E600, W300, W704, W800, W802) — the set
inherited from the prior work in TODO #25.

## Why we did not flip all 29 to `tested`

Commit `42004918` (TODO #25) added
`test_every_tested_rule_has_at_least_one_triggering_fixture` in
`tests/unit/test_lint_rule_registry.py`. It enforces, for every rule at
`state: "tested"` or `"stable"`:

1. `fixtures` MUST be a non-empty list of repo-relative paths.
2. Each path MUST exist under `tests/fixtures/lint/`.
3. Parsing the fixture and running `formspec._rust.lint(...)` MUST emit the
   rule's `code`.
4. The emitted `spec_ref` MUST equal the registry's `specRef`.
5. The emitted `suggested_fix` MUST equal the registry's `suggestedFix`.

Graduating a draft rule to `tested` without supplying a fixture breaks
CI immediately. The original scout plan said "flip all 29 to tested" — that
would have landed 29 failing assertions. Metadata-first / fixtures-later is
the only viable sequencing.

## Sequencing for follow-up PRs

To graduate any draft rule:

1. Author a minimal fixture under `tests/fixtures/lint/<CODE>-<slug>.json`
   that triggers exactly that rule.
2. Confirm the Rust emission site sets `spec_ref` and `suggested_fix` using
   the registry string (via the `metadata_for(...)` helper in
   `crates/formspec-lint/src/metadata.rs`). If the emission site still
   hardcodes strings, switch it to the registry lookup.
3. List the fixture under `rules[*].fixtures` in `specs/lint-codes.json`.
4. Flip `state` to `"tested"`.
5. Run `python3 -m pytest tests/unit/test_lint_rule_registry.py -v` and
   `cargo nextest run -p formspec-lint`.

Recommended graduation order (smallest blast radius first):

- **Single-pass structural rules**: E200, E201, E301, E302, E710 — each
  fireable from a minimal JSON document with no paired artifacts.
- **FEL parse failures**: E400 — one fixture with a syntactically broken
  expression is enough.
- **Theme token value checks**: W700/W701/W702/W703/W708/W709 — one fixture
  per rule with a malformed token value.
- **Theme pairing rules**: W705/W706/W707/W711 — each needs a theme +
  paired definition; mirror the `_pairedDefinition` convention already used
  for W800 and W802 fixtures.
- **Component rules**: E800/E801/E802/E803/E804/E806/E807/W801/W803/W804 —
  several of these need paired definitions too.
- **Extension lifecycle**: E601/E602 — need a registry fixture or inline
  extension registry to resolve against.

## Known semantic divergence — W803/W804 Rust vs. Python

Flagged by the scout during TODO #26 diagnosis. Documented in-source at
`crates/formspec-lint/src/pass_component.rs:1133-1140`.

In the Rust linter (`formspec-lint`):

- **W803** currently titled "Non-input component has bind" in the registry.
  The normative spec clause it cites, Component §4.3 *Editable Binding
  Uniqueness*, actually describes duplicate-editable-bind detection. The
  registry `suggestedFix` I installed ("keep only one editable input bound
  to each field — move extra inputs to a different field") matches that
  spec clause, not the current Rust title.

- **W804** currently titled "Custom component reference unresolved". Same
  mismatch — the cited spec clause is Component §4.3, and the installed
  `suggestedFix` talks about duplicate binds, not custom-component
  resolution.

In the Python linter (`src/formspec/validator/`):

- **W804** means "unresolved Summary/DataTable bind" — a third, unrelated
  semantic.

**Recommendation before graduating W803 or W804:**

1. Decide which semantic each code should carry (propose: align with the
   registry `suggestedFix` I installed, since the spec clause supports it).
2. Update the Rust `title` in `specs/lint-codes.json` to match.
3. If the Rust-only "non-input has bind" and "custom component unresolved"
   checks are still useful, assign them NEW codes (e.g. W805, W806) rather
   than overloading W803/W804.
4. If the Python-side "unresolved Summary/DataTable bind" check survives,
   give it a new code too — W804 cannot mean three different things.

This cleanup should land in the same PR that graduates W803/W804 to
`tested`, with fixtures that exercise whatever semantic wins.

## Anchor drift found during TODO #26

One entry in the scout's original mapping did not resolve:

- **E601 / E602** → requested anchor `specs/registry/extension-registry.md#63-status-lifecycle`.
  That section does not exist. The normative clause is Section 6
  "Extension Lifecycle" with no subsections. I used the correct anchor
  `#6-extension-lifecycle` for both rules. All other 27 anchors in the
  mapping resolved exactly.
