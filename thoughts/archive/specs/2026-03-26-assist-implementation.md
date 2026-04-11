# `formspec-assist` — Reference Implementation

**Date:** 2026-03-26
**Status:** Draft
**Package:** `formspec-assist` (Layer 2, depends on `formspec-engine`, `formspec-types`)
**Implements:** Formspec Assist Specification (see `assist-interop-spec.md`)

---

## Purpose

`formspec-assist` is the **reference implementation** of the Formspec Assist Specification. It implements the full tool catalog, context resolver, profile store, and WebMCP transport binding with polyfill shim. No LLM dependency. No rendering. Pure structured data and protocol.

This package is the **interface layer** — it makes forms agent-accessible. The conversational chat experience is a separate package (`formspec-assist-chat`) that consumes these tools.

---

## Package Shape

```
packages/formspec-assist/
  src/
    index.ts                — Public API: createAssistProvider()
    types.ts                — Public type vocabulary (FieldHelp, ProfileMatch, etc.)
    webmcp-shim.ts          — navigator.modelContext polyfill
    webmcp-types.d.ts       — WebMCP TypeScript declarations
    tools/
      core.ts               — Core tools (describe, list, set, validate)
      profile.ts            — Profile tools (match, apply, learn)
      navigation.ts         — Navigation tools (pages, nextIncomplete)
    context-resolver.ts     — References + Ontology → FieldHelp
    profile-store.ts        — Concept-keyed persistent storage
    profile-matcher.ts      — Ontology-based matching algorithm
    autocomplete-map.ts     — Concept URI → HTML autocomplete token
    transports/
      in-process.ts         — Direct function calls (same-page consumers)
      post-message.ts       — Browser extension content scripts
      custom-event.ts       — Loose same-page coupling
      mcp-websocket.ts      — MCP relay bridge (deferred)
  tests/
    context-resolver.test.ts
    profile-matcher.test.ts
    tools.test.ts
    webmcp-shim.test.ts
```

**Layer 2.** Depends only on `formspec-engine` (Layer 1) and `formspec-types` (Layer 0). No lateral dependency with `formspec-webcomponent` (also Layer 2) — communicates via public `.engine` property and DOM events.

---

## Public API

```typescript
/** Create an Assist Provider for a live FormEngine. */
function createAssistProvider(options: AssistProviderOptions): AssistProvider;

interface AssistProviderOptions {
  engine: IFormEngine;
  references?: ReferencesDocument;
  ontology?: OntologyDocument;
  profile?: UserProfile;
  storage?: StorageBackend;           // default: localStorage
  registerWebMCP?: boolean;            // default: true — register tools on navigator.modelContext
  transports?: ShimTransport[];        // additional transports beyond WebMCP
}

interface AssistProvider {
  // Lifecycle
  attach(engine: IFormEngine): void;
  detach(): void;
  dispose(): void;

  // Sidecar documents
  loadReferences(refs: ReferencesDocument): void;
  loadOntology(ontology: OntologyDocument): void;

  // Direct access (for same-process consumers — no serialization)
  getFieldHelp(path: string): FieldHelp;
  getProgress(): FormProgress;
  matchProfile(profileId?: string): ProfileMatch[];

  // Tool invocation (for any consumer — goes through serialization)
  invokeTool(name: string, input: Record<string, unknown>): Promise<ToolResult>;

  // Tool discovery
  getTools(): ToolDeclaration[];
}
```

The provider auto-registers tools on `navigator.modelContext` (native or shimmed) when `registerWebMCP` is true. Consumers that want in-process access use the direct methods. Consumers that go through a transport use `invokeTool()`.

---

## WebMCP Shim

```typescript
class WebMCPShim implements ModelContext {
  private tools = new Map<string, ModelContextTool>();
  private transports: ShimTransport[] = [];

  registerTool(tool: ModelContextTool): void;
  unregisterTool(name: string): void;
  provideContext(init: { tools: ModelContextTool[] }): void;

  addTransport(transport: ShimTransport): void;
  removeTransport(transport: ShimTransport): void;
}

function ensureModelContext(): ModelContext {
  if (!navigator.modelContext) {
    const shim = new WebMCPShim();
    Object.defineProperty(navigator, 'modelContext', {
      value: shim,
      configurable: true     // allow native WebMCP to replace
    });
  }
  return navigator.modelContext;
}
```

The shim does NOT enforce SecureContext — the whole point is to work where native WebMCP doesn't.

---

## Context Resolver

Implements the resolution algorithm from the Assist Specification §3.2.

```typescript
class ContextResolver {
  constructor(
    private engine: IFormEngine,
    private references?: ReferencesDocument,
    private ontology?: OntologyDocument,
    private registries?: RegistryDocument[]
  );

  /** Resolve full FieldHelp for a path. */
  resolve(path: string, audience?: "human" | "agent" | "both"): FieldHelp;

  /** Resolve just the concept binding (3-level cascade). */
  resolveConcept(path: string): ConceptBinding | undefined;
}
```

Key implementation notes:
- Walk the references array — do NOT assume inheritance.
- Use full Bind.path for ontology lookups (`demographics.dob`, not `dob`).
- Three-level concept cascade: doc binding → registry concept → semanticType literal.
- Default equivalent `type` is `exact` when absent.

---

## Profile Store

```typescript
class ProfileStore {
  constructor(storage?: StorageBackend);

  load(profileId?: string): UserProfile | undefined;
  save(profile: UserProfile): void;
  listProfiles(): Array<{ id: string; label: string; updated: string }>;
  deleteProfile(id: string): void;

  /** Build a concept→value index for matching. */
  getConceptIndex(profileId: string): Map<string, ProfileEntry>;
}
```

Storage backend interface (to be extracted to `formspec-types`):

```typescript
interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

---

## Engine API Prerequisites

Two new public methods needed on `IFormEngine`:

1. **`getFieldPaths(): string[]`** — enumerate all field paths (excluding display-only items)
2. **`getProgress(): FormProgress`** — `{ total, filled, valid, required, requiredFilled, complete }`

Tools use `FieldViewModel` / `FormViewModel` as the primary read surface. Field mutation uses `getFieldVM(path).setValue(value)` for correct path resolution (engine's `setValue()` takes flat names).

---

## Build System

- Add `formspec-assist` to `LAYERS` map in `scripts/check-dep-fences.mjs` with value `2`
- Add to root `package.json` build script after `formspec-engine`, before `formspec-webcomponent`
- Add to `test:unit` script

---

## Declarative Annotations (webcomponent side)

Handled by `formspec-webcomponent` independently — no import from assist.

The webcomponent adds an optional `toolAnnotations` property to `AdapterContext`:

```typescript
interface AdapterContext {
  // ... existing properties ...
  toolAnnotations?: {
    toolparamdescription?: string;
    toolparamtitle?: string;
    autocomplete?: string;
  };
}
```

Populated from the field's label/hint and ontology concept binding. Adapters that don't recognize it (USWDS, Tailwind) silently ignore it.

---

## Validation Findings (incorporated)

All 14 findings from spec-expert and formspec-scout validation have been addressed in this design. See the original brainstorm doc for the full findings table.

Key resolutions:
- Layer 2, no lateral dependency — communicates via `.engine` property + DOM events
- `AdapterContext.toolAnnotations` injection, not `renderField()`
- `getFieldVM(path).setValue()` for nested paths
- All 12 reference types in FieldHelp
- Three-level ontology cascade
- `configurable: true` on shim property
- `StorageBackend` to `formspec-types`
