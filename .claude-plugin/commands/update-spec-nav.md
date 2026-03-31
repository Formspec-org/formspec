---
description: Launch a swarm of agents to update all spec/schema reference maps, then update SKILL.md
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [--specs-only | --schemas-only | --skill-only | spec-name]
---

Update the formspec-specs skill's reference maps and SKILL.md navigator.

## Step 1: Discover source files

Discover all canonical spec files and schema files that need reference maps.

**Specs** — scan `specs/` for `*.md` files, EXCLUDING `*.llm.md`, `*.bluf.md`, `*.semantic.md`:

```bash
find specs/ -name '*.md' ! -name '*.llm.md' ! -name '*.bluf.md' ! -name '*.semantic.md' | sort
```

**Schemas** — scan `schemas/` for `*.schema.json`:

```bash
ls schemas/*.schema.json
```

## Step 2: Build the mapping table

Map each source file to its reference target. Use these conventions:

### Spec reference mappings

The reference filename should match the spec filename. If the spec filename is generic (e.g., `spec.md`), prefix with the parent directory name. All reference files go in `.claude-plugin/skills/formspec-specs/references/`.

Known mappings (update if files have moved):

| Source | Reference Target |
|--------|-----------------|
| `specs/core/spec.md` | `references/core-spec.md` |
| `specs/theme/theme-spec.md` | `references/theme-spec.md` |
| `specs/component/component-spec.md` | `references/component-spec.md` |
| `specs/mapping/mapping-spec.md` | `references/mapping-spec.md` |
| `specs/fel/fel-grammar.md` | `references/fel-grammar.md` |
| `specs/registry/extension-registry.md` | `references/extension-registry.md` |
| `specs/registry/changelog-spec.md` | `references/changelog-spec.md` |

For any newly discovered specs not in this table, derive the reference filename from the spec filename (e.g., `specs/screener/screener-spec.md` → `references/screener-spec.md`).

### Schema reference mappings

Existing grouped schemas stay grouped. New schemas get individual reference files in `.claude-plugin/skills/formspec-specs/references/schemas/`.

Known mappings:

| Source Schema(s) | Reference Target |
|-----------------|-----------------|
| `definition.schema.json` | `schemas/definition.md` |
| `component.schema.json` | `schemas/component.md` |
| `core-commands.schema.json` | `schemas/core-commands.md` |
| `fel-functions.schema.json` | `schemas/fel-functions.md` |
| `mapping.schema.json` + `theme.schema.json` + `registry.schema.json` | `schemas/mapping-theme-registry.md` |
| `response.schema.json` + `validationResult.schema.json` + `validationReport.schema.json` + `changelog.schema.json` + `conformance-suite.schema.json` | `schemas/response-validation-changelog-conformance.md` |

For newly discovered schemas not in this table, create individual reference files (e.g., `screener.schema.json` → `schemas/screener.md`). Exception: if two schemas are clearly paired (e.g., `respondent-ledger.schema.json` + `respondent-ledger-event.schema.json`), group them.

## Step 3: Handle arguments

If `$ARGUMENTS` is provided:
- `--specs-only` → skip schemas, skip SKILL.md update
- `--schemas-only` → skip specs, skip SKILL.md update
- `--skill-only` → skip specs and schemas, only update SKILL.md
- Any other value → treat as a spec or schema name filter (e.g., `core` only updates core-related references)

If no arguments, update everything.

## Step 4: Launch the spec reference swarm

For each spec → reference mapping, launch a `formspec-specs:spec-reference-writer` agent **in parallel** using the Agent tool. Each agent gets this prompt:

```
Read the canonical spec at `{source path}` and generate/update the reference map at `{target path}`.

Source: {absolute source path}
Target: {absolute target path}
```

Launch ALL spec agents in a single message with multiple Agent tool calls so they run concurrently.

## Step 5: Launch the schema reference swarm

After the spec agents complete (or in parallel if independent), launch a `formspec-specs:schema-reference-writer` agent for each schema → reference mapping. Each agent gets this prompt:

For single-schema references:
```
Read the JSON schema at `{source path}` and generate/update the reference map at `{target path}`.

Source: {absolute source path}
Target: {absolute target path}
Type: single-schema
```

For multi-schema (grouped) references:
```
Read the following JSON schemas and generate/update the grouped reference map at `{target path}`.

Sources:
- {absolute source path 1}
- {absolute source path 2}
- ...

Target: {absolute target path}
Type: multi-schema
```

Launch ALL schema agents in a single message with multiple Agent tool calls so they run concurrently.

## Step 6: Update SKILL.md

After ALL spec and schema reference agents have completed, launch a single `formspec-specs:skill-updater` agent:

```
All specification and schema reference maps have been updated. Read all reference files and update SKILL.md to reflect the current state.

Reference directories:
- Spec references: .claude-plugin/skills/formspec-specs/references/*.md
- Schema references: .claude-plugin/skills/formspec-specs/references/schemas/*.md
- SKILL.md: .claude-plugin/skills/formspec-specs/SKILL.md
```

## Step 7: Report results

After all agents complete, report:
- How many spec references were updated/created
- How many schema references were updated/created
- Whether SKILL.md was updated
- Any errors or issues from individual agents
