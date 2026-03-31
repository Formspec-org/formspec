# References Specification Reference Map

> specs/core/references-spec.md -- 697 lines, ~47K -- Companion: Sidecar References Document for External Context and Agent Data Stores

## Overview

The References Specification defines a standalone sidecar JSON document that binds external documentation, knowledge sources, and AI agent data stores to items in a Formspec Definition. Like Theme and Component documents, a References Document lives alongside the Definition and is identified by a `$formspecReferences` version pin. References serve two audiences (human users and AI companion agents) and are pure metadata -- they MUST NOT affect data capture, validation, or the processing model. The spec covers the Reference object model, URI schemes for vector stores and knowledge bases, document structure with composable multi-document merging, `referenceDefs` for DRY reuse via `$ref`, agent integration patterns, and conformance levels.

## Section Map

### Front Matter and Introduction (Lines 1-89)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Abstract | Abstract | States that a References Document is a standalone sidecar that binds external resources to Definition items by path, targeting human users and AI agents. Multiple documents MAY target the same Definition. References are pure metadata that MUST NOT affect data capture, validation, or the processing model. | sidecar document, audience (human/agent/both), pure metadata, additive layer | Understanding the purpose and scope of the References spec |
| Status | Status of This Document | Marks this as a draft companion spec that does not modify the core processing model. Not stable for production until 1.0.0 release. | draft, companion spec | Determining maturity/stability for implementation decisions |
| Conventions | Conventions and Terminology | BCP 14 keyword conventions (MUST/SHOULD/MAY). References RFC 8259 (JSON), RFC 3986 (URI), RFC 6901 (JSON Pointer). Terms from Formspec v1.0 core spec retain their meanings. | RFC 2119, RFC 8259, RFC 3986, RFC 6901, conformant processor | Understanding normative language and external standards |
| BLUF | Bottom Line Up Front | Compact summary of all key points: sidecar model, target/type/audience properties, uri/content delivery, multiple documents merge additively, pure metadata constraint, open strings for forward compatibility, no inheritance, referenceDefs for DRY reuse. | BLUF summary | Quick orientation before deeper reading |
| 1 | Introduction | Motivates why forms need attached context (regulatory guidance, diagnostic criteria, reporting standards). Describes two audiences: human users (help, guidance) and AI agents (RAG, vector stores, tools). Establishes that references are safe and additive. | contextual information, RAG, vector stores, knowledge bases, tool schemas | Understanding the problem space and design motivation |
| 1.1 | Design Principles | Five principles: (1) Additive, not invasive -- removing references produces identical form behavior. (2) Audience-aware -- each reference declares human/agent/both. (3) Transport-agnostic -- URIs, APIs, abstract identifiers. (4) Composable -- multiple documents per Definition. (5) Scoped -- each reference declares its target by path. | additive, audience-aware, transport-agnostic, composable, scoped | Understanding the design philosophy driving spec decisions |

### Reference Object (Lines 90-206)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 2 | Reference Object | Introduces the Reference as a JSON object pointing to external or inline contextual information. Container section for properties, types, validation, ordering, and relationships. | Reference object | Understanding the base data model |
| 2.1 | Properties | Defines all 12 properties of a Reference: `id` (recommended, pattern-constrained), `type` (required), `audience` (required), `title` (recommended), `uri` (conditional), `content` (conditional -- string or object), `mediaType`, `language` (BCP 47), `description`, `tags`, `priority` (primary/supplementary/background, defaults to supplementary), `rel` (relationship, defaults to see-also), `selector`, `extensions` (x-prefixed). | id, type, audience, title, uri, content, mediaType, language, description, tags, priority, rel, selector, extensions | Building or validating a Reference object, understanding each property's role |
| 2.2 | Reference Types | Categorizes types by interaction pattern. Human-oriented: `documentation`, `example`. Shared: `regulation`, `policy`, `glossary`, `schema`. Agent-oriented: `vector-store` (semantic search), `knowledge-base` (structured lookup), `retrieval` (HTTP API), `tool` (function invocation), `api` (REST/GraphQL), `context` (direct inclusion). Custom types must be x-prefixed. Unrecognized non-x types trigger warning but MUST NOT reject. | documentation, example, regulation, policy, glossary, schema, vector-store, knowledge-base, retrieval, tool, api, context, x- prefix, forward compatibility | Choosing the correct type for a reference, understanding what each type means for consumers |
| 2.3 | Validation Rules | Lists 10 validation constraints: uri-or-content required, both means content is fallback, id uniqueness within document (SHOULD across documents), audience enum, type must be recognized or x-prefixed, priority enum, rel handling (unrecognized -> see-also + warning), empty references array is valid, same uri may appear multiple times, all property values are static (no FEL). | uri-or-content, id uniqueness, audience enum, static values, no FEL expressions | Implementing validation logic, understanding what makes a Reference valid |
| 2.4 | Array Ordering | References array is ordered -- first is most relevant. Grouped by priority tier (primary before supplementary before background). Within a tier, array order determines presentation sequence. | array ordering, priority tiers, presentation sequence | Implementing reference display ordering, understanding author intent |
| 2.5 | Reference Relationships | Defines the `rel` property with 8 values: `authorizes`, `constrains`, `defines`, `exemplifies`, `supersedes`, `superseded-by`, `derived-from`, `see-also` (implicit default). Custom rels must be x-prefixed. Modeled after IANA Link Relations. References do not link to each other -- only to their target item. | rel, authorizes, constrains, defines, exemplifies, supersedes, superseded-by, derived-from, see-also, IANA Link Relations | Choosing the right relationship type, understanding how rel affects agent context weighting |

### URI Schemes for Agent Data Stores (Lines 207-327)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3 | URI Schemes for Agent Data Stores | Introduces URI scheme conventions beyond standard https:// for AI infrastructure. Notes that vectorstore: and kb: are Formspec conventions, not IANA-registered. Recommends urn:x- or formspec-fn: for standards-compliant environments. | URI schemes, vectorstore:, kb:, formspec-fn:, urn:x- | Understanding how references point to AI data stores |
| 3.1 | Vector Store References | Format: `vectorstore:{provider}/{collection-id}`. Examples for Pinecone, ChromaDB, Weaviate. Query parameters and auth are runtime concerns. | vectorstore: scheme, provider, collection-id | Constructing URIs for vector store references |
| 3.2 | Knowledge Base References | Format: `kb:{provider}/{base-id}`. Examples for AWS Bedrock, Confluence. | kb: scheme, knowledge base URI | Constructing URIs for knowledge base references |
| 3.3 | Retrieval Endpoints | Standard HTTPS URIs with `type: "retrieval"`. Extensions (x-retrieval) provide method, topK, queryField, authScheme for the agent. | retrieval endpoints, x-retrieval extension, HTTPS URI | Setting up RAG/retrieval API references with query configuration |
| 3.4 | Host-Provided Data Sources | Format: `formspec-fn:{function-name}`. Delegates resolution to the host environment. Recommended for environment-independent definitions. Follows existing formspec-fn: convention from core spec S2.1.7. | formspec-fn:, host delegation, environment-independent | Making references portable across environments |
| 3.5 | Opaque Identifiers | Format: `urn:x-{org}:{type}:{id}`. Fallback for identifiers that do not fit standard schemes. | URN, opaque identifiers | Using non-standard identifier schemes |
| 3.6 | Fragment Targeting | URI fragments (#) per RFC 3986 S3.5. HTML fragments by id, PDF by open parameters (#page=), JSON by JSON Pointer (RFC 6901), plain text/markdown use `selector` instead. When fragment present, SHOULD include mediaType. `selector` is an advisory, unstructured string for resources without native fragment semantics. When both fragment and selector present, fragment is machine-actionable, selector is supplementary context. | URI fragment, selector, JSON Pointer, mediaType, advisory hint | Pointing to specific portions of referenced documents |

### References Document (Lines 328-541)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4 | References Document | Introduces the standalone JSON sidecar document model. Like Theme and Component documents, lives alongside the Definition. Multiple documents MAY target the same Definition for audience separation, locale variants, or domain overlays. | References Document, sidecar, standalone JSON | Understanding the document-level structure |
| 4.1 | Document Structure | Required properties: `$formspecReferences` (must be "1.0"), `version`, `targetDefinition` (url + optional compatibleVersions), `references` array. Optional: `url`, `name` (pattern-constrained), `title`, `description`, `referenceDefs`. Root-level x- extensions allowed and MUST be preserved on round-trip. Full example JSON included. | $formspecReferences, version, targetDefinition, references array, referenceDefs, name, x- extensions | Building or validating a References Document, understanding required vs optional fields |
| 4.2 | Bound References | Each `references` array entry is a Bound Reference -- a Reference with an additional required `target` property. Target uses dot-notation path syntax (same as Bind paths, core S4.3.3). Special value `"#"` means form-level. Target path examples: `"#"`, `"indirectCostRate"`, `"budget.lineItems"`, `"lineItems[*].amount"`. | Bound Reference, target, path syntax, # form-level, dot-notation, [*] wildcard | Binding references to specific Definition items |
| 4.3 | Target Definition Binding | `targetDefinition.url` (required) must match the loaded Definition's url -- mismatch means MUST NOT apply and SHOULD emit error. `compatibleVersions` (optional) is a semver range -- mismatch means SHOULD warn but MAY still apply (warn-and-continue). | targetDefinition, url matching, compatibleVersions, semver range, warn-and-continue | Implementing document loading and validation, understanding binding rules |
| 4.4 | Multiple References Documents | Enables audience separation, locale variants, domain overlays. Processor MUST merge by collecting all Bound References into a single ordered list. Within-document order preserved. Cross-document load order is implementation-defined. References from different documents targeting the same path are additive -- they never replace each other. | multiple documents, additive merge, load order, audience separation, locale variants, domain overlays | Implementing multi-document loading, understanding merge semantics |
| 4.5 | Scoping and Non-Inheritance | References do NOT inherit from parent to child. Each item must be targeted explicitly. Agents wanting hierarchical context must walk ancestor paths themselves (see S5.1). Non-relevant items: references persist structurally but SHOULD NOT be surfaced for non-relevant items. | non-inheritance, explicit targeting, non-relevant items | Understanding why a child field does not automatically get its parent's references |
| 4.6 | Reuse via referenceDefs | Declares `referenceDefs` as a registry of reusable Reference objects. Entries in `references` array use `$ref` pointers instead of duplicating objects inline. Same pattern as JSON Schema `$defs` and Formspec's own `$ref` (core S6.6). | referenceDefs, $ref, DRY reuse, single source of truth | Avoiding duplication when the same reference is bound to multiple items |
| 4.6.1 | Declaring Shared References | `referenceDefs` keys match `[a-zA-Z][a-zA-Z0-9_-]*`. Key becomes the reference's id. If the entry also declares an id, it MUST match the key (processing-time validation, not schema-enforceable). | referenceDefs keys, id-key match constraint, processing-time validation | Defining reusable reference objects |
| 4.6.2 | Referencing Shared Definitions | `$ref` value must be a JSON Pointer (RFC 6901) relative to document root: `"#/referenceDefs/{key}"`. Additional properties alongside `$ref` override the base (shallow merge, top-level keys only). | $ref pointer, JSON Pointer, shallow merge, override properties | Using $ref to reference shared definitions with optional overrides |
| 4.6.3 | Resolution Rules | Six rules: (1) Resolution at load time, before processing. (2) Nonexistent key is a document error -- MUST report, MUST NOT ignore. (3) No recursive $ref. (4) Unreferenced entries are inert (no warning). (5) Resolved id is the referenceDefs key -- overrides MUST NOT include id. (6) Merged result must satisfy all S2.3 validation rules. | load-time resolution, broken ref error, no recursion, inert entries, id from key, merged validation | Implementing $ref resolution logic |
| 4.7 | URI Stability and Versioning | Reference URIs are not versioned with the document -- they point to living external resources. Authors wanting pinned references should use inline `content`, version-qualified URIs, or descriptive notes. | URI stability, living references, pinned content | Understanding URI lifecycle and versioning strategy |
| 4.8 | Modular Composition | When a Group uses $ref to include items from another definition (core S6.6), references from the source definition's References Documents do NOT transfer. Host authors must explicitly bind references using assembled paths (including keyPrefix). | modular composition, $ref import, keyPrefix, no automatic transfer | Understanding reference behavior with definition imports |

### Agent Integration Patterns (Lines 542-611)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5 | Agent Integration Patterns | Advisory section describing how AI agents are expected to consume references. Patterns may vary by implementation. | agent integration, advisory patterns | Implementing agent-side reference consumption |
| 5.1 | Context Assembly | 8-step recommended algorithm: (1) collect all loaded References Documents, (2) filter by field path, (3) collect ancestor and form-level references, (4) filter by audience (agent/both), (5) sort by priority, (6) weight by rel (constrains/defines before see-also), (7) use inline content directly, (8) resolve URIs as appropriate. | context assembly, ancestor walk, priority sort, rel weighting | Implementing an agent's reference resolution pipeline |
| 5.2 | Vector Store Query Pattern | Agent constructs queries using field label/description/hint as context, user question as primary query, and reference tags for namespace/filter scoping. Includes worked example flow. | vector store query, label/description/hint context, tags for scoping | Implementing vector store integration for field-level assistance |
| 5.3 | Tool References | `type: "tool"` references with uri pointing to tool definition and content containing inline tool JSON schema (e.g., OpenAPI, MCP). Example: NICRA lookup tool with parameters. | tool references, tool schema, OpenAPI, MCP tool definition | Binding function-invocation tools to specific fields |
| 5.4 | Grounding Documents | `type: "context"` with inline content provides pre-written grounding text for agents. Useful for field-specific instructions beyond description/hint, domain rules, disambiguation guidance. | context type, grounding text, inline content, disambiguation | Providing pre-written agent context that goes beyond field help text |

### Relationship to Existing Properties (Lines 612-626)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6 | Relationship to Existing Properties | Distinguishes references from existing Item properties (label, hint, description). Label/hint/description are for concise inline human guidance; references are for deeper context (documents, knowledge bases, regulatory citations, agent data). Agents SHOULD use label/hint/description as lightweight context before consulting references. | label, hint, description, references complement | Deciding whether guidance belongs in Item properties or in a Reference |

### Rendering Guidance (Lines 627-636)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7 | Rendering Guidance | Advisory patterns: documentation/regulation/policy -> links in help panels, primary may warrant visible icon; examples -> inline/popover on focus; agent references -> not rendered; both -> available to both pipelines. Relationship-aware rendering: constrains -> "Requirements" heading, exemplifies -> expandable panel, superseded-by -> de-emphasized. | rendering patterns, help panel, popover, relationship-aware display | Implementing UI for human-audience references |

### Conformance (Lines 637-658)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 8 | Conformance | Defines two levels of conformance for References Document handling. | conformance levels | Understanding implementation requirements |
| 8.1 | Core Processor Requirements | Three rules: (1) MAY ignore References Documents entirely. (2) MUST NOT use references to alter data capture, validation, or processing model. (3) References MUST NOT appear in Response data. | Core processor, ignore references, no Response data | Implementing a minimal processor that does not support references |
| 8.2 | Extended Processor Requirements | Nine requirements: MUST load and validate against schema, MUST resolve $ref at load time, MUST verify targetDefinition.url match, SHOULD verify compatibleVersions, MUST validate referenceDefs id-key match, SHOULD validate target paths exist (warning only), SHOULD surface human references in UI, SHOULD expose agent references via API, SHOULD warn on unrecognized non-x types. | Extended processor, schema validation, url match, target path validation, warning-only | Implementing a full-featured processor with reference support |

### Schema (Lines 659-687)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 9 | Schema | Points to `schemas/references.schema.json` as the normative schema. Notes it is standalone (not embedded in definition schema). TargetDefinition type is shared with Component schema via $ref. Contains generated schema-ref table with all schema pointers for BoundReference, Reference, ReferenceOrRef, and ReferenceDefs. | references.schema.json, TargetDefinition shared type, BoundReference, Reference, ReferenceOrRef, ReferenceDefs | Understanding the JSON Schema structure, validating documents |

### Security Considerations (Lines 689-697)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 10 | Security Considerations | Seven security concerns: (1) URI resolution -- allowlist trusted domains, do not blindly fetch. (2) Inline content -- treat as untrusted, sanitize HTML/markdown. (3) Credential exposure -- URIs MUST NOT contain credentials. (4) Prompt injection -- content and fetched documents may contain adversarial text. (5) Circular resolution -- guard with visited-set or depth limit. (6) Browser security -- CORS/CSP restrictions, proxy through backend. (7) Document provenance -- verify source of loaded References Documents. | URI allowlist, content sanitization, credential exposure, prompt injection, circular resolution, CORS, CSP, document provenance | Implementing secure reference handling, reviewing security posture |

## Cross-References

- **Formspec v1.0 Core Specification** -- Referenced throughout as the parent spec. References spec is a companion that does not modify the core processing model.
- **Core S2.1.7 (Data Sources / formspec-fn:)** -- S3.4 follows the existing `formspec-fn:` convention for host-delegated resolution.
- **Core S4.3.3 (Bind paths / dot-notation)** -- S4.2 states that Bound Reference `target` uses the same dot-notation path syntax as Bind paths.
- **Core S6.6 (Modular Composition / $ref)** -- S4.6 uses the same `$ref`/`$defs` pattern for referenceDefs. S4.8 discusses behavior when Groups use `$ref` to include items from other definitions.
- **Core S6.2 (Semver semantics)** -- S4.3 uses semver ranges for `compatibleVersions`.
- **`schemas/references.schema.json`** -- S9 declares this as the normative schema. The generated schema-ref table in S9 is sourced from this schema.
- **Component schema (`schemas/component.schema.json`)** -- S9 notes that TargetDefinition type is shared with the Component schema via `$ref`.
- **RFC 2119 / RFC 8174 (BCP 14)** -- Normative keyword conventions.
- **RFC 8259** -- JSON syntax and data types.
- **RFC 3986** -- URI syntax. S3.6 references S3.5 for fragment semantics.
- **RFC 6901** -- JSON Pointer syntax. Used for URI fragments on JSON resources (S3.6) and for `$ref` values in referenceDefs (S4.6.2).
- **RFC 2045** -- MIME types for `mediaType` property.
- **BCP 47** -- Language tags for `language` property.
- **IANA Link Relations** -- S2.5 notes that `rel` values are modeled after IANA Link Relations and HTML's `rel` attribute.

## Reference Type Quick Reference

| Type | Audience Pattern | Interface Pattern | URI Scheme |
|------|-----------------|-------------------|------------|
| `documentation` | human | Display (links, help panels) | https: |
| `example` | human | Display (inline, popover) | https: |
| `regulation` | both | Display + context | https: |
| `policy` | both | Display + context | https: |
| `glossary` | both | Display + context | https: |
| `schema` | both | Display + context | https: |
| `vector-store` | agent | Semantic similarity search | vectorstore: |
| `knowledge-base` | agent | Structured lookup | kb: |
| `retrieval` | agent | HTTP request/response | https: |
| `tool` | agent | Function invocation | https:, inline content |
| `api` | agent | REST/GraphQL endpoint | https: |
| `context` | agent | Direct inclusion (no external query) | (inline content) |

## Relationship Type Quick Reference

| `rel` Value | Meaning | Agent Weight |
|-------------|---------|--------------|
| `authorizes` | Permits the action described by target | Authoritative |
| `constrains` | Imposes limits on valid values | Authoritative |
| `defines` | Defines the term or concept | Authoritative |
| `exemplifies` | Provides an example or template | Supplementary |
| `supersedes` | Replaces a prior reference version | Current |
| `superseded-by` | Has been replaced by a newer version | Outdated |
| `derived-from` | Target value is derived from this source | Provenance |
| `see-also` | General association (implicit default) | Background |

## Critical Behavioral Rules

1. **References are pure metadata -- zero behavioral impact.** References MUST NOT affect data capture, validation, or the processing model. A conformant Core processor MAY ignore them entirely. References MUST NOT appear in Response data. This is the most important invariant of the entire spec.

2. **At least one of uri or content is required.** Every Reference must provide a `uri`, a `content`, or both. When both are present, `content` is treated as a cached/fallback representation of the URI target -- not as independent content.

3. **No FEL in reference properties.** All reference property values are static. FEL expressions MUST NOT appear in any reference property (uri, content, title, etc.). Dynamic resolution must go through the host environment or `formspec-fn:` URIs.

4. **References do NOT inherit from parent to child.** A reference targeting a group does NOT automatically apply to the group's children. Each item must be targeted explicitly. Agents wanting hierarchical context must walk ancestor paths themselves (the recommended pattern in S5.1).

5. **Priority tiers override array position for ordering.** All primary references are surfaced before supplementary, regardless of array position. Within a tier, array order determines sequence. When `priority` is absent, it defaults to `"supplementary"` (processing-model default, not schema default).

6. **Unrecognized types and rels are warnings, not errors.** Processors encountering an unrecognized non-x-prefixed `type` SHOULD warn and MAY skip, but MUST NOT reject the document. Unrecognized non-x-prefixed `rel` values MUST be treated as `"see-also"` with a warning. This ensures forward compatibility.

7. **targetDefinition.url MUST match -- hard requirement.** If the References Document's `targetDefinition.url` does not match the loaded Definition's `url`, the processor MUST NOT apply the references. This is a MUST (not SHOULD). Version mismatch via `compatibleVersions` is softer -- warn-and-continue.

8. **$ref resolution happens at load time.** After resolution, the document behaves as if all references were inline. Broken $ref (nonexistent key) is a document error that MUST be reported. No recursive $ref allowed. Overrides use shallow merge (top-level keys only). Overrides MUST NOT include `id` -- the identity is always the referenceDefs key.

9. **Multiple References Documents merge additively.** References from different documents targeting the same path never replace each other -- they are collected into a single ordered list. Within-document order is preserved; cross-document order is implementation-defined.

10. **Agents should weight by rel for context assembly.** The S5.1 pattern recommends that `constrains` and `defines` references are authoritative and should be consulted before `see-also` references, which provide background. This enables agents to prioritize the most decision-relevant context.

11. **referenceDefs id-key match is processing-time validation.** The constraint that a referenceDefs entry's explicit `id` must match its key cannot be expressed in JSON Schema and MUST be enforced at processing time by Extended processors.

12. **URI security: do not blindly fetch.** Implementations MUST maintain an allowlist of trusted domains or delegate URI resolution to the host environment. URIs MUST NOT contain credentials. Inline content must be treated as untrusted (sanitize HTML/markdown, guard against prompt injection). Recursive URI resolution must guard against circular loops.

13. **Modular composition does not transfer references.** When a Definition imports items via `$ref` (core S6.6), references from the source definition's sidecar documents do NOT follow. The host definition's References Documents must explicitly target imported items using assembled paths (including keyPrefix).
