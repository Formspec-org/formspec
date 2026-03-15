# Formspec Chat — Product Design Spec

**Date:** 2026-03-14
**Status:** Draft
**Branch:** studiofixes
**Companion:** `packages/formspec-studio/research/adr/0004-the-inquest-prd.md`

---

## Purpose

Formspec Chat is a conversational form builder — "ChatGPT for forms." Users describe what they need in natural language, and the system builds a structured Formspec definition through conversation. The product targets non-technical users (program coordinators, compliance officers, HR managers, small business owners) who know what data they need to collect but cannot translate that knowledge into form structure, conditional logic, and validation rules.

The market opportunity is clear. Every existing AI form builder stops at flat question lists. None generate validation rules, calculated fields, cross-field constraints, or conditional logic from conversation. Formspec Chat, backed by FEL and the full Formspec specification, occupies a category of one: an AI that understands form semantics, not just question text.

---

## Product Vision

### What It Is

A chat-primary interface where users describe their form in natural language. The AI builds a Formspec definition through conversation, reveals a live preview when the scaffold is ready, and accepts refinements through continued chat. Every generated element traces back to the conversation that produced it.

### What It Is Not

- Not a drag-and-drop editor (that is Studio)
- Not a hosted form platform (no share links, no response collection)
- Not a runtime AI — once the form is approved, the AI's involvement ends and the form behaves deterministically

---

## Core Flow

```
[Entry] → [Conversation] → [Preview Reveal] → [Chat Refinement] → [Export]
```

### 1. Entry

A dedicated screen, not a chat window. The user picks one path:

- **Start blank** — jump straight into conversation
- **Choose a template** — select from a library of common archetypes (housing intake, grant application, patient intake, compliance checklist, employee onboarding)
- **Upload an existing form** — PDF, image, spreadsheet, or Formspec JSON
- **Resume a recent session** — pick up where they left off

Provider setup appears here if no provider is configured. It must be minimal: provider picker, API key input, test connection, remember key toggle, done. One screen, no sub-phases. If no key is configured, template browsing and blank-start remain available, but AI-backed generation is disabled.

### 2. Conversation

Chat-primary. The user describes what they need; the AI responds, asks clarifying questions, and builds understanding. There are no visible phases or progress steppers. The AI manages complexity internally.

**How users communicate.** Non-technical users describe purpose and workflow, not fields and structure. "I need to collect grant applications with a budget section that shows line items" is a typical prompt. The AI translates intent into Formspec structure.

**Conversation dimensions.** The AI explores five areas as the conversation develops — not as a rigid interview, but as natural follow-ups:

1. **Purpose.** What regulation, program, or policy does this form serve?
2. **Audience.** Who fills this out — applicants, case workers, or reviewers?
3. **Data.** What information do you need to capture?
4. **Logic.** Are there parts that appear only under certain conditions?
5. **Flow.** Single page or multiple steps? Sections that repeat?

**Uploads.** The chat accepts file drops mid-conversation: images of paper forms, PDFs, spreadsheets. The AI extracts structure (field labels, section headers, conditional instructions, calculation formulas) and folds it into the conversation context.

**Show something fast.** The AI generates a rough scaffold after the first meaningful input — a template selection, a substantive description, or an uploaded document. Users need something concrete to react to. A rough first draft that the user can critique is worth more than a thorough draft that arrives late. The deterministic adapter produces an instant scaffold; when the LLM result arrives, it replaces the deterministic draft entirely. The user sees one scaffold that improves, not two competing drafts.

### 3. Preview Reveal

The AI triggers the preview when the scaffold reaches a useful state — concretely, when the first `ProposalV1` contains at least one field. The screen transitions to a full-screen rendered form. The chat collapses into a drawer the user can pull open.

**Source traces.** Every generated field, rule, and section links back to the conversation message, uploaded file, or template that informed it. The preview surfaces these as "this field came from your message about income verification" annotations. Source traces build trust — the user sees why each element exists.

**Issue queue.** A persistent badge shows unresolved items: missing configuration, contradictions, elements the AI was uncertain about. Each issue links to the relevant form element. Issues persist until the user resolves or defers them. The queue replaces ephemeral toast notifications with a durable, inspectable list.

### 4. Chat Refinement

The user opens the chat drawer and types refinements. The AI applies edits through structured tool calls — the same `formspec-studio-core` command model used by Studio.

**Live update with diff highlight.** Changed or added fields highlight briefly on the preview so the user sees what changed. No before/after comparison; no manual accept step.

**Accordion editing.** Users refine by saying "add more detail to the address section" or "simplify the income questions" — vague directional feedback, not precise structural instructions. The AI handles ambiguity gracefully.

**Issue queue updates.** As the user resolves issues through conversation, the queue reflects changes. New issues may surface from edits. Source traces on new elements link to the refinement message.

### 5. Export

When the user is satisfied:

- **Download JSON** — export the Formspec definition
- **Open in Studio** — handoff via command bundle. Two modes:
  - **New project** — Studio creates a fresh project and replays the command bundle
  - **Import subform** — merge into an existing project via `project.importSubform`
- **Session auto-saves** — the user can close and resume later on the same browser

---

## Architecture

### Package Structure

```
packages/
  formspec-chat/        — Chat app: UI, hooks, orchestration, providers, features
  formspec-shared/      — Contracts, types, persistence, templates, transport
```

**formspec-shared** owns the data layer: type definitions (`InquestSessionV1`, `AnalysisV1`, `ProposalV1`, `InquestIssue`, `InquestHandoffPayloadV1`), persistence (localStorage/IndexedDB), templates, route helpers, and handoff payload builders. No business logic. No UI components beyond `IssueQueue`.

**formspec-chat** owns everything else: the chat app shell, provider adapters, AI operations hooks, authoring draft management, and feature components (template gallery, recent sessions, provider setup, review workspace).

Both packages depend on `formspec-studio-core` for project management, commands, and diagnostics.

### Dependency Direction

```
formspec-studio → formspec-chat → formspec-shared → formspec-studio-core
```

Studio imports Chat to render it. Chat imports Shared for types and persistence. Shared imports Studio-Core for command and project types. No reverse dependencies.

### Provider Adapter Layer

All AI providers implement a common interface:

```
testConnection(input) → ConnectionResult
runAnalysis(input)    → AnalysisV1
runProposal(input)    → ProposalV1
runEdit(input)        → CommandPatchV1
```

Each adapter declares capabilities: chat, images, PDF, structured output, streaming. The system ships with Anthropic, Google, and OpenAI adapters via the AI SDK. A deterministic adapter (regex + pattern matching, no network) provides instant fallback for testing, offline use, and fast first scaffolds.

The host application can inject a custom adapter to override defaults.

### Output Validation

Zod schemas validate every LLM response. Invalid output triggers the deterministic fallback. The system never passes unvalidated LLM output to feature modules.

### Command Pattern

Every mutation — whether from initial generation or chat refinement — dispatches `formspec-studio-core` commands. This provides:

- **Replay** — the full command bundle can be replayed in Studio
- **Undo** — commands are individually reversible
- **Audit** — the project log records every operation
- **Handoff** — the command bundle is the handoff payload

### State Model

The conversation and the form definition are separate streams that sync through commands:

- **Conversation state** — message history, uploads, template selection, provider config
- **Form state** — the `InquestDraft` wrapping a `formspec-studio-core` Project
- **Session state** — combines both plus issues, source traces, and metadata; persists to browser storage

The session is the persistence boundary. The draft lives in memory and syncs back to the session on change.

### Trace System

Every generated element carries a trace linking it to one or more sources:

- Template seed
- Chat message (by message ID)
- Uploaded file (by upload ID)
- Analysis extraction
- Refinement edit

Traces enable "where did this come from?" queries in the UI and support the issue queue's source citations.

### Issue Lifecycle

Issues originate from four sources: analysis (low-confidence extractions), proposal (generation warnings), diagnostics (structural validation), and provider errors. Each issue has severity (error/warning/info), a blocking flag, and a status (open/resolved/deferred).

`mergeIssueSets()` deduplicates by ID. `syncIssueStatuses()` preserves user decisions (resolve/defer) across data refreshes.

---

## Competitive Differentiation

### What every AI form builder does today

Generate a flat list of questions from a text prompt. That is it. None generate conditional logic, validation rules, calculated fields, cross-field constraints, or repeating sections. Design customization via AI is nonexistent in most tools.

### What Formspec Chat does differently

| Capability | Competitors | Formspec Chat |
|---|---|---|
| Conditional logic | Manual setup after generation | Generated from conversation via FEL |
| Validation rules | Manual | Generated — `constraint`, `required`, pattern matching |
| Calculated fields | Manual | Generated — `calculate` with FEL expressions |
| Cross-field constraints | Not supported | Generated — shape rules |
| Repeating sections | Not supported | Generated — repeat groups with min/max |
| Source tracing | Not available | Every element links to its source |
| Deterministic output | AI is runtime | AI drafts; approved form is a stable artifact |
| Structured definition | Proprietary or none | Open JSON spec (Formspec) |

### The trust barrier

Users will not trust AI-generated forms for serious work without:

1. **Full inspectability** — every field, rule, and branch reviewable before deployment
2. **Source tracing** — why each element exists
3. **Deterministic output** — once approved, the form behaves identically every time
4. **Human approval gate** — the AI drafts; a human approves

Formspec Chat addresses all four. The JSON definition is inspectable. Source traces explain provenance. The definition is a stable, versionable artifact. Export requires explicit user action.

---

## MVP Scope

### In

- Chat-first conversational UX with fluid conversation (no visible phases)
- Template library at entry (housing intake, grant application, patient intake, compliance checklist, employee onboarding)
- File upload (PDF, image, spreadsheet) with AI extraction
- Fast first scaffold — show a rough draft after first meaningful input
- Incremental tool-call refinement after preview reveal
- Full-screen preview with chat drawer
- Live update + diff highlight on refinements
- Source tracing on generated elements
- Persistent issue queue with resolve/defer
- Provider setup with BYOK (Anthropic, Google, OpenAI)
- Deterministic fallback adapter (no network, instant)
- Session persistence (localStorage/IndexedDB)
- Studio handoff (new project + import subform)
- Download formspec JSON

### Out

- Working modes (draft fast / verify carefully) — single mode for MVP
- Confidence states on individual elements — issues cover the worst cases
- Embedded visual editor — handoff to Studio instead
- Direct field manipulation in preview — chat-only refinement for MVP
- Share links or hosted form serving
- Multi-user collaboration or cloud sync
- Analytics and telemetry
- Multi-form programs or iterative re-inquest

---

## Design Constraints

### Visual Identity

Formspec Chat has its own visual language — a sister product to Studio, not a skin of it. The overall feel is a professional research assistant: calm, precise, and trustworthy. Specific visual direction (palette, typography, spacing) is a separate concern and not part of this spec.

### Accessibility

All generated forms must meet WCAG 2.1 Level AA. The chat interface and preview must support keyboard navigation and screen readers. Issue severity must use icon + label, not color alone.

### Performance

The first scaffold must appear within seconds of the first meaningful input. The deterministic adapter enables this without waiting for an LLM round-trip. LLM-generated scaffolds may replace the deterministic draft when they arrive.

### Storage

All data stays in the browser. No cloud sync, no server-side storage, no telemetry in MVP. API keys are stored locally only, can be cleared at any time, and are never sent anywhere except the selected provider's API.

---

## Entry Points

Formspec Chat is accessible from:

1. **Direct URL** — standalone browser app at `/chat/`
2. **Studio: new project** — "Describe your form" option launches Chat
3. **Studio: empty state** — empty editor canvas shows a "Start with Chat" call-to-action
4. **Studio: command palette** — "New Chat" opens Chat, targeting merge into current project
5. **Studio: re-entry** — projects with Chat provenance expose a "Reopen Chat" action linking to the saved session

---

## Handoff Protocol

### New Project

Chat builds a command bundle (all mutations since the initial scaffold). On handoff:

1. Chat saves the handoff payload to browser storage
2. Chat navigates to Studio with the handoff ID
3. Studio creates a fresh project
4. Studio replays the command bundle
5. The resulting history is fully undoable in Studio

### Import Subform

When invoked from an existing project (via command palette):

1. Chat packages the generated definition for the target subtree
2. Studio applies `project.importSubform` into the chosen group
3. Root-level constructs that cannot merge safely (screener replacement, page-mode rewrites) surface as issues before handoff

### Provenance

The handoff payload includes session summary metadata under `x-inquest`: template used, provider identifier, summarized inputs, proposal summary, and open/deferred issues. Raw chat transcripts, API keys, and uploaded files stay in browser storage only.

---

## Edge Cases

**Minimal input.** If the user provides only "I need a patient intake form," the system generates a broad scaffold from common patterns. Source traces mark these as template-derived, not user-specified. The issue queue surfaces low-confidence elements.

**Contradictory input.** If user instructions conflict with uploaded materials, the contradiction appears in the issue queue with citations to both sources. The user must resolve it before export.

**Large documents.** If the user uploads a lengthy PDF, the AI summarizes document structure and lets the user narrow scope before full generation.

**Multiple uploads.** Multiple images of a multi-page paper form maintain page order and produce a unified field inventory.

**Session recovery.** Refreshing the tab restores the session from browser storage. If storage is cleared, the session cannot be recovered — the product states this plainly.

**Provider failure.** If the LLM call fails, the deterministic adapter provides a fallback scaffold. The error surfaces in the chat, not as a blocking modal. Existing session state remains intact.

---

## Patterns to Preserve from Current Implementation

These architectural patterns from the existing codebase are sound and should carry forward (as concepts, not code):

1. **Provider adapter interface** — pluggable, capability-flagged, with deterministic fallback
2. **Zod schemas for output validation** — single source of truth for LLM response shape
3. **Command bundle for handoff** — fine-grained Studio commands, not raw JSON diffs
4. **Trace map** — element ID → source reference linkage (exists in code, needs UI)
5. **Issue merging with status preservation** — deduplication + user decision persistence
6. **Session versioning** — `InquestSessionV1` with runtime type guards for safe deserialization

### Patterns to Replace

1. **Rigid phase state machine** → fluid conversation with internal state tracking
2. **Analysis as a separate LLM call** → generate scaffold directly from first input; skip intermediate requirements document
3. **Provider setup as blocking sub-phase** → minimal inline setup, one screen
4. **Chat thread scoped to inputs phase** → chat always available (drawer post-preview)
5. **Monolithic session object** → separate conversation and form state streams, synced through commands

---

## Future Work (Post-MVP)

- **Working modes** — Draft Fast (speed to first scaffold) vs. Verify Carefully (gates block export on unresolved issues)
- **Confidence states** — per-element high/medium/low confidence indicators
- **Direct manipulation** — click fields in preview to edit; drag to reorder
- **Share links** — generate shareable URLs or embed snippets
- **Iterative re-inquest** — upload new guidance against an existing definition for targeted updates
- **Multi-form programs** — related form suites with shared option sets
- **Collaborative sessions** — shared sessions with attribution and cloud sync

---

*End of document.*
