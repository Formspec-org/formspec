# Assist Specification Reference Map

> specs/assist/assist-spec.md -- 801 lines, ~32K -- Companion: Transport-Agnostic Form Filling Interoperability Contract

## Overview

The Assist Specification defines a transport-agnostic interoperability protocol for software that helps people complete Formspec forms at runtime. It standardizes how agents, browser extensions, accessibility tools, automation systems, and chat layers discover a live form, inspect its structure and state, retrieve contextual help from References and Ontology sidecars, validate input, manage user profiles for cross-form autofill, and request mutations in a controlled, user-consented way. Assist is additive to the core spec -- it MUST NOT change core response, validation, calculation, or relevance semantics. It is LLM-independent: chat experiences are consumers of this spec, not part of it.

## Section Map

### Front Matter and Introduction (Lines 1-91)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Front Matter | Title / Abstract | Establishes the spec as v1.0.0-draft.1 (2026-03-27, draft status). The abstract frames Assist as the filling-side counterpart to authoring tools -- it covers discovery, introspection, help, validation, and mutation for live forms. Explicitly excludes rendering, authoring, and LLM behavior. | Assist Provider, Assist Consumer, Passive Provider, transport-agnostic, filling-side | Understanding what Assist covers vs what it excludes |
| Conventions | Conventions and Terminology | Defines RFC 2119 keyword usage, JSON/URI standards, and five key terms: Assist Provider (exposes tools), Assist Consumer (invokes tools), Passive Provider (metadata only), Profile (reusable value store keyed by ontology concept), Human-in-the-loop (explicit user confirmation). | BCP 14, RFC 2119, RFC 8174, RFC 8259, RFC 3986, Profile, Human-in-the-loop | Looking up term definitions or standards references |
| BLUF | Bottom Line Up Front | Seven bullet summary: Assist covers form filling (not authoring), required core is introspection + help + mutation + validation, context comes from References and Ontology sidecars, autofill is ontology-concept-driven, protocol is transport-agnostic and LLM-independent, Assist is additive. | Form filling, introspection, help, mutation, validation, ontology concept identity, transport-agnostic, additive | Quick orientation before deeper reading |

### Purpose and Scope (Lines 92-154)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 1 | Purpose and Scope | Frames how Formspec already provides form state/validation (engine), contextual knowledge (References), and semantic identity (Ontology) -- this spec makes those ingredients interoperable at runtime. | Runtime interoperability, engine state, References, Ontology, semanticType | Understanding why Assist exists and what it unifies |
| 1.1 | What This Specification Defines | Enumerates six deliverables: normative tool catalog, field-help resolution algorithm, profile-matching algorithm, transport requirements, declarative browser annotations, and discovery conventions. | Tool catalog, field-help resolution, profile matching, transport, browser annotations, discovery | Scoping what is normative in this spec |
| 1.2 | What This Specification Does Not Define | Excludes form rendering, component behavior, authoring tools, LLM prompts/chat UX/model selection, mandatory profile storage, and a single canonical JSON schema for the protocol. Design note explains Assist is a live contract, not a sidecar document format. | Non-scope, no top-level schema, no rendering, no authoring MCP | Confirming something is out of scope |
| 1.3 | Relationship to Other Specifications | Table mapping how Assist relates to Core (reads/mutates state), References (help source), Ontology (semantic alignment), Component (passive annotations), Registry (concept entries), and Authoring MCP (filling-side analogue, not replacement). | Core, References, Ontology, Component, Registry, Authoring MCP | Understanding cross-spec dependencies |
| 1.4 | Design Principles | Five principles: LLM-independent (structured data only), user-controlled mutation, additive (no core redefinition), transport-neutral, graceful degradation when sidecars are absent. | LLM-independent, user agency, additive, transport-neutral, graceful degradation | Resolving design trade-offs or ambiguity |

### Conformance Roles (Lines 155-192)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 2 | Conformance Roles | Introduces three conformance roles with different obligation levels. | Conformance, Provider, Consumer, Passive Provider | Determining which requirements apply to your implementation |
| 2.1 | Assist Provider | A provider MUST implement all tools in S3.2-3.4, follow field-help resolution (S5), preserve result/error contracts (S4), and MUST NOT write to readonly or non-relevant fields. | Provider requirements, tool catalog, readonly protection, non-relevant protection | Implementing a full Assist Provider |
| 2.2 | Assist Consumer | A consumer MUST treat the provider as authoritative for live state, MUST parse structured results (not scrape text), SHOULD request user confirmation for high-impact mutations, SHOULD degrade when optional tools are absent. | Consumer requirements, authoritative state, structured parsing, graceful degradation | Implementing an Assist Consumer (agent, extension, chat layer) |
| 2.3 | Passive Provider | A passive provider MUST preserve accessibility semantics, SHOULD emit `data-formspec-*` annotations (S8), MAY omit profile and tool invocation entirely. | Passive Provider, accessibility, data-formspec-* attributes | Implementing a renderer that exposes metadata without full tool support |

### Tool Catalog (Lines 193-240)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3.1 | Naming | All tools use the namespace `formspec.{category}.{action}` (e.g., `formspec.field.set`). | Tool naming, `formspec.` namespace | Looking up tool name format |
| 3.2 | Required Core Introspection Tools | Five required tools: `form.describe` (form metadata/status), `field.list` (filtered field summaries, default filter `"relevant"`), `field.describe` (live state + resolved help), `field.help` (contextual help, default audience `"agent"`), `form.progress` (completion summary). | `formspec.form.describe`, `formspec.field.list`, `formspec.field.describe`, `formspec.field.help`, `formspec.form.progress`, FormDescription, FieldSummary, FieldDescription, FieldHelp, FormProgress | Implementing or invoking introspection tools |
| 3.3 | Required Core Mutation Tools | Two required tools: `field.set` (single field write, MUST reject readonly/non-relevant) and `field.bulkSet` (array of writes, MAY partially succeed, each entry independent). Omitted `value` in `field.set` is treated as `null` (clears the field). | `formspec.field.set`, `formspec.field.bulkSet`, SetValueResult, BulkSetResult, readonly rejection, null clearing | Implementing or invoking mutation tools, understanding partial success semantics |
| 3.4 | Required Core Validation Tools | Two required tools: `form.validate` (full form, default mode `"continuous"`) and `field.validate` (single field scoped). | `formspec.form.validate`, `formspec.field.validate`, ValidationReport, ValidationResult, continuous vs submit mode | Implementing or invoking validation tools |
| 3.5 | Optional Profile Tools | Three optional tools: `profile.match` (suggests reusable values), `profile.apply` (applies matches, `confirm: true` requires human-in-the-loop; if no confirmation mechanism, MUST return `x-confirmation-required`), `profile.learn` (saves concept-bound values). | `formspec.profile.match`, `formspec.profile.apply`, `formspec.profile.learn`, ProfileMatch, ProfileApplyResult, human-in-the-loop, `x-confirmation-required`, `confirm: true` | Implementing profile/autofill features |
| 3.6 | Optional Navigation Tools | Two optional tools: `form.pages` (page progress computed over live field set including active repeat instances) and `form.nextIncomplete` (next incomplete field or page, default scope `"field"`). | `formspec.form.pages`, `formspec.form.nextIncomplete`, PageProgress, NextIncompleteResult, repeat instances, page scope | Implementing navigation/progress features |

### Result, Error, and Data Contracts (Lines 241-418)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4.1 | Tool Result Envelope | Every tool returns `{ content: [{ type: "text", text: string }], isError?: boolean }`. The `text` field contains a JSON-stringified payload. Consumers MUST parse this payload before using it. | ToolResult, JSON-stringified payload, content array, isError | Implementing the wire format for tool results |
| 4.2 | Error Contract | Errors set `isError: true` with a `ToolError` object containing `code`, `message`, and optional `path`. Seven standard codes: NOT_FOUND, INVALID_PATH, INVALID_VALUE, NOT_RELEVANT, READONLY, UNSUPPORTED, ENGINE_ERROR. Providers MAY add `x-` prefixed codes. Two recommended `x-` codes: `x-confirmation-required` and `x-invalid-sidecar`. Consumers MUST treat unknown non-`x-` codes as generic failures. | ToolError, error codes, NOT_FOUND, INVALID_PATH, INVALID_VALUE, NOT_RELEVANT, READONLY, UNSUPPORTED, ENGINE_ERROR, `x-confirmation-required`, `x-invalid-sidecar` | Implementing error handling, mapping error codes |
| 4.3 | Mutation Rules | Five rules for every mutation tool: validate path resolves to writable field, MUST NOT silently write to readonly, MUST NOT silently write to non-relevant, MUST NOT suppress core validation triggered by write, SHOULD support human-in-the-loop for bulk/profile writes. | Mutation safety, readonly protection, relevance protection, core validation preservation, human-in-the-loop | Implementing mutation safety checks |
| 4.4 | Common Data Shapes | Defines TypeScript interfaces for all tool results: FormDescription, FieldSummary (with validity rule: no error-severity results), FormProgress (with filled definition: not null/undefined/empty-string/empty-array), PageProgress, FieldDescription (widget is advisory widgetHint, not resolved component), SetValueResult, BulkSetResult, ProfileApplyResult (with standard skip reasons: NOT_FOUND, READONLY, NOT_RELEVANT, INVALID_VALUE, DECLINED), NextIncompleteResult (reason enum: empty, invalid, required, complete). | FormDescription, FieldSummary, FormProgress, PageProgress, FieldDescription, SetValueResult, BulkSetResult, ProfileApplyResult, NextIncompleteResult, filled definition, valid definition, widget advisory, skip reasons | Implementing data shapes, understanding field validity/filled semantics |

### Field Help and Context Resolution (Lines 420-518)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5.1 | FieldHelp | Defines the structured grounding object returned by `field.help` and embedded in `FieldDescription`. Contains `references` (grouped by ReferenceType), `concept` (ConceptBinding), `equivalents` (ConceptEquivalent with relationship types), and optional `summary`/`commonMistakes`. Enumerates 12 reference types and 5 equivalence relationship types. | FieldHelp, ReferenceType, ReferenceEntry, ConceptBinding, ConceptEquivalent, priority (primary/supplementary/background), relationship types (exact/close/broader/narrower/related), 12 reference types | Understanding the help data model, reference type taxonomy |
| 5.2 | References Resolution | Eight-step algorithm: load all active References Documents, determine field path and ancestor paths (including wildcard forms for repeat indices), collect matching references by exact path + ancestors + `"#"`, MUST NOT treat references as implicitly inherited (ancestor inclusion is from explicit walk), filter by audience, resolve `$ref` bindings, group by type, sort by priority then document order. | References resolution, ancestor path walk, wildcard paths (`items[*]`), audience filtering, `$ref` resolution, priority sort, document order, `"#"` form-level context | Implementing field-help resolution, debugging missing references |
| 5.3 | Ontology Resolution Cascade | Three-source cascade in strict order: (1) Ontology Document binding for field path (last-loaded document wins when multiple loaded, load order = array order), (2) Registry concept entry matching field's `semanticType`, (3) raw `semanticType` literal. Absent relationship type in equivalents MUST be treated as `"exact"`. | Ontology cascade, last-loaded wins, array order, semanticType, registry concept, absent type = exact | Implementing concept resolution, debugging which ontology source wins |
| 5.4 | Synthesized Fields | `summary` and `commonMistakes` are OPTIONAL. If present, MUST be advisory (not override References/Ontology). Summary SHOULD be concise plain-text for tooltip/chat. Providers MAY use LLM-generated content. Synthesis method is implementation-defined. | summary, commonMistakes, advisory, LLM-generated, implementation-defined synthesis | Understanding what providers can synthesize vs what is authoritative |

### Profile Matching (Lines 520-583)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6.1 | Profile Structure | Defines UserProfile with `concepts` (keyed by concept URI) and `fields` (keyed by field path) maps, both containing ProfileEntry with value, confidence, source, lastUsed, and verified flag. ProfileEntrySource is a discriminated union: form-fill, manual, import, extension. ProfileMatch adds relationship and source to each candidate. | UserProfile, ProfileEntry, ProfileEntrySource, ProfileMatch, concepts map, fields map, confidence, verified, form-fill/manual/import/extension sources | Implementing profile storage or understanding the data model |
| 6.2 | Matching Algorithm | Five-step algorithm per writable field: (1) resolve concept identity via S5.3, (2) check `profile.concepts[conceptUri]` for exact match, (3) evaluate equivalents with recommended confidence levels (exact/absent=0.95, close=0.80, broader/narrower=0.60, related=0.40), (4) MAY fall back to `profile.fields[path]` with relationship `"field-key"` and low confidence, (5) SHOULD discard below threshold (0.50 recommended). | Matching algorithm, concept-first, confidence levels, field-key fallback, 0.50 threshold, equivalent confidence tiers | Implementing profile matching, tuning confidence thresholds |
| 6.3 | Learning Rules | `profile.learn` SHOULD store under concept identity when available, MAY store field-path fallbacks for stable non-concept-bound fields, MUST NOT transmit profile data off-device/off-origin without explicit user consent. | profile.learn, concept-first storage, field-path fallback, privacy, consent | Implementing profile learning, understanding privacy constraints |

### Transport Bindings (Lines 584-645)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7.1 | Transport-Neutral Requirements | Four requirements for any transport: tool discovery (enumerate tools with schemas), tool invocation (by name with JSON input), error preservation (ToolError semantics), human-in-the-loop support. Discovery results SHOULD include only supported tools; consumers SHOULD check enumeration or handle UNSUPPORTED errors. | Transport requirements, tool discovery, tool invocation, error preservation, human-in-the-loop | Implementing any Assist transport binding |
| 7.2 | WebMCP Binding | Browser-native binding via `navigator.modelContext`. SHOULD register tools incrementally via `registerTool()`. SHOULD use `requestUserInteraction()` for `confirm: true` mutations. MAY install polyfill when native WebMCP unavailable. | WebMCP, `navigator.modelContext`, `registerTool()`, `requestUserInteraction()`, polyfill | Implementing browser-native Assist in a web renderer |
| 7.3 | MCP Binding | Server-mediated agents. MUST preserve Assist tool names and result envelopes. SHOULD map human-in-the-loop to explicit MCP user prompts. | MCP, server-mediated, tool names, user prompts | Implementing server-side Assist for agent architectures |
| 7.4 | Browser Messaging Binding | `postMessage`-style binding for extensions and page scripts. SHOULD announce tools via DOM event, correlate with stable call identifiers (UUIDs recommended), isolate privileged extension APIs from injected page code. | postMessage, browser extension, callId, UUID, DOM event, privilege isolation | Implementing extension-to-page Assist communication |
| 7.5 | HTTP Binding | Remote agents via HTTP. SHOULD expose `GET /formspec/tools` for discovery and `POST /formspec/tools/{name}` for invocation. Dots in tool names MUST NOT be interpreted as path separators or file extensions. HTTP is binding detail only; normative contract is the tool surface. | HTTP, REST-like, `/formspec/tools`, dot-delimited names, binding detail | Implementing HTTP-based Assist for remote agents |

### Declarative Browser Annotations (Lines 646-690)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 8.1 | Form Container Annotations | Form container SHOULD expose: `data-formspec-form`, `data-formspec-title`, `data-formspec-url`, `data-formspec-version`. | `data-formspec-form`, `data-formspec-title`, `data-formspec-url`, `data-formspec-version` | Implementing form-level passive discovery metadata |
| 8.2 | Field-Level Annotations | Focusable fields SHOULD expose: `toolparamdescription` (machine-readable context), `autocomplete` (best-effort HTML token), standard accessibility metadata (labels, `aria-describedby`). Providers MUST NOT degrade accessibility to add Assist annotations. | `toolparamdescription`, `autocomplete`, `aria-describedby`, accessibility preservation | Adding field-level metadata for passive consumers |
| 8.3 | Ontology-to-Autocomplete Mapping | Advisory mapping table of 10 schema.org concept URIs to HTML `autocomplete` tokens (givenName -> given-name, familyName -> family-name, email -> email, telephone -> tel, streetAddress -> street-address, etc.). Unknown concepts MUST NOT cause an error. | schema.org, autocomplete mapping, givenName, familyName, email, telephone, streetAddress, addressLocality, addressRegion, postalCode, addressCountry, birthDate | Implementing autocomplete token generation from ontology concepts |

### Sidecar Discovery (Lines 692-718)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 9 | Sidecar Discovery | Four-step discovery order: (1) active provider first (use its tools), (2) HTML link relations (`<link rel="formspec-references">`, `formspec-ontology`, `formspec-registry`), (3) definition metadata (future `sidecars` object), (4) well-known sibling paths heuristic. Sidecars are immutable per (definitionUrl, definitionVersion) -- cache on that tuple. Missing sidecars MUST degrade gracefully: without References = less context, without Ontology = weak heuristic fallback, without both = core tools still work. | Sidecar discovery, link relations, `formspec-references`, `formspec-ontology`, `formspec-registry`, caching, immutability, graceful degradation | Implementing sidecar loading, caching strategy, or understanding degradation behavior |

### Extension Integration (Lines 719-757)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 10.1 | Mode 1: Active Assist Provider | Extension discovers and invokes the full tool catalog from an existing provider on the page. Treats provider help and validation as authoritative. | Mode 1, active provider, authoritative | Building an extension that works with Assist-enabled pages |
| 10.2 | Mode 2: Formspec Form Without Assist | Page renders a Formspec form but no Assist Provider. Extension detects the form/engine through public host APIs, MAY bootstrap an in-page provider, SHOULD discover sidecars via S9. | Mode 2, bootstrap provider, public host APIs, sidecar discovery | Building an extension that enhances non-Assist Formspec pages |
| 10.3 | Mode 3: Plain HTML Form | No Formspec form present. Extension MAY fall back to heuristic field detection (labels, name/id/placeholder, aria-label, autocomplete tokens). Mode 3 is explicitly degraded and non-authoritative -- profile matches are advisory only. | Mode 3, heuristic detection, non-authoritative, advisory, plain HTML | Building an extension that works on non-Formspec pages |

### Security, Privacy, and Conformance Summary (Lines 758-801)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 11 | Security and Privacy Considerations | Seven rules: treat all tool input as untrusted, validate paths/values, MUST NOT bypass readonly/relevance, MUST NOT block persistence solely because validation findings exist (unless host policy requires it), MUST NOT transmit profile data without consent, SHOULD encrypt profile storage at rest, SHOULD separate privileged extension APIs from page bootstrap code. | Security, privacy, untrusted input, readonly bypass, profile consent, encryption at rest, privilege separation | Security review, implementing data protection, understanding consent requirements |
| 12.1 | Provider Requirements | Five MUST/SHOULD requirements: implement required core tools, use S4.1 envelope, implement S5 help resolution, preserve core processing semantics, support at least one transport. | Provider conformance checklist | Verifying provider conformance |
| 12.2 | Consumer Requirements | Four requirements: parse structured payloads, respect errors and UNSUPPORTED, SHOULD use provider help/validation over scraped UI, SHOULD surface confirmation for high-impact writes. | Consumer conformance checklist | Verifying consumer conformance |
| 12.3 | Passive Provider Requirements | Three requirements: preserve accessibility, SHOULD emit `data-formspec-*`, MAY omit active tool surface. | Passive provider conformance checklist | Verifying passive provider conformance |

## Cross-References

- **Formspec v1.0 Core Specification**: Assist reads and mutates state governed by the core processing model. Referenced in Abstract (additive, MUST NOT change core semantics), S1.3 (relationship table), S2.1 (provider must not write to readonly/non-relevant), S4.3 (mutation rules preserve core validation), S4.4 (FieldSummary validity maps to core S5.1 validity rule; filled definition extends core S3.5.5 `empty()` function; required bind semantics per core S2.1.4).
- **References Specification / References Documents**: Used as a primary source of contextual help. Referenced in Abstract, S1, S1.1, S1.3, S5.2 (8-step resolution algorithm), S9 (sidecar discovery via `<link rel="formspec-references">`).
- **Ontology Specification / Ontology Documents**: Used for semantic identity and profile matching. Referenced in Abstract, S1, S1.1, S1.3, S5.3 (ontology resolution cascade, pins ontology S8.2 load order to array order), S8.3 (concept-to-autocomplete mapping), S9 (sidecar discovery via `<link rel="formspec-ontology">`).
- **Component Specification**: Passive annotations (S8) emitted by renderers MUST NOT alter component semantics. Referenced in S1.3.
- **Registry Specification / Registry concept entries**: Participate in the ontology resolution cascade (S5.3 step 2: registry entry matching semanticType). Referenced in S1.3, S5.3, S9 (discovery via `<link rel="formspec-registry">`).
- **Authoring MCP tools**: Assist is the filling-side analogue, explicitly not a replacement or extension. Referenced in S1.2, S1.3.
- **Ontology Specification S8.2**: The Assist spec pins the ontology spec's "implementation-defined" load order to concrete array order of documents provided to the provider. Referenced in S5.3.
- **Core Specification S5.1**: Validity rule -- "A Response is valid if and only if zero validation results with severity `error` exist." Applied field-scoped in FieldSummary `valid` definition.
- **Core Specification S3.5.5**: `empty()` function. The `filled` definition extends this to additionally cover `undefined` for host languages that distinguish it.
- **Core Specification S2.1.4**: Required bind semantics, referenced for consistency with the `filled` definition.
- **RFC 2119 / BCP 14 / RFC 8174**: MUST/SHOULD/MAY keyword interpretation.
- **RFC 8259**: JSON syntax and data types.
- **RFC 3986**: URI syntax.
- **JSON Schema draft-07**: Default schema version unless a transport binding states otherwise.
- **WebMCP API**: `navigator.modelContext`, `registerTool()`, `requestUserInteraction()` referenced in S7.2.
- **schema.org vocabulary**: 10 concept URIs mapped to HTML `autocomplete` tokens in S8.3 (givenName, familyName, email, telephone, streetAddress, addressLocality, addressRegion, postalCode, addressCountry, birthDate).

## Tool Catalog Quick Reference

| Tool Name | Category | Required? | Default Params | Returns |
|-----------|----------|-----------|----------------|---------|
| `formspec.form.describe` | Introspection | Yes | -- | FormDescription |
| `formspec.field.list` | Introspection | Yes | filter: `"relevant"` | FieldSummary[] |
| `formspec.field.describe` | Introspection | Yes | -- | FieldDescription |
| `formspec.field.help` | Introspection | Yes | audience: `"agent"` | FieldHelp |
| `formspec.form.progress` | Introspection | Yes | -- | FormProgress |
| `formspec.field.set` | Mutation | Yes | -- | SetValueResult |
| `formspec.field.bulkSet` | Mutation | Yes | -- | BulkSetResult |
| `formspec.form.validate` | Validation | Yes | mode: `"continuous"` | ValidationReport |
| `formspec.field.validate` | Validation | Yes | -- | { results: ValidationResult[] } |
| `formspec.profile.match` | Profile | No | -- | { matches: ProfileMatch[] } |
| `formspec.profile.apply` | Profile | No | confirm: undefined | ProfileApplyResult |
| `formspec.profile.learn` | Profile | No | -- | { savedConcepts, savedFields } |
| `formspec.form.pages` | Navigation | No | -- | { pages: PageProgress[] } |
| `formspec.form.nextIncomplete` | Navigation | No | scope: `"field"` | NextIncompleteResult |

## Error Codes Quick Reference

| Code | Standard? | Meaning |
|------|-----------|---------|
| `NOT_FOUND` | Yes | Path does not resolve to any field |
| `INVALID_PATH` | Yes | Path syntax is malformed |
| `INVALID_VALUE` | Yes | Value rejected by the engine |
| `NOT_RELEVANT` | Yes | Target field is currently not relevant |
| `READONLY` | Yes | Target field is readonly |
| `UNSUPPORTED` | Yes | Tool not implemented by this provider |
| `ENGINE_ERROR` | Yes | Internal engine failure |
| `x-confirmation-required` | Recommended | Confirm requested but no confirmation mechanism available |
| `x-invalid-sidecar` | Recommended | References/Ontology document has structural error or targetDefinition mismatch |

## Critical Behavioral Rules

1. **Assist is additive and MUST NOT alter core semantics.** An Assist Provider MUST NOT change core response, validation, calculation, or relevance semantics. A processor that does not implement Assist remains fully conformant to core. This is the foundational design constraint.

2. **Omitted `value` in `field.set` clears the field.** An omitted `value` property is treated as `null`. Providers MUST treat `undefined` (from omission) identically to `null` for setting field values. This means calling `field.set({ path: "x" })` without a value is a deliberate clear operation, not a no-op.

3. **`bulkSet` MAY partially succeed.** Each entry in a `bulkSet` call is independent unless a transport defines stronger atomicity. Consumers must inspect per-entry results to determine which writes were accepted and which were rejected.

4. **Mutation tools MUST reject writes to readonly and non-relevant fields.** This is not "should" -- it is a hard MUST in S2.1, S3.3, and S4.3. Providers MUST NOT silently write to these fields. The appropriate error codes are `READONLY` and `NOT_RELEVANT`.

5. **References are NOT implicitly inherited.** The resolution algorithm explicitly walks ancestor paths, but the spec states (S5.2 step 4) that ancestor context included in FieldHelp is because the provider explicitly walked ancestor targets, not because the References spec defines inheritance. This distinction matters for implementations that might assume automatic cascade.

6. **Ontology resolution uses last-loaded-document-wins for conflicts.** When multiple Ontology Documents are loaded and two bind the same path, the last-loaded document's binding wins. Load order is pinned to the concrete array order in which documents were provided to the provider (S5.3 step 1). This makes the otherwise implementation-defined ontology load order deterministic.

7. **Absent equivalence relationship type is `"exact"`.** When processing concept equivalents, if the `type` property is missing, it MUST be treated as `"exact"` with the corresponding 0.95 confidence level. This default matters for profile matching.

8. **Profile matching is concept-first, field-path is a low-confidence fallback.** The matching algorithm (S6.2) checks concept identity first, then equivalents, and only MAY fall back to `profile.fields[path]` with relationship `"field-key"` and low confidence. The 0.50 threshold is RECOMMENDED, meaning field-path-only matches with typical low confidence will likely be discarded.

9. **Profile data MUST NOT leave the device without explicit consent.** Both S6.3 and S11 require that profile data not be transmitted off-device or off-origin without explicit user consent. Providers SHOULD encrypt profile storage at rest.

10. **`confirm: true` without a mechanism MUST error, not silently apply.** When `profile.apply` is called with `confirm: true` and the provider has no confirmation mechanism, the provider MUST return `x-confirmation-required`. It MUST NOT silently apply values. This prevents agents from bypassing user consent.

11. **Tool discovery SHOULD list only supported tools.** Consumers SHOULD NOT assume all 14 catalog tools are present. The consumer should check enumeration before invocation, or handle `UNSUPPORTED` errors gracefully (S7.1).

12. **A field is `valid` only when it has zero error-severity results.** Warning and info-level validation results do not affect validity. This is the field-scoped application of the core S5.1 rule.

13. **`filled` includes `undefined` beyond core `empty()`.** The core `empty()` function covers null, empty string, and empty array. Assist extends this to additionally cover `undefined` for host languages that distinguish it (like JavaScript/TypeScript).

14. **Sidecar discovery order is: active provider, link relations, definition metadata, heuristic paths.** Consumers SHOULD try these in order. Sidecars are immutable per `(definitionUrl, definitionVersion)` and should be cached on that tuple. Missing sidecars degrade gracefully -- they never cause hard failures.

15. **Extension Mode 3 (plain HTML) is explicitly non-authoritative.** Profile matches from heuristic field detection on non-Formspec forms MUST be treated as advisory only. This is a hard boundary: Mode 3 can help but cannot be trusted.
