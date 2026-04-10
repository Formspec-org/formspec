# @formspec-org/chat

Conversational form builder core. AI adapter interfaces, session orchestration, source tracing, issue tracking, template library, and session persistence. No React or DOM dependencies.

## Install

```bash
npm install @formspec-org/chat
```

## Architecture

`formspec-chat` is a thin conversation orchestrator. It does **not** own a Project or MCP server — the host (e.g. Formspec Studio) provides a `ToolContext` that connects the session to whatever tool surface is available.

**Three-phase lifecycle:**

1. **Interview** — `AIAdapter.chat()` conducts a guided conversation. The adapter signals `readyToScaffold` when enough information is gathered.
2. **Scaffold** — `AIAdapter.generateScaffold()` produces a `FormDefinition` from the conversation, a template, or an uploaded file.
3. **Refine** — `AIAdapter.refineForm()` modifies the existing form via tool calls routed through the host-provided `ToolContext`.

```
ChatSession               Orchestrates the interview -> scaffold -> refine loop.
  +-- AIAdapter            Interface for any AI provider.
  |     +-- GeminiAdapter  Production adapter (Google Gemini, structured output + tool-use).
  |     +-- MockAdapter    Offline test adapter. Template-based scaffolding, no real refinement.
  +-- SourceTraceManager   Provenance: links each form element to the message/upload/template that created it.
  +-- IssueQueue           Tracks problems, contradictions, and low-confidence elements.
  +-- ToolContext           Host-injected. Routes tool calls to the MCP server the host owns.

TemplateLibrary            Five built-in archetypes for quick-start scaffolding.
SessionStore               Serializes sessions via a StorageBackend (localStorage, in-memory map, etc).
extractRegistryHints       Extracts extension registry info into compact text for AI prompt injection.
diff(old, new)             Structural diff between two FormDefinitions (added/removed/modified keys).
```

## Quick Usage

```typescript
import { ChatSession, MockAdapter } from '@formspec-org/chat';

// Create a session with the offline adapter
const session = new ChatSession({ adapter: new MockAdapter() });

// Interview phase — send messages, adapter guides the conversation
const reply = await session.sendMessage('I need a patient intake form');
// reply.content is the AI's response
// session.isReadyToScaffold() becomes true when the adapter has enough info

// Generate the form
await session.scaffold();
const definition = session.getDefinition();

// For refinement, the host must provide a ToolContext
session.setToolContext(toolContext);
await session.sendMessage('Add an email field with validation');

// Export
const json = session.exportJSON();
const bundle = session.exportBundle(); // definition + component + theme + mapping

// Persist
const store = new SessionStore(localStorage);
store.save(session.toState());

// Restore (host must call setToolContext() again after restore)
const state = store.load(session.id);
const restored = await ChatSession.fromState(state, new MockAdapter());
```

## API

### `ChatSession`

```typescript
new ChatSession(options: {
  adapter: AIAdapter;
  id?: string;
  buildBundle?: (definition: FormDefinition) => ProjectBundle;
})
```

The `buildBundle` callback is injected by the host to convert a bare definition into a full ProjectBundle (definition + component tree + theme + mapping). When omitted, `getBundle()` returns null.

| Method | Returns | Description |
|---|---|---|
| `sendMessage(content)` | `Promise<ChatMessage>` | Send a user message. Runs interview (pre-scaffold) or refinement (post-scaffold). |
| `scaffold()` | `Promise<void>` | Generate a form from the conversation so far. Streams progress via `getScaffoldingText()`. |
| `startFromTemplate(id)` | `Promise<void>` | Initialize from a built-in template. |
| `startFromUpload(attachment)` | `Promise<void>` | Extract structure from an uploaded file, then scaffold. |
| `regenerate()` | `Promise<void>` | Discard the current form and re-scaffold from the full conversation history. |
| `setToolContext(ctx)` | `void` | Inject a `ToolContext` for MCP-backed refinement. Required before `sendMessage` can refine. |
| `getToolContext()` | `ToolContext \| null` | Returns the current tool context, or null. |
| `getDefinition()` | `FormDefinition \| null` | Current form definition, or null if not yet scaffolded. |
| `hasDefinition()` | `boolean` | Whether a definition exists. |
| `isReadyToScaffold()` | `boolean` | Whether the interview has gathered enough info. |
| `getBundle()` | `ProjectBundle \| null` | Full project bundle, or null if `buildBundle` was not provided. |
| `getLastDiff()` | `DefinitionDiff \| null` | Structural diff from the most recent refinement. |
| `getMessages()` | `ChatMessage[]` | Full message history. |
| `getTraces()` | `SourceTrace[]` | All source traces. |
| `getTracesForElement(path)` | `SourceTrace[]` | Traces for a specific field path. |
| `getIssues()` | `Issue[]` | All issues. |
| `getOpenIssueCount()` | `number` | Count of unresolved issues. |
| `resolveIssue(id)` | `void` | Mark an issue resolved. |
| `deferIssue(id)` | `void` | Mark an issue deferred. |
| `exportJSON()` | `FormDefinition` | Export the current definition. Throws if none exists. |
| `exportBundle()` | `ProjectBundle` | Export the full bundle. Throws if none exists. |
| `getDebugLog()` | `DebugEntry[]` | Raw debug log of all adapter calls (sent/received/error). |
| `getScaffoldingText()` | `string \| null` | Partial JSON while scaffold is streaming, null otherwise. |
| `truncate(messageId, includeSelf?)` | `void` | Remove messages after (or including) the given ID. |
| `onChange(listener)` | `() => void` | Subscribe to state changes. Returns unsubscribe function. |
| `toState()` | `ChatSessionState` | Serialize session for persistence. |
| `ChatSession.fromState(state, adapter, buildBundle?)` | `Promise<ChatSession>` | Restore from serialized state. Note: no `ToolContext` — host must call `setToolContext()`. |

### `AIAdapter` interface

```typescript
interface AIAdapter {
  chat(messages: ChatMessage[]): Promise<ConversationResponse>;
  generateScaffold(request: ScaffoldRequest, onProgress?: ScaffoldProgressCallback): Promise<ScaffoldResult>;
  refineForm(messages: ChatMessage[], instruction: string, toolContext: ToolContext): Promise<RefinementResult>;
  extractFromFile(attachment: Attachment): Promise<string>;
  isAvailable(): Promise<boolean>;
}
```

| Method | Purpose |
|---|---|
| `chat` | Interview phase. Returns `{ message, readyToScaffold }`. |
| `generateScaffold` | Produce a `FormDefinition` from conversation, template, or upload. Accepts an optional progress callback for streaming. |
| `refineForm` | Modify an existing form via tool calls. Receives the host's `ToolContext` with tool declarations and a `callTool` dispatcher. Returns a summary message and a log of tool calls executed. |
| `extractFromFile` | Extract structured content from an uploaded file attachment. |
| `isAvailable` | Check if credentials/model are available. |

### `ToolContext`

The host (e.g. Studio) provides this after scaffolding so the adapter can discover and invoke tools.

```typescript
interface ToolContext {
  tools: ToolDeclaration[];
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
  getProjectSnapshot?(): Promise<{ definition: FormDefinition } | null>;
}
```

### `GeminiAdapter`

Production adapter using Google Gemini. Uses structured output (JSON schema) for scaffolding and function calling for refinement.

```typescript
new GeminiAdapter(apiKey: string, model?: string, registryHints?: string)
```

- `model` defaults to `'gemini-3-flash-preview'`
- `registryHints` is a text block from `extractRegistryHints()` injected into the scaffold prompt

### `MockAdapter`

Offline test adapter. Uses templates for scaffold generation and simple heuristics for conversation-based scaffolding. Cannot meaningfully refine forms. No API key required.

### `SourceTraceManager`

Tracks which message, upload, or template produced each form element.

```typescript
manager.addTrace(trace)
manager.getTracesForElement(path)
manager.getTracesForSource(sourceId)
manager.removeTracesForElement(path)
manager.toJSON() / SourceTraceManager.fromJSON(data)
```

### `IssueQueue`

Tracks problems found during generation.

```typescript
queue.addIssue({ severity, category, title, description, sourceIds })
queue.resolveIssue(id)
queue.deferIssue(id)
queue.reopenIssue(id)
queue.getOpenIssues()
queue.getIssuesByElement(path)
queue.getIssueCount()   // { open, resolved, deferred }
queue.toJSON() / IssueQueue.fromJSON(data)
```

Severities: `'error' | 'warning' | 'info'`
Categories: `'missing-config' | 'contradiction' | 'low-confidence' | 'validation'`

### `diff(oldDef, newDef)`

```typescript
const { added, removed, modified } = diff(previousDef, newDef);
```

### `TemplateLibrary`

```typescript
const library = new TemplateLibrary();
library.getAll()       // Template[]
library.getById(id)    // Template | undefined
```

Built-in IDs: `housing-intake`, `grant-application`, `patient-intake`, `compliance-checklist`, `employee-onboarding`.

### `SessionStore`

```typescript
const store = new SessionStore(backend);  // backend implements StorageBackend
store.save(state)
store.load(id)    // ChatSessionState | null
store.delete(id)
store.list()      // SessionSummary[]
```

`StorageBackend` requires `getItem`, `setItem`, `removeItem`. Pass `localStorage` in the browser or a `Map`-backed object in tests.

### `extractRegistryHints`

Extracts a compact text block from a registry document for AI prompt injection. Groups entries by category (dataType, constraint, function) with usage examples.

```typescript
import { extractRegistryHints } from '@formspec-org/chat';
const hints = extractRegistryHints(registryDoc);
// Pass to GeminiAdapter constructor as registryHints
```

### `validateProviderConfig`

```typescript
const errors = validateProviderConfig({ provider: 'google', apiKey: '...' });
// ProviderValidationError[] — empty means valid
```

## Dependencies

- `@formspec-org/types` — shared Formspec type definitions
- `@google/genai` — Google Gemini SDK (used by `GeminiAdapter`)
