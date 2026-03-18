/** @filedesc Top-level chat UI shell; manages AI adapter wiring, file uploads, and panel layout. */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
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

  const handleResumeSession = useCallback(async (sessionId: string) => {
    if (!store) return;
    const state = store.load(sessionId);
    if (!state) return;
    const restored = await ChatSession.fromState(state, getAdapter(providerConfig));
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

function IconBug() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3" width="5" height="6.5" rx="2.5" />
      <path d="M1 5h2M9 5h2M1 8h2M9 8h2M4.5 1.5L5 3M7.5 1.5L7 3" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3H11.5A1.5 1.5 0 0 1 13 4.5V11.5A1.5 1.5 0 0 1 11.5 13H4.5A1.5 1.5 0 0 1 3 11.5V10" />
      <polyline points="8 1 13 1 13 6" />
      <line x1="6" y1="8" x2="13" y2="1" />
    </svg>
  );
}

function ActiveSessionView({ onBack, onUpload, onOpenSettings }: { onBack: () => void; onUpload: () => void; onOpenSettings: () => void }) {
  const session = useChatSession();
  const state = useChatState();
  // Mobile-only view toggle — on desktop both panes are visible
  const [mobileView, setMobileView] = useState<'chat' | 'preview'>('chat');
  const [showDebug, setShowDebug] = useState(false);

  const handleExport = useCallback(async () => {
    const bundle = session.exportBundle();
    const { definition } = bundle;
    const baseName = definition.title?.trim()
      ? definition.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : 'formspec-project';

    const zip = new JSZip();
    zip.file('definition.json', JSON.stringify(bundle.definition, null, 2));
    zip.file('component.json', JSON.stringify(bundle.component, null, 2));
    zip.file('theme.json', JSON.stringify(bundle.theme, null, 2));

    if (bundle.mappings && Object.keys(bundle.mappings).length > 0) {
      const mappingsFolder = zip.folder('mappings');
      if (mappingsFolder) {
        for (const [key, mapping] of Object.entries(bundle.mappings)) {
          mappingsFolder.file(`${key}.json`, JSON.stringify(mapping, null, 2));
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [session]);

  const handleOpenInStudio = useCallback(() => {
    const bundle = session.exportBundle();
    const handoffId = Math.random().toString(36).substring(2, 11);
    const storageKey = `formspec-handoff:${handoffId}`;

    try {
      localStorage.setItem(storageKey, JSON.stringify(bundle));
      
      // Navigate to the studio app. 
      // With base: '/studio/' set in vite config, this works in both dev and prod.
      window.location.href = `/studio/?h=${handoffId}`;
    } catch (err) {
      console.error('Handoff failed', err);
      alert('Failed to prepare project for Studio. The definition may be too large for local storage.');
    }
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
            <span
              data-testid="issue-count"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-amber/10 text-amber border border-amber/25"
            >
              <IconWarning />
              {state.openIssueCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {(state.hasDefinition || state.scaffoldingText != null) && (
            <>
              {/* Mobile-only: segmented view toggle */}
              <div className="flex lg:hidden items-center rounded-md bg-subtle border border-border p-0.5">
                <button
                  onClick={() => setMobileView('chat')}
                  aria-pressed={mobileView === 'chat'}
                  data-testid="mobile-chat-btn"
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
                  data-testid="mobile-preview-btn"
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
                onClick={handleOpenInStudio}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-border text-muted hover:text-ink hover:border-accent/50 transition-colors"
                title="Open this form in the full Studio editor"
              >
                <IconExternal />
                <span className="hidden sm:inline">Open in Studio</span>
              </button>

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

      {/* Content — left sidebar | chat | preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — always visible, toggles between Issues and Debug */}
        <div className="hidden lg:flex flex-col w-[280px] shrink-0 border-r border-border bg-surface">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
            {(['issues', 'debug'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setShowDebug(tab === 'debug')}
                className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors ${
                  (tab === 'debug') === showDebug
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-ink hover:bg-subtle'
                }`}
              >
                {tab === 'issues' && state.openIssueCount > 0
                  ? `Issues (${state.openIssueCount})`
                  : tab === 'debug'
                    ? `Debug (${state.debugLog.length})`
                    : 'Issues'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {showDebug ? <DebugLog entries={state.debugLog} /> : <IssuePanel />}
          </div>
        </div>

        {/* Chat pane — always visible on desktop, toggled on mobile */}
        <div className={[
          'flex flex-col',
          // Mobile: full width when active, hidden when preview
          mobileView === 'chat' ? 'flex-1' : 'hidden',
          // Desktop: always visible, takes remaining width
          'lg:flex lg:flex-1 lg:min-w-0',
        ].join(' ')}>
          <ChatPanel onUpload={onUpload} />
        </div>

        {/* Preview pane — visible when definition exists OR scaffolding is streaming */}
        {(state.hasDefinition || state.scaffoldingText != null) && (
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
      </div>
    </div>
  );
}

// ── Debug Log ──────────────────────────────────────────────────────

function DebugLog({ entries }: { entries: import('formspec-chat').DebugEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-xs text-muted/60 italic">No debug entries yet</p>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-1.5">
      {entries.map((entry, i) => (
        <DebugLogEntry key={i} entry={entry} />
      ))}
    </div>
  );
}

function DebugLogEntry({ entry }: { entry: import('formspec-chat').DebugEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const directionStyle = {
    sent: 'text-accent',
    received: 'text-green',
    error: 'text-error',
  }[entry.direction];

  const directionIcon = {
    sent: '\u2192',   // →
    received: '\u2190', // ←
    error: '\u2717',   // ✗
  }[entry.direction];

  let preview: string;
  try {
    const s = JSON.stringify(entry.data);
    preview = s.length > 80 ? s.slice(0, 80) + '\u2026' : s;
  } catch {
    preview = String(entry.data);
  }

  return (
    <div className="rounded border border-border bg-bg-default text-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-subtle/50 transition-colors"
      >
        <span className={`font-mono font-bold ${directionStyle}`}>{directionIcon}</span>
        <span className="font-mono text-muted/70">{time}</span>
        <span className="font-medium text-ink truncate">{entry.label}</span>
        <span className="ml-auto text-muted/40 text-[10px]">{expanded ? '\u25BC' : '\u25B6'}</span>
      </button>
      {!expanded && (
        <div className="px-2 pb-1.5 -mt-0.5">
          <span className="font-mono text-[10px] text-muted/50 break-all">{preview}</span>
        </div>
      )}
      {expanded && (
        <pre className="px-2 pb-2 font-mono text-[10px] text-ink overflow-x-auto max-h-[300px] overflow-y-auto border-t border-border mt-0.5 pt-1.5 whitespace-pre-wrap break-all">
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
