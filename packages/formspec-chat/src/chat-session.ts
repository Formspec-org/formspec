/** @filedesc Orchestrates a conversational form-building session with AI adapters. */
import type {
  AIAdapter, Attachment, ChatMessage, ChatSessionState,
  ScaffoldRequest, SourceTrace, Issue, DebugEntry,
} from './types.js';
import type { FormDefinition } from 'formspec-types';
import type { ProjectBundle } from 'formspec-core';
import { SourceTraceManager } from './source-trace.js';
import { IssueQueue } from './issue-queue.js';
import { diff, type DefinitionDiff } from './form-scaffolder.js';
import { buildBundleFromDefinition } from './bundle-builder.js';
import { McpBridge } from './mcp-bridge.js';

let sessionCounter = 0;

function nextSessionId(): string {
  return `chat-${++sessionCounter}-${Date.now()}`;
}

/**
 * Orchestrates a conversational form-building session.
 *
 * Composes SourceTraceManager, IssueQueue, and an AIAdapter
 * into a coherent conversation flow. Manages message history, form state,
 * and session serialization.
 */
export class ChatSession {
  readonly id: string;
  private adapter: AIAdapter;
  private messages: ChatMessage[] = [];
  private traces: SourceTraceManager = new SourceTraceManager();
  private issues: IssueQueue = new IssueQueue();
  private definition: FormDefinition | null = null;
  private bundle: ProjectBundle | null = null;
  private createdAt: number;
  private updatedAt: number;
  private templateId?: string;
  private lastDiff: DefinitionDiff | null = null;
  private readyToScaffold = false;
  private listeners: Set<() => void> = new Set();
  private messageCounter = 0;
  private bridge: McpBridge | null = null;
  private debugLog: DebugEntry[] = [];
  private scaffoldingText: string | null = null;

  constructor(options: { adapter: AIAdapter; id?: string }) {
    this.adapter = options.adapter;
    this.id = options.id ?? nextSessionId();
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getTraces(): SourceTrace[] {
    return this.traces.getAllTraces();
  }

  getTracesForElement(path: string): SourceTrace[] {
    return this.traces.getTracesForElement(path);
  }

  getIssues(): Issue[] {
    return this.issues.getAllIssues();
  }

  getOpenIssueCount(): number {
    return this.issues.getIssueCount().open;
  }

  resolveIssue(id: string): void {
    this.issues.resolveIssue(id);
    this.notify();
  }

  deferIssue(id: string): void {
    this.issues.deferIssue(id);
    this.notify();
  }

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getDefinition(): FormDefinition | null {
    return this.definition;
  }

  hasDefinition(): boolean {
    return this.definition !== null;
  }

  isReadyToScaffold(): boolean {
    return this.readyToScaffold;
  }

  getBundle(): ProjectBundle | null {
    return this.bundle;
  }

  /**
   * Returns the diff from the last refinement, or null if no refinement
   * has occurred yet (initial scaffold or template start).
   */
  getLastDiff(): DefinitionDiff | null {
    return this.lastDiff;
  }

  getDebugLog(): DebugEntry[] {
    return [...this.debugLog];
  }

  getScaffoldingText(): string | null {
    return this.scaffoldingText;
  }

  private log(direction: DebugEntry['direction'], label: string, data: unknown): void {
    this.debugLog.push({ timestamp: Date.now(), direction, label, data });
  }

  /**
   * Send a user message and get an assistant response.
   * On the first meaningful message, generates a scaffold.
   * On subsequent messages, refines the existing form.
   */
  async sendMessage(content: string): Promise<ChatMessage> {
    const userMsg: ChatMessage = {
      id: this.nextMessageId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.messages.push(userMsg);

    let assistantContent: string;

    try {
      if (!this.definition) {
        // Interview phase — gather requirements before scaffolding
        this.log('sent', 'chat', { messages: this.messages });
        const response = await this.adapter.chat(this.messages);
        this.log('received', 'chat', response);
        this.readyToScaffold = response.readyToScaffold;
        assistantContent = response.message;
      } else {
        // Refine existing form via MCP tools
        const previousDef = this.definition;
        const toolContext = await this.bridge!.getToolContext();
        this.log('sent', 'refineForm', { instruction: content, toolCount: toolContext.tools.length });
        const result = await this.adapter.refineForm(
          this.messages,
          content,
          toolContext,
        );
        this.log('received', 'refineForm', result);

        // Read back updated state from the bridge
        this.definition = this.bridge!.getDefinition();
        this.bundle = this.bridge!.getBundle();
        this.lastDiff = diff(previousDef, this.definition);

        // Generate traces from tool calls
        const traces: SourceTrace[] = result.toolCalls
          .filter(tc => !tc.isError)
          .map(tc => ({
            elementPath: (tc.args.path ?? tc.args.target ?? '') as string,
            sourceType: 'message' as const,
            sourceId: userMsg.id,
            description: `${tc.tool}: ${JSON.stringify(tc.args).slice(0, 60)}`,
            timestamp: Date.now(),
          }));
        this.traces.addTraces(traces);

        assistantContent = result.message;
      }
    } catch (err) {
      this.log('error', 'sendMessage', { error: (err as Error).message, stack: (err as Error).stack });
      const errorMsg: ChatMessage = {
        id: this.nextMessageId(),
        role: 'system',
        content: `Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: Date.now(),
      };
      this.messages.push(errorMsg);
      this.updatedAt = Date.now();
      this.notify();
      return errorMsg;
    }

    const assistantMsg: ChatMessage = {
      id: this.nextMessageId(),
      role: 'assistant',
      content: assistantContent,
      timestamp: Date.now(),
    };
    this.messages.push(assistantMsg);
    this.updatedAt = Date.now();
    this.notify();

    return assistantMsg;
  }

  /**
   * Generate a form scaffold from the conversation so far.
   * Called when the user explicitly triggers scaffolding after the interview.
   */
  async scaffold(): Promise<void> {
    const request: ScaffoldRequest = { type: 'conversation', messages: this.messages };
    this.log('sent', 'scaffold', request);
    this.scaffoldingText = '';
    this.notify();

    try {
      const result = await this.adapter.generateScaffold(request, (text) => {
        this.scaffoldingText = text;
        this.notify();
      });
      this.log('received', 'scaffold', { title: result.definition.title, itemCount: result.definition.items.length, issueCount: result.issues.length });

      // Create bridge BEFORE setting definition — if it fails, session stays in interview phase
      const bridge = await this.replaceBridge(result.definition);

      this.definition = result.definition;
      this.bundle = buildBundleFromDefinition(result.definition);
      this.lastDiff = null;
      this.traces.addTraces(result.traces);
      this.addIssuesFromResult(result.issues);

      const loadDiags = bridge.consumeLoadDiagnostics();
      this.addIssuesFromResult(loadDiags);
      this.readyToScaffold = false;

      const systemMsg: ChatMessage = {
        id: this.nextMessageId(),
        role: 'system',
        content: `Generated form: "${result.definition.title}" with ${result.definition.items.length} fields.`,
        timestamp: Date.now(),
      };
      this.messages.push(systemMsg);

      // Auto-fix: if audit found errors, run refinement rounds to correct them
      const errors = loadDiags.filter(d => d.severity === 'error');
      if (errors.length > 0) {
        await this.autoFix(errors);
      }
    } catch (err) {
      this.log('error', 'scaffold', { error: (err as Error).message, stack: (err as Error).stack });
      const errorMsg: ChatMessage = {
        id: this.nextMessageId(),
        role: 'system',
        content: `Scaffold failed: ${(err as Error).message}`,
        timestamp: Date.now(),
      };
      this.messages.push(errorMsg);
    } finally {
      this.scaffoldingText = null;
      this.updatedAt = Date.now();
      this.notify();
    }
  }

  /**
   * Initialize the session from a template.
   */
  async startFromTemplate(templateId: string): Promise<void> {
    const result = await this.adapter.generateScaffold({
      type: 'template',
      templateId,
    });
    const bridge = await this.replaceBridge(result.definition);

    this.definition = result.definition;
    this.bundle = buildBundleFromDefinition(result.definition);
    this.templateId = templateId;
    this.traces.addTraces(result.traces);
    this.addIssuesFromResult(result.issues);
    this.addIssuesFromResult(bridge.consumeLoadDiagnostics());

    const systemMsg: ChatMessage = {
      id: this.nextMessageId(),
      role: 'system',
      content: `Started from template: ${result.definition.title}. You can now refine this form through conversation.`,
      timestamp: Date.now(),
    };
    this.messages.push(systemMsg);
    this.updatedAt = Date.now();
    this.notify();
  }

  /**
   * Initialize the session from an uploaded file.
   * Extracts content via the adapter, then scaffolds from the extracted text.
   */
  async startFromUpload(attachment: Attachment): Promise<void> {
    const extractedContent = await this.adapter.extractFromFile(attachment);

    const result = await this.adapter.generateScaffold({
      type: 'upload',
      extractedContent,
    });
    const bridge = await this.replaceBridge(result.definition);

    this.definition = result.definition;
    this.bundle = buildBundleFromDefinition(result.definition);
    this.traces.addTraces(result.traces);
    this.addIssuesFromResult(result.issues);
    this.addIssuesFromResult(bridge.consumeLoadDiagnostics());

    const systemMsg: ChatMessage = {
      id: this.nextMessageId(),
      role: 'system',
      content: `Processed upload: ${attachment.name}. Generated a form with ${result.definition.items.length} fields.`,
      timestamp: Date.now(),
    };
    this.messages.push(systemMsg);
    this.updatedAt = Date.now();
    this.notify();
  }

  /**
   * Re-generate the form from scratch using the entire conversation history.
   * Discards the current definition/bundle and scaffolds a new one.
   */
  async regenerate(): Promise<void> {
    const request: ScaffoldRequest = { type: 'conversation', messages: this.messages };
    this.log('sent', 'regenerate', request);
    this.scaffoldingText = '';
    this.notify();

    try {
      const result = await this.adapter.generateScaffold(request, (text) => {
        this.scaffoldingText = text;
        this.notify();
      });
      this.log('received', 'regenerate', { title: result.definition.title, itemCount: result.definition.items.length });

      const bridge = await this.replaceBridge(result.definition);

      this.definition = result.definition;
      this.bundle = buildBundleFromDefinition(result.definition);
      this.lastDiff = null;
      this.traces = new SourceTraceManager();
      this.traces.addTraces(result.traces);
      this.issues = new IssueQueue();
      this.addIssuesFromResult(result.issues);

      const loadDiags = bridge.consumeLoadDiagnostics();
      this.addIssuesFromResult(loadDiags);

      const systemMsg: ChatMessage = {
        id: this.nextMessageId(),
        role: 'system',
        content: `Regenerated form from scratch: "${result.definition.title}" with ${result.definition.items.length} fields.`,
        timestamp: Date.now(),
      };
      this.messages.push(systemMsg);

      // Auto-fix: if audit found errors, run refinement rounds to correct them
      const errors = loadDiags.filter(d => d.severity === 'error');
      if (errors.length > 0) {
        await this.autoFix(errors);
      }
    } catch (err) {
      this.log('error', 'regenerate', { error: (err as Error).message, stack: (err as Error).stack });
      const errorMsg: ChatMessage = {
        id: this.nextMessageId(),
        role: 'system',
        content: `Regeneration failed: ${(err as Error).message}`,
        timestamp: Date.now(),
      };
      this.messages.push(errorMsg);
    } finally {
      this.scaffoldingText = null;
      this.updatedAt = Date.now();
      this.notify();
    }
  }

  /**
   * Export the current form definition as JSON.
   */
  exportJSON(): FormDefinition {
    if (!this.definition) {
      throw new Error('No form has been generated yet. Send a message or select a template first.');
    }
    return this.definition;
  }

  /**
   * Export the full project bundle (definition + component + theme + mapping).
   */
  exportBundle(): ProjectBundle {
    if (!this.bundle) {
      throw new Error('No form has been generated yet. Send a message or select a template first.');
    }
    return this.bundle;
  }

  /**
   * Serialize the full session state for persistence.
   */
  toState(): ChatSessionState {
    return {
      id: this.id,
      messages: [...this.messages],
      projectSnapshot: {
        definition: this.definition,
      },
      traces: this.traces.toJSON(),
      issues: this.issues.toJSON(),
      debugLog: [...this.debugLog],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      templateId: this.templateId,
      readyToScaffold: this.readyToScaffold || undefined,
    };
  }

  /**
   * Restore a session from serialized state.
   */
  static async fromState(state: ChatSessionState, adapter: AIAdapter): Promise<ChatSession> {
    const session = new ChatSession({ adapter, id: state.id });
    session.messages = [...state.messages];
    session.definition = state.projectSnapshot.definition;
    session.bundle = session.definition ? buildBundleFromDefinition(session.definition) : null;
    session.traces = SourceTraceManager.fromJSON(state.traces);
    session.issues = IssueQueue.fromJSON(state.issues);
    session.createdAt = state.createdAt;
    session.updatedAt = state.updatedAt;
    session.templateId = state.templateId;
    session.readyToScaffold = state.readyToScaffold ?? false;
    session.debugLog = [...(state.debugLog ?? [])];
    session.messageCounter = state.messages.length;

    // Recreate bridge for sessions with an existing definition
    if (session.definition) {
      session.bridge = await McpBridge.create(session.definition);
    }

    return session;
  }

  /**
   * Close any existing bridge and create a new one.
   * Returns the new bridge so callers can consume diagnostics before assigning state.
   */
  private async replaceBridge(definition: FormDefinition): Promise<McpBridge> {
    if (this.bridge) {
      await this.bridge.close();
    }
    const bridge = await McpBridge.create(definition);
    this.bridge = bridge;
    return bridge;
  }

  private addIssuesFromResult(issues: Omit<Issue, 'id' | 'status'>[]): void {
    for (const issue of issues) {
      this.issues.addIssue(issue);
    }
  }

  /**
   * Automatically fix errors found during audit by running refinement rounds.
   * Uses the existing MCP tool surface — the LLM reads the diagnostics and
   * fixes the form via tool calls, exactly like a user-initiated refinement.
   */
  private async autoFix(errors: Omit<Issue, 'id' | 'status'>[]): Promise<void> {
    const MAX_FIX_ROUNDS = 3;

    for (let round = 0; round < MAX_FIX_ROUNDS; round++) {
      const errorSummary = errors
        .map(e => `- [${e.title}] ${e.description}${e.elementPath ? ` (at ${e.elementPath})` : ''}`)
        .join('\n');

      const instruction = `The form has ${errors.length} validation error(s) that need to be fixed:\n${errorSummary}\n\nUse formspec_describe to inspect the current state, then fix each error using the appropriate tools.`;

      this.log('sent', 'autoFix', { round: round + 1, errorCount: errors.length, errors: errorSummary });

      try {
        const toolContext = await this.bridge!.getToolContext();
        const result = await this.adapter.refineForm(this.messages, instruction, toolContext);

        this.log('received', 'autoFix', { round: round + 1, toolCalls: result.toolCalls.length, message: result.message });

        // Read back updated state
        this.definition = this.bridge!.getDefinition();
        this.bundle = this.bridge!.getBundle();

        const fixMsg: ChatMessage = {
          id: this.nextMessageId(),
          role: 'system',
          content: `Auto-fix round ${round + 1}: ${result.message}`,
          timestamp: Date.now(),
        };
        this.messages.push(fixMsg);
        this.updatedAt = Date.now();
        this.notify();

        // Re-audit to check if errors are resolved
        const remainingDiags = await this.bridge!.audit();
        const remainingErrors = remainingDiags.filter(d => d.severity === 'error');

        if (remainingErrors.length === 0) {
          this.log('received', 'autoFix', { round: round + 1, result: 'all errors fixed' });
          return;
        }

        // Still have errors — update for next round
        errors = remainingErrors;
      } catch (err) {
        this.log('error', 'autoFix', { round: round + 1, error: (err as Error).message });
        const errMsg: ChatMessage = {
          id: this.nextMessageId(),
          role: 'system',
          content: `Auto-fix round ${round + 1} failed: ${(err as Error).message}`,
          timestamp: Date.now(),
        };
        this.messages.push(errMsg);
        this.updatedAt = Date.now();
        this.notify();
        return; // Don't keep retrying on adapter failure
      }
    }

    // Exhausted retries — remaining errors stay as issues
    this.log('received', 'autoFix', { result: `gave up after ${MAX_FIX_ROUNDS} rounds, ${errors.length} errors remain` });
  }

  /**
   * Remove all messages following the message with the given ID.
   * If includeSelf is true, also removes the message with the given ID.
   */
  truncate(messageId: string, includeSelf = false): void {
    const index = this.messages.findIndex(m => m.id === messageId);
    if (index === -1) return;
    this.messages = this.messages.slice(0, includeSelf ? index : index + 1);
    this.updatedAt = Date.now();
    this.notify();
  }

  private nextMessageId(): string {
    return `msg-${++this.messageCounter}`;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
