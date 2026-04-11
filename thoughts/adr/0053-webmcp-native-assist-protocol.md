# ADR 0053: WebMCP-Native Agent Protocol for Form-Filling Assistance

**Status:** Proposed
**Date:** 2026-03-26

## Context

### The Problem

People filling out complex forms (grant applications, clinical intake, tax filings, compliance reports) lack tooling that connects them to the contextual knowledge Formspec already captures. Three persistent gaps:

1. **"What does this mean?"** — Fields reference regulations and domain jargon. Formspec has References documents with per-field contextual knowledge (regulations, documentation, examples), but nothing surfaces them to fillers or AI agents at runtime.

2. **"I already answered this."** — The same data (EIN, address, org name) gets re-entered across dozens of forms. Formspec has Ontology documents that give fields semantic identity (concept URIs, cross-system equivalents), but nothing uses these for cross-form data reuse.

3. **"Am I doing this right?"** — FormEngine validates reactively, but nothing guides fillers proactively or makes validation state accessible to external agents.

### The Design Question

This requires three distinct things:

1. **A specification** — a formal, technology-agnostic standard for how agents interact with forms (tool shapes, resolution algorithms, transport contracts). Like the Core or Component specs, but for multimodal interoperability.
2. **A reference implementation** — the package that implements the spec with WebMCP as the primary transport.
3. **A conversational layer** — an LLM-powered chat package that consumes the spec's tools to provide Q&A, guided walkthroughs, and proactive suggestions.

These must be decoupled: the spec defines what tools exist and how they behave, the implementation makes them available, and the chat package is one consumer among many (alongside browser extensions, accessibility tools, and automation scripts).

### The Protocol Question

The implementation needs a transport. Options considered:

1. **Custom protocol** — invent request/response envelopes, define our own transport bindings.
2. **MCP** — expose filling tools alongside authoring tools. Requires a server process.
3. **WebMCP (W3C Draft, Feb 2026)** — build on the browser-native `navigator.modelContext` API. Shim for browsers without support.

### Why WebMCP

WebMCP is a W3C Draft Community Group Report (Google + Microsoft, Web Machine Learning CG) shipping in Chrome 146 Canary. Key alignment:

- **Same data model.** JSON Schema (draft-07) input schemas. Typed content block results.
- **Declarative HTML bridge.** `tool*` attributes on form elements — maps directly to Formspec's structured metadata.
- **Human-in-the-loop.** `requestUserInteraction()` for autofill consent.
- **Progressive enhancement.** Polyfill shim → native browser support. Zero migration.

Building on WebMCP does not preclude MCP. The shim's `MCPWebSocketTransport` bridges to MCP relays when server-side agents need access.

## Decision

### Three-layer architecture:

```
┌──────────────────────────────────────────────────────────────┐
│  Formspec Assist Specification                                │
│  specs/assist/assist-spec.md                                  │
│  Normative: tool catalog, context resolution, profile         │
│  matching, transport contracts, declarative annotations        │
│  Technology-agnostic. No runtime dependency.                  │
├──────────────────────────────────────────────────────────────┤
│  formspec-assist  (Layer 2)                                   │
│  Reference implementation. WebMCP-native + shim.              │
│  Context resolver, profile store, transport bindings.         │
│  No LLM. No rendering.                                       │
├──────────────────────────────────────────────────────────────┤
│  formspec-assist-chat  (Layer 5)                              │
│  Conversational consumer. LLM-powered Q&A, guided flow,      │
│  proactive suggestions, document extraction.                  │
│  Calls assist tools — never bypasses them.                    │
└──────────────────────────────────────────────────────────────┘
```

### 1. The Specification

A new normative spec at `specs/assist/assist-spec.md` defining:

- **Tool catalog** (~15 tools in four categories: introspection, mutation, profile, navigation) with input schemas, output shapes, error codes, and annotations
- **Context resolution algorithm** — how FieldHelp is assembled from References (walk-the-tree, all 12 types, audience filtering) and Ontology (three-level cascade: doc binding → registry concept → semanticType)
- **Profile matching algorithm** — concept-keyed storage, SKOS relationship confidence levels (exact > close > broader/narrower > system+code)
- **Transport bindings** — requirements for any transport (discovery, invocation, results, human-in-the-loop) with specific bindings for WebMCP, MCP, postMessage, and HTTP
- **Declarative annotations** — how renderers SHOULD annotate DOM elements (`toolparamdescription`, `autocomplete`, `data-formspec-*`)

The spec is technology-agnostic. It defines WHAT tools exist and HOW they behave, not what runtime they run on.

### 2. The Implementation: `formspec-assist` at Layer 2

Depends on `formspec-engine` (Layer 1) and `formspec-types` (Layer 0). No dependency on any renderer, chat package, or MCP server.

**No lateral dependency with `formspec-webcomponent`.** Both are Layer 2. The assist sidecar discovers `<formspec-render>` elements via public `.engine` property and DOM events — no import. The webcomponent handles its own declarative `tool*` attribute emission via `AdapterContext` without importing from assist.

**WebMCP shim:** Installs `navigator.modelContext` polyfill with `configurable: true`. Pluggable transports: InProcess, PostMessage, CustomEvent, MCPWebSocket. The shim becomes a no-op when native WebMCP is present.

**Engine API prerequisites:** `getFieldPaths(): string[]` and `getProgress()`. Tools use `FieldViewModel`/`FormViewModel` as primary read surface. Field mutation via `getFieldVM(path).setValue(value)`.

### 3. The Chat Package: `formspec-assist-chat` at Layer 5

Depends on `formspec-assist` (Layer 2) and `formspec-types` (Layer 0). Pluggable LLM adapter (Anthropic, OpenAI, mock).

**A pure consumer of assist tools.** Every form mutation goes through `formspec.field.set`. Every context lookup through `formspec.field.help`. The chat layer adds LLM intelligence but never bypasses the tool interface. Features:

- **Conversational Q&A** — LLM grounded in FieldHelp context from references + ontology
- **Guided walkthrough** — step-by-step flow driven by `formspec.form.pages` + `formspec.field.list`
- **Proactive suggestions** — watches form state, emits autofill/correction/explanation suggestions
- **Document extraction** — upload → LLM extraction → ontology matching → `formspec.field.bulkSet`

**No LLM fallback:** Without an LLM adapter, `formspec.field.help` still returns structured FieldHelp. The chat layer enriches it conversationally but is not required for basic agent interop.

### Tool Surface (from the spec)

| Category | Tools | Annotations |
|----------|-------|-------------|
| **Introspection** | `formspec.form.describe`, `formspec.field.list`, `formspec.field.describe`, `formspec.field.help`, `formspec.form.progress` | `readOnlyHint: true` |
| **Mutation** | `formspec.field.set`, `formspec.field.bulkSet` | default |
| **Profile** | `formspec.profile.match`, `formspec.profile.apply`, `formspec.profile.learn` | apply uses `requestUserInteraction()` |
| **Navigation** | `formspec.form.validate`, `formspec.field.validate`, `formspec.form.pages`, `formspec.form.nextIncomplete` | `readOnlyHint: true` |

## Consequences

### Positive

- **Clean separation.** Spec defines behavior, implementation provides it, chat consumes it. Any layer can evolve independently. New consumers (extensions, a11y tools, automation) use the spec without touching the chat layer.

- **Standards-aligned.** WebMCP transport means native browser support is coming. The spec's transport-agnosticism means it survives if WebMCP evolves.

- **Progressive enhancement.** Shim works today. Native WebMCP tomorrow. MCP bridge for server-side. HTTP binding for remote agents. Same spec, same tools, any transport.

- **No LLM required for interop.** The spec and implementation are pure structured data. Browser extensions (see Formy, `thoughts/specs/2026-03-26-formy-extension.md`), accessibility tools, and automation scripts get full agent access without any AI dependency. The LLM chat layer is additive, not foundational.

- **Leverages existing metadata.** References, Ontology, and FormEngine validation already exist. The spec adds an orchestration protocol, not new data models.

### Negative

- **Three artifacts to maintain.** A spec, an implementation package, and a chat package. Mitigated by clean boundaries — the spec is the stable contract, the implementation is mechanical, and the chat layer is a thin LLM wrapper.

- **WebMCP is a draft.** API may change. Mitigated by the shim (only shim updates, tool definitions stay the same) and by the spec's transport-agnosticism.

- **New public APIs needed on FormEngine.** `getFieldPaths()` and `getProgress()`. Generally useful and not assist-specific.

### Risks

- **WebMCP `provideContext()` overwrite** (W3C issue #101): Third-party scripts can overwrite tools. Mitigated by using `registerTool()` (per-tool) not `provideContext()` (bulk replace).

- **Profile store holds PII.** The assist layer provides mechanisms (encrypted storage, explicit consent); the host app provides policy.

## Related Documents

- `thoughts/archive/specs/2026-03-26-assist-interop-spec.md` — the specification
- `thoughts/archive/specs/2026-03-26-assist-implementation.md` — implementation design
- `thoughts/specs/2026-03-26-assist-chat.md` — chat package design
- `thoughts/specs/2026-03-26-formy-extension.md` — Formy browser extension (Chrome/Firefox consumer of the Assist spec)
- `thoughts/archive/specs/2026-03-25-assistive-chat-agent.md` — original brainstorm + research findings
