---
name: formspec-specs
version: 1.1.0
description: This skill should be used when the user asks about "the spec", "spec sections", "how does formspec define X", "what section covers Y", "cross-tier behavior", "FEL grammar", "validation rules", "component binding", "theme cascade", "mapping transforms", "extension registry", "screener routing", "assist protocol", "respondent ledger", "references document", "locale document", "ontology binding", "schema structure", "what properties does X have", "JSON schema for Y", or any question requiring knowledge of the Formspec specification suite or JSON schemas. Also triggers on implementation questions where normative spec behavior matters -- processing model phases, null propagation, bind semantics, slot resolution, screener evaluation pipeline, determination records, version migrations, locale fallback, concept alignment, schema validation constraints, etc.
---

# Formspec Specification Navigator

Navigate 18.7K lines of specification content and 10.1K lines of JSON schemas without loading everything into context. This skill provides structured section maps, schema reference maps, cross-reference guides, and decision trees for finding the right spec section or schema property quickly.

## Specification Architecture

Formspec uses a **three-tier architecture** with companion and add-on specifications:

```
┌─────────────────────────────────────────────────────┐
│ Tier 3: Components (component-spec.md, 3521 lines)  │  Explicit rendering tree
│   35 component types, slot binding, responsive       │  Overrides Tier 1 & 2
├─────────────────────────────────────────────────────┤
│ Tier 2: Theme (theme-spec.md, 1167 lines)           │  Presentation intent
│   Design tokens, widget catalog, selector cascade    │  Overrides Tier 1
├─────────────────────────────────────────────────────┤
│ Tier 1: Core (spec.md, 4729 lines)                  │  Data & logic
│   Items, binds, FEL, validation, versioning          │  Baseline behavior
├─────────────────────────────────────────────────────┤
│ Companions:                                          │
│   FEL Grammar (395 lines) — Normative PEG grammar   │
│   Mapping DSL (2023 lines) — Bidirectional transforms│
│   Extension Registry (584 lines) — Extension system  │
│   Changelog (260 lines) — Version change format      │
│   Screener (1508 lines) — Respondent routing         │
│   Assist (801 lines) — Form-filling interop protocol │
│   References (697 lines) — Sidecar external context  │
│   Locale (1253 lines) — Internationalization         │
│   Ontology (782 lines) — Semantic concept binding    │
├─────────────────────────────────────────────────────┤
│ Add-On:                                              │
│   Respondent Ledger (969 lines) — Audit trail        │
└─────────────────────────────────────────────────────┘
```

**Precedence rule**: Tier 3 > Tier 2 > Tier 1. Each higher tier can override lower-tier presentation behavior. Companions and add-ons are additive -- they MUST NOT alter core processing semantics.

## Quick Decision Tree -- Which Spec?

| Topic | Read This | Section |
|-------|-----------|---------|
| Item structure, data types, groups | Core spec | S4.2 Item Schema |
| Bind expressions (required, relevant, calculate, constraint, readonly) | Core spec | S4.3 Bind Schema |
| FEL syntax, operators, functions | Core spec S3 + FEL Grammar | S3.1-3.12 + full grammar |
| Validation shapes, severity, constraint kinds | Core spec | S5.1-5.7 |
| Processing model (rebuild/recalculate/revalidate/notify) | Core spec | S2.4 |
| Inline screener routing (legacy) | Core spec | S4.7 |
| Versioning, migrations, response pinning | Core spec | S6.1-6.7 |
| Design tokens, color/spacing/typography | Theme spec | S3.1-3.5 |
| Widget catalog and configuration | Theme spec | S4.1-4.4 |
| Selector cascade (defaults -> selectors -> overrides) | Theme spec | S5.1-5.6 |
| Page layout, 12-column grid, regions | Theme spec | S6.1-6.5 |
| Component tree structure, children ordering | Component spec | S3.1-3.5 |
| Slot binding, bind resolution, dataType compatibility | Component spec | S4.1-4.6 |
| Any specific built-in component | Component spec | S5 (Core) or S6 (Progressive) |
| Custom components, param interpolation | Component spec | S7.1-7.5 |
| Conditional rendering (`when` vs `relevant`) | Component spec | S8.1-8.4 |
| Responsive breakpoints, mobile-first merge | Component spec | S9.1-9.4 |
| Cross-tier token cascade | Component spec | S10.1-10.5 |
| Data transforms (expression, coerce, valueMap, etc.) | Mapping spec | S4.1-4.13 |
| Bidirectional/reverse mapping | Mapping spec | S5.1-5.6 |
| Format adapters (JSON, XML, CSV) | Mapping spec | S6.1-6.5 |
| Extension publishing, discovery, resolution | Extension Registry | Full doc |
| Version changelogs, impact classification | Changelog spec | S3-S6 |
| Standalone screener, evaluation pipeline, strategies | Screener spec | S3-S8 |
| Override routes, safety-critical classification | Screener spec | S5 |
| Determination records, evaluation output | Screener spec | S9 |
| Screener lifecycle, availability, result validity | Screener spec | S10 |
| Form-filling interop, assist providers/consumers | Assist spec | S2-S3 |
| Introspection, help, mutation, validation tools | Assist spec | S4-S7 |
| Autofill profiles, ontology-concept-driven | Assist spec | S8 |
| Transport bindings (JSON-RPC, MCP, REST) | Assist spec | S10 |
| Respondent audit trail, event taxonomy | Respondent Ledger | S3-S5 |
| Materiality rules, change set entries | Respondent Ledger | S6 |
| Ledger integrity, checkpoints, deployment profiles | Respondent Ledger | S8-S10 |
| Sidecar references, external documentation | References spec | S2-S4 |
| Agent data stores, vector store URIs | References spec | S5-S6 |
| Reference composition, multi-document merge | References spec | S7 |
| Locale documents, i18n string keys | Locale spec | S2-S4 |
| FEL interpolation in localized strings | Locale spec | S5 |
| Locale fallback cascade, resolution | Locale spec | S6 |
| Locale FEL functions (locale, formatNumber, formatDate) | Locale spec | S7 |
| Ontology concept bindings, semantic types | Ontology spec | S2-S3 |
| Vocabulary bindings, option set alignment | Ontology spec | S4 |
| Cross-system alignments, linked data export | Ontology spec | S5-S6 |
| Ontology resolution cascade | Ontology spec | S7 |

## File Types in specs/

| Suffix | Purpose | Normative? | When to Read |
|--------|---------|------------|--------------|
| `.md` | Canonical specification | **Yes** | Authoritative source for any behavioral question |
| `.llm.md` | Generated LLM reference | No | Quick context loading -- compact summaries, auto-generated |
| `.bluf.md` | Bottom-line summary | No | 4-line essence of each spec, injected into canonical |
| `.semantic.md` | Semantic capsule | No | Conformance-oriented summary |

**Strategy**: Start with `.llm.md` for orientation. Consult canonical `.md` when precise behavioral semantics matter.

## Cross-Tier Interaction Points

These are the key places where specifications reference each other:

1. **Token Cascade** (Component S10 <- Theme S3): Components inherit design tokens from Theme. Unresolved tokens handled per S10.4.
2. **Widget Config** (Component S5-6 <- Theme S4): Theme's widget catalog provides typed configuration consumed by component rendering.
3. **Bind Compatibility** (Component S4.6 <- Core S4.3): Component slot binding checked against Definition item data types. See compatibility matrix in Component Appendix C.
4. **Conditional Logic** (Component S8 vs Core S4.3 relevant): Component `when` controls rendering visibility; Core `relevant` controls data relevance. Both use FEL but have different semantics -- `relevant=false` excludes from response, `when=false` only hides visually.
5. **Responsive Design** (Component S9 <- Theme S6.4): Component breakpoints merge with Theme layout breakpoints using mobile-first strategy.
6. **Processing Model** (Core S2.4): All tiers depend on the 4-phase processing model -- Rebuild -> Recalculate -> Revalidate -> Notify.
7. **Extension Resolution** (All tiers <- Extension Registry): Extensions declared on items resolve against loaded registry entries. Unresolved = error.
8. **Mapping <-> Core Versioning** (Mapping Appendix A <-> Core S6.7): Version migrations can generate mapping rules; mapping rules can produce migrations.
9. **Screener -> Definition Routing** (Screener S6 -> Core S4): Screener routes target Definitions by URL. The Screener's items reuse Core Item/Bind schemas but run in an isolated evaluation scope.
10. **Assist -> Core + References + Ontology** (Assist S4-S8): Assist introspection reads Core Definition state; help tools consume References sidecar content; autofill profiles use Ontology concept identity for cross-form value matching.
11. **Locale -> Core + Theme + Component** (Locale S4): Locale string keys address Core item labels/choices, Theme page titles, and Component node text via `$page.` and `$component.` prefixes.
12. **Ontology -> Core + Registry** (Ontology S7): Ontology resolution cascade layers concept bindings over registry concept entries and raw `semanticType` values from Core items.
13. **References -> Core** (References S2): References Document targets a Definition by URL and binds external resources to items by path. Pure metadata -- no behavioral effect.
14. **Respondent Ledger -> Core Response** (Ledger S2): Ledger references a Response by `responseId` and pins a Definition by `(definitionUrl, definitionVersion)` tuple. Additive audit layer.

## Critical Behavioral Rules (Cross-Spec)

- **`relevant=false` suppresses validation**: Non-relevant fields skip required/constraint checks (Core S5.6)
- **Tier precedence is absolute**: Tier 3 component tree overrides Theme layout, which overrides Definition formPresentation hints
- **FEL null propagation**: Most operations with null return null (Core S3.8). Exceptions: `coalesce()`, `if()`, null-check operators
- **Processing model is synchronous 4-phase**: No partial updates. Rebuild -> Recalculate -> Revalidate -> Notify, always in order (Core S2.4)
- **Pages are theme-tier**: Page layout lives in Theme (S6), not in Definition. Definition only has advisory `formPresentation`
- **Component `when` vs bind `relevant`**: `when=false` hides but keeps data; `relevant=false` hides AND excludes from response (Component S8.2)
- **Screener evaluation is isolated**: Screener items/binds do NOT interact with any Definition's data or bind scope (Screener S3.3)
- **Override routes are hoisted**: Override routes evaluate before all phases and can halt the pipeline (Screener S5)
- **Determination records are immutable**: Once produced, evaluation data is never modified; only status can transition `completed` -> `expired` (Screener S9)
- **Assist is additive**: Assist MUST NOT change core response, validation, calculation, or relevance semantics (Assist S1)
- **Respondent Ledger is additive**: The canonical Response remains the source of truth; ledger replay is never required to interpret a Response (Ledger S2.2)
- **References are pure metadata**: References MUST NOT affect data capture, validation, or the processing model (References S1.1)
- **Locale is presentation-only**: Locale Documents MUST NOT affect data collection, validation logic, or behavioral semantics (Locale S1.2)
- **Ontology bindings are pure metadata**: Ontology MUST NOT alter core behavioral semantics -- required, relevant, readonly, calculate, validation (Ontology S1)

## JSON Schemas -- Co-Authoritative with Specs

The `schemas/` directory contains 18 JSON Schema files (10130 lines total). Schemas and specs are **co-authoritative** -- neither is assumed more correct than the other:

- **Schemas** define structural truth: what properties exist, their types, required fields, enums, patterns, constraints.
- **Specs** define behavioral truth: processing semantics, evaluation order, null handling, precedence, error behavior.

**When researching any question, always check BOTH the spec and corresponding schema.** If they disagree -- a property the spec calls required isn't in the schema's `required` array, or the schema allows values the spec prohibits -- that is an inconsistency to surface, not silently resolve.

| Schema | Lines | Defines |
|--------|-------|---------|
| `definition.schema.json` | 1729 | Core form definition -- items, binds, instances, variables, screener |
| `component.schema.json` | 1490 | Component tree -- 35 component types, slot binding, responsive |
| `core-commands.schema.json` | 1220 | Programmatic commands for form manipulation |
| `fel-functions.schema.json` | 994 | FEL standard library -- function signatures across 9 categories |
| `mapping.schema.json` | 817 | Mapping DSL -- transforms, adapters, bidirectional rules |
| `theme.schema.json` | 658 | Theme document -- tokens, widgets, selectors, pages, layout |
| `registry.schema.json` | 647 | Extension registry -- entries, publishers, lifecycle |
| `ontology.schema.json` | 429 | Ontology document -- concept bindings, vocabulary bindings, alignments |
| `references.schema.json` | 324 | References document -- external resources, audience, referenceDefs |
| `screener.schema.json` | 286 | Screener document -- evaluation pipeline, strategies, routes |
| `determination.schema.json` | 235 | Determination record -- screener evaluation output |
| `response.schema.json` | 214 | Form response -- submitted data, metadata, pinned version |
| `respondent-ledger.schema.json` | 205 | Respondent ledger -- append-only audit trail |
| `changelog.schema.json` | 204 | Version changelog -- change objects, impact |
| `validationResult.schema.json` | 178 | Single validation result -- severity, path, constraint kind |
| `locale.schema.json` | 173 | Locale document -- internationalized strings, fallback cascade |
| `validationReport.schema.json` | 169 | Full validation report -- aggregated results |
| `conformance-suite.schema.json` | 158 | Test conformance suite -- test cases, expected outcomes |

### Schema <-> Spec Correspondence

| Schema | Normative Spec | Spec Sections |
|--------|---------------|---------------|
| definition | Core spec | S4.1-4.7 |
| component | Component spec | S2-7, Appendix B-C |
| theme | Theme spec | S2-6, Appendix A-C |
| mapping | Mapping spec | S3-6, Appendix A |
| registry | Extension Registry | Full doc |
| changelog | Changelog spec | S2-7 |
| screener | Screener spec | S3-10 |
| determination | Screener spec | S9 (Determination Record) |
| locale | Locale spec | S2-7 |
| ontology | Ontology spec | S2-7 |
| references | References spec | S2-7 |
| respondent-ledger | Respondent Ledger | S3-10 |
| response | Core spec | S2.1 (Response abstraction) |
| validationResult | Core spec | S5.3 |
| validationReport | Core spec | S5.4 |
| fel-functions | Core spec | S3.5 (Built-in Functions) |
| core-commands | N/A (tooling) | Studio/MCP tooling layer |
| conformance-suite | N/A (testing) | Test infrastructure |

### Schema Decision Tree

| Need To Know | Read This Schema |
|---|---|
| What properties can a form item have? | definition -> Item |
| What bind types exist? | definition -> Bind |
| What components are available? | component -> component type discriminator |
| Properties of a specific component (e.g., Grid, TextInput) | component -> $defs |
| FEL function signatures and parameters | fel-functions |
| Theme token categories | theme -> tokens |
| Page layout structure | theme -> pages |
| Mapping transform types | mapping -> fieldRule |
| Extension entry format | registry -> RegistryEntry |
| What a validation error looks like | validationResult |
| Screener pipeline structure, phases, strategies | screener -> phases, strategies |
| Override route configuration | screener -> routes (overrideCondition) |
| Determination record structure | determination |
| Locale string key format and fallback | locale -> strings, fallback |
| Ontology concept binding shape | ontology -> concepts |
| Vocabulary binding and alignment | ontology -> vocabularies, alignments |
| References document structure | references -> references array |
| Agent vs human audience targeting | references -> audience enum |
| Respondent ledger event types | respondent-ledger -> events |
| Ledger checkpoint and integrity | respondent-ledger -> checkpoints |

### Schema Reference Maps

For property-level navigation of each schema, consult:

- **`references/schemas/definition.md`** -- Definition schema: items, binds, instances, variables (1729 lines)
- **`references/schemas/component.md`** -- Component schema: 35 components, slot binding, responsive (1490 lines)
- **`references/schemas/core-commands.md`** -- Core commands schema: programmatic form manipulation (1220 lines)
- **`references/schemas/fel-functions.md`** -- FEL functions schema: function catalog (994 lines)
- **`references/schemas/mapping-theme-registry.md`** -- Mapping (817), theme (658), and registry (647) schemas (2122 combined)
- **`references/schemas/response-validation-changelog-conformance.md`** -- Response (214), validation (178+169), changelog (204), conformance (158) schemas (923 combined)
- **`references/schemas/determination.md`** -- Determination record schema: screener evaluation output (235 lines)
- **`references/schemas/screener.md`** -- Screener schema: evaluation pipeline, strategies, routes (286 lines)
- **`references/schemas/locale.md`** -- Locale schema: internationalized strings, fallback cascade (173 lines)
- **`references/schemas/ontology.md`** -- Ontology schema: concept bindings, vocabulary bindings, alignments (429 lines)
- **`references/schemas/references.md`** -- References schema: external resources, audience, referenceDefs (324 lines)
- **`references/schemas/respondent-ledger.md`** -- Respondent ledger schema: append-only audit trail (205 lines)

Each schema reference contains: top-level structure, $defs catalog, required fields, enums, cross-references, extension points, x-lm annotations, and validation constraints.

## Detailed Specification Reference Maps

For section-by-section navigation of each specification, consult the reference files:

- **`references/core-spec.md`** -- Core specification: items, binds, FEL, validation, versioning (4729 lines mapped)
- **`references/theme-spec.md`** -- Theme specification: tokens, widgets, cascade, layout (1167 lines mapped)
- **`references/component-spec.md`** -- Component specification: tree, binding, 35 components, responsive (3521 lines mapped)
- **`references/mapping-spec.md`** -- Mapping specification: transforms, bidirectional, adapters (2023 lines mapped)
- **`references/fel-grammar.md`** -- FEL normative grammar: lexical rules, precedence, paths (395 lines mapped)
- **`references/extension-registry.md`** -- Extension registry: publishing, discovery, lifecycle (584 lines mapped)
- **`references/changelog-spec.md`** -- Changelog format: change objects, impact classification (260 lines mapped)
- **`references/screener-spec.md`** -- Screener: evaluation pipeline, strategies, override routes, determination (1508 lines mapped)
- **`references/assist-spec.md`** -- Assist: form-filling interop, introspection, mutation, profiles (801 lines mapped)
- **`references/respondent-ledger-spec.md`** -- Respondent Ledger: audit trail, event taxonomy, integrity (969 lines mapped)
- **`references/references-spec.md`** -- References: sidecar external context, agent data stores (697 lines mapped)
- **`references/locale-spec.md`** -- Locale: internationalization, string keys, fallback cascade (1253 lines mapped)
- **`references/ontology-spec.md`** -- Ontology: semantic binding, concept alignment, vocabulary mapping (782 lines mapped)

Each reference file contains:
- Complete section map (heading -> description -> key concepts -> when to consult)
- Cross-references to other specs
- Key schemas defined
- Critical behavioral rules specific to that spec

## Navigation Strategy

1. **Identify the tier**: Is this about data/logic (Tier 1), presentation (Tier 2), rendering (Tier 3), or a companion/add-on?
2. **Check the decision tree** above for the specific topic
3. **Load the .llm.md** file first for quick orientation: `specs/{tier}/{name}.llm.md`
4. **Consult BOTH reference maps** -- the spec reference (`references/*.md`) AND the corresponding schema reference (`references/schemas/*.md`). If both agree, the answer is likely complete.
5. **Read targeted spec sections only** when precise normative language is needed -- NEVER read an entire spec file. Use section headings from the reference maps to grep for the exact line, then read ~80 lines from that offset.
6. **Cross-reference spec <-> schema** for any question about properties, types, or constraints. If they disagree, surface the inconsistency -- do not silently pick one.
7. **Check cross-references** when behavior spans tiers or companion specs -- the reference maps list every cross-spec link.

## Cross-Spec Lookup Paths

Common questions span multiple specs. These are the most frequent cross-spec paths:

- **FEL syntax + semantics**: `fel-grammar.md` (grammar) -> `spec.md` S3 (semantics) -> `fel-functions.schema.json` (stdlib)
- **Validation**: `spec.md` S5 (shapes, rules) -> `validationResult.schema.json` -> `validationReport.schema.json`
- **Versioning + Migration**: `spec.md` S6.7 -> `changelog-spec.md` S6 -> `mapping-spec.md` Appendix A
- **Extensions**: `spec.md` S8 -> `extension-registry.md` -> `registry.schema.json`
- **Widget resolution**: `spec.md` S4.2 (widgetHint) -> `theme-spec.md` S4 (catalog) -> `component-spec.md` S5-6 (components)
- **Screener -> Determination**: `screener-spec.md` S3-S8 (pipeline) -> `screener-spec.md` S9 (Determination Record) -> `determination.schema.json`
- **Screener -> Definition routing**: `screener-spec.md` S6 (routes) -> `spec.md` S4 (target Definition)
- **Assist -> form state**: `assist-spec.md` S4 (introspection) -> `spec.md` S2.4 (processing model) -> `references-spec.md` (help content) -> `ontology-spec.md` (concept identity for autofill)
- **Locale -> all tiers**: `locale-spec.md` S4 (string keys) -> `spec.md` S4.2 (item labels/choices) + `theme-spec.md` S6 (page titles) + `component-spec.md` S3 (node text)
- **Ontology resolution cascade**: `ontology-spec.md` S7 -> `extension-registry.md` (concept entries) -> `spec.md` S4.2 (semanticType)
- **References -> Assist**: `references-spec.md` S2-S6 (reference content) -> `assist-spec.md` S5 (help tools consume references)
- **Respondent Ledger -> Response**: `respondent-ledger-spec.md` S2 (layering) -> `spec.md` S2.1 (Response) -> `response.schema.json`
