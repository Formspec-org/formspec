---
title: "You built the form. Nobody helps people fill it out."
description: "Formspec's Assist specification defines a standard protocol for AI agents, browser extensions, and accessibility tools to help people understand, complete, and reuse data across complex forms — without requiring an LLM."
date: 2026-03-26
tags: ["specification", "ai", "announcement", "deep-dive"]
author: "Michael Deeb & Claude"
---

You spent three months building a 200-field federal grant application. Conditional sections, budget calculations, compliance rules, regulatory cross-references. The definition is locked. Validation is airtight. WCAG compliance is verified. The form ships.

Then a first-time applicant opens it.

She stares at "Modified Total Direct Costs" and wonders what that means. She re-enters her organization's EIN for the fourth time this month — the same nine digits she typed into three other federal systems last week. She fills out the budget section, submits, and gets a validation error she doesn't understand. She calls the help desk. The help desk tells her to read 2 CFR §200.414, subsection (f).

You built a great form. The experience of filling it out is still terrible.

## Three gaps that form builders can't close

The problem isn't the form's logic — it's that nothing connects the person filling the form to the knowledge the form already captures. Three persistent gaps:

**"What does this mean?"** — Fields reference regulations, domain jargon, and institutional context. Formspec already has [References documents](/blog/references-plus-ontology) with per-field contextual knowledge: regulations, documentation, worked examples, glossary entries. But nothing surfaces them to the person filling the form, or to an AI agent helping them, at the moment they need it.

**"I already answered this."** — The same data gets re-entered across dozens of forms. Organization name, EIN, address, PI contact information, DUNS number. Formspec already has [Ontology documents](/blog/ontology-layer) that give fields semantic identity — concept URIs that mean "this field collects an EIN" regardless of what the field is labeled. But nothing uses that semantic identity for cross-form data reuse.

**"Am I doing this right?"** — The form validates reactively: fill a field wrong, see a red message. But nothing guides people proactively. Nothing says "you're 60% done, the next required field is on page 3, and here's what it's asking for." Nothing makes that validation state accessible to tools that could help.

These gaps exist because form specifications have historically stopped at the authoring boundary. Define the fields, define the rules, render the form, done. What happens when a person sits down to fill it out — that's somebody else's problem.

## Formspec Assist: a specification for the filling side

We're building the filling-side counterpart to the authoring tools. Not a product. A specification — the same approach we took with the [Core spec](/blog/introducing-formspec), the [Component spec](/blog/react-and-android), and the [Ontology layer](/blog/ontology-layer).

The **Formspec Assist Specification** defines a standard protocol for how AI agents, browser extensions, accessibility tools, and automation scripts interact with a live form. It defines 15 tools in four categories — introspection, mutation, profile management, and navigation — with typed inputs, structured outputs, and explicit error codes.

The spec is technology-agnostic. It defines *what* tools exist and *how* they behave, not what runtime they run on. Any transport that can carry JSON tool calls — WebMCP, MCP, HTTP, postMessage — can implement it.

### What the tools do

Think of the tool catalog as the API that any helper — human or machine — needs to work with a form:

**Introspection tools** answer questions about the form. "What is this form?" "What fields does it have?" "What does this field mean?" "How far along am I?" The `formspec.field.help` tool is the big one: it assembles contextual knowledge from References (regulations, docs, examples) and Ontology (concept identity, cross-system equivalences) into a single structured response. No LLM required — it's a deterministic lookup against the metadata the form author already attached.

**Mutation tools** fill in values. `formspec.field.set` writes a single field; `formspec.field.bulkSet` writes many at once. Both enforce the form's rules — you can't write to a readonly field, you can't set a value on a field that isn't relevant, and every write returns the validation result so the caller knows immediately if the value is accepted.

**Profile tools** handle data reuse. `formspec.profile.match` takes a user profile and finds fields in the current form that match — not by field name, but by semantic concept. Your profile knows your EIN. The form has an EIN field. The ontology connects them, even if the form calls it "Employer ID" and your profile learned it as "EIN" from a different site. `formspec.profile.apply` fills the matched fields — but only with explicit user confirmation.

**Navigation tools** help people (and agents) move through a form efficiently. "What pages are in this form?" "What's the next field that needs attention?" "Is the form complete?"

### What this means for a grant manager

If you manage a complex form program, here's the practical upshot:

The contextual knowledge you already invest in — help text, regulatory references, worked examples, glossary definitions — stops being documentation that sits in a separate PDF. It becomes machine-readable context that any tool can surface at the exact moment a filler needs it. You author it once, in the References document. Every consumer — AI chat, browser extension, accessibility tool, help sidebar — gets the same authoritative answer.

The semantic tags your data governance team assigns — "this field collects an EIN," "this field collects a DUNS number" — stop being metadata for data pipelines. They become the key that lets a browser extension auto-fill your form from a user's saved profile, matching by meaning rather than by field name.

The validation rules you painstakingly defined — required fields, conditional logic, cross-field constraints — become accessible to external tools that can guide people proactively instead of only flagging errors after the fact.

You don't need to do anything new. The specification consumes the metadata you already create.

## Three layers, cleanly separated

The work is organized into three pieces that can evolve independently:

**1. The specification** (`specs/assist/assist-spec.md`) — a normative document that defines the tool catalog, context resolution algorithm, profile matching algorithm, and transport contracts. Like the Core or Component specs, this is technology-agnostic. It says "a tool called `formspec.field.help` exists, it takes a field path, it returns this structure, and the context is resolved by this algorithm." It does not say "use React" or "use WebMCP" or "use an LLM."

**2. The reference implementation** (`formspec-assist`) — a TypeScript package that implements the spec. It connects to a live FormEngine, resolves context from References and Ontology documents, manages profile storage, and exposes the full tool catalog. It's built on [WebMCP](https://webmachinelearning.github.io/webmcp/) — a W3C draft specification for browser-native AI tool interaction — with a polyfill shim for browsers that don't support it yet. No LLM. No rendering. Pure structured data.

**3. The conversational layer** (`formspec-assist-chat`) — an LLM-powered chat package that consumes the spec's tools to provide Q&A, guided walkthroughs, proactive suggestions, and document extraction. It's one consumer among many. It adds natural language on top of the structured context — but it never bypasses the tool interface.

The separation matters. The spec and implementation work without any AI. A browser extension can call `formspec.field.help` and get structured, authoritative context about a field — regulations, examples, concept identity — without ever touching a language model. An accessibility tool can call `formspec.form.progress` and announce completion status. An automation script can call `formspec.field.bulkSet` to pre-fill a form from a database.

The LLM layer is additive. It enriches the structured context conversationally — turns a FieldHelp response into a natural-language explanation, synthesizes cross-field guidance, extracts data from uploaded documents. But it's not the foundation. The foundation is the spec and the structured metadata.

## Context resolution: how `formspec.field.help` works

The most important tool in the catalog assembles contextual knowledge from two sources:

**From References:** Walk the References document, collect entries whose target matches the field path or the form root (`#`). Filter by audience (agent-only entries don't show up in human-facing help). Group by type: regulations, documentation, examples, glossary entries, vector store endpoints, tool schemas. Rank by priority within each type: primary before supplementary before background.

**From Ontology (three-level cascade):**
1. Check the Ontology document for a direct concept binding on the field path.
2. If no binding, check the registry for a concept matching the field's `semanticType`.
3. If neither, use the `semanticType` as a literal concept URI.

The result is a `FieldHelp` structure: a single object containing everything any consumer needs to understand one field. Regulation citations. Worked examples. Inline context written for agents. Concept identity with cross-system equivalences. All assembled deterministically from the metadata the form author and data governance team already created.

For the indirect cost rate field on a federal financial report, `FieldHelp` returns: the specific 2 CFR section that governs the de minimis rate, an inline explanation written for agent consumption, a link to the organization's grants knowledge base, and the field's formal concept identity in the federal cost accounting framework. The [References + Ontology post](/blog/references-plus-ontology) walks through this scenario in detail.

## Profile matching: data reuse by meaning, not by name

Profile matching is how people stop re-entering the same data across every form they touch.

The matching algorithm works at the concept level. When you fill out a form and the extension learns your responses, it doesn't store "the field called `org_ein` has value `12-3456789`." It stores "the concept `urn:irs:ein` has value `12-3456789`." When you open a different form on a different site, the matcher resolves each field's concept through the ontology, looks up your profile by concept URI, and finds matches.

Confidence levels reflect the quality of the match:

| Match type | Confidence | Example |
|-----------|------------|---------|
| Exact concept match | 0.95 | Both fields bound to `urn:irs:ein` |
| Close equivalent | 0.80 | Field bound to a concept with a `close` equivalent to your profile entry |
| Broader/narrower | 0.60 | Field asks for "Tax ID" (broader), profile has "EIN" (narrower) |
| Related concept | 0.40 | Conceptually related but not interchangeable |
| Field-key fallback | 0.30 | Same field path, no ontology — weakest match |

Matches below 0.50 are discarded by default. High-confidence matches can auto-fill with user confirmation. Low-confidence matches are presented for review — "Your profile has 'Springfield' for city, but this field asks for 'Mailing city' — is that the same?"

The critical constraint: every auto-fill goes through `formspec.profile.apply` with `confirm: true`. The spec requires user confirmation before writing matched values. The tool can suggest; it can't silently overwrite.

## Formy: a browser extension that puts this in people's hands

A specification is only useful if consumers exist. The first consumer we're building is **Formy** — a browser extension for Chrome and Firefox that provides semantic autofill, contextual help, form memory, and multi-profile management.

Formy is a pure consumer of the Assist specification. It calls the spec's tools. It doesn't bypass them.

### Three operating modes

**Mode 1: Full Assist Provider on the page.** When a Formspec form already has the assist package loaded, Formy connects to it via postMessage. Full tool catalog. Full context resolution. Full profile matching. The extension is a thin UI layer — a side panel showing field help, autofill matches, and form progress.

**Mode 2: Bootstrap into a Formspec page.** When a page has a `<formspec-render>` element but no assist provider, Formy injects one. It reads the engine from the web component, discovers sidecar documents (References, Ontology) from `<link>` elements or well-known paths, and spins up the full tool catalog. From there, same as Mode 1.

**Mode 3: Plain HTML forms (degraded).** On non-Formspec forms, Formy falls back to heuristic field detection — reading `autocomplete` attributes, `name` attributes, labels, and input types to build a field model. Profile matching uses these heuristics at lower confidence. No validation, no references, no ontology — but still useful for basic autofill.

### Privacy-first profile storage

Profiles contain PII: names, addresses, tax identifiers, medical record numbers. Formy encrypts them at rest using WebAuthn/passkey authentication. Your fingerprint or face unlocks the vault. No passwords to phish. No cloud sync unless you opt in. The encryption key is derived from your hardware authenticator and held in memory only while the vault is open — it's cleared after five minutes of inactivity or when the browser closes.

Profiles are local-only by default. No telemetry. No analytics. No data leaves the device unless you explicitly export it or enable optional encrypted sync.

## WebMCP: why we built on a W3C draft

The Assist specification is transport-agnostic — it works over any transport that carries JSON tool calls. But the reference implementation uses [WebMCP](https://webmachinelearning.github.io/webmcp/) as the primary browser transport.

WebMCP is a W3C Draft Community Group Report from Google and Microsoft's Web Machine Learning community group, shipping in Chrome 146 Canary. It defines a `navigator.modelContext` API for browser-native AI tool interaction. The alignment with Formspec is direct:

- **Same data model.** JSON Schema input schemas. Typed content block results.
- **Declarative HTML bridge.** `tool*` attributes on form elements map to Formspec's structured metadata.
- **Human-in-the-loop.** `requestUserInteraction()` for autofill consent — the browser mediates confirmation.
- **Progressive enhancement.** Polyfill shim today, native browser support tomorrow. Zero migration cost.

The shim installs a `navigator.modelContext` polyfill that routes tool calls through in-process function calls, postMessage, CustomEvent, or a WebSocket bridge to an MCP relay. When native WebMCP lands, the shim becomes a no-op. The tool definitions don't change. The consumers don't change. Only the transport layer upgrades — silently.

## The honest tradeoffs

**WebMCP is a draft.** The API may change before it reaches recommendation status. We mitigate this with the transport-agnostic spec design — if WebMCP evolves, only the shim needs updating. The tool catalog, context resolution, and profile matching are defined in the Formspec spec, not in the WebMCP binding.

**Three artifacts to maintain.** A specification, an implementation package, and a chat package. That's more surface area than a single monolithic product. The mitigation is clean boundaries — the spec is the stable contract (changes slowly), the implementation is mechanical (follows the spec), and the chat layer is a thin LLM wrapper (follows the tools).

**Profile PII is real risk.** The Assist specification provides mechanisms — encrypted storage, explicit consent, user confirmation for every autofill — but the host application provides policy. An organization deploying Formy needs to decide: which profiles are allowed, what data categories require extra confirmation, whether sync is permitted. The spec gives you the tools; your security team sets the rules.

**Mode 3 is genuinely degraded.** On plain HTML forms without Formspec metadata, Formy is limited to heuristic field detection and basic autofill. No contextual help, no validation guidance, no semantic matching beyond what `autocomplete` attributes and label text can provide. The value of the Assist protocol scales directly with the richness of the form's metadata.

**No LLM means no natural language.** The spec and implementation work without an LLM, which is a feature for interop and privacy. But the structured `FieldHelp` response — regulations, concept URIs, reference entries — isn't as friendly as a conversational explanation. The chat layer exists for a reason. For non-technical fillers, the LLM layer is what transforms structured metadata into "here's what this field means and why it matters."

## What this connects to

The Assist specification is the natural next step after the context layers. We built [References](/blog/references-plus-ontology) to give forms machine-readable context. We built the [Ontology layer](/blog/ontology-layer) to give fields semantic identity. We built [zero-hallucination authoring tools](/blog/zero-hallucination-forms) to let AI build forms safely.

Assist closes the loop on the other side: giving AI, extensions, and accessibility tools a structured way to help people *fill* those forms, grounded in the context the form already carries.

### Next

- The Assist specification draft is in progress — we'll publish it alongside the Core and Component specs.
- `formspec-assist` implementation work starts this week.
- Formy extension prototyping is underway — we'll write about the WebAuthn profile vault separately.
- The conversational chat layer will be the subject of a dedicated post once the assist layer is stable.

All three pieces are open source. The spec and runtime are Apache-2.0 licensed; authoring tools are BSL 1.1 (converting to Apache-2.0 in 2030). No vendor lock-in at any layer.
