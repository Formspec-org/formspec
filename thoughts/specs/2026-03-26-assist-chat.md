# `formspec-assist-chat` — Conversational Form-Filling

**Date:** 2026-03-26
**Status:** Brainstorm
**Package:** `formspec-assist-chat` (Layer 5, depends on `formspec-assist`, `formspec-types`)

---

## Purpose

`formspec-assist-chat` is the **conversational layer** on top of the Formspec Assist Specification. It provides LLM-powered Q&A, guided walkthroughs, proactive suggestions, document extraction, and a chat UI protocol. It is a pure consumer of `formspec-assist` tools — it calls `formspec.field.help`, `formspec.field.set`, `formspec.profile.match`, etc. through the standard tool interface.

This package answers the question: **"What can an LLM do with the structured context that `formspec-assist` exposes?"**

---

## Separation of Concerns

```
┌─────────────────────────────────────────────────────────┐
│  formspec-assist-chat  (Layer 5)                         │
│  LLM adapter, guided flow, suggestions, chat session     │
│                                                          │
│  Consumes tools via:                                     │
│    provider.invokeTool("formspec.field.help", { path })  │
│    provider.invokeTool("formspec.field.set", { path, v })│
│    provider.getFieldHelp(path)  // in-process shortcut   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  formspec-assist  (Layer 2)                              │
│  Tool catalog, context resolver, profile store, shim     │
│  NO LLM. Pure structured data.                           │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  formspec-engine  (Layer 1)                              │
│  Form state, validation, FEL                             │
└─────────────────────────────────────────────────────────┘
```

The chat package adds **LLM intelligence** but never bypasses the tool interface. Every form mutation goes through `formspec.field.set`. Every context lookup goes through `formspec.field.help`. This means:

- The assist tools work without any LLM (extensions, a11y tools, automation scripts use them directly)
- The chat layer can be swapped or removed without affecting agent interop
- The chat layer gets the same context resolution and profile matching as any other consumer

---

## Package Shape

```
packages/formspec-assist-chat/
  src/
    index.ts                — Public API: createChatSession()
    types.ts                — ChatMessage, ChatSession, LLMAdapter
    chat-session.ts         — Conversation orchestrator
    llm-adapter.ts          — Pluggable LLM interface
    guided-flow.ts          — Step-by-step walkthrough mode
    suggestion-engine.ts    — Proactive suggestions from form state changes
    explain.ts              — LLM-powered field explanations (enriches FieldHelp)
    document-extractor.ts   — Upload → field mapping via ontology
    adapters/
      anthropic.ts          — Claude adapter
      openai.ts             — GPT adapter
      mock.ts               — Deterministic testing adapter
```

**Layer 5** (same as `formspec-chat`). Depends on `formspec-assist` (Layer 2) and `formspec-types` (Layer 0). May optionally depend on `formspec-engine` (Layer 1) for direct signal subscription.

---

## Key Interfaces

```typescript
interface ChatSession {
  // Bind to an AssistProvider
  attach(provider: AssistProvider): void;

  // Conversation
  sendMessage(content: string, context?: { fieldPath?: string }): Promise<ChatMessage>;
  getHistory(): ChatMessage[];
  clearHistory(): void;

  // Guided mode
  startGuidedFlow(options?: { skipFilled?: boolean }): GuidedStep;
  nextStep(): GuidedStep;
  previousStep(): GuidedStep;
  skipStep(): GuidedStep;

  // Proactive
  getSuggestions(): Suggestion[];
  onSuggestion(callback: (suggestion: Suggestion) => void): () => void;

  // Document extraction
  extractFromDocument(file: File | Blob): Promise<ExtractionResult>;
}

interface LLMAdapter {
  /** Generate a response given messages and available context. */
  chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    context: LLMContext
  ): Promise<{ message: string; citations?: Citation[] }>;
}

interface LLMContext {
  fieldHelp?: FieldHelp;           // from formspec.field.help
  formDescription?: string;         // from formspec.form.describe
  validationErrors?: string[];      // from formspec.field.validate
  profileMatches?: ProfileMatch[];  // from formspec.profile.match
}
```

---

## Feature Breakdown

### 1. Conversational Q&A

User asks a question about a field. The chat layer:

1. Calls `provider.getFieldHelp(path)` to get structured context (references, ontology, concept)
2. Assembles an LLM system prompt with the FieldHelp data as grounding context
3. Sends the user's question + context to the LLM adapter
4. Returns the LLM response with citations back to the References document entries

**No LLM fallback:** If no LLM adapter is configured, the chat layer returns the structured `FieldHelp` data directly — the UI can render it as a tooltip, accordion, or sidebar. The LLM adds natural language synthesis but isn't required.

### 2. Guided Walkthrough

Walk the user through one field (or logical group) at a time:

```typescript
interface GuidedStep {
  path: string;
  field: FieldDescription;          // from formspec.field.describe
  help: FieldHelp;                  // from formspec.field.help
  suggestion?: ProfileMatch;        // from formspec.profile.match
  validation?: ValidationResult[];
  isLast: boolean;
  progress: { current: number; total: number; filled: number };
}
```

Order driven by the form's page structure + relevance signals (via `formspec.form.pages` and `formspec.field.list`). Skips irrelevant fields. Auto-suggests profile matches at each step.

### 3. Proactive Suggestions

Watches form state changes (via Preact Signals `effect()` or polling `formspec.form.progress`) and emits suggestions:

```typescript
interface Suggestion {
  type: "autofill" | "correction" | "explanation" | "warning" | "related";
  path: string;
  message: string;
  action?: { type: "setValue"; value: unknown } | { type: "navigate"; target: string };
  confidence: number;
  source: "profile" | "ontology" | "validation" | "reference";
  dismissible: boolean;
}
```

Trigger conditions:
- **autofill** — profile match found (via `formspec.profile.match`) when a field is focused or empty
- **correction** — validation failure + LLM suggests fix based on common patterns
- **explanation** — field becomes relevant due to a bind condition; LLM explains why
- **warning** — calculated field produces unexpected value; LLM explains the calculation
- **related** — filling field X makes field Y relevant; show the connection

### 4. Document-to-Form Extraction

User uploads a document. The chat layer:

1. Sends document content to LLM with the form's field list (from `formspec.field.list`)
2. LLM extracts field-value pairs
3. Matches extracted values to form fields using ontology alignment (from `formspec.profile.match` pattern)
4. Presents matches for user review
5. Applies approved values via `formspec.field.bulkSet`

### 5. Accessibility Assistant

- **Error explanation** — translates validation messages into plain language using `formspec.field.help` context + LLM
- **Voice input** — speech recognition → parse intent → `formspec.field.set`
- **Simplified language** — LLM rewrites field labels and help text at a lower reading level

---

## Relationship to `formspec-chat`

| | `formspec-chat` (existing) | `formspec-assist-chat` (proposed) |
|---|---|---|
| **Purpose** | Build forms (authoring) | Fill forms (completing) |
| **Users** | Form authors | Form fillers |
| **Backend** | MCP authoring tools | Assist spec tools |
| **LLM role** | Scaffold/refine definitions | Explain fields, suggest values |
| **Layer** | 5 | 5 |

They share the `LLMAdapter` interface pattern but serve different users and different tool surfaces. Shared types (if any) should live in `formspec-types`.

---

## Open Questions

1. **LLM adapter sharing.** Should `formspec-chat` and `formspec-assist-chat` share a common `LLMAdapter` interface from `formspec-types`? The signatures are similar but the context shapes differ (authoring context vs. filling context). Probably: define a minimal shared base in types, extend per-package.

2. **Suggestion delivery.** Push (callback/event) or pull (polling `getSuggestions()`)? Probably both — push for real-time UI, pull for extension polling.

3. **Multi-agent chat.** When multiple agents are active (HR system + user + finance agent), does the chat layer coordinate them, or is that the assist spec's multi-agent coordination (§9 in the original brainstorm)? Probably: multi-agent coordination belongs in the spec/implementation layer, not the chat layer.

4. **Streaming.** Should the LLM adapter support streaming responses for long explanations? Probably yes for UX, but not for MVP.

5. **Cost/quota.** Chat-mode Q&A incurs LLM costs per question. Should the chat layer have a budget/quota mechanism, or is that the host app's concern? Probably: host app provides the LLM adapter with whatever limits it wants.
