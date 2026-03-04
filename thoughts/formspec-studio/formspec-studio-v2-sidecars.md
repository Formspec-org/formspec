# Formspec Studio V2 Sidecars — Mappings + Changelog/History

This document covers the “sidecar” artifacts that are still edited *in-context* (inline in Properties + global drawers), but are planned separately from the core Definition/Presentation work:
- **Mappings** (`schemas/mapping.schema.json`)
- **Changelog / History** (`schemas/changelog.schema.json`)

Core plan (definition/theme/component + extensions import): [`formspec-studio-v2-plan.md`](formspec-studio-v2-plan.md)

---

## Hard Constraints (Inherited)

1. Packages-first: mapping execution/diagnostics belong in `packages/` (not Studio).
2. Low/no-code first: the guided UI is the primary workflow; raw JSON is “Advanced”.
3. Schemas in `schemas/` are the source of truth.

---

## Delivery Method (Sidecars): Red/Green/Refactor

Sidecar work (mappings/history) should follow the same Fowler-style refactoring discipline as the core plan:

1. Add characterization tests for current behavior before restructuring document stores or UI surfaces.
2. Implement new sidecar drawers/inline sections behind small, test-proven slices.
3. Prefer tests at the boundary users feel:
   - Playwright for mapping/history workflows
   - unit tests for rule editing, serialization, schema validation

Test locations:
- Studio: `form-builder/src/__tests__/*.test.tsx`
- E2E: `tests/e2e/playwright/studio/*.spec.ts`
- Packages (mapping execution): `packages/formspec-engine/tests/*.test.mjs`

---

## Known Gaps (Must Be Resolved In Packages)

The current `packages/formspec-engine` `RuntimeMappingEngine` implementation is not yet aligned with the Mapping DSL described by `schemas/mapping.schema.json` (path syntax, transform coverage, conditions, arrays, bidirectional overrides, etc.). V2 mapping UX assumes:

- Studio only edits schema-valid mapping documents.
- Mapping execution and diagnostics come from `packages/formspec-engine` and conform to the mapping schema.

Bringing the engine into conformance is a prerequisite for any “execute mapping / preview payload” features.

---

## Version Model (One Active, Older Immutable)

- Studio has **one active Definition version** that is editable.
- Older versions may exist in the project as **read-only immutable snapshots** (for diff/history, changelog anchoring, and mapping compatibility reasoning).
- Changelog and mappings always refer to definition identity via `definitionUrl`/`definitionRef` and version strings/ranges; Studio must surface compatibility clearly.

---

## Mappings (N Documents, Field-Centric Authoring)

### What mappings are for

A mapping document describes transformation between a Formspec Response and an external schema (JSON/XML/CSV), per `schemas/mapping.schema.json`.

### Non-technical UX principle

Authors should think in terms of:
- “This form field goes to that destination field”
- “Transform it (format, map codes, compute, drop)”

They should not have to think in terms of `sourcePath`/`targetPath` unless they open Advanced.

### UI Surfaces

1. **Inline (Field Properties → Mappings)**
   - Show mappings that involve the selected field.
   - Allow adding multiple rules per field per mapping (N rules, different targets).
   - Default path: “Copy as-is” (preserve) with a destination picker.

2. **Global (Mappings Drawer)**
   - List mapping documents.
   - Filterable rule table (by source field, destination, transform, format).
   - Clicking a rule navigates back to the source field selection and expands the inline mapping section.

### Guided “Create Mapping” flow (schema-valid by construction)

Because mapping schema requires top-level metadata (`version`, `definitionRef`, `definitionVersion`, `targetSchema`, `rules`), Studio should provide a wizard that:
- Picks output format (`targetSchema.format`) and optional name/URL info
- Pins the mapping to the active definition identity (`definitionRef = definition.url`)
- Sets a default compatibility range (`definitionVersion = >=<current> <nextMajor>` or a conservative exact match, depending on your governance choice)
- Creates an initial rule from the currently selected field (optional)

Advanced JSON editing remains available, but newly created mappings should pass schema validation immediately.

### Diagnostics

- Schema validation (AJV) for the mapping document.
- Cross-document validation:
  - `definitionRef` matches active definition `url`.
  - Mapping rules reference existing fields when a `sourcePath` is present (constants and target-only rules are allowed by schema).
  - Mapping format constraints (e.g., CSV restrictions) surfaced as warnings/errors.
- Execution diagnostics should come from `packages/formspec-engine` mapping APIs (not Studio reimplementation).

---

## Changelog / History (Immutable-Aware)

### What changelog is for

A changelog document enumerates differences between two definition versions (`fromVersion` → `toVersion`) per `schemas/changelog.schema.json`.

### UI Surfaces

1. **Inline (Field Properties → History)**
   - Show changelog entries that touch the selected field/path (if a relevant changelog is loaded).
   - Show impact and migrationHint in plain language first; raw paths in Advanced.

2. **Global (History Drawer)**
   - List changelog documents for the active definition URL.
   - Diff viewer for `fromVersion` vs `toVersion`.
   - “What changed in this release?” summary for non-technical review/approval.

### Version creation (ties into core plan)

When Studio creates a new version:
- The previous version becomes immutable/read-only.
- A changelog can be authored or generated as a release artifact (generation can be deferred).

---

## Phasing (Sidecars)

1. **Sidecars Phase 1:** Document store for N mappings + N changelogs, plus drawers + schema validation.
2. **Sidecars Phase 2:** Inline mapping editor (field-centric) + global rule table navigation.
3. **Sidecars Phase 3:** History drawer + inline field history; changelog viewing first, generation later.
4. **Sidecars Phase 4 (optional):** Mapping execution preview (sample response in, payload out) using package APIs.

### Sidecars Testing Checklist (Per Phase)

- Phase 1:
  - Unit tests: importing mapping/changelog JSON produces schema-valid documents and stable IDs.
  - E2E: open mappings drawer, create mapping doc, see it listed.
- Phase 2:
  - Unit tests: “add mapping rule from field” produces correct `rules[]` entry (schema-valid).
  - E2E: select field → add rule → global table shows it → click navigates back to field.
- Phase 3:
  - Unit tests: changelog filters correctly by field/path.
  - E2E: pick changelog → diff renders → clicking entry selects field.

---

## Sidecars Acceptance Criteria

1. A non-technical author can create a mapping and map several fields without touching JSON or writing paths.
2. A field can have multiple mapping rules across multiple mapping documents (visible inline and globally).
3. Changelog viewing can answer “what changed between X and Y” and “what happened to this field” using immutable prior versions.
4. Mapping/changelog diagnostics are understandable, actionable, and attributed to schema vs engine execution.
