/**
 * Formspec Chat — type vocabulary.
 *
 * All types for the chat-based form builder: messages, traces, issues,
 * adapters, templates, and session persistence.
 */

import type { FormDefinition } from 'formspec-types';

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
  type: 'pdf' | 'image' | 'spreadsheet' | 'json';
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

export interface AIAdapter {
  /** Conduct a guided interview conversation before scaffolding. */
  chat(messages: ChatMessage[]): Promise<ConversationResponse>;

  /** Generate a scaffold from the initial input. */
  generateScaffold(request: ScaffoldRequest): Promise<ScaffoldResult>;

  /** Refine an existing form based on a new instruction. */
  refineForm(
    messages: ChatMessage[],
    currentDefinition: FormDefinition,
    instruction: string,
  ): Promise<ScaffoldResult>;

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
