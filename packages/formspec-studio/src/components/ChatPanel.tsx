/** @filedesc Integrated studio chat panel — shares the studio Project, routes AI through MCP, shows changeset review. */
import { useState, useRef, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { ChatSession, GeminiAdapter, type ChatMessage, type ToolContext } from '@formspec-org/chat';
import { type Project, type Changeset, type MergeResult, type ProposalManager } from '@formspec-org/studio-core';
import { ProjectRegistry } from '@formspec-org/mcp/registry';
import { createToolDispatch } from '@formspec-org/mcp/dispatch';
import { ChangesetReview, type ChangesetReviewData } from './ChangesetReview.js';
import { getSavedProviderConfig } from './AppSettingsDialog.js';
import { IconSparkle, IconArrowUp } from './icons/index.js';

// ── Icons ──────────────────────────────────────────────────────────
// IconClose and IconWarning are ChatPanel-only — kept local. Shared icons
// (IconSparkle, IconArrowUp) live in ./icons.

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 4L4 12M4 4l8 8" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 5v3M7 10h.01" />
      <path d="M6.13 1.87l-4.9 8.5A1 1 0 002.1 12h9.8a1 1 0 00.87-1.5l-4.9-8.5a1 1 0 00-1.74-.13z" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────

export interface ChatPanelProps {
  project: Project;
  onClose: () => void;
  /** When set, pre-fills the input with this prompt and clears it after applying. */
  initialPrompt?: string | null;
}

interface DiagnosticEntry {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
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

export function ChatPanel({ project, onClose, initialPrompt }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(() => !!getSavedProviderConfig()?.apiKey);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
      const result = proposalManager.acceptChangeset([groupIndex]);
      applyMergeResult(result);
    },
    [proposalManager],
  );

  const handleRejectGroup = useCallback(
    (groupIndex: number) => {
      if (!proposalManager) return;
      const result = proposalManager.rejectChangeset([groupIndex]);
      applyMergeResult(result);
    },
    [proposalManager],
  );

  const handleAcceptAll = useCallback(() => {
    if (!proposalManager) return;
    const result = proposalManager.acceptChangeset();
    applyMergeResult(result);
  }, [proposalManager]);

  const handleRejectAll = useCallback(() => {
    if (!proposalManager) return;
    const result = proposalManager.rejectChangeset();
    applyMergeResult(result);
  }, [proposalManager]);

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

      // Wrap in a changeset so the user can review
      if (proposalManager) {
        proposalManager.openChangeset();
        proposalManager.beginEntry('scaffold');

        project.loadBundle({ definition });

        const itemCount = definition.items?.length ?? 0;
        const label = `Initial scaffold: ${itemCount} field(s)`;
        proposalManager.endEntry(label);
        proposalManager.closeChangeset(label);
      } else {
        // No changeset support — load directly
        project.loadBundle({ definition });
      }

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

  function extractDiagnostics(diagnostics: unknown): DiagnosticEntry[] {
    if (!Array.isArray(diagnostics)) return [];
    return diagnostics.map((d: any) => ({
      severity: d.severity === 'warning' ? 'warning' as const : 'error' as const,
      message: d.message ?? String(d),
      path: d.path,
    }));
  }

  const showReview = changeset && (changeset.status === 'pending' || changeset.status === 'open');

  return (
    <div data-testid="chat-panel" className="flex flex-col h-full border-l border-border bg-surface">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <IconSparkle />
          <h2 className="text-sm font-bold text-ink">AI Assistant</h2>
          {changeset && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber/10 text-amber border border-amber/20">
              changeset {changeset.status}
            </span>
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

      {/* ── Content area ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {showReview ? (
          <div className="space-y-4">
            <ChangesetReview
              changeset={changesetToReviewData(changeset)}
              onAcceptGroup={handleAcceptGroup}
              onRejectGroup={handleRejectGroup}
              onAcceptAll={handleAcceptAll}
              onRejectAll={handleRejectAll}
            />

            {/* ── Conflict diagnostics ───────────────────── */}
            {diagnostics.length > 0 && (
              <div data-testid="merge-diagnostics" className="mx-4 space-y-2">
                <h3 className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted">
                  Diagnostics
                </h3>
                <div className="border border-border/60 rounded-lg divide-y divide-border/60">
                  {diagnostics.map((d, i) => (
                    <div
                      key={i}
                      data-testid={`diagnostic-${i}`}
                      className={`px-3 py-2 flex items-start gap-2 text-[12px] ${
                        d.severity === 'error' ? 'bg-error/5 text-error' : 'bg-amber/5 text-amber'
                      }`}
                    >
                      <IconWarning />
                      <div className="min-w-0">
                        <p className="leading-snug">{d.message}</p>
                        {d.path && <span className="font-mono text-[10px] opacity-70">{d.path}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mergeMessage && (
              <div
                data-testid="merge-message"
                className="mx-4 px-3 py-2 rounded-lg text-[12px] font-medium bg-subtle text-muted border border-border/40"
              >
                {mergeMessage}
              </div>
            )}
          </div>
        ) : (
          /* ── Chat messages (or setup prompt) ──────────────── */
          <div className="px-4 py-4 space-y-1">
            {!hasApiKey ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber/10 text-amber">
                  <IconWarning />
                </div>
                <div className="space-y-1.5 max-w-[260px]">
                  <p className="text-[14px] font-semibold text-ink">API key required</p>
                  <p className="text-[13px] text-muted leading-relaxed">
                    Add your AI provider API key in App Settings to use the assistant.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('formspec:open-app-settings'))}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  Open App Settings
                </button>
              </div>
            ) : messages.length === 0 && !sending ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent/10 text-accent">
                  <IconSparkle />
                </div>
                <p className="text-[13px] text-muted max-w-[240px]">
                  Ask the AI to modify your form — add fields, set validation, change layout.
                </p>
              </div>
            ) : null}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`py-1.5 ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-start gap-2 max-w-[90%]">
                    <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-accent/10 text-accent mt-0.5">
                      <IconSparkle />
                    </div>
                    <div className="rounded-xl rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed bg-subtle text-ink">
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    </div>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="max-w-[85%]">
                    <div className="rounded-xl rounded-tr-sm px-3 py-2 text-[13px] leading-relaxed bg-accent text-white">
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    </div>
                  </div>
                )}
                {msg.role === 'system' && (
                  <div className="w-full text-center">
                    <span className="text-[11px] font-mono italic text-muted px-3">{msg.content}</span>
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-start gap-2 py-1.5">
                <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-accent/10 text-accent">
                  <IconSparkle />
                </div>
                <div className="rounded-xl rounded-tl-sm px-3 py-2.5 bg-subtle">
                  <div className="flex items-center gap-1 h-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
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
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Ask the AI to modify your form..."
              className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none disabled:opacity-40 min-h-[32px] py-1 px-1"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !inputValue.trim()}
              aria-label="Send message"
              className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                inputValue.trim() && !sending
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-subtle text-muted'
              }`}
            >
              <IconArrowUp />
            </button>
          </div>
          <p className="text-center text-[10px] text-muted mt-1 select-none">
            Enter to send &middot; Shift+Enter for new line
          </p>
        </div>
      )}
    </div>
  );
}
