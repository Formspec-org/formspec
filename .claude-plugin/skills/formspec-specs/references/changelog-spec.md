# Changelog Specification Reference Map

> specs/registry/changelog-spec.md -- 260 lines, ~12K -- Companion: Version Changelog Format, Impact Classification

## Overview

The Changelog Specification defines a JSON document format for enumerating structural differences between two versions of a Formspec Definition. It supports automated migration generation, CI/CD impact gating, and human-readable release notes. The spec builds on Formspec v1.0 semver semantics (core spec S6.2) and migration objects (core spec S6.7), providing the bridge between version comparison and data migration.

## Section Map

### Front Matter, Introduction, and Document Schema (Lines 1-86)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Title | Formspec Changelog Format v1.0 | Title block with status (Draft), companion relationship to Formspec v1.0, and date (2025-07). | Draft, companion spec | Checking spec maturity or date |
| 1 | Introduction | Defines the purpose of a Changelog Document: automated tooling (migration generation, impact analysis, reviewer notifications), human review (structured release notes), and programmatic consumers (CI/CD gates that reject breaking changes on minor branches). States that terminology follows Formspec v1.0 and references S6.2 (semver) and S6.7 (migrations). | Changelog Document, migration generation, impact analysis, CI/CD gates | Understanding what changelogs are for, or why the format exists |
| BLUF | Bottom Line Up Front | Compact summary: a valid changelog requires `$formspecChangelog`, `definitionUrl`, `fromVersion`, `toVersion`, `semverImpact`, and `changes`. Impact classification drives migration planning and semver governance. Governed by `schemas/changelog.schema.json`. | Required fields, semver governance, changelog.schema.json | Quick orientation before deeper reading |
| 2 | Changelog Document Schema | Defines the top-level JSON object structure with all properties. Contains a generated schema-ref table from `schemas/changelog.schema.json` enumerating nine properties. States that `semverImpact` MUST equal the max impact across all changes (breaking->major, compatible->minor, cosmetic->patch). | `$formspecChangelog` (const "1.0"), `$schema`, `changes`, `definitionUrl`, `fromVersion`, `toVersion`, `generatedAt`, `semverImpact`, `summary` | Building or validating a changelog document, understanding required vs optional top-level fields |
| 2.1 | Example | Full JSON example of a changelog with a `removed` (breaking) and `added` (compatible) change, showing all top-level fields and two Change objects with `before`/`after`/`migrationHint`. Demonstrates version bump from 2.1.0 to 3.0.0 with semverImpact "major". | Example structure, `migrationHint: "drop"`, version bump, complete document shape | Seeing a complete changelog document in practice |

### Change Object (Lines 88-154)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3 | Change Object | Defines the schema for individual Change entries within the `changes` array. Nine properties: `type` (enum: added/removed/modified/moved/renamed), `target` (enum: item/bind/shape/optionSet/dataSource/screener/migration/metadata), `path` (dot-path to affected element), `key` (optional, the item key when target is "item"), `impact` (enum: breaking/compatible/cosmetic), `description` (recommended, human-readable), `before`/`after` (optional, previous/new value or structural fragment), `migrationHint` (optional, FEL expression or "drop" or "preserve"). | Change object, `type` enum, `target` enum, `impact` enum, `path`, `key`, `before`, `after`, `migrationHint` | Constructing or parsing individual change entries, understanding what each property means |
| 3.1 | Change Type Examples | Provides concrete JSON examples for all five change types. `added`: after only, phone field example. `removed`: before + migrationHint "drop", fax field example. `modified`: before + after with partial fragments (changed label only). `renamed`: key change with FEL hint (`$old.cost`), both before and after keys shown. `moved`: path change in before/after, salary field relocated between groups. | added (after only), removed (before + migrationHint), modified (before + after partial), renamed (key change + FEL hint), moved (path change in before/after) | Implementing a changelog generator or understanding what each change type looks like |

### Impact Classification Rules (Lines 156-194)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4 | Impact Classification Rules | Declares that a conformant generator MUST classify each change per the rules in subsections 4.1-4.3. Any change pattern not explicitly listed defaults to **cosmetic**. This is the normative classification framework. | Impact classification, conformance requirement, default-to-cosmetic rule | Implementing impact classification logic, or understanding why a change gets a certain severity |
| 4.1 | Breaking (-> major) | Enumerates 7 change patterns that MUST be classified as breaking: (1) item removed, (2) item key renamed, (3) dataType changed, (4) required constraint added to existing field, (5) repeat/non-repeat toggled, (6) itemType changed (e.g., group->field), (7) option removed from closed optionSet. Each includes rationale explaining why it invalidates stored responses. | Breaking changes, major version bump, stored response invalidation, structural incompatibility | Determining whether a change is breaking, understanding what constitutes a major version bump |
| 4.2 | Compatible (-> minor) | Enumerates 7 change patterns classified as compatible: (1) optional item added, (2) required item added with default, (3) option added to optionSet, (4) new shape added, (5) new bind added, (6) constraint relaxed (e.g., maxLength increased), (7) item moved between groups with key preserved. All are additive or non-destructive. | Compatible changes, minor version bump, additive changes, no data loss | Determining whether a change is compatible, understanding safe additive modifications |
| 4.3 | Cosmetic (-> patch) | Enumerates 6 change patterns classified as cosmetic: (1) label changed, (2) hint changed, (3) help changed, (4) description changed, (5) display order changed within a group, (6) shape property modified (e.g., width). All are display-only with zero data impact. | Cosmetic changes, patch version bump, display-only changes, presentation metadata | Determining whether a change is purely cosmetic with zero data impact |

### Generation Algorithm (Lines 196-217)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5 | Generation Algorithm | Defines the 8-step algorithm a conformant changelog generator MUST follow: (1) load both Definition versions, (2) index items by `key` (the stable identifier), (3) detect removals (key in old but not new), (4) detect additions (key in new but not old), (5) detect modifications (key in both, compare all properties, emit separate Change per differing property), (6) detect renames -- OPTIONAL heuristic matching unpaired removed/added keys sharing same dataType+structure+binds, (7) detect moves (key in both, parent path differs), (8) compute `semverImpact` as max(all change impacts). Steps 3-7 MUST be repeated for binds, shapes, optionSets, dataSources, and screeners using their respective identifiers. | Generation algorithm, key-based indexing, rename heuristic (same dataType + structure + binds), move detection (parent path change), semverImpact computation (max across changes), multi-target iteration | Implementing a changelog generator, understanding the diff algorithm, or debugging incorrect changelogs |

### Migration Relationship (Lines 219-249)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6 | Relationship to S6.7 Migrations | Explains that a Changelog Document with `migrationHint` entries on breaking changes provides sufficient information to auto-generate a S6.7 `migration` object. This is the bridge between changelog output and the Definition's migrations array. | Auto-generation, S6.7 migration objects, migrationHint-to-fieldMap translation | Understanding how changelogs feed into migration generation |
| 6.1 | Mapping Rules | Table mapping each change type + migrationHint combination to a generated `fieldMap` entry: `removed`/`"drop"` -> omit (value discarded); `removed`/`"preserve"` -> `{ "oldKey": "oldKey" }` (carry forward to extension data); `renamed` + FEL expression -> `{ "newKey": "$old.cost" }`; `modified` (dataType change) + FEL -> `{ "amount": "STRING($old.amount)" }` (coercion); `modified` (added required + default) + `"preserve"` -> `{ "field": "$old.field ?? 'default'" }` (fallback). | fieldMap generation, drop vs preserve, FEL coercion expressions (`STRING()`, `$old.field ?? 'default'`), extension data carry-forward | Implementing migration auto-generation, understanding what fieldMap entries look like for each scenario |
| 6.2 | Generation Procedure | 4-step procedure for converting a Changelog Document `C` into a migration object: (1) create migration shell `{ "fromVersion": C.fromVersion, "fieldMap": {} }`, (2) for each breaking change with migrationHint present -- skip if "drop", otherwise add `{ [change.key]: change.migrationHint }` to fieldMap, (3) for each renamed change add `{ [after.key]: migrationHint }` to fieldMap, (4) resulting migration is valid per S6.7 and insertable into the new Definition's migrations array. Includes advisory note that auto-generated migrations SHOULD be reviewed by a form author before deployment. | Migration generation procedure, fieldMap assembly, advisory review requirement, drop-means-skip | Implementing the migration generator, or understanding the exact algorithm for fieldMap construction |

### Media Type and File Extension (Lines 251-260)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7 | Media Type and File Extension | Defines the media type (`application/vnd.formspec.changelog+json`), file extension (`.changelog.json`), and naming convention (`{definitionSlug}-{fromVersion}..{toVersion}.changelog.json` using a double-dot version separator). Example: `grant-application-2.1.0..3.0.0.changelog.json`. | Media type, file extension `.changelog.json`, naming convention, double-dot version separator | File discovery, content-type headers, naming changelog files correctly |

## Cross-References

| Referenced Spec/Schema | Section | Context |
|------------------------|---------|---------|
| Formspec v1.0 S6.2 (Semver Semantics) | S1, S2, throughout | The changelog's `fromVersion`/`toVersion` are interpreted per the definition's `versionAlgorithm` (default: semver). The `semverImpact` field maps directly to semver bump levels (breaking->major, compatible->minor, cosmetic->patch). |
| Formspec v1.0 S6.7 (Migrations) | S1, S6, S6.1, S6.2 | Changelog `migrationHint` entries are designed to auto-generate S6.7 `migration` objects with `fieldMap` entries. The generated migration is insertable into the new Definition's `migrations` array. |
| `schemas/changelog.schema.json` | S2 (schema-ref table), BLUF | The generated schema-ref table in S2 is sourced from this schema. The BLUF section states this schema is the governing structural contract. |
| Definition `url` property | S2 | `definitionUrl` must match the definition's top-level `url` property. |
| Definition `versionAlgorithm` | S2 | Versions are interpreted per this property (default: semver). |

## Impact Classification Quick Reference

| Impact Level | Semver Bump | Default? | Trigger Patterns |
|---|---|---|---|
| **breaking** | major | No | Item removed, key renamed, dataType changed, required added to existing field, repeat/non-repeat toggled, itemType changed (group<->field), option removed from closed optionSet |
| **compatible** | minor | No | Optional item added, required item added with default, option added to optionSet, new shape/bind added, constraint relaxed, item moved (key preserved) |
| **cosmetic** | patch | YES (default for unlisted changes) | Label/hint/help/description changed, display order changed within group, shape property modified |

The `semverImpact` at the document level MUST equal the maximum impact: `breaking > compatible > cosmetic` maps to `major > minor > patch`.

## Change Type Quick Reference

| Type | `before` | `after` | `migrationHint` | Notes |
|------|----------|---------|-----------------|-------|
| `added` | absent | present | rare | New element; after contains full structural fragment |
| `removed` | present | absent | common | Element deleted; migrationHint says what to do with stored data |
| `modified` | present (partial) | present (partial) | when breaking | Changed property; before/after contain ONLY the changed properties, not the full item |
| `renamed` | present (old key) | present (new key) | FEL expression | Heuristically detected; migrationHint is a FEL ref like `$old.cost` |
| `moved` | present (old path) | present (new path) | rare | Key preserved, parent path differs |

## Critical Behavioral Rules

1. **Key is the stable identifier**: The generation algorithm indexes items by `key`, not by path or position. Keys are the identity anchor across versions. Path changes alone trigger `moved`, not `modified`.

2. **Rename detection is optional and heuristic**: Conformant generators MAY detect renames by matching unpaired removed/added keys that share the same `dataType`, child structure, and binds. This is explicitly marked as OPTIONAL (step 6). Generators that skip this will emit separate `removed` + `added` entries instead.

3. **Steps 3-7 repeat for ALL target types**: The algorithm is not just for items. It must be repeated for `binds`, `shapes`, `optionSets`, `dataSources`, and `screeners` using their respective identifiers. Missing this produces an incomplete changelog.

4. **Unlisted changes default to cosmetic**: Any change pattern not explicitly listed in S4.1 or S4.2 MUST be classified as cosmetic. This is a safe default that avoids false-positive breaking change alerts.

5. **`semverImpact` is computed, not declared**: The document-level `semverImpact` MUST equal the maximum impact across all entries in the `changes` array. A generator that lets authors set this independently is non-conformant.

6. **One Change per differing property for modifications**: Step 5 states the generator must emit a separate Change with `type: "modified"` for EACH differing property, not one Change per modified item. A label change and a dataType change on the same item produce two Change objects.

7. **`before`/`after` presence rules by change type**: `added` has `after` only; `removed` has `before` only; `modified`, `renamed`, and `moved` have both. For `modified`, these contain only the changed properties (partial fragments), not the full item.

8. **Migration generation only processes breaking changes with hints**: The S6.2 procedure only creates fieldMap entries for changes where `impact` is `"breaking"` AND `migrationHint` is present. Compatible and cosmetic changes are ignored. Renamed items are processed separately regardless of their impact.

9. **`"drop"` hint means no fieldMap entry**: When `migrationHint` is `"drop"`, the migration generator skips the entry entirely (the old value is discarded). This is distinct from `"preserve"`, which carries the old value forward into extension data via `{ "oldKey": "oldKey" }`.

10. **`"preserve"` on removed items carries data to extension storage**: The fieldMap entry `{ "oldKey": "oldKey" }` means the old value is kept but placed into extension/overflow data, not into a regular form field. This prevents data loss for fields that no longer exist in the new schema.

11. **Auto-generated migrations are advisory**: The spec explicitly states migrations SHOULD be reviewed by a form author before deployment. The `migrationHint` is advisory, not normative -- it is a suggestion for tooling, not a guarantee of correctness.

12. **`$formspecChangelog` is the version discriminator**: The top-level `$formspecChangelog` property MUST be the const string `"1.0"`. This is how processors identify a changelog document and its schema version, analogous to `$formspec` on Definitions and `$formspecRegistry` on Registry Documents.
