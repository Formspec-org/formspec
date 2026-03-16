import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChatSession, GeminiAdapter, MockAdapter, SessionStore, validateProviderConfig } from 'formspec-chat';
import type { AIAdapter, Attachment, ProviderConfig, StorageBackend } from 'formspec-chat';
import { ChatProvider, useChatState, useChatSession } from '../state/ChatContext.js';
import { EntryScreen } from './EntryScreen.js';
import { ChatPanel } from './ChatPanel.js';
import { FormPreview } from './FormPreview.js';
import { IssuePanel } from './IssuePanel.js';
import { ProviderSetup } from './ProviderSetup.js';

const PROVIDER_STORAGE_KEY = 'formspec-chat:provider';

interface ChatShellProps {
  store?: SessionStore;
  storage?: StorageBackend;
}

const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.csv,.tsv,.xlsx,.json';

function attachmentTypeFromFilename(name: string): Attachment['type'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  if (['csv', 'tsv', 'xlsx', 'xls'].includes(ext)) return 'spreadsheet';
  return 'json';
}

function fileToAttachment(file: File, text: string): Attachment {
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: attachmentTypeFromFilename(file.name),
    name: file.name,
    data: text,
  };
}

/**
 * Master layout for Formspec Chat.
 * Manages the lifecycle: entry → active session (chat + preview).
 * Optionally accepts a SessionStore for persistence and resume.
 */
function getAdapter(config: ProviderConfig | null): AIAdapter {
  if (!config) return new MockAdapter();
  return new GeminiAdapter(config.apiKey, config.model);
}

export function ChatShell({ store, storage }: ChatShellProps = {}) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [recentSessions, setRecentSessions] = useState(() => store?.list() ?? []);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(() => {
    if (!storage) return null;
    const raw = storage.getItem(PROVIDER_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return validateProviderConfig(parsed).length === 0 ? parsed : null;
    } catch { return null; }
  });
  const [showProviderSetup, setShowProviderSetup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSessions = useCallback(() => {
    setRecentSessions(store?.list() ?? []);
  }, [store]);

  // Auto-save on session changes
  useEffect(() => {
    if (!session || !store) return;
    return session.onChange(() => {
      store.save(session.toState());
    });
  }, [session, store]);

  const handleSaveProvider = useCallback((config: ProviderConfig) => {
    setProviderConfig(config);
    storage?.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(config));
    setShowProviderSetup(false);
  }, [storage]);

  const handleClearProvider = useCallback(() => {
    setProviderConfig(null);
    storage?.removeItem(PROVIDER_STORAGE_KEY);
    setShowProviderSetup(false);
  }, [storage]);

  const handleStartBlank = useCallback(() => {
    const s = new ChatSession({ adapter: getAdapter(providerConfig) });
    setSession(s);
  }, [providerConfig]);

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    const s = new ChatSession({ adapter: getAdapter(providerConfig) });
    await s.startFromTemplate(templateId);
    setSession(s);
  }, [providerConfig]);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const s = new ChatSession({ adapter: getAdapter(providerConfig) });

    const firstText = await files[0].text();
    const firstAttachment = fileToAttachment(files[0], firstText);
    await s.startFromUpload(firstAttachment);

    for (let i = 1; i < files.length; i++) {
      const text = await files[i].text();
      const attachment = fileToAttachment(files[i], text);
      await s.startFromUpload(attachment);
    }

    setSession(s);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [providerConfig]);

  const handleResumeSession = useCallback((sessionId: string) => {
    if (!store) return;
    const state = store.load(sessionId);
    if (!state) return;
    const restored = ChatSession.fromState(state, getAdapter(providerConfig));
    setSession(restored);
  }, [store, providerConfig]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    store?.delete(sessionId);
    refreshSessions();
  }, [store, refreshSessions]);

  const handleBack = useCallback(() => {
    setSession(null);
    refreshSessions();
  }, [refreshSessions]);

  const handleOpenSettings = useCallback(() => {
    setShowProviderSetup(true);
  }, []);

  const content = !session ? (
    <EntryScreen
      onStartBlank={handleStartBlank}
      onSelectTemplate={handleSelectTemplate}
      onUpload={handleUpload}
      onResumeSession={handleResumeSession}
      recentSessions={recentSessions}
      providerConfig={providerConfig}
      onOpenSettings={handleOpenSettings}
      onDeleteSession={handleDeleteSession}
    />
  ) : (
    <ChatProvider session={session}>
      <ActiveSessionView
        onBack={handleBack}
        onUpload={handleUpload}
        onOpenSettings={handleOpenSettings}
      />
    </ChatProvider>
  );

  return (
    <>
      {content}
      <input
        ref={fileInputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        multiple
        onChange={handleFilesSelected}
        className="hidden"
        aria-hidden="true"
      />
      <ProviderSetup
        open={showProviderSetup}
        onClose={() => setShowProviderSetup(false)}
        onSave={handleSaveProvider}
        initialConfig={providerConfig ?? undefined}
        onClear={handleClearProvider}
      />
    </>
  );
}

// ── Active Session ───────────────────────────────────────────────────

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 2v7M4.5 6.5L7 9l2.5-2.5" />
      <path d="M2.5 10.5v1a.5.5 0 00.5.5h8a.5.5 0 00.5-.5v-1" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 1.5L11 10.5H1L6 1.5z" />
      <line x1="6" y1="5" x2="6" y2="7.5" />
      <circle cx="6" cy="9" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3L5 7l4 4" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="1.75" />
      <path d="M11.8 7a4.8 4.8 0 01-.26 1.22l1.05.6-.7 1.22-1.05-.6a4.8 4.8 0 01-1.05 1.05l.6 1.05-1.22.7-.6-1.05A4.8 4.8 0 017 11.45v1.22H5.78v-1.22a4.8 4.8 0 01-1.22-.26l-.6 1.05-1.22-.7.6-1.05a4.8 4.8 0 01-1.05-1.05l-1.05.6-.7-1.22 1.05-.6A4.8 4.8 0 012.33 7H1.1V5.78h1.22a4.8 4.8 0 01.26-1.22l-1.05-.6.7-1.22 1.05.6a4.8 4.8 0 011.05-1.05l-.6-1.05 1.22-.7.6 1.05A4.8 4.8 0 017 2.33V1.1h1.22v1.22a4.8 4.8 0 011.22.26l.6-1.05 1.22.7-.6 1.05a4.8 4.8 0 011.05 1.05l1.05-.6.7 1.22-1.05.6A4.8 4.8 0 0111.8 7z" />
    </svg>
  );
}

function ActiveSessionView({ onBack, onUpload, onOpenSettings }: { onBack: () => void; onUpload: () => void; onOpenSettings: () => void }) {
  const session = useChatSession();
  const state = useChatState();
  // Mobile-only view toggle — on desktop both panes are visible
  const [mobileView, setMobileView] = useState<'chat' | 'preview'>('chat');
  const [showIssues, setShowIssues] = useState(false);

  const handleExport = useCallback(() => {
    const json = session.exportJSON();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${json.title || 'form'}.formspec.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [session]);

  return (
    <div className="flex flex-col h-screen bg-bg-default text-ink font-ui">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors -ml-1 px-1.5 py-1 rounded hover:bg-subtle"
            title="Back to start"
          >
            <IconBack />
            <span className="hidden sm:inline">New</span>
          </button>
          <div className="w-px h-4 bg-border" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-muted/60 select-none">
            formspec
          </span>
          {state.openIssueCount > 0 && (
            <button
              onClick={() => setShowIssues(!showIssues)}
              data-testid="issue-count"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-amber/10 text-amber border border-amber/25 hover:bg-amber/20 transition-colors"
            >
              <IconWarning />
              {state.openIssueCount}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {state.hasDefinition && (
            <>
              {/* Mobile-only: segmented view toggle */}
              <div className="flex lg:hidden items-center rounded-md bg-subtle border border-border p-0.5">
                <button
                  onClick={() => setMobileView('chat')}
                  aria-pressed={mobileView === 'chat'}
                  className={[
                    'px-3 py-1 text-xs font-medium rounded transition-all duration-100',
                    mobileView === 'chat'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-muted hover:text-ink',
                  ].join(' ')}
                >
                  Chat
                </button>
                <button
                  onClick={() => setMobileView('preview')}
                  aria-pressed={mobileView === 'preview'}
                  className={[
                    'px-3 py-1 text-xs font-medium rounded transition-all duration-100',
                    mobileView === 'preview'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-muted hover:text-ink',
                  ].join(' ')}
                >
                  Preview
                </button>
              </div>

              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-border text-muted hover:text-ink hover:border-accent/50 transition-colors"
              >
                <IconDownload />
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-muted hover:text-ink rounded hover:bg-subtle transition-colors"
            aria-label="Settings"
          >
            <IconGear />
          </button>
        </div>
      </header>

      {/* Content — side-by-side on desktop, toggled on mobile */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat pane — always visible on desktop, toggled on mobile */}
        <div className={[
          'flex flex-col',
          // Mobile: full width when active, hidden when preview
          mobileView === 'chat' ? 'flex-1' : 'hidden',
          // Desktop: always visible, takes ~55% width
          'lg:flex lg:flex-1 lg:min-w-0',
        ].join(' ')}>
          <ChatPanel onUpload={onUpload} />
        </div>

        {/* Preview pane — always visible on desktop when definition exists */}
        {state.hasDefinition && (
          <div className={[
            'flex flex-col border-l border-border',
            // Mobile: full width when active, hidden when chat
            mobileView === 'preview' ? 'flex-1' : 'hidden',
            // Desktop: always visible, 45% width
            'lg:flex lg:w-[45%] lg:max-w-[560px] lg:shrink-0',
          ].join(' ')}>
            <FormPreview />
          </div>
        )}

        {/* Issue panel — slide-over on top of preview */}
        {showIssues && (
          <div className="absolute right-0 top-[45px] bottom-0 w-full sm:w-[360px] bg-surface border-l border-border shadow-lg z-10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium text-ink">Issues</span>
              <button
                onClick={() => setShowIssues(false)}
                className="text-xs text-muted hover:text-ink transition-colors px-2 py-1 rounded hover:bg-subtle"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <IssuePanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
