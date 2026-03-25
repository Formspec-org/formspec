/**
 * Formspec Chat — conversational form builder core.
 *
 * Pure TypeScript logic for the chat-based form building experience.
 * No React/DOM dependencies — those belong in the UI layer.
 */

// Types
export type {
  ChatMessage,
  Attachment,
  SourceTrace,
  SourceType,
  Issue,
  IssueSeverity,
  IssueCategory,
  IssueStatus,
  ConversationResponse,
  ScaffoldResult,
  AIAdapter,
  ScaffoldRequest,
  ProviderConfig,
  ProviderType,
  Template,
  ChatProjectSnapshot,
  ChatSessionState,
  StorageBackend,
  SessionSummary,
  ToolDeclaration,
  ToolCallResult,
  ToolContext,
  ToolCallRecord,
  RefinementResult,
  DebugEntry,
  ScaffoldProgressCallback,
} from './types.js';

// Modules
export { SourceTraceManager } from './source-trace.js';
export { IssueQueue } from './issue-queue.js';
export { validateProviderConfig, type ProviderValidationError } from './provider-config.js';
export { TemplateLibrary } from './template-library.js';
export { GeminiAdapter } from './gemini-adapter.js';
export { MockAdapter } from './mock-adapter.js';
export { SessionStore } from './session-store.js';
export { diff, type DefinitionDiff } from './form-scaffolder.js';
export { buildBundleFromDefinition } from './bundle-builder.js';
export { ChatSession } from './chat-session.js';
export { extractRegistryHints } from './registry-hints.js';
export type { RegistryDocument, RegistryHintEntry } from './registry-hints.js';
