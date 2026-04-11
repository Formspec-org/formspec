# ADR-0047: Declarative References for Forms, Sections, and Fields

**Status**: Accepted
**Date**: 2026-03-19
**Deciders**: @mikewolfd

## Context

Formspec definitions describe form structure and behavior but have no mechanism for attaching external reference material — regulatory guidance, help documentation, knowledge bases, or AI-consumable data sources. The existing `description` and `hint` properties serve inline human guidance but are insufficient for:

- Deep-linking to authoritative regulatory or policy documents
- Pointing AI companion agents to vector stores or RAG endpoints
- Providing field-level grounding context for agent assistance
- Attaching tool schemas that agents can invoke

As AI-assisted form completion becomes common, definitions need a way to declare "here is where to find more context" at any granularity — form-wide, per-section, or per-field.

## Decision

Add a `references` property (array of Reference objects) to:
1. The top-level Definition object (form-wide context)
2. The Item base type (inherited by field, group, display)

Each Reference object has:
- `type` — categorizes the reference (documentation, regulation, vector-store, retrieval, tool, context, etc.)
- `audience` — declares intended consumer: `human`, `agent`, or `both`
- `uri` and/or `content` — the pointer or inline content
- Metadata: `title`, `description`, `mediaType`, `language`, `tags`, `priority`

References are strictly metadata — they MUST NOT affect data capture, validation, or the processing model. Processors that don't understand references ignore them.

URI scheme conventions are defined for common agent infrastructure:
- `vectorstore:{provider}/{collection}` — vector similarity search
- `kb:{provider}/{base-id}` — knowledge bases
- `formspec-fn:{name}` — host-provided (reuses existing convention)

## Alternatives Considered

### Use `extensions` (x- properties) only
Could work but provides no structure, no schema validation, no interoperability. Every organization would invent its own format. References are common enough to warrant first-class support.

### Sidecar document (like Theme/Component)
Would keep definitions leaner but adds deployment complexity. References are tightly coupled to specific fields — a sidecar would need to re-express the item tree to target them. Inline attachment is simpler and keeps field + context co-located.

### Embed in `description`/`hint` with markdown links
Conflates inline help text with deep reference material. Doesn't support structured agent consumption. No way to distinguish audience or reference type.

## Consequences

- Definitions grow slightly larger when references are used
- No processing model changes — references are pure metadata
- Schema needs a new `Reference` $def and `references` property on Definition + Item
- Agents get a standardized, discoverable way to find context for any field
- Human renderers get a standard way to surface help/regulatory links
