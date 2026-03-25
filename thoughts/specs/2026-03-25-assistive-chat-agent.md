# Assistive Chat Agent — Brainstorm & Design Spec

**Date:** 2026-03-25
**Status:** Brainstorm
**Package:** `formspec-assist` (Layer 2–3, depends on `formspec-engine`, `formspec-types`)

---

## Problem Statement

People filling out complex forms (grant applications, clinical intake, tax filings, compliance reports) face three persistent problems:

1. **"What does this mean?"** — Fields use jargon, reference regulations, or require domain knowledge the filler doesn't have.
2. **"I already answered this somewhere else."** — The same data (EIN, address, org name) gets re-entered across dozens of forms.
3. **"Am I doing this right?"** — Validation catches errors after the fact, but doesn't guide the filler toward correct answers proactively.

Formspec already has the metadata to solve all three: **References** (contextual knowledge per field), **Ontology** (semantic identity enabling cross-form data reuse), and **FormEngine** (reactive state + validation). What's missing is an orchestration layer that connects these to a conversational interface and an agent/tool protocol.

## Core Concept

`formspec-assist` is an **optional sidecar package** that adds conversational form-filling assistance. It does NOT render forms — it pairs with whatever renderer is in use (`<formspec-render>`, a React wrapper, a native app, or headless). It provides:

1. A **chat interface** for field-level Q&A, guided walkthroughs, and proactive suggestions
2. A **programmatic agent protocol** for browser extensions, other AI agents, and automation tools to read/write form data
3. A **profile store** for remembering user data across forms using ontology-based semantic matching

---

## Architecture Ideas

### Package Shape

```
formspec-assist/
  src/
    assist-session.ts       — Main orchestrator (like ChatSession but for filling)
    context-resolver.ts     — Resolves references + ontology for a given field path
    profile-store.ts        — Persistent user data store (ontology-keyed)
    agent-protocol.ts       — Structured API for external tools/agents
    suggestion-engine.ts    — Proactive fill suggestions from profile + ontology
    explain.ts              — Generate field explanations from references
    guided-flow.ts          — Step-by-step walkthrough mode
    types.ts                — Public type vocabulary
```

**Dependency position:** Layer 2–3. Depends on `formspec-engine` (field state, validation, FEL) and `formspec-types`. Does NOT depend on `formspec-webcomponent`, `formspec-chat`, or any renderer.

### Key Interfaces

```typescript
interface AssistSession {
  // Bind to a live FormEngine instance
  attach(engine: FormEngine): void;

  // Load sidecar documents
  loadReferences(refs: ReferencesDocument): void;
  loadOntology(ontology: OntologyDocument): void;
  loadProfile(profile: UserProfile): void;

  // Chat — field-level Q&A
  ask(question: string, context?: { fieldPath?: string }): Promise<AssistResponse>;

  // Proactive — what can I help with?
  getSuggestions(): Suggestion[];
  getFieldHelp(path: string): FieldHelp;

  // Agent protocol — structured read/write
  getAgentAPI(): AgentAPI;
}

interface AgentAPI {
  // Introspection
  describeForm(): FormDescription;
  describeField(path: string): FieldDescription;
  getFieldState(path: string): FieldState;
  listFields(filter?: FieldFilter): FieldSummary[];

  // Mutation
  setValue(path: string, value: unknown): SetValueResult;
  setValues(entries: Array<{path: string, value: unknown}>): BulkSetResult;

  // Validation
  validate(): ValidationReport;
  validateField(path: string): ValidationResult[];

  // Profile/autofill
  autoFill(profile: UserProfile): AutoFillResult;
  getAutoFillPreview(profile: UserProfile): AutoFillPreview;
}
```

---

## Feature Ideas

### 1. Context-Aware Field Explanation

When a user focuses a field or asks "what is this?", the assist layer:

1. Looks up the field's `references` entries (audience: `human` or `both`)
2. Looks up the field's `ontology` concept binding for semantic context
3. Looks up applicable `regulation` or `policy` references
4. Composes an explanation from these sources, ranked by `priority`

**Simple mode:** Return structured data (title, description, links, regulation citations) for the renderer to display however it wants — tooltip, side panel, inline expansion.

**Chat mode:** Feed the references + ontology as context to an LLM and let it answer the user's specific question conversationally.

```typescript
interface FieldHelp {
  path: string;
  label: string;

  // From references
  regulations: Array<{ title: string; uri: string; excerpt?: string }>;
  documentation: Array<{ title: string; content: string }>;
  examples: Array<{ title: string; content: string }>;

  // From ontology
  concept?: { display: string; system: string; uri: string };
  equivalents?: Array<{ system: string; display: string; type: string }>;

  // Synthesized
  summary?: string;           // LLM-generated plain-language explanation
  commonMistakes?: string[];  // From reference tags or LLM analysis
}
```

### 2. Ontology-Based Profile Store

The killer feature for repeat form-fillers. The ontology document gives every field a **semantic identity** — `schema.org/birthDate`, `irs.gov/terms/employer-identification-number`, `hl7.org/fhir/Patient.name`. This means:

- A user fills out Form A, which has field `ein` mapped to `irs.gov/terms/employer-identification-number`
- Later they open Form B, which has field `orgTaxId` mapped to the same concept (or a `close`/`broader` equivalent)
- The assist layer recognizes the semantic match and offers to pre-fill

**Profile structure:**

```typescript
interface UserProfile {
  id: string;
  label: string;                    // "My Organization", "Personal Info"
  created: string;
  updated: string;

  // Concept-keyed data store
  concepts: Record<string, ProfileEntry>;

  // Raw key-value fallback (for fields without ontology bindings)
  fields: Record<string, ProfileEntry>;
}

interface ProfileEntry {
  value: unknown;
  confidence: number;              // 0–1, decays over time or with conflicting data
  source: ProfileEntrySource;      // which form/session provided this
  lastUsed: string;
  verified: boolean;               // user explicitly confirmed this value
}

type ProfileEntrySource =
  | { type: 'form-fill'; formUrl: string; fieldPath: string; timestamp: string }
  | { type: 'manual'; timestamp: string }
  | { type: 'import'; source: string; timestamp: string }
  | { type: 'browser-extension'; extensionId: string; timestamp: string };
```

**Matching algorithm:**

1. **Exact concept match** — same concept URI → auto-suggest with high confidence
2. **Close equivalent** — SKOS `close` relationship → suggest with medium confidence
3. **Broader/narrower** — SKOS `broader`/`narrower` → suggest with low confidence, explain the relationship
4. **System + code match** — same system + code but different concept URI → suggest with medium confidence
5. **Label/name heuristic** — fallback fuzzy match on field labels when no ontology exists

**Storage backends:**
- `localStorage` / `IndexedDB` for browser-native
- Encrypted file for CLI/server
- Extension-managed storage for browser extensions
- Cloud sync (optional, user-controlled)

### 3. Agent Protocol (for Browser Extensions & External Tools)

A structured, JSON-serializable protocol that any external tool can speak. Not tied to MCP (which is for form *authoring*) — this is for form *filling*.

**Use cases:**
- Browser extension reads the current form, matches fields to profile, offers autofill
- HR system pre-populates employee forms via API
- AI agent fills out a form on behalf of a user based on source documents
- Accessibility tool reads field descriptions and validation state aloud

**Protocol shape:**

```typescript
// Request envelope
interface AssistRequest {
  id: string;
  method: AssistMethod;
  params: Record<string, unknown>;
}

// Methods
type AssistMethod =
  // Introspection
  | 'form.describe'           // → FormDescription
  | 'form.listFields'         // → FieldSummary[]
  | 'field.describe'          // → FieldDescription (includes references + ontology)
  | 'field.getState'          // → { value, valid, relevant, required, readonly }
  | 'field.getHelp'           // → FieldHelp (references, regulations, examples)

  // Mutation
  | 'field.setValue'           // → { accepted, validationResults }
  | 'field.bulkSet'           // → { results[] }

  // Profile
  | 'profile.match'           // → { matches: Array<{path, concept, value, confidence}> }
  | 'profile.autoFill'        // → { filled: Array<{path, value}>, skipped: Array<{path, reason}> }
  | 'profile.learn'           // → ack (save current form values to profile)

  // Validation
  | 'form.validate'           // → ValidationReport
  | 'form.getProgress'        // → { total, filled, valid, required, complete }

  // Navigation
  | 'form.getPages'           // → page structure
  | 'form.nextIncomplete'     // → path of next field needing attention

  // Chat (optional, requires LLM)
  | 'chat.ask'                // → { response, citations[] }
  | 'chat.explain'            // → { explanation, sources[] }
```

**Transport options:**
- **In-process** — direct JS function calls (same page)
- **postMessage** — cross-origin iframes, browser extension content scripts
- **CustomEvent** — same-page loosely coupled (web component ↔ extension)
- **WebSocket/HTTP** — remote agents, server-side tools
- **MCP bridge** — expose as MCP tools for AI agent integration

### 4. Browser Extension Integration Points

A browser extension that enhances any formspec-rendered form:

**Detection:** Extension detects `<formspec-render>` elements or a `window.__formspecAssist` global, and connects via the agent protocol.

**Capabilities:**

- **Profile sidebar** — shows matched profile data, lets user approve/reject autofill per field
- **Cross-tab learning** — when user fills out a form on Site A, extension saves values keyed by ontology concept; offers them on Site B
- **Regulation overlay** — pulls `audience: "human"` references and shows them inline (tooltips, sidebar panel)
- **Progress tracker** — shows form completion percentage, highlights required fields
- **Form memory** — saves partial responses locally, restores on revisit (keyed by definition URL + version)
- **Multi-profile** — "Fill as: My Organization / Personal / Client: Acme Corp"

**Privacy model:**
- All data stored locally by default (extension storage, encrypted)
- User explicitly chooses what to sync and where
- No data leaves the device without explicit action
- Extension can operate fully offline

### 5. Guided Walkthrough Mode

Instead of presenting the whole form, walk the user through one field (or logical group) at a time:

```typescript
interface GuidedFlow {
  start(options?: { skipFilled?: boolean }): GuidedStep;
  next(): GuidedStep;
  previous(): GuidedStep;
  skip(): GuidedStep;
  jumpTo(path: string): GuidedStep;
  getProgress(): { current: number; total: number; filled: number };
}

interface GuidedStep {
  path: string;
  field: FieldDescription;
  help: FieldHelp;
  suggestion?: { value: unknown; source: string; confidence: number };
  validation?: ValidationResult[];
  isLast: boolean;
}
```

Driven by the form's page structure + relevance signals. Skips irrelevant fields. Shows one group at a time with full contextual help.

### 6. Proactive Suggestion Engine

Watches form state changes and proactively offers help:

- **"Did you mean?"** — when a value fails validation, suggest corrections based on common patterns
- **"You might also need…"** — when filling field X, if field Y becomes relevant due to a bind condition, explain why
- **"From your profile"** — when a field matches a profile concept, offer to autofill
- **"Check this"** — when a calculated field produces an unexpected value, explain the calculation
- **"Similar forms"** — if the user has filled similar forms before, offer bulk import

```typescript
interface Suggestion {
  type: 'autofill' | 'correction' | 'explanation' | 'warning' | 'related';
  path: string;
  message: string;
  action?: { type: 'setValue'; value: unknown } | { type: 'navigate'; target: string };
  confidence: number;
  source: string;           // "profile", "ontology", "validation", "reference"
  dismissible: boolean;
}
```

### 7. Document-to-Form Extraction

User uploads a document (PDF, spreadsheet, prior form response) and the assist layer maps its contents to form fields:

1. Extract structured data from the document
2. Match extracted fields to form fields using ontology concept alignment
3. Present matches for user review
4. Fill approved values

This is the inverse of the mapping spec — instead of form→external format, it's external format→form. The ontology alignments (`exactMatch`, `closeMatch`) provide the semantic bridge.

### 8. Accessibility Assistant

Beyond standard WCAG compliance, an active accessibility layer:

- **Screen reader narration** — reads field help, validation errors, and suggestions aloud with appropriate ARIA live regions
- **Voice input** — "set the organization name to Acme Corp" via speech recognition + agent protocol
- **Cognitive load reduction** — hides non-essential fields, shows progress, offers simplified language mode
- **Error explanation** — translates technical validation messages into plain language using references

### 9. Multi-Agent Coordination

For complex workflows where multiple agents/tools contribute to filling a form:

```typescript
interface AgentRegistration {
  agentId: string;
  name: string;
  capabilities: AgentCapability[];     // 'read', 'write', 'suggest', 'validate'
  fieldClaims: string[];               // paths this agent is responsible for
  priority: number;                    // conflict resolution order
}

type AgentCapability = 'read' | 'write' | 'suggest' | 'validate' | 'explain';
```

Example: an HR system agent claims employee fields, a finance agent claims budget fields, and the user fills the rest. Each agent sees only its claimed fields. Conflicts (two agents writing the same field) resolved by priority + user approval.

---

## Integration Surfaces

### With FormEngine (core dependency)

- Subscribe to value changes → trigger suggestion recalculation
- Subscribe to relevance changes → update guided flow
- Read validation results → power error explanation
- Call `compileExpression()` → explain calculated fields to users
- Call `setValue()` → apply autofill and agent writes

### With References Document

- Resolve per-field references by path
- Filter by audience (`human` for rendering, `agent` for LLM context, `both` for both)
- Follow `$ref` pointers to `referenceDefs`
- Use `priority` for ranking (primary > supplementary > background)
- Use `type` for categorization (regulation, documentation, example, context)
- Use `rel` for relationship semantics (constrains, defines, exemplifies)
- Support `vectorstore:` and `kb:` URI schemes for RAG integration

### With Ontology Document

- Map field paths to concept URIs via `concepts` bindings
- Use `equivalents` for cross-system matching (SKOS relationship types)
- Use `vocabularies` for option set alignment
- Use `alignments` for cross-form field matching
- Use `context` for JSON-LD export of profile data

### With Browser Extension

```
┌──────────────┐    postMessage     ┌──────────────────┐
│   Extension  │◄──────────────────►│  formspec-assist  │
│  (content    │    AgentProtocol   │  (in-page)        │
│   script)    │                    │                    │
├──────────────┤                    ├──────────────────┤
│  Extension   │                    │  FormEngine       │
│  Storage     │                    │  References       │
│  (profiles)  │                    │  Ontology         │
└──────────────┘                    └──────────────────┘
```

### With Native Browser Autofill

Browsers already have autofill (autocomplete attribute). The ontology layer can map formspec concepts to HTML autocomplete tokens:

```typescript
const CONCEPT_TO_AUTOCOMPLETE: Record<string, string> = {
  'https://schema.org/givenName': 'given-name',
  'https://schema.org/familyName': 'family-name',
  'https://schema.org/email': 'email',
  'https://schema.org/telephone': 'tel',
  'https://schema.org/streetAddress': 'street-address',
  'https://schema.org/addressLocality': 'address-level2',
  'https://schema.org/addressRegion': 'address-level1',
  'https://schema.org/postalCode': 'postal-code',
  'https://schema.org/addressCountry': 'country',
  // ...
};
```

The web component renderer could use this mapping to set `autocomplete` attributes automatically, getting browser-native autofill for free.

### With MCP (for AI Agent Integration)

Expose the agent protocol as MCP tools so any MCP-compatible AI agent can fill forms:

```
formspec_assist_describe    — describe form structure
formspec_assist_read        — read field values and state
formspec_assist_write       — set field values
formspec_assist_explain     — get field help from references
formspec_assist_validate    — check current state
formspec_assist_autofill    — apply profile data
formspec_assist_progress    — get completion status
```

This bridges the authoring-side MCP tools (in `formspec-mcp`) with a filling-side MCP surface.

---

## Open Questions

1. **Where does the LLM live?** For chat-mode Q&A, we need an LLM. Options: (a) bring-your-own adapter like formspec-chat does, (b) references-only mode that works without LLM, (c) both. Leaning toward (c) — structured help always works, LLM enhances it.

2. **Profile portability format.** Should profiles be a new schema (`profile.schema.json`)? Or an extension of the response format? Leaning toward new schema — profiles are concept-keyed, responses are path-keyed.

3. **Privacy & consent.** The profile store holds PII. Need clear consent model. Should the assist layer enforce consent gates, or is that the host app's responsibility? Probably: assist layer provides the mechanism (encrypted storage, explicit save actions), host app provides the policy.

4. **Conflict resolution.** When multiple sources suggest different values for the same field (profile says X, document extraction says Y, another agent says Z), how do we present this? Ranked list with provenance? User always decides?

5. **Ontology coverage.** Not all forms will have ontology documents. Fallback strategies: (a) label-based fuzzy matching, (b) form-author-provided field aliases, (c) no autofill for unmapped fields. Probably (c) by default with (a) as opt-in.

6. **Relationship to formspec-chat.** formspec-chat is for *authoring* (building forms). formspec-assist is for *filling* (completing forms). They share some infrastructure (LLM adapters, session management) but serve completely different users. Should they share code? Probably only types and adapter interfaces.

---

## MVP Scope

For a first cut, focus on the highest-leverage features:

1. **Context resolver** — given a field path, resolve all references + ontology and return structured `FieldHelp`
2. **Agent protocol** — `form.describe`, `field.describe`, `field.getState`, `field.setValue`, `form.validate`, `form.getProgress`
3. **Profile store** — concept-keyed storage with `localStorage` backend, exact-match autofill
4. **Autocomplete bridge** — ontology concepts → HTML autocomplete tokens for free browser autofill

Everything else (chat, guided flow, document extraction, multi-agent, browser extension) builds on these four.
