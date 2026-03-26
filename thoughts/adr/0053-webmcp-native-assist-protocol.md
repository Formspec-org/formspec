# ADR 0053: WebMCP-Native Agent Protocol for Form-Filling Assistance

**Status:** Proposed
**Date:** 2026-03-26

## Context

### The Problem

People filling out complex forms (grant applications, clinical intake, tax filings, compliance reports) lack tooling that connects them to the contextual knowledge Formspec already captures. Three persistent gaps:

1. **"What does this mean?"** — Fields reference regulations and domain jargon. Formspec has References documents with per-field contextual knowledge (regulations, documentation, examples), but nothing surfaces them to fillers or AI agents at runtime.

2. **"I already answered this."** — The same data (EIN, address, org name) gets re-entered across dozens of forms. Formspec has Ontology documents that give fields semantic identity (concept URIs, cross-system equivalents), but nothing uses these for cross-form data reuse.

3. **"Am I doing this right?"** — FormEngine validates reactively, but nothing guides fillers proactively or makes validation state accessible to external agents.

### The Protocol Question

An assistive agent needs a protocol to read form structure, write field values, query references/ontology context, and manage user profiles. The question is: **what protocol shape?**

**Options considered:**

1. **Custom protocol** — invent request/response envelopes, define our own transport bindings (postMessage, WebSocket, HTTP), build bridges to each consumer.

2. **MCP (Model Context Protocol)** — expose filling tools alongside the existing authoring tools in `formspec-mcp`. Requires a server process; browser-only use cases need a relay.

3. **WebMCP (W3C Draft, Feb 2026)** — build directly on the browser-native `navigator.modelContext` API. Register every assist capability as a WebMCP tool. Shim the API for browsers that don't support it yet.

### Why WebMCP

WebMCP is a W3C Draft Community Group Report (Google + Microsoft, Web Machine Learning CG) shipping in Chrome 146 Canary. It defines `navigator.modelContext.registerTool()` — a browser-native API for web pages to expose structured tools to AI agents. The browser mediates all agent-tool interaction (same security model as CORS/CSP).

Key alignment with Formspec:

- **Same data model.** WebMCP tools use JSON Schema (draft-07) for input schemas — identical to Formspec's schema foundation. Tool results use typed content blocks (`{ type: "text", text: "..." }`).

- **Declarative HTML bridge.** WebMCP defines `toolname`, `tooldescription`, `toolparamdescription` HTML attributes on form elements. The browser auto-synthesizes tool schemas from annotated forms. Formspec's structured field metadata (labels, hints, ontology concepts) maps directly to these attributes.

- **Human-in-the-loop.** `ModelContextClient.requestUserInteraction()` provides browser-mediated user confirmation — essential for autofill consent and destructive actions.

- **Progressive enhancement.** A polyfill shim implements `navigator.modelContext` for non-WebMCP browsers, routing tool calls through postMessage (extensions), CustomEvent (same-page), MCP-over-WebSocket (Claude Code), or in-process (own UI). When native WebMCP arrives, the shim becomes a no-op — zero migration.

### Why Not the Alternatives

**Custom protocol** creates an island. Every consumer (browser extensions, AI agents, same-page UI) needs a custom binding. We'd reinvent discovery, serialization, and security. WebMCP gives us all three from the browser for free.

**MCP alone** requires a server process. Browser-only form filling (the primary use case) would need a WebSocket relay, adding deployment complexity. MCP is the right protocol for server-side authoring tools (`formspec-mcp`) but not for in-page filling assistance.

Building on WebMCP does not preclude MCP. The shim's `MCPWebSocketTransport` can bridge WebMCP tools to an MCP relay when server-side agents need access.

## Decision

**Build `formspec-assist` as a WebMCP-native package.** Every form-filling assistance capability is registered as a WebMCP tool via `navigator.modelContext.registerTool()`. A polyfill shim provides the API for browsers without native support.

### Package: `formspec-assist` at Layer 2

Depends on `formspec-engine` (Layer 1) and `formspec-types` (Layer 0). No dependency on `formspec-webcomponent`, `formspec-chat`, `formspec-core`, or any renderer.

**No lateral dependency with `formspec-webcomponent`.** Both are Layer 2. The assist sidecar discovers `<formspec-render>` elements via public `.engine` property and DOM events — no import. The webcomponent handles its own declarative `tool*` attribute emission via `AdapterContext` without importing from assist.

### Tool Surface

~15 tools in four categories, registered via `navigator.modelContext.registerTool()`:

| Category | Tools | Annotations |
|----------|-------|-------------|
| **Introspection** | `formspec.form.describe`, `formspec.field.list`, `formspec.field.describe`, `formspec.field.help`, `formspec.form.progress` | `readOnlyHint: true` |
| **Mutation** | `formspec.field.set`, `formspec.field.bulkSet` | default (destructive) |
| **Profile** | `formspec.profile.match`, `formspec.profile.apply`, `formspec.profile.learn` | apply uses `requestUserInteraction()` |
| **Validation/Nav** | `formspec.form.validate`, `formspec.field.validate`, `formspec.form.pages`, `formspec.form.nextIncomplete` | `readOnlyHint: true` |

All tools return `{ content: [{ type: "text", text: JSON.stringify(result) }] }` per the WebMCP result contract.

### WebMCP Shim Architecture

```
┌─────────────────────────────────────────────────┐
│  navigator.modelContext (native or shimmed)       │
│                                                   │
│  registerTool() / unregisterTool()                │
│  provideContext()                                  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Pluggable Transports (shim only)            │ │
│  │  • InProcessTransport   — same-page UI       │ │
│  │  • PostMessageTransport — browser extensions  │ │
│  │  • CustomEventTransport — loose DOM coupling  │ │
│  │  • MCPWebSocketTransport — Claude Code relay  │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

The shim installs via `Object.defineProperty(navigator, 'modelContext', { value: shim, configurable: true })` — `configurable: true` allows native WebMCP to replace it if the browser updates mid-session.

### Three Layers of Agent Accessibility

From a single codebase, formspec forms become accessible to AI agents at three levels:

1. **Imperative WebMCP** (primary) — Rich tools with profile matching, validation, contextual help. Requires `formspec-assist` sidecar.

2. **Declarative WebMCP** (supplementary) — `toolparamdescription` attributes on input elements, populated from field labels + ontology concepts via `AdapterContext.toolAnnotations`. Handled by the webcomponent's adapter pipeline. No `<form>` tag (renderer outputs `div.formspec-container`), so form-level discovery relies on imperative tools.

3. **ARIA + autocomplete** (fallback) — Ontology concept URIs mapped to HTML `autocomplete` tokens (`schema.org/givenName` → `given-name`). Works for all browsers, password managers, and a11y-tree-based agents (Claude extension, screen readers).

### Key Integration Details

**FormEngine API:** Tools use `FieldViewModel` / `FormViewModel` as the primary read surface (richer than raw signals). Field mutation uses `getFieldVM(path).setValue(value)` for path-resolved writes (engine's `setValue()` takes a flat name, not a dot-path). Two new public methods are prerequisites: `getFieldPaths(): string[]` and `getProgress()`.

**References:** Context resolver walks the full references array by target path — references do NOT inherit parent-to-child. Surfaces all 12 spec-defined reference types (not just regulations and documentation).

**Ontology:** Three-level resolution cascade per spec §3.4: (1) Ontology Document binding, (2) Registry concept entry by `semanticType`, (3) `semanticType` literal. Concept keys use full Bind.path syntax (`demographics.dob`, not `dob`). Default equivalent type is `exact` when absent.

**Profile Store:** Concept-keyed `localStorage` backend. Matching uses ontology concept URIs with SKOS relationship confidence: exact > close > broader/narrower > system+code. `StorageBackend` interface to be extracted to `formspec-types` (Layer 0) or duplicated — cannot import from `formspec-chat` (Layer 5).

## Consequences

### Positive

- **Standards-aligned.** Building on a W3C draft with Google + Microsoft backing means the protocol will gain native browser support. Formspec forms become agent-accessible without any extension or server process.

- **Progressive enhancement.** The shim works today in all browsers. As WebMCP ships natively (Chrome first, Edge following), the shim gracefully degrades to a no-op. Zero migration for form authors or consumers.

- **Single protocol, multiple transports.** One set of tool definitions serves in-page UI, browser extensions, MCP relays, and native browser agents. No protocol translation layers.

- **Clean sidecar architecture.** No lateral dependencies. Assist discovers renderers via public DOM APIs. Adapters emit declarative attributes independently. Each package remains independently deployable.

- **Leverages existing metadata.** References, Ontology, and FormEngine validation are already in the spec. This ADR adds an orchestration layer, not new data models.

### Negative

- **WebMCP is a draft, not a standard.** The API may change. Mitigated by the shim: if the native API changes, only the shim needs updating — tool definitions stay the same.

- **Chrome-only for native support (March 2026).** Firefox and Safari are engaged but have no timeline. Mitigated entirely by the shim.

- **No resources in WebMCP.** MCP has tools AND resources; WebMCP is tools-only. Reference documents, ontology documents, and profile data must be served through tool calls (e.g., `formspec.field.describe` returns reference data inline) rather than as browsable resources. This is a minor ergonomic loss for MCP-native agents.

- **New public APIs needed on FormEngine.** `getFieldPaths()` and `getProgress()` must be added before assist can fully function. These are generally useful and not assist-specific.

### Risks

- **WebMCP provideContext() overwrite security** (W3C issue #101): Third-party scripts on the same page can overwrite first-party tools. Mitigated by using `registerTool()` (per-tool) rather than `provideContext()` (bulk replace) for assist tools.

- **Profile store holds PII.** The concept-keyed store accumulates personal data across forms. The assist layer provides the mechanism (encrypted storage, explicit save actions); the host app provides the consent policy. Not a protocol risk, but an implementation responsibility.
