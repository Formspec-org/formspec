/**
 * Formspec Chat — type vocabulary.
 *
 * All types for the chat-based form builder: messages, traces, issues,
 * adapters, templates, and session persistence.
 */

import type { FormDefinition } from '@formspec-org/types';

// ── Chat Messages ────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  type: 'pdf' | 'image' | 'spreadsheet' | 'json' | 'text';
  name: string;
  /** Raw file data or extracted text content. */
  data: string;
  /** Structured content extracted by the AI adapter. */
  extractedContent?: string;
}

// ── Source Traces ────────────────────────────────────────────────────

export type SourceType = 'message' | 'upload' | 'template';

export interface SourceTrace {
  /** Path in the form definition (e.g., "name", "address.street"). */
  elementPath: string;
  /** Origin type. */
  sourceType: SourceType;
  /** Reference to the origin (message ID, attachment ID, or template ID). */
  sourceId: string;
  /** Human-readable explanation (e.g., "From your message about income verification"). */
  description: string;
  /** When this trace was created. */
  timestamp: number;
}

// ── Issue Queue ─────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueCategory =
  | 'missing-config'
  | 'contradiction'
  | 'low-confidence'
  | 'validation';
export type IssueStatus = 'open' | 'resolved' | 'deferred';

export interface Issue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  /** Linked form element path. */
  elementPath?: string;
  /** Related message/upload IDs for citation. */
  sourceIds: string[];
  status: IssueStatus;
  /** Message ID that resolved this issue. */
  resolvedBy?: string;
}

// ── Conversation Response ────────────────────────────────────────────

export interface ConversationResponse {
  message: string;
  readyToScaffold: boolean;
}

// ── AI Adapter ──────────────────────────────────────────────────────

export interface ScaffoldResult {
  /** The generated/updated form definition. */
  definition: FormDefinition;
  /** Source traces for generated elements. */
  traces: SourceTrace[];
  /** Issues discovered during generation. */
  issues: Omit<Issue, 'id' | 'status'>[];
}

// ── Tool Context (for MCP-backed refinement) ────────────────────────

/** A tool declaration surfaced from the MCP server, ready for LLM consumption. */
export interface ToolDeclaration {
  name: string;
  description: string;
  /** JSON Schema for the tool's parameters (project_id already stripped). */
  inputSchema: Record<string, unknown>;
}

/** Result of executing a single MCP tool call. */
export interface ToolCallResult {
  content: string;
  isError: boolean;
}

/** Passed to adapters so they can discover and invoke MCP tools. */
export interface ToolContext {
  tools: ToolDeclaration[];
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
  /** Get the current project state snapshot (for diff tracking after refinement). */
  getProjectSnapshot?(): Promise<{ definition: FormDefinition } | null>;
  /** Get the current workspace selection and viewport for AI context. */
  getWorkspaceContext?(): { selection: { path: string; sourceTab: string } | null; viewport: 'desktop' | 'tablet' | 'mobile' | null };
}

/** Record of a tool call executed during refinement (for logging/traces). */
export interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  result: string;
  isError: boolean;
}

/** Result of an adapter's refinement via tool calls. */
export interface RefinementResult {
  /** AI's natural language summary of what changed. */
  message: string;
  /** Log of tool calls executed. */
  toolCalls: ToolCallRecord[];
}

/** Called with accumulated text as a scaffold streams in. */
export type ScaffoldProgressCallback = (text: string) => void;

export interface AIAdapter {
  /** Conduct a guided interview conversation before scaffolding. */
  chat(messages: ChatMessage[]): Promise<ConversationResponse>;

  /** Generate a scaffold from the initial input. */
  generateScaffold(request: ScaffoldRequest, onProgress?: ScaffoldProgressCallback): Promise<ScaffoldResult>;

  /** Refine an existing form via MCP tool calls. */
  refineForm(
    messages: ChatMessage[],
    instruction: string,
    toolContext: ToolContext,
  ): Promise<RefinementResult>;

  /** Extract structure from an uploaded file. */
  extractFromFile(attachment: Attachment): Promise<string>;

  /** Check if the adapter is available (has valid credentials, etc). */
  isAvailable(): Promise<boolean>;
}

export type ScaffoldRequest =
  | { type: 'template'; templateId: string }
  | { type: 'conversation'; messages: ChatMessage[] }
  | { type: 'upload'; extractedContent: string };

// ── Provider Config ─────────────────────────────────────────────────

export type ProviderType = 'anthropic' | 'google' | 'openai';

export interface ProviderConfig {
  provider: ProviderType;
  apiKey: string;
  model?: string;
}

// ── Templates ───────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  /** The pre-built form definition. */
  definition: FormDefinition;
}

// ── Debug Log ───────────────────────────────────────────────────

export interface DebugEntry {
  timestamp: number;
  direction: 'sent' | 'received' | 'error';
  label: string;
  data: unknown;
}

// ── Session Persistence ─────────────────────────────────────────────

export interface ChatProjectSnapshot {
  definition: FormDefinition | null;
}

export interface ChatSessionState {
  id: string;
  messages: ChatMessage[];
  projectSnapshot: ChatProjectSnapshot;
  traces: SourceTrace[];
  issues: Issue[];
  debugLog?: DebugEntry[];
  createdAt: number;
  updatedAt: number;
  templateId?: string;
  readyToScaffold?: boolean;
}

// ── Session Store ───────────────────────────────────────────────────

/**
 * Storage backend abstraction.
 * In the browser this wraps localStorage/IndexedDB.
 * In tests this can be a simple in-memory map.
 */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ── Session Summary (for listing recent sessions) ───────────────────

export interface SessionSummary {
  id: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  templateId?: string;
  /** First user message, truncated for display. */
  preview: string;
}
