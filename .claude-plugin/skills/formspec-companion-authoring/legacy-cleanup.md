# Formspec-Org Legacy Cleanup Tasks

Items where existing specs or schemas diverge from the current style guide conventions. These should be corrected when the affected files are next revised — not as a dedicated cleanup pass.

## Schema Cleanup

### `$id` pattern inconsistencies

Standard: `https://formspec.org/schemas/[name]/1.0`

| Schema | Current `$id` | Fix |
| --- | --- | --- |
| `mapping.schema.json` | `.../mapping/v1` | Change to `.../mapping/1.0` |
| `changelog.schema.json` | `.../changelog/v1` | Change to `.../changelog/1.0` |
| `response.schema.json` | `.../response.schema.json` | Change to `.../response/1.0` |

### File naming: camelCase → hyphen-case

Standard: `[hyphen-case].schema.json`

| Current | Fix |
| --- | --- |
| `validationResult.schema.json` | `validation-result.schema.json` |
| `validationReport.schema.json` | `validation-report.schema.json` |
| `conformanceSuite.schema.json` | `conformance-suite.schema.json` (if exists) |
| `felFunctions.schema.json` | `fel-functions.schema.json` (if exists) |
| `coreCommands.schema.json` | `core-commands.schema.json` (if exists) |

### Extension model: `patternProperties` → `extensions` property

Standard: Use a dedicated `extensions` property at the document level.

| Schema | Current Pattern | Fix |
| --- | --- | --- |
| `component.schema.json` | Top-level `patternProperties: { "^x-": {} }` | Add `extensions` property, remove top-level `patternProperties` |
| `ontology.schema.json` | Top-level `patternProperties` | Same |
| `references.schema.json` | Top-level `patternProperties` | Same |
| `mapping.schema.json` | Top-level `patternProperties` | Same |

## Spec Cleanup

### Missing YAML frontmatter

Standard: All specs MUST have YAML frontmatter (`title`, `version`, `date`, `status`).

| Spec | File |
| --- | --- |
| Theme | `specs/theme/theme-spec.md` |
| Component | `specs/component/component-spec.md` |
| Screener | `specs/screener/screener-spec.md` |
| Mapping | `specs/mapping/mapping-spec.md` |
| Extension Registry | `specs/registry/extension-registry.md` |
| Changelog | `specs/registry/changelog-spec.md` |
| Respondent Ledger | `specs/audit/respondent-ledger-spec.md` |
| Locale | `specs/locale/locale-spec.md` |

### Appendix separator: em-dash → colon

Standard: Use colon (e.g., `Appendix A: Title`).

Affected specs should be updated when next revised. Not worth a dedicated pass.

### References format: inline → appendix table

Standard: Use appendix table for specs with >5 references.

The Core spec uses inline link definitions. This is acceptable as a grandfathered pattern given Core's size and structure.
