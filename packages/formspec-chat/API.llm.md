# @formspec/chat — API Reference

*Auto-generated from TypeScript declarations — do not hand-edit.*

Conversational form builder core. AI adapter interfaces, session management, template library, source tracing, issue queue, and scaffold/refinement workflows. No React/DOM dependencies.

## `buildBundleFromDefinition(definition: FormDefinition): ProjectBundle`

Build a full ProjectBundle from a bare definition.

Uses createRawProject to generate the component tree, theme, and mapping
that the definition implies. On failure (degenerate definition), returns
a minimal bundle with the definition and empty/null documents.

#### class `ChatSession`

Orchestrates a conversational form-building session.

Composes SourceTraceManager, IssueQueue, and an AIAdapter
into a coherent conversation flow. Manages message history, form state,
and session serialization.

##### `constructor(options: {
        adapter: AIAdapter;
        id?: string;
    })`

##### `getMessages(): ChatMessage[]`

##### `getTraces(): SourceTrace[]`

##### `getTracesForElement(path: string): SourceTrace[]`

##### `getIssues(): Issue[]`

##### `getOpenIssueCount(): number`

##### `resolveIssue(id: string): void`

##### `deferIssue(id: string): void`

##### `onChange(listener: () => void): () => void`

Subscribe to state changes. Returns an unsubscribe function.

##### `getDefinition(): FormDefinition | null`

##### `hasDefinition(): boolean`

##### `isReadyToScaffold(): boolean`

##### `getBundle(): ProjectBundle | null`

##### `getLastDiff(): DefinitionDiff | null`

Returns the diff from the last refinement, or null if no refinement
has occurred yet (initial scaffold or template start).

##### `getDebugLog(): DebugEntry[]`

##### `getScaffoldingText(): string | null`

##### `sendMessage(content: string): Promise<ChatMessage>`

Send a user message and get an assistant response.
On the first meaningful message, generates a scaffold.
On subsequent messages, refines the existing form.

##### `scaffold(): Promise<void>`

Generate a form scaffold from the conversation so far.
Called when the user explicitly triggers scaffolding after the interview.

##### `startFromTemplate(templateId: string): Promise<void>`

Initialize the session from a template.

##### `startFromUpload(attachment: Attachment): Promise<void>`

Initialize the session from an uploaded file.
Extracts content via the adapter, then scaffolds from the extracted text.

##### `regenerate(): Promise<void>`

Re-generate the form from scratch using the entire conversation history.
Discards the current definition/bundle and scaffolds a new one.

##### `exportJSON(): FormDefinition`

Export the current form definition as JSON.

##### `exportBundle(): ProjectBundle`

Export the full project bundle (definition + component + theme + mapping).

##### `toState(): ChatSessionState`

Serialize the full session state for persistence.

##### `fromState(state: ChatSessionState, adapter: AIAdapter): Promise<ChatSession>`

Restore a session from serialized state.

##### `truncate(messageId: string, includeSelf?: boolean): void`

Remove all messages following the message with the given ID.
If includeSelf is true, also removes the message with the given ID.

## `diff(oldDef: FormDefinition, newDef: FormDefinition): DefinitionDiff`

Compute a structural diff between two form definitions.
Returns lists of added, removed, and modified item keys.

#### interface `DefinitionDiff`

- **added**: `string[]`
- **removed**: `string[]`
- **modified**: `string[]`

#### class `GeminiAdapter`

##### `constructor(apiKey: string, model?: string, registryHints?: string)`

##### `isAvailable(): Promise<boolean>`

##### `chat(messages: ChatMessage[]): Promise<ConversationResponse>`

##### `generateScaffold(request: ScaffoldRequest, onProgress?: ScaffoldProgressCallback): Promise<ScaffoldResult>`

##### `refineForm(messages: ChatMessage[], instruction: string, toolContext: ToolContext): Promise<RefinementResult>`

##### `extractFromFile(attachment: Attachment): Promise<string>`

#### class `IssueQueue`

Persistent issue queue — tracks problems, contradictions, and
low-confidence elements in the generated form.

##### `addIssue(input: Omit<Issue, 'id' | 'status'>): Issue`

##### `resolveIssue(id: string, resolvedBy?: string): void`

##### `deferIssue(id: string): void`

##### `reopenIssue(id: string): void`

##### `getOpenIssues(): Issue[]`

##### `getAllIssues(): Issue[]`

##### `getIssuesByElement(path: string): Issue[]`

##### `getIssueCount(): {
        open: number;
        resolved: number;
        deferred: number;
    }`

##### `removeIssuesForElement(path: string): void`

##### `toJSON(): Issue[]`

##### `fromJSON(data: Issue[]): IssueQueue`

#### class `McpBridge`

In-process bridge from chat to the formspec MCP tool surface.

Creates a formspec-mcp Server + Client connected via InMemoryTransport.
The bridge owns a single Project loaded from the scaffolded definition.
All tool calls are routed through the MCP protocol, giving the AI adapter
the same tool schemas and dispatch as a standalone MCP session.

##### `create(definition: FormDefinition): Promise<McpBridge>`

Create a bridge with a project pre-loaded from the given definition.

##### `consumeLoadDiagnostics(): Omit<Issue, 'id' | 'status'>[]`

Consume and clear the diagnostics from the initial load.

##### `audit(): Promise<Omit<Issue, 'id' | 'status'>[]>`

Run project diagnostics via formspec_describe(mode="audit").
Returns issues found in the current project state.

##### `getTools(): Promise<ToolDeclaration[]>`

Get tool declarations for LLM consumption (project_id stripped).

##### `getToolContext(): Promise<ToolContext>`

Build a ToolContext for adapter consumption.

##### `callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>`

Execute a tool call, injecting project_id automatically.

##### `getDefinition(): FormDefinition`

Read the current definition from the underlying project.

##### `getBundle(): ProjectBundle`

Read the full project bundle.

##### `close(): Promise<void>`

Tear down the bridge.

#### class `MockAdapter`

Offline test adapter — works without an API key.
Uses templates for scaffold generation and simple heuristics for
conversation-based scaffolding. Cannot meaningfully refine forms.

Intended for unit/integration tests only. Production uses GeminiAdapter.

##### `isAvailable(): Promise<boolean>`

##### `chat(messages: ChatMessage[]): Promise<ConversationResponse>`

##### `generateScaffold(request: ScaffoldRequest): Promise<ScaffoldResult>`

##### `refineForm(_messages: ChatMessage[], instruction: string, toolContext: ToolContext): Promise<RefinementResult>`

##### `extractFromFile(_attachment: Attachment): Promise<string>`

## `validateProviderConfig(config: ProviderConfig): ProviderValidationError[]`

#### interface `ProviderValidationError`

- **field**: `string`
- **message**: `string`

## `extractRegistryHints(registry: RegistryDocument): string`

Extracts a compact text block from a registry document that an AI model
can use to generate fields with the correct extension declarations.

Groups entries by category (dataType, constraint, function) and produces
usage examples the model can follow.

#### interface `RegistryHintEntry`

@filedesc Extracts concise extension hints from a registry document for AI prompt injection.

- **name**: `string`
- **category**: `string`
- **description**: `string`
- **baseType?**: `string`
- **constraints?**: `Record<string, unknown>`
- **metadata?**: `Record<string, unknown>`
- **parameters?**: `Array<{
        name: string;
        type: string;
        description: string;
    }>`
- **returns?**: `string`
- **examples?**: `Array<Record<string, unknown> | string>`

#### interface `RegistryDocument`

Minimal registry document shape accepted by {@link extractRegistryHints}.

- **entries**: `RegistryHintEntry[]`

#### class `SessionStore`

Persists chat sessions to a StorageBackend (localStorage in browser,
in-memory Map in tests). Each session is stored as a separate key;
a separate index key tracks all session IDs for listing.

##### `constructor(storage: StorageBackend)`

##### `save(session: ChatSessionState): void`

##### `load(id: string): ChatSessionState | null`

##### `delete(id: string): void`

##### `list(): SessionSummary[]`

#### class `SourceTraceManager`

Manages source traces — provenance links between form elements
and their origins (chat messages, uploads, or templates).

##### `addTrace(trace: SourceTrace): void`

##### `addTraces(traces: SourceTrace[]): void`

##### `getAllTraces(): SourceTrace[]`

##### `getTracesForElement(path: string): SourceTrace[]`

##### `getTracesForSource(sourceId: string): SourceTrace[]`

##### `removeTracesForElement(path: string): void`

##### `clear(): void`

##### `toJSON(): SourceTrace[]`

##### `fromJSON(data: SourceTrace[]): SourceTraceManager`

#### class `TemplateLibrary`

Catalog of 5 template archetypes for the Chat entry screen.

##### `getAll(): Template[]`

##### `getById(id: string): Template | undefined`

#### interface `ChatMessage`

- **id**: `string`
- **role**: `'user' | 'assistant' | 'system'`
- **content**: `string`
- **timestamp**: `number`
- **attachments?**: `Attachment[]`

#### interface `Attachment`

- **data** (`string`): Raw file data or extracted text content.
- **extractedContent** (`string`): Structured content extracted by the AI adapter.

#### interface `SourceTrace`

- **elementPath** (`string`): Path in the form definition (e.g., "name", "address.street").
- **sourceType** (`SourceType`): Origin type.
- **sourceId** (`string`): Reference to the origin (message ID, attachment ID, or template ID).
- **description** (`string`): Human-readable explanation (e.g., "From your message about income verification").
- **timestamp** (`number`): When this trace was created.

#### interface `Issue`

- **elementPath** (`string`): Linked form element path.
- **sourceIds** (`string[]`): Related message/upload IDs for citation.
- **resolvedBy** (`string`): Message ID that resolved this issue.

#### interface `ConversationResponse`

- **message**: `string`
- **readyToScaffold**: `boolean`

#### interface `ScaffoldResult`

- **definition** (`FormDefinition`): The generated/updated form definition.
- **traces** (`SourceTrace[]`): Source traces for generated elements.
- **issues** (`Omit<Issue, 'id' | 'status'>[]`): Issues discovered during generation.

#### interface `ToolDeclaration`

A tool declaration surfaced from the MCP server, ready for LLM consumption.

- **inputSchema** (`Record<string, unknown>`): JSON Schema for the tool's parameters (project_id already stripped).

#### interface `ToolCallResult`

Result of executing a single MCP tool call.

- **content**: `string`
- **isError**: `boolean`

#### interface `ToolContext`

Passed to adapters so they can discover and invoke MCP tools.

##### `callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>`

#### interface `ToolCallRecord`

Record of a tool call executed during refinement (for logging/traces).

- **tool**: `string`
- **args**: `Record<string, unknown>`
- **result**: `string`
- **isError**: `boolean`

#### interface `RefinementResult`

Result of an adapter's refinement via tool calls.

- **message** (`string`): AI's natural language summary of what changed.
- **toolCalls** (`ToolCallRecord[]`): Log of tool calls executed.

#### interface `AIAdapter`

##### `chat(messages: ChatMessage[]): Promise<ConversationResponse>`

Conduct a guided interview conversation before scaffolding.

##### `generateScaffold(request: ScaffoldRequest, onProgress?: ScaffoldProgressCallback): Promise<ScaffoldResult>`

Generate a scaffold from the initial input.

##### `refineForm(messages: ChatMessage[], instruction: string, toolContext: ToolContext): Promise<RefinementResult>`

Refine an existing form via MCP tool calls.

##### `extractFromFile(attachment: Attachment): Promise<string>`

Extract structure from an uploaded file.

##### `isAvailable(): Promise<boolean>`

Check if the adapter is available (has valid credentials, etc).

#### interface `ProviderConfig`

- **provider**: `ProviderType`
- **apiKey**: `string`
- **model?**: `string`

#### interface `Template`

- **definition** (`FormDefinition`): The pre-built form definition.

#### interface `DebugEntry`

- **timestamp**: `number`
- **direction**: `'sent' | 'received' | 'error'`
- **label**: `string`
- **data**: `unknown`

#### interface `ChatProjectSnapshot`

- **definition**: `FormDefinition | null`

#### interface `ChatSessionState`

- **id**: `string`
- **messages**: `ChatMessage[]`
- **projectSnapshot**: `ChatProjectSnapshot`
- **traces**: `SourceTrace[]`
- **issues**: `Issue[]`
- **debugLog?**: `DebugEntry[]`
- **createdAt**: `number`
- **updatedAt**: `number`
- **templateId?**: `string`
- **readyToScaffold?**: `boolean`

#### interface `StorageBackend`

Storage backend abstraction.
In the browser this wraps localStorage/IndexedDB.
In tests this can be a simple in-memory map.

##### `getItem(key: string): string | null`

##### `setItem(key: string, value: string): void`

##### `removeItem(key: string): void`

#### interface `SessionSummary`

- **preview** (`string`): First user message, truncated for display.

#### type `SourceType`

```ts
type SourceType = 'message' | 'upload' | 'template';
```

#### type `IssueSeverity`

```ts
type IssueSeverity = 'error' | 'warning' | 'info';
```

#### type `IssueCategory`

```ts
type IssueCategory = 'missing-config' | 'contradiction' | 'low-confidence' | 'validation';
```

#### type `IssueStatus`

```ts
type IssueStatus = 'open' | 'resolved' | 'deferred';
```

#### type `ScaffoldProgressCallback`

Called with accumulated text as a scaffold streams in.

```ts
type ScaffoldProgressCallback = (text: string) => void;
```

#### type `ScaffoldRequest`

```ts
type ScaffoldRequest = {
    type: 'template';
    templateId: string;
} | {
    type: 'conversation';
    messages: ChatMessage[];
} | {
    type: 'upload';
    extractedContent: string;
};
```

#### type `ProviderType`

```ts
type ProviderType = 'anthropic' | 'google' | 'openai';
```

