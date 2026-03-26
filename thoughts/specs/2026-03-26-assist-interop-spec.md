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
- **Sidecar discovery** — how consumers locate References and Ontology documents for a form
- **Transport contract** — requirements for any transport binding (discovery, invocation, results, errors)
- **Declarative annotations** — how renderers SHOULD annotate DOM elements for passive agent discovery
- **Extension integration** — how browser extensions discover, connect to, and enhance forms across sites

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

## 7. Sidecar Discovery

### 7.1 Problem

An Assist Provider needs References and Ontology documents to power context resolution and profile matching. When the host page loads `formspec-assist` and provides these documents programmatically, discovery is trivial. But external consumers — browser extensions, headless agents, testing tools — need a way to locate sidecar documents for a form they encounter in the wild.

### 7.2 Discovery Mechanisms (in priority order)

A conformant consumer SHOULD attempt discovery in this order, using the first mechanism that succeeds:

#### 1. In-page Assist Provider (highest priority)

If an Assist Provider is active on the page, consumers SHOULD use the tool catalog (`formspec.field.help`) rather than loading sidecar documents independently. The provider has already resolved and cached them.

Detection: `CustomEvent('formspec-tools-available')` or `document.querySelector('[data-formspec-form]')` with an active tool registry.

#### 2. HTML Link Elements

Pages SHOULD declare sidecar documents via `<link>` elements in the document head:

```html
<link rel="formspec-references" href="/forms/grant-2024/references.json">
<link rel="formspec-ontology" href="/forms/grant-2024/ontology.json">
<link rel="formspec-registry" href="/registries/acme.registry.json">
```

**Link relation types:**

| `rel` value | Target document |
|-------------|----------------|
| `formspec-references` | References document (per references.schema.json) |
| `formspec-ontology` | Ontology document (per ontology.schema.json) |
| `formspec-registry` | Registry document (per registry.schema.json) |

Multiple links of the same `rel` are allowed (e.g., multiple registries). Consumers MUST process all links for a given `rel`.

The `href` MUST be resolvable relative to the page's base URL. CORS applies — the target resource MUST be served with appropriate `Access-Control-Allow-Origin` headers if cross-origin.

#### 3. Definition Document Metadata

The form definition MAY include sidecar document URLs in its metadata:

```json
{
  "$formspecDefinition": "1.0.0",
  "url": "https://example.com/forms/grant-2024",
  "version": "2.1.0",
  "sidecars": {
    "references": "https://example.com/forms/grant-2024/references.json",
    "ontology": "https://example.com/forms/grant-2024/ontology.json",
    "registries": ["https://example.com/registries/acme.registry.json"]
  }
}
```

This requires the consumer to have access to the definition document. For in-page consumers, this is available from the `FormEngine` or `<formspec-render>` element's definition property. For external consumers, this may require fetching the definition URL.

> **Note:** The `sidecars` property is proposed — it does not yet exist in `definition.schema.json`. If adopted, it SHOULD be added as an optional property.

#### 4. Well-Known Path Convention

If the definition has a `url`, consumers MAY attempt to fetch sidecar documents from sibling paths:

```
{definitionUrl}                         → definition
{definitionUrl}/../references.json      → references
{definitionUrl}/../ontology.json        → ontology
```

This is a **fallback heuristic**, not a normative requirement. Servers are NOT required to serve documents at these paths. Consumers MUST handle 404s gracefully.

### 7.3 Caching

Sidecar documents are **immutable per definition version** — the `(definitionUrl, definitionVersion)` tuple is their cache key. Consumers SHOULD cache aggressively. When the form definition changes version, cached sidecars MUST be invalidated.

Extension consumers SHOULD use `chrome.storage.local` or IndexedDB for sidecar caching, keyed by `definitionUrl + definitionVersion`. HTTP cache headers (`ETag`, `Cache-Control`) SHOULD be respected for network fetches.

### 7.4 Missing Sidecars

Not all forms have References or Ontology documents. Consumers MUST handle their absence gracefully:

- **No References:** `formspec.field.help` returns empty `references` map. Context resolution provides only ontology-derived context.
- **No Ontology:** Profile matching falls back to field-key matching (§4.2 step 4). Declarative annotations fall back to label/hint text without concept enrichment. Autocomplete mapping is not available.
- **Neither:** The tool catalog still functions — introspection, mutation, and validation tools work from the FormEngine alone. Only context resolution and profile matching are degraded.

---

## 8. Extension Integration

### 8.1 Purpose

Browser extensions are a primary consumer class for this specification. They operate **across sites**, providing cross-form profile management, persistent help overlays, and form enhancement that no single-page package can offer. This section defines how extensions discover, connect to, and interact with Formspec forms.

### 8.2 Operating Modes

An extension encounters forms at three levels of capability. It MUST detect which mode applies and degrade gracefully:

#### Mode 1: Page has an Assist Provider (full capability)

The page has loaded `formspec-assist` (or another conformant Assist Provider) and registered tools.

**Detection:** Listen for `CustomEvent('formspec-tools-available')` on `document`, or check for the `data-formspec-form` attribute with an active tool registry.

**Interaction:** The extension's content script communicates via the **postMessage transport** (§5.4). It calls the full tool catalog — `formspec.field.help`, `formspec.profile.match`, `formspec.field.set`, etc. The extension is a pure consumer.

**References and Ontology:** Already loaded by the in-page provider. The extension accesses them through tool calls (`formspec.field.help` returns resolved context inline).

#### Mode 2: Page has a Formspec form but no Assist Provider (bootstrap)

The page renders a form via `<formspec-render>` or similar, but has not loaded `formspec-assist`.

**Detection:** `document.querySelector('formspec-render')` or `document.querySelector('[data-formspec-form]')` without a tool registry.

**Interaction:** The extension's content script reads the public `.engine` property from the `<formspec-render>` element and **bootstraps a lightweight Assist Provider** in the page context. The extension bundles `formspec-assist` as a content script dependency.

**References and Ontology:** The extension uses the **sidecar discovery** mechanisms (§7.2) to locate and fetch the References and Ontology documents:
1. Check for `<link rel="formspec-references">` / `<link rel="formspec-ontology">` in `<head>`
2. Check the definition's `sidecars` metadata (from `element.engine.getDefinition()`)
3. Fall back to well-known path convention
4. Cache sidecar documents keyed by `(definitionUrl, definitionVersion)`

#### Mode 3: Page has a plain HTML form (degraded)

The page has no Formspec form — just standard HTML `<form>` elements.

**Detection:** No `<formspec-render>`, no `data-formspec-form`, no `formspec-tools-available` event.

**Interaction:** The extension uses **heuristic field detection**:
- Read `<label>` associations, `name` attributes, `placeholder` text, `aria-label`
- Read `autocomplete` tokens and map them back to concept URIs (reverse of §6.3)
- Build a lightweight field model from the DOM

**References and Ontology:** Not available. Profile matching uses only:
- `autocomplete` → concept reverse mapping (high confidence for well-known tokens)
- Label text → concept fuzzy matching (low confidence)
- Field `name` → field-key profile lookup (lowest confidence)

The extension CAN still offer profile autofill in this mode, but without ontology-powered confidence levels.

### 8.3 Extension Architecture

```
┌─ Extension (Manifest V3) ───────────────────────────────┐
│                                                          │
│  ┌──────────────┐     ┌──────────────────────────────┐  │
│  │ Side Panel   │     │ Service Worker                │  │
│  │              │     │                               │  │
│  │ • Profile UI │     │ • Cross-tab profile sync      │  │
│  │ • Help panel │     │ • Sidecar cache management    │  │
│  │ • Progress   │     │ • Profile storage (encrypted) │  │
│  │ • Settings   │     │ • Multi-profile management    │  │
│  └──────┬───────┘     └──────────────┬───────────────┘  │
│         │                            │                   │
│  ┌──────▼────────────────────────────▼───────────────┐  │
│  │ Content Script (per tab)                           │  │
│  │                                                    │  │
│  │ • Mode detection (§8.2)                            │  │
│  │ • postMessage transport ↔ in-page Assist Provider  │  │
│  │ • Bootstrap formspec-assist when needed (Mode 2)   │  │
│  │ • Heuristic field detection (Mode 3)               │  │
│  │ • Sidecar discovery (§7.2)                         │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 8.4 Extension-Specific Responsibilities

These concerns belong to the extension layer, NOT to the spec or in-page implementation:

| Concern | Description |
|---------|-------------|
| **Cross-site profile persistence** | Extension storage API. Profiles persist across sites and browser sessions. |
| **Multi-profile management** | "Fill as: My Organization / Personal / Client: Acme Corp" — side panel UI for switching active profile. |
| **Cross-tab learning** | When a user fills a form on Tab A, the extension calls `formspec.profile.learn`, then offers matched values on Tab B. The service worker coordinates this. |
| **Form memory** | Save partial responses locally, restore on revisit. Keyed by `(definitionUrl, definitionVersion)`. |
| **Privacy controls** | Per-site permissions (allow/deny autofill), data deletion, profile export/import, encryption settings. |
| **Sidecar caching** | Cache fetched References and Ontology documents in extension storage. Invalidate on definition version change. |
| **Non-formspec form detection** | Heuristic HTML form scanning for Mode 3 (§8.2). |
| **Side panel rendering** | Field help overlay, profile match preview, form progress display. |

### 8.5 Profile Portability

Extensions SHOULD support profile import/export using the `UserProfile` structure defined in §4.1. The export format is JSON conforming to `profile.schema.json` (proposed):

```json
{
  "$formspecProfile": "1.0.0",
  "id": "org-acme",
  "label": "Acme Corporation",
  "created": "2026-01-15T10:00:00Z",
  "updated": "2026-03-26T14:30:00Z",
  "concepts": {
    "https://irs.gov/terms/employer-identification-number": {
      "value": "12-3456789",
      "confidence": 1.0,
      "source": { "type": "manual", "timestamp": "2026-01-15T10:00:00Z" },
      "lastUsed": "2026-03-20T09:15:00Z",
      "verified": true
    },
    "https://schema.org/name": {
      "value": "Acme Corporation",
      "confidence": 1.0,
      "source": { "type": "form-fill", "formUrl": "https://grants.gov/form/sf424", "fieldPath": "orgName", "timestamp": "2026-02-10T11:00:00Z" },
      "lastUsed": "2026-03-20T09:15:00Z",
      "verified": true
    }
  },
  "fields": {}
}
```

This enables:
- **Backup/restore** — user exports profiles before switching browsers
- **Sharing** — organization shares a base profile with employees (non-PII fields only)
- **Migration** — move profiles between extension and in-page `formspec-assist` implementations
- **Testing** — pre-built profiles for E2E tests

### 8.6 Extension Discovery Signal

For Mode 1 (§8.2), the in-page Assist Provider advertises its tool catalog to extensions via a DOM event:

```typescript
// Provider emits after tool registration
document.dispatchEvent(new CustomEvent('formspec-tools-available', {
  detail: {
    version: '1.0.0',
    tools: [
      { name: 'formspec.form.describe', description: '...', readOnly: true },
      { name: 'formspec.field.set', description: '...', readOnly: false },
      // ...
    ],
    definitionUrl: 'https://example.com/forms/grant-2024',
    definitionVersion: '2.1.0'
  }
}));
```

Extensions listen for this event on `document`. If the event fires after the content script loads, the extension SHOULD also check for the `data-formspec-form` attribute as a synchronization fallback.

For **extension → provider** communication initiation:

```typescript
// Extension content script announces itself
document.dispatchEvent(new CustomEvent('formspec-consumer-connect', {
  detail: {
    type: 'extension',
    capabilities: ['read', 'write', 'profile'],
    extensionId: chrome.runtime.id
  }
}));
```

The provider MAY use this to adjust behavior (e.g., include `human` audience references when an extension with UI capability connects).

---

## 9. Security Considerations

- Providers MUST treat all tool inputs as untrusted. Validate paths, types, and values before acting on them.
- Providers MUST NOT write to non-relevant or readonly fields without explicit override.
- Providers MUST NOT block persistence based on validation state (per Core spec VE-05).
- Profile data is PII. Providers MUST NOT transmit it without explicit user consent. Storage SHOULD be encrypted at rest.
- `formspec.profile.apply` with `confirm: true` MUST obtain user confirmation before writing. The mechanism is transport-defined.
- The `formspec.field.help` tool SHOULD filter references by audience — agent consumers receive `agent` + `both` entries; human-facing consumers receive `human` + `both`.
- Extensions that bootstrap an Assist Provider (Mode 2, §8.2) inject code into the page context. This code runs with the page's origin — extensions MUST NOT expose privileged extension APIs to injected code.
- Sidecar document fetches (§7.2) are subject to CORS. Extensions MAY use `chrome.declarativeNetRequest` or background fetch to bypass CORS for sidecar documents, but MUST validate that fetched documents conform to the expected schema before processing.
- Extensions SHOULD use the WebAuthn / passkey-based profile encryption model defined in the Formy Extension Specification for protecting profile data at rest.
