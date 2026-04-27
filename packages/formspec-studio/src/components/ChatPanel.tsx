/** @filedesc Integrated studio chat panel — shares the studio Project, routes AI through MCP, shows changeset review. */
import { useState, useRef, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { ChatSession, GeminiAdapter, type Attachment, type ChatMessage, type ToolContext } from '@formspec-org/chat';
import { type Project, type Changeset, type MergeResult, type ProposalManager, type Diagnostic, type Diagnostics } from '@formspec-org/studio-core';
import { ProjectRegistry } from '@formspec-org/mcp/registry';
import { createToolDispatch } from '@formspec-org/mcp/dispatch';
import { ChangesetReview, type ChangesetReviewData } from './ChangesetReview.js';
import { getSavedProviderConfig } from './AppSettingsDialog.js';
import { IconSparkle, IconArrowUp, IconClose, IconUpload } from './icons/index.js';
import { ChatMessageList } from './chat/ChatMessageList.js';
import { ChangesetReviewSection } from './chat/ChangesetReviewSection.js';
import { upsertFieldProvenance, upsertStudioPatch } from '../workspaces/shared/studio-intelligence-writer.js';
import { ASSISTANT_COMPOSER_INPUT_TEST_ID } from '../constants/assistant-dom.js';

// ── Types ──────────────────────────────────────────────────────────

export interface ChatPanelProps {
  project: Project;
  onClose: () => void;
  /** Shell rail vs full primary assistant surface (onboarding omits this). */
  surfaceLayout?: 'rail' | 'primary';
  /** When set, pre-fills the input with this prompt and clears it after applying. */
  initialPrompt?: string | null;
  /** Called after the user sends a message, before assistant/tool work resolves. */
  onUserMessage?: () => void;
  onUploadHandlerReady?: (handler: ((file: File) => void) | null) => void;
  onSourceUploadStart?: (file: File) => void;
  onSourceUploadComplete?: (summary: SourceUploadSummary) => void;
  emptyDescription?: string;
  placeholder?: string;
  inputId?: string;
  /** `data-testid` on the composer textarea (defaults to assistant composer id). */
  composerInputTestId?: string;
  inputAriaLabel?: string;
}

export interface SourceUploadSummary {
  name: string;
  type: Attachment['type'];
  fieldCount: number;
  message: string;
}

interface DiagnosticEntry {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}

function normalizeAffectedRef(path: string): string {
  const trimmed = path.replace(/^definition\./, '');
  if (!trimmed) return path;
  return trimmed;
}

function affectedRefsForChangeset(changeset: Changeset, groupIndices?: number[]): string[] {
  const refs = new Set<string>();
  const includePaths = (paths: readonly string[] | undefined) => {
    for (const path of paths ?? []) refs.add(normalizeAffectedRef(path));
  };
  const aiEntries = groupIndices
    ? groupIndices.map((index) => changeset.aiEntries[index]).filter(Boolean)
    : changeset.aiEntries;
  const overlayEntries = groupIndices
    ? groupIndices.map((index) => changeset.userOverlay[index]).filter(Boolean)
    : changeset.userOverlay;
  for (const entry of aiEntries) includePaths(entry.affectedPaths);
  for (const entry of overlayEntries) includePaths(entry.affectedPaths);
  if (refs.size === 0) {
    for (const entry of changeset.aiEntries) includePaths(entry.affectedPaths);
    for (const entry of changeset.userOverlay) includePaths(entry.affectedPaths);
  }
  return [...refs].filter(Boolean);
}

function resolvedAffectedRefs(project: Project, changeset: Changeset, groupIndices?: number[]): string[] {
  const refs = affectedRefsForChangeset(changeset, groupIndices);
  if (refs.length > 0) return refs;
  return project.fieldPaths();
}

// ── Changeset → ReviewData adapter ─────────────────────────────────

function changesetToReviewData(changeset: Readonly<Changeset>): ChangesetReviewData {
  return {
    id: changeset.id,
    status: changeset.status,
    label: changeset.label,
    aiEntries: changeset.aiEntries.map((e) => ({
      toolName: e.toolName,
      summary: e.summary,
      affectedPaths: e.affectedPaths,
      warnings: e.warnings,
    })),
    userOverlay: changeset.userOverlay.map((e) => ({
      summary: e.summary,
      affectedPaths: e.affectedPaths,
    })),
    dependencyGroups: changeset.dependencyGroups.map((g) => ({
      entries: g.entries,
      reason: g.reason,
    })),
  };
}

// ── ChatPanel ──────────────────────────────────────────────────────

export function ChatPanel({
  project,
  onClose,
  surfaceLayout = 'rail',
  initialPrompt,
  onUserMessage,
  onUploadHandlerReady,
  onSourceUploadStart,
  onSourceUploadComplete,
  emptyDescription,
  placeholder,
  inputId,
  composerInputTestId = ASSISTANT_COMPOSER_INPUT_TEST_ID,
  inputAriaLabel,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(() => !!getSavedProviderConfig()?.apiKey);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ChatSession | null>(null);

  const [readyToScaffold, setReadyToScaffold] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);

  // Re-check API key when panel gains focus (user may have just saved one)
  useEffect(() => {
    const check = () => setHasApiKey(!!getSavedProviderConfig()?.apiKey);
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  // Create the in-process tool context once
  const { toolContext, proposalManager } = useMemo(() => {
    const registry = new ProjectRegistry();
    const projectId = registry.registerOpen('studio://current', project);
    const dispatch = createToolDispatch(registry, projectId);

    const ctx: ToolContext = {
      tools: dispatch.declarations,
      async callTool(name: string, args: Record<string, unknown>) {
        return dispatch.call(name, args);
      },
      async getProjectSnapshot() {
        return { definition: project.definition };
      },
    };

    const pm: ProposalManager | null = project.proposals;
    return { toolContext: ctx, proposalManager: pm };
  }, [project]);

  // Create ChatSession when API key becomes available
  useEffect(() => {
    if (sessionRef.current || !hasApiKey) return;
    const config = getSavedProviderConfig();
    if (!config?.apiKey) return;
    const adapter = new GeminiAdapter(config.apiKey, config.model ?? 'gemini-3-flash-preview', '');
    const session = new ChatSession({ adapter });
    session.setToolContext(toolContext);
    sessionRef.current = session;
  }, [toolContext, hasApiKey]);

  // Subscribe to changeset transitions — no polling.
  // useSyncExternalStore re-renders only when ProposalManager notifies.
  // Client-only bundle: getServerSnapshot matches getSnapshot. If ChatPanel is ever
  // rendered under SSR, supply a real server snapshot (or gate this path) per React 18.
  const changeset = useSyncExternalStore(
    useCallback(
      (onStoreChange) => proposalManager?.subscribe(onStoreChange) ?? (() => {}),
      [proposalManager],
    ),
    useCallback(() => proposalManager?.getChangeset() ?? null, [proposalManager]),
    useCallback(() => proposalManager?.getChangeset() ?? null, [proposalManager]),
  );

  useEffect(() => {
    if (!changeset || (changeset.status !== 'pending' && changeset.status !== 'open')) return;
    upsertStudioPatch(project, {
      id: `changeset:${changeset.id}`,
      source: 'ai',
      scope: 'spec',
      summary: changeset.label || 'AI-proposed changeset',
      affectedRefs: affectedRefsForChangeset(changeset),
      status: 'open',
    });
  }, [changeset, project]);

  // Apply initialPrompt when it changes
  useEffect(() => {
    if (initialPrompt) {
      setInputValue(initialPrompt);
      // Focus the input after a tick so the panel is visible
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [initialPrompt]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setSending(true);
    setInputValue('');
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    onUserMessage?.();

    try {
      const session = sessionRef.current;
      if (session) {
        await session.sendMessage(text);
        setMessages(session.getMessages());
        setReadyToScaffold(session.isReadyToScaffold());
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, sending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Changeset actions ────────────────────────────────────────────

  const handleAcceptGroup = useCallback(
    (groupIndex: number) => {
      if (!proposalManager) return;
      const active = proposalManager.getChangeset();
      if (active) {
        const affectedRefs = resolvedAffectedRefs(project, active, [groupIndex]);
        upsertStudioPatch(project, {
          id: `changeset:${active.id}`,
          source: 'ai',
          scope: 'spec',
          summary: active.label || 'AI-proposed changeset',
          affectedRefs,
          status: 'accepted',
        });
        upsertFieldProvenance(project, affectedRefs.map((ref) => ({
          objectRef: ref,
          origin: 'ai',
          rationale: active.label || 'Accepted AI-proposed change.',
          confidence: 'medium',
          sourceRefs: [`changeset.${active.id}`],
          patchRefs: [`changeset:${active.id}`],
          reviewStatus: 'confirmed',
        })));
      }
      const result = proposalManager.acceptChangeset([groupIndex]);
      applyMergeResult(result);
    },
    [project, proposalManager],
  );

  const handleRejectGroup = useCallback(
    (groupIndex: number) => {
      if (!proposalManager) return;
      const active = proposalManager.getChangeset();
      if (active) {
        upsertStudioPatch(project, {
          id: `changeset:${active.id}`,
          source: 'ai',
          scope: 'spec',
          summary: active.label || 'AI-proposed changeset',
          affectedRefs: resolvedAffectedRefs(project, active, [groupIndex]),
          status: 'rejected',
        });
      }
      const result = proposalManager.rejectChangeset([groupIndex]);
      applyMergeResult(result);
    },
    [project, proposalManager],
  );

  const handleAcceptAll = useCallback(() => {
    if (!proposalManager) return;
    const active = proposalManager.getChangeset();
    if (active) {
      const affectedRefs = resolvedAffectedRefs(project, active);
      upsertStudioPatch(project, {
        id: `changeset:${active.id}`,
        source: 'ai',
        scope: 'spec',
        summary: active.label || 'AI-proposed changeset',
        affectedRefs,
        status: 'accepted',
      });
      upsertFieldProvenance(project, affectedRefs.map((ref) => ({
        objectRef: ref,
        origin: 'ai',
        rationale: active.label || 'Accepted AI-proposed change.',
        confidence: 'medium',
        sourceRefs: [`changeset.${active.id}`],
        patchRefs: [`changeset:${active.id}`],
        reviewStatus: 'confirmed',
      })));
    }
    const result = proposalManager.acceptChangeset();
    applyMergeResult(result);
  }, [project, proposalManager]);

  const handleRejectAll = useCallback(() => {
    if (!proposalManager) return;
    const active = proposalManager.getChangeset();
    if (active) {
      upsertStudioPatch(project, {
        id: `changeset:${active.id}`,
        source: 'ai',
        scope: 'spec',
        summary: active.label || 'AI-proposed changeset',
        affectedRefs: resolvedAffectedRefs(project, active),
        status: 'rejected',
      });
    }
    const result = proposalManager.rejectChangeset();
    applyMergeResult(result);
  }, [project, proposalManager]);

  // ── Scaffold as changeset ────────────────────────────────────────

  const handleGenerateForm = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || scaffolding) return;

    setScaffolding(true);
    try {
      // Generate the scaffold via ChatSession
      await session.scaffold();
      const definition = session.getDefinition();
      if (!definition) return;

      loadDefinitionAsChangeset(`Initial scaffold: ${definition.items?.length ?? 0} field(s)`, definition);

      setMessages(session.getMessages());
      setReadyToScaffold(false);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Scaffold failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setScaffolding(false);
    }
  }, [project, proposalManager, scaffolding]);

  const handleUploadFile = useCallback(async (file: File | null) => {
    const session = sessionRef.current;
    if (!file || !session || uploading) return;

    setUploading(true);
    onSourceUploadStart?.(file);
    try {
      const attachment = await fileToAttachment(file);
      await session.startFromUpload(attachment);
      const definition = session.getDefinition();
      if (!definition) return;
      loadDefinitionAsChangeset(`Upload scaffold from ${file.name}: ${definition.items?.length ?? 0} field(s)`, definition);
      setMessages(session.getMessages());
      setReadyToScaffold(false);
      onUserMessage?.();
      onSourceUploadComplete?.({
        name: file.name,
        type: attachment.type,
        fieldCount: definition.items?.length ?? 0,
        message: `Generated ${definition.items?.length ?? 0} field(s) from ${file.name}. Review the proposed changes before they modify the form.`,
      });
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      inputRef.current?.focus();
    }
  }, [onSourceUploadComplete, onSourceUploadStart, onUserMessage, uploading]);

  useEffect(() => {
    if (!onUploadHandlerReady) return;
    if (!hasApiKey) {
      onUploadHandlerReady(null);
      return () => onUploadHandlerReady(null);
    }
    onUploadHandlerReady((file: File) => void handleUploadFile(file));
    return () => onUploadHandlerReady(null);
  }, [handleUploadFile, hasApiKey, onUploadHandlerReady]);

  function loadDefinitionAsChangeset(label: string, definition: NonNullable<ReturnType<ChatSession['getDefinition']>>) {
    if (proposalManager) {
      proposalManager.openChangeset();
      proposalManager.beginEntry('scaffold');
      project.loadBundle({ definition });
      proposalManager.endEntry(label);
      proposalManager.closeChangeset(label);
    } else {
      project.loadBundle({ definition });
    }
  }

  function applyMergeResult(result: MergeResult) {
    if (result.ok) {
      setMergeMessage('Changes applied successfully.');
      setDiagnostics(extractDiagnostics(result.diagnostics));
    } else if ('replayFailure' in result) {
      setMergeMessage(
        `Replay failed at ${result.replayFailure.phase} entry #${result.replayFailure.entryIndex}: ${result.replayFailure.error.message}`,
      );
      setDiagnostics([{ severity: 'error', message: result.replayFailure.error.message }]);
    } else if ('diagnostics' in result) {
      setMergeMessage('Merge blocked — structural validation errors found.');
      setDiagnostics(extractDiagnostics(result.diagnostics));
    }
    // Changeset state updates flow through useSyncExternalStore subscription.
  }

  function extractDiagnostics(diagnostics: Diagnostics): DiagnosticEntry[] {
    const all = [
      ...(diagnostics.structural || []),
      ...(diagnostics.expressions || []),
      ...(diagnostics.extensions || []),
      ...(diagnostics.consistency || []),
    ];
    return all.map((d: Diagnostic) => ({
      severity: d.severity === 'warning' ? 'warning' as const : 'error' as const,
      message: d.message ?? String(d),
      path: d.path,
    }));
  }

  const showReview = changeset && (changeset.status === 'pending' || changeset.status === 'open');
  const showConversationRibbon = Boolean(showReview && hasApiKey && (messages.length > 0 || sending));

  return (
    <div
      data-testid="chat-panel"
      className={`flex flex-col h-full min-h-0 bg-surface ${
        surfaceLayout === 'primary' ? 'border-0' : 'border-l border-border'
      }`}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <IconSparkle />
            <h2 className="text-sm font-bold text-ink">AI Assistant</h2>
            {changeset && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber/10 text-amber border border-amber/20 shrink-0">
                changeset {changeset.status}
              </span>
            )}
          </div>
          {showReview && (
            <p className="text-[11px] text-muted leading-snug pl-7 max-w-[280px]">
              Chat stays visible above; accept or reject the proposed edits below.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded hover:bg-subtle transition-colors"
          aria-label="Close chat panel"
        >
          <IconClose />
        </button>
      </div>

      {/* ── Content: conversation + review (review does not replace chat) ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {showConversationRibbon && (
          <div className="shrink-0 flex flex-col max-h-[38%] min-h-0 border-b border-border/80 bg-bg-default/40">
            <p className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
              Conversation
            </p>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ChatMessageList
                messages={messages}
                sending={sending}
                hasApiKey={hasApiKey}
                messagesEndRef={messagesEndRef}
                emptyDescription={emptyDescription}
                variant="ribbon"
              />
            </div>
          </div>
        )}
        <div className={`flex-1 min-h-0 overflow-y-auto ${showReview ? '' : 'flex flex-col'}`}>
          {showReview ? (
            <ChangesetReviewSection
              changeset={changesetToReviewData(changeset)}
              diagnostics={diagnostics}
              mergeMessage={mergeMessage}
              onAcceptGroup={handleAcceptGroup}
              onRejectGroup={handleRejectGroup}
              onAcceptAll={handleAcceptAll}
              onRejectAll={handleRejectAll}
            />
          ) : (
            <ChatMessageList
              messages={messages}
              sending={sending}
              hasApiKey={hasApiKey}
              messagesEndRef={messagesEndRef}
              emptyDescription={emptyDescription}
            />
          )}
        </div>
      </div>

      {/* ── Generate Form button ─────────────────────────── */}
      {readyToScaffold && !scaffolding && !showReview && (
        <div className="px-4 pb-2 shrink-0">
          <button
            type="button"
            onClick={handleGenerateForm}
            className="w-full py-2 px-4 rounded-lg text-[13px] font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Generate Form
          </button>
        </div>
      )}

      {/* ── Input bar ───────────────────────────────────── */}
      {hasApiKey && (
        <div className="px-4 pb-3 pt-2 border-t border-border shrink-0">
          <div className="flex items-end gap-1 border border-border rounded-xl px-2 py-1.5 bg-bg-default focus-within:border-accent/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.json,.txt,.md,application/pdf,application/json,text/plain,text/markdown"
              className="sr-only"
              aria-label="Upload source file"
              onChange={(event) => void handleUploadFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
              aria-label="Upload PDF, JSON, or text source"
              title="Upload PDF, JSON, or text source"
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:bg-subtle hover:text-ink disabled:opacity-40 transition-colors"
            >
              <IconUpload size={17} />
            </button>
            <textarea
              id={inputId}
              ref={inputRef}
              data-testid={composerInputTestId}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || uploading}
              aria-label={inputAriaLabel ?? 'Assistant message'}
              placeholder={placeholder ?? 'Ask the AI to modify your form…'}
              className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none disabled:opacity-40 min-h-[32px] py-1 px-1"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || uploading || !inputValue.trim()}
              aria-label="Send message"
              className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                inputValue.trim() && !sending && !uploading
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-subtle text-muted'
              }`}
            >
              <IconArrowUp />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted mt-1 select-none">
            {uploading ? 'Processing uploaded source...' : 'Enter to send · Shift+Enter for new line · Upload PDF, JSON, or text'}
          </p>
        </div>
      )}
    </div>
  );
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const type: Attachment['type'] =
    extension === 'pdf' || file.type === 'application/pdf'
      ? 'pdf'
      : extension === 'json' || file.type === 'application/json'
        ? 'json'
        : 'text';
  const data = type === 'pdf' ? await readFileAsDataUrl(file) : await file.text();
  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    name: file.name,
    data,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}
