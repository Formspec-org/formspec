# Formspec Assist Specification — Form Agent Interoperability

**Date:** 2026-03-26
**Status:** Draft
**Spec path:** `specs/assist/assist-spec.md` (proposed)

---

## 1. Introduction

### 1.1 Purpose

This specification defines a **multimodal interoperability protocol** for AI agents, browser extensions, accessibility tools, and automation systems to discover, inspect, manipulate, and manage Formspec forms. It is the filling-side counterpart to the authoring-side MCP tools defined in `formspec-mcp`.

The spec is **technology-agnostic** — it defines tool shapes, data contracts, resolution algorithms, and transport requirements without mandating a specific runtime (WebMCP, MCP, REST, postMessage, etc.). Conformant implementations MAY bind to any transport that can carry JSON tool calls.

### 1.2 Scope

This specification covers:

- **Tool catalog** — the normative set of tools an agent can invoke on a live form
- **Context resolution** — how field-level help is assembled from References and Ontology documents
- **Profile matching** — how cross-form data reuse works via ontology concept alignment
- **Transport contract** — requirements for any transport binding (discovery, invocation, results, errors)
- **Declarative annotations** — how renderers SHOULD annotate DOM elements for passive agent discovery

This specification does NOT cover:

- Form rendering (see Component spec)
- Form authoring (see MCP server)
- Conversational UX / LLM integration (see `formspec-assist-chat`)
- Form definition structure (see Core spec)

### 1.3 Relationship to Other Specs

| Spec | Relationship |
|------|-------------|
| **Core** | Assist tools read and write form state defined by the Core processing model |
| **References** | Context resolution consumes References documents (pure metadata, no behavior change) |
| **Ontology** | Profile matching consumes Ontology documents (pure metadata, no behavior change) |
| **Component** | Declarative annotations extend rendered output without altering component semantics |
| **WebMCP (W3C)** | The recommended browser transport binding; the spec is compatible but not coupled |
| **MCP** | An alternative transport binding for server-side agents |

### 1.4 Conformance Levels

- **Assist Provider** — a system that exposes the tool catalog for a live form (e.g., `formspec-assist` package)
- **Assist Consumer** — a system that invokes tools (e.g., browser agent, extension, chat UI)
- **Passive Provider** — a renderer that emits declarative annotations without the full tool catalog

A conformant Assist Provider MUST implement all tools in the Core tool category. Profile and Navigation tools are OPTIONAL.

---

## 2. Tool Catalog

### 2.1 Tool Naming

All tools use the namespace `formspec.` with dot-separated categories: `formspec.{category}.{action}`.

### 2.2 Tool Result Contract

Every tool returns a result envelope:

```typescript
interface ToolResult {
  content: Array<{ type: "text"; text: string }>;  // JSON-stringified payload
  isError?: boolean;
}
```

The `text` field contains a JSON-stringified domain object. Consumers MUST parse the `text` field to access structured data.

Error results set `isError: true` and the `text` field contains a JSON object with `code` and `message`:

```typescript
interface ToolError {
  code: "NOT_FOUND" | "INVALID_PATH" | "INVALID_VALUE" | "NOT_RELEVANT" | "READONLY" | "ENGINE_ERROR";
  message: string;
  path?: string;
}
```

### 2.3 Core Tools (REQUIRED)

#### Introspection

**`formspec.form.describe`** — Describe the form's structure and current state.

- Input: `{}` (no parameters)
- Output: `{ title, description, url?, version?, fieldCount, pageCount, status }`
- Annotations: `readOnlyHint: true`

**`formspec.field.list`** — List all fields with summary state.

- Input: `{ filter?: "all" | "required" | "empty" | "invalid" | "relevant" }` (default: `"relevant"`)
- Output: `Array<{ path, label, dataType, required, relevant, readonly, filled, valid }>`
- Annotations: `readOnlyHint: true`

**`formspec.field.describe`** — Describe a single field with full context.

- Input: `{ path: string }`
- Output: `FieldDescription` (see §2.6)
- Annotations: `readOnlyHint: true`
- Error: `NOT_FOUND` if path does not resolve to a field item

**`formspec.field.help`** — Get contextual help for a field from References and Ontology.

- Input: `{ path: string }`
- Output: `FieldHelp` (see §3)
- Annotations: `readOnlyHint: true`
- Error: `NOT_FOUND` if path does not resolve

**`formspec.form.progress`** — Get form completion status.

- Input: `{}`
- Output: `{ total, filled, valid, required, requiredFilled, complete, pages?: Array<{ id, title, fieldCount, filledCount, complete }> }`
- Annotations: `readOnlyHint: true`
- `complete` is true when all required fields are filled and the form is valid.

#### Mutation

**`formspec.field.set`** — Set a field value.

- Input: `{ path: string, value: unknown }`
- Output: `{ accepted: boolean, value: unknown, validation: ValidationResult[] }`
- `accepted` is false if the field is readonly or not relevant. Providers MUST NOT silently write to non-relevant or readonly fields.
- Consumers SHOULD use `requestUserInteraction()` (or transport equivalent) before bulk writes.
- Error: `NOT_FOUND`, `NOT_RELEVANT`, `READONLY`, `INVALID_VALUE`

**`formspec.field.bulkSet`** — Set multiple field values atomically.

- Input: `{ entries: Array<{ path: string, value: unknown }> }`
- Output: `{ results: Array<{ path, accepted, validation: ValidationResult[] }>, summary: { accepted, rejected, errors } }`
- Partial success is allowed — each entry is independent. The `summary` reports aggregate counts.

#### Validation

**`formspec.form.validate`** — Get the full validation report.

- Input: `{ mode?: "continuous" | "submit" }` (default: `"continuous"`)
- Output: `ValidationReport` (per validationReport.schema.json)
- Annotations: `readOnlyHint: true`

**`formspec.field.validate`** — Get validation results for a single field.

- Input: `{ path: string }`
- Output: `{ results: ValidationResult[] }`
- Annotations: `readOnlyHint: true`

### 2.4 Profile Tools (OPTIONAL)

**`formspec.profile.match`** — Find profile entries that match form fields.

- Input: `{ profileId?: string }`
- Output: `{ matches: Array<ProfileMatch> }` (see §4.3)
- Annotations: `readOnlyHint: true`

**`formspec.profile.apply`** — Apply matched profile entries to the form.

- Input: `{ matches: Array<{ path: string, value: unknown }>, confirm?: boolean }`
- Output: `{ filled: Array<{ path, value }>, skipped: Array<{ path, reason }>, validation: ValidationReport }`
- When `confirm` is true, the provider MUST obtain user confirmation before writing. Transport bindings define how (WebMCP: `requestUserInteraction()`, MCP: human-in-the-loop prompt, etc.)

**`formspec.profile.learn`** — Save current form values to the profile.

- Input: `{ profileId?: string }`
- Output: `{ savedConcepts: number, savedFields: number }`
- Only saves fields that have ontology concept bindings (concept-keyed) or stable identifiers (field-keyed fallback).

### 2.5 Navigation Tools (OPTIONAL)

**`formspec.form.pages`** — Get page structure.

- Input: `{}`
- Output: `{ pages: Array<{ id, title, fieldCount, filledCount, complete }> }`
- Annotations: `readOnlyHint: true`

**`formspec.form.nextIncomplete`** — Get the next field or page needing attention.

- Input: `{ scope?: "field" | "page" }` (default: `"field"`)
- Output: `{ path?, pageId?, label, reason: "empty" | "invalid" | "required" }`
- Annotations: `readOnlyHint: true`

### 2.6 FieldDescription

Returned by `formspec.field.describe`:

```typescript
interface FieldDescription {
  path: string;
  label: string;
  hint?: string;
  dataType: string;
  widget?: string;

  // State
  value: unknown;
  required: boolean;
  relevant: boolean;
  readonly: boolean;
  valid: boolean;
  validation: ValidationResult[];

  // Options (for choice fields)
  options?: Array<{ value: string; label: string }>;

  // Computed
  calculated?: boolean;
  expression?: string;         // FEL expression (for transparency)

  // Cardinality (for repeat groups)
  repeatIndex?: number;
  repeatCount?: number;
  minRepeat?: number;
  maxRepeat?: number;

  // Context (from References + Ontology, see §3)
  help: FieldHelp;
}
```

---

## 3. Context Resolution

### 3.1 FieldHelp

The `FieldHelp` structure aggregates contextual knowledge from References and Ontology documents for a single field:

```typescript
interface FieldHelp {
  path: string;
  label: string;

  // From References document — keyed by all 12 spec-defined types
  references: Partial<Record<ReferenceType, Array<ReferenceEntry>>>;

  // From Ontology document
  concept?: ConceptBinding;
  equivalents?: Array<ConceptEquivalent>;

  // Synthesized (OPTIONAL — providers MAY leave empty)
  summary?: string;
  commonMistakes?: string[];
}

type ReferenceType =
  | "documentation" | "example" | "regulation" | "policy" | "glossary"
  | "schema" | "vector-store" | "knowledge-base" | "retrieval"
  | "tool" | "api" | "context";

interface ReferenceEntry {
  title: string;
  uri?: string;
  content?: string;
  excerpt?: string;
  rel?: string;          // constrains, defines, exemplifies, etc.
  priority?: string;     // primary, supplementary, background
}
```

### 3.2 Resolution Algorithm

A conformant provider MUST resolve `FieldHelp` as follows:

**References resolution:**

1. Walk the entire `references` array in the References document.
2. Collect entries whose `target` matches the field's path OR `#` (form-level).
3. **References do NOT inherit.** A reference targeting `demographics` does NOT apply to `demographics.dob`. Consumers must walk the tree — do not assume inheritance.
4. Filter by audience: include `agent` and `both` entries for agent consumers; include `human` and `both` for human-facing consumers.
5. Resolve `$ref` pointers to `referenceDefs`.
6. Group by `type`. Rank within each type by `priority` (primary > supplementary > background).

**Ontology resolution (three-level cascade):**

1. **Ontology Document binding** — look up `ontology.concepts[fieldPath]` where `fieldPath` is the full Bind.path (e.g., `demographics.dob`, not `dob`).
2. **Registry concept entry** — if no document binding, check registry entries matching the field's `semanticType`.
3. **`semanticType` literal** — if neither above resolves, use the field's `semanticType` as a literal URI.

When processing `equivalents`, if `type` is absent, treat the relationship as `exact` (per Ontology spec default).

---

## 4. Profile Matching

### 4.1 Profile Structure

```typescript
interface UserProfile {
  id: string;
  label: string;
  created: string;
  updated: string;
  concepts: Record<string, ProfileEntry>;       // keyed by concept URI
  fields: Record<string, ProfileEntry>;          // keyed by field path (fallback)
}

interface ProfileEntry {
  value: unknown;
  confidence: number;              // 0–1
  source: ProfileEntrySource;
  lastUsed: string;
  verified: boolean;
}
```

### 4.2 Matching Algorithm

Given a form with an Ontology document and a UserProfile, the provider matches fields to profile entries:

1. Resolve the field's concept URI via the three-level cascade (§3.2).
2. Look up `profile.concepts[conceptURI]` for an exact match.
3. If no exact match, check the field's `equivalents` array:
   - `exact` or absent `type` → confidence 0.95
   - `close` → confidence 0.80
   - `broader` / `narrower` → confidence 0.60
   - `related` → confidence 0.40
4. If no concept match, check `profile.fields[fieldPath]` as a fallback (confidence 0.30).
5. Discard matches below a provider-defined threshold (RECOMMENDED: 0.50).

### 4.3 ProfileMatch

```typescript
interface ProfileMatch {
  path: string;
  concept?: string;              // concept URI that matched
  value: unknown;
  confidence: number;
  relationship?: string;         // "exact", "close", "broader", "narrower", "related", "field-key"
  source: ProfileEntrySource;
}
```

### 4.4 Storage

This spec does not mandate a storage backend. Providers SHOULD support pluggable storage. Providers MUST NOT transmit profile data without explicit user consent.

---

## 5. Transport Bindings

### 5.1 Requirements for Any Transport

A conformant transport binding MUST:

1. Support tool discovery — consumers can enumerate available tools with their names, descriptions, and input schemas.
2. Support tool invocation — consumers can call a tool by name with JSON input and receive a JSON result.
3. Preserve the `ToolResult` envelope — `{ content: [{ type: "text", text }], isError? }`.
4. Support human-in-the-loop — provide a mechanism for the provider to pause execution and obtain user confirmation.

### 5.2 WebMCP Binding (RECOMMENDED for browsers)

Tools registered via `navigator.modelContext.registerTool()`. Human-in-the-loop via `client.requestUserInteraction()`. Discovery is browser-mediated.

When native WebMCP is unavailable, a conformant implementation SHOULD provide a polyfill that implements the `ModelContext` interface and routes invocations through an alternative transport.

### 5.3 MCP Binding (RECOMMENDED for server-side)

Tools registered as MCP tool declarations. Human-in-the-loop via MCP's built-in prompting. Discovery via `tools/list`.

### 5.4 postMessage Binding (for browser extensions)

Tool discovery via `CustomEvent('formspec-tools-available', { detail: toolList })` on `document`. Tool invocation via `window.postMessage({ type: 'formspec-tool-call', name, input, callId })`. Results via `window.postMessage({ type: 'formspec-tool-result', callId, result })`.

### 5.5 HTTP Binding (for remote agents)

Tools discoverable via `GET /formspec/tools`. Tool invocation via `POST /formspec/tools/{name}` with JSON body. Results as JSON response with the `ToolResult` envelope.

---

## 6. Declarative Annotations

### 6.1 Purpose

Renderers SHOULD annotate DOM elements with metadata that enables passive agent discovery — agents that inspect the DOM without invoking the full tool catalog.

### 6.2 Annotation Attributes

On the form container element:
- `data-formspec-form` — presence indicates a Formspec form
- `data-formspec-title` — form title
- `data-formspec-url` — definition URL
- `data-formspec-version` — definition version

On field input elements:
- `toolparamdescription` — field description for agents (WebMCP declarative attribute)
- `autocomplete` — HTML autocomplete token mapped from ontology concept (§6.3)
- `aria-label` / `aria-describedby` — standard accessibility (always present regardless of agent support)

### 6.3 Ontology-to-Autocomplete Mapping

Renderers SHOULD map well-known ontology concept URIs to HTML `autocomplete` token values:

| Concept URI | `autocomplete` value |
|-------------|---------------------|
| `schema.org/givenName` | `given-name` |
| `schema.org/familyName` | `family-name` |
| `schema.org/email` | `email` |
| `schema.org/telephone` | `tel` |
| `schema.org/streetAddress` | `street-address` |
| `schema.org/addressLocality` | `address-level2` |
| `schema.org/addressRegion` | `address-level1` |
| `schema.org/postalCode` | `postal-code` |
| `schema.org/addressCountry` | `country` |
| `schema.org/birthDate` | `bday` |

This mapping is advisory. Renderers MAY extend it with additional concept-to-autocomplete mappings.

### 6.4 Injection Point

For `<formspec-render>`, declarative annotations are injected via `AdapterContext.toolAnnotations`. The webcomponent populates this from the field's label/hint and ontology concept binding (using the full Bind.path as the key). Adapters that do not recognize `toolAnnotations` silently ignore it — existing adapters (USWDS, Tailwind) are unaffected.

---

## 7. Security Considerations

- Providers MUST treat all tool inputs as untrusted. Validate paths, types, and values before acting on them.
- Providers MUST NOT write to non-relevant or readonly fields without explicit override.
- Providers MUST NOT block persistence based on validation state (per Core spec VE-05).
- Profile data is PII. Providers MUST NOT transmit it without explicit user consent. Storage SHOULD be encrypted at rest.
- `formspec.profile.apply` with `confirm: true` MUST obtain user confirmation before writing. The mechanism is transport-defined.
- The `formspec.field.help` tool SHOULD filter references by audience — agent consumers receive `agent` + `both` entries; human-facing consumers receive `human` + `both`.
