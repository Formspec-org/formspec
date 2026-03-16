import type {
  AIAdapter, Attachment, ChatMessage, ChatSessionState,
  ScaffoldRequest, SourceTrace, Issue,
} from './types.js';
import type { FormDefinition } from 'formspec-types';
import type { ProjectBundle } from 'formspec-core';
import { SourceTraceManager } from './source-trace.js';
import { IssueQueue } from './issue-queue.js';
import { diff, type DefinitionDiff } from './form-scaffolder.js';
import { buildBundleFromDefinition } from './bundle-builder.js';

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
        const response = await this.adapter.chat(this.messages);
        this.readyToScaffold = response.readyToScaffold;
        assistantContent = response.message;
      } else {
        // Refine existing form
        const previousDef = this.definition;
        const result = await this.adapter.refineForm(
          this.messages,
          this.definition,
          content,
        );
        this.lastDiff = diff(previousDef, result.definition);
        this.definition = result.definition;
        this.bundle = buildBundleFromDefinition(result.definition);
        this.traces.addTraces(result.traces);
        this.addIssuesFromResult(result.issues);
        assistantContent = this.lastDiff.added.length === 0 && this.lastDiff.modified.length === 0 && this.lastDiff.removed.length === 0
          ? `I wasn't able to make changes to the form. Try being more specific, or configure an AI provider for full conversational refinement.`
          : `I've updated the form based on your request.`;
      }
    } catch (err) {
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
    const result = await this.adapter.generateScaffold({
      type: 'conversation',
      messages: this.messages,
    });
    this.definition = result.definition;
    this.bundle = buildBundleFromDefinition(result.definition);
    this.lastDiff = null;
    this.traces.addTraces(result.traces);
    this.addIssuesFromResult(result.issues);
    this.readyToScaffold = false;

    const systemMsg: ChatMessage = {
      id: this.nextMessageId(),
      role: 'system',
      content: `Generated form: "${result.definition.title}" with ${result.definition.items.length} fields.`,
      timestamp: Date.now(),
    };
    this.messages.push(systemMsg);
    this.updatedAt = Date.now();
    this.notify();
  }

  /**
   * Initialize the session from a template.
   */
  async startFromTemplate(templateId: string): Promise<void> {
    const result = await this.adapter.generateScaffold({
      type: 'template',
      templateId,
    });
    this.definition = result.definition;
    this.bundle = buildBundleFromDefinition(result.definition);
    this.templateId = templateId;
    this.traces.addTraces(result.traces);
    this.addIssuesFromResult(result.issues);

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
    this.definition = result.definition;
    this.bundle = buildBundleFromDefinition(result.definition);
    this.traces.addTraces(result.traces);
    this.addIssuesFromResult(result.issues);

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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      templateId: this.templateId,
      readyToScaffold: this.readyToScaffold || undefined,
    };
  }

  /**
   * Restore a session from serialized state.
   */
  static fromState(state: ChatSessionState, adapter: AIAdapter): ChatSession {
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
    session.messageCounter = state.messages.length;
    return session;
  }

  private addIssuesFromResult(issues: Omit<Issue, 'id' | 'status'>[]): void {
    for (const issue of issues) {
      this.issues.addIssue(issue);
    }
  }

  private nextMessageId(): string {
    return `msg-${++this.messageCounter}`;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
