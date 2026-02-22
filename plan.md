# Single Source of Truth for Formspec Specifications

## Objective
Make the full `*.md` specs the only hand-edited source of truth, with `*.llm.md` generated automatically and reproducibly.

## Decision
Use **AST-based markdown extraction** (not regex text stripping). Section omission will be explicit and heading-scoped so generated output is deterministic and reviewable.

## Extraction Contract
1. Source files: `specs/**/*.md` excluding `*.llm.md` and `spec-part*.md`.
2. Omission marker: `<!-- llm:omit -->` immediately under a heading. When present, that heading and its full section subtree are omitted from generated `*.llm.md`.
3. Required section: every canonical spec keeps a `## Quick Reference` section in the main file. This section is always included in generated output.
4. Output path: `<source>.llm.md` adjacent to source file.
5. Generator must preserve heading order and normative rules exactly for included sections.

## Implementation Plan

### Phase 1: Tooling
1. Create `scripts/generate-llm-specs.mjs`.
2. Parse markdown to AST (`remark` + `mdast` ecosystem), remove omitted heading subtrees, then stringify.
3. Add stable output formatting to avoid noisy diffs.
4. Add package scripts in root `package.json`:
   - `"docs:generate": "node scripts/generate-llm-specs.mjs"`
   - `"docs:check": "node scripts/generate-llm-specs.mjs --check"`
5. Add required dependencies for the generator (`remark-parse`, `remark-stringify`, `unist-util-visit` or equivalent).

### Phase 2: Content Migration (per spec)
For each existing hand-authored `*.llm.md`:
1. Compare against canonical `*.md`.
2. Move valuable dense summaries/rules into canonical `*.md` under `## Quick Reference` (or another explicit normative section).
3. Mark verbose non-normative sections in canonical `*.md` with heading-level `<!-- llm:omit -->`.
4. Run `npm run docs:generate`.
5. Review diff versus previous `*.llm.md` and confirm no normative requirements were dropped.

Execution order:
1. Small specs:
   - `specs/registry/changelog-spec.md`
   - `specs/registry/extension-registry.md`
   - `specs/theme/theme-spec.md`
2. Medium specs:
   - `specs/fel/fel-grammar.md`
   - `specs/mapping/mapping-spec.md`
3. Large specs:
   - `specs/component/component-spec.md`
   - `specs/core/spec.md`

### Phase 3: Validation and Enforcement
1. Add CI job step to run `npm run docs:check` and fail on drift.
2. Keep `npm test` in validation pipeline to catch downstream doc-fixture coupling.
3. Add a short maintainer note in `agents.md` and `CLAUDE.md`:
   - Edit canonical `*.md` only.
   - Never hand-edit generated `*.llm.md`.

## Acceptance Criteria
1. `npm run docs:generate` produces all `*.llm.md` with no manual edits required.
2. `npm run docs:check` fails whenever generated files are stale.
3. At least one migrated spec in each complexity group passes side-by-side normative review.
4. Generated `*.llm.md` files are materially smaller while retaining all normative constraints.

## Risks and Mitigations
1. Risk: parser/stringifier alters markdown formatting unexpectedly.
   - Mitigation: pin formatter behavior and review initial diffs spec-by-spec.
2. Risk: teams misuse omission markers and hide normative content.
   - Mitigation: require normative review checklist during migration PRs.
3. Risk: drift reappears through manual edits.
   - Mitigation: CI-enforced `docs:check` and guidance updates.
